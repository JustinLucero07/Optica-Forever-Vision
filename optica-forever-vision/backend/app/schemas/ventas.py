from datetime import date, datetime

from pydantic import BaseModel, model_validator


class VentaItemIn(BaseModel):
    producto_id: int | None = None
    descripcion: str
    cantidad: float
    precio_unitario: float
    descuento_pct: float = 0
    garantia_meses: int | None = None

    @model_validator(mode="after")
    def calcular_subtotal(self):
        self._subtotal = round(self.cantidad * self.precio_unitario * (1 - self.descuento_pct / 100), 2)
        return self

    @property
    def subtotal(self) -> float:
        return self._subtotal


class VentaCreate(BaseModel):
    paciente_id: int | None = None
    fecha: date
    descuento: float = 0
    notas: str | None = None
    items: list[VentaItemIn]


class VentaItemOut(BaseModel):
    id: int
    producto_id: int | None
    descripcion: str
    cantidad: float
    precio_unitario: float
    descuento_pct: float
    subtotal: float
    garantia_meses: int | None = None
    garantia_vence: date | None = None
    model_config = {"from_attributes": True}


class VentaOut(BaseModel):
    id: int
    numero: str
    paciente_id: int | None
    usuario_id: int
    fecha: date
    subtotal: float
    descuento: float
    total: float
    estado: str
    notas: str | None
    created_at: datetime
    items: list[VentaItemOut]
    model_config = {"from_attributes": True}


class VentaListItem(BaseModel):
    id: int
    numero: str
    paciente_id: int | None
    paciente_nombre: str | None = None
    fecha: date
    total: float
    estado: str
    created_at: datetime
    model_config = {"from_attributes": True}
