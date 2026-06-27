from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_roles
from app.models.configuracion import Configuracion
from app.models.user import User

router = APIRouter(prefix="/configuracion", tags=["configuracion"])

# Solo estas claves pueden escribirse desde la API
CLAVES_PERMITIDAS = {
    "nombre_optica",
    "direccion_optica",
    "telefono_optica",
    "telefono_optica_2",
    "firma_electronica",
    "logo",
    "pais_codigo",
    "email_admin",
    "admin_phone",
    "wa_mode",   # "wame" | "cloud_api"
}


class ConfigSet(BaseModel):
    valor: str = Field(..., max_length=5_000_000)


@router.get("")
def listar(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.execute(select(Configuracion)).scalars().all()
    return {r.clave: r.valor for r in rows}


@router.put("/{clave}")
def set_config(
    clave: str,
    data: ConfigSet,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    if clave not in CLAVES_PERMITIDAS:
        raise HTTPException(400, detail=f"Clave '{clave}' no permitida")
    row = db.execute(select(Configuracion).where(Configuracion.clave == clave)).scalar_one_or_none()
    if row:
        row.valor = data.valor
    else:
        db.add(Configuracion(clave=clave, valor=data.valor))
    db.commit()
    return {"ok": True}
