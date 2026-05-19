from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.paciente import Paciente
from app.models.user import User
from app.schemas.pacientes import PacienteCreate, PacienteListItem, PacienteOut, PacienteUpdate

router = APIRouter(prefix="/pacientes", tags=["pacientes"])


@router.get("", response_model=list[PacienteListItem])
def listar_pacientes(
    q: str = Query(default="", description="Búsqueda por nombre, cédula o teléfono"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=1000),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Paciente).order_by(Paciente.apellidos, Paciente.nombres)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Paciente.nombres.ilike(like),
                Paciente.apellidos.ilike(like),
                Paciente.cedula.ilike(like),
                Paciente.telefono.ilike(like),
            )
        )
    stmt = stmt.offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=PacienteOut, status_code=status.HTTP_201_CREATED)
def crear_paciente(
    data: PacienteCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "optometrista", "vendedor")),
):
    if data.cedula:
        existe = db.execute(
            select(Paciente).where(Paciente.cedula == data.cedula)
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un paciente con cédula {data.cedula}",
            )

    numero = siguiente_numero(db, "numerador_paciente", "PAC")
    paciente = Paciente(numero=numero, **data.model_dump())
    db.add(paciente)
    db.commit()
    db.refresh(paciente)
    return paciente


@router.get("/{pid}", response_model=PacienteOut)
def obtener_paciente(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return p


@router.put("/{pid}", response_model=PacienteOut)
def actualizar_paciente(
    pid: int,
    data: PacienteUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "optometrista", "vendedor")),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    if data.cedula and data.cedula != p.cedula:
        existe = db.execute(
            select(Paciente).where(Paciente.cedula == data.cedula)
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un paciente con cédula {data.cedula}",
            )

    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(p, campo, valor)

    db.commit()
    db.refresh(p)
    return p


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_paciente(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    db.delete(p)
    db.commit()
