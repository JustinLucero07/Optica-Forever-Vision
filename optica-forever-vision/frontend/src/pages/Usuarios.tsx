import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Pencil, Loader2, UserCheck, UserX, Search, Upload, X } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"

type Rol = "admin" | "optometrista" | "vendedor"

interface Usuario {
  id: number
  full_name: string
  email: string
  role: Rol
  is_active: boolean
  firma_url: string | null
  created_at: string
}

interface UsuarioForm {
  full_name: string
  email: string
  password: string
  role: Rol
}

const rolColors: Record<Rol, string> = {
  admin: "bg-purple-100 text-purple-800",
  optometrista: "bg-blue-100 text-blue-800",
  vendedor: "bg-green-100 text-green-800",
}

const rolLabel: Record<Rol, string> = {
  admin: "Admin",
  optometrista: "Optometrista",
  vendedor: "Vendedor",
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export default function Usuarios() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState("")
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null)
  const firmaInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const setSession = useAuthStore((s) => s.setSession)
  const authToken = useAuthStore((s) => s.token)
  const authUser = useAuthStore((s) => s.user)

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => api.get("/usuarios").then((r) => r.data),
    staleTime: 10_000,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UsuarioForm>()

  const crearMut = useMutation({
    mutationFn: (d: UsuarioForm) =>
      api.post("/usuarios", {
        full_name: d.full_name,
        email: d.email,
        password: d.password,
        role: d.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      cerrarDialog()
      toast.success("Usuario creado")
    },
    onError: (e) => toast.error(errMsg(e, "Error al crear")),
  })

  const editarMut = useMutation({
    mutationFn: (d: UsuarioForm) => {
      const payload: Record<string, any> = {
        full_name: d.full_name,
        email: d.email,
        role: d.role,
      }
      if (d.password) payload.password = d.password
      if (firmaPreview !== null) payload.firma_url = firmaPreview || null
      return api.put(`/usuarios/${editando!.id}`, payload)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      // Si editamos el usuario actual, actualizar el store con la nueva firma
      if (editando?.id === currentUserId && authToken && authUser) {
        setSession(authToken, { ...authUser, firma_url: res.data.firma_url ?? null })
      }
      cerrarDialog()
      toast.success("Usuario actualizado")
    },
    onError: (e) => toast.error(errMsg(e, "Error al actualizar")),
  })

  const toggleActivoMut = useMutation({
    mutationFn: (u: Usuario) => api.put(`/usuarios/${u.id}`, { is_active: !u.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      toast.success("Estado actualizado")
    },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  function handleToggleActivo(u: Usuario) {
    const accion = u.is_active ? "desactivar" : "activar"
    if (!confirm(`¿Confirmas ${accion} al usuario "${u.full_name}"?`)) return
    toggleActivoMut.mutate(u)
  }

  function abrirNuevo() {
    setEditando(null)
    reset({ full_name: "", email: "", password: "", role: "vendedor" })
    setDialogOpen(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setFirmaPreview(null)
    reset({ full_name: u.full_name, email: u.email, password: "", role: u.role })
    setDialogOpen(true)
  }

  function cerrarDialog() {
    setDialogOpen(false)
    setEditando(null)
    setFirmaPreview(null)
  }

  function handleFirmaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setFirmaPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function onSubmit(d: UsuarioForm) {
    editando ? editarMut.mutate(d) : crearMut.mutate(d)
  }

  const cargandoMut = crearMut.isPending || editarMut.isPending

  const usuariosFiltrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase()
    const matchText = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRol = !filtroRol || u.role === filtroRol
    return matchText && matchRol
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button onClick={abrirNuevo}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            className="pl-9 w-64"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="optometrista">Optometrista</option>
          <option value="vendedor">Vendedor</option>
        </select>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Fecha creación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td>
              </tr>
            )}
            {!isLoading && usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron usuarios
                </td>
              </tr>
            )}
            {usuariosFiltrados.map((u) => (
              <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${!u.is_active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rolColors[u.role] ?? "bg-gray-100 text-gray-800"}`}>
                    {rolLabel[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge className={u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {u.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatFecha(u.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActivo(u)}
                        disabled={toggleActivoMut.isPending}
                        title={u.is_active ? "Desactivar usuario" : "Activar usuario"}
                      >
                        {u.is_active ? (
                          <UserX className="h-4 w-4 text-destructive" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onClose={cerrarDialog} className="max-w-lg">
        <DialogHeader onClose={cerrarDialog}>
          {editando ? `Editar — ${editando.full_name}` : "Nuevo Usuario"}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre completo *</Label>
              <Input {...register("full_name", { required: "Requerido" })} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" {...register("email", { required: "Requerido" })} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>{editando ? "Nueva contraseña (dejar en blanco para no cambiar)" : "Contraseña *"}</Label>
              <Input
                type="password"
                {...register("password", {
                  required: editando ? false : "Requerido",
                  minLength: { value: 6, message: "Mínimo 6 caracteres" },
                })}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Rol *</Label>
              <select
                {...register("role", { required: "Requerido" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="vendedor">Vendedor</option>
                <option value="optometrista">Optometrista</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
            {editando && (
              <div className="space-y-2">
                <Label>Firma digital (para PDFs)</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-40 border rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden">
                    {(firmaPreview ?? editando.firma_url) ? (
                      <img src={firmaPreview ?? editando.firma_url!} alt="firma" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin firma</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => firmaInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> Subir imagen
                    </Button>
                    {(firmaPreview ?? editando.firma_url) && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setFirmaPreview("")}>
                        <X className="h-3.5 w-3.5 mr-1" /> Quitar firma
                      </Button>
                    )}
                  </div>
                  <input ref={firmaInputRef} type="file" accept="image/*" className="hidden" onChange={handleFirmaChange} />
                </div>
                <p className="text-xs text-muted-foreground">PNG transparente recomendado. Se mostrará en los certificados.</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarDialog}>
              Cancelar
            </Button>
            <Button type="submit" disabled={cargandoMut}>
              {cargandoMut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editando ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
