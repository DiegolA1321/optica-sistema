import { useEffect, useRef, useState } from "react"

// Mide el ancho real en píxeles de un elemento (vía ResizeObserver) para
// poder usarlo como ancho del viewBox de un gráfico SVG. Evita el bug de
// "se ve estirado/borroso": si el viewBox no coincide con el ancho real
// renderizado, preserveAspectRatio="none" deforma todo de forma no uniforme
// (líneas y círculos dejan de verse nítidos), y quitar ese atributo con un
// viewBox fijo deja franjas vacías o hace crecer la altura sin control. La
// solución real de cualquier librería de gráficos: el viewBox sigue al
// tamaño real del contenedor, nunca al revés.
export function useAnchoElemento(anchoInicial = 460) {
  const ref = useRef(null)
  const [ancho, setAncho] = useState(anchoInicial)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const observer = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect?.width
      if (w) setAncho(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, ancho]
}
