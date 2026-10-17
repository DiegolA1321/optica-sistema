"use client"

import { useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import CampoFecha from "../CampoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { DESTINOS_AVISO } from "../../utilidades/comunicacionInterna"
import { leerDestinatariosDeAvisos, publicarAvisoInterno } from "../../utilidades/soporteDatos"
import ContadorMensaje from "../ContadorMensaje"
import { LIMITE_MENSAJE } from "../../utilidades/limiteMensaje"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
const ETIQUETA = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"

// "Nuevo aviso": el administrador escribe un aviso para todo su personal, para un rol o para una persona, con vencimiento opcional.
// Los roles y las personas se leen de la óptica; el servidor vuelve a comprobar que sean de ella.
export default function VentanaNuevoAviso({ usuario, onCerrar, onPublicado }) {
  const [titulo, setTitulo] = useState("")
  const [cuerpo, setCuerpo] = useState("")
  const [para, setPara] = useState("todos")
  const [rolId, setRolId] = useState("")
  const [perfilId, setPerfilId] = useState("")
  const [venceEl, setVenceEl] = useState("")
  const [destinatarios, setDestinatarios] = useState({ roles: [], personas: [] })
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { leerDestinatariosDeAvisos(usuario.opticaId).then((r) => { setDestinatarios(r); setCargando(false) }) }, [usuario.opticaId])

  const falta = titulo.trim().length < 3 || !cuerpo.trim() || (para === "rol" && !rolId) || (para === "persona" && !perfilId)

  const publicar = async (e) => {
    e.preventDefault()
    if (falta || enviando) return
    setEnviando(true)
    setError("")
    const r = await publicarAvisoInterno({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), para, rolId: para === "rol" ? rolId : null, perfilId: para === "persona" ? perfilId : null, venceEl: venceEl || null })
    setEnviando(false)
    if (r.error) { setError(r.error); return }
    onPublicado?.()
    onCerrar()
  }

  return (
    <Cascaron titulo="Nuevo aviso" subtitulo="Lo verá tu personal en la campanita y en Avisos" Icono={Megaphone} onCerrar={onCerrar} ancho="max-w-xl" formulario={{ onSubmit: publicar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Publicar aviso" guardando={enviando} deshabilitado={falta} nota="Verás quién lo leyó." />}>
      <div className="space-y-4 px-5 py-4">
        <div>
          <label htmlFor="aviso-titulo" className={ETIQUETA}>Título</label>
          <input id="aviso-titulo" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Mañana cerramos a las 5 p. m." className={CAMPO} />
        </div>
        <div>
          <label htmlFor="aviso-cuerpo" className={ETIQUETA}>Mensaje</label>
          <textarea id="aviso-cuerpo" rows={4} value={cuerpo} maxLength={LIMITE_MENSAJE} onChange={(e) => setCuerpo(e.target.value)} placeholder="Escribe el aviso…" className={CAMPO + " resize-none"} />
          <ContadorMensaje valor={cuerpo} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="aviso-para" className={ETIQUETA}>Para</label>
            <select id="aviso-para" value={para} onChange={(e) => { setPara(e.target.value); setRolId(""); setPerfilId("") }} className={CAMPO}>
              {DESTINOS_AVISO.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          {para === "rol" && (
            <div>
              <label htmlFor="aviso-rol" className={ETIQUETA}>Rol</label>
              <select id="aviso-rol" value={rolId} onChange={(e) => setRolId(e.target.value)} disabled={cargando} className={CAMPO}>
                <option value="">{cargando ? "Cargando…" : "Elige un rol"}</option>
                {destinatarios.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}
          {para === "persona" && (
            <div>
              <label htmlFor="aviso-persona" className={ETIQUETA}>Persona</label>
              <select id="aviso-persona" value={perfilId} onChange={(e) => setPerfilId(e.target.value)} disabled={cargando} className={CAMPO}>
                <option value="">{cargando ? "Cargando…" : "Elige a quién"}</option>
                {destinatarios.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <span id="aviso-vence-rotulo" className={ETIQUETA}>Vence el <span className="font-normal normal-case text-slate-500">(opcional)</span></span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[12rem]"><CampoFecha id="aviso-vence" valor={venceEl} onCambiar={setVenceEl} min={hoyISO()} max="2100-12-31" placeholder="Sin vencimiento" etiqueta="Vence el" /></div>
            {venceEl && <button type="button" onClick={() => setVenceEl("")} className="text-sm font-semibold text-blue-700 hover:underline cursor-pointer">Quitar</button>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Después de esa fecha el personal deja de verlo; tú lo sigues viendo.</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
