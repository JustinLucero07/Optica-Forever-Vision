import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Loader2, Printer } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth"
import { getMarcaLogo, MARCA_FOOTER, PDF_BASE_CSS } from "@/lib/pdf"
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

function SeccionRx({ titulo, esf, cil, eje, add, av }: { titulo: string; esf?: number | null; cil?: number | null; eje?: number | null; add?: number | null; av?: string | null }) {
  if (!esf && !cil && !eje) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      <div className="flex gap-3 text-sm">
        {esf != null && <span>Esf: <strong>{Number(esf) >= 0 ? "+" : ""}{esf}</strong></span>}
        {cil != null && <span>Cil: <strong>{Number(cil) >= 0 ? "+" : ""}{cil}</strong></span>}
        {eje != null && <span>Eje: <strong>{eje}°</strong></span>}
        {add != null && <span>Add: <strong>+{add}</strong></span>}
        {av && <span>AV: <strong>{av}</strong></span>}
      </div>
    </div>
  )
}


type ConsultaData = Record<string, unknown> & { recetas?: Array<{ tipo: string } & Record<string, unknown>> }
type PacienteData = Record<string, unknown>

function printCertificado(c: ConsultaData, paciente: PacienteData | undefined, conMedidas: boolean, firma = "", logo?: string | null) {
  const nom = paciente ? `${paciente.apellidos} ${paciente.nombres}` : `Paciente #${c.paciente_id}`
  const recLC = c.recetas?.find((r) => r.tipo === "lente_convencional")
  const recetaHtml = conMedidas && recLC ? `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:11px">
      <thead><tr style="background:#e0f2fe">
        <th style="padding:5px 8px;text-align:left;border:1px solid #bae6fd">Ojo</th>
        <th style="padding:5px 8px;border:1px solid #bae6fd">Esf</th>
        <th style="padding:5px 8px;border:1px solid #bae6fd">Cil</th>
        <th style="padding:5px 8px;border:1px solid #bae6fd">Eje</th>
        <th style="padding:5px 8px;border:1px solid #bae6fd">Add</th>
        <th style="padding:5px 8px;border:1px solid #bae6fd">DNP</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:bold">OD</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_od_esf != null ? (Number(recLC.lc_od_esf) >= 0 ? "+" : "") + recLC.lc_od_esf : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_od_cil != null ? (Number(recLC.lc_od_cil) >= 0 ? "+" : "") + recLC.lc_od_cil : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_od_eje ?? "—"}${recLC.lc_od_eje ? "°" : ""}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_od_add != null ? "+" + recLC.lc_od_add : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_od_dnp ?? "—"}</td>
        </tr>
        <tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:bold">OI</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_oi_esf != null ? (Number(recLC.lc_oi_esf) >= 0 ? "+" : "") + recLC.lc_oi_esf : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_oi_cil != null ? (Number(recLC.lc_oi_cil) >= 0 ? "+" : "") + recLC.lc_oi_cil : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_oi_eje ?? "—"}${recLC.lc_oi_eje ? "°" : ""}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_oi_add != null ? "+" + recLC.lc_oi_add : "—"}</td>
          <td style="padding:5px 8px;border:1px solid #e5e7eb;text-align:center">${recLC.lc_oi_dnp ?? "—"}</td>
        </tr>
      </tbody>
    </table>
    ${recLC.tipo_lente ? `<p style="font-size:11px;margin:4px 0"><strong>Tipo lente:</strong> ${recLC.tipo_lente}</p>` : ""}
    ${recLC.tipo_armadura ? `<p style="font-size:11px;margin:4px 0"><strong>Armadura:</strong> ${recLC.tipo_armadura}</p>` : ""}
  ` : conMedidas ? `<p style="color:#6b7280;font-size:11px">Sin receta registrada</p>` : ""

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificado de Consulta</title>
  <style>${PDF_BASE_CSS}
  .section{margin:12px 0}.section h3{font-size:11px;color:#0891b2;text-transform:uppercase;border-bottom:1px solid #e0f2fe;padding-bottom:4px;margin-bottom:8px}
  .row{display:flex;gap:24px;margin:4px 0;font-size:11px}
  .lbl{color:#6b7280;min-width:130px}.sig{margin-top:40px;border-top:1px solid #374151;width:200px;text-align:center;padding-top:4px;font-size:10px}
  </style></head><body>
  <div class="doc-hdr">
    <div class="doc-hdr-left">
      ${getMarcaLogo(logo)}
      <div class="doc-hdr-title">Certificado de Consulta Oftalmológica</div>
    </div>
    <div class="doc-hdr-right">
      <div class="num">${c.numero}</div>
      <div class="fecha">${c.fecha}</div>
    </div>
  </div>
  <div class="doc-body">
    <div class="doc-section"><h3 class="doc-section-title">Datos del paciente</h3>
      <div class="row"><span class="lbl">Paciente:</span><strong>${nom}</strong></div>
      ${paciente?.cedula ? `<div class="row"><span class="lbl">Cédula:</span>${paciente.cedula}</div>` : ""}
      <div class="row"><span class="lbl">Fecha consulta:</span>${c.fecha}</div>
      <div class="row"><span class="lbl">N° Consulta:</span>${c.numero}</div>
    </div>
    ${c.diagnostico || c.motivo_consulta ? `<div class="doc-section"><h3 class="doc-section-title">Diagnóstico</h3>
      ${c.motivo_consulta ? `<div class="row"><span class="lbl">Motivo:</span>${c.motivo_consulta}</div>` : ""}
      ${c.diagnostico ? `<div class="row"><span class="lbl">Diagnóstico:</span><strong>${c.diagnostico}</strong></div>` : ""}
      ${c.plan_tratamiento ? `<div class="row"><span class="lbl">Plan:</span>${c.plan_tratamiento}</div>` : ""}
    </div>` : ""}
    ${conMedidas ? `<div class="doc-section"><h3 class="doc-section-title">Prescripción</h3>${recetaHtml}</div>` : ""}
    ${c.proximo_control ? `<div class="doc-section"><h3 class="doc-section-title">Próximo control</h3><p style="font-size:11px">${c.proximo_control}</p></div>` : ""}
    <div class="firma-row">
      <div class="firma-box">
        ${firma ? `<img src="${firma}" />` : ""}
        <div class="line"></div>
        <p>Optometrista / Responsable</p>
      </div>
      <div class="firma-box">
        <div class="line" style="margin-top:44px"></div>
        <p>Firma / Huella del Paciente</p>
      </div>
    </div>
  </div>
  ${MARCA_FOOTER}
  <script>window.onload=()=>window.print()</script></body></html>`

  const w = window.open("", "_blank", "width=700,height=800")
  if (w) { w.document.write(html); w.document.close() }
}

export default function ConsultaDetalle() {
  const [conMedidas, setConMedidas] = useState(true)
  const { id } = useParams()
  const navigate = useNavigate()
  const rol = useAuthStore((s) => s.user?.role)

  const { data: c, isLoading } = useQuery({
    queryKey: ["consulta", id],
    queryFn: () => api.get(`/consultas/${id}`).then(r => r.data),
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
  if (!c) return <div className="p-6 text-destructive">Consulta no encontrada</div>

  const recLC = c.recetas?.find((r: { tipo: string }) => r.tipo === "lente_convencional")
  const recCL = c.recetas?.find((r: { tipo: string }) => r.tipo === "contactologia")
  const nombrePac = paciente ? `${paciente.apellidos}, ${paciente.nombres}` : `Paciente #${c.paciente_id}`

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
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
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => printCertificado(c, paciente, conMedidas, config?.firma_electronica || "", useBrandStore.getState().logo)}>
            <Printer className="h-4 w-4 mr-1" /> Certificado
          </Button>
          {(rol === "admin" || rol === "optometrista") && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/pacientes/${c.paciente_id}/consultas/${c.id}/editar`}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Link>
            </Button>
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
            <Fila label="Diagnóstico" valor={c.diagnostico} />
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
