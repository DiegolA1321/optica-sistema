// «Imprimir hoja de conteo»: baja la hoja como PDF DIRECTAMENTE (sin la impresión del navegador, que agregaba «localhost…», la fecha y la paginación). Se dibuja `HojaConteo` fuera de la pantalla,
// se lee cómo quedó cada página (descargarHojaReceta.leerHoja) y se escribe un PDF de varias páginas A4 con el mismo armador de la receta; el logo (una imagen) va como JPEG.
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import HojaConteo from "../componentes/inventario/HojaConteo"
import { armarPdfPaginas, leerHoja, logoComoJpeg } from "./descargarHojaReceta"
import { anchoDeLogo } from "../componentes/LogoImpreso"
import { ALTO_PAGINA, seccionesDeConteo } from "./conteoImpresion"

export const nombreArchivoConteo = (fechaISO = "") => `hoja-de-conteo${fechaISO ? `-${fechaISO}` : ""}.pdf`

export async function armarPdfConteo({ optica = {}, activos = [], descontinuados = [], fecha = "" }) {
  const secciones = seccionesDeConteo({ activos, descontinuados })
  const caja = document.createElement("div")
  caja.setAttribute("aria-hidden", "true")
  caja.style.cssText = "position:fixed;left:-10000px;top:0;width:780px;background:#fff;pointer-events:none"
  document.body.appendChild(caja)
  const raiz = createRoot(caja)
  try {
    // El logo primero: su proporción decide el ancho de su lugar en la hoja (entero, sin deformarse).
    const logo = optica.logoUrl ? await logoComoJpeg(optica.logoUrl) : null
    const opticaHoja = { ...optica, logoUrl: logo ? optica.logoUrl : "", logoAncho: logo ? anchoDeLogo(logo.proporcion, 56, 150) : undefined }
    flushSync(() => raiz.render(<HojaConteo optica={opticaHoja} secciones={secciones} fecha={fecha} />))
    const paginas = [...caja.querySelectorAll("[data-hoja-conteo-pagina]")].map((el) => {
      const datos = leerHoja(el)
      const marca = el.querySelector("[data-logo]")
      const imagenes = []
      if (logo && marca) { const b = el.getBoundingClientRect(); const r = marca.getBoundingClientRect(); imagenes.push({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, jpeg: logo.jpeg, px: logo.px, py: logo.py }) }
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
