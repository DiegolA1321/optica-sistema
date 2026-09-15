"use client"

import { useEffect, useRef, useState } from "react"
import { MonitorX, ZoomIn } from "lucide-react"
import { INK } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Guard global sin excepciones: cubre TODO el árbol de la app (landing,
// login, agendar cita pública, portal del paciente, dashboard, superadmin).
// Los umbrales son deliberadamente extremos — no "un poco chico", sino
// genuinamente ilegible/deformado — porque acá ya no hay una pantalla
// "pensada para escritorio" que justifique un límite más alto: cualquier
// dispositivo que entre debe pasar por el mismo filtro.
const ANCHO_MINIMO = 950
const ALTO_MINIMO = 520
const ZOOM_MINIMO = 65
const ZOOM_MAXIMO = 150

// zoomLevel combina dos señales porque ninguna es 100% confiable sola:
//
// 1) outerWidth/innerWidth — outerWidth es el tamaño físico real de la
//    ventana del navegador (no cambia con el zoom del contenido) mientras
//    que innerWidth es el viewport en píxeles CSS, que sí se expande o
//    contrae con el zoom. A 100% esa relación ronda 100% sin importar el
//    tamaño de la ventana; solo se aleja cuando el zoom en sí cambia. Pero
//    un navegador de escritorio real nunca crea una ventana de menos de
//    ~200px de ancho — si outerWidth reporta menos que eso (pasa en
//    automatización, ciertas sesiones de escritorio remoto/VM, o
//    navegadores en kiosko), no es una medida real y se descarta para no
//    arriesgar un falso positivo que bloquee el sistema entero.
// 2) devicePixelRatio relativo a una línea base capturada al cargar la
//    página — sirve de respaldo exactamente cuando (1) no es confiable:
//    Chrome/Edge multiplican devicePixelRatio junto con el zoom de página,
//    así que compararlo contra su propio valor inicial (asumido 100%,
//    momento en que la app arranca) detecta el mismo cambio de zoom sin
//    depender de outerWidth.
const OUTER_WIDTH_PLAUSIBLE_MIN = 200
const DPR_BASE = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1

// Debounce del listener de resize — abrir/cerrar el panel de DevTools
// (Network, Console) dispara una ráfaga de eventos "resize" mientras el
// panel anima su tamaño; sin esto, el overlay parpadea a mitad de esa
// animación aunque el tamaño final sea perfectamente usable.
const DEBOUNCE_MS = 300

function medirVentana() {
  const width = window.innerWidth
  const height = window.innerHeight
  const outerWidth = window.outerWidth
  const outerWidthConfiable = outerWidth >= OUTER_WIDTH_PLAUSIBLE_MIN
  const zoomPorVentana = outerWidthConfiable && width > 0 ? Math.round((outerWidth / width) * 100) : null
  const zoomPorDPR = Math.round(((window.devicePixelRatio || 1) / DPR_BASE) * 100)
  const zoomLevel = zoomPorVentana ?? zoomPorDPR
  return { width, height, zoomLevel }
}

function useDimensionesVentana() {
  const [dims, setDims] = useState(medirVentana)
  const timeoutRef = useRef(null)
  useEffect(() => {
    const alRedimensionar = () => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setDims(medirVentana()), DEBOUNCE_MS)
    }
    window.addEventListener("resize", alRedimensionar)
    return () => {
      window.removeEventListener("resize", alRedimensionar)
      clearTimeout(timeoutRef.current)
    }
  }, [])
  return dims
}

// Envuelve el árbol completo de la app (ver App.jsx) sin desmontarlo nunca —
// el bloqueo es un overlay a pantalla completa que aparece u desaparece
// encima según el tamaño de ventana/zoom. Si alguien tenía un formulario a
// medio llenar y el navegador hizo zoom sin querer, el trabajo sigue intacto
// debajo al volver a un nivel soportado.
export default function ResolutionGuard({
  children,
  minWidth = ANCHO_MINIMO,
  minHeight = ALTO_MINIMO,
  zoomMin = ZOOM_MINIMO,
  zoomMax = ZOOM_MAXIMO,
}) {
  const { width, height, zoomLevel } = useDimensionesVentana()
  const bloqueado = zoomLevel < zoomMin || zoomLevel > zoomMax || width < minWidth || height < minHeight

  return (
    <>
      {children}
      {bloqueado && (
        <div
          role="alert"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ backgroundColor: "rgba(15,23,42,0.9)" }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div
              className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl text-white"
              style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.5)" }}
            >
              <MonitorX size={30} />
            </div>
            <h1 className="font-serif text-2xl font-bold" style={{ color: INK }}>
              Nivel de Zoom No Soportado
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              El nivel de zoom actual ({zoomLevel}%) deforma la interfaz visual. Para continuar navegando, por favor
              restablece el zoom.
            </p>
            <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-blue-50 p-4 text-left">
              <ZoomIn size={16} className="mt-0.5 shrink-0 text-blue-600" />
              <p className="text-xs leading-relaxed text-blue-800">
                <span className="font-semibold">Sugerencia:</span> Presiona{" "}
                <span className="font-semibold">CTRL + 0</span> en tu teclado para restablecer el zoom al 100% de
                forma inmediata.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
