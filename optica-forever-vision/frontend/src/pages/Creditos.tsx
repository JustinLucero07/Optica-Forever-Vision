import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Loader2, CreditCard, ChevronDown, ChevronUp, Printer } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"

const METODOS = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "cheque", "deposito"]
const PERIODICIDADES = ["mensual", "quincenal", "semanal"]

interface Cuota {
  id: number; numero_cuota: number; fecha_vencimiento: string
  monto: number; monto_pagado: number; fecha_pago: string | null; estado: string
}
interface Credito {
  id: number; numero: string; paciente_id: number | null; paciente_nombre: string | null
  venta_id: number | null; monto_total: number; monto_pagado: number
  numero_cuotas: number; periodicidad: string; fecha_inicio: string; estado: string
  notas: string | null; cuotas?: Cuota[]; created_at: string
}
interface Cuenta { id: number; nombre: string; activa: boolean }
interface VentaPendiente { id: number; numero: string; total: number; paciente_nombre: string | null }

type CreditoForm = { paciente_id: string; venta_id: string; monto_total: string; numero_cuotas: string; periodicidad: string; fecha_inicio: string; notas: string }
type PagoForm = { monto: string; fecha_pago: string; cuenta_bancaria_id: string; metodo_pago: string; referencia: string }

function fmt(n: number) { return `$${Number(n).toFixed(2)}` }
function fmtDate(s: string) { const [y, m, d] = s.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

function estadoColor(e: string) {
  return e === "pagado" ? "default" : e === "vencido" ? "destructive" : e === "vigente" ? "secondary" : "outline"
}

function printComprobante(credito: Credito, cuota: Cuota) {
  const saldo = Number(credito.monto_total) - Number(credito.monto_pagado)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Comprobante Abono</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:20px}
  .hdr{background:#0891b2;color:white;padding:12px 16px;border-radius:6px 6px 0 0}
  .hdr h1{margin:0;font-size:16px;font-weight:bold}
  .hdr p{margin:2px 0;font-size:11px;opacity:.9}
  .body{border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 6px 6px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
  td:first-child{color:#6b7280;width:160px}
  .total-row td{font-weight:bold;background:#f9fafb}
  .footer{margin-top:24px;text-align:center;font-size:10px;color:#9ca3af}
  @media print{body{padding:0}}
</style></head><body>
<div class="hdr">
  <h1>ÓPTICA FOREVER VISION</h1>
  <p>Comprobante de Abono</p>
</div>
<div class="body">
  <table>
    <tr><td>Crédito N°</td><td><strong>${credito.numero}</strong></td></tr>
    <tr><td>Paciente</td><td>${credito.paciente_nombre ?? "—"}</td></tr>
    <tr><td>Cuota</td><td>${cuota.numero_cuota} de ${credito.numero_cuotas}</td></tr>
    <tr><td>Fecha de pago</td><td>${cuota.fecha_pago ? fmtDate(cuota.fecha_pago) : fmtDate(new Date().toISOString())}</td></tr>
    <tr><td>Vencimiento cuota</td><td>${fmtDate(cuota.fecha_vencimiento)}</td></tr>
    <tr><td>Monto abonado</td><td><strong>${fmt(Number(cuota.monto_pagado))}</strong></td></tr>
  </table>
  <table>
    <tr><td>Total crédito</td><td>${fmt(Number(credito.monto_total))}</td></tr>
    <tr><td>Total pagado</td><td style="color:#16a34a">${fmt(Number(credito.monto_pagado))}</td></tr>
    <tr class="total-row"><td>Saldo pendiente</td><td style="color:${saldo > 0 ? '#dc2626' : '#16a34a'}">${fmt(saldo)}</td></tr>
  </table>
  <div class="footer">Av. 24 de mayo y Puyo, Cuenca · Generado ${new Date().toLocaleString("es-EC")}</div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`
  const w = window.open("", "_blank", "width=480,height=600")
  if (w) { w.document.write(html); w.document.close() }
}

export default function Creditos() {
  const [filtroEstado, setFiltroEstado] = useState("")
  const [dialogNuevo, setDialogNuevo] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [pagandoCuota, setPagandoCuota] = useState<{ credito: Credito; cuota: Cuota } | null>(null)
  const [busqVenta, setBusqVenta] = useState("")
  const [ventaSel, setVentaSel] = useState<VentaPendiente | null>(null)
  const [showVentaList, setShowVentaList] = useState(false)
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: creditos = [], isLoading } = useQuery<Credito[]>({
    queryKey: ["creditos", filtroEstado],
    queryFn: () => api.get("/creditos", { params: { estado: filtroEstado || undefined } }).then(r => r.data),
  })

  const { data: creditoDetalle } = useQuery<Credito>({
    queryKey: ["credito", expandido],
    queryFn: () => api.get(`/creditos/${expandido}`).then(r => r.data),
    enabled: !!expandido,
  })

  const { data: cuentas = [] } = useQuery<Cuenta[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
  })

  const { data: ventasPendientes = [] } = useQuery<VentaPendiente[]>({
    queryKey: ["ventas-pendientes"],
    queryFn: () => api.get("/ventas", { params: { estado: "pendiente", limit: 200 } }).then(r => r.data),
    enabled: dialogNuevo,
  })

  const { register: rN, handleSubmit: hsN, reset: resetN, setValue: svN } = useForm<CreditoForm>()
  const { register: rP, handleSubmit: hsP, reset: resetP } = useForm<PagoForm>()

  const crearMut = useMutation({
    mutationFn: (d: CreditoForm) => api.post("/creditos", {
      paciente_id: ventaSel?.id ? undefined : (d.paciente_id ? Number(d.paciente_id) : null),
      venta_id: ventaSel ? ventaSel.id : (d.venta_id ? Number(d.venta_id) : null),
      monto_total: Number(d.monto_total),
      numero_cuotas: Number(d.numero_cuotas),
      periodicidad: d.periodicidad,
      fecha_inicio: d.fecha_inicio,
      notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["creditos"] }); setDialogNuevo(false); toast.success("Crédito creado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const pagarMut = useMutation({
    mutationFn: (d: PagoForm) => api.post(
      `/creditos/${pagandoCuota!.credito.id}/cuotas/${pagandoCuota!.cuota.id}/pagar`,
      { monto: Number(d.monto), fecha_pago: d.fecha_pago, cuenta_bancaria_id: Number(d.cuenta_bancaria_id), metodo_pago: d.metodo_pago, referencia: d.referencia || null }
    ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["creditos"] })
      qc.invalidateQueries({ queryKey: ["credito", expandido] })
      qc.invalidateQueries({ queryKey: ["cobros"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      const cuotaPagada = pagandoCuota!.cuota
      const creditoActualizado = data.data as Credito
      setPagandoCuota(null)
      toast.success("Pago registrado")
      // print receipt
      const cuotaActualizada = creditoActualizado.cuotas?.find(q => q.id === cuotaPagada.id)
      if (cuotaActualizada) printComprobante(creditoActualizado, cuotaActualizada)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  function abrirNuevo() {
    resetN({ fecha_inicio: hoy, periodicidad: "mensual", numero_cuotas: "3" })
    setVentaSel(null); setBusqVenta(""); setDialogNuevo(true)
  }

  function abrirPago(credito: Credito, cuota: Cuota) {
    const saldo = Number(cuota.monto) - Number(cuota.monto_pagado)
    resetP({ fecha_pago: hoy, metodo_pago: "efectivo", monto: saldo.toFixed(2), cuenta_bancaria_id: cuentas[0]?.id.toString() ?? "" })
    setPagandoCuota({ credito, cuota })
  }

  const ventasFiltradas = ventasPendientes.filter(v => {
    const q = busqVenta.toLowerCase()
    return !q || v.numero.toLowerCase().includes(q) || (v.paciente_nombre ?? "").toLowerCase().includes(q)
  })

  const cuotasDetalle = creditoDetalle?.cuotas ?? []

  const estadosSummary = creditos.reduce((acc: Record<string, number>, c) => {
    acc[c.estado] = (acc[c.estado] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Créditos / Plazos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de pagos a cuotas — recordatorios automáticos por WhatsApp
          </p>
        </div>
        {(rol === "admin" || rol === "cajero" || rol === "vendedor") && (
          <Button onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo crédito</Button>
        )}
      </div>

      {/* Resumen */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(estadosSummary).map(([estado, n]) => (
          <Card key={estado} className="px-4 py-2 cursor-pointer" onClick={() => setFiltroEstado(filtroEstado === estado ? "" : estado)}>
            <p className="text-xs text-muted-foreground capitalize">{estado}</p>
            <p className="text-xl font-bold">{n}</p>
          </Card>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {["", "vigente", "vencido", "pagado"].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${filtroEstado === e ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}>
            {e === "" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">N°</th>
                <th className="text-left px-4 py-3 font-medium">Paciente</th>
                <th className="text-left px-4 py-3 font-medium">Inicio</th>
                <th className="text-left px-4 py-3 font-medium">Cuotas</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-right px-4 py-3 font-medium">Pagado</th>
                <th className="text-right px-4 py-3 font-medium">Saldo</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {creditos.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No hay créditos registrados</td></tr>
              )}
              {creditos.map(c => (
                <>
                  <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><Badge variant="outline" className="font-mono text-xs">{c.numero}</Badge></td>
                    <td className="px-4 py-3 font-medium">
                      {c.paciente_id ? (
                        <Link to={`/pacientes/${c.paciente_id}`} className="hover:underline">{c.paciente_nombre ?? `Pac. #${c.paciente_id}`}</Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.fecha_inicio)}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{c.numero_cuotas} · {c.periodicidad}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(Number(c.monto_total))}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(Number(c.monto_pagado))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmt(Number(c.monto_total) - Number(c.monto_pagado))}</td>
                    <td className="px-4 py-3"><Badge variant={estadoColor(c.estado) as any}>{c.estado}</Badge></td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                        {expandido === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </td>
                  </tr>
                  {expandido === c.id && (
                    <tr key={`detail-${c.id}`} className="bg-muted/20">
                      <td colSpan={9} className="px-6 py-4">
                        {!creditoDetalle ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">CUOTAS</p>
                            <div className="rounded-md border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40">
                                  <tr>
                                    <th className="text-left px-3 py-2">Cuota</th>
                                    <th className="text-left px-3 py-2">Vencimiento</th>
                                    <th className="text-right px-3 py-2">Monto</th>
                                    <th className="text-right px-3 py-2">Pagado</th>
                                    <th className="text-left px-3 py-2">F. Pago</th>
                                    <th className="text-left px-3 py-2">Estado</th>
                                    <th className="px-3 py-2" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {cuotasDetalle.map(q => (
                                    <tr key={q.id} className={`border-t ${q.estado === "vencido" ? "bg-red-50" : ""}`}>
                                      <td className="px-3 py-2 font-medium">{q.numero_cuota}/{creditoDetalle.numero_cuotas}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(q.fecha_vencimiento)}</td>
                                      <td className="px-3 py-2 text-right">{fmt(Number(q.monto))}</td>
                                      <td className="px-3 py-2 text-right text-green-700">{Number(q.monto_pagado) > 0 ? fmt(Number(q.monto_pagado)) : "—"}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{q.fecha_pago ? fmtDate(q.fecha_pago) : "—"}</td>
                                      <td className="px-3 py-2">
                                        <Badge variant={estadoColor(q.estado) as any} className="text-xs">{q.estado}</Badge>
                                      </td>
                                      <td className="px-3 py-2 flex gap-1">
                                        {q.estado !== "pagado" && (rol === "admin" || rol === "cajero" || rol === "vendedor") && (
                                          <Button variant="outline" size="sm" onClick={() => abrirPago(creditoDetalle, q)}>Pagar</Button>
                                        )}
                                        {q.estado === "pagado" && (
                                          <Button variant="ghost" size="sm" onClick={() => printComprobante(creditoDetalle, q)}>
                                            <Printer className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog Nuevo Crédito */}
      <Dialog open={dialogNuevo} onClose={() => setDialogNuevo(false)} className="max-w-lg">
        <DialogHeader onClose={() => setDialogNuevo(false)}>Nuevo Crédito / Plan de Pagos</DialogHeader>
        <form onSubmit={hsN(d => crearMut.mutate(d))}>
          <DialogBody className="space-y-3">
            {/* Venta selector */}
            <div className="space-y-1">
              <Label>Vincular a venta pendiente (opcional)</Label>
              {ventaSel ? (
                <div className="flex items-center justify-between bg-muted/30 rounded px-3 py-2 text-sm">
                  <span className="font-mono font-medium">{ventaSel.numero}</span>
                  <span className="text-muted-foreground ml-2">{ventaSel.paciente_nombre}</span>
                  <span className="ml-auto text-green-700 font-medium">${Number(ventaSel.total).toFixed(2)}</span>
                  <button type="button" onClick={() => { setVentaSel(null); svN("monto_total", "") }} className="ml-2 text-muted-foreground hover:text-foreground">×</button>
                </div>
              ) : (
                <div className="relative">
                  <Input placeholder="Buscar venta..." value={busqVenta}
                    onChange={e => { setBusqVenta(e.target.value); setShowVentaList(true) }}
                    onFocus={() => setShowVentaList(true)}
                    onBlur={() => setTimeout(() => setShowVentaList(false), 150)} />
                  {showVentaList && (
                    <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-auto">
                      {ventasFiltradas.slice(0, 15).map(v => (
                        <button key={v.id} type="button" onMouseDown={() => { setVentaSel(v); setBusqVenta(""); setShowVentaList(false); svN("monto_total", String(v.total)) }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between">
                          <span className="font-mono font-medium">{v.numero}</span>
                          <span className="text-muted-foreground ml-2">{v.paciente_nombre}</span>
                          <span className="ml-auto text-green-700">${Number(v.total).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!ventaSel && (
              <div className="space-y-1">
                <Label>ID de paciente (opcional)</Label>
                <Input type="number" placeholder="Dejar vacío si no es paciente registrado" {...rN("paciente_id")} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto total ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rN("monto_total", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Número de cuotas *</Label>
                <Input type="number" min="1" max="60" {...rN("numero_cuotas", { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Periodicidad *</Label>
                <select {...rN("periodicidad")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                  {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Fecha inicio *</Label>
                <Input type="date" {...rN("fecha_inicio", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input placeholder="Observaciones del acuerdo..." {...rN("notas")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogNuevo(false)}>Cancelar</Button>
            <Button type="submit" disabled={crearMut.isPending}>
              {crearMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear crédito
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Pagar cuota */}
      <Dialog open={!!pagandoCuota} onClose={() => setPagandoCuota(null)} className="max-w-md">
        <DialogHeader onClose={() => setPagandoCuota(null)}>
          Pagar cuota {pagandoCuota?.cuota.numero_cuota}/{pagandoCuota?.credito.numero_cuotas} — {pagandoCuota?.credito.numero}
        </DialogHeader>
        <form onSubmit={hsP(d => pagarMut.mutate(d))}>
          <DialogBody className="space-y-3">
            {pagandoCuota && (
              <p className="text-sm text-muted-foreground">
                Vencimiento: <strong>{fmtDate(pagandoCuota.cuota.fecha_vencimiento)}</strong> ·
                Saldo: <strong className="text-foreground">{fmt(Number(pagandoCuota.cuota.monto) - Number(pagandoCuota.cuota.monto_pagado))}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rP("monto", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...rP("fecha_pago", { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método *</Label>
                <select {...rP("metodo_pago")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {METODOS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Cuenta destino *</Label>
                <select {...rP("cuenta_bancaria_id", { required: true })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {cuentas.filter(c => c.activa).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input placeholder="Nro. cheque, transferencia…" {...rP("referencia")} />
            </div>
            <p className="text-xs text-muted-foreground">Al confirmar se imprimirá el comprobante de abono automáticamente.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPagandoCuota(null)}>Cancelar</Button>
            <Button type="submit" disabled={pagarMut.isPending}>
              {pagarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar pago
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
