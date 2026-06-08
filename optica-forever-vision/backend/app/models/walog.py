from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class WaLog(Base):
    __tablename__ = "whatsapp_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    paciente_id: Mapped[int | None] = mapped_column(ForeignKey("pacientes.id", ondelete="SET NULL"), nullable=True)
    telefono: Mapped[str] = mapped_column(String(30), nullable=False)
    template: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="enviado")
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
