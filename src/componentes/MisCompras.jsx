"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { dinero } from "../utilidades/formatoMoneda"
import { formatoFecha } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { numeroComprobante } from "../utilidades/comprobantes"
import { urlDeDescargaPaciente } from "../utilidades/facturaElectronicaApi"
import { tipoDeLentes } from "../utilidades/portalPaciente"
import { porcentajeAbonado } from "../utilidades/portalVistas"
import { Insignia, TituloPagina, Esqueleto, PasosLentes } from "./portal/piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./portal/estilos"

// Portal del paciente, «Mis compras» (diseño aprobado): arriba, si debe algo, el aviso del saldo y cómo pagarlo; después una tarjeta por compra con su número, su fecha, lo que
// compró, lo que abonó y lo que debe (con su barra), el estado de sus lentes y sus facturas para descargar. Solo ve lo suyo: la base valida su sesión, y los archivos salen por una
// función que la vuelve a validar. Los datos los pide el portal una sola vez (los comparte con el Resumen).
export default function MisCompras({ usuario, compras = [], ordenes = [], cargando = false, error = "", contacto = null, onPedirCita, onGarantia }) {
  const [bajando, setBajando] = useState("")
  const [errorDescarga, setErrorDescarga] = useState("")
  const conSaldo = compras.filter((c) => c.estado === "pendiente_pago" && Number(c.saldo) > 0)
  const saldoTotal = conSaldo.reduce((s, c) => s + Number(c.saldo), 0)

  const descargar = async (compra, tipo) => {
    setBajando(`${compra.id}-${tipo}`)
    setErrorDescarga("")
    const { url, error: fallo } = await urlDeDescargaPaciente({ pacienteId: usuario.id, token: usuario.token, facturaId: compra.id, tipo })
    setBajando("")
    if (fallo) { setErrorDescarga(fallo); return }
    const a = document.createElement("a")
    a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove()
  }
  // «de lunes a sábado de 9:00 AM a 6:00 PM» cuando la óptica tiene un solo horario.
  const cuando = contacto?.horario?.length === 1 ? `, de ${contacto.horario[0].etiqueta.toLowerCase()} de ${contacto.horario[0].horario.replace(/\s*[–-]\s*/, " a ").replace(/\b0(\d:)/g, "$1")}` : ""

  return (
    <div className="space-y-5 sm:space-y-6">
      <TituloPagina subtitulo="Tus lentes, tus pagos y tus facturas">Mis compras</TituloPagina>

      {cargando ? (
        <div className="space-y-4" aria-busy="true" aria-label="Cargando tus compras">{[0, 1].map((i) => <Esqueleto key={i} alto="h-40" />)}</div>
      ) : error ? (
        <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{error}</p>
      ) : compras.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-pt-fondo text-slate-400"><Receipt size={26} aria-hidden="true" /></div>
          <p className="text-xl font-semibold text-slate-700">Todavía no tienes compras registradas</p>
          <p className="mx-auto mt-1 max-w-sm text-lg text-pt-texto">Cuando compres en la óptica, tu comprobante aparece aquí.</p>
          {onPedirCita && <button type="button" onClick={() => onPedirCita()} className={BOTON_PRINCIPAL + " mt-4"} style={ESTILO_PRINCIPAL}>Agendar cita</button>}
        </div>
      ) : (
        <>
          {conSaldo.length > 0 && (
            <section aria-labelledby="como-pagar" className="grid gap-x-10 gap-y-3 rounded-[20px] border border-[#F6D9A8] bg-[#FEF4E5] px-6 py-6 text-[#5B3A12] sm:px-8 min-[900px]:grid-cols-[auto_minmax(0,1fr)] min-[900px]:items-center">
              <div>
                <h2 id="como-pagar" className="text-base font-semibold text-pt-ambar">Tienes un saldo por pagar</h2>
                <p className="font-heading text-[32px] font-bold leading-tight tabular-nums text-pt-ambar">{dinero(saldoTotal)}</p>
              </div>
              <p className="text-base leading-relaxed min-[900px]:max-w-[26rem] min-[900px]:justify-self-end">Puedes pagarlo en la óptica{cuando}, en efectivo, con tarjeta o por transferencia.</p>
            </section>
          )}
          <ul className="space-y-6" aria-label="Mis compras">
            {compras.map((c) => {
              const fe = c.factura_electronica
              const lentes = ordenes.filter((o) => o.facturaId === c.id)
              const debe = c.estado === "pendiente_pago"
              const entregada = lentes.length > 0 && lentes.every((o) => o.estado === "entregada")
              const enCurso = lentes.filter((o) => o.estado !== "entregada")
              const titulo = lentes[0] ? tipoDeLentes(lentes[0]) : c.lineas?.[0]?.descripcion || "Compra"
              const archivos = (
                <div className="flex flex-wrap items-center gap-3">
                  {fe?.pdf && <button type="button" onClick={() => descargar(c, "pdf")} disabled={bajando === `${c.id}-pdf`} aria-label="Factura (PDF)" className={BOTON_SECUNDARIO}>Descargar factura</button>}
                  {!debe && onGarantia && <button type="button" onClick={() => onGarantia(c)} className={BOTON_SECUNDARIO}>Solicitar ajuste o garantía</button>}
                </div>
              )
              return (
                <li key={c.id} className="min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[30px] sm:py-7">
                  <div className={"grid gap-x-8 gap-y-5 " + (debe && enCurso.length ? "min-[900px]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]" : !debe ? "min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center" : "")}>
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h2 className="font-heading text-xl font-bold leading-tight text-pt-marino">{titulo}</h2>
                        <Insignia tono={debe ? "ambar" : "verde"}>{debe ? "Con saldo" : entregada ? "Pagada y entregada" : "Pagada"}</Insignia>
                      </div>
                      <p className="text-base text-pt-texto">Comprobante {numeroComprobante(c.numero)} · {formatoFecha(diaDeRegistro(c.fecha), "largoSinDia")}{!debe ? ` · ${dinero(c.total)}` : ""}</p>
                      {debe && (
                        <>
                          <ul aria-label="Lo que compraste" className="space-y-2 pt-1 text-base text-pt-marino">
                            {(c.lineas.length ? c.lineas : [{ descripcion: "Compra", subtotal: c.total }]).map((l, i) => (
                              <li key={i} className="flex items-baseline justify-between gap-4"><span className="min-w-0">{l.descripcion}</span>{l.subtotal != null && <span className="shrink-0 font-bold tabular-nums">{dinero(l.subtotal)}</span>}</li>
                            ))}
                          </ul>
                          <div role="img" aria-label={`Has abonado el ${porcentajeAbonado(c.total, c.abonado)} por ciento`} className="pt-1"><div className="h-2 overflow-hidden rounded-full bg-[#E9EEF5]"><div className="h-full rounded-full bg-pt-azul" style={{ width: porcentajeAbonado(c.total, c.abonado) + "%" }} /></div></div>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                            <p className="text-pt-marino">Abonaste <span className="font-bold tabular-nums">{dinero(c.abonado)}</span> de <span className="font-bold tabular-nums">{dinero(c.total)}</span></p>
                            <p className="font-bold text-pt-ambar">Debes <span className="tabular-nums">{dinero(c.saldo)}</span></p>
                          </div>
                        </>
                      )}
                      {fe && <p className="text-base text-pt-texto">Factura electrónica {fe.numero}{fe.xml && <> · <button type="button" onClick={() => descargar(c, "xml")} disabled={bajando === `${c.id}-xml`} aria-label="XML" className="-my-2.5 inline-flex items-center py-2.5 font-semibold text-pt-azul hover:underline cursor-pointer">Descargar XML</button></>}</p>}
                      {!fe && !debe && <p className="text-base text-pt-texto">Tu óptica todavía no registró la factura electrónica de esta compra.</p>}
                      {fe && !fe.pdf && !fe.xml && <p className="text-base text-pt-texto">Tu óptica todavía no subió los archivos de tu factura electrónica.</p>}
                      {debe && (fe?.pdf || onGarantia) && archivos}
                    </div>
                    {debe && enCurso.length > 0 && (
                      <div className="space-y-5 rounded-[20px] bg-pt-fondo p-5 sm:p-6">
                        <h3 className="text-lg font-bold text-pt-marino">Estado de tus lentes</h3>
                        {enCurso.map((o) => <PasosLentes key={o.id} orden={o} variante="lista" />)}
                      </div>
                    )}
                    {!debe && archivos}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {errorDescarga && <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{errorDescarga}</p>}
      <p className="text-base text-pt-texto">Guarda tus facturas: la ley pide conservarlas durante 7 años.</p>
    </div>
  )
}
