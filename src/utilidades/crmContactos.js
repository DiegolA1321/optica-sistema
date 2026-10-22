// CRM v2: a quién hay que contactar hoy, por qué y qué pasó la última vez. Lógica pura (sin pantalla ni base de datos).
// Los motivos usan las funciones únicas del sistema: el control vencido es el mismo que cuentan el Inicio, Pacientes y Reportes (esInactivo),
// los cumpleaños tienen la misma ventana que el Inicio (diasCumpleEnVentana) y los días y "hoy" salen de hoyISO (hora de Ecuador).
import { diasDesdeUltimaVisita, diasCumpleEnVentana, diasVencido, esInactivo, contarConsultas, contarReferidos, esClienteFrecuente, puntajeFidelidad, fechaProximoControl } from "./fidelizacion"
import { fechaAISO, hoyISO, isoAFechaLocal } from "./disponibilidad"
import { diaDeRegistro } from "./periodoLista"
import { formatoFecha } from "./formatoFecha"
import { diasEnEspera, esDelPortal } from "./pasesVenta"

// ─── Motivos ───
// consentimiento: qué permiso del paciente hace falta para escribirle por ese motivo: "salud" = Recordatorios de salud (control y seguimiento de la compra),
// "promocion" = Promociones y saludos (cumpleaños y campañas).
export const MOTIVOS = {
  sin_visitar: { id: "sin_visitar", etiqueta: "Sin visitar hace más de 12 meses", corta: "Sin visitar +12 meses", consentimiento: "salud" },
  control_vencido: { id: "control_vencido", etiqueta: "Control vencido", corta: "Control vencido", consentimiento: "salud" },
  cumpleanos: { id: "cumpleanos", etiqueta: "Cumpleaños", corta: "Cumpleaños", consentimiento: "promocion" },
  postventa: { id: "postventa", etiqueta: "Seguimiento después de la compra", corta: "Después de la compra", consentimiento: "salud" },
  control_proximo: { id: "control_proximo", etiqueta: "Control que vence pronto", corta: "Control próximo", consentimiento: "salud" },
  // Recibió su diagnóstico (o pidió lentes desde su portal) y todavía no compra: sale de Ventas y vive aquí (reunión del 20 oct.).
  por_vender: { id: "por_vender", etiqueta: "Recibió su diagnóstico y no ha comprado", corta: "Por vender", consentimiento: "salud" },
}
// El que se muestra primero (y el que da el mensaje) cuando un paciente cumple varios: el más específico o más urgente.
export const ORDEN_MOTIVOS = ["sin_visitar", "control_vencido", "por_vender", "cumpleanos", "postventa", "control_proximo"]
export const MOTIVO_PROMOCION = "promocion"
// Los motivos de los avisos que ofrecen WhatsApp (migración 0135): no arman la lista «Para contactar» (esa la arman los de arriba), pero cada uno tiene su plantilla editable y su contacto
// queda en el Seguimiento. control_vencido y por_vender ya son motivos de arriba y se comparten: el mensaje del aviso del Inicio es el mismo del CRM.
export const MOTIVOS_DE_AVISO = {
  cita_no_efectuada: { id: "cita_no_efectuada", etiqueta: "Cita no efectuada", corta: "Cita no efectuada" },
  cita_reagendada: { id: "cita_reagendada", etiqueta: "Cita reagendada", corta: "Cita reagendada" },
  lentes_listos: { id: "lentes_listos", etiqueta: "Lentes listos para retirar", corta: "Lentes listos" },
  medidas_montaje: { id: "medidas_montaje", etiqueta: "Medidas de montaje pedidas", corta: "Medidas de montaje" },
}
export const ETIQUETA_MOTIVO = {
  ...Object.fromEntries(Object.values(MOTIVOS).map((m) => [m.id, m.corta])),
  ...Object.fromEntries(Object.values(MOTIVOS_DE_AVISO).map((m) => [m.id, m.corta])),
  [MOTIVO_PROMOCION]: "Promoción",
  mensaje_manual: "Mensaje desde el perfil",
}

export const DIAS_CONTROL_PROXIMO = 30 // el control vence dentro de los próximos 30 días
export const DIAS_SIN_VISITAR = 365 // más de 12 meses sin visitar
export const POSTVENTA_DESDE = 7 // lentes entregados hace 7 a 15 días
export const POSTVENTA_HASTA = 15

