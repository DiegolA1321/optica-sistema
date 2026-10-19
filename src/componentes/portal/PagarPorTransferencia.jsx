"use client"

import { useState } from "react"
import { Landmark, Copy, Check, Upload, FileText } from "lucide-react"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { problemaDelComprobante, prepararComprobante, ESTADO_PAGO } from "../../utilidades/comprobantePago"
import { Cascaron } from "../AtencionPaciente"
import { Insignia } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// «Pagar por transferencia» (migración 0131): el paciente ve los datos bancarios de la óptica, hace la transferencia en su banco y sube la foto o el PDF del comprobante con el monto.
// Queda «Pago en verificación» hasta que la óptica lo confirma (se registra como abono) o lo rechaza con su motivo.
const DATOS = [["banco", "Banco"], ["tipo_cuenta", "Tipo de cuenta"], ["numero", "Número de cuenta"], ["titular", "A nombre de"], ["documento", "Cédula o RUC"], ["correo", "Correo"]]

// Lo que ya reportó de una compra, con su estado: «Pago en verificación», «Pago confirmado» o el motivo del rechazo.
export function PagosReportados({ pagos = [], facturaId = null, className = "" }) {
  const lista = pagos.filter((p) => (facturaId ? p.facturaId === facturaId : true))
  if (lista.length === 0) return null
  return (
    <ul aria-label="Pagos que reportaste por transferencia" className={"space-y-2 " + className}>
      {lista.map((p) => {
        const e = ESTADO_PAGO[p.estado] || ESTADO_PAGO.por_verificar
        return (
          <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl bg-pt-fondo px-4 py-3 text-base text-pt-marino">
            <span><span className="font-bold tabular-nums">{dinero(p.monto)}</span> · {formatoFecha(diaDeRegistro(p.creadoEn), "medio")}{p.estado === "rechazado" && p.motivoRechazo && <span className="mt-0.5 block text-pt-texto">Motivo: {p.motivoRechazo}</span>}</span>
            <Insignia tono={e.tono}>{e.nombre}</Insignia>
          </li>
        )
      })}
    </ul>
  )
}

function Copiable({ texto }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ } }
  return <button type="button" onClick={copiar} aria-label={"Copiar " + texto} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-base font-semibold text-pt-azul hover:bg-pt-suave cursor-pointer">{copiado ? <><Check size={18} aria-hidden="true" /> Copiado</> : <><Copy size={18} aria-hidden="true" /> Copiar</>}</button>
}

