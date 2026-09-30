"""Overclock core API — PRD §14, MVP scope from §15."""
import asyncio
import logging
import os
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

import jwt
import redis.asyncio as aioredis
from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import motivator, push, reframing, scheduler
from . import reflection as reflection_agent
from .db import EnergyLog, FocusSession, Idea, PushSubscription, Reminder, ReflectionSummary, Session, Subtask, Task, User, now

log = logging.getLogger(__name__)

CLERK_JWKS_URL = os.environ.get("CLERK_JWKS_URL")
# Browser origins allowed to present tokens (Clerk's `azp` claim). Native app tokens carry no azp.
CLERK_AUTHORIZED_PARTIES = {o for o in os.environ.get("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000").split(",") if o}
DEV_AUTH_USER = os.environ.get("DEV_AUTH_USER")  # local only: every request is this user
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", "120"))
GUARDRAIL_AFTER_MIN = 120  # §7 Pillar 4: gentle full-screen interrupt after 2h continuous
RESURFACE_AFTER = timedelta(days=1)  # §15: fixed interval, adaptive spacing is Phase 2
DAILY_XP_CAP = 100  # §3.6: bounded progression, a reachable end state per day
XP_PER_TASK = 10
HYPERFOCUS_AFTER_MIN = 45  # §7 Pillar 4: sustained single-task engagement before we call it flow
CRISIS_OVERUSE_AFTER = 5  # crisis sprints in 14 days before we mention the pattern

_jwks = jwt.PyJWKClient(CLERK_JWKS_URL) if CLERK_JWKS_URL else None
_redis = aioredis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if DEV_AUTH_USER:
        log.warning("DEV_AUTH_USER is set — authentication is DISABLED. Never set this outside local dev.")
    if os.environ.get("MIGRATE_ON_STARTUP", "1") == "1":
        # ponytail: fine for one instance; with several replicas run `alembic upgrade head` as a deploy step instead.
        await asyncio.to_thread(_migrate)
    ticker = asyncio.create_task(scheduler.run()) if os.environ.get("SCHEDULER", "1") == "1" else None
    yield
    if ticker:
        ticker.cancel()


def _migrate() -> None:
    cfg = AlembicConfig(str(Path(__file__).parent.parent / "alembic.ini"))
    cfg.attributes["configure_logger"] = False
    alembic_command.upgrade(cfg, "head")


app = FastAPI(title="Overclock API", lifespan=lifespan)
api = APIRouter(prefix="/api/v1")


# ---------- auth + rate limiting (both on every endpoint, §16) ----------

async def get_db():
    async with Session() as s:
        yield s


Db = Annotated[AsyncSession, Depends(get_db)]


def _user_id_from(request: Request) -> str:
    if DEV_AUTH_USER:
        return DEV_AUTH_USER
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(401, "Not signed in")
    return _user_id_from_token(header.removeprefix("Bearer "))


def _user_id_from_token(token: str) -> str:
    """Shared by HTTP and the room WebSocket, which carries its token in the query string."""
    if DEV_AUTH_USER:
        return DEV_AUTH_USER
    if not _jwks:
        raise HTTPException(401, "Not signed in")
    try:
        key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], leeway=5)
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired — please sign in again")
    if claims.get("azp") and claims["azp"] not in CLERK_AUTHORIZED_PARTIES:
        raise HTTPException(401, "Not signed in")
    return claims["sub"]


async def rate_limit(user_id: str) -> None:
    key = f"rl:{user_id}:{int(now().timestamp() // 60)}"
    try:
        count = await _redis.incr(key)
        if count == 1:
            await _redis.expire(key, 60)
    except aioredis.RedisError as e:
        log.error("rate limiter unavailable, failing open: %s", e)
        return
    if count > RATE_LIMIT_PER_MIN:
        raise HTTPException(429, "Slow down a little — try again in a minute")


async def current_user(request: Request, db: Db) -> User:
    user_id = _user_id_from(request)
    await rate_limit(user_id)
    user = await db.get(User, user_id)
    if not user:
        user = User(id=user_id)
        db.add(user)
        await db.commit()
    return user


Me = Annotated[User, Depends(current_user)]


# ---------- schemas ----------

class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    order_index: int
    status: str


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    raw_input_text: str
    source: str
    status: str
    category: str | None
    reframed_title: str | None
    first_step: str | None
    applied_pinch_lever: str | None
    reframe_accepted: bool | None
    estimated_duration_raw: int | None
    estimated_duration_padded: int | None
    actual_duration: int | None
    due_at: datetime | None
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    captured_at: datetime
    completed_at: datetime | None
    subtasks: list[SubtaskOut]


class CaptureIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    source: Literal["text", "voice", "photo"] = "text"
    due_at: datetime | None = None


class TaskPatch(BaseModel):
    status: Literal["inbox", "scheduled", "in_progress", "done", "archived"] | None = None
    reframe_accepted: bool | None = None
    due_at: datetime | None = None
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None


class CompleteIn(BaseModel):
    actual_duration: int | None = Field(None, ge=1, le=24 * 60)


class SessionStartIn(BaseModel):
    task_id: str | None = None
    type: Literal["manual", "hyperfocus_detected", "crisis_sprint"] = "manual"


class GuardrailAckIn(BaseModel):
    kind: Literal["hydration", "movement", "meal"]


class EnergyIn(BaseModel):
    energy_level: int = Field(ge=1, le=5)
    mood_tag: str | None = Field(None, max_length=40)
    optional_medication_note: str | None = Field(None, max_length=200)


class Preferences(BaseModel):
    calm_mode: bool = False  # §17: less color and motion for overwhelm moments
    dyslexia_font: bool = False  # §17
    reminder_offsets: list[int] = Field([15, 10, 5], max_length=5)  # §7 Pillar 2: minutes before a boundary

    @field_validator("reminder_offsets")
    @classmethod
    def _offsets(cls, v: list[int]) -> list[int]:
        if any(not 1 <= m <= 120 for m in v):
            raise ValueError("reminders must be 1-120 minutes before")
        return sorted(set(v), reverse=True)


class PreferencesPatch(BaseModel):
    calm_mode: bool | None = None
    dyslexia_font: bool | None = None
    reminder_offsets: list[int] | None = None


class OnboardingIn(BaseModel):
    display_name: str | None = Field(None, max_length=80)
    timezone: str = "UTC"
    profile: dict = {}
    accept_disclaimer: bool


# ---------- tasks ----------

async def _own_task(db: AsyncSession, me: User, task_id: str) -> Task:
    task = await db.get(Task, task_id)
    if not task or task.user_id != me.id:
        raise HTTPException(404, "Task not found")
    return task


@api.post("/tasks/capture", response_model=TaskOut)
async def capture(body: CaptureIn, me: Me, db: Db, background: BackgroundTasks):
    """Saves and returns instantly; the reframe lands a few seconds later (clients refetch)."""
    task = Task(user_id=me.id, raw_input_text=body.text, source=body.source, due_at=body.due_at, subtasks=[])
    db.add(task)
    await db.commit()
    background.add_task(_reframe_later, task.id)
    return task


async def _reframe_later(task_id: str) -> None:
    """Runs after the response. If the model is down or out of quota, the scheduler retries later."""
    async with Session() as db:
        task = await db.get(Task, task_id)
        if task:
            await reframing.apply(db, await db.get(User, task.user_id), task)
            await db.commit()


ENERGY_FIT = {  # §7 Pillar 5: what fits my energy right now
    1: {"chore", "admin", "social"},
    2: {"chore", "admin", "social"},
    3: {"chore", "admin", "social", "study"},
}


@api.get("/tasks", response_model=list[TaskOut])
async def list_tasks(me: Me, db: Db, status: str | None = None, energy: int | None = None):
    q = select(Task).where(Task.user_id == me.id).order_by(Task.captured_at.desc())
    q = q.where(Task.status == status) if status else q.where(Task.status.not_in(["done", "archived"]))
    tasks = (await db.scalars(q)).all()
    if energy in ENERGY_FIT:
        tasks = [t for t in tasks if t.category is None or t.category in ENERGY_FIT[energy]]
    elif energy:  # high energy: hardest, most interesting work first
        tasks.sort(key=lambda t: t.category not in ("deep_work", "creative"))
    return tasks


@api.get("/tasks/resurface", response_model=list[TaskOut])
async def resurface(me: Me, db: Db):
    """§7 Pillar 3: re-show forgotten inbox items so the user never has to remember to look."""
    cutoff = now() - RESURFACE_AFTER
    tasks = (await db.scalars(
        select(Task).where(
            Task.user_id == me.id,
            Task.status == "inbox",
            Task.captured_at < cutoff,
            (Task.last_surfaced_at.is_(None)) | (Task.last_surfaced_at < cutoff),
        ).order_by(Task.last_surfaced_at.nulls_first(), Task.captured_at).limit(3)  # few choices per screen (§17)
    )).all()
    for t in tasks:
        t.last_surfaced_at = now()
    await db.commit()
    return tasks


