// «Descargar receta» del portal: baja el PDF DIRECTAMENTE, sin el diálogo de impresión (para un paciente mayor es confuso). Es la misma hoja que imprime el optómetra (`HojaReceta`): se monta
// fuera de la pantalla, se lee cómo quedó dibujada (cada caja con su fondo y sus bordes y cada palabra con su tipo de letra, tamaño, color y posición) y se escribe en una página A4 de un PDF
// armado aquí mismo, sin librerías. El texto del PDF es TEXTO (se puede seleccionar, buscar y copiar), no una imagen de la hoja.
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import HojaReceta from "../componentes/HojaReceta"
import { anchoDeLogo } from "../componentes/LogoImpreso"

const A4 = { ancho: 595.28, alto: 841.89 }
const ANCHO_HOJA = 780 // el ancho de la hoja (HojaReceta), en px
const codificar = (t) => new TextEncoder().encode(t)
const unir = (partes) => {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const salida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { salida.set(p, pos); pos += p.length }
  return salida
}
const num = (n) => (Math.round(n * 100) / 100).toString()

// ── Texto → bytes WinAnsi (como Latin-1; la raya larga, las comillas y la viñeta tienen su propio código). Lo que no exista se cambia por «?»; el signo menos de verdad, por un guion.
const WIN = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "•": 0x95, "−": 0x2d }
const aBytes = (s) => [...String(s ?? "")].map((ch) => { const c = ch.charCodeAt(0); return WIN[ch] ?? (c < 256 ? c : 0x3f) })
const escapar = (bytes) => bytes.flatMap((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? [0x5c, b] : [b]))
const FUENTES = ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Courier", "Courier-Bold"]

// Anchos de Helvetica (milésimas de em) para ajustar cada palabra al ancho que tenía en pantalla (el PDF usa las fuentes estándar, que no miden lo mismo que la fuente de la pantalla).
const ANCHO_HELV = { " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278, ":": 278, ";": 278, "=": 584, "?": 556, "@": 1015, "°": 400, "·": 278, "º": 365,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500 }
const sinAcento = (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "")
const anchoEstimado = (texto, fuente) => {
  const base = [...texto].reduce((s, c) => s + (fuente >= 4 ? 600 : (ANCHO_HELV[c] ?? ANCHO_HELV[sinAcento(c)] ?? 556)), 0)
  return base * (fuente === 1 ? 1.06 : fuente === 2 ? 0.94 : fuente === 3 ? 1.02 : 1)
}

// ── El PDF a partir de lo leído de la hoja. `rects`: [{ x, y, w, h, color: [r,g,b] }] (px, desde arriba a la izquierda, con el color de relleno 0–1); `palabras`: [{ x, y, w, tam, fuente, color, texto }]
// (y = línea base). Puro: se prueba sin navegador.
export function armarPdfVectorial({ ancho = ANCHO_HOJA, alto, rects = [], palabras = [] }) {
  return armarPdfPaginas({ paginas: [{ ancho, alto, rects, palabras }], titulo: "Receta de optica" })
}

// El mismo PDF con VARIAS páginas (la hoja de conteo) y, si se pide, imágenes JPEG (el logo): cada página es { ancho, alto, rects, palabras, imagenes: [{ x, y, w, h, jpeg: Uint8Array, px: ancho, py: alto }] }.
// Cada página se escala a su A4 por separado; los objetos son: 1 catálogo, 2 páginas, 3 datos, 4–9 fuentes, luego las imágenes y, por página, su contenido y su página.
export function armarPdfPaginas({ paginas, titulo = "Documento" }) {
  const imagenes = []
  const contenidos = paginas.map((pg) => {
    const escala = Math.min(A4.ancho / (pg.ancho || ANCHO_HOJA), A4.alto / pg.alto)
    const px = (v) => v * escala
    const arriba = (y) => A4.alto - px(y)
    const op = []
    for (const r of pg.rects || []) op.push(`${r.color.map(num).join(" ")} rg ${num(px(r.x))} ${num(arriba(r.y + r.h))} ${num(px(r.w))} ${num(px(r.h))} re f`)
    const usadas = []
    for (const im of pg.imagenes || []) {
      imagenes.push(im)
      usadas.push(imagenes.length)
      op.push(`q ${num(px(im.w))} 0 0 ${num(px(im.h))} ${num(px(im.x))} ${num(arriba(im.y + im.h))} cm /Im${imagenes.length} Do Q`)
    }
    for (const w of pg.palabras || []) {
      const tam = px(w.tam)
      const natural = (anchoEstimado(w.texto, w.fuente) * tam) / 1000
      const tz = natural > 0 && w.w > 0 ? Math.min(130, Math.max(70, (px(w.w) / natural) * 100)) : 100
      const bytes = escapar(aBytes(w.texto))
      op.push({ bytes: [...aBytes(`${w.color.map(num).join(" ")} rg BT /F${w.fuente + 1} ${num(tam)} Tf ${num(tz)} Tz ${num(px(w.x))} ${num(arriba(w.y))} Td (`), ...bytes, ...aBytes(") Tj ET")] })
    }
    return { contenido: unir(op.flatMap((o) => [typeof o === "string" ? codificar(o) : Uint8Array.from(o.bytes), codificar("\n")])), usadas }
  })
  const primeraImagen = 4 + FUENTES.length
  const primeraPagina = primeraImagen + imagenes.length
  const idPagina = (i) => primeraPagina + i * 2 + 1
  const idContenido = (i) => primeraPagina + i * 2
  const fuentes = FUENTES.map((f, i) => `/F${i + 1} ${4 + i} 0 R`).join(" ")
  const cuerpos = [
    codificar("<< /Type /Catalog /Pages 2 0 R >>"),
    codificar(`<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(" ")}] /Count ${paginas.length} >>`),
    codificar(`<< /Producer (Sistema de optica) /Title (${titulo}) >>`),
    ...FUENTES.map((f) => codificar(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`)),
    ...imagenes.map((im) => unir([codificar(`<< /Type /XObject /Subtype /Image /Width ${im.px} /Height ${im.py} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`), im.jpeg, codificar("\nendstream")])),
  ]
  paginas.forEach((_, i) => {
    const c = contenidos[i]
    cuerpos.push(unir([codificar(`<< /Length ${c.contenido.length} >>\nstream\n`), c.contenido, codificar("endstream")]))
    const xo = c.usadas.length ? ` /XObject << ${c.usadas.map((n) => `/Im${n} ${primeraImagen + n - 1} 0 R`).join(" ")} >>` : ""
    cuerpos.push(codificar(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4.ancho)} ${num(A4.alto)}] /Resources << /Font << ${fuentes} >>${xo} >> /Contents ${idContenido(i)} 0 R >>`))
  })
  const partes = [codificar("%PDF-1.4\n")]
  const posiciones = []
  let largo = partes[0].length
  cuerpos.forEach((cuerpo, i) => {
    posiciones.push(largo)
    const obj = unir([codificar(`${i + 1} 0 obj\n`), cuerpo, codificar("\nendobj\n")])
    partes.push(obj)
    largo += obj.length
  })
  partes.push(codificar(`xref\n0 ${cuerpos.length + 1}\n0000000000 65535 f \n${posiciones.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${cuerpos.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${largo}\n%%EOF\n`))
  return unir(partes)
}

