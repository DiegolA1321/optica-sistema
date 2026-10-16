"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Contact, Gift, HeartHandshake, Megaphone, Send } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import { BotonRequierenAtencion } from "../componentes/RequiereAtencionPorArea"
import SinDatosAun from "../componentes/SinDatosAun"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaParaContactar from "../componentes/crm/PestanaParaContactar"
import PestanaSeguimiento from "../componentes/crm/PestanaSeguimiento"
import PestanaCampanas from "../componentes/crm/PestanaCampanas"
import PestanaFidelizacion from "../componentes/crm/PestanaFidelizacion"
import VentanaResultado from "../componentes/crm/VentanaResultado"
import { VentanaCampana, VentanaNuevaCampana, VentanaPlantillas } from "../componentes/crm/VentanasCampana"
import { CLASE_ACCION_SECUNDARIA } from "../componentes/ventas/estilos"
import { useParamUrl } from "../utilidades/urlEstado"
import { puede } from "../utilidades/permisosUi"
import { motivoDeCampana } from "../utilidades/crmDatos"
import { armarMensaje, avisosDelCrm, contarPorMotivo, listaParaContactar, plantillaDe, rankingPuntaje, MOTIVOS } from "../utilidades/crmContactos"
import { abrirWhatsApp } from "../utilidades/whatsapp"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diaDeRegistro, enPeriodo } from "../utilidades/periodoLista"
import { hoyISO } from "../utilidades/disponibilidad"

const TABS = ["contactar", "seguimiento", "campanas", "fidelizacion"]
const uno = (n, singular, plural) => (n === 1 ? singular : plural)

