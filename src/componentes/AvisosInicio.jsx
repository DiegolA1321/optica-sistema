"use client"

import { useCallback, useEffect, useState } from "react"
import { Megaphone, ArrowRight, Check } from "lucide-react"
import { INK } from "@/lib/tema"
import { avisosUnificados, estaVencido } from "../utilidades/comunicacionInterna"
import { EVENTO_SOPORTE_CAMBIADO, avisarCambioSoporte, leerAvisosInternos, marcarAvisosInternosLeidos } from "../utilidades/soporteDatos"
import { hoyISO } from "../utilidades/disponibilidad"
import { fechaHoraLegible } from "../utilidades/formatoFecha"
import VentanaAvisosInternos from "./soporte/VentanaAvisosInternos"

const MOSTRADOS = 3

// «Avisos» del Inicio (reunión del 20 oct., punto 23): lo que el administrador publica para su personal aparece también aquí, en el Inicio de cada destinatario, con los
// no leídos destacados. Es la misma lista de la campanita y de Soporte › Avisos (mismos avisos, mismo «leído»); aquí se ven los más recientes y «Ver todos» abre la ventana.
// Sin avisos vigentes no se dibuja nada (no hay un hueco ni un «no hay avisos»: el que publica los ve en Soporte).
export default function AvisosInicio({ usuario }) {
  const [estado, setEstado] = useState(null)
  const [verTodos, setVerTodos] = useState(false)
  const cargar = useCallback(async () => {
    const r = await leerAvisosInternos(usuario.id, false)
    if (!r.error) setEstado(r)
  }, [usuario.id])
  useEffect(() => {
    cargar()
    window.addEventListener(EVENTO_SOPORTE_CAMBIADO, cargar)
    return () => window.removeEventListener(EVENTO_SOPORTE_CAMBIADO, cargar)
  }, [cargar])

  if (!estado) return null
  const hoy = hoyISO()
  const avisos = avisosUnificados({ internos: estado.datos.filter((a) => a.autorId !== usuario.id && !estaVencido(a, hoy)), leidosInternos: estado.leidos })
  if (avisos.length === 0) return null
  const sinLeer = avisos.filter((a) => !a.leido).length
  const marcar = async (a) => { await marcarAvisosInternosLeidos([a.id]); await cargar(); avisarCambioSoporte() }

  return (
    <section aria-label="Avisos" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Avisos</h2>
        {sinLeer > 0 && <span role="status" className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{sinLeer === 1 ? "1 nuevo" : `${sinLeer} nuevos`}</span>}
        <button type="button" onClick={() => setVerTodos(true)} aria-label="Ver todos los avisos" className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todos <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <ul className="space-y-2">
        {avisos.slice(0, MOSTRADOS).map((a) => (
          <li key={a.id} className={"flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm " + (a.leido ? "border-slate-200/60" : "border-blue-300 ring-2 ring-blue-50")}>
            <span className={"mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg " + (a.leido ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600")}><Megaphone size={16} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className={"truncate text-sm " + (a.leido ? "font-semibold text-slate-700" : "font-bold")} style={a.leido ? undefined : { color: INK }}>{a.titulo}</p>
              <p className="line-clamp-2 text-sm text-slate-600">{a.cuerpo}</p>
              <p className="mt-0.5 text-xs text-slate-500">De {a.autorNombre} · {fechaHoraLegible(a.creadoEn)}</p>
            </div>
            {!a.leido && (
              <button type="button" onClick={() => marcar(a)} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Check size={14} aria-hidden="true" /> Leído</button>
            )}
          </li>
        ))}
      </ul>
      {verTodos && <VentanaAvisosInternos usuario={usuario} onCerrar={() => { setVerTodos(false); cargar() }} />}
    </section>
  )
}
