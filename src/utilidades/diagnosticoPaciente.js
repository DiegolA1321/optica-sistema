// El diagnóstico de una consulta como filas «título → texto» (para comparar dos diagnósticos en el perfil del paciente). Lógica pura. Usa las funciones únicas del sistema:
// la agudeza (textoAgudeza), la dioptría (dioptriaTexto) y el texto del diagnóstico (textoDiagnostico).
import { textoAgudeza } from "./agudeza"
import { dioptriaTexto } from "./refraccion"
import { textoDiagnostico } from "./pasesVenta"
import { recetasDe } from "./graduacion"
import { lineasDeExamen } from "./resumenExamen"
import { formatoFecha } from "./formatoFecha"

const medida = (o = {}) => (o.esfera || o.cilindro || o.eje ? `${dioptriaTexto(o.esfera) || "—"} ${dioptriaTexto(o.cilindro) || ""} x${o.eje || "—"}°`.replace(/\s+/g, " ") : "")
const av = (o = {}) => [textoAgudeza(o.avSc, o.avScF) && `sin corrección ${textoAgudeza(o.avSc, o.avScF)}`, textoAgudeza(o.avCc, o.avCcF) && `con su corrección ${textoAgudeza(o.avCc, o.avCcF)}`, textoAgudeza(o.avRx, o.avRxF) && `con la receta ${textoAgudeza(o.avRx, o.avRxF)}`].filter(Boolean).join(" · ")

export const tieneRefraccion = (consulta) => recetasDe([consulta]).length > 0

// Las filas que tiene esa consulta (solo lo registrado). Cada fila: [clave, título, texto].
export function filasDeDiagnostico(consulta = {}) {
  const m = consulta.medidas || {}
  const filas = [
    ["motivo", "Motivo de la consulta", [consulta.motivo, consulta.detalleConsulta && `«${consulta.detalleConsulta}»`].filter(Boolean).join(" · ")],
    ["diagnostico", "Diagnóstico", textoDiagnostico(consulta)],
    ["av-od", "Agudeza visual · OD", av(consulta.od)],
    ["av-oi", "Agudeza visual · OI", av(consulta.oi)],
    ["ref-od", "Refracción · OD", tieneRefraccion(consulta) ? medida(consulta.od) : ""],
    ["ref-oi", "Refracción · OI", tieneRefraccion(consulta) ? medida(consulta.oi) : ""],
    ["adicion", "Adición", dioptriaTexto(m.adicionOd || m.adicion) || ""],
    ["dp", "Distancia pupilar", m.dp ? `${m.dp} mm` : ""],
    ...lineasDeExamen(consulta).map(([t, v]) => [`ex-${t}`, t, v]),
    ["lente", "Lente recomendado", consulta.lenteRecomendado],
    ["indicaciones", "Indicaciones", consulta.indicaciones],
  ]
  return filas.filter(([, , v]) => v)
}

// Dos diagnósticos lado a lado: por cada título que tenga alguno de los dos, el texto de cada uno y si cambió. [{ clave, titulo, a, b, cambio }]
export function compararDiagnosticos(a, b) {
  const fa = new Map(filasDeDiagnostico(a).map(([k, t, v]) => [k, { t, v }]))
  const fb = new Map(filasDeDiagnostico(b).map(([k, t, v]) => [k, { t, v }]))
  const claves = [...new Set([...fa.keys(), ...fb.keys()])]
  return claves.map((k) => ({ clave: k, titulo: (fa.get(k) || fb.get(k)).t, a: fa.get(k)?.v || "—", b: fb.get(k)?.v || "—", cambio: (fa.get(k)?.v || "") !== (fb.get(k)?.v || "") }))
}

// «21 oct 2026 · Miopía» — el rótulo de una consulta en el selector.
export const rotuloDeConsulta = (consulta, vigente = false) => {
  const d = textoDiagnostico(consulta) || consulta.motivo || "Consulta"
  return `${formatoFecha(consulta.fecha, "medio")}${vigente ? " · vigente" : ""} · ${d.length > 42 ? d.slice(0, 41) + "…" : d}`
}
