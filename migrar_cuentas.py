#!/usr/bin/env python3
"""
Migración del archivo de Cuentas → API Óptica Forever Vision
  INGRESOS  → /cobros   (cobros sin venta, ingreso de caja)
  EGRESOS   → /egresos  (gastos)
  FACTURAS  → /cxp      (cuentas por pagar a proveedores)

Uso:
    python3 migrar_cuentas.py --pass "Admin2026!" --url http://localhost:8001
"""

import argparse, re, sys
from datetime import datetime, date

try:
    import openpyxl, requests
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "openpyxl", "requests", "-q"])
    import openpyxl, requests

# ── Config ────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--url",  default="http://localhost:8001")
parser.add_argument("--user", default="admin@optica.local")
parser.add_argument("--pass", dest="pwd", required=True)
parser.add_argument("--file", default="Cuentas(Recuperado automáticamente)(Recuperado automáticamente)(Recuperado automáticamente).xlsx")
parser.add_argument("--dry",  action="store_true")
args = parser.parse_args()

BASE = args.url.rstrip("/") + "/api/v1"
DRY  = args.dry

COLORS = {"g": "\033[92m", "r": "\033[91m", "y": "\033[93m", "c": "\033[96m", "": ""}
def log(msg, c=""): print(f"{COLORS.get(c,'')}{msg}\033[0m")

def parse_date(val):
    if val is None: return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d") if isinstance(val, datetime) else str(val)
    s = str(val).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except: pass
    return None

def safe_float(v, d=0.0):
    try: return float(str(v).replace(",", "."))
    except: return d

def clean(v):
    if v is None: return None
    s = str(v).strip()
    return None if s in ("", "None", ".", "-") else s

METODOS = {"efectivo", "transferencia", "tarjeta", "cheque", "deposito", "depósito"}
def detect_metodo(*vals):
    for v in vals:
        s = (str(v).strip().lower() if v else "")
        if any(m in s for m in METODOS):
            if "transfer" in s: return "transferencia"
            if "tarjet" in s: return "tarjeta"
            if "chequ" in s: return "cheque"
            if "depos" in s: return "transferencia"
            return "efectivo"
    return "efectivo"

# ── Auth ──────────────────────────────────────────────────────────────────────
log(f"\n🔐 Autenticando en {BASE}...", "c")
resp = requests.post(f"{BASE}/auth/login", json={"email": args.user, "password": args.pwd})
if resp.status_code != 200:
    log(f"❌ Error: {resp.text}", "r"); sys.exit(1)
token = resp.json()["access_token"]
HDR = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
log("✓ Autenticado", "g")

def post(ep, payload):
    if DRY:
        log(f"  [DRY] {ep}: {payload}", "y"); return {"id": 0}
    r = requests.post(f"{BASE}{ep}", json=payload, headers=HDR)
    if r.status_code not in (200, 201):
        log(f"  ⚠ {ep}: {r.status_code} → {r.text[:120]}", "r"); return None
    return r.json()

# ── Cuenta bancaria por defecto ────────────────────────────────────────────────
default_cuenta_id = None
r_cnt = requests.get(f"{BASE}/cuentas-bancarias", headers=HDR)
if r_cnt.status_code == 200 and r_cnt.json():
    default_cuenta_id = r_cnt.json()[0]["id"]
    log(f"  Cuenta: {r_cnt.json()[0]['nombre']} (id={default_cuenta_id})", "c")
else:
    log("❌ No hay cuentas bancarias. Crea una primero en el sistema.", "r"); sys.exit(1)

# ── Leer Excel ────────────────────────────────────────────────────────────────
log(f"\n📖 Leyendo {args.file}...", "c")
wb = openpyxl.load_workbook(args.file, read_only=True, data_only=True, keep_vba=False)

def get_sheet_rows(name, header_row=3):
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    # Fila de cabecera (1-indexed → 0-indexed = header_row-1)
    hrow = [str(v).strip().upper() if v else "" for v in rows[header_row - 1]]
    data = []
    for row in rows[header_row:]:
        if not any(v is not None for v in row): continue
        data.append(list(row))
    return hrow, data

# ─────────────────────────────────────────────────────────────────────────────
# 1. INGRESOS → /cobros
# Columnas: FECHA | NOMBRE | APELLIDO | PRODUCTO | CANTIDAD | PRECIO | INGRESO | DESCRIPCION | ... | TIPO DE PAGO
# ─────────────────────────────────────────────────────────────────────────────
log("\n💵 [1/3] Migrando INGRESOS → Cobros...", "c")
_, ing_rows = get_sheet_rows("INGRESOS", header_row=3)
ok = err = skip = 0

