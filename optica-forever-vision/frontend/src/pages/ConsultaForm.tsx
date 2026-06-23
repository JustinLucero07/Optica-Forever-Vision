import { useEffect, useState } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { useForm, type UseFormRegister, type FieldPath } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Save, Loader2 } from "lucide-react"

import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type FormData = {
  fecha: string
  motivo_consulta: string
  antecedentes: string
  avsc_od: string; avsc_oi: string; avsc_ao: string
  avcc_od: string; avcc_oi: string; avcc_ao: string
  rx_od_esf: string; rx_od_cil: string; rx_od_eje: string; rx_od_add: string; rx_od_av: string
  rx_oi_esf: string; rx_oi_cil: string; rx_oi_eje: string; rx_oi_add: string; rx_oi_av: string
  pio_od: string; pio_oi: string
  cover_test_vl: string; cover_test_vp: string; motilidad: string; estereopsis: string
  seg_anterior_od: string; seg_anterior_oi: string
  fondo_od: string; fondo_oi: string
  test_colores: string
  diag_od: string; diag_oi: string
  diagnostico: string; plan_tratamiento: string; observaciones: string; proximo_control: string
  // Receta lentes
  lc_od_esf: string; lc_od_cil: string; lc_od_eje: string; lc_od_add: string; lc_od_dnp: string; lc_od_alt: string
  lc_oi_esf: string; lc_oi_cil: string; lc_oi_eje: string; lc_oi_add: string; lc_oi_dnp: string; lc_oi_alt: string
  tipo_lente: string; tipo_armadura: string; obs_lc: string
  // Receta contactología
  cl_od_marca: string; cl_od_bc: string; cl_od_diam: string; cl_od_esf: string; cl_od_cil: string; cl_od_eje: string
  cl_oi_marca: string; cl_oi_bc: string; cl_oi_diam: string; cl_oi_esf: string; cl_oi_cil: string; cl_oi_eje: string
  obs_cl: string
  // Queratometría
  k_od_1: string; k_od_2: string; k_od_eje: string
  k_oi_1: string; k_oi_2: string; k_oi_eje: string
}

function n(v: string) { return v === "" ? null : Number(v) }
function nInt(v: string) { return v === "" ? null : Math.round(Number(v)) }
function s(v: string) { return v === "" ? null : v }

