"""
Importación de comprobantes electrónicos SRI (Ecuador).
Endpoint:
  POST /sri/importar-xml  → sube XML de factura de proveedor, retorna datos parseados y crea CxP
"""
import xml.etree.ElementTree as ET
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_roles
from app.models.tesoreria import CuentaPorPagar
from app.models.user import User

router = APIRouter(prefix="/sri", tags=["sri"])


def _txt(parent: ET.Element | None, path: str, default: str = "") -> str:
    if parent is None:
        return default
    el = parent.find(path)
    return el.text.strip() if el is not None and el.text else default


@router.post("/importar-xml")
async def importar_xml(
    file: UploadFile = File(...),
    guardar: bool = True,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("admin", "cajero")),
):
    content = await file.read()
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise HTTPException(400, detail=f"XML inválido: {exc}")

    # Soporta facturas con o sin namespace
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag not in ("factura", "notaCredito", "notaDebito", "liquidacion"):
        raise HTTPException(400, detail="No es un comprobante SRI reconocido (debe ser factura, nota de crédito, etc.)")

    info_trib = root.find("infoTributaria")
    info_fact = root.find("infoFactura") or root.find("infoNotaCredito") or root.find("infoLiquidacionCompra")
    detalles_el = root.find("detalles")

    if info_trib is None:
        raise HTTPException(400, detail="El XML no tiene <infoTributaria> — no es un comprobante SRI válido")

    ruc           = _txt(info_trib, "ruc")
    razon_social  = _txt(info_trib, "razonSocial")
    estab         = _txt(info_trib, "estab")
    pto_emi       = _txt(info_trib, "ptoEmi")
    secuencial    = _txt(info_trib, "secuencial")
    numero        = f"{estab}-{pto_emi}-{secuencial}"

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

    # Extraer IVA
    iva = round(importe_total - total_sin_imp, 2)

    # Detalles
    items = []
    if detalles_el is not None:
        for det in detalles_el.findall("detalle"):
            try:
                cantidad = float(_txt(det, "cantidad", "0").replace(",", "."))
                precio   = float(_txt(det, "precioUnitario", "0").replace(",", "."))
                subtotal_item = float(_txt(det, "precioTotalSinImpuesto", str(cantidad * precio)).replace(",", "."))
            except ValueError:
                cantidad, precio, subtotal_item = 0, 0, 0
            items.append({
                "codigo":      _txt(det, "codigoPrincipal"),
                "descripcion": _txt(det, "descripcion"),
                "cantidad":    cantidad,
                "precio_unitario": precio,
                "subtotal":    subtotal_item,
            })

    cxp_id = None
    if guardar:
        cxp = CuentaPorPagar(
            proveedor=f"{razon_social} (RUC {ruc})",
            concepto=f"Factura #{numero}",
            monto_total=importe_total,
            monto_pagado=0,
            fecha_emision=fecha_emision,
            referencia=numero,
            notas=f"Importado desde XML SRI. IVA: ${iva:.2f}",
        )
        db.add(cxp)
        db.commit()
        db.refresh(cxp)
        cxp_id = cxp.id

    return {
        "cxp_id":       cxp_id,
        "proveedor":    razon_social,
        "ruc":          ruc,
        "numero":       numero,
        "fecha":        fecha_emision.isoformat(),
        "subtotal":     total_sin_imp,
        "iva":          iva,
        "total":        importe_total,
        "items":        items,
        "guardado":     guardar,
        "mensaje":      f"Factura {numero} de {razon_social} {'importada' if guardar else 'procesada'} correctamente",
    }