// ─── Resultados de un contacto ───
export const RESULTADOS = {
  agendo: { id: "agendo", etiqueta: "Agendó cita", tono: "verde" },
  no_respondio: { id: "no_respondio", etiqueta: "No respondió", tono: "gris" },
  volver_a_contactar: { id: "volver_a_contactar", etiqueta: "Volver a contactar", tono: "ambar" },
  no_le_interesa: { id: "no_le_interesa", etiqueta: "No le interesa", tono: "gris" },
  no_desea_mensajes: { id: "no_desea_mensajes", etiqueta: "No desea recibir mensajes", tono: "rojo" },
}
export const ORDEN_RESULTADOS = ["agendo", "no_respondio", "volver_a_contactar", "no_le_interesa", "no_desea_mensajes"]
export const CANALES = { whatsapp: "WhatsApp", llamada: "Llamada", presencial: "En persona", correo: "Correo" }

// Cuánto tiempo descansa un paciente de un motivo después de contactarlo, según lo que pasó (en días).
export const REINTENTO_NO_RESPONDIO = 3
export const DESCANSO_AGENDO = 30
export const DESCANSO_NO_LE_INTERESA = 180
const DESCANSO_CITA_POSTERIOR = 60
const ESTADOS_CITA_VIVA = ["Pendiente", "En Espera", "En Atención", "Atendida"]

// ─── Consentimiento (cada paciente tiene dos permisos separados) ───
// Recordatorios de salud: sí hasta que diga que no. Promociones: no hasta que diga que sí.
export const aceptaRecordatorios = (p) => p?.aceptaRecordatorios !== false
export const aceptaPromociones = (p) => p?.aceptaPromociones === true
// Qué permiso hace falta para escribirle a un paciente por un motivo: los cumpleaños y las promociones son "Promociones y saludos"; el control y el
// seguimiento de la compra son "Recordatorios de salud".
export const permisoDeMotivo = (motivo) => (motivo === MOTIVO_PROMOCION || MOTIVOS[motivo]?.consentimiento === "promocion" ? "promociones" : "recordatorios")
export const puedeContactarPor = (paciente, motivo) => (permisoDeMotivo(motivo) === "promociones" ? aceptaPromociones(paciente) : aceptaRecordatorios(paciente))

const telefonoDe = (p) => p.telefono || p.contacto || p.celular || ""
const nacimientoDe = (p) => p.fechaNacimiento || p.fecha_nacimiento || ""
const msDe = (v) => { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t }
const diasEntre = (desdeISO, hastaISO) => Math.round((isoAFechaLocal(hastaISO) - isoAFechaLocal(desdeISO)) / 86400000)
const sumarDias = (iso, n) => { const d = isoAFechaLocal(iso); d.setDate(d.getDate() + n); return fechaAISO(d) }

