// Validación del paso 1 «Tus datos» de la web pública.
import { esCedulaValida, esEmailValido } from "./validaciones"

export const MENSAJE_CEDULA_INVALIDA = "Revisa el último dígito: esa cédula no existe."

// Problemas de cada campo del paso 1 ("" = bien). `mostrar`: ya se intentó continuar, así que también se avisa de lo que falta.
export function erroresDatos(d, esPasaporte, mostrar) {
  const falta = (v, msg) => (mostrar && !String(v || "").trim() ? msg : "")
  let documento = ""
  if (esPasaporte) {
    if (mostrar && !/^[A-Z0-9]{5,20}$/.test(d.cedula)) documento = "El pasaporte tiene entre 5 y 20 letras o números."
  } else if (d.cedula.length === 10 && !esCedulaValida(d.cedula)) documento = MENSAJE_CEDULA_INVALIDA
  else if (mostrar && d.cedula.length < 10) documento = "La cédula tiene 10 números."
  return {
    nombres: falta(d.nombres, "Escribe tus nombres."),
    apellidos: falta(d.apellidos, "Escribe tus apellidos."),
    documento,
    telefono: mostrar && d.telefono.length < 7 ? "Escribe un teléfono de 7 a 10 números." : "",
    correo: mostrar && d.correo && !esEmailValido(d.correo, false) ? "Ese correo no es válido — corrígelo o déjalo vacío." : "",
  }
}

export const datosCompletos = (d, esPasaporte) => {
  const e = erroresDatos(d, esPasaporte, true)
  return !e.nombres && !e.apellidos && !e.documento && !e.telefono && !e.correo
}
