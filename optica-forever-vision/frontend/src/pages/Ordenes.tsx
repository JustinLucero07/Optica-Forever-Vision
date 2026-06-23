import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useLocation, useNavigate } from "react-router-dom"
import { Paginador } from "@/components/ui/Paginador"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Printer, ChevronDown, MessageCircle, Send, Trash2, PlusCircle, Tag, LayoutGrid, List, Zap } from "lucide-react"
import { enviarOrdenLista } from "@/lib/whatsapp"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { getMarcaFooter, PDF_BASE_CSS, openPrintWindow, getMarcaLogo, downloadHtmlAsPdf } from "@/lib/pdf"
import { parsePrescripcion } from "@/lib/rx"
import { useBrandStore } from "@/store/brand"

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Proveedor { id: number; nombre: string; tipo: string; telefono: string | null; ruc: string | null }

interface Orden {
  id: number
  numero: string
  paciente_id: number
  consulta_id: number | null
  venta_id: number | null
  proveedor_id: number | null
  lab_proveedor: string
  lab_telefono: string | null
  fecha_envio: string
  fecha_entrega_est: string | null
  fecha_entrega_real: string | null
  estado: string
  tipo: string
  descripcion: string
  precio_lab: number | null
  notas: string | null
  created_at: string
  updated_at: string
}

interface Paciente { id: number; nombres: string; apellidos: string; cedula: string; telefono: string | null }

interface RecetaItem {
  tipo: string
  lc_od_esf: number | null; lc_od_cil: number | null; lc_od_eje: number | null; lc_od_add: number | null
  lc_od_dnp: number | null; lc_oi_esf: number | null; lc_oi_cil: number | null; lc_oi_eje: number | null
  lc_oi_add: number | null; lc_oi_dnp: number | null; tipo_lente: string | null; tipo_armadura: string | null
  cl_od_esf: number | null; cl_od_cil: number | null; cl_od_eje: number | null
  cl_oi_esf: number | null; cl_oi_cil: number | null; cl_oi_eje: number | null
}
interface ConsultaItem {
  id: number; numero: string; fecha: string; diagnostico: string | null
  rx_od_esf: number | null; rx_od_cil: number | null; rx_od_eje: number | null; rx_od_add: number | null
  rx_oi_esf: number | null; rx_oi_cil: number | null; rx_oi_eje: number | null; rx_oi_add: number | null
  recetas: RecetaItem[]
}

interface ProductoMin { id: number; nombre: string; precio_costo: number | null; precio_venta: number | null; stock_actual: number | null }

interface RxOjo { esf: string; cil: string; eje: string; add: string; prisma: string; dnp: string }
const EMPTY_RX_OJO: RxOjo = { esf: "", cil: "", eje: "", add: "", prisma: "", dnp: "" }

interface RxForm {
  od: RxOjo; oi: RxOjo
  dp: string; material: string; tratamiento: string
  diseno: string; diagnostico: string; recomendaciones: string
}
const EMPTY_RX: RxForm = {
  od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO },
  dp: "", material: "", tratamiento: "", diseno: "", diagnostico: "", recomendaciones: "",
}

interface OrdenParte {
  _id: string
  nombre: string
  ojos: "od" | "oi" | "ao"
  fuente: "lab" | "stock"
  proveedor_id: string
  lab_proveedor: string
  lab_telefono: string
  fecha_entrega_est: string
  precio_lab: string
  producto_id: string
}
function newParte(nombre = "Completo"): OrdenParte {
  return {
    _id: Math.random().toString(36).slice(2), nombre, ojos: "ao", fuente: "lab",
    proveedor_id: "", lab_proveedor: "", lab_telefono: "",
    fecha_entrega_est: "", precio_lab: "", producto_id: "",
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ESTADOS_ORDEN = ["pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"]

const ESTADO_BADGE_CLASS: Record<string, string> = {
  pendiente:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  enviado:    "bg-blue-100   text-blue-800   dark:bg-blue-900/60   dark:text-blue-300",
  en_proceso: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300",
  listo:      "bg-green-100  text-green-800  dark:bg-green-900/60  dark:text-green-300",
  entregado:  "bg-slate-200  text-slate-700  dark:bg-slate-700     dark:text-slate-200",
  rechazado:  "bg-red-100    text-red-700    dark:bg-red-900/60    dark:text-red-300",
}

const TIPOS_ORDEN = [
  "Lentes monofocales", "Lentes bifocales", "Lentes progresivos",
  "Lentes de contacto", "Filtros / antireflejo", "Armazón", "Reparación", "Otro",
]

const PARTES_NOMBRES = ["Completo", "OD (ojo derecho)", "OI (ojo izquierdo)", "Ambos ojos", "Armazón", "Lentes de contacto", "Reparación", "Otro"]

const MATERIALES = [
  "Orgánico 1.50", "Orgánico 1.56", "Orgánico 1.60", "Orgánico 1.67", "Orgánico 1.74",
  "Policarbonato", "Trivex", "Cristal", "Otro",
]

const TRATAMIENTOS = [
  "Sin tratamiento", "Antireflejo", "Antireflejo + UV", "Antireflejo + UV + Endurecido",
  "Fotocromático", "Fotocromático + Antireflejo", "Filtro azul", "Filtro azul + Antireflejo",
  "AR + Filtro azul", "Espejado",
]

const DISENOS = [
  "Monofocal", "Bifocal plano", "Bifocal redondo",
  "Progresivo económico", "Progresivo premium", "Progresivo personalizado",
  "Lente contacto suave", "Lente contacto rígido", "Ocupacional", "Otro",
]

const EMPTY_FORM = {
  paciente_id: "",
  tipo: "Lentes monofocales",
  fecha_envio: toISO(new Date()),
  notas: "",
  armazon_ref: "",
  armazon_color: "",
  armazon_talla: "",
  precio_venta: "",
  es_proforma: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function EstadoPill({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE_CLASS[estado] ?? "bg-gray-100 text-gray-700"}`}>
      {estado.replace(/_/g, " ")}
    </span>
  )
}

interface EstadoDropdownPortalProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  estados: string[]
  current: string
  onSelect: (s: string) => void
}
function EstadoDropdownPortal({ anchorEl, open, onClose, estados, current, onSelect }: EstadoDropdownPortalProps) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (open && anchorEl) {
      const r = anchorEl.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width })
    }
  }, [open, anchorEl])

  if (!open) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div
        className="absolute z-[9991] bg-white dark:bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[170px]"
        style={{ top: pos.top, left: pos.left }}
      >
        {estados.map(s => (
          <button
            key={s}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-1.5 transition-colors rounded-lg ${s === current ? "bg-muted" : "hover:bg-muted"}`}
            style={{ width: "calc(100% - 8px)", margin: "0 4px" }}
            onClick={() => { onSelect(s); onClose() }}
          >
            <EstadoPill estado={s} />
            {s === current && <span className="ml-auto text-primary text-xs font-bold">✓</span>}
          </button>
        ))}
      </div>
    </>,
    document.body
  )
}