// ─── Los grupos: quién entra en cada motivo ───
// Devuelve { id, detalle, dias } por cada motivo que cumple el paciente, o [].
export function motivosDe(paciente, { consultas = [], ordenes = [], pases = [], facturas = [], hoy = hoyISO() } = {}) {
  const resultado = []
  // Recibió su diagnóstico y no ha comprado: el pase «listo» más antiguo (lleva más tiempo esperando). Un paciente dado de alta puede seguir con una compra pendiente.
  // Si compró algo después de recibir su diagnóstico (aunque la venta no quedara vinculada a esa consulta), ya no está por vender.
  const porVender = pases.filter((p) => p.pacienteId === paciente.id && p.estado === "listo").sort((a, b) => (a.pasadaEn < b.pasadaEn ? -1 : 1))[0]
  if (porVender && !facturas.some((f) => f.pacienteId === paciente.id && f.estado !== "anulada" && (f.creadoEn || "") > (porVender.pasadaEn || ""))) {
    const dias = diasEnEspera(porVender, isoAFechaLocal(hoy))
    const cuando = dias === 0 ? "hoy" : `hace ${dias} ${dias === 1 ? "día" : "días"}`
    resultado.push({ id: "por_vender", dias, pase: porVender, detalle: esDelPortal(porVender) ? `Pidió lentes desde su portal ${cuando}` : `Recibió su diagnóstico ${cuando}${porVender.proformaEntregadaEn ? " · con proforma" : ""}` })
  }
  if (paciente.estadoClinico === "De alta") return resultado // tratamiento finalizado: no tiene control pendiente
  const vencido = diasVencido(paciente, consultas)
  if (esInactivo(paciente, consultas)) {
    resultado.push({ id: "control_vencido", dias: vencido, detalle: vencido === 0 ? "Su control vence hoy" : `Control vencido hace ${vencido} ${vencido === 1 ? "día" : "días"}` })
  } else if (vencido !== null && vencido >= -DIAS_CONTROL_PROXIMO) {
    const faltan = -vencido
    resultado.push({ id: "control_proximo", dias: faltan, detalle: `Su control vence en ${faltan} ${faltan === 1 ? "día" : "días"}` })
  }
  const sinVisitar = diasDesdeUltimaVisita(paciente, consultas)
  if (sinVisitar !== null && sinVisitar > DIAS_SIN_VISITAR) {
    const meses = Math.floor(sinVisitar / 30)
    resultado.push({ id: "sin_visitar", dias: sinVisitar, detalle: `Última visita hace ${meses} meses` })
  }
  const cumple = diasCumpleEnVentana(nacimientoDe(paciente), isoAFechaLocal(hoy))
  if (cumple !== null) {
    resultado.push({ id: "cumpleanos", dias: cumple, detalle: cumple === 0 ? "Cumple años hoy" : cumple > 0 ? `Cumple años en ${cumple} ${cumple === 1 ? "día" : "días"}` : `Cumplió años hace ${-cumple} ${cumple === -1 ? "día" : "días"}` })
  }
  const entrega = entregaReciente(paciente, ordenes, hoy)
  if (entrega) resultado.push({ id: "postventa", dias: entrega.dias, detalle: `Recibió sus lentes hace ${entrega.dias} días` })
  return resultado
}

// La entrega más reciente de lentes (orden entregada) de un paciente cuyo día cae entre 7 y 15 días atrás.
function entregaReciente(paciente, ordenes, hoy) {
  let mejor = null
  for (const o of ordenes) {
    if (o.pacienteId !== paciente.id || o.estado !== "entregada") continue
    const cambio = (o.historial || []).filter((h) => h.estado === "entregada").sort((a, b) => msDe(b.cambiadoEn) - msDe(a.cambiadoEn))[0]
    const dia = cambio ? diaDeRegistro(cambio.cambiadoEn) : ""
    if (!dia) continue
    const dias = diasEntre(dia, hoy)
    if (dias >= POSTVENTA_DESDE && dias <= POSTVENTA_HASTA && (!mejor || dias < mejor.dias)) mejor = { dias, dia }
  }
  return mejor
}

// ─── Qué pasó con cada contacto ───
// Una cita que el paciente agendó DESPUÉS del contacto lo resuelve sola ("agendó"), salvo que ya haya dicho que no quiere mensajes.
export function citaPosterior(contacto, citas = []) {
  const desde = msDe(contacto.creadoEn)
  return citas.some((c) => c.pacienteId === contacto.pacienteId && ESTADOS_CITA_VIVA.includes(c.estado) && msDe(c.creadoEn) > desde)
}
export function resultadoEfectivo(contacto, citas = []) {
  if (contacto.resultado === "no_desea_mensajes" || contacto.resultado === "no_le_interesa" || contacto.resultado === "agendo") return contacto.resultado
  return citaPosterior(contacto, citas) ? "agendo" : contacto.resultado || null
}

const masReciente = (lista) => lista.reduce((a, b) => (msDe(b.creadoEn) > msDe(a.creadoEn) ? b : a), lista[0])

// ¿Este paciente descansa de este motivo por lo que pasó en su último contacto? { oculto, hasta (el día en que vuelve), reaparece, sinResultado }
export function estadoDelMotivo(contactosDelMotivo, citas, hoy = hoyISO()) {
  if (contactosDelMotivo.length === 0) return { oculto: false }
  const ultimo = masReciente(contactosDelMotivo)
  const efectivo = resultadoEfectivo(ultimo, citas)
  const diaContacto = diaDeRegistro(ultimo.creadoEn) || hoy
  const desdeContacto = diasEntre(diaContacto, hoy)
  const descanso = (dias) => ({ oculto: desdeContacto < dias, hasta: sumarDias(diaContacto, dias), ultimo })
  if (efectivo === null) return { oculto: false, sinResultado: true, ultimo }
  if (efectivo === "agendo") return descanso(ultimo.resultado === "agendo" ? DESCANSO_AGENDO : DESCANSO_CITA_POSTERIOR)
  if (efectivo === "no_respondio") return descanso(REINTENTO_NO_RESPONDIO)
  if (efectivo === "volver_a_contactar") return ultimo.volverEl && ultimo.volverEl > hoy ? { oculto: true, hasta: ultimo.volverEl, ultimo } : { oculto: false, reaparece: true, ultimo }
  if (efectivo === "no_le_interesa") return descanso(DESCANSO_NO_LE_INTERESA)
  return { oculto: true, hasta: null, ultimo } // no_desea_mensajes
}

