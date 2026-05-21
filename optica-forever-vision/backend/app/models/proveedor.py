from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Proveedor(Base):
    __tablename__ = "proveedores"

    id: Mapped[int] = mapped_column(primary_key=True)
    ruc: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    nombre_comercial: Mapped[str | None] = mapped_column(String(150), nullable=True)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False, default="laboratorio")
    # tipos: laboratorio | armazones | insumos | contactologia | servicios | otro
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)
    telefono_2: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    direccion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ciudad: Mapped[str | None] = mapped_column(String(80), nullable=True)
    contacto: Mapped[str | None] = mapped_column(String(100), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now()
    )
