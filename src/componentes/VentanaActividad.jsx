"use client"

import { useEffect, useMemo, useState } from "react"
import { History, Loader2, Search } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { INK } from "@/lib/tema"
import { fechaHoraLegible } from "../utilidades/formatoFecha"
import { NOMBRE_MODULO, detalleActividad, moduloDeRegistro } from "../utilidades/logs"
import { Cascaron } from "./AtencionPaciente"

// Registro de actividad en la ventana estándar del sistema (regla 43): quién hizo qué, con buscador y filtros por usuario y módulo.
// Es la misma ventana desde el Inicio ("Ver todo" del Registro de actividad) y desde Usuarios y permisos ("Actividad"); al cerrarla con la X
// o con Escape la persona queda donde estaba. Carga las últimas 200 acciones de la óptica.
const LIMITE = 200
const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export default function VentanaActividad({ opticaId, onCerrar }) {
  const [logs, setLogs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [texto, setTexto] = useState("")
  const [usuario, setUsuario] = useState("todos")
  const [modulo, setModulo] = useState("todos")

  useEffect(() => {
    let vivo = true
    if (!supabase || !opticaId) { setCargando(false); return }
    supabase.from("logs_optica").select("*").eq("optica_id", opticaId).order("created_at", { ascending: false }).limit(LIMITE)
      .then(({ data, error: err }) => {
        if (!vivo) return
        if (err) setError("No se pudo cargar la actividad. Revisa tu conexión e inténtalo de nuevo.")
        setLogs(data || [])
        setCargando(false)
      })
    return () => { vivo = false }
  }, [opticaId])

  const usuarios = useMemo(() => [...new Set(logs.map((l) => l.usuario_nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [logs])
  const modulos = useMemo(() => [...new Set(logs.map((l) => moduloDeRegistro(l)).filter(Boolean))].sort((a, b) => (NOMBRE_MODULO[a] || a).localeCompare(NOMBRE_MODULO[b] || b, "es")), [logs])
  const q = normalizar(texto).trim()
  const filtrados = useMemo(() => logs.filter((l) => {
    if (usuario !== "todos" && l.usuario_nombre !== usuario) return false
    if (modulo !== "todos" && moduloDeRegistro(l) !== modulo) return false
    if (!q) return true
    return normalizar(`${l.usuario_nombre} ${l.accion} ${detalleActividad(l.detalle)} ${NOMBRE_MODULO[moduloDeRegistro(l)] || l.modulo}`).includes(q)
  }), [logs, usuario, modulo, q])
  const hayFiltros = Boolean(q) || usuario !== "todos" || modulo !== "todos"
  const limpiar = () => { setTexto(""); setUsuario("todos"); setModulo("todos") }
  const clase = "rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm text-slate-700"

  return (
    <Cascaron
      titulo="Registro de actividad"
      subtitulo="Qué hizo cada usuario, incluidos los cambios de roles y permisos"
      Icono={History}
      onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500" role="status">{cargando ? "Cargando…" : `Mostrando ${filtrados.length} de ${logs.length} · últimas ${LIMITE} acciones`}</span>
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
      </>}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input type="search" aria-label="Buscar en la actividad" placeholder="Buscar por persona, acción o detalle…" value={texto} onChange={(e) => setTexto(e.target.value)}
            className="w-full rounded-xl border border-slate-200/60 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
        </div>
        <select aria-label="Filtrar actividad por usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} className={clase}>
          <option value="todos">Todos los usuarios</option>
          {usuarios.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select aria-label="Filtrar actividad por módulo" value={modulo} onChange={(e) => setModulo(e.target.value)} className={clase}>
          <option value="todos">Todos los módulos</option>
          {modulos.map((m) => <option key={m} value={m}>{NOMBRE_MODULO[m] || m}</option>)}
        </select>
      </div>
      {cargando ? (
        <div className="space-y-3 px-5 py-4" aria-busy="true" aria-label="Cargando actividad">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
          <p className="flex items-center justify-center gap-2 pt-1 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando actividad…</p>
        </div>
      ) : error ? (
        <p role="alert" className="px-5 py-10 text-center text-sm font-medium text-red-700">{error}</p>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><History size={22} aria-hidden="true" /></div>
          <p className="text-sm font-semibold text-slate-600">{hayFiltros ? "Ninguna acción coincide con la búsqueda." : "Todavía no hay actividad registrada."}</p>
          {hayFiltros && <button type="button" onClick={limpiar} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Quitar los filtros</button>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-5" aria-label="Actividad">
          {filtrados.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold" style={{ color: INK }}>{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
                  {detalleActividad(l.detalle) && <span className="text-slate-500"> — {detalleActividad(l.detalle)}</span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{NOMBRE_MODULO[moduloDeRegistro(l)] || l.modulo}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{fechaHoraLegible(l.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Cascaron>
  )
}
