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
                whatsapp.send_template(
                    paciente.telefono,
                    settings.WA_CUOTA_TEMPLATE,
                    settings.WA_CUOTA_LANG,
                    components=[{"type": "body", "parameters": [
                        {"type": "text", "text": paciente.nombres},
                        {"type": "text", "text": str(q.numero_cuota)},
                        {"type": "text", "text": str(credito.numero_cuotas)},
                        {"type": "text", "text": credito.numero},
                        {"type": "text", "text": f"{monto:.2f}"},
                        {"type": "text", "text": q.fecha_vencimiento.strftime("%d/%m/%Y")},
                    ]}],
                )
                q.recordatorio_enviado = True
                logger.info("Recordatorio cuota enviado a %s %s", paciente.nombres, paciente.apellidos)
            except Exception as exc:
                logger.error("Error recordatorio cuota %s: %s", q.id, exc)

        db.commit()
        logger.info("Cron cuotas: %d vencidas marcadas, %d recordatorios enviados",
                    len(cuotas_vencidas), len(cuotas_proximas))
    finally:
        db.close()


def _run_turnos_job() -> None:
    """Envía recordatorio WhatsApp a pacientes con turno mañana."""
    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.models.agenda import Turno
    from app.models.paciente import Paciente
    from app.services import whatsapp

    manana = date.today() + timedelta(days=1)
    db = SessionLocal()
    try:
        turnos = db.execute(
            select(Turno).where(
                Turno.fecha == manana,
                Turno.estado.in_(["pendiente", "confirmado"]),
                Turno.paciente_id.isnot(None),
            )
        ).scalars().all()

        enviados = 0
        for t in turnos:
            paciente = db.get(Paciente, t.paciente_id)
            if not paciente or not paciente.telefono:
                continue
            try:
                hora_str = t.hora_inicio.strftime("%H:%M")
                whatsapp.send_template(
                    paciente.telefono,
                    settings.WA_TURNO_TEMPLATE,
                    settings.WA_TURNO_LANG,
                    components=[{"type": "body", "parameters": [
                        {"type": "text", "text": paciente.nombres},
                        {"type": "text", "text": manana.strftime("%d/%m/%Y")},
                        {"type": "text", "text": hora_str},
                        {"type": "text", "text": t.motivo or "Consulta"},
                    ]}],
                )
                enviados += 1
                logger.info("Recordatorio turno enviado a %s %s", paciente.nombres, paciente.apellidos)
            except Exception as exc:
                logger.error("Error recordatorio turno %s: %s", t.id, exc)

        logger.info("Cron turnos: %d recordatorio(s) enviados para %s", enviados, manana)
    finally:
        db.close()


def _get_config_valor(db, clave: str) -> str | None:
    """Lee un valor de la tabla configuraciones."""
    from sqlalchemy import select
    from app.models.configuracion import Configuracion
    row = db.execute(select(Configuracion).where(Configuracion.clave == clave)).scalar_one_or_none()
    return row.valor if row else None


def _run_stock_bajo_job() -> None:
    """Alerta de stock bajo al admin — diario 09:30."""
    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.models.producto import Producto
    from app.services import whatsapp

    db = SessionLocal()
    try:
        admin_phone = _get_config_valor(db, "admin_phone")
        if not admin_phone:
            return

        bajos = db.execute(
            select(Producto).where(
                Producto.activo.is_(True),
                Producto.stock_actual <= Producto.stock_minimo,
            )
        ).scalars().all()

        if not bajos:
            return

        lista = "\n".join(
            f"• {p.nombre}: {int(p.stock_actual)} (mín: {int(p.stock_minimo)})"
            for p in bajos[:10]
        )
        extra = f"\n...y {len(bajos) - 10} más." if len(bajos) > 10 else ""
        whatsapp.send_template(
            admin_phone,
            settings.WA_STOCK_TEMPLATE,
            settings.WA_STOCK_LANG,
            components=[{"type": "body", "parameters": [
                {"type": "text", "text": str(len(bajos))},
                {"type": "text", "text": lista + extra},
            ]}],
        )
        logger.info("Cron stock bajo: alerta enviada (%d productos)", len(bajos))
    except Exception as exc:
        logger.error("Error cron stock bajo: %s", exc)
    finally:
        db.close()


