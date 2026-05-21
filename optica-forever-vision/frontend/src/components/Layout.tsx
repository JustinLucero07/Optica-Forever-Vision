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
import GlobalSearch from "@/components/GlobalSearch"

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
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="h-4 w-4 rounded bg-muted-foreground/20" />
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
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
      {user?.role === "admin" && (
        <>
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Administración</p>
          </div>
          {NAV_ADMIN.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
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

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate("/login")
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Forever Vision</p>
            <p className="text-xs text-muted-foreground">Sistema de gestión</p>
          </div>
          {/* Close button mobile */}
          <button
            className="md:hidden p-1 rounded hover:bg-accent"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <GlobalSearch />
      </div>
      {!user ? <NavSkeleton /> : (
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}
      <div className="p-2 border-t">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Salir
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-card border-b sticky top-0 z-30">
          <button
            className="p-1.5 rounded hover:bg-accent"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-semibold text-sm">Forever Vision</p>
          <div className="ml-auto">
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/20">
          <Outlet />
        </main>
      </div>

      <SessionExpiredModal />
    </div>
  )
}
