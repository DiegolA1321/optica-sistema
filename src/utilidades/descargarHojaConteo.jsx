// «Imprimir hoja de conteo»: baja la hoja como PDF DIRECTAMENTE (sin la impresión del navegador, que agregaba «localhost…», la fecha y la paginación). Se dibuja `HojaConteo` fuera de la pantalla,
// se lee cómo quedó cada página (descargarHojaReceta.leerHoja) y se escribe un PDF de varias páginas A4 con el mismo armador de la receta; el logo (una imagen) va como JPEG.
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import HojaConteo from "../componentes/inventario/HojaConteo"
import { armarPdfPaginas, leerHoja } from "./descargarHojaReceta"
import { ALTO_PAGINA, seccionesDeConteo } from "./conteoImpresion"

// El logo como JPEG (fondo blanco) para el PDF; si no se puede leer (otro origen sin permiso, sin red), el PDF sale sin él.
async function logoComoJpeg(url) {
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url })
    const lado = 200
    const lienzo = document.createElement("canvas")
    lienzo.width = lado; lienzo.height = lado
    const c = lienzo.getContext("2d")
    c.fillStyle = "#fff"; c.fillRect(0, 0, lado, lado)
    const f = Math.min(lado / img.width, lado / img.height)
    c.drawImage(img, (lado - img.width * f) / 2, (lado - img.height * f) / 2, img.width * f, img.height * f)
    const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.9))
    return blob ? { jpeg: new Uint8Array(await blob.arrayBuffer()), px: lado, py: lado } : null
  } catch { return null }
}

export const nombreArchivoConteo = (fechaISO = "") => `hoja-de-conteo${fechaISO ? `-${fechaISO}` : ""}.pdf`

export async function armarPdfConteo({ optica = {}, activos = [], descontinuados = [], fecha = "" }) {
  const secciones = seccionesDeConteo({ activos, descontinuados })
  const caja = document.createElement("div")
  caja.setAttribute("aria-hidden", "true")
  caja.style.cssText = "position:fixed;left:-10000px;top:0;width:780px;background:#fff;pointer-events:none"
  document.body.appendChild(caja)
  const raiz = createRoot(caja)
  try {
    flushSync(() => raiz.render(<HojaConteo optica={optica} secciones={secciones} fecha={fecha} />))
    const logo = optica.logoUrl ? await logoComoJpeg(optica.logoUrl) : null
    const paginas = [...caja.querySelectorAll("[data-hoja-conteo-pagina]")].map((el) => {
      const datos = leerHoja(el)
      const marca = el.querySelector("[data-logo]")
      const imagenes = []
      if (logo && marca) { const b = el.getBoundingClientRect(); const r = marca.getBoundingClientRect(); imagenes.push({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, ...logo }) }
      return { ...datos, alto: ALTO_PAGINA, imagenes }
    })
    return armarPdfPaginas({ paginas, titulo: "Hoja de conteo fisico" })
  } finally {
    raiz.unmount()
    caja.remove()
  }
}

// Baja el PDF. Devuelve true si lo bajó; si algo falla, false (quien llama lo dice).
export async function descargarHojaConteo(datos, fechaISO = "") {
  try {
    const pdf = await armarPdfConteo(datos)
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }))
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = nombreArchivoConteo(fechaISO)
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
