"use client"

import { ArrowLeft, Save, ClipboardList } from "lucide-react"
import { INK } from "@/lib/tema"
import { PASOS } from "../../utilidades/fichaDatos"

// Las piezas de la ficha clínica en celular y tablet (por debajo de 1093 px). La ficha es la misma (mismos tres pasos, bloques, campos, validaciones y guardado del borrador):
// solo cambia cómo se acomoda. `ConsultaMedica` las usa solo en ese modo; en la computadora no se dibujan.
const TONO = { Completo: "text-emerald-700", Registrado: "text-emerald-700", Incompleto: "text-amber-700", Opcional: "text-slate-600" }
const LATERAL = "max(1rem, env(safe-area-inset-left))"
const LATERAL_DER = "max(1rem, env(safe-area-inset-right))"

// La barra de los tres pasos del celular: tres tramos que se tocan (cada uno de 44 px de alto, con la raya fina dentro) y debajo «Paso 2 de 3 · Examen · Opcional».
// El tramo actual va en azul, los completos en verde y el resto en gris. Los nombres accesibles son los mismos de la barra de la computadora.
export function BarraPasosCelular({ paso, estados, onIr }) {
  const indice = PASOS.findIndex((p) => p.id === paso)
  const actual = PASOS[indice]
  return (
    <nav aria-label="Pasos de la ficha clínica">
      <ol className="flex gap-2">
        {PASOS.map((p) => {
          const estado = estados[p.id]
          const hecho = estado === "Completo" || estado === "Registrado"
          return (
            <li key={p.id} className="min-w-0 flex-1">
              <button type="button" onClick={() => onIr(p.id)} aria-current={paso === p.id ? "step" : undefined} aria-label={`Paso ${p.n}: ${p.label}, ${estado}`} className="flex h-11 w-full cursor-pointer items-center">
                <span className={"block h-1.5 w-full rounded-full " + (paso === p.id ? "bg-blue-600" : hecho ? "bg-emerald-500" : "bg-slate-200")} />
              </button>
            </li>
          )
        })}
      </ol>
      <p className="-mt-1 pb-2 text-sm text-slate-600">Paso {indice + 1} de {PASOS.length} · {actual.label} · <span className={"font-semibold " + TONO[estados[actual.id]]}>{estados[actual.id]}</span></p>
    </nav>
  )
}

// Lo de arriba, fijo: volver (←), el paciente y el motivo, cómo va el borrador («Guardado hace 5 s») y la barra de pasos (la que se le pasa).
export function CabeceraFichaCelular({ nombre, motivo, guardado, onVolver, etiquetaVolver, children }) {
  return (
    <header data-ficha-cabecera className="shrink-0 border-b border-slate-200 bg-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: LATERAL, paddingRight: LATERAL_DER }}>
      <div className="flex min-h-[56px] items-center gap-1 py-1">
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label={etiquetaVolver} className="-ml-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-blue-600"><ArrowLeft size={22} aria-hidden="true" /></button>
        )}
        <p className="min-w-0 flex-1 truncate leading-tight"><span className="text-lg font-bold" style={{ color: INK }}>{nombre || "Ficha clínica"}</span>{motivo ? <span className="text-sm text-slate-600"> · {motivo}</span> : null}</p>
        {guardado && <span role="status" className="shrink-0 text-sm font-semibold text-emerald-700">{guardado}</span>}
      </div>
      {children}
    </header>
  )
}

// Lo de abajo, fijo: «Ver documento», «Anterior» y «Siguiente» (en el último paso, «Terminar atención»; con la atención ya terminada, «Nueva consulta»). «Terminar atención» envía el formulario (form=).
export function PieFichaCelular({ indice, total, fichaGuardada, formId, onVerDocumento, onAnterior, onSiguiente, onNueva }) {
  const ultimo = indice === total - 1
  const secundario = "flex-none cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-[15px] font-semibold text-slate-700"
  return (
    <footer data-ficha-pie className="shrink-0 border-t border-slate-200 bg-white" style={{ paddingTop: "0.5rem", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))", paddingLeft: LATERAL, paddingRight: LATERAL_DER }}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onVerDocumento} className={secundario}>Ver documento</button>
        <span className="flex-1" aria-hidden="true" />
        {indice > 0 && <button type="button" onClick={onAnterior} className={secundario}>Anterior</button>}
        {!ultimo ? (
          <button key="btn-siguiente" type="button" onClick={onSiguiente} className="flex-none cursor-pointer rounded-xl bg-blue-600 px-3.5 text-[15px] font-semibold text-white">Siguiente</button>
        ) : !fichaGuardada ? (
          // key distinta del botón «Siguiente» a propósito (ver ConsultaMedica): sin ella React reutiliza el nodo y un toque en «Siguiente» enviaría el formulario.
          <button key="btn-guardar" type="submit" form={formId} className="inline-flex flex-[1_1_11rem] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white"><Save size={16} aria-hidden="true" /> Terminar atención</button>
        ) : (
          <button key="btn-nueva-consulta" type="button" onClick={onNueva} className="inline-flex flex-[1_1_11rem] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold text-white" style={{ backgroundColor: INK }}><ClipboardList size={16} aria-hidden="true" /> Nueva consulta</button>
        )}
      </div>
    </footer>
  )
}
