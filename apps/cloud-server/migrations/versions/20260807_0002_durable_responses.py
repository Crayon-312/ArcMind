"""Link assistant responses to durable generation jobs."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260807_0002"
down_revision: str | None = "20260807_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "assistant_responses",
        sa.Column("user_turn_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "assistant_responses",
        sa.Column("job_id", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "assistant_responses",
        sa.Column("error_code", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "assistant_responses",
        sa.Column("retryable", sa.Boolean(), nullable=True),
    )
    op.execute(
        """
        WITH ranked_responses AS (
            SELECT
                id,
                conversation_id,
                row_number() OVER (
                    PARTITION BY conversation_id
                    ORDER BY created_at, id
                ) AS position
            FROM assistant_responses
        ),
        ranked_user_turns AS (
            SELECT
                id,
                conversation_id,
                row_number() OVER (
                    PARTITION BY conversation_id
                    ORDER BY created_at, id
                ) AS position
            FROM turns
            WHERE role = 'user'
        )
        UPDATE assistant_responses AS response
        SET user_turn_id = user_turn.id
        FROM ranked_responses AS ranked_response
        JOIN ranked_user_turns AS user_turn
          ON user_turn.conversation_id = ranked_response.conversation_id
         AND user_turn.position = ranked_response.position
        WHERE response.id = ranked_response.id
        """
    )
    op.alter_column("assistant_responses", "user_turn_id", nullable=False)
    op.create_foreign_key(
        "fk_assistant_responses_user_turn_id_turns",
        "assistant_responses",
        "turns",
        ["user_turn_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_assistant_responses_user_turn_id",
        "assistant_responses",
        ["user_turn_id"],
    )
    op.create_unique_constraint(
        "uq_assistant_responses_job_id",
        "assistant_responses",
        ["job_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_assistant_responses_job_id",
        "assistant_responses",
        type_="unique",
    )
    op.drop_constraint(
        "uq_assistant_responses_user_turn_id",
        "assistant_responses",
        type_="unique",
    )
    op.drop_constraint(
        "fk_assistant_responses_user_turn_id_turns",
        "assistant_responses",
        type_="foreignkey",
    )
    op.drop_column("assistant_responses", "retryable")
    op.drop_column("assistant_responses", "error_code")
    op.drop_column("assistant_responses", "job_id")
    op.drop_column("assistant_responses", "user_turn_id")
