from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from hashlib import sha256

import sqlalchemy as sa
from alembic import op
from pwdlib import PasswordHash


revision = "0002_customer_accounts"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

password_hash = PasswordHash.recommended()


def _hash_legacy_password(value: str | None) -> str:
    if value and value.startswith("$argon2"):
        return value
    return password_hash.hash(value or token_urlsafe(32))


def _create_users_table() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_name", sa.String(length=160), nullable=False),
        sa.Column("user_email", sa.String(length=254), nullable=True),
        sa.Column("user_mobile", sa.String(length=10), nullable=False),
        sa.Column("user_addr1", sa.String(length=240), nullable=True),
        sa.Column("user_addr2", sa.String(length=240), nullable=True),
        sa.Column("pincode", sa.String(length=6), nullable=True),
        sa.Column("password", sa.String(length=255), nullable=False),
    )


def upgrade() -> None:
    bind = op.get_bind()
    table_names = set(sa.inspect(bind).get_table_names())

    if "users" not in table_names:
        _create_users_table()
    else:
        existing_columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
        required_columns = {
            "id", "user_name", "user_email", "user_mobile", "user_addr1", "user_addr2", "pincode", "password"
        }
        if not required_columns.issubset(existing_columns):
            legacy_rows = bind.execute(sa.text("SELECT rowid AS legacy_id, * FROM users")).mappings().all()
            legacy_columns = existing_columns
            op.rename_table("users", "users_legacy_0002")
            _create_users_table()

            users_table = sa.table(
                "users",
                sa.column("id", sa.Integer()),
                sa.column("user_name", sa.String()),
                sa.column("user_email", sa.String()),
                sa.column("user_mobile", sa.String()),
                sa.column("user_addr1", sa.String()),
                sa.column("user_addr2", sa.String()),
                sa.column("pincode", sa.String()),
                sa.column("password", sa.String()),
            )
            for legacy in legacy_rows:
                row = dict(legacy)
                user_id = row.get("id") or row.get("legacy_id")
                op.bulk_insert(
                    users_table,
                    [{
                        "id": user_id,
                        "user_name": row.get("user_name") or row.get("name") or "Customer",
                        "user_email": row.get("user_email") or row.get("email"),
                        "user_mobile": row.get("user_mobile") or row.get("mobile") or "0000000000",
                        "user_addr1": row.get("user_addr1") or row.get("address") or row.get("address_line1"),
                        "user_addr2": row.get("user_addr2") or row.get("address_line2"),
                        "pincode": row.get("pincode"),
                        "password": _hash_legacy_password(row.get("password")),
                    }],
                )
            op.drop_table("users_legacy_0002")

    index_names = {index["name"] for index in sa.inspect(bind).get_indexes("users")}
    if "ix_users_user_email" not in index_names:
        op.create_index("ix_users_user_email", "users", ["user_email"])
    if "ix_users_user_mobile" not in index_names:
        op.create_index("ix_users_user_mobile", "users", ["user_mobile"])

    if "customer_sessions" not in set(sa.inspect(bind).get_table_names()):
        op.create_table(
            "customer_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        )

    session_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("customer_sessions")}
    if "ix_customer_sessions_token_hash" not in session_indexes:
        op.create_index("ix_customer_sessions_token_hash", "customer_sessions", ["token_hash"], unique=True)
    if "ix_customer_sessions_user_id" not in session_indexes:
        op.create_index("ix_customer_sessions_user_id", "customer_sessions", ["user_id"])
    if "ix_customer_sessions_expires_at" not in session_indexes:
        op.create_index("ix_customer_sessions_expires_at", "customer_sessions", ["expires_at"])

    order_columns = {column["name"] for column in sa.inspect(bind).get_columns("orders")}
    order_foreign_keys = sa.inspect(bind).get_foreign_keys("orders")
    has_user_foreign_key = any(
        foreign_key.get("referred_table") == "users"
        and foreign_key.get("constrained_columns") == ["user_id"]
        for foreign_key in order_foreign_keys
    )
    if "user_id" not in order_columns:
        with op.batch_alter_table("orders") as batch_op:
            batch_op.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key("fk_orders_user_id_users", "users", ["user_id"], ["id"])
    elif not has_user_foreign_key:
        with op.batch_alter_table("orders") as batch_op:
            batch_op.create_foreign_key("fk_orders_user_id_users", "users", ["user_id"], ["id"])

    order_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("orders")}
    if "ix_orders_user_id" not in order_indexes:
        op.create_index("ix_orders_user_id", "orders", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_column("orders", "user_id")
    op.drop_index("ix_customer_sessions_expires_at", table_name="customer_sessions")
    op.drop_index("ix_customer_sessions_user_id", table_name="customer_sessions")
    op.drop_index("ix_customer_sessions_token_hash", table_name="customer_sessions")
    op.drop_table("customer_sessions")
    op.drop_index("ix_users_user_mobile", table_name="users")
    op.drop_index("ix_users_user_email", table_name="users")