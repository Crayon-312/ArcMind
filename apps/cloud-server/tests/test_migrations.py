import os
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import make_url

pytestmark = pytest.mark.skipif(
    os.getenv("ARCMIND_RUN_DATABASE_TESTS") != "1",
    reason="requires permission to create a temporary PostgreSQL database",
)

APP_ROOT = Path(__file__).resolve().parents[1]


def run_alembic(database_url: str, *arguments: str) -> None:
    environment = os.environ.copy()
    environment["ARCMIND_DATABASE_URL"] = database_url
    result = subprocess.run(  # noqa: S603 - executable and arguments are test constants
        [sys.executable, "-m", "alembic", *arguments],
        cwd=APP_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_durable_response_migration_pairs_legacy_creation_order() -> None:
    source_url = make_url(os.environ["ARCMIND_DATABASE_URL"])
    database_name = f"arcmind_migration_{uuid.uuid4().hex}"
    migration_url = source_url.set(database=database_name)
    admin_dsn = source_url.set(
        drivername="postgresql",
        database="postgres",
    ).render_as_string(hide_password=False)
    migration_dsn = migration_url.set(
        drivername="postgresql",
    ).render_as_string(hide_password=False)
    migration_database_url = migration_url.render_as_string(hide_password=False)

    with psycopg.connect(admin_dsn, autocommit=True) as admin:
        admin.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))
        )

    try:
        run_alembic(migration_database_url, "upgrade", "20260807_0001")
        with psycopg.connect(migration_dsn) as database:
            database.execute(
                """
                INSERT INTO users (
                    id, email, status, locale, time_zone, created_at
                ) VALUES
                (
                    '00000000-0000-4000-8000-000000000001',
                    'migration@example.invalid',
                    'active',
                    'zh-CN',
                    'Asia/Shanghai',
                    '2026-08-07T00:00:00Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000003',
                    'legacy-second@example.invalid',
                    'active',
                    'zh-CN',
                    'Asia/Shanghai',
                    '2026-08-07T00:00:01Z'
                );
                INSERT INTO conversations (
                    id, user_id, idempotency_key, mode, state, version, created_at
                ) VALUES
                (
                    '00000000-0000-4000-8000-000000000002',
                    '00000000-0000-4000-8000-000000000001',
                    'migration-conversation',
                    'text',
                    'active',
                    1,
                    '2026-08-07T00:00:00Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000004',
                    '00000000-0000-4000-8000-000000000003',
                    'migration-conversation',
                    'text',
                    'active',
                    1,
                    '2026-08-07T00:00:01Z'
                );
                INSERT INTO auth_sessions (
                    id, user_id, token_digest, state, created_at, last_seen_at,
                    absolute_expires_at, revoked_at
                ) VALUES (
                    '00000000-0000-4000-8000-000000000040',
                    '00000000-0000-4000-8000-000000000003',
                    repeat('a', 64),
                    'active',
                    '2026-08-07T00:00:01Z',
                    '2026-08-07T00:00:01Z',
                    '2026-09-07T00:00:01Z',
                    NULL
                );
                INSERT INTO assistant_responses (
                    id, conversation_id, user_id, idempotency_key, state,
                    snapshot_text, version, created_at, completed_at
                ) VALUES
                (
                    '00000000-0000-4000-8000-000000000010',
                    '00000000-0000-4000-8000-000000000002',
                    '00000000-0000-4000-8000-000000000001',
                    'migration-response-1',
                    'completed',
                    'first response',
                    2,
                    '2026-08-07T00:00:01.000Z',
                    '2026-08-07T00:00:02Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000020',
                    '00000000-0000-4000-8000-000000000002',
                    '00000000-0000-4000-8000-000000000001',
                    'migration-response-2',
                    'completed',
                    'second response',
                    2,
                    '2026-08-07T00:01:01.000Z',
                    '2026-08-07T00:01:02Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000030',
                    '00000000-0000-4000-8000-000000000004',
                    '00000000-0000-4000-8000-000000000003',
                    'migration-response-1',
                    'completed',
                    'legacy second response',
                    2,
                    '2026-08-07T00:02:01.000Z',
                    '2026-08-07T00:02:02Z'
                );
                INSERT INTO turns (
                    id, conversation_id, role, content, finality, created_at
                ) VALUES
                (
                    '00000000-0000-4000-8000-000000000011',
                    '00000000-0000-4000-8000-000000000002',
                    'user',
                    'first request',
                    'final',
                    '2026-08-07T00:00:01.003Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000021',
                    '00000000-0000-4000-8000-000000000002',
                    'user',
                    'second request',
                    'final',
                    '2026-08-07T00:01:01.002Z'
                ),
                (
                    '00000000-0000-4000-8000-000000000031',
                    '00000000-0000-4000-8000-000000000004',
                    'user',
                    'legacy second request',
                    'final',
                    '2026-08-07T00:02:01.002Z'
                );
                """
            )
            database.commit()

        run_alembic(migration_database_url, "upgrade", "head")
        with psycopg.connect(migration_dsn) as database:
            mappings = database.execute(
                """
                SELECT id, user_turn_id
                FROM assistant_responses
                ORDER BY created_at, id
                """
            ).fetchall()
        assert mappings == [
            (
                uuid.UUID("00000000-0000-4000-8000-000000000010"),
                uuid.UUID("00000000-0000-4000-8000-000000000011"),
            ),
            (
                uuid.UUID("00000000-0000-4000-8000-000000000020"),
                uuid.UUID("00000000-0000-4000-8000-000000000021"),
            ),
            (
                uuid.UUID("00000000-0000-4000-8000-000000000030"),
                uuid.UUID("00000000-0000-4000-8000-000000000031"),
            ),
        ]

        with psycopg.connect(migration_dsn) as database:
            users = database.execute(
                "SELECT id, username, password_digest FROM users"
            ).fetchall()
            conversation_owners = database.execute(
                "SELECT DISTINCT user_id FROM conversations"
            ).fetchall()
            conversation_keys = database.execute(
                "SELECT idempotency_key FROM conversations ORDER BY idempotency_key"
            ).fetchall()
            response_owners = database.execute(
                "SELECT DISTINCT user_id FROM assistant_responses"
            ).fetchall()
            response_keys = database.execute(
                "SELECT idempotency_key FROM assistant_responses ORDER BY idempotency_key"
            ).fetchall()
            session_count = database.execute(
                "SELECT count(*) FROM auth_sessions"
            ).fetchone()
            email_column_count = database.execute(
                """
                SELECT count(*)
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'email'
                """
            ).fetchone()

        owner_id = uuid.UUID("00000000-0000-4000-8000-000000000001")
        assert users == [(owner_id, "owner", "pending-deployment-password")]
        assert conversation_owners == [(owner_id,)]
        assert len(conversation_keys) == len(set(conversation_keys)) == 2
        assert response_owners == [(owner_id,)]
        assert len(response_keys) == len(set(response_keys)) == 3
        assert session_count == (0,)
        assert email_column_count == (0,)

        run_alembic(migration_database_url, "downgrade", "20260807_0001")
        run_alembic(migration_database_url, "upgrade", "head")
    finally:
        with psycopg.connect(admin_dsn, autocommit=True) as admin:
            admin.execute(
                sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                    sql.Identifier(database_name)
                )
            )
