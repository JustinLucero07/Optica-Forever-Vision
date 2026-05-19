# Sistema de Gestión — Óptica Forever Vision
## Análisis de archivos actuales + Plan de desarrollo

---

## 1. Lo que descubrí en tus archivos

### 1.1 Contexto del negocio
- **Nombre:** Óptica Forever Vision
- **Dirección:** Av. 24 de mayo y Puyo
- **Teléfonos:** 593998674908 / 979100495
- **País:** Ecuador (código país 593, bancos Pichincha/Produbanco, cooperativas JEP/Jardín Azuayo, billetera DeUna)
- **Volumen actual:** ~138 pacientes, ~118 consultas, ~94 ventas, ~122 productos en inventario

### 1.2 `OpticaRevisado.xlsm` — sistema operativo
Es un Excel con macros VBA (formularios UserForm que simulan una app de escritorio). Tiene 14 hojas y ~50 formularios/módulos VBA. Lo que hace hoy:

| Hoja | Función |
|---|---|
| `bdPacientes` | Maestro de pacientes (key, nombres, cédula, género, fecha nac., edad, tel, estado civil, ocupación, observaciones) |
| `bdConsulta` | Historia clínica + examen visual + receta (144 columnas: anamnesis, agudezas, refracción, diagnóstico, recomendaciones, datos para imprimir orden) |
| `cabezaVentas` | Cabecera de venta (keyVenta, fecha, cliente, n productos, subtotal, descuento, total, cobrado, pendiente, método pago, estado) |
| `CuerpoVenta` | Líneas de venta (keyVenta, keyProducto, precio, cant, descuento, subtotal) |
| `Cxc` | Cuentas por cobrar (deuda, abono, saldo) |
| `bdIngresos` | Cobros aplicados a ventas (keyIngreso, keyVenta, fecha, cliente, método, monto, concepto) |
| `Inventario` | Productos (código, nombre, precio, entradas, salidas, existencias) |
| `bdEntradas` | Movimientos de entrada (keyProducto, cantidad, proveedor, responsable) |
| `Registro Laboratorios` | Laboratorios externos (keyLab, nombre, dirección, tel, email) |
| `Configuraciones` | Contadores autoincrementales, rutas, listas (estado civil, género), código país |
| `Inicio`, `VentaTk`, `Orden Lente Convencional`, `Orden Contactología` | Plantillas de impresión y dashboard |

**Funcionalidades implementadas en VBA hoy:**
- CRUD de pacientes (con normalización de teléfono +593)
- Consultas/recetas con 144 campos clínicos
- Punto de venta con líneas de productos
- Cuentas por cobrar y registro de abonos
- Inventario con entradas/salidas
- **Generación de PDF de orden** (lente convencional / contactología)
- **Envío al laboratorio por WhatsApp Desktop o Outlook Email** con PDF adjunto
- Eliminación en cascada (cliente → consultas → ventas → cuerpo → cxc → ingresos)
- Numeradores secuenciales (orden, venta, consulta, paciente)

### 1.3 `Cuentas.xlsx` — caja y contabilidad
Lleva la contabilidad **separada** del archivo operativo. Es un libro contable diario.

| Hoja | Función |
|---|---|
| `INGRESOS` | Diario de ingresos (fecha, cliente, producto, cantidad, precio, ingreso, descripción [ABONO/CANCELACION/DEPOSITO], observación, tipo de pago, mes, año, orden, soffi) |
| `EGRESOS` | Diario de egresos (fecha, cuenta, distribuidor, cantidad, precio, egreso, detalle, no. documento, mes, año, tipo de pago) |
| `FACTURAS` | Cuentas por pagar a laboratorios (estado POR PAGAR / PAGADO) |
| `RESUMEN 1`, `REPORTE CAJA` | Resúmenes mensuales con SUMIFS |
| `CUENTAS CONTABLES` | Catálogo: cuentas ingreso, cuentas gasto, productos, tipos de pago, distribuidores |

