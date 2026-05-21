import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, Upload, Image } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ConfigDict {
  nombre_optica?: string
  direccion_optica?: string
  telefono_optica?: string
  firma_electronica?: string
}

export default function Configuracion() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null)
  const [nombreOptica, setNombreOptica] = useState("")
  const [direccionOptica, setDireccionOptica] = useState("")
  const [telefonoOptica, setTelefonoOptica] = useState("")

  const { data: config, isLoading } = useQuery<ConfigDict>({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then((r) => r.data),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (config) {
      setNombreOptica(config.nombre_optica ?? "")
      setDireccionOptica(config.direccion_optica ?? "")
      setTelefonoOptica(config.telefono_optica ?? "")
    }
  }, [config])

  const guardarClavesMut = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put("/configuracion/nombre_optica", { valor: nombreOptica }),
        api.put("/configuracion/direccion_optica", { valor: direccionOptica }),
        api.put("/configuracion/telefono_optica", { valor: telefonoOptica }),
      ])
    },
    onSuccess: () => toast.success("Configuración guardada"),
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al guardar"),
  })

  const guardarFirmaMut = useMutation({
    mutationFn: (base64: string) =>
      api.put("/configuracion/firma_electronica", { valor: base64 }),
    onSuccess: () => {
      toast.success("Firma electrónica guardada")
      setFirmaPreview(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al guardar la firma"),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setFirmaPreview(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function handleGuardarFirma() {
    if (!firmaPreview) return
    guardarFirmaMut.mutate(firmaPreview)
  }

  const firmaActual = config?.firma_electronica

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos de la óptica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="nombre_optica">Nombre de la óptica</Label>
                <Input
                  id="nombre_optica"
                  value={nombreOptica}
                  onChange={(e) => setNombreOptica(e.target.value)}
                  placeholder="Ej: Óptica Forever Vision"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="direccion_optica">Dirección</Label>
                <Input
                  id="direccion_optica"
                  value={direccionOptica}
                  onChange={(e) => setDireccionOptica(e.target.value)}
                  placeholder="Ej: Av. Principal 123, Ciudad"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefono_optica">Teléfono</Label>
                <Input
                  id="telefono_optica"
                  value={telefonoOptica}
                  onChange={(e) => setTelefonoOptica(e.target.value)}
                  placeholder="Ej: +593 99 999 9999"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => guardarClavesMut.mutate()}
                  disabled={guardarClavesMut.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {guardarClavesMut.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Firma electrónica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {firmaActual && !firmaPreview && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Firma actual:</p>
              <div className="border rounded-md p-3 bg-muted/20 inline-block">
                <img
                  src={firmaActual}
                  alt="Firma electrónica"
                  className="max-h-32 max-w-xs object-contain"
                />
              </div>
            </div>
          )}

          {!firmaActual && !firmaPreview && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md p-4 bg-muted/10">
              <Image className="h-5 w-5 shrink-0" />
              <span>No hay firma electrónica configurada.</span>
            </div>
          )}

          {firmaPreview && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Vista previa:</p>
              <div className="border rounded-md p-3 bg-muted/20 inline-block">
                <img
                  src={firmaPreview}
                  alt="Vista previa firma"
                  className="max-h-32 max-w-xs object-contain"
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Tamaño recomendado: 400 × 150 px. Formatos aceptados: PNG, JPG, GIF, WebP.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {firmaActual ? "Cambiar imagen" : "Subir imagen"}
            </Button>

            {firmaPreview && (
              <>
                <Button
                  onClick={handleGuardarFirma}
                  disabled={guardarFirmaMut.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {guardarFirmaMut.isPending ? "Guardando…" : "Guardar firma"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setFirmaPreview(null)}
                  disabled={guardarFirmaMut.isPending}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
