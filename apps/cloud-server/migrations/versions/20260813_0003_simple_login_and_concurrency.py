"""Replace email challenges with simple login and enforce response concurrency."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260813_0003"
down_revision: str | None = "20260807_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=320),
        nullable=True,
    )
    op.add_column("users", sa.Column("username", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("password_digest", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_username", "users", ["username"])

    op.create_table(
        "auth_login_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_ip", sa.String(length=45), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_login_attempts_source_created",
        "auth_login_attempts",
        ["source_ip", "created_at"],
    )
    op.create_index(
        "uq_assistant_responses_one_active_per_conversation",
        "assistant_responses",
        ["conversation_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('queued', 'generating')"),
    )
    op.drop_index("ix_auth_challenges_source_created", table_name="auth_challenges")
    op.drop_index("ix_auth_challenges_email_created", table_name="auth_challenges")
    op.drop_table("auth_challenges")


def downgrade() -> None:
    op.create_table(
        "auth_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("source_ip", sa.String(length=45), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_challenges_email_created",
        "auth_challenges",
        ["email", "created_at"],
    )
    op.create_index(
        "ix_auth_challenges_source_created",
        "auth_challenges",
        ["source_ip", "created_at"],
    )
    op.drop_index(
        "uq_assistant_responses_one_active_per_conversation",
        table_name="assistant_responses",
    )
    op.drop_index("ix_auth_login_attempts_source_created", table_name="auth_login_attempts")
    op.drop_table("auth_login_attempts")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "password_digest")
    op.drop_column("users", "username")
    op.execute(
        "UPDATE users SET email = 'downgrade-' || id::text || '@invalid.local' "
        "WHERE email IS NULL"
    )
    op.alter_column(
        "users",
        "email",
        existing_type=sa.String(length=320),
        nullable=False,
    )
