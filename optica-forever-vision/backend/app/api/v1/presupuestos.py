import logging
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.numeradores import siguiente_numero
from app.models.paciente import Paciente
from app.models.presupuesto import Presupuesto, PresupuestoItem
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/presupuestos", tags=["presupuestos"])

ESTADOS = {"borrador", "enviado", "aceptado", "rechazado", "expirado"}


# ── Schemas ────────────────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    descripcion: str
    cantidad: float = 1.0
    precio_unitario: float
    descuento: float = 0.0


class PresupuestoCreate(BaseModel):
    paciente_id: int | None = None
    fecha: date
    notas: str | None = None
    validez_dias: int = 30
    items: list[ItemIn]


class PresupuestoUpdate(BaseModel):
    paciente_id: int | None = None
    fecha: date | None = None
    notas: str | None = None
    validez_dias: int | None = None
    estado: str | None = None
    items: list[ItemIn] | None = None


# ── Helpers ────────────────────────────────────────────────────────────────��───

def _build_items(items_in: list[ItemIn]) -> list[PresupuestoItem]:
    result = []
    for it in items_in:
        subtotal = round(float(it.cantidad) * float(it.precio_unitario) * (1 - float(it.descuento) / 100), 2)
        result.append(PresupuestoItem(
            descripcion=it.descripcion,
            cantidad=Decimal(str(it.cantidad)),
            precio_unitario=Decimal(str(it.precio_unitario)),
            descuento=Decimal(str(it.descuento)),
            subtotal=Decimal(str(subtotal)),
        ))
    return result


def _serialize(p: Presupuesto, pac: Paciente | None = None) -> dict:
    return {
        "id": p.id,
        "numero": p.numero,
        "paciente_id": p.paciente_id,
        "paciente_nombre": f"{pac.apellidos} {pac.nombres}" if pac else None,
        "fecha": p.fecha.isoformat(),
        "estado": p.estado,
        "notas": p.notas,
        "total": float(p.total),
        "validez_dias": p.validez_dias,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
        "items": [
            {
                "id": it.id,
                "descripcion": it.descripcion,
                "cantidad": float(it.cantidad),
                "precio_unitario": float(it.precio_unitario),
                "descuento": float(it.descuento),
                "subtotal": float(it.subtotal),
            }
            for it in p.items
        ],
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
def listar(
    paciente_id: int | None = None,
    estado: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Presupuesto)
        .options(selectinload(Presupuesto.items))
        .order_by(Presupuesto.id.desc())
    )
    if paciente_id:
        stmt = stmt.where(Presupuesto.paciente_id == paciente_id)
    if estado:
        stmt = stmt.where(Presupuesto.estado == estado)

    presupuestos = db.execute(stmt.offset(skip).limit(limit)).scalars().all()
    result = []
    for p in presupuestos:
        pac = db.get(Paciente, p.paciente_id) if p.paciente_id else None
        result.append(_serialize(p, pac))
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
def crear(
    data: PresupuestoCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not data.items:
        raise HTTPException(400, detail="El presupuesto debe tener al menos un ítem")

    numero = siguiente_numero(db, "numerador_presupuesto", "PRE", largo=5)
    items = _build_items(data.items)
    total = sum(float(it.subtotal) for it in items)

    p = Presupuesto(
        numero=numero,
        paciente_id=data.paciente_id,
        usuario_id=current.id,
        fecha=data.fecha,
        notas=data.notas,
        validez_dias=data.validez_dias,
        total=Decimal(str(round(total, 2))),
        estado="borrador",
    )
    db.add(p)
    db.flush()
    for it in items:
        it.presupuesto_id = p.id
        db.add(it)
    db.commit()

    p = db.execute(
        select(Presupuesto).where(Presupuesto.id == p.id).options(selectinload(Presupuesto.items))
    ).scalar_one()
    pac = db.get(Paciente, p.paciente_id) if p.paciente_id else None
    return _serialize(p, pac)


@router.get("/{pid}")
def obtener(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.execute(
        select(Presupuesto).where(Presupuesto.id == pid).options(selectinload(Presupuesto.items))
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Presupuesto no encontrado")
    pac = db.get(Paciente, p.paciente_id) if p.paciente_id else None
    return _serialize(p, pac)


@router.put("/{pid}")
def actualizar(
    pid: int,
    data: PresupuestoUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.execute(
        select(Presupuesto).where(Presupuesto.id == pid).options(selectinload(Presupuesto.items))
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Presupuesto no encontrado")

    if data.estado and data.estado not in ESTADOS:
        raise HTTPException(422, detail=f"Estado inválido. Opciones: {ESTADOS}")

    for field in ("paciente_id", "fecha", "notas", "validez_dias", "estado"):
        val = getattr(data, field)
        if val is not None:
            setattr(p, field, val)

    if data.items is not None:
        for it in list(p.items):
            db.delete(it)
        db.flush()
        new_items = _build_items(data.items)
        for it in new_items:
            it.presupuesto_id = p.id
            db.add(it)
        p.total = Decimal(str(round(sum(float(i.subtotal) for i in new_items), 2)))

    db.commit()
    p = db.execute(
        select(Presupuesto).where(Presupuesto.id == pid).options(selectinload(Presupuesto.items))
    ).scalar_one()
    pac = db.get(Paciente, p.paciente_id) if p.paciente_id else None
    return _serialize(p, pac)


@router.patch("/{pid}/estado")
def cambiar_estado(
    pid: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if estado not in ESTADOS:
        raise HTTPException(422, detail=f"Estado inválido. Opciones: {ESTADOS}")
    p = db.get(Presupuesto, pid)
    if not p:
        raise HTTPException(404, detail="Presupuesto no encontrado")
    p.estado = estado
    db.commit()
    return {"ok": True, "estado": estado}


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Presupuesto, pid)
    if not p:
        raise HTTPException(404, detail="Presupuesto no encontrado")
    db.delete(p)
    db.commit()
