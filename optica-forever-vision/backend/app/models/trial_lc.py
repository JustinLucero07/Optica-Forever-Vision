from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class TrialLC(Base):
    __tablename__ = "trial_lc"

    id: Mapped[int] = mapped_column(primary_key=True)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("pacientes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    consulta_id: Mapped[int | None] = mapped_column(
        ForeignKey("consultas.id", ondelete="SET NULL"), nullable=True
    )
    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    fecha_entrega: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_control: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="entregado")  # entregado | devuelto | comprado

    # OD
    od_marca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    od_bc: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    od_diam: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    od_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    od_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    od_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # OI
    oi_marca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    oi_bc: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    oi_diam: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    oi_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    oi_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    oi_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