@api.patch("/tasks/{task_id}", response_model=TaskOut)
async def patch_task(task_id: str, body: TaskPatch, me: Me, db: Db):
    task = await _own_task(db, me, task_id)
    fields = body.model_dump(exclude_unset=True)
    for k, v in fields.items():
        setattr(task, k, v)
    if {"scheduled_start", "status"} & fields.keys():
        await scheduler.schedule_task_reminders(db, me, task)
    await db.commit()
    return task


@api.post("/tasks/{task_id}/reframe", response_model=TaskOut)
async def rereframe(task_id: str, me: Me, db: Db):
    task = await _own_task(db, me, task_id)
    await reframing.apply(db, me, task)
    await db.commit()
    return task


@api.post("/tasks/{task_id}/complete", response_model=TaskOut)
async def complete(task_id: str, body: CompleteIn, me: Me, db: Db):
    task = await _own_task(db, me, task_id)
    task.status, task.completed_at = "done", now()
    if body.actual_duration:
        task.actual_duration = body.actual_duration
    await scheduler.schedule_task_reminders(db, me, task)  # nothing pending for a finished task
    await db.commit()
    return task


# ---------- focus sessions (manual-start hyperfocus, §15) ----------

async def _own_session(db: AsyncSession, me: User, session_id: str) -> FocusSession:
    fs = await db.get(FocusSession, session_id)
    if not fs or fs.user_id != me.id:
        raise HTTPException(404, "Session not found")
    return fs


@api.post("/focus-sessions/start")
async def start_session(body: SessionStartIn, me: Me, db: Db):
    if body.task_id:
        task = await _own_task(db, me, body.task_id)
        task.status = "in_progress"
    fs = FocusSession(user_id=me.id, task_id=body.task_id, type=body.type)
    db.add(fs)
    await db.commit()
    return {
        "id": fs.id, "started_at": fs.started_at,
        "guardrail_after_minutes": GUARDRAIL_AFTER_MIN,
        "hyperfocus_after_minutes": HYPERFOCUS_AFTER_MIN,
    }


@api.post("/focus-sessions/{session_id}/end")
async def end_session(session_id: str, me: Me, db: Db, interruption_count: int = 0):
    fs = await _own_session(db, me, session_id)
    fs.ended_at, fs.interruption_count = now(), interruption_count
    await db.commit()
    return {"id": fs.id, "minutes": round((fs.ended_at - fs.started_at).total_seconds() / 60)}


class HyperfocusIn(BaseModel):
    detected: bool = True


@api.post("/focus-sessions/{session_id}/hyperfocus")
async def mark_hyperfocus(session_id: str, body: HyperfocusIn, me: Me, db: Db):
    """Passive detection (§7 Pillar 4). The client notices the pattern; the server checks it really held,
    so a false positive can't relabel a two-minute session — and the user can always undo it (§19)."""
    fs = await _own_session(db, me, session_id)
    if not body.detected:
        fs.type = "manual"
    else:
        elapsed_min = (now() - fs.started_at).total_seconds() / 60
        if elapsed_min < HYPERFOCUS_AFTER_MIN or fs.interruption_count or fs.task_id is None:
            raise HTTPException(409, "Not a flow session (yet)")
        fs.type = "hyperfocus_detected"
    await db.commit()
    return {"type": fs.type, "hyperfocus_after_minutes": HYPERFOCUS_AFTER_MIN}


@api.post("/focus-sessions/{session_id}/guardrail-ack")
async def guardrail_ack(session_id: str, body: GuardrailAckIn, me: Me, db: Db):
    fs = await _own_session(db, me, session_id)
    fs.guardrail_prompts_triggered = [*fs.guardrail_prompts_triggered, {"kind": body.kind, "at": now().isoformat()}]
    await db.commit()
    return {"ok": True}


# ---------- push subscriptions (§7 Pillar 2) ----------

class PushIn(BaseModel):
    platform: Literal["web", "expo"]
    endpoint: str = Field(min_length=1, max_length=2000)
    keys: dict = {}


@api.get("/push/key")
async def push_key():
    """The browser needs this public key to subscribe. Public by design."""
    return {"vapid_public_key": push.VAPID_PUBLIC_KEY}


