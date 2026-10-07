// Proforma de venta (R35): un presupuesto para imprimir y entregar. No se guarda
// como documento (el pase solo anota cuándo se entregó y por cuánto) y NO es una
// factura: no descuenta stock, no tiene forma de pago ni numeración y no cierra
// el pase. Lógica pura que arma el HTML; imprimirHtml lo manda a la impresora.
import { fechaLegible } from "./formatoFecha"
import { lineaLunaDeTexto } from "./comprobantes"
import { costoBaseMotivo } from "./costosConsulta"
import { textoDiagnostico } from "./pasesVenta"

// Líneas con las que arranca la proforma de una consulta: la consulta (costo base
// del motivo, editable) y la luna como texto libre con su precio por llenar (R57-R59:
// las lunas no son productos con stock). La montura se elige del inventario.
export function lineasProformaDeConsulta(consulta, parametrizacion) {
  const lente = (consulta?.lenteRecomendado || "").trim()
  return [
    { tipo: "servicio", descripcion: `Consulta${consulta?.motivo ? ` — ${consulta.motivo}` : ""}`, cantidad: 1, precioUnitario: costoBaseMotivo(parametrizacion, consulta?.motivo) },
    lineaLunaDeTexto(lente),
  ]
}

export const VIGENCIA_PROFORMA_DIAS = 15

// Datos de la óptica que salen en la proforma (viven en la parametrización).
export function datosOpticaProforma(parametrizacion) {
  const texto = (v) => (typeof v === "string" ? v.trim() : "")
  const dias = Math.round(Number(parametrizacion?.vigenciaProformaDias))
  return {
    direccion: texto(parametrizacion?.opticaDireccion),
    telefono: texto(parametrizacion?.opticaTelefono),
    ruc: texto(parametrizacion?.opticaRuc),
    vigenciaDias: Number.isFinite(dias) && dias > 0 ? dias : VIGENCIA_PROFORMA_DIAS,
  }
}

const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const dinero = (n) => `$${(Number(n) || 0).toFixed(2)}`
const medida = (o) => (o && (o.esfera || o.cilindro || o.eje) ? `${o.esfera || "—"} | ${o.cilindro || "—"} | ${o.eje || "—"}°` : "No registrada")

// datos: { opticaNombre, paciente: { nombre, cedula }, diagnostico: {...consulta}, lineas: [{ descripcion, cantidad, precioUnitario }], incluirMedidas, fecha }
export function armarHtmlProforma({ opticaNombre = "Óptica", opticaDatos = {}, paciente = {}, diagnostico = null, lineas = [], incluirMedidas = false, fecha = new Date() }) {
  const vigenciaDias = opticaDatos.vigenciaDias || VIGENCIA_PROFORMA_DIAS
  const validaHasta = new Date(new Date(fecha).getTime() + vigenciaDias * 86400000)
  const contacto = [opticaDatos.direccion, opticaDatos.telefono && `Tel. ${opticaDatos.telefono}`, opticaDatos.ruc && `RUC ${opticaDatos.ruc}`].filter(Boolean).map(escapar).join(" · ")
  const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0)
  const filas = lineas
    .map((l) => `<tr><td>${escapar(l.descripcion)}</td><td class="n">${escapar(l.cantidad)}</td><td class="n">${dinero(l.precioUnitario)}</td><td class="n">${dinero((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0))}</td></tr>`)
    .join("")
  const d = diagnostico
  const resumenDiagnostico = textoDiagnostico(d)
  const bloqueDiagnostico = d
    ? `<h2>Datos del diagnóstico</h2>
       <p><b>Consulta del:</b> ${escapar(fechaLegible(d.fecha))}${d.motivo ? ` · ${escapar(d.motivo)}` : ""}</p>
       ${resumenDiagnostico ? `<p><b>Diagnóstico:</b> ${escapar(resumenDiagnostico)}</p>` : ""}
       ${d.lenteRecomendado ? `<p><b>Lente recomendado:</b> ${escapar(d.lenteRecomendado)}</p>` : ""}
       ${d.indicaciones ? `<p><b>Indicaciones:</b> ${escapar(d.indicaciones)}</p>` : ""}
       ${incluirMedidas ? `<p><b>OD:</b> ${escapar(medida(d.od))} &nbsp; <b>OI:</b> ${escapar(medida(d.oi))}</p>` : ""}`
    : ""
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Proforma</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0E2B33;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:20px 0 6px}
  .aviso{margin:6px 0 18px;padding:8px 10px;border:1px dashed #94a3b8;border-radius:6px;font-size:11px;color:#475569}
  table{width:100%;border-collapse:collapse}th,td{padding:7px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{font-size:11px;text-transform:uppercase;color:#64748b}.n{text-align:right;font-variant-numeric:tabular-nums}
  .contacto{color:#475569;font-size:12px}.total{margin-top:12px;text-align:right;font-size:16px;font-weight:700}p{margin:3px 0}
</style></head><body>
<h1>${escapar(opticaNombre)}</h1>
${contacto ? `<p class="contacto">${contacto}</p>` : ""}
<p>Proforma · ${escapar(fechaLegible(fecha))} · <b>Válida hasta ${escapar(fechaLegible(validaHasta))}</b></p>
<div class="aviso">Esto es un presupuesto. No es un comprobante de venta ni una factura electrónica, y no reserva productos ni inventario.</div>
<p><b>Paciente:</b> ${escapar(paciente.nombre)}${paciente.cedula ? ` · ${escapar(paciente.cedula)}` : ""}</p>
${bloqueDiagnostico}
<h2>Detalle</h2>
<table><thead><tr><th>Descripción</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Subtotal</th></tr></thead><tbody>${filas}</tbody></table>
<p class="total">Total: ${dinero(total)}</p>
</body></html>`
}

// Imprime un HTML en un marco oculto (sin ventanas emergentes, que el navegador
// bloquea cuando el clic ya pasó por una llamada a la red).
export function imprimirHtml(html) {
  const marco = document.createElement("iframe")
  marco.setAttribute("aria-hidden", "true")
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
  document.body.appendChild(marco)
  const doc = marco.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()
  const limpiar = () => setTimeout(() => marco.remove(), 1500)
  marco.contentWindow.focus()
  setTimeout(() => {
    marco.contentWindow.print()
    limpiar()
  }, 250)
}
