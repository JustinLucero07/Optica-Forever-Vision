from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class SueldoConfig(Base):
    __tablename__ = "sueldo_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    monto_mensual: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    dia_pago: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class PagoSueldo(Base):
    __tablename__ = "pagos_sueldo"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    periodo: Mapped[str] = mapped_column(String(7), nullable=False)  # "2026-06"
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # sueldo | adelanto
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cuenta_bancaria_id: Mapped[int] = mapped_column(
        ForeignKey("cuentas_bancarias.id", ondelete="RESTRICT"), nullable=False
    )
    egreso_id: Mapped[int | None] = mapped_column(
        ForeignKey("egresos.id", ondelete="SET NULL"), nullable=True
    )
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    pagado_por_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
