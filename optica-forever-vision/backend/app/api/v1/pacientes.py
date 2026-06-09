from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.nota import PacienteNota
from app.models.paciente import Paciente
from app.models.user import User
from app.schemas.pacientes import PacienteCreate, PacienteListItem, PacienteOut, PacienteUpdate


class FotoIn(BaseModel):
    foto: str  # base64 data-url

class NotaIn(BaseModel):
    contenido: str

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


# ── Foto ───────────────────────────────────────────────────────────────────────

@router.put("/{pid}/foto", response_model=PacienteOut)
def guardar_foto(
    pid: int,
    data: FotoIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "optometrista", "vendedor")),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")
    p.foto = data.foto
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{pid}/foto", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_foto(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "optometrista")),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")
    p.foto = None
    db.commit()


# ── Notas internas ─────────────────────────────────────────────────────────────

@router.get("/{pid}/notas")
def listar_notas(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")
    notas = db.execute(
        select(PacienteNota, User)
        .outerjoin(User, PacienteNota.usuario_id == User.id)
        .where(PacienteNota.paciente_id == pid)
        .order_by(PacienteNota.created_at.desc())
    ).all()
    return [
        {
            "id": n.id,
            "contenido": n.contenido,
            "usuario": u.full_name if u else None,
            "created_at": n.created_at.isoformat(),
        }
        for n, u in notas
    ]


@router.post("/{pid}/notas", status_code=status.HTTP_201_CREATED)
def agregar_nota(
    pid: int,
    data: NotaIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")
    nota = PacienteNota(paciente_id=pid, usuario_id=current.id, contenido=data.contenido.strip())
    db.add(nota)
    db.commit()
    db.refresh(nota)
    return {"id": nota.id, "contenido": nota.contenido, "usuario": current.full_name, "created_at": nota.created_at.isoformat()}


@router.delete("/{pid}/notas/{nid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_nota(
    pid: int,
    nid: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    nota = db.execute(
        select(PacienteNota).where(PacienteNota.id == nid, PacienteNota.paciente_id == pid)
    ).scalar_one_or_none()
    if not nota:
        raise HTTPException(404, detail="Nota no encontrada")
    if nota.usuario_id != current.id and current.role != "admin":
        raise HTTPException(403, detail="Solo puedes eliminar tus propias notas")
    db.delete(nota)
    db.commit()


# ── Garantías ──────────────────────────────────────────────────────────────────

@router.get("/{pid}/garantias")
def garantias_paciente(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.venta import Venta, VentaItem
    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")
    rows = db.execute(
        select(VentaItem, Venta.numero)
        .join(Venta, VentaItem.venta_id == Venta.id)
        .where(Venta.paciente_id == pid, VentaItem.garantia_vence.isnot(None))
        .order_by(VentaItem.garantia_vence)
    ).all()
    today = date.today()
    return [
        {
            "id": item.id,
            "descripcion": item.descripcion,
            "garantia_meses": item.garantia_meses,
            "garantia_vence": item.garantia_vence.isoformat() if item.garantia_vence else None,
            "venta_numero": venta_num,
            "vencida": item.garantia_vence < today if item.garantia_vence else False,
        }
        for item, venta_num in rows
    ]


# ── Estado de cuenta ───────────────────────────────────────────────────────────

@router.get("/{pid}/estado-cuenta")
def estado_cuenta(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.credito import Credito, CuotaCredito
    from app.models.venta import Venta

    p = db.get(Paciente, pid)
    if not p:
        raise HTTPException(404, detail="Paciente no encontrado")

    # Ventas pendientes de cobro
    ventas_pend = db.execute(
        select(Venta).where(Venta.paciente_id == pid, Venta.estado == "pendiente")
    ).scalars().all()

    # Créditos activos con cuotas
    creditos = db.execute(
        select(Credito)
        .where(Credito.paciente_id == pid, Credito.estado.in_(["vigente", "vencido"]))
        .options(selectinload(Credito.cuotas))
    ).scalars().all()

    total_ventas = sum(float(v.total) for v in ventas_pend)
    total_creditos = sum(
        float(q.monto - q.monto_pagado)
        for c in creditos
        for q in c.cuotas
        if q.estado in ("pendiente", "vencido")
    )

    return {
        "total_deuda": round(total_ventas + total_creditos, 2),
        "total_ventas_pendientes": round(total_ventas, 2),
        "total_creditos_pendientes": round(total_creditos, 2),
        "ventas_pendientes": [
            {"id": v.id, "numero": v.numero, "fecha": v.fecha.isoformat(), "total": float(v.total)}
            for v in ventas_pend
        ],
        "creditos_activos": [
            {
                "id": c.id,
                "numero": c.numero,
                "estado": c.estado,
                "monto_total": float(c.monto_total),
                "saldo": float(c.monto_total - c.monto_pagado),
                "cuotas_vencidas": sum(1 for q in c.cuotas if q.estado == "vencido"),
            }
            for c in creditos
        ],
    }
