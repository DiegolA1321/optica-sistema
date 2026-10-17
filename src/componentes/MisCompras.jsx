"use client"

import { useState } from "react"
import { Download, Receipt, Glasses } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../utilidades/formatoMoneda"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { numeroComprobante } from "../utilidades/comprobantes"
import { urlDeDescargaPaciente } from "../utilidades/facturaElectronicaApi"
import { textoOrdenPaciente, nombreDeLosLentes } from "../utilidades/portalPaciente"
import { Insignia, TituloPagina, Esqueleto } from "./portal/piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./portal/estilos"

const ETIQUETA = { pagada: "Pagada", pendiente_pago: "Con saldo" }
const TONO = { pagada: "verde", pendiente_pago: "ambar" }

// Portal del paciente, "Mis compras": sus comprobantes (con lo que debe y lo abonado, si tienen saldo), el estado de las órdenes de laboratorio de cada compra
// y, en los que la óptica ya registró su factura electrónica, el PDF y el XML para descargar. Solo ve lo suyo: la base valida su sesión, y los archivos salen
// por una función que la vuelve a validar. Los datos los pide el portal una sola vez (los comparte con el Resumen).
export default function MisCompras({ usuario, compras = [], ordenes = [], cargando = false, error = "", onPedirCita }) {
  const [bajando, setBajando] = useState("")
  const [errorDescarga, setErrorDescarga] = useState("")

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
    <div className="space-y-5">
      <TituloPagina subtitulo="Tus comprobantes, el estado de tus lentes y tus facturas electrónicas para descargar.">Mis compras</TituloPagina>

      {cargando ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando tus compras">{[0, 1].map((i) => <Esqueleto key={i} alto="h-28" />)}</div>
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
        <ul className="space-y-4" aria-label="Mis compras">
          {compras.map((c) => {
            const fe = c.factura_electronica
            const lentes = ordenes.filter((o) => o.facturaId === c.id)
            return (
              <li key={c.id} className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold" style={{ color: INK }}>
                      <span className="tabular-nums">{numeroComprobante(c.numero)}</span>
                      <span className="font-medium text-slate-600">· {fechaLegible(diaDeRegistro(c.fecha))}</span>
                      <Insignia tono={TONO[c.estado] || "gris"}>{ETIQUETA[c.estado] || c.estado}</Insignia>
                    </p>
                    <p className="mt-1 break-words text-lg text-slate-700">{c.lineas.map((l) => l.descripcion).join(" · ") || "Compra"}</p>
                    <p className="mt-1 text-lg text-slate-800">
                      Total <span className="font-semibold tabular-nums">{dinero(c.total)}</span>
                      {c.estado === "pendiente_pago" && <> · Abonado <span className="font-semibold tabular-nums">{dinero(c.abonado)}</span> · <span className="font-semibold text-amber-700">Debes <span className="tabular-nums">{dinero(c.saldo)}</span></span></>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    {fe?.pdf && <button type="button" onClick={() => descargar(c, "pdf")} disabled={bajando === `${c.id}-pdf`} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Factura (PDF)</button>}
                    {fe?.xml && <button type="button" onClick={() => descargar(c, "xml")} disabled={bajando === `${c.id}-xml`} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> XML</button>}
                    {!fe?.pdf && !fe?.xml && <p className="max-w-[18rem] text-base text-slate-600 sm:text-right">{fe ? "Tu óptica todavía no subió los archivos de tu factura electrónica." : "Tu óptica todavía no registró la factura electrónica de esta compra."}</p>}
                  </div>
                </div>
                {lentes.map((o) => {
                  const t = textoOrdenPaciente(o)
                  return (
                    <div key={o.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                      <Glasses size={22} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-lg font-semibold text-slate-800">{nombreDeLosLentes(o)}</p>
                        <Insignia tono={t.tono}>{t.titulo}</Insignia>
                        <p className="text-lg text-slate-700">{t.detalle}</p>
                      </div>
                    </div>
                  )
                })}
              </li>
            )
          })}
        </ul>
      )}
      {errorDescarga && <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-lg font-medium text-red-700">{errorDescarga}</p>}
      <p className="text-base text-slate-600">Solo ves tus compras. Las facturas electrónicas se conservan por 7 años: guarda tu copia.</p>
    </div>
  )
}
