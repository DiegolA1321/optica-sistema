"use client"

import { useMemo, useState } from "react"
import { Banknote, CheckCircle, CreditCard, Download, Landmark, Wallet } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { NavegadorPeriodo } from "../FiltrosCitas"
import { Insignia } from "./Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { hoyISO } from "../../utilidades/disponibilidad"
import { cobrosDelDia, conceptoDelCobro, saldosConEntrega } from "../../utilidades/cobros"
import { diaDeRegistro, moverPeriodo, selectorDelPeriodo, tituloDelPeriodo } from "../../utilidades/periodoLista"
import { saldosPorPaciente, resumenSaldos, textoSaldos } from "../../utilidades/saldosVentas"
import { textoPagos, SIN_INDICAR } from "../../utilidades/pagos"
import { nombreMetodo } from "../../utilidades/reportesDatos"
import { numeroOrden } from "../../utilidades/ordenesLaboratorio"
import { saldoFactura } from "../../utilidades/abonos"
import PagosPorVerificar from "./PagosPorVerificar"

const ICONO_METODO = { efectivo: Banknote, tarjeta: CreditCard, transferencia: Landmark, [SIN_INDICAR]: Wallet }
const DIA_DE_HOY = { filtro: "hoy", ref: "", desde: "", hasta: "" }

