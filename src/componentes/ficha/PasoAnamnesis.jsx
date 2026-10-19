"use client"

import { useRef } from "react"
import { ClipboardList, Glasses, History, ChevronDown, Stethoscope } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { SINTOMAS, ANT_MEDICOS, ANT_FAMILIARES, ALERGIAS_FRECUENTES, MEDICAMENTOS_FRECUENTES, NINGUNO, TIPOS_LENTES, componerTexto } from "../../utilidades/fichaDatos"
import { Tarjeta, Obligatorio, Etiqueta, Campo, Texto, AreaTexto, Chips, Lista, BotonTexto, CLASE_INPUT } from "./piezas"

// Paso 1 · Anamnesis: motivo, síntomas, antecedentes médicos y familiares, alergias, medicamentos y uso de lentes.
// El motivo es el del catálogo de la óptica (el de la cita; alimenta Reportes); lo que cuenta el paciente va aparte, como detalle.
export default function PasoAnamnesis({ f, set, errores, motivosConsulta, conCita, editandoMotivo, setEditandoMotivo, buscador, tieneHistorial, fechaPrecarga, antecedentesAbiertos, setAntecedentesAbiertos }) {
  const detalleRef = useRef(null)
  const motivoFijo = conCita && f.motivo && f.motivo !== "Otros" && !editandoMotivo
  const resumen = [
    ["Antecedentes médicos", componerTexto(f.antMedChips, f.antMedDetalle) || "Ninguno registrado"],
    ["Antecedentes familiares", componerTexto(f.antFamChips, f.antFamDetalle) || "Ninguno registrado"],
    ["Alergias", componerTexto(f.alergiasChips, f.alergiasDetalle) || "Ninguna registrada"],
    ["Medicamentos", componerTexto(f.medChips, f.medDetalle) || "Ninguno registrado"],
    ["Uso de lentes", f.usaLentes === "si" ? [TIPOS_LENTES.find(([v]) => v === f.tipoLentes)?.[1] || "Sí", f.usaLentesDesde && `desde ${f.usaLentesDesde}`].filter(Boolean).join(" · ") : f.usaLentes === "no" ? "No usa" : "No registrado"],
  ]
  const abierto = !tieneHistorial || antecedentesAbiertos
  return (
    <div className="space-y-3">
      {buscador}
      <Tarjeta titulo="Motivo de la consulta" icono={Stethoscope} derecha={<Obligatorio />}>
        {motivoFijo ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold" style={{ color: INK }}>{f.motivo} <span className="text-xs font-normal text-slate-400">(de la cita)</span></p>
            <BotonTexto onClick={() => setEditandoMotivo(true)}>Cambiar</BotonTexto>
          </div>
        ) : (
          <Campo id="motivo" etiqueta="Motivo" error={errores.motivo} className="w-64 max-w-full">
            <select id="motivo" value={f.motivo} onChange={(e) => { set("motivo", e.target.value); if (e.target.value === "Otros") setTimeout(() => detalleRef.current?.focus(), 30) }} aria-invalid={Boolean(errores.motivo)}
              className={CLASE_INPUT + "w-full font-medium " + (errores.motivo ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}>
              <option value="" disabled>Selecciona un motivo...</option>
              {motivosConsulta.map((m) => <option key={m} value={m}>{m}</option>)}
              <option value="Otros">Otros</option>
            </select>
          </Campo>
        )}
        <div className="mt-3">
          <Campo id="detalleConsulta" etiqueta={f.motivo === "Otros" ? "Describe el motivo *" : "Lo que cuenta el paciente (opcional)"} error={errores.detalleConsulta} className="w-full max-w-xl">
            <textarea id="detalleConsulta" ref={detalleRef} rows={2} value={f.detalleConsulta} onChange={(e) => set("detalleConsulta", e.target.value)} placeholder="Con sus palabras: desde cuándo, qué le molesta…" aria-invalid={Boolean(errores.detalleConsulta)}
              className={CLASE_INPUT + "w-full resize-y " + (errores.detalleConsulta ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
          </Campo>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Síntomas" ayuda="Marca los que refiere en esta visita.">
        <Chips etiqueta="Síntomas" opciones={SINTOMAS} valor={f.sintomas} onCambiar={(v) => set("sintomas", v)} />
        <div className="mt-3"><Texto id="sintomasOtros" etiqueta="Otros síntomas" valor={f.sintomasOtros} onCambiar={(v) => set("sintomasOtros", v)} placeholder="Escribe aquí si hay otro…" /></div>
      </Tarjeta>

      <Tarjeta titulo="Antecedentes del paciente" icono={ClipboardList}
        derecha={tieneHistorial ? <button type="button" onClick={() => setAntecedentesAbiertos(!antecedentesAbiertos)} aria-expanded={abierto} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 cursor-pointer"><History size={12} aria-hidden="true" /> Ya registrados{fechaPrecarga ? ` el ${fechaLegible(fechaPrecarga)}` : ""} · {abierto ? "ocultar" : "actualizar"}<ChevronDown size={13} className={abierto ? "" : "-rotate-90"} aria-hidden="true" /></button> : <Etiqueta tono="azul">Primera vez</Etiqueta>}>
        {!abierto ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {resumen.map(([t, v]) => <div key={t}><dt className="text-xs font-semibold text-slate-400">{t}</dt><dd className="text-slate-700">{v}</dd></div>)}
          </dl>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Médicos y oculares</p>
              <Chips etiqueta="Antecedentes médicos" ninguno={NINGUNO.med} opciones={ANT_MEDICOS} valor={f.antMedChips} onCambiar={(v) => set("antMedChips", v)} />
              <div className="mt-2"><Texto id="antMedDetalle" etiqueta="Detalle" valor={f.antMedDetalle} onCambiar={(v) => set("antMedDetalle", v)} placeholder="Ej. hipertensión controlada con losartán" /></div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Familiares</p>
              <Chips etiqueta="Antecedentes familiares" ninguno={NINGUNO.fam} opciones={ANT_FAMILIARES} valor={f.antFamChips} onCambiar={(v) => set("antFamChips", v)} />
              <div className="mt-2"><Texto id="antFamDetalle" etiqueta="Detalle" valor={f.antFamDetalle} onCambiar={(v) => set("antFamDetalle", v)} placeholder="Quién y qué (opcional)" /></div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Alergias</p>
              <Chips etiqueta="Alergias" ninguno={NINGUNO.alergias} opciones={ALERGIAS_FRECUENTES} valor={f.alergiasChips} onCambiar={(v) => set("alergiasChips", v)} />
              <div className="mt-2"><Texto id="alergiasDetalle" etiqueta="Otra alergia" valor={f.alergiasDetalle} onCambiar={(v) => set("alergiasDetalle", v)} placeholder="Escribe aquí si hay otra" /></div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">Medicamentos que toma</p>
              <Chips etiqueta="Medicamentos" ninguno={NINGUNO.medicamentos} opciones={MEDICAMENTOS_FRECUENTES} valor={f.medChips} onCambiar={(v) => set("medChips", v)} />
              <div className="mt-2"><Texto id="medDetalle" etiqueta="Cuáles" valor={f.medDetalle} onCambiar={(v) => set("medDetalle", v)} placeholder="Ej. losartán 50 mg" /></div>
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Uso de lentes" icono={Glasses}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">¿Usa o ha usado lentes?</p>
            <div role="group" aria-label="Usa lentes" className="flex gap-1.5">
              {[["si", "Sí"], ["no", "No"]].map(([v, t]) => (
                <button key={v} type="button" aria-pressed={f.usaLentes === v} onClick={() => set("usaLentes", v)}
                  className={"rounded-lg border px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (f.usaLentes === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-500 hover:border-slate-400")}>{t}</button>
              ))}
            </div>
          </div>
          {f.usaLentes === "si" && <>
            <Lista id="tipoLentes" etiqueta="Qué usa" valor={f.tipoLentes} onCambiar={(v) => set("tipoLentes", v)} opciones={TIPOS_LENTES} ancho="w-44" />
            <Texto id="usaLentesDesde" etiqueta="Desde cuándo" valor={f.usaLentesDesde} onCambiar={(v) => set("usaLentesDesde", v)} placeholder="Ej. 3 años" ancho="w-32" />
          </>}
        </div>
      </Tarjeta>
    </div>
  )
}
