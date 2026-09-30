import os

os.environ["MIGRATE_ON_STARTUP"] = "0"
os.environ["SCHEDULER"] = "0"
os.environ["DB_POOL"] = "none"  # tests drive the scheduler directly  # tests build the schema from the models directly
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://overclock:overclock@localhost:5433/overclock_test")

import pytest
from fastapi.testclient import TestClient

from app import db, main, motivator
from app import reflection as reflection_agent


async def _reset():
    async with db.engine.begin() as conn:
        await conn.run_sync(db.Base.metadata.drop_all)
        await conn.run_sync(db.Base.metadata.create_all)


@pytest.fixture
def client(monkeypatch):
    def fake_auth(request):
        if "x-test-user" not in request.headers:
            raise main.HTTPException(401)
        return request.headers["x-test-user"]

    monkeypatch.setattr(main, "_user_id_from", fake_auth)
    monkeypatch.setattr(main, "_user_id_from_token", lambda token: token)  # room sockets carry the user in ?token=
    monkeypatch.setattr(main, "rate_limit", lambda uid: _noop())

    async def fake_reframe(text, lever):
        if "offline" in text:
            return None
        return motivator.Reframe(category="admin", reframed_title=f"[{lever}] {text}", first_step="Open the tab",
                                 subtasks=["a", "b"], estimated_minutes=20)

    monkeypatch.setattr(motivator, "reframe", fake_reframe)

    calls = []

    async def fake_summary(metrics):
        calls.append(metrics)
        return f"Nice week. {len(calls)}"

    monkeypatch.setattr(reflection_agent, "summarize", fake_summary)
    main.reflection_calls = calls
    with TestClient(main.app) as c:
        c.portal.call(_reset)
        yield c
        c.portal.call(db.engine.dispose)  # pooled connections are bound to this client's event loop


async def _noop():
    pass


def h(user="u1"):
    return {"x-test-user": user}


def test_capture_to_streak_end_to_end(client):
    captured = client.post("/api/v1/tasks/capture", json={"text": "pay electricity bill"}, headers=h()).json()
    assert captured["reframed_title"] is None  # returned before the reframe ran
    t = client.get("/api/v1/tasks", headers=h()).json()[0]  # background reframe has landed
    assert t["reframed_title"] and t["first_step"] == "Open the tab"
    assert [s["title"] for s in t["subtasks"]] == ["a", "b"]
    assert t["estimated_duration_padded"] == 30  # 20 * default 1.5 pad

    # re-reframe must switch lever (novelty)
    t2 = client.post(f"/api/v1/tasks/{t['id']}/reframe", headers=h()).json()
    assert t2["applied_pinch_lever"] != t["applied_pinch_lever"]

    s = client.post("/api/v1/focus-sessions/start", json={"task_id": t["id"]}, headers=h()).json()
    assert s["guardrail_after_minutes"] == 120
    assert client.post(f"/api/v1/focus-sessions/{s['id']}/guardrail-ack", json={"kind": "hydration"}, headers=h()).json()["ok"]
    client.post(f"/api/v1/focus-sessions/{s['id']}/end", headers=h())
    client.post("/api/v1/energy-logs", json={"energy_level": 2}, headers=h())

    done = client.post(f"/api/v1/tasks/{t['id']}/complete", json={"actual_duration": 40}, headers=h()).json()
    assert done["status"] == "done"

    ins = client.get("/api/v1/insights/weekly", headers=h()).json()
    assert ins["completion_rate"] == 1.0 and ins["days_active_this_week"] == 1 and ins["xp_today"] == 10
    assert list(ins["energy_by_day"].values()) == [2.0]


def test_capture_survives_llm_failure(client):
    t = client.post("/api/v1/tasks/capture", json={"text": "offline thought"}, headers=h()).json()
    assert t["reframed_title"] is None
    assert [x["id"] for x in client.get("/api/v1/tasks", headers=h()).json()] == [t["id"]]


def test_energy_filter(client):
    client.post("/api/v1/tasks/capture", json={"text": "file receipts"}, headers=h())  # admin
    assert len(client.get("/api/v1/tasks?energy=1", headers=h()).json()) == 1
    main_tasks = client.get("/api/v1/tasks?energy=5", headers=h()).json()
    assert len(main_tasks) == 1


def test_users_are_isolated_and_can_delete(client):
    t = client.post("/api/v1/tasks/capture", json={"text": "secret"}, headers=h("u1")).json()
    assert client.get("/api/v1/tasks", headers=h("u2")).json() == []
    assert client.post(f"/api/v1/tasks/{t['id']}/complete", json={}, headers=h("u2")).status_code == 404
    assert client.get("/api/v1/tasks").status_code == 401
    assert client.get("/api/v1/me/export", headers=h("u1")).json()["tasks"][0]["raw_input_text"] == "secret"
    client.delete("/api/v1/me", headers=h("u1"))
    assert client.get("/api/v1/me/export", headers=h("u1")).json()["tasks"] == []


