# Flujo de Trabajo — Óptica Forever Vision

Guía completa del sistema de gestión. Explica cada módulo, cuándo usarlo y cómo se conecta con los demás.

---

## Visión general

```
TURNO → CONSULTA → PRESUPUESTO → VENTA ─┬─ ORDEN DE LAB
                                          └─ CRÉDITO
                                               │
                                          TESORERÍA / COBROS
```

Cada paso es opcional. Un paciente puede comprar directamente sin consulta, o tener consulta sin comprar ese día.

---

## 1. Turnos

**Cuándo:** Al agendar una cita presencial o llamada.

**Qué registrar:**
- Paciente (nuevo o existente)
- Fecha y hora
- Motivo (control rutinario, urgencia, entrega de lentes, etc.)
- Optometrista asignado

**Acciones disponibles:**
- Recordatorio por WhatsApp al paciente (texto limpio, sin símbolos de formato)
- Cambiar estado directamente desde la lista

**Flujo siguiente:** El día del turno, ir a **Consultas** y registrar los resultados.

---

## 2. Consultas

**Cuándo:** Al realizar el examen visual con el optómetra.

**Pestañas del formulario:**

### Pestaña 1 — Datos generales
- Fecha, motivo, antecedentes

### Pestaña 2 — Agudeza Visual
- AV sin corrección (SC) y con corrección (CC) para OD / OI / AO

### Pestaña 3 — Exploración
- **Refracción:** OD y OI con ESF / CIL / EJE / ADD / AV
- **Queratometría:** K1 / K2 / Eje para OD y OI (en dioptrías)
- PIO (Presión Intraocular) OD y OI
- Cover test, motilidad, estereopsis
- Segmento anterior y fondo de ojo

### Pestaña 4 — Diagnóstico
- Diagnóstico, plan de tratamiento, observaciones, próximo control

### Pestaña 5 — Receta Lentes Convencionales
- OD/OI: ESF / CIL / EJE / ADD / DNP / Altura
- Tipo de lente, tipo de armadura

### Pestaña 6 — Receta Contactología
- Por ojo: Marca, BC, Diámetro, ESF, CIL, EJE
- Observaciones

**Importante:** Todos estos datos se pueden cargar automáticamente al crear una Orden de Lab, sin necesidad de escribir la prescripción de nuevo.

**Impresión:** Botones "Con medidas" / "Sin medidas" / "Certificado" para imprimir la receta oficial.

---

## 3. Perfil del Paciente

El detalle del paciente centraliza toda su historia clínica y comercial:

- **Historial de consultas:** Tabla con fecha, diagnóstico, refracción resumen
- **Evolución de graduación:** Gráfico de tendencia de ESF/CIL a lo largo del tiempo
- **Ventas y cobros:** Registro completo de compras y pagos
- **Créditos activos:** Estado de deuda y cuotas pendientes
- **Garantías activas:** Lista de ítems con garantía vigente y días restantes
- **Trial LC (lentes de contacto de prueba):** Registro de lentes entregados, estado (entregado / devuelto / comprado) y datos de cada ojo
- **Presupuestos:** Cotizaciones realizadas al paciente

---

## 4. Presupuestos

**Cuándo:** El paciente quiere conocer el precio antes de decidir.

**Qué registrar:**
- Productos y servicios cotizados
- Descuentos opcionales por ítem
- Validez del presupuesto en días

**Flujo de estado:**
```
borrador → enviado → aceptado → convertir a venta
                  → rechazado
```

**Desde un presupuesto aceptado:**
- Botón **"Convertir a venta"** → crea la venta con los mismos ítems
- Botón **"Crear orden lab"** → abre el formulario de Órdenes pre-llenado con el paciente

---

## 5. Ventas

**Cuándo:** El paciente confirma la compra.

**Qué incluir:**
- Armazones, lentes de contacto, estuches, soluciones, etc. (del inventario)
- Servicios: adaptación, montaje, reparación
- Forma de pago: contado o crédito
- **Garantía por ítem:** Se puede ingresar los meses de garantía de cada producto (ej: 12 meses para lentes). El sistema calcula la fecha de vencimiento automáticamente.

**Si pago contado:**
El cobro queda en **Tesorería → Cobros**.

**Si pago a crédito:**
Se crea un **Crédito** con abono inicial y cuotas (ver sección Créditos).

**Desde presupuesto:** `Presupuestos → Aceptado → Convertir a venta`

---

## 6. Órdenes de Trabajo (Lab)

**Cuándo:** El paciente necesita lentes fabricados a medida para encargar al laboratorio.

### Cómo crear una orden

**Paso 1 — Seleccionar paciente**
El sistema carga las consultas disponibles del paciente.

**Paso 2 — Cargar prescripción desde consulta**

Seleccionar la consulta y elegir la **fuente de datos:**