// ─── La lista de trabajo: "Para contactar" ───
// Una fila por paciente, con los motivos por los que hoy hay que escribirle. Quedan fuera el motivo que el paciente no permitió (cada motivo pide su permiso)
// y el que descansa por un contacto reciente. Es la ÚNICA definición de "por contactar hoy": el CRM y los avisos del Inicio cuentan con ella.
// sinPermiso es cuántos pacientes tienen algún motivo que se dejó fuera por falta de permiso (para decirlo, no esconderlo).
export function listaParaContactar({ pacientes = [], consultas = [], ordenes = [], pases = [], facturas = [], citas = [], contactos = [], hoy = hoyISO() } = {}) {
  const contactosDe = new Map()
  for (const c of contactos) {
    if (!contactosDe.has(c.pacienteId)) contactosDe.set(c.pacienteId, [])
    contactosDe.get(c.pacienteId).push(c)
  }
  const filas = []
  let sinPermiso = 0
  for (const paciente of pacientes) {
    const motivos = motivosDe(paciente, { consultas, ordenes, pases, facturas, hoy })
    if (motivos.length === 0) continue
    const suyos = contactosDe.get(paciente.id) || []
    const permitidos = motivos.filter((m) => puedeContactarPor(paciente, m.id))
    if (permitidos.length < motivos.length) sinPermiso++
    let reaparece = false
    let sinResultado = null
    const activos = []
    for (const m of permitidos) {
      const estado = estadoDelMotivo(suyos.filter((c) => c.motivo === m.id), citas, hoy)
      if (estado.oculto) continue
      activos.push(m)
      if (estado.reaparece) reaparece = true
      if (estado.sinResultado) sinResultado = estado.ultimo
    }
    if (activos.length === 0) continue
    activos.sort((a, b) => ORDEN_MOTIVOS.indexOf(a.id) - ORDEN_MOTIVOS.indexOf(b.id))
    const ultimoContacto = suyos.length ? masReciente(suyos) : null
    const proxima = citas.filter((c) => c.pacienteId === paciente.id && ["Pendiente", "En Espera"].includes(c.estado) && c.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0] || null
    filas.push({
      id: paciente.id, paciente, telefono: telefonoDe(paciente), motivos: activos, principal: activos[0].id,
      ultimoContacto, resultadoUltimo: ultimoContacto ? resultadoEfectivo(ultimoContacto, citas) : null,
      reaparece, sinResultado, citaProxima: proxima,
      // Orden de trabajo: primero lo que hay que retomar hoy, luego lo que quedó sin resultado, luego lo más urgente.
      prioridad: (reaparece ? 0 : sinResultado ? 1 : 2) * 10 + ORDEN_MOTIVOS.indexOf(activos[0].id),
    })
  }
  filas.sort((a, b) => a.prioridad - b.prioridad || (b.motivos[0].dias ?? 0) - (a.motivos[0].dias ?? 0) || a.paciente.nombre.localeCompare(b.paciente.nombre))
  return { filas, sinPermiso }
}

// Cuántos pacientes hay por motivo (un paciente con dos motivos cuenta en los dos) y en total (cada paciente una sola vez).
export function contarPorMotivo(filas) {
  const por = Object.fromEntries(ORDEN_MOTIVOS.map((m) => [m, 0]))
  for (const f of filas) for (const m of f.motivos) por[m.id]++
  return { total: filas.length, por }
}
export const filtrarPorMotivo = (filas, motivo) => (motivo && motivo !== "todos" ? filas.filter((f) => f.motivos.some((m) => m.id === motivo)) : filas)