function rxToDesc(rx: RxForm): string {
  const fmtOjo = (label: string, o: RxOjo) => {
    const parts: string[] = []
    if (o.esf) parts.push(`Esf ${o.esf}`)
    if (o.cil) parts.push(`Cil ${o.cil}`)
    if (o.eje) parts.push(`Eje ${o.eje}`)
    if (o.add) parts.push(`Add ${o.add}`)
    if (o.prisma) parts.push(`Prisma ${o.prisma}`)
    if (o.dnp) parts.push(`DNP ${o.dnp}`)
    return parts.length ? `${label}: ${parts.join("  ")}` : ""
  }
  const lines: string[] = []
  const od = fmtOjo("OD", rx.od); if (od) lines.push(od)
  const oi = fmtOjo("OI", rx.oi); if (oi) lines.push(oi)
  if (rx.dp) lines.push(`DP: ${rx.dp}mm`)
  if (rx.material) lines.push(`Material: ${rx.material}`)
  if (rx.tratamiento) lines.push(`Tratamiento: ${rx.tratamiento}`)
  if (rx.diseno) lines.push(`Diseño: ${rx.diseno}`)
  if (rx.diagnostico) lines.push(`Diagnóstico: ${rx.diagnostico}`)
  if (rx.recomendaciones) lines.push(`Recomendaciones: ${rx.recomendaciones}`)
  return lines.join("\n")
}

function descToRx(desc: string): RxForm {
  const p = parsePrescripcion(desc)
  return {
    od: { esf: p.od.esf, cil: p.od.cil, eje: p.od.eje, add: p.od.add, prisma: p.od.prisma, dnp: p.od.dnp },
    oi: { esf: p.oi.esf, cil: p.oi.cil, eje: p.oi.eje, add: p.oi.add, prisma: p.oi.prisma, dnp: p.oi.dnp },
    dp: p.dp, material: p.material, tratamiento: p.tratamiento, diseno: p.diseno,
    diagnostico: p.diagnostico, recomendaciones: p.recomendaciones,
  }
}

