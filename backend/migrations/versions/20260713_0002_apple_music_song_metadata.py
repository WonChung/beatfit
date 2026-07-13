"""Preserve Apple Music song metadata.

Revision ID: 20260713_0002
Revises: 20260713_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260713_0002"
down_revision: str | None = "20260713_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workout_blocks", sa.Column("song_artwork_url", sa.Text(), nullable=True))
    op.add_column("workout_blocks", sa.Column("song_provider_identifier", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("workout_blocks", "song_provider_identifier")
    op.drop_column("workout_blocks", "song_artwork_url")