function buildPayload(d: FormData) {
  const hasLC = [d.lc_od_esf, d.lc_od_cil, d.lc_oi_esf, d.lc_oi_cil, d.tipo_lente].some(Boolean)
  const hasCL = [d.cl_od_esf, d.cl_od_marca, d.cl_oi_esf, d.cl_oi_marca].some(Boolean)

  return {
    fecha: d.fecha,
    motivo_consulta: s(d.motivo_consulta),
    antecedentes: s(d.antecedentes),
    avsc_od: s(d.avsc_od), avsc_oi: s(d.avsc_oi), avsc_ao: s(d.avsc_ao),
    avcc_od: s(d.avcc_od), avcc_oi: s(d.avcc_oi), avcc_ao: s(d.avcc_ao),
    rx_od_esf: n(d.rx_od_esf), rx_od_cil: n(d.rx_od_cil), rx_od_eje: nInt(d.rx_od_eje), rx_od_add: n(d.rx_od_add), rx_od_av: s(d.rx_od_av),
    rx_oi_esf: n(d.rx_oi_esf), rx_oi_cil: n(d.rx_oi_cil), rx_oi_eje: nInt(d.rx_oi_eje), rx_oi_add: n(d.rx_oi_add), rx_oi_av: s(d.rx_oi_av),
    pio_od: n(d.pio_od), pio_oi: n(d.pio_oi),
    cover_test_vl: s(d.cover_test_vl), cover_test_vp: s(d.cover_test_vp), motilidad: s(d.motilidad), estereopsis: s(d.estereopsis),
    seg_anterior_od: s(d.seg_anterior_od), seg_anterior_oi: s(d.seg_anterior_oi),
    fondo_od: s(d.fondo_od), fondo_oi: s(d.fondo_oi),
    test_colores: s(d.test_colores),
    diag_od: s(d.diag_od), diag_oi: s(d.diag_oi),
    diagnostico: s(d.diagnostico), plan_tratamiento: s(d.plan_tratamiento), observaciones: s(d.observaciones),
    proximo_control: s(d.proximo_control),
    receta_lc: hasLC ? {
      od_esf: n(d.lc_od_esf), od_cil: n(d.lc_od_cil), od_eje: nInt(d.lc_od_eje), od_add: n(d.lc_od_add), od_dnp: n(d.lc_od_dnp), od_alt: n(d.lc_od_alt),
      oi_esf: n(d.lc_oi_esf), oi_cil: n(d.lc_oi_cil), oi_eje: nInt(d.lc_oi_eje), oi_add: n(d.lc_oi_add), oi_dnp: n(d.lc_oi_dnp), oi_alt: n(d.lc_oi_alt),
      tipo_lente: s(d.tipo_lente), tipo_armadura: s(d.tipo_armadura), observaciones: s(d.obs_lc),
    } : null,
    receta_cl: hasCL ? {
      od_marca: s(d.cl_od_marca), od_bc: n(d.cl_od_bc), od_diam: n(d.cl_od_diam), od_esf: n(d.cl_od_esf), od_cil: n(d.cl_od_cil), od_eje: nInt(d.cl_od_eje),
      oi_marca: s(d.cl_oi_marca), oi_bc: n(d.cl_oi_bc), oi_diam: n(d.cl_oi_diam), oi_esf: n(d.cl_oi_esf), oi_cil: n(d.cl_oi_cil), oi_eje: nInt(d.cl_oi_eje),
      observaciones: s(d.obs_cl),
    } : null,
    k_od_1: n(d.k_od_1), k_od_2: n(d.k_od_2), k_od_eje: nInt(d.k_od_eje),
    k_oi_1: n(d.k_oi_1), k_oi_2: n(d.k_oi_2), k_oi_eje: nInt(d.k_oi_eje),
  }
}

const SECTIONS = ["Datos", "Agudeza Visual", "Refracción", "Exploración", "Biomicroscopía", "Diagnóstico", "Receta LC", "Contactología"]

const RX_FIELD_PROPS: Record<string, { type: string; step?: string; min?: string; max?: string; placeholder: string }> = {
  esf: { type: "number", step: "0.25", placeholder: "0.00" },
  cil: { type: "number", step: "0.25", placeholder: "0.00" },
  eje: { type: "number", step: "1", min: "0", max: "180", placeholder: "°" },
  add: { type: "number", step: "0.25", min: "0", placeholder: "0.00" },
  av:  { type: "text", placeholder: "20/" },
}

function RxGrid({ prefix, register }: { prefix: string; register: UseFormRegister<FormData> }) {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm">
      <div />
      {["Esfera", "Cilindro", "Eje", "Adición", "AV"].map(h => (
        <div key={h} className="text-center text-xs font-medium text-muted-foreground">{h}</div>
      ))}
      {["od", "oi"].map(eye => (
        <>
          <div key={`${eye}-label`} className="font-semibold text-xs">{eye.toUpperCase()}</div>
          {["esf", "cil", "eje", "add", "av"].map(f => {
            const props = RX_FIELD_PROPS[f]
            return (
              <Input
                key={f}
                type={props.type}
                step={props.step}
                min={props.min}
                max={props.max}
                className="h-8 text-center text-xs"
                placeholder={props.placeholder}
                {...register(`${prefix}_${eye}_${f}` as FieldPath<FormData>)}
              />
            )
          })}
        </>
      ))}
    </div>
  )
}

