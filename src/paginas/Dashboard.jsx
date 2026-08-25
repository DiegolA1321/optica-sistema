"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  Users,
  Calendar,
  Eye,
  Package,
  LayoutDashboard,
  HeartHandshake,
  LogOut,
  Menu,
  X,
  Bell,
  Cake,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CalendarClock,
  BarChart3,
  ShieldCheck,
  Settings,
} from "lucide-react"

// Módulos del sistema
import Pacientes from "./Pacientes"
import ConsultaMedica from "./ConsultaMedica"
import Inventario from "./Inventario"
import Citas from "./Citas"
import Horario from "./Horario"
import Inicio from "./Inicio"
import CRM from "./CRM"
import Reportes from "./Reportes"
import Usuarios from "./Usuarios"
import Configuracion from "./Configuracion"
import { esHoy } from "../utilidades/disponibilidad"
import { esStockBajo } from "../utilidades/inventario"

// ─── Paleta de firma ───
const INK = "#0A1420"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Orden por frecuencia de uso real (feedback del asesor, 2026-08-20): lo que
// más se usa día a día va primero, lo ocasional (horario, reportes) al final.
// soloAdmin: nunca lo ve un perfil de asistente, sin importar sus permisos.
const OPCIONES = [
  { id: "inicio", nombre: "Inicio", icono: LayoutDashboard },
  { id: "citas", nombre: "Citas médicas", icono: Calendar },
  { id: "consultas", nombre: "Ficha clínica", icono: Eye },
  { id: "pacientes", nombre: "Pacientes", icono: Users },
  { id: "inventario", nombre: "Inventario", icono: Package },
  { id: "crm", nombre: "CRM y fidelización", icono: HeartHandshake },
  { id: "horario", nombre: "Mi horario", icono: CalendarClock },
  { id: "reportes", nombre: "Reportes", icono: BarChart3 },
  { id: "usuarios", nombre: "Usuarios y permisos", icono: ShieldCheck, soloAdmin: true },
  { id: "configuracion", nombre: "Configuración", icono: Settings, soloAdmin: true },
]

// Ventana de cumpleaños (-5 a +7 días) → diferencia en días o null
const diasACumple = (fn) => {
  if (!fn) return null
  const partes = String(fn).split(/[-/T]/)
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  if (!mes || !dia) return null
  const hoy0 = new Date()
  hoy0.setHours(0, 0, 0, 0)
  const y = hoy0.getFullYear()
  let mejor = null
  for (const yr of [y - 1, y, y + 1]) {
    const c = new Date(yr, mes - 1, dia)
    c.setHours(0, 0, 0, 0)
    const d = Math.round((c - hoy0) / 86400000)
    if (d >= -5 && d <= 7 && (mejor === null || Math.abs(d) < Math.abs(mejor))) mejor = d
  }
  return mejor
}

