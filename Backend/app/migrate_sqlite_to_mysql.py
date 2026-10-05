from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, create_engine, func, select
from sqlalchemy.engine import Engine, make_url

from app.config import settings


BACKEND_DIR = Path(__file__).resolve().parents[1]
APPLICATION_TABLES = (
    "products",
    "users",
    "orders",
    "order_items",
    "admin_sessions",
    "customer_sessions",
)
BATCH_SIZE = 500


def upgrade_database(database_url: str) -> None:
    previous_url = settings.database_url
    settings.database_url = database_url
    try:
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        command.upgrade(config, "head")
    finally:
        settings.database_url = previous_url


def copy_application_data(source_engine: Engine, target_engine: Engine) -> dict[str, int]:
    source_metadata = MetaData()
    target_metadata = MetaData()
    source_metadata.reflect(bind=source_engine)
    target_metadata.reflect(bind=target_engine)

    missing_source = set(APPLICATION_TABLES) - set(source_metadata.tables)
    missing_target = set(APPLICATION_TABLES) - set(target_metadata.tables)
    if missing_source or missing_target:
        raise RuntimeError(
            f"Database schema is incomplete (source missing: {sorted(missing_source)}, "
            f"target missing: {sorted(missing_target)}). Upgrade both databases first."
        )

    with source_engine.connect() as source, target_engine.begin() as target:
        source_tables = {name: source_metadata.tables[name] for name in APPLICATION_TABLES}
        target_tables = {name: target_metadata.tables[name] for name in APPLICATION_TABLES}
        counts = {
            name: source.execute(select(func.count()).select_from(source_tables[name])).scalar_one()
            for name in APPLICATION_TABLES
        }
        occupied = [
            name for name in APPLICATION_TABLES
            if target.execute(select(func.count()).select_from(target_tables[name])).scalar_one() != 0
        ]
        if occupied:
            raise RuntimeError(f"Refusing to merge into non-empty target tables: {', '.join(occupied)}")

        for name in APPLICATION_TABLES:
            source_result = source.execute(select(source_tables[name]))
            while rows := source_result.fetchmany(BATCH_SIZE):
                target.execute(target_tables[name].insert(), [dict(row._mapping) for row in rows])

        for name, expected_count in counts.items():
            copied_count = target.execute(
                select(func.count()).select_from(target_tables[name])
            ).scalar_one()
            if copied_count != expected_count:
                raise RuntimeError(
                    f"Row count mismatch for {name}: expected {expected_count}, copied {copied_count}"
                )

    return counts


def main() -> None:
    source_url = make_url(settings.sqlite_source_url)
    target_url = make_url(settings.database_url)
    if source_url.get_backend_name() != "sqlite":
        raise SystemExit("SQLITE_SOURCE_URL must point to the existing SQLite database.")
    if target_url.get_backend_name() != "mysql":
        raise SystemExit("Set DATABASE_URL to the destination MySQL database before migrating.")
    if source_url == target_url:
        raise SystemExit("Source and target database URLs must be different.")

    upgrade_database(str(source_url))
    upgrade_database(str(target_url))

    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    target_engine = create_engine(target_url, pool_pre_ping=True)
    try:
        counts = copy_application_data(source_engine, target_engine)
    finally:
        source_engine.dispose()
        target_engine.dispose()

    print("SQLite data copied to MySQL:")
    for table, count in counts.items():
        print(f"  {table}: {count} rows")
    print("Set DATABASE_URL to the MySQL URL and restart the backend to use MySQL.")


if __name__ == "__main__":
    main()