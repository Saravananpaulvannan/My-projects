import sqlite3
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from alembic import command
from alembic.config import Config
from pwdlib import PasswordHash
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.database import Base
from app.config import settings
from app.migrate_sqlite_to_mysql import copy_application_data
from app.models import AdminSession, CustomerSession, Order, OrderItem, Product, User


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


def test_sqlite_data_copy_preserves_application_rows(tmp_path):
    source_engine = create_engine(f"sqlite:///{(tmp_path / 'source.sqlite').as_posix()}")
    target_engine = create_engine(f"sqlite:///{(tmp_path / 'target.sqlite').as_posix()}")
    Base.metadata.create_all(source_engine)
    Base.metadata.create_all(target_engine)

    with Session(source_engine) as db:
        user = User(
            id=12,
            user_name="Migration Customer",
            user_email="migration@example.com",
            user_mobile="9876543210",
            password="argon-hash",
            is_admin=True,
        )
        product = Product(
            id=45,
            name="Migration Product",
            category="Sparklers",
            mrp=100,
            price=10,
            pack_unit="Box",
            stock_quantity=4,
            is_active=True,
        )
        order = Order(
            id=67,
            order_number="ACMIGRATE01",
            customer_name="Migration Customer",
            phone="9876543210",
            address="12 Example Road",
            city="Sivakasi",
            state="Tamil Nadu",
            pincode="626123",
            payment_method="cod",
            user_id=12,
            subtotal=Decimal(10),
            total=Decimal(10),
            status="received",
            delivery_status="Packed",
        )
        order.items.append(OrderItem(
            product_id=45,
            name="Migration Product",
            pack_unit="Box",
            mrp=100,
            price=10,
            quantity=1,
            line_total=Decimal(10),
        ))
        db.add_all([
            user,
            product,
            order,
            AdminSession(token_hash="a" * 64, phone="9876543210", expires_at=datetime.now(UTC) + timedelta(hours=1)),
            CustomerSession(token_hash="b" * 64, user_id=12, expires_at=datetime.now(UTC) + timedelta(hours=1)),
        ])
        db.commit()

    copied = copy_application_data(source_engine, target_engine)
    assert copied == {
        "products": 1,
        "users": 1,
        "orders": 1,
        "order_items": 1,
        "admin_sessions": 1,
        "customer_sessions": 1,
    }
    with Session(target_engine) as db:
        assert db.get(Product, 45).name == "Migration Product"
        assert db.get(User, 12).is_admin is True
        migrated_order = db.scalar(select(Order).where(Order.order_number == "ACMIGRATE01"))
        assert migrated_order.user_id == 12
        assert migrated_order.delivery_status == "Packed"
        assert migrated_order.items[0].price == 10
        assert db.get(CustomerSession, 1).user_id == 12
    source_engine.dispose()
    target_engine.dispose()