// "Requieren atención": lo que no puede esperar a mañana.
export function avisosDelCrm(filas, contactos = [], hoy = hoyISO()) {
  const cumpleHoy = filas.filter((f) => f.motivos.some((m) => m.id === "cumpleanos" && m.dias === 0))
  const vuelven = filas.filter((f) => f.reaparece)
  // Contactos de antes de hoy a los que nadie les anotó qué pasó (los de campaña no llevan resultado).
  const vistos = new Set()
  const sinResultado = []
  for (const c of contactos.slice().sort((a, b) => msDe(b.creadoEn) - msDe(a.creadoEn))) {
    if (c.campanaId || c.resultado || vistos.has(c.pacienteId)) continue
    vistos.add(c.pacienteId)
    if ((diaDeRegistro(c.creadoEn) || hoy) < hoy) sinResultado.push(c)
  }
  return { cumpleHoy, vuelven, sinResultado }
}

// ─── Mensajes ───
export const PLANTILLAS_BASE = {
  control_vencido: "Hola {nombre}, te saludamos de {óptica}. Ya pasó la fecha de tu control visual y revisarlo a tiempo cuida tu salud. ¿Te agendamos una cita?",
  control_proximo: "Hola {nombre}, te saludamos de {óptica}. Tu control visual se acerca ({fecha_del_control}). Escríbenos y te reservamos tu horario.",
  cumpleanos: "¡Feliz cumpleaños, {nombre}! Todo el equipo de {óptica} te desea un día excelente.",
  sin_visitar: "Hola {nombre}, te saludamos de {óptica}. Hace tiempo no te vemos y queremos saber cómo estás. ¿Agendamos una revisión de tu vista?",
  postventa: "Hola {nombre}, te escribimos de {óptica}. ¿Cómo te has adaptado a tus lentes nuevos? Si sientes alguna molestia, cuéntanos y lo revisamos.",
  [MOTIVO_PROMOCION]: "Hola {nombre}, en {óptica} tenemos una promoción para ti. Escríbenos y te contamos los detalles.",
  cita_no_efectuada: "Hola {nombre}, te escribimos de {óptica}. No pudimos atenderte en tu cita del {fecha_de_la_cita}. Cuéntanos qué día y hora te quedan bien y la reagendamos.",
  cita_reagendada: "Hola {nombre}, te escribimos de {óptica} para avisarte que tu cita fue reagendada. Nueva fecha: {fecha_de_la_cita}. Cualquier duda, contáctanos por aquí.",
  lentes_listos: "Hola {nombre}, te escribimos de {óptica}: tus lentes (orden {orden}) ya están listos para retirar. Te esperamos.",
  medidas_montaje: "Hola {nombre}, te escribimos de {óptica}. Estas son las medidas que nos pediste para tus lentes:\n{medidas}\nCualquier duda, escríbenos.",
  por_vender: "Hola {nombre}, te escribimos de {óptica}. Quedamos pendientes de los lentes que te recomendó el optómetra: ¿pudiste revisar tu proforma o quieres que te ayudemos con tu compra? Con gusto te atendemos.",
}
export const VARIABLES_PLANTILLA = [
  { id: "{nombre}", ayuda: "Nombre del paciente, como está guardado" },
  { id: "{óptica}", ayuda: "Nombre de tu óptica" },
  { id: "{fecha_del_control}", ayuda: "Fecha de su próximo control" },
  { id: "{fecha_de_la_cita}", ayuda: "Día y hora de la cita", solo: ["cita_no_efectuada", "cita_reagendada"] },
  { id: "{orden}", ayuda: "Número de la orden de lentes", solo: ["lentes_listos"] },
  { id: "{medidas}", ayuda: "La distancia pupilar y la altura de montaje que ya existen", solo: ["medidas_montaje"] },
]
// Las variables que se ofrecen al editar la plantilla de un motivo: las de siempre y las propias de ese motivo. Sin motivo (una campaña), solo las de siempre.
export const variablesDe = (motivo) => VARIABLES_PLANTILLA.filter((v) => !v.solo || (motivo && v.solo.includes(motivo)))
export const MAX_PLANTILLA = 500

// Los mensajes que salen solos van por correo. Se enciende cuando la óptica tenga su correo configurado (igual que el correo de la factura electrónica).
export const CORREO_AUTOMATICO_ACTIVO = false

// Los mensajes que las ópticas guardaron antes usan los nombres viejos: se siguen entendiendo.
const NOMBRES_VIEJOS = { "{optica}": "{óptica}", "{control}": "{fecha_del_control}" }
const alNombreActual = (texto) => Object.entries(NOMBRES_VIEJOS).reduce((t, [viejo, nuevo]) => t.replaceAll(viejo, nuevo), String(texto || ""))

