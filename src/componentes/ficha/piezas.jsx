"use client"

import { AlertCircle } from "lucide-react"
import { INK } from "@/lib/tema"
import { filtrarNumeroDecimalConSigno, filtrarSoloNumeros } from "../../utilidades/validaciones"

// Piezas pequeñas de la ficha clínica. Cada campo tiene el tamaño de lo que se escribe: un número cabe en 4–5 rem, una lista en lo que ocupa su texto más largo y solo los textos largos usan el ancho del formulario.
export const CLASE_INPUT = "rounded-lg border bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 "
const borde = (error) => (error ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")

export function Tarjeta({ titulo, icono: Icono, derecha, ayuda, children, resaltada = false, className = "", ...resto }) {
  return (
    <section {...resto} className={"rounded-2xl border p-4 shadow-sm " + (resaltada ? "border-blue-300 bg-blue-50/60 " : "border-slate-200/70 bg-white ") + className}>
      {(titulo || derecha) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>{Icono && <Icono size={16} className="text-blue-600" aria-hidden="true" />}{titulo}</h3>
          {derecha}
        </div>
      )}
      {ayuda && <p className="-mt-2 mb-3 text-xs text-slate-500">{ayuda}</p>}
      {children}
    </section>
  )
}

export const Etiqueta = ({ tono = "gris", children }) => (
  <span className={"rounded-full border px-2 py-0.5 text-xs font-bold " + ({ gris: "border-slate-200 bg-slate-50 text-slate-600", rojo: "border-red-200 bg-red-50 text-red-700", verde: "border-emerald-200 bg-emerald-50 text-emerald-700", azul: "border-blue-200 bg-blue-50 text-blue-700" }[tono])}>{children}</span>
)

export const Obligatorio = () => <Etiqueta tono="rojo">Obligatorio</Etiqueta>

export function Campo({ id, etiqueta, error, children, className = "" }) {
  return (
    <div className={className}>
      {etiqueta && <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-500">{etiqueta}</label>}
      {children}
      {error && <p role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-red-600"><AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
    </div>
  )
}

// Un número corto (esfera, cilindro, eje, mm…): ancho fijo, centrado.
export function Numero({ id, etiqueta, valor, onCambiar, error, tipo = "decimal", maxLength, placeholder, ancho = "w-[4.5rem]", "aria-label": ariaLabel }) {
  const cambiar = (e) => onCambiar(tipo === "entero" ? filtrarSoloNumeros(e.target.value, maxLength) : tipo === "libre" ? e.target.value : filtrarNumeroDecimalConSigno(e.target.value))
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} className="shrink-0">
      <input id={id} type="text" inputMode={tipo === "entero" ? "numeric" : "decimal"} value={valor} onChange={cambiar} placeholder={placeholder} aria-label={ariaLabel} aria-invalid={Boolean(error)}
        className={CLASE_INPUT + ancho + " px-1.5 text-center font-mono font-semibold placeholder:font-normal placeholder:text-slate-300 " + borde(error)} />
    </Campo>
  )
}

export function Texto({ id, etiqueta, valor, onCambiar, error, placeholder, ancho = "w-full max-w-md", maxLength, ...resto }) {
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} className={ancho}>
      <input id={id} type="text" value={valor} onChange={(e) => onCambiar(e.target.value)} placeholder={placeholder} maxLength={maxLength} aria-invalid={Boolean(error)} className={CLASE_INPUT + "w-full " + borde(error)} {...resto} />
    </Campo>
  )
}

export function AreaTexto({ id, etiqueta, valor, onCambiar, error, placeholder, filas = 2, ancho = "w-full max-w-xl", readOnly }) {
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} className={ancho}>
      <textarea id={id} rows={filas} value={valor} readOnly={readOnly} onChange={(e) => onCambiar(e.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} className={CLASE_INPUT + "w-full resize-y " + borde(error)} />
    </Campo>
  )
}

// Lista desplegable: el ancho lo da quien la usa (la lista de agudeza es corta; la de tipos de cover test, más larga).
export function Lista({ id, etiqueta, valor, onCambiar, opciones, vacio = "Elegir…", ancho = "w-44", error, "aria-label": ariaLabel }) {
  return (
    <Campo id={id} etiqueta={etiqueta} error={error} className={"shrink-0 " + ancho}>
      <select id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} aria-label={ariaLabel} aria-invalid={Boolean(error)} className={CLASE_INPUT + "w-full font-medium " + borde(error)}>
        <option value="">{vacio}</option>
        {opciones.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{t}</option> })}
      </select>
    </Campo>
  )
}

// Opciones para marcar. `ninguno`: opción exclusiva («Ninguno», «Ninguna conocida»): al marcarla se desmarca lo demás y al marcar otra se quita.
export function Chips({ opciones, valor, onCambiar, ninguno, etiqueta }) {
  const alternar = (o) => {
    if (o === ninguno) { onCambiar(valor.includes(o) ? [] : [o]); return }
    const sin = valor.filter((v) => v !== ninguno)
    onCambiar(sin.includes(o) ? sin.filter((v) => v !== o) : [...sin, o])
  }
  const todas = ninguno ? [ninguno, ...opciones] : opciones
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {todas.map((o) => {
        const on = valor.includes(o)
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => alternar(o)}
            className={"rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (on ? "border-blue-500 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-blue-300")}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

// Dos ojos lado a lado: el ojo izquierdo a la IZQUIERDA y el derecho a la DERECHA (como se sientan frente al paciente), en todas las tarjetas.
export function OjosLadoALado({ izquierdo, derecho, className = "" }) {
  return <div className={"grid grid-cols-2 gap-3 " + className}>{izquierdo}{derecho}</div>
}

export function CuadroOjo({ lado, children, noEvaluado }) {
  const od = lado === "od"
  return (
    <div role="group" aria-label={od ? "Ojo derecho" : "Ojo izquierdo"} className={"min-w-0 rounded-xl border bg-slate-50/60 p-3 " + (noEvaluado ? "border-slate-200 opacity-80" : "border-slate-200/80")}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: od ? "#2563EB" : "#0891b2" }}>
        <span className="grid h-5 w-6 place-items-center rounded font-mono text-xs text-white" style={{ backgroundColor: od ? "#2563EB" : "#06b6d4" }}>{od ? "OD" : "OI"}</span>
        {od ? "Ojo derecho" : "Ojo izquierdo"}
      </p>
      {children}
    </div>
  )
}

export function BotonTexto({ children, onClick, icono: Icono, disabled }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">{Icono && <Icono size={13} aria-hidden="true" />}{children}</button>
}
