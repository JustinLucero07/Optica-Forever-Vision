from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.credito import Credito, CuotaCredito
from app.models.paciente import Paciente
from app.models.tesoreria import CuentaBancaria, Cobro
from app.models.user import User
from app.schemas.creditos import CreditoCreate, CreditoListItem, CreditoOut, PagoCuotaIn

router = APIRouter(prefix="/creditos", tags=["creditos"])

_DIAS = {"mensual": 30, "quincenal": 15, "semanal": 7}


def _generar_cuotas(credito: Credito) -> list[CuotaCredito]:
    monto_cuota = round(float(credito.monto_total) / credito.numero_cuotas, 2)
    dias = _DIAS.get(credito.periodicidad, 30)
    cuotas = []
    for i in range(credito.numero_cuotas):
        fecha_venc = credito.fecha_inicio + timedelta(days=dias * (i + 1))
        cuotas.append(CuotaCredito(
            credito_id=credito.id,
            numero_cuota=i + 1,
            fecha_vencimiento=fecha_venc,
            monto=Decimal(str(monto_cuota)),
        ))
    return cuotas


def _actualizar_estado(credito: Credito) -> None:
    pagado = sum(float(c.monto_pagado) for c in credito.cuotas)
    credito.monto_pagado = Decimal(str(round(pagado, 2)))
    total = float(credito.monto_total)
    if pagado >= total - 0.01:
        credito.estado = "pagado"
    elif any(c.estado == "vencido" for c in credito.cuotas):
        credito.estado = "vencido"
    else:
        credito.estado = "vigente"


@router.get("", response_model=list[CreditoListItem])
def listar(
    estado: str | None = None,
    paciente_id: int | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Credito, Paciente)
        .outerjoin(Paciente, Credito.paciente_id == Paciente.id)
        .order_by(Credito.created_at.desc())
    )
    if estado:
        stmt = stmt.where(Credito.estado == estado)
    if paciente_id:
        stmt = stmt.where(Credito.paciente_id == paciente_id)
    rows = db.execute(stmt.offset(skip).limit(limit)).all()
    return [
        CreditoListItem(
            id=c.id, numero=c.numero, paciente_id=c.paciente_id,
            paciente_nombre=f"{p.apellidos} {p.nombres}" if p else None,
            venta_id=c.venta_id, monto_total=c.monto_total, monto_pagado=c.monto_pagado,
            numero_cuotas=c.numero_cuotas, periodicidad=c.periodicidad,
            fecha_inicio=c.fecha_inicio, estado=c.estado, created_at=c.created_at,
        )
        for c, p in rows
    ]


@router.post("", response_model=CreditoOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: CreditoCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    numero = siguiente_numero(db, "numerador_credito", "CRD")
    credito = Credito(
        numero=numero,
        venta_id=data.venta_id,
        paciente_id=data.paciente_id,
        monto_total=Decimal(str(data.monto_total)),
        numero_cuotas=data.numero_cuotas,
        periodicidad=data.periodicidad,
        fecha_inicio=data.fecha_inicio,
        notas=data.notas,
        usuario_id=current.id,
    )
    db.add(credito)
    db.flush()
    for cuota in _generar_cuotas(credito):
        db.add(cuota)
    db.commit()
    return db.execute(
        select(Credito).where(Credito.id == credito.id).options(selectinload(Credito.cuotas))
    ).scalar_one()


@router.get("/{cid}", response_model=CreditoOut)
def obtener(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    credito = db.execute(
        select(Credito).where(Credito.id == cid).options(selectinload(Credito.cuotas))
    ).scalar_one_or_none()
    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    # actualizar estados vencidos
    hoy = date.today()
    for cuota in credito.cuotas:
        if cuota.estado == "pendiente" and cuota.fecha_vencimiento < hoy:
            cuota.estado = "vencido"
    db.commit()
    db.refresh(credito)
    return credito


@router.post("/{cid}/cuotas/{qid}/pagar", response_model=CreditoOut)
def pagar_cuota(
    cid: int,
    qid: int,
    data: PagoCuotaIn,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    credito = db.execute(
        select(Credito).where(Credito.id == cid).options(selectinload(Credito.cuotas))
    ).scalar_one_or_none()
    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")

    cuota = next((q for q in credito.cuotas if q.id == qid), None)
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    if cuota.estado == "pagado":
        raise HTTPException(status_code=400, detail="La cuota ya está pagada")

    cuenta = db.get(CuentaBancaria, data.cuenta_bancaria_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")

    cuota.monto_pagado = Decimal(str(data.monto))
    cuota.fecha_pago = data.fecha_pago
    cuota.estado = "pagado"

    # registrar cobro
    from app.core.numeradores import siguiente_numero as sig_num
    num_cobro = sig_num(db, "numerador_cobro", "COB")
    concepto = f"Cuota {cuota.numero_cuota}/{credito.numero_cuotas} — {credito.numero}"
    if credito.paciente_id:
        pac = db.get(Paciente, credito.paciente_id)
        if pac:
            concepto = f"Cuota {cuota.numero_cuota}/{credito.numero_cuotas} — {credito.numero} ({pac.apellidos} {pac.nombres})"

    cobro = Cobro(
        numero=num_cobro,
        venta_id=credito.venta_id,
        paciente_id=credito.paciente_id,
        cuenta_bancaria_id=data.cuenta_bancaria_id,
        fecha=data.fecha_pago,
        concepto=concepto,
        monto=Decimal(str(data.monto)),
        metodo_pago=data.metodo_pago,
        referencia=data.referencia,
        usuario_id=current.id,
    )
    db.add(cobro)

    cuenta.saldo_actual = cuenta.saldo_actual + Decimal(str(data.monto))
    _actualizar_estado(credito)
    db.commit()
    db.refresh(credito)
    return credito


@router.delete("/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    credito = db.get(Credito, cid)
    if not credito:
        raise HTTPException(status_code=404, detail="Crédito no encontrado")
    db.delete(credito)
    db.commit()
