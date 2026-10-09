"use client"

import { useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaAISO, hoyISO } from "../utilidades/disponibilidad"
import { formatoFecha, nombreMes } from "../utilidades/formatoFecha"

// Fondo de lo seleccionado: el degradado de la marca. `backgroundOrigin: border-box` porque con un borde transparente el degradado
// se repetía bajo el borde y dejaba el extremo izquierdo con el color contrario (se veía como cortado).
const ESTILO_ACTIVO = { background: GRAD_MARCA, backgroundOrigin: "border-box" }

// Piezas de la barra de Citas: la barra única de búsqueda y filtros, el periodo de la Lista y el conteo.

// Cierra un popover con Escape o al hacer clic fuera.
function useCierre(abierto, cerrar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar() }
    const tecla = (e) => { if (e.key === "Escape") cerrar() }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto, cerrar])
  return ref
}

// Barra única de búsqueda y filtros: "Filtrar" abre un panel con todas las categorías a la vista (los filtros elegidos quedan como etiquetas con su "x" dentro de la
// barra, y el campo de búsqueda ocupa el resto. "Limpiar" quita etiquetas y búsqueda.
// secciones: [{ id, titulo, valor, onChange, opciones: [{ id, etiqueta }], tipo?: "chips" | "lista" | "rango" }] (el tipo "rango" lleva `rango`: { desde, hasta, onDesde, onHasta })
export function BarraBusquedaFiltros({ texto, onTexto, secciones, etiquetas, onLimpiar, placeholder = "Buscar cita: paciente o código", inputId = "citas-busqueda", inputRef, etiquetaPanel = "Filtrar citas" }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const hayAlgo = etiquetas.length > 0 || texto.trim() !== ""
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <div className="flex h-[38px] flex-nowrap items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-1.5 py-1 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls={inputId + "-panel"}
          className={"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (abierto ? "border-slate-400 bg-slate-50 text-slate-800" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
        >
          <SlidersHorizontal size={14} aria-hidden="true" /> Filtrar
          {etiquetas.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={ESTILO_ACTIVO}>{etiquetas.length}</span>}
          <ChevronDown size={13} className={"transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {etiquetas.map((e) => (
          <span key={e.id} title={e.texto} className="inline-flex min-w-0 max-w-[14rem] shrink items-center gap-1 rounded-full border border-slate-200/60 bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
            <span className="truncate">{e.texto}</span>
            <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="shrink-0 rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 cursor-pointer">
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <div className="relative min-w-[6rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor={inputId} className="sr-only">{placeholder}</label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none"
          />
        </div>
        {hayAlgo && (
          <button type="button" onClick={onLimpiar} className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
            <X size={12} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>
      {abierto && (
        <div id={inputId + "-panel"} role="dialog" aria-label={etiquetaPanel} className="absolute left-0 top-full z-30 mt-1.5 w-[24rem] max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {secciones.map((s) => (
            <div key={s.id} role="group" aria-label={s.titulo} className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{s.titulo}</span>
              {s.tipo === "rango" ? (
                <SeccionRango rango={s.rango} />
              ) : s.tipo === "lista" ? (
                <select
                  aria-label={s.titulo}
                  value={s.valor}
                  onChange={(e) => s.onChange(e.target.value)}
                  className={"w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-100 " + (s.valor === s.opciones[0].id ? "border-slate-200/60 bg-white text-slate-600" : "border-transparent text-white")}
                  style={s.valor === s.opciones[0].id ? undefined : ESTILO_ACTIVO}
                >
                  {s.opciones.map((o) => <option key={o.id} value={o.id} className="text-slate-800">{o.etiqueta}{o.conteo != null ? ` (${o.conteo})` : ""}</option>)}
                </select>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {s.opciones.map((o) => {
                    const activo = s.valor === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => s.onChange(activo ? s.opciones[0].id : o.id)} title={activo && o.id !== s.opciones[0].id ? "Clic de nuevo para quitar este filtro" : undefined}
                        aria-pressed={activo}
                        className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}
                        style={activo ? ESTILO_ACTIVO : undefined}
                      >
                        {o.etiqueta}
                        {o.conteo != null && <span className={"rounded-full px-1.5 text-[11px] font-bold tabular-nums " + (activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{o.conteo}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]

// Calendario del rango, con el mismo estilo del selector de fecha de las citas: el primer clic marca el inicio, el
// segundo el final (si es anterior, se intercambian) y el trayecto queda sombreado. "Borrar" quita el rango.
function CalendarioRango({ rango }) {
  const hoy = hoyISO()
  const ref = rango.desde || rango.hasta || hoy
  const [mes, setMes] = useState(() => new Date(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)) - 1, 1))
  const { desde, hasta } = rango
  const eligiendoFin = Boolean(desde) && !hasta
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const celdas = [...Array((primero.getDay() + 6) % 7).fill(null), ...Array.from({ length: new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate() }, (_, i) => fechaAISO(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))]
  const elegir = (iso) => {
    if (eligiendoFin) {
      const [d, h] = iso < desde ? [iso, desde] : [desde, iso]
      rango.onDesde(d); rango.onHasta(h)
    } else { rango.onDesde(iso); rango.onHasta("") }
  }
  const corta = (iso) => formatoFecha(iso, "medioSinAnio")
  const resumen = desde && hasta ? `${corta(desde)} – ${corta(hasta)}` : desde ? `Desde el ${corta(desde)} · elige el final` : "Elige el inicio y el final"
  const flecha = "rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200/60 bg-slate-50/40 p-2.5">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <span className="text-xs font-bold" style={{ color: INK }}>{formatoFecha(mes, "mesAnio")}</span>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior" className={flecha}><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente" className={flecha}><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-slate-500">{DIAS_CORTOS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {celdas.map((iso, i) => {
            if (!iso) return <span key={"v" + i} />
            const extremo = iso === desde || iso === hasta
            const dentro = desde && hasta && iso > desde && iso < hasta
            return (
              <button
                key={iso}
                type="button"
                onClick={() => elegir(iso)}
                aria-pressed={extremo}
                aria-label={formatoFecha(iso, "numerico")}
                className={"h-7 text-xs font-semibold tabular-nums transition-colors cursor-pointer " + (extremo ? "rounded-lg text-white" : dentro ? "bg-slate-200/70 text-slate-800" : "rounded-lg text-slate-700 hover:bg-slate-200/70") + (!extremo && iso === hoy ? " ring-1 ring-inset ring-slate-400 rounded-lg" : "")}
                style={extremo ? ESTILO_ACTIVO : undefined}
              >
                {Number(iso.slice(8))}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="truncate text-xs font-semibold text-slate-600">{resumen}</span>
        {(desde || hasta) && <button type="button" onClick={() => { rango.onDesde(""); rango.onHasta("") }} className="shrink-0 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">Borrar</button>}
      </div>
    </div>
  )
}

// Periodo de la Lista: Hoy · Semana · Mes. Con un rango de fechas elegido en el panel "Filtrar" ninguno queda marcado.
export function PeriodoLista({ valor, onChange, opciones, sinActivo = false }) {
  return (
    <div role="group" aria-label="Periodo de las citas" className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
      {opciones.map((o) => {
        const activo = !sinActivo && valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            className={"inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-600 hover:bg-slate-50")}
            style={activo ? ESTILO_ACTIVO : undefined}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// Selector del periodo: el título pasa a ser un botón que despliega un calendario para ir directo a un día, una semana o un mes.
//   unidad: "dia" | "semana" | "mes" — qué se resalta al pasar el cursor y qué abarca lo elegido.
//   visible: { desde, hasta } del periodo que se ve ahora (se resalta); onElegir(iso, tipo) con tipo "dia" | "mes".
function SelectorPeriodo({ titulo, unidad, visible, onElegir }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const hoy = hoyISO()
  const ancla = visible?.desde || hoy
  const [modo, setModo] = useState("dias")
  const [mes, setMes] = useState(() => new Date(Number(ancla.slice(0, 4)), Number(ancla.slice(5, 7)) - 1, 1))
  const [anio, setAnio] = useState(mes.getFullYear())
  const [pasoPor, setPasoPor] = useState(null)
  const alternar = () => {
    if (!abierto) {
      const m = new Date(Number(ancla.slice(0, 4)), Number(ancla.slice(5, 7)) - 1, 1)
      setMes(m); setAnio(m.getFullYear()); setModo(unidad === "mes" ? "meses" : "dias"); setPasoPor(null)
    }
    setAbierto((v) => !v)
  }
  const elegir = (iso, tipo) => { onElegir(iso, tipo); setAbierto(false) }
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const celdas = [...Array((primero.getDay() + 6) % 7).fill(null), ...Array.from({ length: new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate() }, (_, i) => fechaAISO(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))]
  while (celdas.length % 7 !== 0) celdas.push(null)
  const semanas = Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7))
  const enVisible = (iso) => visible && iso >= visible.desde && iso <= (visible.hasta || visible.desde)
  const flecha = "rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
  const mesActual = (indice) => anio === Number(ancla.slice(0, 4)) && indice === Number(ancla.slice(5, 7)) - 1 && unidad === "mes"
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title="Elegir otra fecha"
        className={"inline-flex h-9 w-44 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold shadow-sm transition-colors cursor-pointer " + (abierto ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200/60 bg-white hover:border-slate-300 hover:bg-slate-50")}
        style={abierto ? undefined : { color: INK }}
      >
        <span>{titulo}</span>
        <ChevronDown size={14} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180 text-blue-600" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="dialog" aria-label="Elegir fecha" className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200/60 bg-white p-3.5 shadow-xl" style={{ animation: "rise-in 160ms ease-out both" }}>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setModo((m) => (m === "dias" ? "meses" : "dias"))}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold transition-colors hover:bg-slate-200 cursor-pointer"
              style={{ color: INK }}
              aria-label={modo === "dias" ? "Elegir otro mes" : "Volver a los días"}
            >
              {modo === "dias" ? formatoFecha(mes, "mesAnio") : anio}
              <ChevronDown size={12} className={modo === "meses" ? "rotate-180" : ""} aria-hidden="true" />
            </button>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => (modo === "dias" ? setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1)) : setAnio((a) => a - 1))} aria-label={modo === "dias" ? "Mes anterior" : "Año anterior"} className={flecha}><ChevronLeft size={14} /></button>
              <button type="button" onClick={() => (modo === "dias" ? setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1)) : setAnio((a) => a + 1))} aria-label={modo === "dias" ? "Mes siguiente" : "Año siguiente"} className={flecha}><ChevronRight size={14} /></button>
            </div>
          </div>
          {modo === "meses" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => elegir(fechaAISO(new Date(anio, i, 1)), "mes")}
                  aria-pressed={mesActual(i)}
                  className={"rounded-xl py-2.5 text-xs font-semibold capitalize transition-colors cursor-pointer " + (mesActual(i) ? "text-white" : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700")}
                  style={mesActual(i) ? ESTILO_ACTIVO : undefined}
                >
                  {nombreMes(i, "corto")}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-slate-500">{DIAS_CORTOS.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="space-y-0.5" onMouseLeave={() => setPasoPor(null)}>
                {semanas.map((fila, f) => {
                  const dentro = fila.some((iso) => iso && enVisible(iso))
                  const resaltarFila = unidad === "semana" && (dentro || pasoPor === f)
                  return (
                    <div key={f} onMouseEnter={() => setPasoPor(f)} className={"grid grid-cols-7 rounded-lg transition-colors " + (resaltarFila ? (dentro ? "bg-blue-100/80" : "bg-slate-100") : "")}>
                      {fila.map((iso, c) => {
                        if (!iso) return <span key={c} />
                        const esHoyCelda = iso === hoy
                        const activoDia = unidad === "dia" && enVisible(iso)
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => elegir(iso, "dia")}
                            aria-label={formatoFecha(iso, "largo")}
                            aria-pressed={activoDia}
                            className={"h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer " + (activoDia ? "text-white" : (unidad === "semana" && dentro ? "text-blue-800" : "text-slate-700") + (unidad === "dia" ? " hover:bg-blue-50" : "")) + (esHoyCelda && !activoDia ? " ring-1 ring-inset ring-blue-400" : "")}
                            style={activoDia ? ESTILO_ACTIVO : undefined}
                          >
                            {Number(iso.slice(8))}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <button type="button" onClick={() => elegir(hoy, unidad === "mes" ? "mes" : "dia")} className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
              Ir a hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Flechas ‹ › con el título del periodo que se ve (igual en Lista, Semana y Mes). Con `selector` el título abre el calendario para elegir otra fecha.
export function NavegadorPeriodo({ titulo, onAnterior, onSiguiente, etiquetaAnterior, etiquetaSiguiente, selector }) {
  const flecha = "grid h-full w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
  return (
    <div className="flex min-w-0 items-center gap-2">
      {selector ? (
        <SelectorPeriodo titulo={titulo} unidad={selector.unidad} visible={selector.visible} onElegir={selector.onElegir} />
      ) : (
        <h2 className="min-w-[7.9rem] shrink-0 whitespace-nowrap text-[13px] font-semibold" style={{ color: INK }}>{titulo}</h2>
      )}
      <div className="flex h-9 shrink-0 items-center rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
        <button type="button" onClick={onAnterior} aria-label={etiquetaAnterior} title={etiquetaAnterior} className={flecha}><ChevronLeft size={14} /></button>
        <button type="button" onClick={onSiguiente} aria-label={etiquetaSiguiente} title={etiquetaSiguiente} className={flecha}><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}

// Sección "Fechas" del panel: un botón con el rango elegido que despliega el calendario. También la usa el historial del perfil del paciente.
export function SeccionRango({ rango, flotante = false }) {
  const [abierto, setAbierto] = useState(!flotante && Boolean(rango.desde))
  const refFlotante = useCierre(flotante && abierto, () => setAbierto(false))
  const corta = (iso) => formatoFecha(iso, "medioSinAnio")
  const texto = rango.desde && rango.hasta ? `${corta(rango.desde)} – ${corta(rango.hasta)}` : rango.desde ? `Desde el ${corta(rango.desde)}` : "Elegir rango de fechas…"
  const hay = Boolean(rango.desde || rango.hasta)
  return (
    <div ref={flotante ? refFlotante : undefined} className={flotante ? "relative" : "space-y-2"}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={"flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (hay ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
        style={hay ? ESTILO_ACTIVO : undefined}
      >
        <span className="truncate">{texto}</span>
        <ChevronDown size={13} className={"shrink-0 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (flotante
        ? <div data-popover-abierto className="absolute right-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/60 bg-white p-2.5 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}><CalendarioRango rango={rango} /></div>
        : <CalendarioRango rango={rango} />)}
    </div>
  )
}

// Cuántas citas se ven ("5 citas", "0 citas"): siempre el mismo formato, con o sin resultados.
export function ConteoCitas({ texto }) {
  return <p role="status" className="shrink-0 text-xs text-slate-500">{texto}</p>
}