@api.post("/push/subscriptions")
async def add_push_subscription(body: PushIn, me: Me, db: Db):
    existing = await db.scalar(
        select(PushSubscription).where(PushSubscription.user_id == me.id, PushSubscription.endpoint == body.endpoint)
    )
    if not existing:
        db.add(PushSubscription(user_id=me.id, platform=body.platform, endpoint=body.endpoint, keys=body.keys))
        await db.commit()
    return {"ok": True}


@api.delete("/push/subscriptions")
async def remove_push_subscription(body: PushIn, me: Me, db: Db):
    await db.execute(
        delete(PushSubscription).where(PushSubscription.user_id == me.id, PushSubscription.endpoint == body.endpoint)
    )
    await db.commit()
    return {"ok": True}


# ---------- idea vault (§7 Pillar 9) ----------

class IdeaIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class IdeaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    text: str
    created_at: datetime
    promoted_task_id: str | None


@api.post("/ideas", response_model=IdeaOut)
async def add_idea(body: IdeaIn, me: Me, db: Db):
    idea = Idea(user_id=me.id, text=body.text)
    db.add(idea)
    await db.commit()
    return idea


@api.get("/ideas", response_model=list[IdeaOut])
async def list_ideas(me: Me, db: Db):
    return (await db.scalars(
        select(Idea).where(Idea.user_id == me.id, Idea.archived_at.is_(None)).order_by(Idea.created_at.desc())
    )).all()


@api.delete("/ideas/{idea_id}")
async def archive_idea(idea_id: str, me: Me, db: Db):
    idea = await db.get(Idea, idea_id)
    if not idea or idea.user_id != me.id:
        raise HTTPException(404, "Idea not found")
    idea.archived_at = now()
    await db.commit()
    return {"ok": True}


@api.post("/ideas/{idea_id}/promote", response_model=TaskOut)
async def promote_idea(idea_id: str, me: Me, db: Db, background: BackgroundTasks):
    """Turn an idea into a real task — the only path from the vault into the task list."""
    idea = await db.get(Idea, idea_id)
    if not idea or idea.user_id != me.id:
        raise HTTPException(404, "Idea not found")
    if idea.promoted_task_id:
        raise HTTPException(409, "That one is already on your task list")
    task = Task(user_id=me.id, raw_input_text=idea.text, source="text", subtasks=[])
    db.add(task)
    await db.flush()
    idea.promoted_task_id, idea.archived_at = task.id, now()
    await db.commit()
    background.add_task(_reframe_later, task.id)
    return task


# ---------- focus rooms: body doubling, presence only (§7 Pillar 7) ----------

ROOMS = {"deep_work": "Deep work", "admin": "Admin & chores", "study": "Study"}

# ponytail: in-process presence, so one API instance. Move to Redis pub/sub (§10) before running two.
_rooms: dict[str, list[tuple[str, str, WebSocket]]] = {room: [] for room in ROOMS}


def _presence(room: str) -> dict:
    seen: dict[str, str] = {}
    for user_id, name, _ in _rooms[room]:
        seen[user_id] = name
    return {"room": room, "count": len(seen), "people": [{"id": i, "name": n} for i, n in seen.items()]}


async def _broadcast(room: str) -> None:
    message = _presence(room)
    for _, _, socket in list(_rooms[room]):
        try:
            await socket.send_json(message)
        except (WebSocketDisconnect, RuntimeError):
            pass  # it will be cleaned up when its own handler unwinds


@api.get("/focus-rooms")
async def focus_rooms(me: Me):
    return [{"id": room, "theme": title, **_presence(room)} for room, title in ROOMS.items()]


@app.websocket("/ws/focus-room/{room}")
async def focus_room(socket: WebSocket, room: str, token: str = ""):
    """Silent co-working: who else is here, nothing more. No audio, no video, no chat."""
    if room not in ROOMS:
        await socket.close(code=4404)
        return
    try:
        user_id = _user_id_from_token(token)
    except HTTPException:
        await socket.close(code=4401)
        return

    await socket.accept()
    async with Session() as db:
        user = await db.get(User, user_id)
        if not user:  # first contact can be a socket, not an HTTP call
            user = User(id=user_id)
            db.add(user)
            await db.flush()
        name = user.display_name or "Someone"
        session = FocusSession(user_id=user_id, type="focus_room")
        db.add(session)
        await db.commit()

    _rooms[room].append((user_id, name, socket))
    await _broadcast(room)
    try:
        while True:
            await socket.receive_text()  # keepalives; nothing to act on
    except WebSocketDisconnect:
        pass
    finally:
        _rooms[room] = [entry for entry in _rooms[room] if entry[2] is not socket]
        await _broadcast(room)
        async with Session() as db:
            ended = await db.get(FocusSession, session.id)
            if ended:
                ended.ended_at = now()
                await db.commit()


