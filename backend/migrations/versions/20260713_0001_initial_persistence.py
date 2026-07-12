"""Create BeatFit persistence tables.

Revision ID: 20260713_0001
Revises:
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("is_temporary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "workouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160)),
        sa.Column("muscle_group", sa.String(length=32), nullable=False),
        sa.Column("difficulty", sa.String(length=32), nullable=False),
        sa.Column("equipment", sa.JSON(), nullable=False),
        sa.Column("goal", sa.String(length=32), nullable=False),
        sa.Column("random_seed", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workouts_user_id", "workouts", ["user_id"])
    op.create_table(
        "workout_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("song_title", sa.String(length=240), nullable=False),
        sa.Column("song_artist", sa.String(length=240), nullable=False),
        sa.Column("song_duration_ms", sa.Integer(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workout_id", "position"),
    )
    op.create_index("ix_workout_blocks_workout_id", "workout_blocks", ["workout_id"])
    op.create_table(
        "workout_intervals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("block_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("start_seconds", sa.Integer(), nullable=False),
        sa.Column("end_seconds", sa.Integer(), nullable=False),
        sa.Column("interval_type", sa.String(length=32), nullable=False),
        sa.Column("exercise_name", sa.String(length=240), nullable=False),
        sa.Column("exercise_catalog_id", sa.String(length=180)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("end_seconds > start_seconds", name="ck_interval_positive_duration"),
        sa.ForeignKeyConstraint(["block_id"], ["workout_blocks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("block_id", "position"),
    )
    op.create_index("ix_workout_intervals_block_id", "workout_intervals", ["block_id"])
    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("planned_duration_seconds", sa.Integer(), nullable=False),
        sa.Column("actual_elapsed_seconds", sa.Integer(), nullable=False),
        sa.Column("total_intervals", sa.Integer(), nullable=False),
        sa.Column("completed_intervals", sa.Integer(), nullable=False),
        sa.Column("completed_work_intervals", sa.Integer(), nullable=False),
        sa.Column("completed_song_blocks", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("workout_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("actual_elapsed_seconds >= 0", name="ck_session_actual_nonnegative"),
        sa.CheckConstraint("completed_intervals >= 0", name="ck_session_completed_nonnegative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workout_sessions_user_id", "workout_sessions", ["user_id"])
    op.create_index("ix_workout_sessions_workout_id", "workout_sessions", ["workout_id"])
    op.create_table(
        "session_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["workout_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_table(
        "saved_workouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("is_favorite", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name"),
        sa.UniqueConstraint("user_id", "workout_id"),
    )
    op.create_index("ix_saved_workouts_user_id", "saved_workouts", ["user_id"])
    op.create_index("ix_saved_workouts_workout_id", "saved_workouts", ["workout_id"])
    op.create_index("ix_saved_workouts_user_favorite", "saved_workouts", ["user_id", "is_favorite"])


def downgrade() -> None:
    op.drop_table("saved_workouts")
    op.drop_table("session_feedback")
    op.drop_table("workout_sessions")
    op.drop_table("workout_intervals")
    op.drop_table("workout_blocks")
    op.drop_table("workouts")
    op.drop_table("users")
