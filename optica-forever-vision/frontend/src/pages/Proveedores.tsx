import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Phone, Mail, Building2 } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

interface Proveedor {
  id: number
  ruc: string | null
  nombre: string
  nombre_comercial: string | null
  tipo: string
  telefono: string | null
  telefono_2: string | null
  email: string | null
  direccion: string | null
  ciudad: string | null
  contacto: string | null
  activo: boolean
  notas: string | null
}

const TIPOS = [
  { value: "laboratorio", label: "Laboratorio" },
  { value: "armazones", label: "Armazones" },
  { value: "insumos", label: "Insumos" },
  { value: "contactologia", label: "Contactología" },
  { value: "servicios", label: "Servicios" },
  { value: "otro", label: "Otro" },
]

const TIPO_COLORS: Record<string, string> = {
  laboratorio: "bg-blue-100 text-blue-800",
  armazones: "bg-purple-100 text-purple-800",
  insumos: "bg-amber-100 text-amber-800",
  contactologia: "bg-cyan-100 text-cyan-800",
  servicios: "bg-green-100 text-green-800",
  otro: "bg-gray-100 text-gray-700",
}

const EMPTY: Omit<Proveedor, "id"> = {
  ruc: "",
  nombre: "",
  nombre_comercial: "",
  tipo: "laboratorio",
  telefono: "",
  telefono_2: "",
  email: "",
  direccion: "",
  ciudad: "",
  contacto: "",
  activo: true,
  notas: "",
}

export default function Proveedores() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [openForm, setOpenForm] = useState(false)
  const [editP, setEditP] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<Omit<Proveedor, "id">>(EMPTY)
  const [saving, setSaving] = useState(false)

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: () => api.get("/proveedores").then(r => r.data),
  })

  function openNew() {
    setEditP(null)
    setForm({ ...EMPTY })
    setOpenForm(true)
  }

  function openEdit(p: Proveedor) {
    setEditP(p)
    setForm({
      ruc: p.ruc ?? "",
      nombre: p.nombre,
      nombre_comercial: p.nombre_comercial ?? "",
      tipo: p.tipo,
      telefono: p.telefono ?? "",
      telefono_2: p.telefono_2 ?? "",
      email: p.email ?? "",
      direccion: p.direccion ?? "",
      ciudad: p.ciudad ?? "",
      contacto: p.contacto ?? "",
      activo: p.activo,
      notas: p.notas ?? "",
    })
    setOpenForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        ruc: form.ruc?.trim() || null,
        nombre_comercial: form.nombre_comercial?.trim() || null,
        telefono: form.telefono?.trim() || null,
        telefono_2: form.telefono_2?.trim() || null,
        email: form.email?.trim() || null,
        direccion: form.direccion?.trim() || null,
        ciudad: form.ciudad?.trim() || null,
        contacto: form.contacto?.trim() || null,
        notas: form.notas?.trim() || null,
      }
      if (editP) {
        await api.put(`/proveedores/${editP.id}`, payload)
        toast.success("Proveedor actualizado")
      } else {
        await api.post("/proveedores", payload)
        toast.success("Proveedor creado")
      }
      qc.invalidateQueries({ queryKey: ["proveedores"] })
      setOpenForm(false)
    } catch (err: any) {
      const msg = err?.response?.data?.detail
      toast.error(msg === "Ya existe un proveedor con ese RUC" ? msg : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const filtered = proveedores.filter(p => {
    const term = search.toLowerCase()
    const matchText = !term || p.nombre.toLowerCase().includes(term)
      || (p.nombre_comercial ?? "").toLowerCase().includes(term)
      || (p.ruc ?? "").includes(term)
    const matchTipo = !filtroTipo || p.tipo === filtroTipo
    return matchText && matchTipo
  })

  const f = (field: keyof Omit<Proveedor, "id">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo proveedor
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar por nombre o RUC..."
          className="w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No hay proveedores</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className={`border rounded-lg p-4 space-y-2 bg-card ${!p.activo ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.nombre}</p>
                  {p.nombre_comercial && (
                    <p className="text-xs text-muted-foreground truncate">{p.nombre_comercial}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[p.tipo] ?? "bg-gray-100"}`}>
                    {TIPOS.find(t => t.value === p.tipo)?.label ?? p.tipo}
                  </span>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {p.ruc && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> RUC: {p.ruc}
                </p>
              )}
              {p.telefono && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {p.telefono}
                  {p.telefono_2 && ` / ${p.telefono_2}`}
                </p>
              )}
              {p.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {p.email}
                </p>
              )}
              {p.contacto && (
                <p className="text-xs text-muted-foreground">Contacto: {p.contacto}</p>
              )}
              {!p.activo && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
            </div>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <h2 className="text-lg font-semibold">{editP ? "Editar proveedor" : "Nuevo proveedor"}</h2>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={form.nombre} onChange={f("nombre")} placeholder="Razón social o nombre" required />
              </div>
              <div>
                <label className="text-sm font-medium">Nombre comercial</label>
                <Input value={form.nombre_comercial ?? ""} onChange={f("nombre_comercial")} placeholder="Nombre de fantasía..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">RUC / Cédula</label>
                <Input value={form.ruc ?? ""} onChange={f("ruc")} placeholder="1234567890001" />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.tipo}
                  onChange={f("tipo")}
                >
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Teléfono / WhatsApp</label>
                <Input value={form.telefono ?? ""} onChange={f("telefono")} placeholder="0999123456" />
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono 2</label>
                <Input value={form.telefono_2 ?? ""} onChange={f("telefono_2")} placeholder="022123456" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={form.email ?? ""} onChange={f("email")} placeholder="lab@ejemplo.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Contacto (persona)</label>
                <Input value={form.contacto ?? ""} onChange={f("contacto")} placeholder="Nombre del representante..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Dirección</label>
                <Input value={form.direccion ?? ""} onChange={f("direccion")} placeholder="Calle y número..." />
              </div>
              <div>
                <label className="text-sm font-medium">Ciudad</label>
                <Input value={form.ciudad ?? ""} onChange={f("ciudad")} placeholder="Cuenca" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notas</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                value={form.notas ?? ""}
                onChange={f("notas")}
                placeholder="Condiciones, plazos, observaciones..."
              />
            </div>

            {editP && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="activo" className="text-sm">Activo</label>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editP ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
