"use client"

import { useMemo, useState } from "react"
import { Stethoscope, ClipboardList, GitCompare } from "lucide-react"
import { INK } from "@/lib/tema"
import SelectorLista from "../SelectorLista"
import { Cascaron, DetalleAtencion, ModalAtencion } from "../AtencionPaciente"
import EvolucionAgudeza from "./EvolucionAgudeza"
import { GraduacionVigente, VentanaHistoriaOjo } from "./Graduacion"
import { TarjetasDiagnostico, RefraccionPerfil } from "./DiagnosticoCompacto"
import { edadEnAnios } from "../../utilidades/edad"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { recetasDe } from "../../utilidades/graduacion"
import { textoDiagnostico } from "../../utilidades/pasesVenta"
import { imprimirHojaReceta } from "../../utilidades/imprimirHojaReceta"
import { datosOpticaReceta } from "../../utilidades/datosReceta"
import { compararDiagnosticos, rotuloDeConsulta, tieneRefraccion } from "../../utilidades/diagnosticoPaciente"

// La pestaña «Diagnóstico» del perfil del paciente (antes «Graduación», reunión del 20 oct., PER-9): TODO el diagnóstico de la consulta elegida —motivo, agudeza visual, la refracción si la hay
// (con los ojos ilustrados), la salud ocular si la hay, el diagnóstico y las indicaciones— con el selector de consulta arriba. Un interruptor de dos opciones cambia entre la vista técnica y la
// vista para el paciente (palabras simples, la misma del portal). «Comparar diagnósticos» pone dos consultas lado a lado; «Imprimir diagnóstico» saca la hoja de la óptica con todo el diagnóstico
// (con la receta dentro si hubo refracción). Una consulta sin refracción muestra su diagnóstico igual, sin huecos.
const BOTON = "inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 cursor-pointer"
const viñetas = (t = "") => t.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((x) => x.trim()).filter(Boolean)

export default function DiagnosticoPerfil({ consultas = [], citas = [], paciente, usuario, parametrizacion, adjuntosDe }) {
  const [id, setId] = useState(null)
  const [vista, setVista] = useState("tecnica") // "tecnica" | "paciente"
  const [comparando, setComparando] = useState(false)
  const [verAtencion, setVerAtencion] = useState(false) // «Ver la atención completa»
  const [verEvolucion, setVerEvolucion] = useState(false) // «Ver su evolución» (la agudeza visual de cada consulta)
  const [historiaOjo, setHistoriaOjo] = useState(null) // "od" | "oi": toda la tarjeta del ojo abre su historia
  const lista = consultas // ya vienen de la más reciente a la más antigua
  const consulta = lista.find((c) => String(c.id) === String(id)) || lista[0]
  const recetas = useMemo(() => recetasDe(lista), [lista])
  if (!consulta) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><ClipboardList size={22} aria-hidden="true" /></div>
        <p className="text-base font-bold text-slate-800">Este paciente todavía no tiene un diagnóstico</p>
        <p className="max-w-md text-sm text-slate-500">Aparece aquí cuando se guarda la ficha clínica de una atención.</p>
      </div>
    )
  }
  const hayRefraccion = tieneRefraccion(consulta)
  const idxReceta = recetas.findIndex((r) => r.id === consulta.id)
  const anterior = hayRefraccion ? recetas[idxReceta + 1] || null : null
  const simple = vista === "paciente"
  const imprimir = () => imprimirHojaReceta({
    optica: datosOpticaReceta(usuario, parametrizacion),
    paciente: { nombre: paciente?.nombre, cedula: paciente?.cedula, edad: edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento) },
    receta: consulta,
    completo: true,
  })
  const indicaciones = viñetas(consulta.indicaciones)

  return (
    <div className="@container space-y-4">
      {/* Una sola fila compacta, en su tarjeta: título, selector de consulta, interruptor de vista y las dos acciones. El selector es lo que se encoge; en pantalla angosta la fila pasa a dos líneas. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/60 bg-white px-5 py-3 shadow-sm">
        <h1 className="shrink-0 whitespace-nowrap text-base font-bold" style={{ color: INK }}>Diagnóstico</h1>
        <div className="min-w-[8rem] max-w-[17rem] flex-1">
          <SelectorLista id="diagnostico-consulta" etiqueta="Consulta" valor={String(consulta.id)} onChange={setId} options={lista.map((c, i) => ({ id: String(c.id), etiqueta: rotuloDeConsulta(c, i === 0) }))} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Cómo ver el diagnóstico" className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5">
            {[["tecnica", "Vista técnica"], ["paciente", "Para el paciente"]].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={vista === k} onClick={() => setVista(k)} className={"min-h-9 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors cursor-pointer " + (vista === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{t}</button>
            ))}
          </div>
          {lista.length > 1 && <button type="button" onClick={() => setComparando(true)} className={BOTON}>Comparar</button>}
          <button type="button" onClick={imprimir} className="inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Imprimir diagnóstico</button>
        </div>
      </div>

      {simple ? (
        <div className="space-y-5">
          <section aria-label="Tu diagnóstico" className="rounded-2xl border border-slate-200/60 bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500"><Stethoscope size={14} aria-hidden="true" /> Lo que encontró tu optómetra</p>
            <p className="mt-1 text-xl font-bold" style={{ color: INK }}>{textoDiagnostico(consulta) || "Sin diagnóstico registrado"}</p>
            {consulta.motivo && <p className="mt-1 text-sm text-slate-600">Viniste por: {consulta.motivo}</p>}
          </section>
          {hayRefraccion && <GraduacionVigente receta={consulta} anterior={anterior} version="paciente" onOjo={setHistoriaOjo} />}
          {indicaciones.length > 0 && (
            <section aria-label="Lo que te indicó tu optómetra" className="rounded-2xl border border-slate-200/60 bg-white p-5">
              <h3 className="text-base font-bold" style={{ color: INK }}>Lo que te indicó tu optómetra</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-slate-500">{indicaciones.map((i) => <li key={i}>{i}</li>)}</ul>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <TarjetasDiagnostico consulta={consulta} onAtencion={() => setVerAtencion(true)} onEvolucion={() => setVerEvolucion(true)} />
          {hayRefraccion && <RefraccionPerfil receta={consulta} anterior={anterior} onOjo={setHistoriaOjo} />}
          {/* El examen y la salud ocular, solo si se registraron. */}
          <div className="hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm has-[section]:block"><DetalleAtencion consulta={consulta} secciones={["examen"]} /></div>
        </div>
      )}
      {verAtencion && <ModalAtencion cita={citas.find((c) => c.id === consulta.citaId) || null} consulta={consulta} paciente={paciente} usuario={usuario} parametrizacion={parametrizacion} adjuntos={adjuntosDe?.(consulta)} onCerrar={() => setVerAtencion(false)} />}
      {verEvolucion && <EvolucionAgudeza consultas={lista} actualId={consulta.id} onCerrar={() => setVerEvolucion(false)} />}
      {historiaOjo && <VentanaHistoriaOjo recetas={recetas} lado={historiaOjo} version={simple ? "paciente" : "personal"} actualId={consulta.id} onElegir={(rid) => { setId(String(rid)); setHistoriaOjo(null) }} onCerrar={() => setHistoriaOjo(null)} onLado={simple ? undefined : setHistoriaOjo} />}
      {comparando && <VentanaCompararDiagnosticos consultas={lista} idInicial={String(consulta.id)} onCerrar={() => setComparando(false)} />}
    </div>
  )
}

