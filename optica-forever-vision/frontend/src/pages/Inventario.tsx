import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Search, Pencil, Package, Loader2, AlertTriangle, ArrowDown, Tag, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { Paginador } from "@/components/ui/Paginador"

interface Categoria { id: number; nombre: string; descripcion?: string | null }
interface Proveedor { id: number; nombre: string }
interface Producto {
  id: number; codigo: string | null; nombre: string; descripcion: string | null
  categoria: Categoria | null; proveedor: Proveedor | null; proveedor_id: number | null
  precio_costo: number; precio_venta: number
  stock_actual: number; stock_minimo: number; unidad: string; activo: boolean
}

type ProdForm = {
  codigo: string; nombre: string; descripcion: string; categoria_id: string; proveedor_id: string
  precio_costo: string; precio_venta: string; stock_actual: string; stock_minimo: string; unidad: string
}

type EntradaForm = { cantidad: string; motivo: string }

export default function Inventario() {
  const [busqueda, setBusqueda] = useState("")
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [page, setPage]       = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dialogProd, setDialogProd] = useState(false)
  const [dialogEntrada, setDialogEntrada] = useState(false)
  const [dialogCats, setDialogCats] = useState(false)
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null)
  const [nombreCat, setNombreCat] = useState("")
  const [editando, setEditando] = useState<Producto | null>(null)
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null)
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["categorias"],
    queryFn: () => api.get("/categorias").then(r => r.data),
  })

  const { data: proveedores = [] } = useQuery<Proveedor[]>({
    queryKey: ["proveedores-activos"],
    queryFn: () => api.get("/proveedores", { params: { activo: true } }).then(r => r.data),
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

  const crearCatMut = useMutation({
    mutationFn: (nombre: string) => api.post("/categorias", { nombre }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias"] }); setNombreCat(""); toast.success("Categoría creada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const editarCatMut = useMutation({
    mutationFn: ({ id, nombre }: { id: number; nombre: string }) => api.put(`/categorias/${id}`, { nombre }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias"] }); setEditandoCat(null); setNombreCat(""); toast.success("Categoría actualizada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const eliminarCatMut = useMutation({
    mutationFn: (id: number) => api.delete(`/categorias/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias"] }); qc.invalidateQueries({ queryKey: ["productos"] }); toast.success("Categoría eliminada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  function guardarCat() {
    const n = nombreCat.trim()
    if (!n) return
    if (editandoCat) editarCatMut.mutate({ id: editandoCat.id, nombre: n })
    else crearCatMut.mutate(n)
  }

  function toPayloadProd(d: ProdForm) {
    return {
      codigo: d.codigo || null, nombre: d.nombre, descripcion: d.descripcion || null,
      categoria_id: d.categoria_id ? Number(d.categoria_id) : null,
      proveedor_id: d.proveedor_id ? Number(d.proveedor_id) : null,
      precio_costo: Number(d.precio_costo), precio_venta: Number(d.precio_venta),
      stock_actual: Number(d.stock_actual), stock_minimo: Number(d.stock_minimo), unidad: d.unidad,
    }
  }

  function abrirNuevo() {
    setEditando(null)
    resetProd({ codigo: "", nombre: "", descripcion: "", categoria_id: "", proveedor_id: "", precio_costo: "0", precio_venta: "0", stock_actual: "0", stock_minimo: "0", unidad: "unidad" })
    setDialogProd(true)
  }

  function abrirEditar(p: Producto) {
    setEditando(p)
    resetProd({
      codigo: p.codigo ?? "", nombre: p.nombre, descripcion: p.descripcion ?? "",
      categoria_id: p.categoria?.id?.toString() ?? "",
      proveedor_id: p.proveedor_id?.toString() ?? "",
      precio_costo: String(p.precio_costo),
      precio_venta: String(p.precio_venta), stock_actual: String(p.stock_actual),
      stock_minimo: String(p.stock_minimo), unidad: p.unidad,
    })
    setDialogProd(true)
  }

  function abrirEntrada(p: Producto) {
    setProductoEntrada(p)
    resetEnt({ cantidad: "", motivo: p.proveedor ? `Compra a ${p.proveedor.nombre}` : "" })
    setDialogEntrada(true)
  }

  function cerrarProd() { setDialogProd(false); setEditando(null) }
  function cerrarEntrada() { setDialogEntrada(false); setProductoEntrada(null) }

  const cargandoProd = crearMut.isPending || editarMut.isPending

  const stockBajoCount = productos.filter(p => p.stock_actual <= p.stock_minimo).length

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{productos.length} productos</p>
          {stockBajoCount > 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="h-3.5 w-3.5" /> {stockBajoCount} producto{stockBajoCount > 1 ? "s" : ""} con stock bajo
            </p>
          )}
        </div>
        {(rol === "admin" || rol === "vendedor") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setDialogCats(true); setEditandoCat(null); setNombreCat("") }}>
              <Tag className="h-4 w-4 mr-2" /> Categorías
            </Button>
            <Button onClick={abrirNuevo}><Plus className="h-4 w-4 mr-2" /> Nuevo Producto</Button>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Buscar por nombre o código…" className="pl-10 rounded-xl" value={busqueda}
                 onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={soloStockBajo}
                 onChange={e => { setSoloStockBajo(e.target.checked); setPage(1) }} className="rounded accent-primary" />
          Solo stock bajo
        </label>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Código</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Categoría</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Proveedor</th>
              <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">P. Costo</th>
              <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">P. Venta</th>
              <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Stock</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin inline" /></td></tr>}
            {!isLoading && productos.length === 0 && (
              <tr><td colSpan={8} className="text-center py-14 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No se encontraron productos</p>
              </td></tr>
            )}
            {productos.slice((page - 1) * perPage, page * perPage).map((p, i) => (
              <tr key={p.id} className={`hover:bg-muted/30 transition-colors table-row-anim ${!p.activo ? "opacity-40" : ""}`}
                  style={{ animationDelay: `${i * 25}ms` }}>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.codigo ?? "—"}</td>
                <td className="px-4 py-3 font-semibold">{p.nombre}</td>
                <td className="px-4 py-3">
                  {p.categoria ? (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{p.categoria.nombre}</span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.proveedor?.nombre ?? <span className="opacity-40">—</span>}</td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">${Number(p.precio_costo).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">${Number(p.precio_venta).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-semibold tabular-nums ${p.stock_actual <= p.stock_minimo ? "text-amber-600" : ""}`}>
                    {Number(p.stock_actual).toFixed(0)} {p.unidad}
                  </span>
                  {p.stock_actual <= p.stock_minimo && (
                    <span className="ml-1.5 text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">⚠</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {(rol === "admin" || rol === "vendedor") && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => abrirEntrada(p)} title="Registrar entrada" className="h-8 w-8 p-0">
                          <ArrowDown className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)} className="h-8 w-8 p-0">
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
        <Paginador page={page} total={productos.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
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
            <div className="space-y-1">
              <Label>Proveedor</Label>
              <select {...regProd("proveedor_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— sin proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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

      {/* Dialog Categorías */}
      <Dialog open={dialogCats} onClose={() => { setDialogCats(false); setEditandoCat(null); setNombreCat("") }} className="max-w-md">
        <DialogHeader onClose={() => { setDialogCats(false); setEditandoCat(null); setNombreCat("") }}>
          Gestionar Categorías
        </DialogHeader>
        <DialogBody className="space-y-4">
          {/* Formulario crear/editar */}
          <div className="flex gap-2">
            <Input
              value={nombreCat}
              onChange={e => setNombreCat(e.target.value)}
              placeholder="Nombre de categoría…"
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), guardarCat())}
            />
            <Button onClick={guardarCat} disabled={crearCatMut.isPending || editarCatMut.isPending || !nombreCat.trim()} className="shrink-0">
              {(crearCatMut.isPending || editarCatMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editandoCat ? "Guardar" : <><Plus className="h-4 w-4 mr-1" />Agregar</>}
            </Button>
            {editandoCat && (
              <Button variant="outline" onClick={() => { setEditandoCat(null); setNombreCat("") }} className="shrink-0">
                Cancelar
              </Button>
            )}
          </div>
          {/* Lista */}
          {categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay categorías aún</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border overflow-hidden">
              {categorias.map(c => (
                <li key={c.id} className={`flex items-center justify-between px-3 py-2.5 text-sm ${editandoCat?.id === c.id ? "bg-muted" : "bg-card"}`}>
                  <span className="font-medium">{c.nombre}</span>
                  <div className="flex gap-1">
                    <button
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setEditandoCat(c); setNombreCat(c.nombre) }}
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => { if (confirm(`¿Eliminar categoría "${c.nombre}"?`)) eliminarCatMut.mutate(c.id) }}
                      title="Eliminar"
                      disabled={eliminarCatMut.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDialogCats(false); setEditandoCat(null); setNombreCat("") }}>Cerrar</Button>
        </DialogFooter>
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
