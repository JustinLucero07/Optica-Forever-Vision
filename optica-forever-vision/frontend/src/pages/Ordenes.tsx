import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Printer, ChevronDown, MessageCircle, Send } from "lucide-react"
import { enviarOrdenLista } from "@/lib/whatsapp"

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

interface Orden {
  id: number
  numero: string
  paciente_id: number
  consulta_id: number | null
  venta_id: number | null
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

const ESTADOS_ORDEN = ["pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"]

const ESTADO_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "secondary",
  enviado: "default",
  en_proceso: "default",
  listo: "default",
  entregado: "default",
  rechazado: "destructive",
}

const ESTADO_BADGE_CLASS: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  enviado: "bg-blue-100 text-blue-800",
  en_proceso: "bg-purple-100 text-purple-800",
  listo: "bg-green-100 text-green-800",
  entregado: "bg-gray-100 text-gray-700",
  rechazado: "bg-red-100 text-red-700",
}

const TIPOS_ORDEN = [
  "Lentes monofocales",
  "Lentes bifocales",
  "Lentes progresivos",
  "Lentes de contacto",
  "Filtros / antireflejo",
  "Armazón",
  "Reparación",
  "Otro",
]

const EMPTY_FORM = {
  paciente_id: "",
  consulta_id: "",
  venta_id: "",
  lab_proveedor: "",
  lab_telefono: "",
  fecha_envio: toISO(new Date()),
  fecha_entrega_est: "",
  tipo: "Lentes monofocales",
  descripcion: "",
  precio_lab: "",
  notas: "",
}