def _run_weekly_summary_job() -> None:
    """Resumen semanal de ventas y cobros al admin — lunes 08:00."""
    from sqlalchemy import select, func
    from app.core.db import SessionLocal
    from app.models.venta import Venta
    from app.models.tesoreria import Cobro
    from app.services import whatsapp

    hoy          = date.today()
    inicio       = hoy - timedelta(days=7)
    db           = SessionLocal()
    try:
        admin_phone = _get_config_valor(db, "admin_phone")
        if not admin_phone:
            return

        total_ventas = float(db.execute(
            select(func.coalesce(func.sum(Venta.total), 0)).where(
                Venta.fecha >= inicio, Venta.estado != "anulado"
            )
        ).scalar_one())

        cant_ventas = db.execute(
            select(func.count(Venta.id)).where(
                Venta.fecha >= inicio, Venta.estado != "anulado"
            )
        ).scalar_one()

        total_cobros = float(db.execute(
            select(func.coalesce(func.sum(Cobro.monto), 0)).where(Cobro.fecha >= inicio)
        ).scalar_one())

        whatsapp.send_template(
            admin_phone,
            settings.WA_SEMANAL_TEMPLATE,
            settings.WA_SEMANAL_LANG,
            components=[{"type": "body", "parameters": [
                {"type": "text", "text": inicio.strftime("%d/%m")},
                {"type": "text", "text": hoy.strftime("%d/%m/%Y")},
                {"type": "text", "text": str(cant_ventas)},
                {"type": "text", "text": f"{total_ventas:.2f}"},
                {"type": "text", "text": f"{total_cobros:.2f}"},
            ]}],
        )
        logger.info("Cron resumen semanal enviado")
    except Exception as exc:
        logger.error("Error cron weekly summary: %s", exc)
    finally:
        db.close()


def _run_monthly_email_job() -> None:
    """Reporte mensual por email al admin — día 1 del mes, 09:00."""
    from sqlalchemy import select, func
    from app.core.db import SessionLocal
    from app.models.venta import Venta
    from app.models.tesoreria import Cobro, Egreso
    from app.models.paciente import Paciente
    from app.core.mailer import send_email

    hoy    = date.today()
    # Primer y último día del mes anterior
    primer_dia = date(hoy.year if hoy.month > 1 else hoy.year - 1,
                      hoy.month - 1 if hoy.month > 1 else 12, 1)
    if hoy.month > 1:
        ultimo_dia = date(hoy.year, hoy.month, 1) - timedelta(days=1)
    else:
        ultimo_dia = date(hoy.year - 1, 12, 31)

    nombre_mes = primer_dia.strftime("%B %Y").capitalize()

    db = SessionLocal()
    try:
        email_admin = _get_config_valor(db, "email_admin")
        nombre_optica = _get_config_valor(db, "nombre_optica") or "Óptica Forever Vision"
        if not email_admin:
            return

        total_ventas = float(db.execute(
            select(func.coalesce(func.sum(Venta.total), 0)).where(
                Venta.fecha >= primer_dia, Venta.fecha <= ultimo_dia, Venta.estado != "anulado"
            )
        ).scalar_one())
        cant_ventas = db.execute(
            select(func.count(Venta.id)).where(
                Venta.fecha >= primer_dia, Venta.fecha <= ultimo_dia, Venta.estado != "anulado"
            )
        ).scalar_one()
        total_cobros = float(db.execute(
            select(func.coalesce(func.sum(Cobro.monto), 0)).where(
                Cobro.fecha >= primer_dia, Cobro.fecha <= ultimo_dia
            )
        ).scalar_one())
        total_egresos = float(db.execute(
            select(func.coalesce(func.sum(Egreso.monto), 0)).where(
                Egreso.fecha >= primer_dia, Egreso.fecha <= ultimo_dia
            )
        ).scalar_one())
        nuevos_pac = db.execute(
            select(func.count(Paciente.id)).where(
                Paciente.created_at >= primer_dia,  # type: ignore
                Paciente.created_at <= ultimo_dia,  # type: ignore
            )
        ).scalar_one()

        resultado = total_cobros - total_egresos
        color_res = "#059669" if resultado >= 0 else "#ef4444"

        html = f"""
        <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1a1a1a">
        <div style="background:#0d9ead;padding:24px;text-align:center;border-radius:12px 12px 0 0">
            <h1 style="color:white;margin:0;font-size:22px">📊 Reporte Mensual</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0">{nombre_optica} · {nombre_mes}</p>
        </div>
        <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none">
            <table style="width:100%;border-collapse:collapse">
                <tr>
                    <td style="padding:14px;background:white;border-radius:8px;text-align:center;width:25%">
                        <p style="margin:0;color:#6b7280;font-size:12px">Ventas</p>
                        <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#3b82f6">${total_ventas:.2f}</p>
                        <p style="margin:2px 0 0;font-size:11px;color:#9ca3af">{cant_ventas} ventas</p>
                    </td>
                    <td style="width:2%"></td>
                    <td style="padding:14px;background:white;border-radius:8px;text-align:center;width:25%">
                        <p style="margin:0;color:#6b7280;font-size:12px">Cobros</p>
                        <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#059669">${total_cobros:.2f}</p>
                    </td>
                    <td style="width:2%"></td>
                    <td style="padding:14px;background:white;border-radius:8px;text-align:center;width:25%">
                        <p style="margin:0;color:#6b7280;font-size:12px">Egresos</p>
                        <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#ef4444">${total_egresos:.2f}</p>
                    </td>
                    <td style="width:2%"></td>
                    <td style="padding:14px;background:white;border-radius:8px;text-align:center;width:25%">
                        <p style="margin:0;color:#6b7280;font-size:12px">Resultado</p>
                        <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:{color_res}">${resultado:.2f}</p>
                    </td>
                </tr>
            </table>
            <p style="margin:20px 0 4px;color:#6b7280;font-size:13px">
                Pacientes nuevos: <strong>{nuevos_pac}</strong>
            </p>
        </div>
        <div style="background:#f3f4f6;padding:16px;text-align:center;border-radius:0 0 12px 12px;font-size:11px;color:#9ca3af">
            Generado automáticamente por el sistema de Óptica Forever Vision ·
            {date.today().strftime("%d/%m/%Y")}
        </div>
        </body></html>
        """
        send_email(
            to_email=email_admin,
            subject=f"Reporte Mensual {nombre_mes} — {nombre_optica}",
            html_body=html,
        )
        logger.info("Cron reporte mensual enviado a %s", email_admin)
    except Exception as exc:
        logger.error("Error cron reporte mensual: %s", exc)
    finally:
        db.close()


