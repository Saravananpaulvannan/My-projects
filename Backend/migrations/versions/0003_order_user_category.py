from alembic import op
import sqlalchemy as sa


revision = "0003_order_user_category"
down_revision = "0002_customer_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    order_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("orders")}
    if "user_category" not in order_columns:
        op.add_column(
            "orders",
            sa.Column("user_category", sa.String(length=16), nullable=False, server_default="guest"),
        )


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("user_category")