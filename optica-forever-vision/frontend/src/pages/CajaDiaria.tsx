import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Wallet, Lock, Unlock, Loader2, TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"

interface CajaOut {
  id: number
  fecha: string
  estado: string
  saldo_apertura: number
  saldo_cierre: number | null
  total_efectivo: number | null
  total_tarjeta: number | null
  total_transferencia: number | null
  total_egresos: number | null
  diferencia: number | null
  notas_apertura: string | null
  notas_cierre: string | null
  cobros_dia: number
  egresos_dia: number
}

interface CajaHoy {
  abierta: boolean
  caja?: CajaOut
  cobros_dia: number
  egresos_dia: number
  neto: number
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—"
  return `$${Number(v).toFixed(2)}`
}

function StatBox({ label, value, color = "text-foreground", icon: Icon }: { label: string; value: string; color?: string; icon?: React.ElementType }) {
  return (
    <div className="bg-card border rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

export default function CajaDiaria() {
  const [dialogApertura, setDialogApertura] = useState(false)
  const [dialogCierre, setDialogCierre] = useState(false)
  const qc = useQueryClient()

  const { data: hoy, isLoading: cargandoHoy } = useQuery<CajaHoy>({
    queryKey: ["caja-hoy"],
    queryFn: () => api.get("/caja/hoy").then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: historial = [], isLoading: cargandoHist } = useQuery<CajaOut[]>({
    queryKey: ["caja-historial"],
    queryFn: () => api.get("/caja").then(r => r.data),
  })

  const { register: regAp, handleSubmit: hsAp, reset: resetAp } = useForm<{ saldo_apertura: string; notas_apertura: string }>()
  const { register: regCi, handleSubmit: hsCi, reset: resetCi } = useForm<{
    total_efectivo: string; total_tarjeta: string; total_transferencia: string; notas_cierre: string
  }>()

  const aperturaMut = useMutation({
    mutationFn: (d: any) => api.post("/caja/apertura", {
      fecha: new Date().toISOString().slice(0, 10),
      saldo_apertura: Number(d.saldo_apertura) || 0,
      notas_apertura: d.notas_apertura || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caja-hoy"] })
      qc.invalidateQueries({ queryKey: ["caja-historial"] })
      setDialogApertura(false)
      toast.success("Caja abierta")
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const cierreMut = useMutation({
    mutationFn: (d: any) => api.post(`/caja/${hoy?.caja?.id}/cierre`, {
      total_efectivo: Number(d.total_efectivo) || 0,
      total_tarjeta: Number(d.total_tarjeta) || 0,
      total_transferencia: Number(d.total_transferencia) || 0,
      notas_cierre: d.notas_cierre || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caja-hoy"] })
      qc.invalidateQueries({ queryKey: ["caja-historial"] })
      qc.invalidateQueries({ queryKey: ["stats-caja-hoy"] })
      setDialogCierre(false)
      toast.success("Caja cerrada correctamente")
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const caja = hoy?.caja

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Caja Diaria
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          {!cargandoHoy && !hoy?.abierta && (
            <Button onClick={() => { resetAp(); setDialogApertura(true) }}>
              <Unlock className="h-4 w-4 mr-2" /> Abrir caja
            </Button>
          )}
          {!cargandoHoy && hoy?.abierta && (
            <Button variant="outline" onClick={() => { resetCi(); setDialogCierre(true) }}>
              <Lock className="h-4 w-4 mr-2" /> Cerrar caja
            </Button>
          )}
        </div>
      </div>

      {/* Estado de hoy */}
      {cargandoHoy ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-4">
          {/* Estado badge */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl w-fit text-sm font-semibold border ${hoy?.abierta ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {hoy?.abierta ? <><Unlock className="h-4 w-4" /> Caja abierta</> : <><Lock className="h-4 w-4" /> {caja ? "Caja cerrada" : "No hay caja para hoy"}</>}
          </div>

          {/* Stats del día */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Cobros del día" value={fmtMoney(hoy?.cobros_dia)} color="text-emerald-600" icon={TrendingUp} />
            <StatBox label="Egresos del día" value={fmtMoney(hoy?.egresos_dia)} color="text-red-500" icon={TrendingDown} />
            <StatBox label="Neto del día" value={fmtMoney(hoy?.neto)} color={(hoy?.neto ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} icon={DollarSign} />
            <StatBox label="Saldo apertura" value={fmtMoney(caja?.saldo_apertura)} icon={Wallet} />
          </div>

          {/* Detalle del cierre si ya cerró */}
          {caja?.estado === "cerrada" && (
            <div className="bg-card border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">Detalle del cierre</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Efectivo contado</p><p className="font-bold">{fmtMoney(caja.total_efectivo)}</p></div>
                <div><p className="text-muted-foreground text-xs">Tarjeta</p><p className="font-bold">{fmtMoney(caja.total_tarjeta)}</p></div>
                <div><p className="text-muted-foreground text-xs">Transferencia</p><p className="font-bold">{fmtMoney(caja.total_transferencia)}</p></div>
                <div>
                  <p className="text-muted-foreground text-xs">Diferencia</p>
                  <p className={`font-bold ${(caja.diferencia ?? 0) !== 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {fmtMoney(caja.diferencia)}
                    {(caja.diferencia ?? 0) === 0 && " ✓"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Saldo cierre</p><p className="font-bold">{fmtMoney(caja.saldo_cierre)}</p></div>
                <div><p className="text-muted-foreground text-xs">Egresos</p><p className="font-bold text-red-500">{fmtMoney(caja.total_egresos)}</p></div>
              </div>
              {caja.notas_cierre && <p className="text-xs text-muted-foreground border-t pt-2">{caja.notas_cierre}</p>}
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Receipt className="h-4 w-4" /> Historial de cajas
        </h2>
        {cargandoHist ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Cobros</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Egresos</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Neto</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Diferencia</th>
                  <th className="px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {historial.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Sin registros</td></tr>
                )}
                {historial.map(c => {
                  const neto = c.cobros_dia - c.egresos_dia
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.fecha}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 tabular-nums">{fmtMoney(c.cobros_dia)}</td>
                      <td className="px-4 py-3 text-right text-red-500 tabular-nums">{fmtMoney(c.egresos_dia)}</td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums ${neto >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {neto >= 0 ? "+" : ""}{fmtMoney(neto)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${(c.diferencia ?? 0) !== 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {c.diferencia != null ? fmtMoney(c.diferencia) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.estado === "abierta" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                          {c.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog Apertura */}
      <Dialog open={dialogApertura} onClose={() => setDialogApertura(false)} className="max-w-sm">
        <DialogHeader onClose={() => setDialogApertura(false)}>Abrir caja del día</DialogHeader>
        <form onSubmit={hsAp(d => aperturaMut.mutate(d))}>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label>Saldo de apertura ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...regAp("saldo_apertura")} />
              <p className="text-xs text-muted-foreground">Dinero en caja al inicio del día</p>
            </div>
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Input placeholder="Observaciones de apertura…" {...regAp("notas_apertura")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogApertura(false)}>Cancelar</Button>
            <Button type="submit" disabled={aperturaMut.isPending}>
              {aperturaMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Abrir caja
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Dialog Cierre */}
      <Dialog open={dialogCierre} onClose={() => setDialogCierre(false)} className="max-w-sm">
        <DialogHeader onClose={() => setDialogCierre(false)}>Cerrar caja del día</DialogHeader>
        <form onSubmit={hsCi(d => cierreMut.mutate(d))}>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm space-y-1">
              <p>Cobros registrados: <strong className="text-emerald-600">{fmtMoney(hoy?.cobros_dia)}</strong></p>
              <p>Egresos registrados: <strong className="text-red-500">{fmtMoney(hoy?.egresos_dia)}</strong></p>
            </div>
            <div className="space-y-1">
              <Label>Efectivo contado ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...regCi("total_efectivo")} />
            </div>
            <div className="space-y-1">
              <Label>Tarjeta ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...regCi("total_tarjeta")} />
            </div>
            <div className="space-y-1">
              <Label>Transferencia ($)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...regCi("total_transferencia")} />
            </div>
            <div className="space-y-1">
              <Label>Notas de cierre (opcional)</Label>
              <Input placeholder="Observaciones…" {...regCi("notas_cierre")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogCierre(false)}>Cancelar</Button>
            <Button type="submit" disabled={cierreMut.isPending}>
              {cierreMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cerrar caja
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
