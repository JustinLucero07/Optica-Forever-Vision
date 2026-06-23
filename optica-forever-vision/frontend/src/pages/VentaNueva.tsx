import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Search, Plus, Trash2, ArrowLeft, ShoppingCart, Loader2, Receipt, ClipboardList } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/dialog"
import PacienteCombobox from "@/components/PacienteCombobox"

interface Producto { id: number; nombre: string; codigo: string | null; precio_venta: number; stock_actual: number; unidad: string; proveedor?: { id: number; nombre: string } | null }
interface CartItem { producto_id: number | null; descripcion: string; cantidad: number; precio_unitario: number; descuento_pct: number; garantia_meses: number | null }

function calcSubtotal(it: CartItem) {
  return it.cantidad * it.precio_unitario * (1 - it.descuento_pct / 100)
}

const DRAFT_KEY = "venta_nueva_draft"

export default function VentaNueva() {
  const navigate = useNavigate()
  const location = useLocation()
  const presupuesto = (location.state as any)?.presupuesto
  const ordenInicial = (location.state as any)?.orden as any | undefined
  // Si viene de presupuesto/orden no usamos el borrador guardado
  const hasExternalInit = !!(presupuesto || ordenInicial)

  const initCart = (): CartItem[] => {
    if (ordenInicial) {
      return [{
        producto_id: null,
        descripcion: ordenInicial.tipo ?? "Orden de laboratorio",
        cantidad: 1,
        precio_unitario: Number(ordenInicial.precio_venta ?? 0),
        descuento_pct: 0,
        garantia_meses: null,
      }]
    }
    if (presupuesto?.items?.length) {
      return presupuesto.items.map((it: any) => ({
        producto_id: null,
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        descuento_pct: Number(it.descuento),
        garantia_meses: null,
      }))
    }
    // Restaurar borrador si existe
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) return JSON.parse(raw).cart ?? []
    } catch { /* ignore */ }
    return []
  }

  const initFromDraft = (field: string, fallback: string) => {
    if (hasExternalInit) return fallback
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) return JSON.parse(raw)[field] ?? fallback
    } catch { /* ignore */ }
    return fallback
  }

  const [busqueda, setBusqueda] = useState("")
  const [cart, setCart] = useState<CartItem[]>(initCart)
  const [pacienteId, setPacienteId] = useState(
    ordenInicial?.paciente_id ? String(ordenInicial.paciente_id)
      : presupuesto?.paciente_id ? String(presupuesto.paciente_id)
      : initFromDraft("pacienteId", "")
  )
  const [descuentoGlobal, setDescuentoGlobal] = useState(initFromDraft("descuentoGlobal", "0"))
  const [notas, setNotas] = useState(
    ordenInicial ? `Orden ${ordenInicial.numero} — ${ordenInicial.tipo}`
      : presupuesto ? `Basado en presupuesto ${presupuesto.numero}`
      : initFromDraft("notas", "")
  )
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [linkedOrdenId, setLinkedOrdenId] = useState<number | null>(ordenInicial?.id ?? null)

  // Guardar borrador al cambiar cart, paciente o notas (solo si no viene de externo)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (hasExternalInit) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      if (cart.length > 0 || pacienteId || notas) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ cart, pacienteId, notas, descuentoGlobal }))
      }
    }, 800)
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current) }
  }, [cart, pacienteId, notas, descuentoGlobal, hasExternalInit])
  const [showOrdenPicker, setShowOrdenPicker] = useState(false)
  const [ordenBusq, setOrdenBusq] = useState("")

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-busq", busqueda],
    queryFn: () => api.get("/productos", { params: { q: busqueda, limit: 20 } }).then(r => r.data),
    enabled: busqueda.length >= 1,
    staleTime: 5_000,
  })

  const [cobroInmediato, setCobroInmediato] = useState(false)
  const [cobroMetodo, setCobroMetodo] = useState("efectivo")
  const [cobroCuentaId, setCobroCuentaId] = useState("")

  const { data: cuentasBancarias = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
    staleTime: 60_000,
  })

  const { data: ordenesDisponibles = [] } = useQuery<any[]>({
    queryKey: ["ordenes-sin-venta"],
    queryFn: () => api.get("/ordenes", { params: { limit: 200 } }).then(r =>
      (Array.isArray(r.data) ? r.data : r.data.items ?? []).filter((o: any) => !o.venta_id && !o.es_proforma && o.estado !== "rechazado")
    ),
    enabled: showOrdenPicker,
  })

  const ordenesFiltradas = ordenesDisponibles.filter((o: any) =>
    !ordenBusq || o.numero?.toLowerCase().includes(ordenBusq.toLowerCase()) ||
    o.tipo?.toLowerCase().includes(ordenBusq.toLowerCase())
  )

  function cargarDesdeOrden(o: any) {
    const desc = o.tipo ?? "Orden de laboratorio"
    setCart(prev => [...prev, {
      producto_id: null,
      descripcion: desc,
      cantidad: 1,
      precio_unitario: Number(o.precio_venta ?? 0),
      descuento_pct: 0,
      garantia_meses: null,
    }])
    if (!pacienteId && o.paciente_id) setPacienteId(String(o.paciente_id))
    if (!notas) setNotas(`Orden ${o.numero} — ${o.tipo}`)
    setLinkedOrdenId(o.id)
    setShowOrdenPicker(false)
    setOrdenBusq("")
  }


  const venderMut = useMutation({
    mutationFn: () => api.post("/ventas", {
      paciente_id: pacienteId ? Number(pacienteId) : null,
      fecha,
      descuento: Number(descuentoGlobal),
      notas: notas || null,
      items: cart.map(it => ({
        producto_id: it.producto_id,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        descuento_pct: it.descuento_pct,
        garantia_meses: it.garantia_meses || null,
      })),
    }),
    onSuccess: async (res) => {
      if (linkedOrdenId) {
        await api.put(`/ordenes/${linkedOrdenId}`, { venta_id: res.data.id }).catch(() => {})
      }
      localStorage.removeItem(DRAFT_KEY)
      if (cobroInmediato && cobroCuentaId) {
        try {
          await api.post("/cobros", {
            venta_id: res.data.id,
            cuenta_bancaria_id: Number(cobroCuentaId),
            fecha: new Date().toISOString().slice(0, 10),
            concepto: `Cobro venta ${res.data.numero}`,
            monto: res.data.total,
            metodo_pago: cobroMetodo,
          })
          toast.success(`Venta ${res.data.numero} registrada y cobro aplicado`)
        } catch {
          toast.success(`Venta ${res.data.numero} registrada`)
          toast.error("No se pudo registrar el cobro automático — hazlo desde el detalle")
        }
      } else {
        toast.success(`Venta ${res.data.numero} registrada — registra el cobro aquí`)
      }
      navigate(`/ventas/${res.data.id}`)
    },
    onError: (e) => toast.error(errMsg(e, "Error al guardar")),
  })

  function agregarProducto(p: Producto) {
    const existe = cart.findIndex(it => it.producto_id === p.id)
    if (existe >= 0) {
      setCart(prev => prev.map((it, i) => i === existe ? { ...it, cantidad: it.cantidad + 1 } : it))
    } else {
      setCart(prev => [...prev, { producto_id: p.id, descripcion: p.nombre, cantidad: 1, precio_unitario: p.precio_venta, descuento_pct: 0, garantia_meses: null }])
    }
    setBusqueda("")
  }

  function agregarManual() {
    setCart(prev => [...prev, { producto_id: null, descripcion: "", cantidad: 1, precio_unitario: 0, descuento_pct: 0, garantia_meses: null }])
  }

  function quitarItem(i: number) { setCart(prev => prev.filter((_, idx) => idx !== i)) }

  function actualizarItem(i: number, campo: keyof CartItem, valor: any) {
    setCart(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }

  const subtotal = cart.reduce((s, it) => s + calcSubtotal(it), 0)
  const total = subtotal - Number(descuentoGlobal)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="font-semibold text-lg">Nueva Venta</h1>
        {ordenInicial && (
          <span className="flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 px-2.5 py-1 rounded-full">
            <ClipboardList className="h-3 w-3" /> Desde orden {ordenInicial.numero}
          </span>
        )}
        {presupuesto && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200/60 px-2.5 py-1 rounded-full">
            <Receipt className="h-3 w-3" /> Desde presupuesto {presupuesto.numero}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Buscador de productos */}
        <div className="w-80 border-r flex flex-col bg-muted/10">
          <div className="p-4 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">BUSCAR PRODUCTO</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nombre o código…" className="pl-9 h-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {productos.map(p => (
              <button
                key={p.id}
                onClick={() => agregarProducto(p)}
                className="w-full text-left rounded-md px-3 py-2.5 hover:bg-accent transition-colors border bg-background"
              >
                <p className="font-medium text-sm leading-tight">{p.nombre}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-muted-foreground">{p.codigo ?? "Sin código"}</span>
                  <span className="text-sm font-semibold text-primary">${Number(p.precio_venta).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Stock: {Number(p.stock_actual).toFixed(0)} {p.unidad}</span>
                  {p.proveedor && <span className="text-xs text-muted-foreground/70 italic">{p.proveedor.nombre}</span>}
                </div>
              </button>
            ))}
            {busqueda && productos.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
            )}
          </div>

          <div className="p-4 border-t space-y-2">
            <Button variant="outline" size="sm" className="w-full" onClick={agregarManual}>
              <Plus className="h-4 w-4 mr-1" /> Ítem manual
            </Button>
            <Button
              variant="outline" size="sm"
              className="w-full text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950/30"
              onClick={() => setShowOrdenPicker(true)}
            >
              <ClipboardList className="h-4 w-4 mr-1" /> Cargar desde Orden Lab
            </Button>
          </div>
        </div>

        {/* Carrito */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <ShoppingCart className="h-12 w-12 opacity-20" />
                <p className="text-sm">Buscá un producto para agregar</p>
              </div>
            )}

            {cart.map((it, i) => (
              <div key={i} className="border rounded-md p-3 bg-background space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={it.descripcion}
                    onChange={e => actualizarItem(i, "descripcion", e.target.value)}
                    placeholder="Descripción del ítem"
                    className="flex-1 h-8 text-sm font-medium"
                  />
                  <Button variant="ghost" size="sm" onClick={() => quitarItem(i)} className="text-destructive hover:text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Cantidad</p>
                    <Input type="number" min="1" step="1" value={it.cantidad} onChange={e => actualizarItem(i, "cantidad", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">P. Unitario</p>
                    <Input type="number" min="0" step="0.01" value={it.precio_unitario} onChange={e => actualizarItem(i, "precio_unitario", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Desc. %</p>
                    <Input type="number" min="0" max="100" step="1" value={it.descuento_pct} onChange={e => actualizarItem(i, "descuento_pct", Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Garantía (meses)</p>
                    <Input type="number" min="0" step="1" placeholder="—" value={it.garantia_meses ?? ""} onChange={e => actualizarItem(i, "garantia_meses", e.target.value ? Number(e.target.value) : null)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="h-8 flex items-center font-semibold text-sm">${calcSubtotal(it).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales y checkout */}
          <div className="border-t bg-background p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Paciente (opcional)</Label>
                <PacienteCombobox
                  value={pacienteId}
                  onChange={id => setPacienteId(id)}
                  placeholder="— consumidor final —"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Descuento global ($)</Label>
                <Input type="number" min="0" step="0.01" value={descuentoGlobal} onChange={e => setDescuentoGlobal(e.target.value)} className="h-9 w-32" />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Notas</Label>
                <Input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones…" className="h-9" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Subtotal: ${subtotal.toFixed(2)}</p>
                {Number(descuentoGlobal) > 0 && <p className="text-xs text-muted-foreground">Descuento: -${Number(descuentoGlobal).toFixed(2)}</p>}
                <p className="text-xl font-bold">Total: ${total.toFixed(2)}</p>
              </div>
              {/* Cobro inmediato */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={cobroInmediato} onChange={e => setCobroInmediato(e.target.checked)} className="rounded" />
                  Cobrar al instante
                </label>
                {cobroInmediato && (
                  <div className="flex gap-2">
                    <select value={cobroMetodo} onChange={e => setCobroMetodo(e.target.value)}
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="cheque">Cheque</option>
                    </select>
                    <select value={cobroCuentaId} onChange={e => setCobroCuentaId(e.target.value)}
                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">— cuenta —</option>
                      {cuentasBancarias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <Button
                size="lg"
                disabled={cart.length === 0 || venderMut.isPending || (cobroInmediato && !cobroCuentaId)}
                onClick={() => {
                  const sinPrecio = cart.filter(it => it.precio_unitario <= 0)
                  if (sinPrecio.length > 0) {
                    if (!window.confirm(`${sinPrecio.length} item(s) tienen precio $0.00. ¿Confirmar de todos modos?`)) return
                  }
                  venderMut.mutate()
                }}
              >
                {venderMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar Venta
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Dialog: selector de orden de lab */}
      <Dialog open={showOrdenPicker} onClose={() => { setShowOrdenPicker(false); setOrdenBusq("") }} className="max-w-lg">
        <DialogHeader onClose={() => { setShowOrdenPicker(false); setOrdenBusq("") }}>
          Cargar desde Orden de Lab
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Buscar por número, tipo…"
              value={ordenBusq}
              onChange={e => setOrdenBusq(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-1">
              {ordenesFiltradas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No hay órdenes disponibles sin facturar</p>
              )}
              {ordenesFiltradas.map((o: any) => (
                <button
                  key={o.id}
                  className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-accent transition-colors"
                  onClick={() => cargarDesdeOrden(o)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-sm">{o.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.estado === "listo" ? "bg-green-100 text-green-700" :
                      o.estado === "en_proceso" ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{o.estado}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{o.tipo}</p>
                  {o.precio_venta && (
                    <p className="text-sm font-semibold text-emerald-600 mt-0.5">${Number(o.precio_venta).toFixed(2)}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}
