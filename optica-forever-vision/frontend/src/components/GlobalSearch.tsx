import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Search, Users, ShoppingBag, ClipboardList, CreditCard, Box, Loader2, X } from "lucide-react"
import { api } from "@/lib/api"

interface Resultado {
  tipo: string
  id: number
  label: string
  sub: string
  url: string
}

interface BuscarResponse {
  query: string
  total: number
  pacientes: Resultado[]
  ventas: Resultado[]
  ordenes: Resultado[]
  creditos: Resultado[]
  productos: Resultado[]
}

const tipoIcon: Record<string, React.ElementType> = {
  paciente: Users,
  venta: ShoppingBag,
  orden: ClipboardList,
  credito: CreditCard,
  producto: Box,
}

const tipoLabel: Record<string, string> = {
  paciente: "Paciente",
  venta: "Venta",
  orden: "Orden Lab",
  credito: "Crédito",
  producto: "Producto",
}

const tipoBg: Record<string, string> = {
  paciente: "bg-blue-100 text-blue-700",
  venta: "bg-green-100 text-green-700",
  orden: "bg-amber-100 text-amber-700",
  credito: "bg-purple-100 text-purple-700",
  producto: "bg-slate-100 text-slate-700",
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Ctrl+K / Cmd+K opens search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQ("")
  }, [open])

  const { data, isFetching } = useQuery<BuscarResponse>({
    queryKey: ["buscar", q],
    queryFn: () => api.get("/buscar", { params: { q } }).then(r => r.data),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  })

  const todos: Resultado[] = data
    ? [
        ...data.pacientes,
        ...data.ventas,
        ...data.ordenes,
        ...data.creditos,
        ...data.productos,
      ]
    : []

  function handleSelect(r: Resultado) {
    navigate(r.url)
    setOpen(false)
  }

  const modal = open && createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal box */}
      <div
        className="relative z-10 w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar paciente, venta, orden, crédito, producto…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground text-foreground"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {q && !isFetching && (
            <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border rounded opacity-60">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length < 2 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Escribe al menos 2 caracteres para buscar
            </div>
          )}
          {q.length >= 2 && !isFetching && todos.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sin resultados para "<strong className="text-foreground">{q}</strong>"
            </div>
          )}
          {todos.length > 0 && (
            <ul className="py-2">
              {todos.map((r, i) => {
                const Icon = tipoIcon[r.tipo] ?? Search
                return (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 ${tipoBg[r.tipo] ?? "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{r.label}</p>
                        {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tipoBg[r.tipo] ?? "bg-muted text-muted-foreground"}`}>
                        {tipoLabel[r.tipo] ?? r.tipo}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground bg-muted/30">
          <span>Esc cerrar</span>
          <span>↵ seleccionar</span>
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground
          bg-muted/50 hover:bg-muted rounded-lg transition-colors border border-transparent
          hover:border-border"
        title="Búsqueda global (Ctrl+K)"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px]
          font-mono bg-background border rounded opacity-60">
          Ctrl K
        </kbd>
      </button>
      {modal}
    </>
  )
}
