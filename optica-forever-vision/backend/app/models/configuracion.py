from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Configuracion(Base):
    """Tabla clave/valor para parámetros del sistema:
    - numerador_paciente / numerador_consulta / numerador_venta / numerador_orden
    - nombre_optica, direccion_optica, telefono_optica, pais_codigo
    - cualquier otra config global
    """

    __tablename__ = "configuraciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    clave: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    valor: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    descripcion: Mapped[str | None] = mapped_column(String(255), nullable=True)
