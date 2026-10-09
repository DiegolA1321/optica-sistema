// Ausencias con autor y citas que hay que pasar a otra persona (reunión del 7 oct., R18). Lógica pura, sin React.
// Una ausencia de "Mi horario" vive en disponibilidad.excepciones[fecha].ausencias como { inicio, fin, motivo, usuarioId, usuarioNombre }.
// Las anteriores a este cambio no tienen autor: no se pueden atribuir a nadie, así que no generan avisos.
import { minutosDesde24h, minutosDesdeMedianoche } from "./disponibilidad"
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
  return ausencias.some((a) => a.usuarioId === personaId && ausenciaCubreCita(a, { hora }))
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
  return grupos.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.personaNombre || "").localeCompare(b.personaNombre || ""))
}
