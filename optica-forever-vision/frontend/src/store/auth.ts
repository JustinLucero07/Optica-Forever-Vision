import { create } from "zustand"

export type Role = "admin" | "optometrista" | "vendedor" | "cajero"

export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: Role
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  sessionExpired: boolean
  setSession: (token: string, user: AuthUser, remember?: boolean) => void
  logout: () => void
  markExpired: () => void
  clearExpired: () => void
}

const STORE_KEY = "ofv-auth"

function loadAuth(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* */ }
  return null
}

const loaded = loadAuth()

export const useAuthStore = create<AuthState>()((set) => ({
  token: loaded?.token ?? null,
  user: loaded?.user ?? null,
  sessionExpired: false,

  setSession: (token, user, remember = true) => {
    set({ token, user, sessionExpired: false })
    const payload = JSON.stringify({ token, user })
    if (remember) {
      localStorage.setItem(STORE_KEY, payload)
      sessionStorage.removeItem(STORE_KEY)
    } else {
      sessionStorage.setItem(STORE_KEY, payload)
      localStorage.removeItem(STORE_KEY)
    }
  },

  logout: () => {
    set({ token: null, user: null, sessionExpired: false })
    localStorage.removeItem(STORE_KEY)
    sessionStorage.removeItem(STORE_KEY)
  },

  markExpired: () => {
    set({ token: null, user: null, sessionExpired: true })
    localStorage.removeItem(STORE_KEY)
    sessionStorage.removeItem(STORE_KEY)
  },

  clearExpired: () => set({ sessionExpired: false }),
}))
