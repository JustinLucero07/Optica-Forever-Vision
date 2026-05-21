"""
Fase 5 — Reportes y KPIs
Endpoints:
  GET /reportes/dashboard        → KPIs generales
  GET /reportes/ventas           → detalle de ventas por rango
  GET /reportes/ventas/excel     → descarga Excel de ventas
  GET /reportes/cobros           → detalle de cobros por rango
  GET /reportes/cobros/excel     → descarga Excel de cobros
  GET /reportes/inventario       → stock actual + alertas
  GET /reportes/inventario/excel → descarga Excel de inventario
  GET /reportes/ordenes          → órdenes por estado y rango
"""
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.agenda import OrdenTrabajo, Turno
from app.models.credito import CuotaCredito
from app.models.paciente import Paciente
from app.models.producto import Producto
from app.models.tesoreria import Cobro, Egreso
from app.models.user import User
from app.models.venta import Venta, VentaItem

router = APIRouter(prefix="/reportes", tags=["reportes"])


# ── helpers ────────────────────────────────────────────────────────────────────

def _excel_response(wb: Workbook, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


def _header_row(ws, cols: list[str], fill_hex: str = "2563EB"):
    fill = PatternFill("solid", fgColor=fill_hex)
    font = Font(bold=True, color="FFFFFF")
    for i, col in enumerate(cols, 1):
        cell = ws.cell(row=1, column=i, value=col)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center")


# ── Dashboard KPIs ─────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard_kpis(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    hoy = date.today()
    inicio_mes = hoy.replace(day=1)

    # Ventas del mes
    ventas_mes = db.execute(
        select(func.coalesce(func.sum(Venta.total), 0)).where(
            Venta.fecha >= inicio_mes,
            Venta.estado != "anulado",
        )
    ).scalar()

    # Ventas de hoy
    ventas_hoy = db.execute(
        select(func.coalesce(func.sum(Venta.total), 0)).where(
            Venta.fecha == hoy,
            Venta.estado != "anulado",
        )
    ).scalar()

    # Cobros del mes
    cobros_mes = db.execute(
        select(func.coalesce(func.sum(Cobro.monto), 0)).where(
            Cobro.fecha >= inicio_mes
        )
    ).scalar()

    # Ventas pendientes de cobro
    ventas_pendientes = db.execute(
        select(func.count()).where(Venta.estado == "pendiente")
    ).scalar()

    # Turnos de hoy
    turnos_hoy = db.execute(
        select(func.count()).where(Turno.fecha == hoy)
    ).scalar()

    # Órdenes pendientes/en proceso
    ordenes_activas = db.execute(
        select(func.count()).where(
            OrdenTrabajo.estado.in_(["pendiente", "enviado", "en_proceso"])
        )
    ).scalar()

    # Órdenes listas (para entregar)
    ordenes_listas = db.execute(
        select(func.count()).where(OrdenTrabajo.estado == "listo")
    ).scalar()

    # Pacientes nuevos este mes
    pacientes_mes = db.execute(
        select(func.count()).where(
            func.date(Paciente.created_at) >= inicio_mes
        )
    ).scalar()

    # Egresos del mes
    egresos_mes = db.execute(
        select(func.coalesce(func.sum(Egreso.monto), 0)).where(
            Egreso.fecha >= inicio_mes
        )
    ).scalar()

    # Cantidad de ventas del mes
    cant_ventas_mes = db.execute(
        select(func.count()).where(
            Venta.fecha >= inicio_mes,
            Venta.estado != "anulado",
        )
    ).scalar()

    # Cuotas vencidas
    cuotas_vencidas_count = db.execute(
        select(func.count()).where(CuotaCredito.estado == "vencido")
    ).scalar()

    cuotas_vencidas_total = db.execute(
        select(func.coalesce(
            func.sum(CuotaCredito.monto - CuotaCredito.monto_pagado), 0
        )).where(CuotaCredito.estado == "vencido")
    ).scalar()

    # Stock bajo
    stock_bajo_count = db.execute(
        select(func.count()).where(
            Producto.activo.is_(True),
            Producto.stock_actual <= Producto.stock_minimo,
        )
    ).scalar()

    # Cobros de hoy
    cobros_hoy = db.execute(
        select(func.coalesce(func.sum(Cobro.monto), 0)).where(
            Cobro.fecha == hoy
        )
    ).scalar()

    return {
        "ventas_hoy": float(ventas_hoy),
        "ventas_mes": float(ventas_mes),
        "cobros_mes": float(cobros_mes),
        "egresos_mes": float(egresos_mes),
        "resultado_mes": float(cobros_mes) - float(egresos_mes),
        "cant_ventas_mes": int(cant_ventas_mes),
        "ventas_pendientes_cobro": int(ventas_pendientes),
        "turnos_hoy": int(turnos_hoy),
        "ordenes_activas": int(ordenes_activas),
        "ordenes_listas": int(ordenes_listas),
        "pacientes_nuevos_mes": int(pacientes_mes),
        "mes": inicio_mes.strftime("%B %Y"),
        "cuotas_vencidas_count": int(cuotas_vencidas_count),
        "cuotas_vencidas_total": float(cuotas_vencidas_total),
        "stock_bajo_count": int(stock_bajo_count),
        "cobros_hoy": float(cobros_hoy),
    }


# ── Reporte de Ventas ──────────────────────────────────────────────────────────

def _query_ventas(db: Session, desde: date | None, hasta: date | None):
    stmt = (
        select(
            Venta.id, Venta.numero, Venta.fecha, Venta.total,
            Venta.descuento, Venta.estado,
            Paciente.apellidos, Paciente.nombres, Paciente.cedula,
        )
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .where(Venta.estado != "anulado")
        .order_by(Venta.fecha.desc(), Venta.id.desc())
    )
    if desde:
        stmt = stmt.where(Venta.fecha >= desde)
    if hasta:
        stmt = stmt.where(Venta.fecha <= hasta)
    return db.execute(stmt).all()


@router.get("/ventas")
def reporte_ventas(
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = _query_ventas(db, desde, hasta)
    data = [
        {
            "id": r.id,
            "numero": r.numero,
            "fecha": r.fecha.isoformat(),
            "paciente": f"{r.apellidos or ''} {r.nombres or ''}".strip() or "—",
            "cedula": r.cedula or "—",
            "total": float(r.total),
            "descuento": float(r.descuento or 0),
            "estado": r.estado,
        }
        for r in rows
    ]
    total = sum(d["total"] for d in data)
    return {"filas": data, "total": total, "cantidad": len(data)}


@router.get("/ventas/excel")
def reporte_ventas_excel(
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = _query_ventas(db, desde, hasta)
    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas"

    cols = ["N° Venta", "Fecha", "Paciente", "Cédula", "Total", "Descuento", "Estado"]
    _header_row(ws, cols)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 28
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 12
    ws.column_dimensions["F"].width = 12
    ws.column_dimensions["G"].width = 12

    for r in rows:
        paciente = f"{r.apellidos or ''} {r.nombres or ''}".strip() or "—"
        ws.append([r.numero, r.fecha, paciente, r.cedula or "—",
                   float(r.total), float(r.descuento or 0), r.estado])

    # Totales
    last = ws.max_row
    ws.append(["", "", "", "TOTAL", f'=SUM(E2:E{last})', "", ""])
    total_row = ws.max_row
    for col in ["D", "E"]:
        ws[f"{col}{total_row}"].font = Font(bold=True)

    suffix = f"_{desde}_{hasta}" if desde or hasta else ""
    return _excel_response(wb, f"ventas{suffix}.xlsx")


# ── Reporte de Cobros ──────────────────────────────────────────────────────────

def _query_cobros(db: Session, desde: date | None, hasta: date | None):
    stmt = (
        select(
            Cobro.id, Cobro.numero, Cobro.fecha, Cobro.monto,
            Cobro.metodo_pago, Cobro.referencia,
            Paciente.apellidos, Paciente.nombres,
        )
        .outerjoin(Venta, Cobro.venta_id == Venta.id)
        .outerjoin(Paciente, Venta.paciente_id == Paciente.id)
        .order_by(Cobro.fecha.desc(), Cobro.id.desc())
    )
    if desde:
        stmt = stmt.where(Cobro.fecha >= desde)
    if hasta:
        stmt = stmt.where(Cobro.fecha <= hasta)
    return db.execute(stmt).all()


@router.get("/cobros")
def reporte_cobros(
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = _query_cobros(db, desde, hasta)
    data = [
        {
            "id": r.id,
            "numero": r.numero,
            "fecha": r.fecha.isoformat(),
            "paciente": f"{r.apellidos or ''} {r.nombres or ''}".strip() or "—",
            "monto": float(r.monto),
            "forma_pago": r.metodo_pago,
            "referencia": r.referencia or "",
        }
        for r in rows
    ]
    total = sum(d["monto"] for d in data)
    # Subtotales por forma de pago
    por_forma: dict[str, float] = {}
    for d in data:
        por_forma[d["forma_pago"]] = por_forma.get(d["forma_pago"], 0) + d["monto"]
    return {"filas": data, "total": total, "cantidad": len(data), "por_forma_pago": por_forma}


@router.get("/cobros/excel")
def reporte_cobros_excel(
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = _query_cobros(db, desde, hasta)
    wb = Workbook()
    ws = wb.active
    ws.title = "Cobros"

    cols = ["N° Cobro", "Fecha", "Paciente", "Monto", "Forma de Pago", "Referencia"]
    _header_row(ws, cols)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 28
    ws.column_dimensions["D"].width = 12
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 20

    for r in rows:
        paciente = f"{r.apellidos or ''} {r.nombres or ''}".strip() or "—"
        ws.append([r.numero, r.fecha, paciente, float(r.monto), r.metodo_pago, r.referencia or ""])

    last = ws.max_row
    ws.append(["", "", "TOTAL", f'=SUM(D2:D{last})', "", ""])
    total_row = ws.max_row
    for col in ["C", "D"]:
        ws[f"{col}{total_row}"].font = Font(bold=True)

    suffix = f"_{desde}_{hasta}" if desde or hasta else ""
    return _excel_response(wb, f"cobros{suffix}.xlsx")


# ── Reporte de Inventario ──────────────────────────────────────────────────────

@router.get("/inventario")
def reporte_inventario(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Producto).where(Producto.activo == True).order_by(Producto.nombre)
    ).scalars().all()

    data = [
        {
            "id": p.id,
            "codigo": p.codigo or "",
            "nombre": p.nombre,
            "categoria_id": p.categoria_id,
            "stock_actual": p.stock_actual,
            "stock_minimo": p.stock_minimo,
            "precio_venta": float(p.precio_venta),
            "precio_costo": float(p.precio_costo) if p.precio_costo else None,
            "alerta": p.stock_actual <= p.stock_minimo,
            "valor_inventario": float(p.precio_costo or p.precio_venta) * p.stock_actual,
        }
        for p in rows
    ]
    valor_total = sum(d["valor_inventario"] for d in data)
    alertas = sum(1 for d in data if d["alerta"])
    return {"filas": data, "valor_total": valor_total, "total_productos": len(data), "alertas_stock": alertas}


@router.get("/inventario/excel")
def reporte_inventario_excel(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Producto).where(Producto.activo == True).order_by(Producto.nombre)
    ).scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Inventario"

    cols = ["Código", "Nombre", "Stock actual", "Stock mínimo", "Precio venta", "Precio costo", "Valor inventario", "Alerta"]
    _header_row(ws, cols)
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 14
    ws.column_dimensions["G"].width = 18
    ws.column_dimensions["H"].width = 10

    alert_fill = PatternFill("solid", fgColor="FEE2E2")

    for p in rows:
        alerta = p.stock_actual <= p.stock_minimo
        valor = float(p.precio_costo or p.precio_venta) * p.stock_actual
        row_data = [
            p.codigo or "", p.nombre, p.stock_actual, p.stock_minimo,
            float(p.precio_venta),
            float(p.precio_costo) if p.precio_costo else "",
            valor,
            "⚠ Bajo stock" if alerta else "",
        ]
        ws.append(row_data)
        if alerta:
            for col in range(1, 9):
                ws.cell(ws.max_row, col).fill = alert_fill

    return _excel_response(wb, "inventario.xlsx")


# ── Reporte de Órdenes ─────────────────────────────────────────────────────────

@router.get("/ordenes")
def reporte_ordenes(
    desde: date | None = None,
    hasta: date | None = None,
    estado: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(
            OrdenTrabajo.id, OrdenTrabajo.numero, OrdenTrabajo.fecha_envio,
            OrdenTrabajo.fecha_entrega_est, OrdenTrabajo.fecha_entrega_real,
            OrdenTrabajo.estado, OrdenTrabajo.tipo, OrdenTrabajo.lab_proveedor,
            OrdenTrabajo.precio_lab,
            Paciente.apellidos, Paciente.nombres,
        )
        .join(Paciente, OrdenTrabajo.paciente_id == Paciente.id)
        .order_by(OrdenTrabajo.id.desc())
    )
    if desde:
        stmt = stmt.where(OrdenTrabajo.fecha_envio >= desde)
    if hasta:
        stmt = stmt.where(OrdenTrabajo.fecha_envio <= hasta)
    if estado:
        stmt = stmt.where(OrdenTrabajo.estado == estado)

    rows = db.execute(stmt).all()
    data = [
        {
            "numero": r.numero,
            "paciente": f"{r.apellidos} {r.nombres}",
            "lab_proveedor": r.lab_proveedor,
            "tipo": r.tipo,
            "fecha_envio": r.fecha_envio.isoformat(),
            "fecha_entrega_est": r.fecha_entrega_est.isoformat() if r.fecha_entrega_est else None,
            "fecha_entrega_real": r.fecha_entrega_real.isoformat() if r.fecha_entrega_real else None,
            "estado": r.estado,
            "precio_lab": float(r.precio_lab) if r.precio_lab else None,
        }
        for r in rows
    ]
    total_lab = sum(d["precio_lab"] for d in data if d["precio_lab"])
    return {"filas": data, "total_lab": total_lab, "cantidad": len(data)}


@router.get("/analytics")
def analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    hoy = date.today()
    result: dict = {
        "ventas_por_mes": [],
        "top_productos": [],
        "pacientes_por_origen": [],
        "cobros_por_metodo": [],
        "pacientes_por_mes": [],
        "ordenes_por_estado": [],
    }

    try:
        rows = db.execute(text("""
            SELECT to_char(fecha, 'YYYY-MM') AS mes,
                   SUM(total) AS total,
                   COUNT(*) AS cantidad
            FROM ventas
            WHERE estado != :estado AND fecha >= :desde
            GROUP BY to_char(fecha, 'YYYY-MM')
            ORDER BY 1
        """), {"estado": "anulado", "desde": hoy.replace(day=1) - timedelta(days=365)}).all()
        result["ventas_por_mes"] = [
            {"mes": r.mes, "total": float(r.total), "cantidad": int(r.cantidad)}
            for r in rows
        ]
    except Exception:
        db.rollback()

    try:
        rows = db.execute(
            select(
                VentaItem.descripcion,
                func.sum(VentaItem.cantidad).label("cantidad"),
                func.sum(VentaItem.subtotal).label("total"),
            )
            .group_by(VentaItem.descripcion)
            .order_by(func.sum(VentaItem.subtotal).desc())
            .limit(10)
        ).all()
        result["top_productos"] = [
            {"nombre": r.descripcion, "cantidad": float(r.cantidad), "total": float(r.total)}
            for r in rows
        ]
    except Exception:
        db.rollback()

    try:
        rows = db.execute(text("""
            SELECT COALESCE(origen, 'No especificado') AS origen,
                   COUNT(*) AS cantidad
            FROM pacientes
            GROUP BY COALESCE(origen, 'No especificado')
            ORDER BY COUNT(*) DESC
        """)).all()
        result["pacientes_por_origen"] = [
            {"origen": r.origen, "cantidad": int(r.cantidad)} for r in rows
        ]
    except Exception:
        db.rollback()

    try:
        rows = db.execute(
            select(
                Cobro.metodo_pago,
                func.sum(Cobro.monto).label("total"),
                func.count().label("cantidad"),
            )
            .where(Cobro.fecha >= hoy - timedelta(days=90))
            .group_by(Cobro.metodo_pago)
            .order_by(func.sum(Cobro.monto).desc())
        ).all()
        result["cobros_por_metodo"] = [
            {"metodo": r.metodo_pago, "total": float(r.total), "cantidad": int(r.cantidad)}
            for r in rows
        ]
    except Exception:
        db.rollback()

    try:
        rows = db.execute(text("""
            SELECT to_char(created_at, 'YYYY-MM') AS mes,
                   COUNT(*) AS cantidad
            FROM pacientes
            WHERE created_at >= :desde
            GROUP BY to_char(created_at, 'YYYY-MM')
            ORDER BY 1
        """), {"desde": hoy.replace(day=1) - timedelta(days=180)}).all()
        result["pacientes_por_mes"] = [
            {"mes": r.mes, "cantidad": int(r.cantidad)} for r in rows
        ]
    except Exception:
        db.rollback()

    try:
        rows = db.execute(
            select(
                OrdenTrabajo.estado,
                func.count().label("cantidad"),
            )
            .group_by(OrdenTrabajo.estado)
        ).all()
        result["ordenes_por_estado"] = [
            {"estado": r.estado, "cantidad": int(r.cantidad)} for r in rows
        ]
    except Exception:
        db.rollback()

    return result