// Pestaña "Cobros y saldos": a la izquierda, lo cobrado en un día por método de pago (para cuadrar la caja) con su lista y su Excel;
// a la derecha, lo que se debe por paciente, con quienes ya tienen sus lentes listos primero. Los dos usan la misma lista de pagos que Reportes.
export default function PestanaCobros({ pagosPorVerificar = [], onPagoConfirmado, onPagoRechazado, facturas, abonos, abonosAnulados = [], pacientes, ventas = [], ordenes = [], puedeEditar, onCobrar, onVerComprobante, onVerPaciente, onExportar }) {
  const hoy = hoyISO()
  const [dia, setDia] = useState(DIA_DE_HOY)
  const diaISO = dia.ref || hoy
  const cobros = useMemo(() => cobrosDelDia({ facturas, abonos, dia: diaISO }), [facturas, abonos, diaISO])
  // Los abonos anulados de ese día: no suman, pero se ven aparte (cuándo se anularon) para que el cuadre de caja de un día pasado siga entendiéndose.
  const anulados = useMemo(() => abonosAnulados.filter((a) => a.fecha === diaISO && facturas.some((f) => f.id === a.facturaId)), [abonosAnulados, facturas, diaISO])
  const saldos = useMemo(() => saldosConEntrega(saldosPorPaciente({ pacientes, facturas, abonos, ventas }), ordenes), [pacientes, facturas, abonos, ventas, ordenes])
  const resumen = resumenSaldos(saldos)
  const nombrePaciente = (id) => pacientes.find((p) => p.id === id)?.nombre || "Paciente"
  const esHoy = diaISO === hoy

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <PagosPorVerificar pagos={pagosPorVerificar} puedeEditar={puedeEditar} onConfirmado={onPagoConfirmado} onRechazado={onPagoRechazado} />
      <section aria-label="Cobrado" className="min-w-0 rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold" style={{ color: INK }}>{esHoy ? "Cobrado hoy" : "Cobrado ese día"}</h2>
            <button type="button" onClick={() => onExportar(diaISO)} disabled={cobros.cantidad === 0} className={CLASE_ACCION_SECUNDARIA}><Download size={14} aria-hidden="true" /> Exportar a Excel</button>
          </div>
          <NavegadorPeriodo titulo={tituloDelPeriodo(dia, hoy)} onAnterior={() => setDia(moverPeriodo(dia, -1, hoy))} onSiguiente={() => setDia(moverPeriodo(dia, 1, hoy))} etiquetaAnterior="Día anterior" etiquetaSiguiente="Día siguiente" selector={selectorDelPeriodo(dia, setDia, hoy)} />
          <div>
            <p className="font-mono text-3xl font-bold" style={{ color: INK }} aria-label={`Total cobrado: ${dinero(cobros.total)}`}>{dinero(cobros.total)}</p>
            <p className="text-sm text-slate-500">{cobros.cantidad === 0 ? "Ningún cobro" : plural(cobros.cantidad, "cobro", "cobros")}</p>
          </div>
          <ul className="grid grid-cols-3 gap-2" aria-label="Cobrado por método de pago">
            {cobros.porMetodo.map((m) => {
              const Icono = ICONO_METODO[m.metodo]
              return (
                <li key={m.metodo} className="min-w-0 rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Icono size={13} className="shrink-0" aria-hidden="true" /> <span className="truncate">{m.etiqueta}</span></p>
                  <p className="font-mono text-base font-bold text-slate-800">{dinero(m.monto)}</p>
                </li>
              )
            })}
          </ul>
        </div>
        {cobros.cantidad === 0 && anulados.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-600">{esHoy ? "Hoy todavía no se ha cobrado nada" : "Ese día no se cobró nada"}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">Los pagos de las ventas y los abonos aparecen aquí el día que se reciben.</p>
            {!esHoy && <button type="button" onClick={() => setDia(DIA_DE_HOY)} className={CLASE_ACCION_SECUNDARIA + " mt-3"}>Ver hoy</button>}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Cobros del día">
            {cobros.filas.map((p, i) => {
              const f = p.factura
              const forma = p.pagos.every((x) => x.metodo === SIN_INDICAR) ? nombreMetodo(f?.metodoPago) : textoPagos(p.pagos)
              const detalle = `${numeroComprobante(f?.numero)} · ${conceptoDelCobro(p)} · ${forma}`
              return (
                <li key={`${f?.id}-${p.abono?.id || "contado"}-${i}`} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <button type="button" onClick={() => f && onVerComprobante(f)} title={nombrePaciente(f?.pacienteId)} className="min-w-0 truncate text-left text-sm font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{nombrePaciente(f?.pacienteId)}</button>
                    <span className="shrink-0 font-mono text-sm font-bold text-slate-800">{dinero(p.monto)}</span>
                  </div>
                  <p className="truncate text-sm text-slate-500" title={detalle}>{detalle}</p>
                </li>
              )
            })}
          </ul>
        )}
        {anulados.length > 0 && (
          <div className="border-t border-slate-100">
            <h3 className="px-4 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Abonos anulados (no suman)</h3>
            <ul className="divide-y divide-slate-100" aria-label="Abonos anulados de ese día">
              {anulados.map((a) => {
                const f = facturas.find((x) => x.id === a.facturaId)
                return (
                  <li key={a.id} className="px-4 py-2.5 text-slate-400">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold" title={nombrePaciente(f?.pacienteId)}>{nombrePaciente(f?.pacienteId)}</span>
                      <span className="shrink-0 font-mono text-sm line-through">{dinero(a.monto)}</span>
                    </div>
                    <p className="truncate text-sm" title={a.anuladoMotivo}>{numeroComprobante(f?.numero)} · anulado el {fechaLegible(diaDeRegistro(a.anuladoEn))} · {a.anuladoMotivo}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Saldos por cobrar" className="min-w-0 rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="space-y-1 border-b border-slate-100 p-4">
          <h2 className="text-base font-bold" style={{ color: INK }}>Saldos por cobrar</h2>
          <p className="font-mono text-3xl font-bold" style={{ color: INK }}>{dinero(resumen.total)}</p>
          <p className="text-sm text-slate-500">{saldos.length === 0 ? "Nadie debe nada" : textoSaldos(resumen, { conTotal: false })}</p>
        </div>
        {saldos.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle size={24} aria-hidden="true" /></div>
            <p className="text-sm font-semibold text-slate-600">No hay saldos por cobrar</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">Cuando una venta quede con abonos pendientes, el paciente aparece aquí con lo que debe.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" aria-label="Pacientes con saldo">
            {saldos.map((s) => (
              <li key={s.pacienteId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" onClick={() => s.paciente && onVerPaciente(s.paciente)} title={s.paciente?.nombre} className="block max-w-full truncate text-left text-sm font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{s.paciente?.nombre || "Paciente"}</button>
                    <p className="text-sm text-slate-500">{s.masAntigua ? `Debe desde el ${fechaLegible(s.masAntigua)}` : "Venta anterior"}</p>
                    {s.ordenesListas.length > 0 && (
                      <div className="mt-1">
                        <Insignia tono="verde" title={s.ordenesListas.map((o) => numeroOrden(o.numero)).join(", ")}>{s.ordenesListas.length === 1 ? "Sus lentes están listos para entregar" : `${s.ordenesListas.length} pedidos listos para entregar`}</Insignia>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-base font-bold text-amber-700" title="Total que debe el paciente">{dinero(s.saldo)}</span>
                </div>
                {/* Cada comprobante en su propia fila y con su "Cobrar" en la misma columna, tenga el paciente uno o varios. */}
                {s.ventasPendientes.length > 0 && (
                  <ul className="mt-2 space-y-1.5" aria-label={`Comprobantes de ${s.paciente?.nombre || "paciente"} con saldo`}>
                    {s.ventasPendientes.map((f) => (
                      <li key={f.id} className="grid grid-cols-[5rem_minmax(0,1fr)_6rem_5.5rem] items-center gap-x-3 rounded-lg bg-slate-50/70 px-3 py-1.5">
                        <button type="button" onClick={() => onVerComprobante(f)} className="text-left font-mono text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 cursor-pointer">{numeroComprobante(f.numero)}</button>
                        <span className="min-w-0 truncate text-sm text-slate-500">{fechaLegible(String(f.creadoEn).slice(0, 10))}</span>
                        <span className="text-right font-mono text-sm font-semibold text-slate-700">{dinero(saldoFactura(f, abonos))}</span>
                        <span className="flex justify-end">{puedeEditar && <button type="button" onClick={() => onCobrar(f, s.paciente)} aria-label={`Cobrar ${numeroComprobante(f.numero)}`} className={CLASE_ACCION_PRINCIPAL + " !px-3 !py-1.5"} style={{ background: GRAD_MARCA }}>Cobrar</button>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
