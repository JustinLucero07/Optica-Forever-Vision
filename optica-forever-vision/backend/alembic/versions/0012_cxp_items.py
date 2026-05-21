"""tabla cxp_items: items de facturas importadas desde XML SRI

Revision ID: 0012_cxp_items
Revises: 0011_sri_producto_map
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_cxp_items"
down_revision = "0011_sri_producto_map"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cxp_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cxp_id", sa.Integer(), nullable=False),
        sa.Column("codigo_proveedor", sa.String(100), nullable=True),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(10, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["cxp_id"], ["cuentas_por_pagar.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_cxp_items_cxp_id", "cxp_items", ["cxp_id"])
    op.create_index("ix_cxp_items_producto_id", "cxp_items", ["producto_id"])


def downgrade():
    op.drop_index("ix_cxp_items_producto_id", "cxp_items")
    op.drop_index("ix_cxp_items_cxp_id", "cxp_items")
    op.drop_table("cxp_items")
