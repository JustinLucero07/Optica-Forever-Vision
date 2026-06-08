import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, ChevronLeft, ChevronRight, Clock, Loader2, MessageCircle } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Paginador } from "@/components/ui/Paginador"
import { enviarRecordatorioCita } from "@/lib/whatsapp"
import ConfirmDialog from "@/components/ConfirmDialog"

// ── Helpers de fecha (sin date-fns) ───────────────────────────────────────────
const DIAS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function weekMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d); r.setDate(d.getDate() + diff); r.setHours(0, 0, 0, 0)
  return r
}

function plusDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r
}

function plusWeeks(d: Date, n: number): Date { return plusDays(d, n * 7) }

function sameDay(a: Date, b: Date): boolean { return toISO(a) === toISO(b) }

function parseDate(s: string): Date { return new Date(s + "T00:00:00") }

function fmtDia(d: Date) { return DIAS_ES[d.getDay()] }
function fmtNum(d: Date) { return String(d.getDate()) }
function fmtRango(a: Date, b: Date) {
  return `${a.getDate()} ${MESES_ES[a.getMonth()]} – ${b.getDate()} ${MESES_ES[b.getMonth()]} ${b.getFullYear()}`
}
function fmtFechaCorta(d: Date) {
  return `${DIAS_ES[d.getDay()]} ${d.getDate()} ${MESES_ES[d.getMonth()]}`
}
function fmtFechaLarga(s: string) {
  const d = parseDate(s)
  return `${DIAS_ES[d.getDay()].toLowerCase()} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`
}

function getDaysInMonthGrid(d: Date): Date[] {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const start = new Date(firstDay)
  const startDow = firstDay.getDay()
  start.setDate(firstDay.getDate() - (startDow === 0 ? 6 : startDow - 1))
  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
    if (days.length > 42) break
  }
  return days
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Turno {
  id: number
  paciente_id: number | null
  optometrista_id: number | null
  creado_por_id: number
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  motivo: string
  estado: string
  notas: string | null
  created_at: string
}

interface Paciente { id: number; nombres: string; apellidos: string; cedula: string; telefono: string | null }
interface UserItem { id: number; full_name: string; role: string }

const ESTADOS_TURNO = ["pendiente", "confirmado", "asistido", "cancelado", "no_asistio"]

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmado: "bg-blue-100 text-blue-800 border-blue-200",
  asistido: "bg-green-100 text-green-800 border-green-200",
  cancelado: "bg-gray-100 text-gray-600 border-gray-200",
  no_asistio: "bg-red-100 text-red-700 border-red-200",
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pendiente: "secondary", confirmado: "default", asistido: "default",
    cancelado: "outline", no_asistio: "destructive",
  }
  return <Badge variant={map[estado] ?? "outline"}>{estado.replace("_", " ")}</Badge>
}

