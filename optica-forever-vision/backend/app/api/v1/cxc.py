"""
Cuentas por Cobrar — análisis de cartera y aging.
Endpoints:
  GET /cxc/aging  → resumen de cartera con buckets de aging + detalle cuota por cuota
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.credito import Credito, CuotaCredito
from app.models.paciente import Paciente
from app.models.user import User

router = APIRouter(prefix="/cxc", tags=["cxc"])


@router.get("/aging")
def aging(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    hoy = date.today()

    rows = db.execute(
        select(CuotaCredito, Credito, Paciente)
        .join(Credito, CuotaCredito.credito_id == Credito.id)
        .outerjoin(Paciente, Credito.paciente_id == Paciente.id)
        .where(CuotaCredito.estado.in_(["pendiente", "vencido"]))
        .order_by(CuotaCredito.fecha_vencimiento)
    ).all()

    buckets: dict[str, dict] = {
        "corriente": {"total": 0.0, "count": 0},
        "dias_1_30":  {"total": 0.0, "count": 0},
        "dias_31_60": {"total": 0.0, "count": 0},
        "dias_61_90": {"total": 0.0, "count": 0},
        "mas_90":     {"total": 0.0, "count": 0},
    }

    cuotas_out = []
    for cuota, credito, paciente in rows:
        saldo = round(float(cuota.monto) - float(cuota.monto_pagado), 2)
        if saldo <= 0:
            continue
        dias = (hoy - cuota.fecha_vencimiento).days
        if dias <= 0:
            bucket = "corriente"
        elif dias <= 30:
            bucket = "dias_1_30"
        elif dias <= 60:
            bucket = "dias_31_60"
        elif dias <= 90:
            bucket = "dias_61_90"
        else:
            bucket = "mas_90"

        buckets[bucket]["total"] += saldo
        buckets[bucket]["count"] += 1

        cuotas_out.append({
            "cuota_id": cuota.id,
            "credito_id": credito.id,
            "credito_numero": credito.numero,
            "cuota_numero": cuota.numero_cuota,
            "total_cuotas": credito.numero_cuotas,
            "paciente_id": credito.paciente_id,
            "paciente_nombre": f"{paciente.apellidos} {paciente.nombres}" if paciente else "—",
            "paciente_telefono": paciente.telefono if paciente else None,
            "venta_id": credito.venta_id,
            "fecha_vencimiento": cuota.fecha_vencimiento.isoformat(),
            "monto": float(cuota.monto),
            "monto_pagado": float(cuota.monto_pagado),
            "saldo": saldo,
            "dias_vencido": dias,
            "estado": cuota.estado,
            "bucket": bucket,
        })

    total_cxc = sum(b["total"] for b in buckets.values())
    total_vencido = sum(b["total"] for k, b in buckets.items() if k != "corriente")

    return {
        "resumen": {
            "total_cxc": round(total_cxc, 2),
            "total_vencido": round(total_vencido, 2),
            "corriente": {**buckets["corriente"], "total": round(buckets["corriente"]["total"], 2)},
            "dias_1_30":  {**buckets["dias_1_30"],  "total": round(buckets["dias_1_30"]["total"], 2)},
            "dias_31_60": {**buckets["dias_31_60"], "total": round(buckets["dias_31_60"]["total"], 2)},
            "dias_61_90": {**buckets["dias_61_90"], "total": round(buckets["dias_61_90"]["total"], 2)},
            "mas_90":     {**buckets["mas_90"],     "total": round(buckets["mas_90"]["total"], 2)},
        },
        "cuotas": cuotas_out,
    }
