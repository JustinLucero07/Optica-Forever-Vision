import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.paciente import Paciente
from app.models.walog import WaLog
from app.models.user import User
from app.services import whatsapp

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class TextMsg(BaseModel):
    telefono: str
    mensaje: str


class TemplateMsg(BaseModel):
    telefono: str
    template: str
    lang: str = "es"
    components: list = []
    paciente_id: int | None = None


@router.post("/send-text")
def send_text(body: TextMsg, _: User = Depends(get_current_user)):
    try:
        result = whatsapp.send_text(body.telefono, body.mensaje)
        if result.get("skipped"):
            raise HTTPException(status_code=503, detail="WhatsApp no configurado — agrega WA_TOKEN y WA_PHONE_ID en el .env del servidor")
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/send-template")
def send_template(
    body: TemplateMsg,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    estado = "enviado"
    error_msg = None
    try:
        result = whatsapp.send_template(body.telefono, body.template, body.lang, body.components or None)
        if result.get("skipped"):
            raise HTTPException(status_code=503, detail="WhatsApp no configurado — agrega WA_TOKEN y WA_PHONE_ID en el .env del servidor")
    except HTTPException:
        raise
    except Exception as e:
        estado = "error"
        error_msg = str(e)
        raise HTTPException(status_code=502, detail=error_msg)
    finally:
        try:
            log = WaLog(
                paciente_id=body.paciente_id,
                telefono=body.telefono,
                template=body.template,
                estado=estado,
                error_msg=error_msg,
            )
            db.add(log)
            db.commit()
        except Exception:
            logger.warning("No se pudo guardar WaLog", exc_info=True)
            db.rollback()
    return {"ok": True}


@router.get("/logs")
def listar_logs(
    paciente_id: int | None = None,
    limite: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = (
        select(WaLog, Paciente)
        .outerjoin(Paciente, WaLog.paciente_id == Paciente.id)
        .order_by(WaLog.created_at.desc())
    )
    if paciente_id:
        stmt = stmt.where(WaLog.paciente_id == paciente_id)
    rows = db.execute(stmt.limit(limite)).all()
    return [
        {
            "id": log.id,
            "telefono": log.telefono,
            "template": log.template,
            "estado": log.estado,
            "error_msg": log.error_msg,
            "paciente_id": log.paciente_id,
            "paciente_nombre": f"{p.apellidos} {p.nombres}" if p else None,
            "created_at": log.created_at.isoformat(),
        }
        for log, p in rows
    ]
