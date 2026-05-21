from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ProveedorProductoMap(Base):
    """Mapea código de proveedor (del XML SRI) → producto interno del inventario."""
    __tablename__ = "proveedor_producto_map"
    __table_args__ = (
        UniqueConstraint("proveedor_id", "codigo_proveedor", name="uq_proveedor_codigo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    proveedor_id: Mapped[int | None] = mapped_column(
        ForeignKey("proveedores.id", ondelete="CASCADE"), nullable=True, index=True
    )
    codigo_proveedor: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    descripcion_proveedor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
