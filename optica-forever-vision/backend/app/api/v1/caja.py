from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_roles
from app.models.caja import CajaDiaria
from app.models.tesoreria import Cobro, Egreso
from app.models.user import User

router = APIRouter(prefix="/caja", tags=["caja"])


class AperturaIn(BaseModel):
    fecha: date
    saldo_apertura: float = 0
    notas_apertura: str | None = None


class CierreIn(BaseModel):
    total_efectivo: float = 0
    total_tarjeta: float = 0
    total_transferencia: float = 0
    notas_cierre: str | None = None


class CajaOut(BaseModel):
    id: int
    fecha: date
    usuario_apertura_id: int
    usuario_cierre_id: int | None
    saldo_apertura: float
    saldo_cierre: float | None
    total_efectivo: float | None
    total_tarjeta: float | None
    total_transferencia: float | None
    total_egresos: float | None
    diferencia: float | None
    estado: str
    notas_apertura: str | None
    notas_cierre: str | None
    created_at: datetime
    # computed at response time
    cobros_dia: float = 0
    egresos_dia: float = 0
    model_config = {"from_attributes": True}


def _totales_dia(db: Session, fecha: date):
    cobros = db.scalar(
        select(func.coalesce(func.sum(Cobro.monto), 0)).where(func.date(Cobro.fecha) == fecha)
    ) or 0
    egresos = db.scalar(
        select(func.coalesce(func.sum(Egreso.monto), 0)).where(func.date(Egreso.fecha) == fecha)
    ) or 0
    return float(cobros), float(egresos)


@router.get("", response_model=list[CajaOut])
def listar(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cajas = db.execute(select(CajaDiaria).order_by(CajaDiaria.fecha.desc()).limit(30)).scalars().all()
    result = []
    for c in cajas:
        cobros, egresos = _totales_dia(db, c.fecha)
        d = CajaOut.model_validate(c)
        d.cobros_dia = cobros
        d.egresos_dia = egresos
        result.append(d)
    return result


@router.get("/hoy")
def caja_hoy(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    hoy = date.today()
    caja = db.scalar(select(CajaDiaria).where(CajaDiaria.fecha == hoy))
    cobros, egresos = _totales_dia(db, hoy)
    if not caja:
        return {"abierta": False, "cobros_dia": cobros, "egresos_dia": egresos, "neto": cobros - egresos}
    d = CajaOut.model_validate(caja)
    d.cobros_dia = cobros
    d.egresos_dia = egresos
    return {"abierta": caja.estado == "abierta", "caja": d, "cobros_dia": cobros, "egresos_dia": egresos, "neto": cobros - egresos}


@router.post("/apertura", response_model=CajaOut, status_code=status.HTTP_201_CREATED)
def apertura(data: AperturaIn, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    existente = db.scalar(select(CajaDiaria).where(CajaDiaria.fecha == data.fecha))
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una caja para esa fecha")
    caja = CajaDiaria(
        fecha=data.fecha,
        saldo_apertura=data.saldo_apertura,
        notas_apertura=data.notas_apertura,
        usuario_apertura_id=current.id,
        estado="abierta",
    )
    db.add(caja)
    db.commit()
    db.refresh(caja)
    cobros, egresos = _totales_dia(db, caja.fecha)
    out = CajaOut.model_validate(caja)
    out.cobros_dia = cobros
    out.egresos_dia = egresos
    return out


@router.post("/{cid}/cierre", response_model=CajaOut)
def cierre(cid: int, data: CierreIn, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    caja = db.get(CajaDiaria, cid)
    if not caja:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    if caja.estado == "cerrada":
        raise HTTPException(status_code=400, detail="La caja ya está cerrada")

    cobros, egresos = _totales_dia(db, caja.fecha)
    total_ingresos = data.total_efectivo + data.total_tarjeta + data.total_transferencia
    saldo_cierre = float(caja.saldo_apertura) + total_ingresos - egresos
    diferencia = total_ingresos - cobros

    caja.total_efectivo = data.total_efectivo
    caja.total_tarjeta = data.total_tarjeta
    caja.total_transferencia = data.total_transferencia
    caja.total_egresos = egresos
    caja.saldo_cierre = saldo_cierre
    caja.diferencia = diferencia
    caja.notas_cierre = data.notas_cierre
    caja.usuario_cierre_id = current.id
    caja.estado = "cerrada"
    db.commit()
    db.refresh(caja)
    out = CajaOut.model_validate(caja)
    out.cobros_dia = cobros
    out.egresos_dia = egresos
    return out
