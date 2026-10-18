"use client"

import { useState } from "react"
import { ChevronRight, Glasses, Check } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { Cascaron } from "../AtencionPaciente"
import { Insignia } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// «Solicitar lentes nuevos» (Mis compras): el paciente avisa a la óptica qué le interesa. No es un carrito: elige UNA opción, puede dejar un comentario y la solicitud le llega a quien vende
// (en «Por vender», marcada «Desde el portal»). Aquí mismo ve en qué va: Recibida, En atención o Atendida (todo lo que ya se cerró, se haya comprado o no).
export const INTERESES = [
  { id: "lentes_con_receta", nombre: "Lentes con mi receta vigente", texto: "Lentes nuevos con la graduación de tu última receta." },
  { id: "montura_nueva", nombre: "Una montura nueva", texto: "Quieres cambiar de marco para tus lentes." },
  { id: "lentes_de_sol", nombre: "Lentes de sol", texto: "Con tu graduación o sin ella." },
  { id: "lentes_de_contacto", nombre: "Lentes de contacto", texto: "Para usar en lugar de tus lentes." },
]
export const nombreDeInteres = (id) => INTERESES.find((i) => i.id === id)?.nombre || "Lentes nuevos"

export const ESTADOS_SOLICITUD = {
  recibida: { nombre: "Recibida", tono: "azul", texto: "La óptica recibió tu solicitud y te contactará pronto." },
  en_atencion: { nombre: "En atención", tono: "violeta", texto: "Alguien de la óptica ya está atendiendo tu solicitud." },
  atendida: { nombre: "Atendida", tono: "verde", texto: "La óptica ya atendió tu solicitud." },
}

function VentanaSolicitar({ recetaVigente, onEnviar, onCerrar }) {
  const [interes, setInteres] = useState("")
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const enviar = async () => {
    if (!interes) { setError("Elige qué te interesa."); return }
    setEnviando(true)
    setError("")
    const r = await onEnviar(interes, comentario)
    setEnviando(false)
    if (!r.ok) { setError(r.error); return }
    onCerrar()
  }
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Solicitar lentes nuevos" subtitulo="Cuéntanos qué te interesa y la óptica te contactará." Icono={Glasses} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cancelar</button><button type="button" onClick={enviar} disabled={enviando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{enviando ? "Enviando…" : "Enviar solicitud"}</button></>}>
      <div className="space-y-4 p-5">
        <div role="radiogroup" aria-label="¿Qué te interesa?" className="space-y-2.5">
          {INTERESES.map((i) => {
            const elegido = interes === i.id
            return (
              <button key={i.id} type="button" role="radio" aria-checked={elegido} onClick={() => { setInteres(i.id); setError("") }}
                className={"flex min-h-14 w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left transition-colors cursor-pointer " + (elegido ? "border-pt-azul bg-pt-suave" : "border-pt-borde bg-white hover:bg-pt-fondo")}>
                <span className={"grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 " + (elegido ? "border-pt-azul bg-pt-azul text-white" : "border-slate-300")} aria-hidden="true">{elegido && <Check size={14} strokeWidth={3} />}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold leading-snug text-pt-marino">{i.nombre}</span>
                  <span className="block text-base leading-snug text-pt-texto">{i.id === "lentes_con_receta" && recetaVigente ? `Con la graduación de tu receta del ${formatoFecha(recetaVigente.fecha, "largoSinDia")}.` : i.texto}</span>
                </span>
              </button>
            )
          })}
        </div>
        <label className="block text-base font-semibold text-pt-marino">¿Algo más que quieras contarnos? <span className="font-normal text-pt-texto">(opcional)</span>
          <textarea rows={3} maxLength={300} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Por ejemplo: busco un marco liviano y de color oscuro."
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
        </label>
        <p className="text-base text-pt-texto">No es una compra: la óptica te escribirá para ayudarte a elegir y decirte el precio.</p>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}

