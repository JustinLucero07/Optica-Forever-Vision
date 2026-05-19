import { api } from "@/lib/api"
import { toast } from "sonner"

// ── wa.me (manual) ─────────────────────────────────────────────────────────────
/**
 * Opens a wa.me link — staff reviews and sends manually from their phone.
 */
export function abrirWhatsApp(telefono: string | null | undefined, mensaje: string) {
  if (!telefono) {
    alert("El paciente no tiene teléfono registrado")
    return
  }
  const digits = telefono.replace(/\D/g, "")
  const num = digits.startsWith("593") ? digits
    : digits.startsWith("0") ? "593" + digits.slice(1)
    : "593" + digits
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, "_blank")
}

// ── Meta API helpers ───────────────────────────────────────────────────────────
function varParam(text: string) {
  return { type: "text", text }
}
function bodyComponent(...vars: string[]) {
  return [{ type: "body", parameters: vars.map(varParam) }]
}

/**
 * Sends a WhatsApp template via the backend Meta API.
 * Shows a toast on success or error.
 */
async function enviarTemplate(
  telefono: string | null | undefined,
  template: string,
  vars: string[],
  label = "Mensaje enviado"
) {
  if (!telefono) {
    toast.error("El paciente no tiene teléfono registrado")
    return
  }
  try {
    await api.post("/whatsapp/send-template", {
      telefono,
      template,
      lang: "es",
      components: bodyComponent(...vars),
    })
    toast.success(label)
  } catch (e: any) {
    toast.error(e?.response?.data?.detail ?? "Error enviando WhatsApp")
  }
}

// ── Exported senders ───────────────────────────────────────────────────────────

/** Enviar recordatorio de cita (plantilla: recordatorio_cita_optica) */
export function enviarRecordatorioCita(
  telefono: string | null | undefined,
  nombre: string,
  fecha: string,  // ej: "lunes 20 de mayo"
  hora: string    // ej: "10:30"
) {
  return enviarTemplate(telefono, "recordatorio_cita_optica", [nombre, fecha, hora], "Recordatorio enviado")
}

/** Enviar aviso de orden lista (plantilla: orden_lista, idioma en_US) */
export function enviarOrdenLista(
  telefono: string | null | undefined,
  nombre: string,
  numeroOrden: string
) {
  if (!telefono) {
    toast.error("El paciente no tiene teléfono registrado")
    return
  }
  return api.post("/whatsapp/send-template", {
    telefono,
    template: "orden_lista",
    lang: "en_US",
    components: bodyComponent(nombre, numeroOrden),
  }).then(() => toast.success("Aviso de orden enviado"))
    .catch((e: any) => toast.error(e?.response?.data?.detail ?? "Error enviando WhatsApp"))
}

/** Enviar saludo de cumpleaños (plantilla: cumpleanos_optica) */
export function enviarCumpleanios(
  telefono: string | null | undefined,
  nombre: string
) {
  return enviarTemplate(telefono, "cumpleanos_optica", [nombre], "Mensaje de cumpleaños enviado")
}

// ── Message builders (for wa.me manual sends) ──────────────────────────────────

export function msgTurno(nombre: string, fecha: string, hora: string) {
  return `Hola ${nombre} 👋, le recordamos su *cita en Óptica Forever Vision* el día *${fecha}* a las *${hora}*.\n\nDirección: Av. 24 de mayo y Puyo, Cuenca.\n¡Le esperamos! 👁️`
}

export function msgOrdenLista(nombre: string, numero: string) {
  return `Hola ${nombre} 👋, sus lentes *(${numero})* en *Óptica Forever Vision* están *LISTOS* para retirar. ✅\n\nHorario: lun-sáb 9:00-18:00\nDirección: Av. 24 de mayo y Puyo, Cuenca.\n¡Le esperamos! 👓`
}

export function msgCumpleanios(nombre: string) {
  return `¡Feliz cumpleaños ${nombre}! 🎂🎉\n\nEn *Óptica Forever Vision* le deseamos un excelente día lleno de alegría.\n\nComo regalo de cumpleaños tiene un *DESCUENTO ESPECIAL* en su próxima visita. 🎁👓\n\n¡Visítenos pronto! Av. 24 de mayo y Puyo, Cuenca.`
}

export function msgRecordatorio(nombre: string) {
  return `Hola ${nombre} 👋, le saludamos desde *Óptica Forever Vision*.\n\nRecuerde que es importante realizarse un control visual periódico para cuidar su salud ocular. 👁️\n\n¡Con gusto le atendemos! Av. 24 de mayo y Puyo, Cuenca.`
}
