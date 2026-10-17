"use client"

import { useEffect, useState } from "react"
import { BookOpen, CheckCircle2, MessageSquarePlus } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL } from "../ventas/estilos"
import { GRAD_MARCA } from "@/lib/tema"
import { CampoCapturas } from "./piezas"
import { MODULOS_SOPORTE, TIPOS_CONSULTA, URGENCIAS, codigoConsulta, contextoDeConsulta, tiempoEstimado } from "../../utilidades/soporte"
import { crearConsulta, leerAjustesSoporte } from "../../utilidades/soporteDatos"
import { esAdministrador, textoDeEnvio } from "../../utilidades/comunicacionInterna"
import ContadorMensaje from "../ContadorMensaje"
import { LIMITE_MENSAJE } from "../../utilidades/limiteMensaje"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
const ETIQUETA = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"

// "Nueva consulta": módulo, tipo, urgencia, asunto, descripción y capturas. El sistema agrega solo quién escribe, su rol, la pantalla y el navegador.
// Al enviar, la misma ventana confirma con el número de la consulta y el tiempo estimado de respuesta.
export default function VentanaNuevaConsulta({ usuario, moduloInicial = "otro", pantallaOrigen = "", onCerrar, onVerMisConsultas, onAbrirAyuda }) {
  const [modulo, setModulo] = useState(MODULOS_SOPORTE.some((m) => m.id === moduloInicial) ? moduloInicial : "otro")
  const [tipo, setTipo] = useState("problema")
  const [urgencia, setUrgencia] = useState("normal")
  const [asunto, setAsunto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [archivos, setArchivos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [enviada, setEnviada] = useState(null)
  const [ajustes, setAjustes] = useState({})
  useEffect(() => { leerAjustesSoporte().then((r) => setAjustes(r.datos || {})) }, [])

  const esAdmin = esAdministrador(usuario)
  const textos = textoDeEnvio(usuario)
  const contexto = contextoDeConsulta({ usuario, pantalla: pantallaOrigen })
  const falta = asunto.trim().length < 3 || descripcion.trim().length < 5

  const enviar = async (e) => {
    e.preventDefault()
    if (falta || enviando) return
    setEnviando(true)
    setError("")
    const r = await crearConsulta({ opticaId: usuario.opticaId, modulo, tipo, urgencia, asunto: asunto.trim(), descripcion: descripcion.trim(), contexto, archivos })
    setEnviando(false)
    if (r.error) { setError(r.error); return }
    setEnviada({ numero: r.datos.numero, urgencia })
  }

  if (enviada) {
    return (
      <Cascaron titulo="Consulta enviada" subtitulo={textos.enviada} Icono={CheckCircle2} onCerrar={() => onCerrar(true)} ancho="max-w-md"
        pie={<>
          <span />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => onCerrar(true)} className={BOTON_CERRAR}>Cerrar</button>
            <button type="button" onClick={() => { onCerrar(true); onVerMisConsultas?.() }} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Ver mis consultas</button>
          </div>
        </>}>
        <div role="status" className="space-y-3 px-5 py-6 text-center">
          <p className="text-sm text-slate-500">Número de tu consulta</p>
          <p className="font-mono text-3xl font-bold tracking-wide" style={{ color: INK }}>{codigoConsulta(enviada.numero)}</p>
          {esAdmin
            ? <p className="text-sm text-slate-600">Te respondemos <strong>{tiempoEstimado(enviada.urgencia, ajustes)}</strong>. Cuando respondan, te avisamos en la campanita y verás la respuesta en «Soporte del sistema».</p>
            : <p className="text-sm text-slate-600">Tu administrador la verá y te responderá. Cuando responda, te avisamos en la campanita y verás la respuesta en «Mis consultas».</p>}
        </div>
      </Cascaron>
    )
  }

  return (
    <Cascaron titulo="Nueva consulta" subtitulo={textos.subtitulo} Icono={MessageSquarePlus} onCerrar={() => onCerrar(false)} ancho="max-w-2xl" formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={() => onCerrar(false)} etiquetaGuardar="Enviar consulta" guardando={enviando} deshabilitado={falta} nota="Se envía con tu nombre, tu rol, la pantalla y el navegador." />}>
      <div className="space-y-5 px-5 py-4">
        {onAbrirAyuda && (
          <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-blue-50/60 px-3.5 py-2.5 text-sm text-slate-600">
            <BookOpen size={15} className="text-blue-700" aria-hidden="true" />
            <span>¿Ya buscaste en la ayuda?</span>
            <button type="button" onClick={() => onAbrirAyuda(asunto.trim())} className="font-semibold text-blue-700 underline-offset-2 hover:underline cursor-pointer">Buscar en la ayuda</button>
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="soporte-modulo" className={ETIQUETA}>¿De qué módulo es?</label>
            <select id="soporte-modulo" value={modulo} onChange={(e) => setModulo(e.target.value)} className={CAMPO}>
              {MODULOS_SOPORTE.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className={ETIQUETA}>Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS_CONSULTA.map((t) => (
                <label key={t.id} title={t.ayuda} className={"cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " + (tipo === t.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}>
                  <input type="radio" name="soporte-tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} className="sr-only" /> {t.nombre}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className={ETIQUETA}>Urgencia</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {URGENCIAS.map((u) => (
              <label key={u.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors " + (urgencia === u.id ? (u.id === "urgente" ? "border-red-400 bg-red-50/60" : "border-blue-500 bg-blue-50/60") : "border-slate-200/60 hover:bg-slate-50")}>
                <input type="radio" name="soporte-urgencia" value={u.id} checked={urgencia === u.id} onChange={() => setUrgencia(u.id)} className={"mt-1 h-4 w-4 shrink-0 " + (u.id === "urgente" ? "accent-red-600" : "accent-blue-600")} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold" style={{ color: INK }}>{u.nombre}</span>
                  <span className="block text-xs text-slate-500">{u.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="soporte-asunto" className={ETIQUETA}>Asunto</label>
          <input id="soporte-asunto" value={asunto} maxLength={120} onChange={(e) => setAsunto(e.target.value)} placeholder="Ej. No puedo cobrar un abono" className={CAMPO} />
        </div>
        <div>
          <label htmlFor="soporte-descripcion" className={ETIQUETA}>Descripción</label>
          <textarea id="soporte-descripcion" rows={5} value={descripcion} maxLength={LIMITE_MENSAJE} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Qué intentabas hacer, qué pasó y qué esperabas que pasara?" className={CAMPO + " resize-none"} />
          <ContadorMensaje valor={descripcion} />
        </div>
        <div>
          <p className={ETIQUETA}>Archivos adjuntos <span className="font-normal normal-case text-slate-500">(opcional)</span></p>
          <CampoCapturas archivos={archivos} onCambiar={setArchivos} deshabilitado={enviando} />
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500 sm:grid-cols-2">
          <div className="flex gap-1.5"><dt className="font-semibold">Escribe:</dt><dd className="truncate">{contexto.quien || "—"} · {contexto.rol}</dd></div>
          <div className="flex gap-1.5"><dt className="font-semibold">Pantalla:</dt><dd className="truncate">{contexto.pantalla}</dd></div>
          <div className="flex gap-1.5 sm:col-span-2"><dt className="font-semibold">Navegador:</dt><dd className="truncate">{contexto.navegador}</dd></div>
        </dl>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
