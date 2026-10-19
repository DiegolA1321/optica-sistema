"use client"

// La graduación del paciente, un solo componente para los dos lados (regla 18): el portal del paciente (`version="paciente"`, palabras simples) y el perfil del paciente del sistema
// del personal (`version="personal"`, notación técnica: OD y OI, esfera, cilindro, eje, adición, agudeza visual y distancia pupilar). Mismas cuentas (`utilidades/graduacion.js`),
// mismos datos y mismo orden: lo que el optómetra le explica al paciente en la consulta es lo que el paciente lee en su portal.
import { useEffect, useMemo, useRef, useState } from "react"
import { Glasses, ChevronDown, ChevronRight, ArrowRight, Printer, GitCompare, Download, Info, Check, MessageSquareText } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { valorD } from "../../utilidades/portalVistas"
import { agudezaConLentes, textoAgudeza } from "../../utilidades/agudeza"
import { medidasLegibles, lecturaDeOjo, numero, cambioPorOjo, aniosDeRecetas, filtrarRecetasPorAnio, lineaDeEsferas, compararRecetas, textoDelta } from "../../utilidades/graduacion"
import { AYUDA_RECETA } from "../../utilidades/portalPaciente"
import { Cascaron } from "../AtencionPaciente"
import OjoIlustrado from "./OjoIlustrado"

const Partes = ({ partes }) => partes.map((p, i) => (p.b ? <strong key={i} className="font-bold">{p.t}</strong> : <span key={i}>{p.t}</span>))
const LADOS = [["od", "Ojo derecho", "OD"], ["oi", "Ojo izquierdo", "OI"]]
const COLOR_LADO = { od: "#1d4ed8", oi: "#0891b2" }

// Un ojo sin ninguna medida en esta receta: se dice en una sola línea, no con una cuadrícula de «No registrado».
export const ojoSinDatos = (o = {}) => !["esfera", "cilindro", "eje", "avSc", "avCc", "avRx"].some((k) => String(o?.[k] ?? "").trim() !== "")
const NOMBRE_SIN_DATOS = { od: "ojo derecho", oi: "ojo izquierdo" }
// Un ojo que el optómetra marcó «Ojo no evaluado» dice su motivo en todas las vistas; si no, simplemente no hay datos de ese ojo.
const sinDatosDelOjo = (lado, receta) => (receta?.ojoNoEvaluado?.[lado] ? `Ojo no evaluado: ${receta.ojoNoEvaluado[lado]}` : `Sin datos del ${NOMBRE_SIN_DATOS[lado]} en esta receta`)

// Toda la tarjeta del ojo se pulsa y abre «Historia de este ojo»: el botón transparente cubre la tarjeta y «Ver la historia ›» lo avisa.
const AbrirOjo = ({ lado, onOjo, paciente }) => onOjo && (
  <>
    <button type="button" onClick={() => onOjo(lado)} aria-label={`Ver la historia del ${NOMBRE_SIN_DATOS[lado]}: todas sus recetas y cómo cambió su esfera`} className="pt-abrir absolute inset-0 rounded-[inherit] cursor-pointer" />
    <p className={"mt-3 flex items-center gap-1 font-semibold " + (paciente ? "text-base text-pt-azul" : "text-sm text-blue-600")} aria-hidden="true">Ver la historia de este ojo <ChevronRight size={paciente ? 20 : 16} /></p>
  </>
)

// ───────────────────────── La graduación vigente ─────────────────────────
// Dos ojos ilustrados con su esfera. Paciente: la explicación de cada ojo y de cada dato; el ojo derecho va a la DERECHA y el izquierdo a la IZQUIERDA, desde la perspectiva del paciente
// (en pantalla angosta, donde se apilan, va primero el derecho). Personal: los valores técnicos de cada ojo, con OD a la izquierda como en la receta impresa.
export function GraduacionVigente({ receta, anterior = null, version = "paciente", onOjo }) {
  if (!receta) return null
  if (version === "personal") return <VigentePersonal receta={receta} anterior={anterior} onOjo={onOjo} />
  return (
    <div className="@container">
      <div className="grid gap-5 @[56rem]:grid-cols-2 @[56rem]:gap-6">
        {LADOS.map(([lado, nombre]) => {
          const l = lecturaDeOjo(receta, lado)
          if (ojoSinDatos(receta[lado])) {
            return (
              <section key={lado} aria-label={nombre} data-lado={lado} className={"pt-abrible relative min-w-0 self-start rounded-[20px] border border-pt-borde bg-white p-5 transition-shadow hover:shadow-md sm:px-[34px] sm:py-7 " + (lado === "od" ? "@[56rem]:order-2" : "@[56rem]:order-1")}>
                <p className="text-lg font-semibold text-pt-marino">{nombre}</p>
                <p className="mt-2 text-lg text-pt-texto">{sinDatosDelOjo(lado, receta)}.</p>
                <AbrirOjo lado={lado} onOjo={onOjo} paciente />
              </section>
            )
          }
          const filas = [
            ["Astigmatismo", l.hayAstigmatismo ? `${valorD(l.cilindro)}${l.eje ? ` · ${l.eje}°` : ""}` : "—", l.explicaCilindro],
            ...(l.adicion ? [["Para leer de cerca", valorD(l.adicion), l.explicaCerca]] : []),
            ...(l.agudeza ? [[l.conLentes ? "Cómo ves con tus lentes" : "Cómo ves sin lentes", l.agudeza, l.explicaAgudeza]] : []),
          ]
          return (
            <section key={lado} aria-label={nombre} data-lado={lado} className={"@container min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[34px] sm:py-7 " + (onOjo ? "pt-abrible relative transition-colors hover:border-pt-azul hover:bg-pt-fondo/60 " : "") + (lado === "od" ? "@[56rem]:order-2" : "@[56rem]:order-1")}>
              <div className="grid items-center gap-x-8 gap-y-4 @[24rem]:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex flex-col items-center text-center">
                  <OjoIlustrado ancho={150} />
                  <p className="mt-1 font-heading text-[44px] font-bold leading-none tabular-nums text-pt-marino">{valorD(l.esfera) || "—"}</p>
                  <p className="mt-1 text-base text-pt-texto">esfera</p>
                  <p className="mt-2 text-lg font-semibold text-pt-marino">{nombre}</p>
                </div>
                <p className="text-lg leading-relaxed text-pt-marino"><Partes partes={l.explicaEsfera} /></p>
              </div>
              <dl className="mt-5 divide-y divide-pt-borde border-t border-pt-borde">
                {filas.map(([titulo, valor, texto]) => (
                  <div key={titulo} className="grid gap-x-5 gap-y-1 py-3.5 @[24rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.5fr)] @[24rem]:items-start">
                    <dt className="text-base text-pt-texto">{titulo}</dt>
                    <dd className="font-heading text-xl font-bold tabular-nums text-pt-marino @[24rem]:min-w-[5.5rem]">{valor}</dd>
                    <dd className="text-base leading-snug text-pt-texto">{texto}</dd>
                  </div>
                ))}
              </dl>
              <AbrirOjo lado={lado} onOjo={onOjo} paciente />
            </section>
          )
        })}
      </div>
    </div>
  )
}

