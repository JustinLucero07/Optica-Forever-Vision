import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { useBrandStore } from "@/store/brand"

interface Props {
  title: string
  subtitle?: string
}

export default function PrintHeader({ title, subtitle }: Props) {
  const { logo } = useBrandStore()

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 60_000,
  })

  const nombre    = config?.nombre_optica    || "Óptica Forever Vision"
  const direccion = config?.direccion_optica || ""
  const telefono  = config?.telefono_optica  || ""

  const now = new Date()
  const fecha = now.toLocaleDateString("es-EC", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
  const hora = now.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })

  return (
    // Oculto en pantalla, visible solo al imprimir
    <div className="print-only" style={{ display: "none" }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        borderBottom: "2px solid #e5e7eb",
        paddingBottom: "16px",
        marginBottom: "20px",
        gap: "16px",
      }}>
        {/* Logo + datos */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {logo && (
            <img
              src={logo}
              alt="Logo"
              style={{ height: "56px", maxWidth: "140px", objectFit: "contain" }}
            />
          )}
          <div>
            <p style={{ fontWeight: "800", fontSize: "18px", margin: "0 0 2px 0", color: "#111" }}>
              {nombre}
            </p>
            {direccion && (
              <p style={{ fontSize: "12px", margin: "0 0 1px 0", color: "#6b7280" }}>{direccion}</p>
            )}
            {telefono && (
              <p style={{ fontSize: "12px", margin: 0, color: "#6b7280" }}>Tel: {telefono}</p>
            )}
          </div>
        </div>

        {/* Reporte + fecha */}
        <div style={{ textAlign: "right" }}>
          <p style={{ fontWeight: "700", fontSize: "15px", margin: "0 0 4px 0", color: "#111" }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontSize: "12px", margin: "0 0 4px 0", color: "#6b7280" }}>{subtitle}</p>
          )}
          <p style={{ fontSize: "11px", margin: 0, color: "#9ca3af" }}>{fecha}</p>
          <p style={{ fontSize: "11px", margin: 0, color: "#9ca3af" }}>Hora: {hora}</p>
        </div>
      </div>
    </div>
  )
}
