"""mejoras v2: keratometria, garantias, trial_lc, caja_diaria

Revision ID: 0016
Revises: 0015_abono_inicial
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015_abono_inicial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Queratometría en consultas ─────────────────────────────────────────────
    op.add_column("consultas", sa.Column("k_od_1", sa.Numeric(5, 2), nullable=True))
    op.add_column("consultas", sa.Column("k_od_2", sa.Numeric(5, 2), nullable=True))
    op.add_column("consultas", sa.Column("k_od_eje", sa.Integer(), nullable=True))
    op.add_column("consultas", sa.Column("k_oi_1", sa.Numeric(5, 2), nullable=True))
    op.add_column("consultas", sa.Column("k_oi_2", sa.Numeric(5, 2), nullable=True))
    op.add_column("consultas", sa.Column("k_oi_eje", sa.Integer(), nullable=True))

    # ── Garantía en venta_items ────────────────────────────────────────────────
    op.add_column("venta_items", sa.Column("garantia_meses", sa.Integer(), nullable=True))
    op.add_column("venta_items", sa.Column("garantia_vence", sa.Date(), nullable=True))

    # ── Trial LC ──────────────────────────────────────────────────────────────
    op.create_table(
        "trial_lc",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paciente_id", sa.Integer(), sa.ForeignKey("pacientes.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("consulta_id", sa.Integer(), sa.ForeignKey("consultas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("fecha_entrega", sa.Date(), nullable=False),
        sa.Column("fecha_control", sa.Date(), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="entregado"),
        sa.Column("od_marca", sa.String(100), nullable=True),
        sa.Column("od_bc", sa.Numeric(4, 2), nullable=True),
        sa.Column("od_diam", sa.Numeric(4, 2), nullable=True),
        sa.Column("od_esf", sa.Numeric(5, 2), nullable=True),
        sa.Column("od_cil", sa.Numeric(5, 2), nullable=True),
        sa.Column("od_eje", sa.Integer(), nullable=True),
        sa.Column("oi_marca", sa.String(100), nullable=True),
        sa.Column("oi_bc", sa.Numeric(4, 2), nullable=True),
        sa.Column("oi_diam", sa.Numeric(4, 2), nullable=True),
        sa.Column("oi_esf", sa.Numeric(5, 2), nullable=True),
        sa.Column("oi_cil", sa.Numeric(5, 2), nullable=True),
        sa.Column("oi_eje", sa.Integer(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    # ── Caja Diaria ───────────────────────────────────────────────────────────
    op.create_table(
        "caja_diaria",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.Date(), nullable=False, unique=True, index=True),
        sa.Column("usuario_apertura_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("usuario_cierre_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("saldo_apertura", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("saldo_cierre", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_efectivo", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_tarjeta", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_transferencia", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_egresos", sa.Numeric(10, 2), nullable=True),
        sa.Column("diferencia", sa.Numeric(10, 2), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="abierta"),
        sa.Column("notas_apertura", sa.Text(), nullable=True),
        sa.Column("notas_cierre", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("caja_diaria")
    op.drop_table("trial_lc")
    op.drop_column("venta_items", "garantia_vence")
    op.drop_column("venta_items", "garantia_meses")
    op.drop_column("consultas", "k_oi_eje")
    op.drop_column("consultas", "k_oi_2")
    op.drop_column("consultas", "k_oi_1")
    op.drop_column("consultas", "k_od_eje")
    op.drop_column("consultas", "k_od_2")
    op.drop_column("consultas", "k_od_1")
