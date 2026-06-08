from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class CreditoCreate(BaseModel):
    venta_id: int | None = None
    paciente_id: int | None = None
    monto_total: float
    abono_inicial: float = 0
    numero_cuotas: int
    periodicidad: str = "mensual"   # mensual | quincenal | semanal
    fecha_inicio: date
    notas: str | None = None


class PagoCuotaIn(BaseModel):
    monto: float
    fecha_pago: date
    cuenta_bancaria_id: int
    metodo_pago: str = "efectivo"
    referencia: str | None = None


class CuotaOut(BaseModel):
    id: int
    numero_cuota: int
    fecha_vencimiento: date
    monto: Decimal
    monto_pagado: Decimal
    fecha_pago: date | None
    estado: str
    recordatorio_enviado: bool

    model_config = {"from_attributes": True}


class CreditoOut(BaseModel):
    id: int
    numero: str
    venta_id: int | None
    paciente_id: int | None
    paciente_nombre: str | None = None
    monto_total: Decimal
    abono_inicial: Decimal = Decimal("0")
    monto_pagado: Decimal
    numero_cuotas: int
    periodicidad: str
    fecha_inicio: date
    estado: str
    notas: str | None
    created_at: datetime
    cuotas: list[CuotaOut]

    model_config = {"from_attributes": True}


class CreditoListItem(BaseModel):
    id: int
    numero: str
    paciente_id: int | None
    paciente_nombre: str | None = None
    venta_id: int | None
    monto_total: Decimal
    abono_inicial: Decimal = Decimal("0")
    monto_pagado: Decimal
    numero_cuotas: int
    periodicidad: str
    fecha_inicio: date
    estado: str
    created_at: datetime

    model_config = {"from_attributes": True}
