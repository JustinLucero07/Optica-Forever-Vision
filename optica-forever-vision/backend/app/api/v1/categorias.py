from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.models.producto import Categoria
from app.models.user import User
from app.schemas.productos import CategoriaCreate, CategoriaOut

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.execute(select(Categoria).order_by(Categoria.nombre)).scalars().all()


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cat = Categoria(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cid}", response_model=CategoriaOut)
def actualizar(
    cid: int,
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cat = db.get(Categoria, cid)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.nombre = data.nombre
    cat.descripcion = data.descripcion
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cat = db.get(Categoria, cid)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    db.delete(cat)
    db.commit()
