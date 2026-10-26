"use client"

import { useMemo, useState } from "react"
import { ClipboardCheck, MessageCircle, Megaphone, Search, UserCheck } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { ConteoCitas } from "../FiltrosCitas"
import { InsigniaMotivo, InsigniaResultado, NombrePaciente } from "./piezas"
import { CLASE_PILDORA } from "./estilosCrm"
import { CANALES, MOTIVOS, contarPorMotivo, filtrarPorMotivo } from "../../utilidades/crmContactos"
import { fechaLegible, formatoFecha } from "../../utilidades/formatoFecha"
import { dinero } from "../../utilidades/formatoMoneda"
import { Insignia } from "../ventas/Lista"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { hoyISO } from "../../utilidades/disponibilidad"
import { useModoCelular } from "../../utilidades/modoCelular"

const POR_PAGINA = 30
// El orden de los filtros es el del pedido: primero lo vencido, luego lo que viene.
const FILTROS = ["control_vencido", "control_proximo", "por_vender", "cumpleanos", "sin_visitar", "postventa"]
const COLUMNAS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_19.5rem]"
const ENCABEZADO = [{ texto: "Paciente" }, { texto: "Motivo" }, { texto: "Último contacto" }, { texto: "" }]
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Pestaña "Para contactar": la lista de trabajo. Una fila por paciente con su motivo; dos acciones por fila (Contactar y Registrar resultado).
// Lo que se calcula (quién entra, quién descansa) viene hecho de crmContactos.listaParaContactar: aquí solo se muestra y se actúa.
export default function PestanaParaContactar({ filas, sinPermiso, filtro, onFiltro, puedeContactar, puedeCampana, onContactar, onResultado, onVerPerfil, onIrACampanas }) {
  const celular = useModoCelular()
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""

  const conteo = useMemo(() => contarPorMotivo(filas), [filas])
  const lista = useMemo(() => {
    const porMotivo = filtrarPorMotivo(filas, filtro)
    const q = sinTildes(texto.trim())
    return q ? porMotivo.filter((f) => sinTildes(f.paciente.nombre).includes(q) || (f.telefono || "").includes(q)) : porMotivo
  }, [filas, filtro, texto])
  const n = lista.length
  const pildora = (activa) => (celular ? CLASE_PILDORA(activa).replace("px-3 py-1.5 text-xs", "px-4 text-base") : CLASE_PILDORA(activa))
  const cambiarFiltro = (id) => { onFiltro(id); setVisibles(POR_PAGINA) }
  const limpiarBusqueda = () => { setTexto(""); setVisibles(POR_PAGINA) }

  const renderFilas = () => lista.slice(0, visibles).map((f) => {
              const motivoActivo = filtro !== "todos" && f.motivos.some((m) => m.id === filtro) ? filtro : f.principal
              const detalle = f.motivos.find((m) => m.id === motivoActivo)?.detalle
              const pasePorVender = f.motivos.find((m) => m.id === "por_vender")?.pase
              const u = f.ultimoContacto
              const pendiente = Boolean(f.sinResultado)
              if (celular) return <TarjetaParaContactar key={f.id} f={f} motivoActivo={motivoActivo} detalle={detalle} proforma={pasePorVender?.proformaEntregadaEn ? (pasePorVender.proformaTotal ? `Proforma ${dinero(Number(pasePorVender.proformaTotal))}` : "Proforma") : null} hoy={hoy} puedeContactar={puedeContactar} pendiente={pendiente} onContactar={onContactar} onResultado={onResultado} onVerPerfil={onVerPerfil} />
              return (
                <li key={f.id} className={"grid grid-cols-1 items-center gap-x-3 gap-y-2 px-4 py-3 " + COLUMNAS}>
                  <div className="min-w-0">
                    <NombrePaciente paciente={f.paciente} onVerPerfil={onVerPerfil} className="block max-w-full" />
                    <p className="truncate text-xs text-slate-500">
                      {f.telefono || "Sin teléfono"}
                      {f.citaProxima && <span className="ml-2 font-semibold text-slate-600">· Con cita el {formatoFecha(f.citaProxima.fecha, "medioSinAnio")}</span>}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">{f.motivos.map((m) => <InsigniaMotivo key={m.id} motivo={m.id} />)}</div>
                    {detalle && <p className="truncate text-xs text-slate-500">{detalle}</p>}
                    {/* La proforma que ya se le entregó, para saber de cuánto fue la oferta al contactarlo. */}
                    {pasePorVender?.proformaEntregadaEn && <Insignia tono="azul" title={`Proforma entregada el ${fechaLegible(pasePorVender.proformaEntregadaEn)}`}>{pasePorVender.proformaTotal ? `Proforma ${dinero(Number(pasePorVender.proformaTotal))}` : "Proforma"}</Insignia>}
                  </div>
                  <div className="min-w-0 space-y-1 text-sm">
                    {u ? (
                      <>
                        <p className="truncate text-slate-700">{diaDeRegistro(u.creadoEn) === hoy ? "Hoy" : fechaLegible(diaDeRegistro(u.creadoEn))} · {CANALES[u.canal] || u.canal}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {f.reaparece ? <InsigniaResultado resultado="volver_a_contactar" /> : <InsigniaResultado resultado={f.resultadoUltimo} automatico={!u.resultado && f.resultadoUltimo === "agendo"} />}
                        </div>
                      </>
                    ) : <p className="text-slate-500">Sin contactar</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 lg:flex-nowrap lg:justify-end">
                    {puedeContactar && (
                      <>
                        <button type="button" onClick={() => onContactar(f, motivoActivo)} disabled={!f.telefono} title={f.telefono ? "Abre WhatsApp con el mensaje ya escrito" : "Sin número registrado"}
                          className={(pendiente ? CLASE_ACCION_SECUNDARIA : CLASE_ACCION_PRINCIPAL).replace("px-3.5", "px-3")} style={pendiente ? undefined : { background: GRAD_MARCA }} aria-label={`Contactar a ${f.paciente.nombre}`}>
                          <MessageCircle size={14} aria-hidden="true" /> Contactar
                        </button>
                        <button type="button" onClick={() => onResultado(f, motivoActivo)} aria-label={`Registrar resultado de ${f.paciente.nombre}`}
                          className={(pendiente ? CLASE_ACCION_PRINCIPAL : CLASE_ACCION_SECUNDARIA).replace("px-3.5", "px-3")} style={pendiente ? { background: GRAD_MARCA } : undefined}>
                          <ClipboardCheck size={14} aria-hidden="true" /> Registrar resultado
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar por motivo" className={celular ? "flex flex-nowrap items-center gap-2 overflow-x-auto pb-1" : "flex flex-wrap items-center gap-2"}>
        <button type="button" onClick={() => cambiarFiltro("todos")} aria-pressed={filtro === "todos"} className={pildora(filtro === "todos")} style={filtro === "todos" ? { background: GRAD_MARCA } : undefined}>
          Todos <span className="tabular-nums opacity-80">({conteo.total})</span>
        </button>
        {FILTROS.map((id) => (
          <button key={id} type="button" onClick={() => cambiarFiltro(id)} aria-pressed={filtro === id} className={pildora(filtro === id)} style={filtro === id ? { background: GRAD_MARCA } : undefined}>
            {MOTIVOS[id].corta} <span className="tabular-nums opacity-80">({conteo.por[id]})</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <ConteoCitas texto={plural(n, "paciente", "pacientes") + (buscando ? " con esa búsqueda" : filtro !== "todos" ? ` · ${MOTIVOS[filtro].etiqueta.toLowerCase()}` : " para contactar")} />
        {filas.length > 5 && (
          <div className={"relative w-full " + (celular ? "" : "max-w-xs")}>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <label htmlFor="crm-contactar-busqueda" className="sr-only">Buscar paciente</label>
            <input id="crm-contactar-busqueda" type="text" value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(POR_PAGINA) }} placeholder="Buscar paciente o teléfono"
              className="w-full rounded-xl border border-slate-200/60 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
          </div>
        )}
      </div>

      {n === 0 ? (
        filas.length === 0 ? (
          <Vacio Icono={UserCheck} titulo="Hoy no hay a quién contactar" texto="Los controles están al día y nadie cumple años esta semana. Cuando quieras escribirle a un grupo, prepara una campaña.">
            {puedeCampana && <button type="button" onClick={onIrACampanas} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Megaphone size={15} aria-hidden="true" /> Preparar una campaña</button>}
          </Vacio>
        ) : buscando ? (
          <Vacio Icono={Search} titulo="Ningún paciente coincide con la búsqueda">
            <button type="button" onClick={limpiarBusqueda} className={CLASE_ACCION_SECUNDARIA}>Quitar la búsqueda</button>
          </Vacio>
        ) : (
          <Vacio Icono={UserCheck} titulo={`Nadie tiene ahora el motivo “${MOTIVOS[filtro].etiqueta}”`} texto="Los demás pacientes de la lista siguen en Todos.">
            <button type="button" onClick={() => cambiarFiltro("todos")} className={CLASE_ACCION_SECUNDARIA}>Ver todos</button>
          </Vacio>
        )
      ) : (
        <>
          {celular ? <ul aria-label="Pacientes para contactar" className="space-y-3">{renderFilas()}</ul> : <ContenedorLista etiqueta="Pacientes para contactar" encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
            {renderFilas()}
          </ContenedorLista>}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>
              El mensaje sale de las plantillas (botón «Plantillas»). Cuando se le escribe, el contacto queda en el Historial de contactos.
              {sinPermiso > 0 && <> {plural(sinPermiso, "paciente tiene", "pacientes tienen")} un motivo que no se muestra porque no aceptó ese tipo de mensaje.</>}
            </span>
            {visibles < n && <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>}
          </div>
        </>
      )}
    </div>
  )
}

// Un paciente de «Para contactar» en el celular: su nombre, el motivo con su detalle, su último contacto y «Contactar» (la misma ventana de la computadora, que sube desde abajo). «Registrar resultado» sigue en la tarjeta.
function TarjetaParaContactar({ f, motivoActivo, detalle, proforma, hoy, puedeContactar, pendiente, onContactar, onResultado, onVerPerfil }) {
  const u = f.ultimoContacto
  return (
    <li data-paciente-id={f.id} className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {onVerPerfil
            ? <button type="button" onClick={() => onVerPerfil(f.paciente.id)} className="block max-w-full cursor-pointer break-words text-left text-lg font-bold leading-snug text-slate-900">{f.paciente.nombre}</button>
            : <p className="break-words text-lg font-bold leading-snug text-slate-900">{f.paciente.nombre}</p>}
          {detalle && <p className="text-base text-slate-600">{detalle}</p>}
        </div>
        {puedeContactar && (
          <button type="button" onClick={() => onContactar(f, motivoActivo)} disabled={!f.telefono} aria-label={`Contactar a ${f.paciente.nombre}`}
            className={"inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-4 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50 " + (pendiente ? "border border-slate-300 bg-white text-slate-800" : "text-white")} style={pendiente ? undefined : { background: GRAD_MARCA }}>
            <MessageCircle size={16} aria-hidden="true" /> Contactar
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {f.motivos.map((m) => <InsigniaMotivo key={m.id} motivo={m.id} />)}
        {proforma && <Insignia tono="azul">{proforma}</Insignia>}
      </div>
      <p className="mt-2 text-base text-slate-600">
        {f.telefono || "Sin teléfono"}
        {f.citaProxima && <span className="font-semibold"> · Con cita el {formatoFecha(f.citaProxima.fecha, "medioSinAnio")}</span>}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-slate-700">
        {u ? (
          <>
            <span>{diaDeRegistro(u.creadoEn) === hoy ? "Hoy" : fechaLegible(diaDeRegistro(u.creadoEn))} · {CANALES[u.canal] || u.canal}</span>
            {f.reaparece ? <InsigniaResultado resultado="volver_a_contactar" /> : <InsigniaResultado resultado={f.resultadoUltimo} automatico={!u.resultado && f.resultadoUltimo === "agendo"} />}
          </>
        ) : <span className="text-slate-600">Sin contactar</span>}
      </div>
      {puedeContactar && (
        <button type="button" onClick={() => onResultado(f, motivoActivo)} aria-label={`Registrar resultado de ${f.paciente.nombre}`} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-1 text-base font-semibold text-blue-700">
          <ClipboardCheck size={16} aria-hidden="true" /> Registrar resultado
        </button>
      )}
    </li>
  )
}
