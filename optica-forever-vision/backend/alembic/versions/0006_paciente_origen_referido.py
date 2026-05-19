"""add origen and referido_por to pacientes

Revision ID: 0006_paciente_origen_referido
Revises: 0005_agenda
Create Date: 2026-05-18
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_paciente_origen_referido"
down_revision: Union[str, None] = "0005_agenda"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pacientes", sa.Column("origen", sa.String(100), nullable=True))
    op.add_column("pacientes", sa.Column("referido_por", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("pacientes", "referido_por")
    op.drop_column("pacientes", "origen")
