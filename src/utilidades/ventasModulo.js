// Reglas del módulo de Ventas que no son de una sola pantalla: cuáles son los pedidos de lentes de cada filtro, cómo se llama su estado y cuál es su siguiente acción.
// Lógica pura; los números salen de las mismas funciones que usan el Inicio y Reportes.
import { textoDiagnostico } from "./pasesVenta"
import { ordenesAbiertas, ordenesAtrasadas, ordenesListasSinAvisar, estadoVisible } from "./ordenesLaboratorio"

// «Por vender» ya no es de Ventas: el paciente que recibió su diagnóstico y no ha comprado está en «Para contactar» del CRM (motivo «por_vender»), con su proforma si la tiene.
export const llevaProforma = (pase) => Boolean(pase?.proformaEntregadaEn)

// El diagnóstico y el lente recomendado en una sola línea: "Miopía · Lente: Monofocal antirreflejo".
// El diagnóstico sin la frase de plantilla "Corrección óptica indicada según refracción", que repite lo mismo en cada paciente (no decide nada).
export const diagnosticoCorto = (consulta) => textoDiagnostico(consulta).replace(/\s*[—–-]\s*Corrección óptica indicada según refracción\.?/gi, "").replace(/^Corrección óptica indicada según refracción\.?\s*·?\s*/i, "").trim()

export function lineaDiagnosticoYLente(consulta) {
  const d = diagnosticoCorto(consulta)
  const lente = String(consulta?.lenteRecomendado || "").trim()
  return [d, lente && `Lente: ${lente}`].filter(Boolean).join(" · ")
}

// ─── Pedidos de lentes ───
// Un pedido está atrasado si pasó su fecha prometida sin estar listo. «En el laboratorio» (enlab) no es una píldora: solo se llega a él desde la franja de Ventas y aparece, con su equis, mientras está puesto.
export const FILTROS_ORDENES = [
  { id: "encurso", etiqueta: "En curso" },
  { id: "atrasadas", etiqueta: "Atrasados" },
  { id: "sinavisar", etiqueta: "Listos sin avisar" },
  { id: "entregadas", etiqueta: "Entregados" },
  { id: "todas", etiqueta: "Todos" },
]
export const FILTRO_EN_LABORATORIO = { id: "enlab", etiqueta: "En el laboratorio" }
// Los nombres de antes (los usan los enlaces del Inicio, de Reportes y las direcciones guardadas).
const FILTRO_ANTIGUO = { abiertas: "encurso", enviadas: "enlab", listas: "encurso", canceladas: "todas" }
const FILTROS_ORDENES_VALIDOS = [...FILTROS_ORDENES.map((f) => f.id), FILTRO_EN_LABORATORIO.id]
export const filtroDeOrdenesValido = (id) => {
  const actual = FILTRO_ANTIGUO[id] || id
  return FILTROS_ORDENES_VALIDOS.includes(actual) ? actual : "encurso"
}

// «Todos» son los pedidos vivos: los cancelados (una venta anulada) no cuentan, igual que las citas canceladas no suman.
export function ordenesDelFiltro(ordenes = [], filtro) {
  const f = filtroDeOrdenesValido(filtro)
  if (f === "encurso") return ordenesAbiertas(ordenes)
  if (f === "atrasadas") return ordenesAtrasadas(ordenes)
  if (f === "enlab") return ordenes.filter((o) => o.estado === "enviada")
  if (f === "sinavisar") return ordenesListasSinAvisar(ordenes)
  if (f === "entregadas") return ordenes.filter((o) => o.estado === "entregada")
  return ordenes.filter((o) => o.estado !== "cancelada")
}

// La siguiente acción del proceso, la única que lleva la fila: Marcar listo → Contactar (la ventana única, con el mensaje de lentes listos) → Entregar.
// Sin teléfono no se puede contactar: se pasa directo a entregar. Quien no puede editar Ventas no ve ninguna.
export function siguienteAccionOrden(orden, { puedeEditar = true, tieneTelefono = true } = {}) {
  if (!puedeEditar) return null
  if (orden.estado === "enviada") return { id: "lista", etiqueta: "Marcar listo" }
  if (orden.estado === "lista") return !orden.pacienteAvisadoEn && tieneTelefono ? { id: "avisar", etiqueta: "Contactar" } : { id: "entregar", etiqueta: "Entregar" }
  return null
}

// A qué estado vuelve una orden con «Volver al estado anterior».
export const ESTADO_ANTERIOR = { lista: "enviada", entregada: "lista" }

// El estado de un pedido como se lee en la lista, con su color (regla 14: rojo = urgente, ámbar = falta algo, azul = avisado, gris = en proceso, verde = terminado):
// «En el laboratorio», «Atrasado 3 días», «Listo · sin avisar», «Listo · avisado», «Entregado».
export function estadoDePedido(orden, dias = 0, hoy) {
  const v = estadoVisible(orden, hoy)
  if (v === "atrasada") return { id: "atrasada", etiqueta: `Atrasado ${dias} ${dias === 1 ? "día" : "días"}`, tono: "rojo" }
  if (v === "lista") return orden.pacienteAvisadoEn ? { id: "avisado", etiqueta: "Listo · avisado", tono: "azul" } : { id: "sinavisar", etiqueta: "Listo · sin avisar", tono: "ambar" }
  if (v === "entregada") return { id: "entregada", etiqueta: "Entregado", tono: "verde" }
  if (v === "cancelada") return { id: "cancelada", etiqueta: "Cancelado", tono: "gris" }
  return { id: "enviada", etiqueta: "En el laboratorio", tono: "gris" }
}
export const textoEstadoOrden = (orden, dias = 0, hoy) => estadoDePedido(orden, dias, hoy).etiqueta

// Los días de espera como se leen en la fila: "Hoy", "1 día", "45 días".
export const textoDiasEspera = (dias) => (dias === 0 ? "Hoy" : `${dias} ${dias === 1 ? "día" : "días"}`)
