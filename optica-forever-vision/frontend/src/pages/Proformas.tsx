import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileX, ShoppingCart, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente", enviado: "Enviado", en_proceso: "En proceso",
  listo: "Listo", entregado: "Entregado", rechazado: "Rechazado",
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-600",
  enviado: "bg-blue-100 text-blue-700",
  en_proceso: "bg-indigo-100 text-indigo-700",
  listo: "bg-green-100 text-green-700",
  entregado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-600",
}

export default function Proformas() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<"todas" | "proforma" | "pendiente">("todas")

  const { data: ordenes = [], isLoading } = useQuery<any[]>({
    queryKey: ["proformas-ordenes"],
    queryFn: () => api.get("/ordenes", { params: { limit: 500 } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).filter((o: any) => !o.venta_id && o.estado !== "rechazado")
    ),
    staleTime: 30_000,
  })

  const { data: pacientes = [] } = useQuery<{ id: number; nombres: string; apellidos: string }[]>({
    queryKey: ["pacientes-mini"],
    queryFn: () => api.get("/pacientes", { params: { limit: 2000 } }).then(r => r.data.items ?? r.data),
    staleTime: 300_000,
  })
  const pacNombre = (id: number) => {
    const p = pacientes.find(p => p.id === id)
    return p ? `${p.apellidos} ${p.nombres}` : `#${id}`
  }

  function facturarOrden(o: any) {
    if (!o.precio_venta || Number(o.precio_venta) <= 0) {
      toast.error("Ingresa el precio de venta en la orden antes de facturar")
      return
    }
    navigate("/ventas/nueva", { state: { orden: o, paciente_id: o.paciente_id } })
  }

  const proformasMut = useMutation({
    mutationFn: ({ id, es_proforma }: { id: number; es_proforma: boolean }) =>
      api.put(`/ordenes/${id}`, { es_proforma }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proformas-ordenes"] })
      toast.success("Orden actualizada")
    },
    onError: () => toast.error("Error al actualizar"),
  })

  const filtradas = ordenes.filter(o => {
    if (filtro === "proforma") return o.es_proforma
    if (filtro === "pendiente") return !o.es_proforma
    return true
  })

  const totalProformas = ordenes.filter(o => o.es_proforma)
  const totalPendientes = ordenes.filter(o => !o.es_proforma)
  const montoProforma = totalProformas.reduce((s, o) => s + (Number(o.precio_venta) || 0), 0)
  const montoPendiente = totalPendientes.reduce((s, o) => s + (Number(o.precio_venta) || 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileX className="h-6 w-6 text-orange-500" />
          Órdenes sin Facturar
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Órdenes de laboratorio que aún no tienen venta asociada
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`rounded-2xl p-4 text-center cursor-pointer border-2 transition-all ${filtro === "todas" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"}`}
          onClick={() => setFiltro("todas")}
        >
          <p className="text-xs text-muted-foreground">Total sin facturar</p>
          <p className="text-2xl font-bold tabular-nums">{ordenes.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">órdenes</p>
        </div>
        <div
          className={`rounded-2xl p-4 text-center cursor-pointer border-2 transition-all ${filtro === "proforma" ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20" : "border-border bg-card hover:bg-muted/40"}`}
          onClick={() => setFiltro("proforma")}
        >
          <p className="text-xs text-muted-foreground">Proformas</p>
          <p className="text-2xl font-bold text-orange-500 tabular-nums">{totalProformas.length}</p>
          <p className="text-xs text-orange-500/80 font-medium mt-0.5">${montoProforma.toFixed(2)}</p>
        </div>
        <div
          className={`rounded-2xl p-4 text-center cursor-pointer border-2 transition-all ${filtro === "pendiente" ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : "border-border bg-card hover:bg-muted/40"}`}
          onClick={() => setFiltro("pendiente")}
        >
          <p className="text-xs text-muted-foreground">Pendientes de facturar</p>
          <p className="text-2xl font-bold text-blue-500 tabular-nums">{totalPendientes.length}</p>
          <p className="text-xs text-blue-500/80 font-medium mt-0.5">${montoPendiente.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-400 opacity-60" />
            <p className="font-medium">¡Todo facturado!</p>
            <p className="text-sm">No hay órdenes pendientes en esta categoría</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">N°</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paciente</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Envío</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">P. Venta</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo orden</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono font-medium">{o.numero}</td>
                  <td className="px-4 py-2.5">{pacNombre(o.paciente_id)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{o.tipo}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(o.fecha_envio)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[o.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {ESTADO_LABEL[o.estado] ?? o.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {o.precio_venta && Number(o.precio_venta) > 0
                      ? `$${Number(o.precio_venta).toFixed(2)}`
                      : <span className="flex items-center justify-end gap-1 text-amber-500 font-normal text-xs"><AlertCircle className="h-3.5 w-3.5" /> Sin precio</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    {o.es_proforma ? (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-medium">Proforma</span>
                    ) : (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      {o.es_proforma ? (
                        <Button
                          variant="ghost" size="sm" className="text-xs text-blue-600"
                          onClick={() => proformasMut.mutate({ id: o.id, es_proforma: false })}
                        >
                          Quitar proforma
                        </Button>
                      ) : (
                        <Button
                          variant="ghost" size="sm" className="text-xs text-orange-600"
                          onClick={() => proformasMut.mutate({ id: o.id, es_proforma: true })}
                        >
                          Marcar proforma
                        </Button>
                      )}
                      {!o.es_proforma && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold"
                          onClick={() => facturarOrden(o)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Facturar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
