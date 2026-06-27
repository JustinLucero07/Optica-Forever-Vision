import { useState, useEffect, useRef } from "react"
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom"
import {
  Banknote, Box, Calendar,
  ClipboardList, CreditCard, FileText, FileUp, FileX,
  Home, Landmark, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Receipt, Settings,
  ShoppingBag, Stethoscope, Truck, UserCog, Users,
  Wallet, X,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import SessionExpiredModal from "@/components/SessionExpiredModal"
import OnboardingTour from "@/components/OnboardingTour"
import GlobalSearch from "@/components/GlobalSearch"
import Notifications from "@/components/Notifications"
import ThemeToggle from "@/components/ThemeToggle"
import { useBrandStore } from "@/store/brand"
import FloatingFAB from "@/components/FloatingFAB"

const NAV = [
  { to: "/", label: "Dashboard", icon: Home, badge: null as keyof NavBadges | null },
  { to: "/pacientes", label: "Pacientes", icon: Users, badge: null },
  { to: "/turnos", label: "Turnos", icon: Calendar, badge: "turnosHoy" as keyof NavBadges },
  { to: "/consultas", label: "Consultas", icon: Stethoscope, badge: null },
  { to: "/ventas", label: "Ventas", icon: ShoppingBag, badge: null },
  { to: "/proformas", label: "Sin facturar", icon: FileX, badge: "proformas" as keyof NavBadges },
  { to: "/inventario", label: "Inventario", icon: Box, badge: null },
  { to: "/ordenes", label: "Órdenes Lab", icon: ClipboardList, badge: "ordenesPendientes" as keyof NavBadges },
  { to: "/caja", label: "Caja Diaria", icon: Banknote, badge: null },
  { to: "/cobros", label: "Cobros / CxC", icon: Wallet, badge: null },
  { to: "/creditos", label: "Créditos", icon: CreditCard, badge: null },
  { to: "/cxc", label: "Cartera CxC", icon: Landmark, badge: null },
  { to: "/presupuestos", label: "Presupuestos", icon: Receipt, badge: null },
  { to: "/reportes", label: "Reportes", icon: FileText, badge: null },
]

const NAV_ADMIN = [
  { to: "/sueldos", label: "Sueldos", icon: Banknote, badge: null as keyof NavBadges | null },
  { to: "/proveedores", label: "Proveedores", icon: Truck, badge: null },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, badge: null },
  { to: "/configuracion", label: "Configuración", icon: Settings, badge: null },
  { to: "/sri-import", label: "Importar SRI XML", icon: FileUp, badge: null },
]

interface NavBadges {
  turnosHoy: number
  ordenesPendientes: number
  proformas: number
}

function NavBadgePill({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white/25 text-white text-[10px] font-bold px-1">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function NavSkeleton() {
  return (
    <div className="flex-1 p-2 space-y-1 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="h-4 w-4 rounded-md bg-white/20" />
          <div className="h-3 rounded bg-white/20" style={{ width: `${55 + (i % 3) * 15}%` }} />
        </div>
      ))}
    </div>
  )
}

function NavLinks({
  onNavigate, collapsed, badges,
}: {
  onNavigate?: () => void
  collapsed: boolean
  badges: NavBadges
}) {
  const { user } = useAuthStore()
  return (
    <>
      {NAV.map(({ to, label, icon: Icon, badge }) => {
        const count = badge ? badges[badge] : 0
        return (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                isActive
                  ? "bg-white/20 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <>{label}<NavBadgePill count={count} /></>}
            {collapsed && count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/80 text-[8px] font-bold text-primary" />
            )}
          </NavLink>
        )
      })}
      {user?.role === "admin" && (
        <>
          <div className={cn("pt-4 pb-1", collapsed ? "px-1" : "px-3")}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                Administración
              </p>
            )}
            {collapsed && <div className="border-t border-white/15" />}
          </div>
          {NAV_ADMIN.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-white/20 text-white shadow-sm backdrop-blur-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </>
      )}
    </>
  )
}

function UserBadge({ name, role, collapsed }: { name?: string; role?: string; collapsed: boolean }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?"
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center px-1")}>
      <div className="h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate leading-tight text-white">{name}</p>
          <p className="text-xs text-white/60 capitalize">{role}</p>
        </div>
      )}
    </div>
  )
}

