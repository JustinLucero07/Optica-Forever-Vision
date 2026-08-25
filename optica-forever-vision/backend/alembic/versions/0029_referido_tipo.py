"""referido tipo (referido / origen)

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None

ORIGENES_FIJOS = ["Recomendación", "Facebook", "Instagram", "TikTok", "Google", "Publicidad", "Redes Sociales", "Otro"]


def upgrade():
    op.add_column("referidos", sa.Column("tipo", sa.String(20), nullable=False, server_default="referido"))
    op.drop_constraint("referidos_nombre_key", "referidos", type_="unique")
    op.create_unique_constraint("referidos_tipo_nombre_key", "referidos", ["tipo", "nombre"])

    conn = op.get_bind()
    for nombre in ORIGENES_FIJOS:
        conn.execute(
            sa.text("INSERT INTO referidos (nombre, tipo, activo) VALUES (:n, 'origen', true) ON CONFLICT DO NOTHING"),
            {"n": nombre},
        )
    conn.execute(sa.text("""
        INSERT INTO referidos (nombre, tipo, activo)
        SELECT DISTINCT TRIM(origen), 'origen', true
        FROM pacientes
        WHERE origen IS NOT NULL AND TRIM(origen) != ''
        ON CONFLICT DO NOTHING
    """))


def downgrade():
    op.drop_constraint("referidos_tipo_nombre_key", "referidos", type_="unique")
    op.execute("DELETE FROM referidos WHERE tipo = 'origen'")
    op.create_unique_constraint("referidos_nombre_key", "referidos", ["nombre"])
    op.drop_column("referidos", "tipo")
