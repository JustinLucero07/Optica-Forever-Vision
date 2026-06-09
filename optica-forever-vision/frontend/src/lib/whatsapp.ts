import { api } from "@/lib/api"
import { toast } from "sonner"
import { errMsg } from "@/lib/errors"
import { useBrandStore } from "@/store/brand"

function getMode() {
  return useBrandStore.getState().waMode ?? "wame"
}

// ── wa.me (manual) ─────────────────────────────────────────────────────────────

export function abrirWhatsApp(telefono: string | null | undefined, mensaje: string) {
  if (!telefono) {
    toast.error("El paciente no tiene teléfono registrado")
    return
  }
  const digits = telefono.replace(/\D/g, "")
  const num = digits.startsWith("593") ? digits
    : digits.startsWith("0") ? "593" + digits.slice(1)
    : "593" + digits
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, "_blank")
}

// ── Cloud API helpers ───────────────────────────────────────────────────────────

function varParam(text: string) {
  return { type: "text", text }
}
function bodyComponent(...vars: string[]) {
  return [{ type: "body", parameters: vars.map(varParam) }]
}

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
  } catch (e) {
    toast.error(errMsg(e, "Error enviando WhatsApp"))
  }
}

// ── Message builders (wa.me) ───────────────────────────────────────────────────

const FIRMA = "Optica Forever Vision\nAv. 24 de mayo y Puyo, Cuenca."

export function msgTurno(nombre: string, fecha: string, hora: string, motivo?: string) {
  const lineas = [
    `Hola ${nombre} 👋`,
    `Le recordamos su cita en Optica Forever Vision.`,
    ``,
    `📅 Fecha: ${fecha}`,
    `🕐 Hora: ${hora}`,
    motivo ? `📋 Motivo: ${motivo}` : "",
    ``,
    `Por favor presentese 5 minutos antes.`,
    ``,
    FIRMA,
  ].filter(l => l !== "")
  return lineas.join("\n")
}

export function msgOrdenLista(nombre: string, numero: string) {
  const lineas = [
    `Hola ${nombre} 👓`,
    `Sus lentes estan listos para retirar.`,
    ``,
    `📋 Orden: ${numero}`,
    ``,
    `📍 Av. 24 de mayo y Puyo, Cuenca`,
    `🕐 Lun–Vie 9:00–18:00 / Sab 9:00–14:00`,
    ``,
    `Le esperamos 😊`,
  ]
  return lineas.join("\n")
}

export function msgCumpleanios(nombre: string) {
  const lineas = [
    `🎂 Feliz cumpleanos, ${nombre}!`,
    ``,
    `En Optica Forever Vision le deseamos un maravilloso dia.`,
    ``,
    `Venga a visitarnos y consulte nuestras promociones especiales.`,
    ``,
    FIRMA,
  ]
  return lineas.join("\n")
}

export function msgControlVisual(nombre: string, fechaControl: string) {
  const lineas = [
    `Hola ${nombre} 👋`,
    `Le recordamos que tiene su proximo control visual programado para el ${fechaControl}.`,
    ``,
    `👓 Por favor comuniquese con nosotros para confirmar o agendar su cita.`,
    ``,
    FIRMA,
  ]
  return lineas.join("\n")
}

export function msgRecordatorio(nombre: string) {
  const lineas = [
    `Hola ${nombre} 👋`,
    `Le saludamos desde Optica Forever Vision.`,
    ``,
    `Recuerde que es importante realizarse un control visual periodico para cuidar su salud ocular. 👁️`,
    ``,
    `Con gusto le atendemos.`,
    ``,
    FIRMA,
  ]
  return lineas.join("\n")
}

export function msgCuota(
  nombre: string,
  numeroCuota: string,
  totalCuotas: string,
  numeroCred: string,
  monto: string,
  fechaVenc: string
) {
  const lineas = [
    `Hola ${nombre} 👋`,
    `Le recordamos el vencimiento de su cuota de credito.`,
    ``,
    `💳 Credito: ${numeroCred}`,
    `📌 Cuota: ${numeroCuota} de ${totalCuotas}`,
    `💵 Monto: $${monto}`,
    `📅 Vence: ${fechaVenc}`,
    ``,
    `Si ya realizo el pago, ignore este mensaje.`,
    ``,
    FIRMA,
  ]
  return lineas.join("\n")
}

