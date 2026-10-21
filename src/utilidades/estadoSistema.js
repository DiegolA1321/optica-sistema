// El estado del sistema para el Resumen del superadmin: los cinco componentes, sus estados, la rapidez con una referencia, el estado
// general, el historial de 30 días y qué hacer en cada caso. Los datos vienen de `estado_sistema()` (migración 0121).

export const COMPONENTES = [
  { id: "sesion", nombre: "Inicio de sesión", para: "Que el personal y los pacientes puedan entrar.", referencia: "Se verifica que las cuentas de acceso respondan y que haya al menos una cuenta activa." },
  { id: "datos", nombre: "Datos", para: "Que la base de datos responda, y qué tan rápido.", referencia: "Se mide cuánto tardan consultas reales a las tablas del sistema." },
  { id: "archivos", nombre: "Archivos", para: "Que se puedan subir y descargar fotos, facturas y adjuntos.", referencia: "Se verifica que el servicio de archivos responda y que existan sus cinco carpetas." },
  { id: "tareas", nombre: "Tareas automáticas", para: "Que se ejecuten las tareas programadas (marcar «No efectuada», recordatorios).", referencia: "Se revisa cuándo corrió cada tarea y si su última ejecución falló." },
  { id: "correo", nombre: "Correo", para: "Que salgan los recordatorios y saludos por correo.", referencia: "Se verifica que haya clave y remitente propio, y que no se rechacen envíos." },
]

