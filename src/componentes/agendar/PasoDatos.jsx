import { HeartPulse, ArrowLeft, X } from "lucide-react"
import CampoFecha from "../CampoFecha"
import PermisosAlRegistrar from "../PermisosAlRegistrar"
import { filtrarSoloLetras, filtrarSoloNumeros } from "../../utilidades/validaciones"
import { erroresDatos } from "../../utilidades/validacionDatosAgendar"
import { INK } from "@/lib/tema"

const SINTOMAS = ["Dolor", "Enrojecimiento", "Visión borrosa", "Picazón o ardor", "Secreción", "Sensibilidad a la luz", "Golpe o trauma"]
const ENTRADA = "min-h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"

function Campo({ id, etiqueta, requerido = false, opcional = false, error = "", ayuda = "", children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold" style={{ color: INK }}>
        {etiqueta}
        {requerido && <span className="ml-1 text-red-700" aria-hidden="true">*</span>}
        {opcional && <span className="ml-1.5 text-sm font-normal text-slate-600">(opcional)</span>}
      </label>
      {children}
      {error ? <p id={id + "-error"} role="alert" className="mt-1.5 text-sm font-medium text-red-800">{error}</p> : ayuda ? <p className="mt-1.5 text-sm text-slate-600">{ayuda}</p> : null}
    </div>
  )
}

