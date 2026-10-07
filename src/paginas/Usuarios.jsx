"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Users, UserPlus, Pencil, X, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Eye, EyeOff, Mail, Info, IdCard,
  History, Loader2, Glasses, UserX, UserCheck, Lock,
} from "lucide-react"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"
import { filtrarSoloLetras, esNombreValido, esEmailValido, esCedulaValida, validarClaveNueva, MENSAJE_CLAVE_SEGURA } from "../utilidades/validaciones"
import { registrarLog, NOMBRE_MODULO } from "../utilidades/logs"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { unirPermisos, menuDePermisos, resumenPermisos } from "../utilidades/roles"
import RolesPanel from "../componentes/RolesPanel"
import { INK, ACCION_VER } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

// Usuarios y roles (Bloque D, R46-R51). Los roles definen los permisos; cada persona recibe uno o varios.
// Desactivar reemplaza a eliminar: la persona pierde el acceso pero conserva su historial.
export default function Usuarios({ usuario, asistentes = [], setAsistentes }) {
  const [pestana, setPestana] = useState("usuarios")
  const [roles, setRoles] = useState([])
  const [asignaciones, setAsignaciones] = useState([]) // { perfil_id, rol_id }
  const [cargando, setCargando] = useState(true)
  // Asignar roles predefinidos y desactivar solo se ofrecen si la base ya aplica los permisos por nivel (migración 0091).
  const [nivelesVigentes, setNivelesVigentes] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(null)
  const mostrarExito = (msg) => { setMensajeExito(msg); setTimeout(() => setMensajeExito(null), 3500) }

  const cargar = useCallback(async () => {
    if (!supabase || !usuario?.opticaId) { setCargando(false); return }
    const [{ data: r }, { data: a }, { data: v }, { data: perfiles }] = await Promise.all([
      supabase.from("roles").select("*").eq("optica_id", usuario.opticaId).order("es_predefinido", { ascending: false }).order("nombre"),
      supabase.from("perfil_roles").select("perfil_id, rol_id"),
      supabase.rpc("permisos_por_nivel_vigentes"),
      supabase.from("perfiles").select("id, nombre, email, etiqueta_rol, es_optometra, cedula, activo, desactivado_en, motivo_desactivacion").eq("optica_id", usuario.opticaId).eq("rol", "asistente"),
    ])
    setRoles(r || [])
    setAsignaciones(a || [])
    setNivelesVigentes(v === true)
    if (perfiles) setAsistentes(perfiles.map((p) => ({ id: p.id, nombre: p.nombre, correo: p.email, etiquetaRol: p.etiqueta_rol || "", esOptometra: !!p.es_optometra, cedula: p.cedula || "", activo: p.activo !== false, desactivadoEn: p.desactivado_en, motivoDesactivacion: p.motivo_desactivacion || "", permisos: {} })))
    setCargando(false)
  }, [usuario?.opticaId, setAsistentes])
  useEffect(() => { cargar() }, [cargar])

  // Actividad (incluye los cambios de roles y permisos, que la base registra sola)
  const [mostrarActividad, setMostrarActividad] = useState(false)
  const [logs, setLogs] = useState([])
  const [cargandoLogs, setCargandoLogs] = useState(false)
  const [filtroUsuarioLog, setFiltroUsuarioLog] = useState("todos")
  const cargarActividad = async () => {
    if (!supabase || !usuario?.opticaId) return
    setCargandoLogs(true)
    const { data } = await supabase.from("logs_optica").select("*").eq("optica_id", usuario.opticaId).order("created_at", { ascending: false }).limit(100)
    setLogs(data || [])
    setCargandoLogs(false)
  }
  const alternarActividad = () => { const abrir = !mostrarActividad; setMostrarActividad(abrir); if (abrir) cargarActividad() }
  const usuariosEnLogs = [...new Set(logs.map((l) => l.usuario_nombre))]
  const logsFiltrados = filtroUsuarioLog === "todos" ? logs : logs.filter((l) => l.usuario_nombre === filtroUsuarioLog)

  // Modal crear / editar
  const [modal, setModal] = useState(null) // { id|null }
  const [nombre, setNombre] = useState("")
  const [cedula, setCedula] = useState("")
  const [correo, setCorreo] = useState("")
  const [clave, setClave] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [rolesElegidos, setRolesElegidos] = useState([])
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  // Desactivar / reactivar
  const [aDesactivar, setADesactivar] = useState(null)
  const [motivo, setMotivo] = useState("")
  const [procesando, setProcesando] = useState(false)

  const rolesAsignables = nivelesVigentes ? roles : roles.filter((r) => !r.es_predefinido)
  const rolesDe = (perfilId) => roles.filter((r) => asignaciones.some((a) => a.perfil_id === perfilId && a.rol_id === r.id))
  const permisosDeRoles = (lista) => unirPermisos(lista.map((r) => r.permisos))

  const abrirCrear = () => { setModal({ id: null }); setNombre(""); setCedula(""); setCorreo(""); setClave(""); setVerClave(false); setRolesElegidos([]); setError("") }
  const abrirEditar = (a) => { setModal({ id: a.id }); setNombre(a.nombre); setCedula(a.cedula || ""); setCorreo(a.correo); setClave(""); setVerClave(false); setRolesElegidos(rolesDe(a.id).map((r) => r.id)); setError("") }
  const cerrarModal = () => { if (!guardando) setModal(null) }
  const alternarRol = (id) => setRolesElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const rolesSeleccionados = roles.filter((r) => rolesElegidos.includes(r.id))
  const vistaPrevia = useMemo(() => { const p = permisosDeRoles(rolesSeleccionados); return { menu: menuDePermisos(p), resumen: resumenPermisos(p) } }, [rolesElegidos, roles]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardarRoles = async (perfilId) => {
    const actuales = asignaciones.filter((a) => a.perfil_id === perfilId).map((a) => a.rol_id)
    const quitar = actuales.filter((id) => !rolesElegidos.includes(id))
    const agregar = rolesElegidos.filter((id) => !actuales.includes(id))
    // primero se agrega y luego se quita: la persona nunca queda un instante sin ningún rol
    if (agregar.length > 0) {
      const { error: e1 } = await supabase.from("perfil_roles").insert(agregar.map((rol_id) => ({ perfil_id: perfilId, rol_id, asignado_por: usuario.id })))
      if (e1) return e1
    }
    if (quitar.length > 0) {
      const { error: e2 } = await supabase.from("perfil_roles").delete().eq("perfil_id", perfilId).in("rol_id", quitar)
      if (e2) return e2
    }
    return null
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    if (!esNombreValido(nombre)) { setError("Ingresa un nombre válido (solo letras)."); return }
    if (rolesElegidos.length === 0) { setError("Elige al menos un rol: sin rol la persona no podría hacer nada."); return }
    const nombresRoles = rolesSeleccionados.map((r) => r.nombre).join(", ")

    if (modal.id != null) {
      const cedulaLimpia = cedula.trim()
      if (cedulaLimpia && !esCedulaValida(cedulaLimpia)) { setError("La cédula ingresada no es válida."); return }
      setGuardando(true)
      const { error: errorUpdate } = await supabase.from("perfiles").update({ nombre: nombre.trim(), etiqueta_rol: nombresRoles, cedula: cedulaLimpia || null }).eq("id", modal.id)
      if (errorUpdate) {
        setGuardando(false)
        setError(errorUpdate.code === "23505" || /duplicate key|unique constraint/i.test(errorUpdate.message) ? "Esa cédula ya está registrada por otro usuario de esta óptica." : errorUpdate.message)
        return
      }
      const errorRoles = await guardarRoles(modal.id)
      setGuardando(false)
      if (errorRoles) { setError(errorRoles.message); return }
      registrarLog(usuario, "usuarios", "Editó a un usuario", nombre.trim())
      setModal(null)
      mostrarExito(`${nombre.trim()} actualizado correctamente.`)
      cargar()
      return
    }

    if (!esEmailValido(correo, false)) { setError("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    const errorClave = validarClaveNueva(clave)
    if (errorClave) { setError(errorClave); return }
    const cedulaCrear = cedula.trim()
    if (!cedulaCrear) { setError("Completa la cédula."); return }
    if (!esCedulaValida(cedulaCrear)) { setError("La cédula ingresada no es válida."); return }
    setGuardando(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: correo.trim(), password: clave })
    if (errorAlta || !alta?.user) {
      setGuardando(false)
      const yaRegistrado = /already registered|already exists|already in use/i.test(errorAlta?.message || "")
      setError(yaRegistrado ? "Ese correo ya tiene una cuenta en el sistema — usa un correo distinto o contacta soporte." : errorAlta?.message || "No se pudo crear la cuenta.")
      return
    }
    // El perfil se inserta con la sesión del administrador (no con la de la cuenta recién creada).
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, optica_id: usuario?.opticaId, rol: "asistente", nombre: nombre.trim(), email: correo.trim(), permisos: {}, etiqueta_rol: nombresRoles, es_optometra: false, cedula: cedulaCrear })
    await temp.auth.signOut()
    if (errorPerfil) {
      setGuardando(false)
      const cedulaDuplicada = errorPerfil.code === "23505" || /duplicate key|unique constraint/i.test(errorPerfil.message)
      setError((cedulaDuplicada ? "Esa cédula ya está registrada por otro usuario de esta óptica." : errorPerfil.message) + " — la cuenta de correo ya quedó creada, contacta soporte si esto se repite.")
      return
    }
    const errorRoles = await guardarRoles(alta.user.id)
    setGuardando(false)
    if (errorRoles) { setError(`La cuenta se creó, pero no se pudieron asignar los roles (${errorRoles.message}). Edita al usuario para asignárselos.`); cargar(); return }
    registrarLog(usuario, "usuarios", "Creó un usuario nuevo", nombre.trim())
    setModal(null)
    mostrarExito(`Usuario ${nombre.trim()} creado correctamente.`)
    cargar()
  }

  const desactivar = async () => {
    setProcesando(true)
    const { data, error: errorRpc } = await supabase.rpc("desactivar_usuario", { p_perfil_id: aDesactivar.id, p_motivo: motivo.trim() || null })
    setProcesando(false)
    if (errorRpc) { setError(errorRpc.message); setADesactivar(null); return }
    registrarLog(usuario, "usuarios", "Desactivó a un usuario", aDesactivar.nombre)
    const n = data?.citas_futuras_asignadas || 0
    mostrarExito(`${aDesactivar.nombre} fue desactivado. Ya no puede entrar.${n > 0 ? ` Tiene ${n} cita${n === 1 ? "" : "s"} futura${n === 1 ? "" : "s"} asignada${n === 1 ? "" : "s"}: reasígnala${n === 1 ? "" : "s"} en Citas.` : ""}`)
    setADesactivar(null)
    setMotivo("")
    cargar()
  }
  const reactivar = async (a) => {
    const { error: errorRpc } = await supabase.rpc("reactivar_usuario", { p_perfil_id: a.id })
    if (errorRpc) { setError(errorRpc.message); return }
    registrarLog(usuario, "usuarios", "Reactivó a un usuario", a.nombre)
    mostrarExito(`${a.nombre} fue reactivado.`)
    cargar()
  }

  const refModalUsuario = useModalAccesible(modal != null, cerrarModal)
  const refModalDesactivar = useModalAccesible(aDesactivar != null, () => { if (!procesando) setADesactivar(null) })

  return (
    <div className="w-full space-y-6 text-left">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><Users size={24} /></div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Usuarios y permisos</h1>
            <p className="text-sm text-slate-500">Primero defines los roles; luego eliges el rol de cada persona.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={alternarActividad} className={"flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors cursor-pointer " + (mostrarActividad ? "border-blue-200/60 bg-blue-50 text-blue-700" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}>
            <History size={17} /> Actividad
          </button>
          {pestana === "usuarios" && (
            <button type="button" onClick={abrirCrear} disabled={cargando || roles.length === 0} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <UserPlus size={18} /> Crear usuario
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Secciones" className="flex w-fit gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
        {[["usuarios", "Usuarios", Users, asistentes.length + (usuario?.rol === "admin" ? 1 : 0)], ["roles", "Roles", ShieldCheck, roles.length]].map(([id, etiqueta, Icono, n]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={"flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (pestana === id ? "text-white" : "text-slate-500 hover:bg-slate-50")} style={pestana === id ? { background: GRAD } : undefined}>
            <Icono size={14} aria-hidden="true" /> {etiqueta} <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (pestana === id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{n}</span>
          </button>
        ))}
      </div>

      {!cargando && !nivelesVigentes && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-800"><ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> Los permisos por nivel todavía no están activos en la base de datos: por seguridad, por ahora no se pueden asignar roles predefinidos ni desactivar usuarios.</p>
      )}

      {mostrarActividad && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}><History size={16} /> Actividad reciente</h4>
              <p className="mt-0.5 text-xs text-slate-500">Qué hizo cada usuario, incluidos los cambios de roles y permisos — últimas 100 acciones.</p>
            </div>
            {usuariosEnLogs.length > 0 && (
              <select value={filtroUsuarioLog} onChange={(e) => setFiltroUsuarioLog(e.target.value)} aria-label="Filtrar actividad por usuario" className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white">
                <option value="todos">Todos los usuarios</option>
                {usuariosEnLogs.map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            )}
          </div>
          <div className="mt-4">
            {cargandoLogs ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Cargando actividad...</div>
            ) : logsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><History size={22} /></div><p className="text-sm font-medium text-slate-500">Todavía no hay actividad registrada.</p></div>
            ) : (
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {logsFiltrados.map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}{l.detalle && <span className="text-slate-500"> — {l.detalle}</span>}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{NOMBRE_MODULO[l.modulo] || l.modulo}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">{new Date(l.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mensajeExito && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="text-emerald-500" size={20} /><p className="text-sm font-semibold">{mensajeExito}</p></div>
      )}
      {error && !modal && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>
      )}

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Cargando usuarios">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200/60 bg-slate-100/70" />)}
        </div>
      ) : pestana === "roles" ? (
        <RolesPanel usuario={usuario} roles={roles} asignaciones={asignaciones} onCambio={cargar} onExito={mostrarExito} />
      ) : asistentes.length === 0 && usuario?.rol !== "admin" ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300"><Users size={30} /></div>
          <p className="mt-4 text-base font-semibold text-slate-600">Aún no hay usuarios creados</p>
          <p className="mt-1 text-sm text-slate-500">Créalos para que tu personal pueda usar el sistema con el rol que tú definas.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Usuarios">
          {/* El administrador de la óptica aparece en la lista, solo lectura: sus datos y su rol no se editan ni se desactivan desde aquí. */}
          {usuario?.rol === "admin" && (
            <li className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{(usuario.nombre || "A").charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{usuario.nombre}</p>
                    {usuario.correo && <p className="truncate font-mono text-xs text-slate-500">{usuario.correo}</p>}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"><Lock size={10} aria-hidden="true" /> Solo lectura</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">Administrador</span>
                {usuario.esOptometra && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
              </div>
              <p className="mt-3 text-xs text-slate-500">Cuenta principal de la óptica: ve y administra todos los módulos. No se edita ni se desactiva desde aquí.</p>
            </li>
          )}
          {asistentes.map((a) => {
            const susRoles = rolesDe(a.id)
            const permisos = permisosDeRoles(susRoles)
            const menu = menuDePermisos(permisos)
            const administracion = menu.some((m) => m === "Mensajes" || m === "Configuración")
            return (
              <li key={a.id} className={"flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm " + (a.activo === false ? "border-slate-200 opacity-80" : "border-slate-200/60")}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: a.activo === false ? "#94a3b8" : GRAD }}>{a.nombre.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{a.nombre}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{a.correo}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => abrirEditar(a)} className={"rounded-lg p-1.5 transition cursor-pointer " + ACCION_VER} title="Editar" aria-label={`Editar ${a.nombre}`}><Pencil size={15} /></button>
                      {a.activo === false ? (
                        <button type="button" onClick={() => reactivar(a)} disabled={!nivelesVigentes} className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" title="Reactivar" aria-label={`Reactivar a ${a.nombre}`}><UserCheck size={15} /></button>
                      ) : (
                        <button type="button" onClick={() => { setError(""); setMotivo(""); setADesactivar(a) }} disabled={!nivelesVigentes} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" title={nivelesVigentes ? "Desactivar" : "Disponible cuando los permisos por nivel estén activos"} aria-label={`Desactivar a ${a.nombre}`}><UserX size={15} /></button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.activo === false && <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600"><Lock size={10} aria-hidden="true" /> Desactivado</span>}
                    {susRoles.length === 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Sin rol: no puede hacer nada</span> : susRoles.map((r) => (
                      <span key={r.id} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">{r.nombre}</span>
                    ))}
                    {a.esOptometra && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                  </div>
                  {a.activo === false && a.motivoDesactivacion && <p className="mt-2 text-xs text-slate-500">Motivo: {a.motivoDesactivacion}</p>}
                  {administracion && <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700"><ShieldAlert size={12} aria-hidden="true" /> Tiene administración delegada (Mensajes y/o Configuración)</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {menu.length === 0 ? <span className="text-xs text-slate-400">Solo ve el Inicio</span> : menu.map((m) => <span key={m} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{m}</span>)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modal != null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarModal}>
          <div ref={refModalUsuario} role="dialog" aria-modal="true" aria-labelledby="usuarios-modal-titulo" className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><UserPlus size={20} /></div>
                <div>
                  <h2 id="usuarios-modal-titulo" className="text-lg font-bold" style={{ color: INK }}>{modal.id != null ? "Editar usuario" : "Crear usuario"}</h2>
                  <p className="text-xs text-slate-500">{modal.id != null ? "Actualiza sus datos y sus roles." : "Cuenta de acceso con el rol que elijas."}</p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertTriangle size={16} /> {error}</div>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</span>
                    <input type="text" value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))} placeholder="Ej. Ana Torres" autoComplete="name" className={CAMPO} autoFocus />
                  </label>
                  <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Cédula {modal.id == null && <span className="text-red-500">*</span>}</span>
                    <div className="relative"><IdCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input type="text" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 dígitos" maxLength={10} className={CAMPO + " pl-9"} /></div>
                  </label>
                </div>
                {modal.id != null ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 text-slate-600"><Info size={17} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed">El correo y la contraseña no se cambian desde aquí. Correo actual: <span className="font-mono font-semibold">{correo}</span></p></div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</span>
                      <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="ana.torres@correo.com" autoComplete="email" className={CAMPO + " pl-9"} /></div>
                    </label>
                    <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</span>
                      <div className="relative">
                        <input type={verClave ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)} placeholder="8 o más, con letra y número" autoComplete="new-password" className={CAMPO + " pr-9"} />
                        <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">{verClave ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{MENSAJE_CLAVE_SEGURA}</p>
                    </label>
                  </div>
                )}

                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-slate-700">Rol <span className="font-normal text-slate-500">· puedes elegir más de uno: los permisos se suman</span></legend>
                  <div className="space-y-2">
                    {rolesAsignables.map((r) => {
                      const marcado = rolesElegidos.includes(r.id)
                      return (
                        <label key={r.id} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200")}>
                          <input type="checkbox" checked={marcado} onChange={() => alternarRol(r.id)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                          <span className="min-w-0 text-sm">
                            <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">{r.nombre}{r.es_predefinido && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Predefinido</span>}</span>
                            {r.descripcion && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{r.descripcion}</span>}
                          </span>
                        </label>
                      )
                    })}
                    {!nivelesVigentes && roles.some((r) => r.es_predefinido) && <p className="text-xs text-amber-700">Los roles predefinidos se podrán asignar cuando los permisos por nivel estén activos.</p>}
                  </div>
                </fieldset>

                {rolesSeleccionados.length > 0 && (
                  <section aria-label="Vista previa de lo que verá" className="rounded-xl border border-slate-200/60 bg-slate-50 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lo que verá y podrá hacer</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">Inicio</span>
                      {vistaPrevia.menu.map((m) => <span key={m} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">{m}</span>)}
                    </div>
                    <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">{vistaPrevia.resumen.map((r) => <li key={r.modulo}><span className="font-semibold">{r.modulo}:</span> {r.texto}</li>)}</ul>
                  </section>
                )}
              </div>
              <div className="flex shrink-0 gap-3 border-t border-slate-100 p-5">
                <button type="button" onClick={cerrarModal} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>{guardando ? "Guardando…" : modal.id != null ? "Guardar cambios" : "Crear usuario"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {aDesactivar && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => { if (!procesando) setADesactivar(null) }}>
          <div ref={refModalDesactivar} role="dialog" aria-modal="true" aria-labelledby="desactivar-titulo" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600"><UserX size={22} aria-hidden="true" /></div>
            <h2 id="desactivar-titulo" className="text-lg font-bold" style={{ color: INK }}>¿Desactivar a {aDesactivar.nombre}?</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Ya no podrá entrar ni ver datos de la óptica; si tiene la sesión abierta, se cierra en unos minutos.</li>
              <li>Se conserva todo su historial: sus citas y atenciones siguen mostrando su nombre.</li>
              <li>Deja de aparecer en "Asignado a". Puedes reactivarlo cuando quieras.</li>
            </ul>
            <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Motivo (opcional)</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Ej. dejó de trabajar con nosotros" className={CAMPO} /></label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setADesactivar(null)} disabled={procesando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={desactivar} disabled={procesando} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 cursor-pointer disabled:opacity-60">{procesando ? "Desactivando…" : "Desactivar"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
