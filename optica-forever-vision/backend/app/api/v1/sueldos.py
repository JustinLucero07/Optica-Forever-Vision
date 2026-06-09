from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.sueldo import SueldoConfig, PagoSueldo
from app.models.tesoreria import CuentaBancaria, Egreso
from app.models.user import User

router = APIRouter(prefix="/sueldos", tags=["sueldos"])


# ── Schemas inline ─────────────────────────────────────────────────────────────
from datetime import datetime
from pydantic import BaseModel


class SueldoConfigCreate(BaseModel):
    usuario_id: int
    monto_mensual: float
    dia_pago: int = 30
    notas: str | None = None


class SueldoConfigOut(BaseModel):
    id: int
    usuario_id: int
    monto_mensual: float
    dia_pago: int
    activo: bool
    notas: str | None
    model_config = {"from_attributes": True}


class PagoSueldoCreate(BaseModel):
    usuario_id: int
    periodo: str          # "2026-06"
    tipo: str             # "sueldo" | "adelanto"
    monto: float
    cuenta_bancaria_id: int
    notas: str | None = None
    fecha: date | None = None


class PagoSueldoOut(BaseModel):
    id: int
    numero: str
    usuario_id: int
    periodo: str
    tipo: str
    monto: float
    cuenta_bancaria_id: int
    egreso_id: int | None
    notas: str | None
    pagado_por_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Configuración de sueldos ───────────────────────────────────────────────────

@router.get("/config", response_model=list[SueldoConfigOut])
def listar_config(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return db.execute(select(SueldoConfig).order_by(SueldoConfig.id)).scalars().all()


@router.post("/config", response_model=SueldoConfigOut, status_code=status.HTTP_201_CREATED)
def crear_config(
    data: SueldoConfigCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    existente = db.execute(select(SueldoConfig).where(SueldoConfig.usuario_id == data.usuario_id)).scalar_one_or_none()
    if existente:
        raise HTTPException(status_code=409, detail="Ya existe configuración para este usuario")
    cfg = SueldoConfig(**data.model_dump())
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.put("/config/{cfg_id}", response_model=SueldoConfigOut)
def actualizar_config(
    cfg_id: int,
    data: SueldoConfigCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cfg = db.get(SueldoConfig, cfg_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.delete("/config/{cfg_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_config(
    cfg_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    cfg = db.get(SueldoConfig, cfg_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    db.delete(cfg)
    db.commit()


# ── Pagos de sueldo ────────────────────────────────────────────────────────────

@router.get("/pagos", response_model=list[PagoSueldoOut])
def listar_pagos(
    usuario_id: int | None = None,
    periodo: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    stmt = select(PagoSueldo).order_by(PagoSueldo.created_at.desc())
    if usuario_id:
        stmt = stmt.where(PagoSueldo.usuario_id == usuario_id)
    if periodo:
        stmt = stmt.where(PagoSueldo.periodo == periodo)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.post("/pagar", response_model=PagoSueldoOut, status_code=status.HTTP_201_CREATED)
def registrar_pago(
    data: PagoSueldoCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin")),
):
    if data.monto <= 0:
        raise HTTPException(status_code=422, detail="El monto debe ser positivo")

    cuenta = db.execute(
        select(CuentaBancaria).where(CuentaBancaria.id == data.cuenta_bancaria_id).with_for_update()
    ).scalar_one_or_none()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    if float(cuenta.saldo_actual) < data.monto:
        raise HTTPException(status_code=422, detail=f"Saldo insuficiente en {cuenta.nombre} — disponible: ${float(cuenta.saldo_actual):.2f}")

    usuario = db.get(User, data.usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    fecha_pago = data.fecha or date.today()
    tipo_label = "Sueldo" if data.tipo == "sueldo" else "Adelanto de sueldo"

    # Crear egreso automáticamente
    num_egreso = siguiente_numero(db, "numerador_egreso", "EGR")
    egreso = Egreso(
        numero=num_egreso,
        cuenta_bancaria_id=data.cuenta_bancaria_id,
        fecha=fecha_pago,
        categoria="Sueldos y Salarios",
        concepto=f"{tipo_label} — {usuario.full_name} — {data.periodo}",
        monto=data.monto,
        metodo_pago="transferencia",
        notas=data.notas,
        usuario_id=current.id,
    )
    db.add(egreso)
    db.flush()

    cuenta.saldo_actual = float(cuenta.saldo_actual) - data.monto

    num_pago = siguiente_numero(db, "numerador_pago_sueldo", "SUE")
    pago = PagoSueldo(
        numero=num_pago,
        usuario_id=data.usuario_id,
        periodo=data.periodo,
        tipo=data.tipo,
        monto=data.monto,
        cuenta_bancaria_id=data.cuenta_bancaria_id,
        egreso_id=egreso.id,
        notas=data.notas,
        pagado_por_id=current.id,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return pago