function VentanaSolicitud({ solicitud, onCerrar }) {
  const e = ESTADOS_SOLICITUD[solicitud.estado] || ESTADOS_SOLICITUD.recibida
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu solicitud" subtitulo={nombreDeInteres(solicitud.interes)} Icono={Glasses} ancho="max-w-md" derecha={<Insignia tono={e.tono}>{e.nombre}</Insignia>} onCerrar={onCerrar}
      pie={<><span /><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
      <div className="space-y-3 p-5 text-lg text-pt-marino">
        <p>{e.texto}</p>
        <dl className="divide-y divide-pt-borde rounded-2xl border border-pt-borde px-4">
          <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-base text-pt-texto">Enviada el</dt><dd className="font-semibold">{formatoFecha(diaDeRegistro(solicitud.creada), "largoSinDia")}</dd></div>
          {solicitud.estado === "atendida" && solicitud.cerrada && <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-base text-pt-texto">Atendida el</dt><dd className="font-semibold">{formatoFecha(diaDeRegistro(solicitud.cerrada), "largoSinDia")}</dd></div>}
          {solicitud.comentario && <div className="py-3"><dt className="text-base text-pt-texto">Tu comentario</dt><dd className="mt-0.5">{solicitud.comentario}</dd></div>}
        </dl>
      </div>
    </Cascaron>
  )
}

// `solicitudes`: { disponible, lista } (la base todavía puede no tenerlo: entonces no se ofrece). `onSolicitar(interes, comentario)` → { ok, error }.
export default function TarjetaSolicitarLentes({ solicitudes, onSolicitar, recetaVigente = null }) {
  const [pidiendo, setPidiendo] = useState(false)
  const [abierta, setAbierta] = useState(null)
  if (!solicitudes?.disponible) return null
  const lista = solicitudes.lista || []
  const enCurso = lista.some((s) => s.estado !== "atendida")
  return (
    <section aria-labelledby="solicitar-lentes" className="rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[30px] sm:py-6">
      <div className="flex flex-col gap-4 @[760px]/portal:flex-row @[760px]/portal:items-center @[760px]/portal:justify-between @[760px]/portal:gap-8">
        <div className="min-w-0">
          <h2 id="solicitar-lentes" className="font-heading text-xl font-bold text-pt-marino">¿Necesitas lentes nuevos?</h2>
          <p className="mt-1 text-base text-pt-texto">{enCurso ? "Ya tienes una solicitud en curso: la óptica te contactará pronto." : "Cuéntanos qué te interesa y la óptica te contactará. No es una compra."}</p>
        </div>
        <button type="button" onClick={() => setPidiendo(true)} disabled={enCurso} className={BOTON_PRINCIPAL + " w-full shrink-0 @[760px]/portal:w-auto"} style={ESTILO_PRINCIPAL}>Solicitar lentes nuevos</button>
      </div>
      {lista.length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-semibold text-pt-texto">Tus solicitudes</h3>
          <ul aria-label="Tus solicitudes de lentes" data-lista="solicitudes" className="mt-1 divide-y divide-pt-borde">
            {lista.map((s) => {
              const e = ESTADOS_SOLICITUD[s.estado] || ESTADOS_SOLICITUD.recibida
              return (
                <li key={s.id} data-fila className="pt-abrible relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-3.5 pr-9 transition-colors hover:bg-pt-fondo/60 sm:grid-cols-[130px_minmax(0,1fr)_150px] sm:pr-10">
                  <p className="col-span-2 text-base text-pt-texto sm:col-span-1">{formatoFecha(diaDeRegistro(s.creada), "medio")}</p>
                  <button type="button" onClick={() => setAbierta(s)} aria-haspopup="dialog" aria-label={`Ver tu solicitud del ${formatoFecha(diaDeRegistro(s.creada), "medio")}: ${nombreDeInteres(s.interes)}, ${e.nombre}`} className="min-w-0 text-left text-base font-semibold leading-snug text-pt-marino cursor-pointer after:absolute after:inset-0 after:content-['']">{nombreDeInteres(s.interes)}</button>
                  <div data-col="estado"><Insignia tono={e.tono}>{e.nombre}</Insignia></div>
                  <ChevronRight size={22} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {pidiendo && <VentanaSolicitar recetaVigente={recetaVigente} onEnviar={onSolicitar} onCerrar={() => setPidiendo(false)} />}
      {abierta && <VentanaSolicitud solicitud={lista.find((s) => s.id === abierta.id) || abierta} onCerrar={() => setAbierta(null)} />}
    </section>
  )
}
