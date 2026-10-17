// Lógica pura del portal del paciente (portal v2, 17 oct. 2026): lo que el paciente ve de sus lentes, de su control y de la óptica, con las mismas
// funciones y los mismos estados que el sistema del personal (regla 2 y 18). El texto está pensado para una persona mayor: frases cortas, sin términos técnicos.
import { ahoraEcuador } from "./horaEcuador"
import { fechaAISO, resumenHorarioSemanal, minutosDesdeMedianoche } from "./disponibilidad"
import { fechaLegible } from "./formatoFecha"
import { diaDeRegistro } from "./periodoLista"
import { estadoVisible } from "./ordenesLaboratorio"
import { fechaProximoControl } from "./fidelizacion"
import { formatearTelefonoEC, linkWhatsApp } from "./whatsapp"

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
