import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  Banknote, Loader2, Pencil, Plus, Trash2, UserCog, AlertTriangle,
} from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Usuario { id: number; full_name: string; email: string; role: string; activo: boolean }
interface SueldoConfig { id: number; usuario_id: number; monto_mensual: number; dia_pago: number; activo: boolean; notas: string | null }
interface PagoSueldo { id: number; numero: string; usuario_id: number; periodo: string; tipo: string; monto: number; cuenta_bancaria_id: number; egreso_id: number | null; notas: string | null; created_at: string }
interface Cuenta { id: number; nombre: string; tipo: string; saldo_actual: number }

type ConfigForm = { usuario_id: string; monto_mensual: string; dia_pago: string; notas: string }
type PagoForm = { usuario_id: string; periodo: string; tipo: string; monto: string; cuenta_bancaria_id: string; notas: string }

const fmt = (n: number) => `$${Number(n).toFixed(2)}`
const periodoActual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function Sueldos() {
  const qc = useQueryClient()
  const [dialogConfig, setDialogConfig] = useState(false)
  const [editandoCfg, setEditandoCfg] = useState<SueldoConfig | null>(null)
  const [dialogPago, setDialogPago] = useState(false)
  const [filtroUsuario, setFiltroUsuario] = useState<number | null>(null)

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ["usuarios"],
    queryFn: () => api.get("/usuarios").then(r => r.data),
  })
  const { data: configs = [] } = useQuery<SueldoConfig[]>({
    queryKey: ["sueldo-config"],
    queryFn: () => api.get("/sueldos/config").then(r => r.data),
  })
  const { data: pagos = [], isLoading: cargandoPagos } = useQuery<PagoSueldo[]>({
    queryKey: ["pagos-sueldo", filtroUsuario],
    queryFn: () => api.get("/sueldos/pagos", { params: { usuario_id: filtroUsuario || undefined, limit: 200 } }).then(r => r.data),
  })
  const { data: cuentas = [] } = useQuery<Cuenta[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
  })

  const { register: rCfg, handleSubmit: hsCfg, reset: resetCfg } = useForm<ConfigForm>()
  const { register: rPago, handleSubmit: hsPago, reset: resetPago, setValue: svPago, watch: watchPago } = useForm<PagoForm>()

  const crearConfigMut = useMutation({
    mutationFn: (d: ConfigForm) => api.post("/sueldos/config", {
      usuario_id: Number(d.usuario_id), monto_mensual: Number(d.monto_mensual),
      dia_pago: Number(d.dia_pago) || 30, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sueldo-config"] }); cerrarConfig(); toast.success("Configuración guardada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const editarConfigMut = useMutation({
    mutationFn: (d: ConfigForm) => api.put(`/sueldos/config/${editandoCfg!.id}`, {
      usuario_id: Number(d.usuario_id), monto_mensual: Number(d.monto_mensual),
      dia_pago: Number(d.dia_pago) || 30, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sueldo-config"] }); cerrarConfig(); toast.success("Configuración actualizada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const eliminarConfigMut = useMutation({
    mutationFn: (id: number) => api.delete(`/sueldos/config/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sueldo-config"] }); toast.success("Eliminado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const pagarMut = useMutation({
    mutationFn: (d: PagoForm) => api.post("/sueldos/pagar", {
      usuario_id: Number(d.usuario_id), periodo: d.periodo, tipo: d.tipo,
      monto: Number(d.monto), cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      notas: d.notas || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagos-sueldo"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      qc.invalidateQueries({ queryKey: ["egresos"] })
      cerrarPago()
      toast.success("Pago registrado y egreso generado")
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  function abrirConfig(cfg?: SueldoConfig) {
    setEditandoCfg(cfg ?? null)
    if (cfg) {
      resetCfg({ usuario_id: String(cfg.usuario_id), monto_mensual: String(cfg.monto_mensual), dia_pago: String(cfg.dia_pago), notas: cfg.notas ?? "" })
    } else {
      resetCfg({ usuario_id: "", monto_mensual: "", dia_pago: "30", notas: "" })
    }
    setDialogConfig(true)
  }
  function cerrarConfig() { setDialogConfig(false); setEditandoCfg(null) }

  function abrirPago(cfg?: SueldoConfig) {
    resetPago({ usuario_id: cfg ? String(cfg.usuario_id) : "", periodo: periodoActual(), tipo: "sueldo", monto: cfg ? String(cfg.monto_mensual) : "", cuenta_bancaria_id: "", notas: "" })
    setDialogPago(true)
  }
  function cerrarPago() { setDialogPago(false) }

  // Calcular lo pagado en el periodo actual por usuario
  const periodoHoy = periodoActual()
  function pagadoEnPeriodo(usuarioId: number) {
    return pagos.filter(p => p.usuario_id === usuarioId && p.periodo === periodoHoy).reduce((s, p) => s + p.monto, 0)
  }

  const usuariosActivos = usuarios.filter(u => u.activo !== false)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sueldos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de sueldos, adelantos y pagos del personal</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => abrirPago()}>
            <Banknote className="h-4 w-4 mr-2" /> Registrar pago
          </Button>
          <Button onClick={() => abrirConfig()}>
            <Plus className="h-4 w-4 mr-2" /> Configurar sueldo
          </Button>
        </div>
      </div>

      {/* ── Tarjetas por empleado ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map(cfg => {
          const usuario = usuariosActivos.find(u => u.id === cfg.usuario_id)
          const pagadoHoy = pagadoEnPeriodo(cfg.usuario_id)
          const pendiente = Math.max(0, cfg.monto_mensual - pagadoHoy)
          const pagosPorcentaje = Math.min(100, (pagadoHoy / cfg.monto_mensual) * 100)

          return (
            <Card key={cfg.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{usuario?.full_name ?? `Usuario #${cfg.usuario_id}`}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">{usuario?.role}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={() => abrirConfig(cfg)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      onClick={() => confirm("¿Eliminar configuración?") && eliminarConfigMut.mutate(cfg.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sueldo mensual</span>
                  <span className="font-semibold">{fmt(cfg.monto_mensual)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pagado ({periodoHoy})</span>
                  <span className="font-semibold text-green-700">{fmt(pagadoHoy)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pagosPorcentaje}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pendiente</span>
                  <span className={`font-bold ${pendiente > 0 ? "text-amber-600" : "text-green-600"}`}>{fmt(pendiente)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" onClick={() => abrirPago(cfg)}>
                    <Banknote className="h-3.5 w-3.5 mr-1" /> Pagar sueldo
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1"
                    onClick={() => { abrirPago(cfg); svPago("tipo", "adelanto") }}>
                    Adelanto
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {configs.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <UserCog className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No hay sueldos configurados aún.</p>
            <Button className="mt-3" onClick={() => abrirConfig()}><Plus className="h-4 w-4 mr-1" /> Configurar primer sueldo</Button>
          </div>
        )}
      </div>

      {/* ── Historial de pagos ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historial de pagos</CardTitle>
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={filtroUsuario ?? ""}
              onChange={e => setFiltroUsuario(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Todos los empleados</option>
              {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {cargandoPagos && <div className="px-4 py-6 text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}
          {!cargandoPagos && pagos.length === 0 && <p className="px-4 py-6 text-muted-foreground text-sm">Sin pagos registrados.</p>}
          <div className="divide-y">
            {pagos.map(p => {
              const u = usuariosActivos.find(x => x.id === p.usuario_id)
              const cuenta = cuentas.find(c => c.id === p.cuenta_bancaria_id)
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{u?.full_name ?? `Usuario #${p.usuario_id}`}</p>
                    <p className="text-xs text-muted-foreground">{p.periodo} · {cuenta?.nombre ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={p.tipo === "sueldo" ? "default" : "outline"} className="capitalize text-xs">{p.tipo}</Badge>
                    <span className="font-semibold text-sm">{fmt(p.monto)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.numero}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Dialog: Configurar sueldo ── */}
      <Dialog open={dialogConfig} onClose={cerrarConfig} className="max-w-md">
        <DialogHeader onClose={cerrarConfig}>{editandoCfg ? "Editar sueldo" : "Configurar sueldo"}</DialogHeader>
        <form onSubmit={hsCfg(d => editandoCfg ? editarConfigMut.mutate(d) : crearConfigMut.mutate(d))}>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label>Empleado *</Label>
              <select {...rCfg("usuario_id", { required: true })} disabled={!!editandoCfg}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar —</option>
                {usuariosActivos.filter(u => editandoCfg || !configs.find(c => c.usuario_id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Sueldo mensual ($) *</Label>
              <Input type="number" step="0.01" min="0" {...rCfg("monto_mensual", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Día de pago</Label>
              <Input type="number" min="1" max="31" {...rCfg("dia_pago")} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input placeholder="Incluye beneficios, descuentos fijos…" {...rCfg("notas")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarConfig}>Cancelar</Button>
            <Button type="submit" disabled={crearConfigMut.isPending || editarConfigMut.isPending}>
              {(crearConfigMut.isPending || editarConfigMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ── Dialog: Registrar pago ── */}
      <Dialog open={dialogPago} onClose={cerrarPago} className="max-w-md">
        <DialogHeader onClose={cerrarPago}>Registrar pago de sueldo</DialogHeader>
        <form onSubmit={hsPago(d => pagarMut.mutate(d))}>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label>Empleado *</Label>
              <select {...rPago("usuario_id", { required: true })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar —</option>
                {usuariosActivos.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Período (AAAA-MM) *</Label>
                <Input placeholder="2026-06" {...rPago("periodo", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <select {...rPago("tipo", { required: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="sueldo">Sueldo</option>
                  <option value="adelanto">Adelanto</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Monto ($) *</Label>
              <Input type="number" step="0.01" min="0" {...rPago("monto", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Cuenta de pago *</Label>
              <select {...rPago("cuenta_bancaria_id", { required: true })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar cuenta —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({fmt(c.saldo_actual)})</option>)}
              </select>
            </div>
            {(() => {
              const cid = watchPago("cuenta_bancaria_id")
              const m = parseFloat(watchPago("monto") || "0")
              const c = cuentas.find(x => x.id === Number(cid))
              if (!c || !m || m <= 0 || c.saldo_actual >= m) return null
              return (
                <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Saldo insuficiente — <strong>{c.nombre}</strong> tiene <strong>${Number(c.saldo_actual).toFixed(2)}</strong> disponible</span>
                </div>
              )
            })()}
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input placeholder="Observaciones del pago…" {...rPago("notas")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarPago}>Cancelar</Button>
            <Button type="submit" disabled={pagarMut.isPending}>
              {pagarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar pago
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
