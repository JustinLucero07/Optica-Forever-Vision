from decimal import Decimal
from sqlalchemy import ForeignKey, Numeric, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CxPItem(Base):
    """Ítems de una factura importada por XML SRI vinculados a una CuentaPorPagar."""
    __tablename__ = "cxp_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    cxp_id: Mapped[int] = mapped_column(
        ForeignKey("cuentas_por_pagar.id", ondelete="CASCADE"), nullable=False, index=True
    )
    codigo_proveedor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    producto_id: Mapped[int | None] = mapped_column(
        ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True
    )
