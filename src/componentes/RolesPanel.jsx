"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Pencil, Trash2, RotateCcw, X, ShieldCheck, ShieldAlert, Lock, Users, Glasses, AlertTriangle, Eye } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { registrarLog } from "../utilidades/logs"
import ConfirmarEliminarModal from "./ConfirmarEliminarModal"
import {
  NIVELES, MODULOS_PERMISO, GRUPOS_MODULOS, MODULOS_CON_ALCANCE, INICIOS_ROL,
  normalizarPermisosRol, resumenPermisos, menuDePermisos,
} from "../utilidades/roles"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

const rolVacio = () => ({ id: null, nombre: "", descripcion: "", es_predefinido: false, atiende_pacientes: false, permisos: {}, alcance: {}, inicio: "general" })

// Pantalla de Roles (R46-R48): lista de roles con sus permisos y editor con matriz
// Ver / Crear / Editar / Eliminar, alcance de los datos y vista previa de lo que verá la persona.
export default function RolesPanel({ usuario, roles, asignaciones, onCambio, onExito }) {
  const [editando, setEditando] = useState(null)
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [restaurando, setRestaurando] = useState(null)
  const [errorGlobal, setErrorGlobal] = useState("")

  const enUso = (rolId) => asignaciones.filter((a) => a.rol_id === rolId).length
  // Los predefinidos se pueden quitar; los que falten se recuperan con sus valores originales.
  const faltanPredefinidos = Math.max(0, 3 - roles.filter((r) => r.es_predefinido).length)
  const [recuperando, setRecuperando] = useState(false)
  const recuperarPredefinidos = async () => {
    setErrorGlobal("")
    setRecuperando(true)
    const { data, error } = await supabase.rpc("restaurar_roles_predefinidos_faltantes")
    setRecuperando(false)
    if (error) { setErrorGlobal(error.message); return }
    registrarLog(usuario, "usuarios", "Restauró los roles predefinidos", `${data} rol(es)`)
    onExito(`Se recuperaron ${data} rol${data === 1 ? "" : "es"} predefinido${data === 1 ? "" : "s"}.`)
    onCambio()
  }

  const eliminar = async () => {
    setEliminando(true)
    const { error } = await supabase.from("roles").delete().eq("id", porEliminar.id)
    setEliminando(false)
    if (error) {
      setErrorGlobal(/foreign key/i.test(error.message) ? "No se puede eliminar: hay personas con este rol. Cámbiales el rol primero." : error.message)
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
    if (error) { setErrorGlobal(error.message); return }
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {faltanPredefinidos > 0 && (
            <button type="button" onClick={recuperarPredefinidos} disabled={recuperando} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">
              <RotateCcw size={15} aria-hidden="true" /> {recuperando ? "Restaurando…" : `Restaurar roles predefinidos (${faltanPredefinidos})`}
            </button>
          )}
        <button type="button" onClick={() => { setErrorGlobal(""); setEditando(rolVacio()) }} className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
          <Plus size={16} aria-hidden="true" /> Nuevo rol
        </button>
        </div>
      </div>
      {errorGlobal && <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {errorGlobal}</p>}

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Roles">
        {roles.map((rol) => {
          const usos = enUso(rol.id)
          const resumen = resumenPermisos(rol.permisos)
          const propios = MODULOS_CON_ALCANCE.filter((m) => rol.permisos?.[m.id] && rol.alcance?.[m.id] === "propio")
          return (
            <li key={rol.id} className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold" style={{ color: INK }}>{rol.nombre}</h3>
                      <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold " + (rol.es_predefinido ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600")}>
                        {rol.es_predefinido && <Lock size={10} aria-hidden="true" />} {rol.es_predefinido ? "Predefinido" : "Propio"}
                      </span>
                      {rol.atiende_pacientes && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                    </div>
                    {rol.descripcion && <p className="mt-1 text-xs leading-relaxed text-slate-500">{rol.descripcion}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => { setErrorGlobal(""); setEditando(rol) }} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" aria-label={`Editar ${rol.nombre}`} title="Editar"><Pencil size={15} /></button>
                    {rol.es_predefinido && (
                      <button type="button" onClick={() => restaurar(rol)} disabled={restaurando === rol.id} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-50" aria-label={`Restaurar ${rol.nombre} a sus valores originales`} title="Restaurar valores originales"><RotateCcw size={15} /></button>
                    )}
                    <button type="button" onClick={() => setPorEliminar(rol)} disabled={usos > 0} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Eliminar ${rol.nombre}`} title={usos > 0 ? "Hay personas con este rol: cámbiales el rol primero" : "Eliminar"}><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {resumen.length === 0 ? <span className="text-xs text-slate-400">Sin permisos</span> : resumen.map((r) => (
                    <span key={r.modulo} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600" title={r.texto}>{r.modulo} <span className="font-normal text-slate-400">· {r.texto}</span></span>
                  ))}
                </div>
                {propios.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><ShieldAlert size={12} aria-hidden="true" /> Solo lo suyo: {propios.map((m) => m.nombre.toLowerCase()).join(", ")}</p>}
              </div>
              <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><Users size={12} aria-hidden="true" /> {usos === 0 ? "Nadie tiene este rol" : `${usos} persona${usos === 1 ? "" : "s"} con este rol`}</p>
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
          mensaje={porEliminar.es_predefinido ? "Nadie lo tiene asignado. Es un rol predefinido: si lo quitas, podrás recuperarlo con «Restaurar roles predefinidos»." : "Nadie lo tiene asignado. Esta acción no se puede deshacer."}
          eliminando={eliminando}
          onCancelar={() => setPorEliminar(null)}
          onConfirmar={eliminar}
        />
      )}
    </div>
  )
}

function EditorRol({ rol, roles, usuario, onCerrar, onGuardado }) {
  const nuevo = !rol.id
  const [nombre, setNombre] = useState(rol.nombre)
  const [descripcion, setDescripcion] = useState(rol.descripcion || "")
  const [atiende, setAtiende] = useState(!!rol.atiende_pacientes)
  const [inicio, setInicio] = useState(rol.inicio || "general")
  const [permisos, setPermisos] = useState(() => normalizarPermisosRol(rol.permisos || {}))
  const [alcance, setAlcance] = useState({ ...(rol.alcance || {}) })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }
  const refModal = useModalAccesible(true, cerrar)

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
  }
  const alternarTodo = (modulo) => {
    const m = MODULOS_PERMISO.find((x) => x.id === modulo)
    setPermisos((prev) => normalizarPermisosRol({ ...prev, [modulo]: prev[modulo]?.length === m.niveles.length ? [] : [...m.niveles] }))
  }

  const vista = useMemo(() => ({ menu: menuDePermisos(permisos), resumen: resumenPermisos(permisos), inicio: INICIOS_ROL.find((i) => i.id === inicio) }), [permisos, inicio])

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    const limpio = nombre.trim()
    if (limpio.length < 2) { setError("Escribe el nombre del rol."); return }
    if (roles.some((r) => r.id !== rol.id && r.nombre.trim().toLowerCase() === limpio.toLowerCase())) { setError("Ya existe un rol con ese nombre."); return }
    const alcanceLimpio = Object.fromEntries(Object.entries(alcance).filter(([m, v]) => v === "propio" && permisos[m]))
    const datos = { nombre: limpio, descripcion: descripcion.trim() || null, atiende_pacientes: atiende, inicio, permisos: normalizarPermisosRol(permisos), alcance: alcanceLimpio }
    setGuardando(true)
    const { error: errorGuardar } = nuevo
      ? await supabase.from("roles").insert({ ...datos, optica_id: usuario.opticaId })
      : await supabase.from("roles").update(datos).eq("id", rol.id)
    setGuardando(false)
    if (errorGuardar) { setError(/roles_nombre_unico|duplicate/i.test(errorGuardar.message) ? "Ya existe un rol con ese nombre." : errorGuardar.message); return }
    onGuardado(limpio, nuevo)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <form ref={refModal} onSubmit={guardar} role="dialog" aria-modal="true" aria-labelledby="rol-titulo" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><ShieldCheck size={20} aria-hidden="true" /></div>
            <div>
              <h2 id="rol-titulo" className="text-lg font-bold" style={{ color: INK }}>{nuevo ? "Nuevo rol" : `Editar rol: ${rol.nombre}`}</h2>
              <p className="text-xs text-slate-500">{rol.es_predefinido ? "Rol predefinido: puedes editarlo, restaurarlo o quitarlo si nadie lo tiene (luego se recupera)." : "Define qué ve y qué puede hacer quien tenga este rol."}</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_17rem] lg:overflow-hidden">
          <div className="space-y-5 p-5 lg:overflow-y-auto">
            {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del rol</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ej. Optómetra principal" className={CAMPO} autoFocus />
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Inicio que verá</span>
                <select value={inicio} onChange={(e) => setInicio(e.target.value)} className={CAMPO}>{INICIOS_ROL.map((i) => <option key={i.id} value={i.id}>{i.etiqueta}</option>)}</select>
              </label>
            </div>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Descripción <span className="font-normal text-slate-500">(opcional)</span></span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={200} className={CAMPO} />
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 transition-colors hover:border-blue-300">
              <input type="checkbox" checked={atiende} onChange={(e) => setAtiende(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
              <span className="text-sm"><span className="flex items-center gap-1.5 font-semibold text-slate-700"><Glasses size={15} className="text-blue-600" aria-hidden="true" /> Atiende pacientes</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">Aparece en "Asignado a" de las citas y puede atender y registrar fichas clínicas.</span></span>
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Permisos por módulo</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200/60">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <th scope="col" className="px-3 py-2 text-left">Módulo</th>
                      {NIVELES.map((n) => <th key={n.id} scope="col" className="w-20 px-2 py-2 text-center">{n.etiqueta}</th>)}
                      <th scope="col" className="w-16 px-2 py-2 text-center">Todo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRUPOS_MODULOS.map((grupo) => (
                      <GrupoFilas key={grupo} grupo={grupo} tiene={tiene} alternar={alternar} alternarTodo={alternarTodo} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Alcance de los datos</p>
              <div className="space-y-2">
                {MODULOS_CON_ALCANCE.map((m) => (
                  <label key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-slate-700">{m.nombre}</span>
                    <select value={alcance[m.id] === "propio" ? "propio" : "todo"} onChange={(e) => setAlcance((a) => ({ ...a, [m.id]: e.target.value }))} disabled={!permisos[m.id]} className="rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus-visible:border-blue-500 disabled:opacity-50" aria-label={`Alcance de ${m.nombre}`}>
                      <option value="todo">Todo lo de la óptica</option>
                      <option value="propio">{m.propio}</option>
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Los pacientes no se acotan: todo el equipo puede buscarlos.</p>
            </div>
          </div>

          <aside className="border-t border-slate-100 bg-slate-50/70 p-5 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Vista previa del rol">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Eye size={13} aria-hidden="true" /> Vista previa</p>
            <p className="mt-3 text-xs font-semibold text-slate-600">Menú que verá</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">Inicio</span>
              {vista.menu.map((m) => <span key={m} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">{m}</span>)}
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-600">Su Inicio</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">{vista.inicio?.etiqueta}.</span> {vista.inicio?.descripcion}</p>
            <p className="mt-4 text-xs font-semibold text-slate-600">Podrá</p>
            {vista.resumen.length === 0 ? <p className="mt-1 text-xs text-slate-400">Todavía nada: marca permisos a la izquierda.</p> : (
              <ul className="mt-1.5 space-y-1 text-xs text-slate-600">{vista.resumen.map((r) => <li key={r.modulo}><span className="font-semibold">{r.modulo}:</span> {r.texto}</li>)}</ul>
            )}
          </aside>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={cerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>{guardando ? "Guardando…" : nuevo ? "Crear rol" : "Guardar cambios"}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

function GrupoFilas({ grupo, tiene, alternar, alternarTodo }) {
  const modulos = MODULOS_PERMISO.filter((m) => m.grupo === grupo)
  const sensible = modulos.some((m) => m.sensible)
  return (
    <>
      <tr className={sensible ? "bg-amber-50/70" : "bg-white"}>
        <th colSpan={6} scope="colgroup" className={"px-3 pb-1 pt-3 text-left text-[11px] font-bold uppercase tracking-wide " + (sensible ? "text-amber-700" : "text-slate-500")}>
          {grupo}{sensible && <span className="ml-1.5 font-normal normal-case">· da acceso de administración de la óptica</span>}
        </th>
      </tr>
      {modulos.map((m) => (
        <tr key={m.id} className={"border-t border-slate-100 " + (sensible ? "bg-amber-50/40" : "")}>
          <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-700">
            {m.nombre}
            {m.ayuda && <span className="block text-[11px] font-normal text-slate-400">{m.ayuda}</span>}
          </th>
          {NIVELES.map((n) => (
            <td key={n.id} className="px-2 py-2 text-center">
              {m.niveles.includes(n.id) ? (
                <input type="checkbox" checked={tiene(m.id, n.id)} onChange={() => alternar(m.id, n.id)} aria-label={`${m.nombre}: ${n.etiqueta}`} className="h-4 w-4 cursor-pointer accent-blue-600" />
              ) : <span className="text-slate-300" aria-hidden="true">—</span>}
            </td>
          ))}
          <td className="px-2 py-2 text-center">
            <button type="button" onClick={() => alternarTodo(m.id)} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 cursor-pointer" aria-label={`Alternar todos los permisos de ${m.nombre}`}>Todo</button>
          </td>
        </tr>
      ))}
    </>
  )
}