// Un texto con una variable insertada donde estaba el cursor (o en lugar de lo seleccionado); sin cursor, al final.
// Devuelve el texto nuevo y dónde queda el cursor, justo después de la variable.
export function insertarEnCursor(texto, variable, inicio, fin) {
  const t = String(texto || "")
  const desde = Number.isInteger(inicio) ? Math.min(inicio, t.length) : t.length
  const hasta = Number.isInteger(fin) ? Math.min(Math.max(fin, desde), t.length) : desde
  const antes = t.slice(0, desde)
  const despues = t.slice(hasta)
  const espacioAntes = antes && !/[\s(¿¡]$/.test(antes) ? " " : ""
  const espacioDespues = despues && !/^[\s,.;:!?)]/.test(despues) ? " " : ""
  return { texto: `${antes}${espacioAntes}${variable}${espacioDespues}${despues}`, cursor: antes.length + espacioAntes.length + variable.length }
}

// El texto de una plantilla: la de la óptica si la editó, la base si no.
export const plantillaDe = (motivo, guardadas = {}) => (guardadas[motivo] && guardadas[motivo].trim() ? guardadas[motivo] : PLANTILLAS_BASE[motivo] || PLANTILLAS_BASE.control_vencido)

// Lo propio de un aviso va en el segundo argumento: cita ({ fecha, hora }), orden (el número ya escrito) y medidas ({ dp, altura }). Con `ejemplo`, las variables de esos avisos llevan
// un dato de muestra (la vista previa de la plantilla en el CRM).
export function armarMensaje(plantilla, { paciente, opticaNombre, consultas = [], cita = null, orden = "", medidas = null, ejemplo = false } = {}) {
  const control = paciente ? fechaProximoControl(paciente, consultas) : null
  const textoControl = control ? formatoFecha(fechaAISO(control), "medio") : "pronto"
  const textoCita = cita?.fecha ? `${formatoFecha(cita.fecha, "calendario", { enFrase: true })}${cita.hora ? ` a las ${cita.hora}` : ""}` : ejemplo ? "martes 20 de octubre a las 04:00 PM" : "tu cita"
  const conUnidad = (t) => (/mm\s*$/i.test(String(t).trim()) ? String(t).trim() : `${String(t).trim()} mm`)
  const lineasMedidas = [medidas?.dp && `• Distancia pupilar: ${conUnidad(medidas.dp)}`, medidas?.altura && `• Altura de montaje: ${conUnidad(medidas.altura)}`].filter(Boolean).join("\n")
  const textoMedidas = lineasMedidas || (ejemplo ? "• Distancia pupilar: 62 mm\n• Altura de montaje: 18 mm" : "")
  return alNombreActual(plantilla)
    .replaceAll("{nombre}", paciente?.nombre || "")
    .replaceAll("{óptica}", opticaNombre || "tu óptica")
    .replaceAll("{fecha_del_control}", textoControl)
    .replaceAll("{fecha_de_la_cita}", textoCita)
    .replaceAll("{orden}", orden || (ejemplo ? "000012" : ""))
    .replaceAll("{medidas}", textoMedidas)
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim()
}

// ─── Campañas: grupos de destinatarios ───
export const GRUPOS_CAMPANA = {
  control_vencido: { id: "control_vencido", etiqueta: "Control vencido", motivo: "control_vencido", consentimiento: "salud", ayuda: "Pacientes con el control vencido (los mismos del Inicio y de Reportes)." },
  sin_visitar: { id: "sin_visitar", etiqueta: "Sin visitar hace más de 12 meses", motivo: "sin_visitar", consentimiento: "salud", ayuda: "Para recuperar a los que dejaron de venir." },
  cumpleanos_mes: { id: "cumpleanos_mes", etiqueta: "Cumpleaños del mes", motivo: "cumpleanos", consentimiento: "promocion", ayuda: "Quienes cumplen años en este mes y aceptaron promociones y saludos." },
  promociones: { id: "promociones", etiqueta: "Quienes aceptan promociones y saludos", motivo: MOTIVO_PROMOCION, consentimiento: "promocion", ayuda: "Solo pacientes que aceptaron recibir promociones y saludos." },
}
export const ORDEN_GRUPOS = ["control_vencido", "sin_visitar", "cumpleanos_mes", "promociones"]

