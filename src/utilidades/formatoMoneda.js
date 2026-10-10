// Fuente única del formato del dinero (regla 12 de docs/principios-diseno.md, igual que formatoFecha.js para las fechas):
// "$3,915.50": signo de dólar, separador de miles con coma y dos decimales con punto. Ninguna pantalla arma un monto con toFixed(2).
// Un valor que no es número (vacío, texto, null) sale como "$0.00".
export function dinero(valor) {
  const n = Number(valor)
  const cifra = Number.isFinite(n) ? n : 0
  const texto = Math.abs(cifra).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (cifra < 0 && Number(texto.replace(/,/g, "")) !== 0 ? "-$" : "$") + texto
}