def test_onboarding_requires_disclaimer(client):
    assert client.post("/api/v1/me/onboarding", json={"accept_disclaimer": False}, headers=h()).status_code == 400
    assert client.post("/api/v1/me/onboarding", json={"accept_disclaimer": True, "timezone": "Asia/Kolkata"}, headers=h()).status_code == 200
    assert client.get("/api/v1/me", headers=h()).json()["onboarded"] is True


def test_pad_and_pii():
    assert motivator.pad(10, [(10, 20), (10, 20), (10, 20)]) == 20
    assert motivator.pad(10, [(10, 100)] * 3) == 30  # clamped at 3x
    assert motivator.pad(10, []) == 15
    assert motivator.strip_pii("mail a@b.com or call +91 98765 43210") == "mail [email] or call [number]"


def test_clerk_token_verification(monkeypatch):
    import time
    from types import SimpleNamespace

    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from fastapi import HTTPException

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(main, "DEV_AUTH_USER", None)
    monkeypatch.setattr(main, "_jwks", SimpleNamespace(get_signing_key_from_jwt=lambda t: SimpleNamespace(key=key.public_key())))

    def check(**claims):
        token = jwt.encode({"sub": "user_1", "exp": int(time.time()) + 60, **claims}, key, algorithm="RS256")
        return main._user_id_from(SimpleNamespace(headers={"authorization": f"Bearer {token}"}))

    assert check() == "user_1"  # native app token: no azp
    assert check(azp="http://localhost:3000") == "user_1"
    for bad in ({"azp": "https://evil.example"}, {"exp": int(time.time()) - 60}):
        with pytest.raises(HTTPException):
            check(**bad)
    with pytest.raises(HTTPException):
        main._user_id_from(SimpleNamespace(headers={}))

    # DEV_AUTH_USER still bypasses auth for local development (and only then).
    monkeypatch.setattr(main, "DEV_AUTH_USER", "local-dev")
    assert main._user_id_from(SimpleNamespace(headers={})) == "local-dev"
    assert main._user_id_from_token("") == "local-dev"


def test_preferences(client):
    assert client.get("/api/v1/me", headers=h()).json()["preferences"] == {"calm_mode": False, "dyslexia_font": False, "reminder_offsets": [15, 10, 5]}
    prefs = client.patch("/api/v1/me/preferences", json={"calm_mode": True, "reminder_offsets": [5, 30, 5]}, headers=h()).json()
    assert prefs == {"calm_mode": True, "dyslexia_font": False, "reminder_offsets": [30, 5]}  # merged, deduped, sorted
    assert client.patch("/api/v1/me/preferences", json={"reminder_offsets": [0]}, headers=h()).status_code == 422
    assert client.get("/api/v1/me", headers=h()).json()["preferences"]["calm_mode"] is True


def test_choose_lever_learns_then_explores():
    import random

    from app.motivator import LEVERS, choose_lever

    class Rng(random.Random):
        """Fixed explore/exploit roll; .choice() delegates, since overriding random() would freeze it."""

        def __init__(self, roll):
            super().__init__()
            self.roll = roll
            self.inner = random.Random(7)

        def random(self): return self.roll
        def choice(self, seq): return self.inner.choice(seq)

    exploit, explore = Rng(0.99), Rng(0.0)

    # Under-sampled levers come first, so every lever gets a fair trial.
    assert choose_lever({}) == LEVERS[0]
    assert choose_lever({LEVERS[0]: (1, 4)}) == LEVERS[1]

    # With enough data it picks the lever that actually gets tasks finished...
    tried = {lever: (0, 10) for lever in LEVERS} | {"play": (9, 10)}  # (started, reframed)
    assert choose_lever(tried, exploit) == "play"
    # ...and the explore branch still samples the others, so a stale winner can be overtaken.
    assert len({choose_lever(tried, explore) for _ in range(40)}) > 1


def test_weekly_reflection_is_written_once(client):
    task = client.post("/api/v1/tasks/capture", json={"text": "water the plants"}, headers=h()).json()
    client.post(f"/api/v1/tasks/{task['id']}/complete", json={}, headers=h())
    first = client.get("/api/v1/insights/reflection", headers=h()).json()
    assert first["text"] == "Nice week. 1"
    assert client.get("/api/v1/insights/reflection", headers=h()).json()["text"] == "Nice week. 1"  # cached, no second call
    assert client.get("/api/v1/insights/reflection?regenerate=true", headers=h()).json()["text"] == "Nice week. 2"
    assert "levers_ranked" in main.reflection_calls[-1]  # the agent sees which levers get tasks started
    assert client.get("/api/v1/me/export", headers=h()).json()["reflections"][0]["generated_text"] == "Nice week. 2"


