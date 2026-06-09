from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.trial_lc import TrialLC
from app.models.user import User

router = APIRouter(prefix="/trial-lc", tags=["trial_lc"])


class TrialLCCreate(BaseModel):
    paciente_id: int
    consulta_id: int | None = None
    fecha_entrega: date
    fecha_control: date | None = None
    estado: str = "entregado"
    od_marca: str | None = None
    od_bc: float | None = None
    od_diam: float | None = None
    od_esf: float | None = None
    od_cil: float | None = None
    od_eje: int | None = None
    oi_marca: str | None = None
    oi_bc: float | None = None
    oi_diam: float | None = None
    oi_esf: float | None = None
    oi_cil: float | None = None
    oi_eje: int | None = None
    notas: str | None = None


class TrialLCOut(TrialLCCreate):
    id: int
    usuario_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("/pacientes/{pid}/trial-lc", response_model=list[TrialLCOut])
def listar(pid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(
        select(TrialLC).where(TrialLC.paciente_id == pid).order_by(TrialLC.fecha_entrega.desc())
    ).scalars().all()


@router.post("/pacientes/{pid}/trial-lc", response_model=TrialLCOut, status_code=status.HTTP_201_CREATED)
def crear(pid: int, data: TrialLCCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    trial = TrialLC(**data.model_dump(), usuario_id=current.id)
    trial.paciente_id = pid
    db.add(trial)
    db.commit()
    db.refresh(trial)
    return trial


@router.patch("/trial-lc/{tid}", response_model=TrialLCOut)
def actualizar_estado(tid: int, estado: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    trial = db.get(TrialLC, tid)
    if not trial:
        raise HTTPException(status_code=404, detail="Trial no encontrado")
    trial.estado = estado
    db.commit()
    db.refresh(trial)
    return trial


@router.delete("/trial-lc/{tid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(tid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    trial = db.get(TrialLC, tid)
    if not trial:
        raise HTTPException(status_code=404, detail="Trial no encontrado")
    db.delete(trial)
    db.commit()
