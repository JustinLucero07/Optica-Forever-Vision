import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Search, Plus, Trash2, ArrowLeft, ShoppingCart, Loader2, Receipt } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PacienteCombobox from "@/components/PacienteCombobox"

interface Producto { id: number; nombre: string; codigo: string | null; precio_venta: number; stock_actual: number; unidad: string; proveedor?: { id: number; nombre: string } | null }
interface CartItem { producto_id: number | null; descripcion: string; cantidad: number; precio_unitario: number; descuento_pct: number; garantia_meses: number | null }

function calcSubtotal(it: CartItem) {
  return it.cantidad * it.precio_unitario * (1 - it.descuento_pct / 100)
}

export default function VentaNueva() {
  const navigate = useNavigate()
  const location = useLocation()
  const presupuesto = (location.state as any)?.presupuesto

  const initCart = (): CartItem[] => {
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
    return []
  }

  const [busqueda, setBusqueda] = useState("")
  const [cart, setCart] = useState<CartItem[]>(initCart)
  const [pacienteId, setPacienteId] = useState(presupuesto?.paciente_id ? String(presupuesto.paciente_id) : "")
  const [descuentoGlobal, setDescuentoGlobal] = useState("0")
  const [notas, setNotas] = useState(presupuesto ? `Basado en presupuesto ${presupuesto.numero}` : "")
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-busq", busqueda],
    queryFn: () => api.get("/productos", { params: { q: busqueda, limit: 20 } }).then(r => r.data),
    enabled: busqueda.length >= 1,
    staleTime: 5_000,
  })


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
    onSuccess: (res) => {
      toast.success(`Venta ${res.data.numero} registrada`)
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

          <div className="p-4 border-t">
            <Button variant="outline" size="sm" className="w-full" onClick={agregarManual}>
              <Plus className="h-4 w-4 mr-1" /> Ítem manual
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
              <Button
                size="lg"
                disabled={cart.length === 0 || venderMut.isPending}
                onClick={() => venderMut.mutate()}
              >
                {venderMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar Venta
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