def test_idea_vault_stays_out_of_the_task_list(client):
    idea = client.post("/api/v1/ideas", json={"text": "app that names my houseplants"}, headers=h()).json()
    assert client.get("/api/v1/tasks", headers=h()).json() == []  # ideas never clutter the task list

    task = client.post(f"/api/v1/ideas/{idea['id']}/promote", headers=h()).json()
    assert task["raw_input_text"] == "app that names my houseplants"
    assert client.get("/api/v1/ideas", headers=h()).json() == []  # promoted ideas leave the vault
    assert client.post(f"/api/v1/ideas/{idea['id']}/promote", headers=h()).status_code == 409

    other = client.post("/api/v1/ideas", json={"text": "keep"}, headers=h()).json()
    assert client.delete(f"/api/v1/ideas/{other['id']}", headers=h("u2")).status_code == 404  # not yours
    client.delete(f"/api/v1/ideas/{other['id']}", headers=h())
    assert client.get("/api/v1/ideas", headers=h()).json() == []
    assert len(client.get("/api/v1/me/export", headers=h()).json()["ideas"]) == 2  # archived, not erased


def test_crisis_sprints_are_counted_and_flagged(client):
    for _ in range(main.CRISIS_OVERUSE_AFTER - 1):
        client.post("/api/v1/focus-sessions/start", json={"type": "crisis_sprint"}, headers=h())
    insights = client.get("/api/v1/insights/weekly", headers=h()).json()
    assert insights["crisis_sprints_14d"] == main.CRISIS_OVERUSE_AFTER - 1 and insights["crisis_overuse"] is False

    client.post("/api/v1/focus-sessions/start", json={"type": "crisis_sprint"}, headers=h())
    assert client.get("/api/v1/insights/weekly", headers=h()).json()["crisis_overuse"] is True


def test_hyperfocus_needs_a_session_that_actually_held(client):
    from datetime import timedelta

    from app.db import FocusSession, Session as DbSession, now

    task = client.post("/api/v1/tasks/capture", json={"text": "write the chapter"}, headers=h()).json()
    started = client.post("/api/v1/focus-sessions/start", json={"task_id": task["id"]}, headers=h()).json()
    assert started["hyperfocus_after_minutes"] == main.HYPERFOCUS_AFTER_MIN

    # A fresh session is never flow, however loudly the client claims it.
    assert client.post(f"/api/v1/focus-sessions/{started['id']}/hyperfocus", json={}, headers=h()).status_code == 409

    async def age_session():
        async with DbSession() as db:
            fs = await db.get(FocusSession, started["id"])
            fs.started_at = now() - timedelta(minutes=main.HYPERFOCUS_AFTER_MIN + 1)
            await db.commit()

    client.portal.call(age_session)
    assert client.post(f"/api/v1/focus-sessions/{started['id']}/hyperfocus", json={}, headers=h()).json()["type"] == "hyperfocus_detected"
    insights = client.get("/api/v1/insights/weekly", headers=h()).json()
    assert insights["hyperfocus_sessions_14d"] == 1 and insights["hyperfocus_top_category"] == "admin"

    # "Actually, no" puts it back — false positives must be undoable (§19).
    undo = client.post(f"/api/v1/focus-sessions/{started['id']}/hyperfocus", json={"detected": False}, headers=h()).json()
    assert undo["type"] == "manual"
    assert client.get("/api/v1/insights/weekly", headers=h()).json()["hyperfocus_sessions_14d"] == 0


