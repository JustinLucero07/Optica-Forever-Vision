# Flujo de Trabajo — Óptica Forever Vision

## Resumen del sistema

Sistema de gestión integral para óptica: pacientes, consultas optométricas, órdenes de lentes, ventas, créditos y tesorería.

---

## 1. Primer contacto con un paciente nuevo

```
Pacientes → Nuevo paciente
  ├── Completar: nombre, apellidos, cédula, teléfono, fecha de nacimiento, dirección
  └── Guardar → queda en la base de datos con historial vacío
```

---

## 2. Agendamiento de turno

```
Turnos (Agenda)
  ├── Vista semana: clic sobre el día → crear turno
  ├── Vista lista: "Nuevo turno"
  ├── Datos: Paciente, Fecha, Hora inicio/fin, Motivo, Optometrista
  ├── Estado inicial: "pendiente"
  └── Opcional: enviar recordatorio WhatsApp al paciente
```

### Estados posibles de un turno:
`pendiente → confirmado → asistido / no_asistio / cancelado`

---

## 3. Consulta optométrica

```
Paciente (detalle) → "Nueva Consulta"
  ├── Motivo de consulta
  ├── Anamnesis (antecedentes, medicamentos)
  ├── Examen visual: AV OD/OI, refracción (esf, cil, eje), ADD
  ├── Queratometría, PIO, fondo de ojo
  ├── Diagnóstico y recomendaciones
  └── Guardar → genera número de consulta (CON-XXXX)
```

El historial de consultas queda visible en el perfil del paciente.

---

## 4. Orden de lentes

Desde la consulta o directamente en el módulo **Órdenes**:

```
Órdenes → "Nueva orden"
  ├── Seleccionar paciente
  ├── Seleccionar proveedor/laboratorio (1 o más partes: OD, OI, completo)
  ├── Completar prescripción: esf, cil, eje, ADD, DNP, altura
  ├── Diseño (monofocal, bifocal, progresivo)
  ├── Tratamiento (AR, fotocromatico, etc.)
  ├── Material (orgánico, policarbonato, etc.)
  ├── Urgente: sí/no → afecta el mensaje WhatsApp al laboratorio
  └── Guardar → genera número de orden (ORD-XXXX), estado: "pendiente"
```

### Flujo de orden:
```
pendiente → enviado_lab → en_proceso → listo → entregado
```

### Acciones en orden:
- **Imprimir orden**: PDF con prescripción completa (diseño con logo)
- **Formato de aceptación**: PDF para firma del paciente al retirar los lentes
- **WhatsApp laboratorio**: envía la RX con texto estándar al número del proveedor

---

## 5. Venta

```
Ventas → "Nueva venta"
  ├── Opcional: asociar paciente
  ├── Agregar ítems: descripción, cantidad, precio, descuento %
  ├── Ver subtotal, descuento total y TOTAL
  └── Guardar → genera VEN-XXXX, estado: "pendiente"
```

> Si se parte de un presupuesto aceptado, se convierte directamente: `Presupuestos → Aceptado → Convertir a venta`

### Estados de venta:
`pendiente → cobrado / anulado`

Una venta pasa a **cobrado** automáticamente cuando los cobros registrados cubren el total.

---

## 6. Cobro de una venta

```
Tesorería → Cobros (CxC) → "Nuevo Cobro"
  ├── Buscar la venta pendiente por número o nombre de paciente
  ├── Sistema muestra: Total venta / Abonado / Saldo
  ├── Ingresar monto a cobrar (puede ser parcial → crédito)
  ├── Método de pago: efectivo / transferencia / tarjeta / cheque / depósito
  ├── Cuenta destino (caja, banco, etc.)
  └── Guardar → genera COB-XXXX, actualiza saldo de la cuenta
```

---

## 7. Venta a crédito

Para ventas que se pagan en cuotas:

```
Créditos → "Nuevo crédito"
  ├── Asociar venta
  ├── Monto del crédito, cuota inicial (enganche)
  ├── Número de cuotas y periodicidad (semanal, quincenal, mensual)
  ├── Fecha de inicio
  └── Guardar → genera CRE-XXXX con tabla de cuotas calculada automáticamente
```

