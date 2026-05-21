"""tabla proveedor_producto_map para mapear codigos SRI a productos internos

Revision ID: 0011_sri_producto_map
Revises: 0010_proveedores
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_sri_producto_map"
down_revision = "0010_proveedores"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "proveedor_producto_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("proveedor_id", sa.Integer(), nullable=True),
        sa.Column("codigo_proveedor", sa.String(100), nullable=False),
        sa.Column("descripcion_proveedor", sa.String(255), nullable=True),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["proveedor_id"], ["proveedores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("proveedor_id", "codigo_proveedor", name="uq_proveedor_codigo"),
    )
    op.create_index("ix_ppm_proveedor_id", "proveedor_producto_map", ["proveedor_id"])
    op.create_index("ix_ppm_codigo_proveedor", "proveedor_producto_map", ["codigo_proveedor"])
    op.create_index("ix_ppm_producto_id", "proveedor_producto_map", ["producto_id"])


def downgrade():
    op.drop_index("ix_ppm_producto_id", "proveedor_producto_map")
    op.drop_index("ix_ppm_codigo_proveedor", "proveedor_producto_map")
    op.drop_index("ix_ppm_proveedor_id", "proveedor_producto_map")
    op.drop_table("proveedor_producto_map")
