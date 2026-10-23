"use client"

import { useMemo, useRef, useState } from "react"
import { crearEscribirPorWhatsApp } from "./EscribirPorWhatsApp"
import ContactarModal from "./ContactarModal"

// Todo lo que hace falta para que el sistema contacte con UNA sola ventana: la función `escribir` (para el contexto de EscribirPorWhatsApp) y la ventana ya dibujada (`ventana`, para ponerla en la pantalla).
// Lo usa el Dashboard; una prueba que monte un módulo solo lo usa igual.
export function useContactar({ plantillas, opticaNombre, opticaTelefono, consultas, contactarDeAviso, contactarManual, avisar }) {
  const [pedido, setPedido] = useState(null)
  const avisarRef = useRef(avisar)
  avisarRef.current = avisar
  const escribir = useMemo(
    () => crearEscribirPorWhatsApp({ plantillas, opticaNombre, opticaTelefono, consultas, contactarDeAviso, contactarManual, avisar: (m) => avisarRef.current?.(m), pedirVentana: setPedido }),
    [plantillas, opticaNombre, opticaTelefono, consultas, contactarDeAviso, contactarManual],
  )
  const ventana = pedido ? <ContactarModal {...pedido} onCerrar={() => setPedido(null)} /> : null
  return { escribir, ventana }
}
