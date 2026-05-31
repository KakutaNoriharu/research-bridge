"""Add notifications table

Revision ID: 20260531_002
Revises: 20260531_001
Create Date: 2026-05-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260531_002"
down_revision: Union[str, None] = "20260531_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE notification_type AS ENUM ('interest', 'match', 'message')"
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "interest", "match", "message",
                name="notification_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("actor_user_id", sa.String(), nullable=False),
        sa.Column("related_id", sa.String(), nullable=True),
        sa.Column(
            "is_read",
            sa.Boolean(),
            server_default=sa.text("FALSE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name="fk_notifications_user",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"],
            name="fk_notifications_actor",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("idx_notifications_user_id", "notifications", ["user_id"])
    op.create_index("idx_notifications_is_read", "notifications", ["is_read"])
    op.create_index("idx_notifications_created_at", "notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notification_type")
