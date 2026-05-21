"""
Importación de comprobantes electrónicos SRI (Ecuador).
Endpoints:
  POST /sri/importar-xml       → parsea XML, auto-matchea items con inventario, crea CxP
  POST /sri/mapear-items        → guarda/actualiza mapeos codigo_proveedor → producto_id
  GET  /sri/mapeos              → lista todos los mapeos existentes
"""
import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_roles
from app.models.cxp_item import CxPItem
from app.models.producto import Producto
from app.models.proveedor import Proveedor
from app.models.sri_map import ProveedorProductoMap
from app.models.tesoreria import CuentaPorPagar
from app.models.user import User

router = APIRouter(prefix="/sri", tags=["sri"])


def _txt(parent: ET.Element | None, path: str, default: str = "") -> str:
    if parent is None:
        return default
    el = parent.find(path)
    return el.text.strip() if el is not None and el.text else default


def _buscar_producto_por_codigo(db: Session, codigo: str) -> Producto | None:
    """Busca en inventario por código exacto."""
    if not codigo:
        return None
    return db.execute(
        select(Producto).where(Producto.codigo == codigo, Producto.activo.is_(True))
    ).scalar_one_or_none()


def _match_item(db: Session, codigo: str, descripcion: str, proveedor_id: int | None) -> dict:
    """Devuelve estado de matching para un item del XML."""
    # 1. Buscar en tabla de mapeos (proveedor específico primero, luego genérico)
    map_row = None
    if proveedor_id:
        map_row = db.execute(
            select(ProveedorProductoMap).where(
                ProveedorProductoMap.proveedor_id == proveedor_id,
                ProveedorProductoMap.codigo_proveedor == codigo,
            )
        ).scalar_one_or_none()
    if map_row is None and codigo:
        map_row = db.execute(
            select(ProveedorProductoMap).where(
                ProveedorProductoMap.proveedor_id.is_(None),
                ProveedorProductoMap.codigo_proveedor == codigo,
            )
        ).scalar_one_or_none()

    if map_row:
        prod = db.get(Producto, map_row.producto_id)
        if prod and prod.activo:
            return {
                "match": "mapeado",
                "producto_id": prod.id,
                "producto_nombre": prod.nombre,
                "producto_codigo": prod.codigo,
            }

    # 2. Buscar directamente por código en inventario
    prod = _buscar_producto_por_codigo(db, codigo)
    if prod:
        return {
            "match": "codigo_directo",
            "producto_id": prod.id,
            "producto_nombre": prod.nombre,
            "producto_codigo": prod.codigo,
        }

    # 3. Intento fuzzy por nombre (si descripción coincide con nombre de producto)
    if descripcion:
        prod = db.execute(
            select(Producto).where(
                Producto.activo.is_(True),
                or_(
                    Producto.nombre.ilike(f"%{descripcion[:30]}%"),
                    Producto.codigo.ilike(f"%{codigo}%") if codigo else Producto.nombre.ilike("%"),
                )
            ).limit(1)
        ).scalar_one_or_none()
        if prod:
            return {
                "match": "sugerido",
                "producto_id": prod.id,
                "producto_nombre": prod.nombre,
                "producto_codigo": prod.codigo,
            }

    return {"match": "sin_match", "producto_id": None, "producto_nombre": None, "producto_codigo": None}


