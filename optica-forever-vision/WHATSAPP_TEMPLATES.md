# Plantillas WhatsApp Cloud API — Óptica Forever Vision

Crea estas plantillas en **Meta Business Manager → WhatsApp → Gestión de plantillas**.

> **Requisitos previos:**
> - Cuenta de Meta Business Manager verificada
> - Número de WhatsApp Business aprobado
> - Agregar en el `.env` del servidor: `WA_TOKEN=...` y `WA_PHONE_ID=...`

---

## 1. Recordatorio de Cuota de Crédito

| Campo | Valor |
|---|---|
| **Nombre** | `recordatorio_cuota` |
| **Categoría** | `UTILITY` |
| **Idioma** | `es` (Español) |

### Cuerpo del mensaje (Body)

```
Hola {{1}} 👋, le recordamos que su cuota {{2}}/{{3}} del crédito *{{4}}* por *${{5}}* vence el *{{6}}*.

Si ya realizó el pago, puede ignorar este mensaje.

Óptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Descripción | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del paciente | `María` |
| `{{2}}` | Número de cuota | `2` |
| `{{3}}` | Total de cuotas | `6` |
| `{{4}}` | Número de crédito | `CRE-00045` |
| `{{5}}` | Monto de la cuota | `25.00` |
| `{{6}}` | Fecha de vencimiento | `28/05/2026` |

---

## 2. Recordatorio de Turno / Cita

| Campo | Valor |
|---|---|
| **Nombre** | `recordatorio_turno` |
| **Categoría** | `UTILITY` |
| **Idioma** | `es` (Español) |

### Cuerpo del mensaje (Body)

```
Hola {{1}} 👋, le recordamos su *cita* en Óptica Forever Vision:

📅 Fecha: *{{2}}*
🕐 Hora: *{{3}}*
📋 Motivo: {{4}}

Por favor, preséntese 5 minutos antes. Si necesita reagendar, escríbanos a este número.

Av. 24 de mayo y Puyo, Cuenca.
```

### Parámetros

| # | Descripción | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del paciente | `Carlos` |
| `{{2}}` | Fecha del turno | `22/05/2026` |
| `{{3}}` | Hora del turno | `10:30` |
| `{{4}}` | Motivo de la cita | `Control de graduación` |

---

## 3. Felicitación de Cumpleaños

| Campo | Valor |
|---|---|
| **Nombre** | `cumpleanos_optica` |
| **Categoría** | `MARKETING` |
| **Idioma** | `es` (Español) |

### Cuerpo del mensaje (Body)

```
🎂 ¡Feliz cumpleaños, {{1}}!

En Óptica Forever Vision le deseamos un maravilloso día.

Como regalo, venga a visitarnos y consulte nuestras promociones especiales para usted.

Av. 24 de mayo y Puyo, Cuenca. ¡Le esperamos!
```

### Parámetros

| # | Descripción | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del paciente | `Ana` |

---

## 4. Comprobante de Abono (Opcional — envío manual)

| Campo | Valor |
|---|---|
| **Nombre** | `comprobante_abono` |
| **Categoría** | `UTILITY` |
| **Idioma** | `es` (Español) |

### Cuerpo del mensaje (Body)

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

| # | Descripción | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del paciente | `Luis` |
| `{{2}}` | Número de crédito | `CRE-00045` |
| `{{3}}` | Número de cuota pagada | `3` |
| `{{4}}` | Total de cuotas | `6` |
| `{{5}}` | Monto abonado | `50.00` |
| `{{6}}` | Fecha de pago | `21/05/2026` |
| `{{7}}` | Saldo restante | `150.00` |

---

## 5. Notificación Orden de Laboratorio Lista

| Campo | Valor |
|---|---|
| **Nombre** | `orden_lista` |
| **Categoría** | `UTILITY` |
| **Idioma** | `es` (Español) |

### Cuerpo del mensaje (Body)

```
Hola {{1}} 👓, ¡sus lentes están listos!

Su orden *{{2}}* ya puede ser retirada en nuestra óptica.

📍 Av. 24 de mayo y Puyo, Cuenca
⏰ Horario: Lunes a Viernes 9:00–18:00 / Sábados 9:00–14:00

Le esperamos. 😊
```

### Parámetros

| # | Descripción | Ejemplo |
|---|---|---|
| `{{1}}` | Nombre del paciente | `Pedro` |
| `{{2}}` | Número de orden | `ORD-00032` |

---

## Cómo activar los templates en el sistema

Una vez aprobados por Meta, actualiza el `.env` del backend con los nombres exactos:

```env
# WhatsApp Cloud API
WA_TOKEN=EAAxxxxxxxxxxxxxxxx
WA_PHONE_ID=1234567890123

# Nombres de templates (deben coincidir exactamente con los aprobados en Meta)
WA_BIRTHDAY_TEMPLATE=cumpleanos_optica
WA_BIRTHDAY_LANG=es
```

Para los nuevos templates (cuotas, turnos, orden lista), el sistema ya usa `send_text` en los crons. Para cambiar a template aprobado cuando lo tengas, edita en `backend/app/main.py` la función correspondiente y reemplaza `whatsapp.send_text(...)` por:

```python
whatsapp.send_template(
    paciente.telefono,
    "recordatorio_cuota",   # nombre exacto del template aprobado
    "es",
    components=[{
        "type": "body",
        "parameters": [
            {"type": "text", "text": paciente.nombres},
            {"type": "text", "text": str(q.numero_cuota)},
            {"type": "text", "text": str(credito.numero_cuotas)},
            {"type": "text", "text": credito.numero},
            {"type": "text", "text": f"{monto:.2f}"},
            {"type": "text", "text": q.fecha_vencimiento.strftime("%d/%m/%Y")},
        ],
    }],
)
```

---

## Pasos para crear una plantilla en Meta Business Manager

1. Ir a **business.facebook.com** → tu empresa → **WhatsApp** → **Gestión de plantillas**
2. Clic en **Crear plantilla**
3. Seleccionar categoría (`UTILITY` para notificaciones, `MARKETING` para promociones)
4. Escribir el nombre en minúsculas y guiones bajos (ej: `recordatorio_cuota`)
5. Seleccionar idioma: **Español**
6. Pegar el texto del cuerpo con los `{{1}}`, `{{2}}`... en las posiciones correctas
7. Enviar para revisión — Meta aprueba en 24-48 horas

> **Importante:** Los mensajes de tipo `UTILITY` (recordatorios, comprobantes) se aprueban más rápido que `MARKETING`. Los templates son gratuitos fuera de ventana de 24h con WhatsApp Business API de Meta.
