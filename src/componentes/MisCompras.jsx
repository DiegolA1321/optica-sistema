"use client"

import { useMemo, useState } from "react"
import { Receipt, ChevronRight } from "lucide-react"
import { dinero } from "../utilidades/formatoMoneda"
import { formatoFecha } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { numeroComprobante } from "../utilidades/comprobantes"
import { urlDeDescargaPaciente } from "../utilidades/facturaElectronicaApi"
import { tipoDeLentes, nombreDeLosLentes, proximoPasoLentes } from "../utilidades/portalPaciente"
import { porcentajeAbonado } from "../utilidades/portalVistas"
import { Cascaron } from "./AtencionPaciente"
import { Insignia, TituloPagina, Esqueleto, PasosLentes, VerDetalle } from "./portal/piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./portal/estilos"
import TarjetaSolicitarLentes from "./portal/SolicitarLentes"

const anioDe = (c) => String(diaDeRegistro(c.fecha)).slice(0, 4)
const CHIP = (activo) => "inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors cursor-pointer " + (activo ? "bg-pt-azul text-white" : "border border-pt-borde bg-white text-pt-marino hover:bg-pt-fondo")

// Portal del paciente, «Mis compras» (diseño aprobado): arriba tres resúmenes pequeños (por pagar, lentes en proceso y tus puntos); después una tarjeta por cada compra que tiene saldo o lentes en
// camino (con lo que compró, lo abonado y lo que debe, y el estado de sus lentes); y el historial de todas las compras con filtros (con saldo, pagadas y por año). Cada compra se pulsa y abre su
// detalle: lo que compró, los pagos y el historial de abonos, el estado de sus lentes y las facturas para descargar. Solo ve lo suyo: la base valida su sesión, y los archivos salen por una función
// que la vuelve a validar. Los datos los pide el portal una sola vez (los comparte con el Inicio).
export default function MisCompras({ usuario, compras = [], ordenes = [], cargando = false, error = "", contacto = null, puntos = null, solicitudes = null, onSolicitarLentes, recetaVigente = null, onPedirCita, onGarantia, onAbrir }) {
  const [bajando, setBajando] = useState("")
  const [errorDescarga, setErrorDescarga] = useState("")
  const [abiertaId, setAbiertaId] = useState(null)
  const [filtro, setFiltro] = useState("todas")
  const conSaldo = compras.filter((c) => c.estado === "pendiente_pago" && Number(c.saldo) > 0)
  const saldoTotal = conSaldo.reduce((s, c) => s + Number(c.saldo), 0)
  const abierta = compras.find((c) => c.id === abiertaId) || null
  const anios = useMemo(() => [...new Set(compras.map(anioDe))].sort((a, b) => b.localeCompare(a)), [compras])
  const enProceso = ordenes.filter((o) => o.estado === "enviada" || o.estado === "lista")
  const listos = enProceso.filter((o) => o.estado === "lista").length
  const proxima = enProceso.map((o) => o.fechaPrometida).filter(Boolean).sort()[0]

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

  const visibles = compras.filter((c) => (filtro === "todas" ? true : filtro === "saldo" ? c.estado === "pendiente_pago" && Number(c.saldo) > 0 : filtro === "pagadas" ? !(c.estado === "pendiente_pago" && Number(c.saldo) > 0) : anioDe(c) === filtro))
  const totalVisible = visibles.reduce((s, c) => s + Number(c.total), 0)
  // Las compras que merecen su tarjeta arriba: las que deben algo o tienen lentes en camino.
  const destacadas = compras.filter((c) => (c.estado === "pendiente_pago" && Number(c.saldo) > 0) || ordenes.some((o) => o.facturaId === c.id && o.estado !== "entregada"))

  // Cada resumen se pulsa y abre su detalle en la ventana estándar (lo que dice la tarjeta y lo que abre es lo mismo).
  const resumen = (titulo, valor, texto, clase, abrir, etiqueta) => (
    <div className={"min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[30px] sm:py-6 " + (abrir ? "pt-abrible relative transition-shadow hover:shadow-md" : "")}>
      {abrir && <button type="button" onClick={() => onAbrir?.(abrir)} aria-label={etiqueta} className="pt-abrir absolute inset-0 rounded-[20px] cursor-pointer" />}
      <p className="flex items-center justify-between gap-3 text-base text-pt-texto">{titulo}{abrir && <ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" />}</p>
      <p className={"mt-1 font-heading text-[32px] font-bold leading-tight tabular-nums " + clase}>{valor}</p>
      <p className="mt-1 text-base leading-snug text-pt-texto">{texto}</p>
    </div>
  )
  // Un solo pedido en proceso abre su pedido; varios, la lista con los pasos de cada uno.
  const abrirLentes = enProceso.length === 0 ? null : enProceso.length === 1 ? { tipo: "pedido", id: enProceso[0].id } : { tipo: "lentes" }

  const solicitar = <TarjetaSolicitarLentes solicitudes={solicitudes} onSolicitar={onSolicitarLentes} recetaVigente={recetaVigente} />
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
      ) : null}
      {!cargando && !error && compras.length === 0 && solicitar}
      {!cargando && !error && compras.length > 0 && (
        <>
          <section aria-label="Resumen de tus compras" className="grid gap-4 @[760px]/portal:grid-cols-3 @[760px]/portal:gap-5">
            {resumen("Por pagar", dinero(saldoTotal), saldoTotal > 0 ? "Págalo en la óptica: efectivo, tarjeta o transferencia." : "No tienes saldo pendiente.", saldoTotal > 0 ? "text-pt-ambar" : "text-pt-marino", saldoTotal > 0 && onAbrir ? { tipo: "saldo" } : null, "Ver tus compras con saldo y el historial de tus abonos")}
            {resumen("Lentes en proceso", enProceso.length, enProceso.length === 0 ? "No tienes lentes en camino." : listos > 0 ? `${listos === 1 ? "1 listo" : listos + " listos"} para retirar.` : proxima ? `Listos aprox. el ${formatoFecha(proxima, "largoSinDia").replace(/ de \d{4}$/, "")}.` : "Te avisaremos cuando estén listos.", "text-pt-marino", onAbrir ? abrirLentes : null, "Ver el estado de tus lentes en proceso")}
            {puntos && resumen("Tus puntos", puntos.puntos, puntos.texto + ".", "text-[#15803D]", onAbrir ? { tipo: "puntos" } : null, "Ver cómo sumas tus puntos")}
          </section>

          {solicitar}

          {destacadas.length > 0 && (
            <ul className="space-y-5 sm:space-y-6" aria-label="Compras con saldo o lentes en camino">
              {destacadas.map((c) => {
                const lentes = ordenes.filter((o) => o.facturaId === c.id)
                const debe = c.estado === "pendiente_pago" && Number(c.saldo) > 0
                const enCurso = lentes.filter((o) => o.estado !== "entregada")
                const titulo = lentes[0] ? tipoDeLentes(lentes[0]) : c.lineas?.[0]?.descripcion || "Compra"
                return (
                  <li key={c.id} className="pt-abrible relative min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 transition-shadow hover:shadow-md sm:px-[30px] sm:py-7">
                    <button type="button" onClick={() => setAbiertaId(c.id)} aria-label={`Ver el detalle de tu compra ${numeroComprobante(c.numero)}`} className="pt-abrir absolute inset-0 rounded-[20px] cursor-pointer" />
                    <div className={"grid gap-x-8 gap-y-5 " + (enCurso.length > 0 ? "@[820px]/portal:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]" : "")}>
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <h2 className="font-heading text-xl font-bold leading-tight text-pt-marino">{titulo}</h2>
                          {debe && <Insignia tono="ambar">Con saldo</Insignia>}
                        </div>
                        <p className="text-base text-pt-texto">Comprobante {numeroComprobante(c.numero)} · {formatoFecha(diaDeRegistro(c.fecha), "largoSinDia")}</p>
                        <ul aria-label="Lo que compraste" className="space-y-2 pt-1 text-base text-pt-marino">
                          {(c.lineas?.length ? c.lineas : [{ descripcion: "Compra", subtotal: c.total }]).map((l, i) => (
                            <li key={i} className="flex items-baseline justify-between gap-4"><span className="min-w-0">{l.descripcion}</span>{l.subtotal != null && <span className="shrink-0 font-bold tabular-nums">{dinero(l.subtotal)}</span>}</li>
                          ))}
                        </ul>
                        {debe && (
                          <>
                            <div role="img" aria-label={`Has abonado el ${porcentajeAbonado(c.total, c.abonado)} por ciento`}><div className="h-2 overflow-hidden rounded-full bg-[#E9EEF5]"><div className="h-full rounded-full bg-pt-azul" style={{ width: porcentajeAbonado(c.total, c.abonado) + "%" }} /></div></div>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                              <p className="text-pt-marino">Abonaste <span className="font-bold tabular-nums">{dinero(c.abonado)}</span> de <span className="font-bold tabular-nums">{dinero(c.total)}</span></p>
                              <p className="font-bold text-pt-ambar">Debes <span className="tabular-nums">{dinero(c.saldo)}</span></p>
                            </div>
                          </>
                        )}
                        {Array.isArray(c.abonos) && c.abonos.length > 0 && (
                          <div className="border-t border-pt-borde pt-3">
                            <h3 className="text-base font-semibold text-pt-texto">Abonos realizados</h3>
                            <ul aria-label="Abonos realizados" className="mt-1 space-y-1 text-base text-pt-marino">
                              {c.abonos.map((a, i) => <li key={i} className="flex items-baseline justify-between gap-4"><span>{formatoFecha(a.fecha, "largoSinDia")}</span><span className="shrink-0 font-bold tabular-nums">{dinero(a.monto)}</span></li>)}
                            </ul>
                          </div>
                        )}
                        {enCurso[0] && (
                          <p className="flex items-start gap-2 rounded-xl bg-pt-suave px-4 py-3 text-base font-semibold leading-snug text-[#1B4FB5]"><span className="sr-only">Lo que sigue: </span>{proximoPasoLentes(enCurso[0])}</p>
                        )}
                      </div>
                      {enCurso.length > 0 && (
                        <div className="flex flex-col space-y-4 rounded-[20px] bg-pt-fondo p-5 sm:p-6">
                          <h3 className="text-lg font-bold text-pt-marino">Estado de tus lentes</h3>
                          {enCurso.map((o) => <PasosLentes key={o.id} orden={o} variante="lista" />)}
                          <p className="mt-auto text-right"><VerDetalle /></p>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <section aria-labelledby="historial-compras" className="rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[30px] sm:py-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="historial-compras" className="font-heading text-xl font-bold text-pt-marino">Historial de compras</h2>
              <p className="text-base text-pt-texto" aria-live="polite">{visibles.length} {visibles.length === 1 ? "compra" : "compras"} · {dinero(totalVisible)} en total</p>
            </div>
            <div role="group" aria-label="Filtrar las compras" className="mt-4 flex flex-wrap gap-2">
              {[["todas", "Todas"], ...(conSaldo.length > 0 ? [["saldo", "Con saldo"]] : []), ["pagadas", "Pagadas"], ...(anios.length > 1 ? anios.map((a) => [a, a]) : [])].map(([id, nombre]) => (
                <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={CHIP(filtro === id)}>{nombre}</button>
              ))}
            </div>
            {visibles.length === 0 ? (
              <p role="status" className="mt-4 rounded-2xl bg-pt-fondo px-5 py-6 text-center text-lg font-semibold text-pt-marino">Ninguna compra coincide con este filtro.</p>
            ) : (
              <ul className="mt-3 divide-y divide-pt-borde" aria-label="Historial de compras" data-lista="historial-compras">
                {visibles.map((c) => {
                  const lentes = ordenes.filter((o) => o.facturaId === c.id)
                  const debe = c.estado === "pendiente_pago" && Number(c.saldo) > 0
                  const entregada = lentes.length > 0 && lentes.every((o) => o.estado === "entregada")
                  const titulo = lentes[0] ? tipoDeLentes(lentes[0]) : c.lineas?.[0]?.descripcion || "Compra"
                  const sub = [numeroComprobante(c.numero), c.factura_electronica ? `factura ${c.factura_electronica.numero}` : c.lineas?.length > 1 ? `${c.lineas.length} productos` : ""].filter(Boolean).join(" · ")
                  return (
                    <li key={c.id} data-fila className="pt-abrible relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-4 transition-colors hover:bg-pt-fondo/60 sm:grid-cols-[130px_minmax(0,1fr)_104px_200px_24px] sm:gap-x-5">
                      <p className="col-span-2 text-base text-pt-texto sm:col-span-1">{formatoFecha(diaDeRegistro(c.fecha), "medio")}</p>
                      <div className="min-w-0">
                        <button type="button" onClick={() => setAbiertaId(c.id)} aria-label={`Ver el detalle de tu compra ${numeroComprobante(c.numero)}`} className="-my-3 block max-w-full py-3 text-left text-base font-semibold leading-snug text-pt-marino cursor-pointer after:absolute after:inset-0 after:content-['']">{titulo}</button>
                        <p className="text-base leading-snug text-pt-texto">{sub}</p>
                      </div>
                      <p data-col="monto" className="text-right text-lg font-bold tabular-nums text-pt-marino sm:order-none">{dinero(c.total)}</p>
                      <div data-col="estado" className="justify-self-start sm:justify-self-stretch"><Insignia tono={debe ? "ambar" : "verde"}>{debe ? "Con saldo" : entregada ? "Pagada y entregada" : "Pagada"}</Insignia></div>
                      <ChevronRight size={22} className="hidden shrink-0 text-slate-500 sm:block" aria-hidden="true" />
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-4 text-base leading-snug text-pt-texto">Al abrir una compra puedes descargar su factura o solicitar un ajuste o la garantía. Guarda tus facturas: la ley pide conservarlas 7 años.</p>
          </section>
        </>
      )}
      {abierta && (() => {
        const c = abierta
        const lentes = ordenes.filter((o) => o.facturaId === c.id)
        const fe = c.factura_electronica
        const debe = c.estado === "pendiente_pago"
        const pct = porcentajeAbonado(c.total, c.abonado)
        const abonos = Array.isArray(c.abonos) ? c.abonos : []
        return (
          <Cascaron pantallaCompletaEnCelular titulo={`Compra ${numeroComprobante(c.numero)}`} subtitulo={formatoFecha(diaDeRegistro(c.fecha), "largoSinDia")} derecha={<Insignia tono={debe ? "ambar" : "verde"}>{debe ? "Con saldo" : "Pagada"}</Insignia>} Icono={Receipt} ancho="max-w-xl" onCerrar={() => setAbiertaId(null)}
            pie={<><span /><button type="button" onClick={() => setAbiertaId(null)} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
            <div className="space-y-4 p-5">
              <section aria-label="Lo que compraste">
                <h3 className="font-heading text-lg font-bold text-pt-marino">Lo que compraste</h3>
                <ul className="mt-2 divide-y divide-pt-borde">
                  {(c.lineas?.length ? c.lineas : [{ descripcion: "Compra", subtotal: c.total }]).map((l, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-lg text-pt-marino"><span className="min-w-0">{l.descripcion}{l.cantidad > 1 ? ` × ${l.cantidad}` : ""}</span>{l.subtotal != null && <span className="shrink-0 font-bold tabular-nums">{dinero(l.subtotal)}</span>}</li>
                  ))}
                  <li className="flex items-baseline justify-between gap-4 py-2 text-lg font-bold text-pt-marino"><span>Total</span><span className="tabular-nums">{dinero(c.total)}</span></li>
                </ul>
              </section>
              {(debe || abonos.length > 1) && (
                <section aria-label="Tus pagos" className="space-y-3 rounded-2xl bg-pt-fondo p-5">
                  <h3 className="font-heading text-lg font-bold text-pt-marino">Tus pagos</h3>
                  {debe && <div role="img" aria-label={`Has abonado el ${pct} por ciento`}><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-pt-azul" style={{ width: pct + "%" }} /></div></div>}
                  {debe && <p className="text-lg text-pt-marino">Abonaste <span className="font-bold tabular-nums">{dinero(c.abonado)}</span> de <span className="font-bold tabular-nums">{dinero(c.total)}</span> · <span className="font-bold text-pt-ambar">debes {dinero(c.saldo)}</span></p>}
                  {abonos.length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-pt-texto">Historial de abonos</h4>
                      <ul className="mt-1 divide-y divide-pt-borde">{abonos.map((a, i) => <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-base text-pt-marino"><span>{formatoFecha(a.fecha, "largoSinDia")}</span><span className="font-bold tabular-nums">{dinero(a.monto)}</span></li>)}</ul>
                    </div>
                  )}
                  {debe && abonos.length === 0 && Number(c.abonado) > 0 && <p className="text-base text-pt-texto">En total has abonado {dinero(c.abonado)}.</p>}
                  {debe && contacto && <p className="text-base text-pt-texto">Puedes pagar el saldo en la óptica{cuando}, en efectivo, con tarjeta o por transferencia.</p>}
                </section>
              )}
              {lentes.length > 0 && (
                <section aria-label="Estado de tus lentes" className="space-y-3">
                  <h3 className="font-heading text-lg font-bold text-pt-marino">Estado de tus lentes</h3>
                  {lentes.map((o) => (
                    <div key={o.id} className="rounded-2xl border border-pt-borde p-4">
                      <PasosLentes orden={o} variante="lista" />
                    </div>
                  ))}
                </section>
              )}
              <section aria-label="Factura" className="space-y-3">
                <h3 className="font-heading text-lg font-bold text-pt-marino">Factura</h3>
                {fe ? <p className="text-lg text-slate-800">Factura electrónica <span className="tabular-nums">{fe.numero}</span></p> : <p className="text-lg text-pt-texto">Tu óptica todavía no registró la factura electrónica de esta compra.</p>}
                {fe && !fe.pdf && !fe.xml && <p className="text-base text-pt-texto">Tu óptica todavía no subió los archivos de tu factura electrónica.</p>}
                <div className="flex flex-wrap gap-3">
                  {fe?.pdf && <button type="button" onClick={() => descargar(c, "pdf")} disabled={bajando === `${c.id}-pdf`} className={BOTON_SECUNDARIO}>Descargar factura</button>}
                  {fe?.xml && <button type="button" onClick={() => descargar(c, "xml")} disabled={bajando === `${c.id}-xml`} className={BOTON_SECUNDARIO}>Descargar XML</button>}
                  {!debe && onGarantia && <button type="button" onClick={() => { setAbiertaId(null); onGarantia(c) }} className={BOTON_SECUNDARIO}>Solicitar ajuste o garantía</button>}
                </div>
                {errorDescarga && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorDescarga}</p>}
              </section>
            </div>
          </Cascaron>
        )
      })()}
      {errorDescarga && !abierta && <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{errorDescarga}</p>}
    </div>
  )
}
