import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Loader2, Printer, Copy, CalendarPlus, FlaskConical, ShoppingCart } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"
import { getMarcaLogo, getMarcaFooter } from "@/lib/pdf"
import { useBrandStore } from "@/store/brand"

function Fila({ label, valor }: { label: string; valor: string | number | boolean | null | undefined }) {
  if (valor === null || valor === undefined || valor === "") return null
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-sm">{String(valor)}</span>
    </div>
  )
}

function fmtRxInline(v: unknown): string {
  if (v === null || v === undefined || v === "") return ""
  const n = Number(v)
  if (isNaN(n)) return ""
  return (n >= 0 ? "+" : "") + n.toFixed(2)
}

function SeccionRx({ titulo, esf, cil, eje, add, av }: { titulo: string; esf?: number | null; cil?: number | null; eje?: number | null; add?: number | null; av?: string | null }) {
  if (esf == null && !cil && !eje) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      <div className="flex gap-3 text-sm">
        {(esf != null || cil != null) && <span>Esf: <strong>{fmtRxInline(esf ?? 0)}</strong></span>}
        {cil != null && <span>Cil: <strong>{fmtRxInline(cil)}</strong></span>}
        {eje != null && <span>Eje: <strong>{eje}°</strong></span>}
        {add != null && <span>Add: <strong>{fmtRxInline(add)}</strong></span>}
        {av && <span>AV: <strong>{av}</strong></span>}
      </div>
    </div>
  )
}


type ConsultaData = Record<string, unknown> & { recetas?: Array<{ tipo: string } & Record<string, unknown>> }
type PacienteData = Record<string, unknown>

function calcEdad(fechaNac: string | null | undefined): string {
  if (!fechaNac) return ""
  const hoy = new Date()
  const nac = new Date(fechaNac)
  let edad = hoy.getFullYear() - nac.getFullYear()
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--
  return `${edad} años`
}

const MESES_ES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"]

function fmtFechaCert(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso + "T12:00:00")
  return `${String(d.getDate()).padStart(2,"0")} de ${MESES_ES[d.getMonth()]} del ${d.getFullYear()}`
}

function fmtRx(v: unknown): string {
  if (v === null || v === undefined || v === "") return ""
  const n = Number(v)
  if (isNaN(n)) return ""
  return (n >= 0 ? "+" : "") + n.toFixed(2)
}

