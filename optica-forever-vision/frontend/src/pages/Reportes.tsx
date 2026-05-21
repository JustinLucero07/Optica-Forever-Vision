import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, TrendingUp, DollarSign, Users, ClipboardList, Package, AlertTriangle } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ── Helpers ────────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function sixMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function fmtUSD(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}
function fmtMes(ym: string) {
  const [y, m] = ym.split("-")
  const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  return `${meses[+m]} ${y.slice(2)}`
}
function downloadExcel(url: string, filename: string, params?: Record<string, string>) {
  const query = params
    ? "?" + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&")
    : ""
  const token = localStorage.getItem("auth-storage")
  let tok = ""
  try { tok = JSON.parse(token || "{}").state?.token ?? "" } catch { /**/ }
  fetch(`/api/v1${url}${query}`, { headers: { Authorization: `Bearer ${tok}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
    })
}

// ── Charts ─────────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#0891b2", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0d9488", "#9333ea", "#16a34a"]

function BarChart({ data, color = "#0891b2", showValues = true }: {
  data: { label: string; value: number }[]
  color?: string
  showValues?: boolean
}) {
  if (!data.length) return <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 520, H = 160, PL = 8, PB = 32, PT = 20
  const barW = Math.max(8, Math.floor((W - PL * 2) / data.length) - 4)
  const gap = (W - PL * 2 - barW * data.length) / (data.length + 1)
  const chartH = H - PB - PT

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = PT + chartH * (1 - p)
        return (
          <g key={p}>
            <line x1={PL} y1={y} x2={W - PL} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PL - 2} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
              {p === 0 ? "0" : max * p >= 1000 ? `${(max * p / 1000).toFixed(0)}k` : (max * p).toFixed(0)}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / max) * chartH)
        const x = PL + gap + i * (barW + gap)
        const y = PT + chartH - barH
        const label = d.label.length > 6 ? d.label.slice(0, 6) + "…" : d.label
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx="2" opacity="0.9" />
            {showValues && d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">
                {d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function HBarChart({ data, showPct = true }: { data: { label: string; value: number }[]; showPct?: boolean }) {
  if (!data.length) return <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>
  const max = Math.max(...data.map(d => d.value), 1)
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground truncate max-w-[55%]">{d.label}</span>
            <span className="font-semibold tabular-nums">
              {showPct ? `${((d.value / total) * 100).toFixed(0)}%` : d.value}
            </span>
          </div>
          <div className="h-5 bg-muted rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white border rounded-lg p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "ventas" | "cobros" | "inventario" | "pacientes"

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Resumen" },
  { id: "ventas", label: "Ventas" },
  { id: "cobros", label: "Cobros" },
  { id: "inventario", label: "Inventario" },
  { id: "pacientes", label: "Pacientes" },
]

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Reportes() {
  const [tab, setTab] = useState<Tab>("dashboard")
  const [desde, setDesde] = useState(sixMonthsAgo())
  const [hasta, setHasta] = useState(today())

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["reportes-dashboard"],
    queryFn: () => api.get("/reportes/dashboard").then(r => r.data),
    staleTime: 60_000,
  })

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError } = useQuery({
    queryKey: ["reportes-analytics"],
    queryFn: () => api.get("/reportes/analytics").then(r => r.data),
    staleTime: 120_000,
    retry: 1,
  })

  const { data: ventas, isLoading: ventasLoading } = useQuery({
    queryKey: ["reportes-ventas", desde, hasta],
    queryFn: () => api.get("/reportes/ventas", { params: { desde, hasta } }).then(r => r.data),
    enabled: tab === "ventas",
    staleTime: 30_000,
  })

  const { data: cobros, isLoading: cobrosLoading } = useQuery({
    queryKey: ["reportes-cobros", desde, hasta],
    queryFn: () => api.get("/reportes/cobros", { params: { desde, hasta } }).then(r => r.data),
    enabled: tab === "cobros",
    staleTime: 30_000,
  })

  const { data: inventario, isLoading: invLoading } = useQuery({
    queryKey: ["reportes-inventario"],
    queryFn: () => api.get("/reportes/inventario").then(r => r.data),
    enabled: tab === "inventario",
    staleTime: 60_000,
  })

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Reportes</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {kpisLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Ventas del mes" value={fmtUSD(kpis.ventas_mes)} sub={`${kpis.cant_ventas_mes} ventas · Hoy: ${fmtUSD(kpis.ventas_hoy)}`} icon={DollarSign} color="bg-cyan-100 text-cyan-700" />
                <KpiCard label="Cobros del mes" value={fmtUSD(kpis.cobros_mes)} sub={`Egresos: ${fmtUSD(kpis.egresos_mes)}`} icon={TrendingUp} color="bg-green-100 text-green-700" />
                <KpiCard label="Pacientes nuevos" value={String(kpis.pacientes_nuevos_mes)} sub={kpis.mes} icon={Users} color="bg-purple-100 text-purple-700" />
                <KpiCard label="Órdenes activas" value={String(kpis.ordenes_activas)} sub={`${kpis.ordenes_listas} listas para entregar`} icon={ClipboardList} color="bg-orange-100 text-orange-700" />
              </div>

              {analyticsLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando gráficas…
                </div>
              )}
              {analyticsError && (
                <p className="text-sm text-destructive">Error cargando gráficas — intenta recargar la página</p>
              )}

              {!analyticsLoading && !analyticsError && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Ventas por mes (últimos 12 meses)</h3>
                      {(analytics?.ventas_por_mes?.length ?? 0) > 0 ? (
                        <BarChart
                          data={analytics.ventas_por_mes.map((r: any) => ({ label: fmtMes(r.mes), value: r.total }))}
                          color="#0891b2"
                        />
                      ) : <p className="text-sm text-muted-foreground">Sin ventas registradas en el período</p>}
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Órdenes por estado</h3>
                      {(analytics?.ordenes_por_estado?.length ?? 0) > 0 ? (
                        <HBarChart
                          data={analytics.ordenes_por_estado.map((r: any) => ({ label: r.estado.replace("_", " "), value: r.cantidad }))}
                          showPct={false}
                        />
                      ) : <p className="text-sm text-muted-foreground">Sin órdenes registradas</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Top productos más vendidos</h3>
                      {(analytics?.top_productos?.length ?? 0) > 0 ? (
                        <HBarChart
                          data={analytics.top_productos.slice(0, 8).map((r: any) => ({ label: r.nombre, value: r.total }))}
                          showPct={false}
                        />
                      ) : <p className="text-sm text-muted-foreground">Sin productos vendidos aún</p>}
                    </div>
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3">Cobros por método (últimos 90 días)</h3>
                      {(analytics?.cobros_por_metodo?.length ?? 0) > 0 ? (
                        <HBarChart
                          data={analytics.cobros_por_metodo.map((r: any) => ({ label: r.metodo, value: r.total }))}
                          showPct={true}
                        />
                      ) : <p className="text-sm text-muted-foreground">Sin cobros en los últimos 90 días</p>}
                    </div>
                  </div>
                </>
              )}

              <div className="bg-white border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Resultado del mes</p>
                  <p className={`text-2xl font-bold ${kpis.resultado_mes >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmtUSD(kpis.resultado_mes)}
                  </p>
                  <p className="text-xs text-muted-foreground">Cobros − Egresos</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm"><span className="text-muted-foreground">Turnos hoy: </span><strong>{kpis.turnos_hoy}</strong></div>
                  <div className="text-sm"><span className="text-muted-foreground">Ventas pendientes cobro: </span><strong>{kpis.ventas_pendientes_cobro}</strong></div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── VENTAS ── */}
      {tab === "ventas" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/ventas/excel", "ventas.xlsx", { desde, hasta })}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>

          {ventasLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : ventas ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total ventas</p>
                  <p className="text-2xl font-bold text-cyan-700">{fmtUSD(ventas.total)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Cantidad</p>
                  <p className="text-2xl font-bold">{ventas.cantidad}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Ticket promedio</p>
                  <p className="text-2xl font-bold">{ventas.cantidad ? fmtUSD(ventas.total / ventas.cantidad) : "—"}</p>
                </div>
              </div>

              {analytics?.ventas_por_mes?.length > 1 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Tendencia mensual</h3>
                  <BarChart
                    data={analytics.ventas_por_mes.map((r: any) => ({ label: fmtMes(r.mes), value: r.total }))}
                    color="#0891b2"
                  />
                </div>
              )}

              {analytics?.top_productos?.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Top 10 productos por ingreso</h3>
                  <HBarChart
                    data={analytics.top_productos.map((r: any) => ({ label: r.nombre, value: r.total }))}
                    showPct={false}
                  />
                </div>
              )}

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">N°</th>
                      <th className="text-left px-4 py-2 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium">Paciente</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                      <th className="text-left px-4 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ventas.filas.map((v: any) => (
                      <tr key={v.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">{v.numero}</td>
                        <td className="px-4 py-2 text-muted-foreground">{v.fecha}</td>
                        <td className="px-4 py-2">{v.paciente}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmtUSD(v.total)}</td>
                        <td className="px-4 py-2 capitalize">{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── COBROS ── */}
      {tab === "cobros" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/cobros/excel", "cobros.xlsx", { desde, hasta })}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>

          {cobrosLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : cobros ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total cobrado</p>
                  <p className="text-2xl font-bold text-green-700">{fmtUSD(cobros.total)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">N° cobros</p>
                  <p className="text-2xl font-bold">{cobros.cantidad}</p>
                </div>
              </div>

              {cobros.por_forma_pago && Object.keys(cobros.por_forma_pago).length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Distribución por método de pago</h3>
                  <HBarChart
                    data={Object.entries(cobros.por_forma_pago as Record<string, number>)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, value]) => ({ label, value }))}
                    showPct={true}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(cobros.por_forma_pago as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs border-b pb-1">
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-semibold">{fmtUSD(v as number)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">N°</th>
                      <th className="text-left px-4 py-2 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium">Paciente</th>
                      <th className="text-right px-4 py-2 font-medium">Monto</th>
                      <th className="text-left px-4 py-2 font-medium">Método</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cobros.filas.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">{c.numero}</td>
                        <td className="px-4 py-2 text-muted-foreground">{c.fecha}</td>
                        <td className="px-4 py-2">{c.paciente}</td>
                        <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtUSD(c.monto)}</td>
                        <td className="px-4 py-2 capitalize">{c.forma_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── INVENTARIO ── */}
      {tab === "inventario" && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/inventario/excel", "inventario.xlsx")}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>

          {invLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : inventario ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Valor total inventario</p>
                  <p className="text-2xl font-bold text-cyan-700">{fmtUSD(inventario.valor_total)}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total productos</p>
                  <p className="text-2xl font-bold">{inventario.total_productos}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Alertas stock bajo</p>
                  <p className={`text-2xl font-bold ${inventario.alertas_stock > 0 ? "text-red-600" : "text-green-600"}`}>{inventario.alertas_stock}</p>
                </div>
              </div>

              {inventario.alertas_stock > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Productos con stock bajo
                  </h3>
                  <div className="space-y-1">
                    {inventario.filas.filter((p: any) => p.alerta).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.nombre}</span>
                        <span className="text-red-600 font-medium">Stock: {p.stock_actual} / Mín: {p.stock_minimo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics?.top_productos?.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Top productos por valor vendido</h3>
                  <BarChart
                    data={analytics.top_productos.slice(0, 10).map((r: any) => ({ label: r.nombre, value: r.total }))}
                    color="#7c3aed"
                  />
                </div>
              )}

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Producto</th>
                      <th className="text-right px-4 py-2 font-medium">Stock</th>
                      <th className="text-right px-4 py-2 font-medium">Mínimo</th>
                      <th className="text-right px-4 py-2 font-medium">P. Venta</th>
                      <th className="text-right px-4 py-2 font-medium">Valor inv.</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventario.filas.map((p: any) => (
                      <tr key={p.id} className={`hover:bg-muted/30 ${p.alerta ? "bg-red-50/50" : ""}`}>
                        <td className="px-4 py-2">{p.nombre}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p.stock_actual}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{p.stock_minimo}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtUSD(p.precio_venta)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtUSD(p.valor_inventario)}</td>
                        <td className="px-4 py-2">
                          {p.alerta && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠ Bajo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── PACIENTES ── */}
      {tab === "pacientes" && (
        <div className="space-y-5">
          {analytics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Pacientes nuevos por mes</h3>
                  {analytics.pacientes_por_mes?.length > 0 ? (
                    <BarChart
                      data={analytics.pacientes_por_mes.map((r: any) => ({ label: fmtMes(r.mes), value: r.cantidad }))}
                      color="#7c3aed"
                      showValues={true}
                    />
                  ) : <p className="text-sm text-muted-foreground">Sin datos</p>}
                </div>

                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">¿Cómo nos conocieron?</h3>
                  {analytics.pacientes_por_origen?.length > 0 ? (
                    <>
                      <HBarChart
                        data={analytics.pacientes_por_origen.map((r: any) => ({ label: r.origen, value: r.cantidad }))}
                        showPct={true}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-1">
                        {analytics.pacientes_por_origen.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{r.origen}</span>
                            <span className="ml-auto font-medium">{r.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sin datos de origen. Asegúrate de completar el campo "Cómo nos conoció" al registrar pacientes.
                    </p>
                  )}
                </div>
              </div>

              {analytics.top_productos?.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Productos más vendidos (por ingreso)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <HBarChart
                      data={analytics.top_productos.slice(0, 5).map((r: any) => ({ label: r.nombre, value: r.total }))}
                      showPct={false}
                    />
                    <div className="space-y-1">
                      {analytics.top_productos.slice(0, 10).map((r: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs border-b pb-1">
                          <span className="truncate max-w-[60%] text-muted-foreground">{r.nombre}</span>
                          <span className="font-semibold">{fmtUSD(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          )}
        </div>
      )}
    </div>
  )
}
