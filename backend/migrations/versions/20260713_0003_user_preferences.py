"""Add explainable workout personalization preferences.

Revision ID: 20260713_0003
Revises: 20260713_0002
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0003"
down_revision: str | None = "20260713_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "default_difficulty",
            sa.String(length=32),
            server_default="intermediate",
            nullable=False,
        ),
        sa.Column(
            "available_equipment",
            sa.JSON(),
            server_default=sa.text("'[\"bodyweight\"]'"),
            nullable=False,
        ),
        sa.Column(
            "preferred_goal",
            sa.String(length=32),
            server_default="endurance",
            nullable=False,
        ),
        sa.Column(
            "avoided_exercise_ids",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "favorite_exercise_ids",
            sa.JSON(),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "high_impact_allowed",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "work_rest_preference",
            sa.String(length=32),
            server_default="balanced",
            nullable=False,
        ),
        sa.Column("history_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_preferences_user_id", "user_preferences", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_preferences_user_id", table_name="user_preferences")
    op.drop_table("user_preferences")
