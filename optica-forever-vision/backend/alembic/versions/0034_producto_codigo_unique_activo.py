"""codigo de producto: unico solo entre productos activos

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-20
"""
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("productos_codigo_key", "productos", type_="unique")
    op.create_index(
        "ix_productos_codigo_activo_uniq", "productos", ["codigo"],
        unique=True, postgresql_where="activo = true AND codigo IS NOT NULL",
    )


def downgrade():
    op.drop_index("ix_productos_codigo_activo_uniq", table_name="productos")
    op.create_unique_constraint("productos_codigo_key", "productos", ["codigo"])
