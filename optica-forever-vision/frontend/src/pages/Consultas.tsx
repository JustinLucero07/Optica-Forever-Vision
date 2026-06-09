import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Search, Loader2, Stethoscope, Plus } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Paginador } from "@/components/ui/Paginador"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import PacienteCombobox from "@/components/PacienteCombobox"

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
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState("")
  const [q, setQ] = useState("")
  const [skip, setSkip] = useState(0)
  const [perPage, setPerPage] = useState(15)
  const [pageLocal, setPageLocal] = useState(1)
  const [modalNueva, setModalNueva] = useState(false)
  const [pacSelId, setPacSelId] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const { data: consultas = [], isLoading } = useQuery<Consulta[]>({
    queryKey: ["consultas-global", q, skip],
    queryFn: () =>
      api.get("/consultas", { params: { q: q || undefined, skip, limit: PAGE } }).then(r => r.data),
  })

  function buscar() {
    setQ(busqueda)
    setSkip(0)
    setPageLocal(1)
  }

  const filtradas = consultas.filter(c => {
    if (desde && c.fecha < desde) return false
    if (hasta && c.fecha > hasta) return false
    return true
  })

  const paged = filtradas.slice((pageLocal - 1) * perPage, pageLocal * perPage)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" /> Consultas
          </h1>
        </div>
        <Button onClick={() => { setPacSelId(""); setModalNueva(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva consulta
        </Button>
      </div>

      {/* Modal nueva consulta */}
      <Dialog open={modalNueva} onClose={() => setModalNueva(false)} className="max-w-md">
        <DialogHeader>
          <h2 className="text-lg font-semibold">Nueva consulta</h2>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground mb-3">Selecciona el paciente para continuar.</p>
          <PacienteCombobox
            value={pacSelId}
            onChange={id => setPacSelId(id)}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setModalNueva(false)}>Cancelar</Button>
          <Button
            disabled={!pacSelId}
            onClick={() => { setModalNueva(false); navigate(`/pacientes/${pacSelId}/consultas/nueva`) }}
          >
            Continuar →
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Búsqueda y filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-72"
            placeholder="Paciente, cédula o número de consulta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscar()}
          />
        </div>
        <Button onClick={buscar}>Buscar</Button>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs text-muted-foreground">Desde</span>
          <Input type="date" className="h-9 w-36 text-sm" value={desde} onChange={e => { setDesde(e.target.value); setPageLocal(1) }} />
          <span className="text-xs text-muted-foreground">Hasta</span>
          <Input type="date" className="h-9 w-36 text-sm" value={hasta} onChange={e => { setHasta(e.target.value); setPageLocal(1) }} />
          {(desde || hasta) && (
            <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setDesde(""); setHasta("") }}>Limpiar</button>
          )}
        </div>
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
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    {q || desde || hasta ? "Sin resultados con los filtros aplicados" : "Sin consultas registradas"}
                  </td>
                </tr>
              )}
              {paged.map(c => (
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
      <div className="rounded-md border">
        <Paginador
          page={pageLocal}
          total={filtradas.length}
          perPage={perPage}
          onChange={p => {
            if (p * perPage > filtradas.length && consultas.length === PAGE) {
              setSkip(s => s + PAGE)
              setPageLocal(1)
            } else {
              setPageLocal(p)
            }
          }}
          onPerPageChange={n => { setPerPage(n); setPageLocal(1) }}
        />
      </div>
      {consultas.length === PAGE && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando {skip + 1}–{skip + consultas.length} · hay más registros
        </p>
      )}
    </div>
  )
}
