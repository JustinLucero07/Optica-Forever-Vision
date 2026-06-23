export type RxOjoparsed = {
  esf: string; cil: string; eje: string; add: string
  prisma: string; dnp: string; dp: string
}

export type ParsedRx = {
  od: RxOjoparser; oi: RxOjoparser
  dp: string; material: string; tratamiento: string
  diseno: string; diagnostico: string; recomendaciones: string
}

type RxOjoparser = RxOjoparsed

export function parsePrescripcion(desc: string): ParsedRx {
  const lines = desc.split("\n").map(l => l.trim()).filter(Boolean)
  const get = (prefix: string) => {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()))
    if (!line) return ""
    const ci = line.indexOf(":")
    return ci >= 0 ? line.slice(ci + 1).trim() : ""
  }
  const parseOjo = (text: string): RxOjoparser => ({
    esf: text.match(/esf[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    cil: text.match(/cil[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    eje: text.match(/eje[\s:]+(\d+)/i)?.[1] ?? "",
    add: text.match(/add[\s:]+([+-]?\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    prisma: text.match(/prisma[\s:]+(\S+)/i)?.[1] ?? "",
    dnp: text.match(/dnp[\s:]+(\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
    dp: text.match(/\bdp[\s:]+(\d+(?:[.,]\d+)?)/i)?.[1] ?? "",
  })
  return {
    od: parseOjo(get("OD")),
    oi: parseOjo(get("OI")),
    dp: get("DP").replace(/mm/i, "").trim(),
    material: get("Material"),
    tratamiento: get("Tratamiento"),
    diseno: get("Diseño"),
    diagnostico: get("Diagnóstico") || get("Diagnostico"),
    recomendaciones: get("Recomendaciones"),
  }
}
