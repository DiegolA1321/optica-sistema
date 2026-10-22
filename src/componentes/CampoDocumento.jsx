"use client"

import { IdCard } from "lucide-react"
import { TIPOS_DOCUMENTO, filtrarDocumento } from "../utilidades/documento"

// El documento de identidad de un paciente: el tipo (cédula, pasaporte u otro documento) y el número, en una sola pieza para el alta rápida de Citas (en Pacientes el formulario completo
// lleva el mismo par). La cédula se valida con su dígito verificador; un extranjero se registra con su pasaporte u otro documento (utilidades/documento.js).
// `compacto`: el tamaño del alta rápida dentro de «Gestionar cita».
export default function CampoDocumento({ tipo, valor, onTipo, onValor, error = false, compacto = false, id }) {
  const borde = error ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50"
  return (
    <div className="flex gap-1.5">
      <select
        aria-label="Tipo de documento" value={tipo} onChange={(e) => { onTipo(e.target.value); onValor(filtrarDocumento(e.target.value, valor)) }}
        className={"shrink-0 rounded-lg border border-slate-200/60 bg-white px-1.5 font-semibold text-slate-700 outline-none cursor-pointer focus-visible:border-blue-500 " + (compacto ? "w-[5.6rem] py-2 text-xs" : "w-[7rem] py-2.5 text-sm")}
      >
        {TIPOS_DOCUMENTO.map((t) => <option key={t.id} value={t.id}>{t.id === "otro" ? "Otro" : t.etiqueta}</option>)}
      </select>
      <div className="relative min-w-0 flex-1">
        <IdCard size={compacto ? 14 : 15} className={"pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500 " + (compacto ? "left-2.5" : "left-3")} aria-hidden="true" />
        <input
          id={id} type="text" inputMode={tipo === "cedula" ? "numeric" : "text"} maxLength={tipo === "cedula" ? 10 : 20} autoComplete="off"
          placeholder={TIPOS_DOCUMENTO.find((t) => t.id === tipo)?.id === "cedula" ? "Cédula" : tipo === "pasaporte" ? "Pasaporte" : "Documento"}
          aria-label="Número del documento" value={valor} onChange={(e) => onValor(filtrarDocumento(tipo, e.target.value))}
          className={"w-full rounded-lg border bg-white pr-2 font-mono outline-none transition focus-visible:ring-2 " + borde + (compacto ? " py-2 pl-8 text-sm" : " rounded-xl py-2.5 pl-9 text-sm")}
        />
      </div>
    </div>
  )
}
