"""referidos master list

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "referidos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(150), nullable=False, unique=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.execute("""
        INSERT INTO referidos (nombre)
        SELECT DISTINCT TRIM(referido_por)
        FROM pacientes
        WHERE referido_por IS NOT NULL AND TRIM(referido_por) != ''
        ON CONFLICT (nombre) DO NOTHING
    """)


def downgrade():
    op.drop_table("referidos")