function printCertificado(c: ConsultaData, paciente: PacienteData | undefined, conMedidas: boolean, firma = "", optNombre = "", logo?: string | null) {
  const nom = paciente ? `${(paciente.apellidos as string ?? "").toUpperCase()} ${(paciente.nombres as string ?? "").toUpperCase()}` : `Paciente #${c.paciente_id}`
  const edad = calcEdad(paciente?.fecha_nacimiento as string | undefined)
  const edadNum = edad ? edad.replace(" años","") : ""
  const fechaTexto = fmtFechaCert(c.fecha as string)

  const recLC = c.recetas?.find((r) => r.tipo === "lente_convencional")

  // AV values
  const avODsc = (c.avsc_od ?? c.avscod ?? "") as string
  const avOIsc = (c.avsc_oi ?? c.avscoi ?? "") as string
  const avAOsc = (c.avsc_ao ?? c.avscao ?? "") as string
  const avODcc = (c.avcc_od ?? c.avccod ?? "-") as string
  const avOIcc = (c.avcc_oi ?? c.avccoi ?? "-") as string

  // Esfera: si null pero hay cil/eje → plano = 0.00
  function fmtEsf(esf: unknown, cil: unknown, eje: unknown): string {
    if (esf !== null && esf !== undefined && esf !== "") return fmtRx(esf)
    if (cil !== null && cil !== undefined && cil !== "") return "0.00"
    if (eje !== null && eje !== undefined && eje !== "") return "0.00"
    return ""
  }

  // RX rows — usa receta LC si existe, sino cae a refracción subjetiva
  const rxOD = recLC ? `
    <td>${fmtEsf(recLC.lc_od_esf, recLC.lc_od_cil, recLC.lc_od_eje)}</td>
    <td>${fmtRx(recLC.lc_od_cil) || ""}</td>
    <td>${recLC.lc_od_eje ? recLC.lc_od_eje + "°" : ""}</td>
    <td>${recLC.lc_od_add ? fmtRx(recLC.lc_od_add) : ""}</td>
    <td>${recLC.lc_od_dnp ?? ""}</td>` : `
    <td>${fmtEsf(c.rx_od_esf, c.rx_od_cil, c.rx_od_eje)}</td>
    <td>${fmtRx(c.rx_od_cil) || ""}</td>
    <td>${c.rx_od_eje ? c.rx_od_eje + "°" : ""}</td>
    <td>${c.rx_od_add ? fmtRx(c.rx_od_add) : ""}</td>
    <td></td>`

  const rxOI = recLC ? `
    <td>${fmtEsf(recLC.lc_oi_esf, recLC.lc_oi_cil, recLC.lc_oi_eje)}</td>
    <td>${fmtRx(recLC.lc_oi_cil) || ""}</td>
    <td>${recLC.lc_oi_eje ? recLC.lc_oi_eje + "°" : ""}</td>
    <td>${recLC.lc_oi_add ? fmtRx(recLC.lc_oi_add) : ""}</td>
    <td>${recLC.lc_oi_dnp ?? ""}</td>` : `
    <td>${fmtEsf(c.rx_oi_esf, c.rx_oi_cil, c.rx_oi_eje)}</td>
    <td>${fmtRx(c.rx_oi_cil) || ""}</td>
    <td>${c.rx_oi_eje ? c.rx_oi_eje + "°" : ""}</td>
    <td>${c.rx_oi_add ? fmtRx(c.rx_oi_add) : ""}</td>
    <td></td>`

  const observaciones = [c.diagnostico, c.plan_tratamiento].filter(Boolean).join("\n")

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificado — ${nom}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;padding:28px 32px;max-width:800px;margin:auto}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0891b2;padding-bottom:10px;margin-bottom:14px}
    .hdr-right{text-align:right;font-size:10px;color:#64748b}
    .title{font-size:16px;font-weight:800;color:#0891b2;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;text-align:center;border-bottom:1px solid #e0f2fe;padding-bottom:8px}
    .subtitle{font-size:13px;font-weight:700;color:#1e293b;text-align:center;margin-bottom:8px}
    .intro{font-size:12px;text-align:center;margin-bottom:4px;line-height:1.7}
    .av-block{margin:14px 0}
    .av-row{display:flex;gap:40px;font-size:11px;margin:3px 0}
    .av-col{display:flex;gap:10px}
    table.rx{width:100%;border-collapse:collapse;margin:14px 0}
    table.rx th{background:#e0f2fe;border:1px solid #bae6fd;padding:6px 10px;text-align:center;font-size:11px;font-weight:700;color:#0c4a6e}
    table.rx td{border:1px solid #e5e7eb;padding:8px 10px;text-align:center;font-size:12px;min-height:28px}
    table.rx td.eye{font-weight:800;background:#f0f9ff;color:#0891b2;text-align:left;padding-left:12px}
    .obs{margin:14px 0}
    .obs-title{font-size:11px;font-weight:700;color:#0891b2;text-transform:uppercase;margin-bottom:6px}
    .obs-text{font-size:11px;line-height:1.8;white-space:pre-wrap}
    .firma-section{margin-top:32px;display:flex;justify-content:flex-end}
    .firma-box{text-align:center;min-width:220px}
    .firma-box img{height:50px;object-fit:contain;display:block;margin:0 auto 4px}
    .firma-line{border-top:1px solid #374151;margin:0 auto 4px;width:200px;padding-top:5px;font-size:11px;font-weight:700}
    .firma-sub{font-size:10px;color:#6b7280}
    @media print{body{padding:16px}}
  </style></head><body>
  <div class="hdr">
    ${getMarcaLogo(logo)}
    <div class="hdr-right">
      <div><strong>N° ${c.numero}</strong></div>
      <div>${c.fecha}</div>
    </div>
  </div>

  <div class="title">Certificado</div>

  <p class="intro"><strong>Certificado de ${nom}</strong> con CI: ${paciente?.cedula ?? "—"}</p>
  <p class="intro">${edadNum ? `Con la edad de: <strong>${edadNum} años</strong>, asistió` : "Asistió"} al examen Optométrico el día <strong>${fechaTexto}</strong></p>
  <p class="intro" style="margin-top:8px">El diagnóstico presente es de: &nbsp;
    <strong>OD:</strong> &nbsp;${(c as any).diag_od || (c.rx_od_esf != null ? "AMETROPÍA" : "EMETROPE.")}&nbsp;&nbsp;&nbsp;&nbsp;
    <strong>AV AO S/C:</strong> ${avAOsc || "—"}&nbsp;&nbsp;&nbsp;&nbsp;
    <strong>OI:</strong> &nbsp;${(c as any).diag_oi || (c.rx_oi_esf != null ? "AMETROPÍA" : "EMETROPE.")}
  </p>

  <div class="av-block">
    <div class="av-row">
      <span><strong>AV OD S/C:</strong> ${avODsc || "—"}</span>
      <span style="margin-left:80px"><strong>AV OD C/C:</strong> ${avODcc || "-"}</span>
    </div>
    <div class="av-row">
      <span><strong>AV OI S/C:</strong> ${avOIsc || "—"}</span>
      <span style="margin-left:80px"><strong>AV OI C/C:</strong> ${avOIcc || "-"}</span>
    </div>
  </div>

  ${conMedidas ? `
  <table class="rx">
    <thead><tr>
      <th style="text-align:left;padding-left:12px">RX</th>
      <th>ESFERA</th><th>CILINDRO</th><th>EJE</th><th>ADD</th><th>DP</th>
    </tr></thead>
    <tbody>
      <tr><td class="eye">OD</td>${rxOD}</tr>
      <tr><td class="eye" style="padding-top:14px;padding-bottom:14px"></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td class="eye">OI</td>${rxOI}</tr>
      <tr><td class="eye" style="padding-top:14px;padding-bottom:14px"></td><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>` : ""}

  ${observaciones ? `<div class="obs">
    <div class="obs-title">Observaciones</div>
    <div class="obs-text">${observaciones}</div>
  </div>` : ""}

  <div class="firma-section">
    <div class="firma-box">
      ${firma ? `<img src="${firma}" />` : `<div style="height:50px"></div>`}
      <div class="firma-line">OPT. (A) &nbsp;…………………………………….</div>
      <div class="firma-sub">${optNombre || "Optometrista"}</div>
    </div>
  </div>

  ${getMarcaFooter(logo)}
  <script>window.onload=()=>window.print()</script></body></html>`

  const w = window.open("", "_blank", "width=700,height=900")
  if (w) { w.document.write(html); w.document.close() }
}

export default function ConsultaDetalle() {
  const [conMedidas, setConMedidas] = useState(true)
  const { id } = useParams()
  const navigate = useNavigate()
  const rol = useAuthStore((s) => s.user?.role)
  const currentUser = useAuthStore((s) => s.user)

  const { data: c, isLoading, isError } = useQuery({
    queryKey: ["consulta", id],
    queryFn: () => api.get(`/consultas/${id}`).then(r => r.data),
    retry: false,
  })

  const { data: paciente } = useQuery({
    queryKey: ["paciente", c?.paciente_id],
    queryFn: () => api.get(`/pacientes/${c?.paciente_id}`).then(r => r.data),
    enabled: !!c?.paciente_id,
  })

  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: () => api.get("/configuracion").then(r => r.data),
    staleTime: 300_000,
  })

  if (isLoading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</div>
  if (isError) return (
    <div className="p-3 sm:p-6 space-y-2">
      <p className="text-destructive font-semibold">Error al cargar la consulta</p>
      <p className="text-sm text-muted-foreground">Es posible que la migración de base de datos pendiente no se haya ejecutado.</p>
      <code className="block text-xs bg-muted px-3 py-2 rounded mt-1">sudo docker exec optica-forever-vision-backend-1 alembic upgrade head</code>
    </div>
  )
  if (!c) return <div className="p-6 text-destructive">Consulta no encontrada</div>

  const recLC = c.recetas?.find((r: { tipo: string }) => r.tipo === "lente_convencional")
  const recCL = c.recetas?.find((r: { tipo: string }) => r.tipo === "contactologia")
  const nombrePac = paciente ? `${paciente.apellidos}, ${paciente.nombres}` : `Paciente #${c.paciente_id}`

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <Breadcrumb crumbs={[
        { label: "Pacientes", to: "/pacientes" },
        { label: nombrePac, to: `/pacientes/${c.paciente_id}` },
        { label: `Consulta ${c.numero}` },
      ]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Consulta <Badge variant="outline">{c.numero}</Badge></h1>
            </div>
            <Link to={`/pacientes/${c.paciente_id}`} className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              {nombrePac}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center border rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setConMedidas(true)}
              className={`px-3 py-1.5 transition-colors ${conMedidas ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >Con medidas</button>
            <button
              onClick={() => setConMedidas(false)}
              className={`px-3 py-1.5 transition-colors ${!conMedidas ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >Sin medidas</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => printCertificado(c, paciente, conMedidas, currentUser?.firma_url || config?.firma_electronica || "", currentUser?.full_name || "", useBrandStore.getState().logo)}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir certificado
          </Button>
          <Button variant="outline" size="sm"
            title="Agendar cita de control para este paciente"
            onClick={() => navigate("/turnos", { state: { fromConsulta: { paciente_id: c.paciente_id, motivo: "Control visual", fecha: c.proximo_control ?? "" } } })}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Agendar control
          </Button>
          <Button
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
            title="Crear orden de laboratorio con la prescripción de esta consulta"
            onClick={() => navigate("/ordenes", { state: { fromConsulta: {
              paciente_id: c.paciente_id,
              consulta_id: c.id,
              od: { esf: c.rx_od_esf, cil: c.rx_od_cil, eje: c.rx_od_eje, add: c.rx_od_add },
              oi: { esf: c.rx_oi_esf, cil: c.rx_oi_cil, eje: c.rx_oi_eje, add: c.rx_oi_add },
              diagnostico: c.diagnostico,
            } } })}>
            <FlaskConical className="h-4 w-4 mr-1" /> Crear orden lab
          </Button>
          <Button
            size="sm"
            variant="default"
            title="Crear venta directa para este paciente"
            onClick={() => navigate("/ventas/nueva", { state: { paciente_id: c.paciente_id } })}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Facturar
          </Button>
          {(rol === "admin" || rol === "optometrista") && (
            <>
              <Button variant="outline" size="sm"
                title="Duplicar esta consulta como nueva"
                onClick={() => navigate(`/pacientes/${c.paciente_id}/consultas/nueva`, { state: { duplicarDe: c } })}>
                <Copy className="h-4 w-4 mr-1" /> Duplicar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/pacientes/${c.paciente_id}/consultas/${c.id}/editar`}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Datos generales</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Fila label="Fecha" valor={c.fecha} />
            <Fila label="Motivo" valor={c.motivo_consulta} />
            <Fila label="Antecedentes" valor={c.antecedentes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Agudeza Visual</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {["OD", "OI", "AO"].map((e) => {
                const k = e.toLowerCase()
                return (
                  <div key={e} className="text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">{e}</p>
                    <p>SC: {c[`avsc_${k}`] ?? "—"}</p>
                    <p>CC: {c[`avcc_${k}`] ?? "—"}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Refracción</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <SeccionRx titulo="OD" esf={c.rx_od_esf} cil={c.rx_od_cil} eje={c.rx_od_eje} add={c.rx_od_add} av={c.rx_od_av} />
            <SeccionRx titulo="OI" esf={c.rx_oi_esf} cil={c.rx_oi_cil} eje={c.rx_oi_eje} add={c.rx_oi_add} av={c.rx_oi_av} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Exploración</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Fila label="PIO OD" valor={c.pio_od ? `${c.pio_od} mmHg` : null} />
            <Fila label="PIO OI" valor={c.pio_oi ? `${c.pio_oi} mmHg` : null} />
            <Fila label="Cover Test VL" valor={c.cover_test_vl} />
            <Fila label="Cover Test VP" valor={c.cover_test_vp} />
            <Fila label="Motilidad" valor={c.motilidad} />
            <Fila label="Estereopsis" valor={c.estereopsis} />
          </CardContent>
        </Card>

        {(c.seg_anterior_od || c.seg_anterior_oi || c.fondo_od || c.fondo_oi) && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">Biomicroscopía y Fondo de Ojo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {c.seg_anterior_od && <div><p className="text-xs text-muted-foreground font-medium mb-1">Seg. Ant. OD</p><p>{c.seg_anterior_od}</p></div>}
              {c.seg_anterior_oi && <div><p className="text-xs text-muted-foreground font-medium mb-1">Seg. Ant. OI</p><p>{c.seg_anterior_oi}</p></div>}
              {c.fondo_od && <div><p className="text-xs text-muted-foreground font-medium mb-1">Fondo OD</p><p>{c.fondo_od}</p></div>}
              {c.fondo_oi && <div><p className="text-xs text-muted-foreground font-medium mb-1">Fondo OI</p><p>{c.fondo_oi}</p></div>}
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Diagnóstico</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            <Fila label="Diagnóstico OD" valor={c.diag_od} />
            <Fila label="Diagnóstico OI" valor={c.diag_oi} />
            <Fila label="Notas clínicas" valor={c.diagnostico} />
            <Fila label="Plan" valor={c.plan_tratamiento} />
            <Fila label="Observaciones" valor={c.observaciones} />
            <Fila label="Próximo control" valor={c.proximo_control} />
          </CardContent>
        </Card>

        {recLC && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Receta — Lentes Convencionales</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <SeccionRx titulo="OD" esf={recLC.lc_od_esf} cil={recLC.lc_od_cil} eje={recLC.lc_od_eje} add={recLC.lc_od_add} />
              <SeccionRx titulo="OI" esf={recLC.lc_oi_esf} cil={recLC.lc_oi_cil} eje={recLC.lc_oi_eje} add={recLC.lc_oi_add} />
              <div className="text-sm space-y-0.5 mt-2">
                {recLC.tipo_lente && <p><span className="text-muted-foreground">Tipo:</span> {recLC.tipo_lente}</p>}
                {recLC.tipo_armadura && <p><span className="text-muted-foreground">Armadura:</span> {recLC.tipo_armadura}</p>}
                {recLC.lc_od_dnp && <p><span className="text-muted-foreground">DNP OD:</span> {recLC.lc_od_dnp} mm</p>}
                {recLC.lc_oi_dnp && <p><span className="text-muted-foreground">DNP OI:</span> {recLC.lc_oi_dnp} mm</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {recCL && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Receta — Contactología</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {["od", "oi"].map(e => (
                <div key={e}>
                  <p className="text-xs font-semibold text-muted-foreground">{e.toUpperCase()}</p>
                  <div className="flex gap-3">
                    {recCL[`cl_${e}_marca`] && <span>Marca: <strong>{recCL[`cl_${e}_marca`]}</strong></span>}
                    {recCL[`cl_${e}_bc`] != null && <span>BC: <strong>{recCL[`cl_${e}_bc`]}</strong></span>}
                    {recCL[`cl_${e}_diam`] != null && <span>⌀: <strong>{recCL[`cl_${e}_diam`]}</strong></span>}
                    {recCL[`cl_${e}_esf`] != null && <span>Esf: <strong>{recCL[`cl_${e}_esf`]}</strong></span>}
                    {recCL[`cl_${e}_cil`] != null && <span>Cil: <strong>{recCL[`cl_${e}_cil`]}</strong></span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
