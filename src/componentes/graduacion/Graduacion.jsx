"use client"

// La graduación del paciente, un solo componente para los dos lados (regla 18): el portal del paciente (`version="paciente"`, palabras simples) y el perfil del paciente del sistema
// del personal (`version="personal"`, notación técnica: OD y OI, esfera, cilindro, eje, adición, agudeza visual y distancia pupilar). Mismas cuentas (`utilidades/graduacion.js`),
// mismos datos y mismo orden: lo que el optómetra le explica al paciente en la consulta es lo que el paciente lee en su portal.
import { useMemo, useState } from "react"
import { Glasses, ChevronRight, ArrowRight, Printer, GitCompare, Download, Info } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { valorD } from "../../utilidades/portalVistas"
import { lecturaDeOjo, cambioPorOjo, aniosDeRecetas, filtrarRecetasPorAnio, lineaDeEsferas, compararRecetas, textoDelta } from "../../utilidades/graduacion"
import { AYUDA_RECETA } from "../../utilidades/portalPaciente"
import { Cascaron } from "../AtencionPaciente"
import OjoIlustrado from "./OjoIlustrado"

const Partes = ({ partes }) => partes.map((p, i) => (p.b ? <strong key={i} className="font-bold">{p.t}</strong> : <span key={i}>{p.t}</span>))
const LADOS = [["od", "Ojo derecho", "OD"], ["oi", "Ojo izquierdo", "OI"]]
const COLOR_LADO = { od: "#1d4ed8", oi: "#0891b2" }
// «−1.75 −0.50 x90»: esfera, cilindro y eje de un ojo con el mismo formato (signo menos, dos decimales) que el resto de la vista.
const tecnica = (o = {}) => (o.esfera || o.cilindro || o.eje ? [valorD(o.esfera) || "—", valorD(o.cilindro), o.eje ? `x${o.eje}` : ""].filter(Boolean).join(" ") : "No registrada")
const fechaCorta = (iso) => formatoFecha(iso, "medio")

// ───────────────────────── La graduación vigente ─────────────────────────
// Dos ojos ilustrados con su esfera. Paciente: la explicación de cada ojo y de cada dato. Personal: los valores técnicos de cada ojo.
export function GraduacionVigente({ receta, version = "paciente" }) {
  if (!receta) return null
  if (version === "personal") return <VigentePersonal receta={receta} />
  return (
    <div className="@container">
      <div className="grid gap-5 @[56rem]:grid-cols-2 @[56rem]:gap-6">
        {LADOS.map(([lado, nombre]) => {
          const l = lecturaDeOjo(receta, lado)
          const filas = [
            ["Astigmatismo", l.hayAstigmatismo ? `${valorD(l.cilindro)}${l.eje ? ` · ${l.eje}°` : ""}` : "—", l.explicaCilindro],
            ...(l.adicion ? [["Para leer de cerca", valorD(l.adicion), l.explicaCerca]] : []),
            ...(l.agudeza ? [[l.conLentes ? "Cómo ves con tus lentes" : "Cómo ves sin lentes", l.agudeza, l.explicaAgudeza]] : []),
          ]
          return (
            <section key={lado} aria-label={nombre} className="@container min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[34px] sm:py-7">
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
            </section>
          )
        })}
      </div>
    </div>
  )
}

function VigentePersonal({ receta }) {
  const m = receta.medidas || {}
  const extra = [["Adición", m.adicion && valorD(m.adicion)], ["DP", m.dp], ["Altura de montaje", m.alt]].filter(([, v]) => v)
  return (
    <div className="@container">
      <div className="grid gap-3 @[40rem]:grid-cols-2">
        {LADOS.map(([lado, nombre, sigla]) => {
          const o = receta[lado] || {}
          const datos = [["Cilindro", valorD(o.cilindro)], ["Eje", o.eje ? `${o.eje}°` : ""], ["AV sin lentes", o.avSc], ["AV con lentes", o.avCc]]
          return (
            <section key={lado} aria-label={nombre} className="rounded-xl border border-slate-200/60 bg-white p-3.5">
              <div className="flex items-center gap-3.5">
                <OjoIlustrado ancho={92} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLOR_LADO[lado] }}>{sigla} · {nombre}</p>
                  <p className="text-2xl font-bold leading-tight tabular-nums text-slate-900">{valorD(o.esfera) || "—"}</p>
                  <p className="text-xs text-slate-500">Esfera</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-sm">
                {datos.map(([t, v]) => <div key={t} className="flex items-baseline justify-between gap-2"><dt className="text-slate-500">{t}</dt><dd className="font-semibold tabular-nums text-slate-900">{v || "—"}</dd></div>)}
              </dl>
            </section>
          )
        })}
      </div>
      {extra.length > 0 && <p className="mt-2 text-sm text-slate-600">{extra.map(([t, v], i) => <span key={t}>{i > 0 && " · "}<span className="text-slate-500">{t}</span> <span className="font-semibold tabular-nums text-slate-900">{v}</span></span>)}</p>}
    </div>
  )
}

