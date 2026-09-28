import { useEffect, useRef } from "react"

const SELECTOR_ENFOCABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Accesibilidad compartida para los modales "hand-rolled" del sistema
// (overlay fijo + createPortal + animación overlay-in/modal-in) — extraído
// del patrón de cierre por Escape que ya funcionaba en ConsultaMedica.jsx y
// ConfirmarCitaModal.jsx, más foco atrapado y devolución de foco al cerrar,
// que no existían en ningún modal todavía (audit UX, Lote 1, punto 1c).
//
// Uso: cada modal sigue siendo dueño de su propio diseño, animación y
// "cerrar al hacer click en el backdrop" — este hook solo agrega teclado y
// foco sobre el contenedor que ya tienen, nunca cambia qué se renderiza.
//
//   const refModal = useModalAccesible(mostrarModal, onCerrar)
//   ...
//   <div ref={refModal} role="dialog" aria-modal="true" aria-labelledby="...">
//
// `abierto` existe porque la mayoría de los modales del sistema no son
// componentes aparte que se montan/desmontan solos — son un bloque
// `{condicion && (<div>...)}` dentro del render de una pantalla mucho más
// grande (Citas.jsx, Pacientes.jsx, etc.), así que el propio hook, llamado
// sin condicionales de React (regla de los hooks), necesita saber cuándo
// "este modal en particular" está realmente abierto para no robar foco ni
// escuchar Escape de fondo todo el tiempo que la pantalla esté montada.
//
// `onCerrar` se guarda en un ref interno en vez de ir en el array de
// dependencias del efecto: casi todos los llamadores pasan un arrow
// function inline (`onClick={() => setX(null)}` repetido como prop), que
// cambia de identidad en cada render del padre — si el efecto dependiera de
// esa referencia, se desmontaría y volvería a montar (incluido el robo de
// foco inicial) en cada re-render ajeno del dueño del modal, no solo al
// abrir/cerrar.
export function useModalAccesible(abierto, onCerrar) {
  const refModal = useRef(null)
  const refCerrar = useRef(onCerrar)
  refCerrar.current = onCerrar

  useEffect(() => {
    if (!abierto) return
    const elementoPrevio = document.activeElement

    const enfocarPrimerElemento = () => {
      const contenedor = refModal.current
      const primero = contenedor?.querySelector(SELECTOR_ENFOCABLE)
      ;(primero || contenedor)?.focus?.()
    }
    // El contenido a veces llega un tick después (createPortal + estado
    // recién montado) — sin este pequeño delay, el primer intento de foco
    // caía antes de que hubiera algo enfocable en el DOM.
    const idTimeout = setTimeout(enfocarPrimerElemento, 0)

    const alTeclado = (e) => {
      if (e.key === "Escape") {
        refCerrar.current?.()
        return
      }
      if (e.key !== "Tab") return
      const contenedor = refModal.current
      if (!contenedor) return
      const enfocables = [...contenedor.querySelectorAll(SELECTOR_ENFOCABLE)].filter((el) => el.offsetParent !== null)
      if (enfocables.length === 0) return
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener("keydown", alTeclado)

    return () => {
      clearTimeout(idTimeout)
      document.removeEventListener("keydown", alTeclado)
      // Si el elemento que abrió el modal ya no está en el DOM (ej. la fila
      // de una tabla que se volvió a renderizar), simplemente no hace nada.
      elementoPrevio?.focus?.()
    }
  }, [abierto])

  return refModal
}
