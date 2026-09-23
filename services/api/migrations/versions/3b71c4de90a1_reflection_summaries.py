"""reflection summaries

Revision ID: 3b71c4de90a1
Revises: 2e240df8d529
Create Date: 2026-09-23

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "3b71c4de90a1"
down_revision: Union[str, Sequence[str], None] = "2e240df8d529"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reflection_summaries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("generated_text", sa.Text(), nullable=False),
        sa.Column("metrics_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "week_start"),
    )
    op.create_index(op.f("ix_reflection_summaries_user_id"), "reflection_summaries", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_reflection_summaries_user_id"), table_name="reflection_summaries")
    op.drop_table("reflection_summaries")