for row in ing_rows:
    fecha  = parse_date(row[0])
    nombre = clean(row[1])
    apell  = clean(row[2]) if len(row) > 2 else None
    prod   = clean(row[3]) if len(row) > 3 else None
    monto  = safe_float(row[6]) if len(row) > 6 else 0  # columna INGRESO (total)

    if not fecha or monto <= 0:
        skip += 1; continue
    # Saltar filas de saldo anterior
    if nombre and "anterior" in nombre.lower():
        skip += 1; continue

    cliente = " ".join(filter(None, [nombre, apell])) or "Cliente"
    concepto = f"{cliente} — {prod or 'Ingreso'}"
    metodo = detect_metodo(*row[7:])

    payload = {
        "cuenta_bancaria_id": default_cuenta_id,
        "fecha":      fecha,
        "concepto":   concepto[:200],
        "monto":      monto,
        "metodo_pago": metodo,
        "notas":      "Importado desde Cuentas.xlsx",
    }
    res = post("/cobros", payload)
    if res and res.get("id"): ok += 1
    else: err += 1

log(f"  ✓ {ok} cobros creados | {err} errores | {skip} omitidos", "g")

# ─────────────────────────────────────────────────────────────────────────────
# 2. EGRESOS → /egresos
# Columnas: FECHA | CUENTA(cat) | DISTRIBUIDOR | CANTIDAD | PRECIO | EGRESO(monto) | DETALLE | MES | AÑO | METODO
# ─────────────────────────────────────────────────────────────────────────────
log("\n📤 [2/3] Migrando EGRESOS → Egresos...", "c")
_, egr_rows = get_sheet_rows("EGRESOS", header_row=3)
ok = err = skip = 0

for row in egr_rows:
    fecha     = parse_date(row[0])
    categoria = clean(row[1]) or "Otros"
    distrib   = clean(row[2]) or ""
    monto     = safe_float(row[5]) if len(row) > 5 else 0
    detalle   = clean(row[6]) if len(row) > 6 else None
    metodo    = detect_metodo(*row[7:])

    if not fecha or monto <= 0:
        skip += 1; continue

    concepto = " — ".join(filter(None, [distrib, detalle])) or categoria

    payload = {
        "cuenta_bancaria_id": default_cuenta_id,
        "fecha":      fecha,
        "categoria":  categoria[:100],
        "concepto":   concepto[:200],
        "monto":      monto,
        "metodo_pago": metodo,
        "notas":      "Importado desde Cuentas.xlsx",
    }
    res = post("/egresos", payload)
    if res and res.get("id"): ok += 1
    else: err += 1

log(f"  ✓ {ok} egresos creados | {err} errores | {skip} omitidos", "g")

# ─────────────────────────────────────────────────────────────────────────────
# 3. FACTURAS → /cxp (cuentas por pagar)
# Columnas: FECHA | CUENTA | DISTRIBUIDOR(proveedor) | TOTAL | DETALLE | NO.DOC | MES | AÑO | TIPO PAGO
# ─────────────────────────────────────────────────────────────────────────────
log("\n🧾 [3/3] Migrando FACTURAS → Cuentas por Pagar...", "c")
_, fac_rows = get_sheet_rows("FACTURAS", header_row=3)
ok = err = skip = 0

for row in fac_rows:
    fecha    = parse_date(row[0])
    proveedor = clean(row[2]) or clean(row[1]) or "Proveedor"
    total    = safe_float(row[3]) if len(row) > 3 else 0
    detalle  = clean(row[4]) if len(row) > 4 else None
    ref      = clean(row[5]) if len(row) > 5 else None

    if not fecha or total <= 0:
        skip += 1; continue

    payload = {
        "proveedor":     proveedor[:200],
        "concepto":      (detalle or f"Factura {ref or ''}").strip()[:200],
        "monto_total":   total,
        "fecha_emision": fecha,
        "referencia":    ref,
        "notas":         "Importado desde Cuentas.xlsx",
    }
    res = post("/cxp", payload)
    if res and res.get("id"): ok += 1
    else: err += 1

log(f"  ✓ {ok} facturas/CxP creadas | {err} errores | {skip} omitidos", "g")

log(f"""
{'='*55}
✅  MIGRACIÓN CUENTAS COMPLETADA
{'='*55}
""", "g")
wb.close()
