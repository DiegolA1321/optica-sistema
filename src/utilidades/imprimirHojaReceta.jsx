// Imprime la hoja de la receta (`HojaReceta`): la monta en una capa pegada al <body>, oculta todo lo demás mientras dura la impresión y la quita al terminar. El mismo camino
// para el optómetra (al terminar la consulta y en «Imprimir receta» del perfil) y para el paciente («Descargar receta» del portal: en el diálogo de impresión elige «Guardar como PDF»).
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import HojaReceta from "../componentes/HojaReceta"

const CLASE = "imprimiendo-hoja-receta"
const ESTILO = `@page { margin: 1.4cm; } #print-hoja-receta { display: none; } @media print { body.${CLASE} > *:not(#print-hoja-receta) { display: none !important; } body.${CLASE} #print-hoja-receta { display: block !important; } #print-hoja-receta, #print-hoja-receta * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`

export function imprimirHojaReceta(datos) {
  document.getElementById("print-hoja-receta")?.remove()
  const capa = document.createElement("div")
  capa.id = "print-hoja-receta"
  const estilo = document.createElement("style")
  estilo.textContent = ESTILO
  capa.appendChild(estilo)
  const hoja = document.createElement("div")
  capa.appendChild(hoja)
  document.body.appendChild(capa)
  const raiz = createRoot(hoja)
  flushSync(() => raiz.render(<HojaReceta {...datos} />))
  document.body.classList.add(CLASE)
  let limpia = false
  const limpiar = () => {
    if (limpia) return
    limpia = true
    document.body.classList.remove(CLASE)
    raiz.unmount()
    capa.remove()
  }
  window.addEventListener("afterprint", limpiar, { once: true })
  window.print()
  setTimeout(limpiar, 60000)
}