// CRM y fidelización: responde "¿a quién tengo que contactar hoy, por qué y qué pasó cuando lo contacté?". Cuatro pestañas: Para contactar (la lista de trabajo),
// Seguimiento (el historial), Campañas (un mensaje para un grupo) y Fidelización (los rankings). El análisis va en Reportes.
export default function CRM({
  usuario, crm, pacientes = [], consultas = [], citas = [], ordenesLab = [], parametrizacion, setParametrizacion, cargaInicial = false,
  onVerPerfil, onRegistrarPaciente, onAviso, accionInicial, onAccionInicialConsumida,
}) {
  const puedeContactar = puede(usuario, "crm", "crear")
  const puedeEditar = puede(usuario, "crm", "editar")
  const [tab, setTab] = useParamUrl("tab", "contactar", TABS)
  const [filtro, setFiltro] = useState("todos")
  const [resultadoDe, setResultadoDe] = useState(null) // { paciente, motivo, contacto }
  const [ventana, setVentana] = useState(null) // "nueva" | "plantillas" | { campanaId }
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

  const { filas, sinPermiso } = useMemo(() => listaParaContactar({ pacientes, consultas, ordenes: ordenesLab, citas, contactos, hoy }), [pacientes, consultas, ordenesLab, citas, contactos, hoy])
  const avisos = useMemo(() => avisosDelCrm(filas, contactos, hoy), [filas, contactos, hoy])
  const pacienteDe = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])

  // ── Contactar: abre WhatsApp con el mensaje del motivo ya escrito (primero la ventana, dentro del clic) y anota el contacto ──
  const contactar = async (fila, motivo) => {
    const mensaje = armarMensaje(plantillaDe(motivo, plantillas), { paciente: fila.paciente, opticaNombre, consultas })
    abrirWhatsApp(fila.telefono, mensaje)
    const r = await crm.contactar({ paciente: fila.paciente, motivo, canal: "whatsapp", mensaje })
    notificar(r.ok ? `Contacto con ${fila.paciente.nombre} registrado. Cuando responda, anota qué pasó.` : r.error)
  }
  const contactoPendiente = (pacienteId, motivo) => contactos.find((c) => c.pacienteId === pacienteId && !c.resultado && !c.campanaId && c.motivo === motivo)
    || contactos.find((c) => c.pacienteId === pacienteId && !c.resultado && !c.campanaId) || null
  const abrirResultado = (fila, motivo) => setResultadoDe({ paciente: fila.paciente, motivo, contacto: contactoPendiente(fila.id, motivo) })
  const abrirResultadoDeContacto = (c) => { const paciente = pacienteDe.get(c.pacienteId); if (paciente) setResultadoDe({ paciente, motivo: c.motivo, contacto: c }) }

  const guardarResultado = async ({ canal, resultado, volverEl }) => {
    const { paciente, motivo, contacto } = resultadoDe
    const r = contacto ? await crm.anotarResultado(contacto, resultado, volverEl) : await crm.contactar({ paciente, motivo, canal, mensaje: "", resultado, volverEl })
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
      id: "vuelven", cantidad: avisos.vuelven.length, texto: uno(avisos.vuelven.length, "paciente que toca volver a contactar hoy", "pacientes que toca volver a contactar hoy"),
      enlace: { texto: `Abrir en Para contactar (${filas.length})`, onClick: () => irA("contactar") },
      casos: avisos.vuelven.map((f) => casoContactar(f, `Pediste volver a contactarlo hoy · ${f.motivos[0].detalle}`)),
    })
    const cumple = avisos.cumpleHoy.filter((f) => !f.sinResultado)
    if (cumple.length > 0) filasAv.push({
      id: "cumple-hoy", cantidad: cumple.length, texto: uno(cumple.length, "cumpleaños hoy sin saludar", "cumpleaños hoy sin saludar"),
      enlace: { texto: `Abrir en Para contactar · Cumpleaños (${contarPorMotivo(filas).por.cumpleanos})`, onClick: () => irA("contactar", "cumpleanos") },
      casos: cumple.map((f) => casoContactar(f, "Cumple años hoy")),
    })
    if (avisos.sinResultado.length > 0) filasAv.push({
      id: "sin-resultado", cantidad: avisos.sinResultado.length, texto: uno(avisos.sinResultado.length, "contacto de días anteriores sin resultado anotado", "contactos de días anteriores sin resultado anotado"),
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

  const contactosDelMes = useMemo(() => contactos.filter((c) => enPeriodo(c.creadoEn, { filtro: "mes", ref: "", desde: "", hasta: "" }, hoy)).length, [contactos, hoy])
  const conPuntaje = useMemo(() => rankingPuntaje(pacientes, consultas).length, [pacientes, consultas])
  const pestanas = [
    { id: "contactar", etiqueta: "Para contactar", cuenta: filas.length, Icono: Contact },
    { id: "seguimiento", etiqueta: "Seguimiento", cuenta: contactosDelMes, Icono: Send, ayuda: "Contactos de este mes" },
    { id: "campanas", etiqueta: "Campañas", cuenta: campanas.length, Icono: Megaphone },
    { id: "fidelizacion", etiqueta: "Fidelización", cuenta: conPuntaje, Icono: Gift, ayuda: "Pacientes con puntaje" },
  ]

  const cargando = cargaInicial || crm.cargando
  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><HeartHandshake size={24} aria-hidden="true" /></div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>CRM y fidelización</h1>
        </div>
        <AccionesDeCabecera avisos={cargando ? null : <BotonRequierenAtencion bloque={bloque} />}>
          {puedeContactar && (
            <button type="button" onClick={() => { setTab("campanas"); setVentana("nueva") }} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Megaphone size={18} aria-hidden="true" /> Nueva campaña
            </button>
          )}
        </AccionesDeCabecera>
      </div>

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
          <div role="tablist" aria-label="Secciones del CRM" className="flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            {pestanas.map(({ id, etiqueta, cuenta, Icono, ayuda }) => {
              const activo = tab === id
              return (
                <button key={id} type="button" role="tab" id={`crm-tab-${id}`} aria-selected={activo} aria-controls="crm-panel" title={ayuda} onClick={() => setTab(id)}
                  className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
                  style={activo ? { background: GRAD_MARCA } : undefined}>
                  <Icono size={14} aria-hidden="true" /> {etiqueta}
                  <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{cuenta}</span>
                </button>
              )
            })}
          </div>

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
                  campanas={campanas} contactos={contactos} pacientes={pacientes} consultas={consultas} puedeCrear={puedeContactar} puedeVerPlantillas
                  onNueva={() => setVentana("nueva")} onAbrir={(id) => setVentana({ campanaId: id })} onPlantillas={() => setVentana("plantillas")}
                />
              </div>
            )}
            {tab === "fidelizacion" && <PestanaFidelizacion pacientes={pacientes} consultas={consultas} onVerPerfil={onVerPerfil} />}
          </div>
        </>
      )}

      {resultadoDe && <VentanaResultado paciente={resultadoDe.paciente} motivo={resultadoDe.motivo} contacto={resultadoDe.contacto} onGuardar={guardarResultado} onCerrar={() => setResultadoDe(null)} />}
      {ventana === "nueva" && <VentanaNuevaCampana pacientes={pacientes} consultas={consultas} plantillas={plantillas} opticaNombre={opticaNombre} onCrear={crearCampana} onCerrar={() => setVentana(null)} />}
      {campanaAbierta && (
        <VentanaCampana
          campana={campanaAbierta} pacientes={pacientes} consultas={consultas} contactos={contactos} opticaNombre={opticaNombre} usuario={usuario} puedeEnviar={puedeContactar}
          onEnviar={enviarDeCampana(campanaAbierta)} onVerPerfil={onVerPerfil ? (id) => { setVentana(null); onVerPerfil(id) } : null} onAviso={notificar} onCerrar={() => setVentana(null)}
        />
      )}
      {ventana === "plantillas" && (
        <VentanaPlantillas plantillas={plantillas} opticaNombre={opticaNombre} puedeEditar={puedeEditar} cumpleAuto={cumpleAuto} onCumpleAuto={setCumpleAuto} onGuardar={crm.guardarPlantilla}
          onCerrar={(guardado) => { setVentana(null); if (guardado) notificar("Plantillas guardadas.") }} />
      )}
    </div>
  )
}