**Catálogos detectados:**
- Cuentas de ingreso: `ABONO`, `CANCELACION`
- Cuentas de gasto: `BISEL Y LUNAS`, `MOTORIZADO`, `COMIDA`, `DEPOSITO`, `LUZ`, `AGUA`, `COMPRAS`, `ARRIENDO`, `BRYAM`, `DANNA`, `OTROS`
- Productos: `LENTES`, `CERTIFICADO`, `CARRERAS`, `ALIMENTACION`, `DISTRIBUIDORA`, `ACCESORIOS`
- Tipos de pago: `EFECTIVO`, `TARJETA`, `JEP DANNA`, `PICHINCHA`, `PRODUBANCO`, `JARDIN AZUAYO`, `JEP BRYAM`, `BRYAM`, `DE UNA`, `DANNA`
- Distribuidores/laboratorios: `ALEPSA`, `IMPORTLENTS`, `OPTEC`, `PECSA`, `PROVISION LENS`, `DELBAK`, `PROVISION CUENCA`, `TECNILENTS`, `ANDINA`, `GUARTAZACA`, `RESTREPO`

### 1.4 Hallazgos críticos
1. **Los dos archivos viven separados** → hoy un cobro hay que cargarlo dos veces (en `bdIngresos` del operativo Y en `INGRESOS` de cuentas). El nuevo sistema unifica esto.
2. **Las recetas se imprimen y se envían al laboratorio** vía WhatsApp/email — replicar esto es esencial.
3. **Hay personal:** Bryam y Danna (aparecen como cuentas de personal y como "responsable" de entradas).
4. **No hay sistema de turnos** (lo vamos a sumar).
5. **No hay roles ni permisos reales** (todos tienen acceso a todo).
6. **Multi-cuenta de banco** muy presente: el sistema debe manejar varias cajas/cuentas (Efectivo, Pichincha, Produbanco, JEP, etc.).

---

## 2. Modelo de datos definitivo (PostgreSQL)

