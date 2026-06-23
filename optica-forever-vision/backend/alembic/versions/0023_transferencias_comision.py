"""comision en transferencias_cuentas

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transferencias_cuentas",
        sa.Column("comision", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("transferencias_cuentas", "comision")
