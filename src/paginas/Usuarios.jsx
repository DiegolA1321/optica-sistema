"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import AvisoFlotante, { DURACION_AVISO_MS } from "../componentes/AvisoFlotante"
import { useParamUrl } from "../utilidades/urlEstado"
import {
  Users, UserPlus, KeyRound, Plus, Pencil, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, Copy, Mail, Info, IdCard,
  History, Glasses, UserX, UserCheck, Lock,
} from "lucide-react"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"
import CampoClaveTemporal from "../componentes/CampoClaveTemporal"
import VistaPrevia, { EtiquetaDeMuestra } from "../componentes/VistaPrevia"
import { filtrarSoloLetras, esNombreValido, esEmailValido, esCedulaValida, resolverClaveTemporal } from "../utilidades/validaciones"
import { registrarLog } from "../utilidades/logs"
import { mensajeDeError } from "../utilidades/permisos"
import VentanaActividad from "../componentes/VentanaActividad"
import { Cascaron, PieFormulario } from "../componentes/AtencionPaciente"
import { unirPermisos, menuDePermisos, resumenPermisos } from "../utilidades/roles"
import RolesPanel from "../componentes/RolesPanel"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import ModalMisRoles from "../componentes/ModalMisRoles"
import FotoProfesional from "../componentes/FotoProfesional"
import { cargarMisPermisos } from "../utilidades/sesionPermisos"
import { INK, ACCION_VER } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

