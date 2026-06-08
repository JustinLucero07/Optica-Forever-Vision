import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Search, Pencil, Eye, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { Paginador } from "@/components/ui/Paginador"

interface Paciente {
  id: number
  numero: string
  cedula: string | null
  nombres: string
  apellidos: string
  fecha_nacimiento: string | null
  genero: string | null
  telefono: string | null
  telefono_2: string | null
  email: string | null
  direccion: string | null
  ocupacion: string | null
  foto: string | null
  armazon_tipo: string | null
  armazon_notas: string | null
}

function PacAvatar({ nombre, foto }: { nombre: string; foto: string | null | undefined }) {
  const initials = nombre.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  if (foto) return <img src={foto} alt={nombre} className="h-8 w-8 rounded-full object-cover shrink-0" />
  return (
    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

interface PacienteForm {
  cedula: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string
  genero: string
  telefono: string
  telefono_2: string
  email: string
  direccion: string
  ocupacion: string
  origen: string
  referido_por: string
  armazon_tipo: string
  armazon_notas: string
}

function toPayload(f: PacienteForm) {
  return {
    cedula: f.cedula || null,
    nombres: f.nombres,
    apellidos: f.apellidos,
    fecha_nacimiento: f.fecha_nacimiento || null,
    genero: f.genero || null,
    telefono: f.telefono || null,
    telefono_2: f.telefono_2 || null,
    email: f.email || null,
    direccion: f.direccion || null,
    ocupacion: f.ocupacion || null,
    origen: f.origen || null,
    referido_por: f.referido_por || null,
    armazon_tipo: f.armazon_tipo?.trim() || null,
    armazon_notas: f.armazon_notas?.trim() || null,
  }
}

export default function Pacientes() {
  const [busqueda, setBusqueda] = useState("")
  const [page, setPage]       = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Paciente | null>(null)
  const [eliminando, setEliminando] = useState<Paciente | null>(null)
  const [sortCol, setSortCol] = useState<"nombre" | "cedula" | "">("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => api.get("/pacientes", { params: { q: busqueda } }).then((r) => r.data),
    staleTime: 10_000,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PacienteForm>()

  const crearMut = useMutation({
    mutationFn: (d: PacienteForm) => api.post("/pacientes", toPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); cerrarDialog(); toast.success("Paciente creado") },
    onError: (e) => toast.error(errMsg(e, "Error al crear")),
  })

  const editarMut = useMutation({
    mutationFn: (d: PacienteForm) => api.put(`/pacientes/${editando!.id}`, toPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); cerrarDialog(); toast.success("Paciente actualizado") },
    onError: (e) => toast.error(errMsg(e, "Error al actualizar")),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => api.delete(`/pacientes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); setEliminando(null); toast.success("Paciente eliminado") },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar")),
  })

  function abrirNuevo() {
    setEditando(null)
    reset({ cedula: "", nombres: "", apellidos: "", fecha_nacimiento: "", genero: "", telefono: "", telefono_2: "", email: "", direccion: "", ocupacion: "", origen: "", referido_por: "", armazon_tipo: "", armazon_notas: "" })
    setDialogOpen(true)
  }

  function abrirEditar(p: Paciente) {
    setEditando(p)
    reset({
      cedula: p.cedula ?? "",
      nombres: p.nombres,
      apellidos: p.apellidos,
      fecha_nacimiento: p.fecha_nacimiento ?? "",
      genero: p.genero ?? "",
      telefono: p.telefono ?? "",
      telefono_2: p.telefono_2 ?? "",
      email: p.email ?? "",
      direccion: p.direccion ?? "",
      ocupacion: p.ocupacion ?? "",
      origen: (p as any).origen ?? "",
      referido_por: (p as any).referido_por ?? "",
      armazon_tipo: p.armazon_tipo ?? "",
      armazon_notas: p.armazon_notas ?? "",
    })
    setDialogOpen(true)
  }

  function cerrarDialog() {
    setDialogOpen(false)
    setEditando(null)
  }

  function onSubmit(d: PacienteForm) {
    editando ? editarMut.mutate(d) : crearMut.mutate(d)
  }

  const cargandoMut = crearMut.isPending || editarMut.isPending

  function SortHeader({ col, label }: { col: string; label: string }) {
    const active = sortCol === col
    return (
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => {
          if (active) setSortDir(d => d === "asc" ? "desc" : "asc")
          else { setSortCol(col as any); setSortDir("asc") }
        }}
      >
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    )
  }

  const pacientesFiltrados: Paciente[] = pacientes
  const pacientesSorted = [...pacientesFiltrados].sort((a, b) => {
    if (!sortCol) return 0
    const va = sortCol === "nombre" ? `${a.apellidos} ${a.nombres}` : (a as any)[sortCol] ?? ""
    const vb = sortCol === "nombre" ? `${b.apellidos} ${b.nombres}` : (b as any)[sortCol] ?? ""
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pacientes.length} registros encontrados</p>
        </div>
        {(rol === "admin" || rol === "optometrista" || rol === "vendedor") && (
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Paciente
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre, cédula o teléfono…"
          className="pl-10 h-10 rounded-xl"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
        />
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Número</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                <SortHeader col="nombre" label="Nombre" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                <SortHeader col="cedula" label="Cédula" />
              </th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Teléfono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin inline mb-2" /><br/>Cargando pacientes…
              </td></tr>
            )}
            {!isLoading && pacientes.length === 0 && (
              <tr><td colSpan={5} className="text-center py-14 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No se encontraron pacientes</p>
                <p className="text-xs mt-1">Intenta con otro nombre o cédula</p>
              </td></tr>
            )}
            {pacientesSorted.slice((page - 1) * perPage, page * perPage).map((p: Paciente, i: number) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors table-row-anim"
                  style={{ animationDelay: `${i * 25}ms` }}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-lg text-muted-foreground">{p.numero}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <PacAvatar nombre={p.nombres} foto={p.foto} />
                    <span className="font-semibold">{p.apellidos}, {p.nombres}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{p.cedula ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.telefono ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                      <Link to={`/pacientes/${p.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {(rol === "admin" || rol === "optometrista" || rol === "vendedor") && (
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)} className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {rol === "admin" && (
                      <Button variant="ghost" size="sm" onClick={() => setEliminando(p)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Paginador page={page} total={pacientesSorted.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={cerrarDialog} className="max-w-2xl">
        <DialogHeader onClose={cerrarDialog}>
          {editando ? `Editar — ${editando.apellidos}, ${editando.nombres}` : "Nuevo Paciente"}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nombres *</Label>
              <Input {...register("nombres", { required: "Requerido" })} />
              {errors.nombres && <p className="text-xs text-destructive">{errors.nombres.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Apellidos *</Label>
              <Input {...register("apellidos", { required: "Requerido" })} />
              {errors.apellidos && <p className="text-xs text-destructive">{errors.apellidos.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Cédula</Label>
              <Input {...register("cedula")} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de Nacimiento</Label>
              <Input type="date" {...register("fecha_nacimiento")} />
            </div>
            <div className="space-y-1">
              <Label>Género</Label>
              <select {...register("genero")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar —</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Ocupación</Label>
              <Input {...register("ocupacion")} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input {...register("telefono")} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono 2</Label>
              <Input {...register("telefono_2")} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Dirección</Label>
              <Input {...register("direccion")} />
            </div>
            <div className="space-y-1">
              <Label>¿Cómo nos conoció?</Label>
              <select {...register("origen")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar —</option>
                {["Recomendación", "Facebook", "Instagram", "TikTok", "Google", "Publicidad", "Redes Sociales", "Otro"].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Referido por (nombre)</Label>
              <Input placeholder="Ej: Dr. García, María López..." {...register("referido_por")} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Tipo de armazón preferido</Label>
              <select
                {...register("armazon_tipo")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— Sin especificar —</option>
                <option value="Metálico">Metálico</option>
                <option value="Plástico / Acetato">Plástico / Acetato</option>
                <option value="Sin armazón (dry)">Sin armazón (dry)</option>
                <option value="Deportivo">Deportivo</option>
                <option value="Mariposa">Mariposa</option>
                <option value="Redondo">Redondo</option>
                <option value="Rectangular">Rectangular</option>
                <option value="Aviador">Aviador</option>
                <option value="Ovalado">Ovalado</option>
                <option value="Cuadrado">Cuadrado</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notas de preferencias ópticas</Label>
              <textarea
                {...register("armazon_notas")}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="Color preferido, material, tamaño de cara, etc."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarDialog}>Cancelar</Button>
            <Button type="submit" disabled={cargandoMut}>
              {cargandoMut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editando ? "Guardar cambios" : "Crear paciente"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!eliminando} onClose={() => setEliminando(null)} className="max-w-md">
        <DialogHeader onClose={() => setEliminando(null)}>Eliminar Paciente</DialogHeader>
        <DialogBody>
          <p>¿Estás seguro de eliminar a <strong>{eliminando?.apellidos}, {eliminando?.nombres}</strong>?</p>
          <p className="text-sm text-muted-foreground mt-1">Esta acción no se puede deshacer.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEliminando(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => eliminarMut.mutate(eliminando!.id)} disabled={eliminarMut.isPending}>
            {eliminarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
