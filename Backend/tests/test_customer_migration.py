import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
from pwdlib import PasswordHash
from sqlalchemy import create_engine, inspect

from app.config import settings


BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_upgrade(database_path: Path, monkeypatch, revision="head"):
    monkeypatch.setattr(settings, "database_url", f"sqlite:///{database_path.as_posix()}")
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    command.upgrade(config, revision)


def test_migration_preserves_legacy_users_and_hashes_passwords(tmp_path, monkeypatch):
    database_path = tmp_path / "legacy.sqlite"
    connection = sqlite3.connect(database_path)
    connection.execute("CREATE TABLE users (user_name TEXT, email TEXT, mobile TEXT, password TEXT)")
    connection.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?)",
        ("Legacy Customer", "legacy@example.com", "9876543210", "legacy-password"),
    )
    connection.commit()
    connection.close()

    run_upgrade(database_path, monkeypatch)

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    assert {"id", "user_name", "user_email", "user_mobile", "user_addr1", "user_addr2", "pincode", "password"} <= columns
    with engine.connect() as db:
        user = db.exec_driver_sql("SELECT user_name, user_email, user_mobile, password FROM users").one()
        assert user[0:3] == ("Legacy Customer", "legacy@example.com", "9876543210")
        assert PasswordHash.recommended().verify("legacy-password", user[3])
        assert db.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0003_order_user_category"
        assert db.exec_driver_sql("PRAGMA table_info(orders)").fetchall()
        order_columns = {row[1] for row in db.exec_driver_sql("PRAGMA table_info(orders)")}
        assert {"user_id", "user_category"} <= order_columns
    engine.dispose()


def test_migration_creates_users_when_legacy_table_is_absent(tmp_path, monkeypatch):
    database_path = tmp_path / "fresh.sqlite"
    run_upgrade(database_path, monkeypatch)

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    assert {column["name"] for column in inspect(engine).get_columns("users")} >= {
        "id", "user_name", "user_email", "user_mobile", "user_addr1", "user_addr2", "pincode", "password"
    }
    engine.dispose()


def test_migration_resumes_after_partial_sqlite_upgrade(tmp_path, monkeypatch):
    database_path = tmp_path / "partial.sqlite"
    run_upgrade(database_path, monkeypatch, "0001_initial")

    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            user_name VARCHAR(160) NOT NULL,
            user_email VARCHAR(254),
            user_mobile VARCHAR(10) NOT NULL,
            user_addr1 VARCHAR(240),
            user_addr2 VARCHAR(240),
            pincode VARCHAR(6),
            password VARCHAR(255) NOT NULL
        );
        CREATE INDEX ix_users_user_email ON users (user_email);
        CREATE INDEX ix_users_user_mobile ON users (user_mobile);
        CREATE TABLE customer_sessions (
            id INTEGER PRIMARY KEY,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at DATETIME NOT NULL
        );
        CREATE UNIQUE INDEX ix_customer_sessions_token_hash ON customer_sessions (token_hash);
        CREATE INDEX ix_customer_sessions_user_id ON customer_sessions (user_id);
        CREATE INDEX ix_customer_sessions_expires_at ON customer_sessions (expires_at);
        ALTER TABLE orders ADD COLUMN user_id INTEGER;
        """
    )
    connection.commit()
    connection.close()

    run_upgrade(database_path, monkeypatch)

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    inspector = inspect(engine)
    assert "ix_orders_user_id" in {index["name"] for index in inspector.get_indexes("orders")}
    assert any(
        foreign_key["referred_table"] == "users" and foreign_key["constrained_columns"] == ["user_id"]
        for foreign_key in inspector.get_foreign_keys("orders")
    )
    with engine.connect() as db:
        assert db.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0003_order_user_category"
        assert "user_category" in {row[1] for row in db.exec_driver_sql("PRAGMA table_info(orders)")}
    engine.dispose()