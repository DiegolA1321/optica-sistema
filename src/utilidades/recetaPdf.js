// «Descargar receta» del portal: un PDF de una página, armado aquí mismo (sin librerías). Usa las fuentes estándar del PDF (Helvetica), que traen
// las tildes y la ñ, así que el archivo se abre igual en cualquier lector. Es la misma receta que ve el paciente en pantalla (regla 29).
import { fechaLegible } from "./formatoFecha"
import { textoGraduacionOjo } from "./recetaTexto"

const ANCHO = 595
const ALTO = 842
const MARGEN = 48

// Texto → bytes WinAnsi (como Latin-1; la raya larga y las comillas tienen su propio código). Lo demás que no exista se cambia por «?».
const WIN = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92, "•": 0x95, "−": 0x2d }
const aBytes = (s) => [...String(s ?? "")].map((ch) => { const c = ch.charCodeAt(0); return WIN[ch] ?? (c < 256 ? c : 0x3f) })
const escapar = (bytes) => bytes.flatMap((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? [0x5c, b] : [b]))
const num = (n) => (Math.round(n * 100) / 100).toString()

// Las operaciones de dibujo de la página, en coordenadas desde arriba a la izquierda (el PDF cuenta desde abajo).
function pagina() {
  const partes = []
  const y = (arriba) => ALTO - arriba
  return {
    texto(x, arriba, tam, negrita, valor, color = [0.055, 0.169, 0.2]) {
      partes.push({ bytes: [...aBytes(`${color.join(" ")} rg BT /${negrita ? "F2" : "F1"} ${tam} Tf ${num(x)} ${num(y(arriba))} Td (`), ...escapar(aBytes(valor)), ...aBytes(") Tj ET\n")] })
    },
    linea(x1, arriba, x2, grosor = 0.8, color = [0.8, 0.84, 0.88]) {
      partes.push({ bytes: aBytes(`${color.join(" ")} RG ${grosor} w ${num(x1)} ${num(y(arriba))} m ${num(x2)} ${num(y(arriba))} l S\n`) })
    },
    caja(x, arriba, ancho, alto, relleno = null) {
      partes.push({ bytes: aBytes(`${relleno ? relleno.join(" ") + " rg " : ""}0.8 0.84 0.88 RG 0.8 w ${num(x)} ${num(y(arriba + alto))} ${num(ancho)} ${num(alto)} re ${relleno ? "B" : "S"}\n`) })
    },
    contenido: () => partes.flatMap((p) => p.bytes),
  }
}

// Parte un texto largo en renglones que caben en `ancho` (aproximado: Helvetica mide cerca de 0.5 del tamaño por letra).
export function partirEnRenglones(texto, tam, ancho) {
  const maxLetras = Math.max(10, Math.floor(ancho / (tam * 0.5)))
  const renglones = []
  let actual = ""
  for (const palabra of String(texto ?? "").split(/\s+/).filter(Boolean)) {
    if (actual && (actual + " " + palabra).length > maxLetras) { renglones.push(actual); actual = palabra } else actual = actual ? actual + " " + palabra : palabra
  }
  if (actual) renglones.push(actual)
  return renglones
}

