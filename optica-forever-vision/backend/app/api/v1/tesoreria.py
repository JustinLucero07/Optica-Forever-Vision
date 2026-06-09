from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.cxp_item import CxPItem
from app.models.tesoreria import CuentaBancaria, Cobro, CuentaPorPagar, Egreso, Transferencia
from app.models.venta import Venta
from app.models.user import User
from app.schemas.tesoreria import (
    CobroCreate, CobroOut,
    CuentaBancariaCreate, CuentaBancariaOut,
    CxPCreate, CxPOut, CxPPago,
    EgresoCreate, EgresoOut,
    TransferenciaCreate, TransferenciaOut,
)

router = APIRouter(tags=["tesoreria"])


# ── Cuentas bancarias ──────────────────────────────────────────────────────────

@router.get("/cuentas-bancarias", response_model=list[CuentaBancariaOut])
def listar_cuentas(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(CuentaBancaria).order_by(CuentaBancaria.nombre)).scalars().all()


@router.post("/cuentas-bancarias", response_model=CuentaBancariaOut, status_code=201)
def crear_cuenta(
    data: CuentaBancariaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cuenta = CuentaBancaria(
        nombre=data.nombre,
        tipo=data.tipo,
        saldo_actual=data.saldo_inicial,
        activa=True,
    )
    db.add(cuenta)
    db.commit()
    db.refresh(cuenta)
    return cuenta


@router.put("/cuentas-bancarias/{cid}", response_model=CuentaBancariaOut)
def actualizar_cuenta(
    cid: int,
    data: CuentaBancariaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cuenta = db.get(CuentaBancaria, cid)
    if not cuenta:
        raise HTTPException(404, detail="Cuenta no encontrada")
    cuenta.nombre = data.nombre
    cuenta.tipo = data.tipo
    db.commit()
    db.refresh(cuenta)
    return cuenta


# ── Cobros ─────────────────────────────────────────────────────────────────────

@router.get("/cobros", response_model=list[CobroOut])
def listar_cobros(
    desde: date | None = None,
    hasta: date | None = None,
    cuenta_id: int | None = None,
    venta_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Cobro).order_by(Cobro.fecha.desc(), Cobro.id.desc())
    if desde:
        stmt = stmt.where(Cobro.fecha >= desde)
    if hasta:
        stmt = stmt.where(Cobro.fecha <= hasta)
    if cuenta_id:
        stmt = stmt.where(Cobro.cuenta_bancaria_id == cuenta_id)
    if venta_id:
        stmt = stmt.where(Cobro.venta_id == venta_id)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.post("/cobros", response_model=CobroOut, status_code=status.HTTP_201_CREATED)
def crear_cobro(
    data: CobroCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero", "vendedor")),
):
    if data.monto <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser positivo")

    cuenta = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_bancaria_id).with_for_update()
    ).scalar_one_or_none()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")

    numero = siguiente_numero(db, "numerador_cobro", "COB")
    cobro = Cobro(numero=numero, usuario_id=current.id, **data.model_dump())
    db.add(cobro)

    cuenta.saldo_actual = float(cuenta.saldo_actual) + data.monto

    # Actualizar estado de la venta si aplica
    if data.venta_id:
        venta = db.get(Venta, data.venta_id)
        if venta and venta.estado == "pendiente":
            db.flush()
            total_cobrado = db.execute(
                select(func.coalesce(func.sum(Cobro.monto), 0))
                .where(Cobro.venta_id == data.venta_id)
            ).scalar_one()
            if float(total_cobrado) >= float(venta.total):
                venta.estado = "cobrado"

    db.commit()
    db.refresh(cobro)
    return cobro


# ── Egresos ────────────────────────────────────────────────────────────────────

@router.get("/egresos", response_model=list[EgresoOut])
def listar_egresos(
    desde: date | None = None,
    hasta: date | None = None,
    categoria: str | None = None,
    cuenta_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Egreso).order_by(Egreso.fecha.desc(), Egreso.id.desc())
    if desde:
        stmt = stmt.where(Egreso.fecha >= desde)
    if hasta:
        stmt = stmt.where(Egreso.fecha <= hasta)
    if categoria:
        stmt = stmt.where(Egreso.categoria == categoria)
    if cuenta_id:
        stmt = stmt.where(Egreso.cuenta_bancaria_id == cuenta_id)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.post("/egresos", response_model=EgresoOut, status_code=status.HTTP_201_CREATED)
def crear_egreso(
    data: EgresoCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero")),
):
    if data.monto <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser positivo")

    cuenta = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_bancaria_id).with_for_update()
    ).scalar_one_or_none()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    if float(cuenta.saldo_actual) < data.monto:
        raise HTTPException(status_code=422, detail=f"Saldo insuficiente en {cuenta.nombre} — disponible: ${float(cuenta.saldo_actual):.2f}")

    numero = siguiente_numero(db, "numerador_egreso", "EGR")
    egreso = Egreso(numero=numero, usuario_id=current.id, **data.model_dump())
    db.add(egreso)

    cuenta.saldo_actual = float(cuenta.saldo_actual) - data.monto

    db.commit()
    db.refresh(egreso)
    return egreso


# ── Cuentas por Pagar (Labs) ───────────────────────────────────────────────────

