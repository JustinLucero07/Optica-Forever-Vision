import { useQuery } from "@tanstack/react-query"
import { useCountUp } from "@/hooks/useCountUp"
import {
  TrendingUp, DollarSign, ShoppingBag, Clock,
  ClipboardList, Users, ArrowDownCircle, Loader2,
  Package, AlertCircle, TrendingDown,
  Activity, Zap, MessageCircle, Cake, Eye, CreditCard, PackageCheck,
} from "lucide-react"
import {
  enviarCumpleanios, enviarControlVisual,
  enviarOrdenLista, enviarRecordatorioCuota, enviarRecordatorioCita,
} from "@/lib/whatsapp"
import { useNavigate, Link } from "react-router-dom"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts"

import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useThemeStore } from "@/store/theme"
import { useBrandStore } from "@/store/brand"

// ── Alertas types ──────────────────────────────────────────────────────────────
interface Cumpleano { id: number; nombres: string; apellidos: string; telefono: string | null; dias_para: number; es_hoy: boolean }
interface Control { paciente_id: number; nombres: string; apellidos: string; telefono: string | null; proximo_control: string; dias_para: number }
interface TurnoHoy { id: number; paciente_id: number; nombres: string; apellidos: string; telefono: string | null; hora_inicio: string; hora_fin: string | null; motivo: string }
interface CuotaProxima { paciente_id: number | null; nombres: string; apellidos: string; telefono: string | null; credito_numero: string; numero_cuota: number; total_cuotas: number; monto: number; fecha_vencimiento: string; dias_para: number }
interface OrdenSinRetirar { id: number; numero: string; paciente_id: number; nombres: string; apellidos: string; telefono: string | null; dias_esperando: number }
interface AlertasData {
  cumpleanos_proximos: Cumpleano[]
  controles_proximos: Control[]
  turnos_hoy: TurnoHoy[]
  cuotas_proximas: CuotaProxima[]
  ordenes_sin_retirar: OrdenSinRetirar[]
}

interface KPIs {
  ventas_hoy: number; ventas_mes: number; cobros_mes: number; egresos_mes: number
  resultado_mes: number; cant_ventas_mes: number; ventas_pendientes_cobro: number
  turnos_hoy: number; ordenes_activas: number; ordenes_listas: number
  pacientes_nuevos_mes: number; mes: string; cobros_hoy: number
  cuotas_vencidas_count: number; cuotas_vencidas_total: number; stock_bajo_count: number
  ventas_pct: number | null; cobros_pct: number | null
  egresos_pct: number | null; pacientes_pct: number | null
}


const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)

const fmtShort = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`

function fmtMes(ym: string) {
  const [y, m] = ym.split("-")
  const M = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${M[+m]} '${y.slice(2)}`
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ color: string; value: number }>
  label?: string
  isCurrency?: boolean
}
function ChartTooltip({ active, payload, label, isCurrency = true }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-2xl overflow-hidden px-4 py-3 text-sm shadow-2xl">
      <p className="text-muted-foreground text-xs mb-1.5">{label}</p>
      <p className="font-bold text-lg" style={{ color: payload[0].color }}>
        {isCurrency ? fmt(payload[0].value) : payload[0].value}
      </p>
    </div>
  )
}

// ── Live badge ─────────────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-xs font-semibold text-emerald-500">EN VIVO</span>
    </div>
  )
}

// ── Quick stat strip (hoy) ─────────────────────────────────────────────────────
function QuickStat({ label, value, isCurrency, color }: {
  label: string; value: number; isCurrency?: boolean; color: string
}) {
  const animated = useCountUp(value, 800)
  const display = isCurrency ? fmtShort(animated) : Math.round(animated).toString()
  return (
    <div className="glass rounded-2xl overflow-hidden px-4 py-3.5 flex items-center gap-3 anim-fade-up hover:scale-[1.02] transition-transform duration-200">
      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight" style={{ color }}>{display}</p>
      </div>
    </div>
  )
}

// ── Comparativo badge ──────────────────────────────────────────────────────────
function PctBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"}`}>
      {up ? "↑" : "↓"}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ── KPI Card principal ─────────────────────────────────────────────────────────
