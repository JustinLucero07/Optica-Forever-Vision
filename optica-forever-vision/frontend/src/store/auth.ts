import { create } from "zustand"
import { persist } from "zustand/middleware"

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
  setSession: (token: string, user: AuthUser) => void
  logout: () => void
  markExpired: () => void
  clearExpired: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sessionExpired: false,
      setSession: (token, user) => set({ token, user, sessionExpired: false }),
      logout: () => set({ token: null, user: null, sessionExpired: false }),
      markExpired: () => set({ token: null, user: null, sessionExpired: true }),
      clearExpired: () => set({ sessionExpired: false }),
    }),
    {
      name: "ofv-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
)
