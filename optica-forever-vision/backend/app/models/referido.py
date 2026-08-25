from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Referido(Base):
    """Fuente de referidos (persona/entidad que recomienda pacientes) u orígenes ('¿Cómo nos conoció?')."""
    __tablename__ = "referidos"
    __table_args__ = (UniqueConstraint("tipo", "nombre", name="referidos_tipo_nombre_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="referido")
    # tipos: referido | origen
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, server_default=func.now()
    )
