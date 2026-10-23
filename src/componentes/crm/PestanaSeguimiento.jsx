"use client"

import { useMemo, useState } from "react"
import { ClipboardCheck, ClipboardList, Contact, MessageCircle, Send } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { Insignia, Vacio } from "../ventas/Lista"
import { BotonFiltrar, CampoBusqueda, FiltroActivo, FranjaDatos, SelectorPeriodo, TablaLista } from "../ventas/Piezas"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { InsigniaMotivo, InsigniaResultado } from "./piezas"
import { CANALES, DIAS_PARA_AGENDAR, ETIQUETA_MOTIVO, categoriaDeContacto, citaQueAgendo, resultadoEfectivo, resumenSeguimiento } from "../../utilidades/crmContactos"
import { fechaHoraLegible, fechaLegible, formatoFecha, horaSinCero } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { diaDeRegistro, enPeriodo } from "../../utilidades/periodoLista"

const POR_PAGINA = 30
const PERIODO_DEFECTO = { filtro: "mes", ref: "", desde: "", hasta: "" }
const COLUMNAS = "lg:grid-cols-[6.5rem_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_9.5rem_1rem]"
const ENCABEZADO = [{ texto: "Fecha" }, { texto: "Paciente y quién contactó" }, { texto: "Motivo" }, { texto: "Resultado" }, { texto: "" }, { texto: "" }]
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const TODOS = { id: "todos", etiqueta: "Todos" }
const MOTIVOS_FILTRO = [TODOS, ...Object.entries(ETIQUETA_MOTIVO).map(([id, etiqueta]) => ({ id, etiqueta }))]
const CANALES_FILTRO = [TODOS, ...Object.entries(CANALES).map(([id, etiqueta]) => ({ id, etiqueta }))]
const TEXTO_DATO = { agendaron: "Agendaron una cita", respondieron: "Respondieron sin agendar", sinrespuesta: "Sin respuesta", falta: "Falta registrar el resultado" }
const CATEGORIA_DE_DATO = { agendaron: "agendo", respondieron: "respondio", sinrespuesta: "sin_respuesta", falta: "falta" }
const SIN_CONTACTOS = "Sin contactos en este período"

// El resultado de un contacto en la lista: «Agendó · 26 oct» (con la fecha de la cita), «Falta el resultado» o el que se anotó.
function Resultado({ contacto: c, resultado, cita }) {
  if (resultado === null) return <Insignia tono="rojo">Falta el resultado</Insignia>
  if (resultado === "agendo") return <Insignia tono="verde" title={c.resultado ? undefined : "El paciente agendó una cita después del contacto"}>{cita ? `Agendó · ${formatoFecha(cita.fecha, "medioSinAnio")}` : "Agendó cita"}</Insignia>
  return <InsigniaResultado resultado={resultado} />
}