const EMPTY_FORM = {
  paciente_id: "", optometrista_id: "",
  fecha: toISO(new Date()),
  hora_inicio: "09:00", hora_fin: "",
  motivo: "", estado: "pendiente", notas: "",
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Turnos() {
  const [weekStart, setWeekStart] = useState(() => weekMonday(new Date()))
  const [mesActual, setMesActual] = useState(() => new Date())
  const [view, setView] = useState<"semana" | "lista" | "mes">("lista")
  const [openForm, setOpenForm] = useState(false)
  const [editTurno, setEditTurno] = useState<Turno | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Turno | null>(null)
  const [filtroEstado, setFiltroEstado] = useState("")
  const [busqPac, setBusqPac] = useState("")
  const [pageLista, setPageLista] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const qc = useQueryClient()

  const weekEnd = plusDays(weekStart, 6)

  const fechaIni = view === "mes"
    ? toISO(new Date(mesActual.getFullYear(), mesActual.getMonth(), 1))
    : toISO(weekStart)
  const fechaFin = view === "mes"
    ? toISO(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0))
    : toISO(weekEnd)

  const { data: turnos = [], isLoading } = useQuery<Turno[]>({
    queryKey: ["turnos", fechaIni, fechaFin],
    queryFn: () =>
      api.get("/turnos", { params: { fecha_inicio: fechaIni, fecha_fin: fechaFin, limit: 500 } }).then(r => r.data),
  })

  const { data: pacientes = [] } = useQuery<Paciente[]>({
    queryKey: ["pacientes-mini"],
    queryFn: () => api.get("/pacientes", { params: { limit: 500 } }).then(r => r.data),
  })

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ["users-mini"],
    queryFn: () => api.get("/auth/users").then(r => r.data).catch(() => []),
  })

  const optometristas = users.filter(u => u.role === "optometrista" || u.role === "admin")


  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/turnos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["turnos"] }); toast.success("Turno eliminado") },
    onError: () => toast.error("Error al eliminar"),
  })

  function openNew(fecha?: string) {
    setEditTurno(null)
    setForm({ ...EMPTY_FORM, fecha: fecha ?? toISO(new Date()) })
    setOpenForm(true)
  }

  function openEdit(t: Turno) {
    setEditTurno(t)
    setForm({
      paciente_id: t.paciente_id?.toString() ?? "",
      optometrista_id: t.optometrista_id?.toString() ?? "",
      fecha: t.fecha, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin ?? "",
      motivo: t.motivo, estado: t.estado, notas: t.notas ?? "",
    })
    setOpenForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.motivo || !form.fecha || !form.hora_inicio) {
      toast.error("Completa los campos obligatorios"); return
    }
    setSaving(true)
    try {
      const payload = {
        paciente_id: form.paciente_id ? Number(form.paciente_id) : null,
        optometrista_id: form.optometrista_id ? Number(form.optometrista_id) : null,
        fecha: form.fecha, hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin || null, motivo: form.motivo,
        estado: form.estado, notas: form.notas || null,
      }
      if (editTurno) {
        await api.put(`/turnos/${editTurno.id}`, payload); toast.success("Turno actualizado")
      } else {
        await api.post("/turnos", payload); toast.success("Turno creado")
      }
      qc.invalidateQueries({ queryKey: ["turnos"] }); setOpenForm(false)
    } catch { toast.error("Error al guardar") }
    finally { setSaving(false) }
  }

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i)), [weekStart])

  function turnosDelDia(day: Date) {
    return turnos.filter(t => sameDay(parseDate(t.fecha), day))
  }

  function pacienteNombre(id: number | null) {
    if (!id) return "—"
    const p = pacientes.find(p => p.id === id)
    return p ? `${p.apellidos} ${p.nombres}` : `Pac. #${id}`
  }

  function pacienteTelefono(id: number | null) {
    if (!id) return null
    return pacientes.find(p => p.id === id)?.telefono ?? null
  }

  function enviarRecordatorio(t: Turno) {
    const p = pacientes.find(p => p.id === t.paciente_id)
    if (!p) return
    enviarRecordatorioCita(p.telefono, p.nombres, fmtFechaLarga(t.fecha), t.hora_inicio)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda / Turnos</h1>
          <p className="text-sm text-muted-foreground">
            {view === "mes"
              ? `${MESES_LARGO[mesActual.getMonth()]} ${mesActual.getFullYear()}`
              : fmtRango(weekStart, weekEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "semana" ? "default" : "outline"} size="sm" onClick={() => setView("semana")}>Semana</Button>
          <Button variant={view === "mes" ? "default" : "outline"} size="sm" onClick={() => setView("mes")}>Mes</Button>
          <Button variant={view === "lista" ? "default" : "outline"} size="sm" onClick={() => setView("lista")}>Lista</Button>
          <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" /> Nuevo turno</Button>
        </div>
      </div>

      {/* Week / month navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          if (view === "mes") {
            setMesActual(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          } else {
            setWeekStart(w => plusWeeks(w, -1))
          }
        }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (view === "mes") {
            setMesActual(new Date())
          } else {
            setWeekStart(weekMonday(new Date()))
          }
        }}>Hoy</Button>
        <Button variant="outline" size="sm" onClick={() => {
          if (view === "mes") {
            setMesActual(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          } else {
            setWeekStart(w => plusWeeks(w, 1))
          }
        }}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* SEMANA */}
      {!isLoading && view === "semana" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayTurnos = turnosDelDia(day)
            const isToday = sameDay(day, new Date())
            return (
              <div key={toISO(day)} className="min-h-[200px]">
                <div
                  className={`text-center py-1 rounded-t text-sm font-medium cursor-pointer hover:bg-accent ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  onClick={() => openNew(toISO(day))}
                >
                  <div>{fmtDia(day)}</div>
                  <div className="text-lg">{fmtNum(day)}</div>
                </div>
                <div className="border border-t-0 rounded-b p-1 min-h-[160px] space-y-1 bg-background">
                  {dayTurnos.map(t => (
                    <div
                      key={t.id}
                      className={`text-xs p-1 rounded border cursor-pointer hover:opacity-80 ${ESTADO_COLORS[t.estado] ?? "bg-gray-50"}`}
                      onClick={() => openEdit(t)}
                    >
                      <div className="font-semibold flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {t.hora_inicio}
                      </div>
                      <div className="truncate">{t.motivo}</div>
                      <div className="truncate text-[10px] opacity-75">{pacienteNombre(t.paciente_id)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MES */}
      {!isLoading && view === "mes" && (
        <div>
          <div className="grid grid-cols-7 mb-1">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden">
            {getDaysInMonthGrid(mesActual).map(day => {
              const isCurrentMonth = day.getMonth() === mesActual.getMonth()
              const isToday = sameDay(day, new Date())
              const dayTurnos = turnosDelDia(day)
              const visible = dayTurnos.slice(0, 3)
              const extra = dayTurnos.length - 3
              return (
                <div
                  key={toISO(day)}
                  className={`bg-background min-h-[100px] p-1 ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  <div
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 cursor-pointer hover:bg-accent ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                    onClick={() => openNew(toISO(day))}
                  >
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map(t => (
                      <div
                        key={t.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${ESTADO_COLORS[t.estado] ?? "bg-gray-50"}`}
                        onClick={() => openEdit(t)}
                        title={`${t.hora_inicio} — ${t.motivo}`}
                      >
                        {t.hora_inicio} {t.motivo}
                      </div>
                    ))}
                    {extra > 0 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{extra} más</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTA */}
      {!isLoading && view === "lista" && (
        <>
          {/* Filtros lista */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar paciente..."
              value={busqPac}
              onChange={e => { setBusqPac(e.target.value); setPageLista(1) }}
              className="h-9 w-48"
            />
            <select
              value={filtroEstado}
              onChange={e => { setFiltroEstado(e.target.value); setPageLista(1) }}
              className="border rounded-md px-3 py-2 text-sm bg-background h-9"
            >
              <option value="">Todos los estados</option>
              {ESTADOS_TURNO.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            {(filtroEstado || busqPac) && (
              <Button variant="ghost" size="sm" onClick={() => { setFiltroEstado(""); setBusqPac(""); setPageLista(1) }}>
                Limpiar
              </Button>
            )}
          </div>

          {(() => {
            const sorted = turnos
              .slice()
              .sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`))
              .filter(t => {
                const matchEstado = !filtroEstado || t.estado === filtroEstado
                const matchPac = !busqPac || pacienteNombre(t.paciente_id).toLowerCase().includes(busqPac.toLowerCase())
                return matchEstado && matchPac
              })
            const paged = sorted.slice((pageLista - 1) * perPage, pageLista * perPage)
            return (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2">Fecha</th>
                      <th className="text-left px-4 py-2">Hora</th>
                      <th className="text-left px-4 py-2">Paciente</th>
                      <th className="text-left px-4 py-2">Motivo</th>
                      <th className="text-left px-4 py-2">Estado</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin turnos en este período</td></tr>
                    )}
                    {paged.map(t => {
                      const isPast = `${t.fecha}T${t.hora_inicio}` < new Date().toISOString().slice(0, 16)
                      return (
                        <tr key={t.id} className={`border-t hover:bg-muted/30 ${isPast ? "opacity-60" : ""}`}>
                          <td className="px-4 py-2">{fmtFechaCorta(parseDate(t.fecha))}</td>
                          <td className="px-4 py-2 font-semibold tabular-nums">{t.hora_inicio}{t.hora_fin ? ` – ${t.hora_fin}` : ""}</td>
                          <td className="px-4 py-2">
                            {t.paciente_id
                              ? <Link to={`/pacientes/${t.paciente_id}`} className="hover:text-primary hover:underline underline-offset-2">{pacienteNombre(t.paciente_id)}</Link>
                              : "—"}
                          </td>
                          <td className="px-4 py-2">{t.motivo}</td>
                          <td className="px-4 py-2"><EstadoBadge estado={t.estado} /></td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Editar</Button>
                              {t.paciente_id && pacienteTelefono(t.paciente_id) && (
                                <Button variant="ghost" size="sm" className="text-green-700"
                                  title="Enviar recordatorio WhatsApp" onClick={() => enviarRecordatorio(t)}>
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="text-destructive"
                                onClick={() => setConfirmDel(t)}>
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Paginador page={pageLista} total={sorted.length} perPage={perPage} onChange={setPageLista} onPerPageChange={n => { setPerPage(n); setPageLista(1) }} />
              </div>
            )
          })()}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="Eliminar turno"
        description={confirmDel ? `¿Eliminar el turno del ${fmtFechaCorta(parseDate(confirmDel.fecha))} a las ${confirmDel.hora_inicio}?` : ""}
        confirmLabel="Eliminar"
        loading={deleteMut.isPending}
        onConfirm={() => { deleteMut.mutate(confirmDel!.id); setConfirmDel(null) }}
        onCancel={() => setConfirmDel(null)}
      />

      {/* FORMULARIO */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <h2 className="text-lg font-semibold">{editTurno ? "Editar turno" : "Nuevo turno"}</h2>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Fecha *</label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS_TURNO.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Hora inicio *</label>
                <Input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium">Hora fin</label>
                <Input type="time" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Motivo *</label>
              <Input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                placeholder="Consulta, control, entrega de lentes..." required />
            </div>
            <div>
              <label className="text-sm font-medium">Paciente</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.paciente_id} onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))}>
                <option value="">— Sin asignar —</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.apellidos} {p.nombres} — {p.cedula}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Optometrista</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.optometrista_id} onChange={e => setForm(f => ({ ...f, optometrista_id: e.target.value }))}>
                <option value="">— Sin asignar —</option>
                {optometristas.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Notas</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2} value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones adicionales..." />
            </div>
            {editTurno && (
              <div>
                <p className="text-sm font-medium mb-1">Cambio rápido de estado:</p>
                <div className="flex flex-wrap gap-1">
                  {ESTADOS_TURNO.map(s => (
                    <button key={s} type="button"
                      className={`text-xs px-2 py-1 rounded border ${ESTADO_COLORS[s]} ${form.estado === s ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                      onClick={() => setForm(f => ({ ...f, estado: s }))}>
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
            {editTurno && form.paciente_id && pacienteTelefono(Number(form.paciente_id)) && (
              <Button
                type="button"
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => enviarRecordatorio(editTurno)}
              >
                <MessageCircle className="h-4 w-4 mr-1" /> Recordatorio WA
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editTurno ? "Guardar cambios" : "Crear turno"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
