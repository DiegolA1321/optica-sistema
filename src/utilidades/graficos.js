import { useCallback, useRef, useState } from "react"

// Mide el ancho real en píxeles de un elemento (vía ResizeObserver) para
// poder usarlo como ancho del viewBox de un gráfico SVG. Evita el bug de
// "se ve estirado/borroso": si el viewBox no coincide con el ancho real
// renderizado, preserveAspectRatio="none" deforma todo de forma no uniforme
// (líneas y círculos dejan de verse nítidos), y quitar ese atributo con un
// viewBox fijo deja franjas vacías o hace crecer la altura sin control. La
// solución real de cualquier librería de gráficos: el viewBox sigue al
// tamaño real del contenedor, nunca al revés.
//
// Ref-callback en vez de useRef + un useEffect de montaje: los gráficos que
// usan este hook (Resumen del superadmin, Reportes) muestran primero un
// estado "aún no hay datos" mientras la consulta a Supabase resuelve, y solo
// cuando llegan datos aparece el <div> real con este ref. Con un useEffect
// de dependencias [] ese primer intento de observer.observe() se topaba con
// ref.current === null (el <div> real todavía no existía), se rendía ahí
// mismo y nunca reintentaba — el gráfico quedaba pegado al ancho por
// defecto (460) para siempre aunque el contenedor real midiera otra cosa,
// y preserveAspectRatio="none" estiraba todo de forma no uniforme para
// llenar ese ancho real. Un ref-callback no tiene ese problema: React lo
// llama cada vez que el nodo cambia, incluida la primera vez que el <div>
// real reemplaza al mensaje de "sin datos", así que el observer se conecta
// en el momento correcto sin importar cuándo lleguen los datos.
export function useAnchoElemento(anchoInicial = 460) {
  const [ancho, setAncho] = useState(anchoInicial)
  const observerRef = useRef(null)
  const ref = useCallback((el) => {
    observerRef.current?.disconnect()
    if (!el) return
    // Medición síncrona apenas el nodo existe — no depende de que
    // ResizeObserver llegue a disparar su primer callback (algunos entornos
    // lo demoran o no lo disparan de entrada), así el ancho ya es correcto
    // desde el primer render con datos reales. El observer queda armado para
    // los cambios posteriores (redimensionar la ventana, colapsar el menú).
    const w = el.getBoundingClientRect().width
    if (w) setAncho(w)
    observerRef.current = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect?.width
      if (w) setAncho(w)
    })
    observerRef.current.observe(el)
  }, [])
  return [ref, ancho]
}
