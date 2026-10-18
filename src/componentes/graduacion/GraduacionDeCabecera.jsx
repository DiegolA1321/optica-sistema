"use client"

import { ChevronRight } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { valorD } from "../../utilidades/portalVistas"
import OjoIlustrado from "./OjoIlustrado"

// La graduación vigente en la cabecera del perfil del paciente (se ve desde todas las pestañas): un panel que ocupa la mitad derecha de la cabecera, con su misma altura. Los dos ojos
// ilustrados (56 px de alto), cada uno con su esfera en grande y el cilindro y el eje en pequeño, y la fecha de la receta. Al pulsarlo abre la pestaña «Graduación». Solo para quien tiene permiso
// de Ficha clínica «ver» (el perfil decide si lo dibuja). Sin receta dice «Sin receta registrada»; un ojo sin ninguna medida, «Sin registrar».
const COLOR = { od: "#1d4ed8", oi: "#0891b2" }
const NOMBRE = { od: "Ojo derecho", oi: "Ojo izquierdo" }

function Ojo({ lado, o = {} }) {
  const esfera = valorD(o.esfera)
  const cil = valorD(o.cilindro)
  const detalle = cil ? `Cil ${cil}${o.eje ? ` × ${o.eje}°` : ""}` : o.eje ? `Eje ${o.eje}°` : ""
  return (
    <span className="flex min-w-0 items-center gap-3">
      <OjoIlustrado ancho={90} className="shrink-0" />
      <span className="block min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: COLOR[lado] }}>{lado === "od" ? "OD" : "OI"} · {NOMBRE[lado]}</span>
        {esfera ? <span className="block text-3xl font-bold leading-tight tabular-nums text-slate-900">{esfera}</span> : <span className="block py-1.5 text-sm text-slate-400">Sin registrar</span>}
        {esfera && <span className="block text-xs tabular-nums text-slate-500">{detalle || "Esfera"}</span>}
      </span>
    </span>
  )
}

// `activa`: ya se está en la pestaña Graduación; el panel sigue a la vista pero deja de ser un botón (no tendría adónde llevar).
export default function GraduacionDeCabecera({ receta, onAbrir, activa = false }) {
  const base = "group flex h-full min-h-[132px] w-full flex-col justify-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-5 py-4 text-left " + (activa ? "" : "transition-colors hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer")
  const Raiz = activa ? "div" : "button"
  const propsRaiz = activa ? {} : { type: "button", "data-resumen": true, onClick: onAbrir }
  if (!receta) {
    return (
      <Raiz {...propsRaiz} aria-label={activa ? undefined : "Graduación vigente: sin receta registrada. Abrir la pestaña Graduación"} className={base}>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graduación vigente</span>
        <span className="text-base text-slate-500">Sin receta registrada</span>
      </Raiz>
    )
  }
  return (
    <Raiz {...propsRaiz} aria-label={activa ? undefined : `Graduación vigente del ${formatoFecha(receta.fecha, "medio")}: ojo derecho ${valorD(receta.od?.esfera) || "sin registrar"}, ojo izquierdo ${valorD(receta.oi?.esfera) || "sin registrar"}. Abrir la pestaña Graduación`} className={base}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Graduación vigente · receta del {formatoFecha(receta.fecha, "medio")}</span>
        {!activa && <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-blue-600" aria-hidden="true">Ver graduación <ChevronRight size={16} /></span>}
      </span>
      <span className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Ojo lado="od" o={receta.od} />
        <Ojo lado="oi" o={receta.oi} />
      </span>
    </Raiz>
  )
}
