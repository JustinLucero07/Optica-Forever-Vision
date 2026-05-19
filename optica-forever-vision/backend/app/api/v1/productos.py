from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.models.producto import MovimientoInventario, Producto
from app.models.user import User
from app.schemas.productos import (
    AjusteStock,
    EntradaStock,
    ProductoCreate,
    ProductoListItem,
    ProductoOut,
    ProductoUpdate,
)

router = APIRouter(prefix="/productos", tags=["productos"])

_eager = selectinload(Producto.categoria)


@router.get("", response_model=list[ProductoListItem])
def listar(
    q: str = Query(default=""),
    categoria_id: int | None = None,
    stock_bajo: bool = False,
    activo: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Producto).options(_eager).where(Producto.activo == activo)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Producto.nombre.ilike(like), Producto.codigo.ilike(like)))
    if categoria_id:
        stmt = stmt.where(Producto.categoria_id == categoria_id)
    if stock_bajo:
        stmt = stmt.where(Producto.stock_actual <= Producto.stock_minimo)
    stmt = stmt.order_by(Producto.nombre).offset(skip).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear(
    data: ProductoCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "vendedor")),
):
    prod = Producto(**data.model_dump())
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return db.execute(select(Producto).options(_eager).where(Producto.id == prod.id)).scalar_one()


@router.get("/{pid}", response_model=ProductoOut)
def obtener(pid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    prod = db.execute(select(Producto).options(_eager).where(Producto.id == pid)).scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return prod


@router.put("/{pid}", response_model=ProductoOut)
def actualizar(
    pid: int,
    data: ProductoUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "vendedor")),
):
    prod = db.get(Producto, pid)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for campo, valor in data.model_dump(exclude_unset=True).items():
        setattr(prod, campo, valor)
    db.commit()
    return db.execute(select(Producto).options(_eager).where(Producto.id == pid)).scalar_one()


@router.post("/{pid}/entrada", response_model=ProductoOut)
def entrada_stock(
    pid: int,
    data: EntradaStock,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "vendedor")),
):
    prod = db.get(Producto, pid)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if data.cantidad <= 0:
        raise HTTPException(status_code=422, detail="La cantidad debe ser positiva")

    antes = prod.stock_actual
    prod.stock_actual = antes + data.cantidad
    db.add(MovimientoInventario(
        producto_id=pid, tipo="entrada", cantidad=data.cantidad,
        stock_antes=antes, stock_despues=prod.stock_actual,
        motivo=data.motivo, usuario_id=current.id,
    ))
    db.commit()
    return db.execute(select(Producto).options(_eager).where(Producto.id == pid)).scalar_one()


@router.post("/{pid}/ajuste", response_model=ProductoOut)
def ajuste_stock(
    pid: int,
    data: AjusteStock,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    prod = db.get(Producto, pid)
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    antes = prod.stock_actual
    diferencia = data.cantidad_nueva - float(antes)
    prod.stock_actual = data.cantidad_nueva
    db.add(MovimientoInventario(
        producto_id=pid, tipo="ajuste", cantidad=diferencia,
        stock_antes=antes, stock_despues=prod.stock_actual,
        motivo=data.motivo, usuario_id=current.id,
    ))
    db.commit()
    return db.execute(select(Producto).options(_eager).where(Producto.id == pid)).scalar_one()