const DIAG_CHIPS = [
  "Miopía", "Hipermetropía", "Astigmatismo", "Astigmatismo miópico",
  "Astigmatismo hipermetrópico", "Astigmatismo mixto", "Emetropía",
  "Presbicia", "Ambliopía", "Estrabismo", "Ojo seco", "Pterigión",
  "Catarata", "Glaucoma sospechoso", "Daltonismo",
]

export default function ConsultaForm() {
  const { pacienteId, consultaId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [seccion, setSeccion] = useState(0)
  const esNueva = !consultaId
  const draftKey = `consulta_draft_${pacienteId}`
  const [tieneBorrador, setTieneBorrador] = useState(() => esNueva && !!localStorage.getItem(draftKey))
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null)

  const { data: paciente } = useQuery({
    queryKey: ["paciente", pacienteId],
    queryFn: () => api.get(`/pacientes/${pacienteId}`).then(r => r.data),
    enabled: !!pacienteId,
  })

  const { data: consulta } = useQuery({
    queryKey: ["consulta", consultaId],
    queryFn: () => api.get(`/consultas/${consultaId}`).then(r => r.data),
    enabled: !!consultaId,
  })

  const { register, handleSubmit, reset, getValues, setValue, watch } = useForm<FormData>({
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) },
  })

  function buildValuesFromConsulta(c: any) {
    const recLC = c.recetas?.find((r: { tipo: string }) => r.tipo === "lente_convencional")
    const recCL = c.recetas?.find((r: { tipo: string }) => r.tipo === "contactologia")
    return {
      fecha: esNueva ? new Date().toISOString().slice(0, 10) : c.fecha,
      motivo_consulta: c.motivo_consulta ?? "",
      antecedentes: c.antecedentes ?? "",
      avsc_od: c.avsc_od ?? "", avsc_oi: c.avsc_oi ?? "", avsc_ao: c.avsc_ao ?? "",
      avcc_od: c.avcc_od ?? "", avcc_oi: c.avcc_oi ?? "", avcc_ao: c.avcc_ao ?? "",
      rx_od_esf: c.rx_od_esf ?? "", rx_od_cil: c.rx_od_cil ?? "", rx_od_eje: c.rx_od_eje ?? "", rx_od_add: c.rx_od_add ?? "", rx_od_av: c.rx_od_av ?? "",
      rx_oi_esf: c.rx_oi_esf ?? "", rx_oi_cil: c.rx_oi_cil ?? "", rx_oi_eje: c.rx_oi_eje ?? "", rx_oi_add: c.rx_oi_add ?? "", rx_oi_av: c.rx_oi_av ?? "",
      pio_od: c.pio_od ?? "", pio_oi: c.pio_oi ?? "",
      cover_test_vl: c.cover_test_vl ?? "", cover_test_vp: c.cover_test_vp ?? "", motilidad: c.motilidad ?? "", estereopsis: c.estereopsis ?? "",
      seg_anterior_od: c.seg_anterior_od ?? "", seg_anterior_oi: c.seg_anterior_oi ?? "",
      fondo_od: c.fondo_od ?? "", fondo_oi: c.fondo_oi ?? "",
      test_colores: c.test_colores ?? "",
      diag_od: c.diag_od ?? "", diag_oi: c.diag_oi ?? "",
      diagnostico: c.diagnostico ?? "", plan_tratamiento: c.plan_tratamiento ?? "", observaciones: c.observaciones ?? "", proximo_control: c.proximo_control ?? "",
      lc_od_esf: recLC?.lc_od_esf ?? "", lc_od_cil: recLC?.lc_od_cil ?? "", lc_od_eje: recLC?.lc_od_eje ?? "", lc_od_add: recLC?.lc_od_add ?? "", lc_od_dnp: recLC?.lc_od_dnp ?? "", lc_od_alt: recLC?.lc_od_alt ?? "",
      lc_oi_esf: recLC?.lc_oi_esf ?? "", lc_oi_cil: recLC?.lc_oi_cil ?? "", lc_oi_eje: recLC?.lc_oi_eje ?? "", lc_oi_add: recLC?.lc_oi_add ?? "", lc_oi_dnp: recLC?.lc_oi_dnp ?? "", lc_oi_alt: recLC?.lc_oi_alt ?? "",
      tipo_lente: recLC?.tipo_lente ?? "", tipo_armadura: recLC?.tipo_armadura ?? "", obs_lc: recLC?.observaciones ?? "",
      cl_od_marca: recCL?.cl_od_marca ?? "", cl_od_bc: recCL?.cl_od_bc ?? "", cl_od_diam: recCL?.cl_od_diam ?? "", cl_od_esf: recCL?.cl_od_esf ?? "", cl_od_cil: recCL?.cl_od_cil ?? "", cl_od_eje: recCL?.cl_od_eje ?? "",
      cl_oi_marca: recCL?.cl_oi_marca ?? "", cl_oi_bc: recCL?.cl_oi_bc ?? "", cl_oi_diam: recCL?.cl_oi_diam ?? "", cl_oi_esf: recCL?.cl_oi_esf ?? "", cl_oi_cil: recCL?.cl_oi_cil ?? "", cl_oi_eje: recCL?.cl_oi_eje ?? "",
      obs_cl: recCL?.observaciones ?? "",
      k_od_1: c.k_od_1 ?? "", k_od_2: c.k_od_2 ?? "", k_od_eje: c.k_od_eje ?? "",
      k_oi_1: c.k_oi_1 ?? "", k_oi_2: c.k_oi_2 ?? "", k_oi_eje: c.k_oi_eje ?? "",
    }
  }

  useEffect(() => {
    const duplicarDe = (location.state as any)?.duplicarDe
    if (duplicarDe && esNueva) {
      reset(buildValuesFromConsulta(duplicarDe))
      toast.info("Consulta duplicada — revisa los datos antes de guardar")
    } else if (consulta) {
      reset(buildValuesFromConsulta(consulta))
    }
  }, [consulta, reset, esNueva])

  // Auto-guardado de borrador cada 30 segundos (solo en nueva consulta)
  useEffect(() => {
    if (!esNueva) return
    const interval = setInterval(() => {
      const vals = getValues()
      if (Object.values(vals).some(v => v !== "" && v != null)) {
        localStorage.setItem(draftKey, JSON.stringify(vals))
        setUltimoGuardado(new Date())
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [esNueva, draftKey, getValues])

  function restaurarBorrador() {
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    try { reset(JSON.parse(raw)); setTieneBorrador(false); toast.success("Borrador restaurado") }
    catch { toast.error("Error al restaurar borrador") }
  }

  function descartarBorrador() {
    localStorage.removeItem(draftKey)
    setTieneBorrador(false)
  }

  const guardarMut = useMutation({
    mutationFn: (d: FormData) => {
      const payload = buildPayload(d)
      return esNueva
        ? api.post(`/pacientes/${pacienteId}/consultas`, payload)
        : api.put(`/consultas/${consultaId}`, payload)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["consultas", pacienteId] })
      if (esNueva) localStorage.removeItem(draftKey)
      toast.success(esNueva ? "Consulta creada" : "Consulta actualizada")
      const proxControl = res.data.proximo_control
      if (esNueva && proxControl &&
        window.confirm(`¿Agendar turno de control para el ${proxControl}?`)) {
        navigate("/turnos", { state: { fromConsulta: { paciente_id: Number(pacienteId), fecha: proxControl, motivo: "Control visual" } } })
      } else {
        navigate(`/consultas/${res.data.id}`)
      }
    },
    onError: (e) => toast.error(errMsg(e, "Error al guardar")),
  })

  const titulo = paciente ? `${paciente.apellidos}, ${paciente.nombres}` : "…"

  return (
    <div className="flex flex-col h-full">
      {/* Banner borrador guardado */}
      {tieneBorrador && esNueva && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-3 text-sm text-amber-800">
          <span>Hay un borrador guardado de una consulta anterior para este paciente.</span>
          <button className="underline font-medium" onClick={restaurarBorrador}>Restaurar</button>
          <button className="text-amber-600 hover:text-amber-900" onClick={descartarBorrador}>Descartar</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">Consulta — {titulo}</p>
            <p className="font-semibold">{esNueva ? "Nueva consulta" : `Editar ${consulta?.numero}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {esNueva && ultimoGuardado && (
            <span className="text-xs text-muted-foreground">
              Borrador guardado {ultimoGuardado.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button onClick={handleSubmit((d) => guardarMut.mutate(d))} disabled={guardarMut.isPending}>
            {guardarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex overflow-x-auto border-b bg-background">
        {SECTIONS.map((s, i) => (
          <button
            key={s}
            onClick={() => setSeccion(i)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${seccion === i ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <form style={{ minHeight: 420 }}>
          {/* 0 - Datos */}
          {seccion === 0 && (
            <div className="space-y-4 max-w-2xl">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" {...register("fecha", { required: true })} className="max-w-xs" />
              </div>
              <div className="space-y-1">
                <Label>Motivo de consulta</Label>
                <Textarea rows={3} {...register("motivo_consulta")} />
              </div>
              <div className="space-y-1">
                <Label>Antecedentes personales y familiares</Label>
                <Textarea rows={4} {...register("antecedentes")} />
              </div>
            </div>
          )}

          {/* 1 - Agudeza Visual */}
          {seccion === 1 && (
            <div className="space-y-6 max-w-2xl">
              {[
                { label: "Agudeza Visual Sin Corrección (AVSC)", prefix: "avsc" },
                { label: "Agudeza Visual Con Corrección Anterior (AVCC)", prefix: "avcc" },
              ].map(({ label, prefix }) => (
                <div key={prefix} className="space-y-3">
                  <h3 className="font-semibold text-sm">{label}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {["od", "oi", "ao"].map(e => {
                      const fieldName = `${prefix}_${e}` as FieldPath<FormData>
                      const stored = watch(fieldName) as string ?? ""
                      const isNumericFmt = /^20\/\d+$/.test(stored)
                      const denom = isNumericFmt ? stored.slice(3) : stored
                      return (
                        <div key={e} className="space-y-1">
                          <Label className="text-xs">{e.toUpperCase()}</Label>
                          <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring bg-background h-9">
                            <span className="px-2 text-sm font-medium text-muted-foreground bg-muted/60 border-r h-full flex items-center select-none">20/</span>
                            <input
                              type="text"
                              placeholder="40"
                              value={denom}
                              className="flex-1 h-full px-2 text-sm bg-background focus:outline-none w-0"
                              onChange={ev => {
                                const v = ev.target.value
                                const isNum = /^\d+$/.test(v)
                                setValue(fieldName, v ? (isNum ? `20/${v}` : v) : "", { shouldDirty: true })
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2 - Refracción */}
          {seccion === 2 && (
            <div className="space-y-4 max-w-2xl">
              <h3 className="font-semibold text-sm">Refracción subjetiva</h3>
              <RxGrid prefix="rx" register={register} />
            </div>
          )}

          {/* 3 - Exploración */}
          {seccion === 3 && (
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>PIO OD (mmHg)</Label>
                  <Input type="number" step="0.1" {...register("pio_od")} />
                </div>
                <div className="space-y-1">
                  <Label>PIO OI (mmHg)</Label>
                  <Input type="number" step="0.1" {...register("pio_oi")} />
                </div>
                <div className="space-y-1">
                  <Label>Cover Test VL</Label>
                  <Input placeholder="Ortoforia, exoforia…" {...register("cover_test_vl")} />
                </div>
                <div className="space-y-1">
                  <Label>Cover Test VP</Label>
                  <Input placeholder="Ortoforia, exoforia…" {...register("cover_test_vp")} />
                </div>
                <div className="space-y-1">
                  <Label>Motilidad ocular</Label>
                  <Input placeholder="Normal, limitada…" {...register("motilidad")} />
                </div>
                <div className="space-y-1">
                  <Label>Estereopsis</Label>
                  <Input placeholder="400 seg/arc…" {...register("estereopsis")} />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm border-t pt-4">Queratometría</h3>
                <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center text-sm">
                  <div />
                  {["K1 (D)", "K2 (D)", "Eje (°)"].map(h => (
                    <div key={h} className="text-center text-xs font-medium text-muted-foreground">{h}</div>
                  ))}
                  {["od", "oi"].map(eye => (
                    <>
                      <div key={`${eye}-k`} className="font-semibold text-xs">{eye.toUpperCase()}</div>
                      {[
                        { f: "1",   type: "number", step: "0.01", placeholder: "0.00" },
                        { f: "2",   type: "number", step: "0.01", placeholder: "0.00" },
                        { f: "eje", type: "number", step: "1", min: "0", max: "180", placeholder: "°" },
                      ].map(({ f, type, step, min, max, placeholder }) => (
                        <Input
                          key={f}
                          type={type}
                          step={step}
                          min={min}
                          max={max}
                          className="h-8 text-center text-xs"
                          placeholder={placeholder}
                          {...register(`k_${eye}_${f}` as any)}
                        />
                      ))}
                    </>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4 - Biomicroscopía */}
          {seccion === 4 && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Segmento Anterior OD</Label>
                  <Textarea rows={4} placeholder="Párpados, conjuntiva, córnea, iris, cristalino…" {...register("seg_anterior_od")} />
                </div>
                <div className="space-y-1">
                  <Label>Segmento Anterior OI</Label>
                  <Textarea rows={4} placeholder="Párpados, conjuntiva, córnea, iris, cristalino…" {...register("seg_anterior_oi")} />
                </div>
                <div className="space-y-1">
                  <Label>Fondo de Ojo OD</Label>
                  <Textarea rows={4} placeholder="Papila, mácula, vasos…" {...register("fondo_od")} />
                </div>
                <div className="space-y-1">
                  <Label>Fondo de Ojo OI</Label>
                  <Textarea rows={4} placeholder="Papila, mácula, vasos…" {...register("fondo_oi")} />
                </div>
              </div>
            </div>
          )}

          {/* 5 - Diagnóstico */}
          {seccion === 5 && (
            <div className="space-y-5 max-w-2xl">
              {/* Test de colores */}
              <div className="space-y-1 max-w-xs">
                <Label>Test de colores (Ishihara)</Label>
                <Input placeholder="Ej: 17/17 correcto, daltonismo…" {...register("test_colores")} />
              </div>
              {/* Diagnóstico por ojo */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Diagnóstico por ojo</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["od", "oi"] as const).map(eye => (
                    <div key={eye} className="space-y-1">
                      <Label className="text-xs font-semibold">{eye.toUpperCase()}</Label>
                      <Input
                        placeholder={`Diagnóstico ${eye.toUpperCase()}…`}
                        {...register(`diag_${eye}` as FieldPath<FormData>)}
                      />
                    </div>
                  ))}
                </div>
                {/* Chips de diagnósticos frecuentes */}
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1.5">Frecuentes (clic para insertar en OD y OI):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIAG_CHIPS.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          const addChip = (cur: string) => {
                            const existing = cur.split(",").map(s => s.trim()).filter(Boolean)
                            if (existing.includes(chip)) return cur
                            return cur ? `${cur}, ${chip}` : chip
                          }
                          setValue("diag_od", addChip(getValues("diag_od")), { shouldDirty: true })
                          setValue("diag_oi", addChip(getValues("diag_oi")), { shouldDirty: true })
                        }}
                        className="px-2.5 py-1 rounded-full text-xs border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Diagnóstico general / notas clínicas</Label>
                <Textarea rows={3} placeholder="Observaciones clínicas adicionales, antecedentes relevantes…" {...register("diagnostico")} />
              </div>
              <div className="space-y-1">
                <Label>Plan de tratamiento</Label>
                <Textarea rows={3} {...register("plan_tratamiento")} />
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea rows={2} {...register("observaciones")} />
              </div>
              <div className="space-y-1 max-w-xs">
                <Label>Próximo control</Label>
                <Input type="date" {...register("proximo_control")} />
              </div>
            </div>
          )}

          {/* 6 - Receta Lentes Convencionales */}
          {seccion === 6 && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="font-semibold text-sm">Lentes Convencionales</h3>
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm">
                <div />
                {["Esfera", "Cilindro", "Eje", "Adición", "DNP", "Altura"].map(h => (
                  <div key={h} className="text-center text-xs font-medium text-muted-foreground">{h}</div>
                ))}
                {["od", "oi"].map(eye => (
                  <>
                    <div key={eye} className="font-semibold text-xs">{eye.toUpperCase()}</div>
                    {["esf", "cil", "eje", "add", "dnp", "alt"].map(f => (
                      <Input
                        key={f}
                        type="number"
                        step={f === "eje" ? "1" : f === "dnp" || f === "alt" ? "0.5" : "0.25"}
                        min={f === "eje" ? "0" : undefined}
                        max={f === "eje" ? "180" : undefined}
                        className="h-8 text-center text-xs"
                        placeholder={f === "eje" ? "°" : "0.00"}
                        {...register(`lc_${eye}_${f}` as any)}
                      />
                    ))}
                  </>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="space-y-1">
                  <Label>Tipo de lente</Label>
                  <select {...register("tipo_lente")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">— seleccionar —</option>
                    <option>Monofocal</option>
                    <option>Bifocal</option>
                    <option>Progresivo</option>
                    <option>Ocupacional</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de armadura</Label>
                  <Input placeholder="Metal, acetato…" {...register("tipo_armadura")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea rows={2} {...register("obs_lc")} />
              </div>
            </div>
          )}

          {/* 7 - Contactología */}
          {seccion === 7 && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="font-semibold text-sm">Lentes de Contacto</h3>
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center text-sm">
                <div />
                {["Marca", "BC", "Diámetro", "Esfera", "Cilindro", "Eje"].map(h => (
                  <div key={h} className="text-center text-xs font-medium text-muted-foreground">{h}</div>
                ))}
                {["od", "oi"].map(eye => (
                  <>
                    <div key={eye} className="font-semibold text-xs">{eye.toUpperCase()}</div>
                    {[
                      { f: "marca", type: "text",   placeholder: "Ej: Acuvue" },
                      { f: "bc",    type: "number", step: "0.01", min: "0",   placeholder: "8.60" },
                      { f: "diam",  type: "number", step: "0.01", min: "0",   placeholder: "14.0" },
                      { f: "esf",   type: "number", step: "0.25",             placeholder: "0.00" },
                      { f: "cil",   type: "number", step: "0.25",             placeholder: "0.00" },
                      { f: "eje",   type: "number", step: "1",   min: "0", max: "180", placeholder: "°" },
                    ].map(({ f, type, step, min, max, placeholder }) => (
                      <Input
                        key={f}
                        type={type}
                        step={step}
                        min={min}
                        max={max}
                        placeholder={placeholder}
                        className="h-8 text-center text-xs"
                        {...register(`cl_${eye}_${f}` as any)}
                      />
                    ))}
                  </>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea rows={2} {...register("obs_cl")} />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Footer navigation */}
      <div className="flex justify-between px-6 py-3 border-t bg-background">
        <Button variant="outline" onClick={() => setSeccion(s => Math.max(0, s - 1))} disabled={seccion === 0}>
          ← Anterior
        </Button>
        <span className="text-sm text-muted-foreground self-center">{seccion + 1} / {SECTIONS.length}</span>
        <Button variant="outline" onClick={() => setSeccion(s => Math.min(SECTIONS.length - 1, s + 1))} disabled={seccion === SECTIONS.length - 1}>
          Siguiente →
        </Button>
      </div>
    </div>
  )
}
