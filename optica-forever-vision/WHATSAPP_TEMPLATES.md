# Plantillas WhatsApp Cloud API — Óptica Forever Vision

Crea estas plantillas en **Meta Business Manager → WhatsApp → Gestión de plantillas**.

> **Requisitos previos:**
> - Cuenta de Meta Business Manager verificada
> - Número de WhatsApp Business aprobado
> - Variables en `backend/.env`: `WA_TOKEN=...` y `WA_PHONE_ID=...`

---

## Estado de implementación

| # | Nombre | Categoría | Trigger | Estado |
|---|---|---|---|---|
| 1 | `recordatorio_cuota` | UTILITY | Cron diario 08:30 | `send_template` ✅ |
| 2 | `recordatorio_turno` | UTILITY | Cron diario 07:00 | `send_template` ✅ |
| 3 | `cumpleanos_optica` | MARKETING | Cron diario 09:00 | `send_template` ✅ |
| 4 | `comprobante_abono` | UTILITY | Al registrar pago de cuota | `send_template` ✅ |
| 5 | `orden_lista` | UTILITY | Al marcar orden como "listo" | `send_template` ✅ |
| 6 | `alerta_stock_bajo` | UTILITY | Cron diario 09:30 (admin) | `send_template` ✅ |
| 7 | `resumen_semanal` | UTILITY | Cron lunes 08:00 (admin) | `send_template` ✅ |
| 8 | `recordatorio_control_visual` | UTILITY | Cron diario 08:15 (7 días antes) | `send_template` ✅ |

> Todos los mensajes usan **WhatsApp Cloud API (`send_template`)**. Funcionan en cualquier momento sin restricción de ventana 24h. Requieren que la plantilla esté aprobada en Meta Business Manager.

---

## Variables de entorno (`backend/.env`)

```env
# Credenciales API Meta
WA_TOKEN=EAAxxxxxxxxxxxxxxxx
WA_PHONE_ID=1234567890123

# Nombres de plantillas (deben coincidir exactamente con los aprobados en Meta)
WA_BIRTHDAY_TEMPLATE=cumpleanos_optica
WA_BIRTHDAY_LANG=es
WA_CUOTA_TEMPLATE=recordatorio_cuota
WA_CUOTA_LANG=es
WA_TURNO_TEMPLATE=recordatorio_turno
WA_TURNO_LANG=es
WA_ABONO_TEMPLATE=comprobante_abono
WA_ABONO_LANG=es
WA_ORDEN_TEMPLATE=orden_lista
WA_ORDEN_LANG=es
WA_STOCK_TEMPLATE=alerta_stock_bajo
WA_STOCK_LANG=es
WA_SEMANAL_TEMPLATE=resumen_semanal
WA_SEMANAL_LANG=es
WA_CONTROL_TEMPLATE=recordatorio_control_visual
WA_CONTROL_LANG=es
CONTROL_REMINDER_DAYS=7

# SMTP para reporte mensual por email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucuenta@gmail.com
SMTP_PASS=tu_app_password
```

---

## Pasos para crear una plantilla en Meta Business Manager

1. Ir a **business.facebook.com** → tu empresa → **WhatsApp** → **Gestión de plantillas**
2. Clic en **Crear plantilla**
3. Seleccionar categoría (`UTILITY` para notificaciones operativas, `MARKETING` para promociones)
4. Nombre en **minúsculas con guiones bajos** (ej: `recordatorio_cuota`)
5. Idioma: **Español**
6. Pegar el texto del cuerpo con los `{{1}}`, `{{2}}`... exactamente como aparece abajo
7. Enviar para revisión — Meta aprueba en **24–48 horas**

> **Tip:** Los templates `UTILITY` se aprueban más rápido que `MARKETING`.

---

## 1. Recordatorio de Cuota de Crédito

| Campo | Valor |
|---|---|
| **Nombre** | `recordatorio_cuota` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_cuotas_job()` — diario 08:30 |

### Cuerpo del mensaje

```
Hola {{1}} 👋, le recordamos que su cuota {{2}}/{{3}} del crédito *{{4}}* por *${{5}}* vence el *{{6}}*.

Si ya realizó el pago, puede ignorar este mensaje.

Óptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `María` |
| `{{2}}` | `cuota.numero_cuota` | `2` |
| `{{3}}` | `credito.numero_cuotas` | `6` |
| `{{4}}` | `credito.numero` | `CRE-00045` |
| `{{5}}` | `cuota.monto - cuota.monto_pagado` | `25.00` |
| `{{6}}` | `cuota.fecha_vencimiento` | `28/05/2026` |

---

## 2. Recordatorio de Turno / Cita

| Campo | Valor |
|---|---|
| **Nombre** | `recordatorio_turno` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_turnos_job()` — diario 07:00 |

### Cuerpo del mensaje

```
Hola {{1}} 👋, le recordamos su *cita* en Óptica Forever Vision:

📅 Fecha: *{{2}}*
🕐 Hora: *{{3}}*
📋 Motivo: {{4}}

Por favor, preséntese 5 minutos antes. Si necesita reagendar, escríbanos a este número.

Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `Carlos` |
| `{{2}}` | `turno.fecha` | `22/05/2026` |
| `{{3}}` | `turno.hora_inicio` | `10:30` |
| `{{4}}` | `turno.motivo` | `Control de graduación` |

---

## 3. Felicitación de Cumpleaños

| Campo | Valor |
|---|---|
| **Nombre** | `cumpleanos_optica` |
| **Categoría** | `MARKETING` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_birthday_job()` — diario 09:00 |

### Cuerpo del mensaje

```
🎂 ¡Feliz cumpleaños, {{1}}!

En Óptica Forever Vision le deseamos un maravilloso día.

