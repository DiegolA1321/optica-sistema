"use client"

import { Activity, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { ICONO_COMPONENTE } from "./iconos"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import {
  ESTADOS, componentesConEstado, rapidez, haceTiempo, historial30, disponibilidad30, queHacer, nombreTarea, cadaCuanto,
} from "../../utilidades/estadoSistema"

const CLASE_BOTON = "flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60"

// Lo que dice la tarjeta debajo del estado: la rapidez con su referencia, o cuándo corrió por última vez la tarea.
export function subDeComponente(c, ahora) {
  const u = c.ultimo
  if (!u) return "Todavía sin verificar"
  const r = rapidez(c.id, u.latencia_ms)
  if (r) return `${r.nombre} · ${r.referencia}`
  if (c.id === "tareas") return u.referencia_at ? `Última tarea ${haceTiempo(u.referencia_at, ahora)}` : "Sin ejecuciones aún"
  if (c.id === "correo" && u.estado === "no_configurado") return "Falta clave y remitente propio"
  return u.estado === "operativo" ? "Responde con normalidad" : (u.detalle || "Revisa el detalle")
}

const CUADRO = { operativo: "bg-emerald-500", lento: "bg-amber-500", con_fallas: "bg-red-500", no_configurado: "bg-slate-400" }

// La ventana de un componente: su estado ahora, qué hacer, los últimos 30 días y los fallos recientes.
export function VentanaComponente({ id, sistema, hoyClave, ahora = Date.now(), onCerrar }) {
  const datos = sistema.datos
  const c = componentesConEstado(datos).find((x) => x.id === id)
  const u = c.ultimo
  const dias = historial30(datos, id, hoyClave)
  const disp = disponibilidad30(datos, id)
  const fallos = (datos.fallos || []).filter((f) => f.componente === id)
  const r = u ? rapidez(id, u.latencia_ms) : null
  const pasos = u ? queHacer(id, u.estado) : []
  return (
    <Cascaron
      titulo={c.nombre} subtitulo={c.para} Icono={ICONO_COMPONENTE[id] || Activity} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">{c.referencia}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={sistema.verificarAhora} disabled={sistema.verificando} className={CLASE_BOTON}>
            {sistema.verificando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />} Verificar ahora
          </button>
          <button type="button" onClick={onCerrar} className={CLASE_BOTON}>Cerrar</button>
        </div>
      </>}
    >
      <div className="space-y-5 p-5">
        <section aria-label="Estado ahora" className="flex flex-wrap items-center gap-3">
          {u ? <span className={"rounded-full border px-2.5 py-0.5 text-xs font-bold " + ESTADOS[u.estado].insignia}>{ESTADOS[u.estado].nombre}</span> : <span className="text-sm text-slate-500">Todavía sin verificar</span>}
          {u && <span className="text-sm text-slate-600">{subDeComponente(c, ahora)} · verificado {haceTiempo(u.creado_at, ahora)}</span>}
        </section>
        {u?.detalle && <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{u.detalle}</p>}

        <section aria-label="Qué hacer">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Qué hacer</h3>
          {pasos.length === 0 ? <p className="text-sm text-slate-600">Todavía no hay una verificación para recomendar algo.</p> : (
            <ul className="space-y-1.5 text-sm text-slate-700">{pasos.map((p) => <li key={p} className="flex gap-2">{u.estado === "operativo" && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />}<span>{p}</span></li>)}</ul>
          )}
        </section>

        <section aria-label="Últimos 30 días">
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Últimos 30 días</h3>
            {disp != null && <span className="text-xs text-slate-500">{String(disp).replace(".", ",")}% de las verificaciones, operativo</span>}
          </div>
          <div className="flex gap-0.5" role="img" aria-label={`Estado de cada uno de los últimos 30 días de ${c.nombre}`}>
            {dias.map((d) => (
              <span key={d.dia} title={`${d.dia}: ${d.estado ? ESTADOS[d.estado].nombre : "sin verificaciones"}`} className={"h-7 min-w-0 flex-1 rounded-sm " + (d.estado ? CUADRO[d.estado] : "bg-slate-200")} />
            ))}
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {["operativo", "lento", "con_fallas", "no_configurado"].map((e) => <span key={e} className="flex items-center gap-1"><span aria-hidden="true" className={"h-2 w-2 rounded-sm " + CUADRO[e]} />{ESTADOS[e].nombre}</span>)}
            <span className="flex items-center gap-1"><span aria-hidden="true" className="h-2 w-2 rounded-sm bg-slate-200" />Sin verificar</span>
          </p>
        </section>

        <section aria-label="Fallos recientes">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Fallos recientes</h3>
          {fallos.length === 0 ? <p className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" /> Sin fallos ni lentitud en los últimos 30 días.</p> : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
              {fallos.map((f) => (
                <li key={f.creado_at} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <span className={"mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold " + ESTADOS[f.estado].insignia}>{ESTADOS[f.estado].nombre}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{f.detalle || "Respondió más lento de lo normal."}</span>
                  <span className="shrink-0 text-xs text-slate-500">{fechaHoraLegible(f.creado_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {id === "tareas" && (
          <section aria-label="Tareas programadas">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tareas programadas</h3>
            {(datos.tareas || []).length === 0 ? <p className="text-sm text-slate-600">No se pudo leer la lista de tareas.</p> : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
                {datos.tareas.map((t) => (
                  <li key={t.nombre} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="block font-semibold" style={{ color: INK }}>{nombreTarea(t.nombre)}</span><span className="block text-xs text-slate-500">{cadaCuanto(t.programacion)}</span></span>
                    <span className="shrink-0 text-xs text-slate-600">{t.ultima_ejecucion ? `Última ${haceTiempo(t.ultima_ejecucion, ahora)}` : "Aún no corrió"}</span>
                    <span className={"shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold " + (t.ultimo_estado === "failed" ? ESTADOS.con_fallas.insignia : ESTADOS.operativo.insignia)}>{t.ultimo_estado === "failed" ? "Falló" : "Bien"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Cascaron>
  )
}
