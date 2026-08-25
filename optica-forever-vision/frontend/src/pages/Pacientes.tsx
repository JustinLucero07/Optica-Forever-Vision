import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Search, Pencil, Trash2, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Users, ChevronDown, ChevronUp, UserCheck, UserPlus } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"
import { Paginador } from "@/components/ui/Paginador"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function calcularEdad(fechaNac: string): number | null {
  if (!fechaNac) return null
  const nac = new Date(fechaNac)
  if (isNaN(nac.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad >= 0 ? edad : null
}

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

interface Usuario { id: number; full_name: string; role: string; is_active: boolean }

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
  referido_a_usuario_id: string
  armazon_tipo: string
  armazon_notas: string
}

type OptomeForm = { full_name: string; username: string; password: string }

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
    referido_a_usuario_id: f.referido_a_usuario_id ? Number(f.referido_a_usuario_id) : null,
    armazon_tipo: f.armazon_tipo?.trim() || null,
    armazon_notas: f.armazon_notas?.trim() || null,
  }
}

export default function Pacientes() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<"lista" | "referidos">("lista")
  const [busqueda, setBusqueda] = useState("")
  const [page, setPage]       = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Paciente | null>(null)
  const [eliminando, setEliminando] = useState<Paciente | null>(null)
  const [sortCol, setSortCol] = useState<"nombre" | "cedula" | "">("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [expandidoRef, setExpandidoRef] = useState<string | null>(null)
  const [dialogOptom, setDialogOptom] = useState(false)
  const [refDropdownOpen, setRefDropdownOpen] = useState(false)
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => api.get("/usuarios").then(r => r.data),
    staleTime: 60_000,
  })
  const optometristas = usuarios.filter(u => u.is_active && (u.role === "optometrista" || u.role === "admin"))

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", busqueda],
    queryFn: () => api.get("/pacientes", { params: { q: busqueda } }).then((r) => r.data),
    staleTime: 10_000,
  })

  interface RefGrupo { referido_por: string; total: number; pacientes: { id: number; nombre: string; numero: string; referido_a_nombre?: string | null }[] }
  const { data: referidos = [], isLoading: cargandoRef } = useQuery<RefGrupo[]>({
    queryKey: ["referidos-stats"],
    queryFn: () => api.get("/pacientes/referidos-stats").then(r => r.data),
    staleTime: 60_000,
    enabled: tab === "referidos",
  })

  interface ReferidoMaster { id: number; nombre: string; activo: boolean }
  const { data: referidosMaster = [] } = useQuery<ReferidoMaster[]>({
    queryKey: ["referidos-list"],
    queryFn: () => api.get("/referidos").then(r => r.data),
    staleTime: 60_000,
  })
  const referidosActivos = referidosMaster.filter(r => r.activo)

  const [editandoRef, setEditandoRef] = useState<ReferidoMaster | null>(null)
  const [nombreRefEdit, setNombreRefEdit] = useState("")

  const editarRefMut = useMutation({
    mutationFn: (r: ReferidoMaster) => api.put(`/referidos/${r.id}`, { nombre: r.nombre, activo: r.activo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referidos-list"] })
      qc.invalidateQueries({ queryKey: ["referidos-stats"] })
      qc.invalidateQueries({ queryKey: ["pacientes"] })
      setEditandoRef(null)
      toast.success("Referido actualizado")
    },
    onError: (e) => toast.error(errMsg(e, "Error al actualizar")),
  })

  const eliminarRefMut = useMutation({
    mutationFn: (id: number) => api.delete(`/referidos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referidos-list"] })
      toast.success("Referido eliminado de la lista")
    },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar")),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PacienteForm>()
  const { register: rO, handleSubmit: hsO, reset: resetO, formState: { errors: errO } } = useForm<OptomeForm>()

  const crearOptomMut = useMutation({
    mutationFn: (d: OptomeForm) => api.post("/usuarios", { full_name: d.full_name, username: d.username, password: d.password, role: "optometrista" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["usuarios"] })
      setValue("referido_a_usuario_id", String(res.data.id))
      setDialogOptom(false)
      resetO()
      toast.success(`Optometrista "${res.data.full_name}" creado`)
    },
    onError: (e) => toast.error(errMsg(e, "Error al crear optometrista")),
  })

  function upsertReferido(nombre: string | undefined) {
    const n = (nombre ?? "").trim()
    if (!n) return
    api.post("/referidos", { nombre: n }).then(() => qc.invalidateQueries({ queryKey: ["referidos-list"] })).catch(() => {})
  }

  const crearMut = useMutation({
    mutationFn: (d: PacienteForm) => api.post("/pacientes", toPayload(d)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["pacientes"] }); cerrarDialog(); toast.success("Paciente creado")
      upsertReferido(variables.referido_por)
    },
    onError: (e) => toast.error(errMsg(e, "Error al crear")),
  })

  const editarMut = useMutation({
    mutationFn: (d: PacienteForm) => api.put(`/pacientes/${editando!.id}`, toPayload(d)),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["pacientes"] }); cerrarDialog(); toast.success("Paciente actualizado")
      upsertReferido(variables.referido_por)
    },
    onError: (e) => toast.error(errMsg(e, "Error al actualizar")),
  })

  const eliminarMut = useMutation({
    mutationFn: (id: number) => api.delete(`/pacientes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pacientes"] }); setEliminando(null); toast.success("Paciente eliminado") },
    onError: (e) => toast.error(errMsg(e, "Error al eliminar")),
  })

  function abrirNuevo() {
    setEditando(null)
    reset({ cedula: "", nombres: "", apellidos: "", fecha_nacimiento: "", genero: "", telefono: "", telefono_2: "", email: "", direccion: "", ocupacion: "", origen: "", referido_por: "", referido_a_usuario_id: "", armazon_tipo: "", armazon_notas: "" })
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
      referido_a_usuario_id: (p as any).referido_a_usuario_id ? String((p as any).referido_a_usuario_id) : "",
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
    <div className="p-3 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([["lista", "Lista de pacientes"], ["referidos", "Referidos"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "referidos" && <UserCheck className="h-3.5 w-3.5 inline mr-1.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Referidos ─────────────────────────────────────────────────────── */}
      {tab === "referidos" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pacientes agrupados por quién los refirió a la óptica.
          </p>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Administrar lista de referidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {referidosMaster.length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay referidos registrados.</p>
              )}
              {referidosMaster.map(r => (
                <div key={r.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                  {editandoRef?.id === r.id ? (
                    <>
                      <Input
                        value={nombreRefEdit}
                        onChange={e => setNombreRefEdit(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <Button size="sm" className="h-8" disabled={editarRefMut.isPending}
                        onClick={() => editarRefMut.mutate({ ...r, nombre: nombreRefEdit })}>
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setEditandoRef(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm truncate ${!r.activo ? "text-muted-foreground line-through" : ""}`}>
                        {r.nombre}
                      </span>
                      <button
                        title="Editar"
                        onClick={() => { setEditandoRef(r); setNombreRefEdit(r.nombre) }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => eliminarRefMut.mutate(r.id)}
                        disabled={eliminarRefMut.isPending}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {cargandoRef && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>}
          {!cargandoRef && referidos.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Sin datos de referidos aún</p>
                <p className="text-xs mt-1">Registra el campo "Referido por" al crear o editar un paciente</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {referidos.map((g) => (
              <Card key={g.referido_por} className="overflow-hidden">
                <CardHeader
                  className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandidoRef(expandidoRef === g.referido_por ? null : g.referido_por)}
                >
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <UserCheck className="h-4 w-4 text-amber-600" />
                      </div>
                      <span className="font-semibold truncate">{g.referido_por}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xl font-bold text-amber-600">{g.total}</span>
                      {expandidoRef === g.referido_por
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground pl-10">
                    {g.total} paciente{g.total !== 1 ? "s" : ""} referido{g.total !== 1 ? "s" : ""}
                  </p>
                </CardHeader>
                {expandidoRef === g.referido_por && (
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-1 border-t pt-2">
                      {g.pacientes.map(p => (
                        <Link
                          key={p.id}
                          to={`/pacientes/${p.id}`}
                          className="flex items-start justify-between px-2 py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-sm gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate hover:underline">{p.nombre}</p>
                            {p.referido_a_nombre && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                                <UserCheck className="h-3 w-3 shrink-0" />
                                {p.referido_a_nombre}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">{p.numero}</span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          {referidos.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border text-sm">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <span className="font-semibold">{referidos.reduce((s, g) => s + g.total, 0)}</span>
                <span className="text-muted-foreground ml-1">pacientes referidos por</span>
                <span className="font-semibold ml-1">{referidos.length}</span>
                <span className="text-muted-foreground ml-1">personas distintas</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Lista ─────────────────────────────────────────────────────────── */}
      {tab === "lista" && <>
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
        <div className="overflow-x-auto">
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
              <tr key={p.id}
                  className="hover:bg-muted/30 transition-colors table-row-anim cursor-pointer"
                  style={{ animationDelay: `${i * 25}ms` }}
                  onClick={() => navigate(`/pacientes/${p.id}`)}>
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
                    {(rol === "admin" || rol === "optometrista" || rol === "vendedor") && (
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); abrirEditar(p) }} className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {rol === "admin" && (
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setEliminando(p) }}
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
        </div>
        <Paginador page={page} total={pacientesSorted.length} perPage={perPage} onChange={setPage} onPerPageChange={n => { setPerPage(n); setPage(1) }} />
      </div>
      </>}

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
              {(() => {
                const edad = calcularEdad(watch("fecha_nacimiento"))
                return edad != null ? (
                  <p className="text-xs text-muted-foreground">{edad} año{edad !== 1 ? "s" : ""}</p>
                ) : null
              })()}
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
            <div className="space-y-1 relative">
              <Label>Referido por (nombre externo)</Label>
              <Input
                placeholder="Ej: Dr. García, María López..."
                autoComplete="off"
                {...register("referido_por")}
                onFocus={() => setRefDropdownOpen(true)}
                onBlur={() => setTimeout(() => setRefDropdownOpen(false), 150)}
              />
              {refDropdownOpen && (() => {
                const texto = (watch("referido_por") ?? "").trim().toLowerCase()
                const coincidencias = referidosActivos.filter(r => !texto || r.nombre.toLowerCase().includes(texto))
                const hayExacto = referidosActivos.some(r => r.nombre.toLowerCase() === texto)
                return (coincidencias.length > 0 || (texto && !hayExacto)) ? (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-border rounded-md shadow-xl max-h-48 overflow-y-auto bg-card">
                    {coincidencias.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onMouseDown={() => { setValue("referido_por", r.nombre); setRefDropdownOpen(false) }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        {r.nombre}
                      </button>
                    ))}
                    {texto && !hayExacto && (
                      <button
                        type="button"
                        onMouseDown={() => setRefDropdownOpen(false)}
                        className="w-full text-left px-3 py-1.5 text-sm text-primary hover:bg-accent transition-colors border-t"
                      >
                        + Crear "{watch("referido_por")}"
                      </button>
                    )}
                  </div>
                ) : null
              })()}
            </div>
            <div className="space-y-1">
              <Label>Referido al optometrista</Label>
              <div className="flex gap-1.5">
                <select
                  {...register("referido_a_usuario_id")}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— sin asignar —</option>
                  {optometristas.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
                {rol === "admin" && (
                  <Button type="button" variant="outline" size="sm" className="px-2 shrink-0" title="Crear nuevo optometrista"
                    onClick={() => { resetO(); setDialogOptom(true) }}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
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

      {/* Mini-dialog crear optometrista */}
      <Dialog open={dialogOptom} onClose={() => setDialogOptom(false)} className="max-w-sm">
        <DialogHeader onClose={() => setDialogOptom(false)}>Nuevo Optometrista</DialogHeader>
        <form onSubmit={hsO(d => crearOptomMut.mutate(d))}>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre completo *</Label>
              <Input placeholder="Danna Mendoza Ávila" {...rO("full_name", { required: "Requerido" })} />
              {errO.full_name && <p className="text-xs text-destructive">{errO.full_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Usuario (login) *</Label>
              <Input placeholder="danna.mendoza" {...rO("username", { required: "Requerido" })} />
              {errO.username && <p className="text-xs text-destructive">{errO.username.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Contraseña temporal *</Label>
              <Input type="password" placeholder="mín. 6 caracteres" {...rO("password", { required: "Requerido", minLength: { value: 6, message: "Mín. 6 caracteres" } })} />
              {errO.password && <p className="text-xs text-destructive">{errO.password.message}</p>}
            </div>
            <p className="text-xs text-muted-foreground">Se creará con rol <strong>Optometrista</strong>. Podrá cambiar su contraseña después.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOptom(false)}>Cancelar</Button>
            <Button type="submit" disabled={crearOptomMut.isPending}>
              {crearOptomMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear y seleccionar
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
