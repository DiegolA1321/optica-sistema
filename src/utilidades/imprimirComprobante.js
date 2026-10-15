// "Imprimir comprobante": el comprobante de venta interno ya guardado, para reimprimirlo cuando el paciente lo pida. Lógica pura que arma el HTML
// (imprimirHtml lo manda a la impresora). No lleva medidas ni datos clínicos: es un documento comercial (regla 29).
import { dinero } from "./formatoMoneda"
import { fechaLegible, hora } from "./formatoFecha"
import { escapar } from "./proforma"
import { numeroComprobante, LEYENDA_INTERNO } from "./comprobantes"
import { abonosDeFactura, totalAbonado, saldoFactura } from "./abonos"
import { brutoLinea, descuentoLinea, subtotalLinea, totalesDeLineas } from "./descuentos"
import { textoPagos, pagosDeAbono, pagosAlContado, SIN_INDICAR } from "./pagos"
import { METODOS_PAGO } from "./ventas"
import { diaDeRegistro } from "./periodoLista"

// Cómo se pagó lo que se cobró al contado: sus formas de pago, o lo que decía la venta si es anterior a ellas.
export function textoFormaDePago(factura, abonos = []) {
  const propios = abonosDeFactura(factura.id, abonos)
  const resto = Math.round(((Number(factura.montoTotal) || 0) - propios.reduce((s, a) => s + a.monto, 0)) * 100) / 100
  if (factura.estado === "pagada" && resto > 0) {
    const pagos = pagosAlContado(factura, resto)
    if (!pagos.every((p) => p.metodo === SIN_INDICAR)) return textoPagos(pagos)
  }
  return METODOS_PAGO[factura.metodoPago] || factura.metodoPago || "—"
}

const formaDeAbono = (a) => { const p = pagosDeAbono(a); return p.every((x) => x.metodo === SIN_INDICAR) ? "—" : textoPagos(p) }

// datos: { opticaNombre, opticaDatos, paciente: { nombre, cedula }, factura, abonos, vendedor }
export function armarHtmlComprobante({ opticaNombre = "Óptica", opticaDatos = {}, paciente = {}, factura, abonos = [], vendedor = "", claveAcceso = "", autorizadaEl = "" }) {
  const contacto = [opticaDatos.direccion, opticaDatos.telefono && `Tel. ${opticaDatos.telefono}`, opticaDatos.ruc && `RUC ${opticaDatos.ruc}`].filter(Boolean).map(escapar).join(" · ")
  const lineas = factura.lineas || []
  const t = totalesDeLineas(lineas)
  const hayDescuento = t.descuento > 0
  const filas = lineas.map((l) => `<tr><td>${escapar(l.descripcion)}${l.descuentoTipo ? `<div class="d">Descuento ${l.descuentoTipo === "porcentaje" ? `${Number(l.descuentoValor)} %` : ""} (${escapar(l.descuentoMotivo)}): -${dinero(descuentoLinea(l))}</div>` : ""}</td><td class="n">${escapar(l.cantidad)}</td><td class="n">${dinero(l.precioUnitario)}</td><td class="n">${dinero(l.descuentoTipo ? subtotalLinea(l) : brutoLinea(l))}</td></tr>`).join("")
  const propios = abonosDeFactura(factura.id, abonos)
  const filasAbonos = propios.map((a) => `<tr><td>${escapar(fechaLegible(a.fecha))}</td><td>${escapar(formaDeAbono(a))}</td><td class="n">${dinero(a.monto)}</td></tr>`).join("")
  const saldo = saldoFactura(factura, abonos)
  const anulada = factura.estado === "anulada"
  const fecha = diaDeRegistro(factura.creadoEn)
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapar(numeroComprobante(factura.numero))}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0E2B33;margin:32px;font-size:13px}
  h1{font-size:20px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:20px 0 6px}
  .aviso{margin:6px 0 18px;padding:8px 10px;border:1px dashed #94a3b8;border-radius:6px;font-size:11px;color:#475569}
  table{width:100%;border-collapse:collapse}th,td{padding:7px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
  th{font-size:11px;text-transform:uppercase;color:#64748b}.n{text-align:right;font-variant-numeric:tabular-nums}
  .d{font-size:11px;color:#475569}.contacto{color:#475569;font-size:12px}p{margin:3px 0}
  .totales{margin-top:12px;text-align:right}.totales p{margin:2px 0}.total{font-size:16px;font-weight:700}
  .anulada{margin:10px 0;padding:8px 10px;border:2px solid #b91c1c;color:#b91c1c;font-weight:700;text-align:center}
</style></head><body>
<h1>${escapar(opticaNombre)}</h1>
${contacto ? `<p class="contacto">${contacto}</p>` : ""}
<p>Comprobante de venta <b>${escapar(numeroComprobante(factura.numero))}</b> · ${escapar(fechaLegible(fecha))}${factura.creadoEn && String(factura.creadoEn).includes("T") ? ` · ${escapar(hora(factura.creadoEn))}` : ""}</p>
${anulada ? `<div class="anulada">VENTA ANULADA${factura.anuladaMotivo ? ` · ${escapar(factura.anuladaMotivo)}` : ""}</div>` : ""}
<div class="aviso">${escapar(LEYENDA_INTERNO)}</div>
<p><b>Paciente:</b> ${escapar(paciente.nombre)}${paciente.cedula ? ` · ${escapar(paciente.cedula)}` : ""}</p>
${factura.facturaElectronica ? `<p><b>Factura electrónica:</b> ${escapar(factura.facturaElectronica)}${autorizadaEl ? ` · autorizada el ${escapar(fechaLegible(autorizadaEl))}` : ""}</p>` : ""}
${factura.facturaElectronica && claveAcceso ? `<p><b>Clave de acceso:</b> <span style="font-family:ui-monospace,Consolas,monospace;font-size:11px">${escapar(claveAcceso)}</span></p>` : ""}
<h2>Detalle</h2>
<table><thead><tr><th>Descripción</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Subtotal</th></tr></thead><tbody>${filas}</tbody></table>
<div class="totales">
${hayDescuento ? `<p>Subtotal: ${dinero(t.bruto)}</p><p>Descuento: -${dinero(t.descuento)}</p>` : ""}
<p class="total">Total: ${dinero(factura.montoTotal)}</p>
<p>Forma de pago: ${escapar(textoFormaDePago(factura, abonos))}</p>
${propios.length > 0 ? `<p>Abonado: ${dinero(totalAbonado(factura.id, abonos))}</p>` : ""}
${!anulada && saldo > 0 ? `<p><b>Saldo pendiente: ${dinero(saldo)}</b></p>` : ""}
</div>
${filasAbonos ? `<h2>Abonos</h2><table><thead><tr><th>Fecha</th><th>Forma de pago</th><th class="n">Monto</th></tr></thead><tbody>${filasAbonos}</tbody></table>` : ""}
${vendedor ? `<p style="margin-top:18px;color:#475569;font-size:12px">Atendió: ${escapar(vendedor)}</p>` : ""}
</body></html>`
}
