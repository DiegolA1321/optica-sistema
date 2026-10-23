"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { HeartHandshake, Megaphone, MessageSquareText } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import { BotonRequierenAtencion } from "../componentes/RequiereAtencionPorArea"
import SinDatosAun from "../componentes/SinDatosAun"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaParaContactar from "../componentes/crm/PestanaParaContactar"
import PestanaSeguimiento from "../componentes/crm/PestanaSeguimiento"
import PestanaCampanas from "../componentes/crm/PestanaCampanas"
import PestanaFidelizacion from "../componentes/crm/PestanaFidelizacion"
import VentanaPlantillas from "../componentes/crm/VentanaPlantillas"
import PanelCrm from "../componentes/crm/PanelCrm"
import { Pestanas } from "../componentes/ventas/Piezas"
import VentanaResultado from "../componentes/crm/VentanaResultado"
import { VentanaCampana, VentanaNuevaCampana } from "../componentes/crm/VentanasCampana"
import { CLASE_ACCION_SECUNDARIA, plural } from "../componentes/ventas/estilos"
import { Cascaron } from "../componentes/AtencionPaciente"
import { BOTON_CERRAR } from "../componentes/ventas/estilos"
import { useParamUrl } from "../utilidades/urlEstado"
import { puede } from "../utilidades/permisosUi"
import { motivoDeCampana } from "../utilidades/crmDatos"
import { avisosDelCrm, contarPorMotivo, listaParaContactar, MOTIVOS, MOTIVOS_DE_AVISO } from "../utilidades/crmContactos"
import { resumenCrm } from "../utilidades/crmResumen"
import { useFidelidadCon } from "../componentes/FidelidadContexto"
import { useEscribirPorWhatsApp } from "../componentes/EscribirPorWhatsApp"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { hoyISO } from "../utilidades/disponibilidad"
import NotaAlcance from "../componentes/NotaAlcance"

const TABS = ["contactar", "seguimiento", "campanas", "fidelizacion"]
const uno = (n, singular, plural) => (n === 1 ? singular : plural)

