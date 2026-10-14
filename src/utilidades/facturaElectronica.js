// La factura electrónica que la óptica emite por fuera (el sistema no la emite): su clave de acceso, sus archivos (RIDE en PDF y XML autorizado
// por el SRI) y los textos para entregarla. Lógica pura; la base repite estas comprobaciones (migración 0110).
//
// Clave de acceso (49 dígitos): fecha de emisión ddmmaaaa (8) · tipo de comprobante (2, "01" = factura) · RUC (13) · ambiente (1) ·
// serie (6: establecimiento y punto de emisión) · secuencial (9) · código numérico (8) · tipo de emisión (1) · dígito verificador (1, módulo 11).
// La serie y el secuencial son los del número de la factura (001-001-000001216), así que la clave y el número se pueden cruzar.
import { normalizarFacturaElectronica } from "./comprobantes"

export const MAX_BYTES_PDF = 5 * 1024 * 1024
export const MAX_BYTES_XML = 2 * 1024 * 1024
export const DIAS_ENLACE_FACTURA = 7

const soloDigitos = (t) => String(t ?? "").replace(/[\s-]/g, "")

// Dígito verificador (módulo 11) de los primeros 48 dígitos: pesos 2 a 7 de derecha a izquierda; 11 → 0 y 10 → 1.
export function digitoVerificador(base48) {
  let suma = 0
  let peso = 2
  for (let i = base48.length - 1; i >= 0; i--) {
    suma += Number(base48[i]) * peso
    peso = peso === 7 ? 2 : peso + 1
  }
  const d = 11 - (suma % 11)
  return d === 11 ? 0 : d === 10 ? 1 : d
}

export const numeroDeClave = (clave) => (clave.length === 49 ? `${clave.slice(24, 27)}-${clave.slice(27, 30)}-${clave.slice(30, 39)}` : "")

const fechaValida = (ddmmaaaa) => {
  const d = Number(ddmmaaaa.slice(0, 2)), m = Number(ddmmaaaa.slice(2, 4)), a = Number(ddmmaaaa.slice(4, 8))
  const f = new Date(a, m - 1, d)
  return a >= 2000 && f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
}

// Revisa una clave de acceso. `numero` (opcional) es el número de la factura: se cruza con la serie y el secuencial de la clave.
export function validarClaveAcceso(texto, numero = "") {
  const clave = soloDigitos(texto)
  if (!clave) return { ok: false, vacia: true, error: "Escribe la clave de acceso.", clave }
  if (!/^\d+$/.test(clave)) return { ok: false, error: "La clave de acceso solo lleva números.", clave }
  if (clave.length !== 49) return { ok: false, error: `La clave de acceso tiene 49 dígitos y esta tiene ${clave.length}.`, clave }
  const esperado = digitoVerificador(clave.slice(0, 48))
  if (Number(clave[48]) !== esperado) return { ok: false, error: `La clave de acceso no es válida: el dígito verificador debería ser ${esperado}.`, clave }
  if (!fechaValida(clave.slice(0, 8))) return { ok: false, error: "La fecha dentro de la clave de acceso no es válida.", clave }
  if (clave.slice(8, 10) !== "01") return { ok: false, error: "La clave de acceso no es de una factura (el tipo de comprobante debe ser 01).", clave }
  const propio = numeroDeClave(clave)
  const dado = normalizarFacturaElectronica(numero)
  if (dado.valor && dado.formatoSri && dado.valor !== propio) return { ok: false, error: `La clave de acceso es de la factura ${propio}, no de la ${dado.valor}.`, clave }
  return {
    ok: true, clave, numero: propio,
    fechaEmision: `${clave.slice(4, 8)}-${clave.slice(2, 4)}-${clave.slice(0, 2)}`,
    ruc: clave.slice(10, 23), ambiente: clave[23] === "2" ? "produccion" : "pruebas",
  }
}

// "0410 2026 0117 …": la clave en grupos de cuatro, para leerla y copiarla.
export const claveEnGrupos = (clave) => String(clave || "").replace(/(\d{4})(?=\d)/g, "$1 ")

// La fecha de autorización: no puede ser futura ni anterior a la fecha de la venta ("AAAA-MM-DD").
export function validarFechaAutorizacion(fecha, { fechaVenta = "", hoy = "" } = {}) {
  if (!fecha) return "Indica la fecha de autorización."
  if (hoy && fecha > hoy) return "La fecha de autorización no puede ser futura."
  if (fechaVenta && fecha < fechaVenta) return "La fecha de autorización no puede ser anterior a la de la venta."
  return ""
}

// Un archivo que se adjunta: el RIDE en PDF (hasta 5 MB) o el XML (hasta 2 MB). `inicio` son los primeros bytes del archivo como texto.
export function validarArchivo(tipo, { nombre = "", bytes = 0, inicio = "" } = {}) {
  const pdf = tipo === "pdf"
  const nombreTipo = pdf ? "El PDF (RIDE)" : "El XML"
  if (!new RegExp(`\\.${tipo}$`, "i").test(nombre)) return `${nombreTipo} debe ser un archivo .${tipo}.`
  if (!(bytes > 0)) return `${nombreTipo} está vacío.`
  if (bytes > (pdf ? MAX_BYTES_PDF : MAX_BYTES_XML)) return `${nombreTipo} pesa más de ${pdf ? 5 : 2} MB.`
  if (pdf && !inicio.startsWith("%PDF-")) return "Ese archivo no es un PDF válido."
  if (!pdf && !/^\s*(<\?xml|<)/.test(inicio.replace(/^﻿/, ""))) return "Ese archivo no es un XML válido."
  return ""
}

// ¿El XML está bien formado y trae la misma clave de acceso? (`analizar` es un DOMParser, para poder probarlo.)
export function revisarXml(texto, clave, analizar = typeof DOMParser !== "undefined" ? new DOMParser() : null) {
  if (analizar) {
    const doc = analizar.parseFromString(texto, "application/xml")
    if (doc.getElementsByTagName("parsererror").length > 0) return "El XML no está bien formado."
  }
  if (clave && !String(texto).includes(clave)) return "El XML no trae la misma clave de acceso que escribiste."
  return ""
}

export const nombreArchivoFactura = (numero, tipo) => `factura-${numero || "electronica"}.${tipo}`

// El mensaje de WhatsApp con el enlace seguro de descarga. El saludo usa el nombre tal como está guardado (regla 34).
export function mensajeFacturaWhatsApp({ paciente, opticaNombre, enlace, dias = DIAS_ENLACE_FACTURA, numero = "" }) {
  const nombre = String(paciente?.nombre || "").trim()
  return `Hola${nombre ? `, ${nombre}` : ""}, te escribimos de ${opticaNombre || "tu óptica"}. Aquí está tu factura electrónica${numero ? ` ${numero}` : ""}: ${enlace}\nEl enlace de descarga vence en ${dias} días.`
}
