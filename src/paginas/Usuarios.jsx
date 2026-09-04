"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  Info,
  Tag,
  CheckSquare,
  Square,
} from "lucide-react"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"
import { filtrarSoloLetras, esNombreValido, esEmailValido } from "../utilidades/validaciones"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Módulos que un usuario puede o no tener habilitados — mismos ids que las
// secciones del sidebar en Dashboard.jsx y que la función tiene_permiso_modulo()
// en la base de datos (migración 0034: estos permisos no son solo de interfaz,
// también limitan qué puede escribir por API). Agrupados en categorías para
// que el administrador no tenga que leer una lista plana de 9 casillas
// (feedback del ing) — y con "Administración" separada porque delegar Mensajes
// o Configuración es delegar acceso a nivel de óptica completa, no un módulo
// operativo más: por eso esos dos arrancan desactivados por defecto, a
// diferencia del resto.
const CATEGORIAS = [
  {
    id: "atencion",
    nombre: "Atención al paciente",
    modulos: [
      { id: "pacientes", nombre: "Pacientes" },
      { id: "consultas", nombre: "Ficha clínica" },
      { id: "citas", nombre: "Citas médicas" },
      { id: "crm", nombre: "CRM y fidelización" },
    ],
  },
  {
    id: "gestion",
    nombre: "Gestión y operación",
    modulos: [
      { id: "inventario", nombre: "Inventario" },
      { id: "reportes", nombre: "Reportes" },
      { id: "horario", nombre: "Mi horario" },
    ],
  },
  {
    id: "administracion",
    nombre: "Administración",
    sensible: true,
    modulos: [
      { id: "mensajes", nombre: "Mensajes" },
      { id: "configuracion", nombre: "Configuración" },
    ],
  },
]
const MODULOS = CATEGORIAS.flatMap((c) => c.modulos)

const permisosPorDefecto = () =>
  CATEGORIAS.reduce((acc, c) => {
    c.modulos.forEach((m) => { acc[m.id] = !c.sensible })
    return acc
  }, {})

// El default por módulo depende de su categoría (true para los operativos,
// false para los sensibles de Administración) — un perfil creado antes de
// que existiera esta categoría no tiene esas claves guardadas todavía, así
// que no puede asumirse "true si no está en false" como antes.
const permisoActivo = (asistente, moduloId) => {
  const categoria = CATEGORIAS.find((c) => c.modulos.some((m) => m.id === moduloId))
  const valor = asistente.permisos?.[moduloId]
  return valor === undefined ? !categoria?.sensible : valor
}

