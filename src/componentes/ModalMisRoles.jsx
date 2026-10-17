"use client"

import { useMemo, useState } from "react"
import { ShieldCheck, Glasses } from "lucide-react"
import { Cascaron, PieFormulario } from "./AtencionPaciente"
import { unirPermisos, menuDePermisos, resumenPermisos } from "../utilidades/roles"
import VistaPrevia, { EtiquetaDeMuestra } from "./VistaPrevia"


// "Mis roles": el administrador principal elige con qué otros roles quiere trabajar (Optómetra, Recepción,
// Ventas…). Cada rol que se marque aparece como una "Vista" en el menú de la esquina superior. El administrador
// sigue viendo todo; los roles solo le dan sus vistas. `onGuardar(ids)` devuelve el mensaje de error o null.
export default function ModalMisRoles({ roles, elegidosIniciales, onGuardar, onCerrar }) {
  const [elegidos, setElegidos] = useState(elegidosIniciales)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }

  const alternar = (id) => setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const seleccionados = roles.filter((r) => elegidos.includes(r.id))
  const vista = useMemo(() => {
    const p = unirPermisos(seleccionados.map((r) => r.permisos))
    return { menu: menuDePermisos(p), resumen: resumenPermisos(p) }
  }, [elegidos, roles]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinCambios = elegidos.length === elegidosIniciales.length && elegidos.every((id) => elegidosIniciales.includes(id))

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    setGuardando(true)
    const mensaje = await onGuardar(elegidos)
    setGuardando(false)
    if (mensaje) setError(mensaje)
  }

  return (
    <Cascaron titulo="Mis roles" subtitulo="Cada rol que marques aparece como una vista en el menú de tu cuenta." Icono={ShieldCheck} ancho="max-w-lg" onCerrar={cerrar} formulario={{ onSubmit: guardar }}
      pie={<PieFormulario onCancelar={cerrar} etiquetaGuardar="Guardar mis roles" guardando={guardando} deshabilitado={sinCambios} />}>
      <div className="space-y-4 p-5">
      {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      <p className="text-sm text-slate-600">Sigues siendo administrador y ves todos los módulos. Los roles te dan una vista enfocada, por ejemplo la de Optómetra con tu agenda del día.</p>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Roles disponibles <span className="font-normal text-slate-500">· puedes marcar varios</span></legend>
        {roles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No hay roles creados todavía. Créalos en la pestaña Roles.</p>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => {
              const marcado = elegidos.includes(r.id)
              return (
                <label key={r.id} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200")}>
                  <input type="checkbox" checked={marcado} onChange={() => alternar(r.id)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                  <span className="min-w-0 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                      {r.nombre}
                      {r.es_predefinido && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">Predefinido</span>}
                      {r.atiende_pacientes && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                    </span>
                    {r.descripcion && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{r.descripcion}</span>}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </fieldset>
      {seleccionados.length > 0 && (
        <VistaPrevia nombre="Vista previa de lo que verás" leyenda="Lo que verás con esos roles">
          <div className="flex flex-wrap gap-1.5">
            <EtiquetaDeMuestra>Inicio</EtiquetaDeMuestra>
            {vista.menu.map((m) => <EtiquetaDeMuestra key={m}>{m}</EtiquetaDeMuestra>)}
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">{vista.resumen.map((r) => <li key={r.modulo}><span className="font-semibold">{r.modulo}:</span> {r.texto}</li>)}</ul>
        </VistaPrevia>
      )}
      </div>
    </Cascaron>
  )
}
