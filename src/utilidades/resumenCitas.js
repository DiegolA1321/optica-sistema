// Números de las citas de un paciente para la pestaña "Resumen" de su perfil.
import { nombreMes } from "./formatoFecha"

const PENDIENTES = ["Pendiente", "En Espera", "En Atención"]

// Atendidas, no asistió, pendientes (incluye en espera y en atención) y canceladas.
export function contarCitas(citas) {
  const conteo = { atendidas: 0, noAsistio: 0, pendientes: 0, canceladas: 0 }
  for (const c of citas) {
    if (c.estado === "Atendida") conteo.atendidas++
    else if (c.estado === "No Asistió") conteo.noAsistio++
    else if (c.estado === "Cancelada") conteo.canceladas++
    else if (PENDIENTES.includes(c.estado)) conteo.pendientes++
  }
  return conteo
}

// Citas por mes en los últimos `meses` meses (el último es el de `hoy`, "AAAA-MM-DD"). Las canceladas no cuentan:
// el gráfico muestra cuántas veces vino (o tenía que venir), no las que se cayeron.
export function citasPorMes(citas, hoy, meses = 12) {
  const [anio, mes] = hoy.split("-").map(Number)
  const lista = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(anio, mes - 1 - i, 1)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    lista.push({ clave, etiqueta: nombreMes(d.getMonth(), "corto"), anio: d.getFullYear(), total: 0, atendidas: 0 })
  }
  for (const c of citas) {
    if (c.estado === "Cancelada" || !c.fecha) continue
    const m = lista.find((x) => x.clave === c.fecha.slice(0, 7))
    if (!m) continue
    m.total++
    if (c.estado === "Atendida") m.atendidas++
  }
  return lista
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

// Día de la semana en que más veces vino (citas atendidas); null si no hay al menos dos o no hay un día claramente mayor.
export function diaMasFrecuente(citas) {
  const cuenta = new Array(7).fill(0)
  let total = 0
  for (const c of citas) {
    if (c.estado !== "Atendida" || !c.fecha) continue
    const [a, m, d] = c.fecha.split("-").map(Number)
    cuenta[new Date(a, m - 1, d).getDay()]++
    total++
  }
  if (total < 2) return null
  const max = Math.max(...cuenta)
  if (cuenta.filter((n) => n === max).length > 1) return null
  return { dia: DIAS[cuenta.indexOf(max)], veces: max }
}
