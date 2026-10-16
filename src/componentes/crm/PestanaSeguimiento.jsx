"use client"

import { useMemo, useState } from "react"
import { ClipboardCheck, Contact, ClipboardList, Search, Send, TrendingUp, Users } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { BarraBusquedaFiltros, ConteoCitas, NavegadorPeriodo, PeriodoLista, SeccionRango } from "../FiltrosCitas"
import FilaTarjetas from "../FilaTarjetas"
import { Cascaron } from "../AtencionPaciente"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { InsigniaMotivo, InsigniaResultado } from "./piezas"
import { CANALES, ETIQUETA_MOTIVO, ORDEN_RESULTADOS, RESULTADOS, resultadoEfectivo, resumenSeguimiento } from "../../utilidades/crmContactos"
import { fechaHoraLegible, fechaLegible, formatoFecha, hora } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { PERIODO_INICIAL, PERIODOS_CON_RANGO, diaDeRegistro, enPeriodo, hayRango, moverPeriodo, selectorDelPeriodo, tituloDelPeriodo } from "../../utilidades/periodoLista"

const POR_PAGINA = 30
const PERIODO_DEFECTO = { filtro: "mes", ref: "", desde: "", hasta: "" }
const COLUMNAS = "lg:grid-cols-[7.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_6.5rem_minmax(0,1.2fr)_minmax(0,1fr)]"
const ENCABEZADO = [{ texto: "Fecha" }, { texto: "Paciente" }, { texto: "Motivo" }, { texto: "Canal" }, { texto: "Resultado" }, { texto: "Quién" }]
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const SUFIJO = { hoy: "hoy", semana: "en la semana", mes: "en el mes" }

const TODOS = { id: "todos", etiqueta: "Todos" }
const MOTIVOS_FILTRO = [TODOS, ...Object.entries(ETIQUETA_MOTIVO).map(([id, etiqueta]) => ({ id, etiqueta }))]
const RESULTADOS_FILTRO = [TODOS, { id: "ninguno", etiqueta: "Sin resultado" }, ...ORDEN_RESULTADOS.map((id) => ({ id, etiqueta: RESULTADOS[id].etiqueta }))]
const CANALES_FILTRO = [TODOS, ...Object.entries(CANALES).map(([id, etiqueta]) => ({ id, etiqueta }))]

