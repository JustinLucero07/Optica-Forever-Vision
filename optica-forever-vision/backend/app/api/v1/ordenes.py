import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.numeradores import siguiente_numero
from app.models.agenda import OrdenTrabajo
from app.models.producto import Producto
from app.models.user import User
from app.schemas.agenda import OrdenCreate, OrdenOut, OrdenUpdate

router = APIRouter(prefix="/ordenes", tags=["ordenes"])


@router.get("", response_model=list[OrdenOut])
def listar_ordenes(
    paciente_id: int | None = None,
    estado: str | None = None,
    venta_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(OrdenTrabajo).order_by(OrdenTrabajo.id.desc())
    if paciente_id:
        stmt = stmt.where(OrdenTrabajo.paciente_id == paciente_id)
    if estado:
        stmt = stmt.where(OrdenTrabajo.estado == estado)
    if venta_id:
        stmt = stmt.where(OrdenTrabajo.venta_id == venta_id)
    return db.execute(stmt.offset(skip).limit(limit)).scalars().all()


@router.get("/count")
def contar_ordenes(
    excluir_estados: str | None = None,
    es_proforma: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(func.count()).select_from(OrdenTrabajo)
    if excluir_estados:
        for s in excluir_estados.split(","):
            stmt = stmt.where(OrdenTrabajo.estado != s.strip())
    if es_proforma is not None:
        stmt = stmt.where(OrdenTrabajo.es_proforma == es_proforma)
    return {"total": db.execute(stmt).scalar_one()}


@router.post("", response_model=OrdenOut, status_code=status.HTTP_201_CREATED)
def crear_orden(
    body: OrdenCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    numero = siguiente_numero(db, "numerador_orden", "ORD", largo=5)
    data = body.model_dump()
    producto_id = data.get("producto_id")  # keep in data so it's stored in DB
    orden = OrdenTrabajo(**data, numero=numero)
    db.add(orden)

    if producto_id and body.lab_proveedor == "Stock propio":
        prod = db.get(Producto, producto_id)
        if prod:
            if prod.stock_actual <= 0:
                raise HTTPException(status_code=422, detail=f"Sin stock disponible para '{prod.nombre}'")
            prod.stock_actual = prod.stock_actual - 1

    db.commit()
    db.refresh(orden)
    return orden


@router.get("/{orden_id}", response_model=OrdenOut)
def obtener_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.put("/{orden_id}", response_model=OrdenOut)
def actualizar_orden(
    orden_id: int,
    body: OrdenUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(orden, k, v)
    db.commit()
    db.refresh(orden)
    return orden


@router.delete("/{orden_id}", status_code=204)
def eliminar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if orden.venta_id:
        raise HTTPException(status_code=409, detail="No se puede eliminar una orden ya facturada")

    # Reponer stock si fue tomado de inventario propio
    if orden.lab_proveedor == "Stock propio" and orden.producto_id:
        prod = db.get(Producto, orden.producto_id)
        if prod:
            prod.stock_actual = prod.stock_actual + 1

    db.delete(orden)
    db.commit()


@router.patch("/{orden_id}/estado", response_model=OrdenOut)
def cambiar_estado(
    orden_id: int,
    estado: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ESTADOS = {"pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"}
    if estado not in ESTADOS:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Opciones: {ESTADOS}")
    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    orden.estado = estado
    db.commit()
    db.refresh(orden)

    # WhatsApp al paciente cuando la orden está lista para retirar
    if estado == "listo" and orden.paciente_id:
        try:
            from app.services import whatsapp
            from app.models.paciente import Paciente
            pac = db.get(Paciente, orden.paciente_id)
            if pac and pac.telefono:
                whatsapp.send_template(
                    pac.telefono,
                    settings.WA_ORDEN_TEMPLATE,
                    settings.WA_ORDEN_LANG,
                    components=[{"type": "body", "parameters": [
                        {"type": "text", "text": pac.nombres},
                        {"type": "text", "text": orden.numero},
                    ]}],
                )
        except Exception as exc:
            logger.warning("WhatsApp orden lista: %s", exc)

    return orden


@router.post("/{orden_id}/whatsapp-lab", status_code=200)
def enviar_whatsapp_lab(
    orden_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Envía los detalles de la orden al WhatsApp del laboratorio via Cloud API."""
    from app.services import whatsapp
    from app.models.paciente import Paciente
    import re

    orden = db.get(OrdenTrabajo, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if not orden.lab_telefono:
        raise HTTPException(status_code=422, detail="La orden no tiene teléfono de laboratorio")

    pac = db.get(Paciente, orden.paciente_id) if orden.paciente_id else None
    pac_nombre = f"{pac.apellidos} {pac.nombres}".strip() if pac else f"Paciente #{orden.paciente_id}"

    def fmtRxLine(text: str) -> str:
        parts = []
        for m in re.finditer(r'(esf|cil|eje|add|dnp|prisma|dp)[\s:]+([+-]?\d+(?:[.,]\d+)?)', text, re.I):
            lbl = m.group(1).upper()
            raw = m.group(2)
            try:
                n = float(raw.replace(",", "."))
                val = (f"+{n:.2f}" if n >= 0 else f"{n:.2f}") if lbl not in ("EJE", "DNP", "PRISMA", "DP") else raw
            except ValueError:
                val = raw
            parts.append(f"{lbl}: {val}")
        return "  ".join(parts)

    rx_lines: list[str] = []
    for ln in [l.strip() for l in (orden.descripcion or "").splitlines() if l.strip()]:
        ll = ln.lower()
        if ll.startswith("od:"):
            rx_lines.append(f"OD ▸ {fmtRxLine(ln)}")
        elif ll.startswith("oi:"):
            rx_lines.append(f"OI ▸ {fmtRxLine(ln)}")
        elif ll.startswith(("material:", "tratamiento:", "diseño:", "diagnóstico:", "dp:")):
            rx_lines.append(f"  {ln}")

    armazon_parts = []
    if orden.armazon_ref: armazon_parts.append(f"Ref: {orden.armazon_ref}")
    if orden.armazon_color: armazon_parts.append(f"Color: {orden.armazon_color}")
    if orden.armazon_talla: armazon_parts.append(f"Talla: {orden.armazon_talla}")

    msg_parts = [
        f"*ORDEN DE TRABAJO — {orden.numero}*",
        "Óptica Forever Vision",
        "",
        f"*Paciente:* {pac_nombre}",
        f"*Tipo:* {orden.tipo}",
        f"*Fecha envío:* {orden.fecha_envio.strftime('%d/%m/%Y')}",
    ]
    if orden.fecha_entrega_est:
        msg_parts.append(f"*Entrega estimada:* {orden.fecha_entrega_est.strftime('%d/%m/%Y')}")
    msg_parts += ["", "*PRESCRIPCIÓN*"] + rx_lines
    if armazon_parts:
        msg_parts += ["", f"*Armazón:* {' | '.join(armazon_parts)}"]
    if orden.notas:
        msg_parts += ["", f"*Observaciones:* {orden.notas}"]
    if orden.precio_lab:
        msg_parts.append(f"*Precio lab acordado:* ${float(orden.precio_lab):.2f}")
    msg_parts += ["", "Por favor confirmar recepción. Gracias 🙏"]

    try:
        result = whatsapp.send_text(orden.lab_telefono, "\n".join(msg_parts))
        if orden.estado == "pendiente":
            orden.estado = "enviado"
            db.commit()
        return {"ok": True, "wa_result": result}
    except Exception as exc:
        logger.error("Error WhatsApp lab %s: %s", orden_id, exc)
        raise HTTPException(status_code=502, detail=f"Error enviando WhatsApp: {exc}")
