"""
Búsqueda global — encuentra pacientes, ventas, órdenes y créditos por texto libre.
Endpoint:
  GET /buscar?q=...  → hasta 5 resultados por entidad
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.agenda import OrdenTrabajo
from app.models.credito import Credito
from app.models.paciente import Paciente
from app.models.producto import Producto
from app.models.user import User
from app.models.venta import Venta

router = APIRouter(prefix="/buscar", tags=["buscar"])


@router.get("")
def buscar(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    term = f"%{q.strip()}%"
    limit = 6

    # Pacientes
    pacientes_rows = db.execute(
        select(Paciente)
        .where(
            or_(
                Paciente.nombres.ilike(term),
                Paciente.apellidos.ilike(term),
                Paciente.cedula.ilike(term),
                Paciente.telefono.ilike(term),
            )
        )
        .limit(limit)
    ).scalars().all()
    pacientes_out = [
        {
            "tipo": "paciente",
            "id": p.id,
            "label": f"{p.apellidos} {p.nombres}",
            "sub": p.cedula or p.telefono or "",
            "url": f"/pacientes/{p.id}",
        }
        for p in pacientes_rows
    ]

    # Ventas
    ventas_rows = db.execute(
        select(Venta, Paciente)
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .where(
            or_(
                Venta.numero.ilike(term),
                Paciente.apellidos.ilike(term),
                Paciente.nombres.ilike(term),
            )
        )
        .order_by(Venta.fecha.desc())
        .limit(limit)
    ).all()
    ventas_out = [
        {
            "tipo": "venta",
            "id": v.id,
            "label": v.numero,
            "sub": f"{p.apellidos} {p.nombres}" if p else f"${float(v.total):.2f}",
            "url": f"/ventas/{v.id}",
        }
        for v, p in ventas_rows
    ]

    # Órdenes
    ordenes_rows = db.execute(
        select(OrdenTrabajo, Paciente)
        .outerjoin(Paciente, OrdenTrabajo.paciente_id == Paciente.id)
        .where(
            or_(
                OrdenTrabajo.numero.ilike(term),
                OrdenTrabajo.lab_proveedor.ilike(term),
                Paciente.apellidos.ilike(term),
                Paciente.nombres.ilike(term),
            )
        )
        .order_by(OrdenTrabajo.id.desc())
        .limit(limit)
    ).all()
    ordenes_out = [
        {
            "tipo": "orden",
            "id": o.id,
            "label": o.numero,
            "sub": f"{p.apellidos} {p.nombres}" if p else o.lab_proveedor or "",
            "url": "/ordenes",
        }
        for o, p in ordenes_rows
    ]

    # Créditos
    creditos_rows = db.execute(
        select(Credito, Paciente)
        .outerjoin(Paciente, Credito.paciente_id == Paciente.id)
        .where(
            or_(
                Credito.numero.ilike(term),
                Paciente.apellidos.ilike(term),
                Paciente.nombres.ilike(term),
            )
        )
        .order_by(Credito.created_at.desc())
        .limit(limit)
    ).all()
    creditos_out = [
        {
            "tipo": "credito",
            "id": c.id,
            "label": c.numero,
            "sub": f"{p.apellidos} {p.nombres}" if p else f"${float(c.monto_total):.2f}",
            "url": "/creditos",
        }
        for c, p in creditos_rows
    ]

    # Productos
    productos_rows = db.execute(
        select(Producto)
        .where(
            Producto.activo.is_(True),
            or_(
                Producto.nombre.ilike(term),
                Producto.codigo.ilike(term),
            )
        )
        .limit(limit)
    ).scalars().all()
    productos_out = [
        {
            "tipo": "producto",
            "id": pr.id,
            "label": pr.nombre,
            "sub": pr.codigo or f"${float(pr.precio_venta):.2f}",
            "url": "/inventario",
        }
        for pr in productos_rows
    ]

    total = len(pacientes_out) + len(ventas_out) + len(ordenes_out) + len(creditos_out) + len(productos_out)

    return {
        "query": q,
        "total": total,
        "pacientes": pacientes_out,
        "ventas": ventas_out,
        "ordenes": ordenes_out,
        "creditos": creditos_out,
        "productos": productos_out,
    }
