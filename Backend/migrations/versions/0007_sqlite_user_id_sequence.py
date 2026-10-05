import sqlalchemy as sa
from alembic import op


revision = "0007_sqlite_user_id_sequence"
down_revision = "0006_users_id_foreign_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return

    if "user_id_sequence" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "user_id_sequence",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        )
        bind.execute(sa.text("INSERT INTO user_id_sequence (id) SELECT id FROM users ORDER BY id"))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite" and "user_id_sequence" in sa.inspect(bind).get_table_names():
        op.drop_table("user_id_sequence")