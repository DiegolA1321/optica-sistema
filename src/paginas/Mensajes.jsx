import { useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Megaphone, MessageSquare, MessageSquarePlus } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaAyuda from "../componentes/soporte/PestanaAyuda"
import PestanaMisConsultas from "../componentes/soporte/PestanaMisConsultas"
import PestanaAvisos from "../componentes/soporte/PestanaAvisos"
import VentanaNuevaConsulta from "../componentes/soporte/VentanaNuevaConsulta"
import VentanaConsulta from "../componentes/soporte/VentanaConsulta"
import BloqueSuscripcion from "../componentes/soporte/BloqueSuscripcion"
import { CLASE_ACCION_SECUNDARIA } from "../componentes/ventas/estilos"
import { EVENTO_SOPORTE_CAMBIADO, avisarCambioSoporte, leerAvisos, leerMisConsultas, marcarAvisosLeidos } from "../utilidades/soporteDatos"
import { useParamUrl } from "../utilidades/urlEstado"
import { puede } from "../utilidades/permisosUi"

const TABS = ["ayuda", "consultas", "avisos"]
const REFRESCO_MS = 45_000

// Soporte: el usuario encuentra ayuda antes de escribir (Ayuda); si escribe, su consulta tiene número, módulo, urgencia y estado, y se conversa hasta
// resolverla (Mis consultas); y lee los anuncios del soporte (Avisos del sistema). "Nueva consulta" es la acción principal de la cabecera.
export default function Mensajes({ usuario, pantallaOrigen = "", moduloOrigen = "otro", abrirConsultaId = null, onAbrirConsultaConsumida }) {
  const puedeVer = puede(usuario, "mensajes", "ver")
  // Quien entra a una óptica como superadmin mira, pero no escribe en nombre del administrador.
  const puedeEscribir = puede(usuario, "mensajes", "crear") && !usuario.impersonadoPor
  const [tab, setTab] = useParamUrl("tab", "ayuda", TABS)
  const [consultas, setConsultas] = useState([])
  const [avisos, setAvisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [ventana, setVentana] = useState(null) // "nueva" | { consultaId } | { nueva: true, modulo }

  const recargar = useCallback(async () => {
    const [c, a] = await Promise.all([leerMisConsultas(usuario.opticaId), leerAvisos(usuario.id)])
    setConsultas(c.datos)
    setAvisos(a.datos)
    setError(c.error || a.error || "")
    setCargando(false)
  }, [usuario.id, usuario.opticaId])

  useEffect(() => { recargar() }, [recargar])
  // Una respuesta nueva aparece sin recargar la página: al volver a la pestaña del navegador, cuando algo cambia aquí y cada 45 segundos.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") recargar() }
    window.addEventListener(EVENTO_SOPORTE_CAMBIADO, recargar)
    document.addEventListener("visibilitychange", alVolver)
    const reloj = setInterval(alVolver, REFRESCO_MS)
    return () => { window.removeEventListener(EVENTO_SOPORTE_CAMBIADO, recargar); document.removeEventListener("visibilitychange", alVolver); clearInterval(reloj) }
  }, [recargar])

  // Desde la campanita: abrir directo la consulta que respondieron.
  useEffect(() => {
    if (!abrirConsultaId) return
    setTab("consultas")
    setVentana({ consultaId: abrirConsultaId })
    onAbrirConsultaConsumida?.()
  }, [abrirConsultaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const consultaAbierta = ventana?.consultaId ? consultas.find((c) => c.id === ventana.consultaId) : null
  const avisosSinLeer = avisos.filter((a) => !a.leido).length
  const respuestasNuevas = consultas.filter((c) => c.respuestaSinLeer && c.autorId === usuario.id).length

  const marcarAviso = async (id) => { await marcarAvisosLeidos([id]); await recargar(); avisarCambioSoporte() }
  const marcarTodos = async () => { await marcarAvisosLeidos(null); await recargar(); avisarCambioSoporte() }
  const escribir = (modulo) => setVentana({ nueva: true, modulo: modulo || moduloOrigen })

  const pestanas = useMemo(() => [
    { id: "ayuda", etiqueta: "Ayuda", Icono: BookOpen },
    { id: "consultas", etiqueta: "Mis consultas", cuenta: consultas.length, nuevas: respuestasNuevas, Icono: MessageSquare },
    { id: "avisos", etiqueta: "Avisos del sistema", cuenta: avisos.length, nuevas: avisosSinLeer, Icono: Megaphone },
  ], [consultas.length, respuestasNuevas, avisos.length, avisosSinLeer])

  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><MessageSquare size={24} aria-hidden="true" /></div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Soporte</h1>
        </div>
        <AccionesDeCabecera>
          {puedeEscribir && (
            <button type="button" onClick={() => escribir("")} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <MessageSquarePlus size={18} aria-hidden="true" /> Nueva consulta
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      {MODO_SAAS_VISIBLE && <BloqueSuscripcion usuario={usuario} />}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
          <button type="button" onClick={recargar} className={CLASE_ACCION_SECUNDARIA}>Reintentar</button>
        </div>
      )}

      <div role="tablist" aria-label="Secciones de Soporte" className="flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
        {pestanas.map(({ id, etiqueta, cuenta, nuevas, Icono }) => {
          const activo = tab === id
          return (
            <button key={id} type="button" role="tab" id={`soporte-tab-${id}`} aria-selected={activo} aria-controls="soporte-panel" onClick={() => setTab(id)}
              className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
              style={activo ? { background: GRAD_MARCA } : undefined}>
              <Icono size={14} aria-hidden="true" /> {etiqueta}
              {cuenta !== undefined && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{cuenta}</span>}
              {nuevas > 0 && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white text-blue-700" : "bg-blue-600 text-white")}>{nuevas === 1 ? "1 nueva" : `${nuevas} nuevas`}</span>}
            </button>
          )
        })}
      </div>

      <div id="soporte-panel" role="tabpanel" aria-labelledby={`soporte-tab-${tab}`}>
        {tab === "ayuda" && <PestanaAyuda puedeEscribir={puedeEscribir} onEscribir={escribir} />}
        {tab === "consultas" && (cargando ? <TablaSkeleton /> : puedeVer
          ? <PestanaMisConsultas consultas={consultas} usuario={usuario} puedeEscribir={puedeEscribir} onAbrir={(id) => setVentana({ consultaId: id })} onNueva={() => escribir("")} />
          : <p className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-500">Tu rol no puede ver las consultas al soporte.</p>)}
        {tab === "avisos" && (cargando ? <TablaSkeleton /> : <PestanaAvisos avisos={avisos} onMarcar={marcarAviso} onMarcarTodos={marcarTodos} onVerAyuda={() => setTab("ayuda")} />)}
      </div>

      {(ventana === "nueva" || ventana?.nueva) && (
        <VentanaNuevaConsulta usuario={usuario} moduloInicial={ventana?.modulo || moduloOrigen} pantallaOrigen={pantallaOrigen}
          onCerrar={(enviada) => { setVentana(null); if (enviada) recargar() }} onVerMisConsultas={() => setTab("consultas")} />
      )}
      {consultaAbierta && <VentanaConsulta consulta={consultaAbierta} usuario={usuario} puedeEscribir={puedeEscribir} onCambio={recargar} onCerrar={() => setVentana(null)} />}
    </div>
  )
}
