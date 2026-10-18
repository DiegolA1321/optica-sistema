"use client"

import { useMemo } from "react"
import { Printer, Eye } from "lucide-react"
import { edadEnAnios } from "../../utilidades/edad"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { ordenarPorFechaYCreacion } from "../../utilidades/fidelizacion"
import { recetasDe } from "../../utilidades/graduacion"
import { imprimirHojaReceta } from "../../utilidades/imprimirHojaReceta"
import { VistaGraduacion } from "./Graduacion"

// La pestaña «Graduación» del perfil del paciente del sistema del personal: la MISMA vista que «Mi receta» del portal (`VistaGraduacion`), en la versión del personal: notación técnica (OD y OI,
// esfera, cilindro, eje, adición, agudeza visual con y sin lentes y distancia pupilar; «No registrado» donde falta un dato), el selector de receta arriba (cambia toda la vista), el antes → ahora,
// la gráfica de tendencia (`tendencia({ onElegir, fechaActiva })`: la de siempre, siempre dibujada y con sus puntos pulsables), las indicaciones y «Comparar dos recetas». «Explicar al paciente» cambia la vista a la de palabras simples del portal y
// «Imprimir receta» imprime la hoja única (`HojaReceta`). El perfil solo ofrece la pestaña a quien tiene permiso de Ficha clínica «ver».
export default function GraduacionPerfil({ consultas = [], paciente, usuario, tendencia = null }) {
  const recetas = useMemo(() => recetasDe([...consultas].sort(ordenarPorFechaYCreacion)), [consultas])
  if (recetas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Eye size={22} aria-hidden="true" /></div>
        <p className="text-base font-bold text-slate-800">Este paciente todavía no tiene una receta</p>
        <p className="max-w-md text-sm text-slate-500">La graduación aparece aquí cuando se guarda la ficha clínica de una atención con las medidas de sus ojos.</p>
      </div>
    )
  }
  const imprimir = (r) => imprimirHojaReceta({
    optica: { nombre: usuario?.opticaNombre, direccion: usuario?.opticaMarca?.direccion, telefono: usuario?.opticaMarca?.telefono, correo: usuario?.opticaMarca?.correo, logoUrl: usuario?.opticaLogoUrl },
    paciente: { nombre: paciente?.nombre, cedula: paciente?.cedula, edad: edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento) },
    receta: r,
  })
  const subtitulo = (r) => [r.id === recetas[0].id ? `Vigente desde el ${formatoFecha(r.fecha, "largoSinDia")}` : `Receta del ${formatoFecha(r.fecha, "largoSinDia")}`, r.profesionalNombre, r.lenteRecomendado && `Lente recomendado: ${r.lenteRecomendado}`].filter(Boolean).join(" · ")
  return (
    <VistaGraduacion recetas={recetas} version="personal" titulo="Graduación" subtitulo={subtitulo} explicable
      accion={{ texto: "Imprimir receta", Icono: Printer, onClick: imprimir }}
      grafica={tendencia} />
  )
}
