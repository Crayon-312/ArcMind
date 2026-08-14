"""Merge legacy users into the single owner identity."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260814_0004"
down_revision: str | None = "20260813_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            owner_id uuid;
            user_count integer;
            bound_count integer;
        BEGIN
            SELECT count(*) INTO user_count FROM users;
            SELECT count(*) INTO bound_count FROM users WHERE username IS NOT NULL;

            IF user_count > 0 THEN
                IF bound_count = 0 THEN
                    SELECT id INTO owner_id
                    FROM users
                    ORDER BY created_at, id
                    LIMIT 1
                    FOR UPDATE;

                    UPDATE users
                    SET username = 'owner',
                        password_digest = 'pending-deployment-password'
                    WHERE id = owner_id;
                ELSIF bound_count = 1 THEN
                    SELECT id INTO owner_id
                    FROM users
                    WHERE username IS NOT NULL
                    FOR UPDATE;

                    UPDATE users
                    SET password_digest = COALESCE(
                        password_digest,
                        'pending-deployment-password'
                    )
                    WHERE id = owner_id;
                ELSE
                    RAISE EXCEPTION 'expected at most one bound user, found %', bound_count;
                END IF;

                UPDATE conversations AS legacy
                SET idempotency_key = 'merged-' || legacy.id::text
                WHERE legacy.user_id <> owner_id
                  AND EXISTS (
                      SELECT 1
                      FROM conversations AS owned
                      WHERE owned.user_id = owner_id
                        AND owned.idempotency_key = legacy.idempotency_key
                  );

                UPDATE assistant_responses AS legacy
                SET idempotency_key = 'merged-' || legacy.id::text
                WHERE legacy.user_id <> owner_id
                  AND EXISTS (
                      SELECT 1
                      FROM assistant_responses AS owned
                      WHERE owned.user_id = owner_id
                        AND owned.idempotency_key = legacy.idempotency_key
                  );

                UPDATE conversations SET user_id = owner_id WHERE user_id <> owner_id;
                UPDATE assistant_responses SET user_id = owner_id WHERE user_id <> owner_id;
                DELETE FROM auth_sessions WHERE user_id <> owner_id;
                DELETE FROM users WHERE id <> owner_id;
            END IF;
        END
        $$;
        """
    )
    op.alter_column(
        "users",
        "username",
        existing_type=sa.String(length=64),
        nullable=False,
    )
    op.alter_column(
        "users",
        "password_digest",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_column("users", "email")


def downgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=320), nullable=True))
    op.create_unique_constraint("users_email_key", "users", ["email"])
    op.alter_column(
        "users",
        "password_digest",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.alter_column(
        "users",
        "username",
        existing_type=sa.String(length=64),
        nullable=True,
    )
