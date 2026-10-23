import { useCallback, useEffect, useMemo, useState } from "react"
import { MessageSquare, MessageSquarePlus, Plus } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaAyuda from "../componentes/soporte/PestanaAyuda"
import PestanaMisConsultas from "../componentes/soporte/PestanaMisConsultas"
import PestanaAvisos from "../componentes/soporte/PestanaAvisos"
import VentanaNuevaConsulta from "../componentes/soporte/VentanaNuevaConsulta"
import VentanaNuevoAviso from "../componentes/soporte/VentanaNuevoAviso"
import VentanaConsulta from "../componentes/soporte/VentanaConsulta"
import BloqueSuscripcion from "../componentes/soporte/BloqueSuscripcion"
import { CLASE_ACCION_SECUNDARIA } from "../componentes/ventas/estilos"
import { Pestanas } from "../componentes/ventas/Piezas"
import {
  EVENTO_SOPORTE_CAMBIADO, avisarCambioSoporte, leerAvisos, leerAvisosInternos, leerDestinatariosDeAvisos, leerMisConsultas, marcarAvisosInternosLeidos, marcarAvisosLeidos, retirarAvisoInterno,
} from "../utilidades/soporteDatos"
import {
  NOMBRE_PESTANA_CONSULTAS, PESTANAS_SOPORTE, avisosUnificados, consultasDePestana, esAdministrador, pestanaDeConsulta, pestanaValida, pestanasDeSoporte, resumenDeLecturas,
} from "../utilidades/comunicacionInterna"
import { moduloDeAyuda } from "../utilidades/soporteAyuda"
import { useParamUrl } from "../utilidades/urlEstado"
import { puede } from "../utilidades/permisosUi"

const REFRESCO_MS = 45_000

