import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_temporary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    workouts: Mapped[list["Workout"]] = relationship(back_populates="user")
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="user")


class Workout(TimestampMixin, Base):
    __tablename__ = "workouts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(160))
    muscle_group: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), nullable=False)
    equipment: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    goal: Mapped[str] = mapped_column(String(32), nullable=False)
    random_seed: Mapped[int | None] = mapped_column(Integer)

    user: Mapped[User] = relationship(back_populates="workouts")
    blocks: Mapped[list["WorkoutBlock"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", order_by="WorkoutBlock.position"
    )
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="workout")
    saved_entries: Mapped[list["SavedWorkout"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan"
    )


class WorkoutBlock(Base):
    __tablename__ = "workout_blocks"
    __table_args__ = (UniqueConstraint("workout_id", "position"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workout_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    song_title: Mapped[str] = mapped_column(String(240), nullable=False)
    song_artist: Mapped[str] = mapped_column(String(240), nullable=False)
    song_duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    workout: Mapped[Workout] = relationship(back_populates="blocks")
    intervals: Mapped[list["WorkoutInterval"]] = relationship(
        back_populates="block",
        cascade="all, delete-orphan",
        order_by="WorkoutInterval.position",
    )


class WorkoutInterval(Base):
    __tablename__ = "workout_intervals"
    __table_args__ = (
        UniqueConstraint("block_id", "position"),
        CheckConstraint("end_seconds > start_seconds", name="ck_interval_positive_duration"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    block_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workout_blocks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    start_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    end_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_type: Mapped[str] = mapped_column(String(32), nullable=False)
    exercise_name: Mapped[str] = mapped_column(String(240), nullable=False)
    exercise_catalog_id: Mapped[str | None] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    block: Mapped[WorkoutBlock] = relationship(back_populates="intervals")


class WorkoutSession(TimestampMixin, Base):
    __tablename__ = "workout_sessions"
    __table_args__ = (
        CheckConstraint("actual_elapsed_seconds >= 0", name="ck_session_actual_nonnegative"),
        CheckConstraint("completed_intervals >= 0", name="ck_session_completed_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    workout_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="SET NULL"), index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    planned_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_elapsed_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    total_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_work_intervals: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_song_blocks: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    workout_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")
    workout: Mapped[Workout | None] = relationship(back_populates="sessions")
    feedback: Mapped["SessionFeedback | None"] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )


class SessionFeedback(TimestampMixin, Base):
    __tablename__ = "session_feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("workout_sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    rating: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    session: Mapped[WorkoutSession] = relationship(back_populates="feedback")


class SavedWorkout(TimestampMixin, Base):
    __tablename__ = "saved_workouts"
    __table_args__ = (
        UniqueConstraint("user_id", "workout_id"),
        UniqueConstraint("user_id", "name"),
        Index("ix_saved_workouts_user_favorite", "user_id", "is_favorite"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    workout_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    workout: Mapped[Workout] = relationship(back_populates="saved_entries")
