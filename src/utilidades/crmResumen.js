// Los cinco datos de arriba del CRM (decisión de la Ronda 5): próximo cumpleaños, el cliente más fiel, quien más refiere, controles vencidos y contactados del mes.
// Cada uno sale de las mismas listas del módulo (Para contactar, Fidelización y Seguimiento), así que el número de la tarjeta es el de su lista. Lógica pura.
import { ahoraEcuador } from "./horaEcuador"
import { diasParaCumpleanos } from "./fidelizacion"
import { fechaAISO, isoAFechaLocal } from "./disponibilidad"
import { resultadoEfectivo, rankingReferidores } from "./crmContactos"
import { enPeriodo } from "./periodoLista"

const nacimientoDe = (p) => p.fechaNacimiento || p.fecha_nacimiento || p.fechaDeNacimiento || ""

// Los cumpleaños que vienen, del más cercano al más lejano: [{ paciente, dias, fecha (ISO) }]. Hoy cuenta como 0.
export function proximosCumpleanos(pacientes = [], hoy = fechaAISO(ahoraEcuador()), limite = Infinity) {
  const inicio = isoAFechaLocal(hoy)
  return pacientes
    .filter((p) => !p.anonimizado && p.estadoClinico !== "Anonimizado")
    .map((p) => ({ paciente: p, dias: diasParaCumpleanos(nacimientoDe(p), inicio) }))
    .filter((x) => x.dias !== null)
    .sort((a, b) => a.dias - b.dias || a.paciente.nombre.localeCompare(b.paciente.nombre))
    .slice(0, limite)
    .map((x) => { const d = new Date(inicio); d.setDate(d.getDate() + x.dias); return { ...x, fecha: fechaAISO(d) } })
}

// «hoy», «mañana», «en 2 días».
export const enDias = (n) => (n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`)

// { cumple, fiel, referidor, controles, contactados: { n, volvieron } }; cada uno es null (o 0) cuando todavía no hay de dónde sacarlo.
// `puntosDe(paciente)` es la cuenta del programa de fidelización de la óptica ({ puntos: { total }, nivel: { nombre } }).
export function resumenCrm({ pacientes = [], contactos = [], citas = [], filas = [], puntosDe, hoy = fechaAISO(ahoraEcuador()) }) {
  const [cumple] = proximosCumpleanos(pacientes, hoy, 1)
  let fiel = null
  for (const p of pacientes) {
    const f = puntosDe(p)
    if (f.puntos.total > 0 && (!fiel || f.puntos.total > fiel.puntos || (f.puntos.total === fiel.puntos && p.nombre.localeCompare(fiel.paciente.nombre) < 0))) fiel = { paciente: p, puntos: f.puntos.total, nivel: f.nivel?.nombre || "" }
  }
  const [referidor] = rankingReferidores(pacientes)
  const delMes = contactos.filter((c) => enPeriodo(c.creadoEn, { filtro: "mes", ref: "", desde: "", hasta: "" }, hoy))
  return {
    cumple: cumple || null,
    fiel,
    referidor: referidor ? { paciente: referidor.paciente, n: referidor.valor } : null,
    controles: filas.filter((f) => f.motivos.some((m) => m.id === "control_vencido")).length,
    contactados: { n: delMes.length, volvieron: delMes.filter((c) => resultadoEfectivo(c, citas) === "agendo").length },
  }
}
