import sqlalchemy as sa
from alembic import op


revision = "0006_users_id_foreign_key"
down_revision = "0005_admin_product_order_management"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_users_id_foreign_key"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    primary_key = inspector.get_pk_constraint("users").get("constrained_columns", [])
    if primary_key == ["id"]:
        return

    indexes = inspector.get_indexes("users")
    if any(index.get("unique") and index.get("column_names") == ["id"] for index in indexes):
        return

    duplicate_id = bind.execute(
        sa.text("SELECT id FROM users GROUP BY id HAVING COUNT(*) > 1 LIMIT 1")
    ).first()
    if duplicate_id:
        raise RuntimeError("Cannot repair users.id foreign keys because duplicate user IDs exist.")

    op.create_index(INDEX_NAME, "users", ["id"], unique=True)


def downgrade() -> None:
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("users")}
    if INDEX_NAME in indexes:
        op.drop_index(INDEX_NAME, table_name="users")