// Los pacientes de un grupo. sinPermiso: los que cumplen el grupo pero no aceptaron ese tipo de mensaje (no se les escribe).
export function destinatariosCampana(grupo, { pacientes = [], consultas = [], hoy = hoyISO() } = {}) {
  const def = GRUPOS_CAMPANA[grupo]
  if (!def) return { pacientes: [], sinPermiso: 0 }
  const mes = Number(hoy.slice(5, 7))
  const cumple = (p) => {
    if (p.estadoClinico === "De alta" && def.id !== "cumpleanos_mes" && def.id !== "promociones") return false
    if (def.id === "control_vencido") return esInactivo(p, consultas)
    if (def.id === "sin_visitar") { const d = diasDesdeUltimaVisita(p, consultas); return d !== null && d > DIAS_SIN_VISITAR }
    if (def.id === "cumpleanos_mes") return Number(String(nacimientoDe(p)).split(/[-/T]/)[1]) === mes
    return true // promociones: todos los que lo aceptan
  }
  const del = pacientes.filter(cumple)
  const permitidos = del.filter((p) => puedeContactarPor(p, def.motivo))
  const orden = def.id === "cumpleanos_mes"
    ? (p) => Number(String(nacimientoDe(p)).split(/[-/T]/)[2]) || 0
    : def.id === "promociones" ? () => 0 : (p) => -(diasDesdeUltimaVisita(p, consultas) ?? 0)
  permitidos.sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre))
  return { pacientes: permitidos, sinPermiso: del.length - permitidos.length }
}

// ─── Seguimiento: el historial de contactos y sus números ───
export function resumenSeguimiento(contactos, citas = []) {
  const pacientes = new Set(contactos.map((c) => c.pacienteId))
  let agendaron = 0
  let respondieron = 0
  for (const c of contactos) {
    const r = resultadoEfectivo(c, citas)
    if (r === "agendo") agendaron++
    if (r && r !== "no_respondio") respondieron++
  }
  return {
    contactos: contactos.length, pacientes: pacientes.size, agendaron, respondieron,
    tasaRespuesta: contactos.length ? Math.round((respondieron / contactos.length) * 100) : null,
  }
}

// ─── Fidelización: los rankings con todos los nombres ───
export function rankingReferidores(pacientes = []) {
  return pacientes.map((p) => ({ paciente: p, valor: contarReferidos(p, pacientes) })).filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.paciente.nombre.localeCompare(b.paciente.nombre))
}
export function rankingFrecuentes(pacientes = [], consultas = []) {
  return pacientes.filter((p) => esClienteFrecuente(p, consultas)).map((p) => ({ paciente: p, valor: contarConsultas(p, consultas) }))
    .sort((a, b) => b.valor - a.valor || a.paciente.nombre.localeCompare(b.paciente.nombre))
}
export function rankingPuntaje(pacientes = [], consultas = []) {
  return pacientes.map((p) => ({ paciente: p, valor: puntajeFidelidad(p, consultas, pacientes) })).filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.paciente.nombre.localeCompare(b.paciente.nombre))
}

// La fecha de hoy más N días ("volver a contactar en 3 días").
export const fechaEnDias = (n, hoy = hoyISO()) => sumarDias(hoy, n)

// ─── Exportar la lista de una campaña (el mismo formato de los demás Excel de la Reportes) ───
export function modeloListaCampana({ campana, filas }) {
  return {
    archivo: `campana-${String(campana.nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "lista"}`,
    hoja: "Campaña", titulo: `Campaña: ${campana.nombre} (${GRUPOS_CAMPANA[campana.grupo]?.etiqueta || campana.grupo})`,
    nota: "Estado de hoy: los pacientes del grupo que aceptaron este tipo de mensaje, y cuáles ya recibieron el envío por WhatsApp.",
    columnas: [
      { titulo: "Paciente", tipo: "texto" }, { titulo: "Teléfono", tipo: "texto" }, { titulo: "Correo", tipo: "texto" }, { titulo: "Mensaje", tipo: "texto" }, { titulo: "Enviado", tipo: "texto" },
    ],
    filas: filas.map((f) => ({ celdas: [f.nombre, f.telefono || "", f.correo || "", f.mensaje, f.enviado ? "Sí" : "No"] })),
    bloques: [], personal: true, sinPeriodo: true, sinFiltros: true, cuenta: "pacientes",
  }
}
