"""End-to-end check of every user-facing flow against a running API.

    # terminal 1
    cd services/api && DEV_AUTH_USER=verify-bot uv run uvicorn app.main:app --env-file .env --port 8000
    # terminal 2
    cd services/api && uv run python scripts/verify_local.py

It signs in as the throwaway user `verify-bot`, walks the whole product, prints a PASS/FAIL line per
flow, and deletes its own data at the end. Real Gemini calls are used, so reframing and the weekly
reflection are checked for real; both are allowed to be slow or unavailable without failing the run.
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx
import websockets

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # import app.* when run from scripts/

BASE = os.environ.get("VERIFY_API", "http://localhost:8000")
API = f"{BASE}/api/v1"
results: list[tuple[bool, str, str]] = []


def check(ok: bool, name: str, detail: str = "") -> bool:
    results.append((ok, name, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{f' — {detail}' if detail else ''}")
    return ok


async def main() -> int:
    async with httpx.AsyncClient(base_url=API, timeout=30) as api:
        await api.delete("/me")  # start clean, in case an earlier run stopped halfway

        # --- onboarding (§15) ---
        me = (await api.get("/me")).json()
        check("disclaimer" in me and "not a medical device" in me["disclaimer"], "Non-clinical disclaimer is served")
        refused = await api.post("/me/onboarding", json={"accept_disclaimer": False})
        check(refused.status_code == 400, "Onboarding refuses to skip the disclaimer")
        onboarded = await api.post("/me/onboarding", json={"accept_disclaimer": True, "timezone": "Asia/Kolkata", "display_name": "Verify Bot"})
        check(onboarded.status_code == 200, "Onboarding accepted")

        # --- capture -> Task Alchemy (§7 Pillar 1) ---
        started = time.perf_counter()
        task = (await api.post("/tasks/capture", json={"text": "book a dentist appointment this week"})).json()
        capture_ms = (time.perf_counter() - started) * 1000
        check(capture_ms < 500, "Capture returns immediately", f"{capture_ms:.0f}ms (target <500ms)")

        reframed, waited = None, 0.0
        while waited < 30:
            await asyncio.sleep(1)
            waited += 1
            current = next((t for t in (await api.get("/tasks")).json() if t["id"] == task["id"]), None)
            if current and current["reframed_title"]:
                reframed = current
                break
        if reframed:
            check(bool(reframed["first_step"]), "Reframe has a 2-minute first step", reframed["first_step"])
            check(reframed["applied_pinch_lever"] in ["challenge", "play", "novelty", "urgency", "interest"],
                  "A PINCH lever was applied", f"{reframed['applied_pinch_lever']} — “{reframed['reframed_title']}”")
            check(reframed["estimated_duration_padded"] >= reframed["estimated_duration_raw"],
                  "Estimate is padded for time blindness",
                  f"{reframed['estimated_duration_raw']} -> {reframed['estimated_duration_padded']} min")
            check(waited <= 10, "Reframe arrived in the background", f"{waited:.0f}s")
        else:
            check(False, "Reframe arrived within 30s", "Gemini slow or unavailable — capture still saved")

        again = (await api.post(f"/tasks/{task['id']}/reframe")).json()
        check(again["applied_pinch_lever"] != (reframed or task).get("applied_pinch_lever"),
              "“Another angle” switches lever", again["applied_pinch_lever"])

        # --- energy + matching (§7 Pillar 5) ---
        check((await api.post("/energy-logs", json={"energy_level": 2})).status_code == 200, "Energy check-in logged")
        low = (await api.get("/tasks", params={"energy": 1})).json()
        check(all(t["category"] in (None, "chore", "admin", "social") for t in low), "Low-energy view hides demanding work")

        # --- focus session, guardrails, hyperfocus (§7 Pillar 4) ---
        session = (await api.post("/focus-sessions/start", json={"task_id": task["id"]})).json()
        check(session["guardrail_after_minutes"] == 120, "Body-check guardrail scheduled", "after 120 min")
        check(session["hyperfocus_after_minutes"] == 45, "Hyperfocus watch armed", "after 45 min")
        check((await api.post(f"/focus-sessions/{session['id']}/guardrail-ack", json={"kind": "hydration"})).status_code == 200,
              "Guardrail acknowledgement recorded")
        early = await api.post(f"/focus-sessions/{session['id']}/hyperfocus", json={"detected": True})
        check(early.status_code == 409, "False hyperfocus is rejected", "a fresh session is never flow")
        check((await api.post(f"/focus-sessions/{session['id']}/end")).status_code == 200, "Focus session ended")

        sprint = await api.post("/focus-sessions/start", json={"task_id": task["id"], "type": "crisis_sprint"})
        check(sprint.status_code == 200, "Crisis sprint starts (§7 Pillar 8)")
        await api.post(f"/focus-sessions/{sprint.json()['id']}/end")

        # --- reminders (§7 Pillar 2) ---
        from datetime import datetime, timedelta, timezone

        soon = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()
        await api.patch(f"/tasks/{task['id']}", json={"scheduled_start": soon, "status": "scheduled"})
        queued = await pending_reminders()
        check(len(queued) == 4, "Reminders queued for a scheduled task", f"{len(queued)}: {', '.join(queued)}")

        # --- idea vault (§7 Pillar 9) ---
        idea = (await api.post("/ideas", json={"text": "a podcast about boring museums"})).json()
        check(all(t["raw_input_text"] != idea["text"] for t in (await api.get("/tasks")).json()),
              "Ideas stay out of the task list")
        promoted = (await api.post(f"/ideas/{idea['id']}/promote")).json()
        check(promoted["raw_input_text"] == idea["text"], "Promoting an idea creates a task")
        check((await api.post(f"/ideas/{idea['id']}/promote")).status_code == 409, "An idea can't be promoted twice")

        # --- focus rooms (§7 Pillar 7) ---
        rooms = (await api.get("/focus-rooms")).json()
        check([r["id"] for r in rooms] == ["deep_work", "admin", "study"], "Three focus rooms exist")
        async with websockets.connect(f"{BASE.replace('http', 'ws')}/ws/focus-room/deep_work?token=x") as socket:
            presence = json.loads(await socket.recv())
            check(presence["count"] == 1, "Joining a room shows presence", f"{presence['people'][0]['name']}")
        await asyncio.sleep(0.4)
        check((await api.get("/focus-rooms")).json()[0]["count"] == 0, "Leaving a room clears presence")

        # --- progress + insights (§7 Pillar 10) ---
        await api.post(f"/tasks/{task['id']}/complete", json={"actual_duration": 25})
        check(await pending_reminders() == [], "Finishing a task cancels its reminders")
        insights = (await api.get("/insights/weekly")).json()
        check(insights["xp_today"] == 10 and insights["xp_daily_cap"] == 100, "XP is bounded per day (§3.6)",
              f"{insights['xp_today']}/{insights['xp_daily_cap']}")
        check(insights["days_active_this_week"] == 1, "Streak counts days shown up, never resets")
        check("completion_rate_reframed" in insights, "Reframed vs unreframed completion tracked (§9 KPI 1)")

        reflection = await api.get("/insights/reflection")
        if reflection.status_code == 200:
            text = reflection.json()["text"]
            shaming = [w for w in ("should", "failed", "just ", "finally", "only ") if w in text.lower()]
            check(not shaming, "Weekly reflection avoids shaming language", text[:90] + "…")
        else:
            check(False, "Weekly reflection generated", "Gemini unavailable — insights still render")

        # --- push, privacy, deletion (§16) ---
        check("vapid_public_key" in (await api.get("/push/key")).json(), "Web push key served")
        export = (await api.get("/me/export")).json()
        check({"tasks", "ideas", "focus_sessions", "energy_logs", "reflections"} <= export.keys(),
              "Data export covers everything", f"{len(export['tasks'])} tasks")
        check((await api.delete("/me")).status_code == 200, "Account deletion works")
        check((await api.get("/me/export")).json()["tasks"] == [], "Deletion really removes the data")

    failed = [name for ok, name, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("Failed: " + "; ".join(failed))
    return 1 if failed else 0


async def pending_reminders() -> list[str]:
    """Reminders are internal, so read them straight from the database."""
    from sqlalchemy import select

    from app.db import Reminder, Session

    async with Session() as db:
        rows = await db.scalars(
            select(Reminder).where(Reminder.user_id == "verify-bot", Reminder.sent_at.is_(None)).order_by(Reminder.send_at)
        )
        return [r.title.split(":")[0] for r in rows]


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
