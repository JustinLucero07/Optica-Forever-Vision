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

TIPOS_VALIDOS = {
    "referido", "origen",
    "luna_material", "luna_indice", "luna_tratamiento",
    "rx_material", "rx_tratamiento", "rx_diseno",
}
TIPOS_CASCADA_PACIENTE = {"referido", "origen"}


class ReferidoIn(BaseModel):
    nombre: str
    tipo: str = "referido"
    activo: bool = True


class ReferidoOut(BaseModel):
    id: int
    nombre: str
    tipo: str
    activo: bool
    model_config = {"from_attributes": True}


@router.get("", response_model=list[ReferidoOut])
def listar(
    tipo: str = Query("referido"),
    activo: bool | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Referido).where(Referido.tipo == tipo).order_by(Referido.nombre)
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
    tipo = data.tipo if data.tipo in TIPOS_VALIDOS else "referido"
    existing = db.execute(
        select(Referido).where(Referido.tipo == tipo, Referido.nombre.ilike(nombre))
    ).scalar_one_or_none()
    if existing:
        return existing
    ref = Referido(nombre=nombre, tipo=tipo, activo=data.activo)
    db.add(ref)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(Referido).where(Referido.tipo == tipo, Referido.nombre.ilike(nombre))
        ).scalar_one_or_none()
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Ya existe un registro con ese nombre")
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
    if nombre_anterior != nombre_nuevo and ref.tipo in TIPOS_CASCADA_PACIENTE:
        columna = Paciente.origen if ref.tipo == "origen" else Paciente.referido_por
        db.execute(
            Paciente.__table__.update()
            .where(columna == nombre_anterior)
            .values({columna.key: nombre_nuevo})
        )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un registro con ese nombre")
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
