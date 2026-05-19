from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user, require_roles
from app.core.db import get_db
from app.core.numeradores import siguiente_numero
from app.models.consulta import Consulta, Receta
from app.models.paciente import Paciente
from app.models.user import User
from app.schemas.consultas import (
    ConsultaCreate,
    ConsultaGlobalItem,
    ConsultaListItem,
    ConsultaOut,
    ConsultaUpdate,
)

router = APIRouter(tags=["consultas"])


def _apply_recetas(db: Session, consulta: Consulta, data: ConsultaCreate) -> None:
    recetas_existentes = {r.tipo: r for r in consulta.recetas}

    if data.receta_lc is not None:
        r = recetas_existentes.get("lente_convencional") or Receta(
            consulta_id=consulta.id, tipo="lente_convencional"
        )
        lc = data.receta_lc
        r.lc_od_esf = lc.od_esf
        r.lc_od_cil = lc.od_cil
        r.lc_od_eje = lc.od_eje
        r.lc_od_add = lc.od_add
        r.lc_od_dnp = lc.od_dnp
        r.lc_od_alt = lc.od_alt
        r.lc_oi_esf = lc.oi_esf
        r.lc_oi_cil = lc.oi_cil
        r.lc_oi_eje = lc.oi_eje
        r.lc_oi_add = lc.oi_add
        r.lc_oi_dnp = lc.oi_dnp
        r.lc_oi_alt = lc.oi_alt
        r.tipo_lente = lc.tipo_lente
        r.tipo_armadura = lc.tipo_armadura
        r.observaciones = lc.observaciones
        if r not in consulta.recetas:
            consulta.recetas.append(r)

    if data.receta_cl is not None:
        r = recetas_existentes.get("contactologia") or Receta(
            consulta_id=consulta.id, tipo="contactologia"
        )
        cl = data.receta_cl
        r.cl_od_marca = cl.od_marca
        r.cl_od_bc = cl.od_bc
        r.cl_od_diam = cl.od_diam
        r.cl_od_esf = cl.od_esf
        r.cl_od_cil = cl.od_cil
        r.cl_od_eje = cl.od_eje
        r.cl_oi_marca = cl.oi_marca
        r.cl_oi_bc = cl.oi_bc
        r.cl_oi_diam = cl.oi_diam
        r.cl_oi_esf = cl.oi_esf
        r.cl_oi_cil = cl.oi_cil
        r.cl_oi_eje = cl.oi_eje
        r.observaciones = cl.observaciones
        if r not in consulta.recetas:
            consulta.recetas.append(r)


@router.get("/consultas", response_model=list[ConsultaGlobalItem])
def listar_todas_consultas(
    q: str = Query(default="", description="Buscar por paciente, cédula o número"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(Consulta, Paciente)
        .join(Paciente, Consulta.paciente_id == Paciente.id)
        .order_by(Consulta.fecha.desc(), Consulta.id.desc())
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Paciente.nombres.ilike(like),
                Paciente.apellidos.ilike(like),
                Paciente.cedula.ilike(like),
                Consulta.numero.ilike(like),
            )
        )
    rows = db.execute(stmt.offset(skip).limit(limit)).all()
    result = []
    for consulta, paciente in rows:
        result.append(ConsultaGlobalItem(
            id=consulta.id,
            numero=consulta.numero,
            fecha=consulta.fecha,
            paciente_id=consulta.paciente_id,
            paciente_nombre=f"{paciente.apellidos} {paciente.nombres}",
            motivo_consulta=consulta.motivo_consulta,
            diagnostico=consulta.diagnostico,
            rx_od_esf=consulta.rx_od_esf,
            rx_od_cil=consulta.rx_od_cil,
            rx_od_eje=consulta.rx_od_eje,
        ))
    return result


@router.get("/pacientes/{pid}/consultas", response_model=list[ConsultaListItem])
def listar_consultas(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Paciente, pid):
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    stmt = (
        select(Consulta)
        .where(Consulta.paciente_id == pid)
        .order_by(Consulta.fecha.desc())
    )
    return db.execute(stmt).scalars().all()


@router.post(
    "/pacientes/{pid}/consultas",
    response_model=ConsultaOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_consulta(
    pid: int,
    data: ConsultaCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "optometrista")),
):
    if not db.get(Paciente, pid):
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    numero = siguiente_numero(db, "numerador_consulta", "CON")
    campos = data.model_dump(exclude={"receta_lc", "receta_cl"})
    consulta = Consulta(numero=numero, paciente_id=pid, optometrista_id=current.id, **campos)
    db.add(consulta)
    db.flush()

    _apply_recetas(db, consulta, data)
    db.commit()

    consulta = db.execute(
        select(Consulta).where(Consulta.id == consulta.id).options(selectinload(Consulta.recetas))
    ).scalar_one()
    return consulta


@router.get("/consultas/{cid}", response_model=ConsultaOut)
def obtener_consulta(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    consulta = db.execute(
        select(Consulta).where(Consulta.id == cid).options(selectinload(Consulta.recetas))
    ).scalar_one_or_none()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    return consulta


@router.put("/consultas/{cid}", response_model=ConsultaOut)
def actualizar_consulta(
    cid: int,
    data: ConsultaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "optometrista")),
):
    consulta = db.execute(
        select(Consulta).where(Consulta.id == cid).options(selectinload(Consulta.recetas))
    ).scalar_one_or_none()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")

    campos = data.model_dump(exclude={"receta_lc", "receta_cl"}, exclude_unset=True)
    for campo, valor in campos.items():
        setattr(consulta, campo, valor)

    _apply_recetas(db, consulta, data)
    db.commit()
    db.refresh(consulta)
    return consulta


@router.delete("/consultas/{cid}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_consulta(
    cid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    consulta = db.get(Consulta, cid)
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    db.delete(consulta)
    db.commit()
