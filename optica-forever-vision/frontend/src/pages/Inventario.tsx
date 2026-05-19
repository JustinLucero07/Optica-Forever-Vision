import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Search, Pencil, Package, Loader2, AlertTriangle, ArrowDown } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"

interface Categoria { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string; descripcion: string | null
  categoria: Categoria | null; precio_costo: number; precio_venta: number
  stock_actual: number; stock_minimo: number; unidad: string; activo: boolean
}

type ProdForm = {
  codigo: string; nombre: string; descripcion: string; categoria_id: string
  precio_costo: string; precio_venta: string; stock_actual: string; stock_minimo: string; unidad: string
}

type EntradaForm = { cantidad: string; motivo: string }

export default function Inventario() {
  const [busqueda, setBusqueda] = useState("")
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [dialogProd, setDialogProd] = useState(false)
  const [dialogEntrada, setDialogEntrada] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null)
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => api.get("/categorias").then(r => r.data),
  })

  const { data: productos = [], isLoading } = useQuery<Producto[]>({
    queryKey: ["productos", busqueda, soloStockBajo],
    queryFn: () => api.get("/productos", { params: { q: busqueda, stock_bajo: soloStockBajo } }).then(r => r.data),
    staleTime: 10_000,
  })

  const { register: regProd, handleSubmit: hsProd, reset: resetProd, formState: { errors: errProd } } = useForm<ProdForm>()
  const { register: regEnt, handleSubmit: hsEnt, reset: resetEnt } = useForm<EntradaForm>()

  const crearMut = useMutation({
    mutationFn: (d: ProdForm) => api.post("/productos", toPayloadProd(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos"] }); cerrarProd(); toast.success("Producto creado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const editarMut = useMutation({
    mutationFn: (d: ProdForm) => api.put(`/productos/${editando!.id}`, toPayloadProd(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos"] }); cerrarProd(); toast.success("Producto actualizado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const entradaMut = useMutation({
    mutationFn: (d: EntradaForm) => api.post(`/productos/${productoEntrada!.id}/entrada`, { cantidad: Number(d.cantidad), motivo: d.motivo || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["productos"] }); cerrarEntrada(); toast.success("Stock actualizado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  function toPayloadProd(d: ProdForm) {
    return {
      codigo: d.codigo || null, nombre: d.nombre, descripcion: d.descripcion || null,
      categoria_id: d.categoria_id ? Number(d.categoria_id) : null,
      precio_costo: Number(d.precio_costo), precio_venta: Number(d.precio_venta),
      stock_actual: Number(d.stock_actual), stock_minimo: Number(d.stock_minimo), unidad: d.unidad,
    }
  }

  function abrirNuevo() {
    setEditando(null)
    resetProd({ codigo: "", nombre: "", descripcion: "", categoria_id: "", precio_costo: "0", precio_venta: "0", stock_actual: "0", stock_minimo: "0", unidad: "unidad" })
    setDialogProd(true)
  }

  function abrirEditar(p: Producto) {
    setEditando(p)
    resetProd({
      codigo: p.codigo ?? "", nombre: p.nombre, descripcion: p.descripcion ?? "",
      categoria_id: p.categoria?.id?.toString() ?? "", precio_costo: String(p.precio_costo),
      precio_venta: String(p.precio_venta), stock_actual: String(p.stock_actual),
      stock_minimo: String(p.stock_minimo), unidad: p.unidad,
    })
    setDialogProd(true)
  }

  function abrirEntrada(p: Producto) {
    setProductoEntrada(p)
    resetEnt({ cantidad: "", motivo: "" })
    setDialogEntrada(true)
  }

  function cerrarProd() { setDialogProd(false); setEditando(null) }
  function cerrarEntrada() { setDialogEntrada(false); setProductoEntrada(null) }

  const cargandoProd = crearMut.isPending || editarMut.isPending

  const stockBajoCount = productos.filter(p => p.stock_actual <= p.stock_minimo).length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          {stockBajoCount > 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {stockBajoCount} producto{stockBajoCount > 1 ? "s" : ""} con stock bajo
            </p>
          )}
        </div>
        {(rol === "admin" || rol === "vendedor") && (
          <Button onClick={abrirNuevo}><Plus className="h-4 w-4 mr-2" /> Nuevo Producto</Button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o código…" className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={soloStockBajo} onChange={e => setSoloStockBajo(e.target.checked)} className="rounded" />
          Solo stock bajo
        </label>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Código</th>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Categoría</th>
              <th className="text-right px-4 py-3 font-medium">P. Costo</th>
              <th className="text-right px-4 py-3 font-medium">P. Venta</th>
              <th className="text-right px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {!isLoading && productos.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron productos</td></tr>
            )}
            {productos.map(p => (
              <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${!p.activo ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 text-muted-foreground text-xs">{p.codigo ?? "—"}</td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    {p.nombre}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.categoria?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-right">${Number(p.precio_costo).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium">${Number(p.precio_venta).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-medium ${p.stock_actual <= p.stock_minimo ? "text-amber-600" : ""}`}>
                    {Number(p.stock_actual).toFixed(0)} {p.unidad}
                  </span>
                  {p.stock_actual <= p.stock_minimo && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline ml-1" />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {(rol === "admin" || rol === "vendedor") && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => abrirEntrada(p)} title="Registrar entrada">
                          <ArrowDown className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog Producto */}
      <Dialog open={dialogProd} onClose={cerrarProd} className="max-w-2xl">
        <DialogHeader onClose={cerrarProd}>{editando ? "Editar Producto" : "Nuevo Producto"}</DialogHeader>
        <form onSubmit={hsProd(d => editando ? editarMut.mutate(d) : crearMut.mutate(d))}>
          <DialogBody className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Nombre *</Label>
              <Input {...regProd("nombre", { required: "Requerido" })} />
              {errProd.nombre && <p className="text-xs text-destructive">{errProd.nombre.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Código</Label>
              <Input placeholder="Ej: MON-001" {...regProd("codigo")} />
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <select {...regProd("categoria_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— sin categoría —</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Precio Costo ($)</Label>
              <Input type="number" step="0.01" min="0" {...regProd("precio_costo")} />
            </div>
            <div className="space-y-1">
              <Label>Precio Venta ($)</Label>
              <Input type="number" step="0.01" min="0" {...regProd("precio_venta", { required: "Requerido" })} />
            </div>
            <div className="space-y-1">
              <Label>Stock Inicial</Label>
              <Input type="number" step="1" min="0" {...regProd("stock_actual")} />
            </div>
            <div className="space-y-1">
              <Label>Stock Mínimo (alerta)</Label>
              <Input type="number" step="1" min="0" {...regProd("stock_minimo")} />
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <select {...regProd("unidad")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="unidad">Unidad</option>
                <option value="par">Par</option>
                <option value="caja">Caja</option>
                <option value="frasco">Frasco</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Descripción</Label>
              <Input {...regProd("descripcion")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarProd}>Cancelar</Button>
            <Button type="submit" disabled={cargandoProd}>
              {cargandoProd && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editando ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Entrada de stock */}
      <Dialog open={dialogEntrada} onClose={cerrarEntrada} className="max-w-md">
        <DialogHeader onClose={cerrarEntrada}>Entrada de Stock — {productoEntrada?.nombre}</DialogHeader>
        <form onSubmit={hsEnt(d => entradaMut.mutate(d))}>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">Stock actual: <strong>{productoEntrada?.stock_actual} {productoEntrada?.unidad}</strong></p>
            <div className="space-y-1">
              <Label>Cantidad a ingresar *</Label>
              <Input type="number" step="1" min="1" {...regEnt("cantidad", { required: true, min: 1 })} />
            </div>
            <div className="space-y-1">
              <Label>Motivo (opcional)</Label>
              <Input placeholder="Compra proveedor, devolución…" {...regEnt("motivo")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarEntrada}>Cancelar</Button>
            <Button type="submit" disabled={entradaMut.isPending}>
              {entradaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar entrada
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
