import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Plus, Calendar, Stethoscope, Loader2, MessageCircle } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"
import { abrirWhatsApp, msgRecordatorio, enviarCumpleanios } from "@/lib/whatsapp"

function campo(label: string, valor: string | null | undefined) {
  if (!valor) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{valor}</p>
    </div>
  )
}

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{nombreCompleto}</h1>
          <Badge variant="outline" className="mt-0.5">{paciente.numero}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {campo("Cédula", paciente.cedula)}
          {campo("Fecha de nacimiento", paciente.fecha_nacimiento)}
          {campo("Género", paciente.genero)}
          {campo("Ocupación", paciente.ocupacion)}
          {campo("Teléfono", paciente.telefono)}
          {campo("Teléfono 2", paciente.telefono_2)}
          {campo("Email", paciente.email)}
          {campo("Dirección", paciente.direccion)}
          {campo("Origen / Cómo nos conoció", paciente.origen)}
          {campo("Referido por", paciente.referido_por)}
        </CardContent>
      </Card>

      {paciente.telefono && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => abrirWhatsApp(paciente.telefono, msgRecordatorio(paciente.nombres))}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Recordatorio control visual
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => enviarCumpleanios(paciente.telefono, paciente.nombres)}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Oferta de cumpleaños 🎂
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Consultas
          </h2>
          {(rol === "admin" || rol === "optometrista") && (
            <Button size="sm" asChild>
              <Link to={`/pacientes/${id}/consultas/nueva`}>
                <Plus className="h-4 w-4 mr-1" /> Nueva Consulta
              </Link>
            </Button>
          )}
        </div>

        {cargandoCons && (
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando consultas…
          </div>
        )}

        {!cargandoCons && consultas.length === 0 && (
          <p className="text-muted-foreground text-sm py-4">Este paciente no tiene consultas aún.</p>
        )}

        <div className="space-y-2">
          {consultas.map((c: any) => (
            <Link key={c.id} to={`/consultas/${c.id}`} className="block">
              <div className="rounded-md border p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{c.fecha} — <Badge variant="outline">{c.numero}</Badge></p>
                      {c.motivo_consulta && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.motivo_consulta}</p>
                      )}
                    </div>
                  </div>
                  {c.diagnostico && (
                    <p className="text-xs text-muted-foreground hidden md:block max-w-xs line-clamp-1">{c.diagnostico}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
