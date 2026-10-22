// Comprobante de venta interno (Bloque E, migración 0094). La tabla se sigue llamando
// facturas_venta, pero en pantalla el documento es un "comprobante de venta interno": no es una
// factura electrónica autorizada por el SRI. El número de esa factura, si se emitió por fuera,
// se registra aparte (facturaElectronica).
import { TIPOS_LENTE } from "./ordenesLaboratorio"

export const LEYENDA_INTERNO = "Documento interno. No es una factura electrónica autorizada por el SRI."

export const numeroComprobante = (n) => `CV-${String(n ?? 0).padStart(4, "0")}`

// Número de factura electrónica del SRI: 001-001-000000123 (15 dígitos). Se normaliza si son
// 15 dígitos con o sin guiones; cualquier otro formato se respeta tal cual (los proveedores de
// facturación pueden usar otro) y solo se avisa.
export function normalizarFacturaElectronica(texto) {
  const valor = String(texto ?? "").trim()
  if (!valor) return { valor: "", formatoSri: true, demasiadoLargo: false }
  const digitos = valor.replace(/[\s-]/g, "")
  if (/^\d{15}$/.test(digitos) && /^[\d\s-]+$/.test(valor)) {
    return { valor: `${digitos.slice(0, 3)}-${digitos.slice(3, 6)}-${digitos.slice(6)}`, formatoSri: true, demasiadoLargo: false }
  }
  return { valor, formatoSri: false, demasiadoLargo: valor.length > 60 }
}

export const TRATAMIENTOS_LUNA = [
  { id: "antirreflejo", label: "Antirreflejo" },
  { id: "filtroAzul", label: "Filtro azul" },
  { id: "fotocromatico", label: "Fotocromático" },
]

const etiquetaTipo = (id) => TIPOS_LENTE.find((t) => t.id === id)?.label || ""

// Texto legible de una luna: "Monofocal · CR-39 · antirreflejo, filtro azul".
export function descripcionLuna({ tipoLente = "", material = "", antirreflejo = false, filtroAzul = false, fotocromatico = false, otrosTratamientos = "" } = {}) {
  const trat = [antirreflejo && "antirreflejo", filtroAzul && "filtro azul", fotocromatico && "fotocromático", (otrosTratamientos || "").trim()].filter(Boolean)
  const partes = [etiquetaTipo(tipoLente), (material || "").trim(), trat.join(", ")].filter(Boolean)
  return partes.length ? `Luna: ${partes.join(" · ")}` : "Luna"
}

// Lo que se guarda en facturas_venta_lineas.detalle y precarga la orden de laboratorio.
export const detalleLuna = ({ tipoLente = "", material = "", antirreflejo = false, filtroAzul = false, fotocromatico = false, otrosTratamientos = "" } = {}) => ({
  tipo_lente: tipoLente || null, material: (material || "").trim() || null,
  antirreflejo: !!antirreflejo, filtro_azul: !!filtroAzul, fotocromatico: !!fotocromatico,
  otros_tratamientos: (otrosTratamientos || "").trim() || null,
})

// Línea de luna a partir de lo que el optómetra escribió en "Lente a recomendar" (texto, precio 0).
export const lineaLunaDeTexto = (texto) => {
  const t = String(texto ?? "").trim()
  return { tipo: "luna", productoId: null, descripcion: t ? `Luna: ${t}` : "Luna", cantidad: 1, precioUnitario: 0, detalle: null }
}

// Campos de la orden de laboratorio que salen de la línea de luna de una venta.
export function datosOrdenDeLinea(linea) {
  const d = linea?.detalle
  if (!d) return {}
  return {
    tipoLente: d.tipo_lente || undefined, material: d.material || undefined,
    antirreflejo: !!d.antirreflejo, filtroAzul: !!d.filtro_azul, fotocromatico: !!d.fotocromatico,
    otrosTratamientos: d.otros_tratamientos || undefined,
  }
}

// Las líneas con stock y foto son monturas y accesorios: son las únicas con producto_id.
export const montura = (lineas = []) => lineas.find((l) => l.tipo === "producto") || null
export const lunaDe = (lineas = []) => lineas.find((l) => l.tipo === "luna") || null

// Lo que «Usar como guía» (Nueva venta) toma del último diagnóstico: de lo que el optómetra escribió en «Lente a recomendar» («progresivo con filtro azul») saca el tipo de luna y sus filtros,
// para que la persona que vende parta de ahí y no escriba otra vez lo que ya se decidió en la consulta. Lo que no reconoce se deja como estaba (monofocal, sin filtros).
export function lunaDeTexto(texto) {
  const t = String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  return {
    tipoLente: /progres/.test(t) ? "progresivo" : /bifocal|doble foco/.test(t) ? "bifocal" : "monofocal",
    antirreflejo: /anti\s*-?\s*rr?eflej|\bar\b/.test(t),
    filtroAzul: /filtro\s+azul|luz\s+azul|blue/.test(t),
    fotocromatico: /fotocrom|photo/.test(t),
  }
}
