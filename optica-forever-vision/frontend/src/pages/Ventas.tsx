import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, XCircle, Loader2, Download, ArrowUpDown, ArrowUp, ArrowDown, Copy } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { exportCSV } from "@/lib/export"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { Paginador } from "@/components/ui/Paginador"

interface Venta {
  id: number
  numero: string
  paciente_id: number | null
  paciente_nombre: string | null
  fecha: string
  total: number
  estado: string
  abonado?: number
}

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", anulado: "destructive", cobrado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estado}</Badge>
}

type SortCol = "numero" | "fecha" | "paciente" | "total" | ""

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />
  return sortDir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1 inline" />
    : <ArrowDown className="h-3 w-3 ml-1 inline" />
}

export default function Ventas() {
  const navigate = useNavigate()
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [page, setPage]       = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [anulando, setAnulando] = useState<Venta | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: ventas = [], isLoading } = useQuery<Venta[]>({
    queryKey: ["ventas", desde, hasta],
    queryFn: () => api.get("/ventas", { params: { desde: desde || undefined, hasta: hasta || undefined } }).then(r => r.data),
    staleTime: 10_000,
  })

  const anularMut = useMutation({
    mutationFn: (id: number) => api.post(`/ventas/${id}/anular`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ventas"] }); setAnulando(null); toast.success("Venta anulada") },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  const duplicarMut = useMutation({
    mutationFn: async (ventaId: number) => {
      const { data: detalle } = await api.get(`/ventas/${ventaId}`)
      return api.post("/ventas", {
        paciente_id: detalle.paciente_id,
        fecha: new Date().toISOString().slice(0, 10),
        notas: detalle.notas,
        items: (detalle.items ?? []).map((it: any) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento: it.descuento ?? 0,
        })),
      })
    },
    onSuccess: () => {
      toast.success("Venta duplicada")
      qc.invalidateQueries({ queryKey: ["ventas"] })
    },
    onError: (e) => toast.error(errMsg(e, "Error al duplicar")),
  })

  const total = ventas.filter(v => v.estado !== "anulado").reduce((s, v) => s + v.total, 0)

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortCol(col)
      setSortDir("asc")
    }
    setPage(1)
  }

  const sorted = [...ventas].sort((a, b) => {
    if (!sortCol) return 0
    let av: string | number = ""
    let bv: string | number = ""
    if (sortCol === "numero")   { av = a.numero;                         bv = b.numero }
    if (sortCol === "fecha")    { av = a.fecha;                          bv = b.fecha }
    if (sortCol === "paciente") { av = a.paciente_nombre ?? "";          bv = b.paciente_nombre ?? "" }
    if (sortCol === "total")    { av = a.total;                          bv = b.total }
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  const thClass = "text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide select-none cursor-pointer hover:text-foreground transition-colors"

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{ventas.length} registros · Total: <span className="font-semibold text-foreground">${total.toFixed(2)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() =>
            exportCSV("ventas.csv", ventas.map(v => ({
              numero: v.numero,
              fecha: v.fecha,
              paciente: v.paciente_nombre ?? "Consumidor final",
              total: v.total,
              estado: v.estado,
            })))
          }>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          {(rol === "admin" || rol === "vendedor") && (
            <Button asChild><Link to="/ventas/nueva"><Plus className="h-4 w-4 mr-2" /> Nueva Venta</Link></Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Desde</span>
          <Input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }} className="h-9 w-40 rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hasta</span>
          <Input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }} className="h-9 w-40 rounded-xl" />
        </div>
        {(desde || hasta) && (
          <Button variant="ghost" size="sm" onClick={() => { setDesde(""); setHasta(""); setPage(1) }}>Limpiar</Button>
        )}
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className={thClass} onClick={() => handleSort("numero")}>
                Número <SortIcon col="numero" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("fecha")}>
                Fecha <SortIcon col="fecha" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("paciente")}>
                Paciente <SortIcon col="paciente" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide select-none cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort("total")}>
                Total <SortIcon col="total" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Saldo</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && <tr><td colSpan={7} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin inline" /></td></tr>}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={7} className="text-center py-14 text-muted-foreground">
                <p className="font-medium">No hay ventas en el período</p>
                <p className="text-xs mt-1">Selecciona un rango de fechas</p>
              </td></tr>
            )}
            {sorted.slice((page - 1) * perPage, page * perPage).map((v, i) => {
              const saldo = v.total - (v.abonado ?? 0)
              const showSaldo = v.estado !== "cobrado" && v.estado !== "anulado"
              return (
                <tr key={v.id}
                    className={`hover:bg-muted/30 transition-colors table-row-anim cursor-pointer ${v.estado === "anulado" ? "opacity-40" : ""}`}
                    style={{ animationDelay: `${i * 25}ms` }}
                    onClick={() => navigate(`/ventas/${v.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.numero}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.fecha}</td>
                  <td className="px-4 py-3 font-medium">{v.paciente_nombre ?? (v.paciente_id ? `Pac. #${v.paciente_id}` : "Consumidor final")}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">${Number(v.total).toFixed(2)}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">
                    {showSaldo ? (
                      <span className={saldo > 0.01 ? "text-red-500" : "text-green-500"}>
                        ${saldo.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><EstadoBadge estado={v.estado} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {(rol === "admin" || rol === "vendedor") && v.estado !== "anulado" && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={e => { e.stopPropagation(); duplicarMut.mutate(v.id) }}
                          disabled={duplicarMut.isPending}
                          title="Duplicar venta"
                          className="h-8 w-8 p-0"
                        >
                          {duplicarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                      {rol === "admin" && v.estado !== "anulado" && (
                        <Button variant="ghost" size="sm"
                                onClick={e => { e.stopPropagation(); setAnulando(v) }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Paginador page={page} total={sorted.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
      </div>

      <Dialog open={!!anulando} onClose={() => setAnulando(null)} className="max-w-md">
        <DialogHeader onClose={() => setAnulando(null)}>Anular Venta</DialogHeader>
        <DialogBody>
          <p>¿Anular la venta <strong>{anulando?.numero}</strong> por <strong>${Number(anulando?.total ?? 0).toFixed(2)}</strong>?</p>
          <p className="text-sm text-muted-foreground mt-1">El stock de los productos se restaurará automáticamente.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAnulando(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => anularMut.mutate(anulando!.id)} disabled={anularMut.isPending}>
            {anularMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Anular
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
