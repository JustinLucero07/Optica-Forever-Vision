"""seed opciones de material/tratamiento/diseno de prescripcion (rx)

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None

MATERIALES = ["Orgánico 1.50", "Orgánico 1.56", "Orgánico 1.60", "Orgánico 1.67", "Orgánico 1.74", "Policarbonato", "Trivex", "Cristal", "Otro"]
TRATAMIENTOS = [
    "Sin tratamiento", "Antireflejo", "Antireflejo + UV", "Antireflejo + UV + Endurecido",
    "Fotocromático", "Fotocromático + Antireflejo", "Filtro azul", "Filtro azul + Antireflejo",
    "AR + Filtro azul", "Espejado",
]
DISENOS = [
    "Monofocal", "Bifocal plano", "Bifocal redondo",
    "Progresivo económico", "Progresivo premium", "Progresivo personalizado",
    "Lente contacto suave", "Lente contacto rígido", "Ocupacional", "Otro",
]


def upgrade():
    conn = op.get_bind()
    for tipo, valores in [("rx_material", MATERIALES), ("rx_tratamiento", TRATAMIENTOS), ("rx_diseno", DISENOS)]:
        for nombre in valores:
            conn.execute(
                sa.text("INSERT INTO referidos (nombre, tipo, activo) VALUES (:n, :t, true) ON CONFLICT DO NOTHING"),
                {"n": nombre, "t": tipo},
            )


def downgrade():
    op.execute("DELETE FROM referidos WHERE tipo IN ('rx_material', 'rx_tratamiento', 'rx_diseno')")
