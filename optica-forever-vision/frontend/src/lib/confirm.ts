import { toast } from "sonner"

/**
 * Eliminar con posibilidad de deshacer.
 * Llama onConfirm tras 4s si el usuario no cancela.
 */
export function deleteWithUndo(
  message: string,
  onConfirm: () => void,
  onUndo?: () => void,
) {
  let cancelled = false
  const id = toast(message, {
    duration: 4500,
    action: {
      label: "Deshacer",
      onClick: () => {
        cancelled = true
        onUndo?.()
        toast.dismiss(id)
      },
    },
  })
  setTimeout(() => {
    if (!cancelled) onConfirm()
  }, 4600)
}

/**
 * Confirmación destructiva simple sin undo.
 * Muestra toast con botón Confirmar / Cancelar.
 */
export function confirmAction(
  message: string,
  onConfirm: () => void,
  label = "Confirmar",
) {
  toast(message, {
    duration: 8000,
    action: {
      label,
      onClick: onConfirm,
    },
  })
}