function KpiCard({
  label, value, isCurrency = false, sub, icon: Icon, color, onClick, delay = 0, pct,
}: {
  label: string; value: number; isCurrency?: boolean; sub?: string
  icon: React.ElementType; color: string; onClick?: () => void; delay?: number; pct?: number | null
}) {
  const animated = useCountUp(value, 1100)
  const display  = isCurrency ? fmt(animated) : Math.round(animated).toString()

  return (
    <div
      className={[
        "anim-fade-up glass rounded-2xl overflow-hidden p-5",
        "transition-all duration-200 hover:-translate-y-1",
        onClick ? "cursor-pointer" : "",
      ].join(" ")}
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 12px 40px ${color}25, 0 0 0 1px ${color}20`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
      onClick={onClick}
    >
      {/* Icon con glow */}
      <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
           style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="h-5 w-5 relative z-10" style={{ color }} />
        <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: `0 0 20px ${color}25` }} />
      </div>

      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end gap-2 flex-wrap">
        <p className="text-2xl font-black leading-tight tracking-tight tabular-nums">{display}</p>
        <PctBadge pct={pct} />
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ── Alert card ─────────────────────────────────────────────────────────────────
function AlertCard({ icon: Icon, title, value, sub, color, onClick }: {
  icon: React.ElementType; title: string; value: string; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <div
      className={`glass rounded-2xl overflow-hidden p-4 flex items-center gap-4 anim-fade-up ${onClick ? "cursor-pointer hover:-translate-y-0.5 transition-transform duration-150" : ""}`}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="font-bold text-lg">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ── Alertas helpers ────────────────────────────────────────────────────────────
function fmtISO(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
function hoyDDMMYYYY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
}
function labelDias(n: number, esHoy?: boolean) {
  if (esHoy || n === 0) return "Hoy"
  if (n === 1) return "Mañana"
  return `En ${n}d`
}

function DiasBadge({ dias, esHoy }: { dias: number; esHoy?: boolean }) {
  const label = labelDias(dias, esHoy)
  const cls = (esHoy || dias === 0)
    ? "bg-rose-500 text-white"
    : dias === 1
    ? "bg-amber-500 text-white"
    : "bg-muted text-muted-foreground"
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cls}`}>{label}</span>
}

function WaBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  if (disabled) return (
    <span title="Sin teléfono registrado"
      className="ml-auto shrink-0 p-1.5 rounded-lg text-muted-foreground/30 cursor-not-allowed">
      <MessageCircle className="h-4 w-4" />
    </span>
  )
  return (
    <button onClick={onClick} title="Enviar WhatsApp"
      className="ml-auto shrink-0 p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
      <MessageCircle className="h-4 w-4" />
    </button>
  )
}

function PacLink({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <Link to={`/pacientes/${id}`} className="truncate flex-1 font-medium hover:text-primary hover:underline underline-offset-2 transition-colors">
      {children}
    </Link>
  )
}

function AlertPanel({ title, icon: Icon, color, count, emptyMsg, children }: {
  title: string; icon: React.ElementType; color: string
  count: number; emptyMsg: string; children?: React.ReactNode
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden p-4 space-y-2 anim-fade-up">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="text-sm font-bold flex-1">{title}</span>
        {count > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: color }}>{count}</span>
        )}
      </div>
      {count === 0
        ? <p className="text-xs text-muted-foreground py-1">{emptyMsg} ✓</p>
        : children}
    </div>
  )
}

function AlertRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs min-w-0">
      {children}
    </div>
  )
}

// ── Kanban constants ───────────────────────────────────────────────────────────
interface OrdenKanban { id: number; numero: string; estado: string; paciente_nombre?: string }

const ESTADOS_KANBAN = ["pendiente", "enviado", "en_proceso", "listo", "entregado"]
const LABEL_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado al Lab",
  en_proceso: "En Proceso",
  listo: "Listo",
  entregado: "Entregado",
}
const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
  enviado: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
  en_proceso: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800",
  listo: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
  entregado: "bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700",
}

