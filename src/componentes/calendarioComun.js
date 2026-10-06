import { useLayoutEffect, useState } from "react"

// Piezas que comparten las vistas Semana y Mes de Citas.

// Mismos colores de estado que la lista de citas: línea a la izquierda y
// fondo suave. Cualquier estado desconocido se trata como pendiente.
const COLOR_ESTADO = {
  "En Atención": { linea: "#2563eb", fondo: "#eff6ff" },
  Atendida: { linea: "#10b981", fondo: "#ecfdf5" },
  "No Asistió": { linea: "#ef4444", fondo: "#fef2f2" },
  Cancelada: { linea: "#94a3b8", fondo: "#f8fafc" },
}
const COLOR_PENDIENTE = { linea: "#f59e0b", fondo: "#fffbeb" }
export const colorDe = (estado) => COLOR_ESTADO[estado] || COLOR_PENDIENTE

// Alto que le queda al calendario: desde donde empieza hasta el borde inferior
// del área con scroll de la página (menos su relleno), con un mínimo para que
// siga siendo usable en pantallas bajas. Devuelve [refDelContenedor, alto]; el
// alto se recalcula al cambiar el tamaño de la ventana o de lo que hay encima
// (avisos, tarjetas, filtros).
export function useAlturaDisponible(ref, minimo = 380) {
  const [alto, setAlto] = useState(minimo)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let sc = el.parentElement
    while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
    if (!sc || sc === document.body) sc = document.documentElement
    const medir = () => {
      const estilo = getComputedStyle(sc)
      const relleno = parseFloat(estilo.paddingBottom) || 0
      const alturaVisible = sc === document.documentElement ? window.innerHeight : sc.clientHeight
      const arriba = el.getBoundingClientRect().top - (sc === document.documentElement ? 0 : sc.getBoundingClientRect().top) + (sc === document.documentElement ? window.scrollY : sc.scrollTop)
      const h = Math.max(minimo, Math.floor(alturaVisible - arriba - relleno))
      setAlto((a) => (a === h ? a : h))
    }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(sc)
    if (el.parentElement) obs.observe(el.parentElement)
    window.addEventListener("resize", medir)
    return () => { obs.disconnect(); window.removeEventListener("resize", medir) }
  }, [ref, minimo])
  return alto
}
