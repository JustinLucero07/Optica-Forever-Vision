import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileX, ShoppingCart, Loader2, CheckCircle, AlertCircle, Pencil, Zap, ExternalLink } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}
function fmtMoney(n: number) { return `$${n.toFixed(2)}` }

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", enviado: "Enviado", en_proceso: "En proceso",
  listo: "Listo", entregado: "Entregado", rechazado: "Rechazado",
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-600",
  enviado: "bg-blue-100 text-blue-700",
  en_proceso: "bg-indigo-100 text-indigo-700",
  listo: "bg-green-100 text-green-700",
  entregado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-600",
}
const METODOS = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "cheque", "deposito"]

export default function Proformas() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<"todas" | "proforma" | "pendiente">("todas")
  const [busq, setBusq] = useState("")

  // Modal editar precios
  const [editando, setEditando] = useState<any | null>(null)
  const [editArmazon, setEditArmazon] = useState("")
  const [editLunas, setEditLunas] = useState("")

  // Modal facturar directo
  const [facturando, setFacturando] = useState<any | null>(null)
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [registrarCobro, setRegistrarCobro] = useState(true)
  const [cuentaId, setCuentaId] = useState("")
  const [ventaCreada, setVentaCreada] = useState<{ id: number; numero: string } | null>(null)

  const { data: ordenes = [], isLoading } = useQuery<any[]>({
    queryKey: ["proformas-ordenes"],
    queryFn: () => api.get("/ordenes", { params: { limit: 500 } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).filter((o: any) => !o.venta_id && o.estado !== "rechazado")
    ),
    staleTime: 30_000,
  })

  const { data: pacientes = [] } = useQuery<{ id: number; nombres: string; apellidos: string }[]>({
    queryKey: ["pacientes-mini"],
    queryFn: () => api.get("/pacientes", { params: { limit: 2000 } }).then(r => r.data.items ?? r.data),
    staleTime: 300_000,
  })

  const { data: cuentas = [] } = useQuery<{ id: number; nombre: string; tipo: string }[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
    staleTime: 300_000,
  })

  const pacNombre = (id: number) => {
    const p = pacientes.find(p => p.id === id)
    return p ? `${p.apellidos} ${p.nombres}` : `#${id}`
  }

  // ── Editar precios ──────────────────────────────────────────────────────────
  function abrirEditPrecios(o: any) {
    setEditando(o)
    setEditArmazon(o.precio_armazon != null ? String(Number(o.precio_armazon).toFixed(2)) : "")
    setEditLunas(o.precio_lunas != null ? String(Number(o.precio_lunas).toFixed(2)) : "")
  }

  const totalEdit = (parseFloat(editArmazon) || 0) + (parseFloat(editLunas) || 0)

  const preciosMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/ordenes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proformas-ordenes"] })
      toast.success("Precios guardados")
      setEditando(null)
    },
    onError: () => toast.error("Error al guardar precios"),
  })

  function guardarPrecios() {
    if (!editando) return
    const armazon = parseFloat(editArmazon) || 0
    const lunas = parseFloat(editLunas) || 0
    const total = armazon + lunas
    if (total <= 0) { toast.error("Ingresa al menos un precio mayor a 0"); return }
    preciosMut.mutate({
      id: editando.id,
      data: { precio_armazon: armazon > 0 ? armazon : null, precio_lunas: lunas > 0 ? lunas : null, precio_venta: total },
    })
  }

  // ── Facturar directo ────────────────────────────────────────────────────────
  function abrirFacturar(o: any) {
    setFacturando(o)
    setMetodoPago("efectivo")
    setRegistrarCobro(true)
    setCuentaId(cuentas[0]?.id ? String(cuentas[0].id) : "")
    setVentaCreada(null)
  }

  const facturarMut = useMutation({
    mutationFn: async (o: any) => {
      const total = Number(o.precio_venta)
      const items: any[] = []
      if (Number(o.precio_armazon) > 0) {
        items.push({ producto_id: null, descripcion: `Armazón${o.armazon_ref ? ` (${o.armazon_ref})` : ""}`, cantidad: 1, precio_unitario: Number(o.precio_armazon), descuento_pct: 0 })
      }
      if (Number(o.precio_lunas) > 0) {
        items.push({ producto_id: null, descripcion: `Lunas ${o.tipo}`, cantidad: 1, precio_unitario: Number(o.precio_lunas), descuento_pct: 0 })
      }
      if (!items.length) {
        items.push({ producto_id: null, descripcion: `Orden de laboratorio ${o.numero}`, cantidad: 1, precio_unitario: total, descuento_pct: 0 })
      }
      const venta = await api.post("/ventas", {
        paciente_id: o.paciente_id,
        fecha: new Date().toISOString().slice(0, 10),
        descuento: 0,
        notas: `Generado desde orden ${o.numero}`,
        items,
      })
      const ventaId = venta.data.id
      // Vincular la orden a la venta
      await api.put(`/ordenes/${o.id}`, { venta_id: ventaId }).catch(() => {})
      // Registrar cobro si se eligió
      if (registrarCobro && cuentaId) {
        await api.post("/cobros", {
          venta_id: ventaId,
          monto: total,
          metodo_pago: metodoPago,
          cuenta_bancaria_id: Number(cuentaId),
          fecha: new Date().toISOString().slice(0, 10),
          concepto: `Cobro venta ${venta.data.numero}`,
        }).catch(() => {})
      }
      return venta.data
    },
    onSuccess: (venta) => {
      qc.invalidateQueries({ queryKey: ["proformas-ordenes"] })
      qc.invalidateQueries({ queryKey: ["nav-badge-proformas"] })
      setVentaCreada({ id: venta.id, numero: venta.numero })
    },
    onError: () => toast.error("Error al crear la venta"),
  })

  const proformasMut = useMutation({
    mutationFn: ({ id, es_proforma }: { id: number; es_proforma: boolean }) => api.put(`/ordenes/${id}`, { es_proforma }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proformas-ordenes"] }); toast.success("Orden actualizada") },
    onError: () => toast.error("Error al actualizar"),
  })

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const filtradas = ordenes.filter(o => {
    if (filtro === "proforma" && !o.es_proforma) return false
    if (filtro === "pendiente" && o.es_proforma) return false
    if (busq) {
      const q = busq.toLowerCase()
      return (
        o.numero?.toLowerCase().includes(q) ||
        pacNombre(o.paciente_id).toLowerCase().includes(q) ||
        o.tipo?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalProformas = ordenes.filter(o => o.es_proforma)
  const totalPendientes = ordenes.filter(o => !o.es_proforma)
  const montoProforma = totalProformas.reduce((s, o) => s + (Number(o.precio_venta) || 0), 0)
  const montoPendiente = totalPendientes.reduce((s, o) => s + (Number(o.precio_venta) || 0), 0)

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileX className="h-6 w-6 text-orange-500" />
            Órdenes sin Facturar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Órdenes de laboratorio que aún no tienen venta asociada
          </p>
        </div>
      </div>

      {/* KPIs clickables */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total sin facturar", count: ordenes.length, monto: null, key: "todas", color: "border-primary bg-primary/5" },
          { label: "Proformas", count: totalProformas.length, monto: montoProforma, key: "proforma", color: "border-orange-400 bg-orange-50 dark:bg-orange-950/20", textColor: "text-orange-500" },
          { label: "Pendientes", count: totalPendientes.length, monto: montoPendiente, key: "pendiente", color: "border-blue-400 bg-blue-50 dark:bg-blue-950/20", textColor: "text-blue-500" },
        ].map(({ label, count, monto, key, color, textColor }) => (
          <div
            key={key}
            className={`rounded-2xl p-3 sm:p-4 text-center cursor-pointer border-2 transition-all ${filtro === key ? color : "border-border bg-card hover:bg-muted/40"}`}
            onClick={() => setFiltro(key as any)}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${filtro === key && textColor ? textColor : ""}`}>{count}</p>
            {monto != null && <p className={`text-xs mt-0.5 font-medium ${textColor ?? "text-muted-foreground"}`}>{fmtMoney(monto)}</p>}
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="flex flex-wrap gap-2">
        <input
          className="flex h-9 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1 min-w-[200px]"
          placeholder="Buscar por número, paciente o tipo…"
          value={busq}
          onChange={e => setBusq(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="¡Todo facturado!"
            description="No hay órdenes pendientes en esta categoría"
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {["N°", "Paciente", "Tipo", "Envío", "Estado", "Armazón", "Lunas", "Total", "Tipo orden", "Acciones"].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${["Armazón", "Lunas", "Total"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtradas.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-xs">{o.numero}</td>
                  <td className="px-4 py-3 font-medium max-w-[160px] truncate">{pacNombre(o.paciente_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.tipo}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(o.fecha_envio)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[o.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {ESTADO_LABEL[o.estado] ?? o.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.precio_armazon != null && Number(o.precio_armazon) > 0
                      ? fmtMoney(Number(o.precio_armazon))
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {o.precio_lunas != null && Number(o.precio_lunas) > 0
                      ? fmtMoney(Number(o.precio_lunas))
                      : <span className="text-muted-foreground/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {o.precio_venta && Number(o.precio_venta) > 0
                      ? <span className="text-primary">{fmtMoney(Number(o.precio_venta))}</span>
                      : <span className="flex items-center justify-end gap-1 text-amber-500 font-normal text-xs whitespace-nowrap">
                          <AlertCircle className="h-3.5 w-3.5" /> Sin precio
                        </span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {o.es_proforma
                      ? <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">Proforma</span>
                      : <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end items-center">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title="Editar precios" onClick={() => abrirEditPrecios(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {o.es_proforma ? (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-orange-600" onClick={() => proformasMut.mutate({ id: o.id, es_proforma: false })}>
                          Quitar
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => proformasMut.mutate({ id: o.id, es_proforma: true })}>
                          Proforma
                        </Button>
                      )}
                      {!o.es_proforma && (
                        <>
                          {/* Facturar directo */}
                          {o.precio_venta && Number(o.precio_venta) > 0 ? (
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => abrirFacturar(o)}
                              title="Facturar en 1 click"
                            >
                              <Zap className="h-3.5 w-3.5 mr-1" /> Facturar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })}
                              title="Ir a venta nueva"
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Nueva venta
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── Modal editar precios ── */}
      {editando && (
        <Dialog open onClose={() => setEditando(null)} className="max-w-sm">
          <DialogHeader onClose={() => setEditando(null)}>
            Precios — Orden {editando.numero}
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">{editando.tipo} · {pacNombre(editando.paciente_id)}</p>
            {editando.armazon_ref && (
              <p className="text-xs text-muted-foreground">Armazón ref: <strong>{editando.armazon_ref}</strong></p>
            )}
            {[
              { label: "Precio Armazón", val: editArmazon, set: setEditArmazon },
              { label: "Precio Lunas", val: editLunas, set: setEditLunas },
            ].map(({ label, val, set }) => (
              <div key={label} className="space-y-1">
                <Label>{label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" className="pl-6" value={val} onChange={e => set(e.target.value)} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary">{fmtMoney(totalEdit)}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardarPrecios} disabled={preciosMut.isPending || totalEdit <= 0}>
              {preciosMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* ── Modal Facturar directo ── */}
      {facturando && (
        <Dialog open onClose={() => setFacturando(null)} className="max-w-md">
          <DialogHeader onClose={() => setFacturando(null)}>
            {ventaCreada ? "¡Venta creada!" : `Facturar orden ${facturando.numero}`}
          </DialogHeader>
          <DialogBody className="space-y-4">
            {ventaCreada ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="font-semibold text-lg">Venta {ventaCreada.numero} generada</p>
                <p className="text-sm text-muted-foreground">La orden quedó vinculada automáticamente</p>
                <Link
                  to={`/ventas/${ventaCreada.id}`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  onClick={() => setFacturando(null)}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Ver detalle de la venta
                </Link>
              </div>
            ) : (
              <>
                {/* Resumen */}
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paciente</span>
                    <span className="font-medium">{pacNombre(facturando.paciente_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo</span>
                    <span>{facturando.tipo}</span>
                  </div>
                  {Number(facturando.precio_armazon) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Armazón</span>
                      <span className="tabular-nums">{fmtMoney(Number(facturando.precio_armazon))}</span>
                    </div>
                  )}
                  {Number(facturando.precio_lunas) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lunas</span>
                      <span className="tabular-nums">{fmtMoney(Number(facturando.precio_lunas))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold">
                    <span>Total</span>
                    <span className="text-primary tabular-nums">{fmtMoney(Number(facturando.precio_venta))}</span>
                  </div>
                </div>

                {/* Cobro inmediato */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={registrarCobro}
                      onChange={e => setRegistrarCobro(e.target.checked)}
                    />
                    <span className="text-sm font-medium">Registrar cobro inmediato</span>
                  </label>
                  {registrarCobro && (
                    <div className="pl-6 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Método de pago</Label>
                        <select
                          className="flex h-9 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={metodoPago}
                          onChange={e => setMetodoPago(e.target.value)}
                        >
                          {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      {cuentas.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Cuenta bancaria</Label>
                          <select
                            className="flex h-9 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={cuentaId}
                            onChange={e => setCuentaId(e.target.value)}
                          >
                            {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogBody>
          {!ventaCreada && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setFacturando(null)}>Cancelar</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => facturarMut.mutate(facturando)}
                disabled={facturarMut.isPending || (registrarCobro && !cuentaId)}
              >
                {facturarMut.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando…</>
                  : <><Zap className="h-4 w-4 mr-2" /> Crear venta {registrarCobro ? "+ cobro" : ""}</>
                }
              </Button>
            </DialogFooter>
          )}
          {ventaCreada && (
            <DialogFooter>
              <Button onClick={() => setFacturando(null)}>Cerrar</Button>
            </DialogFooter>
          )}
        </Dialog>
      )}
    </div>
  )
}
