"""diag_od y diag_oi en consultas

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("consultas", sa.Column("diag_od", sa.String(255), nullable=True))
    op.add_column("consultas", sa.Column("diag_oi", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("consultas", "diag_od")
    op.drop_column("consultas", "diag_oi")
