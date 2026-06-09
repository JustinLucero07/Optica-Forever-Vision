"""sueldos y transferencias entre cuentas

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Transferencias entre cuentas ──────────────────────────────────────────
    op.create_table(
        "transferencias_cuentas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero", sa.String(20), unique=True, nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("cuenta_origen_id", sa.Integer(), sa.ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cuenta_destino_id", sa.Integer(), sa.ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("monto", sa.Numeric(10, 2), nullable=False),
        sa.Column("concepto", sa.String(255), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── Configuración de sueldos ──────────────────────────────────────────────
    op.create_table(
        "sueldo_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("monto_mensual", sa.Numeric(10, 2), nullable=False),
        sa.Column("dia_pago", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── Pagos de sueldo ───────────────────────────────────────────────────────
    op.create_table(
        "pagos_sueldo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero", sa.String(20), unique=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("periodo", sa.String(7), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("monto", sa.Numeric(10, 2), nullable=False),
        sa.Column("cuenta_bancaria_id", sa.Integer(), sa.ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("egreso_id", sa.Integer(), sa.ForeignKey("egresos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("pagado_por_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("pagos_sueldo")
    op.drop_table("sueldo_config")
    op.drop_table("transferencias_cuentas")
