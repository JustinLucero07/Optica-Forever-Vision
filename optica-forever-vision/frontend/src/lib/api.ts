import axios from "axios"
import { useAuthStore } from "@/store/auth"

export const api = axios.create({
  baseURL: "/api/v1",
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // Solo desloguear si es un error de token (inválido o expirado),
      // no por falta de permisos en un recurso específico
      const authError = err.response?.headers?.["x-auth-error"]
      const hasToken = useAuthStore.getState().token
      if (hasToken && authError === "token_invalid") {
        useAuthStore.getState().markExpired()
      } else if (hasToken) {
        // 401 genérico con token presente → sesión expirada
        useAuthStore.getState().markExpired()
      }
    }
    return Promise.reject(err)
  }
)
