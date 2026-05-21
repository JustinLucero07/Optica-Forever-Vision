"""proveedores module: tabla proveedores, FK en ordenes_trabajo y cuentas_por_pagar

Revision ID: 0010_proveedores
Revises: 0009_config_text_firma
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_proveedores"
down_revision = "0009_config_text_firma"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "proveedores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ruc", sa.String(20), nullable=True),
        sa.Column("nombre", sa.String(150), nullable=False),
        sa.Column("nombre_comercial", sa.String(150), nullable=True),
        sa.Column("tipo", sa.String(30), nullable=False, server_default="laboratorio"),
        sa.Column("telefono", sa.String(20), nullable=True),
        sa.Column("telefono_2", sa.String(20), nullable=True),
        sa.Column("email", sa.String(120), nullable=True),
        sa.Column("direccion", sa.String(255), nullable=True),
        sa.Column("ciudad", sa.String(80), nullable=True),
        sa.Column("contacto", sa.String(100), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proveedores_ruc", "proveedores", ["ruc"], unique=True)

    # FK proveedor_id en ordenes_trabajo
    op.add_column("ordenes_trabajo", sa.Column("proveedor_id", sa.Integer(), nullable=True))
    op.create_index("ix_ordenes_trabajo_proveedor_id", "ordenes_trabajo", ["proveedor_id"])
    op.create_foreign_key(
        "fk_ordenes_trabajo_proveedor_id",
        "ordenes_trabajo", "proveedores",
        ["proveedor_id"], ["id"],
        ondelete="SET NULL",
    )

    # FK proveedor_id y orden_id en cuentas_por_pagar
    op.add_column("cuentas_por_pagar", sa.Column("proveedor_id", sa.Integer(), nullable=True))
    op.add_column("cuentas_por_pagar", sa.Column("orden_id", sa.Integer(), nullable=True))
    op.create_index("ix_cuentas_por_pagar_proveedor_id", "cuentas_por_pagar", ["proveedor_id"])
    op.create_index("ix_cuentas_por_pagar_orden_id", "cuentas_por_pagar", ["orden_id"])
    op.create_foreign_key(
        "fk_cuentas_por_pagar_proveedor_id",
        "cuentas_por_pagar", "proveedores",
        ["proveedor_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_cuentas_por_pagar_orden_id",
        "cuentas_por_pagar", "ordenes_trabajo",
        ["orden_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_cuentas_por_pagar_orden_id", "cuentas_por_pagar", type_="foreignkey")
    op.drop_constraint("fk_cuentas_por_pagar_proveedor_id", "cuentas_por_pagar", type_="foreignkey")
    op.drop_index("ix_cuentas_por_pagar_orden_id", "cuentas_por_pagar")
    op.drop_index("ix_cuentas_por_pagar_proveedor_id", "cuentas_por_pagar")
    op.drop_column("cuentas_por_pagar", "orden_id")
    op.drop_column("cuentas_por_pagar", "proveedor_id")

    op.drop_constraint("fk_ordenes_trabajo_proveedor_id", "ordenes_trabajo", type_="foreignkey")
    op.drop_index("ix_ordenes_trabajo_proveedor_id", "ordenes_trabajo")
    op.drop_column("ordenes_trabajo", "proveedor_id")

    op.drop_index("ix_proveedores_ruc", "proveedores")
    op.drop_table("proveedores")
