"use client"

import { useMemo, useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, plural } from "../ventas/estilos"
import { InsigniaEstado, InsigniaUrgencia } from "./piezas"
import { codigoConsulta, nombreModulo, ordenarMisConsultas } from "../../utilidades/soporte"
import { estaEscalada } from "../../utilidades/comunicacionInterna"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"

const COLUMNAS = "lg:grid-cols-[5.5rem_minmax(0,2fr)_minmax(0,1fr)_6rem_6.5rem_7.5rem]"
const ENCABEZADO = [{ texto: "Número" }, { texto: "Asunto" }, { texto: "Módulo" }, { texto: "Urgencia" }, { texto: "Fecha" }, { texto: "Estado" }]
const FILTROS = [{ id: "todas", nombre: "Todas" }, { id: "abiertas", nombre: "Abiertas" }, { id: "resueltas", nombre: "Resueltas" }]

// Pestaña "Mis consultas": cada consulta con su número, asunto, módulo, urgencia, fecha y estado. Al abrirla se ve la conversación completa.
// Cada persona ve las suyas; el administrador, las de todo su personal (con el nombre de quien escribió).
// Tres versiones, según el nivel (variante): "consultas" = las del personal a su administrador; "personal" = las que le escriben al administrador (con quién
// escribió y si ya se escaló); "sistema" = las del administrador al soporte del sistema.
const VACIOS = {
  consultas: { titulo: "Todavía no escribiste ninguna consulta", texto: "Cuando escribas a tu administrador, aquí verás tu consulta con su número, su estado y la conversación hasta que se resuelva.", etiqueta: "Mis consultas" },
  sistema: { titulo: "Todavía no escribiste al soporte del sistema", texto: "Cuando escribas al soporte, aquí verás tu consulta con su número, su estado y la conversación hasta que se resuelva.", etiqueta: "Soporte del sistema" },
  personal: { titulo: "Tu personal todavía no te escribió", texto: "Cuando alguien reporte un problema o haga una pregunta, aparecerá aquí para que la respondas, la resuelvas o la escales al soporte del sistema.", etiqueta: "Consultas del personal" },
}
export default function PestanaMisConsultas({ consultas, usuario, puedeEscribir, onAbrir, onNueva, variante = "consultas", onAccionVacia }) {
  const [filtro, setFiltro] = useState("todas")
  const ordenadas = useMemo(() => ordenarMisConsultas(consultas), [consultas])
  const visibles = ordenadas.filter((c) => filtro === "todas" || (filtro === "abiertas" ? c.estado !== "resuelta" : c.estado === "resuelta"))
  const esPersonal = variante === "personal"
  const conVariasPersonas = consultas.some((c) => c.autorId !== usuario.id)
  // Un filtro sobre pocas filas es ruido (regla 25): aparece con más de 5 consultas.
  const conFiltros = consultas.length > 5
  const sinLeer = consultas.filter((c) => c.respuestaSinLeer && c.autorId === usuario.id).length
  // Al administrador le tocan las que esperan su respuesta (el personal escribió último y no están resueltas ni escaladas).
  const porResponder = esPersonal ? consultas.filter((c) => c.destino === "admin" && c.ultimoMensajeDe === "optica" && c.estado !== "resuelta").length : 0
  const vacio = VACIOS[variante] || VACIOS.consultas

  if (consultas.length === 0) {
    return (
      <Vacio Icono={MessageSquarePlus} titulo={vacio.titulo} texto={vacio.texto}>
        {esPersonal
          ? <button type="button" onClick={onAccionVacia} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Publicar un aviso al personal</button>
          : puedeEscribir && <button type="button" onClick={onNueva} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><MessageSquarePlus size={15} aria-hidden="true" /> Nueva consulta</button>}
      </Vacio>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <p role="status" className="text-sm font-semibold text-slate-600">
          {plural(visibles.length, "consulta", "consultas")}{sinLeer > 0 && <span className="ml-2 font-bold text-blue-700">{plural(sinLeer, "respuesta nueva", "respuestas nuevas")}</span>}
          {porResponder > 0 && <span className="ml-2 font-bold text-blue-700">{plural(porResponder, "espera tu respuesta", "esperan tu respuesta")}</span>}
        </p>
        {conFiltros && (
          <div role="group" aria-label="Filtrar consultas" className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={"rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer " + (filtro === f.id ? "text-white" : "text-slate-500 hover:bg-slate-50")} style={filtro === f.id ? { background: GRAD_MARCA } : undefined}>{f.nombre}</button>
            ))}
          </div>
        )}
      </div>
      {visibles.length === 0 ? (
        <Vacio Icono={MessageSquarePlus} titulo={filtro === "abiertas" ? "No tienes consultas abiertas" : "Ninguna consulta está resuelta todavía"} texto="Cambia el filtro para ver las demás.">
          <button type="button" onClick={() => setFiltro("todas")} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Ver todas</button>
        </Vacio>
      ) : (
        <ContenedorLista etiqueta={vacio.etiqueta} encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
          {visibles.map((c) => {
            const nueva = c.respuestaSinLeer && c.autorId === usuario.id
            return (
              <li key={c.id} className={"grid grid-cols-1 items-center gap-x-3 gap-y-1 px-4 py-3 " + COLUMNAS + (nueva ? " bg-blue-50/40" : "")}>
                <span className="font-mono text-sm font-bold text-slate-700">{codigoConsulta(c.numero)}</span>
                <div className="min-w-0">
                  <button type="button" onClick={() => onAbrir(c.id)} className="block max-w-full truncate text-left text-sm font-bold hover:text-blue-700 hover:underline underline-offset-2 cursor-pointer" style={{ color: INK }}>{c.asunto}</button>
                  {conVariasPersonas && c.autorId !== usuario.id && <p className="truncate text-xs text-slate-500">Escribió {c.autorNombre} · {c.autorRol}{estaEscalada(c) ? " · Escalada al soporte del sistema" : ""}</p>}
                  {!esPersonal && c.destino === "admin" && c.estado !== "resuelta" && <p className="truncate text-xs text-slate-500">Con tu administrador</p>}
                  {nueva && <p className="text-xs font-bold text-blue-700">Respuesta nueva</p>}
                </div>
                <p className="truncate text-sm text-slate-600">{nombreModulo(c.modulo)}</p>
                <div className="min-h-[1.5rem]"><InsigniaUrgencia urgencia={c.urgencia} /></div>
                <p className="text-sm text-slate-600">{fechaLegible(diaDeRegistro(c.creadaEn))}</p>
                <div><InsigniaEstado estado={c.estado} /></div>
              </li>
            )
          })}
        </ContenedorLista>
      )}
    </div>
  )
}