// ─── PDF: Orden para lab ──────────────────────────────────────────────────────
function buildOrdenHtml(orden: Orden, pacNombre: string, logo?: string | null, forPrint = false): string {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtRxVal = (v: string) => {
    if (!v) return "—"
    const n = Number(v.replace(",", "."))
    if (isNaN(n)) return v
    return (n >= 0 ? "+" : "") + n.toFixed(2)
  }
  const c = (v: string) => `<td>${v || "—"}</td>`
  const cr = (v: string) => `<td>${fmtRxVal(v)}</td>`

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Orden ${orden.numero}</title>
  <style>
    ${PDF_BASE_CSS}
    .extras{display:flex;border:1px solid #e5e7eb;border-top:none}
    .extras>div{flex:1;padding:8px 12px;border-right:1px solid #e5e7eb;font-size:11px}
    .extras>div:last-child{border-right:none}
    .extras .l{color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
  </style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Orden de Trabajo — Lente Convencional</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${orden.numero}</div>
      <div class="fecha">${fmtDate(orden.fecha_envio)}</div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section">
      <div class="doc-grid" style="grid-template-columns:130px 1fr 130px 1fr">
        <span class="lbl">Paciente</span><span class="val"><strong>${pacNombre}</strong></span>
        <span class="lbl">Laboratorio</span><span class="val"><strong>${orden.lab_proveedor}</strong></span>
        <span class="lbl">Tipo</span><span class="val">${orden.tipo}</span>
        <span class="lbl">Entrega est.</span><span class="val">${orden.fecha_entrega_est ? fmtDate(orden.fecha_entrega_est) : "—"}</span>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Prescripción</div>
      <table class="rx">
        <thead><tr>
          <th style="width:44px"></th>
          <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th>
          <th>PRISMA</th><th>DNP</th><th>DP</th>
        </tr></thead>
        <tbody>
          <tr>
            <td class="eye">OD</td>
            ${cr(rx.od.esf)}${cr(rx.od.cil)}${c(rx.od.eje)}${cr(rx.od.add)}
            ${c(rx.od.prisma)}${c(rx.od.dnp)}${c(rx.od.dp || rx.dp)}
          </tr>
          <tr>
            <td class="eye">OI</td>
            ${cr(rx.oi.esf)}${cr(rx.oi.cil)}${c(rx.oi.eje)}${cr(rx.oi.add)}
            ${c(rx.oi.prisma)}${c(rx.oi.dnp)}${c(rx.oi.dp || rx.dp)}
          </tr>
        </tbody>
      </table>
    </div>
    <div class="extras">
      <div><div class="l">Diseño del lente</div>${rx.diseno || "—"}</div>
      <div><div class="l">Tratamiento</div>${rx.tratamiento || "—"}</div>
      <div><div class="l">Material</div>${rx.material || "—"}</div>
    </div>
    ${rx.diagnostico ? `<div class="doc-section"><span style="font-weight:600;color:#374151">Diagnóstico: </span>${rx.diagnostico}</div>` : ""}
    ${rx.recomendaciones ? `<div class="doc-section"><span style="font-weight:600;color:#374151">Recomendaciones: </span>${rx.recomendaciones}</div>` : ""}
    ${orden.notas ? `<div class="doc-section"><span style="font-weight:600;color:#374151">Observaciones: </span>${orden.notas}</div>` : ""}
    <div class="doc-section">
      <div class="firma-row">
        <div class="firma-box"><div class="line"></div><p>Responsable óptica</p></div>
        <div class="firma-box"><div class="line"></div><p>Recibido por (lab)</p></div>
        <div class="firma-box"><div class="line"></div><p>Fecha de entrega</p></div>
      </div>
    </div>
  </div>
  ${getMarcaFooter(logo)}
  ${forPrint ? "<script>window.print();window.onafterprint=()=>window.close();</script>" : ""}
  </body></html>`
}

function printOrden(orden: Orden, pacNombre: string, logo?: string | null) {
  openPrintWindow(buildOrdenHtml(orden, pacNombre, logo, true), 820, 900)
}

// ─── PDF: Etiqueta de lente ───────────────────────────────────────────────────
function printEtiqueta(orden: Orden, pacNombre: string) {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtVal = (v: string | null | undefined) => {
    if (v == null || v === "") return null
    const n = parseFloat(v)
    if (isNaN(n)) return v
    return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
  }
  const odParts = [fmtVal(rx.od.esf), fmtVal(rx.od.cil), rx.od.eje ? `x${rx.od.eje}°` : null].filter(Boolean).join(" ")
  const oiParts = [fmtVal(rx.oi.esf), fmtVal(rx.oi.cil), rx.oi.eje ? `x${rx.oi.eje}°` : null].filter(Boolean).join(" ")

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Etiqueta ${orden.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;width:90mm;height:50mm;padding:4mm;display:flex;flex-direction:column;justify-content:center;gap:2mm}
    .num{font-size:18px;font-weight:900;color:#0891b2;letter-spacing:1px}
    .pac{font-size:11px;font-weight:700;text-transform:uppercase}
    .rx{font-size:9px;line-height:1.6;color:#374151}
    .rx span{font-weight:bold;color:#0891b2;margin-right:4px}
    .footer{font-size:8px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:2mm;margin-top:auto}
    @media print{@page{size:90mm 50mm;margin:0}body{padding:4mm}}
  </style></head><body>
  <div class="num">${orden.numero}</div>
  <div class="pac">${pacNombre}</div>
  <div class="rx">
    <div><span>OD:</span>${odParts || "—"}</div>
    <div><span>OI:</span>${oiParts || "—"}</div>
    ${rx.diseno ? `<div><span>Diseño:</span>${rx.diseno}</div>` : ""}
    ${rx.material ? `<div><span>Mat:</span>${rx.material}</div>` : ""}
  </div>
  <div class="footer">Óptica Forever Vision · ${new Date().toLocaleDateString("es-EC")}</div>
  <script>window.print();window.onafterprint=()=>window.close();</script>
  </body></html>`
  const w = window.open("", "_blank", "width=400,height=300")
  if (!w) return
  w.document.write(html)
  w.document.close()
}

// ─── PDF: Aceptación entrega de lentes ───────────────────────────────────────
function printAceptacion(orden: Orden, pacNombre: string, firma = "", logo?: string | null) {
  const rx = parsePrescripcion(orden.descripcion)
  const fmtRxVal2 = (v: string) => { const n = Number(v.replace(",",".")); return !v ? "—" : isNaN(n) ? v : (n>=0?"+":"")+n.toFixed(2) }
  const c = (v: string) => `<td>${v || "—"}</td>`
  const cr = (v: string) => `<td>${fmtRxVal2(v)}</td>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Aceptación ${orden.numero}</title>
  <style>${PDF_BASE_CSS}</style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Formato de Aceptación — Entrega de Lentes</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${orden.numero}</div>
      <div class="fecha">${new Date().toLocaleDateString("es-EC")}</div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section">
      <div class="doc-section-title">Datos del cliente</div>
      <div class="doc-grid">
        <span class="lbl">Paciente</span><span class="val"><strong>${pacNombre}</strong></span>
        <span class="lbl">Lab / Proveedor</span><span class="val">${orden.lab_proveedor}</span>
        <span class="lbl">Tipo de lente</span><span class="val">${orden.tipo}</span>
        <span class="lbl">Fecha de entrega</span><span class="val">${new Date().toLocaleDateString("es-EC")}</span>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Prescripción entregada</div>
      <table class="rx">
        <thead><tr>
          <th style="width:44px"></th>
          <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th><th>PRISMA</th><th>DNP</th>
        </tr></thead>
        <tbody>
          <tr><td class="eye">OD</td>${cr(rx.od.esf)}${cr(rx.od.cil)}${c(rx.od.eje)}${cr(rx.od.add)}${c(rx.od.prisma)}${c(rx.od.dnp || rx.dp)}</tr>
          <tr><td class="eye">OI</td>${cr(rx.oi.esf)}${cr(rx.oi.cil)}${c(rx.oi.eje)}${cr(rx.oi.add)}${c(rx.oi.prisma)}${c(rx.oi.dnp || rx.dp)}</tr>
        </tbody>
      </table>
      <div class="doc-grid" style="margin-top:8px">
        ${rx.material ? `<span class="lbl">Material</span><span class="val">${rx.material}</span>` : ""}
        ${rx.tratamiento ? `<span class="lbl">Tratamiento</span><span class="val">${rx.tratamiento}</span>` : ""}
        ${rx.diseno ? `<span class="lbl">Diseño</span><span class="val">${rx.diseno}</span>` : ""}
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">Conformidad del cliente</div>
      <div class="check-item"><span class="check-box"></span> He recibido los lentes en perfectas condiciones y los he probado a mi satisfacción.</div>
      <div class="check-item"><span class="check-box"></span> Entiendo que los lentes han sido fabricados con la prescripción indicada y no presentan defecto de fabricación.</div>
      <div class="check-item"><span class="check-box"></span> Me han explicado el período de adaptación y los cuidados necesarios.</div>
      <div class="check-item"><span class="check-box"></span> Estoy conforme con el producto recibido y no tengo objeción al respecto.</div>
    </div>
    <div class="doc-section">
      <div class="firma-row">
        <div class="firma-box"><div class="line"></div><p>Firma del cliente</p></div>
        <div class="firma-box"><div class="line"></div><p>Cédula / Documento</p></div>
        <div class="firma-box">
          ${firma ? `<img src="${firma}" />` : `<div class="line"></div>`}
          <p>Responsable Óptica Forever Vision</p>
        </div>
      </div>
    </div>
  </div>
  ${getMarcaFooter(logo)}
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  openPrintWindow(html, 780, 920)
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
function fmtPhone(tel: string) {
  const digits = tel.replace(/\D/g, "")
  if (digits.startsWith("593")) return digits
  if (digits.startsWith("0")) return "593" + digits.slice(1)
  return "593" + digits
}

function enviarAlLab(orden: Orden, pacNombre: string) {
  const tel = orden.lab_telefono
  if (!tel) return
  const rx = parsePrescripcion(orden.descripcion)
  const esUrgente = /urgente|urgencia/i.test(orden.notas ?? "")
  const ojosMatch = /Ojo:\s*(od|oi|ao)/i.exec(orden.notas ?? "")
  const ojos = (ojosMatch?.[1]?.toLowerCase() ?? "ao") as "od" | "oi" | "ao"

  const notasLimpias = (orden.notas ?? "")
    .split("|").map(s => s.trim())
    .filter(s => s && !/^(Ojo:|Fuente:|Producto:)/i.test(s))
    .join(" | ")

  const fmtOjo = (label: string, ojo: ReturnType<typeof parsePrescripcion>["od"]) => {
    const parts = [`ESF: ${ojo.esf || "pl"}`, `CIL: ${ojo.cil || "pl"}`]
    if (ojo.eje) parts.push(`EJE: ${ojo.eje}`)
    if (ojo.add) parts.push(`ADD: +${ojo.add}`)
    if (ojo.prisma) parts.push(`PRIS: ${ojo.prisma}`)
    if (ojo.dnp) parts.push(`DNP: ${ojo.dnp}mm`)
    return `${label}: ${parts.join("  ")}`
  }

  const rxLineas: string[] = []
  if (ojos === "od" || ojos === "ao") rxLineas.push(fmtOjo("OD", rx.od))
  if (ojos === "oi" || ojos === "ao") rxLineas.push(fmtOjo("OI", rx.oi))
  if (rx.dp) rxLineas.push(`DP: ${rx.dp}mm`)

  const lineas = [
    esUrgente ? "🔴 URGENTE 🔴" : "",
    `*OPTICA FOREVER VISION*`,
    `Orden: *${orden.numero}*  |  Fecha: ${fmtDate(orden.fecha_envio)}`,
    orden.fecha_entrega_est ? `Entrega solicitada: *${fmtDate(orden.fecha_entrega_est)}*` : "",
    ``,
    `Paciente: *${pacNombre}*`,
    `Tipo: ${orden.tipo}`,
    rx.material ? `Material: ${rx.material}` : "",
    rx.tratamiento ? `Tratamiento: ${rx.tratamiento}` : "",
    rx.diseno ? `Diseño: ${rx.diseno}` : "",
    ``,
    `*PRESCRIPCION:*`,
    ...rxLineas,
    ``,
    rx.diagnostico ? `Diagnostico: ${rx.diagnostico}` : "",
    notasLimpias ? `Notas: ${notasLimpias}` : "",
    ``,
    `Confirmar recepcion y tiempo de entrega, gracias.`,
    `Optica Forever Vision`,
  ].filter(v => v !== "")

  // Abrir WhatsApp con el texto
  window.open(`https://wa.me/${fmtPhone(tel)}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank")

  // Generar y descargar el PDF para adjuntar en el chat
  const logo = useBrandStore.getState().logo
  const htmlPdf = buildOrdenHtml(orden, pacNombre, logo)
  downloadHtmlAsPdf(htmlPdf, `${orden.numero}.pdf`)
    .then(() => {
      // toast shown separately so it appears after the download starts
    })
    .catch(console.error)
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Ordenes() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroPaciente, setFiltroPaciente] = useState("")
  const [vistaKanban, setVistaKanban] = useState(false)
  const [page, setPage] = useState(1)
  const [PER_PAGE, setPER_PAGE] = useState(20)
  const [openForm, setOpenForm] = useState(false)
  const [editOrden, setEditOrden] = useState<Orden | null>(null)
  const [form, setForm] = useState(() => {
    const pre = (location.state as any)?.fromPresupuesto
    if (pre) return { ...EMPTY_FORM, paciente_id: pre.paciente_id ? String(pre.paciente_id) : "", notas: pre.notas ?? "" }
    return { ...EMPTY_FORM }
  })
  const [rx, setRx] = useState<RxForm>({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
  const [partes, setPartes] = useState<OrdenParte[]>([newParte()])
  const [saving, setSaving] = useState(false)
  const [estadoDropdown, setEstadoDropdown] = useState<number | null>(null)
  const estadoAnchorRef = useRef<HTMLElement | null>(null)
  const [consultaSelId, setConsultaSelId] = useState("")
  const [fuenteRx, setFuenteRx] = useState<"refraccion" | "lentes" | "contacto">("refraccion")
  const qc = useQueryClient()

  const brandLogo = useBrandStore(s => s.logo)

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 300_000,
  })
  const waCloudEnabled = config?.wa_mode === "cloud_api"

  const { data: ordenes = [], isLoading } = useQuery<Orden[]>({
    queryKey: ["ordenes", filtroEstado],
    queryFn: () =>
      api.get("/ordenes", { params: { estado: filtroEstado || undefined, limit: 200 } }).then(r => r.data),
  })

  const { data: pacientes = [] } = useQuery<Paciente[]>({
    queryKey: ["pacientes-mini"],
    queryFn: () => api.get("/pacientes", { params: { limit: 500 } }).then(r => r.data),
  })

  const { data: proveedores = [] } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => api.get("/proveedores", { params: { activo: true } }).then(r => r.data),
  })

  const { data: consultasDePaciente = [] } = useQuery<ConsultaItem[]>({
    queryKey: ["consultas-paciente", form.paciente_id],
    queryFn: () => api.get(`/pacientes/${form.paciente_id}/consultas`).then(r => r.data),
    enabled: !!form.paciente_id && openForm,
    staleTime: 60_000,
  })

  const { data: productosMini = [] } = useQuery<ProductoMin[]>({
    queryKey: ["productos-mini"],
    queryFn: () => api.get("/productos", { params: { limit: 500 } }).then(r => r.data),
    staleTime: 120_000,
  })

  const estadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/ordenes/${id}/estado`, null, { params: { estado } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Estado actualizado") },
    onError: () => toast.error("Error al actualizar estado"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/ordenes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Orden eliminada y stock repuesto") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al eliminar orden"),
  })

  const waApiMut = useMutation({
    mutationFn: (id: number) => api.post(`/ordenes/${id}/whatsapp-lab`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Orden enviada al lab por WhatsApp ✓") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al enviar WhatsApp"),
  })

  function pacienteNombre(id: number) {
    const p = pacientes.find(p => p.id === id)
    return p ? `${p.apellidos} ${p.nombres}` : `Pac. #${id}`
  }

  function pacienteTelefono(id: number) {
    return pacientes.find(p => p.id === id)?.telefono ?? null
  }

  function cargarDesdeConsulta(id: string, fuente?: typeof fuenteRx) {
    setConsultaSelId(id)
    const c = consultasDePaciente.find(c => c.id === Number(id))
    if (!c) return
    const src = fuente ?? fuenteRx
    const fmtN = (v: number | null | undefined) => v != null ? String(v) : ""
    if (src === "refraccion") {
      setRx(r => ({
        ...r,
        od: { esf: fmtN(c.rx_od_esf), cil: fmtN(c.rx_od_cil), eje: fmtN(c.rx_od_eje), add: fmtN(c.rx_od_add), prisma: "", dnp: "" },
        oi: { esf: fmtN(c.rx_oi_esf), cil: fmtN(c.rx_oi_cil), eje: fmtN(c.rx_oi_eje), add: fmtN(c.rx_oi_add), prisma: "", dnp: "" },
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Refracción cargada")
    } else if (src === "lentes") {
      const lc = c.recetas?.find(r => r.tipo === "lente_convencional")
      if (!lc) { toast.warning("Esta consulta no tiene receta de lentes convencionales"); return }
      setRx(r => ({
        ...r,
        od: { esf: fmtN(lc.lc_od_esf), cil: fmtN(lc.lc_od_cil), eje: fmtN(lc.lc_od_eje), add: fmtN(lc.lc_od_add), prisma: "", dnp: fmtN(lc.lc_od_dnp) },
        oi: { esf: fmtN(lc.lc_oi_esf), cil: fmtN(lc.lc_oi_cil), eje: fmtN(lc.lc_oi_eje), add: fmtN(lc.lc_oi_add), prisma: "", dnp: fmtN(lc.lc_oi_dnp) },
        diseno: lc.tipo_lente ?? r.diseno,
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Receta de lentes convencionales cargada")
    } else if (src === "contacto") {
      const cl = c.recetas?.find(r => r.tipo === "contactologia")
      if (!cl) { toast.warning("Esta consulta no tiene receta de contactología"); return }
      setRx(r => ({
        ...r,
        od: { esf: fmtN(cl.cl_od_esf), cil: fmtN(cl.cl_od_cil), eje: fmtN(cl.cl_od_eje), add: "", prisma: "", dnp: "" },
        oi: { esf: fmtN(cl.cl_oi_esf), cil: fmtN(cl.cl_oi_cil), eje: fmtN(cl.cl_oi_eje), add: "", prisma: "", dnp: "" },
        diagnostico: c.diagnostico ?? r.diagnostico,
      }))
      toast.success("Receta de contactología cargada")
    }
  }

  useEffect(() => {
    const pre = (location.state as any)?.fromPresupuesto
    if (pre) {
      setEditOrden(null)
      setRx({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
      setPartes([newParte()])
      setConsultaSelId("")
      setOpenForm(true)
    }
    const ft = (location.state as any)?.fromTurno
    if (ft) {
      setEditOrden(null)
      setForm(f => ({ ...f, paciente_id: ft.paciente_id ? String(ft.paciente_id) : "" }))
      setPartes([newParte()])
      setOpenForm(true)
    }
    const fc = (location.state as any)?.fromConsulta
    if (fc) {
      const fmtN = (v: number | null | undefined) => v != null ? String(v) : ""
      setEditOrden(null)
      setForm(f => ({ ...f, paciente_id: fc.paciente_id ? String(fc.paciente_id) : "" }))
      setRx({
        ...EMPTY_RX,
        od: { esf: fmtN(fc.od?.esf), cil: fmtN(fc.od?.cil), eje: fmtN(fc.od?.eje), add: fmtN(fc.od?.add), prisma: "", dnp: "" },
        oi: { esf: fmtN(fc.oi?.esf), cil: fmtN(fc.oi?.cil), eje: fmtN(fc.oi?.eje), add: fmtN(fc.oi?.add), prisma: "", dnp: "" },
        diagnostico: fc.diagnostico || "",
      })
      setConsultaSelId(String(fc.consulta_id))
      setPartes([newParte()])
      setOpenForm(true)
    }
  }, [])

  function openNew() {
    setEditOrden(null)
    setForm({ ...EMPTY_FORM })
    setRx({ ...EMPTY_RX, od: { ...EMPTY_RX_OJO }, oi: { ...EMPTY_RX_OJO } })
    setPartes([newParte()])
    setConsultaSelId("")
    setFuenteRx("refraccion")
    setOpenForm(true)
  }

  function openEdit(o: Orden) {
    setEditOrden(o)
    setRx(descToRx(o.descripcion))
    setForm({
      paciente_id: o.paciente_id.toString(),
      tipo: o.tipo,
      fecha_envio: o.fecha_envio,
      notas: o.notas ?? "",
      armazon_ref: (o as any).armazon_ref ?? "",
      armazon_color: (o as any).armazon_color ?? "",
      armazon_talla: (o as any).armazon_talla ?? "",
      precio_venta: (o as any).precio_venta?.toString() ?? "",
      es_proforma: (o as any).es_proforma ?? false,
    })
    const ojosGuardado = /Ojo:\s*(od|oi|ao)/i.exec(o.notas ?? "")?.[1] as "od" | "oi" | "ao" | undefined
    setPartes([{
      _id: "edit",
      nombre: "Completo",
      ojos: ojosGuardado ?? "ao",
      fuente: o.lab_proveedor === "Stock propio" ? "stock" : "lab",
      proveedor_id: o.proveedor_id?.toString() ?? "",
      lab_proveedor: o.lab_proveedor,
      lab_telefono: o.lab_telefono ?? "",
      fecha_entrega_est: o.fecha_entrega_est ?? "",
      precio_lab: o.precio_lab?.toString() ?? "",
      producto_id: "",
    }])
    setOpenForm(true)
  }

  function setParteField(id: string, field: keyof OrdenParte, value: string) {
    setPartes(ps => ps.map(p => p._id === id ? { ...p, [field]: value } : p))
  }

  function handleParteProveedorChange(pid: string, parteId: string) {
    const prov = proveedores.find(p => p.id === Number(pid))
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      proveedor_id: pid,
      lab_proveedor: prov ? prov.nombre : p.lab_proveedor,
      lab_telefono: prov?.telefono ?? p.lab_telefono,
    } : p))
  }

  function handleParteProductoChange(productoId: string, parteId: string) {
    const prod = productosMini.find(p => p.id === Number(productoId))
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      producto_id: productoId,
      precio_lab: prod?.precio_costo != null ? String(prod.precio_costo) : p.precio_lab,
    } : p))
    // Auto-fill precio_venta from product if not already set
    if (prod?.precio_venta != null && Number(prod.precio_venta) > 0 && !form.precio_venta) {
      setForm(f => ({ ...f, precio_venta: String(prod.precio_venta) }))
    }
  }

  function handleParteFuente(fuente: "lab" | "stock", parteId: string) {
    setPartes(ps => ps.map(p => p._id === parteId ? {
      ...p,
      fuente,
      lab_proveedor: fuente === "stock" ? "Stock propio" : (p.lab_proveedor === "Stock propio" ? "" : p.lab_proveedor),
      lab_telefono: fuente === "stock" ? "" : p.lab_telefono,
    } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id) { toast.error("Selecciona el paciente"); return }
    if (partes.some(p => p.fuente === "lab" && !p.lab_proveedor)) {
      toast.error("Ingresa el nombre del laboratorio en cada parte de tipo 'Laboratorio'"); return
    }

    const descripcion = rxToDesc(rx) || "—"
    setSaving(true)
    try {
      const extraFields = {
        armazon_ref: form.armazon_ref || null,
        armazon_color: form.armazon_color || null,
        armazon_talla: form.armazon_talla || null,
        precio_venta: form.precio_venta ? Number(form.precio_venta) : null,
        es_proforma: form.es_proforma,
      }
      if (editOrden) {
        const parte = partes[0]
        const labProv = parte.fuente === "stock" ? "Stock propio" : parte.lab_proveedor
        await api.put(`/ordenes/${editOrden.id}`, {
          paciente_id: Number(form.paciente_id),
          consulta_id: consultaSelId ? Number(consultaSelId) : editOrden.consulta_id ?? null,
          tipo: form.tipo,
          descripcion,
          fecha_envio: form.fecha_envio,
          notas: form.notas || null,
          proveedor_id: parte.proveedor_id ? Number(parte.proveedor_id) : null,
          lab_proveedor: labProv,
          lab_telefono: parte.fuente === "stock" ? null : (parte.lab_telefono || null),
          fecha_entrega_est: parte.fecha_entrega_est || null,
          precio_lab: parte.precio_lab ? Number(parte.precio_lab) : null,
          ...extraFields,
        })
        toast.success("Orden actualizada")
      } else {
        for (const parte of partes) {
          const labProv = parte.fuente === "stock" ? "Stock propio" : parte.lab_proveedor
          const prodNombre = parte.producto_id ? productosMini.find(p => p.id === Number(parte.producto_id))?.nombre : null
          await api.post("/ordenes", {
            paciente_id: Number(form.paciente_id),
            consulta_id: consultaSelId ? Number(consultaSelId) : null,
            tipo: form.tipo,
            descripcion,
            fecha_envio: form.fecha_envio,
            notas: [form.notas, `Ojo: ${parte.ojos}`, parte.fuente === "stock" ? "Fuente: Stock propio" : null, prodNombre ? `Producto: ${prodNombre}` : null].filter(Boolean).join(" | ") || null,
            proveedor_id: parte.proveedor_id ? Number(parte.proveedor_id) : null,
            lab_proveedor: labProv,
            lab_telefono: parte.fuente === "stock" ? null : (parte.lab_telefono || null),
            fecha_entrega_est: parte.fecha_entrega_est || null,
            precio_lab: parte.precio_lab ? Number(parte.precio_lab) : null,
            producto_id: parte.fuente === "stock" && parte.producto_id ? Number(parte.producto_id) : null,
            ...extraFields,
          })
        }
        toast.success(partes.length > 1 ? `${partes.length} órdenes creadas` : "Orden creada")
      }
      qc.invalidateQueries({ queryKey: ["ordenes"] })
      setOpenForm(false)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const ordenesFiltradas = ordenes.filter(o =>
    !filtroPaciente || pacienteNombre(o.paciente_id).toLowerCase().includes(filtroPaciente.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Órdenes de Trabajo</h1>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva orden</Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Buscar paciente..."
          className="w-56"
          value={filtroPaciente}
          onChange={e => setFiltroPaciente(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filtroEstado}
          onChange={e => { setPage(1); setFiltroEstado(e.target.value) }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 border rounded-md overflow-hidden">
          <button onClick={() => setVistaKanban(false)} title="Vista lista"
            className={`p-2 transition-colors ${!vistaKanban ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setVistaKanban(true)} title="Vista Kanban"
            className={`p-2 transition-colors ${vistaKanban ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vistaKanban ? (
        /* ── Vista Kanban ── */
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ESTADOS_ORDEN.map(estado => {
            const cols = ordenesFiltradas.filter(o => o.estado === estado)
            return (
              <div key={estado} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{estado.replace("_", " ")}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ESTADO_BADGE_CLASS[estado] ?? "bg-muted text-muted-foreground"}`}>{cols.length}</span>
                </div>
                <div className="space-y-2">
                  {cols.length === 0 && (
                    <div className="border border-dashed rounded-lg py-6 text-center text-xs text-muted-foreground">Vacío</div>
                  )}
                  {cols.map(o => (
                    <div key={o.id} className="bg-card border rounded-xl p-3 shadow-sm space-y-1.5 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{o.numero}</span>
                        <EstadoPill estado={o.estado} />
                      </div>
                      <p className="text-xs font-medium text-foreground truncate">{pacienteNombre(o.paciente_id)}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.tipo}</p>
                      <p className="text-xs text-muted-foreground">{o.lab_proveedor}</p>
                      <div className="flex gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(o)}>Editar</Button>
                        {o.lab_telefono && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-blue-600"
                              title="WhatsApp manual" onClick={() => enviarAlLab(o, pacienteNombre(o.paciente_id))}>
                              <Send className="h-3 w-3" />
                            </Button>
                            {waCloudEnabled && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600"
                                title="Enviar via Cloud API" disabled={waApiMut.isPending}
                                onClick={() => waApiMut.mutate(o.id)}>
                                <Zap className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">N°</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Paciente</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Lab.</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Envío</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Entrega est.</th>
                <th className="text-left px-4 py-2 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Sin órdenes registradas</td></tr>
              )}
              {ordenesFiltradas.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((o, i) => (
                <tr key={o.id} className="border-t hover:bg-muted/30 table-row-anim" style={{ animationDelay: `${i * 25}ms` }}>
                  <td className="px-4 py-2 font-mono font-medium">
                    {o.numero}
                    {(o as any).es_proforma && (
                      <span className="ml-1.5 text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-1.5 py-0.5 rounded-full border border-orange-200 dark:border-orange-700">PROFORMA</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{pacienteNombre(o.paciente_id)}</td>
                  <td className="px-4 py-2">{o.lab_proveedor}</td>
                  <td className="px-4 py-2">{o.tipo}</td>
                  <td className="px-4 py-2">{fmtDate(o.fecha_envio)}</td>
                  <td className="px-4 py-2">{o.fecha_entrega_est ? fmtDate(o.fecha_entrega_est) : "—"}</td>
                  <td className="px-4 py-2">
                    <button
                      className="flex items-center gap-1 rounded-lg hover:bg-muted/60 px-1.5 py-1 transition-colors"
                      onClick={e => {
                        estadoAnchorRef.current = e.currentTarget
                        setEstadoDropdown(estadoDropdown === o.id ? null : o.id)
                      }}
                    >
                      <EstadoPill estado={o.estado} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <EstadoDropdownPortal
                      anchorEl={estadoDropdown === o.id ? estadoAnchorRef.current : null}
                      open={estadoDropdown === o.id}
                      onClose={() => setEstadoDropdown(null)}
                      estados={ESTADOS_ORDEN}
                      current={o.estado}
                      onSelect={s => {
                        const IRREVERSIBLES = ["entregado", "rechazado"]
                        if (IRREVERSIBLES.includes(s) && !window.confirm(`¿Cambiar estado a "${s}"? Esta acción es difícil de revertir.`)) return
                        estadoMut.mutate({ id: o.id, estado: s })
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
                      <Button variant="ghost" size="sm" title="Imprimir orden" onClick={() => printOrden(o, pacienteNombre(o.paciente_id), brandLogo)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Imprimir etiqueta de lente" onClick={() => printEtiqueta(o, pacienteNombre(o.paciente_id))}>
                        <Tag className="h-4 w-4" />
                      </Button>
                      {(o.estado === "listo" || o.estado === "entregado") && (
                        <Button
                          variant="ghost" size="sm" title="Formato de aceptación"
                          onClick={() => printAceptacion(o, pacienteNombre(o.paciente_id), config?.firma_electronica || "", brandLogo)}
                        >
                          <Printer className="h-4 w-4 text-indigo-600" />
                        </Button>
                      )}
                      {o.lab_telefono && (
                        <>
                          <Button
                            variant="ghost" size="sm" className="text-blue-700"
                            title="Abrir WhatsApp (texto manual)"
                            onClick={() => enviarAlLab(o, pacienteNombre(o.paciente_id))}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {waCloudEnabled && (
                            <Button
                              variant="ghost" size="sm" className="text-emerald-600"
                              title="Enviar directamente via WhatsApp Cloud API"
                              disabled={waApiMut.isPending}
                              onClick={() => waApiMut.mutate(o.id)}
                            >
                              {waApiMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            </Button>
                          )}
                        </>
                      )}
                      {o.estado === "listo" && (
                        <Button
                          variant="ghost" size="sm" className="text-green-600"
                          title="Notificar al paciente"
                          onClick={() => enviarOrdenLista(pacienteTelefono(o.paciente_id), pacienteNombre(o.paciente_id), o.numero)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {!o.venta_id && !(o as any).es_proforma && o.estado !== "rechazado" && (
                        <Button
                          variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 font-medium text-xs"
                          title="Crear venta desde esta orden"
                          onClick={() => navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })}
                        >
                          $ Facturar
                        </Button>
                      )}
                      {o.venta_id && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2">✓ Facturada</span>
                      )}
                      {!o.venta_id && (
                        <Button
                          variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          title="Eliminar orden"
                          onClick={() => {
                            if (confirm(`¿Eliminar orden ${o.numero}? Si era de stock, se repone la unidad.`)) {
                              deleteMut.mutate(o.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginador page={page} total={ordenesFiltradas.length} perPage={PER_PAGE} onChange={setPage} onPerPageChange={n => { setPER_PAGE(n); setPage(1) }} />
        </div>
      )
      }

      {/* FORM DIALOG */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} className="max-w-4xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <h2 className="text-lg font-semibold">
              {editOrden ? `Editar ${editOrden.numero}` : "Nueva orden de trabajo"}
            </h2>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {/* Datos básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Paciente *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.paciente_id}
                  onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))}
                  required
                >
                  <option value="">— Seleccionar paciente —</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.apellidos} {p.nombres} — {p.cedula}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                >
                  {TIPOS_ORDEN.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha envío *</label>
                <Input type="date" value={form.fecha_envio} onChange={e => setForm(f => ({ ...f, fecha_envio: e.target.value }))} required />
              </div>
            </div>

            {/* Cargar desde consulta */}
            {!editOrden && form.paciente_id && (
              <div className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50/60 dark:bg-cyan-950/20 dark:border-cyan-800 px-4 py-3">
                <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">
                  Cargar prescripción desde consulta
                </span>
                {consultasDePaciente.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Este paciente no tiene consultas registradas</p>
                ) : (
                  <>
                    {/* Fuente */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-700 dark:text-cyan-300 shrink-0">Fuente:</span>
                      <div className="flex rounded-md border border-cyan-300 overflow-hidden text-xs font-medium">
                        {([
                          { key: "refraccion", label: "Refracción" },
                          { key: "lentes", label: "Lentes conv." },
                          { key: "contacto", label: "Contactología" },
                        ] as const).map((opt, i) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={`px-3 py-1 transition-colors ${i > 0 ? "border-l border-cyan-300" : ""} ${fuenteRx === opt.key ? "bg-cyan-600 text-white" : "bg-white/50 text-cyan-700 hover:bg-cyan-100 dark:bg-transparent dark:text-cyan-300"}`}
                            onClick={() => {
                              setFuenteRx(opt.key)
                              if (consultaSelId) cargarDesdeConsulta(consultaSelId, opt.key)
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Selector de consulta */}
                    <select
                      className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
                      value={consultaSelId}
                      onChange={e => cargarDesdeConsulta(e.target.value)}
                    >
                      <option value="">— Seleccionar consulta —</option>
                      {consultasDePaciente.map(c => {
                        const lc = c.recetas?.find(r => r.tipo === "lente_convencional")
                        const cl = c.recetas?.find(r => r.tipo === "contactologia")
                        const preview = fuenteRx === "refraccion"
                          ? [c.rx_od_esf != null ? `OD: ${Number(c.rx_od_esf) >= 0 ? "+" : ""}${c.rx_od_esf}` : "",
                             c.rx_oi_esf != null ? `OI: ${Number(c.rx_oi_esf) >= 0 ? "+" : ""}${c.rx_oi_esf}` : ""].filter(Boolean).join(" / ")
                          : fuenteRx === "lentes"
                          ? lc ? [lc.lc_od_esf != null ? `OD: ${Number(lc.lc_od_esf) >= 0 ? "+" : ""}${lc.lc_od_esf}` : "",
                                   lc.lc_oi_esf != null ? `OI: ${Number(lc.lc_oi_esf) >= 0 ? "+" : ""}${lc.lc_oi_esf}` : ""].filter(Boolean).join(" / ")
                                : "sin receta LC"
                          : cl ? [cl.cl_od_esf != null ? `OD: ${Number(cl.cl_od_esf) >= 0 ? "+" : ""}${cl.cl_od_esf}` : "",
                                   cl.cl_oi_esf != null ? `OI: ${Number(cl.cl_oi_esf) >= 0 ? "+" : ""}${cl.cl_oi_esf}` : ""].filter(Boolean).join(" / ")
                                : "sin receta CL"
                        return (
                          <option key={c.id} value={c.id}>
                            {c.numero} — {c.fecha}{preview ? ` | ${preview}` : ""}{c.diagnostico ? ` | ${c.diagnostico}` : ""}
                          </option>
                        )
                      })}
                    </select>
                  </>
                )}
                {consultaSelId && (
                  <p className="text-xs text-cyan-600 dark:text-cyan-400">
                    ✓ Prescripción cargada. Cada parte enviará los ojos según su selector OD / OI / Ambos.
                  </p>
                )}
              </div>
            )}

            {/* Prescripción */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 uppercase tracking-wide border-b border-cyan-100">
                Prescripción / Receta
              </div>
              <div className="p-4 space-y-4">
                {/* Tabla OD/OI */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600">
                        <th className="border p-2 font-semibold w-12 text-center">Ojo</th>
                        <th className="border p-2 font-semibold text-center">ESF</th>
                        <th className="border p-2 font-semibold text-center">CIL</th>
                        <th className="border p-2 font-semibold text-center">EJE</th>
                        <th className="border p-2 font-semibold text-center">ADD</th>
                        <th className="border p-2 font-semibold text-center">PRISMA</th>
                        <th className="border p-2 font-semibold text-center">DNP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["od", "oi"] as const).map(ojo => (
                        <tr key={ojo}>
                          <td className="border p-2 font-bold text-center text-cyan-700 bg-cyan-50 uppercase">{ojo}</td>
                          {([
                            { f: "esf",    type: "number", step: "0.25",              placeholder: "±0.00" },
                            { f: "cil",    type: "number", step: "0.25",              placeholder: "±0.00" },
                            { f: "eje",    type: "number", step: "1",   min: "0", max: "180", placeholder: "0–180" },
                            { f: "add",    type: "number", step: "0.25", min: "0",    placeholder: "+0.00" },
                            { f: "prisma", type: "text",                              placeholder: "2Δ BU" },
                            { f: "dnp",    type: "number", step: "0.5",  min: "0",    placeholder: "mm" },
                          ] as { f: keyof RxOjo; type: string; step?: string; min?: string; max?: string; placeholder: string }[]).map(({ f, type, step, min, max, placeholder }) => (
                            <td key={f} className="border p-1">
                              <input
                                type={type}
                                step={step}
                                min={min}
                                max={max}
                                className="w-full px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 rounded"
                                value={rx[ojo][f as keyof RxOjo]}
                                onChange={e => setRx(r => ({ ...r, [ojo]: { ...r[ojo], [f]: e.target.value } }))}
                                placeholder={placeholder}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* DP + Material + Tratamiento + Diseño */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">DP (mm)</label>
                    <Input type="number" step="0.5" min="0" value={rx.dp} onChange={e => setRx(r => ({ ...r, dp: e.target.value }))} placeholder="63" className="text-center mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Material</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                      value={rx.material}
                      onChange={e => setRx(r => ({ ...r, material: e.target.value }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tratamiento</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                      value={rx.tratamiento}
                      onChange={e => setRx(r => ({ ...r, tratamiento: e.target.value }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {TRATAMIENTOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diseño</label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                      value={rx.diseno}
                      onChange={e => setRx(r => ({ ...r, diseno: e.target.value }))}
                    >
                      <option value="">— Seleccionar —</option>
                      {DISENOS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnóstico</label>
                    <Input value={rx.diagnostico} onChange={e => setRx(r => ({ ...r, diagnostico: e.target.value }))} placeholder="Miopía, Astigmatismo..." className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recomendaciones</label>
                    <Input value={rx.recomendaciones} onChange={e => setRx(r => ({ ...r, recomendaciones: e.target.value }))} placeholder="Uso permanente, lectura..." className="mt-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Proveedores / Partes */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-violet-50 px-4 py-2.5 flex items-center justify-between border-b border-violet-100">
                <span className="text-sm font-semibold text-violet-800 uppercase tracking-wide">
                  Proveedores
                  {partes.length > 1 && (
                    <span className="ml-2 text-xs font-normal text-violet-600 normal-case">
                      — se crearán {partes.length} órdenes separadas
                    </span>
                  )}
                </span>
                {!editOrden && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium"
                    onClick={() => setPartes(ps => [...ps, newParte("")])}
                  >
                    <PlusCircle className="h-4 w-4" /> Agregar proveedor
                  </button>
                )}
              </div>
              <div className="p-4 space-y-3">
                {partes.map((parte) => (
                  <div key={parte._id} className={`rounded-lg border p-3 space-y-2 ${parte.fuente === "stock" ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-900/40"}`}>
                    {/* Header: nombre parte + fuente toggle + eliminar */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {partes.length > 1 ? (
                        <select
                          className="border rounded-md px-2 py-1 text-xs bg-background font-semibold"
                          value={parte.nombre}
                          onChange={e => setParteField(parte._id, "nombre", e.target.value)}
                        >
                          {PARTES_NOMBRES.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 uppercase">Datos del proveedor</span>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {/* Ojos selector */}
                        <div className="flex rounded-md border overflow-hidden text-xs font-medium">
                          {(["od", "oi", "ao"] as const).map((o, i) => (
                            <button
                              key={o}
                              type="button"
                              className={`px-2.5 py-1 transition-colors ${i > 0 ? "border-l" : ""} ${parte.ojos === o ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                              onClick={() => setParteField(parte._id, "ojos", o)}
                            >
                              {o === "ao" ? "Ambos" : o.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        {/* Fuente toggle */}
                        <div className="flex rounded-md border overflow-hidden text-xs font-medium">
                          <button
                            type="button"
                            className={`px-2.5 py-1 transition-colors ${parte.fuente === "lab" ? "bg-violet-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            onClick={() => handleParteFuente("lab", parte._id)}
                          >
                            Lab
                          </button>
                          <button
                            type="button"
                            className={`px-2.5 py-1 transition-colors border-l ${parte.fuente === "stock" ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            onClick={() => handleParteFuente("stock", parte._id)}
                          >
                            Stock
                          </button>
                        </div>
                        {partes.length > 1 && (
                          <button type="button" className="text-red-400 hover:text-red-600 ml-1" onClick={() => setPartes(ps => ps.filter(p => p._id !== parte._id))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Producto del inventario */}
                    <div>
                      <label className="text-xs text-slate-500">
                        {parte.fuente === "stock" ? "Producto del inventario *" : "Producto del inventario (opcional)"}
                      </label>
                      <select
                        className="w-full border rounded-md px-2 py-1.5 text-sm bg-background mt-0.5"
                        value={parte.producto_id}
                        onChange={e => handleParteProductoChange(e.target.value, parte._id)}
                      >
                        <option value="">— Sin producto vinculado —</option>
                        {productosMini.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} — Stock: {Math.floor(p.stock_actual ?? 0)} | Costo: ${(p.precio_costo ?? 0).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Campos de lab (ocultos si fuente=stock) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {parte.fuente === "lab" && (
                        <>
                          <div>
                            <label className="text-xs text-slate-500">Proveedor del sistema</label>
                            <select
                              className="w-full border rounded-md px-2 py-1.5 text-sm bg-background mt-0.5"
                              value={parte.proveedor_id}
                              onChange={e => handleParteProveedorChange(e.target.value, parte._id)}
                            >
                              <option value="">— Texto libre —</option>
                              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Lab / Nombre *</label>
                            <Input
                              value={parte.lab_proveedor}
                              onChange={e => setParteField(parte._id, "lab_proveedor", e.target.value)}
                              placeholder="Nombre del laboratorio"
                              className="mt-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">WhatsApp lab</label>
                            <Input
                              value={parte.lab_telefono}
                              onChange={e => setParteField(parte._id, "lab_telefono", e.target.value)}
                              placeholder="0999123456"
                              className="mt-0.5"
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <label className="text-xs text-slate-500">Entrega estimada</label>
                        <Input
                          type="date"
                          value={parte.fecha_entrega_est}
                          onChange={e => setParteField(parte._id, "fecha_entrega_est", e.target.value)}
                          className="mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">
                          {parte.fuente === "stock" ? "Precio costo ($)" : "Precio lab ($)"}
                        </label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={parte.precio_lab}
                          onChange={e => setParteField(parte._id, "precio_lab", e.target.value)}
                          placeholder="0.00"
                          className="mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Armazón */}
            <div className="border rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Armazón</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Referencia / Modelo</label>
                  <Input
                    placeholder="Ej: Ray-Ban RB3025"
                    value={form.armazon_ref}
                    onChange={e => setForm(f => ({ ...f, armazon_ref: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Color</label>
                  <Input
                    placeholder="Ej: Negro mate"
                    value={form.armazon_color}
                    onChange={e => setForm(f => ({ ...f, armazon_color: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Talla</label>
                  <Input
                    placeholder="Ej: 52-18-140"
                    value={form.armazon_talla}
                    onChange={e => setForm(f => ({ ...f, armazon_talla: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Precios y proforma */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Precio de venta al cliente ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.precio_venta}
                  onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.es_proforma}
                    onChange={e => setForm(f => ({ ...f, es_proforma: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-medium">Marcar como Proforma</span>
                  <span className="text-xs text-muted-foreground">(no genera venta)</span>
                </label>
              </div>
            </div>

            {/* Notas internas */}
            <div>
              <label className="text-sm font-medium">Notas internas</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none mt-1"
                rows={2}
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Urgente, color del armazón, instrucciones especiales..."
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editOrden ? "Guardar cambios" : partes.length > 1 ? `Crear ${partes.length} órdenes` : "Crear orden"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
