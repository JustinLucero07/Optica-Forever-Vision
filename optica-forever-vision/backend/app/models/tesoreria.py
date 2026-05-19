from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CuentaBancaria(Base):
    __tablename__ = "cuentas_bancarias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # efectivo | banco | electronico
    saldo_actual: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Cobro(Base):
    __tablename__ = "cobros"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    venta_id: Mapped[int | None] = mapped_column(
        ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    paciente_id: Mapped[int | None] = mapped_column(
        ForeignKey("pacientes.id", ondelete="SET NULL"), nullable=True
    )
    cuenta_bancaria_id: Mapped[int] = mapped_column(
        ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    metodo_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )


class Egreso(Base):
    __tablename__ = "egresos"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    cuenta_bancaria_id: Mapped[int] = mapped_column(
        ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False
    )
    cxp_id: Mapped[int | None] = mapped_column(
        ForeignKey("cuentas_por_pagar.id", ondelete="SET NULL"), nullable=True
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    categoria: Mapped[str] = mapped_column(String(100), nullable=False)
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    metodo_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )


class CuentaPorPagar(Base):
    __tablename__ = "cuentas_por_pagar"

    id: Mapped[int] = mapped_column(primary_key=True)
    proveedor: Mapped[str] = mapped_column(String(150), nullable=False)
    concepto: Mapped[str] = mapped_column(String(255), nullable=False)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    monto_pagado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    fecha_emision: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_vencimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