// «Comparar diagnósticos»: dos consultas lado a lado; lo que cambió entre ellas va marcado.
function VentanaCompararDiagnosticos({ consultas, idInicial, onCerrar }) {
  const [idB, setIdB] = useState(idInicial)
  const otra = consultas.find((c) => String(c.id) !== idInicial)
  const [idA, setIdA] = useState(String(otra?.id ?? idInicial))
  const a = consultas.find((c) => String(c.id) === idA)
  const b = consultas.find((c) => String(c.id) === idB)
  const filas = useMemo(() => compararDiagnosticos(a, b), [a, b])
  const opciones = consultas.map((c, i) => ({ id: String(c.id), etiqueta: rotuloDeConsulta(c, i === 0) }))
  return (
    <Cascaron titulo="Comparar diagnósticos" subtitulo="Elige dos consultas y mira qué cambió." Icono={GitCompare} ancho="max-w-4xl" onCerrar={onCerrar} capa="z-[60]"
      pie={<><span className="text-xs text-slate-500">Lo que cambió entre las dos va con fondo amarillo.</span><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
      <div className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-2">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Antes</p><SelectorLista id="comparar-a" etiqueta="Diagnóstico anterior" valor={idA} onChange={setIdA} options={opciones} /></div>
        <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Después</p><SelectorLista id="comparar-b" etiqueta="Diagnóstico posterior" valor={idB} onChange={setIdB} options={opciones} /></div>
      </div>
      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="w-40 px-2 py-1.5" /><th className="px-2 py-1.5">{a ? formatoFecha(a.fecha, "medio") : "—"}</th><th className="px-2 py-1.5">{b ? formatoFecha(b.fecha, "medio") : "—"}</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-slate-100 align-top">
                <th scope="row" className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{f.titulo}</th>
                <td className={"px-2 py-2 text-slate-700 " + (f.cambio ? "bg-amber-50" : "")}>{f.a}</td>
                <td className={"px-2 py-2 text-slate-700 " + (f.cambio ? "bg-amber-50" : "")}>{f.b}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={3} className="px-2 py-6 text-center text-slate-500">Estas consultas no tienen datos para comparar.</td></tr>}
          </tbody>
        </table>
      </div>
    </Cascaron>
  )
}
