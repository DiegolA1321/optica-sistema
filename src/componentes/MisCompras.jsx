"use client"

import { useEffect, useState } from "react"
import { Download, Receipt } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../utilidades/formatoMoneda"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { numeroComprobante } from "../utilidades/comprobantes"
import { misCompras, urlDeDescargaPaciente } from "../utilidades/facturaElectronicaApi"

const ETIQUETA = { pagada: "Pagada", pendiente_pago: "Con saldo" }
const CLASE = { pagada: "border-emerald-200/60 bg-emerald-50 text-emerald-700", pendiente_pago: "border-amber-200/60 bg-amber-50 text-amber-700" }

// Portal del paciente, "Mis compras": sus comprobantes (con lo que debe y lo abonado, si tienen saldo) y, en los que la óptica ya registró su factura
// electrónica, el PDF y el XML para descargar. Solo ve lo suyo: la base valida su sesión, y los archivos salen por una función que la vuelve a validar.
export default function MisCompras({ usuario, onPedirCita }) {
  const [estado, setEstado] = useState({ cargando: true, compras: [], error: "" })
  const [bajando, setBajando] = useState("")
  const [errorDescarga, setErrorDescarga] = useState("")

  useEffect(() => {
    let vivo = true
    misCompras(typeof usuario?.id === "string" ? usuario.id : null, usuario?.token).then(({ compras, error }) => { if (vivo) setEstado({ cargando: false, compras, error: error || "" }) })
    return () => { vivo = false }
  }, [usuario?.id, usuario?.token])

  const descargar = async (compra, tipo) => {
    setBajando(`${compra.id}-${tipo}`)
    setErrorDescarga("")
    const { url, error } = await urlDeDescargaPaciente({ pacienteId: usuario.id, token: usuario.token, facturaId: compra.id, tipo })
    setBajando("")
    if (error) { setErrorDescarga(error); return }
    const a = document.createElement("a")
    a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Mis compras</h1>
        <p className="text-sm text-slate-500">Tus comprobantes y tus facturas electrónicas, para descargar cuando las necesites.</p>
      </div>

      {estado.cargando ? (
        <div className="space-y-3" aria-busy="true" aria-label="Cargando tus compras">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-slate-200/70" />)}</div>
      ) : estado.error ? (
        <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{estado.error}</p>
      ) : estado.compras.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400"><Receipt size={26} aria-hidden="true" /></div>
          <p className="text-base font-semibold text-slate-600">Todavía no tienes compras registradas</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Cuando compres en la óptica, tu comprobante aparece aquí.</p>
          {onPedirCita && <button type="button" onClick={onPedirCita} className="mt-3 text-sm font-semibold text-blue-600 hover:underline cursor-pointer">Pedir una cita</button>}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Mis compras">
          {estado.compras.map((c) => {
            const fe = c.factura_electronica
            return (
              <li key={c.id} className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold" style={{ color: INK }}>
                    <span className="font-mono">{numeroComprobante(c.numero)}</span>
                    <span className="font-medium text-slate-500">· {fechaLegible(diaDeRegistro(c.fecha))}</span>
                    <span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + CLASE[c.estado]}>{ETIQUETA[c.estado] || c.estado}</span>
                  </p>
                  <p className="truncate text-sm text-slate-500" title={c.lineas.map((l) => l.descripcion).join(", ")}>{c.lineas.map((l) => l.descripcion).join(" · ") || "Compra"}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Total <span className="font-mono font-semibold">{dinero(c.total)}</span>
                    {c.estado === "pendiente_pago" && <> · Abonado <span className="font-mono font-semibold">{dinero(c.abonado)}</span> · <span className="font-semibold text-amber-700">Debes <span className="font-mono">{dinero(c.saldo)}</span></span></>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {fe?.pdf && <button type="button" onClick={() => descargar(c, "pdf")} disabled={bajando === `${c.id}-pdf`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60"><Download size={14} aria-hidden="true" /> Factura (PDF)</button>}
                  {fe?.xml && <button type="button" onClick={() => descargar(c, "xml")} disabled={bajando === `${c.id}-xml`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60"><Download size={14} aria-hidden="true" /> XML</button>}
                  {!fe?.pdf && !fe?.xml && <p className="max-w-[16rem] text-sm text-slate-500 sm:text-right">{fe ? "Tu óptica todavía no subió los archivos de tu factura electrónica." : "Tu óptica todavía no registró la factura electrónica de esta compra."}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {errorDescarga && <p role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorDescarga}</p>}
      <p className="text-xs text-slate-500">Solo ves tus compras. Las facturas electrónicas se conservan por 7 años: guarda tu copia.</p>
    </div>
  )
}
