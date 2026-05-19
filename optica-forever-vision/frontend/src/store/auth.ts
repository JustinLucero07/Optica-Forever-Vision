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
  setSession: (token: string, user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "ofv-auth" }
  )
)
