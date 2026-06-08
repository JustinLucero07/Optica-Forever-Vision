import type { AxiosError } from "axios"

type ApiErrorBody = { detail?: string | Array<{ msg?: string; loc?: unknown[] }> }

export function errMsg(e: unknown, fallback = "Error inesperado"): string {
  const err = e as AxiosError<ApiErrorBody>
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (first?.msg) return first.msg
    return fallback
  }
  return fallback
}
