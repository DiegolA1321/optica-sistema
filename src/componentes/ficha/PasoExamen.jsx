"use client"

import { useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { INK } from "@/lib/tema"
import { bloquesDeExamen } from "../../utilidades/fichaDatos"
import PasoAgudeza from "./PasoAgudeza"
import PasoRefraccion from "./PasoRefraccion"
import PasoSalud from "./PasoSalud"

// Un bloque plegable del Examen: el título, su estado («Sin registrar» o «Registrado») y, si tiene algo, el resumen de una línea. Se abre y se cierra con un clic; el contenido solo se dibuja abierto.
function Bloque({ id, titulo, registrado, resumen, abierto, onAlternar, error, children }) {
  return (
    <section aria-label={titulo} className={"rounded-2xl border bg-white shadow-sm " + (error ? "border-red-300" : "border-slate-200/70")}>
      <button type="button" id={`bloque-${id}`} aria-expanded={abierto} aria-controls={`bloque-${id}-contenido`} onClick={onAlternar}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">
        <span className="min-w-0 flex-1">
          <span data-bloque-cabecera className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span data-bloque-titulo className="text-sm font-bold" style={{ color: INK }}>{titulo}</span>
            <span data-bloque-estado className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold " + (registrado ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
              {registrado && <Check size={11} aria-hidden="true" />}{registrado ? "Registrado" : "Sin registrar"}
            </span>
            {error && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Falta completar</span>}
          </span>
          {registrado && resumen && <span className="mt-0.5 block truncate text-xs text-slate-500">{resumen}</span>}
        </span>
        <ChevronDown size={18} aria-hidden="true" className={"shrink-0 text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
      </button>
      {abierto && <div id={`bloque-${id}-contenido`} className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-3">{children}</div>}
    </section>
  )
}

// Paso 2 · Examen: cinco bloques plegados (todos cerrados al entrar) y todo opcional. Cada uno muestra su estado y un resumen de una línea sin abrirlo.
export default function PasoExamen({ f, set, setVarios, errores, edad, manejaProgresion, ultimaConsulta, analisis }) {
  // Si al terminar falta algo de la refracción (a medias), ese bloque se abre solo para que se vea qué falta.
  const conErrores = Object.keys(errores || {}).length > 0
  const [abiertos, setAbiertos] = useState(() => new Set(conErrores ? ["refraccion"] : []))
  const [vistoError, setVistoError] = useState(conErrores)
  if (conErrores && !vistoError) { setVistoError(true); setAbiertos((a) => new Set([...a, "refraccion"])) }
  if (!conErrores && vistoError) setVistoError(false)
  const alternar = (id) => setAbiertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const abrir = (id) => setAbiertos((a) => new Set([...a, id]))
  const bloques = bloquesDeExamen(f)
  const comunes = { f, set, setVarios, ultimaConsulta }
  const contenido = {
    agudeza: <PasoAgudeza parte="agudeza" {...comunes} onIrARefraccion={() => abrir("refraccion")} />,
    lentes: <PasoAgudeza parte="lentes" {...comunes} />,
    refraccion: (
      <>
        <PasoRefraccion {...comunes} errores={errores || {}} edad={edad} manejaProgresion={manejaProgresion} />
        {analisis}
      </>
    ),
    cover: <PasoAgudeza parte="cover" {...comunes} />,
    salud: <PasoSalud f={f} set={set} setVarios={setVarios} />,
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-slate-500">Todo el examen es opcional: abre solo lo que midas hoy. Cada bloque muestra si ya tiene datos.</p>
      {bloques.map((b) => (
        <Bloque key={b.id} id={b.id} titulo={b.label} registrado={b.registrado} resumen={b.resumen} abierto={abiertos.has(b.id)} onAlternar={() => alternar(b.id)} error={b.id === "refraccion" && conErrores}>
          {contenido[b.id]}
        </Bloque>
      ))}
    </div>
  )
}
