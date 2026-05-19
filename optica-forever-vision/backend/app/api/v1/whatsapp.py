from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.services import whatsapp

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


class TextMsg(BaseModel):
    telefono: str
    mensaje: str


class TemplateMsg(BaseModel):
    telefono: str
    template: str
    lang: str = "es"
    components: list = []


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
def send_template(body: TemplateMsg, _: User = Depends(get_current_user)):
    try:
        result = whatsapp.send_template(body.telefono, body.template, body.lang, body.components or None)
        if result.get("skipped"):
            raise HTTPException(status_code=503, detail="WhatsApp no configurado — agrega WA_TOKEN y WA_PHONE_ID en el .env del servidor")
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
