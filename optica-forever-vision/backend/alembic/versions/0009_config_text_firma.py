"""config valor text + firma key

Revision ID: 0009_config_text_firma
Revises: 0008_orden_lab_telefono
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0009_config_text_firma"
down_revision = "0008_orden_lab_telefono"
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column("configuraciones", "valor",
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=False,
    )
    # Seed config defaults (ignore if exists)
    op.execute("""
        INSERT INTO configuraciones (clave, valor, descripcion) VALUES
        ('firma_electronica', '', 'Firma en base64 para documentos impresos'),
        ('nombre_optica', 'Óptica Forever Vision', 'Nombre de la óptica'),
        ('direccion_optica', 'Av. 24 de mayo y Puyo, Cuenca', 'Dirección'),
        ('telefono_optica', '', 'Teléfono de contacto')
        ON CONFLICT (clave) DO NOTHING
    """)

def downgrade():
    op.alter_column("configuraciones", "valor",
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=False,
    )
