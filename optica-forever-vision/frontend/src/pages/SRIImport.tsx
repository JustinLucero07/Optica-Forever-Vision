import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SRIItem {
  codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

interface SRIResult {
  cxp_id: number | null
  proveedor: string
  ruc: string
  numero: string
  fecha: string
  subtotal: number
  iva: number
  total: number
  items: SRIItem[]
  guardado: boolean
  mensaje: string
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

export default function SRIImport() {
  const [file, setFile] = useState<File | null>(null)
  const [resultado, setResultado] = useState<SRIResult | null>(null)
  const [dragging, setDragging] = useState(false)

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
      toast.success(data.mensaje)
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? "Error al procesar el XML")
    },
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
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Importar Factura SRI</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el archivo XML de un comprobante electrónico emitido por el SRI (facturas de proveedores).
          Se registrará automáticamente como Cuenta por Pagar.
        </p>
      </div>

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
              <p className="font-medium">Procesando XML del SRI…</p>
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
              {file && !importMut.isPending && (
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
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-green-800">{resultado.mensaje}</p>
              {resultado.cxp_id && (
                <p className="text-sm text-green-700 mt-0.5">
                  Creada como Cuenta por Pagar #{resultado.cxp_id} —{" "}
                  <Link to="/cobros" className="underline font-medium">
                    Ver en Cobros / CxP
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Datos del Comprobante
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
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Subtotal (sin IVA)" value={fmt(resultado.subtotal)} />
                <Row label="IVA" value={fmt(resultado.iva)} />
                <Row label="Total" value={<span className="font-bold text-base">{fmt(resultado.total)}</span>} />
              </CardContent>
            </Card>
          </div>

          {resultado.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detalle de Productos / Servicios</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Descripción</th>
                      <th className="text-right px-4 py-2 font-medium w-20">Cant.</th>
                      <th className="text-right px-4 py-2 font-medium w-28">P. Unit.</th>
                      <th className="text-right px-4 py-2 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resultado.items.map((it, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-2">
                          {it.codigo && <span className="text-xs text-muted-foreground mr-2">[{it.codigo}]</span>}
                          {it.descripcion}
                        </td>
                        <td className="px-4 py-2 text-right">{it.cantidad}</td>
                        <td className="px-4 py-2 text-right">{fmt(it.precio_unitario)}</td>
                        <td className="px-4 py-2 text-right font-medium">{fmt(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
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
            <CardTitle className="text-sm text-muted-foreground">¿Cómo obtener el XML del SRI?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Ingresa al portal del SRI: <strong>sri.gob.ec</strong> → Servicios en Línea</p>
            <p>2. Busca en "Comprobantes Electrónicos Recibidos" o pídele al proveedor el XML firmado</p>
            <p>3. Descarga el archivo <strong>.xml</strong> del comprobante electrónico</p>
            <p>4. Súbelo aquí — el sistema extraerá automáticamente los datos y creará la cuenta por pagar</p>
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
