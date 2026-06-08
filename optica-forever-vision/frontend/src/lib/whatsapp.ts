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

export function msgTurno(nombre: string, fecha: string, hora: string, motivo?: string) {
  const motivoLine = motivo ? `\n📋 Motivo: ${motivo}` : ""
  return `Hola ${nombre} 👋, le recordamos su *cita* en Óptica Forever Vision:\n\n📅 Fecha: *${fecha}*\n🕐 Hora: *${hora}*${motivoLine}\n\nPor favor, preséntese 5 minutos antes.\n\nAv. 24 de mayo y Puyo, Cuenca.`
}

export function msgOrdenLista(nombre: string, numero: string) {
  return `Hola ${nombre} 👓, ¡sus lentes están listos!\n\nSu orden *${numero}* ya puede ser retirada en nuestra óptica.\n\n📍 Av. 24 de mayo y Puyo, Cuenca\n⏰ Lun–Vie 9:00–18:00 / Sáb 9:00–14:00\n\n¡Le esperamos! 😊`
}

export function msgCumpleanios(nombre: string) {
  return `🎂 ¡Feliz cumpleaños, ${nombre}!\n\nEn Óptica Forever Vision le deseamos un maravilloso día.\n\nComo regalo, venga a visitarnos y consulte nuestras promociones especiales para usted.\n\nAv. 24 de mayo y Puyo, Cuenca. ¡Le esperamos!`
}

export function msgControlVisual(nombre: string, fechaControl: string) {
  return `Hola ${nombre} 👋, le recordamos que tiene su próximo *control visual* programado para el *${fechaControl}*.\n\n👓 Por favor, comuníquese con nosotros para confirmar o agendar su cita.\n\nÓptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.`
}

export function msgRecordatorio(nombre: string) {
  return `Hola ${nombre} 👋, le saludamos desde *Óptica Forever Vision*.\n\nRecuerde que es importante realizarse un control visual periódico para cuidar su salud ocular. 👁️\n\n¡Con gusto le atendemos! Av. 24 de mayo y Puyo, Cuenca.`
}

export function msgCuota(
  nombre: string,
  numeroCuota: string,
  totalCuotas: string,
  numeroCred: string,
  monto: string,
  fechaVenc: string
) {
  return `Hola ${nombre} 👋, le recordamos que su cuota *${numeroCuota}/${totalCuotas}* del crédito *${numeroCred}* por *$${monto}* vence el *${fechaVenc}*.\n\nSi ya realizó el pago, puede ignorar este mensaje.\n\nÓptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.`
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
  return `✅ Hola ${nombre}, confirmamos su pago en Óptica Forever Vision:\n\n💳 Crédito: *${numeroCred}*\n📌 Cuota: ${numeroCuota}/${totalCuotas}\n💵 Monto abonado: *$${monto}*\n📅 Fecha: ${fecha}\n💰 Saldo pendiente: *$${saldo}*\n\nGracias por su pago. Guarde este mensaje como comprobante.\n\nÓptica Forever Vision — Av. 24 de mayo y Puyo, Cuenca.`
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
