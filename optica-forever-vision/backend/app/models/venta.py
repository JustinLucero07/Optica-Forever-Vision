from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Venta(Base):
    __tablename__ = "ventas"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    paciente_id: Mapped[int | None] = mapped_column(
        ForeignKey("pacientes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    descuento: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list["VentaItem"]] = relationship(
        "VentaItem", back_populates="venta", cascade="all, delete-orphan"
    )


class VentaItem(Base):
    __tablename__ = "venta_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(
        ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    producto_id: Mapped[int | None] = mapped_column(
        ForeignKey("productos.id", ondelete="SET NULL"), nullable=True
    )
    descripcion: Mapped[str] = mapped_column(String(255), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    descuento_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    venta: Mapped["Venta"] = relationship("Venta", back_populates="items")
