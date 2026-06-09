import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Printer, Trash2, ChevronDown, ChevronUp, Search, FileText, Check, X, ShoppingCart, Copy } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Paginador } from "@/components/ui/Paginador"
import { useAuthStore } from "@/store/auth"
import ConfirmDialog from "@/components/ConfirmDialog"

// ── Types ──────────────────────────────────────────────────────────────────────
interface ItemRow { descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }
interface Presupuesto {
  id: number; numero: string; paciente_id: number | null; paciente_nombre: string | null
  fecha: string; estado: string; notas: string | null; total: number; validez_dias: number
  created_at: string; items: ItemRow[]
}
interface Paciente { id: number; nombres: string; apellidos: string; cedula: string | null }

const ESTADOS_COLOR: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  enviado: "bg-blue-100 text-blue-700",
  aceptado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
  expirado: "bg-orange-100 text-orange-700",
}

const fmt = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
const today = () => new Date().toISOString().slice(0, 10)

// ── Item editor row ────────────────────────────────────────────────────────────
function ItemEditorRow({
  item, idx, onChange, onRemove,
}: {
  item: { descripcion: string; cantidad: string; precio_unitario: string; descuento: string }
  idx: number
  onChange: (idx: number, field: string, val: string) => void
  onRemove: (idx: number) => void
}) {
  const sub = parseFloat(item.cantidad || "0") * parseFloat(item.precio_unitario || "0") * (1 - parseFloat(item.descuento || "0") / 100)
  return (
    <div className="grid grid-cols-12 gap-1.5 items-center text-sm">
      <Input className="col-span-5" placeholder="Descripción" value={item.descripcion} onChange={e => onChange(idx, "descripcion", e.target.value)} />
      <Input className="col-span-2" type="number" min="0.01" step="0.01" placeholder="Qty" value={item.cantidad} onChange={e => onChange(idx, "cantidad", e.target.value)} />
      <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="Precio" value={item.precio_unitario} onChange={e => onChange(idx, "precio_unitario", e.target.value)} />
      <Input className="col-span-1" type="number" min="0" max="100" step="1" placeholder="%" value={item.descuento} onChange={e => onChange(idx, "descuento", e.target.value)} />
      <div className="col-span-1 text-right font-semibold tabular-nums">{fmt(isNaN(sub) ? 0 : sub)}</div>
      <button onClick={() => onRemove(idx)} className="col-span-1 text-red-500 hover:text-red-700 flex justify-center">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Print view ─────────────────────────────────────────────────────────────────
function PrintView({ p, optica }: { p: Presupuesto; optica: string }) {
  return (
    <div id="print-area" className="hidden print:block p-8 font-sans text-sm text-black">
      <div className="flex justify-between items-start border-b pb-4 mb-4">
        <div>
          <h1 className="text-xl font-bold">{optica}</h1>
          <p className="text-gray-500 text-xs mt-1">Sistema de gestión óptica</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">PRESUPUESTO</p>
          <p className="text-gray-600">{p.numero}</p>
          <p className="text-gray-500 text-xs">Fecha: {p.fecha} · Válido {p.validez_dias} días</p>
        </div>
      </div>
      {p.paciente_nombre && (
        <div className="mb-4">
          <p className="font-semibold">Paciente:</p>
          <p>{p.paciente_nombre}</p>
        </div>
      )}
      <table className="w-full border-collapse mb-4 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Descripción</th>
            <th className="border px-2 py-1 text-right">Qty</th>
            <th className="border px-2 py-1 text-right">Precio</th>
            <th className="border px-2 py-1 text-right">Desc.%</th>
            <th className="border px-2 py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((it, i) => (
            <tr key={i}>
              <td className="border px-2 py-1">{it.descripcion}</td>
              <td className="border px-2 py-1 text-right">{it.cantidad}</td>
              <td className="border px-2 py-1 text-right">{fmt(it.precio_unitario)}</td>
              <td className="border px-2 py-1 text-right">{it.descuento}%</td>
              <td className="border px-2 py-1 text-right font-semibold">{fmt(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="border px-2 py-1 text-right font-bold">TOTAL</td>
            <td className="border px-2 py-1 text-right font-bold text-base">{fmt(p.total)}</td>
          </tr>
        </tfoot>
      </table>
      {p.notas && <p className="text-xs text-gray-500 mt-2">Notas: {p.notas}</p>}
      <p className="text-xs text-gray-400 mt-6 text-center">
        Este presupuesto es válido por {p.validez_dias} días a partir de la fecha de emisión.
      </p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Presupuestos() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const rol = useAuthStore(s => s.user?.role)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [printP, setPrintP] = useState<Presupuesto | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [confirmEliminar, setConfirmEliminar] = useState<Presupuesto | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)

  // Form state
  const [pacQuery, setPacQuery] = useState("")
  const [pacSelId, setPacSelId] = useState<number | null>(null)
  const [pacSelNombre, setPacSelNombre] = useState("")
  const [fecha, setFecha] = useState(today())
  const [validez, setValidez] = useState("30")
  const [notas, setNotas] = useState("")
  const [items, setItems] = useState([{ descripcion: "", cantidad: "1", precio_unitario: "", descuento: "0" }])

  const { data: presupuestos = [], isLoading } = useQuery<Presupuesto[]>({
    queryKey: ["presupuestos"],
    queryFn: () => api.get("/presupuestos").then(r => r.data),
  })

  const { data: opticaConfig } = useQuery<{ nombre_optica?: string }>({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 60_000,
  })

  const { data: pacResults = [] } = useQuery<Paciente[]>({
    queryKey: ["pac-search-pre", pacQuery],
    queryFn: () => pacQuery.length >= 2
      ? api.get("/pacientes", { params: { q: pacQuery, limit: 8 } }).then(r => r.data)
      : Promise.resolve([]),
    enabled: pacQuery.length >= 2 && !pacSelId,
  })

  const crearMut = useMutation({
    mutationFn: (data: object) => api.post("/presupuestos", data),
    onSuccess: () => {
      toast.success("Presupuesto creado")
      qc.invalidateQueries({ queryKey: ["presupuestos"] })
      resetForm()
    },
    onError: e => toast.error(errMsg(e, "Error al crear presupuesto")),
  })

  const estadoMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: string }) =>
      api.patch(`/presupuestos/${id}/estado`, null, { params: { estado } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presupuestos"] }),
    onError: e => toast.error(errMsg(e, "Error")),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => api.delete(`/presupuestos/${id}`),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["presupuestos"] }) },
    onError: e => toast.error(errMsg(e, "Error al eliminar")),
  })

  const duplicarMut = useMutation({
    mutationFn: (p: Presupuesto) => api.post("/presupuestos", {
      paciente_id: p.paciente_id,
      fecha: today(),
      notas: p.notas,
      validez_dias: p.validez_dias,
      items: p.items.map(it => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento: it.descuento,
      })),
    }),
    onSuccess: () => { toast.success("Presupuesto duplicado"); qc.invalidateQueries({ queryKey: ["presupuestos"] }) },
    onError: e => toast.error(errMsg(e, "Error al duplicar")),
  })

  function resetForm() {
    setShowForm(false); setPacQuery(""); setPacSelId(null); setPacSelNombre("")
    setFecha(today()); setValidez("30"); setNotas("")
    setItems([{ descripcion: "", cantidad: "1", precio_unitario: "", descuento: "0" }])
  }

  function itemChange(idx: number, field: string, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(it => it.descripcion.trim() && it.precio_unitario)
    if (!validItems.length) { toast.error("Agrega al menos un ítem con descripción y precio"); return }
    crearMut.mutate({
      paciente_id: pacSelId,
      fecha,
      notas: notas || null,
      validez_dias: parseInt(validez) || 30,
      items: validItems.map(it => ({
        descripcion: it.descripcion,
        cantidad: parseFloat(it.cantidad) || 1,
        precio_unitario: parseFloat(it.precio_unitario),
        descuento: parseFloat(it.descuento) || 0,
      })),
    })
  }

  function handlePrint(p: Presupuesto) {
    setPrintP(p)
    setTimeout(() => window.print(), 150)
  }

  function convertirAVenta(p: Presupuesto) {
    navigate("/ventas/nueva", { state: { presupuesto: p } })
  }

  function convertirAOrden(p: Presupuesto) {
    navigate("/ordenes", { state: { fromPresupuesto: { paciente_id: p.paciente_id, notas: `Basado en presupuesto ${p.numero}` } } })
  }

  const presupuestosFiltrados = presupuestos.filter(p => {
    if (filtroEstado && p.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return p.numero.toLowerCase().includes(q) || (p.paciente_nombre?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  const totalForm = items.reduce((acc, it) => {
    const sub = parseFloat(it.cantidad || "0") * parseFloat(it.precio_unitario || "0") * (1 - parseFloat(it.descuento || "0") / 100)
    return acc + (isNaN(sub) ? 0 : sub)
  }, 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Presupuestos / Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Genera y envía cotizaciones a tus pacientes</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo presupuesto
        </Button>
      </div>

      {/* ── Formulario ── */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Paciente */}
                <div className="space-y-1 relative">
                  <Label>Paciente (opcional)</Label>
                  {pacSelId ? (
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
                      <span className="flex-1">{pacSelNombre}</span>
                      <button type="button" onClick={() => { setPacSelId(null); setPacSelNombre(""); setPacQuery("") }} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar paciente..." value={pacQuery} onChange={e => setPacQuery(e.target.value)} />
                      </div>
                      {pacResults.length > 0 && (
                        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border rounded-md shadow-lg max-h-48 overflow-auto">
                          {pacResults.map(p => (
                            <button key={p.id} type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => { setPacSelId(p.id); setPacSelNombre(`${p.apellidos} ${p.nombres}`); setPacQuery("") }}>
                              {p.apellidos} {p.nombres}
                              {p.cedula && <span className="text-muted-foreground ml-1 text-xs">· {p.cedula}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Fecha</Label>
                  <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Validez (días)</Label>
                  <Input type="number" min="1" value={validez} onChange={e => setValidez(e.target.value)} />
                </div>
              </div>

              {/* Ítems */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1.5 text-xs font-semibold text-muted-foreground">
                  <div className="col-span-5">Descripción</div>
                  <div className="col-span-2">Cantidad</div>
                  <div className="col-span-2">Precio</div>
                  <div className="col-span-1">Desc.%</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1" />
                </div>
                {items.map((it, idx) => (
                  <ItemEditorRow key={idx} item={it} idx={idx} onChange={itemChange}
                    onRemove={idx => setItems(prev => prev.filter((_, i) => i !== idx))} />
                ))}
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setItems(prev => [...prev, { descripcion: "", cantidad: "1", precio_unitario: "", descuento: "0" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar ítem
                </Button>
                <div className="text-right font-bold text-lg">Total: {fmt(totalForm)}</div>
              </div>

              <div className="space-y-1">
                <Label>Notas internas</Label>
                <Input placeholder="Observaciones, condiciones, etc." value={notas} onChange={e => setNotas(e.target.value)} />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" disabled={crearMut.isPending}>
                  {crearMut.isPending ? "Guardando…" : "Crear presupuesto"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-9 w-56" placeholder="Buscar por nº o paciente…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[null, "borrador", "enviado", "aceptado", "rechazado", "expirado"].map(est => (
            <button key={est ?? "todos"} onClick={() => { setFiltroEstado(est); setPage(1) }}
              className={[
                "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                filtroEstado === est
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
              ].join(" ")}>
              {est ?? "Todos"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ── */}
      {isLoading && <p className="text-muted-foreground text-sm">Cargando…</p>}

      <div className="space-y-2">
        {presupuestosFiltrados.slice((page - 1) * perPage, page * perPage).map(p => (
          <div key={p.id} className="border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{p.numero}</span>
                  {p.paciente_nombre && <span className="text-sm text-muted-foreground">— {p.paciente_nombre}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADOS_COLOR[p.estado] ?? "bg-muted"}`}>{p.estado}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.fecha} · {p.items.length} ítems · {fmt(p.total)}</p>
              </div>
              {expanded === p.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </div>

            {expanded === p.id && (
              <div className="border-t p-4 space-y-3 bg-muted/10">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-2 py-1 rounded-l">Descripción</th>
                      <th className="text-right px-2 py-1">Qty</th>
                      <th className="text-right px-2 py-1">Precio</th>
                      <th className="text-right px-2 py-1">Desc.%</th>
                      <th className="text-right px-2 py-1 rounded-r">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((it, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-2 py-1">{it.descripcion}</td>
                        <td className="px-2 py-1 text-right">{it.cantidad}</td>
                        <td className="px-2 py-1 text-right">{fmt(it.precio_unitario)}</td>
                        <td className="px-2 py-1 text-right">{it.descuento}%</td>
                        <td className="px-2 py-1 text-right font-semibold">{fmt(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="px-2 py-1 text-right font-bold">TOTAL</td>
                      <td className="px-2 py-1 text-right font-bold text-base">{fmt(p.total)}</td>
                    </tr>
                  </tfoot>
                </table>
                {p.notas && <p className="text-xs text-muted-foreground">Notas: {p.notas}</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                  {["enviado", "aceptado", "rechazado"].map(est => (
                    <Button key={est} size="sm" variant="outline"
                      className={p.estado === est ? "opacity-40 cursor-default" : ""}
                      disabled={p.estado === est}
                      onClick={() => estadoMut.mutate({ id: p.id, estado: est })}>
                      {est === "aceptado" && <Check className="h-3.5 w-3.5 mr-1 text-green-600" />}
                      {est === "rechazado" && <X className="h-3.5 w-3.5 mr-1 text-red-500" />}
                      {est.charAt(0).toUpperCase() + est.slice(1)}
                    </Button>
                  ))}
                  {p.estado === "aceptado" && (
                    <>
                      <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => convertirAVenta(p)}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Convertir a venta
                      </Button>
                      <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        onClick={() => convertirAOrden(p)}>
                        <FileText className="h-3.5 w-3.5 mr-1" /> Crear orden lab
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handlePrint(p)}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir / PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => duplicarMut.mutate(p)} disabled={duplicarMut.isPending}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                  </Button>
                  {(rol === "admin") && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto"
                      onClick={() => setConfirmEliminar(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {!isLoading && presupuestosFiltrados.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            {presupuestos.length === 0
              ? "No hay presupuestos aún. Crea el primero con el botón de arriba."
              : "Sin resultados con el filtro actual."}
          </p>
        )}
      </div>
      {presupuestosFiltrados.length > 0 && (
        <div className="border rounded-lg">
          <Paginador page={page} total={presupuestosFiltrados.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
        </div>
      )}

      {/* Print area (oculto en pantalla) */}
      {printP && <PrintView p={printP} optica={opticaConfig?.nombre_optica ?? "Óptica"} />}

      <ConfirmDialog
        open={!!confirmEliminar}
        title="Eliminar presupuesto"
        description={`¿Eliminar el presupuesto ${confirmEliminar?.numero}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={eliminarMut.isPending}
        onConfirm={() => { eliminarMut.mutate(confirmEliminar!.id); setConfirmEliminar(null) }}
        onCancel={() => setConfirmEliminar(null)}
      />
    </div>
  )
}
