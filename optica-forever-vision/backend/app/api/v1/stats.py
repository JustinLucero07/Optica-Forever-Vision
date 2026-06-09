from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.agenda import OrdenTrabajo, Turno
from app.models.credito import CuotaCredito
from app.models.producto import Producto
from app.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/alertas")
def alertas(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    hoy = date.today()

    creditos_vencidos = db.scalar(
        select(func.count()).select_from(CuotaCredito)
        .where(CuotaCredito.estado == "pendiente", CuotaCredito.fecha_vencimiento < hoy)
    ) or 0

    stock_bajo = db.scalar(
        select(func.count()).select_from(Producto)
        .where(Producto.activo == True, Producto.stock_actual <= Producto.stock_minimo)
    ) or 0

    ordenes_listas = db.scalar(
        select(func.count()).select_from(OrdenTrabajo)
        .where(
            OrdenTrabajo.estado == "listo",
            OrdenTrabajo.fecha_envio <= hoy - timedelta(days=1),
        )
    ) or 0

    turnos_hoy = db.scalar(
        select(func.count()).select_from(Turno)
        .where(Turno.fecha == hoy, Turno.estado.in_(["pendiente", "confirmado"]))
    ) or 0

    total = creditos_vencidos + stock_bajo + ordenes_listas

    return {
        "total": total,
        "creditos_vencidos": creditos_vencidos,
        "stock_bajo": stock_bajo,
        "ordenes_listas": ordenes_listas,
        "turnos_hoy": turnos_hoy,
    }


@router.get("/caja-hoy")
def caja_hoy(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Resumen rápido de cobros y egresos del día para el dashboard."""
    from app.models.tesoreria import Cobro, Egreso
    hoy = date.today()

    ingresos = db.scalar(
        select(func.coalesce(func.sum(Cobro.monto), 0))
        .where(func.date(Cobro.fecha) == hoy)
    ) or 0

    egresos = db.scalar(
        select(func.coalesce(func.sum(Egreso.monto), 0))
        .where(func.date(Egreso.fecha) == hoy)
    ) or 0

    return {"ingresos": float(ingresos), "egresos": float(egresos), "neto": float(ingresos) - float(egresos)}
