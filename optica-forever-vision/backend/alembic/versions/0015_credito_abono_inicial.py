"""abono_inicial en creditos

Revision ID: 0015_abono_inicial
Revises: 0014_armazon_preferido
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_abono_inicial"
down_revision = "0014_armazon_preferido"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("creditos", sa.Column(
        "abono_inicial",
        sa.Numeric(10, 2),
        nullable=False,
        server_default="0",
    ))


def downgrade():
    op.drop_column("creditos", "abono_inicial")