| Fuente | Qué carga |
|--------|-----------|
| **Refracción** | Los datos del examen visual (rx_od / rx_oi) |
| **Lentes conv.** | La receta de lentes convencionales (con DNP incluido) |
| **Contactología** | La receta de lentes de contacto |

El preview del dropdown muestra los valores OD/OI de la fuente seleccionada para ayudar a elegir la consulta correcta.

**Paso 3 — Completar prescripción**
Tabla editable con OD/OI: ESF / CIL / EJE / ADD / PRISMA / DNP.
Campos de Material, Tratamiento, Diseño, DP.

**Paso 4 — Agregar partes / proveedores**

Cada "parte" de la orden puede ir a un proveedor diferente o salir del stock propio:

| Fuente | Cuándo usar |
|--------|-------------|
| **Laboratorio** | Se encarga la fabricación a un lab externo |
| **Stock propio** | La óptica ya tiene esa parte en inventario |

Por cada parte se define:
- **OD / OI / Ambos** (qué ojo va a ese proveedor)
- Nombre del proveedor (autocompletado desde el directorio)
- Teléfono del lab (para WhatsApp)
- Fecha de entrega estimada
- Precio de costo del lab
- Producto del inventario vinculado (para costeo)

**Ejemplo real:**
> Un cliente necesita lentes progresivos + armazón especial de otro proveedor:
> - Parte 1 → Lab "ÓpticaLab" · Ambos ojos · Lentes progresivos · $85
> - Parte 2 → Stock propio · armazón referenciado en inventario
>
> → Se crean **2 órdenes separadas** desde un mismo formulario

### Estados de la orden

```
Pendiente → Enviado → En Proceso → Listo → Entregado
                                       ↘ Rechazado
```

### Enviar al lab por WhatsApp

Botón "Enviar" (ícono avión) en la fila de la orden:
- Abre WhatsApp con el mensaje completo pre-llenado: número de orden, fecha, tipo, material, tratamiento, prescripción filtrada al ojo correcto (OD / OI / Ambos según la parte)
- El mensaje es texto limpio, sin asteriscos ni símbolos de formato
- Simultáneamente abre el PDF de la orden para imprimir y adjuntar manualmente

> WhatsApp no permite adjuntar archivos por URL. El PDF se abre aparte para guardarlo y adjuntarlo desde el chat.

### Notificar al paciente

Cuando el estado cambia a **"Listo"**, aparece el botón WhatsApp verde en la fila para avisar al paciente que sus lentes están listos.

### Imprimir

| Ícono | Documento |
|-------|-----------|
| Impresora negra | Ficha técnica de la orden (para el lab o archivo) |
| Impresora azul | Formulario de aceptación con espacio para firmas |
| Etiqueta | Etiqueta pequeña de identificación del lente |

---

## 7. Créditos

**Cuándo:** El paciente no paga la totalidad en el momento.

**Cómo funciona:**
1. Se define el monto total, abono inicial y número de cuotas
2. El sistema calcula el monto de cada cuota y las fechas de vencimiento automáticamente
3. El vendedor registra cada pago cuando el paciente llega a cancelar
4. El crédito se marca como **Pagado** cuando el total cubierto alcanza el monto

**Estados:**
- **Vigente:** Cuotas al día
- **Vencido:** Tiene cuotas con fecha vencida sin pagar → aparece en **Notificaciones**
- **Pagado:** Cancelado completamente

**WhatsApp:** Botones para recordar cuotas vencidas o confirmar abonos (texto limpio).

**Impresión:** Comprobante de pago con tabla de cuotas, firmas y logo de la óptica.

---

## 8. Trial LC (Lentes de Contacto de Prueba)

**Cuándo:** Se entrega una muestra de lente de contacto al paciente para que pruebe antes de comprar.

**Desde el perfil del paciente → sección "Trial LC":**
- Registrar: Fecha de entrega, Fecha de control
- Por ojo (OD/OI): Marca, BC (base curva), Diámetro, ESF, CIL, EJE
- Estado: **Entregado / Devuelto / Comprado**
- Notas adicionales

Sirve para llevar trazabilidad de muestras y hacer seguimiento de adaptación.

---

## 9. Garantías

Las garantías se registran al momento de hacer la venta, por ítem:

- Al ingresar **meses de garantía** en un ítem de venta, el sistema calcula la fecha de vencimiento
- En el **perfil del paciente** → sección "Garantías" se muestra:
  - Descripción del producto
  - Número de venta
  - Fecha de vencimiento
  - Días restantes (o "Vencida" en rojo si ya pasó)

---

## 10. Inventario

**Qué gestionar:**
- Armazones, lentes de contacto, soluciones, estuches, repuestos
- Productos usados como insumos o vendidos directamente

