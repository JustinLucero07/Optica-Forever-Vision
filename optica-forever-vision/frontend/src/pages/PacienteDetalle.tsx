import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Plus, Calendar, Stethoscope, Loader2, MessageCircle,
  Camera, Trash2, StickyNote, Send, DollarSign, CreditCard, ShoppingBag,
  History, CheckCircle, XCircle,
} from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"
import { enviarControlVisual, enviarCumpleanios } from "@/lib/whatsapp"
import { toast } from "sonner"
import { errMsg } from "@/lib/errors"
import ConfirmDialog from "@/components/ConfirmDialog"

// ── Helpers ────────────────────────────────────────────────────────────────────
function campo(label: string, valor: string | null | undefined) {
  if (!valor) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  )
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)

function fmtFechaControl(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

// ── Sección: Foto ──────────────────────────────────────────────────────────────
function FotoSection({ pacienteId, foto }: { pacienteId: number | string; foto: string | null | undefined }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const subirMut = useMutation({
    mutationFn: (base64: string) => api.put(`/pacientes/${pacienteId}/foto`, { foto: base64 }),
    onSuccess: () => { toast.success("Foto actualizada"); qc.invalidateQueries({ queryKey: ["paciente", String(pacienteId)] }) },
    onError: e => toast.error(errMsg(e, "Error al subir foto")),
  })

  const eliminarMut = useMutation({
    mutationFn: () => api.delete(`/pacientes/${pacienteId}/foto`),
    onSuccess: () => { toast.success("Foto eliminada"); qc.invalidateQueries({ queryKey: ["paciente", String(pacienteId)] }) },
    onError: e => toast.error(errMsg(e, "Error al eliminar foto")),
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no debe superar 2 MB"); return }
    const reader = new FileReader()
    reader.onload = () => subirMut.mutate(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors"
        onClick={() => fileRef.current?.click()}
        title="Clic para subir foto"
      >
        {foto
          ? <img src={foto} alt="Foto paciente" className="w-full h-full object-cover" />
          : <Camera className="h-8 w-8 text-muted-foreground/50" />
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => fileRef.current?.click()} disabled={subirMut.isPending}>
          {subirMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
          {foto ? "Cambiar" : "Subir foto"}
        </Button>
        {foto && (
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => setConfirmDel(true)} disabled={eliminarMut.isPending}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <ConfirmDialog open={confirmDel} title="Eliminar foto"
        description="¿Eliminar la foto del paciente?"
        confirmLabel="Eliminar" loading={eliminarMut.isPending}
        onConfirm={() => { eliminarMut.mutate(); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)} />
    </div>
  )
}

// ── Sección: Estado de cuenta ──────────────────────────────────────────────────
function EstadoCuenta({ pacienteId }: { pacienteId: number | string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["estado-cuenta", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}/estado-cuenta`).then(r => r.data),
    staleTime: 30_000,
  })

  const ventas: any[] = Array.isArray(data?.ventas_pendientes) ? data.ventas_pendientes : []
  const creditos: any[] = Array.isArray(data?.creditos_activos) ? data.creditos_activos : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-amber-500" /> Estado de cuenta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}
        {data && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-xl p-3 text-center ${data.total_deuda > 0 ? "bg-red-50 dark:bg-red-950/20 border border-red-200/50" : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50"}`}>
                <p className="text-xs text-muted-foreground">Deuda total</p>
                <p className={`text-xl font-bold tabular-nums ${data.total_deuda > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {fmt(data.total_deuda)}
                </p>
              </div>
              <div className="rounded-xl p-3 text-center bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <ShoppingBag className="h-3 w-3" /> Ventas pend.
                </p>
                <p className="text-xl font-bold">{ventas.length}</p>
                {data.total_ventas_pendientes > 0 && (
                  <p className="text-xs text-amber-600 font-medium">{fmt(data.total_ventas_pendientes)}</p>
                )}
              </div>
              <div className="rounded-xl p-3 text-center bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <CreditCard className="h-3 w-3" /> Créditos activos
                </p>
                <p className="text-xl font-bold">{creditos.length}</p>
                {data.total_creditos_pendientes > 0 && (
                  <p className="text-xs text-red-600 font-medium">{fmt(data.total_creditos_pendientes)}</p>
                )}
              </div>
            </div>
            {creditos.length > 0 && (
              <div className="space-y-1.5">
                {creditos.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-xs rounded-lg bg-muted/30 px-3 py-1.5">
                    <span className="font-mono font-medium">{c.numero}</span>
                    <span className={`capitalize ${c.estado === "vencido" ? "text-red-600" : "text-muted-foreground"}`}>{c.estado}</span>
                    {c.cuotas_vencidas > 0 && <span className="text-red-600 font-semibold">{c.cuotas_vencidas} venc.</span>}
                    <span className="font-semibold">{fmt(c.saldo)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Sección: Notas internas ────────────────────────────────────────────────────
function NotasSection({ pacienteId }: { pacienteId: number | string }) {
  const qc = useQueryClient()
  const userId = useAuthStore(s => s.user?.id)
  const rol = useAuthStore(s => s.user?.role)
  const [texto, setTexto] = useState("")
  const [confirmNota, setConfirmNota] = useState<number | null>(null)

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}/notas`).then(r => r.data),
    staleTime: 30_000,
  })

  const crearMut = useMutation({
    mutationFn: (contenido: string) => api.post(`/pacientes/${pacienteId}/notas`, { contenido }),
    onSuccess: () => { toast.success("Nota guardada"); setTexto(""); qc.invalidateQueries({ queryKey: ["notas", pacienteId] }) },
    onError: e => toast.error(errMsg(e, "Error al guardar nota")),
  })

  const eliminarMut = useMutation({
    mutationFn: (nid: number) => api.delete(`/pacientes/${pacienteId}/notas/${nid}`),
    onSuccess: () => { toast.success("Nota eliminada"); qc.invalidateQueries({ queryKey: ["notas", pacienteId] }) },
    onError: e => toast.error(errMsg(e, "Error al eliminar nota")),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    crearMut.mutate(texto.trim())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-violet-500" /> Notas internas
          <span className="text-xs text-muted-foreground font-normal">(privadas, solo staff)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form nueva nota */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            className="flex-1 min-h-[56px] resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="Escribe una nota interna…"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(e as any) }}
          />
          <Button type="submit" size="sm" disabled={crearMut.isPending || !texto.trim()} className="self-end">
            {crearMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {/* Lista de notas */}
        {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}

        {!isLoading && notas.length === 0 && (
          <p className="text-xs text-muted-foreground">Sin notas aún.</p>
        )}

        <div className="space-y-2">
          {notas.map((n: any) => (
            <div key={n.id} className="rounded-xl border bg-muted/20 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">{n.usuario_nombre ?? "Sistema"}</p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{n.contenido}</p>
                </div>
                {(rol === "admin" || n.usuario_id === userId) && (
                  <button onClick={() => setConfirmNota(n.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-lg shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          ))}
        </div>
        <ConfirmDialog open={confirmNota !== null} title="Eliminar nota"
          description="¿Eliminar esta nota interna? No se puede recuperar."
          confirmLabel="Eliminar" loading={eliminarMut.isPending}
          onConfirm={() => { if (confirmNota) eliminarMut.mutate(confirmNota); setConfirmNota(null) }}
          onCancel={() => setConfirmNota(null)} />
      </CardContent>
    </Card>
  )
}

// ── Sección: Historial WhatsApp ────────────────────────────────────────────────
function WaLogsSection({ pacienteId }: { pacienteId: number | string }) {
  const [open, setOpen] = useState(false)
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["walogs", pacienteId],
    queryFn: () => api.get(`/whatsapp/logs`, { params: { paciente_id: pacienteId, limite: 30 } }).then(r => r.data),
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(v => !v)}>
        <CardTitle className="text-base flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-500" /> Historial WhatsApp enviados
          </div>
          <span className="text-xs text-muted-foreground font-normal">{open ? "▲ cerrar" : "▼ ver"}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!isLoading && logs.length === 0 && <p className="text-xs text-muted-foreground">Sin mensajes enviados.</p>}
          {logs.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 text-xs border-b border-border/30 pb-2 last:border-0">
              {log.estado === "enviado"
                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{log.template ?? "Mensaje de texto"}</p>
                {log.error_msg && <p className="text-destructive">{log.error_msg}</p>}
              </div>
              <p className="text-muted-foreground shrink-0 tabular-nums">
                {new Date(log.created_at).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

// ── Sección: Historial de actividad ───────────────────────────────────────────
type EventoHistorial = {
  id: string
  tipo: "consulta" | "venta" | "orden" | "credito" | "cobro"
  fecha: string
  titulo: string
  subtitulo?: string
  estado?: string
  to?: string
}

function colorPorTipo(tipo: EventoHistorial["tipo"]) {
  const map: Record<EventoHistorial["tipo"], string> = {
    consulta: "bg-blue-500",
    venta:    "bg-green-500",
    orden:    "bg-purple-500",
    credito:  "bg-amber-500",
    cobro:    "bg-emerald-500",
  }
  return map[tipo] ?? "bg-muted"
}

function HistorialSection({ consultas }: { consultas: any[] }) {
  const [open, setOpen] = useState(false)

  const historial: EventoHistorial[] = [
    ...consultas.map((c: any): EventoHistorial => ({
      id:       `consulta-${c.id}`,
      tipo:     "consulta",
      fecha:    c.fecha ?? "",
      titulo:   "Consulta " + (c.numero ?? `#${c.id}`),
      subtitulo: c.motivo_consulta ?? undefined,
      to:       `/consultas/${c.id}`,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(v => !v)}>
        <CardTitle className="text-base flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-500" /> Historial de actividad
          </div>
          <span className="text-xs text-muted-foreground font-normal">{open ? "▲ cerrar" : "▼ ver"}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0">
          {historial.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
          )}
          <div className="relative pl-6 border-l-2 border-muted space-y-4">
            {historial.map(ev => (
              <div key={ev.id} className="relative">
                <div className={`absolute -left-[25px] top-1 h-4 w-4 rounded-full border-2 border-background ${colorPorTipo(ev.tipo)}`} />
                <div className="bg-card border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    {ev.to ? (
                      <Link to={ev.to} className="font-semibold hover:underline">{ev.titulo}</Link>
                    ) : (
                      <span className="font-semibold">{ev.titulo}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{ev.fecha}</span>
                  </div>
                  {ev.subtitulo && <p className="text-xs text-muted-foreground">{ev.subtitulo}</p>}
                  {ev.estado && <Badge variant="outline" className="text-xs">{ev.estado}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function PacienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: paciente, isLoading: cargandoPac } = useQuery({
    queryKey: ["paciente", id],
    queryFn: () => api.get(`/pacientes/${id}`).then((r) => r.data),
  })

  const { data: consultas = [], isLoading: cargandoCons } = useQuery({
    queryKey: ["consultas", id],
    queryFn: () => api.get(`/pacientes/${id}/consultas`).then((r) => r.data),
    enabled: !!id,
  })

  if (cargandoPac) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
      </div>
    )
  }

  if (!paciente) {
    return <div className="p-6 text-destructive">Paciente no encontrado</div>
  }

  const nombreCompleto = `${paciente.apellidos}, ${paciente.nombres}`

  const proximoControl: string | null = consultas
    .filter((c: { proximo_control?: string | null }) => c.proximo_control)
    .sort((a: { fecha: string }, b: { fecha: string }) => b.fecha.localeCompare(a.fecha))[0]
    ?.proximo_control ?? null

  function handleControlVisual() {
    if (!proximoControl) {
      toast.error("El paciente no tiene próximo control registrado en ninguna consulta")
      return
    }
    enviarControlVisual(paciente.telefono, paciente.nombres, fmtFechaControl(proximoControl))
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{nombreCompleto}</h1>
          <Badge variant="outline" className="mt-0.5">{paciente.numero}</Badge>
        </div>
      </div>

      {/* ── Datos + foto side-by-side ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6">
          <FotoSection pacienteId={id!} foto={paciente.foto} />
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
            {campo("Cédula", paciente.cedula)}
            {campo("Fecha de nacimiento", paciente.fecha_nacimiento)}
            {campo("Género", paciente.genero)}
            {campo("Ocupación", paciente.ocupacion)}
            {campo("Teléfono", paciente.telefono)}
            {campo("Teléfono 2", paciente.telefono_2)}
            {campo("Email", paciente.email)}
            {campo("Dirección", paciente.direccion)}
            {campo("Origen / Cómo nos conoció", paciente.origen)}
            {campo("Referido por", paciente.referido_por)}
            {campo("Armazón preferido", paciente.armazon_tipo)}
            {campo("Notas de preferencias", paciente.armazon_notas)}
          </div>
        </CardContent>
      </Card>

      {/* ── Estado de cuenta ── */}
      <EstadoCuenta pacienteId={id!} />

      {paciente.telefono && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={handleControlVisual}
              title={proximoControl ? `Próximo control: ${fmtFechaControl(proximoControl)}` : "Sin próximo control registrado"}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              {proximoControl
                ? `Control visual · ${fmtFechaControl(proximoControl)}`
                : "Control visual (sin fecha)"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => enviarCumpleanios(paciente.telefono, paciente.nombres)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Oferta de cumpleaños 🎂
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Notas internas ── */}
      <NotasSection pacienteId={id!} />

      {/* ── Historial WhatsApp ── */}
      <WaLogsSection pacienteId={id!} />

      {/* ── Historial de actividad ── */}
      <HistorialSection consultas={consultas} />

      {/* ── Historial consultas ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Consultas
          </h2>
          {(rol === "admin" || rol === "optometrista") && (
            <Button size="sm" asChild>
              <Link to={`/pacientes/${id}/consultas/nueva`}>
                <Plus className="h-4 w-4 mr-1" /> Nueva Consulta
              </Link>
            </Button>
          )}
        </div>

        {cargandoCons && (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando consultas…
          </div>
        )}

        {!cargandoCons && consultas.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">Este paciente no tiene consultas aún.</p>
        )}

        <div className="space-y-2">
          {consultas.map((c: any) => (
            <Link key={c.id} to={`/consultas/${c.id}`} className="block">
              <div className="rounded-md border p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{c.fecha} — <Badge variant="outline">{c.numero}</Badge></p>
                      {c.motivo_consulta && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.motivo_consulta}</p>
                      )}
                    </div>
                  </div>
                  {c.diagnostico && (
                    <p className="text-xs text-muted-foreground hidden md:block max-w-xs line-clamp-1">{c.diagnostico}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
