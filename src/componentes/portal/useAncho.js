import { useEffect, useLayoutEffect, useState } from "react"

// ¿Se cumple esta consulta de pantalla (por ejemplo «(min-width: 640px)»)? Sin `matchMedia` (pruebas) vale `inicial`, que es la versión ancha.
export function useConsulta(consulta, inicial = true) {
  const leer = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(consulta).matches : inicial)
  const [cumple, setCumple] = useState(leer)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined
    const m = window.matchMedia(consulta)
    const cambio = () => setCumple(m.matches)
    cambio()
    m.addEventListener("change", cambio)
    return () => m.removeEventListener("change", cambio)
  }, [consulta])
  return cumple
}
// El portal tiene una versión de celular (390 px) y otra ancha: el celular es todo lo que mide menos de 640 px.
export const useCelular = () => !useConsulta("(min-width: 640px)", true)

// El ancho de un elemento (la tarjeta responde a su propio ancho y no al de la ventana). Sin ResizeObserver (pruebas) devuelve 0.
export function useAnchoDe(ref) {
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setAncho(Math.floor(el.getBoundingClientRect().width))
    medir()
    if (typeof ResizeObserver === "undefined") return undefined
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return ancho
}
