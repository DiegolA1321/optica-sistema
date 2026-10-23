// Roles y permisos por nivel (Bloque D, migraciones 0090 y 0091).
// El catálogo de módulos y niveles es el mismo que usa la base (_catalogo_permisos):
// lo que no está concedido, no se tiene. Cualquier nivel implica "ver".

export const NIVELES = [
  { id: "ver", etiqueta: "Ver" },
  { id: "crear", etiqueta: "Crear" },
  { id: "editar", etiqueta: "Editar" },
  { id: "eliminar", etiqueta: "Eliminar" },
]
const ORDEN_NIVELES = NIVELES.map((n) => n.id)

// grupo: cómo se agrupan en la matriz. sensible: delegar acceso a toda la óptica.
export const MODULOS_PERMISO = [
  { id: "pacientes", breve: "Perfil, datos e historia", nombre: "Pacientes", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "Eliminar = anonimizar a un paciente." },
  { id: "consultas", breve: "Diagnóstico y receta", nombre: "Ficha clínica", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar"], ayuda: "Las fichas no se borran." },
  { id: "citas", breve: "Agenda y atenciones", nombre: "Citas médicas", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar"], ayuda: "Las citas no se borran: se cancelan." },
  { id: "crm", breve: "Mensajes, campañas y fidelización", nombre: "CRM y fidelización", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "" },
  { id: "ventas", breve: "Vender, abonos y pedidos", nombre: "Ventas", grupo: "Gestión y operación", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "Crear = vender y proformas · Editar = abonos y órdenes · Eliminar = anular ventas." },
  { id: "inventario", breve: "Productos y stock", nombre: "Inventario", grupo: "Gestión y operación", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "" },
  { id: "reportes", breve: "Indicadores", nombre: "Reportes", grupo: "Gestión y operación", niveles: ["ver"], ayuda: "El alcance decide si ve todo o solo lo suyo." },
  { id: "horario", breve: "Su agenda y sus ausencias", nombre: "Mi horario", grupo: "Gestión y operación", niveles: ["ver"], ayuda: "Ve su agenda y edita su propio horario y sus ausencias." },
  { id: "horario_optica", breve: "Horario general de la óptica · da acceso de administración", nombre: "Horario de la óptica", grupo: "Gestión y operación", niveles: ["ver", "editar"], sensible: true, ayuda: "Ver: el horario general en lectura · Editar: cambiarlo, cerrar o abrir días y la duración de las citas. El administrador siempre puede." },
  { id: "mensajes", breve: "Consultas y avisos", nombre: "Soporte", grupo: "Administración", niveles: ["ver", "crear"], ayuda: "Ver: la ayuda, sus propias consultas y los avisos del sistema · Crear: escribir a su administrador (no al soporte del sistema) y responder. Solo el administrador escribe al soporte del sistema, ve y escala las consultas de su personal y publica avisos. Los avisos de la óptica le llegan a todo el personal destinatario, tenga o no este permiso." },
  { id: "configuracion", breve: "Datos y parámetros · da acceso de administración", nombre: "Configuración", grupo: "Administración", niveles: ["ver", "editar"], sensible: true, ayuda: "Datos de la óptica y parámetros." },
]
export const GRUPOS_MODULOS = [...new Set(MODULOS_PERMISO.map((m) => m.grupo))]

// «Qué datos ve» (solo citas, fichas clínicas y reportes). Tres alcances según el módulo: «Solo las suyas» (el más restrictivo), «Los que atiende» (las fichas de los pacientes que atiende,
// migración 0145) y «Toda la óptica». Los pacientes no se acotan: todo el equipo puede buscarlos.
export const ALCANCE_MAS_RESTRICTIVO = "propio"
export const OPCIONES_ALCANCE = {
  citas: [{ id: "propio", etiqueta: "Solo las suyas" }, { id: "todo", etiqueta: "Toda la óptica" }],
  consultas: [{ id: "propio", etiqueta: "Solo las suyas" }, { id: "atiende", etiqueta: "Los que atiende" }, { id: "todo", etiqueta: "Toda la óptica" }],
  reportes: [{ id: "propio", etiqueta: "Solo lo suyo" }, { id: "todo", etiqueta: "Toda la óptica" }],
}
export const MODULOS_CON_ALCANCE = [
  { id: "citas", nombre: "Citas", propio: "Solo las suyas (y las que aún no tienen responsable)" },
  { id: "consultas", nombre: "Fichas clínicas", propio: "Solo las que atendió", atiende: "Las de los pacientes que atiende" },
  { id: "reportes", nombre: "Reportes", propio: "Solo lo que se calcula con sus citas y fichas" },
]
const ANCHO_ALCANCE = { propio: 0, atiende: 1, todo: 2 }
// Lo que guarda un rol en cada módulo con alcance: un valor que no existe (o ausente) vale «toda la óptica», como en la base.
export const alcanceDe = (alcance, modulo) => (OPCIONES_ALCANCE[modulo]?.some((o) => o.id === alcance?.[modulo]) ? alcance[modulo] : "todo")
// El alcance de un rol nuevo: cada módulo con alcance que se encienda parte de lo más restrictivo.
export const alcanceDeRolNuevo = () => Object.fromEntries(MODULOS_CON_ALCANCE.map((m) => [m.id, ALCANCE_MAS_RESTRICTIVO]))
// Lo que se guarda: el alcance explícito de cada módulo con alcance que el rol tiene (los demás no llevan).
export const alcanceParaGuardar = (alcance, permisos) => Object.fromEntries(MODULOS_CON_ALCANCE.filter((m) => permisos?.[m.id]).map((m) => [m.id, alcanceDe(alcance, m.id)]))
// «Partir de» un rol: sus permisos, su alcance y lo que lo hace de atención a pacientes (nada más).
export const partirDeRol = (rol) => ({
  permisos: normalizarPermisosRol(rol?.permisos || {}),
  alcance: Object.fromEntries(MODULOS_CON_ALCANCE.map((m) => [m.id, alcanceDe(rol?.alcance, m.id)])),
  atiende: !!rol?.atiende_pacientes,
  inicio: rol?.inicio || "general",
})

export const INICIOS_ROL = [
  { id: "general", etiqueta: "General (según los módulos del rol)", descripcion: "Muestra los bloques de los módulos que el rol puede ver." },
  { id: "optometra", etiqueta: "Optómetra", descripcion: "Su agenda de hoy, siguiente paciente y atenciones abiertas." },
  { id: "recepcion", etiqueta: "Recepción", descripcion: "Citas de hoy, sala de espera, por confirmar y atajos para agendar." },
  { id: "ventas", etiqueta: "Ventas", descripcion: "Ventas, pedidos y saldos por cobrar." },
]

export const permisosCompletos = () => Object.fromEntries(MODULOS_PERMISO.map((m) => [m.id, [...m.niveles]]))

// ¿Tiene este nivel en este módulo? permisos = { modulo: ["ver", ...] }
export const puedeNivel = (permisos, modulo, nivel = "ver") => Array.isArray(permisos?.[modulo]) && permisos[modulo].includes(nivel)

// Un nivel implica "ver", se ordenan y se descartan módulos o niveles que no existen.
export function normalizarPermisosRol(permisos = {}) {
  const limpio = {}
  for (const m of MODULOS_PERMISO) {
    const dados = new Set((Array.isArray(permisos[m.id]) ? permisos[m.id] : []).filter((n) => m.niveles.includes(n)))
    if (dados.size === 0) continue
    const niveles = ORDEN_NIVELES.filter((n) => m.niveles.includes(n) && (dados.has(n) || n === "ver"))
    if (niveles.length > 0) limpio[m.id] = niveles
  }
  return limpio
}

// Interruptores de módulo que usa el menú (Dashboard): true si puede ver el módulo.
export const modulosVisibles = (permisos) => Object.fromEntries(MODULOS_PERMISO.map((m) => [m.id, puedeNivel(permisos, m.id, "ver")]))

// Suma de los permisos de varios roles (como hace la base).
export function unirPermisos(listaPermisos) {
  const suma = {}
  for (const permisos of listaPermisos) {
    for (const [modulo, niveles] of Object.entries(permisos || {})) suma[modulo] = [...new Set([...(suma[modulo] || []), ...niveles])]
  }
  return normalizarPermisosRol(suma)
}

// Alcance más amplio entre los roles que dan acceso al módulo ("todo" gana).
export function alcanceDeRoles(roles, modulo) {
  const concedidos = roles.filter((r) => Array.isArray(r.permisos?.[modulo]))
  if (concedidos.length === 0) return "todo"
  return concedidos.map((r) => alcanceDe(r.alcance, modulo)).reduce((a, b) => (ANCHO_ALCANCE[b] > ANCHO_ALCANCE[a] ? b : a))
}

// Texto corto de lo que puede hacer un rol (vista previa)
export function resumenPermisos(permisos) {
  return MODULOS_PERMISO.map((m) => {
    const niveles = permisos?.[m.id]
    if (!Array.isArray(niveles) || niveles.length === 0) return null
    // "Mi horario" solo tiene el nivel ver, pero quien lo tiene también edita su propio horario y sus ausencias: no se resume como "solo ver".
    if (m.id === "horario") return { modulo: m.nombre, texto: "su agenda y su propio horario" }
    const mas = niveles.filter((n) => n !== "ver").map((n) => NIVELES.find((x) => x.id === n)?.etiqueta.toLowerCase())
    return { modulo: m.nombre, texto: mas.length === 0 ? "solo ver" : `ver, ${mas.join(", ")}` }
  }).filter(Boolean)
}

// Módulos que aparecen en el menú para este conjunto de permisos (en el orden del menú).
export const NOMBRES_MENU = { citas: "Citas médicas", pacientes: "Pacientes", ventas: "Ventas", inventario: "Inventario", crm: "CRM y fidelización", horario: "Mi horario", reportes: "Reportes", mensajes: "Soporte", configuracion: "Configuración" }
export const menuDePermisos = (permisos) => ["citas", "pacientes", "ventas", "inventario", "crm", "horario", "reportes", "mensajes", "configuracion"].filter((m) => puedeNivel(permisos, m, "ver")).map((m) => NOMBRES_MENU[m])
