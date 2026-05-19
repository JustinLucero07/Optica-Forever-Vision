import { Navigate, Outlet, createBrowserRouter } from "react-router-dom"

import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import LoginPage from "@/pages/Login"
import Pacientes from "@/pages/Pacientes"
import PacienteDetalle from "@/pages/PacienteDetalle"
import ConsultaForm from "@/pages/ConsultaForm"
import Consultas from "@/pages/Consultas"
import ConsultaDetalle from "@/pages/ConsultaDetalle"
import Inventario from "@/pages/Inventario"
import Ventas from "@/pages/Ventas"
import VentaNueva from "@/pages/VentaNueva"
import VentaDetalle from "@/pages/VentaDetalle"
import Cobros from "@/pages/Cobros"
import Creditos from "@/pages/Creditos"
import Turnos from "@/pages/Turnos"
import Ordenes from "@/pages/Ordenes"
import Reportes from "@/pages/Reportes"
import { useAuthStore } from "@/store/auth"

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function RedirectIfAuth() {
  const token = useAuthStore((s) => s.token)
  if (token) return <Navigate to="/" replace />
  return <LoginPage />
}

function Proximamente({ titulo }: { titulo: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">{titulo}</h1>
      <p className="text-muted-foreground">Módulo en desarrollo — disponible próximamente.</p>
    </div>
  )
}

export const router = createBrowserRouter([
  { path: "/login", element: <RedirectIfAuth /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Dashboard /> },

          // Pacientes
          { path: "pacientes", element: <Pacientes /> },
          { path: "pacientes/:id", element: <PacienteDetalle /> },

          // Consultas (nueva y editar desde el paciente)
          { path: "pacientes/:pacienteId/consultas/nueva", element: <ConsultaForm /> },
          { path: "pacientes/:pacienteId/consultas/:consultaId/editar", element: <ConsultaForm /> },

          // Consulta detalle (acceso directo)
          { path: "consultas/:id", element: <ConsultaDetalle /> },

          // Inventario y Ventas
          { path: "inventario", element: <Inventario /> },
          { path: "ventas", element: <Ventas /> },
          { path: "ventas/nueva", element: <VentaNueva /> },
          { path: "ventas/:id", element: <VentaDetalle /> },

          // Agenda y Órdenes (Fase 4)
          { path: "turnos", element: <Turnos /> },
          { path: "ordenes", element: <Ordenes /> },

          // Cobros / Tesorería / Créditos
          { path: "cobros", element: <Cobros /> },
          { path: "creditos", element: <Creditos /> },
          { path: "consultas", element: <Consultas /> },
          { path: "reportes", element: <Reportes /> },

          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
])
