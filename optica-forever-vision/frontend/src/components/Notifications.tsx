import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { Bell, CreditCard, Package, ClipboardCheck, Calendar, X } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"

interface Alertas {
  total: number
  creditos_vencidos: number
  stock_bajo: number
  ordenes_listas: number
  turnos_hoy: number
}

export default function Notifications() {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const { data } = useQuery<Alertas>({
    queryKey: ["alertas"],
    queryFn: () => api.get("/stats/alertas").then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const panelWidth = 320
      // Prefer aligning left edge to button's left, but clamp so panel stays in viewport
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

  const items = [
    {
      label: "Créditos vencidos",
      count: data?.creditos_vencidos ?? 0,
      icon: CreditCard,
      href: "/creditos",
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
      desc: "cuotas pendientes de cobro",
    },
    {
      label: "Stock bajo",
      count: data?.stock_bajo ?? 0,
      icon: Package,
      href: "/inventario",
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      desc: "productos bajo el mínimo",
    },
    {
      label: "Órdenes listas",
      count: data?.ordenes_listas ?? 0,
      icon: ClipboardCheck,
      href: "/ordenes",
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      desc: "esperando ser entregadas",
    },
    {
      label: "Turnos hoy",
      count: data?.turnos_hoy ?? 0,
      icon: Calendar,
      href: "/turnos",
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      desc: "citas agendadas para hoy",
    },
  ]

  const panel = open && createPortal(
    <>
      <div className="fixed inset-0 z-[9980]" onClick={() => setOpen(false)} />
      <div
        className="fixed z-[9981] w-80 rounded-2xl shadow-2xl overflow-hidden border border-border"
        style={{ top: pos.top, left: pos.left, backgroundColor: "hsl(var(--card))" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="font-semibold text-sm">Alertas del sistema</span>
          {total === 0
            ? <span className="text-xs text-muted-foreground">Todo en orden ✓</span>
            : <span className="text-xs font-medium text-destructive">{total} pendiente{total > 1 ? "s" : ""}</span>
          }
          <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-2 space-y-1">
          {items.map(item => (
            <Link
              key={item.label}
              to={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${item.count === 0 ? "opacity-50" : ""}`}
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${item.bg}`}>
                <item.icon className={`h-4.5 w-4.5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${item.count > 0 ? item.color : "text-muted-foreground"}`}>
                {item.count}
              </span>
            </Link>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
          Actualiza cada 60 segundos
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
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted transition-colors"
        title="Alertas del sistema"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
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
