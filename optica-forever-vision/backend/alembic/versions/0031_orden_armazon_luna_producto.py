"""orden armazon/luna producto_id

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ordenes_trabajo", sa.Column("armazon_producto_id", sa.Integer(), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("luna_producto_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_ordenes_armazon_producto", "ordenes_trabajo", "productos",
        ["armazon_producto_id"], ["id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_ordenes_luna_producto", "ordenes_trabajo", "productos",
        ["luna_producto_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_ordenes_armazon_producto_id", "ordenes_trabajo", ["armazon_producto_id"])
    op.create_index("ix_ordenes_luna_producto_id", "ordenes_trabajo", ["luna_producto_id"])


def downgrade():
    op.drop_index("ix_ordenes_luna_producto_id", table_name="ordenes_trabajo")
    op.drop_index("ix_ordenes_armazon_producto_id", table_name="ordenes_trabajo")
    op.drop_constraint("fk_ordenes_luna_producto", "ordenes_trabajo", type_="foreignkey")
    op.drop_constraint("fk_ordenes_armazon_producto", "ordenes_trabajo", type_="foreignkey")
    op.drop_column("ordenes_trabajo", "luna_producto_id")
    op.drop_column("ordenes_trabajo", "armazon_producto_id")
