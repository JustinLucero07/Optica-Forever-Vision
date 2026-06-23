import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Download, Loader2, TrendingUp, DollarSign,
  Users, ClipboardList, AlertTriangle, Printer, MessageCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, Line, ComposedChart,
} from "recharts"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useThemeStore } from "@/store/theme"
import { useBrandStore } from "@/store/brand"
import { useAuthStore } from "@/store/auth"
import { Paginador } from "@/components/ui/Paginador"
import { useCountUp } from "@/hooks/useCountUp"
import PrintHeader from "@/components/PrintHeader"
import { enviarControlVisual } from "@/lib/whatsapp"

// ── Helpers ────────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
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
  const tok = useAuthStore.getState().token ?? ""
  fetch(`/api/v1${url}${query}`, { headers: { Authorization: `Bearer ${tok}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
    })
}

const PALETTE = [
  "#7c3aed", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#0d9488", "#9333ea", "#16a34a",
  "#2563eb", "#db2777",
]

// ── Hooks ──────────────────────────────────────────────────────────────────────
function useChartTheme() {
  const dark = useThemeStore(s => s.dark)
  const hex = useBrandStore(s => s.primaryHex)
  return {
    grid: dark ? "#1e293b" : "#e5e7eb",
    tick: dark ? "#64748b" : "#9ca3af",
    tooltipBg: dark ? "#1e2a3a" : "#ffffff",
    tooltipBorder: dark ? "#334155" : "#e5e7eb",
    tooltipText: dark ? "#f1f5f9" : "#111827",
    primary: hex,
  }
}

function FvTooltip({ active, payload, label, isCurrency = true, suffix = "" }: any) {
  const t = useChartTheme()
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border shadow-xl px-3 py-2.5 text-sm min-w-[120px]"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder }}>
      <p className="text-xs font-medium mb-1" style={{ color: t.tick }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: p.color || p.fill }}>{p.name ?? ""}</span>
          <span className="font-bold" style={{ color: p.color || p.fill }}>
            {isCurrency ? fmtUSD(p.value) : `${p.value}${suffix}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl overflow-hidden p-5 anim-fade-up ${className}`}>
      <p className="text-sm font-semibold mb-4">{title}</p>
      {children}
    </div>
  )
}

function MiniKpi({ label, rawValue, formatter, sub, icon: Icon, color, trend }: {
  label: string; rawValue: number; formatter?: (n: number) => string
  sub?: string; icon: React.ElementType; color: string; trend?: number | null
}) {
  const animated = useCountUp(rawValue, 1000)
  const display = formatter ? formatter(animated) : Math.round(animated).toString()
  return (
    <div className="glass rounded-2xl overflow-hidden p-4 flex items-start gap-3 anim-fade-up hover:scale-[1.02] transition-transform duration-200">
      <div className={`p-2.5 rounded-xl shrink-0 shadow-lg ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-black tabular-nums leading-tight">{display}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {trend !== null && trend !== undefined && (
        <div className={`text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full ${trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {trend >= 0 ? "+" : ""}{trend}%
        </div>
      )}
    </div>
  )
}

function VBarChart({ data, isCurrency = true }: { data: { name: string; value: number }[]; isCurrency?: boolean }) {
  const t = useChartTheme()
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="vbarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.primary} stopOpacity={1} />
            <stop offset="100%" stopColor={t.primary} stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={v => isCurrency ? (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`) : String(v)} />
        <Tooltip content={<FvTooltip isCurrency={isCurrency} />} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
        <Bar dataKey="value" fill={`url(#vbarGrad)`} radius={[6, 6, 0, 0]} maxBarSize={52} isAnimationActive animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function HBarChart({ data, isCurrency = false }: { data: { name: string; value: number }[]; isCurrency?: boolean }) {
  const t = useChartTheme()
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
  return (
    <ResponsiveContainer width="100%" height={Math.min(data.length * 42 + 20, 280)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="hbarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false}
          tickFormatter={v => isCurrency ? `$${v}` : String(v)} />
        <YAxis type="category" dataKey="name" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={95} />
        <Tooltip content={<FvTooltip isCurrency={isCurrency} />} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
        <Bar dataKey="value" fill={`url(#hbarGrad)`} radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const t = useChartTheme()
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" isAnimationActive animationDuration={900}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} strokeWidth={0} />)}
        </Pie>
        <Tooltip formatter={(v) => [typeof v === "number" ? fmtUSD(v) : v, ""]}
          contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 12, fontSize: 12 }} />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: t.tick }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Selector de año ────────────────────────────────────────────────────────────
function YearPicker({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  return (
    <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
      <button onClick={() => onChange(year - 1)} disabled={year <= currentYear - 10}
        className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-30">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {years.reverse().map(y => (
        <button key={y} onClick={() => onChange(y)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${year === y ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}>
          {y}
        </button>
      ))}
      <button onClick={() => onChange(year + 1)} disabled={year >= currentYear}
        className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-30">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
type Tab = "anual" | "ventas" | "cobros" | "inventario" | "pacientes" | "inactivos" | "proformas"

const TABS: { id: Tab; label: string }[] = [
  { id: "anual", label: "Vista Anual" },
  { id: "ventas", label: "Ventas" },
  { id: "cobros", label: "Cobros" },
  { id: "proformas", label: "Órdenes Lab" },
  { id: "inventario", label: "Inventario" },
  { id: "pacientes", label: "Pacientes" },
  { id: "inactivos", label: "Inactivos" },
]

export default function Reportes() {
  const [tab, setTab] = useState<Tab>("anual")
  const [year, setYear] = useState(new Date().getFullYear())
  const [desde, setDesde] = useState(sixMonthsAgo())
  const [hasta, setHasta] = useState(today())
  const [pageVentas, setPageVentas] = useState(1)
  const [pageCobros, setPageCobros] = useState(1)
  const [pageInv, setPageInv] = useState(1)
  const [perPageVentas, setPerPageVentas] = useState(15)
  const [perPageCobros, setPerPageCobros] = useState(15)
  const [perPageInv, setPerPageInv] = useState(15)
  const [mesesInactivos, setMesesInactivos] = useState(12)
  const t = useChartTheme()

  const { data: anual, isLoading: anualLoading } = useQuery({
    queryKey: ["reportes-anual", year],
    queryFn: () => api.get("/reportes/anual", { params: { year } }).then(r => r.data),
    staleTime: 120_000,
    enabled: tab === "anual",
  })

  const { data: analytics } = useQuery({
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

  const { data: inventario, isLoading: invLoading, isError: invError, refetch: refetchInv } = useQuery({
    queryKey: ["reportes-inventario"],
    queryFn: () => api.get("/reportes/inventario").then(r => r.data),
    enabled: tab === "inventario",
    staleTime: 60_000,
    refetchOnMount: true,
    retry: 1,
  })

  const { data: proformas, isLoading: proformasLoading } = useQuery({
    queryKey: ["reportes-proformas", desde, hasta],
    queryFn: () => api.get("/reportes/proformas", { params: { desde, hasta } }).then(r => r.data),
    enabled: tab === "proformas",
    staleTime: 30_000,
  })

  const { data: inactivos, isLoading: inactivosLoading } = useQuery({
    queryKey: ["reportes-inactivos", mesesInactivos],
    queryFn: () => api.get("/reportes/pacientes-inactivos", { params: { meses: mesesInactivos } }).then(r => r.data),
    enabled: tab === "inactivos",
    staleTime: 60_000,
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PrintHeader title="Reportes y Estadísticas" subtitle={`Año ${year}`} />

      <div className="flex items-start justify-between gap-4 anim-fade-up no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes & KPIs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análisis completo del negocio por año y período</p>
        </div>
        <div className="flex items-center gap-2">
          {(tab === "anual") && <YearPicker year={year} onChange={y => { setYear(y) }} />}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit overflow-x-auto no-print">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={["px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISTA ANUAL ── */}
      {tab === "anual" && (
        <div className="space-y-6 anim-fade-in">
          {anualLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Calculando KPIs {year}…</div>
          ) : anual && (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniKpi label="Ventas del año" rawValue={anual.totales.ventas} formatter={fmtUSD}
                  sub={`${anual.totales.cant_ventas} ventas · Ticket prom: ${fmtUSD(anual.totales.ticket_promedio)}`}
                  icon={DollarSign} color="bg-gradient-to-br from-blue-500 to-indigo-600" />
                <MiniKpi label="Cobros del año" rawValue={anual.totales.cobros} formatter={fmtUSD}
                  sub={`Egresos: ${fmtUSD(anual.totales.egresos)}`}
                  icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
                <MiniKpi label="Pacientes nuevos" rawValue={anual.totales.pacientes_nuevos}
                  sub={`${anual.totales.consultas} consultas realizadas`}
                  icon={Users} color="bg-gradient-to-br from-violet-500 to-purple-700" />
                <MiniKpi label="Órdenes del año" rawValue={anual.totales.ordenes}
                  sub={`Créditos: ${anual.creditos.cantidad} por ${fmtUSD(anual.creditos.total)}`}
                  icon={ClipboardList} color="bg-gradient-to-br from-amber-500 to-orange-500" />
              </div>

              {/* Resultado neto */}
              <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 anim-fade-up">
                <div>
                  <p className="text-sm text-muted-foreground">Resultado neto {year}</p>
                  <p className={`text-4xl font-black tracking-tight ${anual.totales.resultado >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {fmtUSD(anual.totales.resultado)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cobros {fmtUSD(anual.totales.cobros)} − Egresos {fmtUSD(anual.totales.egresos)}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "Ventas", v: fmtUSD(anual.totales.ventas), color: "text-blue-600" },
                    { label: "Cobros", v: fmtUSD(anual.totales.cobros), color: "text-emerald-600" },
                    { label: "Egresos", v: fmtUSD(anual.totales.egresos), color: "text-amber-600" },
                  ].map(({ label, v, color }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-lg font-bold tabular-nums ${color}`}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gráfica combinada: Cobros + Egresos por mes */}
              <ChartCard title={`Cobros vs Egresos — ${year}`}>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={anual.por_mes} margin={{ top: 8, right: 4, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cobGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="egrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                    <Tooltip content={<FvTooltip isCurrency />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: t.tick }}>{v}</span>} />
                    <Bar dataKey="cobros" name="Cobros" fill="url(#cobGrad)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="egresos" name="Egresos" fill="url(#egrGrad)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Line type="monotone" dataKey="resultado" name="Resultado neto" stroke="#7c3aed"
                      strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Ventas por mes */}
                <ChartCard title={`Ventas por mes — ${year}`}>
                  <VBarChart data={anual.por_mes.map((m: any) => ({ name: m.label, value: m.ventas }))} isCurrency />
                </ChartCard>

                {/* Pacientes + consultas por mes */}
                <ChartCard title={`Pacientes nuevos y consultas — ${year}`}>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={anual.por_mes} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<FvTooltip isCurrency={false} />} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: t.tick }}>{v}</span>} />
                      <Bar dataKey="pacientes_nuevos" name="Pac. nuevos" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line type="monotone" dataKey="consultas" name="Consultas" stroke="#0891b2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Top productos */}
                <ChartCard title={`Top productos — ${year}`}>
                  <HBarChart
                    data={anual.top_productos.slice(0, 8).map((r: any) => ({
                      name: r.nombre.length > 22 ? r.nombre.slice(0, 22) + "…" : r.nombre,
                      value: r.total,
                    }))}
                    isCurrency
                  />
                </ChartCard>

                {/* Métodos de pago */}
                <ChartCard title={`Cobros por método de pago — ${year}`}>
                  {anual.metodos_pago.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <DonutChart data={anual.metodos_pago.map((r: any) => ({ name: r.metodo, value: r.total }))} />
                      <div className="space-y-1.5">
                        {anual.metodos_pago.map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                              <span className="text-xs text-muted-foreground capitalize">{r.metodo}</span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">{fmtUSD(r.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-sm text-muted-foreground py-4">Sin cobros en {year}</p>}
                </ChartCard>

                {/* Egresos por categoría */}
                <ChartCard title={`Egresos por categoría — ${year}`}>
                  <HBarChart
                    data={anual.egresos_por_categoria.map((r: any) => ({
                      name: r.categoria.length > 20 ? r.categoria.slice(0, 20) + "…" : r.categoria,
                      value: r.total,
                    }))}
                    isCurrency
                  />
                </ChartCard>

                {/* Origen pacientes */}
                <ChartCard title={`Origen de nuevos pacientes — ${year}`}>
                  {anual.origen_pacientes.length > 0 ? (
                    <DonutChart data={anual.origen_pacientes.map((r: any) => ({ name: r.origen, value: r.cantidad }))} />
                  ) : <p className="text-sm text-muted-foreground py-4">Sin registros de origen</p>}
                </ChartCard>
              </div>

              {/* Tabla mensual */}
              <div className="glass rounded-2xl overflow-x-auto anim-fade-up">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["Mes", "Ventas", "Cobros", "Egresos", "Resultado", "Pac. nuevos", "Consultas", "Órdenes"].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${h === "Mes" ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {anual.por_mes.map((m: any) => {
                      const esMesActual = m.mes === new Date().getMonth() + 1 && year === new Date().getFullYear()
                      return (
                        <tr key={m.mes} className={`hover:bg-muted/20 transition-colors ${esMesActual ? "bg-primary/5 font-semibold" : ""}`}>
                          <td className="px-4 py-2.5">{m.label} {esMesActual && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded ml-1">actual</span>}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-blue-600">{fmtUSD(m.ventas)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{fmtUSD(m.cobros)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">{fmtUSD(m.egresos)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${m.resultado >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtUSD(m.resultado)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{m.pacientes_nuevos}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{m.consultas}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{m.ordenes}</td>
                        </tr>
                      )
                    })}
                    {/* Totales */}
                    <tr className="bg-muted/50 font-bold border-t-2 border-border">
                      <td className="px-4 py-3 text-sm">TOTAL {year}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-700">{fmtUSD(anual.totales.ventas)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{fmtUSD(anual.totales.cobros)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtUSD(anual.totales.egresos)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums text-lg ${anual.totales.resultado >= 0 ? "text-emerald-700" : "text-destructive"}`}>{fmtUSD(anual.totales.resultado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{anual.totales.pacientes_nuevos}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{anual.totales.consultas}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{anual.totales.ordenes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VENTAS ── */}
      {tab === "ventas" && (
        <div className="space-y-5 anim-fade-in">
          <div className="flex flex-wrap gap-3 items-end">
            <div><label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" /></div>
            <div><label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" /></div>
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/ventas/excel", "ventas.xlsx", { desde, hasta })}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
          {ventasLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : ventas && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total ventas", v: fmtUSD(ventas.total), color: "text-primary" },
                  { label: "Cantidad", v: String(ventas.cantidad), color: "" },
                  { label: "Ticket promedio", v: ventas.cantidad ? fmtUSD(ventas.total / ventas.cantidad) : "—", color: "" },
                ].map(({ label, v, color }) => (
                  <div key={label} className="bg-card border rounded-2xl p-4 text-center anim-fade-up">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{v}</p>
                  </div>
                ))}
              </div>
              {analytics?.ventas_por_mes?.length > 1 && (
                <ChartCard title="Tendencia mensual">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analytics.ventas_por_mes.map((r: any) => ({ name: fmtMes(r.mes), value: r.total }))} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
                      <XAxis dataKey="name" tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: t.tick, fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                      <Tooltip content={<FvTooltip isCurrency />} />
                      <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#vGrad)" dot={false} activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 0 }} isAnimationActive animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
              {analytics?.top_productos?.length > 0 && (
                <ChartCard title="Top productos por ingreso">
                  <HBarChart data={analytics.top_productos.map((r: any) => ({ name: r.nombre.length > 20 ? r.nombre.slice(0, 20) + "…" : r.nombre, value: r.total }))} isCurrency />
                </ChartCard>
              )}
              <div className="glass rounded-2xl overflow-hidden anim-fade-up">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["N°", "Fecha", "Paciente", "Total", "Estado"].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${h === "Total" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ventas.filas.slice((pageVentas - 1) * perPageVentas, pageVentas * perPageVentas).map((v: any, i: number) => (
                      <tr key={v.id} className="hover:bg-muted/30 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{v.numero}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{v.fecha}</td>
                        <td className="px-4 py-2.5">{v.paciente}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtUSD(v.total)}</td>
                        <td className="px-4 py-2.5 capitalize text-muted-foreground">{v.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Paginador page={pageVentas} total={ventas.filas.length} perPage={perPageVentas} onChange={setPageVentas} onPerPageChange={n => { setPerPageVentas(n); setPageVentas(1) }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── COBROS ── */}
      {tab === "cobros" && (
        <div className="space-y-5 anim-fade-in">
          <div className="flex flex-wrap gap-3 items-end">
            <div><label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" /></div>
            <div><label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" /></div>
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/cobros/excel", "cobros.xlsx", { desde, hasta })}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
          {cobrosLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : cobros && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground">Total cobrado</p><p className="text-2xl font-bold text-emerald-500 tabular-nums">{fmtUSD(cobros.total)}</p></div>
                <div className="bg-card border rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground">N° cobros</p><p className="text-2xl font-bold tabular-nums">{cobros.cantidad}</p></div>
              </div>
              {cobros.por_forma_pago && Object.keys(cobros.por_forma_pago).length > 0 && (
                <ChartCard title="Distribución por método de pago">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <DonutChart data={Object.entries(cobros.por_forma_pago as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))} />
                    <div className="space-y-2">
                      {Object.entries(cobros.por_forma_pago as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
                        <div key={k} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="capitalize text-muted-foreground">{k}</span>
                          </div>
                          <span className="font-semibold tabular-nums">{fmtUSD(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>
              )}
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["N°", "Fecha", "Paciente", "Monto", "Método"].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${h === "Monto" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cobros.filas.slice((pageCobros - 1) * perPageCobros, pageCobros * perPageCobros).map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{c.numero}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.fecha}</td>
                        <td className="px-4 py-2.5">{c.paciente}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-500">{fmtUSD(c.monto)}</td>
                        <td className="px-4 py-2.5 capitalize text-muted-foreground">{c.forma_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Paginador page={pageCobros} total={cobros.filas.length} perPage={perPageCobros} onChange={setPageCobros} onPerPageChange={n => { setPerPageCobros(n); setPageCobros(1) }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── INVENTARIO ── */}
      {tab === "inventario" && (
        <div className="space-y-5 anim-fade-in">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => downloadExcel("/reportes/inventario/excel", "inventario.xlsx")}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
          {invLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : invError ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-destructive text-sm">Error al cargar inventario.</p>
              <Button variant="outline" size="sm" onClick={() => refetchInv()}>Reintentar</Button>
            </div>
          ) : inventario ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground">Valor total inventario</p><p className="text-2xl font-bold text-primary tabular-nums">{fmtUSD(inventario.valor_total)}</p></div>
                <div className="bg-card border rounded-2xl p-4 text-center"><p className="text-xs text-muted-foreground">Total productos</p><p className="text-2xl font-bold tabular-nums">{inventario.total_productos}</p></div>
                <div className="bg-card border rounded-2xl p-4 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Stock bajo</p>
                  <p className={`text-2xl font-bold tabular-nums ${inventario.alertas_stock > 0 ? "text-destructive" : "text-emerald-500"}`}>{inventario.alertas_stock}</p>
                </div>
              </div>
              {inventario.alertas_stock > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Productos con stock bajo
                  </h3>
                  <div className="space-y-1.5">
                    {inventario.filas.filter((p: any) => p.alerta).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.nombre}</span>
                        <span className="text-destructive font-medium tabular-nums">Stock: {p.stock_actual} / Mín: {p.stock_minimo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["Producto", "Stock", "Mín", "P. Venta", "Valor inv.", ""].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${["Stock", "Mín", "P. Venta", "Valor inv."].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inventario.filas.slice((pageInv - 1) * perPageInv, pageInv * perPageInv).map((p: any) => (
                      <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${p.alerta ? "bg-destructive/5" : ""}`}>
                        <td className="px-4 py-2.5">{p.nombre}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{p.stock_actual}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{p.stock_minimo}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtUSD(p.precio_venta)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmtUSD(p.valor_inventario)}</td>
                        <td className="px-4 py-2.5">{p.alerta && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">Bajo</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Paginador page={pageInv} total={inventario.filas.length} perPage={perPageInv} onChange={setPageInv} onPerPageChange={n => { setPerPageInv(n); setPageInv(1) }} />
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">Sin productos en inventario</div>
          )}
        </div>
      )}

      {/* ── ÓRDENES LAB / PROFORMAS ── */}
      {tab === "proformas" && (
        <div className="space-y-5 anim-fade-in">
          <div className="flex flex-wrap items-center gap-3 no-print">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
            </div>
          </div>
          {proformasLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : proformas ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-2xl p-4 text-center border-l-4 border-emerald-500">
                  <p className="text-xs text-muted-foreground">Facturado</p>
                  <p className="text-2xl font-bold text-emerald-600 tabular-nums">{fmtUSD(proformas.total_facturado)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{proformas.cant_facturadas} órdenes</p>
                </div>
                <div className="glass rounded-2xl p-4 text-center border-l-4 border-orange-400">
                  <p className="text-xs text-muted-foreground">Proformas (sin facturar)</p>
                  <p className="text-2xl font-bold text-orange-500 tabular-nums">{fmtUSD(proformas.total_proforma)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{proformas.cant_proformas} órdenes</p>
                </div>
                <div className="glass rounded-2xl p-4 text-center border-l-4 border-blue-400">
                  <p className="text-xs text-muted-foreground">Pendientes de facturar</p>
                  <p className="text-2xl font-bold text-blue-500 tabular-nums">{fmtUSD(proformas.total_pendiente)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{proformas.cant_pendientes} órdenes</p>
                </div>
              </div>
              {/* Tabla detalle */}
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["N°", "Paciente", "Tipo", "Lab", "Estado", "Precio venta", "Estado factura"].map(h => (
                        <th key={h} className="px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {proformas.filas.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sin órdenes en el período</td></tr>
                    ) : proformas.filas.map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium">{r.numero}</td>
                        <td className="px-4 py-2.5">{r.paciente}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.tipo}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.lab_proveedor}</td>
                        <td className="px-4 py-2.5 capitalize">{r.estado}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums">{r.precio_venta ? fmtUSD(r.precio_venta) : "—"}</td>
                        <td className="px-4 py-2.5">
                          {r.facturada ? (
                            <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">✓ Facturada</span>
                          ) : r.es_proforma ? (
                            <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">Proforma</span>
                          ) : (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                          )}
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
        <div className="space-y-5 anim-fade-in">
          {!analytics ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ChartCard title="Pacientes nuevos por mes">
                <VBarChart data={(analytics.pacientes_por_mes ?? []).map((r: any) => ({ name: fmtMes(r.mes), value: r.cantidad }))} isCurrency={false} />
              </ChartCard>
              <ChartCard title="¿Cómo nos conocieron?">
                {analytics.pacientes_por_origen?.length > 0 ? (
                  <DonutChart data={analytics.pacientes_por_origen.map((r: any) => ({ name: r.origen, value: r.cantidad }))} />
                ) : <p className="text-sm text-muted-foreground py-4">Sin datos de origen.</p>}
              </ChartCard>
              {analytics.top_productos?.length > 0 && (
                <ChartCard title="Productos más vendidos" className="md:col-span-2">
                  <HBarChart data={analytics.top_productos.slice(0, 8).map((r: any) => ({ name: r.nombre.length > 22 ? r.nombre.slice(0, 22) + "…" : r.nombre, value: r.total }))} isCurrency />
                </ChartCard>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INACTIVOS ── */}
      {tab === "inactivos" && (
        <div className="space-y-5 anim-fade-in">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Sin consulta hace más de (meses)</label>
              <div className="flex items-center gap-2 mt-1">
                {[6, 12, 18, 24].map(m => (
                  <button key={m}
                    className={["px-3 py-1.5 text-sm rounded-lg border transition-all",
                      mesesInactivos === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"].join(" ")}
                    onClick={() => setMesesInactivos(m)}>{m}m</button>
                ))}
                <Input type="number" min="1" max="120" className="w-24 h-9" value={mesesInactivos} onChange={e => setMesesInactivos(Number(e.target.value))} />
              </div>
            </div>
          </div>
          {inactivosLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : inactivos && (
            <>
              <div className="glass rounded-2xl p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Pacientes sin consulta en +{mesesInactivos} meses</p>
                  <p className="text-2xl font-bold">{inactivos.total}</p>
                </div>
              </div>
              {inactivos.total > 0 && (
                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        {["Paciente", "Última consulta", "Inactividad", "Teléfono", ""].map(h => (
                          <th key={h} className={`px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide ${h === "Inactividad" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(inactivos.filas ?? []).map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{p.apellidos} {p.nombres}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.ultima_consulta ?? "Nunca"}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(p.meses_inactivo ?? 999) >= 12 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                              {p.meses_inactivo != null ? `${p.meses_inactivo}m` : "Nunca"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{p.telefono ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {p.telefono && (
                              <button onClick={() => enviarControlVisual(p.telefono, p.nombres, "")}
                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors" title="WhatsApp reactivación">
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {inactivos.total === 0 && <p className="text-muted-foreground text-sm text-center py-8">¡Excelente! No hay pacientes inactivos con ese criterio.</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