# ---------- energy ----------

@api.post("/energy-logs")
async def log_energy(body: EnergyIn, me: Me, db: Db):
    entry = EnergyLog(user_id=me.id, **body.model_dump())
    db.add(entry)
    await db.commit()
    return {"id": entry.id, "logged_at": entry.logged_at}


# ---------- insights (§15: completion rate, streak, energy trend — no AI reflection yet) ----------

@api.get("/insights/weekly")
async def weekly(me: Me, db: Db):
    return await _weekly_metrics(me, db)


async def _weekly_metrics(me: User, db: AsyncSession) -> dict:
    tz = ZoneInfo(me.timezone)
    since = now() - timedelta(days=7)
    captured = (await db.scalars(select(Task).where(Task.user_id == me.id, Task.captured_at >= since))).all()
    done_times = (await db.scalars(
        select(Task.completed_at).where(Task.user_id == me.id, Task.completed_at.is_not(None))
    )).all()
    energy = (await db.execute(
        select(EnergyLog.logged_at, EnergyLog.energy_level).where(EnergyLog.user_id == me.id, EnergyLog.logged_at >= since)
    )).all()

    def rate(tasks):
        return round(sum(t.status == "done" for t in tasks) / len(tasks), 2) if tasks else None

    per_day = Counter(t.astimezone(tz).date() for t in done_times)
    xp = sum(min(n * XP_PER_TASK, DAILY_XP_CAP) for n in per_day.values())
    week_days = {(now() - timedelta(days=i)).astimezone(tz).date() for i in range(7)}
    by_day = defaultdict(list)
    for at, level in energy:
        by_day[at.astimezone(tz).date().isoformat()].append(level)

    flow = (await db.execute(
        select(FocusSession.started_at, FocusSession.ended_at, Task.category)
        .join(Task, Task.id == FocusSession.task_id, isouter=True)
        .where(
            FocusSession.user_id == me.id,
            FocusSession.type == "hyperfocus_detected",
            FocusSession.started_at >= now() - timedelta(days=14),
        )
    )).all()
    flow_hours = Counter(start.astimezone(tz).hour for start, _, _ in flow)
    flow_categories = Counter(category for _, _, category in flow if category)

    # §7 Pillar 10: show which reframe styles actually work for this person
    levers = await reframing.lever_stats(db, me.id)
    ranked = sorted(
        ({"lever": lever, "started": started, "reframed": total, "rate": round(started / total, 2)}
         for lever, (started, total) in levers.items() if total >= 3),
        key=lambda row: row["rate"], reverse=True,
    )

    crisis_recently = await db.scalar(
        select(func.count()).select_from(FocusSession).where(
            FocusSession.user_id == me.id,
            FocusSession.type == "crisis_sprint",
            FocusSession.started_at >= now() - timedelta(days=14),
        )
    )
    return {
        "completion_rate": rate(captured),
        "completion_rate_reframed": rate([t for t in captured if t.reframed_title]),
        "completion_rate_unreframed": rate([t for t in captured if not t.reframed_title]),
        # "reset, not restart" (§7 Pillar 6): count days you showed up; gaps never zero anything out
        "days_active_this_week": len(week_days & per_day.keys()),
        "days_active_total": len(per_day),
        "xp": xp,
        "level": xp // 500 + 1,
        "xp_today": min(per_day[now().astimezone(tz).date()] * XP_PER_TASK, DAILY_XP_CAP),
        "xp_daily_cap": DAILY_XP_CAP,
        "energy_by_day": {d: round(sum(v) / len(v), 1) for d, v in sorted(by_day.items())},
        # §7 Pillar 8: surface chronic crisis-mode use honestly; living in crunch is a burnout risk, not a strategy
        "levers_ranked": ranked,
        "best_lever": ranked[0] if ranked else None,
        "weakest_lever": ranked[-1] if len(ranked) > 1 else None,
        # §7 Pillar 4: learn to engineer the on-ramp instead of waiting for flow to happen
        "hyperfocus_sessions_14d": len(flow),
        "hyperfocus_peak_hour": flow_hours.most_common(1)[0][0] if flow_hours else None,
        "hyperfocus_top_category": flow_categories.most_common(1)[0][0] if flow_categories else None,
        "crisis_sprints_14d": crisis_recently,
        "crisis_overuse": crisis_recently >= CRISIS_OVERUSE_AFTER,
    }