@router.post("/importar-xml")
async def importar_xml(
    file: UploadFile = File(...),
    guardar: bool = True,
    orden_id: int | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero")),
):
    content = await file.read()
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise HTTPException(400, detail=f"XML inválido: {exc}")

    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag not in ("factura", "notaCredito", "notaDebito", "liquidacion"):
        raise HTTPException(400, detail="No es un comprobante SRI reconocido")

    info_trib = root.find("infoTributaria")
    info_fact = root.find("infoFactura") or root.find("infoNotaCredito") or root.find("infoLiquidacionCompra")
    detalles_el = root.find("detalles")

    if info_trib is None:
        raise HTTPException(400, detail="El XML no tiene <infoTributaria>")

    ruc          = _txt(info_trib, "ruc")
    razon_social = _txt(info_trib, "razonSocial")
    estab        = _txt(info_trib, "estab")
    pto_emi      = _txt(info_trib, "ptoEmi")
    secuencial   = _txt(info_trib, "secuencial")
    numero       = f"{estab}-{pto_emi}-{secuencial}"

    fecha_str = _txt(info_fact, "fechaEmision")
    try:
        fecha_emision = datetime.strptime(fecha_str, "%d/%m/%Y").date()
    except ValueError:
        fecha_emision = date.today()

    try:
        total_sin_imp = float(_txt(info_fact, "totalSinImpuestos", "0"))
    except ValueError:
        total_sin_imp = 0.0
    try:
        importe_total = float(_txt(info_fact, "importeTotal", "0"))
    except ValueError:
        importe_total = total_sin_imp

    iva = round(importe_total - total_sin_imp, 2)

    # Auto-match proveedor por RUC
    proveedor_match = None
    if ruc:
        proveedor_match = db.execute(
            select(Proveedor).where(Proveedor.ruc == ruc)
        ).scalar_one_or_none()
    proveedor_id = proveedor_match.id if proveedor_match else None

    # Parsear items y hacer matching con inventario
    items = []
    if detalles_el is not None:
        for det in detalles_el.findall("detalle"):
            try:
                cantidad = float(_txt(det, "cantidad", "0").replace(",", "."))
                precio   = float(_txt(det, "precioUnitario", "0").replace(",", "."))
                subtotal_item = float(_txt(det, "precioTotalSinImpuesto", str(cantidad * precio)).replace(",", "."))
            except ValueError:
                cantidad, precio, subtotal_item = 0, 0, 0

            codigo_prov = _txt(det, "codigoPrincipal")
            descripcion = _txt(det, "descripcion")
            match_info  = _match_item(db, codigo_prov, descripcion, proveedor_id)

            items.append({
                "codigo":          codigo_prov,
                "descripcion":     descripcion,
                "cantidad":        cantidad,
                "precio_unitario": precio,
                "subtotal":        subtotal_item,
                **match_info,
            })

    cxp_id = None
    if guardar:
        cxp = CuentaPorPagar(
            proveedor=razon_social if proveedor_match else f"{razon_social} (RUC {ruc})",
            concepto=f"Factura #{numero}",
            monto_total=importe_total,
            monto_pagado=0,
            fecha_emision=fecha_emision,
            referencia=numero,
            notas=f"Importado desde XML SRI. IVA: ${iva:.2f}",
            proveedor_id=proveedor_id,
            orden_id=orden_id,
        )
        db.add(cxp)
        db.flush()  # get cxp.id before commit
        for item in items:
            db.add(CxPItem(
                cxp_id=cxp.id,
                codigo_proveedor=item["codigo"] or None,
                descripcion=item["descripcion"] or "—",
                cantidad=item["cantidad"],
                precio_unitario=item["precio_unitario"],
                subtotal=item["subtotal"],
                producto_id=item.get("producto_id"),
            ))
        db.commit()
        db.refresh(cxp)
        cxp_id = cxp.id

    sin_match = sum(1 for i in items if i["match"] == "sin_match")
    con_match = len(items) - sin_match

    return {
        "cxp_id":           cxp_id,
        "proveedor":        razon_social,
        "proveedor_id":     proveedor_id,
        "proveedor_nombre": proveedor_match.nombre if proveedor_match else None,
        "ruc":              ruc,
        "numero":           numero,
        "fecha":            fecha_emision.isoformat(),
        "subtotal":         total_sin_imp,
        "iva":              iva,
        "total":            importe_total,
        "items":            items,
        "guardado":         guardar,
        "items_con_match":  con_match,
        "items_sin_match":  sin_match,
        "mensaje":          f"Factura {numero} — {con_match}/{len(items)} ítems vinculados al inventario"
                            + (f" — proveedor '{proveedor_match.nombre}'" if proveedor_match else ""),
    }


# ── Mapeos ─────────────────────────────────────────────────────────────────────

class MapeoItem(BaseModel):
    codigo_proveedor: str
    descripcion_proveedor: Optional[str] = None
    producto_id: int
    proveedor_id: Optional[int] = None


class GuardarMapeosIn(BaseModel):
    mapeos: list[MapeoItem]


@router.post("/mapear-items")
def guardar_mapeos(
    body: GuardarMapeosIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero")),
):
    """Guarda o actualiza mapeos codigo_proveedor → producto interno."""
    guardados = 0
    for m in body.mapeos:
        if not m.codigo_proveedor or not m.producto_id:
            continue
        # Verificar que el producto existe
        if not db.get(Producto, m.producto_id):
            continue

        existing = db.execute(
            select(ProveedorProductoMap).where(
                ProveedorProductoMap.proveedor_id == m.proveedor_id,
                ProveedorProductoMap.codigo_proveedor == m.codigo_proveedor,
            )
        ).scalar_one_or_none()

        if existing:
            existing.producto_id = m.producto_id
            if m.descripcion_proveedor:
                existing.descripcion_proveedor = m.descripcion_proveedor
        else:
            db.add(ProveedorProductoMap(
                proveedor_id=m.proveedor_id,
                codigo_proveedor=m.codigo_proveedor,
                descripcion_proveedor=m.descripcion_proveedor,
                producto_id=m.producto_id,
            ))
        guardados += 1

    db.commit()
    return {"guardados": guardados, "mensaje": f"{guardados} mapeo(s) guardados correctamente"}


@router.get("/mapeos")
def listar_mapeos(
    proveedor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista mapeos existentes, opcionalmente filtrados por proveedor."""
    stmt = select(ProveedorProductoMap)
    if proveedor_id is not None:
        stmt = stmt.where(ProveedorProductoMap.proveedor_id == proveedor_id)
    rows = db.execute(stmt.order_by(ProveedorProductoMap.id.desc())).scalars().all()

    result = []
    for r in rows:
        prod = db.get(Producto, r.producto_id)
        result.append({
            "id":                   r.id,
            "proveedor_id":         r.proveedor_id,
            "codigo_proveedor":     r.codigo_proveedor,
            "descripcion_proveedor": r.descripcion_proveedor,
            "producto_id":          r.producto_id,
            "producto_nombre":      prod.nombre if prod else None,
            "producto_codigo":      prod.codigo if prod else None,
        })
    return result


@router.delete("/mapeos/{map_id}", status_code=204)
def eliminar_mapeo(
    map_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "cajero")),
):
    row = db.get(ProveedorProductoMap, map_id)
    if not row:
        raise HTTPException(404, detail="Mapeo no encontrado")
    db.delete(row)
    db.commit()
