import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  Box,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  LogOut,
  ShoppingBag,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"

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
  { to: "/reportes", label: "Reportes", icon: FileText },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <p className="font-semibold">Forever Vision</p>
          <p className="text-xs text-muted-foreground">Sistema de gestión</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-muted/20">
        <Outlet />
      </main>
    </div>
  )
}
