import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Eye, XCircle, Loader2 } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth"

interface Venta { id: number; numero: string; paciente_id: number | null; paciente_nombre: string | null; fecha: string; total: number; estado: string }

function EstadoBadge({ estado }: { estado: string }) {
  const v = { pendiente: "secondary", anulado: "destructive", cobrado: "default" } as const
  return <Badge variant={v[estado as keyof typeof v] ?? "outline"}>{estado}</Badge>
}

export default function Ventas() {
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [anulando, setAnulando] = useState<Venta | null>(null)
  const qc = useQueryClient()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: ventas = [], isLoading } = useQuery<Venta[]>({
    queryKey: ["ventas", desde, hasta],
    queryFn: () => api.get("/ventas", { params: { desde: desde || undefined, hasta: hasta || undefined } }).then(r => r.data),
    staleTime: 10_000,
  })

  const anularMut = useMutation({
    mutationFn: (id: number) => api.post(`/ventas/${id}/anular`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ventas"] }); setAnulando(null); toast.success("Venta anulada") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error"),
  })

  const total = ventas.filter(v => v.estado !== "anulado").reduce((s, v) => s + v.total, 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ventas</h1>
        {(rol === "admin" || rol === "vendedor") && (
          <Button asChild><Link to="/ventas/nueva"><Plus className="h-4 w-4 mr-2" /> Nueva Venta</Link></Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Desde</span>
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Hasta</span>
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="h-9 w-40" />
        </div>
        {(desde || hasta) && (
          <Button variant="ghost" size="sm" onClick={() => { setDesde(""); setHasta("") }}>Limpiar</Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          Total período: <strong className="text-foreground">${total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Número</th>
              <th className="text-left px-4 py-3 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 font-medium">Paciente</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {!isLoading && ventas.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No hay ventas en el período</td></tr>
            )}
            {ventas.map(v => (
              <tr key={v.id} className={`hover:bg-muted/30 transition-colors ${v.estado === "anulado" ? "opacity-50" : ""}`}>
                <td className="px-4 py-3"><Badge variant="outline">{v.numero}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{v.fecha}</td>
                <td className="px-4 py-3 text-muted-foreground">{v.paciente_nombre ?? (v.paciente_id ? `Pac. #${v.paciente_id}` : "Consumidor final")}</td>
                <td className="px-4 py-3 text-right font-semibold">${Number(v.total).toFixed(2)}</td>
                <td className="px-4 py-3"><EstadoBadge estado={v.estado} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/ventas/${v.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {rol === "admin" && v.estado !== "anulado" && (
                      <Button variant="ghost" size="sm" onClick={() => setAnulando(v)} className="text-destructive hover:text-destructive">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!anulando} onClose={() => setAnulando(null)} className="max-w-md">
        <DialogHeader onClose={() => setAnulando(null)}>Anular Venta</DialogHeader>
        <DialogBody>
          <p>¿Anular la venta <strong>{anulando?.numero}</strong> por <strong>${Number(anulando?.total ?? 0).toFixed(2)}</strong>?</p>
          <p className="text-sm text-muted-foreground mt-1">El stock de los productos se restaurará automáticamente.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAnulando(null)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => anularMut.mutate(anulando!.id)} disabled={anularMut.isPending}>
            {anularMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Anular
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
