import os
import uuid

import psycopg
import pytest
from pydantic import SecretStr
from sqlalchemy.engine import make_url

from arcmind_cloud.config import get_settings

pytestmark = pytest.mark.skipif(
    os.getenv("ARCMIND_RUN_DATABASE_TESTS") != "1",
    reason="requires an explicitly provisioned PostgreSQL test database",
)


def runtime_dsn() -> str:
    settings = get_settings()
    password = settings.runtime_database_password
    assert isinstance(password, SecretStr)
    return (
        make_url(settings.database_url)
        .set(
            drivername="postgresql",
            username="arcmind_runtime",
            password=password.get_secret_value(),
        )
        .render_as_string(hide_password=False)
    )


def test_runtime_role_can_read_and_write_but_cannot_change_schema() -> None:
    with psycopg.connect(runtime_dsn()) as database:
        role = database.execute(
            """
            SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication,
                   rolbypassrls
            FROM pg_roles
            WHERE rolname = current_user
            """
        ).fetchone()
        assert role == (False, False, False, False, False, False)
        attempt_id = uuid.uuid4()
        database.execute(
            "INSERT INTO auth_login_attempts (id, source_ip, created_at) "
            "VALUES (%s, %s, now())",
            (attempt_id, "127.0.0.21"),
        )
        assert database.execute(
            "SELECT source_ip FROM auth_login_attempts WHERE id = %s",
            (attempt_id,),
        ).fetchone() == ("127.0.0.21",)
        database.rollback()

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            database.execute("CREATE TABLE runtime_role_must_not_create_tables (id integer)")
