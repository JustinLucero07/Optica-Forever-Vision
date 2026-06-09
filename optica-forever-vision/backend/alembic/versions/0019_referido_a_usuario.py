"""referido_a_usuario en pacientes

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pacientes",
        sa.Column("referido_a_usuario_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pacientes_referido_a_usuario",
        "pacientes", "users",
        ["referido_a_usuario_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_pacientes_referido_a_usuario_id", "pacientes", ["referido_a_usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_pacientes_referido_a_usuario_id", table_name="pacientes")
    op.drop_constraint("fk_pacientes_referido_a_usuario", "pacientes", type_="foreignkey")
    op.drop_column("pacientes", "referido_a_usuario_id")
