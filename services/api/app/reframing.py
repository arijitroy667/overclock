"""Applying Task Alchemy to a task (PRD §7 Pillar 1), shared by the API and the retry loop."""
import logging

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import motivator
from .db import Subtask, Task, User, now

log = logging.getLogger(__name__)

STARTED = ("in_progress", "done")
MAX_ATTEMPTS = 5  # give up quietly; "Another angle" is always there


async def lever_stats(db: AsyncSession, user_id: str) -> dict[str, tuple[int, int]]:
    """Per-lever (started, reframed) — did this framing actually get the user moving (§9 KPI 2)?

    Every reframed task counts in the denominator, including ones still sitting in the inbox:
    a lever that never gets you started has to be able to look bad.
    """
    rows = (await db.execute(
        select(
            Task.applied_pinch_lever,
            func.sum(case((Task.status.in_(STARTED), 1), else_=0)),
            func.count(),
        ).where(Task.user_id == user_id, Task.applied_pinch_lever.is_not(None))
        .group_by(Task.applied_pinch_lever)
    )).all()
    return {lever: (int(started), total) for lever, started, total in rows}


async def apply(db: AsyncSession, user: User, task: Task) -> bool:
    """Reframe one task in place. False when the model didn't answer — the capture is untouched."""
    lever = motivator.choose_lever(await lever_stats(db, user.id))
    if lever == task.applied_pinch_lever:  # re-reframe: always try a different angle
        n = await db.scalar(select(func.count()).select_from(Task).where(Task.user_id == user.id))
        lever = motivator.pick_lever(n)

    task.reframe_attempts = (task.reframe_attempts or 0) + 1
    task.reframe_attempted_at = now()
    r = await motivator.reframe(task.raw_input_text, lever)
    if not r:
        return False

    history = (await db.execute(
        select(Task.estimated_duration_raw, Task.actual_duration).where(
            Task.user_id == user.id, Task.category == r.category, Task.actual_duration.is_not(None)
        )
    )).all()
    task.category = r.category
    task.reframed_title = r.reframed_title
    task.first_step = r.first_step
    task.applied_pinch_lever = lever
    task.reframe_accepted = None
    task.estimated_duration_raw = r.estimated_minutes
    task.estimated_duration_padded = motivator.pad(r.estimated_minutes, history)
    task.subtasks = [Subtask(title=t, order_index=i) for i, t in enumerate(r.subtasks)]
    return True
