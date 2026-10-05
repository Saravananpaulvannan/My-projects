import sqlalchemy as sa
from alembic import op


revision = "0005_admin_product_order_management"
down_revision = "0004_user_admin_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    product_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("products")}
    if "description" not in product_columns:
        op.add_column("products", sa.Column("description", sa.Text(), nullable=True))
    if "image_path" not in product_columns:
        op.add_column("products", sa.Column("image_path", sa.String(length=255), nullable=True))
    if "stock_quantity" not in product_columns:
        op.add_column(
            "products",
            sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        )

    order_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("orders")}
    if "delivery_status" not in order_columns:
        op.add_column(
            "orders",
            sa.Column("delivery_status", sa.String(length=20), nullable=False, server_default="Placed"),
        )


def downgrade() -> None:
    order_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("orders")}
    if "delivery_status" in order_columns:
        with op.batch_alter_table("orders") as batch_op:
            batch_op.drop_column("delivery_status")

    product_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("products")}
    with op.batch_alter_table("products") as batch_op:
        for column in ("stock_quantity", "image_path", "description"):
            if column in product_columns:
                batch_op.drop_column(column)