```
┌─ AUTENTICACIÓN ──────────────────────────────────────────────┐
│  users(id, email, password_hash, full_name, role,            │
│        is_active, created_at)                                │
│  roles: admin | optometrista | vendedor | cajero             │
└──────────────────────────────────────────────────────────────┘

┌─ MAESTROS ───────────────────────────────────────────────────┐
│  pacientes(id, codigo[P1..], nombres, cedula, genero,        │
│            fecha_nacimiento, telefono, email, estado_civil,  │
│            ocupacion, direccion, observaciones, created_at)  │
│                                                              │
│  laboratorios(id, codigo, nombre, telefono, email, direccion)│
│                                                              │
│  proveedores(id, nombre, ruc, telefono, email, direccion)    │
│                                                              │
│  cuentas_financieras(id, nombre, tipo[caja|banco|coop|       │
│            billetera], saldo_inicial, activa)                │
│                                                              │
│  categorias_gasto(id, nombre)                                │
└──────────────────────────────────────────────────────────────┘

┌─ INVENTARIO ─────────────────────────────────────────────────┐
│  categorias_producto(id, nombre)  -- armazón, luna,          │
│                       certificado, accesorio, líquido        │
│                                                              │
│  productos(id, codigo, nombre, categoria_id, marca, modelo,  │
│            color, precio_compra, precio_venta, stock_minimo, │
│            stock_actual, activo)                             │
│                                                              │
│  movimientos_inventario(id, producto_id, tipo[entrada|       │
│            salida|ajuste], cantidad, costo_unit, proveedor_id│
│            usuario_id, motivo, ref_venta_id, fecha)          │
└──────────────────────────────────────────────────────────────┘

┌─ CLÍNICA ────────────────────────────────────────────────────┐
│  consultas(id, codigo[C1..], paciente_id, fecha, motivo,     │
│            antecedentes, diagnostico, recomendaciones,       │
│            observaciones, optometrista_id)                   │
│                                                              │
│  recetas(id, consulta_id, tipo[lente_convencional|           │
│          contactologia], fecha,                              │
│          -- ojo derecho                                      │
│          od_esf, od_cyl, od_eje, od_add, od_dnp, od_alt,     │
│          od_av_lejos, od_av_cerca, od_avcc_lejos, od_avcc_   │
│          cerca, od_diametro, od_curva_base, od_prisma,       │
│          -- ojo izquierdo (mismas columnas oi_*)             │
│          dp, diseno_lente, material, tratamiento,            │
│          orden_numero, estado_envio, lab_destino_id,         │
│          ruta_pdf)                                           │
│                                                              │
│  envios_laboratorio(id, receta_id, laboratorio_id, canal     │
│            [whatsapp|email], destino, fecha_envio,           │
│            estado[enviado|recibido|listo|entregado],         │
│            usuario_id)                                       │
└──────────────────────────────────────────────────────────────┘

┌─ AGENDA ─────────────────────────────────────────────────────┐
│  turnos(id, paciente_id, fecha, hora_inicio, hora_fin, tipo  │
│         [consulta|control|entrega], estado[programado|       │
│         confirmado|atendido|cancelado|noshow], notas,        │
│         optometrista_id)                                     │
└──────────────────────────────────────────────────────────────┘

┌─ VENTAS ─────────────────────────────────────────────────────┐
│  ventas(id, numero, fecha, paciente_id, vendedor_id,         │
│         consulta_id?, subtotal, descuento, total, cobrado,   │
│         pendiente, estado[completada|pendiente|anulada],     │
│         observaciones)                                       │
│                                                              │
│  venta_items(id, venta_id, producto_id, cantidad, precio,    │
│              descuento, subtotal)                            │
│                                                              │
│  ordenes_trabajo(id, venta_id, receta_id, laboratorio_id,    │
│            estado[pendiente|en_lab|listo|entregado],         │
│            fecha_promesa, fecha_entrega, notas)              │
└──────────────────────────────────────────────────────────────┘

┌─ FACTURACIÓN INTERNA ────────────────────────────────────────┐
│  comprobantes(id, tipo[factura|nota_venta|recibo], numero,   │
│            fecha, venta_id, paciente_id, total, anulado)     │
└──────────────────────────────────────────────────────────────┘

┌─ TESORERÍA ──────────────────────────────────────────────────┐
│  cobros(id, venta_id, paciente_id, fecha, monto,             │
│         cuenta_financiera_id, concepto[abono|cancelacion],   │
│         usuario_id, observaciones)                           │
│                                                              │
│  cxc(id, paciente_id, venta_id, total_deuda, abonado, saldo) │
│       -- vista materializada o calculada en runtime          │
│                                                              │
│  egresos(id, fecha, categoria_id, proveedor_id?,             │
│          cuenta_financiera_id, monto, descripcion,           │
│          n_documento, usuario_id)                            │
│                                                              │
│  cuentas_pagar(id, proveedor_id, fecha_factura,              │
│            n_documento, monto, estado[por_pagar|pagado],     │
│            fecha_pago, cuenta_financiera_id)                 │
│                                                              │
│  arqueo_caja(id, cuenta_id, fecha, saldo_inicial,            │
│              total_ingresos, total_egresos, saldo_calculado, │
│              saldo_real, diferencia, usuario_id)             │
└──────────────────────────────────────────────────────────────┘

┌─ AUDITORÍA ──────────────────────────────────────────────────┐
│  audit_log(id, usuario_id, accion, entidad, entidad_id,      │
│            datos_antes, datos_despues, fecha, ip)            │
└──────────────────────────────────────────────────────────────┘
```

### Relaciones clave
- 1 paciente → N consultas → N recetas → 1 envío al lab
- 1 paciente → N ventas → N items + N cobros (= cxc)
- 1 venta → 1 receta opcional → 1 orden de trabajo → estado del lab
- 1 cobro → 1 cuenta financiera (suma a INGRESOS de esa caja)
- 1 egreso/pago a proveedor → 1 cuenta financiera (resta de esa caja)

---

## 3. Stack final y arquitectura

### Backend (Python)
```
fastapi[standard]==0.115.*
sqlalchemy==2.0.*
alembic==1.13.*
psycopg[binary]==3.2.*
pydantic==2.*
pydantic-settings==2.*
python-jose[cryptography]   # JWT
passlib[bcrypt]              # hashing
python-multipart             # uploads
weasyprint                   # PDFs (recetas, facturas, reportes)
openpyxl                     # exports + importer inicial
pandas                       # importer + reportes
celery + redis               # tareas async (envío email/WhatsApp)
httpx                        # llamadas externas
pytest + pytest-asyncio      # tests
```

