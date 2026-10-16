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
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { hoyISO } from "../../utilidades/disponibilidad"

const POR_PAGINA = 30
// El orden de los filtros es el del pedido: primero lo vencido, luego lo que viene.
const FILTROS = ["control_vencido", "control_proximo", "cumpleanos", "sin_visitar", "postventa"]
const COLUMNAS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_16rem]"
const ENCABEZADO = [{ texto: "Paciente" }, { texto: "Motivo" }, { texto: "Último contacto" }, { texto: "" }]
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Pestaña "Para contactar": la lista de trabajo. Una fila por paciente con su motivo; dos acciones por fila (Contactar y Registrar resultado).
// Lo que se calcula (quién entra, quién descansa) viene hecho de crmContactos.listaParaContactar: aquí solo se muestra y se actúa.
export default function PestanaParaContactar({ filas: filasHoy, todas, sinPermiso, incluirTodos, onIncluirTodos, filtro, onFiltro, puedeContactar, puedeCampana, onContactar, onResultado, onVerPerfil, onIrACampanas }) {
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""

  // Lo de hoy, o todos los que tienen un motivo (como los cuentan el Inicio, Pacientes y Reportes): el mismo cálculo, dos vistas.
  const filas = incluirTodos ? todas : filasHoy
  const conteo = useMemo(() => contarPorMotivo(filas), [filas])
  const fuera = todas.length - filasHoy.length
  const lista = useMemo(() => {
    const porMotivo = filtrarPorMotivo(filas, filtro)
    const q = sinTildes(texto.trim())
    return q ? porMotivo.filter((f) => sinTildes(f.paciente.nombre).includes(q) || (f.telefono || "").includes(q)) : porMotivo
  }, [filas, filtro, texto])
  const n = lista.length
  const cambiarFiltro = (id) => { onFiltro(id); setVisibles(POR_PAGINA) }
  const limpiarBusqueda = () => { setTexto(""); setVisibles(POR_PAGINA) }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar por motivo" className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => cambiarFiltro("todos")} aria-pressed={filtro === "todos"} className={CLASE_PILDORA(filtro === "todos")} style={filtro === "todos" ? { background: GRAD_MARCA } : undefined}>
          Todos <span className="tabular-nums opacity-80">({conteo.total})</span>
        </button>
        {FILTROS.map((id) => (
          <button key={id} type="button" onClick={() => cambiarFiltro(id)} aria-pressed={filtro === id} className={CLASE_PILDORA(filtro === id)} style={filtro === id ? { background: GRAD_MARCA } : undefined}>
            {MOTIVOS[id].corta} <span className="tabular-nums opacity-80">({conteo.por[id]})</span>
          </button>
        ))}
        {(fuera > 0 || incluirTodos) && (
          <button type="button" onClick={() => { onIncluirTodos(!incluirTodos); setVisibles(POR_PAGINA) }} aria-pressed={incluirTodos} title="Suma a la lista a quienes ya se contactó hace poco o no desean recibir mensajes: así los números son los mismos del Inicio, Pacientes y Reportes"
            className={"ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (incluirTodos ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}>
            {incluirTodos ? "Mostrando también a quienes no hay que contactar hoy" : `Incluir a quienes no hay que contactar hoy (${fuera})`}
          </button>
        )}
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <ConteoCitas texto={plural(n, "paciente", "pacientes") + (buscando ? " con esa búsqueda" : filtro !== "todos" ? ` · ${MOTIVOS[filtro].etiqueta.toLowerCase()}` : " para contactar")} />
        {filas.length > 5 && (
          <div className="relative w-full max-w-xs">
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
          <ContenedorLista etiqueta="Pacientes para contactar" encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
            {lista.slice(0, visibles).map((f) => {
              const motivoActivo = filtro !== "todos" && f.motivos.some((m) => m.id === filtro) ? filtro : f.principal
              const detalle = f.motivos.find((m) => m.id === motivoActivo)?.detalle
              const u = f.ultimoContacto
              const pendiente = Boolean(f.sinResultado)
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
                    {f.estado === "descansa" && <p className="text-xs font-semibold text-slate-500">{f.descansaHasta ? `Vuelve a aparecer el ${formatoFecha(f.descansaHasta, "medioSinAnio")}` : "Descansa"}</p>}
                    {f.estado === "sin_permiso" && <p className="text-xs font-semibold text-red-700">No desea recibir mensajes</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    {puedeContactar && f.estado !== "sin_permiso" && (
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
            })}
          </ContenedorLista>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>
              El mensaje sale de las plantillas (Campañas → Plantillas). Cuando se le escribe, el contacto queda en Seguimiento.
              {!incluirTodos && sinPermiso > 0 && <> No aparecen {plural(sinPermiso, "paciente", "pacientes")} que no desean recibir mensajes.</>}
            </span>
            {visibles < n && <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>}
          </div>
        </>
      )}
    </div>
  )
}
