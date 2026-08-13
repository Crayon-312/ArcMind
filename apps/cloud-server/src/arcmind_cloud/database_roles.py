from psycopg import sql
from sqlalchemy.engine import make_url

from .asyncio_runtime import run
from .config import get_settings
from .database import engine

RUNTIME_ROLE = "arcmind_runtime"


async def configure_database_roles() -> None:
    settings = get_settings()
    runtime_password = settings.runtime_database_password
    if runtime_password is None:
        raise RuntimeError("runtime_database_password is required to configure database roles")

    database_name = make_url(settings.database_url).database
    if not database_name:
        raise RuntimeError("database_url must include a database name")

    async with engine.begin() as connection:
        raw = await connection.get_raw_connection()
        driver = raw.driver_connection
        if driver is None:
            raise RuntimeError("database driver connection is unavailable")
        exists = await driver.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s",
            (RUNTIME_ROLE,),
        )
        if await exists.fetchone() is None:
            await driver.execute(
                sql.SQL("CREATE ROLE {}").format(sql.Identifier(RUNTIME_ROLE))
            )
        await driver.execute(
            "SELECT set_config('arcmind.runtime_password', %s, true)",
            (runtime_password.get_secret_value(),),
        )
        await driver.execute(
            sql.SQL(
                "DO $role$ BEGIN EXECUTE format("
                "'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB "
                "NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS', "
                "{}, current_setting('arcmind.runtime_password')); END $role$"
            ).format(sql.Literal(RUNTIME_ROLE))
        )
        await driver.execute(
            sql.SQL("REVOKE ALL PRIVILEGES ON DATABASE {} FROM {}").format(
                sql.Identifier(database_name),
                sql.Identifier(RUNTIME_ROLE),
            )
        )
        await driver.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                sql.Identifier(database_name),
                sql.Identifier(RUNTIME_ROLE),
            )
        )
        await driver.execute(
            sql.SQL("REVOKE ALL PRIVILEGES ON SCHEMA public FROM {}").format(
                sql.Identifier(RUNTIME_ROLE)
            )
        )
        await driver.execute(
            sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(
                sql.Identifier(RUNTIME_ROLE)
            )
        )
        await driver.execute(
            sql.SQL(
                "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES "
                "IN SCHEMA public TO {}"
            ).format(sql.Identifier(RUNTIME_ROLE))
        )
        await driver.execute(
            sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(
                sql.Identifier(RUNTIME_ROLE)
            )
        )
        owner = make_url(settings.database_url).username
        if owner:
            await driver.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA public "
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}"
                ).format(sql.Identifier(owner), sql.Identifier(RUNTIME_ROLE))
            )
            await driver.execute(
                sql.SQL(
                    "ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA public "
                    "GRANT USAGE, SELECT ON SEQUENCES TO {}"
                ).format(sql.Identifier(owner), sql.Identifier(RUNTIME_ROLE))
            )


def main() -> None:
    run(configure_database_roles())


if __name__ == "__main__":
    main()
