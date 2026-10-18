"use client"

import { useMemo, useState } from "react"
import { Eye, MessageSquareText } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { edadEnAnios } from "../../utilidades/edad"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { ordenarPorFechaYCreacion } from "../../utilidades/fidelizacion"
import { recetasDe } from "../../utilidades/graduacion"
import { imprimirHojaReceta } from "../../utilidades/imprimirHojaReceta"
import { GraduacionVigente, CambioGraduacion, ListaRecetas, DetalleReceta } from "./Graduacion"

// La graduación en el perfil del paciente del sistema del personal: la misma vista que el paciente ve en su portal (`Graduacion.jsx`), en la versión del personal (notación técnica: OD y OI,
// esfera, cilindro, eje, adición, agudeza visual y distancia pupilar). Arriba la graduación vigente con los ojos ilustrados, junto a la gráfica de tendencia (`tendencia`, ya existente); debajo,
// el antes → ahora y la lista de recetas con filtros por año, su detalle y «Comparar dos recetas». «Explicar al paciente» muestra la versión con palabras simples para enseñársela durante la consulta.
// Solo se dibuja para quien puede ver fichas clínicas (el perfil decide; aquí no se vuelve a preguntar).
export default function GraduacionPerfil({ consultas = [], paciente, usuario, tendencia = null }) {
  const recetas = useMemo(() => recetasDe([...consultas].sort(ordenarPorFechaYCreacion)), [consultas])
  const [verId, setVerId] = useState(null)
  const [explicando, setExplicando] = useState(false)
  if (recetas.length === 0) return null
  const vigente = recetas[0]
  const receta = recetas.find((r) => String(r.id) === String(verId))
  const imprimir = (r) => imprimirHojaReceta({
    optica: { nombre: usuario?.opticaNombre, direccion: usuario?.opticaMarca?.direccion, telefono: usuario?.opticaMarca?.telefono, correo: usuario?.opticaMarca?.correo, logoUrl: usuario?.opticaLogoUrl },
    paciente: { nombre: paciente?.nombre, cedula: paciente?.cedula, edad: edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento) },
    receta: r,
  })
  return (
    <section aria-label="Graduación del paciente" className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Graduación vigente <span className="font-normal text-slate-500">· receta del {formatoFecha(vigente.fecha, "largoSinDia")}</span></h3>
        <button type="button" onClick={() => setExplicando(true)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer">
          <MessageSquareText size={15} aria-hidden="true" /> Explicar al paciente
        </button>
      </div>
      <div className={"grid gap-4 " + (tendencia ? "@[56rem]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" : "")}>
        <div className="@container min-w-0"><GraduacionVigente receta={vigente} version="personal" /></div>
        {tendencia && <div className="min-w-0 rounded-xl border border-slate-200/60 p-3">{tendencia}</div>}
      </div>
      <div className="grid gap-4 @[56rem]:grid-cols-2">
        {recetas.length > 1 && <CambioGraduacion consultas={recetas} version="personal" />}
        <ListaRecetas recetas={recetas} version="personal" onAbrir={setVerId} />
      </div>
      {receta && <DetalleReceta receta={receta} version="personal" onCerrar={() => setVerId(null)} onImprimir={() => imprimir(receta)} />}
      {explicando && (
        <Cascaron titulo="Explicar al paciente" subtitulo="Así lo lee el paciente en su portal, con palabras simples." Icono={Eye} ancho="max-w-5xl" onCerrar={() => setExplicando(false)}
          pie={<><span /><button type="button" onClick={() => setExplicando(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
          <div className="space-y-4 bg-pt-fondo p-5">
            <GraduacionVigente receta={vigente} version="paciente" />
            {recetas.length > 1 && <CambioGraduacion consultas={recetas} version="paciente" />}
          </div>
        </Cascaron>
      )}
    </section>
  )
}
