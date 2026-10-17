// Lógica pura del portal del paciente (portal v2, 17 oct. 2026): lo que el paciente ve de sus lentes, de su control y de la óptica, con las mismas
// funciones y los mismos estados que el sistema del personal (regla 2 y 18). El texto está pensado para una persona mayor: frases cortas, sin términos técnicos.
import { ahoraEcuador } from "./horaEcuador"
import { fechaAISO, resumenHorarioSemanal, minutosDesdeMedianoche, estadoAtencionHoy } from "./disponibilidad"
import { tendenciaEntreConsultas, variacionEntre, verdictoPorVariacion, textoDioptrias } from "./tendenciaGraduacion"
import { fechaLegible } from "./formatoFecha"
import { diaDeRegistro } from "./periodoLista"
import { estadoVisible } from "./ordenesLaboratorio"
import { fechaProximoControl } from "./fidelizacion"
import { formatearTelefonoEC, linkWhatsApp } from "./whatsapp"

// ── Identidad de la óptica ──
// El portal se viste con el logo y el color de la óptica (Configuración › Personalización): el acento tiñe el menú, los botones principales y la tarjeta destacada.
// Sin color propio queda el azul de la marca del sistema. El texto sobre el acento es blanco u oscuro según el contraste (WCAG).
const HEX = /^#[0-9a-f]{6}$/i
const luminancia = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function identidadDeLaOptica(opticaPublica) {
  const m = opticaPublica?.marca || {}
  const acento = HEX.test(m.colorAcento || "") ? m.colorAcento : "#2563EB"
  const secundario = HEX.test(m.colorSecundario || "") ? m.colorSecundario : ""
  const porDefecto = acento.toLowerCase() === "#2563eb" && !secundario
  const grad = secundario ? `linear-gradient(135deg,${acento},${secundario})` : porDefecto ? "linear-gradient(135deg,#22D3EE,#2563EB)" : `linear-gradient(135deg,color-mix(in srgb, ${acento} 60%, white),${acento})`
  return {
    acento, grad,
    // La tarjeta destacada es siempre oscura (el acento mezclado con negro), así el texto blanco se lee con cualquier color.
    hero: `linear-gradient(135deg,color-mix(in srgb, ${acento} 72%, black),color-mix(in srgb, ${acento} 92%, black))`,
    // Botón principal: texto blanco salvo que el acento sea tan claro que el blanco no se lea (contraste menor a 3:1).
    textoBoton: (1.05 / (luminancia(secundario || acento) + 0.05)) >= 3 ? "#FFFFFF" : "#0E2B33",
    logoUrl: opticaPublica?.logo_url || m.logoUrlClaro || "",
  }
}

// ── Citas ──
// El mismo criterio de "próximas" que usa el personal: todo lo que no está resuelto (atendida, no asistió, cancelada).
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
  "No Asistió": "No llegaste a esta cita. Puedes agendar otra.",
  Cancelada: "Esta cita se canceló. Puedes agendar otra.",
}

// ── Lentes (órdenes de laboratorio) ──
// Fila de mis_ordenes_paciente → objeto de la app. Mismos nombres que el personal (`mapOrden`), solo lo que el paciente recibe.
export const mapOrdenPaciente = (o) => ({
  id: o.id, numero: o.numero, estado: o.estado, fechaPrometida: o.fecha_prometida, tipoLente: o.tipo_lente, montura: o.montura || "",
  facturaId: o.factura_id, creadaEn: o.creada_en, listaEl: o.lista_el || null, entregadaEl: o.entregada_el || null,
})

export const ordenesAbiertasDelPaciente = (ordenes = []) => ordenes.filter((o) => o.estado === "enviada" || o.estado === "lista")

const TIPO_LENTE = { monofocal: "Lentes de un solo foco", bifocal: "Lentes bifocales", progresivo: "Lentes progresivos" }
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

