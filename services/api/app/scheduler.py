"""Queues and delivers time-anchored reminders (PRD §7 Pillar 2).

ponytail: one in-process loop, not Celery + Beat (§12). Fine for a single API instance; move the loop
into a worker (or SKIP_DUE_LOCKED rows) before running several replicas, or they'll all send the same nudge.
"""
import asyncio
import logging
import os
from datetime import timedelta

from sqlalchemy import delete, select

from . import push
from .db import PushSubscription, Reminder, Session, Task, User, now

log = logging.getLogger(__name__)

TICK_SECONDS = int(os.environ.get("SCHEDULER_TICK_SECONDS", "30"))
BATCH = 100


async def schedule_task_reminders(db, user: User, task: Task) -> None:
    """Re-queue this task's reminders: a few minutes before the start, and at the start itself."""
    await db.execute(delete(Reminder).where(Reminder.task_id == task.id, Reminder.sent_at.is_(None)))
    if not task.scheduled_start or task.status in ("done", "archived"):
        return

    offsets = (user.preferences or {}).get("reminder_offsets") or [15, 10, 5]
    title = task.reframed_title or task.raw_input_text
    for minutes in offsets:
        send_at = task.scheduled_start - timedelta(minutes=minutes)
        if send_at > now():
            db.add(Reminder(user_id=user.id, task_id=task.id, send_at=send_at,
                            title=f"{minutes} minutes until: {title}", body=task.first_step or "Ready when you are."))
    if task.scheduled_start > now():
        db.add(Reminder(user_id=user.id, task_id=task.id, send_at=task.scheduled_start,
                        title=f"Now: {title}", body=task.first_step or "Start with one small piece."))


async def deliver_due() -> int:
    """Send every reminder that is due. Returns how many were sent."""
    async with Session() as db:
        due = (await db.scalars(
            select(Reminder).where(Reminder.sent_at.is_(None), Reminder.send_at <= now()).limit(BATCH)
        )).all()
        if not due:
            return 0

        subscriptions: dict[str, list[PushSubscription]] = {}
        for reminder in due:
            if reminder.user_id not in subscriptions:
                subscriptions[reminder.user_id] = list(await db.scalars(
                    select(PushSubscription).where(PushSubscription.user_id == reminder.user_id)
                ))
            for subscription in subscriptions[reminder.user_id]:
                if not await push.send(subscription, reminder.title, reminder.body):
                    await db.delete(subscription)  # gone for good
            reminder.sent_at = now()
        await db.commit()
        return len(due)


async def run() -> None:
    while True:
        try:
            sent = await deliver_due()
            if sent:
                log.info("sent %d reminder(s)", sent)
        except Exception as e:  # keep ticking through database blips
            log.error("scheduler tick failed: %s", e)
        await asyncio.sleep(TICK_SECONDS)
