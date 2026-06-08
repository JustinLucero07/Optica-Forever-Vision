"""armazon_tipo y armazon_notas en pacientes

Revision ID: 0014_armazon_preferido
Revises: 0013_new_tables
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_armazon_preferido"
down_revision = "0013_new_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("pacientes", sa.Column("armazon_tipo", sa.String(100), nullable=True))
    op.add_column("pacientes", sa.Column("armazon_notas", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("pacientes", "armazon_notas")
    op.drop_column("pacientes", "armazon_tipo")