// La línea de pasos del seguimiento de unos lentes (como el de un envío): Pedido → En el laboratorio → Listos para retirar → Entregados. «Atrasada» es
// la misma orden en el paso del laboratorio, con su aviso en rojo (igual que en Ventas).
export const PASOS_LENTES = ["Pedido", "En el laboratorio", "Listos para retirar", "Entregados"]
export function pasosDeLosLentes(orden, hoy = ahoraEcuador()) {
  const visible = estadoVisible(orden, hoy)
  const actual = { enviada: 1, atrasada: 1, lista: 2, entregada: 3 }[visible] ?? 1
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
  return { iso, dias, vencido: dias < 0, pronto: dias >= 0 && dias <= 30 }
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
    hoy: disponibilidad ? estadoAtencionHoy(disponibilidad) : null,
    comoLlegarUrl: texto(parametrizacion?.opticaDireccion) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([texto(parametrizacion?.opticaDireccion), nombre].filter(Boolean).join(", "))}` : "",
  }
}
export const tieneContacto = (c) => Boolean(c.direccion || c.telefono || c.horario.length)

// ── Historial de recetas ──
// Cómo cambió la graduación desde el examen anterior, en palabras simples. Usa las MISMAS cuentas que la tendencia del perfil del paciente en el sistema del personal
// (`tendenciaEntreConsultas`: promedio del equivalente esférico, y menos de 0,25 D es «sin cambios»), así que los dos lados dicen siempre lo mismo.
// `consultasRecientePrimero`: las consultas del paciente de la más reciente a la más antigua.
export function resumenCambioGraduacion(consultasRecientePrimero = []) {
  const t = tendenciaEntreConsultas(consultasRecientePrimero)
  if (!t) return null
  const desde = fechaLegible(t.fechaPrevia)
  const mide = textoDioptrias(Math.abs(t.variacion)).replace(/^[+−]/, "")
  const frase = t.verdicto === "Sin cambios"
    ? `Tu graduación se mantiene igual que en tu examen del ${desde}.`
    : t.verdicto === "Aumentó"
      ? `Tu graduación aumentó un poco desde tu examen del ${desde}: en promedio ${mide} más.`
      : `Tu graduación disminuyó desde tu examen del ${desde}: en promedio ${mide} menos.`
  // Por ojo, con la misma resta y el mismo umbral de la tendencia (|equivalente esférico| de ahora menos el de antes; el ojo sin medida en alguno de los dos no se compara).
  const [reciente, previa] = consultasRecientePrimero
  const ojo = (nombre, clave) => {
    const v = variacionEntre({ od: reciente[clave] }, { od: previa[clave] })
    const tam = v === null ? "" : textoDioptrias(Math.abs(v)).replace(/^[+−]/, "")
    return { nombre, texto: v === null ? "—" : verdictoPorVariacion(v) === "Sin cambios" ? "sin cambios" : v > 0 ? `aumentó ${tam}` : `disminuyó ${tam}` }
  }
  return { verdicto: t.verdicto, frase, desde, porOjo: [ojo("Ojo derecho", "od"), ojo("Ojo izquierdo", "oi")] }
}

// ── Receta ──
// Qué significa cada valor, en palabras de todos los días (se muestra al pasar el cursor o tocar el dato).
export const AYUDA_RECETA = {
  esfera: "Cuánto necesita corregirse el ojo. Con signo menos (−) cuesta ver de lejos; con signo más (+) cuesta ver de cerca.",
  cilindro: "Corrige el astigmatismo: la vista borrosa o doble por la forma del ojo. Si está vacío, no tienes astigmatismo.",
  eje: "La dirección del astigmatismo, en grados. Lo usa la óptica para fabricar tus lentes.",
  adicion: "La ayuda extra para leer de cerca. Se usa en lentes bifocales y progresivos.",
  agudeza: "Qué tan bien ves. 20/20 es la vista normal; mientras más grande el segundo número, más borrosa es tu vista.",
}
