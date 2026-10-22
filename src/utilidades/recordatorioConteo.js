// Recordatorio del conteo físico del inventario (Configuración → Inventario): «Recordar el conteo cada N días» (por defecto 30, se puede desactivar).
// Cuando toca, aparece en «Requiere tu atención» del Inventario y del Inicio con «Imprimir hoja»; al generar la hoja de conteo se reinicia. Todo vive en la parametrización de la óptica:
// `recordatorioConteo: { activo, dias }` y `ultimoConteo` (fecha ISO de la última hoja generada). Una óptica que nunca contó cuenta desde el día que se creó. Lógica pura.
export const DIAS_CONTEO_POR_DEFECTO = 30
export const TOPE_DIAS_CONTEO = 365

export function recordatorioDeConteo(parametrizacion) {
  const r = parametrizacion?.recordatorioConteo
  const n = Math.floor(Number(r?.dias))
  return { activo: r?.activo !== false, dias: Number.isFinite(n) && n >= 1 && n <= TOPE_DIAS_CONTEO ? n : DIAS_CONTEO_POR_DEFECTO }
}

const aDia = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Date.UTC(a, m - 1, d) }
export const diasEntre = (desde, hasta) => Math.round((aDia(hasta) - aDia(desde)) / 86400000)

// { toca, dias, cada, ultimo, nunca }: `dias` = días desde el último conteo (o desde que se creó la óptica si nunca se contó).
export function conteoPendiente({ parametrizacion, creadaEn = null, hoy }) {
  const { activo, dias: cada } = recordatorioDeConteo(parametrizacion)
  const ultimo = parametrizacion?.ultimoConteo ? String(parametrizacion.ultimoConteo).slice(0, 10) : null
  const base = ultimo || (creadaEn ? String(creadaEn).slice(0, 10) : null)
  if (!activo || !base) return { toca: false, dias: null, cada, ultimo, nunca: !ultimo }
  const dias = diasEntre(base, hoy)
  return { toca: dias >= cada, dias, cada, ultimo, nunca: !ultimo }
}

export const textoConteo = ({ dias, nunca }) => (nunca ? `Todavía no se hizo ningún conteo (hace ${dias} ${dias === 1 ? "día" : "días"} que la óptica usa el sistema)` : `Hace ${dias} ${dias === 1 ? "día" : "días"} del último conteo`)
