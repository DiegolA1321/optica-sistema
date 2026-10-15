// Conteo físico: la hoja en blanco para contar en el estante y el acta del conteo. Lógica pura: arma el HTML que se imprime o se guarda como PDF.
// La hoja NO trae lo que dice el sistema (el conteo es a ciegas). El acta trae fecha, quién contó, los productos con diferencia y su valor en dinero.
import { escapar } from "./proforma"
import { dinero } from "./formatoMoneda"
import { formatoFecha, fechaHoraLegible } from "./formatoFecha"

const ESTILO = `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0E2B33;margin:28px;font-size:13px}
h1{font-size:19px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:18px 0 6px}
p{margin:3px 0}table{border-collapse:collapse;width:100%}th,td{padding:7px 10px;border:1px solid #cbd5e1;text-align:left}
th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}td.n,th.n{text-align:right;white-space:nowrap}
.firma{display:flex;gap:40px;margin-top:46px}.firma div{flex:1;border-top:1px solid #64748b;padding-top:4px;font-size:12px;color:#475569}
.contado{width:90px}.nota{width:160px}.resumen{display:flex;gap:18px;flex-wrap:wrap;margin:12px 0}.resumen div{border:1px solid #cbd5e1;border-radius:6px;padding:8px 14px}
.resumen b{display:block;font-size:17px}.mas{color:#047857}.menos{color:#b91c1c}.sec{page-break-inside:avoid}tr{page-break-inside:avoid}`

const signo = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
const dineroConSigno = (n) => (n < 0 ? `−${dinero(Math.abs(n))}` : dinero(n))

// La hoja en blanco: los productos activos por categoría, con una celda vacía para escribir lo contado. Sin existencias del sistema.
export function htmlHojaConteo({ opticaNombre = "", productos = [], fecha = new Date() }) {
  const grupos = new Map()
  for (const p of [...productos].sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "", "es") || (a.nombre || "").localeCompare(b.nombre || "", "es"))) {
    const c = p.categoria || "Sin categoría"
    if (!grupos.has(c)) grupos.set(c, [])
    grupos.get(c).push(p)
  }
  const secciones = [...grupos.entries()].map(([categoria, lista]) => `<div class="sec"><h2>${escapar(categoria)} · ${lista.length} producto${lista.length === 1 ? "" : "s"}</h2>
<table><thead><tr><th>Producto</th><th>Código</th><th class="contado n">Contado</th><th class="nota">Nota</th></tr></thead><tbody>
${lista.map((p) => `<tr><td>${escapar(p.nombre)}</td><td>${escapar(p.codigo || "")}</td><td></td><td></td></tr>`).join("")}</tbody></table></div>`).join("")
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de conteo físico</title><style>${ESTILO}</style></head><body>
<h1>${escapar(opticaNombre)}</h1>
<p>Hoja de conteo físico · ${escapar(formatoFecha(fecha, "largo"))}</p>
<p>Contado por: ______________________________ &nbsp;&nbsp; Fecha del conteo: ____ / ____ / ________</p>
${productos.length === 0 ? "<p>No hay productos para contar.</p>" : secciones}
<div class="firma"><div>Contó</div><div>Revisó</div></div>
</body></html>`
}

// El acta de un conteo ya registrado: quién y cuándo, cuántos productos, los que tenían diferencia y lo que valen esas diferencias.
// `acta`: { creadoEn, usuarioNombre, contados, iguales, sobrantes, faltantes, valorPrecio, valorCosto, detalle: [{ nombre, categoria, antes, contado, diferencia, precio, costo }] }
export function htmlActaConteo({ opticaNombre = "", acta }) {
  const filas = (acta.detalle || []).map((d) => `<tr><td>${escapar(d.nombre)}</td><td>${escapar(d.categoria || "")}</td><td class="n">${escapar(d.antes)}</td><td class="n">${escapar(d.contado)}</td>
<td class="n ${d.diferencia > 0 ? "mas" : "menos"}">${escapar(signo(d.diferencia))}</td><td class="n ${d.diferencia > 0 ? "mas" : "menos"}">${escapar(dineroConSigno((Number(d.diferencia) || 0) * (Number(d.precio) || 0)))}</td>${acta.valorCosto != null ? `<td class="n">${d.costo == null ? "—" : escapar(dineroConSigno((Number(d.diferencia) || 0) * Number(d.costo)))}</td>` : ""}</tr>`).join("")
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta de conteo físico</title><style>${ESTILO}</style></head><body>
<h1>${escapar(opticaNombre)}</h1>
<p>Acta de conteo físico · ${escapar(fechaHoraLegible(acta.creadoEn, { anio: true }))}</p>
<p>Contó: <b>${escapar(acta.usuarioNombre || "—")}</b></p>
<div class="resumen">
<div><b>${escapar(acta.contados)}</b>productos contados</div>
<div><b>${escapar(acta.contados - acta.iguales)}</b>con diferencia</div>
<div><b>${escapar(acta.sobrantes)} / ${escapar(acta.faltantes)}</b>unidades que sobran / faltan</div>
<div><b class="${acta.valorPrecio < 0 ? "menos" : "mas"}">${escapar(dineroConSigno(acta.valorPrecio))}</b>valor de la diferencia a precio de venta</div>
${acta.valorCosto != null ? `<div><b class="${acta.valorCosto < 0 ? "menos" : "mas"}">${escapar(dineroConSigno(acta.valorCosto))}</b>valor de la diferencia a costo</div>` : ""}
</div>
${filas
    ? `<h2>Productos con diferencia</h2><table><thead><tr><th>Producto</th><th>Categoría</th><th class="n">Sistema</th><th class="n">Contado</th><th class="n">Diferencia</th><th class="n">Valor (precio)</th>${acta.valorCosto != null ? '<th class="n">Valor (costo)</th>' : ""}</tr></thead><tbody>${filas}</tbody></table>`
    : "<p>Lo contado coincide con el sistema: no hubo diferencias.</p>"}
<p style="margin-top:10px;color:#475569;font-size:12px">Las diferencias quedaron registradas como ajustes por conteo con el motivo «Conteo físico».</p>
<div class="firma"><div>Contó</div><div>Revisó</div></div>
</body></html>`
}

// Una fila de `conteos_inventario` con los nombres de la aplicación.
export const mapActa = (r) => ({
  id: r.id, creadoEn: r.created_at, usuarioNombre: r.usuario_nombre || "", contados: Number(r.productos_contados) || 0, iguales: Number(r.productos_iguales) || 0,
  sobrantes: Number(r.unidades_sobrantes) || 0, faltantes: Number(r.unidades_faltantes) || 0, valorPrecio: Number(r.valor_precio) || 0,
  valorCosto: r.valor_costo == null ? null : Number(r.valor_costo),
  detalle: (Array.isArray(r.detalle) ? r.detalle : []).map((d) => ({ productoId: d.producto_id, nombre: d.nombre, categoria: d.categoria, antes: Number(d.antes) || 0, contado: Number(d.contado) || 0, diferencia: Number(d.diferencia) || 0, precio: Number(d.precio) || 0, costo: d.costo == null ? null : Number(d.costo) })),
})