### Frontend (React + TS)
```
vite + react@18 + typescript
tailwindcss + shadcn/ui      # diseño profesional
@tanstack/react-query        # data fetching
react-hook-form + zod        # formularios
react-router-dom             # routing
recharts                     # gráficos del dashboard
date-fns                     # fechas
sonner                       # toasts
zustand                      # estado global ligero
```

### Infraestructura (Hostinger VPS)
```
docker + docker-compose
  ├─ nginx        (reverse proxy + TLS)
  ├─ backend      (FastAPI uvicorn workers)
  ├─ frontend     (build estático servido por nginx)
  ├─ postgres:16
  ├─ redis:7      (Celery broker + caché)
  └─ certbot      (Let's Encrypt auto-renew)

CI: GitHub Actions → SSH deploy a VPS
Backups: pg_dump diario → S3 / Drive (cron)
```

### Estructura de carpetas
```
optica-forever-vision/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/         # config, security, deps, db
│   │   ├── models/       # SQLAlchemy
│   │   ├── schemas/      # Pydantic
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── pacientes.py
│   │   │   ├── consultas.py
│   │   │   ├── recetas.py
│   │   │   ├── turnos.py
│   │   │   ├── productos.py
│   │   │   ├── inventario.py
│   │   │   ├── ventas.py
│   │   │   ├── cobros.py
│   │   │   ├── egresos.py
│   │   │   ├── proveedores.py
│   │   │   ├── laboratorios.py
│   │   │   ├── envios.py
│   │   │   ├── reportes.py
│   │   │   └── dashboard.py
│   │   ├── services/     # lógica de negocio
│   │   ├── reports/      # generación PDF/XLSX
│   │   ├── tasks/        # Celery (envío whatsapp/email)
│   │   └── utils/
│   ├── alembic/
│   ├── tests/
│   ├── scripts/
│   │   └── import_excel.py   # carga inicial desde tus xlsx
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── features/     # un folder por dominio
│   │   ├── api/          # axios + react-query hooks
│   │   ├── lib/
│   │   └── routes.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx/
├── .github/workflows/
└── README.md
```

---

## 4. Plan por fases (cronograma sugerido: 8–10 semanas)

### Fase 0 — Setup (semana 1)
- Repo Git + estructura monorepo
- Docker Compose (postgres + redis + backend + frontend)
- Alembic primera migración
- Auth JWT (login, refresh, roles)
- Layout base del frontend (sidebar + topbar + login)
- Configuración de la óptica (datos del local, IVA si aplica)
- CI: lint + tests + build

### Fase 1 — Núcleo clínico (semanas 2-3)
- CRUD Pacientes (con búsqueda por cédula/nombre/teléfono)
- CRUD Consultas con todos los campos clínicos
- CRUD Recetas (lente convencional + contactología) — replicando el formulario VBA con shadcn/ui
- Generación de PDF de receta/orden con WeasyPrint, formato igual al actual
- Historial clínico del paciente

### Fase 2 — Comercial (semanas 3-5)
- CRUD Productos + Categorías
- Inventario: entradas, salidas, ajustes, stock con alertas
- Punto de venta: buscar paciente, agregar productos, asociar receta opcional
- Comprobantes internos (factura/nota de venta) con numeración secuencial
- Imprimir ticket / comprobante en PDF

### Fase 3 — Tesorería (semanas 5-6)
- Cuentas financieras (Efectivo, Pichincha, Produbanco, JEP, Jardín Azuayo, DeUna…)
- Cobros aplicados a ventas (abono / cancelación) → actualiza CxC y caja
- Cuentas por cobrar con vencimientos
- Egresos por categoría
- Cuentas por pagar (laboratorios)
- Arqueo de caja diario

### Fase 4 — Laboratorios y agenda (semana 7)
- CRUD Laboratorios
- Órdenes de trabajo con estado (pendiente → en lab → listo → entregado)
- Envío de receta por **WhatsApp Web** (link wa.me) y **Email** (SMTP) con PDF adjunto
- Módulo de turnos con calendario (mensual/semanal/día)
- Recordatorios automáticos (cumpleaños, control anual, turnos del día)

### Fase 5 — Reportes y dashboard (semana 8)
- Dashboard con KPIs:
  - Ventas del día/mes/año (gráfico)
  - Ingresos por método de pago
  - Productos más vendidos
  - Pacientes nuevos
  - Stock bajo mínimo
  - CxC vencidas