// Pestaña "Seguimiento": el historial de contactos (qué se hizo, con quién y qué pasó). Arriba, los números de lo que se ve en la lista.
export default function PestanaSeguimiento({ contactos, citas, pacientes, campanas, puedeContactar, onResultado, onVerPerfil, onIrAContactar }) {
  const [periodo, setPeriodo] = useState(PERIODO_DEFECTO)
  const [motivo, setMotivo] = useState("todos")
  const [resultado, setResultado] = useState("todos")
  const [canal, setCanal] = useState("todos")
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [detalle, setDetalle] = useState(null)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""
  const pacienteDe = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])

  const lista = useMemo(() => {
    const q = sinTildes(texto.trim())
    return contactos.filter((c) => {
      if (!buscando && !enPeriodo(c.creadoEn, periodo, hoy)) return false
      if (motivo !== "todos" && c.motivo !== motivo) return false
      if (canal !== "todos" && c.canal !== canal) return false
      if (resultado !== "todos") {
        const r = resultadoEfectivo(c, citas)
        if (resultado === "ninguno" ? r !== null : r !== resultado) return false
      }
      return !q || sinTildes(pacienteDe.get(c.pacienteId)?.nombre).includes(q)
    })
  }, [contactos, citas, periodo, motivo, canal, resultado, texto, buscando, hoy, pacienteDe])
  const resumen = useMemo(() => resumenSeguimiento(lista, citas), [lista, citas])
  const n = lista.length
  const cambiar = (poner) => (valor) => { poner(valor); setVisibles(POR_PAGINA) }

  const etiquetas = [
    motivo !== "todos" && { id: "motivo", texto: `Motivo: ${ETIQUETA_MOTIVO[motivo]}`, quitar: () => setMotivo("todos") },
    resultado !== "todos" && { id: "resultado", texto: `Resultado: ${RESULTADOS_FILTRO.find((r) => r.id === resultado).etiqueta}`, quitar: () => setResultado("todos") },
    canal !== "todos" && { id: "canal", texto: `Canal: ${CANALES[canal]}`, quitar: () => setCanal("todos") },
  ].filter(Boolean)
  const secciones = [
    { id: "motivo", titulo: "Motivo", valor: motivo, onChange: cambiar(setMotivo), opciones: MOTIVOS_FILTRO },
    { id: "resultado", titulo: "Resultado", valor: resultado, onChange: cambiar(setResultado), opciones: RESULTADOS_FILTRO },
    { id: "canal", titulo: "Canal", valor: canal, onChange: cambiar(setCanal), opciones: CANALES_FILTRO },
  ]
  const limpiar = () => { setMotivo("todos"); setResultado("todos"); setCanal("todos"); setTexto(""); setPeriodo(PERIODO_DEFECTO); setVisibles(POR_PAGINA) }
  const hayFiltros = etiquetas.length > 0 || buscando
  const sufijo = buscando ? "" : hayRango(periodo) ? " en el rango" : SUFIJO[periodo.filtro] ? ` ${periodo.filtro === "hoy" && periodo.ref && periodo.ref !== hoy ? "ese día" : SUFIJO[periodo.filtro]}` : ""
  const hayPeriodo = !buscando && (periodo.filtro !== "todas" || hayRango(periodo))

  const tarjetas = [
    { id: "contactados", titulo: "Contactados", valor: resumen.pacientes, desc: plural(resumen.contactos, "contacto", "contactos"), icono: Users, onClick: resultado !== "todos" ? () => setResultado("todos") : undefined },
    { id: "agendaron", titulo: "Agendaron", valor: resumen.agendaron, desc: resumen.agendaron === 1 ? "contacto terminó en cita" : "contactos terminaron en cita", icono: ClipboardCheck, color: "green", seleccionada: resultado === "agendo", onClick: () => setResultado(resultado === "agendo" ? "todos" : "agendo") },
    { id: "tasa", titulo: "Tasa de respuesta", valor: resumen.tasaRespuesta === null ? "—" : `${resumen.tasaRespuesta} %`, desc: resumen.contactos ? `${resumen.respondieron} de ${resumen.contactos} respondieron` : "Aún sin contactos", icono: TrendingUp },
  ]

  return (
    <div className="space-y-3">
      <FilaTarjetas titulo="Lo que se ve en la lista" tarjetas={tarjetas} neutro compacta columnas="lg:grid-cols-3" />
      <div className="flex items-start gap-3">
        <BarraBusquedaFiltros texto={texto} onTexto={cambiar(setTexto)} secciones={secciones} etiquetas={etiquetas} onLimpiar={limpiar} placeholder="Buscar un paciente en todo el historial" inputId="crm-seguimiento-busqueda" etiquetaPanel="Filtrar los contactos" panelId="crm-seguimiento-filtrar" />
      </div>
      <div className="flex h-12 items-center justify-between gap-3 px-2 pt-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {buscando && <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Search size={14} aria-hidden="true" /> Buscando en todas las fechas</p>}
          <ConteoCitas texto={`${plural(n, "contacto", "contactos")}${sufijo}`} />
        </div>
        {!buscando && (
          <div className="flex min-w-0 items-center gap-3">
            <PeriodoLista valor={periodo.filtro} onChange={(id) => { setPeriodo({ filtro: id, ref: "", desde: "", hasta: "" }); setVisibles(POR_PAGINA) }} opciones={PERIODOS_CON_RANGO} />
            {periodo.filtro === "rango" ? (
              <NavegadorPeriodo
                titulo={tituloDelPeriodo(periodo, hoy)}
                tituloNodo={<div className="w-44 shrink-0"><SeccionRango flotante rango={{ desde: periodo.desde, hasta: periodo.hasta, onDesde: (d) => setPeriodo({ ...periodo, desde: d }), onHasta: (h) => setPeriodo({ ...periodo, hasta: h }) }} /></div>}
                onAnterior={() => setPeriodo(moverPeriodo(periodo, -1, hoy))} onSiguiente={() => setPeriodo(moverPeriodo(periodo, 1, hoy))} etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente"
              />
            ) : hayPeriodo ? (
              <NavegadorPeriodo titulo={tituloDelPeriodo(periodo, hoy)} onAnterior={() => setPeriodo(moverPeriodo(periodo, -1, hoy))} onSiguiente={() => setPeriodo(moverPeriodo(periodo, 1, hoy))} etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" selector={selectorDelPeriodo(periodo, setPeriodo, hoy)} />
            ) : (
              <div className="invisible" aria-hidden="true"><NavegadorPeriodo inactivo titulo="" etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" /></div>
            )}
          </div>
        )}
      </div>

      {n === 0 ? (
        contactos.length === 0 ? (
          <Vacio Icono={ClipboardList} titulo="Todavía no hay contactos registrados" texto="Cada vez que contactas a un paciente desde Para contactar o desde una campaña, queda aquí con su resultado.">
            <button type="button" onClick={onIrAContactar} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Contact size={15} aria-hidden="true" /> Ir a Para contactar</button>
          </Vacio>
        ) : hayFiltros ? (
          <Vacio Icono={ClipboardList} titulo={buscando ? "Ningún contacto coincide con la búsqueda" : "Ningún contacto coincide con los filtros"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={ClipboardList} titulo={periodo.filtro === "hoy" && !periodo.ref ? "Hoy todavía no se ha contactado a nadie" : "No hay contactos en este período"} texto="Los de otros días siguen en el historial.">
            <button type="button" onClick={() => setPeriodo({ ...PERIODO_INICIAL })} className={CLASE_ACCION_SECUNDARIA}>Ver todas las fechas</button>
          </Vacio>
        )
      ) : (
        <>
          <ContenedorLista etiqueta="Contactos" encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
            {lista.slice(0, visibles).map((c) => {
              const p = pacienteDe.get(c.pacienteId)
              const r = resultadoEfectivo(c, citas)
              return (
                <li key={c.id} className="hover:bg-slate-50/70">
                  <button type="button" onClick={() => setDetalle(c)} className={"grid w-full grid-cols-1 items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left cursor-pointer " + COLUMNAS} aria-label={`Ver el contacto con ${p?.nombre || "un paciente"}`}>
                    <span className="text-sm text-slate-700">{formatoFecha(diaDeRegistro(c.creadoEn), "medioSinAnio")}<span className="block text-xs text-slate-500">{hora(c.creadoEn)}</span></span>
                    <span className="min-w-0 truncate text-sm font-bold text-slate-800">{p?.nombre || "Paciente eliminado"}</span>
                    <span className="min-w-0"><InsigniaMotivo motivo={c.motivo} /></span>
                    <span className="text-sm text-slate-600">{CANALES[c.canal] || c.canal}</span>
                    <span className="min-w-0 space-y-0.5">
                      <InsigniaResultado resultado={r} automatico={!c.resultado && r === "agendo"} />
                      {c.volverEl && <span className="block text-xs text-slate-500">Volver el {fechaLegible(c.volverEl)}</span>}
                    </span>
                    <span className="min-w-0 truncate text-sm text-slate-600">{c.creadoPorNombre || "—"}</span>
                  </button>
                </li>
              )
            })}
          </ContenedorLista>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>Respondieron = agendó, pidió volver a ser contactado, no le interesa o no desea mensajes. “No respondió” y “sin resultado” no cuentan. Un contacto sin resultado cuenta como “agendó” si el paciente agendó una cita después.</span>
            {visibles < n && <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>}
          </div>
        </>
      )}

      {detalle && (
        <DetalleContacto
          contacto={detalle} paciente={pacienteDe.get(detalle.pacienteId)} campana={campanas.find((k) => k.id === detalle.campanaId)} resultado={resultadoEfectivo(detalle, citas)}
          puedeRegistrar={puedeContactar && !detalle.resultado} onRegistrar={() => { const c = detalle; setDetalle(null); onResultado(c) }}
          onVerPerfil={onVerPerfil ? (id) => { setDetalle(null); onVerPerfil(id) } : null} onCerrar={() => setDetalle(null)}
        />
      )}
    </div>
  )
}

