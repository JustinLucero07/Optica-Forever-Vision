from datetime import date, datetime, time

from pydantic import BaseModel, field_serializer, field_validator


def _fmt_time(v: time | None) -> str | None:
    if v is None:
        return None
    return v.strftime("%H:%M")


class TurnoCreate(BaseModel):
    paciente_id: int | None = None
    optometrista_id: int | None = None
    fecha: date
    hora_inicio: time
    hora_fin: time | None = None
    motivo: str
    estado: str = "pendiente"
    notas: str | None = None

    @field_validator("hora_inicio", "hora_fin", mode="before")
    @classmethod
    def parse_time(cls, v):
        if v is None:
            return v
        if isinstance(v, time):
            return v
        if isinstance(v, str) and v:
            parts = v.split(":")
            try:
                return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
            except (ValueError, IndexError):
                pass
        return v


class TurnoUpdate(TurnoCreate):
    fecha: date | None = None
    hora_inicio: time | None = None
    motivo: str | None = None


class TurnoOut(BaseModel):
    id: int
    paciente_id: int | None
    optometrista_id: int | None
    creado_por_id: int
    fecha: date
    hora_inicio: time
    hora_fin: time | None
    motivo: str
    estado: str
    notas: str | None
    created_at: datetime

    @field_serializer("hora_inicio")
    def ser_hi(self, v): return _fmt_time(v) if isinstance(v, time) else v

    @field_serializer("hora_fin")
    def ser_hf(self, v): return _fmt_time(v) if isinstance(v, time) else v

    model_config = {"from_attributes": True}


# ── Órdenes de trabajo ─────────────────────────────────────────────────────────

class OrdenCreate(BaseModel):
    paciente_id: int
    consulta_id: int | None = None
    venta_id: int | None = None
    proveedor_id: int | None = None
    lab_proveedor: str
    lab_telefono: str | None = None
    fecha_envio: date
    fecha_entrega_est: date | None = None
    tipo: str
    descripcion: str
    precio_lab: float | None = None
    notas: str | None = None


class OrdenUpdate(BaseModel):
    proveedor_id: int | None = None
    lab_proveedor: str | None = None
    lab_telefono: str | None = None
    fecha_entrega_est: date | None = None
    fecha_entrega_real: date | None = None
    estado: str | None = None
    descripcion: str | None = None
    precio_lab: float | None = None
    notas: str | None = None


class OrdenOut(BaseModel):
    id: int
    numero: str
    paciente_id: int
    paciente_nombre: str | None = None
    consulta_id: int | None
    venta_id: int | None
    proveedor_id: int | None
    lab_proveedor: str
    lab_telefono: str | None
    fecha_envio: date
    fecha_entrega_est: date | None
    fecha_entrega_real: date | None
    estado: str
    tipo: str
    descripcion: str
    precio_lab: float | None
    notas: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