// datos: { optica, paciente: {nombre, cedula}, receta (la consulta del portal), mostrarMedidas }
export function armarPdfReceta({ optica = "Óptica", paciente = {}, receta = {}, mostrarMedidas = false }) {
  const p = pagina()
  let y = MARGEN + 14
  p.texto(MARGEN, y, 20, true, optica)
  y += 22
  p.texto(MARGEN, y, 13, false, "Receta óptica", [0.3, 0.36, 0.42])
  y += 12
  p.linea(MARGEN, y, ANCHO - MARGEN, 1.2)
  y += 26
  const fila = (etiqueta, valor) => { p.texto(MARGEN, y, 11, true, etiqueta + ":"); p.texto(MARGEN + 90, y, 12, false, valor || "—"); y += 18 }
  fila("Paciente", paciente.nombre)
  fila("Cédula", paciente.cedula)
  fila("Fecha", receta.fecha ? fechaLegible(receta.fecha) : "")
  y += 8

  const ancho = (ANCHO - MARGEN * 2 - 16) / 2
  for (const [i, titulo, ojo] of [[0, "Ojo derecho", receta.od || {}], [1, "Ojo izquierdo", receta.oi || {}]]) {
    const x = MARGEN + i * (ancho + 16)
    p.caja(x, y, ancho, 118, [0.97, 0.98, 0.99])
    p.texto(x + 12, y + 22, 13, true, titulo)
    p.texto(x + 12, y + 44, 11, true, "Graduación")
    p.texto(x + 12, y + 61, 13, false, textoGraduacionOjo(ojo))
    p.texto(x + 12, y + 77, 9, false, "Esfera · Cilindro · Eje", [0.4, 0.45, 0.5])
    p.texto(x + 12, y + 98, 11, true, "Agudeza visual")
    p.texto(x + 110, y + 98, 12, false, ojo.avCc || ojo.avSc || "—")
  }
  y += 118 + 24

  const adicion = receta.medidas?.adicion
  if (adicion) { p.texto(MARGEN, y, 11, true, "Adición (para leer de cerca):"); p.texto(MARGEN + 170, y, 12, false, String(adicion)); y += 20 }
  if (mostrarMedidas && receta.medidas?.dp) { p.texto(MARGEN, y, 11, true, "Distancia pupilar:"); p.texto(MARGEN + 170, y, 12, false, String(receta.medidas.dp)); y += 20 }
  if (mostrarMedidas && receta.medidas?.alt) { p.texto(MARGEN, y, 11, true, "Altura de montaje:"); p.texto(MARGEN + 170, y, 12, false, String(receta.medidas.alt)); y += 20 }

  const bloque = (etiqueta, valor) => {
    if (!valor) return
    y += 6
    p.texto(MARGEN, y, 11, true, etiqueta)
    y += 17
    for (const r of partirEnRenglones(valor, 12, ANCHO - MARGEN * 2)) { p.texto(MARGEN, y, 12, false, r); y += 16 }
  }
  bloque("Lente recomendado", receta.lenteRecomendado)
  bloque("Diagnóstico", receta.diagnostico)
  bloque("Indicaciones", receta.indicaciones)

  p.linea(MARGEN, ALTO - 70, ANCHO - MARGEN, 0.8)
  p.texto(MARGEN, ALTO - 52, 10, false, `Emitida por ${receta.profesionalNombre || "el equipo"}${receta.profesionalRegistro ? ` · Reg. Prof. ${receta.profesionalRegistro}` : ""} · ${optica}`, [0.3, 0.36, 0.42])

  // Armado del archivo: 5 objetos (catálogo, páginas, página, contenido y dos fuentes) con su tabla de posiciones.
  const flujo = p.contenido()
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ]
  const salida = [...aBytes("%PDF-1.4\n")]
  const posiciones = []
  const objeto = (n, cuerpo) => { posiciones.push(salida.length); salida.push(...aBytes(`${n} 0 obj\n`), ...cuerpo, ...aBytes("\nendobj\n")) }
  objetos.forEach((o, i) => objeto(i + 1, aBytes(o)))
  objeto(6, [...aBytes(`<< /Length ${flujo.length} >>\nstream\n`), ...flujo, ...aBytes("\nendstream")])
  const inicioTabla = salida.length
  salida.push(...aBytes(`xref\n0 7\n0000000000 65535 f \n${posiciones.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${inicioTabla}\n%%EOF\n`))
  return new Uint8Array(salida)
}

export function nombreArchivoReceta(paciente = {}, receta = {}) {
  const limpio = String(paciente.nombre || "paciente").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `receta-${limpio || "paciente"}-${receta.fecha || ""}.pdf`.replace(/-\.pdf$/, ".pdf")
}

// Baja el archivo (clic síncrono en el botón: el navegador lo permite sin avisos).
export function descargarPdfReceta(datos) {
  const url = URL.createObjectURL(new Blob([armarPdfReceta(datos)], { type: "application/pdf" }))
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombreArchivoReceta(datos.paciente, datos.receta)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
