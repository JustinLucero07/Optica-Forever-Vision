import { useState, useRef, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, X, User } from "lucide-react"
import { api } from "@/lib/api"
import { Input } from "@/components/ui/input"

interface Paciente {
  id: number
  nombres: string
  apellidos: string
  cedula: string | null
  telefono: string | null
  foto: string | null
}

interface Props {
  value: string
  onChange: (id: string, nombre?: string) => void
  placeholder?: string
  className?: string
}

export default function PacienteCombobox({ value, onChange, placeholder = "Buscar paciente…", className }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Paciente | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: resultados = [], isFetching } = useQuery<Paciente[]>({
    queryKey: ["pac-combo", query],
    queryFn: () =>
      api.get("/pacientes", { params: { q: query || undefined, limit: 8 } }).then(r => r.data),
    enabled: open && query.length >= 1,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!value) { setSelected(null); return }
    if (selected && String(selected.id) === value) return
    api.get(`/pacientes/${value}`).then(r => setSelected(r.data)).catch(() => {})
  }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function seleccionar(p: Paciente) {
    setSelected(p)
    onChange(String(p.id), `${p.apellidos} ${p.nombres}`)
    setQuery("")
    setOpen(false)
  }

  function limpiar() {
    setSelected(null)
    onChange("", undefined)
    setQuery("")
  }

  if (selected) {
    return (
      <div className={`flex items-center gap-2 border rounded-md px-3 py-1.5 bg-background ${className ?? ""}`}>
        {selected.foto ? (
          <img src={selected.foto} alt="" className="h-8 w-8 rounded-full object-cover shrink-0 border" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{selected.apellidos}, {selected.nombres}</p>
          {selected.cedula && <p className="text-xs text-muted-foreground">{selected.cedula}</p>}
        </div>
        <button onClick={limpiar} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 h-9"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
      </div>

      {open && query.length >= 1 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {resultados.length === 0 && !isFetching && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
          )}
          {resultados.map(p => (
            <button
              key={p.id}
              onClick={() => seleccionar(p)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              {p.foto ? (
                <img src={p.foto} alt="" className="h-9 w-9 rounded-full object-cover shrink-0 border" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(p.apellidos[0] ?? "") + (p.nombres[0] ?? "")}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{p.apellidos}, {p.nombres}</p>
                <p className="text-xs text-muted-foreground">{p.cedula ?? "Sin cédula"} · {p.telefono ?? "—"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
