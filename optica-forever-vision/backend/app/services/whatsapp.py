import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_WA_BASE = "https://graph.facebook.com/v25.0"


def _fmt_phone(telefono: str) -> str:
    digits = "".join(c for c in telefono if c.isdigit())
    if digits.startswith("593"):
        return digits
    if digits.startswith("0"):
        return "593" + digits[1:]
    return "593" + digits


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.WA_TOKEN}", "Content-Type": "application/json"}


def _configured() -> bool:
    return bool(settings.WA_TOKEN and settings.WA_PHONE_ID)


def send_text(telefono: str, texto: str) -> dict:
    """Send a free-form text message (only within 24h customer-initiated window)."""
    if not _configured():
        logger.warning("WhatsApp not configured — WA_TOKEN or WA_PHONE_ID missing")
        return {"skipped": True}

    payload = {
        "messaging_product": "whatsapp",
        "to": _fmt_phone(telefono),
        "type": "text",
        "text": {"body": texto, "preview_url": False},
    }
    r = httpx.post(f"{_WA_BASE}/{settings.WA_PHONE_ID}/messages", json=payload, headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()


def send_template(telefono: str, template_name: str, lang: str = "es", components: list | None = None) -> dict:
    """Send a pre-approved template message (works for outbound / bulk sends)."""
    if not _configured():
        logger.warning("WhatsApp not configured — WA_TOKEN or WA_PHONE_ID missing")
        return {"skipped": True}

    tmpl: dict = {"name": template_name, "language": {"code": lang}}
    if components:
        tmpl["components"] = components

    payload = {
        "messaging_product": "whatsapp",
        "to": _fmt_phone(telefono),
        "type": "template",
        "template": tmpl,
    }
    r = httpx.post(f"{_WA_BASE}/{settings.WA_PHONE_ID}/messages", json=payload, headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()
