"""precio_armazon y precio_lunas en ordenes_trabajo

Revision ID: 0025
Revises: 0024
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ordenes_trabajo", sa.Column("precio_armazon", sa.Numeric(10, 2), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("precio_lunas", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("ordenes_trabajo", "precio_lunas")
    op.drop_column("ordenes_trabajo", "precio_armazon")
