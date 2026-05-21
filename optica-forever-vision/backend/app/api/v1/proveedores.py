from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.proveedor import Proveedor
from app.models.user import User

router = APIRouter(prefix="/proveedores", tags=["proveedores"])


class ProveedorIn(BaseModel):
    ruc: Optional[str] = None
    nombre: str
    nombre_comercial: Optional[str] = None
    tipo: str = "laboratorio"
    telefono: Optional[str] = None
    telefono_2: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    contacto: Optional[str] = None
    activo: bool = True
    notas: Optional[str] = None


class ProveedorOut(BaseModel):
    id: int
    ruc: Optional[str]
    nombre: str
    nombre_comercial: Optional[str]
    tipo: str
    telefono: Optional[str]
    telefono_2: Optional[str]
    email: Optional[str]
    direccion: Optional[str]
    ciudad: Optional[str]
    contacto: Optional[str]
    activo: bool
    notas: Optional[str]

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProveedorOut])
def listar_proveedores(
    q: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Proveedor)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Proveedor.nombre.ilike(term),
                Proveedor.nombre_comercial.ilike(term),
                Proveedor.ruc.ilike(term),
            )
        )
    if tipo:
        stmt = stmt.where(Proveedor.tipo == tipo)
    if activo is not None:
        stmt = stmt.where(Proveedor.activo.is_(activo))
    stmt = stmt.order_by(Proveedor.nombre)
    return db.execute(stmt).scalars().all()


@router.get("/{proveedor_id}", response_model=ProveedorOut)
def obtener_proveedor(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Proveedor, proveedor_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return p


@router.post("", response_model=ProveedorOut, status_code=201)
def crear_proveedor(
    data: ProveedorIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if data.ruc:
        existing = db.execute(
            select(Proveedor).where(Proveedor.ruc == data.ruc)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un proveedor con ese RUC")
    p = Proveedor(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{proveedor_id}", response_model=ProveedorOut)
def actualizar_proveedor(
    proveedor_id: int,
    data: ProveedorIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Proveedor, proveedor_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if data.ruc and data.ruc != p.ruc:
        existing = db.execute(
            select(Proveedor).where(Proveedor.ruc == data.ruc)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un proveedor con ese RUC")
    for field, value in data.model_dump().items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{proveedor_id}", status_code=204)
def eliminar_proveedor(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Proveedor, proveedor_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    p.activo = False
    db.commit()