- Reportes exportables (PDF + Excel):
  - Ventas por período
  - Ingresos vs egresos
  - Stock valorizado
  - CxC y CxP
  - Movimientos de caja por cuenta
  - Ranking de productos / vendedores
  - Lista de pacientes con próximo control

### Fase 6 — Importador y migración (semana 9)
- Script `import_excel.py` que carga `OpticaRevisado.xlsm` + `Cuentas.xlsx` a la BD nueva
- Reconciliación: detectar duplicados, mapear cuentas, normalizar teléfonos
- Ejecución en staging → validación → producción

### Fase 7 — Despliegue y pulido (semana 10)
- Setup VPS Hostinger (Ubuntu 22.04)
- Dominio + Cloudflare opcional
- Nginx + TLS Let's Encrypt
- Backups automáticos diarios (pg_dump → almacenamiento externo)
- Manual de usuario (PDF) y videos cortos
- Capacitación a los 5 usuarios

---

## 5. Roles y permisos propuestos

| Permiso | Admin | Optometrista | Vendedor | Cajero |
|---|:-:|:-:|:-:|:-:|
| Pacientes (CRUD) | ✅ | ✅ | ✅ leer/crear | ✅ leer |
| Consultas / Recetas | ✅ | ✅ | ❌ | ❌ |
| Productos / Inventario | ✅ | ❌ | ✅ leer | ❌ |
| Ventas | ✅ | ❌ | ✅ | ✅ leer |
| Cobros / CxC | ✅ | ❌ | ❌ | ✅ |
| Egresos / CxP | ✅ | ❌ | ❌ | ✅ leer |
| Reportes | ✅ | ✅ propios | ✅ propios | ❌ |
| Configuración / Usuarios | ✅ | ❌ | ❌ | ❌ |

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos durante migración | Importador idempotente + dry-run + backup pre-migración |
| WhatsApp no se puede enviar 100% automático sin API oficial pagada | Usar `wa.me` link (abre WhatsApp Web con mensaje + adjunto manual). Alternativa: WhatsApp Business API (pago) en fase 2 |
| El optometrista usa el sistema desde el consultorio (otra PC) | App web → cualquier PC en LAN o internet con login |
| Caída del VPS | Backups diarios + script de restore documentado; opcional réplica BD |
| Numeración de comprobantes con saltos | Transacción + secuencia DB; nunca cliente-side |

---

## 7. Lo que necesito de vos antes de empezar la Fase 0

1. **Logo de la óptica** (PNG/SVG con fondo transparente) → para PDFs y header.
2. **Datos fiscales completos:** RUC del propietario/empresa, nombre comercial completo (¿"Óptica Forever Vision" exacto?), dirección formal.
3. **Cuentas bancarias / cooperativas** que querés ver en el sistema (parece que las uso del Excel: Pichincha, Produbanco, JEP Danna, JEP Bryam, Jardín Azuayo, DeUna Danna, Efectivo… ¿alguna más?).
4. **Personal (usuarios iniciales):** nombres, emails y rol de los 5 (vos, Bryam, Danna, ¿optometrista?, ¿otro?).
5. **Categorías de gasto** que querés mantener (las del Excel: Comida, Luz, Agua, Arriendo, Compras, Bisel y Lunas, Motorizado, Personal Bryam, Personal Danna, Otros, Depósito… ¿agrego/quito alguna?).
6. **Numeración inicial:** ¿el nuevo sistema arranca con la numeración existente (ventas en #95, órdenes en #124) o reinicia?
7. **Dominio:** ¿ya tenés uno en mente (`opticaforevervision.com` o similar)?
8. **Forma de pago al laboratorio:** ¿el flujo actual es siempre POR PAGAR → PAGADO o hay pagos al contado?

---

## 8. Próximo paso

Cuando me confirmes los 8 puntos de arriba, arranco con la **Fase 0**:
1. Crear la estructura del repo
2. Levantar `docker-compose` con Postgres + FastAPI + Vite
3. Primer commit con auth, layout y la pantalla de login funcional

¿Le damos verde, o querés ajustar algo del plan?
