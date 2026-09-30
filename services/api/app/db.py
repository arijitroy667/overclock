"""Core entities from PRD §13 (no FocusRoom / PersonalizationMemory yet)."""
import os
import uuid
from datetime import date, datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import JSON, Date, DateTime, ForeignKey, NullPool, String, Text, UniqueConstraint
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://overclock:overclock@localhost:5433/overclock")


def _for_asyncpg(url: str) -> tuple[str, dict]:
    """Hosted Postgres hands out libpq URLs; asyncpg needs its own scheme and rejects libpq-only params."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break
    parts = urlsplit(url)
    params = dict(parse_qsl(parts.query))
    sslmode = params.pop("sslmode", None)
    params.pop("channel_binding", None)  # libpq-only, and asyncpg errors on it
    connect_args = {"ssl": True} if sslmode and sslmode != "disable" else {}
    return urlunsplit(parts._replace(query=urlencode(params))), connect_args


_url, _connect_args = _for_asyncpg(DATABASE_URL)
# DB_POOL=none: a connection per use. Only for tests, where the WebSocket test client runs handlers on
# its own event loop and pooled asyncpg connections belong to the loop that opened them.
engine = create_async_engine(
    _url, connect_args=_connect_args, **({"poolclass": NullPool} if os.environ.get("DB_POOL") == "none" else {})
)
Session = async_sessionmaker(engine, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True), date: Date()}


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # Clerk user id
    email: Mapped[str | None]
    display_name: Mapped[str | None]
    timezone: Mapped[str] = mapped_column(default="UTC")
    created_at: Mapped[datetime] = mapped_column(default=now)
    onboarding_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")  # calm mode, font, reminder offsets
    disclaimer_accepted_at: Mapped[datetime | None]


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    raw_input_text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(default="text")  # text | voice | photo
    captured_at: Mapped[datetime] = mapped_column(default=now)
    status: Mapped[str] = mapped_column(default="inbox")  # inbox | scheduled | in_progress | done | archived
    category: Mapped[str | None]  # deep_work | admin | creative | social | chore | study
    reframed_title: Mapped[str | None]
    first_step: Mapped[str | None]
    applied_pinch_lever: Mapped[str | None]
    reframe_accepted: Mapped[bool | None]
    estimated_duration_raw: Mapped[int | None]  # minutes
    estimated_duration_padded: Mapped[int | None]
    actual_duration: Mapped[int | None]
    due_at: Mapped[datetime | None]  # the real deadline; reframing never touches it
    scheduled_start: Mapped[datetime | None]
    scheduled_end: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    last_surfaced_at: Mapped[datetime | None]
    reframe_attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    reframe_attempted_at: Mapped[datetime | None]
    subtasks: Mapped[list["Subtask"]] = relationship(
        order_by="Subtask.order_index", cascade="all, delete-orphan", lazy="selectin"
    )


class Subtask(Base):
    __tablename__ = "subtasks"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    title: Mapped[str]
    order_index: Mapped[int]
    status: Mapped[str] = mapped_column(default="todo")


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    type: Mapped[str] = mapped_column(default="manual")  # manual | hyperfocus_detected | crisis_sprint | focus_room
    started_at: Mapped[datetime] = mapped_column(default=now)
    ended_at: Mapped[datetime | None]
    interruption_count: Mapped[int] = mapped_column(default=0)
    guardrail_prompts_triggered: Mapped[list] = mapped_column(JSON, default=list)


class ReflectionSummary(Base):
    """One plain-language weekly summary per user (§7 Pillar 10, Reflection agent)."""
    __tablename__ = "reflection_summaries"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week_start: Mapped[date]
    generated_text: Mapped[str] = mapped_column(Text)
    metrics_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=now)
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)


class PushSubscription(Base):
    """Where to reach a user when the app is closed: a browser push endpoint or an Expo push token."""
    __tablename__ = "push_subscriptions"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str]  # web | expo
    endpoint: Mapped[str] = mapped_column(Text)  # push URL (web) or ExponentPushToken (expo)
    keys: Mapped[dict] = mapped_column(JSON, default=dict)  # web push p256dh/auth
    created_at: Mapped[datetime] = mapped_column(default=now)
    failed_at: Mapped[datetime | None]
    __table_args__ = (UniqueConstraint("user_id", "endpoint"),)


class Reminder(Base):
    """A queued nudge (§7 Pillar 2). The scheduler sends these whether or not the app is open."""
    __tablename__ = "reminders"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    send_at: Mapped[datetime] = mapped_column(index=True)
    title: Mapped[str]
    body: Mapped[str]
    sent_at: Mapped[datetime | None]


class Idea(Base):
    """Idea Vault (§7 Pillar 9): capture-and-return, deliberately apart from the task list."""
    __tablename__ = "ideas"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=now)
    archived_at: Mapped[datetime | None]
    promoted_task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))


class EnergyLog(Base):
    __tablename__ = "energy_logs"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    logged_at: Mapped[datetime] = mapped_column(default=now)
    energy_level: Mapped[int]  # 1-5
    mood_tag: Mapped[str | None]
    optional_medication_note: Mapped[str | None]