def test_reminders_are_queued_sent_and_cancelled(client, monkeypatch):
    from datetime import timedelta

    from app import push as push_module
    from app import scheduler
    from app.db import Reminder, Session as DbSession, now

    sent = []

    async def fake_send(subscription, title, body):
        sent.append((subscription.platform, title))
        return True

    monkeypatch.setattr(push_module, "send", fake_send)
    client.post("/api/v1/push/subscriptions", json={"platform": "web", "endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}, headers=h())
    client.post("/api/v1/push/subscriptions", json={"platform": "web", "endpoint": "https://push.example/abc", "keys": {}}, headers=h())  # idempotent

    task = client.post("/api/v1/tasks/capture", json={"text": "call the bank"}, headers=h()).json()
    start = (now() + timedelta(minutes=20)).isoformat()
    client.patch(f"/api/v1/tasks/{task['id']}", json={"scheduled_start": start, "status": "scheduled"}, headers=h())

    async def pending():
        async with DbSession() as db:
            return list(await db.scalars(select_reminders()))

    def select_reminders():
        from sqlalchemy import select
        return select(Reminder).where(Reminder.sent_at.is_(None)).order_by(Reminder.send_at)

    queued = client.portal.call(pending)
    assert [r.title.split()[0] for r in queued] == ["15", "10", "5", "Now:"]  # defaults, minus the ones already past

    async def make_all_due():
        async with DbSession() as db:
            for reminder in await db.scalars(select_reminders()):
                reminder.send_at = now() - timedelta(seconds=1)
            await db.commit()

    client.portal.call(make_all_due)
    assert client.portal.call(scheduler.deliver_due) == 4
    assert len(sent) == 4 and sent[0][0] == "web"
    assert client.portal.call(scheduler.deliver_due) == 0  # never sent twice

    # Finishing the task clears anything still queued for it.
    client.patch(f"/api/v1/tasks/{task['id']}", json={"scheduled_start": (now() + timedelta(hours=2)).isoformat()}, headers=h())
    assert len(client.portal.call(pending)) == 4
    client.post(f"/api/v1/tasks/{task['id']}/complete", json={}, headers=h())
    assert client.portal.call(pending) == []


def test_focus_room_presence(client):
    rooms = client.get("/api/v1/focus-rooms", headers=h()).json()
    assert [r["id"] for r in rooms] == ["deep_work", "admin", "study"]
    assert all(r["count"] == 0 for r in rooms)  # honest empty state, no fake crowd

    with client.websocket_connect("/ws/focus-room/deep_work?token=u1") as first:
        assert first.receive_json()["count"] == 1
        with client.websocket_connect("/ws/focus-room/deep_work?token=u1") as same_person:
            assert same_person.receive_json()["count"] == 1  # two devices, still one person
        with client.websocket_connect("/ws/focus-room/deep_work?token=u2") as other:
            assert other.receive_json()["count"] == 2
            assert client.get("/api/v1/focus-rooms", headers=h()).json()[0]["count"] == 2
    assert client.get("/api/v1/focus-rooms", headers=h()).json()[0]["count"] == 0  # leaving clears presence

    import pytest as _pytest
    from starlette.websockets import WebSocketDisconnect as _Disconnect

    with _pytest.raises(_Disconnect):  # unknown room
        with client.websocket_connect("/ws/focus-room/nope?token=u1") as bad:
            bad.receive_json()


def test_failed_reframe_is_retried_later(client, monkeypatch):
    from datetime import timedelta

    from sqlalchemy import select

    from app import motivator, scheduler
    from app.db import Session as DbSession, Task, now

    attempts = {"n": 0}

    async def flaky(text, lever):
        attempts["n"] += 1
        if attempts["n"] == 1:
            return None  # e.g. Gemini out of quota
        return motivator.Reframe(category="chore", reframed_title="Later, but reframed", first_step="Stand up",
                                 subtasks=[], estimated_minutes=10)

    monkeypatch.setattr(motivator, "reframe", flaky)
    task = client.post("/api/v1/tasks/capture", json={"text": "water the plants"}, headers=h()).json()
    assert client.get("/api/v1/tasks", headers=h()).json()[0]["reframed_title"] is None  # capture survived

    assert client.portal.call(scheduler.retry_reframes) == 0  # not yet: backoff hasn't elapsed

    async def age_attempt():
        async with DbSession() as db:
            stale = await db.scalar(select(Task).where(Task.id == task["id"]))
            stale.reframe_attempted_at = now() - scheduler.RETRY_REFRAME_AFTER - timedelta(minutes=1)
            await db.commit()

    client.portal.call(age_attempt)
    assert client.portal.call(scheduler.retry_reframes) == 1
    assert client.get("/api/v1/tasks", headers=h()).json()[0]["reframed_title"] == "Later, but reframed"


def test_insights_rank_reframe_styles(client):
    """§7 Pillar 10: the dashboard shows which reframe styles work, once there is enough to judge."""
    from sqlalchemy import select

    from app.db import Session as DbSession, Task

    ids = [client.post("/api/v1/tasks/capture", json={"text": f"task {i}"}, headers=h()).json()["id"] for i in range(6)]

    async def set_levers():
        async with DbSession() as db:
            for task_id, lever, status in zip(ids, ["play"] * 3 + ["urgency"] * 3, ["done", "done", "inbox"] * 2):
                task = await db.scalar(select(Task).where(Task.id == task_id))
                task.applied_pinch_lever, task.status = lever, status
            await db.commit()

    client.portal.call(set_levers)
    insights = client.get("/api/v1/insights/weekly", headers=h()).json()
    assert insights["best_lever"]["rate"] == 0.67 and insights["weakest_lever"]["rate"] == 0.67
    assert {row["lever"] for row in insights["levers_ranked"]} == {"play", "urgency"}
