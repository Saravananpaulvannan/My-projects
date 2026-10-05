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
    assert {"id", "user_name", "user_email", "user_mobile", "user_addr1", "user_addr2", "pincode", "password", "is_admin"} <= columns
    with engine.connect() as db:
        user = db.exec_driver_sql("SELECT user_name, user_email, user_mobile, password, is_admin FROM users").one()
        assert user[0:3] == ("Legacy Customer", "legacy@example.com", "9876543210")
        assert PasswordHash.recommended().verify("legacy-password", user[3])
        assert user[4] == 0
        assert db.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0007_sqlite_user_id_sequence"
        assert db.exec_driver_sql("PRAGMA table_info(orders)").fetchall()
        order_columns = {row[1] for row in db.exec_driver_sql("PRAGMA table_info(orders)")}
        assert {"user_id", "user_category", "delivery_status"} <= order_columns
        assert "stock_quantity" in {row[1] for row in db.exec_driver_sql("PRAGMA table_info(products)")}
    engine.dispose()


def test_migration_creates_users_when_legacy_table_is_absent(tmp_path, monkeypatch):
    database_path = tmp_path / "fresh.sqlite"
    run_upgrade(database_path, monkeypatch)

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    assert {column["name"] for column in inspect(engine).get_columns("users")} >= {
        "id", "user_name", "user_email", "user_mobile", "user_addr1", "user_addr2", "pincode", "password", "is_admin"
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
        assert db.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "0007_sqlite_user_id_sequence"
        assert "user_category" in {row[1] for row in db.exec_driver_sql("PRAGMA table_info(orders)")}
    engine.dispose()


def test_admin_role_migration_can_be_downgraded(tmp_path, monkeypatch):
    database_path = tmp_path / "downgrade.sqlite"
    run_upgrade(database_path, monkeypatch)
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    command.downgrade(config, "0003_order_user_category")

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    assert "is_admin" not in {column["name"] for column in inspect(engine).get_columns("users")}
    engine.dispose()


def test_migration_repairs_composite_user_primary_key_foreign_keys(tmp_path, monkeypatch):
    database_path = tmp_path / "composite-users.sqlite"
    run_upgrade(database_path, monkeypatch, "0001_initial")

    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER NOT NULL,
            user_name VARCHAR(160) NOT NULL,
            user_email VARCHAR(254),
            user_mobile VARCHAR(10) NOT NULL,
            user_addr1 VARCHAR(240),
            user_addr2 VARCHAR(240),
            pincode VARCHAR(6),
            password VARCHAR(255) NOT NULL,
            PRIMARY KEY (id, user_email)
        );
        INSERT INTO users (id, user_name, user_email, user_mobile, password)
        VALUES (7, 'Legacy Customer', 'legacy@example.com', '9876543210', 'hashed-password');
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
    assert "uq_users_id_foreign_key" in {index["name"] for index in inspect(engine).get_indexes("users")}
    with engine.connect() as db:
        db.exec_driver_sql("PRAGMA foreign_keys=ON")
        next_user_id = db.exec_driver_sql("INSERT INTO user_id_sequence DEFAULT VALUES RETURNING id").scalar_one()
        assert next_user_id == 8
        db.exec_driver_sql(
            "INSERT INTO customer_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            ("a" * 64, 7, "2030-01-01 00:00:00"),
        )
        assert db.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    engine.dispose()