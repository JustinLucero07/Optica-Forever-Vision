import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  Box,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  FileUp,
  Home,
  Landmark,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShoppingBag,
  Stethoscope,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import SessionExpiredModal from "@/components/SessionExpiredModal"
import OnboardingTour from "@/components/OnboardingTour"
import GlobalSearch from "@/components/GlobalSearch"
import ThemeToggle from "@/components/ThemeToggle"
import { useBrandStore } from "@/store/brand"
import FloatingFAB from "@/components/FloatingFAB"

const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/turnos", label: "Turnos", icon: Calendar },
  { to: "/consultas", label: "Consultas", icon: Stethoscope },
  { to: "/ventas", label: "Ventas", icon: ShoppingBag },
  { to: "/inventario", label: "Inventario", icon: Box },
  { to: "/ordenes", label: "Órdenes Lab", icon: ClipboardList },
  { to: "/cobros", label: "Cobros / CxC", icon: Wallet },
  { to: "/creditos", label: "Créditos", icon: CreditCard },
  { to: "/cxc", label: "Cartera CxC", icon: Landmark },
  { to: "/presupuestos", label: "Presupuestos", icon: Receipt },
  { to: "/reportes", label: "Reportes", icon: FileText },
]

const NAV_ADMIN = [
  { to: "/proveedores", label: "Proveedores", icon: Truck },
  { to: "/usuarios", label: "Usuarios", icon: UserCog },
  { to: "/configuracion", label: "Configuración", icon: Settings },
  { to: "/sri-import", label: "Importar SRI XML", icon: FileUp },
]

function NavSkeleton() {
  return (
    <div className="flex-1 p-2 space-y-1 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="h-4 w-4 rounded-md bg-muted-foreground/20" />
          <div className="h-3 rounded bg-muted-foreground/20" style={{ width: `${55 + (i % 3) * 15}%` }} />
        </div>
      ))}
    </div>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuthStore()
  return (
    <>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
      {user?.role === "admin" && (
        <>
          <div className="px-3 pt-4 pb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Administración
            </p>
          </div>
          {NAV_ADMIN.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </>
      )}
    </>
  )
}

function UserBadge({ name, role }: { name?: string; role?: string }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{name}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const logo = useBrandStore((s) => s.logo)

  function handleLogout() {
    logout()
    navigate("/login")
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {logo ? (
              <img src={logo} alt="Logo" className="h-8 max-w-[100px] object-contain shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-bold">FV</span>
              </div>
            )}
            {!logo && (
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">Forever Vision</p>
                <p className="text-[10px] text-muted-foreground">Sistema de gestión</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <GlobalSearch />
      </div>

      {/* Nav */}
      {!user ? <NavSkeleton /> : (
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}

      {/* Footer */}
      <div className="border-t p-2 space-y-1">
        <UserBadge name={user?.full_name} role={user?.role} />
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive h-9"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:h-screen md:sticky md:top-0 w-64 bg-card border-r flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r flex flex-col transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-card border-b sticky top-0 z-30">
          <button
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="Logo" className="h-7 max-w-[80px] object-contain" />
            ) : (
              <>
                <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-[10px] font-bold">FV</span>
                </div>
                <p className="font-semibold text-sm">Forever Vision</p>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background relative">
          <FloatingFAB />
          {/* Blobs decorativos — necesarios para que el glass sea visible */}
          <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
            {/* Blob principal (arriba-centro) */}
            <div className="absolute top-[-12%] left-[20%] w-[750px] h-[750px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.22) 0%, transparent 62%)` }} />
            {/* Blob secundario (abajo-derecha) */}
            <div className="absolute bottom-[-12%] right-[0%] w-[650px] h-[650px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.16) 0%, transparent 62%)` }} />
            {/* Blob terciario (izquierda-medio) */}
            <div className="absolute top-[35%] left-[-8%] w-[500px] h-[500px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.12) 0%, transparent 62%)` }} />
            {/* Acento calido (abajo-izquierda) en light mode */}
            <div className="dark:hidden absolute bottom-[5%] left-[30%] w-[400px] h-[400px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(220 70% 85%/0.35) 0%, transparent 65%)` }} />
          </div>
          <Outlet />
        </main>
      </div>

      <SessionExpiredModal />
      <OnboardingTour />
    </div>
  )
}
