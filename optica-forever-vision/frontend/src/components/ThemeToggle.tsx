import { Moon, Sun } from "lucide-react"
import { useThemeStore } from "@/store/theme"

export default function ThemeToggle() {
  const { dark, toggle } = useThemeStore()
  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-lg hover:bg-white/15 transition-colors text-white/70 hover:text-white"
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
