// Lógica pura del portal del paciente (portal v2, 17 oct. 2026): lo que el paciente ve de sus lentes, de su control y de la óptica, con las mismas
// funciones y los mismos estados que el sistema del personal (regla 2 y 18). El texto está pensado para una persona mayor: frases cortas, sin términos técnicos.
import { ahoraEcuador } from "./horaEcuador"
import { fechaAISO, resumenHorarioSemanal, minutosDesdeMedianoche } from "./disponibilidad"
import { estadoDeLaOpticaHoy } from "./portalVistas"
import { fechaLegible, nombreMes, formatoFecha } from "./formatoFecha"
import { dinero } from "./formatoMoneda"
import { diaDeRegistro } from "./periodoLista"
import { estadoVisible } from "./ordenesLaboratorio"
import { fechaProximoControl } from "./fidelizacion"
import { formatearTelefonoEC, linkWhatsApp } from "./whatsapp"

// ── Identidad de la óptica ──
// El portal sigue el diseño aprobado (docs/portal-propuesta/): azul #1D5FD6, azul marino #0F2340 en la franja y el boleto, y fondo #F4F7FB. Si la óptica eligió un color propio
// (Configuración › Personalización), ese color reemplaza al azul en el menú, los botones y los enlaces; el marino no cambia. El texto sobre el acento es blanco u oscuro según el contraste (WCAG).
export const AZUL_PORTAL = "#1D5FD6"
export const MARINO_PORTAL = "#0F2340"
const AZUL_DEL_SISTEMA = "#2563eb"
const HEX = /^#[0-9a-f]{6}$/i
const luminancia = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function identidadDeLaOptica(opticaPublica) {
  const m = opticaPublica?.marca || {}
  const propio = HEX.test(m.colorAcento || "") && m.colorAcento.toLowerCase() !== AZUL_DEL_SISTEMA
  const acento = propio ? m.colorAcento : AZUL_PORTAL
  return {
    acento,
    // Botón principal: texto blanco salvo que el acento sea tan claro que el blanco no se lea (contraste menor a 3:1).
    textoBoton: (1.05 / (luminancia(acento) + 0.05)) >= 3 ? "#FFFFFF" : "#0E2B33",
    logoUrl: opticaPublica?.logo_url || m.logoUrlClaro || "",
  }
}

