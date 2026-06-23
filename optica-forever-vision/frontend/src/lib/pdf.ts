// ─── Shared PDF brand template ────────────────────────────────────────────────
// Logo SVG inline (ojo estilizado + texto Óptica Forever Vision)
const EYE_SVG = `<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="23" cy="23" rx="19" ry="12.5" stroke="#0891b2" stroke-width="2.4" fill="none"/>
  <circle cx="23" cy="23" r="7" stroke="#0891b2" stroke-width="2.4" fill="none"/>
  <circle cx="23" cy="23" r="3.5" fill="#0891b2"/>
  <line x1="23" y1="10" x2="23" y2="6.5" stroke="#0891b2" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="11" y1="15" x2="8.5" y2="12" stroke="#0891b2" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="35" y1="15" x2="37.5" y2="12" stroke="#0891b2" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

export const MARCA_LOGO = `
<div style="display:flex;align-items:center;gap:10px">
  ${EYE_SVG}
  <div style="line-height:1.25">
    <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:12px;color:#64748b;letter-spacing:1px">Óptica</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:13px;color:#0891b2;letter-spacing:2.5px">FOREVER VISION</div>
  </div>
</div>`

const PIN_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
const PHONE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.23h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l.81-.81a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 17z"/></svg>`

export function getMarcaFooter(logo?: string | null): string {
  const rightLogo = logo
    ? `<img src="${logo}" style="height:36px;width:auto;max-width:120px;object-fit:contain;" />`
    : `${EYE_SVG.replace('width="46" height="46"', 'width="32" height="32"')}
       <div style="margin-left:8px;line-height:1.2">
         <div style="font-family:Georgia,serif;font-style:italic;font-size:9px;color:#64748b;letter-spacing:1px">Óptica</div>
         <div style="font-family:Arial,sans-serif;font-weight:800;font-size:10px;color:#0891b2;letter-spacing:2px">FOREVER VISION</div>
       </div>`
  return `
<div style="display:flex;align-items:stretch;justify-content:space-between;background:#f0f9ff;border-top:2px solid #0891b2;margin-top:20px;font-family:Arial,sans-serif">
  <div style="display:flex;align-items:center;gap:6px;padding:8px 16px;flex:1">
    <div style="margin-right:12px">
      <div style="display:inline-flex;align-items:flex-start;gap:4px;font-size:10px;color:#475569;line-height:1.5">
        ${PIN_SVG}
        <span>Av. 24 de Mayo y Puyo<br>Diagonal a la salida de Wayra Plaza<br>Sector Colegio Garaicoa — Cuenca</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#475569">${PHONE_SVG} 0979 100 495</span>
      <span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#475569">${PHONE_SVG} 0998 674 908</span>
    </div>
  </div>
  <div style="display:flex;align-items:center;padding:8px 16px;background:#e0f2fe;border-left:1px solid #bae6fd">
    ${rightLogo}
  </div>
</div>`
}

// Backwards compat — uses SVG fallback (no custom logo)
export const MARCA_FOOTER = getMarcaFooter(null)

export const PDF_BASE_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;padding:24px;max-width:860px;margin:auto}
  .doc-hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 20px;background:#0891b2;border-radius:6px 6px 0 0;color:#fff}
  .doc-hdr-left{display:flex;flex-direction:column;gap:6px}
  .doc-hdr-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;opacity:.9;margin-top:4px}
  .doc-hdr-right{text-align:right}
  .doc-hdr-right .num{font-size:22px;font-weight:800;letter-spacing:1px}
  .doc-hdr-right .fecha{font-size:11px;opacity:.85;margin-top:2px}
  .doc-body{border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;overflow:hidden}
  .doc-section{padding:12px 16px;border-bottom:1px solid #f0f0f0}
  .doc-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#0891b2;border-bottom:1px solid #e0f2fe;padding-bottom:4px;margin-bottom:8px}
  .doc-grid{display:grid;grid-template-columns:160px 1fr;gap:4px 12px;font-size:11px}
  .doc-grid .lbl{color:#6b7280;font-weight:600}
  .doc-grid .val{color:#111}
  table.items{width:100%;border-collapse:collapse}
  table.items th{background:#0891b2;color:#fff;padding:7px 10px;font-size:11px;font-weight:600;text-align:left}
  table.items th.r{text-align:right}
  table.items th.c{text-align:center}
  table.items td{padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px}
  table.items tr:nth-child(even) td{background:#f9fafb}
  table.rx{width:100%;border-collapse:collapse}
  table.rx th{background:#e0f2fe;border:1px solid #bae6fd;padding:5px 8px;text-align:center;font-size:11px;font-weight:700;color:#0c4a6e}
  table.rx td{border:1px solid #e5e7eb;padding:5px 8px;text-align:center;font-size:12px}
  table.rx td.eye{font-weight:800;background:#f0f9ff;color:#0891b2;font-size:13px}
  .totales{background:#f8fafc;padding:12px 16px;border-top:1px solid #e5e7eb}
  .t-row{display:flex;justify-content:space-between;padding:2px 0;font-size:12px}
  .t-row.big{font-size:16px;font-weight:800;color:#0891b2;border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px}
  .firma-row{display:flex;gap:20px;margin-top:28px;justify-content:space-between}
  .firma-box{flex:1;text-align:center}
  .firma-box .line{border-top:1px solid #374151;margin:0 auto 4px;width:88%}
  .firma-box img{height:44px;object-fit:contain;margin-bottom:2px;display:block;margin:0 auto 4px}
  .firma-box p{font-size:9px;color:#6b7280}
  .check-item{display:flex;align-items:flex-start;gap:8px;font-size:11px;margin:5px 0}
  .check-box{width:14px;height:14px;border:1.5px solid #374151;display:inline-block;flex-shrink:0;margin-top:1px}
  @media print{body{padding:8px}}
`

const PRINT_WIN_NAME = "optica_print_window"

export function openPrintWindow(html: string, width = 860, height = 960) {
  // Reuse the same named window so repeated prints don't pile up
  let w = window.open("", PRINT_WIN_NAME, `width=${width},height=${height}`)
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
}

/**
 * Renders `html` in a hidden off-screen div, captures with html2canvas,
 * converts to PDF with jsPDF, and triggers a browser download.
 * Returns the PDF blob so callers can also upload/share it.
 */
export async function downloadHtmlAsPdf(html: string, filename: string): Promise<Blob> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ])

  // Render in a hidden div at fixed width so layout matches print
  const wrapper = document.createElement("div")
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:860px;background:#fff;z-index:-1"
  // Strip auto-print scripts to avoid popups
  wrapper.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 860,
    })

    const imgData = canvas.toDataURL("image/jpeg", 0.92)
    const imgW = 210 // A4 width in mm
    const imgH = (canvas.height * imgW) / canvas.width

    const pdf = new jsPDF({ orientation: imgH > imgW ? "p" : "l", unit: "mm", format: [imgW, imgH] })
    pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH)

    const blob = pdf.output("blob")
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return blob
  } finally {
    document.body.removeChild(wrapper)
  }
}

export function getMarcaLogo(logoBase64?: string | null): string {
  if (logoBase64) {
    return `<div style="display:flex;align-items:center;">
      <img src="${logoBase64}" style="height:52px;width:auto;max-width:220px;object-fit:contain;" />
    </div>`
  }
  // fallback to built-in SVG
  return MARCA_LOGO
}
