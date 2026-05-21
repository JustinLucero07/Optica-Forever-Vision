from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_roles
from app.core.security import hash_password
from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, UserOut

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.get("", response_model=list[UserOut])
def listar(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return db.execute(select(User).order_by(User.full_name)).scalars().all()

@router.post("", response_model=UserOut, status_code=201)
def crear(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    if db.execute(select(User).where(User.email == data.email)).scalar_one_or_none():
        raise HTTPException(400, detail="El email ya existe")
    user = User(
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        password_hash=hash_password(data.password),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{uid}", response_model=UserOut)
def actualizar(uid: int, data: UserUpdate, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    user = db.get(User, uid)
    if not user:
        raise HTTPException(404, detail="Usuario no encontrado")
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        if uid == me.id:
            raise HTTPException(400, detail="No puedes cambiar tu propio rol")
        user.role = data.role
    if data.is_active is not None:
        if uid == me.id and not data.is_active:
            raise HTTPException(400, detail="No puedes desactivarte a ti mismo")
        user.is_active = data.is_active
    if data.password:
        user.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{uid}", status_code=204)
def eliminar(uid: int, db: Session = Depends(get_db), me: User = Depends(require_roles("admin"))):
    if uid == me.id:
        raise HTTPException(400, detail="No puedes eliminarte a ti mismo")
    user = db.get(User, uid)
    if not user:
        raise HTTPException(404)
    db.delete(user)
    db.commit()
