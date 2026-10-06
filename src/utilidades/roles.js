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
  { id: "pacientes", nombre: "Pacientes", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "Eliminar = anonimizar a un paciente." },
  { id: "consultas", nombre: "Ficha clínica", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar"], ayuda: "Las fichas no se borran." },
  { id: "citas", nombre: "Citas médicas", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar"], ayuda: "Las citas no se borran: se cancelan." },
  { id: "crm", nombre: "CRM y fidelización", grupo: "Atención al paciente", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "" },
  { id: "ventas", nombre: "Ventas", grupo: "Gestión y operación", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "Crear = vender y proformas · Editar = abonos y órdenes · Eliminar = anular ventas." },
  { id: "inventario", nombre: "Inventario", grupo: "Gestión y operación", niveles: ["ver", "crear", "editar", "eliminar"], ayuda: "" },
  { id: "reportes", nombre: "Reportes", grupo: "Gestión y operación", niveles: ["ver"], ayuda: "El alcance decide si ve todo o solo lo suyo." },
  { id: "horario", nombre: "Mi horario", grupo: "Gestión y operación", niveles: ["ver", "editar"], ayuda: "" },
  { id: "mensajes", nombre: "Mensajes", grupo: "Administración", niveles: ["ver", "crear"], sensible: true, ayuda: "Mensajes con soporte." },
  { id: "configuracion", nombre: "Configuración", grupo: "Administración", niveles: ["ver", "editar"], sensible: true, ayuda: "Datos de la óptica y parámetros." },
]
export const GRUPOS_MODULOS = [...new Set(MODULOS_PERMISO.map((m) => m.grupo))]

// Alcance de los datos (solo citas, consultas y reportes)
export const MODULOS_CON_ALCANCE = [
  { id: "citas", nombre: "Citas", propio: "Solo las suyas (y las que aún no tienen responsable)" },
  { id: "consultas", nombre: "Fichas clínicas", propio: "Solo las que atendió" },
  { id: "reportes", nombre: "Reportes", propio: "Solo lo que se calcula con sus citas y fichas" },
]

export const INICIOS_ROL = [
  { id: "general", etiqueta: "General (según los módulos del rol)", descripcion: "Muestra los bloques de los módulos que el rol puede ver." },
  { id: "optometra", etiqueta: "Optómetra", descripcion: "Su agenda de hoy, siguiente paciente y atenciones abiertas." },
  { id: "recepcion", etiqueta: "Recepción", descripcion: "Citas de hoy, sala de espera, por confirmar y atajos para agendar." },
  { id: "ventas", etiqueta: "Ventas", descripcion: "Pacientes por vender, órdenes de laboratorio y saldos por cobrar." },
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
  return concedidos.some((r) => (r.alcance?.[modulo] || "todo") === "todo") ? "todo" : "propio"
}

// Texto corto de lo que puede hacer un rol (vista previa)
export function resumenPermisos(permisos) {
  return MODULOS_PERMISO.map((m) => {
    const niveles = permisos?.[m.id]
    if (!Array.isArray(niveles) || niveles.length === 0) return null
    const mas = niveles.filter((n) => n !== "ver").map((n) => NIVELES.find((x) => x.id === n)?.etiqueta.toLowerCase())
    return { modulo: m.nombre, texto: mas.length === 0 ? "solo ver" : `ver, ${mas.join(", ")}` }
  }).filter(Boolean)
}

// Módulos que aparecen en el menú para este conjunto de permisos (en el orden del menú).
export const NOMBRES_MENU = { citas: "Citas médicas", pacientes: "Pacientes", inventario: "Inventario", crm: "CRM y fidelización", horario: "Mi horario", reportes: "Reportes", mensajes: "Mensajes", configuracion: "Configuración" }
export const menuDePermisos = (permisos) => ["citas", "pacientes", "inventario", "crm", "horario", "reportes", "mensajes", "configuracion"].filter((m) => puedeNivel(permisos, m, "ver")).map((m) => NOMBRES_MENU[m])
