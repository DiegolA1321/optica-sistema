"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { INK } from "@/lib/tema"

// Cuánto dura un aviso de guardado en pantalla (un solo número para todo el sistema).
export const DURACION_AVISO_MS = 3000

// Un aviso que no dice «listo» sino que algo no salió: lleva el ícono de alerta en vez del de confirmación.
const ES_ERROR = /\b(no se pudo|no pudo|no puedes|no puede|no tienes|no hay conexi|error|fall[óo]|rechaz|inv[aá]lid|necesitas|debes)\b/i
export const tipoDeAviso = (texto) => (ES_ERROR.test(String(texto ?? "")) ? "error" : "exito")

// El mensaje flotante de todo el sistema: arriba, centrado, encima del contenido (no mueve nada), del ancho justo de su texto y con su ícono.
// `tipo` es «exito» o «error» (si no se da, se deduce del texto); `accion` ({ etiqueta, onClick }) es opcional (p. ej. «Deshacer»).
export default function AvisoFlotante({ texto, tipo, accion, saliendo = false }) {
  const t = tipo || tipoDeAviso(texto)
  const Icono = t === "error" ? AlertCircle : CheckCircle2
  return (
    <div role={t === "error" ? "alert" : "status"} data-aviso-flotante
      className="fixed left-1/2 top-4 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-xl border bg-white px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.16)]"
      style={{ borderColor: t === "error" ? "#FECDD3" : "#A7F3D0", animation: saliendo ? "rise-out 180ms cubic-bezier(0.4,0,1,1) both" : "rise-in 220ms cubic-bezier(0.16,1,0.3,1) both" }}>
      <Icono size={18} aria-hidden="true" className={"shrink-0 " + (t === "error" ? "text-rose-500" : "text-emerald-500")} />
      <p className="text-sm font-semibold" style={{ color: INK }}>{texto}</p>
      {accion && (
        <button type="button" onClick={accion.onClick} className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">{accion.etiqueta}</button>
      )}
    </div>
  )
}

// Muestra un aviso y lo quita solo a los 3 segundos: `const [aviso, avisar] = useAvisoTemporal()`; `avisar("Guardado.")` (o `avisar(null)` para quitarlo).
export function useAvisoTemporal(ms = DURACION_AVISO_MS) {
  const [aviso, setAviso] = useState(null)
  const reloj = useRef(null)
  const avisar = useCallback((valor) => {
    setAviso(valor || null)
    clearTimeout(reloj.current)
    if (valor) reloj.current = setTimeout(() => setAviso(null), ms)
  }, [ms])
  useEffect(() => () => clearTimeout(reloj.current), [])
  return [aviso, avisar]
}
