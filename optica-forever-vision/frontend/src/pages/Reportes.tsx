import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, AlertTriangle } from "lucide-react"

function todayStr() { return new Date().toISOString().slice(0, 10) }
function firstOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function sixMonthsAgoStr() {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Tab = "ventas" | "cobros" | "inventario" | "ordenes"

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}

function downloadExcel(url: string, filename: string, params?: Record<string, string>) {
  const query = params
    ? "?" + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&")
    : ""
  const token = localStorage.getItem("auth-storage")
  let tok = ""
  try { tok = JSON.parse(token || "{}").state?.token ?? "" } catch { /* */ }
  fetch(`/api/v1${url}${query}`, { headers: { Authorization: `Bearer ${tok}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
    })
}

// ── SVG Bar Chart ──────────────────────────────────────────────────────────────
function BarChart({ data, color = "#0891b2" }: { data: { label: string; value: number }[]; color?: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 560
  const H = 140
  const PAD_L = 52
  const PAD_B = 28
  const chartW = W - PAD_L
  const chartH = H - 8
  const gap = 4
  const barW = Math.max(8, Math.floor((chartW / data.length) - gap))

  return (
    <svg viewBox={`0 0 ${W} ${H + PAD_B}`} className="w-full max-w-2xl">
      {/* y-axis gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = 4 + chartH * (1 - f)
        return (
          <g key={f}>
            <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {fmt(max * f)}
            </text>
          </g>
        )
      })}
      {/* bars */}
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * chartH)
        const x = PAD_L + i * (barW + gap) + gap / 2
        const y = 4 + chartH - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} opacity={0.85} />
            {d.value > 0 && barW > 20 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="#6b7280">
                {fmt(d.value)}
              </text>
            )}
            <text
              x={x + barW / 2} y={H + PAD_B - 4}
              textAnchor="middle" fontSize={9} fill="#6b7280"
              transform={data.length > 8 ? `rotate(-35 ${x + barW / 2} ${H + PAD_B - 4})` : undefined}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Horizontal bar chart for payment methods ───────────────────────────────────
function HBarChart({ data }: { data: [string, number][] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(([, v]) => v), 1)
  const COLORS = ["#0891b2", "#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c"]
  return (
    <div className="space-y-2 max-w-md">
      {data.map(([label, value], i) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          <div className="w-32 text-right text-xs text-muted-foreground capitalize truncate">
            {label.replace(/_/g, " ")}
          </div>
          <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, (value / max) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          </div>
          <div className="w-20 text-xs font-medium">{fmt(value)}</div>
        </div>
      ))}
    </div>
  )
}

// ── group ventas filas by month ────────────────────────────────────────────────
function agruparPorMes(filas: any[]): { label: string; value: number }[] {
  const meses: Record<string, number> = {}
  for (const f of filas) {
    const ym = (f.fecha as string).slice(0, 7)
    meses[ym] = (meses[ym] ?? 0) + f.total
  }
  return Object.entries(meses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ label: k.slice(5) + "/" + k.slice(2, 4), value: v }))
}

// ── Ventas Tab ─────────────────────────────────────────────────────────────────
function TabVentas() {
  const [desde, setDesde] = useState(sixMonthsAgoStr())
  const [hasta, setHasta] = useState(todayStr())

  const { data, isLoading } = useQuery({
    queryKey: ["rep-ventas", desde, hasta],
    queryFn: () =>
      api.get("/reportes/ventas", { params: { desde, hasta } }).then(r => r.data),
  })

  const porMes = data ? agruparPorMes(data.filas) : []

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-sm font-medium">Desde</label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium">Hasta</label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={() => downloadExcel("/reportes/ventas/excel", `ventas_${desde}_${hasta}.xlsx`, { desde, hasta })}>
          <Download className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>

      {isLoading && <div className="flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}

      {data && (
        <>
          <div className="flex gap-6 text-sm">
            <span><strong>{data.cantidad}</strong> ventas</span>
            <span>Total: <strong className="text-green-700">{fmt(data.total)}</strong></span>
          </div>

          {/* Gráfica por mes */}
          {porMes.length > 1 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Ventas por mes</p>
              <BarChart data={porMes} color="#0891b2" />
            </div>
          )}

          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Paciente</th>
                  <th className="text-left px-3 py-2">Cédula</th>
                  <th className="text-right px-3 py-2">Descuento</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{r.numero}</td>
                    <td className="px-3 py-1.5">{r.fecha}</td>
                    <td className="px-3 py-1.5">{r.paciente}</td>
                    <td className="px-3 py-1.5">{r.cedula}</td>
                    <td className="px-3 py-1.5 text-right">{r.descuento > 0 ? fmt(r.descuento) : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmt(r.total)}</td>
                    <td className="px-3 py-1.5">{r.estado}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/40 font-semibold">
                  <td colSpan={5} className="px-3 py-2 text-right">TOTAL</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(data.total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Cobros Tab ─────────────────────────────────────────────────────────────────
function TabCobros() {
  const [desde, setDesde] = useState(firstOfMonthStr())
  const [hasta, setHasta] = useState(todayStr())

  const { data, isLoading } = useQuery({
    queryKey: ["rep-cobros", desde, hasta],
    queryFn: () =>
      api.get("/reportes/cobros", { params: { desde, hasta } }).then(r => r.data),
  })

  const porFormaPago: [string, number][] = data
    ? Object.entries(data.por_forma_pago as Record<string, number>).sort(([, a], [, b]) => b - a)
    : []

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-sm font-medium">Desde</label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium">Hasta</label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={() => downloadExcel("/reportes/cobros/excel", `cobros_${desde}_${hasta}.xlsx`, { desde, hasta })}>
          <Download className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>

      {isLoading && <div className="flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}

      {data && (
        <>
          <div className="flex gap-6 text-sm flex-wrap">
            <span><strong>{data.cantidad}</strong> cobros</span>
            <span>Total: <strong className="text-green-700">{fmt(data.total)}</strong></span>
          </div>

          {/* Gráfica por forma de pago */}
          {porFormaPago.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Cobros por forma de pago</p>
              <HBarChart data={porFormaPago} />
            </div>
          )}

          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Paciente</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-left px-3 py-2">Forma de pago</th>
                  <th className="text-left px-3 py-2">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{r.numero}</td>
                    <td className="px-3 py-1.5">{r.fecha}</td>
                    <td className="px-3 py-1.5">{r.paciente}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{fmt(r.monto)}</td>
                    <td className="px-3 py-1.5">{r.forma_pago}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.referencia || "—"}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/40 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right">TOTAL</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(data.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Inventario Tab ─────────────────────────────────────────────────────────────
function TabInventario() {
  const { data, isLoading } = useQuery({
    queryKey: ["rep-inventario"],
    queryFn: () => api.get("/reportes/inventario").then(r => r.data),
  })

  // top 10 productos por valor de inventario
  const topProductos: { label: string; value: number }[] = data
    ? [...data.filas]
        .sort((a: any, b: any) => b.valor_inventario - a.valor_inventario)
        .slice(0, 10)
        .map((p: any) => ({ label: p.nombre.slice(0, 14), value: p.valor_inventario }))
    : []

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => downloadExcel("/reportes/inventario/excel", "inventario.xlsx")}>
          <Download className="h-4 w-4 mr-1" /> Excel
        </Button>
      </div>

      {isLoading && <div className="flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}

      {data && (
        <>
          <div className="flex gap-6 text-sm flex-wrap">
            <span><strong>{data.total_productos}</strong> productos activos</span>
            <span>Valor inventario: <strong>{fmt(data.valor_total)}</strong></span>
            {data.alertas_stock > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <strong>{data.alertas_stock}</strong> con stock bajo
              </span>
            )}
          </div>

          {topProductos.length > 1 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Top 10 productos por valor en inventario</p>
              <BarChart data={topProductos} color="#0d9488" />
            </div>
          )}

          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">Código</th>
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="text-right px-3 py-2">Stock</th>
                  <th className="text-right px-3 py-2">Mínimo</th>
                  <th className="text-right px-3 py-2">P. Venta</th>
                  <th className="text-right px-3 py-2">P. Costo</th>
                  <th className="text-right px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((p: any) => (
                  <tr
                    key={p.id}
                    className={`border-t hover:bg-muted/20 ${p.alerta ? "bg-red-50" : ""}`}
                  >
                    <td className="px-3 py-1.5 font-mono text-xs">{p.codigo || "—"}</td>
                    <td className="px-3 py-1.5">
                      {p.nombre}
                      {p.alerta && <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-medium ${p.alerta ? "text-red-600" : ""}`}>
                      {p.stock_actual}
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{p.stock_minimo}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.precio_venta)}</td>
                    <td className="px-3 py-1.5 text-right">{p.precio_costo ? fmt(p.precio_costo) : "—"}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(p.valor_inventario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Órdenes Tab ────────────────────────────────────────────────────────────────
function TabOrdenes() {
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [estado, setEstado] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["rep-ordenes", desde, hasta, estado],
    queryFn: () =>
      api.get("/reportes/ordenes", {
        params: { desde: desde || undefined, hasta: hasta || undefined, estado: estado || undefined },
      }).then(r => r.data),
  })

  // conteo por estado
  const porEstado: { label: string; value: number }[] = data
    ? Object.entries(
        (data.filas as any[]).reduce((acc: Record<string, number>, r) => {
          acc[r.estado] = (acc[r.estado] ?? 0) + 1
          return acc
        }, {})
      ).map(([label, value]) => ({ label, value: value as number }))
    : []

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-sm font-medium">Desde</label>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium">Hasta</label>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium">Estado</label>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={estado}
            onChange={e => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {["pendiente", "enviado", "en_proceso", "listo", "entregado", "rechazado"].map(s => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div className="flex gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>}

      {data && (
        <>
          <div className="flex gap-6 text-sm">
            <span><strong>{data.cantidad}</strong> órdenes</span>
            {data.total_lab > 0 && <span>Total lab: <strong>{fmt(data.total_lab)}</strong></span>}
          </div>

          {porEstado.length > 1 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Órdenes por estado</p>
              <HBarChart data={porEstado.map(d => [d.label, d.value] as [string, number])} />
            </div>
          )}

          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Paciente</th>
                  <th className="text-left px-3 py-2">Lab.</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Envío</th>
                  <th className="text-left px-3 py-2">Entrega est.</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-right px-3 py-2">Precio lab</th>
                </tr>
              </thead>
              <tbody>
                {data.filas.map((r: any) => (
                  <tr key={r.numero} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-mono">{r.numero}</td>
                    <td className="px-3 py-1.5">{r.paciente}</td>
                    <td className="px-3 py-1.5">{r.lab_proveedor}</td>
                    <td className="px-3 py-1.5">{r.tipo}</td>
                    <td className="px-3 py-1.5">{r.fecha_envio}</td>
                    <td className="px-3 py-1.5">{r.fecha_entrega_est ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.estado.replace("_", " ")}</td>
                    <td className="px-3 py-1.5 text-right">{r.precio_lab ? fmt(r.precio_lab) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "cobros", label: "Cobros" },
  { key: "inventario", label: "Inventario" },
  { key: "ordenes", label: "Órdenes Lab" },
]

export default function Reportes() {
  const [tab, setTab] = useState<Tab>("ventas")

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "ventas" && <TabVentas />}
        {tab === "cobros" && <TabCobros />}
        {tab === "inventario" && <TabInventario />}
        {tab === "ordenes" && <TabOrdenes />}
      </div>
    </div>
  )
}
