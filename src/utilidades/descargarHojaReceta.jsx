// «Descargar receta» del portal: baja el PDF DIRECTAMENTE, sin el diálogo de impresión (para un paciente mayor es confuso). Es la misma hoja que imprime el optómetra (`HojaReceta`): se
// monta fuera de la pantalla, se dibuja a una imagen (SVG con la hoja adentro → lienzo → JPEG) y esa imagen va en una página A4 de un PDF armado aquí mismo, sin librerías.
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import HojaReceta from "../componentes/HojaReceta"

const A4 = { ancho: 595.28, alto: 841.89 }
const ANCHO_HOJA = 780 // el ancho de la hoja (HojaReceta)
const codificar = (t) => new TextEncoder().encode(t)
const unir = (partes) => {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const salida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { salida.set(p, pos); pos += p.length }
  return salida
}
const num = (n) => (Math.round(n * 100) / 100).toString()

// Un PDF de una página A4 con una imagen JPEG que ocupa todo el ancho (y, si es muy alta, se ajusta al alto). Puro: se prueba sin navegador.
export function armarPdfConImagen({ jpeg, anchoPx, altoPx }) {
  const escala = Math.min(A4.ancho / anchoPx, A4.alto / altoPx)
  const w = anchoPx * escala
  const h = altoPx * escala
  const x = (A4.ancho - w) / 2
  const y = A4.alto - h
  const contenido = codificar(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im0 Do Q`)
  const cuerpos = [
    codificar("<< /Type /Catalog /Pages 2 0 R >>"),
    codificar("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    codificar(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4.ancho)} ${num(A4.alto)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    unir([codificar(`<< /Length ${contenido.length} >>\nstream\n`), contenido, codificar("\nendstream")]),
    unir([codificar(`<< /Type /XObject /Subtype /Image /Width ${anchoPx} /Height ${altoPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, codificar("\nendstream")]),
  ]
  const partes = [codificar("%PDF-1.4\n")]
  const posiciones = []
  let largo = partes[0].length
  cuerpos.forEach((cuerpo, i) => {
    posiciones.push(largo)
    const obj = unir([codificar(`${i + 1} 0 obj\n`), cuerpo, codificar("\nendobj\n")])
    partes.push(obj)
    largo += obj.length
  })
  const tabla = `xref\n0 ${cuerpos.length + 1}\n0000000000 65535 f \n${posiciones.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${cuerpos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`
  partes.push(codificar(tabla))
  return unir(partes)
}

export function nombreArchivoReceta(paciente = {}, receta = {}) {
  const limpio = String(paciente.nombre || "paciente").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `receta-${limpio || "paciente"}-${receta.fecha || ""}.pdf`.replace(/-\.pdf$/, ".pdf")
}

// Una imagen dentro de un SVG solo se dibuja si va incrustada: el logo se baja y se convierte; si no se puede (otro servidor sin permiso), la hoja sale sin logo.
async function logoIncrustado(url) {
  if (!url || url.startsWith("data:")) return url || ""
  try {
    const r = await fetch(url)
    if (!r.ok) return ""
    const blob = await r.blob()
    return await new Promise((res) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => res(""); f.readAsDataURL(blob) })
  } catch { return "" }
}

async function hojaAJpeg(datos) {
  const caja = document.createElement("div")
  caja.setAttribute("aria-hidden", "true")
  caja.style.cssText = `position:fixed;left:-10000px;top:0;width:${ANCHO_HOJA}px;background:#fff;pointer-events:none`
  document.body.appendChild(caja)
  const raiz = createRoot(caja)
  try {
    flushSync(() => raiz.render(<HojaReceta {...datos} />))
    const hoja = caja.firstElementChild
    const alto = Math.ceil(hoja.getBoundingClientRect().height)
    const xml = new window.XMLSerializer().serializeToString(hoja)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_HOJA}" height="${alto}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`
    const imagen = new Image()
    await new Promise((res, rej) => { imagen.onload = res; imagen.onerror = () => rej(new Error("No se pudo dibujar la hoja.")); imagen.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) })
    const escala = 2
    const lienzo = document.createElement("canvas")
    lienzo.width = ANCHO_HOJA * escala
    lienzo.height = alto * escala
    const ctx = lienzo.getContext("2d")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, lienzo.width, lienzo.height)
    ctx.scale(escala, escala)
    ctx.drawImage(imagen, 0, 0, ANCHO_HOJA, alto)
    const blob = await new Promise((res) => lienzo.toBlob(res, "image/jpeg", 0.92))
    if (!blob) throw new Error("No se pudo crear la imagen de la hoja.")
    return { jpeg: new Uint8Array(await blob.arrayBuffer()), anchoPx: lienzo.width, altoPx: lienzo.height }
  } finally {
    raiz.unmount()
    caja.remove()
  }
}

// Baja la receta como PDF. Devuelve true si la bajó; si el navegador no puede dibujar la hoja, devuelve false para que quien llama use otro camino.
export async function descargarHojaReceta(datos) {
  try {
    const logoUrl = await logoIncrustado(datos.optica?.logoUrl)
    const imagen = await hojaAJpeg({ ...datos, optica: { ...datos.optica, logoUrl } })
    const pdf = armarPdfConImagen(imagen)
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }))
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = nombreArchivoReceta(datos.paciente, datos.receta)
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
