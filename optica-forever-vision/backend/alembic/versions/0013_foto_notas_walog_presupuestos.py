"""foto paciente, notas, whatsapp_logs, presupuestos

Revision ID: 0013_new_tables
Revises: 0012_cxp_items
Create Date: 2026-06-07
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_new_tables"
down_revision = "0012_cxp_items"
branch_labels = None
depends_on = None


def upgrade():
    # ── pacientes.foto ─────────────────────────────────────────────────────────
    op.add_column("pacientes", sa.Column("foto", sa.Text(), nullable=True))

    # ── paciente_notas ──────────────��──────────────────────────────────────────
    op.create_table(
        "paciente_notas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paciente_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["paciente_id"], ["pacientes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_paciente_notas_paciente_id", "paciente_notas", ["paciente_id"])

    # ── whatsapp_logs ───────────────────────────────────────────────────���─────
    op.create_table(
        "whatsapp_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paciente_id", sa.Integer(), nullable=True),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("template", sa.String(100), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="enviado"),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["paciente_id"], ["pacientes.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_whatsapp_logs_paciente_id", "whatsapp_logs", ["paciente_id"])
    op.create_index("ix_whatsapp_logs_created_at", "whatsapp_logs", ["created_at"])

    # ── presupuestos ─────────────────────────────────────────────────────��─────
    op.create_table(
        "presupuestos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero", sa.String(20), unique=True, nullable=False),
        sa.Column("paciente_id", sa.Integer(), nullable=True),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("validez_dias", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["paciente_id"], ["pacientes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_presupuestos_paciente_id", "presupuestos", ["paciente_id"])

    # ── presupuesto_items ─────────────────────────────────────────────────────
    op.create_table(
        "presupuesto_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("presupuesto_id", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("precio_unitario", sa.Numeric(10, 2), nullable=False),
        sa.Column("descuento", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.ForeignKeyConstraint(["presupuesto_id"], ["presupuestos.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_presupuesto_items_presupuesto_id", "presupuesto_items", ["presupuesto_id"])


    # Numerador para presupuestos
    op.execute("INSERT INTO configuraciones (clave, valor) VALUES ('numerador_presupuesto', '0') ON CONFLICT (clave) DO NOTHING")


def downgrade():
    op.drop_index("ix_presupuesto_items_presupuesto_id", "presupuesto_items")
    op.drop_table("presupuesto_items")
    op.drop_index("ix_presupuestos_paciente_id", "presupuestos")
    op.drop_table("presupuestos")
    op.drop_index("ix_whatsapp_logs_created_at", "whatsapp_logs")
    op.drop_index("ix_whatsapp_logs_paciente_id", "whatsapp_logs")
    op.drop_table("whatsapp_logs")
    op.drop_index("ix_paciente_notas_paciente_id", "paciente_notas")
    op.drop_table("paciente_notas")
    op.drop_column("pacientes", "foto")
