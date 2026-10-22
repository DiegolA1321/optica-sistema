// El documento de identidad de un paciente: cédula ecuatoriana (con su dígito verificador), pasaporte u otro documento (sin esa validación, para extranjeros).
// El número se guarda en `cedula` (es también el usuario del portal) y el tipo en `tipoDocumento` (migración 0136). Lógica pura.
import { esCedulaValida } from "./validaciones"

export const TIPOS_DOCUMENTO = [
  { id: "cedula", etiqueta: "Cédula", placeholder: "1315556667", ayuda: "Cédula ecuatoriana de 10 dígitos." },
  { id: "pasaporte", etiqueta: "Pasaporte", placeholder: "AB123456", ayuda: "Número de pasaporte (letras y números)." },
  { id: "otro", etiqueta: "Otro documento", placeholder: "Número del documento", ayuda: "Cualquier otro documento de identidad (letras, números y guiones)." },
]
export const tipoDeDocumento = (paciente) => (TIPOS_DOCUMENTO.some((t) => t.id === paciente?.tipoDocumento) ? paciente.tipoDocumento : "cedula")
export const etiquetaDocumento = (paciente) => TIPOS_DOCUMENTO.find((t) => t.id === tipoDeDocumento(paciente))?.etiqueta || "Cédula"

// Lo que se deja escribir en el campo: una cédula, solo dígitos (10); los demás, letras, números y guiones (hasta 20), en mayúsculas.
export function filtrarDocumento(tipo, valor) {
  const t = String(valor ?? "")
  if (tipo === "cedula") return t.replace(/\D/g, "").slice(0, 10)
  return t.replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 20)
}

// Texto del problema, o "" si el documento sirve. La cédula pasa por el dígito verificador; el pasaporte y otros solo piden una longitud razonable.
export function errorDeDocumento(tipo, valor) {
  const v = String(valor || "").trim()
  if (!v) return "Escribe el número del documento."
  if (tipo === "cedula") return esCedulaValida(v) ? "" : "Esa cédula no es válida — revisa los dígitos. Si es extranjero, elige Pasaporte u Otro documento."
  if (v.length < 5) return "El número del documento es muy corto (mínimo 5 caracteres)."
  return /^[A-Za-z0-9-]+$/.test(v) ? "" : "Usa solo letras, números y guiones."
}
