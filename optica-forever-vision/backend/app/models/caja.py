from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CajaDiaria(Base):
    __tablename__ = "caja_diaria"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True, unique=True)
    usuario_apertura_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    usuario_cierre_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    saldo_apertura: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    saldo_cierre: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    total_efectivo: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    total_tarjeta: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    total_transferencia: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    total_egresos: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    diferencia: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="abierta")  # abierta | cerrada
    notas_apertura: Mapped[str | None] = mapped_column(Text, nullable=True)
    notas_cierre: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
