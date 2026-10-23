// Reporte del período en PDF: la pestaña que se está viendo, con el período y los filtros en el encabezado. Se imprime solo el
// reporte (no la barra lateral ni los botones) y el navegador lo guarda como PDF desde "Imprimir".
import { imprimirDocumento, estilosImpresion } from "./imprimir"
import { formatoFecha, horaSinCero } from "./formatoFecha"
import { ahoraEcuador } from "./horaEcuador"

const CLASE = "printing-reporte"
const ID_TEMPORAL = "reporte-pdf-temporal"

const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

// Arma el encabezado del reporte (puro, para poder probarlo).
export function encabezadoPdf({ opticaNombre, pestana, rango, filtros, usuarioNombre, ahora = ahoraEcuador() }) {
  return {
    optica: opticaNombre || "Óptica",
    titulo: `Reporte de ${pestana}`,
    periodo: `Período: ${formatoFecha(rango.inicio, "medio")} a ${formatoFecha(rango.fin, "medio")}`,
    filtros: `Filtros: ${filtros || "ninguno"}`,
    generado: `Generado: ${formatoFecha(ahora, "medio")}, ${horaSinCero(ahora)} · por ${usuarioNombre || "Usuario"}`,
  }
}

export function imprimirReporte({ panelId, ...datos }) {
  const panel = document.getElementById(panelId)
  if (!panel) return false
  const e = encabezadoPdf(datos)
  if (!document.getElementById("estilo-reporte-pdf")) {
    const estilo = document.createElement("style")
    estilo.id = "estilo-reporte-pdf"
    estilo.textContent = estilosImpresion(CLASE)
    document.head.appendChild(estilo)
  }
  const previo = document.getElementById(ID_TEMPORAL)
  if (previo) previo.remove()
  const temporal = document.createElement("div")
  temporal.id = ID_TEMPORAL
  temporal.style.cssText = "position:fixed;left:-99999px;top:0;width:900px"
  temporal.innerHTML = `<div style="font-family:system-ui,sans-serif;margin-bottom:12px;border-bottom:1px solid #cbd5e1;padding-bottom:8px">
    <div style="font-size:18px;font-weight:700;color:#0E2B33">${escapar(e.optica)}</div>
    <div style="font-size:15px;font-weight:600;color:#0E2B33">${escapar(e.titulo)}</div>
    <div style="font-size:12px;color:#475569">${escapar(e.periodo)}</div>
    <div style="font-size:12px;color:#475569">${escapar(e.filtros)}</div>
    <div style="font-size:12px;color:#475569">${escapar(e.generado)}</div></div>`
  temporal.appendChild(panel.cloneNode(true))
  document.body.appendChild(temporal)
  imprimirDocumento(ID_TEMPORAL, CLASE)
  setTimeout(() => temporal.remove(), 2000)
  return true
}
