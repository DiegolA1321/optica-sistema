// "Profesional" de una cita: un solo dato en el detalle y en la tarjeta (reunión del 7 oct., R18). Internamente se siguen
// guardando tres: asignado_a (quién la tiene ahora), asignado_original (quién la tenía antes de la primera reasignación) y
// atendido_por (quién la atendió de verdad). Lógica pura, sin React.
import { etiquetaMiembro } from "./equipo"

// Para quién era la cita originalmente: la persona de antes de reasignarla o, si nunca se reasignó, la asignada.
export const asignadoOriginalDe = (cita) => cita.asignadoOriginal || cita.asignadoA || null

// { tipo, nombre, enLugarDe, reasignadaDe, verbo }
//   "normal":    "Profesional: Paula" (la atiende o atendió quien la tenía; o la tiene asignada)
//   "enLugarDe": atendió otra persona: "Atendida por Rosa (en lugar de Paula)"
//   "sinAsignar": nadie la tiene
// `reasignadaDe` solo aplica a una cita que cambió de manos y todavía no se atiende ("Reasignada de Paula").
export function profesionalDeCita(cita, equipo = []) {
  const original = asignadoOriginalDe(cita)
  if (cita.atendidoPor) {
    const nombre = etiquetaMiembro(equipo, cita.atendidoPor)
    if (original && original !== cita.atendidoPor) {
      return { tipo: "enLugarDe", nombre, enLugarDe: etiquetaMiembro(equipo, original), reasignadaDe: null, verbo: cita.estado === "Atendida" ? "Atendida por" : "Atiende" }
    }
    return { tipo: "normal", nombre, enLugarDe: null, reasignadaDe: null, verbo: null }
  }
  if (cita.asignadoA) {
    const reasignada = cita.asignadoOriginal && cita.asignadoOriginal !== cita.asignadoA
    return { tipo: "normal", nombre: etiquetaMiembro(equipo, cita.asignadoA), enLugarDe: null, reasignadaDe: reasignada ? etiquetaMiembro(equipo, cita.asignadoOriginal) : null, verbo: null }
  }
  return { tipo: "sinAsignar", nombre: null, enLugarDe: null, reasignadaDe: null, verbo: null }
}

// Con alcance "propio" (el optómetra) todas las citas que ve son suyas o están sin asignar: el nombre sería siempre el suyo.
// Solo se muestra cuando la cita no la tiene nadie. Quien ve todas las citas (administrador, recepción…) lo ve siempre.
export const mostrarProfesional = (cita, vistaPropia) => !vistaPropia || (!cita.asignadoA && !cita.atendidoPor)

// Línea corta de la tarjeta ("Profesional: Paula" / "Atendida por Rosa (en lugar de Paula)"); null si no hay nada que decir.
export function lineaProfesional(cita, equipo = []) {
  const p = profesionalDeCita(cita, equipo)
  if (p.tipo === "sinAsignar") return null
  if (p.tipo === "enLugarDe") return `${p.verbo} ${p.nombre} (en lugar de ${p.enLugarDe})`
  return `Profesional: ${p.nombre}`
}

// ¿La cita puede reasignarse? Solo mientras está pendiente o en espera (no en atención ni cerrada).
export const esReasignable = (cita) => ["Pendiente", "En Espera"].includes(cita.estado)

// ¿Se puede tomar? Sin asignar, sin atender y todavía abierta.
export const esTomable = (cita) => !cita.asignadoA && !cita.atendidoPor && esReasignable(cita)
