// Estado de pantalla guardado en la URL: recargar la página deja al usuario donde estaba, y "atrás" vuelve a donde estaba antes.
// Dashboard guarda la sección (?seccion=); aquí viven los detalles de cada sección (pestaña, paciente abierto, ficha).
import { useCallback, useState } from "react"

// Parámetros que pertenecen a una sección: Dashboard los quita al cambiar de sección para que no viajen a otra.
export const PARAMS_DE_SECCION = ["tab", "paciente", "ficha", "fcita"]

export function leerParam(clave) {
  try { return new URLSearchParams(window.location.search).get(clave) } catch { return null }
}

// Cambia un parámetro sin recargar. `empujar` crea una entrada nueva en el historial (para que "atrás" vuelva a la pantalla
// anterior); sin ella se reemplaza la entrada actual (pestañas y filtros no llenan el historial).
export function escribirParam(clave, valor, { empujar = false, estado } = {}) {
  try {
    const params = new URLSearchParams(window.location.search)
    if (valor == null || valor === "") params.delete(clave)
    else params.set(clave, valor)
    const url = `${window.location.pathname}?${params}`
    if (url === `${window.location.pathname}${window.location.search}`) return
    const nuevo = { ...(window.history.state || {}), ...(estado || {}) }
    if (empujar) window.history.pushState(nuevo, "", url)
    else window.history.replaceState(nuevo, "", url)
  } catch { /* sin historial (pruebas): se ignora */ }
}

// Como useState, pero el valor sobrevive a una recarga: se lee de ?clave= al montar y se escribe al cambiar.
// `validos` evita que un valor viejo o inventado en la URL deje una pestaña inexistente.
export function useParamUrl(clave, defecto, validos) {
  const [valor, setValor] = useState(() => {
    const guardado = leerParam(clave)
    return guardado && (!validos || validos.includes(guardado)) ? guardado : defecto
  })
  const cambiar = useCallback((nuevo) => {
    setValor(nuevo)
    escribirParam(clave, nuevo === defecto ? null : nuevo)
  }, [clave, defecto])
  return [valor, cambiar]
}