// El dato que falta, dicho: «No registrado» (nunca un guion).
const NoRegistrado = () => <span className="font-normal text-slate-400">No registrado</span>

// La versión técnica: los mismos ojos grandes, con notación OD y OI y todos los valores de la receta (esfera, cilindro, eje, agudeza con y sin lentes, adición, distancia pupilar y altura).
// Sin esfera, en lugar del valor grande va un texto pequeño y gris: «Sin registrar». En el espacio libre de cada ojo: cuánto cambió desde la receta anterior y la explicación en palabras
// simples (la misma del portal), en letra pequeña.
function VigentePersonal({ receta, anterior, onOjo }) {
  const m = receta.medidas || {}
  // Adición y distancia pupilar siempre (con «No registrado» si faltan); la altura (solo las fichas anteriores la guardaban) y el prisma, solo si hay.
  const todasLasMedidas = medidasLegibles(m)
  const medidas = todasLasMedidas.filter(([t, x]) => x || t === "Adición" || t === "Distancia pupilar (DP)")
  const cambios = anterior ? cambioPorOjo([receta, anterior]) : null
  const desde = anterior ? nombreMes(Number(String(anterior.fecha).slice(5, 7)) - 1) : ""
  return (
    <div className="@container space-y-3">
      <div className="grid gap-4 @[44rem]:grid-cols-2">
        {LADOS.map(([lado, nombre, sigla]) => {
          const o = receta[lado] || {}
          const datos = [["Cilindro", valorD(o.cilindro)], ["Eje", o.eje ? `${o.eje}°` : ""], ["AV sin lentes", textoAgudeza(o.avSc, o.avScF)], [o.avRx ? "AV con la receta" : "AV con lentes", textoAgudeza(agudezaConLentes(o), o.avRx ? o.avRxF : o.avCcF)]]
          const l = lecturaDeOjo(receta, lado)
          const v = cambios?.find((c) => c.lado === lado)?.variacion
          const delta = v == null ? "" : Math.abs(v) < 0.25 ? `Sin cambios desde ${desde}` : `${textoDelta(v)} desde ${desde}`
          if (ojoSinDatos(o)) {
            return (
              <section key={lado} aria-label={nombre} data-lado={lado} className={"self-start rounded-2xl border border-slate-200/60 bg-white p-5 " + (lado === "od" ? "@[44rem]:order-2 " : "@[44rem]:order-1 ") + (onOjo ? "pt-abrible relative transition-colors hover:border-blue-300 hover:bg-blue-50/30" : "")}>
                <p className="text-sm font-bold uppercase tracking-wide" style={{ color: COLOR_LADO[lado] }}>{sigla} · {nombre}</p>
                <p className="mt-2 text-base text-slate-500">{sinDatosDelOjo(lado, receta)}.</p>
                <AbrirOjo lado={lado} onOjo={onOjo} paciente={false} />
              </section>
            )
          }
          return (
            <section key={lado} aria-label={nombre} data-lado={lado} className={"@container rounded-2xl border border-slate-200/60 bg-white p-5 " + (lado === "od" ? "@[44rem]:order-2 " : "@[44rem]:order-1 ") + (onOjo ? "pt-abrible relative transition-colors hover:border-blue-300 hover:bg-blue-50/30" : "")}>
              <div className="flex items-start gap-5">
                <OjoIlustrado ancho={150} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-wide" style={{ color: COLOR_LADO[lado] }}>{sigla} · {nombre}</p>
                  {valorD(o.esfera) ? <p className="text-5xl font-bold leading-tight tabular-nums text-slate-900">{valorD(o.esfera)}</p> : <p className="py-3 text-sm text-slate-400">Sin registrar</p>}
                  <p className="text-sm text-slate-500">Esfera{delta && <span className="font-semibold text-slate-600"> · {delta}</span>}</p>
                  {valorD(o.esfera) && <p className="mt-1.5 text-xs leading-snug text-slate-500"><Partes partes={l.explicaEsfera} /></p>}
                </div>
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-base @[34rem]:grid-cols-2">
                {datos.map(([t, x]) => <div key={t} className="flex items-baseline justify-between gap-2"><dt className="text-slate-500">{t}</dt><dd className="text-right font-semibold tabular-nums text-slate-900">{x || <NoRegistrado />}</dd></div>)}
              </dl>
              <AbrirOjo lado={lado} onOjo={onOjo} paciente={false} />
            </section>
          )
        })}
      </div>
      {todasLasMedidas.every(([, x]) => !x)
        ? <p aria-label="Medidas de la receta" className="rounded-xl bg-slate-50 px-4 py-2.5 text-base text-slate-500">Sin adición, distancia pupilar ni altura de montaje en esta receta.</p>
        : (
          <dl aria-label="Medidas de la receta" className="flex flex-wrap gap-x-8 gap-y-1 rounded-xl bg-slate-50 px-4 py-2.5 text-base">
            {medidas.map(([t, x]) => <div key={t} className="flex items-baseline gap-2"><dt className="text-slate-500">{t}</dt><dd className="font-semibold tabular-nums text-slate-900">{x || <NoRegistrado />}</dd></div>)}
          </dl>
        )}
    </div>
  )
}

