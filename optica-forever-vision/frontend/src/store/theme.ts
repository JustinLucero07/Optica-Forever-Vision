import { create } from "zustand"
import { persist } from "zustand/middleware"

interface ThemeState {
  dark: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      toggle: () => {
        const next = !get().dark
        set({ dark: next })
        document.documentElement.classList.toggle("dark", next)
      },
    }),
    { name: "fv-theme" }
  )
)

export function initTheme() {
  try {
    const raw = localStorage.getItem("fv-theme")
    if (raw) {
      const { state } = JSON.parse(raw)
      document.documentElement.classList.toggle("dark", !!state.dark)
    }
  } catch { /* noop */ }
}
