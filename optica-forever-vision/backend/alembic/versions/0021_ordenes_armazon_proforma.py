"""armazón y proforma en ordenes_trabajo

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ordenes_trabajo", sa.Column("armazon_ref",   sa.String(150), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("armazon_color", sa.String(80),  nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("armazon_talla", sa.String(40),  nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("precio_venta",  sa.Numeric(10, 2), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("es_proforma",   sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("ordenes_trabajo", "armazon_ref")
    op.drop_column("ordenes_trabajo", "armazon_color")
    op.drop_column("ordenes_trabajo", "armazon_talla")
    op.drop_column("ordenes_trabajo", "precio_venta")
    op.drop_column("ordenes_trabajo", "es_proforma")
