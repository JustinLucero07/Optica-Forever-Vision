import { useNavigate } from "react-router-dom"
import { LogIn, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth"

export default function SessionExpiredModal() {
  const { sessionExpired, clearExpired } = useAuthStore()
  const navigate = useNavigate()

  if (!sessionExpired) return null

  function handleRelogin() {
    clearExpired()
    navigate("/login")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="h-7 w-7 text-amber-600" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Sesión expirada</h2>
          <p className="text-sm text-muted-foreground">
            Tu sesión ha expirado por inactividad. Inicia sesión de nuevo para continuar.
          </p>
        </div>
        <Button className="w-full" onClick={handleRelogin}>
          <LogIn className="h-4 w-4 mr-2" />
          Volver a ingresar
        </Button>
      </div>
    </div>
  )
}
