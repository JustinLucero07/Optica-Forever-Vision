import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { Bell, CreditCard, Package, ClipboardCheck, Calendar, X, ChevronDown, ChevronUp } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"

interface Alertas {
  total: number
  creditos_vencidos: number
  stock_bajo: number
  ordenes_listas: number
  turnos_hoy: number
}

interface TurnoHoy {
  id: number
  paciente_id: number
  nombres: string
  apellidos: string
  hora_inicio: string
  motivo: string
}

interface OrdenSinRetirar {
  id: number
  numero: string
  paciente_id: number
  nombres: string
  apellidos: string
  dias_esperando: number
}

interface AlertasDetalle {
  turnos_hoy: TurnoHoy[]
  ordenes_sin_retirar: OrdenSinRetirar[]
  cumpleanos_proximos: any[]
  controles_proximos: any[]
  cuotas_proximas: any[]
  productos_sin_stock: any[]
}

export default function Notifications() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const { data } = useQuery<Alertas>({
    queryKey: ["alertas"],
    queryFn: () => api.get("/stats/alertas").then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const { data: detalle } = useQuery<AlertasDetalle>({
    queryKey: ["alertas-detalle"],
    queryFn: () => api.get("/reportes/alertas").then(r => r.data),
    enabled: open,
    refetchInterval: 120_000,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const panelWidth = 340
      const leftRaw = r.left
      const left = Math.min(leftRaw, window.innerWidth - panelWidth - 8)
      setPos({ top: r.bottom + 8, left: Math.max(8, left) })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  const total = data?.total ?? 0

  function toggleExpand(key: string) {
    setExpanded(e => e === key ? null : key)
  }

  const turnos = detalle?.turnos_hoy ?? []
  const ordenesListas = (detalle?.ordenes_sin_retirar ?? []).filter(o => o.dias_esperando >= 0)

  const panel = open && createPortal(
    <>
      <div className="fixed inset-0 z-[9980]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[9981] w-[340px] rounded-2xl shadow-2xl overflow-hidden border border-border"
        style={{ top: pos.top, left: pos.left, backgroundColor: "hsl(var(--card))" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="font-semibold text-sm">Alertas del sistema</span>
          {total === 0
            ? <span className="text-xs text-muted-foreground">Todo en orden ✓</span>
            : <span className="text-xs font-medium text-destructive">{total} pendiente{total > 1 ? "s" : ""}</span>
          }
          <button onClick={() => setOpen(false)} className="ml-2 text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
          {/* Créditos vencidos */}
          <Link
            to="/creditos"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${(data?.creditos_vencidos ?? 0) === 0 ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-red-50 dark:bg-red-950/30">
              <CreditCard className="h-[18px] w-[18px] text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Créditos vencidos</p>
              <p className="text-xs text-muted-foreground">cuotas pendientes de cobro</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${(data?.creditos_vencidos ?? 0) > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {data?.creditos_vencidos ?? 0}
            </span>
          </Link>

          {/* Stock bajo */}
          <div>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${(data?.stock_bajo ?? 0) === 0 ? "opacity-50" : ""}`}
              onClick={() => (data?.stock_bajo ?? 0) > 0 && toggleExpand("stock")}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-amber-50 dark:bg-amber-950/30">
                <Package className="h-[18px] w-[18px] text-amber-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Stock bajo</p>
                <p className="text-xs text-muted-foreground">productos bajo el mínimo</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-amber-600">{data?.stock_bajo ?? 0}</span>
              {(data?.stock_bajo ?? 0) > 0 && (
                expanded === "stock"
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
              )}
            </button>
            {expanded === "stock" && (detalle?.productos_sin_stock ?? []).length > 0 && (
              <div className="mx-3 mb-1 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 divide-y divide-amber-100 dark:divide-amber-900/30 overflow-hidden">
                {(detalle?.productos_sin_stock ?? []).slice(0, 5).map((p: any) => (
                  <Link key={p.id} to="/inventario" onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
                    <span className="text-foreground font-medium truncate">{p.nombre}</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold ml-2 shrink-0">Stock: {p.stock_actual}</span>
                  </Link>
                ))}
                {(detalle?.productos_sin_stock ?? []).length > 5 && (
                  <p className="text-center text-xs text-muted-foreground py-1.5">+{(detalle?.productos_sin_stock ?? []).length - 5} más</p>
                )}
              </div>
            )}
          </div>

          {/* Órdenes listas */}
          <div>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${(data?.ordenes_listas ?? 0) === 0 ? "opacity-50" : ""}`}
              onClick={() => (data?.ordenes_listas ?? 0) > 0 && toggleExpand("ordenes")}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-emerald-50 dark:bg-emerald-950/30">
                <ClipboardCheck className="h-[18px] w-[18px] text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Órdenes listas</p>
                <p className="text-xs text-muted-foreground">esperando ser entregadas</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-emerald-600">{data?.ordenes_listas ?? 0}</span>
              {(data?.ordenes_listas ?? 0) > 0 && (
                expanded === "ordenes"
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
              )}
            </button>
            {expanded === "ordenes" && ordenesListas.length > 0 && (
              <div className="mx-3 mb-1 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 divide-y divide-emerald-100 dark:divide-emerald-900/30 overflow-hidden">
                {ordenesListas.slice(0, 5).map((o) => (
                  <Link key={o.id} to="/ordenes" onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors">
                    <span className="font-medium text-foreground">{o.apellidos} {o.nombres}</span>
                    <span className="text-muted-foreground ml-2 shrink-0 font-mono">{o.numero}</span>
                  </Link>
                ))}
                {ordenesListas.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground py-1.5">+{ordenesListas.length - 5} más</p>
                )}
              </div>
            )}
          </div>

          {/* Turnos hoy */}
          <div>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${(data?.turnos_hoy ?? 0) === 0 ? "opacity-50" : ""}`}
              onClick={() => (data?.turnos_hoy ?? 0) > 0 && toggleExpand("turnos")}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-blue-50 dark:bg-blue-950/30">
                <Calendar className="h-[18px] w-[18px] text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Turnos hoy</p>
                <p className="text-xs text-muted-foreground">citas agendadas para hoy</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-blue-600">{data?.turnos_hoy ?? 0}</span>
              {(data?.turnos_hoy ?? 0) > 0 && (
                expanded === "turnos"
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
              )}
            </button>
            {expanded === "turnos" && turnos.length > 0 && (
              <div className="mx-3 mb-1 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 divide-y divide-blue-100 dark:divide-blue-900/30 overflow-hidden">
                {turnos.slice(0, 5).map((t) => (
                  <Link key={t.id} to="/turnos" onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors">
                    <span className="font-medium text-foreground">{t.apellidos} {t.nombres}</span>
                    <span className="text-blue-700 dark:text-blue-400 font-bold ml-2 shrink-0 tabular-nums">{t.hora_inicio}</span>
                  </Link>
                ))}
                {turnos.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground py-1.5">+{turnos.length - 5} más</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
          Actualiza cada 60 s · <Link to="/turnos" onClick={() => setOpen(false)} className="hover:text-foreground underline">Ver agenda completa</Link>
        </div>
      </div>
    </>,
    document.body
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/15 transition-colors"
        title="Alertas del sistema"
      >
        <Bell className="h-5 w-5 text-white/70" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>
      {panel}
    </>
  )
}
