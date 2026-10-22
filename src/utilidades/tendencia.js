// Cuentas del gráfico de tendencia (Reportes, panel del superadmin y demás): promedio de 3 períodos, línea de tendencia (mínimos cuadrados),
// cambio frente al período anterior y la frase que lo explica en palabras. Lógica pura, sin React.

export const MIN_PERIODOS_TENDENCIA = 3

// Promedio de cada período con los dos anteriores (los primeros usan los que haya).
export function promedioMovil(valores, ventana = 3) {
  return valores.map((_, i) => {
    const tramo = valores.slice(Math.max(0, i - ventana + 1), i + 1)
    return tramo.reduce((s, v) => s + v, 0) / tramo.length
  })
}

// Recta que mejor se ajusta a los valores: { pendiente, intercepto } con x = 0, 1, 2…
export function rectaDeTendencia(valores) {
  const n = valores.length
  if (n < 2) return { pendiente: 0, intercepto: valores[0] || 0 }
  const mediaX = (n - 1) / 2
  const mediaY = valores.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  valores.forEach((v, i) => { num += (i - mediaX) * (v - mediaY); den += (i - mediaX) ** 2 })
  const pendiente = den === 0 ? 0 : num / den
  return { pendiente, intercepto: mediaY - pendiente * mediaX }
}

// Cuántos períodos tienen historia: desde el primero con algún valor hasta el último. Una óptica nueva con un solo mes de datos no tiene tendencia que mostrar.
export function periodosConHistoria(valores) {
  const primero = valores.findIndex((v) => (v || 0) > 0)
  return primero === -1 ? 0 : valores.length - primero
}

// Cambio del último período frente al anterior, en porcentaje (null si el anterior fue 0: no hay con qué comparar).
export function cambioFrenteAlAnterior(valores) {
  if (valores.length < 2) return null
  const ultimo = valores[valores.length - 1] || 0
  const anterior = valores[valores.length - 2] || 0
  if (anterior === 0) return ultimo === 0 ? 0 : null
  return Math.round(((ultimo - anterior) / anterior) * 100)
}

// «Estable» si, a lo largo de todo el rango, la tendencia mueve menos del 5 % del promedio.
const esEstable = (pendiente, n, media) => Math.abs(pendiente) * (n - 1) < Math.max(0.05 * Math.abs(media), 1e-9)

// Todo junto. `datos`: [{ etiqueta, valor }]. `periodo`: «mes», «semana»… `plural`: lo que se cuenta («consultas»). `formato`: valor → texto.
export function analizarTendencia(datos, { periodo = "mes", plural = "registros", sujeto = `las ${plural}`, formato = (v) => String(Math.round(v * 10) / 10) } = {}) {
  const valores = datos.map((d) => d.valor || 0)
  const n = valores.length
  const promedio = promedioMovil(valores)
  const conHistoria = periodosConHistoria(valores)
  const hayTendencia = conHistoria >= MIN_PERIODOS_TENDENCIA
  const recta = rectaDeTendencia(valores.slice(n - conHistoria))
  const desde = n - conHistoria
  const tendencia = hayTendencia ? valores.map((_, i) => (i < desde ? null : recta.intercepto + recta.pendiente * (i - desde))) : valores.map(() => null)
  const cambio = cambioFrenteAlAnterior(valores)
  const media = valores.reduce((s, v) => s + v, 0) / Math.max(1, n)
  const direccion = !hayTendencia ? null : esEstable(recta.pendiente, conHistoria, media) ? "estable" : recta.pendiente > 0 ? "sube" : "baja"
  const mejor = valores.some((v) => v > 0) ? datos[valores.indexOf(Math.max(...valores))] : null
  let frase
  if (!valores.some((v) => v > 0)) frase = `Todavía no hay ${plural} en estos ${n} ${periodo === "mes" ? "meses" : periodo + "s"}.`
  else if (!hayTendencia) frase = `Hay ${conHistoria === 1 ? "un solo " + periodo : conHistoria + " " + (periodo === "mes" ? "meses" : periodo + "s")} con datos: la tendencia se dibuja desde ${MIN_PERIODOS_TENDENCIA} ${periodo === "mes" ? "meses" : periodo + "s"}.`
  else {
    const ini = recta.intercepto
    const fin = recta.intercepto + recta.pendiente * (conHistoria - 1)
    const plurales = periodo === "mes" ? "meses" : periodo + "s"
    const rango = `${conHistoria === n ? `En los últimos ${n} ${plurales}` : `Desde que hay datos (${conHistoria} ${plurales})`}`
    frase = direccion === "estable"
      ? `${rango} ${sujeto} se mantienen estables, en torno a ${formato(media)} por ${periodo}.`
      : `${rango} ${sujeto} van ${direccion === "sube" ? "en aumento" : "a la baja"}: de ${formato(Math.max(0, ini))} a ${formato(Math.max(0, fin))} por ${periodo}.`
    if (mejor) frase += ` El mejor ${periodo} fue ${mejor.etiqueta}.`
  }
  return { valores, promedio, tendencia, hayTendencia, pendiente: hayTendencia ? recta.pendiente : null, direccion, cambio, mejor, frase, conHistoria }
}
