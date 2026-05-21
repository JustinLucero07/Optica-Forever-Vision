import { useQuery } from "@tanstack/react-query"
import {
  TrendingUp, DollarSign, ShoppingBag, Clock,
  ClipboardList, CheckCircle, Users, ArrowDownCircle, Loader2,
  Banknote, Package, AlertCircle,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

interface KPIs {
  ventas_hoy: number
  ventas_mes: number
  cobros_mes: number
  egresos_mes: number
  resultado_mes: number
  cant_ventas_mes: number
  ventas_pendientes_cobro: number
  turnos_hoy: number
  ordenes_activas: number
  ordenes_listas: number
  pacientes_nuevos_mes: number
  mes: string
  cobros_hoy: number
  cuotas_vencidas_count: number
  cuotas_vencidas_total: number
  stock_bajo_count: number
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}

function KpiCard({
  label, value, sub, icon: Icon, color, onClick,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
  onClick?: () => void
}) {
  return (
    <div
      className={`bg-card rounded-xl border p-5 flex items-start gap-4 ${onClick ? "cursor-pointer hover:bg-accent/30 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data: kpis, isLoading } = useQuery<KPIs>({
    queryKey: ["dashboard-kpis"],
    queryFn: () => api.get("/reportes/dashboard").then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido, {user?.full_name}</h1>
        <p className="text-sm text-muted-foreground capitalize">{user?.role} · Óptica Forever Vision</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando indicadores...
        </div>
      )}

      {kpis && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {kpis.mes}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Ventas del mes"
                value={fmt(kpis.ventas_mes)}
                sub={`${kpis.cant_ventas_mes} ventas`}
                icon={TrendingUp}
                color="bg-blue-500"
              />
              <KpiCard
                label="Cobros del mes"
                value={fmt(kpis.cobros_mes)}
                icon={DollarSign}
                color="bg-green-500"
              />
              <KpiCard
                label="Egresos del mes"
                value={fmt(kpis.egresos_mes)}
                icon={ArrowDownCircle}
                color="bg-red-500"
              />
              <KpiCard
                label="Resultado neto"
                value={fmt(kpis.resultado_mes)}
                sub="Cobros − Egresos"
                icon={DollarSign}
                color={kpis.resultado_mes >= 0 ? "bg-emerald-600" : "bg-orange-500"}
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Hoy
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Ventas de hoy"
                value={fmt(kpis.ventas_hoy)}
                icon={ShoppingBag}
                color="bg-violet-500"
              />
              <KpiCard
                label="Cobros de hoy"
                value={fmt(kpis.cobros_hoy)}
                icon={Banknote}
                color="bg-emerald-500"
              />
              <KpiCard
                label="Turnos hoy"
                value={kpis.turnos_hoy.toString()}
                icon={Clock}
                color="bg-sky-500"
              />
              <KpiCard
                label="Órdenes activas"
                value={kpis.ordenes_activas.toString()}
                sub={`${kpis.ordenes_listas} listas para entregar`}
                icon={ClipboardList}
                color="bg-amber-500"
              />
              <KpiCard
                label="Cobros pendientes"
                value={kpis.ventas_pendientes_cobro.toString()}
                sub="ventas sin cobrar"
                icon={CheckCircle}
                color="bg-rose-500"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Pacientes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Pacientes nuevos"
                value={kpis.pacientes_nuevos_mes.toString()}
                sub="este mes"
                icon={Users}
                color="bg-teal-500"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Alertas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Cuotas vencidas"
                value={kpis.cuotas_vencidas_count.toString()}
                sub={fmt(kpis.cuotas_vencidas_total)}
                icon={AlertCircle}
                color={kpis.cuotas_vencidas_count > 0 ? "bg-red-600" : "bg-gray-400"}
                onClick={() => navigate("/cxc")}
              />
              <KpiCard
                label="Stock bajo"
                value={kpis.stock_bajo_count.toString()}
                sub="productos bajo mínimo"
                icon={Package}
                color={kpis.stock_bajo_count > 0 ? "bg-orange-500" : "bg-gray-400"}
                onClick={() => navigate("/inventario")}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
