import os

os.environ["MIGRATE_ON_STARTUP"] = "0"  # tests build the schema from the models directly
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
    assert main.reflection_calls[-1]["levers"]  # the agent sees which levers got tasks started
    assert client.get("/api/v1/me/export", headers=h()).json()["reflections"][0]["generated_text"] == "Nice week. 2"
