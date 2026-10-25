import { useState } from "react"
import { MapPin, ExternalLink, CheckCircle2 } from "lucide-react"
import { datosOpticaProforma } from "../../utilidades/proforma"
import { MAPA_VACIO, mapaGuardado, resolverEnlaceMapa } from "../../utilidades/enlaceMapa"

const INK = "#0E2B33"
const GRADIENTE = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Dirección, teléfono y mapa de la óptica: un solo lugar, el que ve el paciente. Alimenta la página pública (Contacto, mapa y «Cómo llegar»),
// el agendamiento, el portal del paciente y los documentos impresos. La óptica solo pega el enlace de Google Maps (Compartir → Copiar enlace).
export default function DatosOptica({ parametrizacion, setParametrizacion, onExito, onError }) {
  const g = datosOpticaProforma(parametrizacion)
  const mapa = mapaGuardado(parametrizacion)
  const [borrador, setBorrador] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorEnlace, setErrorEnlace] = useState("")
  const valor = (k, base) => (k in borrador ? borrador[k] : base)
  const hayCambios = Object.keys(borrador).length > 0
  const cambiar = (k) => (e) => { setBorrador((b) => ({ ...b, [k]: e.target.value })); if (k === "enlace") setErrorEnlace("") }
  const clase = "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

  const guardar = async () => {
    setErrorEnlace("")
    setGuardando(true)
    let nuevoMapa = null // null = el enlace no cambió: se conserva lo guardado
    if ("enlace" in borrador) {
      const pegado = borrador.enlace.trim()
      if (!pegado) nuevoMapa = MAPA_VACIO
      else {
        try { nuevoMapa = await resolverEnlaceMapa(pegado) } catch (e) { setErrorEnlace(e.message); setGuardando(false); return }
      }
    }
    const { error } = (await setParametrizacion((prev) => ({
      ...prev,
      opticaDireccion: valor("direccion", g.direccion).trim(),
      opticaTelefono: valor("telefono", g.telefono).trim(),
      ...(nuevoMapa || {}),
    }))) || {}
    setGuardando(false)
    if (error) { onError?.("No se pudieron guardar los datos de la óptica. Revisa tu conexión e intenta de nuevo."); return }
    setBorrador({})
    onExito?.("Datos de la óptica guardados correctamente.")
  }

  return (
    <section aria-labelledby="datos-optica" className="mb-5 rounded-xl border border-slate-200/60 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><MapPin size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="datos-optica" className="text-sm font-bold" style={{ color: INK }}>Datos de la óptica</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Aparecen en la página pública (Contacto, mapa y «Cómo llegar»), el agendamiento, el portal del paciente y los documentos que imprimes.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Dirección</span>
              <input value={valor("direccion", g.direccion)} onChange={cambiar("direccion")} maxLength={160} placeholder="Calle, número y ciudad" className={clase} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Teléfono (WhatsApp)</span>
              <input value={valor("telefono", g.telefono)} onChange={cambiar("telefono")} maxLength={40} inputMode="tel" placeholder="09XXXXXXXX" className={clase} />
            </label>
            <div className="sm:col-span-2">
              <label htmlFor="enlace-mapa" className="mb-1 block text-xs font-semibold text-slate-600">Enlace de Google Maps</label>
              <input id="enlace-mapa" value={valor("enlace", mapa?.url || "")} onChange={cambiar("enlace")} maxLength={300} inputMode="url" placeholder="https://maps.app.goo.gl/…" aria-invalid={!!errorEnlace} aria-describedby="ayuda-enlace-mapa" className={clase + (errorEnlace ? " border-rose-400" : "")} />
              <p id="ayuda-enlace-mapa" className={"mt-1 text-xs leading-relaxed " + (errorEnlace ? "font-semibold text-rose-700" : "text-slate-500")} role={errorEnlace ? "alert" : undefined}>
                {errorEnlace || "En Google Maps busca tu óptica, toca «Compartir» y copia el enlace. El mapa de la página pública sale de ahí."}
              </p>
            </div>
          </div>
          {mapa && !("enlace" in borrador) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>Ubicada{mapa.nombre ? `: ${mapa.nombre}` : ""}.</span>
              <a href={mapa.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">Ver en Google Maps <ExternalLink size={12} aria-hidden="true" /></a>
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={guardar} disabled={!hayCambios || guardando} className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRADIENTE }}>
              {guardando ? "Guardando…" : "Guardar datos de la óptica"}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
