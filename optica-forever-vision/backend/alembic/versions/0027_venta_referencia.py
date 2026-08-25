"""venta referencia

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ventas", sa.Column("referencia", sa.String(50), nullable=True))


def downgrade():
    op.drop_column("ventas", "referencia")