export function nombreArchivoReceta(paciente = {}, receta = {}) {
  const limpio = String(paciente.nombre || "paciente").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `receta-${limpio || "paciente"}-${receta.fecha || ""}.pdf`.replace(/-\.pdf$/, ".pdf")
}

// ── Leer cómo quedó dibujada la hoja ──
const colorDe = (css) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/.exec(css || "")
  if (!m) return null
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return a === 0 ? null : { rgb: [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255], a }
}
const sobreBlanco = (c) => c.rgb.map((v) => v * c.a + (1 - c.a))
const fuenteDe = (cs) => {
  const negrita = (parseInt(cs.fontWeight, 10) || 400) >= 600
  const familia = (cs.fontFamily || "").toLowerCase()
  const base = /georgia|times|serif/.test(familia) && !/sans-serif/.test(familia.split(",")[0]) ? 2 : /mono|courier|consolas/.test(familia) ? 4 : 0
  return base + (negrita ? 1 : 0)
}

export function leerHoja(hoja) {
  const base = hoja.getBoundingClientRect()
  const rects = []
  const palabras = []
  const recorrer = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === "none" || cs.visibility === "hidden") return
    const r = el.getBoundingClientRect()
    const x = r.left - base.left
    const y = r.top - base.top
    const fondo = colorDe(cs.backgroundColor)
    if (fondo && r.width > 0 && r.height > 0) rects.push({ x, y, w: r.width, h: r.height, color: sobreBlanco(fondo) })
    for (const [lado, ancho, estilo, color] of [["t", cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor], ["b", cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor], ["l", cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor], ["r", cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor]]) {
      const w = parseFloat(ancho)
      const c = colorDe(color)
      if (!(w > 0) || estilo === "none" || !c || r.width <= 0) continue
      const rgb = sobreBlanco(c)
      if (lado === "t") rects.push({ x, y, w: r.width, h: w, color: rgb })
      if (lado === "b") rects.push({ x, y: y + r.height - w, w: r.width, h: w, color: rgb })
      if (lado === "l") rects.push({ x, y, w, h: r.height, color: rgb })
      if (lado === "r") rects.push({ x: x + r.width - w, y, w, h: r.height, color: rgb })
    }
    for (const hijo of el.childNodes) {
      if (hijo.nodeType === 1) recorrer(hijo)
      else if (hijo.nodeType === 3 && hijo.textContent.trim()) {
        const color = colorDe(cs.color)
        const tam = parseFloat(cs.fontSize)
        const fuente = fuenteDe(cs)
        const mayusculas = cs.textTransform === "uppercase"
        const texto = hijo.textContent
        const rango = document.createRange()
        for (const m of texto.matchAll(/\S+/g)) {
          rango.setStart(hijo, m.index)
          rango.setEnd(hijo, m.index + m[0].length)
          const cajas = rango.getClientRects()
          if (!cajas.length) continue
          const c = cajas[0]
          palabras.push({ x: c.left - base.left, y: c.top - base.top + c.height * 0.8, w: c.width, tam, fuente, color: color ? sobreBlanco(color) : [0, 0, 0], texto: mayusculas ? m[0].toUpperCase() : m[0] })
        }
      }
    }
  }
  recorrer(hoja)
  return { ancho: base.width, alto: base.height, rects, palabras }
}