**Stock bajo:**
Si `stock_actual ≤ stock_mínimo` → aparece alerta ⚠ en la tabla y en el panel de **Notificaciones** del encabezado.

**Entrada de stock:** Botón ↓ en cada producto para registrar compra o devolución.

**Categorías:** Crear/editar/eliminar categorías (Armazones, Lentes de contacto, Soluciones, etc.).

---

## 11. Tesorería

### Cobros
Todos los pagos recibidos: ventas al contado, abonos a créditos, anticipos.

### Egresos
Pagos realizados por la óptica: servicios, sueldos, insumos, gastos varios.

### Cuentas por Pagar (CxP)
Facturas pendientes de pago a proveedores. Se pueden importar desde XML del SRI o registrar manualmente.

---

## 12. Proveedores

Directorio de laboratorios y distribuidores:
- Se vinculan a Órdenes de Lab (auto-llena nombre y teléfono WhatsApp)
- Se vinculan a Cuentas por Pagar
- Se puede importar facturas XML del SRI y asociarlas al proveedor

---

## 13. Reportes

Métricas del negocio con gráficos:
- Ingresos vs egresos por período
- Ventas por categoría de producto
- Órdenes por estado
- Tendencia mensual

---

## 14. Notificaciones del sistema

Campana (🔔) en el encabezado. Muestra alertas en tiempo real:

| Alerta | Módulo |
|--------|--------|
| Créditos vencidos | Ir a Créditos |
| Stock bajo | Ir a Inventario |
| Órdenes listas | Ir a Órdenes |
| Turnos hoy | Ir a Turnos |

Se actualiza automáticamente cada 60 segundos.

---

## 15. WhatsApp

Todos los mensajes que genera el sistema son texto limpio (sin asteriscos, guiones bajos ni símbolos de formato). Usan emojis solo donde aportan claridad.

| Mensaje | Módulo que lo envía |
|---------|---------------------|
| Recordatorio de cita | Turnos |
| Orden al laboratorio | Órdenes |
| Lentes listos (al paciente) | Órdenes |
| Recordatorio de cuota | Créditos |
| Confirmación de abono | Créditos |
| Control visual | Paciente |
| Cumpleaños | Paciente |

---

## 16. Configuración

**Datos de la empresa:** Nombre, RUC, dirección, teléfono.
**Logo:** Aparece en todos los PDFs e impresiones.
**Firma electrónica:** Imagen de la firma del optómetra (en recetas y comprobantes).
**WhatsApp cron:** Recordatorios automáticos de turnos próximos.

---

## 17. Usuarios y roles

| Rol | Acceso |
|-----|--------|
| **admin** | Todo el sistema: configuración, eliminación, reportes |
| **vendedor** | Ventas, inventario, órdenes, créditos, turnos |
| **optometrista** | Consultas, turnos, pacientes |

---

## Atajos

| Atajo | Función |
|-------|---------|
| `Ctrl + K` | Búsqueda global: pacientes, ventas, órdenes, créditos, productos |

---

## Diagrama completo del flujo

```
Paciente nuevo
      │
      ▼
   Turno (agenda)  ──── WhatsApp recordatorio
      │
      ▼
  Consulta
  ├── Refracción OD/OI
  ├── Queratometría K1/K2
  ├── Receta lentes convencionales (con DNP)
  └── Receta lentes de contacto
      │
      ├──────────────────────┐
      ▼                      ▼
  Presupuesto           Orden de Lab
  (cotización)          ├── Cargar Rx desde consulta
      │                 │     (Refracción / LC / Contacto)
      ▼                 ├── Parte 1 → Lab A (OD)
  Convertir             ├── Parte 2 → Lab B (OI)
      │                 └── Parte 3 → Stock propio
      ▼                       │
    Venta                     ▼
  ├── Ítems con garantía  Estado: listo
  ├── Contado             │
  └── Crédito             └── WhatsApp al paciente
      │                         │
      ▼                         ▼
  Cobros /                PDF aceptación (firma)
  Cuotas
      │
      ▼
  Tesorería
```

---

## Documentos que genera el sistema

| Documento | Módulo | Descripción |
|-----------|--------|-------------|
| Receta optométrica | Consultas | Receta oficial con firma del optómetra |
| Orden de trabajo | Órdenes | Prescripción para el laboratorio |
| Formato aceptación lentes | Órdenes | Firma del paciente al retirar |
| Etiqueta de lente | Órdenes | Identificación pequeña del lente |
| Comprobante de venta | Ventas | Factura con ítems, totales y logo |
| Presupuesto | Presupuestos | Cotización con validez |
| Comprobante de cuota | Créditos | Recibo de pago de cuota |
| Formato aceptación crédito | Créditos | Contrato con tabla de cuotas y firmas |

Todos usan la misma plantilla de marca con logo, color teal (#0891b2) y footer con datos de contacto.
