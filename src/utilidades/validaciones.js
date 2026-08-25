// ─── Utilidades de validación de formularios ───
// Filtros "en vivo" (mientras el usuario escribe) + validadores para el envío.

// Solo letras (con tildes, ñ, espacios, guion y apóstrofe para nombres compuestos).
export function filtrarSoloLetras(valor, maxLen) {
  let limpio = (valor || "").replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, "")
  if (maxLen) limpio = limpio.slice(0, maxLen)
  return limpio
}

// Solo dígitos, con longitud máxima opcional (ej. cédula = 10, teléfono = 10).
export function filtrarSoloNumeros(valor, maxLen) {
  let limpio = (valor || "").replace(/[^0-9]/g, "")
  if (maxLen) limpio = limpio.slice(0, maxLen)
  return limpio
}

// Números con un signo inicial opcional y un solo punto decimal (valores dióptricos, precios).
export function filtrarNumeroDecimalConSigno(valor) {
  let limpio = (valor || "").replace(/[^0-9.+-]/g, "")
  const signo = limpio.match(/^[+-]/)?.[0] || ""
  limpio = signo + limpio.slice(signo.length).replace(/[+-]/g, "")
  const partes = limpio.split(".")
  if (partes.length > 2) limpio = partes[0] + "." + partes.slice(1).join("")
  return limpio
}

// Números positivos con un solo punto decimal (precios, montos).
export function filtrarNumeroDecimal(valor) {
  let limpio = (valor || "").replace(/[^0-9.]/g, "")
  const partes = limpio.split(".")
  if (partes.length > 2) limpio = partes[0] + "." + partes.slice(1).join("")
  return limpio
}

export function esNombreValido(valor) {
  return Boolean(valor && valor.trim().length > 1 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(valor.trim()))
}

// Cédula ecuatoriana: algoritmo real de validación (módulo 10), no sólo contar
// dígitos — antes "0000000000" pasaba como válida. Verifica código de provincia,
// tipo de persona (tercer dígito) y el dígito verificador según el algoritmo
// oficial del Registro Civil / INEC.
export function esCedulaValida(valor) {
  const cedula = String(valor || "")
  if (!/^\d{10}$/.test(cedula)) return false

  const provincia = Number(cedula.slice(0, 2))
  if (provincia < 1 || provincia > 24) return false

  const tercerDigito = Number(cedula[2])
  if (tercerDigito >= 6) return false // 0-5: persona natural; 6-9 no corresponden a cédula de identidad

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let valorPos = Number(cedula[i]) * coeficientes[i]
    if (valorPos >= 10) valorPos -= 9
    suma += valorPos
  }
  const verificador = (10 - (suma % 10)) % 10
  return verificador === Number(cedula[9])
}

// Teléfono: entre 7 y 10 dígitos (fijo o celular), o vacío si es opcional.
export function esTelefonoValido(valor, opcional = true) {
  if (!valor) return opcional
  return /^\d{7,10}$/.test(valor)
}