def _run_control_visual_job() -> None:
    """Recordatorio de próximo control visual — diario 08:15.

    Busca consultas con proximo_control == hoy + CONTROL_REMINDER_DAYS y envía
    un WhatsApp al paciente. Como la lógica usa la fecha exacta, cada paciente
    recibe el mensaje una sola vez (no hace falta campo de seguimiento).
    """
    from sqlalchemy import select
    from app.core.db import SessionLocal
    from app.models.consulta import Consulta
    from app.models.paciente import Paciente
    from app.services import whatsapp

    fecha_objetivo = date.today() + timedelta(days=settings.CONTROL_REMINDER_DAYS)
    db = SessionLocal()
    try:
        consultas = db.execute(
            select(Consulta).where(
                Consulta.proximo_control == fecha_objetivo,
                Consulta.paciente_id.isnot(None),
            )
        ).scalars().all()

        # Si un paciente tiene varias consultas en esa fecha, usar la más reciente
        pac_map: dict[int, Consulta] = {}
        for c in consultas:
            if c.paciente_id not in pac_map or c.fecha > pac_map[c.paciente_id].fecha:
                pac_map[c.paciente_id] = c

        enviados = 0
        for pac_id, consulta in pac_map.items():
            paciente = db.get(Paciente, pac_id)
            if not paciente or not paciente.telefono:
                continue
            try:
                fecha_str = consulta.proximo_control.strftime("%d/%m/%Y")
                whatsapp.send_template(
                    paciente.telefono,
                    settings.WA_CONTROL_TEMPLATE,
                    settings.WA_CONTROL_LANG,
                    components=[{"type": "body", "parameters": [
                        {"type": "text", "text": paciente.nombres},
                        {"type": "text", "text": fecha_str},
                    ]}],
                )
                enviados += 1
                logger.info(
                    "Recordatorio control visual enviado a %s %s (fecha: %s)",
                    paciente.nombres, paciente.apellidos, fecha_str,
                )
            except Exception as exc:
                logger.error("Error recordatorio control visual pac_id=%s: %s", pac_id, exc)

        logger.info(
            "Cron control visual: %d recordatorio(s) para controles del %s",
            enviados, fecha_objetivo,
        )
    finally:
        db.close()


@app.on_event("startup")
def startup_scheduler() -> None:
    if not settings.SCHEDULER_ENABLED:
        logger.info("SCHEDULER_ENABLED=false — crons deshabilitados en este worker")
        return
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
        scheduler.add_job(
            _run_turnos_job,
            CronTrigger(hour=7, minute=0),
            id="recordatorio_turnos",
            replace_existing=True,
        )
        scheduler.add_job(
            _run_stock_bajo_job,
            CronTrigger(hour=9, minute=30),
            id="alerta_stock_bajo",
            replace_existing=True,
        )
        scheduler.add_job(
            _run_weekly_summary_job,
            CronTrigger(day_of_week="mon", hour=8, minute=0),
            id="resumen_semanal",
            replace_existing=True,
        )
        scheduler.add_job(
            _run_monthly_email_job,
            CronTrigger(day=1, hour=9, minute=0),
            id="reporte_mensual_email",
            replace_existing=True,
        )
        scheduler.add_job(
            _run_control_visual_job,
            CronTrigger(hour=8, minute=15),
            id="recordatorio_control_visual",
            replace_existing=True,
        )
        scheduler.start()
        app.state.scheduler = scheduler
        logger.info(
            "APScheduler iniciado — cumpleaños 09:00, cuotas 08:30, turnos 07:00, "
            "stock 09:30, resumen lunes 08:00, reporte mensual día 1 09:00, "
            "control visual 08:15"
        )
    except ImportError:
        logger.warning("APScheduler no instalado — crons deshabilitados")


@app.on_event("shutdown")
def shutdown_scheduler() -> None:
    scheduler = getattr(app.state, "scheduler", None)
    if scheduler:
        scheduler.shutdown(wait=False)
