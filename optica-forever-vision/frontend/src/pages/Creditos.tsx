import { useState } from "react"
import { Paginador } from "@/components/ui/Paginador"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Loader2, CreditCard, ChevronDown, ChevronUp, Printer, UserCheck } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { getMarcaFooter, PDF_BASE_CSS, openPrintWindow, getMarcaLogo } from "@/lib/pdf"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import PacienteCombobox from "@/components/PacienteCombobox"
import { Card } from "@/components/ui/card"
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
  venta_id: number | null; monto_total: number; abono_inicial: number; monto_pagado: number
  numero_cuotas: number; periodicidad: string; fecha_inicio: string; estado: string
  notas: string | null; cuotas?: Cuota[]; created_at: string
}
interface Cuenta { id: number; nombre: string; activa: boolean }
interface VentaPendiente { id: number; numero: string; total: number; paciente_nombre: string | null }

type CreditoForm = { venta_id: string; monto_total: string; abono_inicial: string; numero_cuotas: string; periodicidad: string; fecha_inicio: string; notas: string }
type PagoForm = { monto: string; fecha_pago: string; cuenta_bancaria_id: string; metodo_pago: string; referencia: string }

function fmt(n: number) { return `$${Number(n).toFixed(2)}` }
function fmtDate(s: string) { const [y, m, d] = s.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

function estadoColor(e: string) {
  return e === "pagado" ? "default" : e === "vencido" ? "destructive" : e === "vigente" ? "secondary" : "outline"
}

async function printComprobante(credito: Credito, cuota: Cuota, firma = "") {
  const logo = (await import("@/store/brand")).useBrandStore.getState().logo
  const saldo = Number(credito.monto_total) - Number(credito.monto_pagado)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Comprobante Abono</title>
<style>${PDF_BASE_CSS}</style></head><body>
<div class="doc-hdr">
  <div class="doc-hdr-left">
    ${getMarcaLogo(logo)}
    <div class="doc-hdr-title">Comprobante de Abono</div>
  </div>
  <div class="doc-hdr-right">
    <div class="num">${cuota.numero_cuota}/${credito.numero_cuotas}</div>
    <div class="fecha">Cuota · ${credito.numero}</div>
  </div>
</div>
<div class="doc-body">
  <div class="doc-section">
    <div class="doc-section-title">Detalle del pago</div>
    <div class="doc-grid">
      <span class="lbl">Paciente</span><span class="val"><strong>${credito.paciente_nombre ?? "—"}</strong></span>
      <span class="lbl">Crédito N°</span><span class="val">${credito.numero}</span>
      <span class="lbl">Cuota</span><span class="val">${cuota.numero_cuota} de ${credito.numero_cuotas}</span>
      <span class="lbl">Vencimiento</span><span class="val">${fmtDate(cuota.fecha_vencimiento)}</span>
      <span class="lbl">Fecha de pago</span><span class="val">${cuota.fecha_pago ? fmtDate(cuota.fecha_pago) : fmtDate(new Date().toISOString())}</span>
      <span class="lbl">Monto abonado</span><span class="val"><strong style="font-size:16px;color:#0891b2">${fmt(Number(cuota.monto_pagado))}</strong></span>
    </div>
  </div>
  <div class="doc-section">
    <div class="doc-section-title">Resumen del crédito</div>
    <div class="doc-grid">
      <span class="lbl">Total crédito</span><span class="val">${fmt(Number(credito.monto_total))}</span>
      <span class="lbl">Total pagado</span><span class="val" style="color:#16a34a">${fmt(Number(credito.monto_pagado))}</span>
      <span class="lbl">Saldo pendiente</span><span class="val" style="color:${saldo > 0 ? "#dc2626" : "#16a34a"};font-weight:700">${fmt(saldo)}</span>
    </div>
  </div>
  <div class="doc-section">
    <div class="firma-row">
      <div class="firma-box"><div class="line"></div><p>Firma del cliente</p></div>
      <div class="firma-box">
        ${firma ? `<img src="${firma}" />` : `<div class="line"></div>`}
        <p>Responsable Óptica Forever Vision</p>
      </div>
    </div>
  </div>
</div>
${getMarcaFooter(logo)}
<script>window.onload=()=>window.print()</script>
</body></html>`
  openPrintWindow(html, 520, 700)
}

async function printAceptacionCredito(credito: Credito, productos: string, firma = "") {
  const logo = (await import("@/store/brand")).useBrandStore.getState().logo
  const abono = Number(credito.abono_inicial ?? 0)
  const saldoFinanciar = Number(credito.monto_total) - abono
  const cuotaValor = credito.numero_cuotas > 0
    ? (saldoFinanciar / credito.numero_cuotas).toFixed(2)
    : "0.00"
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Aceptación de Crédito ${credito.numero}</title>
<style>${PDF_BASE_CSS}
  .declaracion{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;font-size:11px;line-height:1.7;color:#374151;margin:8px 0}
</style></head><body>
<div class="doc-hdr">
  <div class="doc-hdr-left">
    ${getMarcaLogo(logo)}
    <div class="doc-hdr-title">Formato de Aceptación de Crédito</div>
  </div>
  <div class="doc-hdr-right">
    <div class="num">${credito.numero}</div>
    <div class="fecha">${fmtDate(credito.fecha_inicio)}</div>
  </div>
</div>
<div class="doc-body">
  <div class="doc-section">
    <div class="doc-section-title">Datos del cliente</div>
    <div class="doc-grid">
      <span class="lbl">Nombre del cliente</span><span class="val"><strong>${credito.paciente_nombre ?? "—"}</strong></span>
      <span class="lbl">Fecha</span><span class="val">${fmtDate(credito.fecha_inicio)}</span>
    </div>
  </div>
  <div class="doc-section">
    <div class="doc-section-title">Detalle de la compra</div>
    <div class="doc-grid">
      <span class="lbl">Producto(s) adquiridos</span><span class="val">${productos || "—"}</span>
      <span class="lbl">Valor Total</span><span class="val"><strong>$${Number(credito.monto_total).toFixed(2)}</strong></span>
      ${abono > 0 ? `<span class="lbl">Abono inicial</span><span class="val" style="color:#16a34a;font-weight:600">$${abono.toFixed(2)}</span>` : ""}
      <span class="lbl">Saldo a Financiar</span><span class="val" style="color:#0891b2;font-weight:700">$${saldoFinanciar.toFixed(2)}</span>
      <span class="lbl">Método acordado</span><span class="val">PAGO A ${credito.numero_cuotas} CUOTAS — ${credito.periodicidad.toUpperCase()}</span>
      <span class="lbl">Número de cuotas</span><span class="val">${credito.numero_cuotas}</span>
      <span class="lbl">Valor por cuota</span><span class="val"><strong>$${cuotaValor}</strong></span>
      ${credito.notas ? `<span class="lbl">Observaciones</span><span class="val">${credito.notas}</span>` : ""}
    </div>
  </div>
  <div class="doc-section">
    <div class="doc-section-title">Declaración de aceptación</div>
    <div class="declaracion">
      Yo, <strong>${credito.paciente_nombre ?? "___________________________"}</strong>, declaro que he recibido los productos detallados anteriormente y acepto adquirirlos bajo la modalidad de crédito, comprometiéndome a cancelar según lo acordado.<br><br>
      Me comprometo a realizar los pagos en las fechas establecidas. En caso de incumplimiento, autorizo a Óptica Forever Vision a contactarme y proceder conforme a lo estipulado para el cumplimiento de la deuda.
    </div>
  </div>
  <div class="doc-section">
    <div class="firma-row">
      <div class="firma-box">
        <div class="line"></div>
        <p>Firma del Cliente</p>
        <p style="margin-top:6px;font-size:9px">C.I.: ___________________</p>
      </div>
      <div class="firma-box">
        ${firma ? `<img src="${firma}" />` : `<div class="line"></div>`}
        <p>Firma del Representante de Forever Vision</p>
      </div>
    </div>
  </div>
</div>
${getMarcaFooter(logo)}
<script>window.onload=()=>window.print()</script>
</body></html>`
  openPrintWindow(html, 720, 960)
}

export default function Creditos() {
  const [filtroEstado, setFiltroEstado] = useState("")
  const [soloCuotasVencidas, setSoloCuotasVencidas] = useState(false)
  const [page, setPage] = useState(1)
  const [PER_PAGE, setPER_PAGE] = useState(20)
  const [dialogNuevo, setDialogNuevo] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [pagandoCuota, setPagandoCuota] = useState<{ credito: Credito; cuota: Cuota } | null>(null)
  const [busqVenta, setBusqVenta] = useState("")
  const [ventaSel, setVentaSel] = useState<VentaPendiente | null>(null)
  const [showVentaList, setShowVentaList] = useState(false)
  const [pacienteId, setPacienteId] = useState("")
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)
  const currentUser = useAuthStore((s) => s.user)
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 300_000,
  })

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

  const { data: pacienteSel } = useQuery<{ referido_por?: string | null; referido_a_nombre?: string | null; origen?: string | null }>({
    queryKey: ["paciente", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then(r => r.data),
    enabled: !!pacienteId && dialogNuevo,
    staleTime: 60_000,
  })


  const { register: rN, handleSubmit: hsN, reset: resetN, setValue: svN, watch: wN } = useForm<CreditoForm>()
  const { register: rP, handleSubmit: hsP, reset: resetP, watch: watchP } = useForm<PagoForm>()

  const crearMut = useMutation({
    mutationFn: (d: CreditoForm) => api.post("/creditos", {
      paciente_id: ventaSel ? undefined : (pacienteId ? Number(pacienteId) : null),
      venta_id: ventaSel ? ventaSel.id : null,
      monto_total: Number(d.monto_total),
      abono_inicial: Number(d.abono_inicial) || 0,
      numero_cuotas: Number(d.numero_cuotas),
      periodicidad: d.periodicidad,
      fecha_inicio: d.fecha_inicio,
      notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["creditos"] }); setDialogNuevo(false); toast.success("Crédito creado") },
    onError: (e) => toast.error(errMsg(e, "Error")),
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
      if (cuotaActualizada) printComprobante(creditoActualizado, cuotaActualizada, currentUser?.firma_url ?? config?.firma_electronica ?? "")
    },
    onError: (e) => toast.error(errMsg(e, "Error")),
  })

  function abrirNuevo() {
    resetN({ fecha_inicio: hoy, periodicidad: "mensual", numero_cuotas: "3", abono_inicial: "0" })
    setVentaSel(null); setBusqVenta("")
    setPacienteId("")
    setDialogNuevo(true)
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

  const creditosFiltrados = soloCuotasVencidas
    ? creditos.filter(c => c.estado === "vencido")
    : creditos

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
      <div className="flex flex-wrap items-center gap-2">
        {["", "vigente", "vencido", "pagado"].map(e => (
          <button key={e} onClick={() => { setPage(1); setFiltroEstado(e) }}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${filtroEstado === e ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted"}`}>
            {e === "" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={soloCuotasVencidas}
            onChange={e => { setSoloCuotasVencidas(e.target.checked); setPage(1) }}
            className="rounded"
          />
          Solo con cuotas vencidas
        </label>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">N°</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Paciente</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Inicio</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Cuotas</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Pagado</th>
                <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Saldo</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {creditosFiltrados.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No hay créditos registrados</td></tr>
              )}
              {creditosFiltrados.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((c, i) => (
                <>
                  <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors table-row-anim" style={{ animationDelay: `${i * 25}ms` }}>
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          title="Formato de aceptación de crédito"
                          onClick={() => printAceptacionCredito(c, c.venta_id ? `Venta ${c.venta_id}` : "Productos óptica", currentUser?.firma_url ?? config?.firma_electronica ?? "")}
                        >
                          <Printer className="h-4 w-4 text-indigo-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                          {expandido === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
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
                                          <Button variant="ghost" size="sm" onClick={() => printComprobante(creditoDetalle, q, currentUser?.firma_url ?? config?.firma_electronica ?? "")}>
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
          <Paginador page={page} total={creditosFiltrados.length} perPage={PER_PAGE} onChange={setPage} onPerPageChange={n => { setPER_PAGE(n); setPage(1) }} />
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
                <Label>Paciente (opcional)</Label>
                <PacienteCombobox value={pacienteId} onChange={setPacienteId} />
                {(pacienteSel?.referido_por || pacienteSel?.referido_a_nombre) && (
                  <div className="mt-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 text-sm space-y-1">
                    {pacienteSel.referido_por && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="text-amber-700 dark:text-amber-400">Referido por: <strong>{pacienteSel.referido_por}</strong></span>
                      </div>
                    )}
                    {pacienteSel.referido_a_nombre && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="text-blue-700 dark:text-blue-400">Al optometrista: <strong>{pacienteSel.referido_a_nombre}</strong></span>
                      </div>
                    )}
                  </div>
                )}
                {pacienteSel?.origen && (
                  <p className="text-xs text-muted-foreground pl-1">Canal: {pacienteSel.origen}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto total ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rN("monto_total", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Abono inicial ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...rN("abono_inicial")} />
                <p className="text-xs text-muted-foreground">Pago de entrada al crear el crédito</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número de cuotas *</Label>
                <Input type="number" min="1" max="60" {...rN("numero_cuotas", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Periodicidad *</Label>
                <select {...rN("periodicidad")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                  {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha inicio *</Label>
                <Input type="date" {...rN("fecha_inicio", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input placeholder="Observaciones del acuerdo..." {...rN("notas")} />
            </div>
            {/* Resumen calculado */}
            {(() => {
              const total = Number(wN("monto_total")) || 0
              const abono = Number(wN("abono_inicial")) || 0
              const cuotas = Number(wN("numero_cuotas")) || 0
              const saldo = total - abono
              const cuotaVal = cuotas > 0 ? saldo / cuotas : 0
              if (total <= 0) return null
              return (
                <div className="bg-muted/30 rounded-lg px-4 py-3 text-sm space-y-1 border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo a financiar</span>
                    <span className="font-semibold text-cyan-700">{fmt(saldo)}</span>
                  </div>
                  {cuotas > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor por cuota</span>
                      <span className="font-bold">{fmt(cuotaVal)}</span>
                    </div>
                  )}
                </div>
              )
            })()}
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
            <Button type="submit" disabled={pagarMut.isPending || (() => {
              if (!pagandoCuota) return false
              const saldoCuota = Number(pagandoCuota.cuota.monto) - Number(pagandoCuota.cuota.monto_pagado)
              const m = parseFloat(watchP("monto") || "0")
              return m <= 0 || m > saldoCuota
            })()}>
              {pagarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar pago
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