// ── Page fade transition ────────────────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)
  const prev = useRef(location.pathname)

  useEffect(() => {
    if (prev.current !== location.pathname) {
      setVisible(false)
      const t = setTimeout(() => { setVisible(true); prev.current = location.pathname }, 60)
      return () => clearTimeout(t)
    }
  }, [location.pathname])

  return (
    <div
      className="transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const logo = useBrandStore((s) => s.logo)
  const primaryHex = useBrandStore((s) => s.primaryHex)

  // ── Nav badges ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: turnosBadge } = useQuery<{ total: number }>({
    queryKey: ["nav-badge-turnos", today],
    queryFn: () => api.get("/turnos/count", { params: { fecha: today, estado: "pendiente" } }).then(r => r.data).catch(() => ({ total: 0 })),
    staleTime: 60_000,
    retry: false,
  })
  const { data: ordenesBadge } = useQuery<{ total: number }>({
    queryKey: ["nav-badge-ordenes"],
    queryFn: () => api.get("/ordenes/count", { params: { excluir_estados: "entregado,cancelado,rechazado" } }).then(r => r.data).catch(() => ({ total: 0 })),
    staleTime: 60_000,
    retry: false,
  })
  const { data: proformasBadge } = useQuery<{ total: number }>({
    queryKey: ["nav-badge-proformas"],
    queryFn: () => api.get("/ordenes/count", { params: { es_proforma: true } }).then(r => r.data).catch(() => ({ total: 0 })),
    staleTime: 60_000,
    retry: false,
  })

  const badges: NavBadges = {
    turnosHoy: turnosBadge?.total ?? 0,
    ordenesPendientes: ordenesBadge?.total ?? 0,
    proformas: proformasBadge?.total ?? 0,
  }

  function handleLogout() {
    logout()
    navigate("/login")
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className={cn("p-4 border-b border-white/10 space-y-3", collapsed && "p-3")}>
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              {logo ? (
                <img src={logo} alt="Logo" className="h-8 max-w-[100px] object-contain shrink-0 brightness-0 invert" />
              ) : (
                <>
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">FV</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight text-white">Forever Vision</p>
                    <p className="text-[10px] text-white/50">Sistema de gestión</p>
                  </div>
                </>
              )}
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center mx-auto">
              <span className="text-white text-xs font-bold">FV</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!collapsed && <Notifications />}
            {!collapsed && <ThemeToggle />}
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!collapsed && <GlobalSearch />}
      </div>

      {/* Nav */}
      {!user ? <NavSkeleton /> : (
        <nav className={cn("flex-1 p-2 space-y-0.5 overflow-y-auto", collapsed && "flex flex-col items-center")}>
          <NavLinks onNavigate={() => setMobileOpen(false)} collapsed={collapsed} badges={badges} />
        </nav>
      )}

      {/* Footer */}
      <div className="border-t border-white/10 p-2 space-y-1">
        <UserBadge name={user?.full_name} role={user?.role} collapsed={collapsed} />
        {!collapsed ? (
          <>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
            {/* Collapse button — visible inside sidebar */}
            <button
              onClick={() => setCollapsed(true)}
              className="hidden md:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
              title="Colapsar menú"
            >
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Colapsar menú</span>
            </button>
          </>
        ) : (
          <>
            <button
              className="w-full flex justify-center p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={handleLogout}
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
            {/* Expand button */}
            <button
              onClick={() => setCollapsed(false)}
              className="hidden md:flex w-full justify-center p-2 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
              title="Expandir menú"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex md:h-screen md:sticky md:top-0 flex-col shrink-0 transition-all duration-200 relative",
          collapsed ? "w-16" : "w-64"
        )}
        style={{ background: primaryHex }}
      >
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
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: primaryHex }}
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
            <Notifications />
            <ThemeToggle />
            <GlobalSearch />
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background relative">
          <FloatingFAB />
          {/* Blobs decorativos */}
          <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
            <div className="absolute top-[-12%] left-[20%] w-[750px] h-[750px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.22) 0%, transparent 62%)` }} />
            <div className="absolute bottom-[-12%] right-[0%] w-[650px] h-[650px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.16) 0%, transparent 62%)` }} />
            <div className="absolute top-[35%] left-[-8%] w-[500px] h-[500px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.12) 0%, transparent 62%)` }} />
            <div className="dark:hidden absolute bottom-[5%] left-[30%] w-[400px] h-[400px] rounded-full"
                 style={{ background: `radial-gradient(circle, hsl(220 70% 85%/0.35) 0%, transparent 65%)` }} />
          </div>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <SessionExpiredModal />
      <OnboardingTour />
    </div>
  )
}
