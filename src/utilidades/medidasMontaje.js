// Respuesta de la óptica a «Solicitar medidas» del portal: qué medidas existen, cómo se redactan y cómo las lee el paciente.
// Distancia pupilar: la de la última receta (consulta). Altura de montaje: la de la última orden de lentes del paciente (depende de la montura, por eso vive en la orden).
import { ordenarPorFechaYCreacion } from "./fidelizacion"

const limpio = (t) => String(t ?? "").trim()
const conUnidad = (t) => (/mm\s*$/i.test(limpio(t)) ? limpio(t) : `${limpio(t)} mm`)

export function medidasDelPaciente({ consultas = [], ordenes = [] } = {}) {
  const dp = limpio([...consultas].sort(ordenarPorFechaYCreacion).find((c) => limpio(c.medidas?.dp))?.medidas?.dp)
  const orden = [...ordenes].sort((a, b) => (limpio(b.creadaEn) > limpio(a.creadaEn) ? 1 : limpio(b.creadaEn) < limpio(a.creadaEn) ? -1 : (b.numero || 0) - (a.numero || 0))).find((o) => limpio(o.alturaMontaje))
  const altura = limpio(orden?.alturaMontaje)
  return { dp, altura, faltan: !dp || !altura, hayAlgo: !!(dp || altura) }
}

// Lo que el portal recibe de mi_solicitud_medidas_paciente → forma que usa la pantalla.
export function mapSolicitudMedidas(d) {
  if (!d || typeof d !== "object") return null
  const u = d.ultima
  return {
    abiertaDesde: d.abierta_desde || null,
    ultima: u ? { resultado: u.resultado, cerrada: u.cerrada, dp: u.dp || "", altura: u.altura || "", citaFecha: u.cita_fecha || null, citaHora: u.cita_hora || "" } : null,
  }
}

export { conUnidad as medidaConUnidad }