// El logo de la óptica como JPEG para el PDF (el PDF de aquí no sabe de PNG con transparencia ni de SVG): se dibuja en un lienzo sobre fondo blanco, entero y con su proporción,
// con un lado de 600 px como máximo. Un SVG se convierte igual (el navegador lo dibuja en el lienzo). Si no se puede leer (otro origen sin permiso, sin red, un SVG que el
// navegador no dibuja), devuelve null y el PDF sale con el nombre de la óptica y sin logo.
export async function logoComoJpeg(url) {
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url })
    const w = img.naturalWidth || 300
    const h = img.naturalHeight || 300
    const f = 600 / Math.max(w, h)
    const lienzo = document.createElement("canvas")
    lienzo.width = Math.max(1, Math.round(w * f)); lienzo.height = Math.max(1, Math.round(h * f))
    const c = lienzo.getContext("2d")
    c.fillStyle = "#fff"; c.fillRect(0, 0, lienzo.width, lienzo.height)
    c.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", 0.9))
    return blob ? { jpeg: new Uint8Array(await blob.arrayBuffer()), px: lienzo.width, py: lienzo.height, proporcion: lienzo.width / lienzo.height } : null
  } catch { return null }
}

async function hojaAPdf(datos) {
  const logo = datos.optica?.logoUrl ? await logoComoJpeg(datos.optica.logoUrl) : null
  const optica = { ...datos.optica, logoUrl: logo ? datos.optica.logoUrl : "", logoAncho: logo ? anchoDeLogo(logo.proporcion) : undefined }
  const caja = document.createElement("div")
  caja.setAttribute("aria-hidden", "true")
  caja.style.cssText = `position:fixed;left:-10000px;top:0;width:${ANCHO_HOJA}px;background:#fff;pointer-events:none`
  document.body.appendChild(caja)
  const raiz = createRoot(caja)
  try {
    flushSync(() => raiz.render(<HojaReceta {...datos} optica={optica} />))
    const hoja = caja.querySelector("[data-hoja-receta]")
    if (!hoja) throw new Error("No se pudo preparar la hoja.")
    const lectura = leerHoja(hoja)
    const marca = hoja.querySelector("[data-logo]")
    const imagenes = []
    if (logo && marca) { const b = hoja.getBoundingClientRect(); const r = marca.getBoundingClientRect(); imagenes.push({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height, jpeg: logo.jpeg, px: logo.px, py: logo.py }) }
    return armarPdfPaginas({ paginas: [{ ...lectura, imagenes }], titulo: "Receta de optica" })
  } finally {
    raiz.unmount()
    caja.remove()
  }
}

// Baja la receta como PDF. Devuelve true si la bajó; si algo falla devuelve false para que quien llama use otro camino (el diálogo de impresión). El logo de la óptica va en el PDF como imagen (si no se puede leer, el PDF sale sin él).
export async function descargarHojaReceta(datos) {
  try {
    const pdf = await hojaAPdf(datos)
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
