from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.paciente import Paciente
from app.models.producto import MovimientoInventario, Producto
from app.models.user import User
from app.models.venta import Venta, VentaItem
from app.schemas.ventas import VentaCreate, VentaListItem, VentaOut

router = APIRouter(prefix="/ventas", tags=["ventas"])

_eager = selectinload(Venta.items)


@router.get("", response_model=list[VentaListItem])
def listar(
    desde: date | None = None,
    hasta: date | None = None,
    paciente_id: int | None = None,
    estado: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Venta, Paciente)
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .order_by(Venta.fecha.desc(), Venta.id.desc())
    )
    if desde:
        stmt = stmt.where(Venta.fecha >= desde)
    if hasta:
        stmt = stmt.where(Venta.fecha <= hasta)
    if paciente_id:
        stmt = stmt.where(Venta.paciente_id == paciente_id)
    if estado:
        stmt = stmt.where(Venta.estado == estado)
    rows = db.execute(stmt.offset(skip).limit(limit)).all()
    return [
        VentaListItem(
            id=v.id, numero=v.numero, paciente_id=v.paciente_id,
            paciente_nombre=f"{p.apellidos} {p.nombres}" if p else None,
            fecha=v.fecha, total=v.total, estado=v.estado, created_at=v.created_at,
        )
        for v, p in rows
    ]


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
def crear_venta(
    data: VentaCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "vendedor")),
):
    if not data.items:
        raise HTTPException(status_code=422, detail="La venta debe tener al menos un ítem")

    numero = siguiente_numero(db, "numerador_venta", "VEN")

    subtotal = sum(it.subtotal for it in data.items)
    total = round(subtotal - data.descuento, 2)

    venta = Venta(
        numero=numero,
        paciente_id=data.paciente_id,
        usuario_id=current.id,
        fecha=data.fecha,
        subtotal=subtotal,
        descuento=data.descuento,
        total=total,
        notas=data.notas,
    )
    db.add(venta)
    db.flush()

    for it in data.items:
        item = VentaItem(
            venta_id=venta.id,
            producto_id=it.producto_id,
            descripcion=it.descripcion,
            cantidad=it.cantidad,
            precio_unitario=it.precio_unitario,
            descuento_pct=it.descuento_pct,
            subtotal=it.subtotal,
        )
        db.add(item)

        if it.producto_id:
            prod = db.get(Producto, it.producto_id)
            if prod:
                antes = prod.stock_actual
                prod.stock_actual = float(antes) - it.cantidad
                db.add(MovimientoInventario(
                    producto_id=it.producto_id,
                    tipo="salida",
                    cantidad=it.cantidad,
                    stock_antes=antes,
                    stock_despues=prod.stock_actual,
                    motivo="Venta",
                    referencia=numero,
                    usuario_id=current.id,
                ))

    db.commit()
    return db.execute(select(Venta).options(_eager).where(Venta.id == venta.id)).scalar_one()


@router.get("/{vid}", response_model=VentaOut)
def obtener(vid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    v = db.execute(select(Venta).options(_eager).where(Venta.id == vid)).scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return v


@router.post("/{vid}/anular", response_model=VentaOut)
def anular_venta(
    vid: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    v = db.execute(select(Venta).options(_eager).where(Venta.id == vid)).scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if v.estado == "anulado":
        raise HTTPException(status_code=409, detail="La venta ya está anulada")

    v.estado = "anulado"

    for item in v.items:
        if item.producto_id:
            prod = db.get(Producto, item.producto_id)
            if prod:
                antes = prod.stock_actual
                prod.stock_actual = float(antes) + float(item.cantidad)
                db.add(MovimientoInventario(
                    producto_id=item.producto_id,
                    tipo="entrada",
                    cantidad=item.cantidad,
                    stock_antes=antes,
                    stock_despues=prod.stock_actual,
                    motivo=f"Anulación {v.numero}",
                    referencia=v.numero,
                    usuario_id=current.id,
                ))

    db.commit()
    db.refresh(v)
    return v