// Soporte, en niveles (como en un soporte profesional):
//   · Quien no es administrador: Mis consultas (a su administrador), Avisos (del sistema y de su administrador) y Ayuda.
//   · El administrador: Consultas del personal (las responde, las resuelve o las escala), Soporte del sistema (sus consultas al superadmin), Avisos (con
//     "Nuevo aviso", para su personal) y Ayuda.
// El servidor decide a quién va cada consulta; aquí solo se muestra. La acción principal de la cabecera cambia con la pestaña.
export default function Mensajes({ usuario, pantallaOrigen = "", moduloOrigen = "otro", abrirConsultaId = null, onAbrirConsultaConsumida }) {
  const puedeVer = puede(usuario, "mensajes", "ver")
  // Quien entra a una óptica como superadmin mira, pero no escribe en nombre del administrador.
  const puedeEscribir = puede(usuario, "mensajes", "crear") && !usuario.impersonadoPor
  const esAdmin = esAdministrador(usuario)
  const [tabGuardada, setTab] = useParamUrl("tab", pestanasDeSoporte(usuario)[0], PESTANAS_SOPORTE)
  const tab = pestanaValida(usuario, tabGuardada)
  const [consultas, setConsultas] = useState([])
  const [avisos, setAvisos] = useState([])
  const [internos, setInternos] = useState({ datos: [], leidos: [], lecturas: [] })
  const [destinatarios, setDestinatarios] = useState({ roles: [], personas: [] })
  const [ayuda, setAyuda] = useState({ clave: 0, texto: "", modulo: "" }) // "¿Ya buscaste en la ayuda?": abre la Ayuda con el buscador listo
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [ventana, setVentana] = useState(null) // "nueva" | "aviso" | { consultaId } | { nueva: true, modulo }

  const recargar = useCallback(async () => {
    const [c, a, i] = await Promise.all([leerMisConsultas(usuario.opticaId), leerAvisos(usuario.id), leerAvisosInternos(usuario.id, esAdmin)])
    setConsultas(c.datos)
    setAvisos(a.datos)
    setInternos({ datos: i.datos, leidos: i.leidos, lecturas: i.lecturas })
    setError(c.error || a.error || i.error || "")
    setCargando(false)
  }, [usuario.id, usuario.opticaId, esAdmin])

  useEffect(() => { recargar() }, [recargar])
  // Para decir "Rol Optómetra" o el nombre de la persona en los avisos que publicó el administrador.
  useEffect(() => { if (esAdmin && usuario.opticaId) leerDestinatariosDeAvisos(usuario.opticaId).then(setDestinatarios) }, [esAdmin, usuario.opticaId])
  // Una respuesta nueva aparece sin recargar la página: al volver a la pestaña del navegador, cuando algo cambia aquí y cada 45 segundos.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") recargar() }
    window.addEventListener(EVENTO_SOPORTE_CAMBIADO, recargar)
    document.addEventListener("visibilitychange", alVolver)
    const reloj = setInterval(alVolver, REFRESCO_MS)
    return () => { window.removeEventListener(EVENTO_SOPORTE_CAMBIADO, recargar); document.removeEventListener("visibilitychange", alVolver); clearInterval(reloj) }
  }, [recargar])

  // Desde la campanita: abrir directo la consulta que respondieron (o la que espera al administrador), en la pestaña que le toca.
  const [irA, setIrA] = useState(null)
  useEffect(() => {
    if (!abrirConsultaId) return
    setIrA(abrirConsultaId)
    setVentana({ consultaId: abrirConsultaId })
    onAbrirConsultaConsumida?.()
  }, [abrirConsultaId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = irA ? consultas.find((x) => x.id === irA) : null
    if (c) { setTab(pestanaDeConsulta(c, usuario)); setIrA(null) }
  }, [irA, consultas]) // eslint-disable-line react-hooks/exhaustive-deps

  const consultaAbierta = ventana?.consultaId ? consultas.find((c) => c.id === ventana.consultaId) : null
  const lecturas = useMemo(() => resumenDeLecturas(internos.lecturas), [internos.lecturas])
  const avisosLista = useMemo(() => avisosUnificados({ sistema: avisos, internos: internos.datos, leidosInternos: internos.leidos }), [avisos, internos])
  // Lo que el administrador publicó no cuenta como "nuevo" para él.
  const avisosSinLeer = avisosLista.filter((a) => !a.leido && !(esAdmin && a.origen === "interno")).length

  const marcarAviso = async (a) => {
    await (a.origen === "interno" ? marcarAvisosInternosLeidos([a.id]) : marcarAvisosLeidos([a.id]))
    await recargar()
    avisarCambioSoporte()
  }
  const marcarTodos = async () => { await Promise.all([marcarAvisosLeidos(null), marcarAvisosInternosLeidos(null)]); await recargar(); avisarCambioSoporte() }
  const retirar = async (id) => { await retirarAvisoInterno(id); await recargar(); avisarCambioSoporte() }
  const escribir = (modulo) => setVentana({ nueva: true, modulo: modulo || moduloOrigen })

  const consultasDe = (p) => consultasDePestana(consultas, usuario, p)
  const nuevasDe = (p) => (p === "personal"
    ? consultasDe(p).filter((c) => c.destino === "admin" && c.ultimoMensajeDe === "optica" && c.estado !== "resuelta").length
    : consultasDe(p).filter((c) => c.respuestaSinLeer && (c.autorId === usuario.id || c.iniciadaPor === "soporte")).length)
  const pestanas = useMemo(() => {
    const defs = {
      consultas: { titulo: NOMBRE_PESTANA_CONSULTAS.consultas },
      personal: { titulo: NOMBRE_PESTANA_CONSULTAS.personal },
      sistema: { titulo: NOMBRE_PESTANA_CONSULTAS.sistema },
      avisos: { titulo: "Avisos", cuenta: avisosLista.length, nuevas: avisosSinLeer },
      ayuda: { titulo: "Ayuda" },
    }
    return pestanasDeSoporte(usuario).map((id) => {
      const d = defs[id]
      if (id === "consultas" || id === "personal" || id === "sistema") return { id, ...d, cuenta: consultasDePestana(consultas, usuario, id).length, nuevas: nuevasDe(id) }
      return { id, ...d }
    })
  }, [usuario, consultas, avisosLista.length, avisosSinLeer]) // eslint-disable-line react-hooks/exhaustive-deps

  // La acción principal de la cabecera: el administrador publica en Avisos y escribe al soporte en las demás; en "Consultas del personal" no hay botón
  // (ahí contesta), y la ayuda no lo repite.
  // En las pestañas de consultas, «Nueva consulta» está en su propia tarjeta (no se repite arriba).
  const accionCabecera = esAdmin && tab === "avisos" ? "aviso" : (tab === "consultas" || tab === "sistema" || (esAdmin && tab === "personal")) ? null : "consulta"

  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><MessageSquare size={24} aria-hidden="true" /></div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Soporte</h1>
        </div>
        <AccionesDeCabecera>
          {accionCabecera === "aviso" && puedeEscribir && (
            <button type="button" onClick={() => setVentana("aviso")} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Plus size={18} aria-hidden="true" /> Nuevo aviso
            </button>
          )}
          {accionCabecera === "consulta" && puedeEscribir && (
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

      <Pestanas etiqueta="Secciones de Soporte" pestanas={pestanas} activa={tab} onCambiar={setTab} idBase="soporte" />

      <div id="soporte-panel" role="tabpanel" aria-labelledby={`soporte-tab-${tab}`}>
        {tab === "ayuda" && <PestanaAyuda key={ayuda.clave} esAdmin={esAdmin} puedeEscribir={puedeEscribir} onEscribir={escribir} busquedaInicial={ayuda.texto} moduloInicial={ayuda.modulo} enfocar={ayuda.clave > 0} />}
        {(tab === "consultas" || tab === "personal" || tab === "sistema") && (cargando ? <TablaSkeleton /> : puedeVer
          ? <PestanaMisConsultas variante={tab} consultas={consultasDe(tab)} usuario={usuario} puedeEscribir={puedeEscribir} onAbrir={(id) => setVentana({ consultaId: id })} onNueva={() => escribir("")}
              onAccionVacia={() => { setTab("avisos"); setVentana("aviso") }} />
          : <p className="rounded-2xl border border-slate-200/60 bg-white p-5 text-sm text-slate-500">Tu rol no puede ver las consultas.</p>)}
        {tab === "avisos" && (cargando ? <TablaSkeleton /> : (
          <PestanaAvisos avisos={avisosLista} esAdmin={esAdmin} lecturas={lecturas} destinatarios={destinatarios} onMarcar={marcarAviso} onMarcarTodos={marcarTodos} onVerAyuda={() => setTab("ayuda")}
            onNuevo={() => setVentana("aviso")} onRetirar={retirar} />
        ))}
      </div>

      {(ventana === "nueva" || ventana?.nueva) && (
        <VentanaNuevaConsulta usuario={usuario} moduloInicial={ventana?.modulo || moduloOrigen} pantallaOrigen={pantallaOrigen}
          onCerrar={(enviada) => { setVentana(null); if (enviada) recargar() }} onVerMisConsultas={() => setTab(esAdmin ? "sistema" : "consultas")}
          onAbrirAyuda={(texto) => { setVentana(null); setAyuda((a) => ({ clave: a.clave + 1, texto, modulo: "" })); setTab("ayuda") }} />
      )}
      {ventana === "aviso" && esAdmin && <VentanaNuevoAviso usuario={usuario} onCerrar={() => setVentana(null)} onPublicado={() => { setTab("avisos"); recargar(); avisarCambioSoporte() }} />}
      {consultaAbierta && <VentanaConsulta consulta={consultaAbierta} usuario={usuario} puedeEscribir={puedeEscribir} onCambio={recargar} onCerrar={() => setVentana(null)}
        onVerGuia={(moduloDeUso) => { setVentana(null); setAyuda((a) => ({ clave: a.clave + 1, texto: "", modulo: moduloDeAyuda(moduloDeUso) })); setTab("ayuda") }} />}
    </div>
  )
}