Como regalo, venga a visitarnos y consulte nuestras promociones especiales para usted.

Av. 24 de mayo y Puyo, Cuenca. ¡Le esperamos!
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `Ana` |

---

## 4. Comprobante de Pago de Crédito

| Campo | Valor |
|---|---|
| **Nombre** | `comprobante_abono` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Trigger** | `POST /creditos/{id}/cuotas/{qid}/pagar` — automático al registrar pago |

### Cuerpo del mensaje

```
✅ Hola {{1}}, confirmamos su pago en Óptica Forever Vision:

💳 Crédito: *{{2}}*
📌 Cuota: {{3}}/{{4}}
💵 Monto abonado: *${{5}}*
📅 Fecha: {{6}}
💰 Saldo pendiente: *${{7}}*

Gracias por su pago. Guarde este mensaje como comprobante.

Óptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `Luis` |
| `{{2}}` | `credito.numero` | `CRE-00045` |
| `{{3}}` | `cuota.numero_cuota` | `3` |
| `{{4}}` | `credito.numero_cuotas` | `6` |
| `{{5}}` | `data.monto` | `50.00` |
| `{{6}}` | `data.fecha_pago` | `21/05/2026` |
| `{{7}}` | saldo restante calculado | `150.00` |

---

## 5. Orden de Laboratorio Lista

| Campo | Valor |
|---|---|
| **Nombre** | `orden_lista` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Trigger** | `PATCH /ordenes/{id}/estado?estado=listo` — automático al cambiar estado |

### Cuerpo del mensaje

```
Hola {{1}} 👓, ¡sus lentes están listos!

Su orden *{{2}}* ya puede ser retirada en nuestra óptica.

📍 Av. 24 de mayo y Puyo, Cuenca
⏰ Horario: Lunes a Viernes 9:00–18:00 / Sábados 9:00–14:00

¡Le esperamos! 😊
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `Pedro` |
| `{{2}}` | `orden.numero` | `ORD-00032` |

---

## 6. Alerta de Stock Bajo (Admin)

| Campo | Valor |
|---|---|
| **Nombre** | `alerta_stock_bajo` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_stock_bajo_job()` — diario 09:30 |
| **Destinatario** | Administrador (`admin_phone` en Configuración) |

### Cuerpo del mensaje

```
⚠️ *Alerta de Stock Bajo* — Óptica Forever Vision

{{1}} producto(s) están bajo su stock mínimo:

{{2}}

Por favor, realice los pedidos necesarios.
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | cantidad de productos bajo mínimo | `3` |
| `{{2}}` | lista de productos con stock/mínimo | `• Armazón OR280: 2 (mín: 5)\n• Luna Bifocal: 0 (mín: 3)` |

> Solo se envía si hay al menos 1 producto bajo mínimo.

---

## 7. Resumen Semanal (Admin)

| Campo | Valor |
|---|---|
| **Nombre** | `resumen_semanal` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_weekly_summary_job()` — lunes 08:00 |
| **Destinatario** | Administrador (`admin_phone` en Configuración) |

### Cuerpo del mensaje

```
📊 *Resumen Semanal* — Óptica Forever Vision
Del {{1}} al {{2}}

🛒 Ventas: {{3}} ventas · *${{4}}*
💵 Cobros recibidos: *${{5}}*

¡Que tenga una excelente semana! 💪
Óptica Forever Vision
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | fecha inicio (hoy − 7 días) | `19/05` |
| `{{2}}` | fecha fin (hoy) | `25/05/2026` |
| `{{3}}` | cantidad de ventas de la semana | `42` |
| `{{4}}` | total ventas en $ | `1850.00` |
| `{{5}}` | total cobros en $ | `2100.00` |

---

## 8. Recordatorio de Control Visual

| Campo | Valor |
|---|---|
| **Nombre** | `recordatorio_control_visual` |
| **Categoría** | `UTILITY` |
| **Idioma** | `Español (es)` |
| **Cron** | `_run_control_visual_job()` — diario 08:15 |
| **Campo fuente** | `consultas.proximo_control` — fecha registrada por el optometrista |
| **Anticipación** | 7 días antes (configurable: `CONTROL_REMINDER_DAYS=7` en `.env`) |

### Cómo funciona

El cron revisa cada día las consultas donde `proximo_control == hoy + 7`.
Si el optometrista registró `proximo_control = 2026-06-04`, el paciente recibe el mensaje
el **28/05/2026** (exactamente 7 días antes). No requiere campo extra en la BD.

### Cuerpo del mensaje

```
Hola {{1}} 👋, le recordamos que tiene su próximo *control visual* programado para el *{{2}}*.

👓 Por favor, comuníquese con nosotros para confirmar o agendar su cita.

Óptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Campo fuente | Ejemplo |
|---|---|---|
| `{{1}}` | `paciente.nombres` | `Valeria` |
| `{{2}}` | `consulta.proximo_control` | `04/06/2026` |

---

## Prioridad de creación en Meta

| Prioridad | Template | Razón |
|---|---|---|
| 🔴 Alta | `comprobante_abono` | Se envía en cada pago — muy útil para pacientes |
| 🔴 Alta | `orden_lista` | Ahorra llamadas cuando los lentes están listos |
| 🔴 Alta | `recordatorio_control_visual` | Fideliza pacientes y reduce pérdida de seguimiento |
| 🟡 Media | `recordatorio_cuota` | Mejora el cobro de créditos vencidos |
| 🟡 Media | `recordatorio_turno` | Reduce ausentismo en citas |
| 🟢 Normal | `cumpleanos_optica` | Ya funciona con template aprobado |
| 🟢 Normal | `alerta_stock_bajo` | Admin puede ver desde Dashboard también |
| 🟢 Normal | `resumen_semanal` | Conveniencia para el admin |
