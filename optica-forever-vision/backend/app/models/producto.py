from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.core.db import Base
from app.models.proveedor import Proveedor


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(255), nullable=True)

    productos: Mapped[list["Producto"]] = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True, index=True
    )
    precio_costo: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    stock_actual: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    unidad: Mapped[str] = mapped_column(String(30), nullable=False, default="unidad")
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    proveedor_id: Mapped[int | None] = mapped_column(
        ForeignKey("proveedores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    categoria: Mapped["Categoria | None"] = relationship("Categoria", back_populates="productos")
    proveedor: Mapped["Proveedor | None"] = relationship("Proveedor", foreign_keys=[proveedor_id], lazy="joined")


class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # entrada | salida | ajuste
    cantidad: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock_antes: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    stock_despues: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    motivo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    referencia: Mapped[str | None] = mapped_column(String(50), nullable=True)  # VEN-0094, etc.
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
