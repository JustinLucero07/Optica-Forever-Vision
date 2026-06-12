from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Consulta(Base):
    __tablename__ = "consultas"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    paciente_id: Mapped[int] = mapped_column(
        ForeignKey("pacientes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    optometrista_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)

    motivo_consulta: Mapped[str | None] = mapped_column(Text, nullable=True)
    antecedentes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Agudeza visual sin corrección
    avsc_od: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avsc_oi: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avsc_ao: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Agudeza visual con corrección anterior
    avcc_od: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avcc_oi: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avcc_ao: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Refracción OD
    rx_od_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_od_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_od_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rx_od_add: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_od_av: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Refracción OI
    rx_oi_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_oi_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_oi_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rx_oi_add: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    rx_oi_av: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Queratometría OD
    k_od_1: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    k_od_2: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    k_od_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Queratometría OI
    k_oi_1: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    k_oi_2: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    k_oi_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Presión intraocular
    pio_od: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    pio_oi: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)

    # Tests binoculares
    cover_test_vl: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cover_test_vp: Mapped[str | None] = mapped_column(String(100), nullable=True)
    motilidad: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estereopsis: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Biomicroscopía y fondo de ojo
    seg_anterior_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    seg_anterior_oi: Mapped[str | None] = mapped_column(Text, nullable=True)
    fondo_od: Mapped[str | None] = mapped_column(Text, nullable=True)
    fondo_oi: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Conclusión
    diag_od: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diag_oi: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diagnostico: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_tratamiento: Mapped[str | None] = mapped_column(Text, nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    proximo_control: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    recetas: Mapped[list["Receta"]] = relationship(
        "Receta", back_populates="consulta", cascade="all, delete-orphan"
    )


class Receta(Base):
    __tablename__ = "recetas"

    id: Mapped[int] = mapped_column(primary_key=True)
    consulta_id: Mapped[int] = mapped_column(
        ForeignKey("consultas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # lente_convencional | contactologia

    # Lentes convencionales — OD
    lc_od_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_od_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_od_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lc_od_add: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_od_dnp: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    lc_od_alt: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)

    # Lentes convencionales — OI
    lc_oi_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_oi_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_oi_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)
    lc_oi_add: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    lc_oi_dnp: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    lc_oi_alt: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    tipo_lente: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tipo_armadura: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Contactología — OD
    cl_od_marca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cl_od_bc: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    cl_od_diam: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    cl_od_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    cl_od_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    cl_od_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Contactología — OI
    cl_oi_marca: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cl_oi_bc: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    cl_oi_diam: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    cl_oi_esf: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    cl_oi_cil: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    cl_oi_eje: Mapped[int | None] = mapped_column(Integer, nullable=True)

    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )

    consulta: Mapped["Consulta"] = relationship("Consulta", back_populates="recetas")
