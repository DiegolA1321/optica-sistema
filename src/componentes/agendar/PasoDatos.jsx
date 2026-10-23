import { HeartPulse, ChevronRight, X } from "lucide-react"
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

// Paso 1 «Tus datos»: nombre, documento, fecha de nacimiento (opcional), teléfono, correo (opcional) y el motivo de la visita.
export default function PasoDatos({ datos, cambiar, esPasaporte, onPasaporte, intento, motivos, conMolestia, onMolestia, alternarSintoma, onContinuar, marca }) {
  const err = erroresDatos(datos, esPasaporte, intento)
  const borde = (hay) => (hay ? "border-red-600" : "border-slate-300")
  return (
    <div className="ac-step space-y-5">
      <p className="text-base text-slate-600">Los campos con <span className="text-red-700">*</span> son obligatorios.</p>

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

        <Campo id="agendar-nacimiento" etiqueta="Fecha de nacimiento" opcional>
          <CampoFecha id="agendar-nacimiento" etiqueta="Fecha de nacimiento" valor={datos.fechaNacimiento} onCambiar={(v) => cambiar({ fechaNacimiento: v })} placeholder="Elige tu fecha" grande flotante />
          {datos.fechaNacimiento && (
            <button type="button" onClick={() => cambiar({ fechaNacimiento: "" })} className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
              <X size={14} aria-hidden="true" /> Quitar la fecha
            </button>
          )}
        </Campo>

        <Campo id="agendar-telefono" etiqueta="Teléfono / WhatsApp" requerido error={err.telefono} ayuda="Para recordarte la cita.">
          <input id="agendar-telefono" type="tel" inputMode="numeric" autoComplete="tel" placeholder="Ej. 0991234567" maxLength={10} value={datos.telefono} aria-invalid={Boolean(err.telefono) || undefined}
            onChange={(e) => cambiar({ telefono: filtrarSoloNumeros(e.target.value, 10) })} className={ENTRADA + " " + borde(err.telefono)} />
        </Campo>
        <Campo id="agendar-correo" etiqueta="Correo" opcional error={err.correo} ayuda="Si lo dejas, también te llega el recordatorio por correo.">
          <input id="agendar-correo" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={datos.correo}
            onChange={(e) => cambiar({ correo: e.target.value })} className={ENTRADA + " border-slate-300"} />
        </Campo>
      </div>

      <PermisosAlRegistrar persona="yo" idBase="reserva-permisos" recordatorios={datos.aceptaRecordatorios} promociones={datos.aceptaPromociones}
        onCambiar={(c) => cambiar({ ...(c.recordatorios !== undefined ? { aceptaRecordatorios: c.recordatorios } : {}), ...(c.promociones !== undefined ? { aceptaPromociones: c.promociones } : {}) })} />

      <div>
        <p className="mb-2 text-base font-semibold" style={{ color: INK }} id="agendar-motivo-titulo">¿Qué necesitas? <span className="text-red-700" aria-hidden="true">*</span></p>
        <div role="group" aria-labelledby="agendar-motivo-titulo" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {motivos.map((m) => {
            const sel = datos.motivo === m.titulo
            return (
              <button key={m.id} type="button" aria-pressed={sel} onClick={() => cambiar({ motivo: m.titulo, motivoElegido: true })}
                className={"flex min-h-20 flex-col rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " + (sel ? "border-blue-600 bg-blue-50/70" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50")}
                style={sel ? { borderColor: marca.color, boxShadow: `0 0 0 1px ${marca.color}` } : undefined}>
                <span className="text-base font-bold leading-snug" style={{ color: INK }}>{m.titulo}</span>
                {m.descripcion && <span className="mt-0.5 text-sm leading-snug text-slate-600">{m.descripcion}</span>}
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onMolestia} aria-expanded={conMolestia}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800">
          <HeartPulse size={16} aria-hidden="true" /> {conMolestia ? "No tengo ninguna molestia que contar" : "¿Tienes alguna molestia? Cuéntasela al optómetra (opcional)"}
        </button>

        {conMolestia && (
          <div className="ac-step mt-2 rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-base font-bold" style={{ color: INK }}>Cuéntanos un poco más</h4>
            <p className="text-sm text-slate-600">Esto le llega al optómetra antes de tu cita para revisarlo con más contexto — es opcional.</p>

            <p className="mb-1.5 mt-3 text-sm font-semibold text-slate-700">¿Qué síntomas tienes?</p>
            <div className="flex flex-wrap gap-2">
              {SINTOMAS.map((s) => {
                const activo = datos.triage.sintomas.includes(s)
                return (
                  <button key={s} type="button" aria-pressed={activo} onClick={() => alternarSintoma(s)}
                    className={"min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400")}>
                    {s}
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

      <div className="flex justify-end pt-1">
        <button type="button" onClick={onContinuar}
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-7 text-base font-bold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          style={{ background: marca.fondo, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
          Continuar <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
