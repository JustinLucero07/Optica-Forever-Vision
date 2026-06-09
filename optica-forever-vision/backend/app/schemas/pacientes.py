from datetime import date, datetime

from pydantic import BaseModel


class PacienteCreate(BaseModel):
    cedula: str | None = None
    nombres: str
    apellidos: str
    fecha_nacimiento: date | None = None
    genero: str | None = None
    telefono: str | None = None
    telefono_2: str | None = None
    email: str | None = None
    direccion: str | None = None
    ocupacion: str | None = None
    origen: str | None = None
    referido_por: str | None = None
    referido_a_usuario_id: int | None = None
    armazon_tipo: str | None = None
    armazon_notas: str | None = None


class PacienteUpdate(BaseModel):
    cedula: str | None = None
    nombres: str | None = None
    apellidos: str | None = None
    fecha_nacimiento: date | None = None
    genero: str | None = None
    telefono: str | None = None
    telefono_2: str | None = None
    email: str | None = None
    direccion: str | None = None
    ocupacion: str | None = None
    origen: str | None = None
    referido_por: str | None = None
    referido_a_usuario_id: int | None = None
    armazon_tipo: str | None = None
    armazon_notas: str | None = None


class PacienteOut(BaseModel):
    id: int
    numero: str
    cedula: str | None
    nombres: str
    apellidos: str
    fecha_nacimiento: date | None
    genero: str | None
    telefono: str | None
    telefono_2: str | None
    email: str | None
    direccion: str | None
    ocupacion: str | None
    origen: str | None
    referido_por: str | None
    referido_a_usuario_id: int | None = None
    referido_a_nombre: str | None = None
    foto: str | None = None
    armazon_tipo: str | None = None
    armazon_notas: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PacienteListItem(BaseModel):
    id: int
    numero: str
    cedula: str | None
    nombres: str
    apellidos: str
    telefono: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
