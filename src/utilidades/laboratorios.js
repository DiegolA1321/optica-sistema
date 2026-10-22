// El catálogo de laboratorios de la óptica (Configuración → Laboratorios). Se guarda en la parametrización (`parametrizacion.laboratorios`: [{ nombre, activo }]), como la fidelización:
// no hace falta cambiar la base de datos y cada óptica, la de hoy y la que se cree después, empieza con el catálogo vacío y agrega los suyos.
// Los pedidos de lentes guardan el nombre del laboratorio como texto: renombrar o desactivar uno no toca los pedidos ya hechos. Lógica pura.
import { laboratoriosUsados } from "./ordenesLaboratorio"

export const MAX_LABORATORIOS = 50
export const MAX_NOMBRE_LABORATORIO = 60

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
// «Laboratorio Visión Norte» y «laboratorio vision  norte» son el mismo nombre.
export const claveDeNombre = (t) => sinTildes(t).toLowerCase().replace(/\s+/g, " ").trim()
// Lo que distingue a un laboratorio: su nombre sin la palabra «laboratorio» (que casi todos llevan), para encontrar «Visión Norte» ≈ «Laboratorio Visión Norte».
const nucleo = (t) => claveDeNombre(t).replace(/^laboratorio(s)?\s+/, "").replace(/\s+(lab|laboratorio)$/, "").trim()

// El catálogo guardado, limpio: nombres sin repetir y en el orden en que se agregaron. Sin catálogo guardado todavía, vacío.
export function laboratoriosDe(parametrizacion) {
  const lista = Array.isArray(parametrizacion?.laboratorios) ? parametrizacion.laboratorios : []
  const vistos = new Set()
  const out = []
  for (const l of lista) {
    const nombre = String(l?.nombre ?? "").trim()
    const clave = claveDeNombre(nombre)
    if (!nombre || vistos.has(clave)) continue
    vistos.add(clave)
    out.push({ nombre, activo: l.activo !== false })
  }
  return out
}

export const laboratoriosActivos = (parametrizacion) => laboratoriosDe(parametrizacion).filter((l) => l.activo).map((l) => l.nombre)

// Los que se ofrecen al elegir el laboratorio de un pedido: los activos y, si el pedido ya tenía uno que ahora está desactivado o no está en el catálogo, ese también (no se pierde).
export function laboratoriosParaElegir(parametrizacion, actual = "") {
  const activos = laboratoriosActivos(parametrizacion)
  const a = String(actual ?? "").trim()
  return a && !activos.some((n) => claveDeNombre(n) === claveDeNombre(a)) ? [...activos, a] : activos
}

// Los nombres que se pueden filtrar en la lista de pedidos: los del catálogo y los que ya usan los pedidos (aunque se hayan desactivado o renombrado).
export function laboratoriosParaFiltrar(parametrizacion, ordenes = []) {
  const vistos = new Set()
  const out = []
  for (const n of [...laboratoriosDe(parametrizacion).map((l) => l.nombre), ...laboratoriosUsados(ordenes)]) {
    const c = claveDeNombre(n)
    if (c && !vistos.has(c)) { vistos.add(c); out.push(n) }
  }
  return out
}

// ¿El nombre es válido para agregarlo (o para renombrar `excepto`)? Devuelve el mensaje de error o "".
export function errorDeNombreLaboratorio(lista, nombre, excepto = "") {
  const n = String(nombre ?? "").trim()
  if (!n) return "Escribe el nombre del laboratorio."
  if (n.length > MAX_NOMBRE_LABORATORIO) return `El nombre no puede pasar de ${MAX_NOMBRE_LABORATORIO} caracteres.`
  const repetido = lista.find((l) => claveDeNombre(l.nombre) === claveDeNombre(n) && claveDeNombre(l.nombre) !== claveDeNombre(excepto))
  if (repetido) return `Ya existe «${repetido.nombre}»${repetido.activo ? "" : " (desactivado)"}.`
  if (!excepto && lista.length >= MAX_LABORATORIOS) return `Una óptica puede tener hasta ${MAX_LABORATORIOS} laboratorios.`
  return ""
}

export const agregarLaboratorio = (lista, nombre) => [...lista, { nombre: String(nombre).trim(), activo: true }]
export const renombrarLaboratorio = (lista, nombre, nuevo) => lista.map((l) => (l.nombre === nombre ? { ...l, nombre: String(nuevo).trim() } : l))
export const cambiarActivoLaboratorio = (lista, nombre, activo) => lista.map((l) => (l.nombre === nombre ? { ...l, activo } : l))

// Los laboratorios parecidos entre sí («Laboratorio Visión Norte» y «Laboratorio Visión»): grupos de nombres que casi seguro son el mismo laboratorio, con el más usado primero,
// para proponer unificarlos. Dos nombres son parecidos si uno contiene al otro sin la palabra «laboratorio». `cuenta` es cuántos pedidos usa cada nombre.
export function gruposDeParecidos(nombres = [], cuenta = new Map()) {
  const unicos = [...new Set(nombres.map((n) => String(n ?? "").trim()).filter(Boolean))]
  const parecidos = (a, b) => {
    const x = nucleo(a), y = nucleo(b)
    return x === y || (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x)))
  }
  const grupos = []
  for (const n of unicos) {
    const g = grupos.find((grupo) => grupo.some((m) => parecidos(m, n)))
    if (g) g.push(n)
    else grupos.push([n])
  }
  return grupos.filter((g) => g.length > 1).map((g) => g.slice().sort((a, b) => (cuenta.get(b) || 0) - (cuenta.get(a) || 0) || a.length - b.length))
}
