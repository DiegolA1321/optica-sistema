"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pencil, Trash2, RotateCcw, ShieldCheck, ShieldAlert, Lock, Users, Glasses, AlertTriangle } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { Cascaron, PieFormulario } from "./AtencionPaciente"
import { registrarLog } from "../utilidades/logs"
import { mensajeDeError } from "../utilidades/permisos"
import ConfirmarEliminarModal from "./ConfirmarEliminarModal"
import {
  NIVELES, MODULOS_PERMISO, MODULOS_CON_ALCANCE, INICIOS_ROL, OPCIONES_ALCANCE, ALCANCE_MAS_RESTRICTIVO,
  normalizarPermisosRol, resumenPermisos, alcanceDe, alcanceDeRolNuevo, alcanceParaGuardar, partirDeRol,
} from "../utilidades/roles"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

const rolVacio = () => ({ id: null, nombre: "", descripcion: "", es_predefinido: false, atiende_pacientes: false, permisos: {}, alcance: {}, inicio: "general" })

// Pantalla de Roles (R46-R48): lista de roles con sus permisos y editor con matriz
// Ver / Crear / Editar / Eliminar, alcance de los datos y vista previa de lo que verá la persona.
// pedidoNuevoRol: el botón "Nuevo rol" está en la cabecera de la pantalla (junto a Actividad, como "Crear usuario"); cada pulsación sube este número.
export default function RolesPanel({ usuario, roles, asignaciones, onCambio, onExito, pedidoNuevoRol = 0 }) {
  const [editando, setEditando] = useState(null)
  const ultimoPedido = useRef(pedidoNuevoRol)
  useEffect(() => {
    if (pedidoNuevoRol === ultimoPedido.current) return
    ultimoPedido.current = pedidoNuevoRol
    setErrorGlobal("")
    setEditando(rolVacio())
  }, [pedidoNuevoRol])
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [restaurando, setRestaurando] = useState(null)
  const [errorGlobal, setErrorGlobal] = useState("")

  const enUso = (rolId) => asignaciones.filter((a) => a.rol_id === rolId).length

  const eliminar = async () => {
    setEliminando(true)
    const { error } = await supabase.from("roles").delete().eq("id", porEliminar.id)
    setEliminando(false)
    if (error) {
      setErrorGlobal(/foreign key/i.test(error.message) ? "No se puede eliminar: hay personas con este rol. Cámbiales el rol primero." : mensajeDeError(error, "No se pudo eliminar el rol."))
      setPorEliminar(null)
      return
    }
    registrarLog(usuario, "usuarios", "Eliminó un rol", porEliminar.nombre)
    onExito(`Rol «${porEliminar.nombre}» eliminado.`)
    setPorEliminar(null)
    onCambio()
  }

  const restaurar = async (rol) => {
    setRestaurando(rol.id)
    const { error } = await supabase.rpc("restaurar_rol_predefinido", { p_rol_id: rol.id })
    setRestaurando(null)
    if (error) { setErrorGlobal(mensajeDeError(error, "No se pudo restaurar el rol.")); return }
    registrarLog(usuario, "usuarios", "Restauró un rol predefinido", rol.nombre)
    onExito(`Rol «${rol.nombre}» restaurado a sus valores originales.`)
    onCambio()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-slate-600">
          Un rol define qué módulos ve una persona y qué puede hacer en cada uno. Al crear un usuario eliges su rol (o varios: los permisos se suman).
        </p>
      </div>
      {errorGlobal && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {errorGlobal}</p>}

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Roles">
        {roles.map((rol) => {
          const usos = enUso(rol.id)
          const resumen = resumenPermisos(rol.permisos)
          const propios = MODULOS_CON_ALCANCE.filter((m) => rol.permisos?.[m.id] && rol.alcance?.[m.id] === "propio")
          const atiende = MODULOS_CON_ALCANCE.filter((m) => rol.permisos?.[m.id] && rol.alcance?.[m.id] === "atiende")
          return (
            <li key={rol.id} className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold" style={{ color: INK }}>{rol.nombre}</h3>
                      <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold " + (rol.es_predefinido ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600")}>
                        {rol.es_predefinido && <Lock size={10} aria-hidden="true" />} {rol.es_predefinido ? "Predefinido" : "Propio"}
                      </span>
                      {rol.atiende_pacientes && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                    </div>
                    {rol.descripcion && <p className="mt-1 text-xs leading-relaxed text-slate-500">{rol.descripcion}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => { setErrorGlobal(""); setEditando(rol) }} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" aria-label={`Editar ${rol.nombre}`} title="Editar"><Pencil size={15} /></button>
                    {rol.es_predefinido ? (
                      <button type="button" onClick={() => restaurar(rol)} disabled={restaurando === rol.id} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-50" aria-label={`Restaurar ${rol.nombre} a sus valores originales`} title="Restaurar valores originales"><RotateCcw size={15} /></button>
                    ) : (
                      <button type="button" onClick={() => setPorEliminar(rol)} disabled={usos > 0} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Eliminar ${rol.nombre}`} title={usos > 0 ? "Hay personas con este rol: cámbiales el rol primero" : "Eliminar"}><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {resumen.length === 0 ? <span className="text-xs text-slate-400">Sin permisos</span> : resumen.map((r) => (
                    <span key={r.modulo} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600" title={r.texto}>{r.modulo} <span className="font-normal text-slate-400">· {r.texto}</span></span>
                  ))}
                </div>
                {propios.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><ShieldAlert size={12} aria-hidden="true" /> Solo lo suyo: {propios.map((m) => m.nombre.toLowerCase()).join(", ")}</p>}
                {atiende.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><ShieldAlert size={12} aria-hidden="true" /> Solo los pacientes que atiende: {atiende.map((m) => m.nombre.toLowerCase()).join(", ")}</p>}
              </div>
              <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500"><Users size={12} aria-hidden="true" /> {usos === 0 ? "Nadie tiene este rol" : `${usos} persona${usos === 1 ? "" : "s"} con este rol`}</p>
            </li>
          )
        })}
      </ul>

      {editando && (
        <EditorRol
          rol={editando}
          roles={roles}
          usuario={usuario}
          onCerrar={() => setEditando(null)}
          onGuardado={(nombre, nuevo) => { setEditando(null); onExito(nuevo ? `Rol «${nombre}» creado.` : `Rol «${nombre}» actualizado.`); onCambio() }}
        />
      )}
      {porEliminar && (
        <ConfirmarEliminarModal
          titulo={`¿Eliminar el rol «${porEliminar.nombre}»?`}
          mensaje="Nadie lo tiene asignado. Esta acción no se puede deshacer."
          eliminando={eliminando}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={eliminar}
        />
      )}
    </div>
  )
}

// Crear o editar un rol (diseño de la Ronda 5): el nombre, de qué rol partir, cada módulo con sus interruptores (ver, crear, editar, borrar) y «Qué datos ve». Todo empieza apagado y con el alcance más
// restrictivo; solo se activa lo que se marca. Lo que no se ve de entrada (descripción, inicio que verá y si atiende pacientes) está en «Más opciones».
const FILAS_MODULOS = [...MODULOS_PERMISO, { id: "usuarios", nombre: "Usuarios y permisos", breve: "Solo administración", niveles: [], soloAdmin: true }]

function Interruptor({ activo, onCambiar, etiqueta, deshabilitado = false }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={deshabilitado} onClick={onCambiar}
      className={"relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " + (deshabilitado ? "cursor-not-allowed opacity-50 " : "cursor-pointer ")}
      style={{ backgroundColor: activo ? "#2563EB" : "#cbd5e1" }}>
      <span className={"absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " + (activo ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}

function EditorRol({ rol, roles, usuario, onCerrar, onGuardado }) {
  const nuevo = !rol.id
  const [nombre, setNombre] = useState(rol.nombre)
  const [descripcion, setDescripcion] = useState(rol.descripcion || "")
  const [atiende, setAtiende] = useState(!!rol.atiende_pacientes)
  const [inicio, setInicio] = useState(rol.inicio || "general")
  const [permisos, setPermisos] = useState(() => normalizarPermisosRol(rol.permisos || {}))
  // Un rol nuevo parte de lo más restrictivo; uno que ya existe, de lo que tiene guardado (un valor ausente es «toda la óptica», como en la base).
  const [alcance, setAlcance] = useState(() => (nuevo ? alcanceDeRolNuevo() : Object.fromEntries(MODULOS_CON_ALCANCE.map((m) => [m.id, alcanceDe(rol.alcance, m.id)]))))
  const [partir, setPartir] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }

  const tiene = (modulo, nivel) => permisos[modulo]?.includes(nivel) || false
  const alternar = (modulo, nivel) => {
    setPermisos((prev) => {
      const actuales = new Set(prev[modulo] || [])
      if (actuales.has(nivel)) {
        // quitar "ver" quita todo el módulo
        if (nivel === "ver") actuales.clear()
        else actuales.delete(nivel)
      } else {
        actuales.add(nivel)
        actuales.add("ver")
      }
      return normalizarPermisosRol({ ...prev, [modulo]: [...actuales] })
    })
    // Un módulo que se enciende parte de lo más restrictivo.
    if (!permisos[modulo] && MODULOS_CON_ALCANCE.some((m) => m.id === modulo)) setAlcance((a) => ({ ...a, [modulo]: ALCANCE_MAS_RESTRICTIVO }))
  }

  // «Partir de»: copia los permisos y el alcance de otro rol (el nombre y la descripción son del rol nuevo).
  const elegirPlantilla = (id) => {
    setPartir(id)
    const base = id ? roles.find((r) => r.id === id) : null
    const p = partirDeRol(base)
    setPermisos(base ? p.permisos : {})
    setAlcance(base ? p.alcance : alcanceDeRolNuevo())
    setAtiende(base ? p.atiende : false)
    setInicio(base ? p.inicio : "general")
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    const limpio = nombre.trim()
    if (limpio.length < 2) { setError("Escribe el nombre del rol."); return }
    if (roles.some((r) => r.id !== rol.id && r.nombre.trim().toLowerCase() === limpio.toLowerCase())) { setError("Ya existe un rol con ese nombre."); return }
    const datos = { nombre: limpio, descripcion: descripcion.trim() || null, atiende_pacientes: atiende, inicio, permisos: normalizarPermisosRol(permisos), alcance: alcanceParaGuardar(alcance, permisos) }
    setGuardando(true)
    const { error: errorGuardar } = nuevo
      ? await supabase.from("roles").insert({ ...datos, optica_id: usuario.opticaId })
      : await supabase.from("roles").update(datos).eq("id", rol.id)
    setGuardando(false)
    if (errorGuardar) { setError(/roles_nombre_unico|duplicate/i.test(errorGuardar.message) ? "Ya existe un rol con ese nombre." : mensajeDeError(errorGuardar, "No se pudo guardar el rol.")); return }
    onGuardado(limpio, nuevo)
  }

  return (
    <Cascaron titulo={nuevo ? "Crear rol" : `Editar rol: ${rol.nombre}`} subtitulo={rol.es_predefinido ? "Rol predefinido: puedes editarlo y restaurarlo, pero no eliminarlo." : "Qué puede hacer y qué datos ve quien tenga este rol"} Icono={ShieldCheck} ancho="max-w-4xl" formulario={{ onSubmit: guardar }}
      pie={<PieFormulario onCancelar={cerrar} etiquetaGuardar={nuevo ? "Crear rol" : "Guardar cambios"} guardando={guardando} />}>
      <div className="space-y-5 p-5">
        {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}
        <div className={"grid grid-cols-1 gap-4 " + (nuevo ? "sm:grid-cols-2" : "")}>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Nombre del rol</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ej. Optómetra principal" className={CAMPO} autoFocus />
          </label>
          {nuevo && (
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Partir de</span>
              <select value={partir} onChange={(e) => elegirPlantilla(e.target.value)} className={CAMPO}>
                <option value="">Ningún rol (todo apagado)</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 text-left">Módulo</th>
                {NIVELES.map((n) => <th key={n.id} scope="col" className="w-20 px-2 py-2 text-center">{n.id === "eliminar" ? "Borrar" : n.etiqueta}</th>)}
                <th scope="col" className="w-48 py-2 pl-3 text-left">Qué datos ve</th>
              </tr>
            </thead>
            <tbody>
              {FILAS_MODULOS.map((m) => {
                const conAlcance = MODULOS_CON_ALCANCE.some((x) => x.id === m.id)
                return (
                  <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
                    <th scope="row" className="py-3 pr-3 text-left" title={m.ayuda || undefined}>
                      <span className="block font-bold" style={{ color: INK }}>{m.nombre}</span>
                      <span className={"block text-xs font-normal " + (m.sensible ? "text-amber-700" : "text-slate-500")}>{m.breve}</span>
                    </th>
                    {NIVELES.map((n) => (
                      <td key={n.id} className="px-2 py-3 text-center">
                        {m.soloAdmin ? <Interruptor activo={false} deshabilitado etiqueta={`${m.nombre}: ${n.etiqueta} (solo administración)`} />
                          : m.niveles.includes(n.id) ? <Interruptor activo={tiene(m.id, n.id)} onCambiar={() => alternar(m.id, n.id)} etiqueta={`${m.nombre}: ${n.id === "eliminar" ? "Borrar" : n.etiqueta}`} />
                          : <span className="text-slate-300" aria-hidden="true">—</span>}
                      </td>
                    ))}
                    <td className="py-3 pl-3">
                      {conAlcance && permisos[m.id] ? (
                        <select value={alcanceDe(alcance, m.id)} onChange={(e) => setAlcance((a) => ({ ...a, [m.id]: e.target.value }))} aria-label={`Qué datos ve en ${m.nombre}`} className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus-visible:border-blue-500">
                          {OPCIONES_ALCANCE[m.id].map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
                        </select>
                      ) : m.id === "pacientes" && permisos.pacientes ? <span className="text-xs text-slate-500">Todos (se comparten)</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">Todo empieza apagado y con el alcance más restrictivo («Solo lo suyo»). Solo se activa lo que se marca.</p>

        <details className="rounded-xl border border-slate-200/60 px-3.5 py-2.5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Más opciones</summary>
          <div className="mt-3 space-y-4">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Descripción <span className="font-normal text-slate-500">(opcional)</span></span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200} className={CAMPO} />
            </label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Inicio que verá</span>
              <select value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO}>{INICIOS_ROL.map((i) => <option key={i.id} value={i.id}>{i.etiqueta}</option>)}</select>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 transition-colors hover:border-blue-300">
              <input type="checkbox" checked={atiende} onChange={(e) => setAtiende(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span className="text-sm"><span className="flex items-center gap-1.5 font-semibold text-slate-700"><Glasses size={15} className="text-blue-600" aria-hidden="true" /> Atiende pacientes</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Aparece en «Asignado a» de las citas y puede atender y registrar fichas clínicas.</span></span>
            </label>
          </div>
        </details>
      </div>
    </Cascaron>
  )
}
