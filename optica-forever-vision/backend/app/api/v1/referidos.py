from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_roles
from app.models.paciente import Paciente
from app.models.referido import Referido
from app.models.user import User

router = APIRouter(prefix="/referidos", tags=["referidos"])


class ReferidoIn(BaseModel):
    nombre: str
    activo: bool = True


class ReferidoOut(BaseModel):
    id: int
    nombre: str
    activo: bool
    model_config = {"from_attributes": True}


@router.get("", response_model=list[ReferidoOut])
def listar(
    activo: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Referido).order_by(Referido.nombre)
    if activo is not None:
        stmt = stmt.where(Referido.activo.is_(activo))
    return db.execute(stmt).scalars().all()


@router.post("", response_model=ReferidoOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: ReferidoIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    nombre = data.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre es obligatorio")
    existing = db.execute(select(Referido).where(Referido.nombre.ilike(nombre))).scalar_one_or_none()
    if existing:
        return existing
    ref = Referido(nombre=nombre, activo=data.activo)
    db.add(ref)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(select(Referido).where(Referido.nombre.ilike(nombre))).scalar_one_or_none()
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Ya existe un referido con ese nombre")
    db.refresh(ref)
    return ref


@router.put("/{referido_id}", response_model=ReferidoOut)
def actualizar(
    referido_id: int,
    data: ReferidoIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    ref = db.get(Referido, referido_id)
    if not ref:
        raise HTTPException(status_code=404, detail="Referido no encontrado")
    nombre_nuevo = data.nombre.strip()
    if not nombre_nuevo:
        raise HTTPException(status_code=422, detail="El nombre es obligatorio")
    nombre_anterior = ref.nombre
    ref.nombre = nombre_nuevo
    ref.activo = data.activo
    # Propaga el renombre a los pacientes que ya usaban el nombre anterior
    if nombre_anterior != nombre_nuevo:
        db.execute(
            Paciente.__table__.update()
            .where(Paciente.referido_por == nombre_anterior)
            .values(referido_por=nombre_nuevo)
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un referido con ese nombre")
    db.refresh(ref)
    return ref


@router.delete("/{referido_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    referido_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    ref = db.get(Referido, referido_id)
    if not ref:
        raise HTTPException(status_code=404, detail="Referido no encontrado")
    db.delete(ref)
    db.commit()
