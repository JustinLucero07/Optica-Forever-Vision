import { create } from "zustand"
import { persist } from "zustand/middleware"

// Teal/Cian como color base — coincide con el logo de Óptica Forever Vision
const DEFAULT_HSL = "187 80% 40%"
const DEFAULT_HEX = "#0d9ead"

export const COLOR_PRESETS = [
  { name: "Teal FV",    hsl: "187 80% 40%", hex: "#0d9ead" },  // Logo color
  { name: "Cian",       hsl: "191 97% 35%", hex: "#0891b2" },
  { name: "Índigo",     hsl: "252 87% 58%", hex: "#6d28d9" },
  { name: "Azul",       hsl: "221 83% 53%", hex: "#3b82f6" },
  { name: "Esmeralda",  hsl: "160 84% 39%", hex: "#059669" },
  { name: "Rosa",       hsl: "330 81% 55%", hex: "#ec4899" },
  { name: "Ámbar",      hsl: "32 95% 44%",  hex: "#d97706" },
  { name: "Pizarra",    hsl: "215 28% 45%", hex: "#64748b" },
]

export type WaMode = "wame" | "cloud_api"

interface BrandState {
  logo: string | null
  primaryHsl: string
  primaryHex: string
  waMode: WaMode
  setLogo: (v: string | null) => void
  setPrimary: (hsl: string, hex: string) => void
  setWaMode: (mode: WaMode) => void
}

export const useBrandStore = create<BrandState>()(
  persist(
    (set) => ({
      logo: null,
      primaryHsl: DEFAULT_HSL,
      primaryHex: DEFAULT_HEX,
      waMode: "wame",
      setLogo: (logo) => set({ logo }),
      setPrimary: (hsl, hex) => {
        set({ primaryHsl: hsl, primaryHex: hex })
        applyPrimary(hsl)
      },
      setWaMode: (waMode) => set({ waMode }),
    }),
    { name: "fv-brand" }
  )
)

export function applyPrimary(hsl: string) {
  const r = document.documentElement
  r.style.setProperty("--primary", hsl)
  r.style.setProperty("--ring", hsl)
}

export function initBrand() {
  try {
    const raw = localStorage.getItem("fv-brand")
    if (raw) {
      const { state } = JSON.parse(raw)
      if (state?.primaryHsl) applyPrimary(state.primaryHsl)
      else applyPrimary(DEFAULT_HSL)
    } else {
      applyPrimary(DEFAULT_HSL)
    }
  } catch { applyPrimary(DEFAULT_HSL) }
}
