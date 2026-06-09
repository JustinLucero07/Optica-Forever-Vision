"""firma_url en users, proveedor_id en productos, numeradores faltantes"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    # firma_url en users
    op.add_column("users", sa.Column("firma_url", sa.Text(), nullable=True))

    # proveedor_id en productos
    op.add_column("productos", sa.Column("proveedor_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_productos_proveedor",
        "productos",
        "proveedores",
        ["proveedor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_productos_proveedor_id", "productos", ["proveedor_id"])

    # Numeradores que faltaban
    op.execute("""
        INSERT INTO configuraciones (clave, valor, descripcion)
        VALUES
          ('numerador_transferencia', '0', 'Último número de transferencia entre cuentas'),
          ('numerador_pago_sueldo', '0', 'Último número de pago/adelanto de sueldo')
        ON CONFLICT (clave) DO NOTHING
    """)


def downgrade():
    op.execute("DELETE FROM configuraciones WHERE clave IN ('numerador_transferencia','numerador_pago_sueldo')")
    op.drop_index("ix_productos_proveedor_id", table_name="productos")
    op.drop_constraint("fk_productos_proveedor", "productos", type_="foreignkey")
    op.drop_column("productos", "proveedor_id")
    op.drop_column("users", "firma_url")