// CRM y fidelización: responde "¿a quién tengo que contactar hoy, por qué y qué pasó cuando lo contacté?". Cuatro pestañas: Para contactar (la lista de trabajo),
// Seguimiento (el historial), Campañas (un mensaje para un grupo) y Fidelización (cumpleanos y rankings). Las plantillas (el texto de cada mensaje) se abren con el botón «Plantillas».
// Arriba, un panel con cuatro listas cortas (cumpleaños próximos, los más fieles, los que más refieren y lo de este mes). El análisis va en Reportes.
export default function CRM({
  usuario, crm, alcancePropio = false, pacientes = [], consultas = [], citas = [], ordenesLab = [], pases = [], facturasVenta = [], parametrizacion, setParametrizacion, cargaInicial = false,
  onVerPerfil, onRegistrarPaciente, onAviso, accionInicial, onAccionInicialConsumida,
}) {
  const puedeContactar = puede(usuario, "crm", "crear")
  const puedeEditar = puede(usuario, "crm", "editar")
  const [tab, setTab] = useParamUrl("tab", "contactar", TABS)
  const [filtro, setFiltro] = useState("todos")
  const [resultadoDe, setResultadoDe] = useState(null) // { paciente, motivo, contacto }
  const [ventana, setVentana] = useState(null) // "nueva" | "plantillas" | "referidores" | { campanaId }
  const [vistaFidelizacion, setVistaFidelizacion] = useState("puntaje") // el ranking con el que abre «Fidelización» (las listas de arriba eligen cuál)
  const notificar = useCallback((msg) => onAviso?.(msg), [onAviso])
  const { contactos, campanas, plantillas } = crm
  const opticaNombre = usuario?.opticaNombre || "tu óptica"
  const hoy = hoyISO()

  // Lo que pidió otro módulo (el Inicio): la pestaña y el motivo (el Inicio cuenta con la misma lista, así que el número es el mismo).
  useEffect(() => {
    if (!accionInicial) return
    if (accionInicial.tab && TABS.includes(accionInicial.tab)) setTab(accionInicial.tab)
    setFiltro(accionInicial.filtro || "todos")
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial])

  const { filas, sinPermiso } = useMemo(() => listaParaContactar({ pacientes, consultas, ordenes: ordenesLab, pases, facturas: facturasVenta, citas, contactos, hoy }), [pacientes, consultas, ordenesLab, pases, facturasVenta, citas, contactos, hoy])
  const avisos = useMemo(() => avisosDelCrm(filas, contactos, hoy), [filas, contactos, hoy])
  const pacienteDe = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])

  // ── Contactar: abre WhatsApp con el mensaje del motivo ya escrito (primero la ventana, dentro del clic) y anota el contacto ──
  // La ventana de Contactar es la misma de todo el sistema: el mensaje del motivo ya escrito, editable; al enviar abre WhatsApp y el CRM anota el contacto con su motivo.
  const escribirPorWhatsApp = useEscribirPorWhatsApp()
  const contactar = (fila, motivo) => escribirPorWhatsApp({
    paciente: fila.paciente, telefono: fila.telefono, motivo,
    // Los motivos de un aviso de otro módulo («Por vender») anotan su contacto con el permiso de ese módulo, igual que desde el Inicio; los propios del CRM, con el del CRM.
    registro: MOTIVOS_DE_AVISO[motivo] || motivo === "por_vender" ? undefined : ({ paciente, motivo: m, mensaje }) => crm.contactar({ paciente, motivo: m, canal: "whatsapp", mensaje }),
    alRegistrar: (r) => notificar(r.ok ? `Contacto con ${fila.paciente.nombre} registrado. Cuando responda, anota qué pasó.` : r.error),
  })
  // «Saludar» (Fidelización › Cumpleaños): la ventana de Contactar con la plantilla de cumpleaños; al enviar, el contacto queda registrado.
  const saludar = (paciente) => escribirPorWhatsApp({
    paciente, telefono: paciente.telefono || paciente.contacto || paciente.celular, motivo: "cumpleanos",
    registro: ({ paciente: p, motivo: m, mensaje }) => crm.contactar({ paciente: p, motivo: m, canal: "whatsapp", mensaje }),
    alRegistrar: (r) => notificar(r.ok ? `Saludo a ${paciente.nombre} registrado.` : r.error),
  })
  const contactoPendiente = (pacienteId, motivo) => contactos.find((c) => c.pacienteId === pacienteId && !c.resultado && !c.campanaId && c.motivo === motivo)
    || contactos.find((c) => c.pacienteId === pacienteId && !c.resultado && !c.campanaId) || null
  const abrirResultado = (fila, motivo) => setResultadoDe({ paciente: fila.paciente, motivo, contacto: contactoPendiente(fila.id, motivo) })
  const abrirResultadoDeContacto = (c) => { const paciente = pacienteDe.get(c.pacienteId); if (paciente) setResultadoDe({ paciente, motivo: c.motivo, contacto: c }) }

  const guardarResultado = async ({ canal, resultado, volverEl }) => {
    const { paciente, motivo, contacto } = resultadoDe
    // Sin un contacto anotado todavía, un motivo de otro módulo («Por vender») se anota primero como el contacto de ese aviso y después se le pone el resultado.
    let r
    if (contacto) r = await crm.anotarResultado(contacto, resultado, volverEl)
    else if (motivo === "por_vender") {
      const c = await crm.contactarDeAviso({ paciente, motivo, mensaje: "" })
      r = c.ok ? await crm.anotarResultado({ id: c.id, pacienteId: paciente.id }, resultado, volverEl) : c
    } else r = await crm.contactar({ paciente, motivo, canal, mensaje: "", resultado, volverEl })
    if (!r.ok) return r
    setResultadoDe(null)
    notificar(
      resultado === "volver_a_contactar" ? `Listo: ${paciente.nombre} reaparecerá en la lista el ${fechaLegible(volverEl)}.`
        : resultado === "agendo" ? `Anotado: ${paciente.nombre} agendó cita.`
        : resultado === "no_desea_mensajes" ? `Anotado: no se le volverá a escribir a ${paciente.nombre}.`
        : "Resultado guardado.",
    )
    return r
  }

  // ── Requieren atención: lo que no puede esperar (mismo botón y misma ventana de los demás módulos) ──
  const irA = (t, f = "todos") => { setFiltro(f); setTab(t) }
  const nombreDe = (id) => pacienteDe.get(id)?.nombre || "Paciente"
  const bloque = useMemo(() => {
    const casoContactar = (f, detalle) => ({ id: f.id, nombre: f.paciente.nombre, detalle, accion: puedeContactar && f.telefono ? { etiqueta: "Contactar", onClick: () => contactar(f, f.principal) } : null })
    const filasAv = []
    if (avisos.vuelven.length > 0) filasAv.push({
      id: "vuelven", cantidad: avisos.vuelven.length, corto: "toca volver a contactar", texto: uno(avisos.vuelven.length, "paciente que toca volver a contactar hoy", "pacientes que toca volver a contactar hoy"),
      enlace: { texto: `Abrir en Para contactar (${filas.length})`, onClick: () => irA("contactar") },
      casos: avisos.vuelven.map((f) => casoContactar(f, `Pediste volver a contactarlo hoy · ${f.motivos[0].detalle}`)),
    })
    const cumple = avisos.cumpleHoy.filter((f) => !f.sinResultado)
    if (cumple.length > 0) filasAv.push({
      id: "cumple-hoy", cantidad: cumple.length, corto: "cumpleaños sin saludar", texto: uno(cumple.length, "cumpleaños hoy sin saludar", "cumpleaños hoy sin saludar"),
      enlace: { texto: `Abrir en Para contactar · Cumpleaños (${contarPorMotivo(filas).por.cumpleanos})`, onClick: () => irA("contactar", "cumpleanos") },
      casos: cumple.map((f) => casoContactar(f, "Cumple años hoy")),
    })
    if (avisos.sinResultado.length > 0) filasAv.push({
      id: "sin-resultado", cantidad: avisos.sinResultado.length, corto: "sin resultado anotado", texto: uno(avisos.sinResultado.length, "contacto de días anteriores sin resultado anotado", "contactos de días anteriores sin resultado anotado"),
      casos: avisos.sinResultado.map((c) => ({
        id: c.id, nombre: nombreDe(c.pacienteId), detalle: `Contactado el ${fechaLegible(diaDeRegistro(c.creadoEn))} · ${MOTIVOS[c.motivo]?.corta || c.motivo}`,
        accion: puedeContactar ? { etiqueta: "Registrar resultado", navega: true, onClick: () => abrirResultadoDeContacto(c) } : null,
      })),
    })
    return { id: "crm", titulo: "CRM y fidelización", icono: HeartHandshake, filas: filasAv }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisos, filas, puedeContactar, plantillas, pacientes, contactos])

  // ── Campañas ──
  const crearCampana = async (datos) => {
    const r = await crm.crearCampana(datos)
    if (!r.ok) return r
    setVentana({ campanaId: r.id })
    notificar(`Campaña “${datos.nombre.trim()}” creada. Envía cada mensaje por WhatsApp.`)
    return r
  }
  const campanaAbierta = ventana?.campanaId ? campanas.find((k) => k.id === ventana.campanaId) : null
  const enviarDeCampana = (campana) => (paciente, mensaje) => crm.contactar({ paciente, motivo: motivoDeCampana(campana.grupo), canal: "whatsapp", mensaje, campanaId: campana.id })
  const cumpleAuto = parametrizacion?.cumpleAuto === true
  const setCumpleAuto = (v) => setParametrizacion?.((prev) => ({ ...prev, cumpleAuto: v }))

  const { de: fidelidadDe } = useFidelidadCon({ pacientes, consultas })
  const resumen = useMemo(() => resumenCrm({ pacientes, contactos, citas, puntosDe: fidelidadDe, hoy }), [pacientes, contactos, citas, fidelidadDe, hoy])
  // Las listas de arriba: cada una abre su pestaña (con el mismo número).
  const verFidelizacion = (vista) => () => { setVistaFidelizacion(vista); setTab("fidelizacion") }
  const pestanas = [
    { id: "contactar", titulo: "Para contactar", cuenta: filas.length },
    { id: "seguimiento", titulo: "Seguimiento" },
    { id: "campanas", titulo: "Campañas", cuenta: campanas.length },
    { id: "fidelizacion", titulo: "Fidelización" },
  ]

  const cargando = cargaInicial || crm.cargando
  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><HeartHandshake size={24} aria-hidden="true" /></div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>CRM y fidelización</h1>
        </div>
        <AccionesDeCabecera avisos={cargando ? null : bloque.filas.length > 0 ? <BotonRequierenAtencion bloque={bloque} /> : null}>
          <button type="button" onClick={() => setVentana("plantillas")} className={CLASE_ACCION_SECUNDARIA.replace("px-3.5", "px-4").replace("py-2", "py-3") + " gap-2"}>
            <MessageSquareText size={18} aria-hidden="true" /> Plantillas
          </button>
          {puedeContactar && (
            <button type="button" onClick={() => { setTab("campanas"); setVentana("nueva") }} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Megaphone size={18} aria-hidden="true" /> Nueva campaña
            </button>
          )}
        </AccionesDeCabecera>
      </div>
      <NotaAlcance alcancePropio={alcancePropio} />

      {!cargando && pacientes.length === 0 ? (
        <SinDatosAun titulo="Todavía no hay pacientes a quienes escribir" texto="Aquí aparecen los controles por vencer, los cumpleaños y quienes llevan tiempo sin venir, en cuanto registres pacientes." accion={onRegistrarPaciente ? { etiqueta: "Registrar el primer paciente", onClick: onRegistrarPaciente } : null} />
      ) : cargando ? (
        <TablaSkeleton />
      ) : (
        <>
          {crm.error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {crm.error}
              <button type="button" onClick={crm.recargar} className={CLASE_ACCION_SECUNDARIA}>Reintentar</button>
            </div>
          )}
          <PanelCrm resumen={resumen} onVerCumpleanos={verFidelizacion("puntaje")} onVerFieles={verFidelizacion("puntaje")} onVerReferidores={() => setVentana("referidores")} onVerSeguimiento={() => setTab("seguimiento")} />
          <Pestanas etiqueta="Secciones del CRM" pestanas={pestanas} activa={tab} onCambiar={setTab} idBase="crm" />

          <div id="crm-panel" role="tabpanel" aria-labelledby={`crm-tab-${tab}`}>
            {tab === "contactar" && (
              <PestanaParaContactar
                filas={filas} sinPermiso={sinPermiso} filtro={filtro} onFiltro={setFiltro}
                puedeContactar={puedeContactar} puedeCampana={puedeContactar} onContactar={contactar} onResultado={abrirResultado} onVerPerfil={onVerPerfil} onIrACampanas={() => setTab("campanas")}
              />
            )}
            {tab === "seguimiento" && (
              <PestanaSeguimiento
                contactos={contactos} citas={citas} pacientes={pacientes} campanas={campanas} puedeContactar={puedeContactar}
                onResultado={abrirResultadoDeContacto} onVerPerfil={onVerPerfil} onIrAContactar={() => setTab("contactar")}
              />
            )}
            {tab === "campanas" && (
              <div className="space-y-3">
                <PestanaCampanas
                  campanas={campanas} contactos={contactos} pacientes={pacientes} consultas={consultas} puedeCrear={puedeContactar}
                  onNueva={() => setVentana("nueva")} onAbrir={(id) => setVentana({ campanaId: id })}
                />
              </div>
            )}
            {tab === "fidelizacion" && <PestanaFidelizacion key={vistaFidelizacion} vistaInicial={vistaFidelizacion} pacientes={pacientes} consultas={consultas} contactos={contactos} puedeContactar={puedeContactar} onSaludar={saludar} onVerPerfil={onVerPerfil} />}
          </div>
        </>
      )}

      {resultadoDe && <VentanaResultado paciente={resultadoDe.paciente} motivo={resultadoDe.motivo} contacto={resultadoDe.contacto} onGuardar={guardarResultado} onCerrar={() => setResultadoDe(null)} />}
      {ventana === "nueva" && <VentanaNuevaCampana pacientes={pacientes} consultas={consultas} citas={citas} plantillas={plantillas} opticaNombre={opticaNombre} opticaTelefono={parametrizacion?.opticaTelefono} onCrear={crearCampana} onCerrar={() => setVentana(null)} />}
      {campanaAbierta && (
        <VentanaCampana
          campana={campanaAbierta} pacientes={pacientes} consultas={consultas} contactos={contactos} opticaNombre={opticaNombre} opticaTelefono={parametrizacion?.opticaTelefono} usuario={usuario} puedeEnviar={puedeContactar}
          onEnviar={enviarDeCampana(campanaAbierta)} onVerPerfil={onVerPerfil ? (id) => { setVentana(null); onVerPerfil(id) } : null} onAviso={notificar} onCerrar={() => setVentana(null)}
        />
      )}
      {ventana === "plantillas" && (
        <VentanaPlantillas plantillas={plantillas} opticaNombre={opticaNombre} opticaTelefono={parametrizacion?.opticaTelefono} puedeEditar={puedeEditar}
          cumpleAuto={cumpleAuto} onCumpleAuto={setCumpleAuto} onGuardar={crm.guardarPlantilla} onAviso={notificar} onCerrar={() => setVentana(null)} />
      )}
      {ventana === "referidores" && (
        <Cascaron titulo="Quienes más refieren" subtitulo="Con empates, comparten el mismo puesto" Icono={HeartHandshake} ancho="max-w-md" onCerrar={() => setVentana(null)}
          pie={<><span /><button type="button" onClick={() => setVentana(null)} className={BOTON_CERRAR}>Cerrar</button></>}>
          <ul aria-label="Quienes más refieren" className="divide-y divide-slate-100 px-5">
            {resumen.referidores.todos.map((x) => (
              <li key={x.paciente.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5">
                <span className="text-sm font-bold tabular-nums text-slate-500">{x.lugar}</span>
                <span className="break-words text-sm font-semibold text-slate-800">{x.paciente.nombre}</span>
                <span className="text-sm tabular-nums text-slate-600">{plural(x.valor, "referido", "referidos")}</span>
              </li>
            ))}
          </ul>
        </Cascaron>
      )}
    </div>
  )
}