@router.get("/cxp", response_model=list[CxPOut])
def listar_cxp(
    estado: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(CuentaPorPagar).order_by(CuentaPorPagar.fecha_emision.desc())
    if estado:
        stmt = stmt.where(CuentaPorPagar.estado == estado)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.post("/cxp", response_model=CxPOut, status_code=status.HTTP_201_CREATED)
def crear_cxp(
    data: CxPCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero")),
):
    cxp = CuentaPorPagar(**data.model_dump())
    db.add(cxp)
    db.commit()
    db.refresh(cxp)
    return cxp


@router.delete("/cxp/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cxp(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cxp = db.get(CuentaPorPagar, cid)
    if not cxp:
        raise HTTPException(status_code=404, detail="CxP no encontrada")
    if float(cxp.monto_pagado) > 0:
        raise HTTPException(status_code=422, detail="No se puede eliminar una CxP con pagos registrados")
    db.delete(cxp)
    db.commit()


@router.post("/cxp/{cid}/pago", response_model=CxPOut)
def registrar_pago_cxp(
    cid: int,
    data: CxPPago,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero")),
):
    cxp = db.execute(
        select(CuentaPorPagar).where(CuentaPorPagar.id == cid).with_for_update()
    ).scalar_one_or_none()
    if not cxp:
        raise HTTPException(status_code=404, detail="CxP no encontrada")
    if cxp.estado == "pagado":
        raise HTTPException(status_code=409, detail="Esta cuenta ya está completamente pagada")

    pendiente = float(cxp.monto_total) - float(cxp.monto_pagado)
    if data.monto > pendiente + 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"El monto excede el saldo pendiente (${pendiente:.2f})",
        )

    cuenta = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_bancaria_id).with_for_update()
    ).scalar_one_or_none()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    if float(cuenta.saldo_actual) < data.monto:
        raise HTTPException(status_code=422, detail=f"Saldo insuficiente en {cuenta.nombre} — disponible: ${float(cuenta.saldo_actual):.2f}")

    numero = siguiente_numero(db, "numerador_egreso", "EGR")
    egreso = Egreso(
        numero=numero,
        cuenta_bancaria_id=data.cuenta_bancaria_id,
        cxp_id=cid,
        fecha=data.fecha,
        categoria="Bisel y Lunas",
        concepto=f"Pago {cxp.proveedor} — {cxp.concepto}",
        monto=data.monto,
        metodo_pago=data.metodo_pago,
        referencia=data.referencia,
        usuario_id=current.id,
    )
    db.add(egreso)

    cuenta.saldo_actual = float(cuenta.saldo_actual) - data.monto
    cxp.monto_pagado = float(cxp.monto_pagado) + data.monto

    if float(cxp.monto_pagado) >= float(cxp.monto_total) - 0.01:
        cxp.estado = "pagado"
    else:
        cxp.estado = "parcial"

    db.commit()
    db.refresh(cxp)
    return cxp


@router.get("/cxp/{cid}/items")
def listar_items_cxp(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cxp = db.get(CuentaPorPagar, cid)
    if not cxp:
        raise HTTPException(status_code=404, detail="CxP no encontrada")
    items = db.execute(
        select(CxPItem).where(CxPItem.cxp_id == cid).order_by(CxPItem.id)
    ).scalars().all()
    return [
        {
            "id": it.id,
            "codigo_proveedor": it.codigo_proveedor,
            "descripcion": it.descripcion,
            "cantidad": float(it.cantidad),
            "precio_unitario": float(it.precio_unitario),
            "subtotal": float(it.subtotal),
            "producto_id": it.producto_id,
        }
        for it in items
    ]


@router.post("/cxp/{cid}/items/{item_id}/vincular")
def vincular_item_producto(
    cid: int,
    item_id: int,
    producto_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero")),
):
    item = db.execute(
        select(CxPItem).where(CxPItem.id == item_id, CxPItem.cxp_id == cid)
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    item.producto_id = producto_id
    db.commit()
    return {"ok": True}


# ── Transferencias entre cuentas ───────────────────────────────────────────────

@router.get("/transferencias", response_model=list[TransferenciaOut])
def listar_transferencias(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.execute(
        select(Transferencia).order_by(Transferencia.fecha.desc(), Transferencia.id.desc()).offset(skip).limit(limit)
    ).scalars().all()


@router.post("/transferencias", response_model=TransferenciaOut, status_code=status.HTTP_201_CREATED)
def crear_transferencia(
    data: TransferenciaCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero")),
):
    if data.monto <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser positivo")
    if data.cuenta_origen_id == data.cuenta_destino_id:
        raise HTTPException(status_code=422, detail="Las cuentas de origen y destino deben ser distintas")

    origen = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_origen_id).with_for_update()
    ).scalar_one_or_none()
    if not origen:
        raise HTTPException(status_code=404, detail="Cuenta origen no encontrada")
    if float(origen.saldo_actual) < data.monto:
        raise HTTPException(status_code=422, detail=f"Saldo insuficiente en {origen.nombre} (${float(origen.saldo_actual):.2f})")

    destino = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_destino_id).with_for_update()
    ).scalar_one_or_none()
    if not destino:
        raise HTTPException(status_code=404, detail="Cuenta destino no encontrada")

    numero = siguiente_numero(db, "numerador_transferencia", "TRF")
    t = Transferencia(numero=numero, usuario_id=current.id, **data.model_dump())
    db.add(t)

    origen.saldo_actual = float(origen.saldo_actual) - data.monto
    destino.saldo_actual = float(destino.saldo_actual) + data.monto

    db.commit()
    db.refresh(t)
    return t
