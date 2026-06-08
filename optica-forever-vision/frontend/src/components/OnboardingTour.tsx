import { useState, useEffect } from "react"
import { X, ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const STEPS = [
  {
    title: "¡Bienvenido a Óptica Forever Vision!",
    body: "Este sistema te ayuda a gestionar pacientes, consultas, órdenes de lentes, ventas y cobros en un solo lugar.",
    icon: "👓",
  },
  {
    title: "Menú de navegación",
    body: "En el panel izquierdo encontrarás todos los módulos: Pacientes, Turnos, Consultas, Ventas, Órdenes Lab, Cobros, Créditos y más.",
    icon: "🗂️",
  },
  {
    title: "Buscador global",
    body: "Presiona Ctrl+K en cualquier momento para buscar pacientes, ventas, órdenes o créditos rápidamente.",
    icon: "🔍",
  },
  {
    title: "Flujo principal",
    body: "El flujo típico es: Turno → Consulta → Orden de lente → Venta → Cobro. Cada módulo se conecta automáticamente.",
    icon: "🔄",
  },
  {
    title: "Documentos PDF",
    body: "Puedes imprimir comprobantes, órdenes de trabajo, aceptaciones y etiquetas desde cada módulo con el logo de la óptica.",
    icon: "🖨️",
  },
]

const STORAGE_KEY = "fv-tour-done"

export default function OnboardingTour() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Show after 1s delay so the app is fully loaded
      const t = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(t)
    }
  }, [])

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 relative">
        <button
          onClick={finish}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center space-y-3">
          <div className="text-5xl">{current.icon}</div>
          <h2 className="text-xl font-bold">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>

        <div className="flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>
              ¡Empezar! 🚀
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <button onClick={finish} className="underline hover:text-foreground">Saltar tour</button>
        </p>
      </div>
    </div>
  )
}
