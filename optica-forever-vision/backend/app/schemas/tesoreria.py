from datetime import date, datetime

from pydantic import BaseModel


class CuentaBancariaCreate(BaseModel):
    nombre: str
    tipo: str = "banco"
    saldo_inicial: float = 0


class CuentaBancariaOut(BaseModel):
    id: int
    nombre: str
    tipo: str
    saldo_actual: float
    activa: bool
    model_config = {"from_attributes": True}


class CobroCreate(BaseModel):
    venta_id: int | None = None
    paciente_id: int | None = None
    cuenta_bancaria_id: int
    fecha: date
    concepto: str
    monto: float
    metodo_pago: str
    referencia: str | None = None
    notas: str | None = None


class CobroOut(BaseModel):
    id: int
    numero: str
    venta_id: int | None
    paciente_id: int | None
    cuenta_bancaria_id: int
    fecha: date
    concepto: str
    monto: float
    metodo_pago: str
    referencia: str | None
    notas: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class EgresoCreate(BaseModel):
    cuenta_bancaria_id: int
    cxp_id: int | None = None
    fecha: date
    categoria: str
    concepto: str
    monto: float
    metodo_pago: str
    referencia: str | None = None
    notas: str | None = None


class EgresoOut(BaseModel):
    id: int
    numero: str
    cuenta_bancaria_id: int
    cxp_id: int | None
    fecha: date
    categoria: str
    concepto: str
    monto: float
    metodo_pago: str
    referencia: str | None
    notas: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class CxPCreate(BaseModel):
    proveedor: str
    concepto: str
    monto_total: float
    fecha_emision: date
    fecha_vencimiento: date | None = None
    referencia: str | None = None
    notas: str | None = None


class CxPPago(BaseModel):
    monto: float
    cuenta_bancaria_id: int
    fecha: date
    metodo_pago: str
    referencia: str | None = None


class CxPOut(BaseModel):
    id: int
    proveedor: str
    concepto: str
    monto_total: float
    monto_pagado: float
    fecha_emision: date
    fecha_vencimiento: date | None
    estado: str
    referencia: str | None
    notas: str | None
    created_at: datetime

    @property
    def monto_pendiente(self) -> float:
        return round(self.monto_total - self.monto_pagado, 2)

    model_config = {"from_attributes": True}


class TransferenciaCreate(BaseModel):
    fecha: date
    cuenta_origen_id: int
    cuenta_destino_id: int
    monto: float
    comision: float = 0.0
    concepto: str | None = None
    notas: str | None = None


class TransferenciaOut(BaseModel):
    id: int
    numero: str
    fecha: date
    cuenta_origen_id: int
    cuenta_destino_id: int
    monto: float
    comision: float
    concepto: str | None
    notas: str | None
    created_at: datetime
    model_config = {"from_attributes": True}
