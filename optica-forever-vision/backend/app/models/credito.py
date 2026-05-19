from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Credito(Base):
    __tablename__ = "creditos"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    venta_id: Mapped[int | None] = mapped_column(
        ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    paciente_id: Mapped[int | None] = mapped_column(
        ForeignKey("pacientes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    monto_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    monto_pagado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    numero_cuotas: Mapped[int] = mapped_column(Integer, nullable=False)
    periodicidad: Mapped[str] = mapped_column(String(20), nullable=False, default="mensual")
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="vigente")
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    cuotas: Mapped[list["CuotaCredito"]] = relationship(
        "CuotaCredito", back_populates="credito", cascade="all, delete-orphan",
        order_by="CuotaCredito.numero_cuota",
    )


class CuotaCredito(Base):
    __tablename__ = "cuotas_credito"

    id: Mapped[int] = mapped_column(primary_key=True)
    credito_id: Mapped[int] = mapped_column(
        ForeignKey("creditos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    numero_cuota: Mapped[int] = mapped_column(Integer, nullable=False)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    monto_pagado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    fecha_pago: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    recordatorio_enviado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    credito: Mapped["Credito"] = relationship("Credito", back_populates="cuotas")