function EstadoPill({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE_CLASS[estado] ?? "bg-gray-100"}`}>
      {estado.replace("_", " ")}
    </span>
  )
}

function parsePrescripcion(desc: string) {
  const lines = desc.split("\n").map(l => l.trim()).filter(Boolean)
  const get = (prefix: string) => {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return ""
    const ci = line.indexOf(":")
    return ci >= 0 ? line.slice(ci + 1).trim() : ""
  }
  const parseOjo = (text: string) => ({
    esf: text.match(/esf[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    cil: text.match(/cil[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    eje: text.match(/eje[\s:]+(\d+)/i)?.[1] ?? "",
    add: text.match(/add[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    prisma: text.match(/prisma[\s:]+(\S+)/i)?.[1] ?? "",
    dnp: text.match(/dnp[\s:]+(\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    dp: text.match(/\bdp[\s:]+(\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
  })
  return {
    od: parseOjo(get("OD")),
    oi: parseOjo(get("OI")),
    dp: get("DP").replace(/mm/i, "").trim(),
    material: get("Material"),
    tratamiento: get("Tratamiento"),
    diseno: get("Diseño"),
    diagnostico: get("Diagnóstico") || get("Diagnostico"),
    recomendaciones: get("Recomendaciones"),
  }
}

function printOrden(orden: Orden, pacNombre: string) {
  const rx = parsePrescripcion(orden.descripcion)
  const c = (v: string) =>
    `<td style="border:1px solid #ddd;padding:5px 8px;text-align:center;font-size:12px;">${v || "—"}</td>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Orden ${orden.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px}
    .hdr{background:#0891b2;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start;border-radius:4px 4px 0 0}
    .hdr h1{font-size:18px;font-weight:700}
    .hdr h2{font-size:11px;font-weight:400;margin-top:3px;letter-spacing:1px;text-transform:uppercase}
    .hdr-r{text-align:right}.hdr-r .num{font-size:20px;font-weight:700}
    .info{border:1px solid #e5e7eb;border-top:none;display:flex}
    .logo{width:120px;min-height:70px;border-right:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;padding:8px;flex-shrink:0}
    .pac{flex:1;padding:8px 12px;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px}
    .pac .l{color:#6b7280;font-weight:600}
    .sec{background:#f3f4f6;padding:5px 10px;font-weight:700;font-size:11px;border:1px solid #e5e7eb;border-top:none;text-transform:uppercase;letter-spacing:.5px}
    table.rx{width:100%;border-collapse:collapse}
    table.rx th{background:#e0f2fe;border:1px solid #ddd;padding:5px 8px;text-align:center;font-size:11px;font-weight:600}
    table.rx td:first-child{font-weight:700;background:#f0f9ff;text-align:center}
    .extras{display:flex;border:1px solid #e5e7eb;border-top:none}
    .extras>div{flex:1;padding:8px 12px;border-right:1px solid #e5e7eb}
    .extras>div:last-child{border-right:none}
    .extras .l{color:#6b7280;font-size:10px;font-weight:600;text-transform:uppercase;margin-bottom:2px}
    .txt{border:1px solid #e5e7eb;border-top:none;padding:8px 12px}
    .txt .l{font-weight:600;color:#374151}
    pre.rx{background:#f9fafb;border:1px solid #e5e7eb;padding:8px 10px;white-space:pre-wrap;font-size:11px;margin:0}
    .firma{display:flex;justify-content:space-between;margin-top:28px}
    .firma>div{text-align:center;font-size:11px;color:#6b7280}
    .firma .line{border-top:1px solid #111;width:180px;margin:0 auto 4px}
    @media print{body{padding:8px}}
  </style></head><body>
  <div class="hdr">
    <div><h1>ÓPTICA FOREVER VISION</h1><h2>Orden para Lente Convencional</h2></div>
    <div class="hdr-r"><div class="num">${orden.numero}</div><div>${fmtDate(orden.fecha_envio)}</div></div>
  </div>
  <div class="info">
    <div class="logo">[Logo]</div>
    <div class="pac">
      <span class="l">Paciente:</span><span>${pacNombre}</span>
      <span class="l">Laboratorio:</span><span>${orden.lab_proveedor}</span>
      <span class="l">Tipo:</span><span>${orden.tipo}</span>
      <span class="l">Entrega est.:</span><span>${orden.fecha_entrega_est ? fmtDate(orden.fecha_entrega_est) : "—"}</span>
      ${orden.precio_lab ? `<span class="l">Precio lab:</span><span>$${Number(orden.precio_lab).toFixed(2)}</span>` : ""}
    </div>
  </div>
  <div class="sec">Prescripción</div>
  <table class="rx">
    <thead><tr>
      <th style="width:40px"></th>
      <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th>
      <th>PRISMA</th><th>DNP</th><th>DP</th><th>ALT</th>
      <th>AV LEJOS</th><th>AV CERCA</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="border:1px solid #ddd;padding:5px 8px;font-weight:700;text-align:center;background:#f0f9ff;">OD</td>
        ${c(rx.od.esf)}${c(rx.od.cil)}${c(rx.od.eje)}${c(rx.od.add)}
        ${c(rx.od.prisma)}${c(rx.od.dnp)}${c(rx.od.dp || rx.dp)}${c("")}${c("")}${c("")}
      </tr>
      <tr>
        <td style="border:1px solid #ddd;padding:5px 8px;font-weight:700;text-align:center;background:#f0f9ff;">OI</td>
        ${c(rx.oi.esf)}${c(rx.oi.cil)}${c(rx.oi.eje)}${c(rx.oi.add)}
        ${c(rx.oi.prisma)}${c(rx.oi.dnp)}${c(rx.oi.dp || rx.dp)}${c("")}${c("")}${c("")}
      </tr>
    </tbody>
  </table>
  <div class="extras">
    <div><div class="l">Diseño</div>${rx.diseno || "—"}</div>
    <div><div class="l">Tratamiento</div>${rx.tratamiento || "—"}</div>
    <div><div class="l">Material</div>${rx.material || "—"}</div>
  </div>
  ${rx.diagnostico ? `<div class="txt"><span class="l">Diagnóstico: </span>${rx.diagnostico}</div>` : ""}
  ${rx.recomendaciones ? `<div class="txt"><span class="l">Recomendaciones: </span>${rx.recomendaciones}</div>` : ""}
  ${orden.notas ? `<div class="txt"><span class="l">Observaciones: </span>${orden.notas}</div>` : ""}
  <div class="txt" style="margin-top:4px"><span class="l">Descripción completa:</span><br><pre class="rx">${orden.descripcion}</pre></div>
  <div class="firma">
    <div><div class="line"></div>Responsable</div>
    <div><div class="line"></div>Fecha de entrega</div>
    <div><div class="line"></div>Firma paciente</div>
  </div>
  <script>window.print();window.onafterprint=()=>window.close();</script>
  </body></html>`

  const w = window.open("", "_blank", "width=820,height=980")
  if (!w) return
  w.document.write(html)
  w.document.close()
}

function printAceptacion(orden: Orden, pacNombre: string, firma = "") {
  const rx = parsePrescripcion(orden.descripcion)
  const c = (v: string) =>
    `<td style="border:1px solid #ddd;padding:5px 8px;text-align:center;font-size:12px;">${v || "—"}</td>`

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Aceptación ${orden.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}
    .hdr{background:#0891b2;color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-radius:6px 6px 0 0}
    .hdr h1{font-size:18px;font-weight:700}.hdr h2{font-size:11px;font-weight:400;margin-top:3px;text-transform:uppercase;letter-spacing:1px;opacity:.9}
    .hdr-r{text-align:right}.hdr-r .num{font-size:20px;font-weight:700}
    .body{border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 6px 6px}
    .sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#0891b2;border-bottom:1px solid #e0f2fe;padding-bottom:3px;margin:12px 0 6px}
    .row{display:grid;grid-template-columns:160px 1fr;gap:4px;font-size:11px;padding:2px 0}
    .lbl{color:#6b7280;font-weight:600}
    table.rx{width:100%;border-collapse:collapse;margin:6px 0}
    table.rx th{background:#e0f2fe;border:1px solid #ddd;padding:5px 8px;text-align:center;font-size:11px;font-weight:600}
    table.rx td:first-child{font-weight:700;background:#f0f9ff;text-align:center;border:1px solid #ddd;padding:5px 8px}
    .check{display:flex;align-items:center;gap:8px;font-size:11px;margin:5px 0}
    .box{width:14px;height:14px;border:1.5px solid #374151;display:inline-block;flex-shrink:0}
    .sig-row{display:flex;gap:40px;margin-top:32px;justify-content:space-between}
    .sig{flex:1;text-align:center}
    .sig .line{border-top:1px solid #111;margin:0 auto 4px;width:85%}
    .sig p{font-size:10px;color:#6b7280}
    @media print{body{padding:8px}}
  </style></head><body>
  <div class="hdr">
    <div><h1>ÓPTICA FOREVER VISION</h1><h2>Formato de Aceptación — Entrega de Lentes</h2></div>
    <div class="hdr-r"><div class="num">${orden.numero}</div><div>${fmtDate(orden.fecha_envio)}</div></div>
  </div>
  <div class="body">
    <div class="sec">Datos del cliente</div>
    <div class="row"><span class="lbl">Paciente:</span><strong>${pacNombre}</strong></div>
    <div class="row"><span class="lbl">Laboratorio / Proveedor:</span>${orden.lab_proveedor}</div>
    <div class="row"><span class="lbl">Tipo de lente:</span>${orden.tipo}</div>
    <div class="row"><span class="lbl">Fecha de entrega:</span>${new Date().toLocaleDateString("es-EC")}</div>
    ${orden.precio_lab ? `<div class="row"><span class="lbl">Valor:</span>$${Number(orden.precio_lab).toFixed(2)}</div>` : ""}

    <div class="sec">Prescripción entregada</div>
    <table class="rx">
      <thead><tr>
        <th style="width:40px"></th>
        <th>ESF</th><th>CYL</th><th>EJE</th><th>ADD</th><th>DNP</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>OD</td>
          ${c(rx.od.esf)}${c(rx.od.cil)}${c(rx.od.eje)}${c(rx.od.add)}${c(rx.od.dnp || rx.dp)}
        </tr>
        <tr>
          <td>OI</td>
          ${c(rx.oi.esf)}${c(rx.oi.cil)}${c(rx.oi.eje)}${c(rx.oi.add)}${c(rx.oi.dnp || rx.dp)}
        </tr>
      </tbody>
    </table>
    ${rx.material ? `<div class="row"><span class="lbl">Material:</span>${rx.material}</div>` : ""}
    ${rx.tratamiento ? `<div class="row"><span class="lbl">Tratamiento:</span>${rx.tratamiento}</div>` : ""}

    <div class="sec">Conformidad del cliente</div>
    <div class="check"><span class="box"></span> He recibido los lentes en perfectas condiciones y los he probado a mi satisfacción.</div>
    <div class="check"><span class="box"></span> Entiendo que los lentes han sido fabricados con la prescripción indicada y no tienen defecto de fabricación.</div>
    <div class="check"><span class="box"></span> Me han explicado el período de adaptación y los cuidados necesarios.</div>
    <div class="check"><span class="box"></span> Estoy conforme con el producto recibido y no tengo objeción al respecto.</div>

    <div class="sig-row">
      <div class="sig"><div class="line"></div><p>Firma del cliente</p></div>
      <div class="sig"><div class="line"></div><p>Cédula / Documento</p></div>
      <div class="sig">
        ${firma ? `<img src="${firma}" style="height:44px;object-fit:contain;margin-bottom:2px" />` : "<div class=\"line\"></div>"}
        <p>Responsable Óptica Forever Vision</p>
      </div>
    </div>
    <p style="margin-top:16px;font-size:9px;color:#9ca3af;text-align:center">Av. 24 de mayo y Puyo, Cuenca · ${new Date().toLocaleString("es-EC")}</p>
  </div>
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  const w = window.open("", "_blank", "width=780,height=900")
  if (!w) return
  w.document.write(html)
  w.document.close()
}

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
  const fmtOjo = (ojo: ReturnType<typeof parsePrescripcion>["od"]) =>
    [`Esf: ${ojo.esf || "—"}`, `Cil: ${ojo.cil || "—"}`, `Eje: ${ojo.eje || "—"}`, ojo.add ? `Add: ${ojo.add}` : "", ojo.dnp ? `DNP: ${ojo.dnp}` : ""].filter(Boolean).join("  ")

  const msg = [
    `*ÓPTICA FOREVER VISION — Orden ${orden.numero}*`,
    `Fecha: ${fmtDate(orden.fecha_envio)}`,
    `Paciente: ${pacNombre}`,
    `Tipo: ${orden.tipo}`,
    ``,
    `*OD:* ${fmtOjo(rx.od)}`,
    `*OI:* ${fmtOjo(rx.oi)}`,
    rx.dp ? `DP: ${rx.dp}` : "",
    rx.material ? `Material: ${rx.material}` : "",
    rx.tratamiento ? `Tratamiento: ${rx.tratamiento}` : "",
    rx.diseno ? `Diseño: ${rx.diseno}` : "",
    orden.fecha_entrega_est ? `Entrega estimada: ${fmtDate(orden.fecha_entrega_est)}` : "",
    orden.notas ? `Obs: ${orden.notas}` : "",
  ].filter(v => v !== "").join("\n")

  window.open(`https://wa.me/${fmtPhone(tel)}?text=${encodeURIComponent(msg)}`, "_blank")
}

export default function Ordenes() {
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroPaciente, setFiltroPaciente] = useState("")
  const [openForm, setOpenForm] = useState(false)
  const [editOrden, setEditOrden] = useState<Orden | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [estadoDropdown, setEstadoDropdown] = useState<number | null>(null)
  const qc = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 300_000,
  })

  const { data: ordenes = [], isLoading } = useQuery<Orden[]>({
    queryKey: ["ordenes", filtroEstado],
    queryFn: () =>
      api.get("/ordenes", { params: { estado: filtroEstado || undefined, limit: 200 } }).then(r => r.data),
  })

  const { data: pacientes = [] } = useQuery<Paciente[]>({
    queryKey: ["pacientes-mini"],
    queryFn: () => api.get("/pacientes", { params: { limit: 500 } }).then(r => r.data),
  })

  const estadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/ordenes/${id}/estado`, null, { params: { estado } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ordenes"] }); toast.success("Estado actualizado") },
    onError: () => toast.error("Error al actualizar estado"),
  })

  function pacienteNombre(id: number) {
    const p = pacientes.find(p => p.id === id)
    return p ? `${p.apellidos} ${p.nombres}` : `Pac. #${id}`
  }

  function pacienteTelefono(id: number) {
    return pacientes.find(p => p.id === id)?.telefono ?? null
  }

  function openNew() {
    setEditOrden(null)
    setForm({ ...EMPTY_FORM })
    setOpenForm(true)
  }

  function openEdit(o: Orden) {
    setEditOrden(o)
    setForm({
      paciente_id: o.paciente_id.toString(),
      consulta_id: o.consulta_id?.toString() ?? "",
      venta_id: o.venta_id?.toString() ?? "",
      lab_proveedor: o.lab_proveedor,
      lab_telefono: o.lab_telefono ?? "",
      fecha_envio: o.fecha_envio,
      fecha_entrega_est: o.fecha_entrega_est ?? "",
      tipo: o.tipo,
      descripcion: o.descripcion,
      precio_lab: o.precio_lab?.toString() ?? "",
      notas: o.notas ?? "",
    })
    setOpenForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id || !form.lab_proveedor || !form.descripcion || !form.fecha_envio) {
      toast.error("Completa los campos obligatorios")
      return
    }
    setSaving(true)
    try {
      const payload = {
        paciente_id: Number(form.paciente_id),
        consulta_id: form.consulta_id ? Number(form.consulta_id) : null,
        venta_id: form.venta_id ? Number(form.venta_id) : null,
        lab_proveedor: form.lab_proveedor,
        lab_telefono: form.lab_telefono || null,
        fecha_envio: form.fecha_envio,
        fecha_entrega_est: form.fecha_entrega_est || null,
        tipo: form.tipo,
        descripcion: form.descripcion,
        precio_lab: form.precio_lab ? Number(form.precio_lab) : null,
        notas: form.notas || null,
      }
      if (editOrden) {
        await api.put(`/ordenes/${editOrden.id}`, payload)
        toast.success("Orden actualizada")
      } else {
        await api.post("/ordenes", payload)
        toast.success("Orden creada")
      }
      qc.invalidateQueries({ queryKey: ["ordenes"] })
      setOpenForm(false)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const ordenesFiltradas = ordenes.filter(o => {
    if (!filtroPaciente) return true
    return pacienteNombre(o.paciente_id).toLowerCase().includes(filtroPaciente.toLowerCase())
  })

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Órdenes de Trabajo</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nueva orden
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar paciente..."
          className="w-56"
          value={filtroPaciente}
          onChange={e => setFiltroPaciente(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map(s => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2">N°</th>
                <th className="text-left px-4 py-2">Paciente</th>
                <th className="text-left px-4 py-2">Lab.</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Envío</th>
                <th className="text-left px-4 py-2">Entrega est.</th>
                <th className="text-left px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Sin órdenes registradas
                  </td>
                </tr>
              )}
              {ordenesFiltradas.map(o => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono font-medium">{o.numero}</td>
                  <td className="px-4 py-2">{pacienteNombre(o.paciente_id)}</td>
                  <td className="px-4 py-2">{o.lab_proveedor}</td>
                  <td className="px-4 py-2">{o.tipo}</td>
                  <td className="px-4 py-2">{fmtDate(o.fecha_envio)}</td>
                  <td className="px-4 py-2">
                    {o.fecha_entrega_est ? fmtDate(o.fecha_entrega_est) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {/* Estado dropdown */}
                    <div className="relative">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => setEstadoDropdown(estadoDropdown === o.id ? null : o.id)}
                      >
                        <EstadoPill estado={o.estado} />
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </button>
                      {estadoDropdown === o.id && (
                        <div className="absolute z-10 mt-1 bg-white border rounded-md shadow-lg min-w-[130px]">
                          {ESTADOS_ORDEN.map(s => (
                            <button
                              key={s}
                              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                              onClick={() => {
                                estadoMut.mutate({ id: o.id, estado: s })
                                setEstadoDropdown(null)
                              }}
                            >
                              {s.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>Editar</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => printOrden(o, pacienteNombre(o.paciente_id))}
                        title="Imprimir orden para lab"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {(o.estado === "listo" || o.estado === "entregado") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Formato de aceptación"
                          onClick={() => printAceptacion(o, pacienteNombre(o.paciente_id), config?.firma_electronica || "")}
                        >
                          <Printer className="h-4 w-4 text-indigo-600" />
                        </Button>
                      )}
                      {o.lab_telefono && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-700"
                          title="Enviar orden al proveedor por WhatsApp"
                          onClick={() => enviarAlLab(o, pacienteNombre(o.paciente_id))}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {o.estado === "listo" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600"
                          title="Notificar al paciente que su orden está lista"
                          onClick={() => enviarOrdenLista(
                            pacienteTelefono(o.paciente_id),
                            pacienteNombre(o.paciente_id),
                            o.numero
                          )}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FORM DIALOG */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <h2 className="text-lg font-semibold">{editOrden ? `Editar ${editOrden.numero}` : "Nueva orden de trabajo"}</h2>
          </DialogHeader>
          <DialogBody className="space-y-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Laboratorio / Proveedor *</label>
                <Input
                  value={form.lab_proveedor}
                  onChange={e => setForm(f => ({ ...f, lab_proveedor: e.target.value }))}
                  placeholder="Nombre del lab..."
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">WhatsApp del Lab</label>
                <Input
                  value={form.lab_telefono}
                  onChange={e => setForm(f => ({ ...f, lab_telefono: e.target.value }))}
                  placeholder="0999123456"
                />
              </div>
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha envío *</label>
                <Input type="date" value={form.fecha_envio} onChange={e => setForm(f => ({ ...f, fecha_envio: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium">Entrega estimada</label>
                <Input type="date" value={form.fecha_entrega_est} onChange={e => setForm(f => ({ ...f, fecha_entrega_est: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Precio lab ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_lab}
                  onChange={e => setForm(f => ({ ...f, precio_lab: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Descripción / Receta para el lab *</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none font-mono"
                rows={6}
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder={`OD: Esf -1.00 Cil -0.50 Eje 180 ADD +2.00\nOI: Esf -1.25 Cil -0.75 Eje 175 ADD +2.00\nDP: 63mm\nMaterial: Orgánico 1.56\nTratamiento: Antireflejo + UV`}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notas internas</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones, urgencia, color del armazón..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editOrden ? "Guardar cambios" : "Crear orden"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