// `compras`: las compras con saldo ({ id, comprobante, saldo }); `pagos`: lo ya reportado; `onEnviar({ facturaId, monto, archivo })` → { ok, error }.
export default function VentanaPagarPorTransferencia({ datos, compras = [], pagos = [], compraInicialId = null, onEnviar, onCerrar }) {
  const pendientes = (id) => pagos.filter((p) => p.facturaId === id && p.estado === "por_verificar").reduce((s, p) => s + p.monto, 0)
  const porPagar = (c) => Math.max(0, Math.round((Number(c.saldo) - pendientes(c.id)) * 100) / 100)
  const [compraId, setCompraId] = useState(compraInicialId || compras[0]?.id || "")
  const compra = compras.find((c) => c.id === compraId) || compras[0]
  const [monto, setMonto] = useState(() => (compra ? String(porPagar(compra)) : ""))
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [enviado, setEnviado] = useState(false)
  const elegirCompra = (id) => { setCompraId(id); const c = compras.find((x) => x.id === id); setMonto(c ? String(porPagar(c)) : "") }
  const enviar = async () => {
    const valor = Math.round(parseFloat(String(monto).replace(",", ".")) * 100) / 100
    if (!compra) { setError("No tienes saldo por pagar."); return }
    if (!(valor > 0)) { setError("Escribe el monto que transferiste."); return }
    if (valor > porPagar(compra)) { setError(`El monto no puede ser mayor a lo que debes (${dinero(porPagar(compra))}).`); return }
    const problema = problemaDelComprobante(archivo)
    if (problema) { setError(problema); return }
    setEnviando(true); setError("")
    let preparado
    try { preparado = await prepararComprobante(archivo) } catch (e) { setEnviando(false); setError(e.message); return }
    const r = await onEnviar({ facturaId: compra.id, monto: valor, archivo: preparado })
    setEnviando(false)
    if (!r.ok) { setError(r.error); return }
    setEnviado(true)
  }
  const campo = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg text-pt-marino outline-none focus-visible:border-pt-azul focus-visible:ring-2 focus-visible:ring-blue-100"
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Pagar por transferencia" subtitulo="Transfiere y sube tu comprobante" Icono={Landmark} ancho="max-w-xl" onCerrar={onCerrar} capa="z-[60]"
      pie={enviado
        ? <><span /><button type="button" onClick={onCerrar} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>Listo</button></>
        : <><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cancelar</button><button type="button" onClick={enviar} disabled={enviando || !compra} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{enviando ? "Enviando…" : "Enviar comprobante"}</button></>}>
      {enviado ? (
        <div className="space-y-3 p-5">
          <p role="status" className="flex items-start gap-3 rounded-2xl bg-[#E3F4EA] px-4 py-4 text-lg font-semibold text-[#166534]"><Check size={24} className="mt-0.5 shrink-0" aria-hidden="true" /> Recibimos tu comprobante. La óptica lo verificará y te avisaremos aquí: verás «Pago confirmado».</p>
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <section aria-label="Datos para la transferencia" className="rounded-2xl border border-pt-borde">
            <h3 className="border-b border-pt-borde px-4 py-3 font-heading text-lg font-bold text-pt-marino">1. Haz la transferencia</h3>
            <dl className="divide-y divide-pt-borde px-4">
              {DATOS.filter(([k]) => datos?.[k]).map(([k, etiqueta]) => (
                <div key={k} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
                  <dt className="text-base text-pt-texto">{etiqueta}</dt>
                  <dd className="flex items-center gap-2 text-lg font-semibold text-pt-marino"><span className={k === "numero" ? "tabular-nums" : ""}>{datos[k]}</span>{k === "numero" && <Copiable texto={datos[k]} />}</dd>
                </div>
              ))}
            </dl>
            {datos?.instrucciones && <p className="border-t border-pt-borde px-4 py-3 text-base text-pt-texto">{datos.instrucciones}</p>}
          </section>
          <section aria-label="Tu comprobante" className="space-y-4">
            <h3 className="font-heading text-lg font-bold text-pt-marino">2. Sube tu comprobante</h3>
            {compras.length > 1 && (
              <label className="block text-base font-semibold text-pt-marino">¿Qué compra pagas?
                <select value={compraId} onChange={(e) => elegirCompra(e.target.value)} className={campo + " mt-1 font-normal"}>
                  {compras.map((c) => <option key={c.id} value={c.id}>{`Comprobante ${c.comprobante} · debes ${dinero(porPagar(c))}`}</option>)}
                </select>
              </label>
            )}
            <label className="block text-base font-semibold text-pt-marino">¿Cuánto transferiste? <span className="font-normal text-pt-texto">(debes {dinero(compra ? porPagar(compra) : 0)})</span>
              <span className="relative mt-1 block"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-pt-texto" aria-hidden="true">$</span>
                <input inputMode="decimal" value={monto} onChange={(e) => { setMonto(e.target.value.replace(/[^0-9.,]/g, "")); setError("") }} className={campo + " pl-8 tabular-nums"} /></span>
            </label>
            <div>
              <label htmlFor="archivo-comprobante" className="mb-1 block text-base font-semibold text-pt-marino">Foto o PDF del comprobante</label>
              <label className={BOTON_SECUNDARIO + " w-full justify-start"}><Upload size={20} aria-hidden="true" /> {archivo ? "Cambiar el archivo" : "Elegir la foto o el PDF"}
                <input id="archivo-comprobante" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => { setArchivo(e.target.files?.[0] || null); setError("") }} className="sr-only" />
              </label>
              {archivo && <p className="mt-2 flex items-center gap-2 text-base text-pt-marino"><FileText size={18} className="shrink-0 text-pt-azul" aria-hidden="true" /><span className="min-w-0 truncate">{archivo.name}</span></p>}
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}
          </section>
          <PagosReportados pagos={pagos} facturaId={compra?.id} />
        </div>
      )}
    </Cascaron>
  )
}