// Usuarios y roles (Bloque D, R46-R51). Los roles definen los permisos; cada persona recibe uno o varios.
// Desactivar reemplaza a eliminar: la persona pierde el acceso pero conserva su historial.
export default function Usuarios({ usuario, asistentes = [], setAsistentes, alActualizarUsuario }) {
  const [pestana, setPestana] = useParamUrl("tab", "usuarios", ["usuarios", "roles"])
  const [roles, setRoles] = useState([])
  const [asignaciones, setAsignaciones] = useState([]) // { perfil_id, rol_id }
  const [cargando, setCargando] = useState(true)
  // Si no se pudieron leer los roles o las personas, la pantalla lo dice y deja reintentar: nunca muestra "Sin rol" ni "0" como si fueran datos.
  const [errorCarga, setErrorCarga] = useState(false)
  // Asignar roles predefinidos y desactivar solo se ofrecen si la base ya aplica los permisos por nivel (migración 0091).
  const [nivelesVigentes, setNivelesVigentes] = useState(false)
  // El administrador principal (el primero de la óptica) cambia sus propios roles desde aquí; un administrador
  // creado después puede cambiar los de los demás, pero no los suyos. La base lo hace cumplir (migración 0098).
  const [esPrincipal, setEsPrincipal] = useState(true)
  const [misRolesAbierto, setMisRolesAbierto] = useState(false)
  // La foto del profesional (perfiles.foto_url, migración 0148) se lee aparte y con tolerancia: en una base sin esa columna la lista carga igual y no se ofrece el control de foto.
  const [fotos, setFotos] = useState({})
  const [fotosDisponibles, setFotosDisponibles] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(null)
  const mostrarExito = (msg) => { setMensajeExito(msg); setTimeout(() => setMensajeExito(null), DURACION_AVISO_MS) }

  const cargar = useCallback(async () => {
    if (!supabase || !usuario?.opticaId) { setCargando(false); return }
    const [{ data: r, error: errorRoles }, { data: a, error: errorAsignaciones }, { data: v }, { data: perfiles, error: errorPerfiles }, { data: principal }] = await Promise.all([
      supabase.from("roles").select("*").eq("optica_id", usuario.opticaId).order("es_predefinido", { ascending: false }).order("nombre"),
      supabase.from("perfil_roles").select("perfil_id, rol_id"),
      supabase.rpc("permisos_por_nivel_vigentes"),
      supabase.from("perfiles").select("id, nombre, email, etiqueta_rol, es_optometra, cedula, registro_profesional, activo, desactivado_en, motivo_desactivacion").eq("optica_id", usuario.opticaId).eq("rol", "asistente"),
      usuario.rol === "admin" ? supabase.rpc("soy_administrador_principal") : Promise.resolve({ data: null }),
    ])
    if (errorRoles || errorAsignaciones || errorPerfiles) { setErrorCarga(true); setCargando(false); return }
    setErrorCarga(false)
    // Sin la función (base sin la 0098) se asume principal: la base decide al guardar.
    if (principal === false) setEsPrincipal(false)
    setRoles(r || [])
    setAsignaciones(a || [])
    setNivelesVigentes(v === true)
    if (perfiles) setAsistentes(perfiles.map((p) => ({ id: p.id, nombre: p.nombre, correo: p.email, etiquetaRol: p.etiqueta_rol || "", esOptometra: !!p.es_optometra, cedula: p.cedula || "", registroProfesional: p.registro_profesional || "", activo: p.activo !== false, desactivadoEn: p.desactivado_en, motivoDesactivacion: p.motivo_desactivacion || "", permisos: {} })))
    setCargando(false)
    try {
      const { data: f, error: errorFotos } = await supabase.from("perfiles").select("id, foto_url").eq("optica_id", usuario.opticaId)
      if (!errorFotos && Array.isArray(f)) { setFotos(Object.fromEntries(f.map((x) => [x.id, x.foto_url || ""]))); setFotosDisponibles(true) } else setFotosDisponibles(false)
    } catch { setFotosDisponibles(false) }
  }, [usuario?.opticaId, setAsistentes])
  useEffect(() => { cargar() }, [cargar])
  const reintentarCarga = () => { setErrorCarga(false); setCargando(true); cargar() }

  // Actividad (incluye los cambios de roles y permisos, que la base registra sola)
  const [mostrarActividad, setMostrarActividad] = useState(false)
  const [pedidoNuevoRol, setPedidoNuevoRol] = useState(0) // el botón "Nuevo rol" de la cabecera le pide a la pantalla de Roles abrir el editor
  const alternarActividad = () => setMostrarActividad((v) => !v)

  // Modal crear / editar
  const [modal, setModal] = useState(null) // { id|null }
  const [nombre, setNombre] = useState("")
  const [cedula, setCedula] = useState("")
  const [registro, setRegistro] = useState("")
  const [correo, setCorreo] = useState("")
  const [escribirClave, setEscribirClave] = useState(false)
  const [claveEscrita, setClaveEscrita] = useState("")
  const [claveCreada, setClaveCreada] = useState(null) // { nombre, correo, clave }: la contraseña temporal, que se ve una sola vez
  const [copiada, setCopiada] = useState(false)
  const [rolesElegidos, setRolesElegidos] = useState([])
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  // Desactivar / reactivar
  const [aDesactivar, setADesactivar] = useState(null)
  const [procesando, setProcesando] = useState(false)

  const rolesAsignables = nivelesVigentes ? roles : roles.filter((r) => !r.es_predefinido)
  const rolesDe = (perfilId) => roles.filter((r) => asignaciones.some((a) => a.perfil_id === perfilId && a.rol_id === r.id))
  const permisosDeRoles = (lista) => unirPermisos(lista.map((r) => r.permisos))

  const abrirCrear = () => { setModal({ id: null }); setNombre(""); setCedula(""); setRegistro(""); setCorreo(""); setEscribirClave(false); setClaveEscrita(""); setRolesElegidos([]); setError("") }
  const abrirEditar = (a) => { setModal({ id: a.id }); setNombre(a.nombre); setCedula(a.cedula || ""); setRegistro(a.registroProfesional || ""); setCorreo(a.correo); setRolesElegidos(rolesDe(a.id).map((r) => r.id)); setError("") }
  const cerrarModal = () => { if (!guardando) setModal(null) }
  const alternarRol = (id) => setRolesElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const rolesSeleccionados = roles.filter((r) => rolesElegidos.includes(r.id))
  // Quien puede crear fichas clínicas atiende pacientes y firma recetas.
  const atiende = Boolean(permisosDeRoles(rolesSeleccionados).consultas?.includes("crear"))
  const vistaPrevia = useMemo(() => { const p = permisosDeRoles(rolesSeleccionados); return { menu: menuDePermisos(p), resumen: resumenPermisos(p) } }, [rolesElegidos, roles]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardarRoles = async (perfilId, elegidos = rolesElegidos) => {
    const actuales = asignaciones.filter((a) => a.perfil_id === perfilId).map((a) => a.rol_id)
    const quitar = actuales.filter((id) => !elegidos.includes(id))
    const agregar = elegidos.filter((id) => !actuales.includes(id))
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

  // "Mis roles" del administrador principal: guarda y refresca su sesión para que las vistas del menú se actualicen al instante.
  const guardarMisRoles = async (ids) => {
    const errorRoles = await guardarRoles(usuario.id, ids)
    if (errorRoles) return /solo el administrador principal/i.test(errorRoles.message) ? "Solo el administrador principal puede cambiar sus propios roles." : mensajeDeError(errorRoles, "No se pudieron guardar los roles.")
    const [extras, { data: yo }] = await Promise.all([cargarMisPermisos(supabase), supabase.from("perfiles").select("es_optometra").eq("id", usuario.id).maybeSingle()])
    alActualizarUsuario?.({ ...(extras || {}), esOptometra: !!yo?.es_optometra })
    registrarLog(usuario, "usuarios", "Cambió sus propios roles", roles.filter((r) => ids.includes(r.id)).map((r) => r.nombre).join(", ") || "Sin roles")
    setMisRolesAbierto(false)
    mostrarExito("Tus roles se guardaron. Elige tu vista en el menú de tu cuenta.")
    cargar()
    return null
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    if (!esNombreValido(nombre)) { setError("Ingresa un nombre válido (solo letras)."); return }
    if (rolesElegidos.length === 0) { setError("Elige al menos un rol: sin rol la persona no podría hacer nada."); return }
    const nombresRoles = rolesSeleccionados.map((r) => r.nombre).join(", ")
    // El registro profesional sale en las recetas que firma: es obligatorio para quien atiende (puede crear fichas clínicas).
    if (atiende && !registro.trim()) { setError("Completa el registro profesional: sale en las recetas que firma esta persona."); return }

    if (modal.id != null) {
      const cedulaLimpia = cedula.trim()
      if (cedulaLimpia && !esCedulaValida(cedulaLimpia)) { setError("La cédula ingresada no es válida."); return }
      setGuardando(true)
      const { error: errorUpdate } = await supabase.from("perfiles").update({ nombre: nombre.trim(), etiqueta_rol: nombresRoles, cedula: cedulaLimpia || null, registro_profesional: registro.trim() || null }).eq("id", modal.id)
      if (errorUpdate) {
        setGuardando(false)
        setError(errorUpdate.code === "23505" || /duplicate key|unique constraint/i.test(errorUpdate.message) ? "Esa cédula ya está registrada por otro usuario de esta óptica." : mensajeDeError(errorUpdate, "No se pudieron guardar los cambios del usuario."))
        return
      }
      const errorRoles = await guardarRoles(modal.id)
      setGuardando(false)
      if (errorRoles) { setError(mensajeDeError(errorRoles, "No se pudieron guardar los roles.")); return }
      registrarLog(usuario, "usuarios", "Editó a un usuario", nombre.trim())
      setModal(null)
      mostrarExito(`${nombre.trim()} actualizado correctamente.`)
      cargar()
      return
    }

    if (!esEmailValido(correo, false)) { setError("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    const cedulaCrear = cedula.trim()
    if (!cedulaCrear) { setError("Completa la cédula."); return }
    if (!esCedulaValida(cedulaCrear)) { setError("La cédula ingresada no es válida."); return }
    const { clave: claveTemporal, error: errorClave } = resolverClaveTemporal(escribirClave, claveEscrita) // por defecto la genera el sistema; la persona la cambia al entrar
    if (errorClave) { setError(errorClave); return }
    setGuardando(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: correo.trim(), password: claveTemporal, options: { data: { clave_temporal: true } } })
    if (errorAlta || !alta?.user) {
      setGuardando(false)
      const yaRegistrado = /already registered|already exists|already in use/i.test(errorAlta?.message || "")
      setError(yaRegistrado ? "Ese correo ya tiene una cuenta en el sistema — usa un correo distinto o contacta soporte." : mensajeDeError(errorAlta, "No se pudo crear la cuenta."))
      return
    }
    // El perfil se inserta con la sesión del administrador (no con la de la cuenta recién creada).
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, optica_id: usuario?.opticaId, rol: "asistente", nombre: nombre.trim(), email: correo.trim(), permisos: {}, etiqueta_rol: nombresRoles, es_optometra: false, cedula: cedulaCrear, registro_profesional: registro.trim() || null })
    await temp.auth.signOut()
    if (errorPerfil) {
      setGuardando(false)
      const cedulaDuplicada = errorPerfil.code === "23505" || /duplicate key|unique constraint/i.test(errorPerfil.message)
      setError((cedulaDuplicada ? "Esa cédula ya está registrada por otro usuario de esta óptica." : mensajeDeError(errorPerfil, "No se pudo guardar el perfil")) + " — la cuenta de correo ya quedó creada, contacta soporte si esto se repite.")
      return
    }
    const errorRoles = await guardarRoles(alta.user.id)
    setGuardando(false)
    if (errorRoles) { setError(`La cuenta se creó, pero no se pudieron asignar los roles (${mensajeDeError(errorRoles, "error al guardar")}). Edita al usuario para asignárselos.`); cargar(); return }
    registrarLog(usuario, "usuarios", "Creó un usuario nuevo", nombre.trim())
    setModal(null)
    mostrarExito(`Usuario ${nombre.trim()} creado correctamente.`)
    setCopiada(false)
    setClaveCreada({ nombre: nombre.trim(), correo: correo.trim(), clave: claveTemporal })
    cargar()
  }

  const desactivar = async () => {
    setProcesando(true)
    const { data, error: errorRpc } = await supabase.rpc("desactivar_usuario", { p_perfil_id: aDesactivar.id, p_motivo: null })
    setProcesando(false)
    if (errorRpc) { setError(mensajeDeError(errorRpc, "No se pudo desactivar al usuario.")); setADesactivar(null); return }
    registrarLog(usuario, "usuarios", "Desactivó a un usuario", aDesactivar.nombre)
    const n = data?.citas_futuras_asignadas || 0
    mostrarExito(`${aDesactivar.nombre} fue desactivado. Ya no puede entrar.${n > 0 ? ` Tiene ${n} cita${n === 1 ? "" : "s"} futura${n === 1 ? "" : "s"} asignada${n === 1 ? "" : "s"}: reasígnala${n === 1 ? "" : "s"} en Citas.` : ""}`)
    setADesactivar(null)
    cargar()
  }
  const reactivar = async (a) => {
    const { error: errorRpc } = await supabase.rpc("reactivar_usuario", { p_perfil_id: a.id })
    if (errorRpc) { setError(mensajeDeError(errorRpc, "No se pudo reactivar al usuario.")); return }
    registrarLog(usuario, "usuarios", "Reactivó a un usuario", a.nombre)
    mostrarExito(`${a.nombre} fue reactivado.`)
    cargar()
  }

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
        <AccionesDeCabecera>
          <button type="button" onClick={alternarActividad} className={"flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors cursor-pointer " + "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50"}>
            <History size={17} /> Actividad
          </button>
          {pestana === "usuarios" && (
            <button type="button" onClick={abrirCrear} disabled={cargando || errorCarga || roles.length === 0} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <UserPlus size={18} /> Crear usuario
            </button>
          )}
          {pestana === "roles" && (
            <button type="button" onClick={() => setPedidoNuevoRol((n) => n + 1)} disabled={cargando || errorCarga} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Plus size={18} aria-hidden="true" /> Nuevo rol
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      <div role="tablist" aria-label="Secciones" className="flex w-fit gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
        {[["usuarios", "Usuarios", Users, errorCarga ? null : asistentes.length + (usuario?.rol === "admin" ? 1 : 0)], ["roles", "Roles", ShieldCheck, errorCarga ? null : roles.length]].map(([id, etiqueta, Icono, n]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={"flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (pestana === id ? "text-white" : "text-slate-500 hover:bg-slate-50")} style={pestana === id ? { background: GRAD } : undefined}>
            <Icono size={14} aria-hidden="true" /> {etiqueta} {n !== null && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (pestana === id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{n}</span>}
          </button>
        ))}
      </div>

      {!cargando && !nivelesVigentes && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-800"><ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> Los permisos por nivel todavía no están activos en la base de datos: por seguridad, por ahora no se pueden asignar roles predefinidos ni desactivar usuarios.</p>
      )}

      {claveCreada && (
        <Cascaron
          titulo="Contraseña temporal"
          subtitulo={`Para ${claveCreada.nombre}`}
          Icono={KeyRound}
          ancho="max-w-md"
          onCerrar={() => setClaveCreada(null)}
          pie={<>
            <span className="text-xs text-slate-500">No se vuelve a mostrar.</span>
            <button type="button" onClick={() => setClaveCreada(null)} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          </>}
        >
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-slate-600">Entrega esta contraseña a <span className="font-semibold text-slate-800">{claveCreada.nombre}</span> ({claveCreada.correo}). Al entrar, el sistema le pedirá que elija la suya.</p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
              <code className="select-all font-mono text-lg font-bold tracking-wide" style={{ color: INK }}>{claveCreada.clave}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(claveCreada.clave).then(() => setCopiada(true)).catch(() => {}) }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                {copiada ? <><CheckCircle2 size={13} aria-hidden="true" /> Copiada</> : <><Copy size={13} aria-hidden="true" /> Copiar</>}
              </button>
            </div>
          </div>
        </Cascaron>
      )}
      {mostrarActividad && <VentanaActividad opticaId={usuario?.opticaId} onCerrar={() => setMostrarActividad(false)} />}

      {mensajeExito && <AvisoFlotante texto={mensajeExito} tipo="exito" />}
      {error && !modal && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>
      )}

      {errorCarga && !cargando ? (
        <div role="alert" className="rounded-2xl border border-red-200/60 bg-red-50 p-8 text-center">
          <AlertTriangle size={28} className="mx-auto text-red-500" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-red-800">No se pudo cargar los usuarios y roles</p>
          <p className="mt-1 text-sm text-red-700">Revisa tu conexión e inténtalo de nuevo.</p>
          <button type="button" onClick={reintentarCarga} className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer">Reintentar</button>
        </div>
      ) : cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Cargando usuarios">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200/60 bg-slate-100/70" />)}
        </div>
      ) : pestana === "roles" ? (
        <RolesPanel usuario={usuario} roles={roles} asignaciones={asignaciones} onCambio={cargar} onExito={mostrarExito} pedidoNuevoRol={pedidoNuevoRol} />
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
                  {fotos[usuario.id] ? <img src={fotos[usuario.id]} alt={`Foto de ${usuario.nombre}`} className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{(usuario.nombre || "A").charAt(0).toUpperCase()}</div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{usuario.nombre}</p>
                    {usuario.correo && <p className="truncate font-mono text-xs text-slate-500">{usuario.correo}</p>}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{esPrincipal ? "Administrador principal" : "Solo lectura"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Administrador</span>
                {rolesDe(usuario.id).map((r) => <span key={r.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{r.nombre}</span>)}
                {usuario.esOptometra && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
              </div>
              <p className="mt-3 text-xs text-slate-500">Ve y administra todos los módulos; no se desactiva desde aquí.{esPrincipal ? " Puedes sumarte roles para trabajar con su vista (por ejemplo, la de Optómetra)." : " Solo el administrador principal cambia sus propios roles."}</p>
              {fotosDisponibles && usuario.esOptometra && (
                <div className="mt-3"><FotoProfesional opticaId={usuario.opticaId} perfilId={usuario.id} nombre={usuario.nombre} url={fotos[usuario.id] || ""} onCambio={(u) => setFotos((p) => ({ ...p, [usuario.id]: u }))} onAviso={mostrarExito} /></div>
              )}
              {esPrincipal && nivelesVigentes && (
                <button type="button" onClick={() => setMisRolesAbierto(true)} className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                  <Pencil size={13} aria-hidden="true" /> Mis roles
                </button>
              )}
            </li>
          )}
          {asistentes.map((a) => {
            const susRoles = rolesDe(a.id)
            const permisos = permisosDeRoles(susRoles)
            const menu = menuDePermisos(permisos)
            const resumen = resumenPermisos(permisos) // los mismos módulos con su nivel, como en las tarjetas de los roles
            const administracion = menu.includes("Configuración")
            return (
              <li key={a.id} className={"flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm " + (a.activo === false ? "border-slate-200 opacity-80" : "border-slate-200/60")}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      {fotos[a.id] ? <img src={fotos[a.id]} alt={`Foto de ${a.nombre}`} className={"h-10 w-10 shrink-0 rounded-full object-cover " + (a.activo === false ? "grayscale" : "")} /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: a.activo === false ? "#94a3b8" : GRAD }}>{a.nombre.charAt(0).toUpperCase()}</div>}
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
                        <button type="button" onClick={() => { setError(""); setADesactivar(a) }} disabled={!nivelesVigentes} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" title={nivelesVigentes ? "Desactivar" : "Disponible cuando los permisos por nivel estén activos"} aria-label={`Desactivar a ${a.nombre}`}><UserX size={15} /></button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.activo === false && <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600"><Lock size={10} aria-hidden="true" /> Desactivado</span>}
                    {susRoles.length === 0 ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">Sin rol: no puede hacer nada</span> : susRoles.map((r) => (
                      <span key={r.id} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{r.nombre}</span>
                    ))}
                    {a.esOptometra && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                  </div>
                  {a.activo === false && a.motivoDesactivacion && <p className="mt-2 text-xs text-slate-500">Motivo: {a.motivoDesactivacion}</p>}
                  {administracion && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><ShieldAlert size={12} aria-hidden="true" /> Tiene administración delegada (Configuración)</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {resumen.length === 0 ? <span className="text-xs text-slate-400">Solo ve el Inicio</span> : resumen.map((r) => <span key={r.modulo} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600" title={r.texto}>{r.modulo} <span className="font-normal text-slate-400">· {r.texto}</span></span>)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {misRolesAbierto && (
        <ModalMisRoles roles={rolesAsignables} elegidosIniciales={asignaciones.filter((a) => a.perfil_id === usuario.id).map((a) => a.rol_id)} onGuardar={guardarMisRoles} onCerrar={() => setMisRolesAbierto(false)} />
      )}

      {modal != null && (
        <Cascaron titulo={modal.id != null ? "Editar usuario" : "Crear usuario"} subtitulo={modal.id != null ? "Actualiza sus datos y sus roles." : "Cuenta de acceso con el rol que elijas."} Icono={UserPlus} ancho="max-w-2xl" onCerrar={cerrarModal} formulario={{ onSubmit: guardar }}
          pie={<PieFormulario onCancelar={cerrarModal} etiquetaGuardar={modal.id != null ? "Guardar cambios" : "Crear usuario"} guardando={guardando} />}>
          <div className="space-y-4 p-5">
        {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertTriangle size={16} /> {error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo <span className="text-red-500">*</span></span>
            <input type="text" value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))} placeholder="Ej. Ana Torres" autoComplete="off" className={CAMPO} autoFocus />
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Cédula {modal.id == null && <span className="text-red-500">*</span>}</span>
            <div className="relative"><IdCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="text" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 dígitos" maxLength={10} className={CAMPO + " pl-9"} /></div>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Registro profesional {atiende && <span className="text-red-500">*</span>}</span>
            <input type="text" value={registro} onChange={(e) => setRegistro(e.target.value.slice(0, 40))} placeholder={atiende ? "Sale en la receta" : "Opcional"} maxLength={40} autoComplete="off" className={CAMPO} />
            {atiende && <span className="mt-1 block text-xs text-slate-500">Este rol atiende pacientes: su registro sale en cada receta que firma.</span>}
          </label>
        </div>
        {fotosDisponibles && (atiende || asistentes.find((x) => x.id === modal.id)?.esOptometra) && (modal.id != null
          ? <FotoProfesional opticaId={usuario.opticaId} perfilId={modal.id} nombre={nombre} url={fotos[modal.id] || ""} onCambio={(u) => setFotos((p) => ({ ...p, [modal.id]: u }))} onAviso={mostrarExito} />
          : <p className="text-xs text-slate-500">Podrás agregar su foto después de crear la cuenta.</p>)}
        {modal.id != null ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 text-slate-600"><Info size={17} className="mt-0.5 shrink-0" /><p className="text-xs leading-relaxed">El correo y la contraseña no se cambian desde aquí. Correo actual: <span className="font-mono font-semibold">{correo}</span></p></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico <span className="text-red-500">*</span></span>
              <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="ana.torres@correo.com" autoComplete="off" className={CAMPO + " pl-9"} /></div>
            </label>
            <CampoClaveTemporal escribir={escribirClave} onEscribir={setEscribirClave} valor={claveEscrita} onValor={setClaveEscrita} id="usuario-clave-temporal" />

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
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">{r.nombre}{r.es_predefinido && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">Predefinido</span>}</span>
                    {r.descripcion && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{r.descripcion}</span>}
                  </span>
                </label>
              )
            })}
            {!nivelesVigentes && roles.some((r) => r.es_predefinido) && <p className="text-xs text-amber-700">Los roles predefinidos se podrán asignar cuando los permisos por nivel estén activos.</p>}
          </div>
        </fieldset>

        {rolesSeleccionados.length > 0 && (
          <VistaPrevia nombre="Vista previa de lo que verá" leyenda="Lo que verá y podrá hacer">
            <div className="flex flex-wrap gap-1.5">
              <EtiquetaDeMuestra>Inicio</EtiquetaDeMuestra>
              {vistaPrevia.menu.map((m) => <EtiquetaDeMuestra key={m}>{m}</EtiquetaDeMuestra>)}
            </div>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">{vistaPrevia.resumen.map((r) => <li key={r.modulo}><span className="font-semibold">{r.modulo}:</span> {r.texto}</li>)}</ul>
          </VistaPrevia>
        )}
          </div>
        </Cascaron>
      )}

      {aDesactivar && (
        <Cascaron
          titulo={`¿Desactivar a ${aDesactivar.nombre}?`}
          subtitulo="Cambia el acceso, no el historial."
          Icono={UserX}
          ancho="max-w-md"
          onCerrar={() => { if (!procesando) setADesactivar(null) }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setADesactivar(null)} disabled={procesando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={desactivar} disabled={procesando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">{procesando ? "Desactivando…" : "Desactivar"}</button>
            </div>
          </>}
        >
          <div className="space-y-3 p-6">
            <p className="text-sm text-slate-700">{aDesactivar.nombre}{rolesDe(aDesactivar.id).length > 0 ? <span className="text-slate-500"> · {rolesDe(aDesactivar.id).map((r) => r.nombre).join(", ")}</span> : null}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li><strong>No podrá ingresar</strong> al sistema desde este momento.</li>
              <li><strong>Su historial se conserva</strong>: las ventas, abonos y registros que hizo siguen a su nombre.</li>
              <li>Puedes <strong>reactivar la cuenta</strong> cuando quieras, con sus mismos roles.</li>
            </ul>
            <p className="text-xs leading-relaxed text-slate-500">No existe «eliminar» un usuario: borraría quién hizo cada cosa en el sistema.</p>
          </div>
        </Cascaron>
      )}
    </div>
  )
}