// El detalle de un contacto, en la ventana estándar: qué se hizo, qué se dijo y qué pasó.
function DetalleContacto({ contacto: c, paciente, campana, resultado, puedeRegistrar, onRegistrar, onVerPerfil, onCerrar }) {
  const Fila = ({ etiqueta, children }) => (<div className="flex gap-4 py-2 text-sm"><dt className="w-36 shrink-0 text-slate-500">{etiqueta}</dt><dd className="min-w-0 flex-1 font-medium text-slate-800">{children}</dd></div>)
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
            <InsigniaResultado resultado={resultado} automatico={!c.resultado && resultado === "agendo"} />
            {c.volverEl && <span className="ml-2 text-slate-600">Volver el {fechaLegible(c.volverEl)}</span>}
            {c.resultado && c.resultadoPorNombre && <span className="mt-1 block text-xs font-normal text-slate-500">Lo anotó {c.resultadoPorNombre}{c.resultadoEn ? `, el ${fechaHoraLegible(c.resultadoEn, { anio: true })}` : ""}</span>}
          </Fila>
        </dl>
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje</p>
          {c.mensaje ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-700">{c.mensaje}</p> : <p className="text-sm text-slate-500">No se guardó el texto de este contacto (por ejemplo, una llamada o una visita).</p>}
        </div>
      </div>
    </Cascaron>
  )
}