export default function Dashboard({ usuario, pacientes = [], setPacientes, citas = [], setCitas, inventario = [], setInventario, consultas = [], setConsultas, disponibilidad, setDisponibilidad, asistentes = [], setAsistentes, parametrizacion, setParametrizacion, motivosConsulta = [], setMotivosConsulta, diagnosticosRapidos = [], setDiagnosticosRapidos, alSalir }) {
  const esAsistente = usuario?.rol === "asistente"
  const esAdmin = usuario?.rol === "admin"

  // Un asistente solo ve lo que el administrador le habilitó (default: todo
  // menos lo marcado soloAdmin). El administrador ve siempre todo.
  const opcionesVisibles = useMemo(
    () => OPCIONES.filter((o) => {
      if (o.soloAdmin) return esAdmin
      if (esAsistente) return usuario?.permisos?.[o.id] !== false
      return true
    }),
    [esAsistente, esAdmin, usuario],
  )

  // Recuerda la sección del sidebar en la que estaba — recargar la página ya no
  // manda de vuelta a Inicio si estaba, por ejemplo, en Citas médicas.
  const [seccionActiva, setSeccionActiva] = useState(() => {
    const guardada = localStorage.getItem('optica_seccion_activa')
    return opcionesVisibles.some((o) => o.id === guardada) ? guardada : "inicio"
  })
  const [accionPacienteInicio, setAccionPacienteInicio] = useState(null)
  const [abrirAgendarAlEntrar, setAbrirAgendarAlEntrar] = useState(false)
  const [fichaClinicaPacienteInicial, setFichaClinicaPacienteInicial] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(false)
  const [notifAbierta, setNotifAbierta] = useState(false)
  const [userMenuAbierto, setUserMenuAbierto] = useState(false)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifAbierta(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuAbierto(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    localStorage.setItem('optica_seccion_activa', seccionActiva)
  }, [seccionActiva])

  // Si al administrador le quita un permiso mientras el asistente está en esa
  // sección (u otra sesión abierta), no lo deja varado: lo manda a Inicio.
  useEffect(() => {
    if (!opcionesVisibles.some((o) => o.id === seccionActiva)) setSeccionActiva("inicio")
  }, [opcionesVisibles, seccionActiva])

  // Navegación unificada (mapea alias de otros módulos)
  const navegar = (vista) => {
    const mapa = { consulta: "consultas", consultas_opticas: "consultas" }
    setSeccionActiva(mapa[vista] || vista)
    setMenuAbierto(false)
    setNotifAbierta(false)
  }

  // Centro de notificaciones (alertas reales del sistema)
  const alertas = useMemo(() => {
    const arr = []
    inventario.forEach((p) => {
      if (esStockBajo(p)) arr.push({ icon: Package, color: "#d97706", bg: "#fffbeb", texto: `Stock bajo: ${p.nombre}`, sub: `${p.stock} u. disponibles`, destino: "inventario" })
    })
    const citasDeHoy = citas.filter((c) => esHoy(c.fecha))
    if (citasDeHoy.length) arr.push({ icon: Calendar, color: "#2563eb", bg: "#eff6ff", texto: `${citasDeHoy.length} cita${citasDeHoy.length > 1 ? "s" : ""} para hoy`, sub: "Revisa la agenda del día", destino: "citas" })
    pacientes.forEach((p) => {
      const d = diasACumple(p.fechaNacimiento || p.fecha_nacimiento)
      if (d !== null) {
        const t = d === 0 ? "cumple años hoy" : d > 0 ? `cumple en ${d} día${d > 1 ? "s" : ""}` : `cumplió hace ${Math.abs(d)} día${Math.abs(d) > 1 ? "s" : ""}`
        arr.push({ icon: Cake, color: "#b45309", bg: "#fef3c7", texto: `${p.nombre} ${t}`, sub: "Envíale un saludo desde el CRM", destino: "crm" })
      }
    })
    return arr
  }, [inventario, citas, pacientes])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  const hoyFecha = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const nombreUsuario = usuario?.nombre || (esAsistente ? "Asistente" : "Administrador")
  const rolUsuario = esAsistente ? "Asistente" : "Administrador"
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase()

  const renderSeccion = () => {
    switch (seccionActiva) {
      case "pacientes":
        return (
          <Pacientes
            setVista={navegar}
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            setConsultas={setConsultas}
            citas={citas}
            setCitas={setCitas}
            disponibilidad={disponibilidad}
            motivosConsulta={motivosConsulta}
            accionInicial={accionPacienteInicio}
            onAccionInicialConsumida={() => setAccionPacienteInicio(null)}
            onIrAFichaClinica={(paciente) => { setFichaClinicaPacienteInicial(paciente); navegar("consultas") }}
          />
        )
      case "consultas":
        return (
          <ConsultaMedica
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            setConsultas={setConsultas}
            inventario={inventario}
            setInventario={setInventario}
            parametrizacion={parametrizacion}
            diagnosticosRapidos={diagnosticosRapidos}
            pacienteInicial={fichaClinicaPacienteInicial}
            onPacienteInicialConsumido={() => setFichaClinicaPacienteInicial(null)}
          />
        )
      case "inventario":
        return <Inventario inventario={inventario} setInventario={setInventario} />
      case "citas":
        return (
          <Citas
            citas={citas}
            setCitas={setCitas}
            pacientes={pacientes}
            disponibilidad={disponibilidad}
            abrirModalAlEntrar={abrirAgendarAlEntrar}
            onModalAlEntrarConsumido={() => setAbrirAgendarAlEntrar(false)}
            motivosConsulta={motivosConsulta}
          />
        )
      case "horario":
        return <Horario disponibilidad={disponibilidad} setDisponibilidad={setDisponibilidad} citas={citas} />
      case "crm":
        return <CRM pacientes={pacientes} consultas={consultas} />
      case "reportes":
        return <Reportes pacientes={pacientes} consultas={consultas} citas={citas} />
      case "usuarios":
        return <Usuarios asistentes={asistentes} setAsistentes={setAsistentes} />
      case "configuracion":
        return (
          <Configuracion
            parametrizacion={parametrizacion}
            setParametrizacion={setParametrizacion}
            motivosConsulta={motivosConsulta}
            setMotivosConsulta={setMotivosConsulta}
            diagnosticosRapidos={diagnosticosRapidos}
            setDiagnosticosRapidos={setDiagnosticosRapidos}
          />
        )
      case "inicio":
        return (
          <>
            <Inicio
              setVista={navegar}
              nombreUsuario={nombreUsuario}
              pacientes={pacientes}
              citas={citas}
              inventario={inventario}
              consultas={consultas}
              onAbrirPaciente={(paciente, accion) => {
                setAccionPacienteInicio({ pacienteId: paciente.id, accion })
              }}
              onAgendarRapido={() => {
                setAbrirAgendarAlEntrar(true)
                navegar("citas")
              }}
            />
            <Pacientes
              overlaySolo
              pacientes={pacientes}
              setPacientes={setPacientes}
              consultas={consultas}
              setConsultas={setConsultas}
              citas={citas}
              setCitas={setCitas}
              disponibilidad={disponibilidad}
              motivosConsulta={motivosConsulta}
              accionInicial={accionPacienteInicio}
              onAccionInicialConsumida={() => setAccionPacienteInicio(null)}
              onIrAFichaClinica={(paciente) => { setFichaClinicaPacienteInicial(paciente); navegar("consultas") }}
            />
          </>
        )
      default:
        return (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-center">
              <p className="text-lg text-slate-500">Sección en desarrollo</p>
              <h3 className="mt-1 text-2xl font-bold uppercase text-blue-600">{seccionActiva}</h3>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: "#F7F5F0" }}>
      {/* Backdrop móvil */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden transition-all duration-300 lg:static lg:translate-x-0 " +
          (colapsado ? "lg:w-20 " : "lg:w-72 ") +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
        style={{ backgroundColor: INK }}
      >
        {/* Profundidad de marca */}
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80" viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }} />

        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className={"flex items-center justify-between border-b border-white/10 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <Eye size={22} strokeWidth={2.2} />
              </div>
              <div className={"leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="text-lg font-bold tracking-tight text-white">
                  Diego <span style={{ color: "#22D3EE" }}>Óptica</span>
                </p>
                <p className="text-[11px] font-medium tracking-wide text-white/40">PANEL DE CONTROL</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 " + (colapsado ? "lg:hidden" : "")}>Menú principal</p>
            {opcionesVisibles.map((opcion) => {
              const Icono = opcion.icono
              const activo = seccionActiva === opcion.id
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => navegar(opcion.id)}
                  title={colapsado ? opcion.nombre : undefined}
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}
                  style={activo ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.55)" } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-white/55 group-hover:text-white"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {activo && <span className={"ml-auto h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 border-t border-white/10 p-4">
          <div className={"flex items-center gap-2 px-2 text-[11px] font-medium text-white/40 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className={colapsado ? "lg:hidden" : ""}>Sistema en línea · v1.0</span>
          </div>
        </div>
      </aside>

      {/* ─── CONTENIDO ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Barra superior */}
        <header className="relative z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuAbierto(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer">
              <Menu size={22} />
            </button>
            <button type="button" onClick={() => setColapsado((v) => !v)} className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex cursor-pointer" title={colapsado ? "Expandir menú" : "Colapsar menú"}>
              {colapsado ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight" style={{ color: INK }}>
                {saludo}, {nombreUsuario}
              </p>
              <p className="truncate text-xs capitalize text-slate-500">{hoyFecha}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notificaciones */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifAbierta((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
                title="Notificaciones"
              >
                <Bell size={18} />
                {alertas.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#dc2626)" }}>
                    {alertas.length > 9 ? "9+" : alertas.length}
                  </span>
                )}
              </button>

              {notifAbierta && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold" style={{ color: INK }}>Notificaciones</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{alertas.length}</span>
                  </div>
                  {alertas.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                      <p className="text-sm font-medium text-slate-500">Todo al día. Sin alertas.</p>
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      {alertas.map((a, i) => (
                        <button key={i} type="button" onClick={() => navegar(a.destino)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: a.bg, color: a.color }}>
                            <a.icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{a.texto}</p>
                            <p className="truncate text-xs text-slate-500">{a.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Usuario */}
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserMenuAbierto((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{nombreUsuario}</p>
                  <p className="text-[10px] text-slate-500">{rolUsuario}</p>
                </div>
                <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenuAbierto ? "rotate-180" : "")} />
              </button>

              {userMenuAbierto && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" style={{ color: INK }}>{nombreUsuario}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {rolUsuario}
                      </p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={alSalir}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                    >
                      <LogOut size={17} />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Espacio de trabajo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{renderSeccion()}</div>
      </main>
    </div>
  )
}
