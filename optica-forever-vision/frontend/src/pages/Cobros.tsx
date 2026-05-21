import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Plus, Loader2, TrendingUp, TrendingDown, Wallet, AlertCircle, X, ChevronDown, ChevronUp, Link2, PackagePlus, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"

const METODOS = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "cheque", "deposito"]
const CATEGORIAS_EGRESO = [
  "Alimentación", "Luz / Agua / Internet", "Arriendo", "Compras / Insumos",
  "Bisel y Lunas", "Motorizado", "Personal / Sueldos", "Publicidad", "Mantenimiento", "Otros",
]

type Tab = "cobros" | "egresos" | "cxp" | "cuentas"

interface Cuenta { id: number; nombre: string; tipo: string; saldo_actual: number; activa: boolean }
interface Cobro { id: number; numero: string; fecha: string; concepto: string; monto: number; metodo_pago: string; venta_id: number | null }
interface Egreso { id: number; numero: string; fecha: string; categoria: string; concepto: string; monto: number; metodo_pago: string }
interface CxP { id: number; proveedor: string; concepto: string; monto_total: number; monto_pagado: number; fecha_emision: string; fecha_vencimiento: string | null; estado: string }
interface CxPItem { id: number; codigo_proveedor: string | null; descripcion: string; cantidad: number; precio_unitario: number; subtotal: number; producto_id: number | null }
interface ProductoMin { id: number; nombre: string; codigo: string | null }
interface VentaPendiente { id: number; numero: string; total: number; estado: string; paciente_nombre: string | null; fecha: string }

type CobroForm = { cuenta_bancaria_id: string; fecha: string; concepto: string; monto: string; metodo_pago: string; referencia: string; notas: string }
type EgresoForm = { cuenta_bancaria_id: string; fecha: string; categoria: string; concepto: string; monto: string; metodo_pago: string; referencia: string; notas: string }
type CxPForm = { proveedor: string; concepto: string; monto_total: string; fecha_emision: string; fecha_vencimiento: string; referencia: string; notas: string }
type PagoForm = { monto: string; cuenta_bancaria_id: string; fecha: string; metodo_pago: string; referencia: string }

function fmt(n: number) { return `$${Number(n).toFixed(2)}` }

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", parcial: "outline", pagado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estado}</Badge>
}

