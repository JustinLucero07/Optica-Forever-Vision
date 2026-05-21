import logging
from datetime import date, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import SLOWAPI_AVAILABLE, limiter

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

# Rate limiter (activo solo si slowapi está instalado)
if SLOWAPI_AVAILABLE:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Cron jobs ──────────────────────────────────────────────────────────────────

def _run_birthday_job() -> None:
    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.models.paciente import Paciente
    from app.services import whatsapp

    hoy = date.today()
    db = SessionLocal()
    try:
        pacientes = db.execute(
            select(Paciente).where(
                Paciente.fecha_nacimiento.isnot(None),
                Paciente.telefono.isnot(None),
            )
        ).scalars().all()

        enviados = 0
        for p in pacientes:
            fn = p.fecha_nacimiento
            if fn and fn.month == hoy.month and fn.day == hoy.day:
                try:
                    whatsapp.send_template(
                        p.telefono,
                        settings.WA_BIRTHDAY_TEMPLATE,
                        settings.WA_BIRTHDAY_LANG,
                        components=[{
                            "type": "body",
                            "parameters": [{"type": "text", "text": p.nombres}],
                        }],
                    )
                    enviados += 1
                    logger.info("Cumpleaños enviado a %s %s", p.nombres, p.apellidos)
                except Exception as exc:
                    logger.error("Error WhatsApp cumpleaños %s %s: %s", p.nombres, p.apellidos, exc)
        logger.info("Cron cumpleaños: %d enviado(s)", enviados)
    finally:
        db.close()


def _run_cuotas_job() -> None:
    """Send WhatsApp reminders for cuotas due in the next 3 days and mark overdue ones."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.core.db import SessionLocal
    from app.models.credito import Credito, CuotaCredito
    from app.models.paciente import Paciente
    from app.services import whatsapp

    hoy = date.today()
    en_3_dias = hoy + timedelta(days=3)
    db = SessionLocal()
    try:
        # Mark overdue cuotas
        cuotas_vencidas = db.execute(
            select(CuotaCredito).where(
                CuotaCredito.estado == "pendiente",
                CuotaCredito.fecha_vencimiento < hoy,
            )
        ).scalars().all()
        for q in cuotas_vencidas:
            q.estado = "vencido"

        # Send reminders for cuotas due in 3 days (not yet reminded)
        cuotas_proximas = db.execute(
            select(CuotaCredito)
            .where(
                CuotaCredito.estado == "pendiente",
                CuotaCredito.fecha_vencimiento <= en_3_dias,
                CuotaCredito.fecha_vencimiento >= hoy,
                CuotaCredito.recordatorio_enviado.is_(False),
            )
        ).scalars().all()

        for q in cuotas_proximas:
            credito = db.execute(
                select(Credito).where(Credito.id == q.credito_id)
            ).scalar_one_or_none()
            if not credito or not credito.paciente_id:
                continue
            paciente = db.get(Paciente, credito.paciente_id)
            if not paciente or not paciente.telefono:
                continue
            try:
                monto = float(q.monto) - float(q.monto_pagado)
                dias_restantes = (q.fecha_vencimiento - hoy).days
                texto = (
                    f"Hola {paciente.nombres} 👋, le recordamos que su cuota "
                    f"{q.numero_cuota}/{credito.numero_cuotas} del crédito *{credito.numero}* "
                    f"por *${monto:.2f}* vence el *{q.fecha_vencimiento.strftime('%d/%m/%Y')}* "
                    f"({'hoy' if dias_restantes == 0 else f'en {dias_restantes} día(s)'}).\n\n"
                    f"Óptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca."
                )
                whatsapp.send_text(paciente.telefono, texto)
                q.recordatorio_enviado = True
                logger.info("Recordatorio cuota enviado a %s %s", paciente.nombres, paciente.apellidos)
            except Exception as exc:
                logger.error("Error recordatorio cuota %s: %s", q.id, exc)

        db.commit()
        logger.info("Cron cuotas: %d vencidas marcadas, %d recordatorios enviados",
                    len(cuotas_vencidas), len(cuotas_proximas))
    finally:
        db.close()


@app.on_event("startup")
def startup_scheduler() -> None:
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            _run_birthday_job,
            CronTrigger(hour=9, minute=0),
            id="cumpleanos_diario",
            replace_existing=True,
        )
        scheduler.add_job(
            _run_cuotas_job,
            CronTrigger(hour=8, minute=30),
            id="recordatorio_cuotas",
            replace_existing=True,
        )
        scheduler.start()
        app.state.scheduler = scheduler
        logger.info("APScheduler iniciado — cumpleaños 09:00, cuotas 08:30")
    except ImportError:
        logger.warning("APScheduler no instalado — crons deshabilitados")


@app.on_event("shutdown")
def shutdown_scheduler() -> None:
    scheduler = getattr(app.state, "scheduler", None)
    if scheduler:
        scheduler.shutdown(wait=False)