// peso: para elegir el peor. Un servicio sin configurar no es una falla: no vuelve "con fallas" al sistema.
export const ESTADOS = {
  operativo: { nombre: "Operativo", peso: 0, texto: "text-emerald-700", punto: "bg-emerald-500", insignia: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  no_configurado: { nombre: "No configurado", peso: 1, texto: "text-slate-600", punto: "bg-slate-400", insignia: "border-slate-200 bg-slate-50 text-slate-600" },
  lento: { nombre: "Lento", peso: 2, texto: "text-amber-700", punto: "bg-amber-500", insignia: "border-amber-200 bg-amber-50 text-amber-700" },
  con_fallas: { nombre: "Con fallas", peso: 3, texto: "text-red-700", punto: "bg-red-500", insignia: "border-red-200 bg-red-50 text-red-700" },
}
export const nombreComponente = (id) => COMPONENTES.find((c) => c.id === id)?.nombre || id

// La rapidez, con su referencia, en lugar de un número suelto. Solo donde se mide un tiempo (Inicio de sesión, Datos y Archivos).
export const LIMITE_RAPIDO_MS = 200
export const LIMITE_NORMAL_MS = 800
export function rapidez(componente, ms) {
  if (!["sesion", "datos", "archivos"].includes(componente) || ms == null) return null
  if (ms < LIMITE_RAPIDO_MS) return { nombre: "Rápido", referencia: "menos de 0,2 s" }
  if (ms < LIMITE_NORMAL_MS) return { nombre: "Normal", referencia: "menos de 0,8 s" }
  return { nombre: "Lento", referencia: "0,8 s o más" }
}

// "hace 5 min", "hace 2 h", "hace 3 días".
export function haceTiempo(iso, ahora = Date.now()) {
  if (!iso) return ""
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000))
  if (min < 1) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? "día" : "días"}`
}

// Las cinco filas en su orden, con lo último que se verificó de cada una (null si todavía no hay).
export function componentesConEstado(datos) {
  const ultimos = new Map((datos?.ultimos || []).map((u) => [u.componente, u]))
  return COMPONENTES.map((c) => ({ ...c, ultimo: ultimos.get(c.id) || null }))
}

// El estado general es el peor de los cinco. Falta configurar algo no es una falla: el sistema sigue «Operativo» y se dice qué falta.
export function estadoGeneral(componentes) {
  const con = componentes.filter((c) => c.ultimo)
  if (con.length === 0) return { estado: null, nombre: "Sin verificar", sinConfigurar: [] }
  const peor = con.reduce((a, c) => (ESTADOS[c.ultimo.estado].peso > ESTADOS[a.ultimo.estado].peso ? c : a))
  const sinConfigurar = con.filter((c) => c.ultimo.estado === "no_configurado").map((c) => c.nombre)
  if (peor.ultimo.estado === "no_configurado") return { estado: "operativo", nombre: ESTADOS.operativo.nombre, sinConfigurar }
  return { estado: peor.ultimo.estado, nombre: ESTADOS[peor.ultimo.estado].nombre, sinConfigurar }
}

// Una verificación atrasada (la tarea de cada 15 minutos dejó de correr) se dice: un estado viejo no es un estado.
export const MINUTOS_ATRASO = 45
export const verificacionAtrasada = (componentes, ahora = Date.now()) => {
  const fechas = componentes.filter((c) => c.ultimo).map((c) => new Date(c.ultimo.creado_at).getTime())
  return fechas.length > 0 && ahora - Math.max(...fechas) > MINUTOS_ATRASO * 60000
}

// Los 30 días de un componente: un cuadro por día con el peor estado de ese día (null = sin verificaciones).
export function historial30(datos, componente, hoyISO) {
  const porDia = new Map((datos?.historial || []).filter((h) => h.componente === componente).map((h) => [h.dia, h]))
  const [a, m, d] = hoyISO.split("-").map(Number)
  const dias = []
  for (let i = 29; i >= 0; i--) {
    const f = new Date(Date.UTC(a, m - 1, d - i)).toISOString().slice(0, 10)
    const h = porDia.get(f)
    let estado = null
    if (h) estado = h.con_fallas > 0 ? "con_fallas" : h.lento > 0 ? "lento" : h.operativo > 0 ? "operativo" : h.no_configurado > 0 ? "no_configurado" : null
    dias.push({ dia: f, estado, latenciaMedia: h?.latencia_media ?? null })
  }
  return dias
}

// El porcentaje de verificaciones operativas en los 30 días (null si no hubo ninguna).
export function disponibilidad30(datos, componente) {
  const filas = (datos?.historial || []).filter((h) => h.componente === componente)
  const total = filas.reduce((n, h) => n + h.operativo + h.lento + h.con_fallas, 0)
  if (total === 0) return null
  return Math.round((filas.reduce((n, h) => n + h.operativo, 0) / total) * 1000) / 10
}

// Qué hacer según el componente y su estado.
const QUE_HACER = {
  sesion: {
    con_fallas: ["Entra al panel de Supabase → Authentication y revisa que el servicio esté activo.", "Mientras no responda nadie podrá iniciar sesión: avisa a la óptica."],
    lento: ["Suele ser pasajero: espera la próxima verificación (cada 15 minutos).", "Si sigue lento, revisa el panel de Supabase → Authentication → Logs."],
  },
  datos: {
    con_fallas: ["Revisa en el panel de Supabase que el proyecto esté activo y no pausado.", "Si el proyecto está activo, mira Database → Logs: puede haber una consulta bloqueada."],
    lento: ["Suele ser pasajero: espera la próxima verificación.", "Si se repite, revisa en Supabase → Reports el uso de la base de datos."],
  },
  archivos: {
    con_fallas: ["Revisa en Supabase → Storage que las cinco carpetas existan (logos, productos, consultas-adjuntos, facturas-electronicas, soporte-adjuntos).", "Si falta alguna, hay que volver a crearla antes de que la óptica suba archivos."],
    lento: ["Suele ser pasajero: espera la próxima verificación.", "Si se repite, revisa Supabase → Storage → Logs."],
  },
  tareas: {
    con_fallas: ["Mira abajo qué tarea falló o se retrasó y cuándo corrió por última vez.", "En Supabase → Database → Cron revisa su última ejecución y su mensaje de error.", "Mientras tanto «No efectuada» y los recordatorios no se marcan solos: se pueden marcar a mano."],
    lento: ["Una tarea se está retrasando: espera la próxima verificación.", "Si sigue igual, revisa Supabase → Database → Cron."],
  },
  correo: {
    no_configurado: ["Pide la clave del servicio de correo, verifica un dominio propio para el remitente y guárdalos en la bóveda de Supabase (secretos resend_api_key y correo_remitente).", "Mientras tanto no salen recordatorios ni saludos por correo; el resto del sistema funciona."],
    con_fallas: ["El servicio de correo rechazó envíos: revisa la clave y que el dominio del remitente esté verificado.", "Mira el panel del servicio de correo (Resend → Logs) para ver el motivo de cada rechazo."],
  },
}
export const queHacer = (componente, estado) => QUE_HACER[componente]?.[estado] || (estado === "operativo" ? ["No hay nada que hacer: todo responde con normalidad."] : [])

// Los avisos del área «Sistema» de «Requiere tu atención»: un aviso por tipo de problema, con un caso por componente.
// «No configurado» no es un aviso: el sistema funciona (se ve en Estado del sistema).
export function avisosDeSistema(componentes) {
  const fila = (estado, singular, plural) => {
    const casos = componentes.filter((c) => c.ultimo?.estado === estado)
    if (casos.length === 0) return null
    return {
      id: estado, cantidad: casos.length, texto: casos.length === 1 ? singular : plural, tono: estado === "con_fallas" ? "urgente" : undefined,
      nombres: casos.map((c) => c.nombre).join(", "),
      casos: casos.map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.ultimo.detalle || c.para, insignia: { texto: ESTADOS[estado].nombre, tono: estado === "con_fallas" ? "urgente" : "aviso" }, accion: { etiqueta: "Ver detalle", componente: c.id } })),
    }
  }
  return [fila("con_fallas", "componente con fallas", "componentes con fallas"), fila("lento", "componente lento", "componentes lentos")].filter(Boolean)
}

// Los datos de ejemplo para revisar la pantalla antes de aplicar la migración (solo en desarrollo, con ?_muestra=estado).
export function estadoDeMuestra(ahora = Date.now(), variante = "estado") {
  const hace = (min) => new Date(ahora - min * 60000).toISOString()
  const dia = (n) => new Date(ahora - n * 86400000).toISOString().slice(0, 10)
  const historial = []
  for (const c of COMPONENTES) {
    for (let n = 0; n < 30; n++) {
      const base = { componente: c.id, dia: dia(n), operativo: 96, lento: 0, con_fallas: 0, no_configurado: 0, latencia_media: c.id === "archivos" ? 40 : 6 }
      if (c.id === "correo") Object.assign(base, { operativo: 0, no_configurado: 96, latencia_media: null })
      if (c.id === "tareas") base.latencia_media = null
      if (c.id === "datos" && n === 4) Object.assign(base, { operativo: 90, lento: 6 })
      if (c.id === "archivos" && n === 9) Object.assign(base, { operativo: 80, con_fallas: 16 })
      historial.push(base)
    }
  }
  const lento = variante === "lento"
  return {
    generado: hace(0),
    ultimos: [
      { componente: "sesion", estado: "operativo", latencia_ms: 5, detalle: null, referencia_at: null, creado_at: hace(6) },
      { componente: "datos", estado: lento ? "lento" : "operativo", latencia_ms: lento ? 1150 : 2, detalle: null, referencia_at: null, creado_at: hace(6) },
      { componente: "archivos", estado: "operativo", latencia_ms: 32, detalle: null, referencia_at: null, creado_at: hace(6) },
      { componente: "tareas", estado: "operativo", latencia_ms: null, detalle: null, referencia_at: hace(3), creado_at: hace(6) },
      { componente: "correo", estado: "no_configurado", latencia_ms: null, detalle: "Falta la clave del servicio de correo o un remitente con dominio propio verificado: los correos salen con el remitente de pruebas y no llegan a los pacientes.", referencia_at: null, creado_at: hace(6) },
    ],
    historial,
    fallos: [
      { componente: "archivos", estado: "con_fallas", detalle: "Faltan carpetas de archivos (hay 4 de 5).", creado_at: hace(9 * 1440) },
      { componente: "datos", estado: "lento", detalle: null, creado_at: hace(4 * 1440) },
    ],
    tareas: [
      { nombre: "marcar_no_asistio_automatico", programacion: "*/5 * * * *", ultima_ejecucion: hace(3), ultimo_estado: "succeeded" },
      { nombre: "recordatorios_citas_diarios", programacion: "0 15 * * *", ultima_ejecucion: hace(600), ultimo_estado: "succeeded" },
      { nombre: "saludos_cumpleanos_diarios", programacion: "0 15 * * *", ultima_ejecucion: hace(600), ultimo_estado: "succeeded" },
      { nombre: "limpiar_limite_solicitudes", programacion: "30 4 * * *", ultima_ejecucion: hace(700), ultimo_estado: "succeeded" },
      { nombre: "verificar_sistema", programacion: "*/15 * * * *", ultima_ejecucion: hace(6), ultimo_estado: "succeeded" },
    ],
  }
}

// Una consulta de soporte de ejemplo (urgente y sin respuesta) para revisar el Inicio con un aviso (solo con ?_muestra=lento, en desarrollo).
export const consultaDeMuestra = (opticaId) => ({ id: "muestra-1", numero: 61, asunto: "No puedo imprimir la receta de un paciente", urgencia: "urgente", estado: "recibida", ultimoMensajeDe: "optica", opticaId })

// El uso de la óptica de ejemplo (todos los módulos en uso, algunos hace unos días) para que cada estado de la muestra sea reproducible.
export function usoDeMuestra(opticaId, ahora = Date.now()) {
  const hace = (d) => new Date(ahora - d * 86400000).toISOString()
  return [{ optica_id: opticaId, personas_activas: 3, previo: { personas_activas: 2 }, modulos: { citas: hace(0), pacientes: hace(1), consultas: hace(2), ventas: hace(3), inventario: hace(10), crm: hace(12), reportes: hace(14) } }]
}

// Cómo se llaman las tareas programadas en voz de la persona (no los nombres internos).
export const NOMBRE_TAREA = {
  marcar_no_asistio_automatico: "Marcar «No efectuada»",
  recordatorios_citas_diarios: "Recordatorios de citas",
  saludos_cumpleanos_diarios: "Saludos de cumpleaños",
  limpiar_limite_solicitudes: "Limpieza de solicitudes públicas",
  verificar_sistema: "Verificación del sistema",
}
export const nombreTarea = (n) => NOMBRE_TAREA[n] || n
export const cadaCuanto = (cron) => ({ "*/5 * * * *": "cada 5 minutos", "*/15 * * * *": "cada 15 minutos", "0 15 * * *": "todos los días a las 10:00", "30 4 * * *": "todos los días de madrugada" }[cron] || cron)