export default function Usuarios({ usuario, asistentes = [], setAsistentes }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [nombre, setNombre] = useState("")
  const [etiquetaRol, setEtiquetaRol] = useState("")
  const [correo, setCorreo] = useState("")
  const [clave, setClave] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [permisos, setPermisos] = useState(permisosPorDefecto())
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const abrirCrear = () => {
    setEditandoId(null)
    setNombre("")
    setEtiquetaRol("")
    setCorreo("")
    setClave("")
    setVerClave(false)
    setPermisos(permisosPorDefecto())
    setError("")
    setModalAbierto(true)
  }

  const abrirEditar = (a) => {
    setEditandoId(a.id)
    setNombre(a.nombre)
    setEtiquetaRol(a.etiquetaRol || "")
    setCorreo(a.correo)
    setClave("")
    setVerClave(false)
    setPermisos({ ...permisosPorDefecto(), ...a.permisos })
    setError("")
    setModalAbierto(true)
  }

  const cerrarModal = () => { if (!guardando) setModalAbierto(false) }

  const alternarPermiso = (id) => setPermisos((prev) => ({ ...prev, [id]: !prev[id] }))

  // "Seleccionar toda la categoría" — si ya están todos activos, la desactiva
  // todos; si falta alguno, los activa todos. Mismo patrón que pidió el ing
  // ("le doy click a la sección general, se selecciona todo, o se deselecciona
  // todo, o internamente le doy click a lo que me interesa").
  const alternarCategoria = (categoria) => {
    const todosActivos = categoria.modulos.every((m) => permisos[m.id])
    setPermisos((prev) => {
      const siguiente = { ...prev }
      categoria.modulos.forEach((m) => { siguiente[m.id] = !todosActivos })
      return siguiente
    })
  }

  // Editar solo cambia nombre/permisos — correo y contraseña quedan fijos
  // una vez creada la cuenta (son de Supabase Auth, no hay endpoint sin
  // privilegios elevados para cambiarlos desde acá).
  const guardar = async (e) => {
    e.preventDefault()
    setError("")

    if (editandoId != null) {
      if (!esNombreValido(nombre)) { setError("Ingresa un nombre válido (solo letras)."); return }
      setGuardando(true)
      const { error: errorUpdate } = await supabase.from("perfiles").update({ nombre: nombre.trim(), permisos, etiqueta_rol: etiquetaRol.trim() || null }).eq("id", editandoId)
      setGuardando(false)
      if (errorUpdate) { setError(errorUpdate.message); return }
      setAsistentes(asistentes.map((a) => (a.id === editandoId ? { ...a, nombre: nombre.trim(), permisos, etiquetaRol: etiquetaRol.trim() } : a)))
      setModalAbierto(false)
      return
    }

    if (!esNombreValido(nombre)) { setError("Ingresa un nombre válido (solo letras)."); return }
    if (!esEmailValido(correo, false)) { setError("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    if (!clave.trim()) {
      setError("Completa la contraseña.")
      return
    }
    if (clave.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    setGuardando(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: correo.trim(), password: clave })
    if (errorAlta || !alta?.user) {
      setGuardando(false)
      setError(errorAlta?.message || "No se pudo crear la cuenta.")
      return
    }
    // Ciberseguridad: el insert de perfiles va con la sesión del admin
    // logueado (supabase), no con la del usuario recién creado (temp) — la
    // policy de auto-inserción para rol='asistente' no restringe optica_id,
    // así que insertar autenticado como el usuario nuevo dejaría a
    // cualquiera con la anon key crear una cuenta y auto-asignarse
    // asistente de CUALQUIER óptica llamando la API de Supabase directo, sin
    // pasar por esta pantalla. perfiles_admin_gestiona_asistentes sí permite
    // esto, scoped a la óptica del admin que llama.
    const { error: errorPerfil } = await supabase
      .from("perfiles")
      .insert({ id: alta.user.id, optica_id: usuario?.opticaId, rol: "asistente", nombre: nombre.trim(), email: correo.trim(), permisos, etiqueta_rol: etiquetaRol.trim() || null })
    await temp.auth.signOut()
    setGuardando(false)
    if (errorPerfil) {
      setError(errorPerfil.message + " — la cuenta de correo ya quedó creada, contactá soporte si esto se repite.")
      return
    }
    setAsistentes([...asistentes, { id: alta.user.id, nombre: nombre.trim(), correo: correo.trim(), permisos, etiquetaRol: etiquetaRol.trim() }])
    setModalAbierto(false)
  }

  const confirmarEliminar = async () => {
    if (porEliminar == null) return
    setEliminando(true)
    const { error: errorDelete } = await supabase.from("perfiles").delete().eq("id", porEliminar)
    setEliminando(false)
    if (errorDelete) { setError(errorDelete.message); return }
    setAsistentes(asistentes.filter((a) => a.id !== porEliminar))
    setPorEliminar(null)
  }

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Users size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Usuarios y permisos</h1>
            <p className="text-sm text-slate-500">Crea usuarios y define qué puede ver y hacer cada uno.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <UserPlus size={18} />
          Crear usuario
        </button>
      </div>

      {/* ─── NOTA DE ALCANCE ─── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed">
          Solo el administrador principal ve esta sección. Cada usuario inicia sesión con el correo y contraseña que le asignes aquí (cuenta real, funciona desde cualquier dispositivo), y en su panel solo aparecen los módulos que dejes activados. Tú, como administrador principal, siempre conservas acceso completo — esto solo define qué le delegas a cada persona.
        </p>
      </div>

      {/* ─── LISTADO ─── */}
      {asistentes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300">
            <Users size={30} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-600">Aún no hay usuarios creados</p>
          <p className="mt-1 text-sm text-slate-500">Créalos para que tu personal contratado pueda usar el sistema con los permisos que tú definas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {asistentes.map((a) => {
            const activos = MODULOS.filter((m) => permisoActivo(a, m.id))
            const categoriaAdmin = CATEGORIAS.find((c) => c.sensible)
            const tieneAdminDelegada = categoriaAdmin.modulos.some((m) => permisoActivo(a, m.id))
            return (
              <div key={a.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                        {a.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{a.nombre}</p>
                        <p className="font-mono text-xs text-slate-500">{a.correo}</p>
                        {a.etiquetaRol && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            <Tag size={10} /> {a.etiquetaRol}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => abrirEditar(a)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Editar" aria-label={`Editar ${a.nombre}`}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => setPorEliminar(a.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 cursor-pointer" title="Eliminar" aria-label={`Eliminar ${a.nombre}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {tieneAdminDelegada && (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                      <ShieldAlert size={12} /> Tiene administración delegada (Mensajes y/o Configuración)
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MODULOS.map((m) => {
                      const on = permisoActivo(a, m.id)
                      return (
                        <span
                          key={m.id}
                          className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400 line-through")}
                        >
                          {m.nombre}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">{activos.length} de {MODULOS.length} módulos habilitados</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── MODAL CREAR/EDITAR ─── */}
      {modalAbierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarModal}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>{editandoId != null ? "Editar usuario" : "Crear usuario"}</h4>
                  <p className="text-xs text-slate-500">{editandoId != null ? "Actualiza su nombre, alias y permisos." : "Cuenta de acceso con permisos por módulo."}</p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                    <input
                      type="text" value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))}
                      placeholder="Ej. Ana Torres"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Alias / rol <span className="normal-case text-slate-500">(opcional)</span></label>
                    <div className="relative">
                      <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text" value={etiquetaRol} onChange={(e) => setEtiquetaRol(e.target.value)}
                        placeholder="Ej. Secretaria, Asesor de ventas"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                  </div>
                </div>
                <p className="-mt-2.5 text-[11px] text-slate-500">Solo una etiqueta para que recuerdes para qué lo contrataste — no cambia sus permisos, esos se definen abajo.</p>

                {editandoId != null ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-600">
                    <Info size={17} className="mt-0.5 shrink-0" />
                    <p className="text-xs leading-relaxed">
                      El correo y la contraseña no se pueden cambiar desde acá una vez creada la cuenta. Correo actual: <span className="font-mono font-semibold">{correo}</span>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                          placeholder="ana.torres@correo.com"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                      <div className="relative">
                        <input
                          type={verClave ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        />
                        <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
                          {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Módulos y permisos</p>
                  {CATEGORIAS.map((categoria) => {
                    const todosActivos = categoria.modulos.every((m) => permisos[m.id])
                    const algunoActivo = categoria.modulos.some((m) => permisos[m.id])
                    return (
                      <div
                        key={categoria.id}
                        className={"rounded-xl border p-3 " + (categoria.sensible ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50")}
                      >
                        <button
                          type="button"
                          onClick={() => alternarCategoria(categoria)}
                          className="flex w-full items-center gap-2 text-left cursor-pointer"
                        >
                          {todosActivos ? (
                            <CheckSquare size={16} className={categoria.sensible ? "text-amber-600" : "text-blue-600"} />
                          ) : (
                            <Square size={16} className={algunoActivo ? "text-slate-500" : "text-slate-300"} />
                          )}
                          <span className={"text-xs font-bold uppercase tracking-wide " + (categoria.sensible ? "text-amber-700" : "text-slate-600")}>
                            {categoria.nombre}
                          </span>
                          {categoria.sensible && <ShieldAlert size={13} className="text-amber-600" />}
                        </button>
                        {categoria.sensible && (
                          <p className="mb-2 mt-1 pl-6 text-[11px] leading-relaxed text-amber-700">
                            Activar esto le da acceso de administración de la óptica (no solo de un módulo operativo) — úsalo solo si de verdad va a ayudarte a gestionar el sistema.
                          </p>
                        )}
                        <div className="mt-2 grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                          {categoria.modulos.map((m) => (
                            <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300">
                              <input
                                type="checkbox"
                                checked={Boolean(permisos[m.id])}
                                onChange={() => alternarPermiso(m.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              {m.nombre}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[11px] text-slate-500">"Inicio" siempre está disponible; el panel de administrador principal nunca lo ve un usuario delegado.</p>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" disabled={guardando} onClick={cerrarModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {guardando ? "Guardando..." : editandoId != null ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL ELIMINAR ─── */}
      {porEliminar != null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setPorEliminar(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>¿Eliminar este perfil?</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">Ya no podrá iniciar sesión con estas credenciales. Esta acción no se puede deshacer.</p>
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" disabled={eliminando} onClick={() => { setPorEliminar(null); setError("") }} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                Volver
              </button>
              <button type="button" disabled={eliminando} onClick={confirmarEliminar} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer disabled:opacity-50">
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