// ───────────────────────── Antes → ahora ─────────────────────────
export function CambioGraduacion({ consultas, version = "paciente" }) {
  const cambio = useMemo(() => cambioPorOjo(consultas), [consultas])
  if (!cambio) return null
  const paciente = version === "paciente"
  const hayCambio = cambio.some((o) => o.texto && o.texto !== "Sin cambios")
  const chip = (c, claseExtra) => <span className={"inline-flex items-baseline gap-2 rounded-lg px-3 py-1.5 " + claseExtra}><span className={paciente ? "text-base" : "text-xs"}>{c.fecha}</span><span className={"font-bold tabular-nums " + (paciente ? "text-lg" : "text-sm")}>{valorD(c.valor) || "—"}</span></span>
  return (
    <section aria-label={paciente ? "Cómo cambió desde tu examen anterior" : "Cambio desde la consulta anterior"} className={paciente ? "rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6" : "rounded-2xl border border-slate-200/60 bg-white p-4"}>
      <h3 className={paciente ? "font-heading text-xl font-bold text-pt-marino" : "text-sm font-bold text-slate-900"}>{paciente ? "Cómo cambió desde tu examen anterior" : "Cambio desde la consulta anterior"}</h3>
      <p className={paciente ? "mt-1 text-base text-pt-texto" : "mt-0.5 text-xs text-slate-500"}>{paciente ? (hayCambio ? "Un cambio pequeño y normal con el tiempo." : "Tu graduación se mantiene igual.") : "Esfera de cada ojo en las dos últimas consultas."}</p>
      <ul className={"mt-3 divide-y " + (paciente ? "divide-pt-borde border-t border-pt-borde" : "divide-slate-100 border-t border-slate-100")}>
        {cambio.map((o, i) => (
          <li key={o.lado} className={"grid gap-x-6 gap-y-1.5 py-3.5 " + (paciente ? "@[30rem]:grid-cols-[9rem_minmax(0,1fr)]" : "sm:grid-cols-[7rem_minmax(0,1fr)]")}>
            <p className={paciente ? "self-center text-lg font-bold text-pt-marino" : "self-center text-sm font-bold"} style={paciente ? undefined : { color: COLOR_LADO[o.lado] }}>{paciente ? o.nombre : LADOS[i][2] + " · " + o.nombre}</p>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {chip(o.antes, paciente ? "bg-pt-fondo text-pt-texto" : "bg-slate-50 text-slate-600")}
                <ArrowRight size={paciente ? 24 : 18} className={paciente ? "text-pt-azul" : "text-blue-600"} aria-label="a" />
                {chip(o.ahora, paciente ? "bg-pt-suave text-[#1B4FB5]" : "bg-blue-50 text-blue-700")}
              </div>
              <p className={paciente ? "mt-1.5 text-lg text-pt-marino" : "mt-1 text-sm text-slate-600"}>{paciente ? o.texto : (o.variacion === null ? "—" : o.texto === "Sin cambios" ? "Sin cambios" : (o.variacion > 0 ? "Aumentó " : "Disminuyó ") + Math.abs(o.variacion).toFixed(2) + " D (equivalente esférico)")}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ───────────────────────── Tus recetas ─────────────────────────
const CHIP = (activo, paciente) => paciente
  ? "inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors cursor-pointer " + (activo ? "bg-pt-azul text-white" : "border border-pt-borde bg-white text-pt-marino hover:bg-pt-fondo")
  : "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")

export function ListaRecetas({ recetas, version = "paciente", onAbrir }) {
  const paciente = version === "paciente"
  const [anio, setAnio] = useState("todas")
  const [comparando, setComparando] = useState(false)
  const anios = useMemo(() => aniosDeRecetas(recetas), [recetas])
  const visibles = filtrarRecetasPorAnio(recetas, anio)
  const vigenteId = recetas[0]?.id
  const linea = (r) => (paciente ? lineaDeEsferas(r, valorD) : ["OD " + tecnica(r.od), "OI " + tecnica(r.oi)].join(" · ")) || "Consulta registrada"
  return (
    <section aria-label={paciente ? "Tus recetas" : "Recetas del paciente"} className={paciente ? "rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6" : "rounded-2xl border border-slate-200/60 bg-white p-4"}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={paciente ? "font-heading text-xl font-bold text-pt-marino" : "text-sm font-bold text-slate-900"}>{paciente ? "Tus recetas" : "Recetas del paciente"}</h3>
        <p className={paciente ? "text-base text-pt-texto" : "text-xs text-slate-500"}>{recetas.length} {recetas.length === 1 ? "receta" : "recetas"}</p>
      </div>
      {anios.length > 1 && (
        <div role="group" aria-label="Filtrar por año" className="mt-3 flex flex-wrap gap-2">
          {["todas", ...anios].map((a) => <button key={a} type="button" aria-pressed={anio === a} onClick={() => setAnio(a)} className={CHIP(anio === a, paciente)}>{a === "todas" ? "Todas" : a}</button>)}
        </div>
      )}
      <ul className={"mt-3 divide-y " + (paciente ? "divide-pt-borde" : "divide-slate-100")}>
        {visibles.map((r) => {
          const vigente = r.id === vigenteId
          return (
            <li key={r.id}>
              <button type="button" onClick={() => onAbrir(r.id)} aria-label={`Ver la receta del ${fechaCorta(r.fecha)}`}
                className={"flex w-full items-center gap-3 text-left transition-colors cursor-pointer " + (paciente ? "min-h-16 rounded-xl px-3 py-3 hover:bg-pt-fondo " : "min-h-12 rounded-lg px-2.5 py-2 hover:bg-slate-50 ") + (vigente ? (paciente ? "bg-pt-suave/70 " : "bg-blue-50/60 ") : "")}>
                <span className="min-w-0 flex-1">
                  <span className={"block font-semibold leading-snug " + (paciente ? "text-lg text-pt-marino" : "text-sm text-slate-900")}>{formatoFecha(r.fecha, "largoSinDia")}{vigente && <span className={"font-semibold " + (paciente ? "text-base text-pt-azul" : "text-xs text-blue-600")}> · vigente</span>}</span>
                  <span className={"block " + (paciente ? "text-base text-pt-texto" : "text-xs text-slate-500")}>{linea(r)}</span>
                </span>
                <ChevronRight size={paciente ? 22 : 16} className="shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      {recetas.length > 1 && (
        <button type="button" onClick={() => setComparando(true)} className={paciente ? "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-slate-300/80 bg-white px-5 text-base font-semibold text-pt-marino transition-colors hover:bg-slate-50 cursor-pointer" : "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"}>
          <GitCompare size={paciente ? 20 : 15} aria-hidden="true" /> Comparar dos recetas
        </button>
      )}
      {comparando && <VentanaComparar recetas={recetas} version={version} onCerrar={() => setComparando(false)} />}
    </section>
  )
}

// ───────────────────────── Comparar dos recetas ─────────────────────────
// Elegir dos y verlas lado a lado, con las diferencias señaladas (marcadas en ámbar y dichas en texto, no solo con color).
export function VentanaComparar({ recetas, version = "paciente", onCerrar }) {
  const paciente = version === "paciente"
  const [idA, setIdA] = useState(String(recetas[1]?.id ?? recetas[0]?.id))
  const [idB, setIdB] = useState(String(recetas[0]?.id))
  const a = recetas.find((r) => String(r.id) === idA)
  const b = recetas.find((r) => String(r.id) === idB)
  const iguales = !a || !b || idA === idB
  const cmp = iguales ? null : compararRecetas(a, b)
  const fmt = (clave, v) => (v === "" || v == null ? "—" : /esfera|cilindro|adicion/.test(clave) ? valorD(v) : /eje/.test(clave) ? `${v}°` : String(v))
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
                <section key={lado} aria-label={nombre} className="min-w-0 rounded-2xl border border-slate-200/60">
                  <h3 className="border-b border-slate-100 px-4 py-2.5 text-base font-bold" style={{ color: COLOR_LADO[lado] }}>{paciente ? nombre : `${sigla} · ${nombre}`}</h3>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-4 pb-2 pt-2 text-sm font-semibold text-slate-500"><span /><span className="min-w-[4.5rem] text-right">{formatoFecha(cmp.antes.fecha, "medioSinAnio")} {String(cmp.antes.fecha).slice(2, 4)}</span><span className="min-w-[4.5rem] text-right">{formatoFecha(cmp.ahora.fecha, "medioSinAnio")} {String(cmp.ahora.fecha).slice(2, 4)}</span></div>
                  <ul>
                    {filasDe(lado).map((f) => (
                      <li key={f.clave} className={"grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2.5 text-base " + (f.difiere ? "bg-[#FDEBD3]" : "")}>
                        <span className="text-slate-700">{etiqueta(f)}{f.difiere && <span className="ml-1.5 text-sm font-bold text-pt-ambar">cambió{f.delta != null ? " (" + textoDelta(f.delta) + ")" : ""}</span>}</span>
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
                <span className="text-slate-700">{etiqueta(adicion)}{adicion.difiere && <span className="ml-1.5 text-sm font-bold text-pt-ambar">cambió</span>}</span>
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
  const agudeza = (o = {}) => o.avCc || o.avSc || ""
  const filas = [
    ["esfera", "Esfera", valorD(receta.od?.esfera), valorD(receta.oi?.esfera)],
    ["cilindro", paciente ? "Cilindro" : "Cilindro", valorD(receta.od?.cilindro), valorD(receta.oi?.cilindro)],
    ["eje", "Eje", receta.od?.eje ? `${receta.od.eje}°` : "", receta.oi?.eje ? `${receta.oi.eje}°` : ""],
    ["adicion", "Adición", valorD(receta.medidas?.adicion), null],
    ["agudeza", "Agudeza visual", agudeza(receta.od), agudeza(receta.oi)],
  ].filter(([clave, , od]) => clave !== "adicion" || od)
  const T = paciente ? { fila: "min-h-12 px-4 py-2 sm:px-5", rotulo: "text-lg text-pt-texto", valor: "font-heading text-2xl font-bold tabular-nums text-pt-marino", cab: "text-lg font-bold" } : { fila: "min-h-11 px-4 py-2", rotulo: "text-sm text-slate-500", valor: "text-base font-bold tabular-nums text-slate-900", cab: "text-sm font-bold" }
  return (
    <div role="table" aria-label={paciente ? "Tu receta" : "Receta"} className="overflow-hidden rounded-2xl border border-slate-200/70">
      <div role="row" className="grid grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-end gap-2 bg-slate-50 px-4 py-3 sm:px-5">
        <span role="columnheader"><span className="sr-only">Dato</span></span>
        <span role="columnheader" className={T.cab + " text-blue-700"}>{paciente ? "Ojo derecho" : "OD"}</span>
        <span role="columnheader" className={T.cab + " text-cyan-700"}>{paciente ? "Ojo izquierdo" : "OI"}</span>
      </div>
      {filas.map(([clave, etiqueta, od, oi]) => (
        <div key={clave} role="row" className="border-t border-slate-200/70">
          <button type="button" disabled={!paciente} onClick={() => setAbierta((a) => (a === clave ? "" : clave))} aria-expanded={paciente ? abierta === clave : undefined}
            aria-label={`${etiqueta}: ${clave === "adicion" ? od : `${paciente ? "ojo derecho" : "OD"} ${od || "sin dato"}, ${paciente ? "ojo izquierdo" : "OI"} ${oi || "sin dato"}`}${paciente ? ". Toca para saber qué significa" : ""}`}
            title={paciente ? AYUDA_RECETA[clave] : undefined} className={"grid w-full grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-center gap-2 text-left " + T.fila + (paciente ? " transition-colors hover:bg-pt-fondo cursor-pointer" : " cursor-default")}>
            <span role="rowheader" className={"flex items-center gap-1.5 " + T.rotulo}>{etiqueta}{paciente && <Info size={18} className="shrink-0 text-slate-400" aria-hidden="true" />}</span>
            {clave === "adicion"
              ? <span role="cell" className={"col-span-2 " + T.valor}>{od}</span>
              : <><span role="cell" className={T.valor}>{od || "—"}</span><span role="cell" className={T.valor}>{oi || "—"}</span></>}
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
        {!paciente && (m.dp || m.alt) && <Dato titulo="Medidas para los lentes" paciente={false}>{[m.dp && `DP ${m.dp}`, m.alt && `Altura ${m.alt}`].filter(Boolean).join(" · ")}</Dato>}
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
