import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Search, Loader2, Stethoscope, ChevronLeft, ChevronRight } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function fmtRx(esf: number | null, cil: number | null, eje: number | null) {
  if (esf == null && cil == null) return "—"
  const e = esf != null ? (esf >= 0 ? `+${esf.toFixed(2)}` : esf.toFixed(2)) : ""
  const c = cil != null ? (cil >= 0 ? ` +${cil.toFixed(2)}` : ` ${cil.toFixed(2)}`) : ""
  const ax = eje != null ? ` x${eje}°` : ""
  return `${e}${c}${ax}`
}

interface Consulta {
  id: number
  numero: string
  fecha: string
  paciente_id: number
  paciente_nombre: string
  motivo_consulta: string | null
  diagnostico: string | null
  rx_od_esf: number | null
  rx_od_cil: number | null
  rx_od_eje: number | null
}

const PAGE = 50

export default function Consultas() {
  const [busqueda, setBusqueda] = useState("")
  const [q, setQ] = useState("")
  const [skip, setSkip] = useState(0)

  const { data: consultas = [], isLoading } = useQuery<Consulta[]>({
    queryKey: ["consultas-global", q, skip],
    queryFn: () =>
      api.get("/consultas", { params: { q: q || undefined, skip, limit: PAGE } }).then(r => r.data),
  })

  function buscar() {
    setQ(busqueda)
    setSkip(0)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" /> Consultas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Para crear una consulta, ve al paciente y haz clic en "Nueva Consulta"
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pacientes">Buscar paciente →</Link>
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Paciente, cédula o número de consulta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscar()}
          />
        </div>
        <Button onClick={buscar}>Buscar</Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">N°</th>
                <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Paciente</th>
                <th className="text-left px-4 py-2.5 font-medium">Motivo</th>
                <th className="text-left px-4 py-2.5 font-medium">Refracción OD</th>
                <th className="text-left px-4 py-2.5 font-medium">Diagnóstico</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {consultas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    {q ? `Sin resultados para "${q}"` : "Sin consultas registradas"}
                  </td>
                </tr>
              )}
              {consultas.map(c => (
                <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono text-xs">{c.numero}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmtDate(c.fecha)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/pacientes/${c.paciente_id}`}
                      className="hover:underline underline-offset-2"
                    >
                      {c.paciente_nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                    {c.motivo_consulta ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {fmtRx(c.rx_od_esf, c.rx_od_cil, c.rx_od_eje)}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                    {c.diagnostico ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/consultas/${c.id}`}>Ver →</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {(skip > 0 || consultas.length === PAGE) && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={skip === 0}
            onClick={() => setSkip(s => Math.max(0, s - PAGE))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Mostrando {skip + 1}–{skip + consultas.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={consultas.length < PAGE}
            onClick={() => setSkip(s => s + PAGE)}
          >
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
