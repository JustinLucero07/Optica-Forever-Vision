"""seed opciones de material/indice/tratamiento de lunas

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None

MATERIALES = ["CR-39 (Orgánico)", "Policarbonato", "Trivex", "Alto índice 1.60", "Alto índice 1.67", "Alto índice 1.74", "Mineral (vidrio)"]
INDICES = ["1.50", "1.53", "1.56", "1.60", "1.67", "1.74"]
TRATAMIENTOS = ["Antirreflejo", "Fotocromático", "Polarizado", "BlueCut", "UV400", "Hidrófobo", "Antirrasguño"]


def upgrade():
    conn = op.get_bind()
    for tipo, valores in [("luna_material", MATERIALES), ("luna_indice", INDICES), ("luna_tratamiento", TRATAMIENTOS)]:
        for nombre in valores:
            conn.execute(
                sa.text("INSERT INTO referidos (nombre, tipo, activo) VALUES (:n, :t, true) ON CONFLICT DO NOTHING"),
                {"n": nombre, "t": tipo},
            )


def downgrade():
    op.execute("DELETE FROM referidos WHERE tipo IN ('luna_material', 'luna_indice', 'luna_tratamiento')")
