"use client"

import { ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { formatoFecha } from "../../utilidades/formatoFecha"

// Una lista corta del panel: hasta tres personas con sus nombres completos (sin cortarlos) y el enlace a la lista entera.
function Lista({ titulo, filas, vacio, enlace, onEnlace, ayuda }) {
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="text-sm text-slate-500">{vacio}</p>
      ) : (
        <ul className="space-y-1.5">
          {filas.map((f) => (
            <li key={f.id} className="min-w-0">
              <p className="break-words text-sm font-semibold leading-snug" style={{ color: INK }}>{f.nombre}</p>
              <p className="text-xs text-slate-500">{f.detalle}</p>
            </li>
          ))}
        </ul>
      )}
      {enlace && (
        <button type="button" onClick={onEnlace} title={ayuda} className="mt-auto inline-flex items-center gap-1 self-start pt-0.5 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">
          {enlace} <ArrowRight size={12} aria-hidden="true" />
        </button>
      )}
    </section>
  )
}

const por = (n, singular, plural) => (n === 1 ? singular : plural)

// El panel de arriba del CRM: cumpleaños próximos, los más fieles, los que más refieren y lo de este mes. Cada lista lleva a su pestaña con el mismo número.
export default function PanelCrm({ resumen, onVerCumpleanos, onVerFieles, onVerReferidores, onVerSeguimiento }) {
  const { cumples, fieles, referidores, mes } = resumen
  return (
    <div role="region" aria-label="Resumen del CRM" className="grid grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200/70 bg-white shadow-sm sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      <Lista titulo="Cumpleaños próximos" vacio="Ningún paciente tiene su fecha de nacimiento registrada."
        filas={cumples.lista.map((x) => ({ id: x.paciente.id, nombre: x.paciente.nombre, detalle: `${formatoFecha(x.fecha, "medioSinAnio")}${x.edad !== null ? ` · cumple ${x.edad}` : ""}` }))}
        enlace={cumples.delMes > 0 ? `Ver los ${cumples.delMes} de este mes` : cumples.total > 0 ? "Ver todos" : ""} onEnlace={onVerCumpleanos} ayuda="Abre Fidelización con los cumpleaños del mes" />
      <Lista titulo="Más fieles" vacio="Nadie suma puntos todavía."
        filas={fieles.lista.map((x) => ({ id: x.paciente.id, nombre: x.paciente.nombre, detalle: `${x.nivel ? x.nivel + " · " : ""}${x.valor} pts` }))}
        enlace={fieles.total > 0 ? "Ver el ranking" : ""} onEnlace={onVerFieles} ayuda="Abre el ranking de puntos" />
      <Lista titulo="Más refieren" vacio="Nadie ha referido todavía."
        filas={referidores.lista.map((x) => ({ id: x.paciente.id, nombre: x.paciente.nombre, detalle: `${x.valor} ${por(x.valor, "referido", "referidos")}` }))}
        enlace={referidores.total > 0 ? "Ver todos" : ""} onEnlace={onVerReferidores} ayuda="Abre el ranking de quienes más refieren" />
      <Lista titulo="Este mes"
        filas={[
          { id: "contactados", nombre: `${mes.contactados} ${por(mes.contactados, "contactado", "contactados")}`, detalle: "contactos hechos, como en el historial" },
          { id: "volvieron", nombre: `${mes.volvieron} ${por(mes.volvieron, "volvió", "volvieron")} a agendar`, detalle: "agendaron cita después" },
          { id: "campanas", nombre: `${mes.campanas} ${por(mes.campanas, "campaña enviada", "campañas enviadas")}`, detalle: "con al menos un envío" },
        ]}
        enlace="Ver el historial" onEnlace={onVerSeguimiento} ayuda="Abre el historial de contactos de este mes" />
    </div>
  )
}