export default function Cobros() {
  const [tab, setTab] = useState<Tab>("cobros")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [dialogCobro, setDialogCobro] = useState(false)
  const [dialogEgreso, setDialogEgreso] = useState(false)
  const [dialogCxP, setDialogCxP] = useState(false)
  const [pagandoCxP, setPagandoCxP] = useState<CxP | null>(null)
  const [expandedCxP, setExpandedCxP] = useState<number | null>(null)
  const [dialogNuevoProd, setDialogNuevoProd] = useState<CxPItem | null>(null)
  const [nuevoProdNombre, setNuevoProdNombre] = useState("")
  const [nuevoProdCodigo, setNuevoProdCodigo] = useState("")

  // venta selection state for cobro dialog
  const [ventaSel, setVentaSel] = useState<VentaPendiente | null>(null)
  const [busqVenta, setBusqVenta] = useState("")
  const [showVentaList, setShowVentaList] = useState(false)

  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: cuentas = [] } = useQuery<Cuenta[]>({
    queryKey: ["cuentas-bancarias"],
    queryFn: () => api.get("/cuentas-bancarias").then(r => r.data),
  })

  const { data: cobros = [], isLoading: cargCobros } = useQuery<Cobro[]>({
    queryKey: ["cobros", desde, hasta],
    queryFn: () => api.get("/cobros", { params: { desde: desde || undefined, hasta: hasta || undefined } }).then(r => r.data),
    enabled: tab === "cobros",
  })

  const { data: egresos = [], isLoading: cargEgr } = useQuery<Egreso[]>({
    queryKey: ["egresos", desde, hasta],
    queryFn: () => api.get("/egresos", { params: { desde: desde || undefined, hasta: hasta || undefined } }).then(r => r.data),
    enabled: tab === "egresos",
  })

  const { data: cxps = [], isLoading: cargCxP } = useQuery<CxP[]>({
    queryKey: ["cxp"],
    queryFn: () => api.get("/cxp").then(r => r.data),
    enabled: tab === "cxp",
  })

  const { data: cxpItems = [] } = useQuery<CxPItem[]>({
    queryKey: ["cxp-items", expandedCxP],
    queryFn: () => api.get(`/cxp/${expandedCxP}/items`).then(r => r.data),
    enabled: !!expandedCxP,
  })

  const { data: productosMin = [] } = useQuery<ProductoMin[]>({
    queryKey: ["productos-mini"],
    queryFn: () => api.get("/productos", { params: { limit: 500 } }).then(r => r.data),
    enabled: tab === "cxp",
  })

  // ventas pendientes para el selector de cobro
  const { data: ventasPendientes = [] } = useQuery<VentaPendiente[]>({
    queryKey: ["ventas-pendientes"],
    queryFn: () => api.get("/ventas", { params: { estado: "pendiente", limit: 200 } }).then(r => r.data),
    enabled: dialogCobro,
  })

  // cobros ya registrados de la venta seleccionada
  const { data: cobrosVenta = [] } = useQuery<Cobro[]>({
    queryKey: ["cobros-venta", ventaSel?.id],
    queryFn: () => api.get("/cobros", { params: { venta_id: ventaSel!.id } }).then(r => r.data),
    enabled: !!ventaSel,
  })

  const abonadoVenta = cobrosVenta.reduce((s, c) => s + c.monto, 0)
  const saldoVenta = ventaSel ? Math.max(0, ventaSel.total - abonadoVenta) : 0

  const { register: rC, handleSubmit: hsC, reset: resetC, setValue: svC } = useForm<CobroForm>()
  const { register: rE, handleSubmit: hsE, reset: resetE } = useForm<EgresoForm>()
  const { register: rCxP, handleSubmit: hsCxP, reset: resetCxP } = useForm<CxPForm>()
  const { register: rPago, handleSubmit: hsPago, reset: resetPago } = useForm<PagoForm>()

  // auto-fill monto when venta selection + cobros load
  useEffect(() => {
    if (ventaSel) {
      svC("concepto", `Cobro venta ${ventaSel.numero}`)
      svC("monto", saldoVenta.toFixed(2))
    }
  }, [ventaSel, abonadoVenta])

  const cobroMut = useMutation({
    mutationFn: (d: CobroForm) => api.post("/cobros", {
      venta_id: ventaSel?.id ?? null,
      cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, concepto: d.concepto, monto: Number(d.monto),
      metodo_pago: d.metodo_pago, referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobros"] })
      qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] })
      qc.invalidateQueries({ queryKey: ["ventas-pendientes"] })
      qc.invalidateQueries({ queryKey: ["cobros-venta"] })
      setDialogCobro(false)
      toast.success("Cobro registrado")
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const egresoMut = useMutation({
    mutationFn: (d: EgresoForm) => api.post("/egresos", {
      cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, categoria: d.categoria, concepto: d.concepto, monto: Number(d.monto),
      metodo_pago: d.metodo_pago, referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["egresos"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); setDialogEgreso(false); toast.success("Egreso registrado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const cxpMut = useMutation({
    mutationFn: (d: CxPForm) => api.post("/cxp", {
      proveedor: d.proveedor, concepto: d.concepto, monto_total: Number(d.monto_total),
      fecha_emision: d.fecha_emision, fecha_vencimiento: d.fecha_vencimiento || null,
      referencia: d.referencia || null, notas: d.notas || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); setDialogCxP(false); toast.success("CxP creada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const pagoMut = useMutation({
    mutationFn: (d: PagoForm) => api.post(`/cxp/${pagandoCxP!.id}/pago`, {
      monto: Number(d.monto), cuenta_bancaria_id: Number(d.cuenta_bancaria_id),
      fecha: d.fecha, metodo_pago: d.metodo_pago, referencia: d.referencia || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); qc.invalidateQueries({ queryKey: ["cuentas-bancarias"] }); setPagandoCxP(null); toast.success("Pago registrado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const eliminarCxPMut = useMutation({
    mutationFn: (id: number) => api.delete(`/cxp/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cxp"] }); toast.success("CxP eliminada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "No se puede eliminar"),
  })

  const hoy = new Date().toISOString().slice(0, 10)
  const totalCobros = cobros.reduce((s, c) => s + c.monto, 0)
  const totalEgresos = egresos.reduce((s, e) => s + e.monto, 0)
  const totalActivos = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo_actual, 0)
  const cxpPendiente = cxps.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.monto_total - c.monto_pagado), 0)

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "cobros", label: "Cobros (CxC)", icon: TrendingUp },
    { id: "egresos", label: "Egresos", icon: TrendingDown },
    { id: "cxp", label: "Cuentas x Pagar", icon: AlertCircle },
    { id: "cuentas", label: "Saldos", icon: Wallet },
  ]

  function abrirCobro() {
    resetC({ fecha: hoy, metodo_pago: "efectivo", cuenta_bancaria_id: cuentas[0]?.id.toString() ?? "" })
    setVentaSel(null)
    setBusqVenta("")
    setDialogCobro(true)
  }
  function cerrarCobro() { setDialogCobro(false); setVentaSel(null); setBusqVenta("") }
  function abrirEgreso() { resetE({ fecha: hoy, metodo_pago: "efectivo", cuenta_bancaria_id: cuentas[0]?.id.toString() ?? "" }); setDialogEgreso(true) }
  function abrirCxP() { resetCxP({ fecha_emision: hoy }); setDialogCxP(true) }
  function abrirPago(c: CxP) { resetPago({ fecha: hoy, metodo_pago: "efectivo", monto: String(c.monto_total - c.monto_pagado), cuenta_bancaria_id: cuentas[0]?.id.toString() ?? "" }); setPagandoCxP(c) }

  function seleccionarVenta(v: VentaPendiente) {
    setVentaSel(v)
    setBusqVenta("")
    setShowVentaList(false)
  }

  function limpiarVenta() {
    setVentaSel(null)
    setBusqVenta("")
    svC("concepto", "")
    svC("monto", "")
  }

  const ventasFiltradas = ventasPendientes.filter(v => {
    const q = busqVenta.toLowerCase()
    return !q || v.numero.toLowerCase().includes(q) || (v.paciente_nombre ?? "").toLowerCase().includes(q)
  })

  const SelectCuenta = ({ reg }: { reg: any }) => (
    <select {...reg} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {cuentas.filter(c => c.activa).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select>
  )

  const SelectMetodo = ({ reg }: { reg: any }) => (
    <select {...reg} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {METODOS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
    </select>
  )

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Tesorería</h1>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total activos</p><p className="text-xl font-bold text-green-600">{fmt(totalActivos)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cobros período</p><p className="text-xl font-bold">{fmt(totalCobros)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Egresos período</p><p className="text-xl font-bold text-amber-600">{fmt(totalEgresos)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">CxP pendiente</p><p className="text-xl font-bold text-red-600">{fmt(cxpPendiente)}</p></CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Filtro fechas */}
      {(tab === "cobros" || tab === "egresos") && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Desde</span>
            <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hasta</span>
            <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
          </div>
          {(desde || hasta) && <Button variant="ghost" size="sm" onClick={() => { setDesde(""); setHasta("") }}>Limpiar</Button>}
          <div className="ml-auto">
            {tab === "cobros" && (rol === "admin" || rol === "cajero" || rol === "vendedor") && (
              <Button size="sm" onClick={abrirCobro}><Plus className="h-4 w-4 mr-1" /> Nuevo Cobro</Button>
            )}
            {tab === "egresos" && (rol === "admin" || rol === "cajero") && (
              <Button size="sm" onClick={abrirEgreso}><Plus className="h-4 w-4 mr-1" /> Nuevo Egreso</Button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cobros */}
      {tab === "cobros" && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Número</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Concepto</th>
                <th className="text-left px-4 py-3 font-medium">Método</th>
                <th className="text-right px-4 py-3 font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cargCobros && <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
              {!cargCobros && cobros.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No hay cobros en el período</td></tr>}
              {cobros.map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><Badge variant="outline">{c.numero}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.fecha}</td>
                  <td className="px-4 py-3">{c.concepto}{c.venta_id && <span className="ml-2 text-xs text-muted-foreground">VEN #{c.venta_id}</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{c.metodo_pago.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(c.monto)}</td>
                </tr>
              ))}
              {!cargCobros && cobros.length > 0 && (
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-right text-sm">Total</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(totalCobros)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Egresos */}
      {tab === "egresos" && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Número</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-left px-4 py-3 font-medium">Concepto</th>
                <th className="text-right px-4 py-3 font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cargEgr && <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
              {!cargEgr && egresos.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No hay egresos en el período</td></tr>}
              {egresos.map(e => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><Badge variant="outline">{e.numero}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{e.fecha}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{e.categoria}</Badge></td>
                  <td className="px-4 py-3">{e.concepto}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmt(e.monto)}</td>
                </tr>
              ))}
              {!cargEgr && egresos.length > 0 && (
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-right text-sm">Total</td>
                  <td className="px-4 py-2 text-right text-amber-700">{fmt(totalEgresos)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: CxP */}
      {tab === "cxp" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {(rol === "admin" || rol === "cajero") && (
              <Button size="sm" onClick={abrirCxP}><Plus className="h-4 w-4 mr-1" /> Nueva CxP</Button>
            )}
          </div>

          {cargCxP && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!cargCxP && cxps.length === 0 && <p className="text-center py-10 text-muted-foreground">No hay cuentas por pagar</p>}

          {/* Desktop table */}
          {!cargCxP && cxps.length > 0 && (
            <div className="hidden md:block rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-8 px-2 py-3" />
                    <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                    <th className="text-left px-4 py-3 font-medium">Concepto</th>
                    <th className="text-left px-4 py-3 font-medium">Emisión</th>
                    <th className="text-left px-4 py-3 font-medium">Vencimiento</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-right px-4 py-3 font-medium">Pendiente</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cxps.map(c => (
                    <>
                      <tr key={c.id} className={`hover:bg-muted/30 ${c.estado === "pagado" ? "opacity-60" : ""}`}>
                        <td className="px-2 py-3">
                          <button onClick={() => setExpandedCxP(expandedCxP === c.id ? null : c.id)}
                            className="text-muted-foreground hover:text-foreground p-0.5">
                            {expandedCxP === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.proveedor}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.concepto}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.fecha_emision}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.fecha_vencimiento ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{fmt(c.monto_total)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(c.monto_total - c.monto_pagado)}</td>
                        <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                        <td className="px-4 py-3">
                          <CxPAcciones c={c} rol={rol} onPagar={() => abrirPago(c)} onEliminar={() => eliminarCxPMut.mutate(c.id)} />
                        </td>
                      </tr>
                      {expandedCxP === c.id && (
                        <tr key={`items-${c.id}`} className="bg-muted/20">
                          <td colSpan={9} className="px-6 py-3">
                            <CxPItemsPanel items={cxpItems} productos={productosMin}
                              onCrearProd={(it) => { setNuevoProdNombre(it.descripcion); setNuevoProdCodigo(it.codigo_proveedor ?? ""); setDialogNuevoProd(it) }} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards */}
          {!cargCxP && cxps.length > 0 && (
            <div className="md:hidden space-y-3">
              {cxps.map(c => (
                <div key={c.id} className={`border rounded-lg bg-card overflow-hidden ${c.estado === "pagado" ? "opacity-70" : ""}`}>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.proveedor}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.concepto}</p>
                      </div>
                      <EstadoBadge estado={c.estado} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">{fmt(c.monto_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pendiente</p>
                        <p className="font-semibold text-red-600">{fmt(c.monto_total - c.monto_pagado)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Emisión</p>
                        <p className="text-xs">{c.fecha_emision}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => setExpandedCxP(expandedCxP === c.id ? null : c.id)}
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                        {expandedCxP === c.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Ver ítems
                      </button>
                      <div className="ml-auto">
                        <CxPAcciones c={c} rol={rol} onPagar={() => abrirPago(c)} onEliminar={() => eliminarCxPMut.mutate(c.id)} />
                      </div>
                    </div>
                  </div>
                  {expandedCxP === c.id && (
                    <div className="border-t bg-muted/20 px-4 py-3">
                      <CxPItemsPanel items={cxpItems} productos={productosMin}
                        onCrearProd={(it) => { setNuevoProdNombre(it.descripcion); setNuevoProdCodigo(it.codigo_proveedor ?? ""); setDialogNuevoProd(it) }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Saldos */}
      {tab === "cuentas" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cuentas.map(c => (
            <Card key={c.id} className={!c.activa ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  {c.nombre}
                  <Badge variant="outline" className="font-normal text-xs">{c.tipo}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${c.saldo_actual < 0 ? "text-destructive" : "text-green-700"}`}>
                  {fmt(c.saldo_actual)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Cobro */}
      <Dialog open={dialogCobro} onClose={cerrarCobro} className="max-w-lg">
        <DialogHeader onClose={cerrarCobro}>Nuevo Cobro</DialogHeader>
        <form onSubmit={hsC(d => cobroMut.mutate(d))}>
          <DialogBody className="space-y-3">
            {/* Venta selector */}
            <div className="space-y-1">
              <Label>Venta a cobrar (opcional)</Label>
              {ventaSel ? (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{ventaSel.numero} · {ventaSel.paciente_nombre ?? "Sin paciente"}</p>
                      <p className="text-xs text-muted-foreground">{ventaSel.fecha}</p>
                    </div>
                    <button type="button" onClick={limpiarVenta} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="bg-background rounded p-1.5">
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{fmt(ventaSel.total)}</p>
                    </div>
                    <div className="bg-background rounded p-1.5">
                      <p className="text-muted-foreground">Abonado</p>
                      <p className="font-semibold text-green-700">{fmt(abonadoVenta)}</p>
                    </div>
                    <div className="bg-background rounded p-1.5">
                      <p className="text-muted-foreground">Saldo</p>
                      <p className="font-semibold text-amber-700">{fmt(saldoVenta)}</p>
                    </div>
                  </div>
                  {cobrosVenta.length > 0 && (
                    <div className="space-y-1 border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground">Pagos anteriores</p>
                      {cobrosVenta.map(c => (
                        <div key={c.id} className="flex justify-between text-xs text-muted-foreground">
                          <span>{c.fecha} · {c.metodo_pago.replace("_", " ")}</span>
                          <span className="font-medium text-foreground">{fmt(c.monto)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar por número de venta o paciente..."
                    value={busqVenta}
                    onChange={e => { setBusqVenta(e.target.value); setShowVentaList(true) }}
                    onFocus={() => setShowVentaList(true)}
                    onBlur={() => setTimeout(() => setShowVentaList(false), 150)}
                  />
                  {showVentaList && (busqVenta || ventasPendientes.length > 0) && (
                    <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                      {ventasPendientes.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-3">No hay ventas pendientes</p>
                      )}
                      {ventasFiltradas.slice(0, 20).map(v => (
                        <button
                          key={v.id} type="button"
                          onMouseDown={() => seleccionarVenta(v)}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                        >
                          <span>
                            <span className="font-mono font-medium">{v.numero}</span>
                            {v.paciente_nombre && <span className="text-muted-foreground ml-2">· {v.paciente_nombre}</span>}
                          </span>
                          <span className="text-green-700 font-medium ml-2">{fmt(v.total)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...rC("fecha", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Monto ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rC("monto", { required: true, min: 0.01 })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Concepto *</Label>
              <Input placeholder="Cobro venta, abono cuota…" {...rC("concepto", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método de pago *</Label>
                <SelectMetodo reg={rC("metodo_pago")} />
              </div>
              <div className="space-y-1">
                <Label>Cuenta destino *</Label>
                <SelectCuenta reg={rC("cuenta_bancaria_id", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input placeholder="Nro. cheque, transferencia…" {...rC("referencia")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrarCobro}>Cancelar</Button>
            <Button type="submit" disabled={cobroMut.isPending}>
              {cobroMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Egreso */}
      <Dialog open={dialogEgreso} onClose={() => setDialogEgreso(false)} className="max-w-lg">
        <DialogHeader onClose={() => setDialogEgreso(false)}>Nuevo Egreso</DialogHeader>
        <form onSubmit={hsE(d => egresoMut.mutate(d))}>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...rE("fecha", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Monto ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rE("monto", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Categoría *</Label>
              <select {...rE("categoria", { required: true })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— seleccionar —</option>
                {CATEGORIAS_EGRESO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Concepto *</Label>
              <Input placeholder="Descripción del gasto" {...rE("concepto", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método de pago *</Label>
                <SelectMetodo reg={rE("metodo_pago")} />
              </div>
              <div className="space-y-1">
                <Label>Cuenta origen *</Label>
                <SelectCuenta reg={rE("cuenta_bancaria_id", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input placeholder="Comprobante, factura…" {...rE("referencia")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogEgreso(false)}>Cancelar</Button>
            <Button type="submit" disabled={egresoMut.isPending}>
              {egresoMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog CxP */}
      <Dialog open={dialogCxP} onClose={() => setDialogCxP(false)} className="max-w-lg">
        <DialogHeader onClose={() => setDialogCxP(false)}>Nueva Cuenta por Pagar</DialogHeader>
        <form onSubmit={hsCxP(d => cxpMut.mutate(d))}>
          <DialogBody className="space-y-3">
            <div className="space-y-1">
              <Label>Proveedor / Lab *</Label>
              <Input placeholder="Nombre del proveedor" {...rCxP("proveedor", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Concepto *</Label>
              <Input placeholder="Descripción" {...rCxP("concepto", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto Total ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rCxP("monto_total", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Referencia</Label>
                <Input placeholder="Nro. orden, factura…" {...rCxP("referencia")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha emisión *</Label>
                <Input type="date" {...rCxP("fecha_emision", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha vencimiento</Label>
                <Input type="date" {...rCxP("fecha_vencimiento")} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCxP(false)}>Cancelar</Button>
            <Button type="submit" disabled={cxpMut.isPending}>
              {cxpMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Crear
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Pago CxP */}
      <Dialog open={!!pagandoCxP} onClose={() => setPagandoCxP(null)} className="max-w-md">
        <DialogHeader onClose={() => setPagandoCxP(null)}>
          Registrar Pago — {pagandoCxP?.proveedor}
        </DialogHeader>
        <form onSubmit={hsPago(d => pagoMut.mutate(d))}>
          <DialogBody className="space-y-3">
            {pagandoCxP && (
              <p className="text-sm text-muted-foreground">
                Pendiente: <strong className="text-foreground">{fmt(pagandoCxP.monto_total - pagandoCxP.monto_pagado)}</strong>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monto a pagar ($) *</Label>
                <Input type="number" step="0.01" min="0.01" {...rPago("monto", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...rPago("fecha", { required: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Método *</Label>
                <SelectMetodo reg={rPago("metodo_pago")} />
              </div>
              <div className="space-y-1">
                <Label>Cuenta origen *</Label>
                <SelectCuenta reg={rPago("cuenta_bancaria_id", { required: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Referencia</Label>
              <Input placeholder="Nro. transferencia, cheque…" {...rPago("referencia")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPagandoCxP(null)}>Cancelar</Button>
            <Button type="submit" disabled={pagoMut.isPending}>
              {pagoMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar pago
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog crear producto desde ítem CxP */}
      <Dialog open={!!dialogNuevoProd} onClose={() => setDialogNuevoProd(null)} className="max-w-md">
        <DialogHeader onClose={() => setDialogNuevoProd(null)}>Crear producto en inventario</DialogHeader>
        <DialogBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Se creará el producto y se vinculará al ítem de esta factura. La próxima vez que llegue el mismo código del proveedor se detectará automáticamente.
          </p>
          <div className="space-y-1">
            <Label>Nombre del producto *</Label>
            <Input value={nuevoProdNombre} onChange={e => setNuevoProdNombre(e.target.value)} placeholder="Nombre en tu inventario..." />
          </div>
          <div className="space-y-1">
            <Label>Código interno</Label>
            <Input value={nuevoProdCodigo} onChange={e => setNuevoProdCodigo(e.target.value)} placeholder="Ej: ARM-001" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDialogNuevoProd(null)}>Cancelar</Button>
          <Button
            type="button"
            disabled={!nuevoProdNombre.trim()}
            onClick={async () => {
              if (!dialogNuevoProd || !nuevoProdNombre.trim()) return
              try {
                const res = await api.post("/productos", {
                  nombre: nuevoProdNombre.trim(),
                  codigo: nuevoProdCodigo.trim() || null,
                  precio_costo: 0, precio_venta: 0, stock_actual: 0, stock_minimo: 0, unidad: "unidad",
                })
                const prod = res.data
                // vincular ítem al producto
                await api.post(`/cxp/${expandedCxP}/items/${dialogNuevoProd.id}/vincular`, null, { params: { producto_id: prod.id } })
                // guardar mapeo SRI
                if (dialogNuevoProd.codigo_proveedor) {
                  await api.post("/sri/mapear-items", { mapeos: [{ codigo_proveedor: dialogNuevoProd.codigo_proveedor, descripcion_proveedor: dialogNuevoProd.descripcion, producto_id: prod.id, proveedor_id: null }] })
                }
                toast.success(`Producto "${prod.nombre}" creado y vinculado`)
                qc.invalidateQueries({ queryKey: ["cxp-items", expandedCxP] })
                qc.invalidateQueries({ queryKey: ["productos-mini"] })
                setDialogNuevoProd(null)
              } catch (e: any) {
                toast.error(e?.response?.data?.detail ?? "Error al crear producto")
              }
            }}
          >
            Crear y vincular
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function CxPAcciones({ c, rol, onPagar, onEliminar }: {
  c: CxP; rol: string | undefined
  onPagar: () => void; onEliminar: () => void
}) {
  return (
    <div className="flex gap-1 items-center">
      {c.estado !== "pagado" && (rol === "admin" || rol === "cajero") && (
        <Button variant="outline" size="sm" onClick={onPagar}>Pagar</Button>
      )}
      {rol === "admin" && c.monto_pagado === 0 && (
        <button
          onClick={() => { if (confirm(`¿Eliminar CxP de ${c.proveedor}?`)) onEliminar() }}
          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function CxPItemsPanel({ items, productos, onCrearProd }: {
  items: CxPItem[]
  productos: ProductoMin[]
  onCrearProd: (it: CxPItem) => void
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Sin ítems (factura ingresada manualmente).</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ítems de la factura</p>
      {/* Mobile: list */}
      <div className="md:hidden space-y-2">
        {items.map(it => {
          const prod = productos.find(p => p.id === it.producto_id)
          return (
            <div key={it.id} className="text-xs border rounded p-2 space-y-1">
              <div className="flex items-start justify-between gap-1">
                <div>
                  {it.codigo_proveedor && <span className="font-mono text-muted-foreground mr-1">[{it.codigo_proveedor}]</span>}
                  <span>{it.descripcion}</span>
                </div>
                <span className="font-medium shrink-0">{fmt(it.subtotal)}</span>
              </div>
              <div className="text-muted-foreground">Cant: {it.cantidad} × {fmt(it.precio_unitario)}</div>
              {prod ? (
                <span className="inline-flex items-center gap-1 text-green-700"><Link2 className="h-3 w-3" />{prod.nombre}</span>
              ) : (
                <button onClick={() => onCrearProd(it)} className="inline-flex items-center gap-1 text-amber-600 underline">
                  <PackagePlus className="h-3 w-3" />Crear producto
                </button>
              )}
            </div>
          )
        })}
      </div>
      {/* Desktop: table */}
      <table className="hidden md:table w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left py-1 pr-3">Código prov.</th>
            <th className="text-left py-1 pr-3">Descripción</th>
            <th className="text-right py-1 pr-3">Cant.</th>
            <th className="text-right py-1 pr-3">P.Unit.</th>
            <th className="text-right py-1 pr-3">Subtotal</th>
            <th className="text-left py-1">Producto inventario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {items.map(it => {
            const prod = productos.find(p => p.id === it.producto_id)
            return (
              <tr key={it.id}>
                <td className="py-1.5 pr-3 font-mono text-muted-foreground">{it.codigo_proveedor ?? "—"}</td>
                <td className="py-1.5 pr-3">{it.descripcion}</td>
                <td className="py-1.5 pr-3 text-right">{it.cantidad}</td>
                <td className="py-1.5 pr-3 text-right">{fmt(it.precio_unitario)}</td>
                <td className="py-1.5 pr-3 text-right font-medium">{fmt(it.subtotal)}</td>
                <td className="py-1.5">
                  {prod ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Link2 className="h-3 w-3" />{prod.nombre}{prod.codigo ? ` [${prod.codigo}]` : ""}
                    </span>
                  ) : (
                    <button onClick={() => onCrearProd(it)}
                      className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 underline">
                      <PackagePlus className="h-3 w-3" />Crear producto
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
