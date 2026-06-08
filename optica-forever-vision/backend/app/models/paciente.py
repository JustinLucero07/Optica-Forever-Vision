from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Paciente(Base):
    __tablename__ = "pacientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    cedula: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nombres: Mapped[str] = mapped_column(String(150), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(150), nullable=False)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    genero: Mapped[str | None] = mapped_column(String(20), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)
    telefono_2: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocupacion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    origen: Mapped[str | None] = mapped_column(String(100), nullable=True)
    referido_por: Mapped[str | None] = mapped_column(String(255), nullable=True)
    foto: Mapped[str | None] = mapped_column(Text, nullable=True)
    armazon_tipo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    armazon_notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_pacientes_cedula", "cedula"),
        Index("ix_pacientes_nombres", "nombres"),
        Index("ix_pacientes_apellidos", "apellidos"),
        Index("ix_pacientes_telefono", "telefono"),
    )
