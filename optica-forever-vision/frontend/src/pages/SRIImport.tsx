import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2,
  ExternalLink, Link2, Save, Trash2
} from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import { errMsg } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Producto { id: number; nombre: string; codigo: string | null }

interface SRIItem {
  codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  // matching
  match: "mapeado" | "codigo_directo" | "sugerido" | "sin_match"
  producto_id: number | null
  producto_nombre: string | null
  producto_codigo: string | null
}

interface SRIResult {
  cxp_id: number | null
  proveedor: string
  proveedor_id: number | null
  proveedor_nombre: string | null
  ruc: string
  numero: string
  fecha: string
  subtotal: number
  iva: number
  total: number
  items: SRIItem[]
  guardado: boolean
  items_con_match: number
  items_sin_match: number
  mensaje: string
}

interface MapeoExistente {
  id: number
  proveedor_id: number | null
  codigo_proveedor: string
  descripcion_proveedor: string | null
  producto_id: number
  producto_nombre: string | null
  producto_codigo: string | null
}

const MATCH_LABEL: Record<string, { label: string; cls: string }> = {
  mapeado:       { label: "Mapeado",       cls: "bg-green-100 text-green-800" },
  codigo_directo:{ label: "Código exacto", cls: "bg-blue-100 text-blue-800" },
  sugerido:      { label: "Sugerido",      cls: "bg-amber-100 text-amber-800" },
  sin_match:     { label: "Sin vincular",  cls: "bg-red-100 text-red-700" },
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default function SRIImport() {
  const qc = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [resultado, setResultado] = useState<SRIResult | null>(null)
  const [dragging, setDragging] = useState(false)
  // mapeos locales: indice item → producto_id seleccionado por usuario
  const [overrides, setOverrides] = useState<Record<number, number>>({})
  const [showMapeos, setShowMapeos] = useState(false)
  const [prodSearch, setProdSearch] = useState<Record<number, string>>({})

  const { data: productos = [] } = useQuery<Producto[]>({
    queryKey: ["productos-mini"],
    queryFn: () => api.get("/productos", { params: { limit: 500 } }).then(r => r.data),
  })

  const { data: mapeos = [], refetch: refetchMapeos } = useQuery<MapeoExistente[]>({
    queryKey: ["sri-mapeos"],
    queryFn: () => api.get("/sri/mapeos").then(r => r.data),
    enabled: showMapeos,
  })

  const importMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData()
      fd.append("file", f)
      return api.post<SRIResult>("/sri/importar-xml", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then(r => r.data)
    },
    onSuccess: (data) => {
      setResultado(data)
      setOverrides({})
      toast.success(data.mensaje)
    },
    onError: (e) => toast.error(errMsg(e, "Error al procesar el XML")),
  })

  const mapearMut = useMutation({
    mutationFn: (mapeos: Array<{ codigo_proveedor: string; descripcion_proveedor: string; producto_id: number; proveedor_id: number | null }>) =>
      api.post("/sri/mapear-items", { mapeos }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.mensaje)
      qc.invalidateQueries({ queryKey: ["sri-mapeos"] })
    },
    onError: () => toast.error("Error al guardar mapeos"),
  })

  const deleteMapMut = useMutation({
    mutationFn: (id: number) => api.delete(`/sri/mapeos/${id}`),
    onSuccess: () => { refetchMapeos(); toast.success("Mapeo eliminado") },
  })

  function handleFile(f: File) {
    if (!f.name.endsWith(".xml")) {
      toast.error("Solo se aceptan archivos .xml del SRI")
      return
    }
    setFile(f)
    setResultado(null)
    importMut.mutate(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ""
  }

  function reset() {
    setFile(null)
    setResultado(null)
    setOverrides({})
  }

  function guardarMapeos() {
    if (!resultado) return
    const nuevos: Array<{ codigo_proveedor: string; descripcion_proveedor: string; producto_id: number; proveedor_id: number | null }> = []

    resultado.items.forEach((item, idx) => {
      // Solo guardamos mapeos donde el usuario hizo una selección manual O donde había sin_match y ahora tienen override
      if (overrides[idx] && item.codigo) {
        nuevos.push({
          codigo_proveedor: item.codigo,
          descripcion_proveedor: item.descripcion,
          producto_id: overrides[idx],
          proveedor_id: resultado.proveedor_id,
        })
      }
    })

    if (nuevos.length === 0) {
      toast.info("No hay nuevas vinculaciones para guardar")
      return
    }
    mapearMut.mutate(nuevos)
  }

  const hayOverrides = Object.keys(overrides).length > 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importar Factura SRI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sube el XML del SRI — los ítems se vinculan automáticamente a tu inventario.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowMapeos(!showMapeos)}>
          <Link2 className="h-4 w-4 mr-1" />
          {showMapeos ? "Ocultar mapeos" : "Ver mapeos guardados"}
        </Button>
      </div>

      {/* Tabla de mapeos guardados */}
      {showMapeos && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Mapeos de códigos guardados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {mapeos.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Ningún mapeo guardado aún.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Código proveedor</th>
                    <th className="text-left px-4 py-2 font-medium">Descripción en factura</th>
                    <th className="text-left px-4 py-2 font-medium">→ Producto interno</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mapeos.map(m => (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{m.codigo_proveedor}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.descripcion_proveedor ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className="font-medium">{m.producto_nombre}</span>
                        {m.producto_codigo && <span className="text-xs text-muted-foreground ml-1">[{m.producto_codigo}]</span>}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => deleteMapMut.mutate(m.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drop zone */}
      {!resultado && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors
            ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          `}
        >
          {importMut.isPending ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Procesando XML y buscando productos…</p>
              <p className="text-sm">{file?.name}</p>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-3">
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Arrastra el XML aquí o haz clic para seleccionar</p>
                <p className="text-sm text-muted-foreground mt-1">Comprobantes electrónicos del SRI — formato .xml</p>
              </div>
              {file && (
                <Badge variant="outline" className="mt-1">
                  <FileText className="h-3 w-3 mr-1" />{file.name}
                </Badge>
              )}
              <input type="file" accept=".xml" className="sr-only" onChange={handleInputChange} />
            </label>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-4">
          {/* Banner de estado */}
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${resultado.items_sin_match > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
            {resultado.items_sin_match > 0
              ? <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              : <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              <p className={`font-medium ${resultado.items_sin_match > 0 ? "text-amber-800" : "text-green-800"}`}>
                {resultado.mensaje}
              </p>
              {resultado.proveedor_nombre && (
                <p className="text-sm mt-0.5 text-muted-foreground">
                  Proveedor vinculado: <strong>{resultado.proveedor_nombre}</strong>
                </p>
              )}
              {resultado.cxp_id && (
                <p className="text-sm mt-0.5 text-muted-foreground">
                  Cuenta por Pagar #{resultado.cxp_id} creada —{" "}
                  <Link to="/cobros" className="underline font-medium">Ver en CxP</Link>
                </p>
              )}
              {resultado.items_sin_match > 0 && (
                <p className="text-sm mt-1 text-amber-700">
                  {resultado.items_sin_match} ítem(s) sin vincular — selecciónalos abajo y guarda el mapeo para que se detecten automáticamente la próxima vez.
                </p>
              )}
            </div>
          </div>

          {/* Datos comprobante + valores */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Comprobante
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Proveedor" value={resultado.proveedor} />
                <Row label="RUC" value={resultado.ruc} />
                <Row label="N° Factura" value={resultado.numero} />
                <Row label="Fecha" value={fmtDate(resultado.fecha)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Subtotal (sin IVA)" value={fmt(resultado.subtotal)} />
                <Row label="IVA" value={fmt(resultado.iva)} />
                <Row label="Total" value={<span className="font-bold text-base">{fmt(resultado.total)}</span>} />
              </CardContent>
            </Card>
          </div>

          {/* Items con matching */}
          {resultado.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">
                  Ítems de la factura
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({resultado.items_con_match} vinculados, {resultado.items_sin_match} pendientes)
                  </span>
                </CardTitle>
                {hayOverrides && (
                  <Button size="sm" onClick={guardarMapeos} disabled={mapearMut.isPending}>
                    {mapearMut.isPending
                      ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      : <Save className="h-4 w-4 mr-1" />
                    }
                    Guardar vinculaciones
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Ítem del proveedor</th>
                      <th className="text-right px-4 py-2 font-medium w-16">Cant.</th>
                      <th className="text-right px-4 py-2 font-medium w-24">Subtotal</th>
                      <th className="text-left px-4 py-2 font-medium w-64">Producto en inventario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resultado.items.map((item, idx) => {
                      const matchInfo = MATCH_LABEL[item.match] ?? MATCH_LABEL.sin_match
                      const selectedPid = overrides[idx] ?? item.producto_id ?? undefined
                      const noMatch = item.match === "sin_match" && !overrides[idx]

                      return (
                        <tr key={idx} className={`hover:bg-muted/30 ${noMatch ? "bg-red-50/40" : ""}`}>
                          <td className="px-4 py-2">
                            <div className="flex flex-col gap-0.5">
                              {item.codigo && (
                                <span className="font-mono text-xs text-muted-foreground">{item.codigo}</span>
                              )}
                              <span>{item.descripcion || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">{item.cantidad}</td>
                          <td className="px-4 py-2 text-right font-medium">{fmt(item.subtotal)}</td>
                          <td className="px-4 py-2">
                            {item.codigo ? (
                              <div className="flex flex-col gap-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium w-fit ${matchInfo.cls}`}>
                                  {overrides[idx] ? "Vinculado ✓" : matchInfo.label}
                                </span>
                                <ProdSelector
                                  productos={productos}
                                  value={selectedPid}
                                  search={prodSearch[idx] ?? ""}
                                  onSearch={s => setProdSearch(prev => ({ ...prev, [idx]: s }))}
                                  onChange={pid => {
                                    setOverrides(prev => pid ? { ...prev, [idx]: pid } : (() => { const n = { ...prev }; delete n[idx]; return n })())
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin código proveedor</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {hayOverrides && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <Link2 className="h-4 w-4 flex-shrink-0" />
              Tienes {Object.keys(overrides).length} vinculación(es) nuevas.{" "}
              <button onClick={guardarMapeos} className="underline font-medium">
                Guardar ahora
              </button>{" "}
              para que se detecten automáticamente la próxima vez.
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={reset} variant="outline">
              <Upload className="h-4 w-4 mr-2" /> Importar otro XML
            </Button>
            <Button asChild variant="default">
              <Link to="/cobros">
                <ExternalLink className="h-4 w-4 mr-2" /> Ver Cuentas por Pagar
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Instrucciones */}
      {!resultado && !importMut.isPending && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">¿Cómo funciona la vinculación?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• El sistema busca el código del ítem en tu inventario automáticamente</p>
            <p>• Si ya mapeaste ese código antes → se vincula de una (ícono verde)</p>
            <p>• Si no lo encuentra → selecciona el producto manualmente y guarda el mapeo</p>
            <p>• La próxima vez que llegue ese código del mismo proveedor → detección automática</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ProdSelector({
  productos, value, search, onSearch, onChange,
}: {
  productos: Producto[]
  value: number | undefined
  search: string
  onSearch: (s: string) => void
  onChange: (pid: number | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const selProd = value ? productos.find(p => p.id === value) : null
  const filtered = productos.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q)
  })

  return (
    <div className="relative">
      <div
        className="border rounded px-2 py-1 text-xs bg-background cursor-pointer flex items-center justify-between gap-1 min-h-[28px]"
        onClick={() => setOpen(o => !o)}
      >
        {selProd
          ? <span className="truncate">{selProd.nombre}{selProd.codigo ? ` [${selProd.codigo}]` : ""}</span>
          : <span className="text-muted-foreground">— Buscar producto —</span>
        }
        <span className="text-muted-foreground shrink-0">▾</span>
      </div>
      {open && (
        <div className="absolute z-30 w-72 mt-1 bg-background border rounded-md shadow-xl">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              className="w-full px-2 py-1 text-xs border rounded outline-none bg-background"
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={e => onSearch(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setOpen(false)}
            />
          </div>
          <div className="max-h-48 overflow-auto">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted text-muted-foreground"
              onMouseDown={() => { onChange(undefined); onSearch(""); setOpen(false) }}
            >
              — Sin vincular —
            </button>
            {filtered.slice(0, 30).map(p => (
              <button
                key={p.id}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex gap-2 ${p.id === value ? "bg-primary/10 font-semibold" : ""}`}
                onMouseDown={() => { onChange(p.id); onSearch(""); setOpen(false) }}
              >
                {p.codigo && <span className="font-mono text-muted-foreground shrink-0">[{p.codigo}]</span>}
                <span className="truncate">{p.nombre}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
