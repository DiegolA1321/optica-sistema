"use client"

import { useState } from "react"
import { Download, Receipt, Wallet, MapPin } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../utilidades/formatoMoneda"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { numeroComprobante } from "../utilidades/comprobantes"
import { urlDeDescargaPaciente } from "../utilidades/facturaElectronicaApi"
import { nombreDeLosLentes } from "../utilidades/portalPaciente"
import { porcentajeAbonado } from "../utilidades/portalVistas"
import { Insignia, TituloPagina, Esqueleto, PasosLentes, Bloque, Baldosa } from "./portal/piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./portal/estilos"

const ETIQUETA = { pagada: "Pagada", pendiente_pago: "Con saldo" }
const TONO = { pagada: "verde", pendiente_pago: "ambar" }

// Portal del paciente, "Mis compras": cada compra es una tarjeta con su número, su fecha, lo que compró, lo que costó, lo que abonó y lo que debe (con su barra de progreso), el
// estado de sus lentes en la línea de pasos y las facturas para descargar. Arriba, si debe algo, «Cómo pagar tu saldo». Solo ve lo suyo: la base valida su sesión, y los archivos
// salen por una función que la vuelve a validar. Los datos los pide el portal una sola vez (los comparte con el Resumen).
export default function MisCompras({ usuario, compras = [], ordenes = [], cargando = false, error = "", contacto = null, onPedirCita }) {
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

  return (
    <div className="space-y-6">
      <TituloPagina subtitulo="Tus comprobantes, el estado de tus lentes y tus facturas electrónicas para descargar.">Mis compras</TituloPagina>

      {cargando ? (
        <div className="space-y-4" aria-busy="true" aria-label="Cargando tus compras">{[0, 1].map((i) => <Esqueleto key={i} alto="h-40" />)}</div>
      ) : error ? (
        <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{error}</p>
      ) : compras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400"><Receipt size={26} aria-hidden="true" /></div>
          <p className="text-xl font-semibold text-slate-700">Todavía no tienes compras registradas</p>
          <p className="mx-auto mt-1 max-w-sm text-lg text-slate-600">Cuando compres en la óptica, tu comprobante aparece aquí.</p>
          {onPedirCita && <button type="button" onClick={() => onPedirCita()} className={BOTON_PRINCIPAL + " mt-4"} style={ESTILO_PRINCIPAL}>Agendar cita</button>}
        </div>
      ) : (
        <>
          {conSaldo.length > 0 && (
            <Bloque id="como-pagar" titulo="Cómo pagar tu saldo" Icono={Wallet} tono="ambar">
              <p className="text-lg text-slate-800">Tienes <span className="font-bold tabular-nums">{dinero(saldoTotal)}</span> por pagar. Puedes pagarlo en la óptica, en efectivo, con tarjeta o por transferencia.</p>
              {contacto && (contacto.hoy || contacto.direccion) && (
                <ul className="mt-2 space-y-1 text-lg text-slate-700">
                  {contacto.hoy && <li className="font-semibold" style={{ color: contacto.hoy.abierto ? "#047857" : "#475569" }}>{contacto.hoy.texto}</li>}
                  {contacto.direccion && <li className="flex items-start gap-2"><MapPin size={20} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> {contacto.direccion}</li>}
                </ul>
              )}
            </Bloque>
          )}
          <ul className="pt-fila pt-fila--dos" aria-label="Mis compras">
            {compras.map((c) => {
              const fe = c.factura_electronica
              const lentes = ordenes.filter((o) => o.facturaId === c.id)
              const debe = c.estado === "pendiente_pago"
              return (
                <li key={c.id} className="min-w-0 space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Baldosa Icono={Receipt} tono={debe ? "ambar" : "verde"} />
                      <div className="min-w-0">
                        <p className="text-lg font-bold tabular-nums" style={{ color: INK }}>{numeroComprobante(c.numero)}</p>
                        <p className="text-base text-slate-600">{fechaLegible(diaDeRegistro(c.fecha))}</p>
                      </div>
                    </div>
                    <Insignia tono={TONO[c.estado] || "gris"}>{ETIQUETA[c.estado] || c.estado}</Insignia>
                  </div>

                  <ul className="flex flex-wrap gap-2" aria-label="Lo que compraste">
                    {(c.lineas.length ? c.lineas : [{ descripcion: "Compra" }]).map((l, i) => <li key={i} className="rounded-full bg-slate-100 px-3.5 py-1.5 text-base font-medium text-slate-700">{l.descripcion}</li>)}
                  </ul>

                  <div>
                    <p className="text-lg text-slate-800">
                      Total <span className="font-heading text-2xl font-bold tabular-nums" style={{ color: INK }}>{dinero(c.total)}</span>
                      {debe && <> · Abonado <span className="font-semibold tabular-nums">{dinero(c.abonado)}</span></>}
                    </p>
                    {debe && (
                      <div className="mt-2">
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`Has abonado el ${porcentajeAbonado(c.total, c.abonado)} por ciento`}><div className="h-full rounded-full bg-emerald-500" style={{ width: porcentajeAbonado(c.total, c.abonado) + "%" }} /></div>
                        <p className="mt-1.5 text-lg font-semibold text-amber-700">Debes <span className="tabular-nums">{dinero(c.saldo)}</span></p>
                      </div>
                    )}
                  </div>

                  {lentes.map((o) => (
                    <div key={o.id} className="space-y-3 rounded-xl bg-slate-50 p-4">
                      <p className="text-lg font-semibold leading-snug text-slate-800">{nombreDeLosLentes(o)}</p>
                      <PasosLentes orden={o} vertical />
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    {fe?.pdf && <button type="button" onClick={() => descargar(c, "pdf")} disabled={bajando === `${c.id}-pdf`} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Factura (PDF)</button>}
                    {fe?.xml && <button type="button" onClick={() => descargar(c, "xml")} disabled={bajando === `${c.id}-xml`} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> XML</button>}
                    {!fe?.pdf && !fe?.xml && <p className="text-base text-slate-600">{fe ? "Tu óptica todavía no subió los archivos de tu factura electrónica." : "Tu óptica todavía no registró la factura electrónica de esta compra."}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {errorDescarga && <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{errorDescarga}</p>}
      <p className="text-base text-slate-600">Solo ves tus compras. Las facturas electrónicas se conservan por 7 años: guarda tu copia.</p>
    </div>
  )
}