// ── Citas ──
// El mismo criterio de "próximas" que usa el personal: todo lo que no está resuelto (atendida, no efectuada, cancelada).
export const ESTADOS_RESUELTOS = ["Atendida", "No Asistió", "Cancelada"]
export const esCitaProxima = (c) => !ESTADOS_RESUELTOS.includes(c.estado)
const porFechaYHora = (a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
export const citasProximas = (citas) => citas.filter(esCitaProxima).sort(porFechaYHora)
export const citasHistorial = (citas) => citas.filter((c) => !esCitaProxima(c)).sort((a, b) => porFechaYHora(b, a))

// Lo que el paciente lee de cada estado: el nombre es el del sistema; la nota explica qué sigue, en palabras sencillas.
export const NOTA_ESTADO_CITA = {
  Pendiente: "Te esperamos a la hora de tu cita.",
  "En Espera": "Ya llegaste: te llamarán en un momento.",
  "En Atención": "Te están atendiendo ahora.",
  Atendida: "Ya te atendimos.",
  "No Asistió": "Esta cita no se efectuó. Puedes agendar otra.",
  Cancelada: "Esta cita se canceló. Puedes agendar otra.",
}

// ── Lentes (órdenes de laboratorio) ──
// Fila de mis_ordenes_paciente → objeto de la app. Mismos nombres que el personal (`mapOrden`), solo lo que el paciente recibe.
export const mapOrdenPaciente = (o) => ({
  id: o.id, numero: o.numero, estado: o.estado, fechaPrometida: o.fecha_prometida, tipoLente: o.tipo_lente, montura: o.montura || "",
  facturaId: o.factura_id, creadaEn: o.creada_en, listaEl: o.lista_el || null, entregadaEl: o.entregada_el || null,
})

export const ordenesAbiertasDelPaciente = (ordenes = []) => ordenes.filter((o) => o.estado === "enviada" || o.estado === "lista")

const TIPO_LENTE = { monofocal: "Lentes monofocales", bifocal: "Lentes bifocales", progresivo: "Lentes progresivos" }
// Solo el tipo («Lentes progresivos»), para el título de una compra.
export const tipoDeLentes = (orden) => TIPO_LENTE[orden.tipoLente] || "Tus lentes"
export const nombreDeLosLentes = (orden) => [TIPO_LENTE[orden.tipoLente] || "Tus lentes", orden.montura && `con la montura ${orden.montura}`].filter(Boolean).join(" ")

// El estado de la orden es el mismo que ve Ventas (enviada, lista, entregada y «atrasada» cuando la fecha prometida ya pasó, el color es el mismo):
// aquí con el nombre que entiende el paciente y la fecha que le importa. `tono` es el de siempre: azul en curso, verde listo, rojo urgente, gris cerrado.
export function textoOrdenPaciente(orden, hoy = ahoraEcuador()) {
  const visible = estadoVisible(orden, hoy)
  const fecha = (v) => fechaLegible(diaDeRegistro(v))
  if (visible === "atrasada") return { clave: "atrasada", tono: "rojo", titulo: "En el laboratorio", detalle: "Se están demorando un poco más de lo previsto. Llama a la óptica para saber cuándo estarán." }
  if (visible === "lista") return { clave: "lista", tono: "verde", titulo: "Listos para retirar", detalle: orden.listaEl ? `Están en la óptica desde el ${fecha(orden.listaEl)}. Pasa a recogerlos.` : "Ya están en la óptica. Pasa a recogerlos." }
  if (visible === "entregada") return { clave: "entregada", tono: "gris", titulo: "Entregados", detalle: orden.entregadaEl ? `Los recibiste el ${fecha(orden.entregadaEl)}.` : "Ya los recibiste." }
  return { clave: "enviada", tono: "azul", titulo: "En el laboratorio", detalle: orden.fechaPrometida ? `Fecha estimada: ${fechaLegible(orden.fechaPrometida)}.` : "Te avisaremos cuando estén listos." }
}

// Lo que sigue para el paciente, en una frase: «Retíralos en la óptica desde el 22 de octubre.»
export function proximoPasoLentes(orden, hoy = ahoraEcuador()) {
  const visible = estadoVisible(orden, hoy)
  if (visible === "lista") return "Ya están listos: retíralos en la óptica."
  if (visible === "entregada") return ""
  if (visible === "atrasada") return "Se están demorando un poco más de lo previsto: llama a la óptica para saber cuándo estarán."
  return orden.fechaPrometida ? `Retíralos en la óptica desde el ${formatoFecha(orden.fechaPrometida, "largoSinDia").replace(/ de \d{4}$/, "")}.` : "Te avisaremos cuando estén listos para retirar."
}

// La línea de pasos del seguimiento de unos lentes (como el de un envío): Pedido → En el laboratorio → Listos para retirar → Entregados. «Atrasada» es
// la misma orden en el paso del laboratorio, con su aviso en rojo (igual que en Ventas).
export const PASOS_LENTES = ["Pedido", "En el laboratorio", "Listos para retirar", "Entregados"]
export function pasosDeLosLentes(orden, hoy = ahoraEcuador()) {
  const visible = estadoVisible(orden, hoy)
  // Entregados es el último paso: ya cumplido (todos los pasos quedan hechos).
  const actual = { enviada: 1, atrasada: 1, lista: 2, entregada: 4 }[visible] ?? 1
  const tono = visible === "atrasada" ? "rojo" : visible === "lista" ? "verde" : visible === "entregada" ? "gris" : "azul"
  return { actual, tono, pasos: PASOS_LENTES.map((nombre, i) => ({ nombre, estado: i < actual ? "hecho" : i === actual ? "actual" : "pendiente" })) }
}

// ── Próximo control ──
// Una sola cuenta con el personal: `fechaProximoControl`. El portal solo recibe lo mínimo (mi_control_paciente) y arma con eso lo que la función pide.
export function proximoControlDelPaciente(control, hoy = ahoraEcuador()) {
  if (!control?.ultima_consulta || control.de_alta) return null
  const objetivo = fechaProximoControl(
    { id: "yo", nombre: "", estadoClinico: "", fechaRegistro: control.ultima_consulta },
    [{ pacienteId: "yo", fecha: control.ultima_consulta, proximoControlDias: control.proximo_control_dias }],
  )
  if (!objetivo) return null
  const iso = fechaAISO(objetivo)
  const hoyIso = fechaAISO(hoy)
  const dias = Math.round((new Date(`${iso}T00:00:00Z`) - new Date(`${hoyIso}T00:00:00Z`)) / 86400000)
  return { iso, dias, vencido: dias < 0, pronto: dias >= 0 && dias <= 30, ultima: control.ultima_consulta }
}

export function textoControl(control) {
  if (control.vencido) return "Ya pasó la fecha recomendada. Agenda tu control cuanto antes."
  if (control.pronto) return control.dias === 0 ? "Es hoy." : control.dias === 1 ? "Es mañana." : `Faltan ${control.dias} días.`
  return "Es la fecha que recomendó tu optómetra."
}

// ── Saldo ──
// Lo que debe el paciente: la suma de los saldos de sus compras con saldo (el mismo número que Cobros y saldos).
export const saldoDelPaciente = (compras = []) => compras.filter((c) => c.estado === "pendiente_pago").reduce((s, c) => s + Math.max(0, Number(c.saldo) || 0), 0)

// ── La óptica ──
const texto = (v) => String(v ?? "").trim()
export function contactoDeLaOptica({ parametrizacion, disponibilidad, nombre = "", paciente = "" } = {}) {
  const telefono = texto(parametrizacion?.opticaTelefono)
  const numero = telefono ? formatearTelefonoEC(telefono) : ""
  return {
    direccion: texto(parametrizacion?.opticaDireccion),
    telefono,
    telefonoHref: numero ? `tel:+${numero}` : "",
    whatsappUrl: numero ? linkWhatsApp(telefono, `Hola, soy ${paciente || "paciente"}${nombre ? ` de ${nombre}` : ""}.`) : "",
    horario: resumenHorarioSemanal(disponibilidad?.horarioSemanal),
    // «Abierto hoy hasta las 6:00 PM» / «Cerrado hoy»: la misma frase que la página pública de la óptica.
    hoy: estadoDeLaOpticaHoy(disponibilidad),
    comoLlegarUrl: texto(parametrizacion?.opticaDireccion) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([texto(parametrizacion?.opticaDireccion), nombre].filter(Boolean).join(", "))}` : "",
  }
}
export const tieneContacto = (c) => Boolean(c.direccion || c.telefono || c.horario.length)

// ── Receta ──
// Qué significa cada valor, en palabras de todos los días (se muestra al pasar el cursor o tocar el dato).
export const AYUDA_RECETA = {
  esfera: "Cuánto necesita corregirse el ojo. Con signo menos (−) cuesta ver de lejos; con signo más (+) cuesta ver de cerca.",
  cilindro: "Corrige el astigmatismo: la vista borrosa o doble por la forma del ojo. Si está vacío, no tienes astigmatismo.",
  eje: "La dirección del astigmatismo, en grados. Lo usa la óptica para fabricar tus lentes.",
  adicion: "La ayuda extra para leer de cerca. Se usa en lentes bifocales y progresivos.",
  agudeza: "Qué tan bien ves. 20/20 es la vista normal; mientras más grande el segundo número, más borrosa es tu vista.",
}

// ── Pendiente para ti ──
// Lo que el paciente debe hacer, en este orden de prioridad: retirar lentes listos, pagar un saldo y calificar una visita atendida. Solo trae lo que hay;
// sin nada pendiente devuelve [] y el Inicio no dibuja el bloque. `abrir` es la ventana de detalle que abre la tarjeta.
export function pendientesDelPaciente({ ordenes = [], detalleDisponible = false, saldoInfo = null, historial = [], detalle = {} } = {}) {
  const lista = []
  for (const o of ordenes.filter((x) => x.estado === "lista")) {
    lista.push({ id: "lentes-" + o.id, tipo: "lentes", titulo: "Tus lentes están listos para retirar", texto: "Pasa por la óptica a recogerlos.", accion: "Ver detalle", abrir: { tipo: "pedido", id: o.id } })
  }
  if (saldoInfo && saldoInfo.saldo > 0) {
    const retiro = ordenes.some((o) => o.estado === "enviada" || o.estado === "lista")
    lista.push({ id: "saldo", tipo: "saldo", titulo: `Tienes ${dinero(saldoInfo.saldo)} por pagar`, texto: retiro ? "Puedes pagarlo al retirar tus lentes." : "Puedes pagarlo en la óptica.", accion: "Ver detalle", abrir: { tipo: "saldo" } })
  }
  if (detalleDisponible) {
    const sinCalificar = historial.find((c) => c.estado === "Atendida" && detalle[c.id] && !detalle[c.id].calificacion)
    if (sinCalificar) lista.push({ id: "calificar-" + sinCalificar.id, tipo: "calificar", titulo: `¿Cómo te atendimos el ${diaYMes(sinCalificar.fecha)}?`, texto: "Tu opinión nos ayuda a mejorar.", accion: "Calificar", abrir: { tipo: "cita", id: sinCalificar.id } })
  }
  return lista
}
const diaYMes = (iso) => formatoFecha(iso, "largoSinDia").replace(/ de \d{4}$/, "")
