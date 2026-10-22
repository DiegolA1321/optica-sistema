// Hoja de conteo: la hoja que se imprime para contar en el estante. Lógica pura: arma el HTML que se imprime o se guarda como PDF.
// Trae todos los productos activos con su código, su descripción y la existencia que dice el sistema, y una columna en blanco para escribir lo contado (reunión del 20 oct.: el conteo físico
// se reemplaza por esta hoja). Las diferencias se corrigen producto por producto con «Ajustar stock», que deja su motivo en el historial.
import { escapar } from "./proforma"
import { formatoFecha } from "./formatoFecha"

const ESTILO = `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0E2B33;margin:28px;font-size:13px}
h1{font-size:19px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:18px 0 6px}
p{margin:3px 0}table{border-collapse:collapse;width:100%}th,td{padding:7px 10px;border:1px solid #cbd5e1;text-align:left}
th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}td.n,th.n{text-align:right;white-space:nowrap}
.firma{display:flex;gap:40px;margin-top:46px}.firma div{flex:1;border-top:1px solid #64748b;padding-top:4px;font-size:12px;color:#475569}
.contado{width:110px}.codigo{width:110px}.sec{page-break-inside:avoid}tr{page-break-inside:avoid}.nota{color:#475569;font-size:12px}`

// Los productos activos por categoría y orden alfabético, cada uno con una celda vacía para lo contado.
export function htmlHojaConteo({ opticaNombre = "", productos = [], fecha = new Date() }) {
  const grupos = new Map()
  for (const p of [...productos].sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "", "es") || (a.nombre || "").localeCompare(b.nombre || "", "es"))) {
    const c = p.categoria || "Sin categoría"
    if (!grupos.has(c)) grupos.set(c, [])
    grupos.get(c).push(p)
  }
  const secciones = [...grupos.entries()].map(([categoria, lista]) => `<div class="sec"><h2>${escapar(categoria)} · ${lista.length} producto${lista.length === 1 ? "" : "s"}</h2>
<table><thead><tr><th class="codigo">Código</th><th>Descripción</th><th class="n">En el sistema</th><th class="contado n">Contado</th></tr></thead><tbody>
${lista.map((p) => `<tr><td>${escapar(p.codigo || "")}</td><td>${escapar(p.nombre)}</td><td class="n">${escapar(Number(p.stock) || 0)}</td><td></td></tr>`).join("")}</tbody></table></div>`).join("")
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de conteo</title><style>${ESTILO}</style></head><body>
<h1>${escapar(opticaNombre)}</h1>
<p>Hoja de conteo · ${escapar(formatoFecha(fecha, "largo"))} · ${productos.length} producto${productos.length === 1 ? "" : "s"} activo${productos.length === 1 ? "" : "s"}</p>
<p>Contado por: ______________________________ &nbsp;&nbsp; Fecha del conteo: ____ / ____ / ________</p>
<p class="nota">Escribe lo que cuentes en la última columna. Las diferencias se corrigen en el sistema con «Ajustar stock».</p>
${productos.length === 0 ? "<p>No hay productos para contar.</p>" : secciones}
<div class="firma"><div>Contó</div><div>Revisó</div></div>
</body></html>`
}