@api.get("/insights/reflection")
async def reflection(me: Me, db: Db, regenerate: bool = False):
    """One plain-language summary per week, written once and then reused."""
    tz = ZoneInfo(me.timezone)
    today = now().astimezone(tz).date()
    week_start = today - timedelta(days=today.weekday())  # Monday
    existing = await db.scalar(
        select(ReflectionSummary).where(ReflectionSummary.user_id == me.id, ReflectionSummary.week_start == week_start)
    )
    if existing and not regenerate:
        return {"week_start": week_start, "text": existing.generated_text}

    metrics = await _weekly_metrics(me, db)
    text = await reflection_agent.summarize(metrics)
    if not text:
        raise HTTPException(503, "Couldn’t write your reflection just now. Try again in a bit.")
    if existing:
        existing.generated_text, existing.metrics_snapshot = text, metrics
    else:
        db.add(ReflectionSummary(user_id=me.id, week_start=week_start, generated_text=text, metrics_snapshot=metrics))
    await db.commit()
    return {"week_start": week_start, "text": text}


# ---------- account: onboarding, export, deletion (§8, §16) ----------

DISCLAIMER = (
    "Overclock is a productivity tool, not a medical device. It does not diagnose, treat or cure ADHD "
    "and is not a substitute for professional care."
)


@api.get("/me")
async def get_me(me: Me):
    return {
        "id": me.id, "display_name": me.display_name, "timezone": me.timezone,
        "onboarded": me.disclaimer_accepted_at is not None, "disclaimer": DISCLAIMER,
        "preferences": Preferences(**me.preferences or {}).model_dump(),
    }


@api.patch("/me/preferences")
async def set_preferences(body: PreferencesPatch, me: Me, db: Db):
    try:
        prefs = Preferences(**{**(me.preferences or {}), **body.model_dump(exclude_none=True)})
    except ValidationError as e:
        raise HTTPException(422, e.errors()[0]["msg"])
    me.preferences = prefs.model_dump()
    await db.commit()
    return me.preferences


@api.post("/me/onboarding")
async def onboarding(body: OnboardingIn, me: Me, db: Db):
    if not body.accept_disclaimer:
        raise HTTPException(400, "Please read and accept the note about what Overclock is and isn't")
    try:
        ZoneInfo(body.timezone)
    except (KeyError, ValueError):
        raise HTTPException(400, "Unknown timezone")
    me.display_name, me.timezone, me.onboarding_profile = body.display_name, body.timezone, body.profile
    me.disclaimer_accepted_at = now()
    await db.commit()
    return {"ok": True}


@api.get("/me/export")
async def export(me: Me, db: Db):
    def rows(objs):
        return [{c.name: getattr(o, c.name) for c in o.__table__.columns} for o in objs]

    tasks = (await db.scalars(select(Task).where(Task.user_id == me.id))).all()
    return {
        "user": rows([me])[0],
        "tasks": rows(tasks),
        "subtasks": rows([s for t in tasks for s in t.subtasks]),
        "focus_sessions": rows((await db.scalars(select(FocusSession).where(FocusSession.user_id == me.id))).all()),
        "energy_logs": rows((await db.scalars(select(EnergyLog).where(EnergyLog.user_id == me.id))).all()),
        "reflections": rows((await db.scalars(select(ReflectionSummary).where(ReflectionSummary.user_id == me.id))).all()),
        "ideas": rows((await db.scalars(select(Idea).where(Idea.user_id == me.id))).all()),
    }


@api.delete("/me")
async def delete_me(me: Me, db: Db):
    task_ids = select(Task.id).where(Task.user_id == me.id)
    for stmt in (
        delete(Subtask).where(Subtask.task_id.in_(task_ids)),
        delete(FocusSession).where(FocusSession.user_id == me.id),
        delete(ReflectionSummary).where(ReflectionSummary.user_id == me.id),
        delete(Idea).where(Idea.user_id == me.id),
        delete(Reminder).where(Reminder.user_id == me.id),
        delete(PushSubscription).where(PushSubscription.user_id == me.id),
        delete(EnergyLog).where(EnergyLog.user_id == me.id),
        delete(Task).where(Task.user_id == me.id),
        delete(User).where(User.id == me.id),
    ):
        await db.execute(stmt)
    await db.commit()
    return {"deleted": True}


@app.get("/health")
async def health():
    return {"ok": True}


app.include_router(api)
