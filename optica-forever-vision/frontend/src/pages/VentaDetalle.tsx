import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Printer } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

function printComprobante(v: Venta, pac: Paciente | null, abonado: number) {
  const pendiente = Math.max(0, Number(v.total) - abonado)
  const nombre = pac ? `${pac.apellidos} ${pac.nombres}` : "—"
  const cedula = pac?.cedula ?? "—"
  const tel = pac?.telefono ?? "—"
  const dir = pac?.direccion ?? "—"
  const mail = pac?.email ?? "—"

  const filas = v.items.map(it => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${it.descripcion}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${it.cantidad}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(it.precio_unitario).toFixed(2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${it.descuento_pct > 0 ? it.descuento_pct + "%" : "—"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${Number(it.subtotal).toFixed(2)}</td>
    </tr>`).join("")

  const descuentoRow = Number(v.descuento) > 0
    ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Descuento:</span><span>-$${Number(v.descuento).toFixed(2)}</span></div>`
    : ""

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Comprobante ${v.numero}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px;max-width:820px;margin:auto}
    .hdr{background:#0891b2;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0}
    .hdr h1{font-size:20px;font-weight:700;letter-spacing:1px}
    .hdr h2{font-size:11px;font-weight:400;margin-top:3px;text-transform:uppercase;letter-spacing:1px}
    .hdr-r{text-align:right}.hdr-r .num{font-size:20px;font-weight:700}
    .info{display:flex;border:1px solid #e5e7eb;border-top:none}
    .logo{width:150px;min-height:80px;border-right:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:11px;padding:10px;flex-shrink:0}
    .datos{flex:1}
    .datos table{width:100%;border-collapse:collapse}
    .datos td{padding:5px 10px;border-bottom:1px solid #f3f4f6;font-size:12px}
    .datos td:first-child{font-weight:600;background:#f9fafb;width:32%;color:#374151}
    .items-tbl{width:100%;border-collapse:collapse;margin-top:10px;border:1px solid #e5e7eb}
    .items-tbl th{background:#0891b2;color:#fff;padding:7px 10px;font-size:12px;text-align:left}
    .items-tbl th.r{text-align:right}.items-tbl th.c{text-align:center}
    .footer{background:#0891b2;color:#fff;padding:12px 20px;border-radius:0 0 4px 4px;margin-top:0}
    .t-row{display:flex;justify-content:flex-end;gap:40px;margin-bottom:5px}
    .t-row .v{min-width:90px;text-align:right;font-weight:600}
    .t-row.big .v{font-size:18px;font-weight:700}
    @media print{body{padding:8px}}
  </style></head><body>
  <div class="hdr">
    <div><h1>ÓPTICA FOREVER VISION</h1><h2>Comprobante de Venta</h2></div>
    <div class="hdr-r">
      <div class="num">${v.numero}</div>
      <div>Fecha: ${fmtDate(v.fecha)}</div>
      <div>Estado: ${v.estado.toUpperCase()}</div>
    </div>
  </div>
  <div class="info">
    <div class="logo">[Logo]</div>
    <div class="datos"><table>
      <tr><td>Paciente</td><td>${nombre}</td></tr>
      <tr><td>Cédula</td><td>${cedula}</td></tr>
      <tr><td>Teléfono</td><td>${tel}</td></tr>
      <tr><td>Dirección</td><td>${dir}</td></tr>
      <tr><td>Correo</td><td>${mail}</td></tr>
      ${v.notas ? `<tr><td>Observaciones</td><td>${v.notas}</td></tr>` : ""}
    </table></div>
  </div>
  <table class="items-tbl">
    <thead><tr>
      <th>Descripción</th>
      <th class="c" style="width:60px">Cant.</th>
      <th class="r" style="width:90px">P. Unitario</th>
      <th class="c" style="width:70px">Desc. %</th>
      <th class="r" style="width:90px">Subtotal</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="footer">
    <div class="t-row"><span>Subtotal:</span><span class="v">$${Number(v.subtotal).toFixed(2)}</span></div>
    ${descuentoRow}
    <div class="t-row big"><span>TOTAL:</span><span class="v">$${Number(v.total).toFixed(2)}</span></div>
    <div class="t-row"><span>Abonado:</span><span class="v">$${abonado.toFixed(2)}</span></div>
    <div class="t-row"><span>Saldo Pendiente:</span><span class="v">$${pendiente.toFixed(2)}</span></div>
  </div>
  <script>window.print();window.onafterprint=()=>window.close();</script>
  </body></html>`

  const w = window.open("", "_blank", "width=860,height=940")
  if (!w) return
  w.document.write(html)
  w.document.close()
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
