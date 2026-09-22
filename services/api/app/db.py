"""Core entities from PRD §13 (MVP subset: no FocusRoom / ReflectionSummary / PersonalizationMemory yet)."""
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://overclock:overclock@localhost:5433/overclock")

engine = create_async_engine(DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True)}


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


class EnergyLog(Base):
    __tablename__ = "energy_logs"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    logged_at: Mapped[datetime] = mapped_column(default=now)
    energy_level: Mapped[int]  # 1-5
    mood_tag: Mapped[str | None]
    optional_medication_note: Mapped[str | None]
