// FORMATO ÚNICO DE FECHAS Y HORAS de todo el sistema. Ninguna pantalla arma una fecha o una hora a mano (ni con
// toLocaleDateString, ni con arreglos de meses): se pide aquí con un formato con nombre.
//
//   formatoFecha(valor, nombre)      ejemplo con 2026-10-08
//   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
//   "largo"         Jueves, 8 de octubre de 2026     cabecera, detalle de la cita, textos largos
//   "largoSinDia"   8 de octubre de 2026             frases ("agendada para el 8 de octubre de 2026")
//   "medio"         8 oct 2026                       tarjetas, listas, tablas, registros
//   "medioSinAnio"  8 oct                            lo mismo cuando el año sobra
//   "corto"         jue 8 oct 2026                   título de un día en el selector de periodo
//   "calendario"    Jueves, 8 de octubre             encabezados de día de la lista y del calendario
//   "diaNumero"     Jue 8                            atajos y etiquetas muy cortas
//   "diaMes"        8 de octubre                     un día dentro de su mes (calendario mensual)
//   "mesAnio"       Octubre 2026                     título de un mes
//   "mes" / "dia"   oct / 08                         piezas sueltas (el riel de fechas de la lista)
//
// Con `{ enFrase: true }` la primera letra queda en minúscula para incrustarla en una oración ("el martes, 6 de
// octubre"). Los rangos tienen su propia función (tituloSemana, rangoLargo). Las horas, una sola: hora().
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]
export { MESES_CORTOS, MESES_LARGOS }

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const dos = (n) => String(n).padStart(2, "0")

// Acepta "AAAA-MM-DD" (fecha sin hora, sin corrimiento de zona horaria), un texto con hora (timestamptz) o un Date.
// Devuelve null si no hay fecha válida.
function partes(valor) {
  if (!valor) return null
  let anio, mes, dia
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor) && (valor.length === 10 || (valor[10] === "T" && /T00:00:00(\.000)?Z?$/.test(valor.slice(10))))) {
    ;[anio, mes, dia] = valor.slice(0, 10).split("-").map(Number)
  } else {
    const f = valor instanceof Date ? valor : new Date(valor)
    if (Number.isNaN(f.getTime())) return null
    anio = f.getFullYear(); mes = f.getMonth() + 1; dia = f.getDate()
  }
  return { anio, mes, dia, diaSemana: new Date(anio, mes - 1, dia).getDay() }
}

const FORMATOS = {
  largo: (p) => mayuscula(`${DIAS_LARGOS[p.diaSemana]}, ${p.dia} de ${MESES_LARGOS[p.mes - 1]} de ${p.anio}`),
  largoSinDia: (p) => `${p.dia} de ${MESES_LARGOS[p.mes - 1]} de ${p.anio}`,
  medio: (p) => `${p.dia} ${MESES_CORTOS[p.mes - 1]} ${p.anio}`,
  medioSinAnio: (p) => `${p.dia} ${MESES_CORTOS[p.mes - 1]}`,
  corto: (p) => `${DIAS_CORTOS[p.diaSemana]} ${p.dia} ${MESES_CORTOS[p.mes - 1]} ${p.anio}`,
  calendario: (p) => mayuscula(`${DIAS_LARGOS[p.diaSemana]}, ${p.dia} de ${MESES_LARGOS[p.mes - 1]}`),
  diaNumero: (p) => `${mayuscula(DIAS_CORTOS[p.diaSemana])} ${p.dia}`,
  diaMes: (p) => `${p.dia} de ${MESES_LARGOS[p.mes - 1]}`,
  mesAnio: (p) => `${mayuscula(MESES_LARGOS[p.mes - 1])} ${p.anio}`,
  mes: (p) => MESES_CORTOS[p.mes - 1],
  dia: (p) => dos(p.dia),
}
export const NOMBRES_FORMATO = Object.keys(FORMATOS)

export function formatoFecha(valor, nombre = "medio", { enFrase = false } = {}) {
  const formato = FORMATOS[nombre]
  if (!formato) throw new Error(`Formato de fecha desconocido: ${nombre}`)
  const p = partes(valor)
  if (!p) return ""
  const texto = formato(p)
  return enFrase ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto
}

// Título de un rango de días: "5 – 11 oct 2026"; entre dos meses "28 sept – 4 oct 2026"; entre dos años
// "28 dic 2026 – 3 ene 2027". Con un solo extremo, ese día en formato "medio".
export function tituloSemana(desde, hasta) {
  const a = partes(desde), b = partes(hasta)
  if (!a || !b) return formatoFecha(desde || hasta, "medio")
  if (a.anio !== b.anio) return `${formatoFecha(desde, "medio")} – ${formatoFecha(hasta, "medio")}`
  if (a.mes !== b.mes) return `${formatoFecha(desde, "medioSinAnio")} – ${formatoFecha(hasta, "medio")}`
  return `${a.dia} – ${b.dia} ${MESES_CORTOS[b.mes - 1]} ${b.anio}`
}

// Rango en palabras (lectores de pantalla y títulos largos): "5 al 11 de octubre de 2026".
export function rangoLargo(desde, hasta) {
  const a = partes(desde), b = partes(hasta)
  if (!a || !b) return formatoFecha(desde || hasta, "largoSinDia")
  if (a.anio !== b.anio) return `${formatoFecha(desde, "largoSinDia")} al ${formatoFecha(hasta, "largoSinDia")}`
  if (a.mes !== b.mes) return `${a.dia} de ${MESES_LARGOS[a.mes - 1]} al ${formatoFecha(hasta, "largoSinDia")}`
  return `${a.dia} al ${formatoFecha(hasta, "largoSinDia")}`
}

// LA hora del sistema: "09:00 AM" (12 h, con cero a la izquierda). Acepta "HH:MM" en 24 h ("14:30" → "02:30 PM"), una hora
// que ya viene en 12 h ("9:00 am" → "09:00 AM"), un Date o un texto con fecha y hora (timestamptz). Sin valor, "".
export function hora(valor) {
  if (valor === null || valor === undefined || valor === "") return ""
  let h, m
  if (typeof valor === "string" && /^\d{1,2}:\d{2}\s*[ap]\.?m\.?$/i.test(valor.trim())) {
    const [, hh, mm, ap] = valor.trim().match(/^(\d{1,2}):(\d{2})\s*([ap])/i)
    return `${dos(Number(hh))}:${mm} ${ap.toUpperCase()}M`
  }
  if (typeof valor === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(valor.trim())) {
    ;[h, m] = valor.trim().split(":").map(Number)
  } else {
    const f = valor instanceof Date ? valor : new Date(valor)
    if (Number.isNaN(f.getTime())) return ""
    h = f.getHours(); m = f.getMinutes()
  }
  return `${dos(h % 12 === 0 ? 12 : h % 12)}:${dos(m)} ${h < 12 ? "AM" : "PM"}`
}

// Fecha y hora juntas: "7 oct, 08:19 AM" (o "7 oct 2026, 08:19 AM" con anio: true), para registros.
export function fechaHoraLegible(valor, { anio = false } = {}) {
  const f = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(f.getTime())) return ""
  return `${formatoFecha(f, anio ? "medio" : "medioSinAnio")}, ${hora(f)}`
}

// Atajos de uso común (mismos formatos, nombres que ya usa el resto del código).
export const fechaLegible = (valor) => formatoFecha(valor, "medio")
export const fechaCorta = (valor) => formatoFecha(valor, "medioSinAnio")
export const horaLegible = hora