// Paso 2 «Tus datos»: solo nombres, apellidos, documento y teléfono son obligatorios. Correo, fecha de nacimiento, los mensajes que quiere recibir y «contar una molestia»
// van plegados en «Más datos (opcional)». «Cambiar fecha u hora» vuelve al paso 1 sin perder lo escrito.
export default function PasoDatos({ datos, cambiar, esPasaporte, onPasaporte, intento, conMolestia, onMolestia, alternarSintoma, onConfirmar, onCambiarHora, enviando, errorReserva, marca }) {
  const err = erroresDatos(datos, esPasaporte, intento)
  const borde = (hay) => (hay ? "border-red-600" : "border-slate-300")
  return (
    <div className="ac-step space-y-5">
      <p className="text-base text-slate-600">Solo te pedimos lo necesario. Los campos con <span className="text-red-700">*</span> son obligatorios.</p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo id="agendar-nombres" etiqueta="Nombres" requerido error={err.nombres}>
          <input id="agendar-nombres" autoComplete="given-name" placeholder="Ej. Diego Andrés" value={datos.nombres} aria-invalid={Boolean(err.nombres) || undefined}
            onChange={(e) => cambiar({ nombres: filtrarSoloLetras(e.target.value) })} className={ENTRADA + " " + borde(err.nombres)} />
        </Campo>
        <Campo id="agendar-apellidos" etiqueta="Apellidos" requerido error={err.apellidos}>
          <input id="agendar-apellidos" autoComplete="family-name" placeholder="Ej. Zambrano Loor" value={datos.apellidos} aria-invalid={Boolean(err.apellidos) || undefined}
            onChange={(e) => cambiar({ apellidos: filtrarSoloLetras(e.target.value) })} className={ENTRADA + " " + borde(err.apellidos)} />
        </Campo>

        <div className="min-w-0">
          <Campo id="agendar-documento" etiqueta={esPasaporte ? "Pasaporte" : "Cédula"} requerido error={err.documento}>
            {esPasaporte ? (
              <input id="agendar-documento" placeholder="Ej. AB123456" maxLength={20} autoCapitalize="characters" value={datos.cedula} aria-invalid={Boolean(err.documento) || undefined}
                onChange={(e) => cambiar({ cedula: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} className={ENTRADA + " " + borde(err.documento)} />
            ) : (
              <input id="agendar-documento" type="tel" inputMode="numeric" placeholder="Ej. 1234567890" maxLength={10} value={datos.cedula} aria-invalid={Boolean(err.documento) || undefined}
                onChange={(e) => cambiar({ cedula: filtrarSoloNumeros(e.target.value, 10) })} className={ENTRADA + " " + borde(err.documento)} />
            )}
          </Campo>
          <button type="button" onClick={() => { onPasaporte(!esPasaporte); cambiar({ cedula: "" }) }}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-blue-700 underline-offset-2 hover:underline">
            {esPasaporte ? "Tengo cédula ecuatoriana · usar cédula" : "Soy extranjero · usar pasaporte"}
          </button>
        </div>

        <Campo id="agendar-telefono" etiqueta="Teléfono / WhatsApp" requerido error={err.telefono} ayuda="Para recordarte la cita.">
          <input id="agendar-telefono" type="tel" inputMode="numeric" autoComplete="tel" placeholder="Ej. 0991234567" maxLength={10} value={datos.telefono} aria-invalid={Boolean(err.telefono) || undefined}
            onChange={(e) => cambiar({ telefono: filtrarSoloNumeros(e.target.value, 10) })} className={ENTRADA + " " + borde(err.telefono)} />
        </Campo>
      </div>

      <details className="group rounded-xl border border-slate-300 bg-white" open={Boolean(datos.correo || datos.fechaNacimiento || conMolestia) || undefined}>
        <summary className="flex min-h-12 cursor-pointer items-center px-4 py-2 text-base font-bold" style={{ color: INK }}>
          <span>Más datos <span className="font-normal text-slate-600">(opcional: correo, fecha de nacimiento, mensajes que quieres recibir)</span></span>
        </summary>
        <div className="space-y-5 border-t border-slate-200 p-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Campo id="agendar-correo" etiqueta="Correo" opcional error={err.correo} ayuda="Si lo dejas, también te llega el recordatorio por correo.">
              <input id="agendar-correo" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={datos.correo}
                onChange={(e) => cambiar({ correo: e.target.value })} className={ENTRADA + " border-slate-300"} />
            </Campo>
            <Campo id="agendar-nacimiento" etiqueta="Fecha de nacimiento" opcional>
              <CampoFecha id="agendar-nacimiento" etiqueta="Fecha de nacimiento" valor={datos.fechaNacimiento} onCambiar={(v) => cambiar({ fechaNacimiento: v })} placeholder="Elige tu fecha" grande flotante />
              {datos.fechaNacimiento && (
                <button type="button" onClick={() => cambiar({ fechaNacimiento: "" })} className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  <X size={14} aria-hidden="true" /> Quitar la fecha
                </button>
              )}
            </Campo>
          </div>

          <PermisosAlRegistrar persona="yo" idBase="reserva-permisos" recordatorios={datos.aceptaRecordatorios} promociones={datos.aceptaPromociones}
            onCambiar={(c) => cambiar({ ...(c.recordatorios !== undefined ? { aceptaRecordatorios: c.recordatorios } : {}), ...(c.promociones !== undefined ? { aceptaPromociones: c.promociones } : {}) })} />

          <div>
            <button type="button" onClick={onMolestia} aria-expanded={conMolestia}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800">
              <HeartPulse size={16} aria-hidden="true" /> {conMolestia ? "No tengo ninguna molestia que contar" : "¿Tienes alguna molestia? Cuéntasela al optómetra (opcional)"}
            </button>

            {conMolestia && (
              <div className="ac-step mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-base font-bold" style={{ color: INK }}>Cuéntanos un poco más</h4>
                <p className="text-sm text-slate-600">Esto le llega al optómetra antes de tu cita para revisarlo con más contexto — es opcional.</p>

                <p className="mb-1.5 mt-3 text-sm font-semibold text-slate-700">¿Qué síntomas tienes?</p>
                <div className="flex flex-wrap gap-2">
                  {SINTOMAS.map((sintoma) => {
                    const activo = datos.triage.sintomas.includes(sintoma)
                    return (
                      <button key={sintoma} type="button" aria-pressed={activo} onClick={() => alternarSintoma(sintoma)}
                        className={"min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400")}>
                        {sintoma}
                      </button>
                    )
                  })}
                </div>

                <p className="mb-1.5 mt-4 text-sm font-semibold text-slate-700">¿Desde cuándo?</p>
                <div className="flex flex-wrap gap-2">
                  {["Hoy", "Hace unos días", "Hace más de una semana"].map((op) => (
                    <button key={op} type="button" aria-pressed={datos.triage.desdeCuando === op} onClick={() => cambiar({ triage: { ...datos.triage, desdeCuando: op } })}
                      className={"min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer " + (datos.triage.desdeCuando === op ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400")}>
                      {op}
                    </button>
                  ))}
                </div>

                <textarea rows={2} value={datos.triage.detalle} aria-label="Algo más que quieras contarnos"
                  onChange={(e) => cambiar({ triage: { ...datos.triage, detalle: e.target.value } })}
                  placeholder="Algo más que quieras contarnos (opcional)"
                  className="mt-3 w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-800 outline-none transition-colors focus-visible:border-blue-500" />
              </div>
            )}
          </div>
        </div>
      </details>

      {errorReserva && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-base font-medium text-red-800">{errorReserva}</p>}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onCambiarHora} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start px-1 text-base font-semibold transition-colors hover:underline" style={{ color: marca.color }}>
          <ArrowLeft size={18} aria-hidden="true" /> Cambiar fecha u hora
        </button>
        <button type="button" onClick={onConfirmar} disabled={enviando}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-7 text-base font-bold text-white transition-colors hover:brightness-110 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          style={{ background: marca.fondo, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
          {enviando ? "Guardando…" : "Confirmar mi cita"}
        </button>
      </div>
    </div>
  )
}
