"use client"

import { useState } from "react"
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  X,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Módulos que un asistente puede o no tener habilitados — mismos ids que las
// secciones del sidebar en Dashboard.jsx. Por defecto todos activos: el
// administrador decide qué le quita a cada perfil, no al revés.
const MODULOS = [
  { id: "pacientes", nombre: "Pacientes" },
  { id: "consultas", nombre: "Ficha clínica" },
  { id: "citas", nombre: "Citas médicas" },
  { id: "horario", nombre: "Mi horario" },
  { id: "inventario", nombre: "Inventario" },
  { id: "crm", nombre: "CRM y fidelización" },
  { id: "reportes", nombre: "Reportes" },
]

const permisosPorDefecto = () => MODULOS.reduce((acc, m) => ({ ...acc, [m.id]: true }), {})

export default function Usuarios({ asistentes = [], setAsistentes }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [nombre, setNombre] = useState("")
  const [usuarioCampo, setUsuarioCampo] = useState("")
  const [clave, setClave] = useState("")
  const [verClave, setVerClave] = useState(false)
  const [permisos, setPermisos] = useState(permisosPorDefecto())
  const [error, setError] = useState("")
  const [porEliminar, setPorEliminar] = useState(null)

  const abrirCrear = () => {
    setEditandoId(null)
    setNombre("")
    setUsuarioCampo("")
    setClave("")
    setVerClave(false)
    setPermisos(permisosPorDefecto())
    setError("")
    setModalAbierto(true)
  }

  const abrirEditar = (a) => {
    setEditandoId(a.id)
    setNombre(a.nombre)
    setUsuarioCampo(a.usuario)
    setClave(a.clave)
    setVerClave(false)
    setPermisos({ ...permisosPorDefecto(), ...a.permisos })
    setError("")
    setModalAbierto(true)
  }

  const cerrarModal = () => setModalAbierto(false)

  const alternarPermiso = (id) => setPermisos((prev) => ({ ...prev, [id]: !prev[id] }))

  const guardar = (e) => {
    e.preventDefault()
    if (!nombre.trim() || !usuarioCampo.trim() || !clave.trim()) {
      setError("Completa nombre, usuario y contraseña.")
      return
    }
    const usuarioNormalizado = usuarioCampo.trim().toLowerCase()
    const enUso = asistentes.some((a) => a.id !== editandoId && a.usuario.toLowerCase() === usuarioNormalizado)
    if (enUso) {
      setError("Ese usuario ya está en uso por otro perfil.")
      return
    }

    if (editandoId != null) {
      setAsistentes(asistentes.map((a) => (a.id === editandoId ? { ...a, nombre: nombre.trim(), usuario: usuarioCampo.trim(), clave, permisos } : a)))
    } else {
      setAsistentes([...asistentes, { id: Date.now(), nombre: nombre.trim(), usuario: usuarioCampo.trim(), clave, permisos }])
    }
    setModalAbierto(false)
  }

  const confirmarEliminar = () => {
    if (porEliminar == null) return
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
            <p className="text-sm text-slate-500">Crea perfiles de asistente/secretaria y define qué módulos puede ver cada uno.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <UserPlus size={18} />
          Crear asistente
        </button>
      </div>

      {/* ─── NOTA DE ALCANCE ─── */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-relaxed">
          Solo el administrador ve esta sección. Un perfil de asistente inicia sesión con el usuario y contraseña que le asignes aquí, y en su panel solo aparecen los módulos que dejes activados.
        </p>
      </div>

      {/* ─── LISTADO ─── */}
      {asistentes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300">
            <Users size={30} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-600">Aún no hay perfiles de asistente</p>
          <p className="mt-1 text-sm text-slate-500">Créalos para que tu personal contratado pueda usar el sistema sin tener acceso de administrador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {asistentes.map((a) => {
            const activos = MODULOS.filter((m) => a.permisos?.[m.id] !== false)
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
                        <p className="font-mono text-xs text-slate-500">{a.usuario}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => abrirEditar(a)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => setPorEliminar(a.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 cursor-pointer" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {MODULOS.map((m) => {
                      const on = a.permisos?.[m.id] !== false
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
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarModal}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <h4 className="text-lg font-bold" style={{ color: INK }}>{editandoId != null ? "Editar asistente" : "Crear asistente"}</h4>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
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

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                  <input
                    type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Ana Torres"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Usuario</label>
                    <input
                      type="text" value={usuarioCampo} onChange={(e) => setUsuarioCampo(e.target.value)}
                      placeholder="Ej. ana.torres"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                    <div className="relative">
                      <input
                        type={verClave ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)}
                        placeholder="Contraseña de acceso"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                      <button type="button" onClick={() => setVerClave((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
                        {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Módulos que puede ver</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MODULOS.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-300">
                        <input
                          type="checkbox"
                          checked={permisos[m.id] !== false}
                          onChange={() => alternarPermiso(m.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {m.nombre}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">"Inicio" siempre está disponible; el panel de administrador nunca lo ve un asistente.</p>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {editandoId != null ? "Guardar cambios" : "Crear perfil"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL ELIMINAR ─── */}
      {porEliminar != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPorEliminar(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>¿Eliminar este perfil?</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">Ya no podrá iniciar sesión con estas credenciales. Esta acción no se puede deshacer.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPorEliminar(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Volver
              </button>
              <button type="button" onClick={confirmarEliminar} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
