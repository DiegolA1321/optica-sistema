"use client"

import { useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import CampoFecha from "../CampoFecha"
import { CANALES, DESCANSO_AGENDO, DESCANSO_NO_LE_INTERESA, ETIQUETA_MOTIVO, ORDEN_RESULTADOS, REINTENTO_NO_RESPONDIO, RESULTADOS, fechaEnDias } from "../../utilidades/crmContactos"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { hoyISO } from "../../utilidades/disponibilidad"

const AYUDA = {
  agendo: `Queda resuelto y no vuelve a aparecer por este motivo en ${DESCANSO_AGENDO} días.`,
  no_respondio: `Vuelve a aparecer en ${REINTENTO_NO_RESPONDIO} días.`,
  volver_a_contactar: "Tú eliges cuándo: reaparece solo ese día.",
  no_le_interesa: `No vuelve a aparecer por este motivo en ${Math.round(DESCANSO_NO_LE_INTERESA / 30)} meses.`,
  no_desea_mensajes: "No se le vuelve a escribir (ni recordatorios ni promociones). Queda en su perfil y se puede cambiar ahí.",
}
const DIAS_RAPIDOS = [3, 7, 15, 30]

// "Registrar resultado": qué pasó con un contacto. Si ya se le escribió (hay un contacto sin resultado) se anota en ese contacto;
// si no (por ejemplo una llamada o una visita), se registra el contacto y su resultado de una vez, diciendo el canal.
export default function VentanaResultado({ paciente, motivo, contacto = null, onGuardar, onCerrar }) {
  const [canal, setCanal] = useState(contacto?.canal || "whatsapp")
  const [resultado, setResultado] = useState("")
  const [volverEl, setVolverEl] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const hoy = hoyISO()
  const falta = !resultado || (resultado === "volver_a_contactar" && !volverEl)

  const enviar = async (e) => {
    e.preventDefault()
    if (falta || guardando) return
    setGuardando(true)
    setError("")
    const r = await onGuardar({ canal, resultado, volverEl: resultado === "volver_a_contactar" ? volverEl : null })
    if (r && r.ok === false) { setError(r.error || "No se pudo guardar. Intenta de nuevo."); setGuardando(false) }
  }

  return (
    <Cascaron
      titulo="Registrar resultado"
      subtitulo={`${paciente.nombre} · ${ETIQUETA_MOTIVO[motivo] || motivo}`}
      Icono={ClipboardCheck}
      onCerrar={onCerrar}
      ancho="max-w-xl"
      formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Guardar resultado" guardando={guardando} deshabilitado={falta} />}
    >
      <div className="space-y-5 px-5 py-4">
        {contacto ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">Se le escribió por {CANALES[contacto.canal] || contacto.canal} el {fechaLegible(diaDeRegistro(contacto.creadoEn))}. ¿Qué pasó?</p>
        ) : (
          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">¿Cómo lo contactaste?</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CANALES).map(([id, etiqueta]) => (
                <label key={id} className={"cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors " + (canal === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}>
                  <input type="radio" name="canal" value={id} checked={canal === id} onChange={() => setCanal(id)} className="sr-only" />{etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">¿Qué pasó?</legend>
          <div className="space-y-2">
            {ORDEN_RESULTADOS.map((id) => (
              <label key={id} className={"flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors " + (resultado === id ? "border-blue-500 bg-blue-50/60" : "border-slate-200/60 hover:bg-slate-50")}>
                <input type="radio" name="resultado" value={id} checked={resultado === id} onChange={() => setResultado(id)} className="mt-1 h-4 w-4 accent-blue-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold" style={{ color: INK }}>{RESULTADOS[id].etiqueta}</span>
                  <span className="block text-sm text-slate-500">{AYUDA[id]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {resultado === "volver_a_contactar" && (
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Volver a contactar en</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_RAPIDOS.map((n) => {
                const f = fechaEnDias(n, hoy)
                return (
                  <button key={n} type="button" onClick={() => setVolverEl(f)} aria-pressed={volverEl === f} className={"rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer " + (volverEl === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}>
                    {n} días
                  </button>
                )
              })}
            </div>
            <div className="max-w-xs">
              <CampoFecha id="crm-volver" etiqueta="O elige otra fecha" valor={volverEl} onCambiar={setVolverEl} min={fechaEnDias(1, hoy)} max={fechaEnDias(365, hoy)} placeholder="Elige otra fecha" />
            </div>
            {volverEl && <p className="text-sm text-slate-600">Reaparecerá en la lista el {fechaLegible(volverEl)}.</p>}
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