// ───────────────────────── Antes → ahora ─────────────────────────
// `onElegir()`: cada fila se pulsa y cambia la vista a la receta anterior (de la que se compara).
export function CambioGraduacion({ consultas, version = "paciente", onElegir }) {
  const cambio = useMemo(() => cambioPorOjo(consultas), [consultas])
  if (!cambio) return null
  const paciente = version === "paciente"
  const hayCambio = cambio.some((o) => o.texto && o.texto !== "Sin cambios")
  const chip = (c, claseExtra) => <span className={"inline-flex items-baseline gap-2 rounded-lg px-3 py-1.5 " + claseExtra}><span className={paciente ? "text-base" : "text-xs"}>{c.fecha}</span><span className={"font-bold tabular-nums " + (paciente ? "text-lg" : "text-sm")}>{valorD(c.valor) || (paciente ? "—" : "No registrado")}</span></span>
  return (
    <section aria-label={paciente ? "Cómo cambió desde tu examen anterior" : "Cambio desde la consulta anterior"} className={"min-w-0 " + (paciente ? "rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6" : "rounded-2xl border border-slate-200/60 bg-white p-4")}>
      <h3 className={paciente ? "font-heading text-xl font-bold text-pt-marino" : "text-sm font-bold text-slate-900"}>{paciente ? "Cómo cambió desde tu examen anterior" : "Cambio desde la consulta anterior"}</h3>
      <p className={paciente ? "mt-1 text-base text-pt-texto" : "mt-0.5 text-xs text-slate-500"}>{paciente ? (hayCambio ? "Un cambio pequeño y normal con el tiempo." : "Tu graduación se mantiene igual.") : "Esfera de cada ojo en las dos últimas consultas. Pulsa una fila para comparar las dos recetas."}</p>
      <ul className={"mt-3 divide-y " + (paciente ? "divide-pt-borde border-t border-pt-borde" : "divide-slate-100 border-t border-slate-100")}>
        {cambio.map((o, i) => {
          const contenido = (
            <>
              <p className={paciente ? "self-center text-lg font-bold text-pt-marino" : "self-center text-sm font-bold"} style={paciente ? undefined : { color: COLOR_LADO[o.lado] }}>{paciente ? o.nombre : LADOS[i][2] + " · " + o.nombre}</p>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  {chip(o.antes, paciente ? "bg-pt-fondo text-pt-texto" : "bg-slate-50 text-slate-600")}
                  <ArrowRight size={paciente ? 24 : 18} className={paciente ? "text-pt-azul" : "text-blue-600"} aria-label="a" />
                  {chip(o.ahora, paciente ? "bg-pt-suave text-[#1B4FB5]" : "bg-blue-50 text-blue-700")}
                </div>
                <p className={paciente ? "mt-1.5 text-lg text-pt-marino" : "mt-1 text-sm text-slate-600"}>{paciente ? o.texto : (o.variacion === null ? "No registrado" : o.texto === "Sin cambios" ? "Sin cambios" : (o.variacion > 0 ? "Aumentó " : "Disminuyó ") + Math.abs(o.variacion).toFixed(2) + " D (equivalente esférico)")}</p>
              </div>
            </>
          )
          const clase = "grid w-full gap-x-6 gap-y-1.5 text-left " + (paciente ? "@[30rem]:grid-cols-[9rem_minmax(0,1fr)] py-3.5" : "sm:grid-cols-[7rem_minmax(0,1fr)] py-3")
          return (
            <li key={o.lado}>
              {onElegir
                ? <button type="button" onClick={onElegir} aria-label={`Comparar las dos recetas (${o.antes.fecha} y ${o.ahora.fecha}): ${o.nombre}`} className={clase + " rounded-lg transition-colors cursor-pointer " + (paciente ? "hover:bg-pt-fondo" : "px-2 hover:bg-slate-50")}>{contenido}</button>
                : <div className={clase}>{contenido}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ───────────────────────── El selector de receta ─────────────────────────
// «Receta del 20 de abril de 2026 · vigente»: la receta que se muestra. Al pulsarla se abre un menú con todas las recetas del paciente y un filtro por año; al elegir una, cambia toda la
// vista. Con una sola receta es un rótulo, no un control (un selector que no ofrece nada más no aparece).
const CHIP = (activo, paciente) => paciente
  ? "inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors cursor-pointer " + (activo ? "bg-pt-azul text-white" : "border border-pt-borde bg-white text-pt-marino hover:bg-pt-fondo")
  : "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")

export function SelectorReceta({ recetas, valorId, onElegir, version = "paciente" }) {
  const paciente = version === "paciente"
  const [abierto, setAbierto] = useState(false)
  const [anio, setAnio] = useState("todas")
  const raiz = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false) }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto])
  const anios = useMemo(() => aniosDeRecetas(recetas), [recetas])
  const actual = recetas.find((r) => String(r.id) === String(valorId)) || recetas[0]
  const rotulo = (r) => `Receta del ${formatoFecha(r.fecha, "largoSinDia")}${r.id === recetas[0]?.id ? " · vigente" : ""}`
  if (recetas.length < 2) return <p className={paciente ? "text-lg font-semibold text-pt-marino" : "text-sm font-semibold text-slate-800"}>{rotulo(actual)}</p>
  const visibles = filtrarRecetasPorAnio(recetas, anio)
  return (
    <div className="relative" ref={raiz}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="listbox" aria-expanded={abierto} aria-label={`Elegir otra receta. Se muestra: ${rotulo(actual)}`}
        className={"inline-flex w-full items-center justify-between gap-3 border bg-white text-left font-semibold transition-colors cursor-pointer " + (paciente ? "@[40rem]:w-[22.5rem] min-h-12 rounded-xl border-[1.5px] border-slate-300/80 px-4 text-base text-pt-marino hover:bg-slate-50" : "min-h-10 rounded-lg border-slate-300 px-3 text-sm text-slate-800 hover:bg-slate-50")}>
        <span>{rotulo(actual)}</span>
        <ChevronDown size={paciente ? 20 : 16} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div className={"absolute left-0 top-full z-40 mt-2 w-[min(26rem,calc(100vw-2rem))] @[56rem]:left-auto @[56rem]:right-0 rounded-2xl border bg-white p-3 shadow-2xl " + (paciente ? "border-pt-borde" : "border-slate-200")}>
          {anios.length > 1 && (
            <div role="group" aria-label="Filtrar por año" className="mb-2 flex flex-wrap gap-2">
              {["todas", ...anios].map((a) => <button key={a} type="button" aria-pressed={anio === a} onClick={() => setAnio(a)} className={CHIP(anio === a, paciente)}>{a === "todas" ? "Todas" : a}</button>)}
            </div>
          )}
          <ul role="listbox" aria-label="Recetas del paciente" className="max-h-72 overflow-y-auto">
            {visibles.map((r) => {
              const elegida = String(r.id) === String(actual.id)
              return (
                <li key={r.id} role="presentation">
                  <button type="button" role="option" aria-selected={elegida} onClick={() => { onElegir(r.id); setAbierto(false) }} className={"flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors cursor-pointer " + (paciente ? "min-h-14 py-2 " : "min-h-11 py-1.5 ") + (elegida ? (paciente ? "bg-pt-suave" : "bg-blue-50") : "hover:bg-slate-50")}>
                    <span className="min-w-0 flex-1">
                      <span className={"block font-semibold leading-snug " + (paciente ? "text-base text-pt-marino" : "text-sm text-slate-900")}>{formatoFecha(r.fecha, "largoSinDia")}{r.id === recetas[0]?.id && <span className={paciente ? "text-pt-azul" : "text-blue-600"}> · vigente</span>}</span>
                      <span className={"block " + (paciente ? "text-base text-pt-texto" : "text-xs text-slate-500")}>{lineaDeEsferas(r, valorD) || "Consulta registrada"}</span>
                    </span>
                    {elegida && <Check size={paciente ? 20 : 16} className={paciente ? "text-pt-azul" : "text-blue-600"} aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
            {visibles.length === 0 && <li className="px-3 py-3 text-base text-slate-500">No hay recetas de ese año.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

// Las indicaciones del optómetra en viñetas: una por línea o por frase.
const viñetas = (texto = "") => texto.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((x) => x.trim()).filter(Boolean)

// ───────────────────────── La vista completa de una receta ─────────────────────────
// «Mi receta» del portal y la pestaña «Graduación» del perfil del paciente del personal son ESTA vista (regla 18): el selector de receta arriba, junto al título, con «Comparar dos recetas» y la acción de
// entregar la receta; y, de la receta elegida, los ojos, el antes → ahora (contra la receta anterior a esa), las indicaciones y lo que cada lado agregue.
//   version       «paciente» (palabras simples) o «personal» (notación técnica). Con `explicable`, el botón «Explicar al paciente» cambia la vista a la del paciente y de vuelta.
//   accion        { texto, Icono, onClick(receta) }: «Descargar receta» en el portal; «Imprimir receta» en el perfil.
//   subtitulo     (receta) => texto bajo el título.   indicacionesExtra: líneas que se suman a las de la receta vigente.
//   derecha       (receta) => nodo bajo las indicaciones (en el portal «Medidas para tus lentes»): equilibra las dos columnas.
//   grafica       ({ onElegir(fecha), fechaActiva }) => nodo: la gráfica de tendencia (el perfil del personal). Va al lado del antes → ahora y sus puntos cambian la vista a esa receta.
export function VistaGraduacion({ recetas = [], version = "paciente", titulo = "Mi receta", subtitulo, accion, explicable = false, indicacionesExtra = [], derecha, grafica, className = "" }) {
  const [id, setId] = useState(() => recetas[0]?.id)
  const [simple, setSimple] = useState(false)
  const [comparando, setComparando] = useState(false)
  const [historiaOjo, setHistoriaOjo] = useState(null) // "od" | "oi"
  const idx = Math.max(0, recetas.findIndex((r) => String(r.id) === String(id)))
  const receta = recetas[idx]
  const anterior = recetas[idx + 1] || null
  if (!receta) return null
  const v = simple ? "paciente" : version
  const paciente = v === "paciente"
  const portal = version === "paciente"
  const base = viñetas(receta.indicaciones)
  const indicaciones = idx === 0 && !base.some((i) => /control/i.test(i)) ? [...base, ...indicacionesExtra] : base
  const compararCon = anterior || recetas.find((r) => r !== receta)
  const elegirPorFecha = (fecha) => { const r = recetas.find((x) => x.fecha === fecha); if (r) setId(r.id) }
  const boton = portal
    ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold leading-snug text-pt-marino transition-colors hover:bg-slate-50 cursor-pointer"
    : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
  const cambio = portal && anterior && <CambioGraduacion consultas={[receta, anterior]} version={v} onElegir={() => setComparando(true)} />
  const bloqueIndicaciones = indicaciones.length > 0 && (
    <section aria-label={paciente ? "Lo que te indicó tu optómetra" : "Indicaciones"} className={"min-w-0 " + (paciente ? "rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6" : "rounded-2xl border border-slate-200/60 bg-white p-4")}>
      <h3 className={paciente ? "font-heading text-xl font-bold text-pt-marino" : "text-sm font-bold text-slate-900"}>{paciente ? "Lo que te indicó tu optómetra" : "Indicaciones"}</h3>
      <ul className={"mt-3 list-disc space-y-2 pl-5 leading-relaxed marker:text-slate-500 " + (paciente ? "text-base text-pt-marino" : "text-sm text-slate-700")}>{indicaciones.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  )
  const extraDerecha = derecha?.(receta)
  return (
    <div className={"@container space-y-5 sm:space-y-6 " + className}>
      <div className="flex flex-col gap-4 @[56rem]:flex-row @[56rem]:items-start @[56rem]:justify-between @[56rem]:gap-6">
        <div className="min-w-0">
          <h1 className={portal ? "font-heading text-2xl font-bold tracking-tight text-pt-marino sm:text-[28px] sm:leading-tight" : "text-lg font-bold text-slate-900"}>{titulo}</h1>
          {subtitulo && <p className={"mt-1 " + (portal ? "text-base text-pt-texto" : "text-sm text-slate-500")}>{subtitulo(receta)}</p>}
        </div>
        <div className={"flex flex-wrap items-center gap-3 @[56rem]:justify-end " + (portal ? "@[40rem]:flex-nowrap" : "")}>
          <SelectorReceta recetas={recetas} valorId={receta.id} onElegir={setId} version={portal ? "paciente" : "personal"} />
          {recetas.length > 1 && <button type="button" onClick={() => setComparando(true)} aria-label="Comparar dos recetas" className={boton + " shrink-0"}><GitCompare size={portal ? 20 : 15} aria-hidden="true" /> {portal ? <><span className="@[48rem]:hidden">Comparar</span><span className="hidden @[48rem]:inline">Comparar dos recetas</span></> : "Comparar dos recetas"}</button>}
          {explicable && <button type="button" onClick={() => setSimple((x) => !x)} aria-pressed={simple} className={boton}><MessageSquareText size={15} aria-hidden="true" /> {simple ? "Volver a la vista técnica" : "Explicar al paciente"}</button>}
          {accion && (
            <button type="button" onClick={() => accion.onClick(receta)} className={portal ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold leading-snug transition-colors hover:brightness-110 cursor-pointer" : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer"} style={portal ? { background: "var(--portal-acento, #1D5FD6)", color: "var(--portal-texto-boton, #FFFFFF)" } : { background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
              {accion.Icono && <accion.Icono size={portal ? 20 : 15} aria-hidden="true" />} {accion.texto}
            </button>
          )}
        </div>
      </div>

      <GraduacionVigente receta={receta} anterior={anterior} version={v} onOjo={setHistoriaOjo} />

      {portal && grafica ? (
        <>
          {/* El perfil del personal: el antes → ahora y la gráfica lado a lado, las indicaciones debajo */}
          <div className={"grid items-stretch gap-5 sm:gap-6 " + (cambio ? "@[56rem]:grid-cols-2" : "")}>
            {cambio}
            <section aria-label="Tendencia de graduación" className="min-w-0 rounded-2xl border border-slate-200/60 bg-white p-4">{grafica({ onElegir: elegirPorFecha, fechaActiva: receta.fecha })}</section>
          </div>
          {bloqueIndicaciones}
        </>
      ) : (
        <div className={"grid items-start gap-5 sm:gap-6 " + (cambio && (bloqueIndicaciones || extraDerecha) ? "@[56rem]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : "")}>
          {cambio}
          {(bloqueIndicaciones || extraDerecha) && <div className="min-w-0 space-y-5 sm:space-y-6">{bloqueIndicaciones}{extraDerecha}</div>}
        </div>
      )}
      {historiaOjo && <VentanaHistoriaOjo recetas={recetas} lado={historiaOjo} version={v} actualId={receta.id} onElegir={(rid) => { setId(rid); setHistoriaOjo(null) }} onCerrar={() => setHistoriaOjo(null)} />}
      {comparando && compararCon && <VentanaComparar recetas={recetas} version={v} idA={String(compararCon.id)} idB={String(receta.id)} onCerrar={() => setComparando(false)} />}
    </div>
  )
}

// ───────────────────────── Historia de este ojo ─────────────────────────
// Todas las recetas del paciente en una tabla (pulsar una fila cambia la vista a esa receta) y una gráfica de la esfera de ese ojo en el tiempo.
const GraficaEsfera = ({ puntos, paciente, nombre }) => {
  const W = 600, H = 220, L = 52, R = 18, T = 18, B = 34
  const t = (f) => new Date(String(f).slice(0, 10) + "T00:00:00Z").getTime()
  const t0 = t(puntos[0].fecha), t1 = t(puntos[puntos.length - 1].fecha)
  const vs = puntos.map((p) => p.v)
  const lo = Math.min(...vs) - 0.5, hi = Math.max(...vs) + 0.5
  const x = (f) => L + (t1 === t0 ? (W - L - R) / 2 : ((t(f) - t0) / (t1 - t0)) * (W - L - R))
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B)
  const marcas = [hi, (hi + lo) / 2, lo]
  return (
    <svg role="img" aria-label={`Gráfica de la esfera del ${nombre}: ${puntos.map((p) => `${formatoFecha(p.fecha, "medio")} ${valorD(String(p.v))}`).join(", ")}`} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {marcas.map((m, i) => <g key={i}><line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="#E2E8F0" strokeWidth="1" /><text x={L - 8} y={y(m) + 5} textAnchor="end" fontSize="14" fill="#475569">{valorD(String(Math.round(m * 4) / 4))}</text></g>)}
      <polyline points={puntos.map((p) => `${x(p.fecha)},${y(p.v)}`).join(" ")} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p) => <g key={p.fecha + p.id}><circle cx={x(p.fecha)} cy={y(p.v)} r="6" fill="#fff" stroke="#2563EB" strokeWidth="3" /><text x={x(p.fecha)} y={H - 10} textAnchor="middle" fontSize="14" fill="#475569">{formatoFecha(p.fecha, "medioSinAnio")} {String(p.fecha).slice(2, 4)}</text></g>)}
    </svg>
  )
}

export function VentanaHistoriaOjo({ recetas, lado, version = "paciente", actualId, onElegir, onCerrar }) {
  const paciente = version === "paciente"
  const nombre = NOMBRE_SIN_DATOS[lado]
  const sigla = lado === "od" ? "OD" : "OI"
  const filas = recetas.filter((r) => !ojoSinDatos(r[lado]))
  const puntos = [...filas].reverse().map((r) => ({ id: r.id, fecha: r.fecha, v: numero(r[lado]?.esfera) })).filter((p) => p.v !== null)
  // En una ventana angosta (celular, zoom alto) cada receta es dos líneas: la fecha y, debajo, sus valores con su nombre; desde 30 rem, una tabla en columnas.
  const COL = "@[30rem]:grid @[30rem]:grid-cols-[minmax(0,1.5fr)_4.5rem_4.5rem_3.5rem_4.5rem] @[30rem]:items-center @[30rem]:gap-x-3 px-4"
  return (
    <Cascaron pantallaCompletaEnCelular titulo={paciente ? `Historia de tu ${nombre}` : `Historia de este ojo · ${sigla}`} subtitulo={paciente ? "Todas tus recetas y cómo cambió tu esfera." : "Todas las recetas del paciente y la esfera en el tiempo."} Icono={Glasses} ancho="max-w-2xl" onCerrar={onCerrar} capa="z-[60]"
      pie={<><span /><button type="button" onClick={onCerrar} className={paciente ? "inline-flex min-h-12 items-center rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold text-pt-marino hover:bg-slate-50 cursor-pointer" : "rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"}>Cerrar</button></>}>
      <div className="space-y-4 p-5">
        <section aria-label="Esfera en el tiempo" className="rounded-2xl border border-slate-200/60 p-3">
          <h3 className="px-1 text-base font-bold text-slate-900">Esfera en el tiempo</h3>
          {puntos.length >= 2 ? <GraficaEsfera puntos={puntos} paciente={paciente} nombre={nombre} /> : <p className="px-1 py-6 text-base text-slate-500">Con una sola receta todavía no hay gráfica.</p>}
        </section>
        <section aria-label="Recetas de este ojo">
          <h3 className="mb-2 text-base font-bold text-slate-900">Todas las recetas</h3>
          {filas.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-500">{sinDatosDelOjo(lado, recetas[0])}.</p> : (
            <div data-lista="historia-ojo" className="@container overflow-hidden rounded-2xl border border-slate-200/70">
              <div aria-hidden="true" className={COL + " hidden bg-slate-50 py-2 text-sm font-semibold text-slate-500"}><span>Fecha</span><span className="text-right">Esfera</span><span className="text-right">{paciente ? "Astig." : "Cilindro"}</span><span className="text-right">Eje</span><span className="text-right">AV</span></div>
              <ul className="divide-y divide-slate-100">
                {filas.map((r) => {
                  const o = r[lado] || {}
                  return (
                    <li key={r.id} data-fila>
                      <button type="button" onClick={() => onElegir(r.id)} aria-current={String(r.id) === String(actualId) ? "true" : undefined} aria-label={`Ver la receta del ${formatoFecha(r.fecha, "largoSinDia")}`} className={COL + " block min-h-12 w-full py-2.5 text-left text-base transition-colors cursor-pointer hover:bg-slate-50 " + (String(r.id) === String(actualId) ? "bg-blue-50/60" : "")}>
                        <span className="block font-semibold text-slate-900">{formatoFecha(r.fecha, "medio")}{r.id === recetas[0]?.id && <span className="text-blue-600"> · vigente</span>}</span>
                        <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 @[30rem]:contents">
                          <span data-col="monto" className="font-bold tabular-nums text-slate-900 @[30rem]:text-right"><span className="font-normal text-slate-600 @[30rem]:hidden">Esfera </span>{valorD(o.esfera) || "—"}</span>
                          <span className="tabular-nums text-slate-700 @[30rem]:text-right"><span className="text-slate-600 @[30rem]:hidden">{paciente ? "Astig. " : "Cil. "}</span>{valorD(o.cilindro) || "—"}</span>
                          <span className="tabular-nums text-slate-700 @[30rem]:text-right"><span className="text-slate-600 @[30rem]:hidden">Eje </span>{o.eje ? `${o.eje}°` : "—"}</span>
                          <span className="tabular-nums text-slate-700 @[30rem]:text-right"><span className="text-slate-600 @[30rem]:hidden">AV </span>{textoAgudeza(agudezaConLentes(o) || o.avSc, o.avRx ? o.avRxF : o.avCcF) || "—"}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Cascaron>
  )
}

// ───────────────────────── Comparar dos recetas ─────────────────────────
// Elegir dos y verlas lado a lado, con las diferencias señaladas (marcadas en ámbar y dichas en texto, no solo con color).
export function VentanaComparar({ recetas, version = "paciente", idA: inicialA, idB: inicialB, onCerrar }) {
  const paciente = version === "paciente"
  const [idA, setIdA] = useState(inicialA ?? String(recetas[1]?.id ?? recetas[0]?.id))
  const [idB, setIdB] = useState(inicialB ?? String(recetas[0]?.id))
  const a = recetas.find((r) => String(r.id) === idA)
  const b = recetas.find((r) => String(r.id) === idB)
  const iguales = !a || !b || idA === idB
  const cmp = iguales ? null : compararRecetas(a, b)
  const fmt = (clave, v) => (v === "" || v == null ? (paciente ? "—" : "No registrado") : /esfera|cilindro|adicion/.test(clave) ? valorD(v) : /eje/.test(clave) ? `${v}°` : String(v))
  const rotulo = (r) => `${formatoFecha(r.fecha, "medio")}${r.id === recetas[0]?.id ? " (vigente)" : ""}`
  const campo = "min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
  const filasDe = (lado) => cmp.filas.filter((f) => f.lado === lado)
  const adicion = cmp?.filas.find((f) => f.lado === null)
  const etiqueta = (f) => (paciente ? ({ Esfera: "Esfera", Cilindro: "Astigmatismo", Eje: "Eje", "Agudeza visual": "Cómo ves con tus lentes", "Adición": "Para leer de cerca" })[f.etiqueta] : f.etiqueta)
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Comparar dos recetas" subtitulo={paciente ? "Elige dos y mira qué cambió." : "Elige dos recetas del paciente."} Icono={GitCompare} ancho="max-w-3xl" onCerrar={onCerrar} capa="z-[60]"
      pie={<><span /><button type="button" onClick={onCerrar} className={paciente ? "inline-flex min-h-12 items-center rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold text-pt-marino hover:bg-slate-50 cursor-pointer" : "rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"}>Cerrar</button></>}>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-base font-semibold text-slate-700">Primera receta
            <select value={idA} onChange={(e) => setIdA(e.target.value)} className={campo + " mt-1 font-normal"}>{recetas.map((r) => <option key={r.id} value={String(r.id)}>{rotulo(r)}</option>)}</select>
          </label>
          <label className="block text-base font-semibold text-slate-700">Segunda receta
            <select value={idB} onChange={(e) => setIdB(e.target.value)} className={campo + " mt-1 font-normal"}>{recetas.map((r) => <option key={r.id} value={String(r.id)}>{rotulo(r)}</option>)}</select>
          </label>
        </div>
        {iguales ? (
          <p role="status" className="rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-700">Elige dos recetas distintas para compararlas.</p>
        ) : (
          <>
            <p role="status" className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-800"><Info size={20} className="shrink-0 text-blue-600" aria-hidden="true" />{cmp.cambios === 0 ? "Las dos recetas tienen los mismos valores." : `Cambiaron ${cmp.cambios} ${cmp.cambios === 1 ? "valor" : "valores"}: están marcados en ámbar.`}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LADOS.map(([lado, nombre, sigla]) => (
                <section key={lado} aria-label={nombre} className={"min-w-0 rounded-2xl border border-slate-200/60 " + (lado === "od" ? "sm:order-2" : "sm:order-1")}>
                  <h3 className="border-b border-slate-100 px-4 py-2.5 text-base font-bold" style={{ color: COLOR_LADO[lado] }}>{paciente ? nombre : `${sigla} · ${nombre}`}</h3>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-4 pb-2 pt-2 text-base font-semibold text-slate-500"><span /><span className="min-w-[4.5rem] text-right">{formatoFecha(cmp.antes.fecha, "medioSinAnio")} {String(cmp.antes.fecha).slice(2, 4)}</span><span className="min-w-[4.5rem] text-right">{formatoFecha(cmp.ahora.fecha, "medioSinAnio")} {String(cmp.ahora.fecha).slice(2, 4)}</span></div>
                  <ul>
                    {filasDe(lado).map((f) => (
                      <li key={f.clave} className={"grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5 text-base " + (f.difiere ? "bg-[#FDEBD3]" : "")}>
                        <span className="text-slate-700">{etiqueta(f)}{f.difiere && <span className="ml-1.5 text-base font-bold text-pt-ambar">cambió{f.delta != null ? " (" + textoDelta(f.delta) + ")" : ""}</span>}</span>
                        <span className="min-w-[4.5rem] text-right font-semibold tabular-nums text-slate-700">{fmt(f.clave, f.antes)}</span>
                        <span className={"min-w-[4.5rem] text-right tabular-nums " + (f.difiere ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>{fmt(f.clave, f.ahora)}</span>
                      </li>
                    ))}
                    {filasDe(lado).length === 0 && <li className="px-4 py-3 text-base text-slate-500">Sin valores en este ojo.</li>}
                  </ul>
                </section>
              ))}
            </div>
            {adicion && (
              <p className={"flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-base " + (adicion.difiere ? "bg-[#FDEBD3]" : "bg-slate-50")}>
                <span className="text-slate-700">{etiqueta(adicion)}{adicion.difiere && <span className="ml-1.5 text-base font-bold text-pt-ambar">cambió</span>}</span>
                <span className="font-semibold tabular-nums text-slate-900">{fmt(adicion.clave, adicion.antes)} → {fmt(adicion.clave, adicion.ahora)}</span>
              </p>
            )}
          </>
        )}
      </div>
    </Cascaron>
  )
}

// ───────────────────────── El detalle de una receta ─────────────────────────
function TablaReceta({ receta, version }) {
  const paciente = version === "paciente"
  const [abierta, setAbierta] = useState("")
  const agudeza = (o = {}) => agudezaConLentes(o) || o.avSc || ""
  const filas = [
    ["esfera", "Esfera", valorD(receta.od?.esfera), valorD(receta.oi?.esfera)],
    ["cilindro", paciente ? "Cilindro" : "Cilindro", valorD(receta.od?.cilindro), valorD(receta.oi?.cilindro)],
    ["eje", "Eje", receta.od?.eje ? `${receta.od.eje}°` : "", receta.oi?.eje ? `${receta.oi.eje}°` : ""],
    ["adicion", "Adición", medidasLegibles(receta.medidas, { conMontaje: false })[0][1] && (/^OD/.test(medidasLegibles(receta.medidas, { conMontaje: false })[0][1]) ? medidasLegibles(receta.medidas, { conMontaje: false })[0][1] : valorD(medidasLegibles(receta.medidas, { conMontaje: false })[0][1])), null],
    ["agudeza", "Agudeza visual", agudeza(receta.od), agudeza(receta.oi)],
  ].filter(([clave, , od]) => clave !== "adicion" || od)
  const T = paciente ? { fila: "min-h-12 px-4 py-2 sm:px-5", rotulo: "text-lg text-pt-texto", valor: "font-heading text-2xl font-bold tabular-nums text-pt-marino", cab: "text-lg font-bold" } : { fila: "min-h-11 px-4 py-2", rotulo: "text-sm text-slate-500", valor: "text-base font-bold tabular-nums text-slate-900", cab: "text-sm font-bold" }
  return (
    <div role="table" aria-label={paciente ? "Tu receta" : "Receta"} className="overflow-hidden rounded-2xl border border-slate-200/70">
      <div role="row" className="grid grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-end gap-2 bg-slate-50 px-4 py-3 sm:px-5">
        <span role="columnheader"><span className="sr-only">Dato</span></span>
        <span role="columnheader" className={T.cab + " text-cyan-700"}>{paciente ? "Ojo izquierdo" : "OI"}</span>
        <span role="columnheader" className={T.cab + " text-blue-700"}>{paciente ? "Ojo derecho" : "OD"}</span>
      </div>
      {filas.map(([clave, etiqueta, od, oi]) => (
        <div key={clave} role="row" className="border-t border-slate-200/70">
          <button type="button" disabled={!paciente} onClick={() => setAbierta((a) => (a === clave ? "" : clave))} aria-expanded={paciente ? abierta === clave : undefined}
            aria-label={`${etiqueta}: ${clave === "adicion" ? od : `${paciente ? "ojo derecho" : "OD"} ${od || "sin dato"}, ${paciente ? "ojo izquierdo" : "OI"} ${oi || "sin dato"}`}${paciente ? ". Toca para saber qué significa" : ""}`}
            title={paciente ? AYUDA_RECETA[clave] : undefined} className={"grid w-full grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-center gap-2 text-left " + T.fila + (paciente ? " transition-colors hover:bg-pt-fondo cursor-pointer" : " cursor-default")}>
            <span role="rowheader" className={"flex items-center gap-1.5 " + T.rotulo}>{etiqueta}{paciente && <Info size={18} className="shrink-0 text-slate-400" aria-hidden="true" />}</span>
            {clave === "adicion"
              ? <span role="cell" className={"col-span-2 " + T.valor}>{od}</span>
              : <><span role="cell" className={T.valor}>{oi || (paciente ? "—" : <NoRegistrado />)}</span><span role="cell" className={T.valor}>{od || (paciente ? "—" : <NoRegistrado />)}</span></>}
          </button>
          {paciente && abierta === clave && <p role="note" className="bg-pt-fondo px-4 py-3 text-lg text-slate-700 sm:px-5">{AYUDA_RECETA[clave]}</p>}
        </div>
      ))}
    </div>
  )
}

const Dato = ({ titulo, children, paciente }) => <div><p className={paciente ? "text-base font-semibold text-pt-texto" : "text-xs font-bold uppercase tracking-wide text-slate-500"}>{titulo}</p><p className={paciente ? "text-lg text-slate-800" : "text-sm text-slate-800"}>{children}</p></div>

// `onImprimir`: abre la hoja de la receta (la misma que imprime el optómetra) para imprimirla o guardarla como PDF.
export function DetalleReceta({ receta, version = "paciente", onCerrar, onImprimir }) {
  const paciente = version === "paciente"
  const m = receta.medidas || {}
  return (
    <Cascaron pantallaCompletaEnCelular titulo={`Receta del ${formatoFecha(receta.fecha, "medio")}`} subtitulo={receta.profesionalNombre ? `Emitida por ${receta.profesionalNombre}` : paciente ? "Tu receta" : "Receta"} Icono={Glasses} ancho="max-w-xl" onCerrar={onCerrar} capa="z-[60]"
      pie={<>
        {onImprimir ? <button type="button" onClick={onImprimir} className={paciente ? "inline-flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold text-pt-marino hover:bg-slate-50 cursor-pointer" : "flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"}>{paciente ? <Download size={20} aria-hidden="true" /> : <Printer size={15} aria-hidden="true" />} {paciente ? "Descargar receta" : "Imprimir receta"}</button> : <span />}
        <button type="button" onClick={onCerrar} className={paciente ? "inline-flex min-h-12 items-center rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold text-pt-marino hover:bg-slate-50 cursor-pointer" : "rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"}>Cerrar</button>
      </>}>
      <div className="space-y-3 p-4 sm:p-5">
        <TablaReceta receta={receta} version={version} />
        {!paciente && medidasLegibles(m).some(([t, x]) => x && t !== "Adición") && <Dato titulo="Medidas para los lentes" paciente={false}>{medidasLegibles(m).filter(([t, x]) => x && t !== "Adición").map(([t, x]) => `${t.replace(" (DP)", "")}: ${x}`).join(" · ")}</Dato>}
        {(receta.lenteRecomendado || receta.diagnostico) && (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {receta.lenteRecomendado && <Dato paciente={paciente} titulo="Lente recomendado">{receta.lenteRecomendado}</Dato>}
            {receta.diagnostico && <Dato paciente={paciente} titulo="Diagnóstico">{receta.diagnostico}</Dato>}
          </div>
        )}
        {receta.indicaciones && <Dato paciente={paciente} titulo={paciente ? "Indicaciones de tu optómetra" : "Indicaciones"}>{receta.indicaciones}</Dato>}
      </div>
    </Cascaron>
  )
}
