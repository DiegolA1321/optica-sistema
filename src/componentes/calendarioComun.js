import { useLayoutEffect, useState } from "react"

// Piezas que comparten las vistas Semana y Mes de Citas.

// Mismos estados que la lista de citas, con colores de relleno más firmes para
// que el calendario se lea por color de un vistazo: línea sólida a la izquierda,
// fondo pastel y texto oscuro del mismo tono. Un estado desconocido cuenta como
// pendiente.
const COLOR_ESTADO = {
  "En Atención": { linea: "#2563eb", fondo: "#dbeafe", texto: "#1e3a8a", etiqueta: "En atención" },
  Atendida: { linea: "#059669", fondo: "#bbf7d0", texto: "#064e3b", etiqueta: "Atendida" },
  "No Asistió": { linea: "#dc2626", fondo: "#fecaca", texto: "#7f1d1d", etiqueta: "No asistió" },
  Cancelada: { linea: "#94a3b8", fondo: "#e2e8f0", texto: "#475569", etiqueta: "Cancelada" },
}
const COLOR_PENDIENTE = { linea: "#d97706", fondo: "#fde68a", texto: "#78350f", etiqueta: "Pendiente" }
export const colorDe = (estado) => COLOR_ESTADO[estado] || COLOR_PENDIENTE
// Leyenda que se muestra en el encabezado de Semana y Mes.
export const LEYENDA_ESTADOS = [COLOR_PENDIENTE, COLOR_ESTADO["En Atención"], COLOR_ESTADO.Atendida, COLOR_ESTADO["No Asistió"]]

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
