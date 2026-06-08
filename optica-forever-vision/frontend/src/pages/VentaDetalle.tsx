import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Printer } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MARCA_FOOTER, PDF_BASE_CSS, openPrintWindow, getMarcaLogo } from "@/lib/pdf"

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

interface VentaItem {
  id: number; descripcion: string; cantidad: number
  precio_unitario: number; descuento_pct: number; subtotal: number
}
interface Venta {
  id: number; numero: string; paciente_id: number | null; fecha: string
  subtotal: number; descuento: number; total: number; estado: string
  notas: string | null; items: VentaItem[]
}
interface Paciente {
  id: number; nombres: string; apellidos: string; cedula: string
  telefono: string | null; email: string | null; direccion: string | null
}
interface Cobro { id: number; monto: number }

async function printComprobante(v: Venta, pac: Paciente | null, abonado: number) {
  const logo = (await import("@/store/brand")).useBrandStore.getState().logo
  const pendiente = Math.max(0, Number(v.total) - abonado)
  const nombre = pac ? `${pac.apellidos} ${pac.nombres}` : "—"
  const cedula = pac?.cedula ?? "—"
  const tel = pac?.telefono ?? "—"
  const dir = pac?.direccion ?? "—"
  const mail = pac?.email ?? "—"

  const filas = v.items.map(it => `
    <tr>
      <td>${it.descripcion}</td>
      <td class="c">${it.cantidad}</td>
      <td class="r">$${Number(it.precio_unitario).toFixed(2)}</td>
      <td class="c">${it.descuento_pct > 0 ? it.descuento_pct + "%" : "—"}</td>
      <td class="r" style="font-weight:600">$${Number(it.subtotal).toFixed(2)}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Comprobante ${v.numero}</title>
  <style>
    ${PDF_BASE_CSS}
    td.r{text-align:right} td.c{text-align:center}
    .totales-box{padding:12px 20px;display:flex;flex-direction:column;align-items:flex-end;gap:3px;border-top:1px solid #e5e7eb}
  </style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Comprobante de Venta</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${v.numero}</div>
      <div class="fecha">Fecha: ${fmtDate(v.fecha)}</div>
      <div class="fecha" style="margin-top:2px">Estado: <strong>${v.estado.toUpperCase()}</strong></div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section">
      <div class="doc-section-title">Datos del Comprador</div>
      <div class="doc-grid">
        <span class="lbl">Nombre</span><span class="val"><strong>${nombre}</strong></span>
        <span class="lbl">Cédula</span><span class="val">${cedula}</span>
        <span class="lbl">Teléfono</span><span class="val">${tel}</span>
        <span class="lbl">Dirección</span><span class="val">${dir}</span>
        ${mail !== "—" ? `<span class="lbl">Correo</span><span class="val">${mail}</span>` : ""}
        ${v.notas ? `<span class="lbl">Observaciones</span><span class="val">${v.notas}</span>` : ""}
      </div>
    </div>
    <table class="items">
      <thead><tr>
        <th>Descripción</th>
        <th class="c" style="width:55px">Cant.</th>
        <th class="r" style="width:85px">P. Unit.</th>
        <th class="c" style="width:65px">Desc.%</th>
        <th class="r" style="width:85px">Subtotal</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="totales-box">
      <div class="t-row" style="min-width:280px"><span>Subtotal:</span><span>$${Number(v.subtotal).toFixed(2)}</span></div>
      ${Number(v.descuento) > 0 ? `<div class="t-row" style="min-width:280px;color:#dc2626"><span>Descuento:</span><span>-$${Number(v.descuento).toFixed(2)}</span></div>` : ""}
      <div class="t-row big" style="min-width:280px"><span>TOTAL:</span><span>$${Number(v.total).toFixed(2)}</span></div>
      <div class="t-row" style="min-width:280px;color:#16a34a"><span>Abonado:</span><span>$${abonado.toFixed(2)}</span></div>
      ${pendiente > 0 ? `<div class="t-row" style="min-width:280px;color:#dc2626"><span>Saldo Pendiente:</span><span>$${pendiente.toFixed(2)}</span></div>` : ""}
    </div>
  </div>
  ${MARCA_FOOTER}
  <script>window.print();window.onafterprint=()=>window.close();</script>
  </body></html>`

  openPrintWindow(html, 860, 960)
}

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", anulado: "destructive", cobrado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estado}</Badge>
}

export default function VentaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: v, isLoading } = useQuery<Venta>({
    queryKey: ["venta", id],
    queryFn: () => api.get(`/ventas/${id}`).then(r => r.data),
  })

  const { data: paciente } = useQuery<Paciente>({
    queryKey: ["paciente", v?.paciente_id],
    queryFn: () => api.get(`/pacientes/${v!.paciente_id}`).then(r => r.data),
    enabled: !!v?.paciente_id,
  })

  const { data: cobros = [] } = useQuery<Cobro[]>({
    queryKey: ["cobros-venta", id],
    queryFn: () => api.get("/cobros", { params: { venta_id: Number(id), limit: 100 } }).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
    </div>
  )
  if (!v) return <div className="p-6 text-destructive">Venta no encontrada</div>

  const abonado = cobros.reduce((s, c) => s + Number(c.monto), 0)
  const pendiente = Math.max(0, Number(v.total) - abonado)
  const nombrePac = paciente ? `${paciente.apellidos} ${paciente.nombres}` : undefined

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Venta <Badge variant="outline">{v.numero}</Badge></h1>
              <EstadoBadge estado={v.estado} />
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(v.fecha)}{nombrePac && ` — ${nombrePac}`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => printComprobante(v, paciente ?? null, abonado)}>
          <Printer className="h-4 w-4 mr-1" /> Comprobante
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Detalle de ítems</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Descripción</th>
                <th className="text-right px-4 py-2 font-medium">Cant.</th>
                <th className="text-right px-4 py-2 font-medium">P. Unit.</th>
                <th className="text-right px-4 py-2 font-medium">Desc. %</th>
                <th className="text-right px-4 py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {v.items.map(it => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5">{it.descripcion}</td>
                  <td className="px-4 py-2.5 text-right">{it.cantidad}</td>
                  <td className="px-4 py-2.5 text-right">${Number(it.precio_unitario).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">{it.descuento_pct > 0 ? `${it.descuento_pct}%` : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">${Number(it.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${Number(v.subtotal).toFixed(2)}</span>
          </div>
          {Number(v.descuento) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Descuento</span><span>-${Number(v.descuento).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1.5">
            <span>Total</span><span>${Number(v.total).toFixed(2)}</span>
          </div>
          {abonado > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Abonado</span><span>${abonado.toFixed(2)}</span>
            </div>
          )}
          {pendiente > 0.01 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Saldo pendiente</span><span>${pendiente.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {v.notas && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Notas:</span> {v.notas}
        </p>
      )}

      {v.paciente_id && (
        <Button variant="link" size="sm" asChild>
          <Link to={`/pacientes/${v.paciente_id}`}>← Ver paciente</Link>
        </Button>
      )}
    </div>
  )
}
