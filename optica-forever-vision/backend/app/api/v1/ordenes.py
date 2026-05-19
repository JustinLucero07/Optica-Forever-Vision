from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.numeradores import siguiente_numero
from app.models.agenda import OrdenTrabajo
from app.models.user import User
from app.schemas.agenda import OrdenCreate, OrdenOut, OrdenUpdate

router = APIRouter(prefix="/ordenes", tags=["ordenes"])


@router.get("", response_model=list[OrdenOut])
def listar_ordenes(
    paciente_id: int | None = None,
    estado: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(OrdenTrabajo).order_by(OrdenTrabajo.id.desc())
    if paciente_id:
        stmt = stmt.where(OrdenTrabajo.paciente_id == paciente_id)
    if estado:
        stmt = stmt.where(OrdenTrabajo.estado == estado)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.post("", response_model=OrdenOut, status_code=status.HTTP_201_CREATED)
def crear_orden(
    body: OrdenCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    numero = siguiente_numero(db, "numerador_orden", "ORD", largo=5)
    orden = OrdenTrabajo(**body.model_dump(), numero=numero)
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return orden


@router.get("/{orden_id}", response_model=OrdenOut)
def obtener_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.put("/{orden_id}", response_model=OrdenOut)
def actualizar_orden(
    orden_id: int,
    body: OrdenUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(orden, k, v)
    db.commit()
    db.refresh(orden)
    return orden


@router.patch("/{orden_id}/estado", response_model=OrdenOut)
def cambiar_estado(
    orden_id: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ESTADOS = {"pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"}
    if estado not in ESTADOS:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Opciones: {ESTADOS}")
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    orden.estado = estado
    db.commit()
    db.refresh(orden)
    return orden
