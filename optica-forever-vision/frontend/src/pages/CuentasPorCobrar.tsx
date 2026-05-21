import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Loader2, AlertCircle, Phone } from "lucide-react"

import { api } from "@/lib/api"

interface BucketSummary {
  total: number
  count: number
}

interface Resumen {
  total_cxc: number
  total_vencido: number
  corriente: BucketSummary
  dias_1_30: BucketSummary
  dias_31_60: BucketSummary
  dias_61_90: BucketSummary
  mas_90: BucketSummary
}

interface Cuota {
  cuota_id: number
  credito_id: number
  credito_numero: string
  cuota_numero: number
  total_cuotas: number
  paciente_id: number
  paciente_nombre: string
  paciente_telefono: string | null
  venta_id: number
  fecha_vencimiento: string
  monto: number
  monto_pagado: number
  saldo: number
  dias_vencido: number
  estado: string
  bucket: string
}

interface AgingResponse {
  resumen: Resumen
  cuotas: Cuota[]
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}

function fmtDate(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

type BucketFilter = "" | "corriente" | "dias_1_30" | "dias_31_60" | "dias_61_90" | "mas_90"

const BUCKET_LABELS: Record<string, string> = {
  corriente: "Corriente",
  dias_1_30: "1-30 días",
  dias_31_60: "31-60 días",
  dias_61_90: "61-90 días",
  mas_90: "+90 días",
}

function estadoBadge(estado: string) {
  if (estado === "vencido")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        Vencido
      </span>
    )
  if (estado === "corriente")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        Corriente
      </span>
    )
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
      Pendiente
    </span>
  )
}

interface SummaryCardProps {
  label: string
  total: number
  count: number
  colorClass: string
  active: boolean
  onClick: () => void
}

function SummaryCard({ label, total, count, colorClass, active, onClick }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
        active ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-accent/30"
      }`}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{fmt(total)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{count} cuota{count !== 1 ? "s" : ""}</p>
    </button>
  )
}

export default function CuentasPorCobrar() {
  const navigate = useNavigate()
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("")
  const [search, setSearch] = useState("")

  const { data, isLoading, isError } = useQuery<AgingResponse>({
    queryKey: ["cxc-aging"],
    queryFn: () => api.get("/cxc/aging").then((r) => r.data),
    refetchInterval: 60_000,
  })

  const resumen = data?.resumen
  const cuotas = data?.cuotas ?? []

  const filtered = cuotas.filter((c) => {
    const matchBucket = bucketFilter === "" || c.bucket === bucketFilter
    const matchSearch =
      search.trim() === "" ||
      c.paciente_nombre.toLowerCase().includes(search.trim().toLowerCase())
    return matchBucket && matchSearch
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cartera — Cuentas por Cobrar</h1>
        <p className="text-sm text-muted-foreground">
          Análisis de antigüedad de saldos pendientes
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando cartera...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" /> Error al cargar los datos de cartera.
        </div>
      )}

      {resumen && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Cartera Total */}
            <button
              onClick={() => setBucketFilter("")}
              className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary col-span-2 sm:col-span-1 ${
                bucketFilter === "" ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:bg-accent/30"
              }`}
            >
              <p className="text-xs text-muted-foreground mb-1">Cartera Total</p>
              <p className="text-xl font-bold text-foreground">{fmt(resumen.total_cxc)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vencido: {fmt(resumen.total_vencido)}
              </p>
            </button>

            <SummaryCard
              label="Corriente (0d)"
              total={resumen.corriente.total}
              count={resumen.corriente.count}
              colorClass="text-green-600"
              active={bucketFilter === "corriente"}
              onClick={() => setBucketFilter(bucketFilter === "corriente" ? "" : "corriente")}
            />
            <SummaryCard
              label="1-30 días"
              total={resumen.dias_1_30.total}
              count={resumen.dias_1_30.count}
              colorClass="text-yellow-600"
              active={bucketFilter === "dias_1_30"}
              onClick={() => setBucketFilter(bucketFilter === "dias_1_30" ? "" : "dias_1_30")}
            />
            <SummaryCard
              label="31-60 días"
              total={resumen.dias_31_60.total}
              count={resumen.dias_31_60.count}
              colorClass="text-orange-600"
              active={bucketFilter === "dias_31_60"}
              onClick={() => setBucketFilter(bucketFilter === "dias_31_60" ? "" : "dias_31_60")}
            />
            <SummaryCard
              label="61-90 días"
              total={resumen.dias_61_90.total}
              count={resumen.dias_61_90.count}
              colorClass="text-red-400"
              active={bucketFilter === "dias_61_90"}
              onClick={() => setBucketFilter(bucketFilter === "dias_61_90" ? "" : "dias_61_90")}
            />
            <SummaryCard
              label="+90 días"
              total={resumen.mas_90.total}
              count={resumen.mas_90.count}
              colorClass="text-red-700"
              active={bucketFilter === "mas_90"}
              onClick={() => setBucketFilter(bucketFilter === "mas_90" ? "" : "mas_90")}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value as BucketFilter)}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas las cuotas</option>
              <option value="corriente">Corriente</option>
              <option value="dias_1_30">1-30 días</option>
              <option value="dias_31_60">31-60 días</option>
              <option value="dias_61_90">61-90 días</option>
              <option value="mas_90">+90 días</option>
            </select>

            <input
              type="text"
              placeholder="Buscar por paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary flex-1 max-w-xs"
            />

            {(bucketFilter !== "" || search !== "") && (
              <button
                onClick={() => { setBucketFilter(""); setSearch("") }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Crédito</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Cuota N°</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimiento</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Días vencido</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Saldo</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No hay cuotas pendientes
                    </td>
                  </tr>
                )}
                {filtered.map((cuota) => {
                  const isOverdue = cuota.dias_vencido > 0
                  return (
                    <tr
                      key={cuota.cuota_id}
                      className={`border-b last:border-0 transition-colors ${
                        isOverdue ? "bg-red-50 hover:bg-red-100/70" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{cuota.paciente_nombre}</p>
                        {cuota.paciente_telefono && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" />
                            {cuota.paciente_telefono}
                          </p>
                        )}
                        {cuota.bucket && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {BUCKET_LABELS[cuota.bucket] ?? cuota.bucket}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {cuota.credito_numero}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cuota.cuota_numero}/{cuota.total_cuotas}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fmtDate(cuota.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        {isOverdue ? (
                          <span className="text-red-600">{cuota.dias_vencido}d</span>
                        ) : (
                          <span className="text-green-600">
                            {cuota.dias_vencido === 0 ? "Hoy" : `${Math.abs(cuota.dias_vencido)}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {fmt(cuota.saldo)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {estadoBadge(cuota.estado)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate("/creditos")}
                          className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          Pagar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground text-right">
            Mostrando {filtered.length} de {cuotas.length} cuotas pendientes
          </p>
        </>
      )}
    </div>
  )
}