export function msgAbono(
  nombre: string,
  numeroCred: string,
  numeroCuota: string,
  totalCuotas: string,
  monto: string,
  fecha: string,
  saldo: string
) {
  const lineas = [
    `✅ Hola ${nombre}, confirmamos su pago en Optica Forever Vision.`,
    ``,
    `💳 Credito: ${numeroCred}`,
    `📌 Cuota: ${numeroCuota} de ${totalCuotas}`,
    `💵 Monto abonado: $${monto}`,
    `📅 Fecha: ${fecha}`,
    `💰 Saldo pendiente: $${saldo}`,
    ``,
    `Gracias por su pago. Guarde este mensaje como comprobante.`,
    ``,
    FIRMA,
  ]
  return lineas.join("\n")
}

// ── Exported senders ───────────────────────────────────────────────────────────

/** Recordatorio de cita (manual botón en Turnos) */
export function enviarRecordatorioCita(
  telefono: string | null | undefined,
  nombre: string,
  fecha: string,
  hora: string,
  motivo?: string
) {
  if (getMode() === "cloud_api") {
    const vars = motivo ? [nombre, fecha, hora, motivo] : [nombre, fecha, hora, ""]
    return enviarTemplate(telefono, "recordatorio_cita_optica", vars, "Recordatorio de cita enviado")
  }
  return abrirWhatsApp(telefono, msgTurno(nombre, fecha, hora, motivo))
}

/** Orden de laboratorio lista */
export function enviarOrdenLista(
  telefono: string | null | undefined,
  nombre: string,
  numeroOrden: string
) {
  if (getMode() === "cloud_api") {
    if (!telefono) { toast.error("El paciente no tiene teléfono registrado"); return }
    return api.post("/whatsapp/send-template", {
      telefono,
      template: "orden_lista",
      lang: "es",
      components: bodyComponent(nombre, numeroOrden),
    }).then(() => toast.success("Aviso de orden enviado"))
      .catch((e: unknown) => toast.error(errMsg(e, "Error enviando WhatsApp")))
  }
  return abrirWhatsApp(telefono, msgOrdenLista(nombre, numeroOrden))
}

/** Felicitación de cumpleaños */
export function enviarCumpleanios(
  telefono: string | null | undefined,
  nombre: string
) {
  if (getMode() === "cloud_api") {
    return enviarTemplate(telefono, "cumpleanos_optica", [nombre], "Mensaje de cumpleaños enviado")
  }
  return abrirWhatsApp(telefono, msgCumpleanios(nombre))
}

/** Recordatorio de cuota de crédito próxima a vencer */
export function enviarRecordatorioCuota(
  telefono: string | null | undefined,
  nombre: string,
  numeroCuota: string,
  totalCuotas: string,
  numeroCred: string,
  monto: string,
  fechaVenc: string
) {
  if (getMode() === "cloud_api") {
    return enviarTemplate(
      telefono,
      "recordatorio_cuota",
      [nombre, numeroCuota, totalCuotas, numeroCred, monto, fechaVenc],
      "Recordatorio de cuota enviado"
    )
  }
  return abrirWhatsApp(telefono, msgCuota(nombre, numeroCuota, totalCuotas, numeroCred, monto, fechaVenc))
}

/** Recordatorio de control visual */
export function enviarControlVisual(
  telefono: string | null | undefined,
  nombre: string,
  fechaControl: string
) {
  if (getMode() === "cloud_api") {
    return enviarTemplate(
      telefono,
      "recordatorio_control_visual",
      [nombre, fechaControl],
      "Recordatorio de control visual enviado ✅"
    )
  }
  return abrirWhatsApp(telefono, msgControlVisual(nombre, fechaControl))
}
