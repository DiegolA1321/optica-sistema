// Ausencias con autor y citas que hay que pasar a otra persona (reunión del 7 oct., R18). Lógica pura, sin React.
// Una ausencia de "Mi horario" vive en disponibilidad.excepciones[fecha].ausencias como { inicio, fin, motivo, usuarioId, usuarioNombre }.
// Las anteriores a este cambio no tienen autor: no se pueden atribuir a nadie, así que no generan avisos.
import { minutosDesde24h, minutosDesdeMedianoche } from "./disponibilidad"
import { ausenciaCubreMinuto, diasDelRango } from "./agendaPersonal"
import { esReasignable } from "./profesionalCita"
import { puede } from "./permisosUi"

// Reasignar depende del PERMISO, no del nombre del rol: editar citas con alcance "todo".
export const puedeReasignar = (usuario, alcance) => puede(usuario, "citas", "editar") && alcance !== "propio"

// ¿La ausencia cubre la hora de inicio de esa cita?
export function ausenciaCubreCita(ausencia, cita) {
  const inicio = minutosDesdeMedianoche(cita.hora)
  return inicio >= minutosDesde24h(ausencia.inicio) && inicio < minutosDesde24h(ausencia.fin)
}

// ¿Esa persona registró una ausencia que cubre esta fecha y hora? (para marcarla en el selector)
export function ausenteEnHorario(disponibilidad, personaId, fecha, hora) {
  if (!personaId || !fecha || !hora) return false
  const ausencias = disponibilidad?.excepciones?.[fecha]?.ausencias || []
  if (ausencias.some((a) => a.usuarioId === personaId && ausenciaCubreCita(a, { hora }))) return true
  // Las ausencias aprobadas de «Horario → Ausencias».
  const minuto = minutosDesdeMedianoche(hora)
  return (disponibilidad?.profesionales || []).some((p) => p.id === personaId && (p.ausencias || []).some((a) => ausenciaCubreMinuto(a, fecha, minuto, disponibilidad)))
}

// Grupos de citas por reasignar: una entrada por persona y fecha con ausencia registrada que todavía tiene citas abiertas
// (Pendiente o En Espera) asignadas a ella dentro del rango ausente. Ordenados por fecha. `hoy` = "AAAA-MM-DD".
export function citasPorReasignar(citas = [], disponibilidad, hoy) {
  const grupos = []
  for (const [fecha, exc] of Object.entries(disponibilidad?.excepciones || {})) {
    if (fecha < hoy) continue
    const porPersona = new Map()
    for (const ausencia of exc?.ausencias || []) {
      if (!ausencia.usuarioId) continue
      const afectadas = citas.filter((c) => c.fecha === fecha && c.asignadoA === ausencia.usuarioId && esReasignable(c) && ausenciaCubreCita(ausencia, c))
      if (afectadas.length === 0) continue
      const previo = porPersona.get(ausencia.usuarioId) || { fecha, personaId: ausencia.usuarioId, personaNombre: ausencia.usuarioNombre || null, citas: [] }
      for (const c of afectadas) if (!previo.citas.some((x) => x.id === c.id)) previo.citas.push(c)
      porPersona.set(ausencia.usuarioId, previo)
    }
    for (const g of porPersona.values()) {
      g.citas.sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
      grupos.push(g)
    }
  }
  // Las ausencias APROBADAS (Horario → Ausencias): cada día de la ausencia, las citas abiertas de esa persona que caen en su tiempo ausente.
  for (const p of disponibilidad?.profesionales || []) {
    for (const a of p.ausencias || []) {
      for (const fecha of diasDelRango(a.desde < hoy ? hoy : a.desde, a.hasta)) {
        const afectadas = citas.filter((c) => c.fecha === fecha && c.asignadoA === p.id && esReasignable(c) && ausenciaCubreMinuto(a, fecha, minutosDesdeMedianoche(c.hora), disponibilidad))
        if (afectadas.length === 0) continue
        let g = grupos.find((x) => x.fecha === fecha && x.personaId === p.id)
        if (!g) { g = { fecha, personaId: p.id, personaNombre: null, citas: [] }; grupos.push(g) }
        for (const c of afectadas) if (!g.citas.some((x) => x.id === c.id)) g.citas.push(c)
        g.citas.sort((x, y) => minutosDesdeMedianoche(x.hora) - minutosDesdeMedianoche(y.hora))
      }
    }
  }
  return grupos.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.personaNombre || "").localeCompare(b.personaNombre || ""))
}
