// Reglas del módulo de Ventas que no son de una sola pantalla: cuáles son los pedidos de cada filtro, cómo se llama su estado y cuál es su siguiente acción.
// Lógica pura; los números salen de las mismas funciones que usan el Inicio y Reportes.
//
// Un pedido es el registro simple de lo que la óptica encarga afuera (las lunas): la óptica no administra al laboratorio, se comunica con él por fuera. Nace cuando una venta incluye algo que se encarga,
// con su entrega («Retira en la óptica» o «Envío a domicilio», con la dirección) y la fecha aproximada en que estará listo. Estados: En proceso → Listo → Entregado, y «Atrasado» si pasa la fecha sin estar listo.
import { textoDiagnostico } from "./pasesVenta"
import { ordenesAtrasadas, ordenesEnProceso, ordenesListasSinAvisar, estadoVisible, diasDeAtraso } from "./ordenesLaboratorio"

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

// ─── La entrega de un pedido ───
export const ENTREGAS = [
  { id: "retira", etiqueta: "Retira en la óptica" },
  { id: "envio", etiqueta: "Envío a domicilio" },
]
export const DIAS_PEDIDO_POR_DEFECTO = 7
// Cuántos días tarda un pedido en estar listo, por defecto: los que configure la óptica (Configuración → Ventas) o 7.
export function diasDePedido(parametrizacion) {
  const n = Math.round(Number(parametrizacion?.diasPedido))
  return Number.isFinite(n) && n >= 1 && n <= 90 ? n : DIAS_PEDIDO_POR_DEFECTO
}
// Un pedido sin entrega guardada (los de antes) es «retira».
export const entregaDe = (orden) => (orden?.entrega === "envio" ? "envio" : "retira")
export const etiquetaEntrega = (orden) => ENTREGAS.find((e) => e.id === entregaDe(orden)).etiqueta

// ─── Pedidos ───
// Un pedido está atrasado si pasó su fecha aproximada sin estar listo. «Sin avisar» (listos que todavía no se le dijeron al paciente) no es una píldora: solo se llega desde el Inicio y aparece, con su equis, mientras está puesto.
export const FILTROS_ORDENES = [
  { id: "enproceso", etiqueta: "En proceso" },
  { id: "atrasadas", etiqueta: "Atrasados" },
  { id: "listos", etiqueta: "Listos para entregar" },
  { id: "entregadas", etiqueta: "Entregados" },
  { id: "todas", etiqueta: "Todos" },
]
export const FILTRO_SIN_AVISAR = { id: "sinavisar", etiqueta: "Listos sin avisar" }
// Los nombres de antes (los usan los enlaces del Inicio, de Reportes y las direcciones guardadas).
const FILTRO_ANTIGUO = { encurso: "enproceso", abiertas: "enproceso", enviadas: "enproceso", enlab: "enproceso", listas: "listos", canceladas: "todas" }
const FILTROS_ORDENES_VALIDOS = [...FILTROS_ORDENES.map((f) => f.id), FILTRO_SIN_AVISAR.id]
export const filtroDeOrdenesValido = (id) => {
  const actual = FILTRO_ANTIGUO[id] || id
  return FILTROS_ORDENES_VALIDOS.includes(actual) ? actual : "enproceso"
}

// «Todos» son los pedidos vivos: los cancelados (una venta anulada) no cuentan, igual que las citas canceladas no suman. «En proceso» incluye los atrasados (siguen sin estar listos).
export function ordenesDelFiltro(ordenes = [], filtro) {
  const f = filtroDeOrdenesValido(filtro)
  if (f === "enproceso") return ordenesEnProceso(ordenes)
  if (f === "atrasadas") return ordenesAtrasadas(ordenes)
  if (f === "listos") return ordenes.filter((o) => o.estado === "lista")
  if (f === "sinavisar") return ordenesListasSinAvisar(ordenes)
  if (f === "entregadas") return ordenes.filter((o) => o.estado === "entregada")
  return ordenes.filter((o) => o.estado !== "cancelada")
}

// La siguiente acción del proceso, la única que lleva la fila: Marcar listo → Avisar al paciente (la ventana única de Contactar; el mensaje cambia si retira o se le envía) → Entregar.
// Sin teléfono no se puede avisar: se pasa directo a entregar. Quien no puede editar Ventas no ve ninguna.
export function siguienteAccionOrden(orden, { puedeEditar = true, tieneTelefono = true } = {}) {
  if (!puedeEditar) return null
  if (orden.estado === "enviada") return { id: "lista", etiqueta: "Marcar listo" }
  if (orden.estado === "lista") return !orden.pacienteAvisadoEn && tieneTelefono ? { id: "avisar", etiqueta: "Avisar al paciente" } : { id: "entregar", etiqueta: "Entregar" }
  return null
}

// A qué estado vuelve un pedido con «Volver al estado anterior».
export const ESTADO_ANTERIOR = { lista: "enviada", entregada: "lista" }

// El estado de un pedido como se lee en la lista, con su color (regla 14: rojo = urgente, ámbar = falta algo, azul = en orden, gris = en proceso, verde = terminado):
// «En proceso», «Atrasado 3 días», «Listo · sin avisar» (ámbar) o «Listo · avisado» (azul) y «Entregado».
export function estadoDePedido(orden, dias = 0, hoy) {
  const v = estadoVisible(orden, hoy)
  if (v === "atrasada") return { id: "atrasada", etiqueta: `Atrasado ${dias} ${dias === 1 ? "día" : "días"}`, tono: "rojo" }
  if (v === "lista") return orden.pacienteAvisadoEn ? { id: "avisado", etiqueta: "Listo · avisado", tono: "azul" } : { id: "sinavisar", etiqueta: "Listo · sin avisar", tono: "ambar" }
  if (v === "entregada") return { id: "entregada", etiqueta: "Entregado", tono: "verde" }
  if (v === "cancelada") return { id: "cancelada", etiqueta: "Cancelado", tono: "gris" }
  return { id: "enviada", etiqueta: "En proceso", tono: "gris" }
}
// El estado de entrega de una venta, para su fila en la lista: el del pedido de esa venta (los mismos nombres y colores que en Pedidos). Con varios pedidos manda el que más urge
// (atrasado, en proceso, listo, entregado); sin pedido (o con todos cancelados) no hay entrega y devuelve null.
const URGENCIA_ENTREGA = ["atrasada", "enviada", "sinavisar", "avisado", "entregada"]
export function entregaDeVenta(facturaId, ordenes = [], hoy) {
  const estados = ordenes
    .filter((o) => o.facturaId === facturaId && o.estado !== "cancelada")
    .map((o) => estadoDePedido(o, diasDeAtraso(o, hoy), hoy))
  if (estados.length === 0) return null
  const e = [...estados].sort((a, b) => URGENCIA_ENTREGA.indexOf(a.id) - URGENCIA_ENTREGA.indexOf(b.id))[0]
  return estados.length > 1 ? { ...e, etiqueta: `${e.etiqueta} (${estados.length} pedidos)` } : e
}
export const textoEstadoOrden = (orden, dias = 0, hoy) => estadoDePedido(orden, dias, hoy).etiqueta

// Los días de espera como se leen en la fila: "Hoy", "1 día", "45 días".
export const textoDiasEspera = (dias) => (dias === 0 ? "Hoy" : `${dias} ${dias === 1 ? "día" : "días"}`)