// Pestaña «Historial de contactos»: cada contacto que se hizo a un paciente (desde Para contactar, el Inicio, el perfil o una campaña), con su resultado. Arriba, el período, la búsqueda y «Filtrar»;
// luego la franja de datos (cada dato filtra la lista) y la lista en columnas; toda la fila abre el detalle del contacto.
export default function PestanaSeguimiento({ contactos, citas, pacientes, campanas, puedeContactar, onResultado, onVolverAContactar, onVerPerfil, onIrAContactar }) {
  const [periodo, setPeriodo] = useState(PERIODO_DEFECTO)
  const [motivo, setMotivo] = useState("todos")
  const [canal, setCanal] = useState("todos")
  const [quien, setQuien] = useState("todos")
  const [dato, setDato] = useState(null)
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [detalle, setDetalle] = useState(null)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""
  const pacienteDe = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])
  const campanaDe = useMemo(() => new Map(campanas.map((k) => [k.id, k])), [campanas])
  const quienes = useMemo(() => [...new Set(contactos.map((c) => c.creadoPorNombre).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((n) => ({ id: n, etiqueta: n })), [contactos])
  const volver = (poner) => (valor) => { poner(valor); setVisibles(POR_PAGINA) }

  // Los contactos del período y de los filtros; la franja cuenta sobre ellos y el dato pulsado recorta la lista.
  const base = useMemo(() => {
    const q = sinTildes(texto.trim())
    return contactos.filter((c) => {
      if (!buscando && !enPeriodo(c.creadoEn, periodo, hoy)) return false
      if (motivo !== "todos" && c.motivo !== motivo) return false
      if (canal !== "todos" && c.canal !== canal) return false
      if (quien !== "todos" && c.creadoPorNombre !== quien) return false
      return !q || sinTildes(pacienteDe.get(c.pacienteId)?.nombre).includes(q)
    })
  }, [contactos, periodo, motivo, canal, quien, texto, buscando, hoy, pacienteDe])
  const resumen = useMemo(() => resumenSeguimiento(base, citas), [base, citas])
  const lista = useMemo(() => (dato ? base.filter((c) => categoriaDeContacto(c, citas) === CATEGORIA_DE_DATO[dato]) : base), [base, dato, citas])
  const n = lista.length
  const elegirDato = (id) => { setDato((actual) => (actual === id ? null : id)); setVisibles(POR_PAGINA) }

  const vacioPeriodo = resumen.contactos === 0
  const pct = (x) => (vacioPeriodo ? SIN_CONTACTOS : `${x} % de los contactados`)
  const datos = [
    { id: "contactados", etiqueta: "Contactados", valor: String(resumen.contactos), sub: vacioPeriodo ? SIN_CONTACTOS : plural(resumen.pacientes, "paciente", "pacientes"), activo: dato === null, onClick: () => { setDato(null); setVisibles(POR_PAGINA) }, ayuda: "Los contactos de la lista de abajo. Pulsa para ver todos." },
    { id: "agendaron", etiqueta: "Agendaron una cita", punto: "verde", valor: String(resumen.agendaron), sub: pct(resumen.pctAgendaron), activo: dato === "agendaron", onClick: () => elegirDato("agendaron"), ayuda: "Contactos que terminaron en una cita. Pulsa para verlos." },
    { id: "respondieron", etiqueta: "Respondieron sin agendar", valor: String(resumen.sinAgendar), sub: vacioPeriodo ? SIN_CONTACTOS : `${resumen.pctSinAgendar} %`, activo: dato === "respondieron", onClick: () => elegirDato("respondieron"), ayuda: "Respondieron (pidió volver a ser contactado, no le interesa o no desea mensajes) pero no agendaron. Pulsa para verlos." },
    { id: "sinrespuesta", etiqueta: "Sin respuesta", punto: "ambar", valor: String(resumen.sinRespuesta), sub: vacioPeriodo ? SIN_CONTACTOS : "volver a intentar", activo: dato === "sinrespuesta", onClick: () => elegirDato("sinrespuesta"), ayuda: "Contactos que no respondieron. Pulsa para verlos." },
    { id: "falta", etiqueta: "Falta registrar el resultado", punto: "rojo", valor: String(resumen.faltan), sub: vacioPeriodo ? SIN_CONTACTOS : "de tus contactos", activo: dato === "falta", onClick: () => elegirDato("falta"), ayuda: "Contactos sin resultado anotado. Pulsa para verlos." },
  ]

  const secciones = [
    { id: "motivo", titulo: "Motivo", valor: motivo, onChange: volver(setMotivo), opciones: MOTIVOS_FILTRO },
    { id: "canal", titulo: "Canal", valor: canal, onChange: volver(setCanal), opciones: CANALES_FILTRO },
    ...(quienes.length > 0 ? [{ id: "quien", titulo: "Quién contactó", valor: quien, onChange: volver(setQuien), opciones: [TODOS, ...quienes] }] : []),
  ]
  const hayFiltros = dato !== null || motivo !== "todos" || canal !== "todos" || quien !== "todos"
  const quitarFiltros = () => { setDato(null); setMotivo("todos"); setCanal("todos"); setQuien("todos"); setVisibles(POR_PAGINA) }
  const limpiar = () => { quitarFiltros(); setTexto(""); setPeriodo(PERIODO_DEFECTO) }
  const puestos = [
    dato && TEXTO_DATO[dato],
    motivo !== "todos" && `Motivo: ${ETIQUETA_MOTIVO[motivo]}`,
    canal !== "todos" && `Canal: ${CANALES[canal]}`,
    quien !== "todos" && `Contactó: ${quien}`,
  ].filter(Boolean)

  const accion = (c, categoria, paciente) => {
    if (!puedeContactar) return null
    if (categoria === "falta") return <button type="button" onClick={() => onResultado(c)} className={CLASE_ACCION_PRINCIPAL.replace("px-3.5", "px-3")} style={{ background: GRAD_MARCA }}><ClipboardCheck size={14} aria-hidden="true" /> Registrar resultado</button>
    if (categoria === "sin_respuesta" && paciente && onVolverAContactar) {
      const tel = paciente.telefono || paciente.contacto || paciente.celular
      return <button type="button" onClick={() => onVolverAContactar(c, paciente)} disabled={!tel} title={tel ? undefined : "Sin número registrado"} aria-label={`Volver a contactar a ${paciente.nombre}`} className={CLASE_ACCION_SECUNDARIA}><MessageCircle size={14} aria-hidden="true" /> Volver a contactar</button>
    }
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <SelectorPeriodo periodo={periodo} onCambiar={volver(setPeriodo)} buscando={buscando} ariaLabel="Período del historial" />
        <CampoBusqueda id="crm-seguimiento-busqueda" valor={texto} onCambio={volver(setTexto)} placeholder="Buscar paciente" className="min-w-[12rem]" />
        <BotonFiltrar secciones={secciones} panelId="crm-seguimiento-filtrar" />
      </div>

      <FranjaDatos etiqueta="Resumen del historial de contactos" datos={datos} />

      {hayFiltros && <FiltroActivo texto={puestos.join(" · ")} onQuitar={quitarFiltros} onLimpiar={buscando ? limpiar : undefined} />}

      {n === 0 ? (
        contactos.length === 0 ? (
          <Vacio Icono={ClipboardList} titulo="Todavía no hay contactos registrados" texto="Cada vez que contactas a un paciente queda aquí, con su resultado. Así sabes a quién volver a escribir y cuántos vuelven a la óptica.">
            <button type="button" onClick={onIrAContactar} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Contact size={15} aria-hidden="true" /> Ir a Para contactar</button>
          </Vacio>
        ) : hayFiltros || buscando ? (
          <Vacio Icono={ClipboardList} titulo={buscando ? "Ningún contacto coincide con la búsqueda" : "Ningún contacto coincide con el filtro"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={ClipboardList} titulo={SIN_CONTACTOS} texto="Los contactos de otros períodos siguen en el historial: cambia el período para verlos.">
            <button type="button" onClick={() => setPeriodo({ filtro: "todas", ref: "", desde: "", hasta: "" })} className={CLASE_ACCION_SECUNDARIA}>Ver todas las fechas</button>
          </Vacio>
        )
      ) : (
        <>
          <TablaLista etiqueta="Contactos" plantilla={COLUMNAS} encabezado={ENCABEZADO}>
            {lista.slice(0, visibles).map((c) => {
              const p = pacienteDe.get(c.pacienteId)
              const r = resultadoEfectivo(c, citas)
              const cat = categoriaDeContacto(c, citas)
              const campana = c.campanaId ? campanaDe.get(c.campanaId) : null
              const por = campana ? `Campaña · ${campana.nombre}` : `${CANALES[c.canal] || c.canal}${c.creadoPorNombre ? ` · ${c.creadoPorNombre}` : ""}`
              const dia = diaDeRegistro(c.creadoEn)
              return (
                <li key={c.id} data-fila className="relative px-5 py-3 transition-colors hover:bg-slate-50/70">
                  <div className={"grid grid-cols-1 items-center gap-x-4 gap-y-1 " + COLUMNAS}>
                    <button type="button" onClick={() => setDetalle(c)} aria-label={`Ver el contacto con ${p?.nombre || "un paciente"}`} className="absolute inset-0 cursor-pointer" />
                    <p className="text-sm text-slate-700">{dia ? formatoFecha(dia, "medioSinAnio") : "—"}<span className="block text-xs text-slate-500">{horaSinCero(c.creadoEn)}</span></p>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: INK }} title={p?.nombre}>{p?.nombre || "Paciente eliminado"}</p>
                      <p className="truncate text-xs text-slate-500" title={por}>{por}</p>
                    </div>
                    <div className="min-w-0"><InsigniaMotivo motivo={c.motivo} /></div>
                    <div className="min-w-0 space-y-0.5">
                      <Resultado contacto={c} resultado={r} cita={r === "agendo" ? citaQueAgendo(c, citas) : null} />
                      {c.volverEl && <span className="block text-xs text-slate-500">Volver el {fechaLegible(c.volverEl)}</span>}
                    </div>
                    <div className="relative min-w-0 lg:flex lg:justify-end">{accion(c, cat, p)}</div>
                    <span className="hidden text-slate-400 lg:block" aria-hidden="true">›</span>
                  </div>
                </li>
              )
            })}
          </TablaLista>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>Si después de un contacto el paciente agenda una cita (en los {DIAS_PARA_AGENDAR} días siguientes), el resultado cambia solo a «Agendó».</span>
            {visibles < n && <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>}
          </div>
        </>
      )}

      {detalle && (
        <DetalleContacto
          contacto={detalle} paciente={pacienteDe.get(detalle.pacienteId)} campana={campanaDe.get(detalle.campanaId)} resultado={resultadoEfectivo(detalle, citas)} cita={citaQueAgendo(detalle, citas)}
          historial={contactos.filter((x) => x.pacienteId === detalle.pacienteId).sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))} citas={citas}
          puedeRegistrar={puedeContactar && categoriaDeContacto(detalle, citas) === "falta"} onRegistrar={() => { const c = detalle; setDetalle(null); onResultado(c) }}
          onVerPerfil={onVerPerfil ? (id) => { setDetalle(null); onVerPerfil(id) } : null} onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

// El detalle de un contacto, en la ventana estándar: qué se hizo, el mensaje que se envió, qué pasó y los demás contactos de ese paciente.
function DetalleContacto({ contacto: c, paciente, campana, resultado, cita, historial, citas, puedeRegistrar, onRegistrar, onVerPerfil, onCerrar }) {
  const Fila = ({ etiqueta, children }) => (<div className="flex gap-4 py-2 text-sm"><dt className="w-36 shrink-0 text-slate-500">{etiqueta}</dt><dd className="min-w-0 flex-1 font-medium text-slate-800">{children}</dd></div>)
  const otros = historial.filter((x) => x.id !== c.id)
  return (
    <Cascaron
      titulo="Contacto con el paciente"
      subtitulo={paciente?.nombre || "Paciente eliminado"}
      Icono={Send}
      onCerrar={onCerrar}
      ancho="max-w-xl"
      pie={<>
        {onVerPerfil && paciente ? <button type="button" onClick={() => onVerPerfil(paciente.id)} className={CLASE_ACCION_SECUNDARIA}>Ver perfil</button> : <span />}
        <div className="flex items-center gap-2">
          {puedeRegistrar && <button type="button" onClick={onRegistrar} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ClipboardCheck size={14} aria-hidden="true" /> Registrar resultado</button>}
          <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
        </div>
      </>}
    >
      <div className="space-y-4 px-5 py-4">
        <dl className="divide-y divide-slate-100">
          <Fila etiqueta="Fecha">{fechaHoraLegible(c.creadoEn, { anio: true })}</Fila>
          <Fila etiqueta="Motivo"><InsigniaMotivo motivo={c.motivo} />{campana && <span className="ml-2 text-slate-600">Campaña “{campana.nombre}”</span>}</Fila>
          <Fila etiqueta="Canal">{CANALES[c.canal] || c.canal}</Fila>
          <Fila etiqueta="Lo hizo">{c.creadoPorNombre || "—"}</Fila>
          <Fila etiqueta="Resultado">
            <Resultado contacto={c} resultado={resultado} cita={resultado === "agendo" ? cita : null} />
            {c.volverEl && <span className="ml-2 text-slate-600">Volver el {fechaLegible(c.volverEl)}</span>}
            {c.resultado && c.resultadoPorNombre && <span className="mt-1 block text-xs font-normal text-slate-500">Lo anotó {c.resultadoPorNombre}{c.resultadoEn ? `, el ${fechaHoraLegible(c.resultadoEn, { anio: true })}` : ""}</span>}
          </Fila>
        </dl>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje enviado</p>
          {c.mensaje ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-700">{c.mensaje}</p> : <p className="text-sm text-slate-500">No se guardó el texto de este contacto (por ejemplo, una llamada o una visita).</p>}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Otros contactos con {paciente?.nombre || "este paciente"} ({otros.length})</p>
          {otros.length === 0 ? <p className="text-sm text-slate-500">Es el único contacto registrado con este paciente.</p> : (
            <ul aria-label="Otros contactos del paciente" className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
              {otros.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2">
                  <span className="text-sm text-slate-700">{formatoFecha(diaDeRegistro(x.creadoEn), "medio")} <span className="text-slate-500">· {ETIQUETA_MOTIVO[x.motivo] || x.motivo} · {CANALES[x.canal] || x.canal}</span></span>
                  <Resultado contacto={x} resultado={resultadoEfectivo(x, citas)} cita={resultadoEfectivo(x, citas) === "agendo" ? citaQueAgendo(x, citas) : null} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Cascaron>
  )
}
