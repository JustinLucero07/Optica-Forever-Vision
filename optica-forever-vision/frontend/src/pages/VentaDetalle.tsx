import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Printer, DollarSign } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getMarcaFooter, PDF_BASE_CSS, openPrintWindow, getMarcaLogo } from "@/lib/pdf"

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

interface VentaItem {
  id: number; descripcion: string; cantidad: number
  precio_unitario: number; descuento_pct: number; subtotal: number
}
interface Venta {
  id: number; numero: string; paciente_id: number | null; fecha: string
  subtotal: number; descuento: number; total: number; estado: string
  notas: string | null; items: VentaItem[]
}
interface Paciente {
  id: number; nombres: string; apellidos: string; cedula: string
  telefono: string | null; email: string | null; direccion: string | null
}
interface Cobro { id: number; monto: number; metodo_pago?: string; fecha?: string }
interface CuentaBancaria { id: number; nombre: string; saldo_actual: number }

async function printComprobante(v: Venta, pac: Paciente | null, abonado: number) {
  const logo = (await import("@/store/brand")).useBrandStore.getState().logo
  const pendiente = Math.max(0, Number(v.total) - abonado)
  const nombre = pac ? `${pac.apellidos} ${pac.nombres}` : "—"
  const cedula = pac?.cedula ?? "—"
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprobante ${v.numero}</title>
<style>${PDF_BASE_CSS}
  .brand-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 20px 16px;border-bottom:1px solid #e5e7eb;margin-bottom:20px}
  .firma-section{display:flex;justify-content:center;gap:60px;margin-top:36px}
  .firma-box{text-align:center;width:200px}
  .firma-line{border-top:1px solid #374151;margin:0 auto 4px;width:88%}
  .firma-sub{font-size:9px;color:#6b7280}
</style>
</head><body>
<div class="brand-hdr">
  ${getMarcaLogo(logo)}
  <div style="text-align:right">
    <div style="font-size:18px;font-weight:800;color:#0891b2">COMPROBANTE DE VENTA</div>
    <div style="font-size:13px;font-weight:700">${v.numero}</div>
    <div style="font-size:11px;color:#6b7280">${fmtDate(v.fecha)}</div>
  </div>
</div>

<div class="doc-body">
  <div class="doc-section">
    <div class="doc-section-title">Datos del cliente</div>
    <div class="doc-grid">
      <span class="lbl">Nombre</span><span class="val">${nombre}</span>
      <span class="lbl">Cédula</span><span class="val">${cedula}</span>
      ${pac?.telefono ? `<span class="lbl">Teléfono</span><span class="val">${pac.telefono}</span>` : ""}
    </div>
  </div>

  <div class="doc-section">
    <div class="doc-section-title">Detalle</div>
    <table class="items">
      <thead><tr>
        <th>Descripción</th><th class="c">Cant.</th><th class="r">P.Unit.</th><th class="r">Desc.%</th><th class="r">Subtotal</th>
      </tr></thead>
      <tbody>
        ${v.items.map(it => `<tr>
          <td>${it.descripcion}</td>
          <td style="text-align:center">${it.cantidad}</td>
          <td style="text-align:right">$${Number(it.precio_unitario).toFixed(2)}</td>
          <td style="text-align:right">${it.descuento_pct > 0 ? it.descuento_pct + "%" : "—"}</td>
          <td style="text-align:right;font-weight:600">$${Number(it.subtotal).toFixed(2)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="totales">
    <div class="t-row"><span>Subtotal</span><span>$${Number(v.subtotal).toFixed(2)}</span></div>
    ${Number(v.descuento) > 0 ? `<div class="t-row" style="color:#d97706"><span>Descuento</span><span>-$${Number(v.descuento).toFixed(2)}</span></div>` : ""}
    <div class="t-row big"><span>Total</span><span>$${Number(v.total).toFixed(2)}</span></div>
    ${abonado > 0 ? `<div class="t-row" style="color:#16a34a"><span>Pagado</span><span>$${abonado.toFixed(2)}</span></div>` : ""}
    ${pendiente > 0.01 ? `<div class="t-row" style="color:#dc2626;font-weight:700"><span>Saldo pendiente</span><span>$${pendiente.toFixed(2)}</span></div>` : ""}
  </div>
</div>

<div class="firma-section">
  <div class="firma-box">
    <div class="firma-line"></div>
    <div class="firma-sub">Firma del cliente</div>
  </div>
  <div class="firma-box">
    <div class="firma-line"></div>
    <div class="firma-sub">Responsable / Óptica</div>
  </div>
</div>

${getMarcaFooter(logo)}
<script>window.onload=()=>window.print()</script></body></html>`

  openPrintWindow(html, 860, 960)
}

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", anulado: "destructive", cobrado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estado}</Badge>
}

export default function VentaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [cobroMonto, setCobroMonto] = useState("")
  const [cobroMetodo, setCobroMetodo] = useState("efectivo")
  const [cobroCuenta, setCobroCuenta] = useState("")
  const [cobroRef, setCobroRef] = useState("")
  const [showCobroForm, setShowCobroForm] = useState(false)

  const { data: v, isLoading } = useQuery<Venta>({
    queryKey: ["venta", id],
    queryFn: () => api.get(`/ventas/${id}`).then(r => r.data),
  })

  const { data: paciente } = useQuery<Paciente>({
    queryKey: ["paciente", v?.paciente_id],
    queryFn: () => api.get(`/pacientes/${v!.paciente_id}`).then(r => r.data),
    enabled: !!v?.paciente_id,
  })

  const { data: cobros = [], refetch: refetchCobros } = useQuery<Cobro[]>({
    queryKey: ["cobros-venta", id],
    queryFn: () => api.get("/cobros", { params: { venta_id: Number(id), limit: 100 } }).then(r => r.data),
    enabled: !!id,
  })

  const { data: cuentas = [] } = useQuery<CuentaBancaria[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
    staleTime: 60_000,
  })

  const cobroMut = useMutation({
    mutationFn: () => api.post("/cobros", {
      venta_id: Number(id),
      cuenta_bancaria_id: Number(cobroCuenta) || null,
      fecha: new Date().toISOString().slice(0, 10),
      concepto: v?.numero ? `Cobro venta ${v.numero}` : "Cobro de venta",
      monto: Number(cobroMonto),
      metodo_pago: cobroMetodo,
      referencia: cobroRef || null,
    }),
    onMutate: async () => {
      // Optimistic: agrega el cobro a la lista local de inmediato
      await qc.cancelQueries({ queryKey: ["cobros-venta", id] })
      const prev = qc.getQueryData<Cobro[]>(["cobros-venta", id]) ?? []
      const optimistic: Cobro = {
        id: -Date.now(),
        monto: Number(cobroMonto),
        metodo_pago: cobroMetodo,
        fecha: new Date().toISOString().slice(0, 10),
      }
      qc.setQueryData<Cobro[]>(["cobros-venta", id], [...prev, optimistic])
      return { prev }
    },
    onSuccess: () => {
      toast.success("Cobro registrado")
      refetchCobros()
      qc.invalidateQueries({ queryKey: ["venta", id] })
      setShowCobroForm(false)
      setCobroRef("")
    },
    onError: (e, _vars, ctx) => {
      // Revert optimistic update
      if (ctx?.prev) qc.setQueryData(["cobros-venta", id], ctx.prev)
      toast.error(errMsg(e, "Error al registrar cobro"))
    },
  })

  if (isLoading) return (
    <div className="p-6 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
    </div>
  )
  if (!v) return <div className="p-6 text-destructive">Venta no encontrada</div>

  const abonado = cobros.reduce((s, c) => s + Number(c.monto), 0)
  const pendiente = Math.max(0, Number(v.total) - abonado)
  const nombrePac = paciente ? `${paciente.apellidos} ${paciente.nombres}` : undefined

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Venta <Badge variant="outline">{v.numero}</Badge></h1>
              <EstadoBadge estado={v.estado} />
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(v.fecha)}{nombrePac && ` — ${nombrePac}`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => printComprobante(v, paciente ?? null, abonado)}>
          <Printer className="h-4 w-4 mr-1" /> Comprobante
        </Button>
      </div>

      {/* ── Alerta de cobro pendiente ── */}
      {pendiente > 0.01 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                Saldo pendiente: ${pendiente.toFixed(2)}
              </span>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                setCobroMonto(pendiente.toFixed(2))
                if (cuentas.length === 1) setCobroCuenta(String(cuentas[0].id))
                setShowCobroForm(f => !f)
              }}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              {showCobroForm ? "Cancelar" : "Registrar cobro"}
            </Button>
          </div>

          {showCobroForm && (
            <div className="bg-white dark:bg-card rounded-lg p-4 border space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monto</Label>
                  <Input
                    type="number" min="0.01" step="0.01"
                    value={cobroMonto}
                    onChange={e => setCobroMonto(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Método</Label>
                  <select
                    value={cobroMetodo}
                    onChange={e => setCobroMetodo(e.target.value)}
                    className="h-8 w-full rounded-md border text-sm px-2 bg-background"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuenta</Label>
                  <select
                    value={cobroCuenta}
                    onChange={e => setCobroCuenta(e.target.value)}
                    className="h-8 w-full rounded-md border text-sm px-2 bg-background"
                  >
                    <option value="">— selecciona —</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Referencia (opcional)</Label>
                  <Input
                    placeholder="Nro. transacción"
                    value={cobroRef}
                    onChange={e => setCobroRef(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!cobroMonto || !cobroCuenta || cobroMut.isPending}
                  onClick={() => cobroMut.mutate()}
                >
                  {cobroMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
                  Confirmar cobro
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Detalle de ítems</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Descripción</th>
                <th className="text-right px-4 py-2 font-medium">Cant.</th>
                <th className="text-right px-4 py-2 font-medium">P. Unit.</th>
                <th className="text-right px-4 py-2 font-medium">Desc. %</th>
                <th className="text-right px-4 py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {v.items.map(it => (
                <tr key={it.id}>
                  <td className="px-4 py-2.5">{it.descripcion}</td>
                  <td className="px-4 py-2.5 text-right">{it.cantidad}</td>
                  <td className="px-4 py-2.5 text-right">${Number(it.precio_unitario).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">{it.descuento_pct > 0 ? `${it.descuento_pct}%` : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">${Number(it.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="w-72 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${Number(v.subtotal).toFixed(2)}</span>
          </div>
          {Number(v.descuento) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Descuento</span><span>-${Number(v.descuento).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1.5">
            <span>Total</span><span>${Number(v.total).toFixed(2)}</span>
          </div>
          {abonado > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Abonado</span><span>${abonado.toFixed(2)}</span>
            </div>
          )}
          {pendiente > 0.01 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Saldo pendiente</span><span>${pendiente.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {cobros.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Cobros registrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium">Método</th>
                  <th className="text-right px-4 py-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cobros.map(co => (
                  <tr key={co.id}>
                    <td className="px-4 py-2">{co.fecha ? fmtDate(co.fecha) : "—"}</td>
                    <td className="px-4 py-2 capitalize">{co.metodo_pago ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-medium text-green-700">${Number(co.monto).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {v.notas && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Notas:</span> {v.notas}
        </p>
      )}

      {v.paciente_id && (
        <Button variant="link" size="sm" asChild>
          <Link to={`/pacientes/${v.paciente_id}`}>← Ver paciente</Link>
        </Button>
      )}
    </div>
  )
}
