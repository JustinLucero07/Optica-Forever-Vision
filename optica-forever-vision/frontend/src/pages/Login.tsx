import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Eye, EyeOff, Mail, Lock, AlertCircle,
  Loader2, Shield, CheckCircle2,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { useBrandStore } from "@/store/brand"

const MAX_ATTEMPTS = 5

// ── Features que se muestran en el panel izquierdo ────────────────────────────
const FEATURES = [
  "Historial clínico completo",
  "Inventario en tiempo real",
  "Créditos y cartera",
  "Reportes con gráficas",
  "WhatsApp integrado",
]

// ── Genera una versión más oscura/clara del hex para el gradiente ─────────────
function hexVariant(hex: string, alpha: string) {
  return hex + alpha
}

export default function LoginPage() {
  const navigate   = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const { logo, primaryHex } = useBrandStore()

  const [email,      setEmail]      = useState("")
  const [password,   setPassword]   = useState("")
  const [showPwd,    setShowPwd]    = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading,    setLoading]    = useState(false)
  const [attempts,   setAttempts]   = useState(0)
  const [capsLock,   setCapsLock]   = useState(false)

  // Detectar Bloq Mayús
  useEffect(() => {
    const h = (e: KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"))
    window.addEventListener("keydown", h)
    window.addEventListener("keyup",   h)
    return () => { window.removeEventListener("keydown", h); window.removeEventListener("keyup", h) }
  }, [])

  const blocked = attempts >= MAX_ATTEMPTS

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (blocked || loading) return
    setLoading(true)
    try {
      const { data } = await api.post("/auth/login", { email, password })
      setSession(data.access_token, data.user, rememberMe)
      toast.success(`¡Bienvenido, ${data.user.full_name}!`)
      navigate("/")
    } catch (err: unknown) {
      const ex = err as { response?: { status?: number; data?: { detail?: string } } }
      const n = attempts + 1
      setAttempts(n)
      if (!ex.response) toast.error("Sin conexión con el servidor")
      else if (ex.response.status === 429) toast.error("Demasiados intentos. Espera 15 minutos.")
      else if (n >= MAX_ATTEMPTS) toast.error("Acceso bloqueado. Recarga la página.")
      else toast.error(ex.response.data?.detail ?? "Credenciales incorrectas")
    } finally {
      setLoading(false)
    }
  }

  // Gradiente animado usando el color de marca
  const bgStyle = {
    background: `linear-gradient(-45deg,
      ${hexVariant(primaryHex, "ff")},
      ${hexVariant(primaryHex, "cc")},
      ${hexVariant(primaryHex, "88")},
      ${hexVariant(primaryHex, "bb")})`,
    backgroundSize: "400% 400%",
    animation: "gradientMove 14s ease infinite",
  }

  return (
    <div className="min-h-screen flex">

      {/* ══ Panel izquierdo animado (desktop) ══════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden flex-col" style={bgStyle}>

        {/* Blobs flotantes */}
        <div
          className="login-blob-1 absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.12)", filter: "blur(70px)" }}
        />
        <div
          className="login-blob-2 absolute -bottom-32 -right-20 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.1)", filter: "blur(80px)" }}
        />
        <div
          className="login-blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.07)", filter: "blur(60px)" }}
        />

        {/* Patrón de puntos sutil */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Contenido */}
        <div className="relative z-10 flex flex-col justify-between h-full p-12">

          {/* Logo */}
          <div className="anim-pop-in flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-lg tracking-tight">FV</span>
              </div>
            )}
            <div>
              <p className="text-white font-bold text-xl leading-tight">Forever Vision</p>
              <p className="text-white/70 text-xs tracking-wide">Sistema de gestión óptica</p>
            </div>
          </div>

          {/* Tagline central */}
          <div className="space-y-7">
            <div className="space-y-4 anim-fade-up delay-100">
              <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
                Tu óptica,<br />
                <span className="text-white/80">siempre</span><br />
                bajo control.
              </h2>
              <p className="text-white/65 text-base leading-relaxed max-w-sm">
                Gestiona pacientes, inventario, ventas y reportes desde una sola plataforma profesional.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2.5 anim-fade-up delay-200">
              {FEATURES.map((f, i) => (
                <div
                  key={f}
                  className="flex items-center gap-3 anim-fade-up"
                  style={{ animationDelay: `${250 + i * 70}ms` }}
                >
                  <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-white/80 text-sm">{f}</span>
                </div>
              ))}
            </div>

            {/* Badge seguridad */}
            <div className="flex items-center gap-2 anim-fade-up delay-500">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <Shield className="h-3.5 w-3.5 text-white/70" />
                <span className="text-white/70 text-xs">JWT · Rate limiting · Sesiones seguras</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-white/35 text-xs anim-fade-in delay-600">
            © {new Date().getFullYear()} Óptica Forever Vision · Cuenca, Ecuador
          </p>
        </div>
      </div>

      {/* ══ Panel derecho — Formulario ═════════════════════════════════════════ */}
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden bg-background">

        {/* Blur decorativo en esquinas (desktop, solo panel derecho) */}
        <div
          className="hidden lg:block absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none opacity-10"
          style={{ background: primaryHex, filter: "blur(80px)" }}
        />
        <div
          className="hidden lg:block absolute -bottom-20 -left-20 w-48 h-48 rounded-full pointer-events-none opacity-10"
          style={{ background: primaryHex, filter: "blur(60px)" }}
        />

        {/* Fondo móvil animado */}
        <div className="lg:hidden absolute inset-0 -z-10 opacity-10" style={bgStyle} />

        <div className="relative z-10 w-full max-w-[420px]">

          {/* ── Logo (mobile) ── */}
          <div className="lg:hidden text-center mb-8 anim-pop-in">
            {logo ? (
              <img src={logo} alt="Logo" className="h-14 mx-auto object-contain mb-3" />
            ) : (
              <div className="mx-auto h-16 w-16 rounded-3xl flex items-center justify-center mb-3 shadow-xl"
                   style={{ background: primaryHex }}>
                <span className="text-white font-black text-2xl">FV</span>
              </div>
            )}
            <p className="font-bold text-2xl">Forever Vision</p>
            <p className="text-muted-foreground text-sm mt-1">Sistema de gestión óptica</p>
          </div>

          {/* ── Card principal ── */}
          <div className="anim-scale-in">
            {/* Franja de color en el tope */}
            <div className="h-1 rounded-t-3xl" style={{ background: `linear-gradient(90deg, ${primaryHex}, ${primaryHex}66)` }} />

            <div className="bg-card border border-t-0 rounded-b-3xl shadow-2xl p-8 space-y-7">

              {/* Título */}
              <div className="anim-fade-up delay-100">
                <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
                <p className="text-muted-foreground text-sm mt-1">Ingresa tus credenciales para continuar</p>
              </div>

              {/* Alerta intentos */}
              {attempts >= 3 && (
                <div className="bg-destructive/10 border border-destructive/25 rounded-2xl p-4 flex items-start gap-3 anim-scale-in">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      {blocked ? "Acceso bloqueado" : "Credenciales incorrectas"}
                    </p>
                    <p className="text-xs text-destructive/70 mt-0.5">
                      {blocked
                        ? "Has superado el límite de intentos. Recarga la página."
                        : `${MAX_ATTEMPTS - attempts} intento${MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} restante${MAX_ATTEMPTS - attempts !== 1 ? "s" : ""}.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                {/* Email */}
                <div className="space-y-1.5 anim-fade-up delay-150">
                  <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={blocked}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl transition-shadow focus:shadow-md"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5 anim-fade-up delay-250">
                  <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      disabled={blocked}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-12 h-12 rounded-xl transition-shadow focus:shadow-md"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
                      aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {capsLock && (
                    <p className="text-xs text-amber-500 flex items-center gap-1.5 anim-fade-in">
                      <AlertCircle className="h-3 w-3" /> Bloq Mayús activado
                    </p>
                  )}
                </div>

                {/* Recordar sesión */}
                <div className="flex items-center gap-2.5 anim-fade-up delay-300">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded-md border-border cursor-pointer accent-primary"
                  />
                  <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                    Recordar sesión en este dispositivo
                  </Label>
                </div>

                {/* Botón */}
                <div className="anim-fade-up delay-400">
                  <button
                    type="submit"
                    disabled={loading || blocked}
                    className="btn-shimmer w-full h-12 rounded-xl font-semibold text-base text-white transition-all duration-200 hover:opacity-90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    style={{ background: loading || blocked ? undefined : primaryHex }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
                      </span>
                    ) : blocked ? "Acceso bloqueado" : "Ingresar al sistema"}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <p className="text-center text-xs text-muted-foreground/60 anim-fade-in delay-600">
                © {new Date().getFullYear()} Óptica Forever Vision · Cuenca, Ecuador
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
