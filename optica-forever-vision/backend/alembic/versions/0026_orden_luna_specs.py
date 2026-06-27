"""orden luna specs

Revision ID: 0026
Revises: 0025
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ordenes_trabajo", sa.Column("luna_material", sa.String(80), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("luna_tratamientos", sa.String(250), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("luna_color", sa.String(80), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("luna_indice", sa.String(20), nullable=True))
    op.add_column("ordenes_trabajo", sa.Column("luna_diametro", sa.String(30), nullable=True))


def downgrade():
    op.drop_column("ordenes_trabajo", "luna_diametro")
    op.drop_column("ordenes_trabajo", "luna_indice")
    op.drop_column("ordenes_trabajo", "luna_color")
    op.drop_column("ordenes_trabajo", "luna_tratamientos")
    op.drop_column("ordenes_trabajo", "luna_material")
