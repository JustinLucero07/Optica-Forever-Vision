"""orden lab_telefono

Revision ID: 0008_orden_lab_telefono
Revises: 0007_creditos
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_orden_lab_telefono"
down_revision = "0007_creditos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ordenes_trabajo",
        sa.Column("lab_telefono", sa.String(30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ordenes_trabajo", "lab_telefono")
