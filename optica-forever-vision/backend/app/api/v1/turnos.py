from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.agenda import Turno
from app.models.user import User
from app.schemas.agenda import TurnoCreate, TurnoOut, TurnoUpdate

router = APIRouter(prefix="/turnos", tags=["turnos"])


@router.get("", response_model=list[TurnoOut])
def listar_turnos(
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    optometrista_id: int | None = None,
    estado: str | None = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Turno).order_by(Turno.fecha, Turno.hora_inicio)
    if fecha_inicio:
        stmt = stmt.where(Turno.fecha >= fecha_inicio)
    if fecha_fin:
        stmt = stmt.where(Turno.fecha <= fecha_fin)
    if optometrista_id:
        stmt = stmt.where(Turno.optometrista_id == optometrista_id)
    if estado:
        stmt = stmt.where(Turno.estado == estado)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.get("/count")
def contar_turnos(
    fecha: date | None = None,
    estado: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(func.count()).select_from(Turno)
    if fecha:
        stmt = stmt.where(Turno.fecha == fecha)
    if estado:
        stmt = stmt.where(Turno.estado == estado)
    return {"total": db.execute(stmt).scalar_one()}


@router.post("", response_model=TurnoOut, status_code=status.HTTP_201_CREATED)
def crear_turno(
    body: TurnoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    turno = Turno(**body.model_dump(), creado_por_id=current_user.id)
    db.add(turno)
    db.commit()
    db.refresh(turno)
    return turno


@router.get("/{turno_id}", response_model=TurnoOut)
def obtener_turno(
    turno_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    turno = db.get(Turno, turno_id)
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    return turno


@router.put("/{turno_id}", response_model=TurnoOut)
def actualizar_turno(
    turno_id: int,
    body: TurnoUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    turno = db.get(Turno, turno_id)
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(turno, k, v)
    db.commit()
    db.refresh(turno)
    return turno


@router.patch("/{turno_id}/estado", response_model=TurnoOut)
def cambiar_estado(
    turno_id: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ESTADOS = {"pendiente", "confirmado", "asistido", "cancelado", "no_asistio"}
    if estado not in ESTADOS:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Opciones: {ESTADOS}")
    turno = db.get(Turno, turno_id)
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    turno.estado = estado
    db.commit()
    db.refresh(turno)
    return turno


@router.delete("/{turno_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_turno(
    turno_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    turno = db.get(Turno, turno_id)
    if not turno:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    db.delete(turno)
    db.commit()
