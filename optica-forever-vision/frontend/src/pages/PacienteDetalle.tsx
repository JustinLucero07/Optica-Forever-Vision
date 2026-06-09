import { useRef, useState, useMemo } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Plus, Calendar, Stethoscope, Loader2, MessageCircle,
  Camera, Trash2, StickyNote, Send, DollarSign, CreditCard, ShoppingBag,
  History, CheckCircle, XCircle, TrendingUp, Eye, Gift,
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
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

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
            {/* Deuda total — fila completa, prominente */}
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${data.total_deuda > 0 ? "bg-red-50 dark:bg-red-950/20 border border-red-200/50" : "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50"}`}>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Deuda total</p>
                <p className={`text-2xl font-bold tabular-nums leading-none ${data.total_deuda > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {fmt(data.total_deuda)}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 opacity-20 ${data.total_deuda > 0 ? "text-red-500" : "text-emerald-500"}`} />
            </div>
            {/* Ventas pendientes + Créditos activos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl px-4 py-3 bg-muted/40 border border-border/50">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <ShoppingBag className="h-3 w-3" /> Ventas pend.
                </p>
                <p className="text-2xl font-bold leading-none">{ventas.length}</p>
                {data.total_ventas_pendientes > 0 && (
                  <p className="text-xs text-amber-600 font-semibold mt-1">{fmt(data.total_ventas_pendientes)}</p>
                )}
              </div>
              <div className="rounded-xl px-4 py-3 bg-muted/40 border border-border/50">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <CreditCard className="h-3 w-3" /> Créditos activos
                </p>
                <p className="text-2xl font-bold leading-none">{creditos.length}</p>
                {data.total_creditos_pendientes > 0 && (
                  <p className="text-xs text-red-600 font-semibold mt-1">{fmt(data.total_creditos_pendientes)}</p>
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

// ── Sección: Garantías ─────────────────────────────────────────────────────────
function GarantiasSection({ pacienteId }: { pacienteId: number | string }) {
  const [open, setOpen] = useState(false)
  const { data: garantias = [], isLoading } = useQuery({
    queryKey: ["garantias", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}/garantias`).then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  })

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(v => !v)}>
        <CardTitle className="text-base flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" /> Garantías de productos
          </div>
          <span className="text-xs text-muted-foreground font-normal">{open ? "▲ cerrar" : "▼ ver"}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-2">
          {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!isLoading && garantias.length === 0 && <p className="text-xs text-muted-foreground">Sin garantías registradas.</p>}
          {garantias.map((g: any) => {
            const vence = g.garantia_vence
            const vencida = vence < hoy
            const diasRestantes = Math.round((new Date(vence).getTime() - Date.now()) / 86_400_000)
            return (
              <div key={g.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${vencida ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{g.descripcion}</p>
                  <p className="text-xs text-muted-foreground">Venta {g.venta_numero} · {g.garantia_meses} mes{g.garantia_meses !== 1 ? "es" : ""}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={`text-xs font-semibold ${vencida ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {vencida ? "Vencida" : `${diasRestantes}d restantes`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">hasta {vence}</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      )}
    </Card>
  )
}

// ── Sección: Trial Lentes de Contacto ──────────────────────────────────────────
const TRIAL_ESTADOS = ["entregado", "devuelto", "comprado"] as const
const TRIAL_ESTADO_CLASS: Record<string, string> = {
  entregado: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  devuelto:  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  comprado:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
}

function TrialLCSection({ pacienteId }: { pacienteId: number | string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  const emptyForm = { marca_od: "", bc_od: "", diam_od: "", esf_od: "", cil_od: "", eje_od: "", marca_oi: "", bc_oi: "", diam_oi: "", esf_oi: "", cil_oi: "", eje_oi: "", notas: "" }
  const [form, setForm] = useState(emptyForm)
  const setF = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const { data: trials = [], isLoading } = useQuery({
    queryKey: ["trial-lc", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}/trial-lc`).then(r => r.data),
    enabled: open,
    staleTime: 30_000,
  })

  const crearMut = useMutation({
    mutationFn: () => api.post(`/pacientes/${pacienteId}/trial-lc`, {
      marca_od: form.marca_od || null, bc_od: form.bc_od ? Number(form.bc_od) : null,
      diam_od: form.diam_od ? Number(form.diam_od) : null, esf_od: form.esf_od ? Number(form.esf_od) : null,
      cil_od: form.cil_od ? Number(form.cil_od) : null, eje_od: form.eje_od ? Number(form.eje_od) : null,
      marca_oi: form.marca_oi || null, bc_oi: form.bc_oi ? Number(form.bc_oi) : null,
      diam_oi: form.diam_oi ? Number(form.diam_oi) : null, esf_oi: form.esf_oi ? Number(form.esf_oi) : null,
      cil_oi: form.cil_oi ? Number(form.cil_oi) : null, eje_oi: form.eje_oi ? Number(form.eje_oi) : null,
      notas: form.notas || null,
    }),
    onSuccess: () => { toast.success("Trial registrado"); setDialogOpen(false); setForm(emptyForm); qc.invalidateQueries({ queryKey: ["trial-lc", pacienteId] }) },
    onError: e => toast.error(errMsg(e, "Error al guardar")),
  })

  const estadoMut = useMutation({
    mutationFn: ({ tid, estado }: { tid: number; estado: string }) => api.patch(`/trial-lc/${tid}`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trial-lc", pacienteId] }),
    onError: e => toast.error(errMsg(e, "Error")),
  })

  const eliminarMut = useMutation({
    mutationFn: (tid: number) => api.delete(`/trial-lc/${tid}`),
    onSuccess: () => { toast.success("Trial eliminado"); setConfirmDel(null); qc.invalidateQueries({ queryKey: ["trial-lc", pacienteId] }) },
    onError: e => toast.error(errMsg(e, "Error")),
  })

  const LC_FIELDS = [
    { label: "Marca", key: "marca", type: "text" },
    { label: "BC", key: "bc", type: "number" },
    { label: "Diám.", key: "diam", type: "number" },
    { label: "Esf.", key: "esf", type: "number" },
    { label: "Cil.", key: "cil", type: "number" },
    { label: "Eje", key: "eje", type: "number" },
  ]

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(v => !v)}>
        <CardTitle className="text-base flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-cyan-500" /> Prueba de lentes de contacto
          </div>
          <span className="text-xs text-muted-foreground font-normal">{open ? "▲ cerrar" : "▼ ver"}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm); setDialogOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuevo trial
            </Button>
          </div>
          {isLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!isLoading && trials.length === 0 && <p className="text-xs text-muted-foreground">Sin pruebas registradas.</p>}
          <div className="space-y-2">
            {trials.map((t: any) => (
              <div key={t.id} className="border rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{t.fecha?.slice(0, 10)}</p>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={t.estado}
                      onChange={e => estadoMut.mutate({ tid: t.id, estado: e.target.value })}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${TRIAL_ESTADO_CLASS[t.estado] ?? ""}`}
                    >
                      {TRIAL_ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button onClick={() => setConfirmDel(t.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-muted-foreground">OD</p>
                    <p>{[t.marca_od, t.bc_od && `BC ${t.bc_od}`, t.diam_od && `Ø${t.diam_od}`, t.esf_od && `Esf ${t.esf_od}`, t.cil_od && `Cil ${t.cil_od}`, t.eje_od && `Eje ${t.eje_od}°`].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-muted-foreground">OI</p>
                    <p>{[t.marca_oi, t.bc_oi && `BC ${t.bc_oi}`, t.diam_oi && `Ø${t.diam_oi}`, t.esf_oi && `Esf ${t.esf_oi}`, t.cil_oi && `Cil ${t.cil_oi}`, t.eje_oi && `Eje ${t.eje_oi}°`].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                </div>
                {t.notas && <p className="text-xs text-muted-foreground italic">{t.notas}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} className="max-w-lg">
        <DialogHeader onClose={() => setDialogOpen(false)}>Nuevo trial de lentes de contacto</DialogHeader>
        <DialogBody className="space-y-4">
          {(["od", "oi"] as const).map(eye => (
            <div key={eye} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{eye.toUpperCase()}</p>
              <div className="grid grid-cols-3 gap-2">
                {LC_FIELDS.map(f => (
                  <div key={f.key} className="space-y-0.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type={f.type}
                      step="0.01"
                      className="h-8 text-sm"
                      value={(form as any)[`${f.key}_${eye}`]}
                      onChange={e => setF(`${f.key}_${eye}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1">
            <Label>Notas</Label>
            <Input value={form.notas} onChange={e => setF("notas", e.target.value)} placeholder="Observaciones…" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={() => crearMut.mutate()} disabled={crearMut.isPending}>
            {crearMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </Dialog>

      <ConfirmDialog open={confirmDel !== null} title="Eliminar trial"
        description="¿Eliminar este registro de prueba?"
        confirmLabel="Eliminar" loading={eliminarMut.isPending}
        onConfirm={() => { if (confirmDel) eliminarMut.mutate(confirmDel) }}
        onCancel={() => setConfirmDel(null)} />
    </Card>
  )
}

// ── Evolución de Graduación ────────────────────────────────────────────────────
function EvolucionGraduacion({ consultas }: { consultas: any[] }) {
  const datos = useMemo(() => {
    return [...consultas]
      .filter((c: any) => c.rx_od_esf != null || c.rx_oi_esf != null)
      .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
      .map((c: any) => ({
        fecha: c.fecha.slice(0, 7),
        "OD ESF": c.rx_od_esf != null ? Number(c.rx_od_esf) : null,
        "OD CIL": c.rx_od_cil != null ? Number(c.rx_od_cil) : null,
        "OI ESF": c.rx_oi_esf != null ? Number(c.rx_oi_esf) : null,
        "OI CIL": c.rx_oi_cil != null ? Number(c.rx_oi_cil) : null,
      }))
  }, [consultas])

  if (datos.length < 2) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-500" /> Evolución de graduación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v > 0 ? "+" : ""}${v}`} />
            <Tooltip formatter={(v) => { const n = Number(v); return `${n > 0 ? "+" : ""}${n}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="OD ESF" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="OD CIL" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" connectNulls />
            <Line type="monotone" dataKey="OI ESF" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="OI CIL" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Líneas sólidas = Esfera · Líneas punteadas = Cilindro · Azul/violeta = OD · Verde = OI
        </p>
      </CardContent>
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

  const { data: ordenesActivas = [] } = useQuery<{ id: number; numero: string; estado: string; tipo: string }[]>({
    queryKey: ["ordenes-paciente", id],
    queryFn: () => api.get("/ordenes", { params: { paciente_id: id, limit: 20 } }).then(r => r.data),
    enabled: !!id,
    staleTime: 60_000,
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

  const ultimaConsulta = consultas.length > 0
    ? consultas.reduce((a: any, b: any) => a.fecha > b.fecha ? a : b)
    : null
  const diasSinConsulta = ultimaConsulta
    ? Math.floor((Date.now() - new Date(ultimaConsulta.fecha).getTime()) / 86_400_000)
    : null
  const ordenesEnProceso = ordenesActivas.filter(o => !["entregado", "rechazado"].includes(o.estado))

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{nombreCompleto}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <Badge variant="outline">{paciente.numero}</Badge>
            {ordenesEnProceso.length > 0 && (
              <Link to="/ordenes">
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer">
                  {ordenesEnProceso.length} orden{ordenesEnProceso.length > 1 ? "es" : ""} en proceso
                </Badge>
              </Link>
            )}
            {diasSinConsulta !== null && diasSinConsulta > 365 && (
              <Badge className="bg-red-100 text-red-700 border border-red-300">
                Sin consulta hace {Math.floor(diasSinConsulta / 30)} meses
              </Badge>
            )}
            {diasSinConsulta !== null && diasSinConsulta <= 365 && diasSinConsulta > 0 && (
              <span className="text-xs text-muted-foreground">
                Última consulta hace {diasSinConsulta} día{diasSinConsulta !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {(rol === "admin" || rol === "optometrista") && (
          <Button size="sm" asChild className="shrink-0">
            <Link to={`/pacientes/${id}/consultas/nueva`}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Consulta
            </Link>
          </Button>
        )}
      </div>

      {/* ── Layout dos columnas ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">

        {/* ── COLUMNA IZQUIERDA ── */}
        <div className="space-y-5 min-w-0">

          {/* Datos personales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos personales</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-5">
              <FotoSection pacienteId={id!} foto={paciente.foto} />
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
                {campo("Cédula", paciente.cedula)}
                {campo("Nacimiento", paciente.fecha_nacimiento)}
                {campo("Género", paciente.genero)}
                {campo("Ocupación", paciente.ocupacion)}
                {campo("Teléfono", paciente.telefono)}
                {campo("Teléfono 2", paciente.telefono_2)}
                {campo("Email", paciente.email)}
                {campo("Dirección", paciente.direccion)}
                {campo("Cómo nos conoció", paciente.origen)}
                {campo("Referido por", paciente.referido_por)}
                {paciente.referido_a_nombre && campo("Referido al optometrista", paciente.referido_a_nombre)}
                {campo("Armazón preferido", paciente.armazon_tipo)}
                {campo("Notas preferencias", paciente.armazon_notas)}
              </div>
            </CardContent>
          </Card>

          {/* Historial de actividad */}
          <HistorialSection consultas={consultas} />

          {/* Evolución de graduación */}
          <EvolucionGraduacion consultas={consultas} />

          {/* Historial de consultas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-5 w-5" /> Consultas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cargandoCons && (
                <div className="px-4 py-6 flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                </div>
              )}
              {!cargandoCons && consultas.length === 0 && (
                <p className="px-4 py-6 text-muted-foreground text-sm">Sin consultas registradas.</p>
              )}
              <div className="divide-y">
                {consultas.map((c: any) => (
                  <Link key={c.id} to={`/consultas/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{c.fecha} <Badge variant="outline" className="ml-1 text-xs">{c.numero}</Badge></p>
                        {c.motivo_consulta && (
                          <p className="text-xs text-muted-foreground truncate">{c.motivo_consulta}</p>
                        )}
                      </div>
                    </div>
                    {c.diagnostico && (
                      <p className="text-xs text-muted-foreground hidden lg:block max-w-[200px] truncate ml-3">{c.diagnostico}</p>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── COLUMNA DERECHA (sidebar) ── */}
        <div className="space-y-5">

          {/* Estado de cuenta */}
          <EstadoCuenta pacienteId={id!} />

          {/* WhatsApp */}
          {paciente.telefono && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  variant="outline" size="sm"
                  className="justify-start border-green-300 text-green-700 hover:bg-green-50"
                  onClick={handleControlVisual}
                  title={proximoControl ? `Próximo control: ${fmtFechaControl(proximoControl)}` : "Sin próximo control"}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-2" />
                  {proximoControl ? `Control · ${fmtFechaControl(proximoControl)}` : "Control visual (sin fecha)"}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="justify-start border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => enviarCumpleanios(paciente.telefono, paciente.nombres)}
                >
                  <Gift className="h-3.5 w-3.5 mr-2" />
                  Oferta de cumpleaños
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notas internas */}
          <NotasSection pacienteId={id!} />

          {/* Garantías */}
          <GarantiasSection pacienteId={id!} />

          {/* Trial LC */}
          <TrialLCSection pacienteId={id!} />

          {/* Historial WhatsApp */}
          <WaLogsSection pacienteId={id!} />

        </div>
      </div>
    </div>
  )
}
