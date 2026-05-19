import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Search, Pencil, Eye, Trash2, Loader2 } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"

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
  }
}

export default function Pacientes() {
  const [busqueda, setBusqueda] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Paciente | null>(null)
  const [eliminando, setEliminando] = useState<Paciente | null>(null)
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
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al crear"),
  })

  const editarMut = useMutation({
    mutationFn: (d: PacienteForm) => api.put(`/pacientes/${editando!.id}`, toPayload(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); cerrarDialog(); toast.success("Paciente actualizado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al actualizar"),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => api.delete(`/pacientes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); setEliminando(null); toast.success("Paciente eliminado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al eliminar"),
  })

  function abrirNuevo() {
    setEditando(null)
    reset({ cedula: "", nombres: "", apellidos: "", fecha_nacimiento: "", genero: "", telefono: "", telefono_2: "", email: "", direccion: "", ocupacion: "", origen: "", referido_por: "" })
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pacientes</h1>
        {(rol === "admin" || rol === "optometrista" || rol === "vendedor") && (
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Paciente
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, cédula o teléfono…"
          className="pl-9"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Número</th>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Cédula</th>
              <th className="text-left px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
            )}
            {!isLoading && pacientes.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron pacientes</td></tr>
            )}
            {pacientes.map((p: Paciente) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Badge variant="outline">{p.numero}</Badge>
                </td>
                <td className="px-4 py-3 font-medium">{p.apellidos}, {p.nombres}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.cedula ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.telefono ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/pacientes/${p.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {(rol === "admin" || rol === "optometrista" || rol === "vendedor") && (
                      <Button variant="ghost" size="sm" onClick={() => abrirEditar(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {rol === "admin" && (
                      <Button variant="ghost" size="sm" onClick={() => setEliminando(p)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
