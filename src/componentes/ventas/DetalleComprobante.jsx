"use client"

import { useEffect, useState } from "react"
import { Ban, Landmark, Pencil, Plus, Printer, Receipt, Wallet } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { supabase } from "../../lib/supabaseClient"
import { Cascaron } from "../AtencionPaciente"
import { Bloque, Columna, Dato } from "./Detalle"
import { Insignia } from "./Lista"
import BloqueFacturaElectronica from "./BloqueFacturaElectronica"
import { useFacturaElectronica } from "./useFacturaElectronica"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "./estilos"
import { VentanaRevision } from "./PagosPorVerificar"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible, fechaHoraLegible, hora } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { abonosDeFactura, totalAbonado } from "../../utilidades/abonos"
import { estadoDeComprobante } from "../../utilidades/saldosVentas"
import { brutoLinea, descuentoLinea, subtotalLinea, totalesDeLineas } from "../../utilidades/descuentos"
import { pagosDeAbono, textoPagos, redondear, SIN_INDICAR } from "../../utilidades/pagos"
import { textoFormaDePago, armarHtmlComprobante } from "../../utilidades/imprimirComprobante"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { imprimirHtml, datosOpticaProforma } from "../../utilidades/proforma"
import { registrarLog } from "../../utilidades/logs"
import { puede } from "../../utilidades/permisosUi"
import { numeroOrden, diasDeAtraso, nombreDeLentes } from "../../utilidades/ordenesLaboratorio"
import { estadoDePedido } from "../../utilidades/ventasModulo"

const TONO_ESTADO = { pagada: "verde", saldo: "ambar", anulada: "gris" }

