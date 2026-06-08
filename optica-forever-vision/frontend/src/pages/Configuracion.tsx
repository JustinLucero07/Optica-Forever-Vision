import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, Upload, Image, Palette, Trash2, Bell, Mail, Phone, MessageCircle } from "lucide-react"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBrandStore, COLOR_PRESETS, type WaMode } from "@/store/brand"

interface ConfigDict {
  nombre_optica?: string
  direccion_optica?: string
  telefono_optica?: string
  firma_electronica?: string
  email_admin?: string
  admin_phone?: string
  wa_mode?: WaMode
  wa_token?: string
  wa_phone_id?: string
  wa_business_id?: string
}

export default function Configuracion() {
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const logoInputRef   = useRef<HTMLInputElement>(null)
  const [firmaPreview, setFirmaPreview] = useState<string | null>(null)
  const qc = useQueryClient()
  const { logo, primaryHsl, setPrimary, setLogo, setWaMode } = useBrandStore()
  const [nombreOptica, setNombreOptica]     = useState("")
  const [direccionOptica, setDireccionOptica] = useState("")
  const [telefonoOptica, setTelefonoOptica] = useState("")
  const [emailAdmin, setEmailAdmin]         = useState("")
  const [adminPhone, setAdminPhone]         = useState("")
  const [waModeLocal, setWaModeLocal]       = useState<WaMode>("wame")
  const [waToken, setWaToken]               = useState("")
  const [waPhoneId, setWaPhoneId]           = useState("")
  const [waBizId, setWaBizId]               = useState("")

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
      setEmailAdmin(config.email_admin ?? "")
      setAdminPhone(config.admin_phone ?? "")
      const mode = (config.wa_mode as WaMode) ?? "wame"
      setWaModeLocal(mode)
      setWaMode(mode)
      setWaToken(config.wa_token ?? "")
      setWaPhoneId(config.wa_phone_id ?? "")
      setWaBizId(config.wa_business_id ?? "")
    }
  }, [config])

  const guardarClavesMut = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put("/configuracion/nombre_optica",    { valor: nombreOptica }),
        api.put("/configuracion/direccion_optica", { valor: direccionOptica }),
        api.put("/configuracion/telefono_optica",  { valor: telefonoOptica }),
      ])
    },
    onSuccess: () => toast.success("Configuración guardada"),
    onError: (e) => toast.error(errMsg(e, "Error al guardar")),
  })

  const guardarNotifMut = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put("/configuracion/email_admin", { valor: emailAdmin }),
        api.put("/configuracion/admin_phone", { valor: adminPhone }),
      ])
    },
    onSuccess: () => toast.success("Notificaciones guardadas"),
    onError: (e) => toast.error(errMsg(e, "Error al guardar")),
  })

  const guardarWaMut = useMutation({
    mutationFn: (mode: WaMode) =>
      api.put("/configuracion/wa_mode", { valor: mode }),
    onSuccess: (_data, mode) => {
      setWaMode(mode)
      toast.success(mode === "wame" ? "Modo wa.me activado" : "Modo Cloud API activado")
    },
    onError: (e) => toast.error(errMsg(e, "Error al guardar")),
  })

  const guardarWaCredsMut = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.put("/configuracion/wa_token",       { valor: waToken }),
        api.put("/configuracion/wa_phone_id",    { valor: waPhoneId }),
        api.put("/configuracion/wa_business_id", { valor: waBizId }),
      ])
    },
    onSuccess: () => toast.success("Credenciales Cloud API guardadas"),
    onError: (e) => toast.error(errMsg(e, "Error al guardar credenciales")),
  })

  const guardarFirmaMut = useMutation({
    mutationFn: (base64: string) =>
      api.put("/configuracion/firma_electronica", { valor: base64 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["configuracion"] })
      toast.success("Firma electrónica guardada")
      setFirmaPreview(null)
    },
    onError: (e) => toast.error(errMsg(e, "Error al guardar la firma")),
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

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>

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
      {/* ── Notificaciones automáticas ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Notificaciones automáticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            El sistema envía automáticamente alertas de stock bajo y un resumen semanal
            al teléfono WhatsApp del administrador, y un reporte mensual al email indicado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email_admin" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email para reportes mensuales
              </Label>
              <Input
                id="email_admin"
                type="email"
                placeholder="admin@tudominio.com"
                value={emailAdmin}
                onChange={e => setEmailAdmin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Recibe el reporte el día 1 de cada mes.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin_phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> WhatsApp del administrador
              </Label>
              <Input
                id="admin_phone"
                type="tel"
                placeholder="+593999999999"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Formato internacional. Recibe alertas de stock y resumen semanal.</p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1">Automatizaciones activas:</p>
            <p>⏰ <strong>09:30 diario</strong> — Alerta de stock bajo (si hay productos bajo mínimo)</p>
            <p>📅 <strong>Lunes 08:00</strong> — Resumen semanal de ventas y cobros</p>
            <p>📧 <strong>Día 1 del mes, 09:00</strong> — Reporte mensual por email</p>
            <p>✅ <strong>Al pagar cuota</strong> — Comprobante de pago WhatsApp al paciente</p>
            <p>👓 <strong>Al marcar orden "lista"</strong> — Notificación WhatsApp al paciente</p>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={() => guardarNotifMut.mutate()} disabled={guardarNotifMut.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {guardarNotifMut.isPending ? "Guardando…" : "Guardar notificaciones"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── WhatsApp ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige cómo se envían los mensajes de WhatsApp desde los botones del sistema.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opción wa.me */}
            <button
              type="button"
              onClick={() => {
                setWaModeLocal("wame")
                guardarWaMut.mutate("wame")
              }}
              className={[
                "flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all",
                waModeLocal === "wame"
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                  : "border-border hover:border-green-300",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600 shrink-0" />
                <span className="font-semibold text-sm">Manual (wa.me)</span>
                {waModeLocal === "wame" && (
                  <span className="ml-auto rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Prepara el mensaje y abre WhatsApp Web / app. Tú revisas y pulsas <strong>Enviar</strong> desde tu celular.
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 font-medium mt-1">
                No requiere configuración adicional
              </p>
            </button>

            {/* Opción Cloud API */}
            <button
              type="button"
              onClick={() => {
                setWaModeLocal("cloud_api")
                guardarWaMut.mutate("cloud_api")
              }}
              className={[
                "flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all",
                waModeLocal === "cloud_api"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : "border-border hover:border-blue-300",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600 shrink-0" />
                <span className="font-semibold text-sm">Automático (Cloud API)</span>
                {waModeLocal === "cloud_api" && (
                  <span className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Envía directamente via WhatsApp Business Cloud API. El mensaje sale solo, sin abrir ninguna app.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mt-1">
                Requiere WA_TOKEN, WA_PHONE_ID y plantillas aprobadas en Meta
              </p>
            </button>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Nota sobre los envíos automáticos (crons):</p>
            <p>Los recordatorios automáticos de cuotas, cumpleaños, control visual, etc. siempre usan
            Cloud API independientemente de esta configuración, ya que se ejecutan en el servidor.</p>
          </div>

          {waModeLocal === "cloud_api" && (
            <div className="border rounded-xl p-4 space-y-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Credenciales Cloud API (Meta / WhatsApp Business)
              </p>
              <div className="space-y-2">
                <Label htmlFor="wa_token" className="text-sm">WA_TOKEN (Access Token)</Label>
                <Input id="wa_token" type="password" placeholder="EAAxxxxxxxx…"
                  value={waToken} onChange={e => setWaToken(e.target.value)} />
                <p className="text-xs text-muted-foreground">Token de acceso permanente desde Meta for Developers</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa_phone_id" className="text-sm">WA_PHONE_ID (Phone Number ID)</Label>
                <Input id="wa_phone_id" placeholder="1234567890123"
                  value={waPhoneId} onChange={e => setWaPhoneId(e.target.value)} />
                <p className="text-xs text-muted-foreground">ID del número de teléfono en Meta Business Suite</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa_biz_id" className="text-sm">WA_BUSINESS_ID (Business Account ID)</Label>
                <Input id="wa_biz_id" placeholder="9876543210"
                  value={waBizId} onChange={e => setWaBizId(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => guardarWaCredsMut.mutate()} disabled={guardarWaCredsMut.isPending}>
                {guardarWaCredsMut.isPending ? "Guardando…" : "Guardar credenciales"}
              </Button>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">¿Cómo obtenerlas?</p>
                <p>1. Ir a developers.facebook.com → Tu app → WhatsApp → Configuración de API</p>
                <p>2. Copiar el "Token de acceso temporal" (o crear uno permanente)</p>
                <p>3. Copiar el "ID de número de teléfono" del número registrado</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Apariencia ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Apariencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Logo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Logo de la óptica</Label>
            <div className="flex items-start gap-4">
              <div className="h-16 w-32 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Image className="h-6 w-6 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {logo ? "Cambiar logo" : "Subir logo"}
                </Button>
                {logo && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setLogo(null)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG o SVG transparente recomendado.</p>
              </div>
            </div>
          </div>

          {/* Color principal */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Color principal del sistema</Label>
            <div className="flex flex-wrap gap-3">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.name}
                  title={c.name}
                  onClick={() => {
                    setPrimary(c.hsl, c.hex)
                    toast.success(`Color cambiado a ${c.name}`)
                  }}
                  className={[
                    "h-10 w-10 rounded-xl transition-all duration-150 hover:scale-110",
                    "border-2 shadow-sm",
                    primaryHsl === c.hsl
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent",
                  ].join(" ")}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El color se aplica al sidebar, botones y elementos destacados. Se guarda automáticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