// ── Página ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const user    = useAuthStore((s) => s.user)
  const dark    = useThemeStore((s) => s.dark)
  const { primaryHex } = useBrandStore()
  const navigate = useNavigate()

  const { data: kpis, isLoading } = useQuery<KPIs>({
    queryKey: ["dashboard-kpis"],
    queryFn: () => api.get("/reportes/dashboard").then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: cajaHoy } = useQuery<{ ingresos: number; egresos: number; neto: number }>({
    queryKey: ["stats-caja-hoy"],
    queryFn: () => api.get("/stats/caja-hoy").then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: analytics } = useQuery<any>({
    queryKey: ["dashboard-analytics"],
    queryFn: () => api.get("/reportes/analytics").then(r => r.data),
    staleTime: 120_000,
    retry: 1,
  })

  const { data: alertas } = useQuery<AlertasData>({
    queryKey: ["dashboard-alertas"],
    queryFn: () => api.get("/reportes/alertas").then(r => r.data),
    refetchInterval: 300_000,
    staleTime: 120_000,
  })

  const { data: ordenesKanban = [] } = useQuery<OrdenKanban[]>({
    queryKey: ["ordenes-dashboard"],
    queryFn: () => api.get("/ordenes", { params: { limit: 100 } }).then(r => r.data),
    staleTime: 120_000,
  })

  const gridColor = dark ? "#ffffff0f" : "#0000000d"
  const tickColor = dark ? "#475569" : "#94a3b8"

  const ventasMes = (analytics?.ventas_por_mes ?? []).map((r: any) => ({
    name: fmtMes(r.mes), ventas: r.total, cobros: 0,
  }))

  // Mini sparkline para hoy vs ayer (usamos los primeros datos del mes)
  const ordenesData = (analytics?.ordenes_por_estado ?? []).map((r: any) => ({
    name: r.estado.replace("_", " "),
    value: r.cantidad,
  }))

  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches"

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between anim-fade-up">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {saludo},{" "}
            <span style={{ color: primaryHex }}>{user?.full_name?.split(" ")[0]}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {user?.role} · {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveBadge />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-muted-foreground anim-fade-in">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: primaryHex }} />
          Cargando indicadores…
        </div>
      )}

      {kpis && (
        <>
          {/* ── Strip de hoy ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <QuickStat label="Ventas hoy"      value={kpis.ventas_hoy}   isCurrency color={primaryHex} />
            <QuickStat label="Cobros hoy"      value={kpis.cobros_hoy}   isCurrency color="#10b981" />
            <QuickStat label="Turnos hoy"      value={kpis.turnos_hoy}              color="#f59e0b" />
            <QuickStat label="Órdenes activas" value={kpis.ordenes_activas}         color="#8b5cf6" />
            {cajaHoy && (
              <Link to="/caja" className="block">
                <div className="glass rounded-2xl p-4 flex flex-col gap-1 hover:scale-[1.02] transition-transform cursor-pointer">
                  <p className="text-xs text-muted-foreground font-medium">Neto del día</p>
                  <p className={`text-xl font-black tabular-nums ${cajaHoy.neto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {cajaHoy.neto >= 0 ? "+" : ""}${Math.abs(cajaHoy.neto).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ↑${cajaHoy.ingresos.toFixed(2)} · ↓${cajaHoy.egresos.toFixed(2)}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* ── KPIs principales del mes ── */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" style={{ color: primaryHex }} />
              {kpis.mes} — Resumen mensual
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Ventas del mes"  value={kpis.ventas_mes}  isCurrency
                sub={`${kpis.cant_ventas_mes} ventas`}
                icon={TrendingUp}      color="#3b82f6"   delay={0}   pct={kpis.ventas_pct} />
              <KpiCard label="Cobros del mes"  value={kpis.cobros_mes}  isCurrency
                icon={DollarSign}      color="#10b981"   delay={80}  pct={kpis.cobros_pct} />
              <KpiCard label="Egresos del mes" value={kpis.egresos_mes} isCurrency
                icon={ArrowDownCircle} color="#ef4444"   delay={160} pct={kpis.egresos_pct} />
              <KpiCard
                label="Resultado neto" value={Math.abs(kpis.resultado_mes)} isCurrency
                sub={kpis.resultado_mes >= 0 ? "↑ Mes positivo" : "↓ Mes negativo"}
                icon={kpis.resultado_mes >= 0 ? TrendingUp : TrendingDown}
                color={kpis.resultado_mes >= 0 ? "#a855f7" : "#f97316"}
                delay={240}
              />
            </div>
          </div>

          {/* ── Gráficas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Área chart — 2/3 del ancho */}
            <div className="lg:col-span-2 glass rounded-2xl overflow-hidden p-5 anim-fade-up"
                 style={{ animationDelay: "320ms" }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-bold">Tendencia de ventas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Últimos 12 meses</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  <Zap className="h-3 w-3" style={{ color: primaryHex }} />
                  {ventasMes.length} meses
                </div>
              </div>
              {ventasMes.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={ventasMes} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={primaryHex} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={primaryHex} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="ventas" stroke={primaryHex} strokeWidth={2.5}
                      fill="url(#vGrad)" dot={false}
                      activeDot={{ r: 6, fill: primaryHex, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                      isAnimationActive animationDuration={1200} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sin datos suficientes
                </div>
              )}
            </div>

            {/* Órdenes por estado — 1/3 del ancho */}
            <div className="glass rounded-2xl overflow-hidden p-5 anim-fade-up"
                 style={{ animationDelay: "360ms" }}>
              <p className="text-sm font-bold mb-1">Órdenes por estado</p>
              <p className="text-xs text-muted-foreground mb-4">Distribución actual</p>
              {ordenesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ordenesData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="oGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={primaryHex} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={primaryHex} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <XAxis type="number" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<ChartTooltip isCurrency={false} />} cursor={{ fill: gridColor }} />
                    <Bar dataKey="value" fill="url(#oGrad)" radius={[0, 8, 8, 0]} maxBarSize={24}
                      isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </div>

          {/* ── Métricas secundarias + Alertas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Métricas de operación */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Operación</p>
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Pacientes nuevos"  value={kpis.pacientes_nuevos_mes}     icon={Users}
                  sub="este mes" color="#ec4899" delay={400} pct={kpis.pacientes_pct} />
                <KpiCard label="Cobros pendientes"  value={kpis.ventas_pendientes_cobro}  icon={ShoppingBag}
                  sub="ventas sin cobrar" color="#64748b" delay={460} />
                <KpiCard label="Órdenes listas"    value={kpis.ordenes_listas}            icon={ClipboardList}
                  sub="para entregar" color="#10b981" delay={520} />
                <KpiCard label="Pacientes hoy"     value={kpis.turnos_hoy}               icon={Clock}
                  sub="con turno" color="#f59e0b" delay={580} />
              </div>
            </div>

            {/* Alertas */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Alertas y estados</p>
              <div className="space-y-2.5">

                {/* Resultado */}
                <div className="glass rounded-2xl overflow-hidden p-4 anim-fade-up" style={{ animationDelay: "400ms" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Resultado neto del mes</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${kpis.resultado_mes >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"}`}>
                      {kpis.resultado_mes >= 0 ? "↑ Positivo" : "↓ Negativo"}
                    </span>
                  </div>
                  <p className={`text-3xl font-black mt-1 tabular-nums ${kpis.resultado_mes >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {fmt(kpis.resultado_mes)}
                  </p>
                </div>

                <AlertCard
                  icon={AlertCircle}
                  title="Cuotas de crédito vencidas"
                  value={`${kpis.cuotas_vencidas_count} cuotas`}
                  sub={kpis.cuotas_vencidas_count > 0 ? `Total: ${fmt(kpis.cuotas_vencidas_total)}` : "Sin vencidas ✓"}
                  color={kpis.cuotas_vencidas_count > 0 ? "#ef4444" : "#10b981"}
                  onClick={() => navigate("/cxc")}
                />

                <AlertCard
                  icon={Package}
                  title="Productos bajo stock mínimo"
                  value={`${kpis.stock_bajo_count} productos`}
                  sub={kpis.stock_bajo_count > 0 ? "Requieren reposición" : "Inventario saludable ✓"}
                  color={kpis.stock_bajo_count > 0 ? "#f97316" : "#10b981"}
                  onClick={() => navigate("/inventario")}
                />
              </div>
            </div>
          </div>

          {/* ── Alertas del día ── */}
          {alertas && (
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" style={{ color: primaryHex }} />
                Agenda &amp; alertas
              </p>

              {/* Fila 1: Turnos y Cumpleaños */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <AlertPanel title="Turnos de hoy" icon={Clock} color="#f59e0b"
                  count={alertas.turnos_hoy.length} emptyMsg="Sin turnos programados para hoy">
                  {alertas.turnos_hoy.map(t => (
                    <AlertRow key={t.id}>
                      <span className="font-bold tabular-nums text-amber-600 shrink-0">{t.hora_inicio}</span>
                      <PacLink id={t.paciente_id}>{t.apellidos} {t.nombres}</PacLink>
                      <span className="text-muted-foreground truncate max-w-[120px] hidden sm:block">{t.motivo}</span>
                      <WaBtn disabled={!t.telefono} onClick={() => enviarRecordatorioCita(t.telefono, t.nombres, hoyDDMMYYYY(), t.hora_inicio, t.motivo)} />
                    </AlertRow>
                  ))}
                </AlertPanel>

                <AlertPanel title="Cumpleaños próximos (7 días)" icon={Cake} color="#ec4899"
                  count={alertas.cumpleanos_proximos.length} emptyMsg="Sin cumpleaños en los próximos 7 días">
                  {alertas.cumpleanos_proximos.map(p => (
                    <AlertRow key={p.id}>
                      <DiasBadge dias={p.dias_para} esHoy={p.es_hoy} />
                      <PacLink id={p.id}>{p.apellidos} {p.nombres}</PacLink>
                      <WaBtn disabled={!p.telefono} onClick={() => enviarCumpleanios(p.telefono, p.nombres)} />
                    </AlertRow>
                  ))}
                </AlertPanel>
              </div>

              {/* Fila 2: Controles y Cuotas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <AlertPanel title="Controles visuales próximos (14 días)" icon={Eye} color="#8b5cf6"
                  count={alertas.controles_proximos.length} emptyMsg="Sin controles próximos">
                  {alertas.controles_proximos.map(c => (
                    <AlertRow key={c.paciente_id}>
                      <DiasBadge dias={c.dias_para} />
                      <PacLink id={c.paciente_id}>{c.apellidos} {c.nombres}</PacLink>
                      <span className="text-muted-foreground shrink-0">{fmtISO(c.proximo_control)}</span>
                      <WaBtn disabled={!c.telefono} onClick={() => enviarControlVisual(c.telefono, c.nombres, fmtISO(c.proximo_control))} />
                    </AlertRow>
                  ))}
                </AlertPanel>

                <AlertPanel title="Cuotas vencen esta semana" icon={CreditCard} color="#ef4444"
                  count={alertas.cuotas_proximas.length} emptyMsg="Sin cuotas venciendo esta semana">
                  {alertas.cuotas_proximas.map((q, i) => (
                    <AlertRow key={i}>
                      <DiasBadge dias={q.dias_para} />
                      {q.paciente_id
                        ? <PacLink id={q.paciente_id}>{q.apellidos} {q.nombres}</PacLink>
                        : <span className="truncate flex-1 font-medium">{q.apellidos} {q.nombres}</span>}
                      <span className="text-muted-foreground shrink-0">{q.credito_numero} · ${q.monto.toFixed(2)}</span>
                      <WaBtn disabled={!q.telefono} onClick={() => enviarRecordatorioCuota(
                        q.telefono, q.nombres,
                        String(q.numero_cuota), String(q.total_cuotas),
                        q.credito_numero, q.monto.toFixed(2),
                        fmtISO(q.fecha_vencimiento)
                      )} />
                    </AlertRow>
                  ))}
                </AlertPanel>
              </div>

              {/* Fila 3: Órdenes sin retirar */}
              {alertas.ordenes_sin_retirar.length > 0 && (
                <AlertPanel title="Órdenes listas sin retirar (+3 días)" icon={PackageCheck} color="#f97316"
                  count={alertas.ordenes_sin_retirar.length} emptyMsg="">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {alertas.ordenes_sin_retirar.map(o => (
                      <AlertRow key={o.id}>
                        <span className="font-bold text-orange-500 shrink-0">{o.dias_esperando}d</span>
                        <PacLink id={o.paciente_id}>{o.apellidos} {o.nombres}</PacLink>
                        <span className="text-muted-foreground shrink-0">{o.numero}</span>
                        <WaBtn disabled={!o.telefono} onClick={() => enviarOrdenLista(o.telefono, o.nombres, o.numero)} />
                      </AlertRow>
                    ))}
                  </div>
                </AlertPanel>
              )}
            </div>
          )}

          {/* ── Kanban: Estado de órdenes ── */}
          <div className="mt-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <PackageCheck className="h-3.5 w-3.5" style={{ color: primaryHex }} />
              Estado de órdenes del laboratorio
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {ESTADOS_KANBAN.map(estado => {
                const grupo = ordenesKanban.filter(o => o.estado === estado)
                return (
                  <div key={estado} className={`border rounded-xl p-3 space-y-2 ${COLOR_ESTADO[estado]}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide">{LABEL_ESTADO[estado]}</span>
                      <span className="text-lg font-black">{grupo.length}</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {grupo.slice(0, 8).map(o => (
                        <Link key={o.id} to="/ordenes" className="block bg-background/80 rounded-lg px-2 py-1.5 text-xs border hover:bg-background transition-colors">
                          <p className="font-semibold truncate">{o.numero}</p>
                          <p className="text-muted-foreground truncate">{o.paciente_nombre ?? "—"}</p>
                        </Link>
                      ))}
                      {grupo.length > 8 && (
                        <p className="text-xs text-center text-muted-foreground">+{grupo.length - 8} más</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Footer con info ── */}
          <div className="flex items-center justify-between text-xs text-muted-foreground/50 pt-2 border-t border-border/30 anim-fade-in" style={{ animationDelay: "700ms" }}>
            <span>Óptica Forever Vision · Sistema de gestión</span>
            <span>Actualizado cada 60 segundos</span>
          </div>
        </>
      )}
    </div>
  )
}