// El detalle de un comprobante de venta guardado: sus datos, las líneas con sus descuentos, los pagos (con quién los registró), sus órdenes de laboratorio
// y la factura electrónica. Aquí están todas las acciones; la fila de la lista solo lleva "Abonar" (regla 9). Se puede reimprimir.
export default function DetalleComprobante({ factura: f, paciente, abonos = [], abonosAnulados = [], ordenes = [], equipo = [], usuario, parametrizacion, v, ordenesApi = null, puedeVender, puedeEditar, puedeAnular, onCerrar, onVerPaciente, onAviso, pagosPorVerificar = [], onPagoConfirmado, onPagoRechazado }) {
  const [cambios, setCambios] = useState([]) // lo que se corrigió o anuló de los abonos
  const [pagoAbierto, setPagoAbierto] = useState(null) // la transferencia que se está revisando
  const fe = useFacturaElectronica(f.id, f.facturaElectronica)
  const estado = estadoDeComprobante(f, abonos)
  const anulada = estado.id === "anulada"
  const propios = abonosDeFactura(f.id, abonos)
  const totales = totalesDeLineas(f.lineas || [])
  const ordenesDeVenta = ordenes.filter((o) => o.facturaId === f.id)
  const anuladosDeVenta = abonosAnulados.filter((a) => a.facturaId === f.id) // no cuentan en nada, pero el registro se conserva
  const nombre = (id) => (id ? equipo.find((m) => m.id === id)?.nombre || (id === usuario?.id ? usuario?.nombre : null) || "Equipo" : "—")
  const puedeVerRevision = puede(usuario, "ventas", "ver")
  const restoAlContado = f.estado === "pagada" ? redondear((Number(f.montoTotal) || 0) - propios.reduce((s, a) => s + a.monto, 0)) : 0

  // Qué se corrigió o anuló de los abonos de esta venta (la base lo guarda: lo anterior, el motivo, quién y cuándo).
  useEffect(() => {
    if (!supabase) return
    let vivo = true
    supabase.from("abonos_correcciones").select("accion, motivo, monto_anterior, monto_nuevo, realizado_por, realizado_en").eq("factura_id", f.id).order("realizado_en").then(({ data }) => { if (vivo && data) setCambios(data) })
    return () => { vivo = false }
  // Se vuelve a leer cuando cambia algún abono (uno nuevo, corregido o anulado).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id, abonos.map((x) => x.id + x.monto).join(","), abonosAnulados.length])

  const imprimir = () => {
    imprimirHtml(armarHtmlComprobante({ opticaNombre: usuario?.opticaNombre, opticaDatos: datosOpticaProforma(parametrizacion), paciente: paciente || {}, factura: f, abonos, claveAcceso: fe.datos?.claveAcceso || "", autorizadaEl: fe.datos?.autorizadaEl || "", vendedor: nombre(f.registradoPor) === "—" ? "" : nombre(f.registradoPor) }))
    registrarLog(usuario, "ventas", "Reimprimió un comprobante", `${paciente?.nombre || ""} · ${numeroComprobante(f.numero)}`)
  }
  const con = (accion) => () => accion({ factura: f, paciente })

  return (
    <>
    <Cascaron
      titulo={`Venta ${numeroComprobante(f.numero)}`}
      subtitulo={`${paciente?.nombre || "Paciente"} · ${fechaLegible(diaDeRegistro(f.creadoEn)) || "—"}`}
      Icono={Receipt}
      ancho="max-w-4xl"
      etiqueta={`Venta ${numeroComprobante(f.numero)}`}
      onCerrar={onCerrar}
      derecha={<Insignia tono={TONO_ESTADO[estado.id]}>{estado.id === "saldo" ? `Con saldo ${dinero(estado.saldo)}` : estado.etiqueta}</Insignia>}
      pie={(
        <>
          {puedeAnular && !anulada ? <button type="button" onClick={con(v.setAnularPara)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/60 px-3.5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 cursor-pointer"><Ban size={14} aria-hidden="true" /> Anular venta</button> : <span />}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={imprimir} className={CLASE_ACCION_SECUNDARIA}><Printer size={14} aria-hidden="true" /> Imprimir comprobante</button>
            {puedeEditar && estado.id === "saldo" && <button type="button" onClick={con(v.setAbonoPara)} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Wallet size={14} aria-hidden="true" /> Registrar abono</button>}
            <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
          </div>
        </>
      )}
    >
      <div className="space-y-5 p-5">
        {anulada && (
          <p role="status" className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-bold">Venta anulada</span>{f.anuladaEn ? ` el ${fechaLegible(diaDeRegistro(f.anuladaEn))}` : ""}{f.anuladaPor ? ` por ${nombre(f.anuladaPor)}` : ""}{f.anuladaMotivo ? `. Motivo: ${f.anuladaMotivo}` : ""}.
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Columna titulo="La venta">
            <Dato etiqueta="Fecha">{fechaLegible(diaDeRegistro(f.creadoEn)) || "—"}{String(f.creadoEn || "").includes("T") ? ` · ${hora(f.creadoEn)}` : ""}</Dato>
            <Dato etiqueta="Registrada por">{nombre(f.registradoPor)}</Dato>
            <Dato etiqueta="Forma de pago">{textoFormaDePago(f, abonos)}{f.metodoPago === "cuotas" && f.cuotasTotales ? ` (${f.cuotasPagadas || 0}/${f.cuotasTotales} cuotas)` : ""}</Dato>
          </Columna>
          <Columna titulo="Paciente">
            <Dato etiqueta="Nombre">
              {paciente && onVerPaciente ? <button type="button" onClick={() => onVerPaciente(paciente)} className="text-left text-blue-700 transition-colors hover:text-blue-800 hover:underline cursor-pointer">{paciente.nombre}</button> : (paciente?.nombre || "Paciente")}
            </Dato>
            <Dato etiqueta="Cédula" vacio={!paciente?.cedula}>{paciente?.cedula || "Sin cédula"}</Dato>
            <Dato etiqueta="Teléfono (el día de la venta)" vacio={!(f.pacienteTelefono || paciente?.telefono)}>{f.pacienteTelefono || paciente?.telefono || "Sin teléfono"}</Dato>
          </Columna>
        </div>

        <Bloque titulo="Detalle de la venta">
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-1.5 text-left font-bold">Descripción</th><th className="px-3 py-1.5 text-right font-bold">Cant.</th><th className="px-3 py-1.5 text-right font-bold">Precio</th><th className="px-3 py-1.5 text-right font-bold">Subtotal</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(f.lineas || []).map((l, i) => (
                  <tr key={l.id || i} className="align-top">
                    <td className="max-w-0 px-3 py-2">
                      <p className="truncate font-semibold text-slate-800" title={l.descripcion}>{l.descripcion}</p>
                      {l.descuentoTipo && (
                        <p className="mt-0.5 text-xs text-slate-500">Descuento {l.descuentoTipo === "porcentaje" ? `de ${Number(l.descuentoValor)} % ` : ""}(−{dinero(descuentoLinea(l))}) · {l.descuentoMotivo}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{l.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{dinero(l.precioUnitario)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{dinero(l.descuentoTipo ? subtotalLinea(l) : brutoLinea(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto mt-3 w-full max-w-xs space-y-1 text-sm">
            {totales.descuento > 0 && (
              <>
                <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-mono">{dinero(totales.bruto)}</dd></div>
                <div className="flex justify-between text-slate-600"><dt>Descuento</dt><dd className="font-mono">−{dinero(totales.descuento)}</dd></div>
              </>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900"><dt>Total</dt><dd className="font-mono">{dinero(f.montoTotal)}</dd></div>
            {!anulada && propios.length > 0 && <div className="flex justify-between text-slate-600"><dt>Abonado</dt><dd className="font-mono">{dinero(totalAbonado(f.id, abonos))}</dd></div>}
            {estado.id === "saldo" && <div className="flex justify-between font-bold text-amber-700"><dt>Saldo</dt><dd className="font-mono">{dinero(estado.saldo)}</dd></div>}
          </dl>
        </Bloque>

        {/* Los archivos y los envíos de la factura electrónica son de quien ve Ventas; quien llega desde el perfil del paciente solo ve su número. */}
        {!puede(usuario, "ventas", "ver") ? (f.facturaElectronica ? <Bloque titulo="Factura electrónica"><p className="font-mono text-sm text-slate-700">{f.facturaElectronica}</p></Bloque> : null) : <BloqueFacturaElectronica factura={f} paciente={paciente} usuario={usuario} equipo={equipo} fe={fe} puedeEditar={puedeEditar} onRegistrar={() => v.setFacturaElectronicaPara({ factura: f, paciente })} onAviso={onAviso} />}

        {(propios.length > 0 || anuladosDeVenta.length > 0 || restoAlContado > 0 || cambios.length > 0 || estado.id === "saldo") && (
          <Bloque titulo="Pagos">
            {propios.length === 0 && anuladosDeVenta.length === 0 && restoAlContado <= 0 ? (
              <p className="text-sm text-slate-500">Todavía no se ha recibido ningún pago.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200/60">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-1.5 text-left font-bold">Fecha</th><th className="px-3 py-1.5 text-left font-bold">Concepto</th><th className="px-3 py-1.5 text-left font-bold">Forma de pago</th><th className="px-3 py-1.5 text-left font-bold">Registró</th><th className="px-3 py-1.5 text-right font-bold">Monto</th><th className="w-20 px-3 py-1.5" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {restoAlContado > 0 && (
                      <tr>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fechaLegible(diaDeRegistro(f.creadoEn))}</td>
                        <td className="px-3 py-2 text-slate-700">Pago de la venta</td>
                        <td className="max-w-0 truncate px-3 py-2 text-slate-600" title={textoFormaDePago(f, abonos)}>{textoFormaDePago(f, abonos)}</td>
                        <td className="max-w-0 truncate px-3 py-2 text-slate-600">{nombre(f.registradoPor)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{dinero(restoAlContado)}</td>
                        <td />
                      </tr>
                    )}
                    {propios.map((a) => {
                      const pagos = pagosDeAbono(a)
                      const forma = pagos.every((p) => p.metodo === SIN_INDICAR) ? "Sin indicar" : textoPagos(pagos)
                      return (
                        <tr key={a.id}>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fechaLegible(a.fecha)}</td>
                          <td className="max-w-0 px-3 py-2 text-slate-700">
                            <p className="truncate" title={a.nota || "Abono"}>{a.nota || "Abono"}</p>
                            {a.montoOriginal != null && <p className="truncate text-xs text-slate-500" title={`Corregido: antes ${dinero(a.montoOriginal)}`}>Corregido · antes {dinero(a.montoOriginal)}</p>}
                          </td>
                          <td className="max-w-0 truncate px-3 py-2 text-slate-600" title={forma}>{forma}</td>
                          <td className="max-w-0 truncate px-3 py-2 text-slate-600" title={nombre(a.registradoPor)}>{nombre(a.registradoPor)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{dinero(a.monto)}</td>
                          <td className="px-3 py-2 text-right">
                            {puedeEditar && !anulada && <button type="button" onClick={() => v.setCorregirAbonoPara({ abono: a, factura: f, paciente })} aria-label={`Corregir el abono de ${dinero(a.monto)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer"><Pencil size={13} aria-hidden="true" /> Corregir</button>}
                          </td>
                        </tr>
                      )
                    })}
                    {anuladosDeVenta.map((a) => (
                      <tr key={a.id} className="bg-slate-50/60 text-slate-400">
                        <td className="whitespace-nowrap px-3 py-2">{fechaLegible(a.fecha)}</td>
                        <td className="max-w-0 px-3 py-2" colSpan={3}>
                          <p className="truncate" title={a.anuladoMotivo}>Abono anulado el {fechaLegible(diaDeRegistro(a.anuladoEn))} por {nombre(a.anuladoPor)}</p>
                          <p className="truncate text-xs" title={a.anuladoMotivo}>Motivo: {a.anuladoMotivo}</p>
                        </td>
                        <td className="px-3 py-2 text-right font-mono line-through">{dinero(a.monto)}</td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cambios.length > 0 && (
              <ul aria-label="Cambios en los abonos" className="mt-2 space-y-1 text-sm text-slate-500">
                {cambios.map((c, i) => (
                  <li key={i}>{c.accion === "anulado" ? `Se anuló un abono de ${dinero(c.monto_anterior)}` : `Se corrigió un abono de ${dinero(c.monto_anterior)} a ${dinero(c.monto_nuevo)}`} · {c.motivo} · {nombre(c.realizado_por)}, {fechaHoraLegible(c.realizado_en, { anio: true })}</li>
                ))}
              </ul>
            )}
          </Bloque>
        )}

        {puedeVerRevision && pagosPorVerificar.length > 0 && (
          <Bloque titulo="Pago por verificar">
            <ul className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-200/70 bg-amber-50/50" aria-label="Transferencias por verificar">
              {pagosPorVerificar.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <Landmark size={15} className="shrink-0 text-amber-700" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-slate-700">Transferencia de <span className="font-mono font-semibold">{dinero(p.monto)}</span> · enviada el {fechaLegible(diaDeRegistro(p.creadoEn)) || "—"}</span>
                  <button type="button" onClick={() => setPagoAbierto(p)} aria-haspopup="dialog" className={CLASE_ACCION_SECUNDARIA}>Revisar</button>
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        <Bloque titulo="Estado de los lentes" derecha={puedeVender && !anulada ? <button type="button" onClick={con(v.setOrdenParaVenta)} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer"><Plus size={13} aria-hidden="true" /> {ordenesDeVenta.length > 0 ? "Otro pedido de lentes" : "Crear pedido de lentes"}</button> : null}>
          {ordenesDeVenta.length === 0 ? (
            <p className="text-sm text-slate-500">Esta venta no tiene pedido de lentes.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/60" aria-label="Pedidos de lentes de la venta">
              {ordenesDeVenta.map((o) => {
                const estadoPedido = estadoDePedido(o, diasDeAtraso(o))
                return (
                  <li key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <button type="button" onClick={() => ordenesApi?.verDetalle(o)} disabled={!ordenesApi} className="font-mono font-bold text-blue-700 transition-colors hover:text-blue-800 hover:underline cursor-pointer disabled:cursor-default disabled:text-slate-700 disabled:no-underline">{numeroOrden(o.numero)}</button>
                    <span className="min-w-0 flex-1 truncate text-slate-600" title={o.laboratorio || "Sin laboratorio"}>{nombreDeLentes(o)} · {o.laboratorio || "Sin laboratorio"} · prometido el {fechaLegible(o.fechaPrometida) || "—"}</span>
                    <Insignia tono={estadoPedido.tono}>{estadoPedido.etiqueta}</Insignia>
                  </li>
                )
              })}
            </ul>
          )}
        </Bloque>
      </div>
    </Cascaron>
    {pagoAbierto && (
      <VentanaRevision pago={pagoAbierto} puedeEditar={puedeEditar} onCerrar={() => setPagoAbierto(null)}
        onConfirmado={(p, r) => { setPagoAbierto(null); onPagoConfirmado?.(p, r) }} onRechazado={(p) => { setPagoAbierto(null); onPagoRechazado?.(p) }} />
    )}
    </>
  )
}
