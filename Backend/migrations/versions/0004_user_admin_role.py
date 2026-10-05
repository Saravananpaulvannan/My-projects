import sqlalchemy as sa
from alembic import op


revision = "0004_user_admin_role"
down_revision = "0003_order_user_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "is_admin" not in columns:
        op.add_column(
            "users",
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "is_admin" in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("is_admin")