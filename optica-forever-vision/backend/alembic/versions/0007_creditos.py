"""add creditos and cuotas_credito tables

Revision ID: 0007_creditos
Revises: 0006_paciente_origen_referido
Create Date: 2026-05-18
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_creditos"
down_revision: Union[str, None] = "0006_paciente_origen_referido"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "creditos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("venta_id", sa.Integer, sa.ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("paciente_id", sa.Integer, sa.ForeignKey("pacientes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("monto_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("monto_pagado", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("numero_cuotas", sa.Integer, nullable=False),
        sa.Column("periodicidad", sa.String(20), nullable=False, server_default="mensual"),
        sa.Column("fecha_inicio", sa.Date, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="vigente"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column("usuario_id", sa.Integer, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_creditos_paciente_id", "creditos", ["paciente_id"])
    op.create_index("ix_creditos_venta_id", "creditos", ["venta_id"])

    op.create_table(
        "cuotas_credito",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("credito_id", sa.Integer, sa.ForeignKey("creditos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("numero_cuota", sa.Integer, nullable=False),
        sa.Column("fecha_vencimiento", sa.Date, nullable=False),
        sa.Column("monto", sa.Numeric(10, 2), nullable=False),
        sa.Column("monto_pagado", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("fecha_pago", sa.Date, nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("recordatorio_enviado", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_cuotas_credito_id", "cuotas_credito", ["credito_id"])

    # Seed numerador
    op.execute("INSERT INTO configuraciones (clave, valor, descripcion) VALUES ('numerador_credito', '0', 'Último número de crédito/plan de pago')")


def downgrade() -> None:
    op.execute("DELETE FROM configuraciones WHERE clave = 'numerador_credito'")
    op.drop_table("cuotas_credito")
    op.drop_table("creditos")
