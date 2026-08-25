"""orden trabajo referencia

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("ordenes_trabajo", sa.Column("referencia", sa.String(50), nullable=True))


def downgrade():
    op.drop_column("ordenes_trabajo", "referencia")
