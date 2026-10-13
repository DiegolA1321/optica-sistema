// Reportes v2: período, período anterior equivalente, variación y descarga de Excel. Lógica pura (salvo la descarga).
import { ahoraEcuador, aEcuador } from "./horaEcuador"
import { fechaAISO } from "./disponibilidad"
import { sumarDiasISO } from "./controles"
import { registrarLog } from "./logs"

export const PERIODOS = [
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
  { id: "trimestre", label: "Últimos 3 meses" },
  { id: "semestre", label: "Últimos 6 meses" },
  { id: "anio", label: "Este año" },
  { id: "personalizado", label: "Personalizado" },
]

const iso = (y, m, d) => fechaAISO(new Date(y, m, d))
const diasEnMes = (y, m) => new Date(y, m + 1, 0).getDate()

export function rangoDePeriodo(id, personalizado = {}, hoy = ahoraEcuador()) {
  const y = hoy.getFullYear(), m = hoy.getMonth()
  const hoyISO = iso(y, m, hoy.getDate())
  if (id === "personalizado") return { inicio: personalizado.inicio || iso(y, m, 1), fin: personalizado.fin || hoyISO }
  if (id === "mesPasado") return { inicio: iso(y, m - 1, 1), fin: iso(y, m, 0) }
  if (id === "trimestre") return { inicio: iso(y, m - 2, 1), fin: hoyISO }
  if (id === "semestre") return { inicio: iso(y, m - 5, 1), fin: hoyISO }
  if (id === "anio") return { inicio: iso(y, 0, 1), fin: hoyISO }
  return { inicio: iso(y, m, 1), fin: hoyISO }
}

const diasEntre = (a, b) => Math.round((Date.UTC(...b.split("-").map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(...a.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000)

// Período anterior equivalente: el mes en curso se compara con el mismo tramo de días del mes anterior (1–12 contra 1–12),
// no con el mes completo; el año en curso, con el mismo tramo del año anterior; el resto, con la ventana inmediata de igual largo.
export function rangoAnterior(id, rango, hoy = ahoraEcuador()) {
  const y = hoy.getFullYear(), m = hoy.getMonth()
  if (id === "mes") return { inicio: iso(y, m - 1, 1), fin: iso(y, m - 1, Math.min(hoy.getDate(), diasEnMes(y, m - 1))) }
  if (id === "mesPasado") return { inicio: iso(y, m - 2, 1), fin: iso(y, m - 1, 0) }
  if (id === "anio") return { inicio: iso(y - 1, 0, 1), fin: iso(y - 1, hoy.getMonth(), Math.min(hoy.getDate(), diasEnMes(y - 1, hoy.getMonth()))) }
  const largo = diasEntre(rango.inicio, rango.fin) + 1
  const fin = sumarDiasISO(rango.inicio, -1)
  return { inicio: sumarDiasISO(fin, -(largo - 1)), fin }
}

// La fecha calendario (de Ecuador) de una fecha pura "AAAA-MM-DD" o de un instante con hora.
export const diaDe = (valor) => (!valor ? "" : String(valor).includes("T") ? fechaAISO(aEcuador(valor)) : String(valor).slice(0, 10))
export const enRango = (valor, rango) => { const d = diaDe(valor); return !!d && d >= rango.inicio && d <= rango.fin }

// Variación frente al período anterior. `buenoSiSube`: más ventas es bueno; más inasistencias es malo. `puntos`: tasas (se resta, no se divide).
export function variacion(actual, previo, { buenoSiSube = true, puntos = false } = {}) {
  if (previo == null || actual == null) return { texto: "Sin período anterior", tono: "neutro", flecha: "" }
  if (actual === previo) return { texto: "Igual que antes", tono: "neutro", flecha: "→" }
  if (!puntos && previo === 0) return { texto: "Antes: 0", tono: buenoSiSube ? "bueno" : "malo", flecha: "↑" }
  const sube = actual > previo
  const cambio = puntos ? Math.abs(actual - previo) : Math.abs(Math.round(((actual - previo) / previo) * 100))
  return { texto: `${cambio}${puntos ? " pts" : "%"} vs. antes`, tono: sube === buenoSiSube ? "bueno" : "malo", flecha: sube ? "↑" : "↓" }
}

export const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null)

// Descarga un Excel con exactamente las filas que se ven. Las primeras filas llevan el título y los filtros aplicados.
// Si lleva datos personales, queda registrado en la actividad (quién y cuándo).
export async function descargarExcel({ usuario, archivo, titulo, filtros = "", columnas, filas, personal = true }) {
  const { default: writeExcelFile } = await import("write-excel-file/browser")
  const celda = (v) => (v == null || v === "" ? null : { value: typeof v === "number" ? v : String(v) })
  const datos = [
    [{ value: titulo, fontWeight: "bold" }],
    [{ value: filtros }],
    [],
    columnas.map((c) => ({ value: c.titulo, fontWeight: "bold" })),
    ...filas.map((f) => columnas.map((c) => celda(c.valor(f)))),
  ]
  await writeExcelFile(datos, { columns: columnas.map((c) => ({ width: c.ancho || 18 })) }).toFile(`${archivo}.xlsx`)
  if (personal) registrarLog(usuario, "reportes", "descargó un Excel con datos de pacientes", `${titulo} · ${filas.length} filas`)
}