### Gestión de cuotas:
```
Crédito (expandir) → Ver cuotas
  ├── Registrar pago → seleccionar cuota, monto, método
  ├── Imprimir comprobante de pago (PDF con logo)
  └── Imprimir "Formato de Aceptación de Crédito" (documento físico para firma)
```

### Seguimiento de cartera:
```
Cartera (CxC) → vista de antigüedad de saldos
  ├── Corriente (0 días vencido)
  ├── 1-30 días
  ├── 31-60 días
  ├── 61-90 días
  └── +90 días → casos críticos
```

---

## 8. Egreso / Gasto

```
Tesorería → Egresos → "Nuevo Egreso"
  ├── Categoría: Arriendo, Insumos, Bisel y Lunas, Personal, etc.
  ├── Monto y método de pago
  ├── Cuenta origen
  └── Guardar → descuenta saldo de la cuenta
```

---

## 9. Cuentas por Pagar (proveedores/laboratorios)

Cuando llega una factura de un laboratorio:

```
Tesorería → Cuentas x Pagar → "Nueva CxP"
  ├── Proveedor, concepto, monto total
  ├── Fecha de emisión y vencimiento
  └── Guardar → estado: "pendiente"

  Opción: importar XML de factura SRI → parsea ítems automáticamente
    └── Módulo SRI → subir XML → mapear ítems a productos del inventario

Cuando se paga la factura:
  CxP → Pagar → monto, cuenta, método
  └── Estado pasa a: "parcial" o "pagado"
```

---

## 10. Inventario

```
Inventario
  ├── Productos con: nombre, código, precio costo/venta, stock actual, stock mínimo
  ├── Alerta automática cuando stock_actual <= stock_mínimo
  ├── Stock se actualiza automáticamente al registrar CxP con ítems vinculados
  └── Búsqueda y filtro por nombre/código/categoría
```

---

## 11. Presupuesto / Cotización

Para clientes que piden precio antes de decidir:

```
Presupuestos → "Nuevo presupuesto"
  ├── Opcional: asociar paciente
  ├── Ítems con precio y descuento
  ├── Validez en días
  └── Guardar → PRE-XXXX, estado: "borrador"

Flujo de estado:
  borrador → enviado → aceptado → convertir a venta
                    → rechazado
```

---

## 12. Reportes

```
Reportes
  ├── Ventas por período (tabla + gráfico de barras)
  ├── Top productos más vendidos
  ├── Ingresos vs egresos
  └── Exportar a Excel/PDF
```

---

## 13. Configuración del sistema

```
Configuración
  ├── Datos de la óptica (nombre, dirección, teléfonos, RUC)
  ├── Cuentas bancarias: crear/editar cuentas de tesorería
  ├── Firma electrónica del responsable (imagen PNG para PDFs)
  └── Preferencias generales
```

---

## 14. Usuarios y roles

| Rol | Acceso |
|-----|--------|
| **admin** | Todo: usuarios, configuración, eliminar registros, reportes |
| **optometrista** | Consultas, pacientes, órdenes, turnos |
| **vendedor** | Ventas, cobros, pacientes, presupuestos |

---

## Diagrama de flujo resumido

```
Paciente nuevo
      │
      ▼
   Turno (agenda)
      │
      ▼
  Consulta → Rx registrada
      │
      ▼
  Orden de lente → Lab (WhatsApp)
      │                 │
      │           Lente llega
      │                 │
      ▼                 ▼
    Venta ←─── Entrega al paciente
      │              (PDF aceptación)
      ▼
 Cobro / Crédito
      │
      ▼
  Tesorería actualizada
```

---

## Documentos que genera el sistema

| Documento | Módulo | Descripción |
|-----------|--------|-------------|
| Comprobante de venta | Ventas (detalle) | Factura con ítems, totales y logo |
| Orden de trabajo | Órdenes | Prescripción para el laboratorio |
| Formato aceptación lentes | Órdenes | Firma del paciente al retirar |
| Comprobante de cuota | Créditos | Recibo de pago de cuota |
| Formato aceptación crédito | Créditos | Contrato de crédito con cuotas |
| Presupuesto | Presupuestos | Cotización con validez |

Todos los documentos usan la misma plantilla de marca con logo de ojo, color teal (#0891b2) y footer con dirección y teléfonos.
