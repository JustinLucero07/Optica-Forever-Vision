import { Plus, ShoppingBag, Calendar, Wallet, Users } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

const ACTIONS = [
  { icon: ShoppingBag, label: "Nueva Venta",    to: "/ventas/nueva" },
  { icon: Calendar,    label: "Nuevo Turno",    to: "/turnos" },
  { icon: Wallet,      label: "Nuevo Cobro",    to: "/cobros" },
  { icon: Users,       label: "Nuevo Paciente", to: "/pacientes" },
]

export default function FloatingFAB() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function handleAction(to: string) {
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={ref} className="hidden md:block fixed bottom-6 right-6 z-40">
      <div className="flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {ACTIONS.map(({ icon: Icon, label, to }) => (
              <button
                key={to}
                onClick={() => handleAction(to)}
                className="flex items-center gap-2 bg-card border shadow-md rounded-xl px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                {label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          aria-label="Acciones rápidas"
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-200"
          style={{ boxShadow: "0 4px 24px hsl(var(--primary)/0.35)" }}
        >
          <Plus
            className="h-7 w-7 transition-transform duration-200"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>
    </div>
  )
}
