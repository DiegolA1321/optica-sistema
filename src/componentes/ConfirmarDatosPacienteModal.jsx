import CampoFecha from "./CampoFecha"
"use client"

import { useState } from "react"
import { UserCheck, IdCard, Phone, Mail, Cake, ChevronRight } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { filtrarSoloLetras, filtrarSoloNumeros } from "../utilidades/validaciones"
import { validarDatosPaciente } from "../utilidades/pacientes"
import { MENSAJE_SIN_PERMISO, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { Cascaron } from "./AtencionPaciente"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// D2 (reunión 29 sept.): un paciente que se registró solo al agendar por la
// web (origen='paciente', migración 0067) todavía no fue revisado por
// recepción — antes de dejarlo entrar a la ficha clínica, recepción confirma
// o corrige sus datos una vez, y se marca confirmado_recepcion (migración
// 0077). Un solo componente para este paso: antes vivía duplicado a mano en
// Citas.jsx ("Atender") y hubiera repetido lo mismo en Pacientes.jsx (elegir
// cita desde el perfil) — ahora ambos lo reutilizan.
// `soloConfirmar`: se abre desde el Inicio, sin ir a la ficha clínica después.
export default function ConfirmarDatosPacienteModal({ usuario, paciente, pacientes, setPacientes, onConfirmado, onCerrar, soloConfirmar = false }) {
  const opticaId = usuario?.opticaId
  const [nombre, setNombre] = useState(paciente.nombre || "")
  const [cedula, setCedula] = useState(paciente.cedula || "")
  const [telefono, setTelefono] = useState(paciente.telefono || "")
  const [correo, setCorreo] = useState(paciente.correo || "")
  const [fechaNacimiento, setFechaNacimiento] = useState(paciente.fecha_nacimiento || "")
  const [errores, setErrores] = useState({})
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)

  const confirmar = async (e) => {
    e.preventDefault()
    const errs = validarDatosPaciente(pacientes, { nombre, cedula, telefono, correo }, paciente.id)
    setErrores(errs)
    if (Object.keys(errs).length > 0) return

    setGuardando(true)
    setError("")
    const cambios = { nombre, cedula, telefono, correo, fecha_nacimiento: fechaNacimiento || null, confirmado_recepcion: true }
    if (supabase && opticaId) {
      const { data: actualizado, error: errorConfirmar } = await supabase.from("pacientes").update(cambios).eq("id", paciente.id).select()
      if (fueBloqueadoPorPermiso({ error: errorConfirmar, data: actualizado })) {
        setGuardando(false)
        setError(MENSAJE_SIN_PERMISO)
        return
      }
      if (errorConfirmar) {
        setGuardando(false)
        setError("No se pudieron confirmar los datos del paciente. Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    const pacienteConfirmado = { ...paciente, nombre, cedula, telefono, correo, fecha_nacimiento: fechaNacimiento || null, confirmadoRecepcion: true }
    setPacientes?.(pacientes.map((p) => (p.id === paciente.id ? pacienteConfirmado : p)))
    setGuardando(false)
    onConfirmado(pacienteConfirmado)
  }

  return (
    <Cascaron
      titulo="Confirmar datos del paciente"
      subtitulo={"Se registró por la web y todavía no pasó por recepción — revisa o corrige sus datos" + (soloConfirmar ? "." : " antes de abrir la ficha clínica.")}
      Icono={UserCheck}
      ancho="max-w-md"
      capa="z-[70]"
      onCerrar={() => !guardando && onCerrar()}
      formulario={{ onSubmit: confirmar }}
      pie={<>
        <span />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={guardando} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer" style={{ background: GRAD }}>
            {guardando ? "Guardando…" : soloConfirmar ? "Confirmar datos" : "Confirmar y atender"}
            {!soloConfirmar && <ChevronRight size={16} />}
          </button>
        </div>
      </>}
    >
        <div className="space-y-3.5 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
            <input
              type="text" value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))}
              className={"w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (errores.nombre ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
            />
            {errores.nombre && <p className="mt-1 text-xs font-medium text-red-600">{errores.nombre}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
              <div className="relative">
                <IdCard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" inputMode="numeric" maxLength={10} value={cedula}
                  onChange={(e) => setCedula(filtrarSoloNumeros(e.target.value, 10))}
                  className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (errores.cedula ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                />
              </div>
              {errores.cedula && <p className="mt-1 text-xs font-medium text-red-600">{errores.cedula}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono</label>
              <div className="relative">
                <Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" inputMode="numeric" maxLength={10} value={telefono}
                  onChange={(e) => setTelefono(filtrarSoloNumeros(e.target.value, 10))}
                  className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (errores.telefono ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                />
              </div>
              {errores.telefono && <p className="mt-1 text-xs font-medium text-red-600">{errores.telefono}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo <span className="normal-case text-slate-500">(opcional)</span></label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
                  className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (errores.correo ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                />
              </div>
              {errores.correo && <p className="mt-1 text-xs font-medium text-red-600">{errores.correo}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nacimiento <span className="normal-case text-slate-500">(opcional)</span></label>
              <CampoFecha id="confirmar-nacimiento" valor={fechaNacimiento} onCambiar={setFechaNacimiento} icono={Cake} placeholder="Elige la fecha" />
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
        </div>
    </Cascaron>
  )
}
