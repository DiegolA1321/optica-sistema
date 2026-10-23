"use client"

import { useMemo, useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, plural } from "../ventas/estilos"
import { InsigniaEstado, InsigniaUrgencia } from "./piezas"
import { ordenarMisConsultas } from "../../utilidades/soporte"
import { estaEscalada } from "../../utilidades/comunicacionInterna"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"

const COLUMNAS = "lg:grid-cols-[minmax(0,1fr)_6.5rem_8rem_1rem]"
const ENCABEZADO = [{ texto: "Consulta" }, { texto: "Fecha" }, { texto: "Estado" }, { texto: "" }]
const FILTROS = [{ id: "todas", nombre: "Todas" }, { id: "abiertas", nombre: "Abiertas" }, { id: "resueltas", nombre: "Resueltas" }]

// Pestaña de consultas: cada consulta con su asunto (y, debajo, quién la tiene ahora), su fecha y su estado; el número, el módulo y la urgencia se ven al abrirla, con la conversación completa.
// Cada persona ve las suyas; el administrador, las de todo su personal (con el nombre de quien escribió).
// Tres versiones, según el nivel (variante): "consultas" = las del personal a su administración; "personal" = las que le escriben al administrador (con quién
// escribió y si ya se escaló); "sistema" = las del administrador al soporte del sistema. La tarjeta lleva su título, lo que se le promete a quien escribe y «Nueva consulta».
const TARJETA = {
  consultas: { titulo: "Tus consultas", texto: "Le escribes a la administración de la óptica. Si es un problema del sistema, ella lo pasa al soporte.", etiqueta: "Mis consultas" },
  sistema: { titulo: "Soporte del sistema", texto: "Le escribes al soporte del sistema y te responde por aquí.", etiqueta: "Soporte del sistema" },
  personal: { titulo: "Consultas del personal", texto: "Tu personal te escribe aquí: respóndelas, resuélvelas o pásalas al soporte del sistema.", etiqueta: "Consultas del personal" },
}
const VACIOS = {
  consultas: { titulo: "Todavía no escribiste ninguna consulta", texto: "Cuando escribas a tu administrador, aquí verás tu consulta con su estado y la conversación hasta que se resuelva." },
  sistema: { titulo: "Todavía no escribiste al soporte del sistema", texto: "Cuando escribas al soporte, aquí verás tu consulta con su estado y la conversación hasta que se resuelva." },
  personal: { titulo: "Tu personal todavía no te escribió", texto: "Cuando alguien reporte un problema o haga una pregunta, aparecerá aquí para que la respondas, la resuelvas o la escales al soporte del sistema." },
}

// Quién la tiene ahora, en una frase corta (la segunda línea de cada consulta).
function lineaDeConsulta(c, { usuario, esPersonal, conVariasPersonas }) {
  if (c.iniciadaPor === "soporte") return "Iniciada por el soporte"
  if (conVariasPersonas && c.autorId !== usuario.id) return `Escribió ${c.autorNombre} · ${c.autorRol}${estaEscalada(c) ? " · Escalada al soporte del sistema" : ""}`
  if (estaEscalada(c) && !esPersonal) return "Pasada al soporte del sistema"
  if (c.estado === "resuelta") return "Resuelta"
  if (c.estado === "respondida") return c.destino === "admin" ? "Respondida por tu administrador" : "Respondida por el soporte del sistema"
  return c.destino === "admin" ? "Con tu administrador" : "Con el soporte del sistema"
}

export default function PestanaMisConsultas({ consultas, usuario, puedeEscribir, onAbrir, onNueva, variante = "consultas", onAccionVacia }) {
  const [filtro, setFiltro] = useState("todas")
  const ordenadas = useMemo(() => ordenarMisConsultas(consultas), [consultas])
  const visibles = ordenadas.filter((c) => filtro === "todas" || (filtro === "abiertas" ? c.estado !== "resuelta" : c.estado === "resuelta"))
  const esPersonal = variante === "personal"
  const conVariasPersonas = consultas.some((c) => c.autorId !== usuario.id)
  // Un filtro sobre pocas filas es ruido (regla 25): aparece con más de 5 consultas.
  const conFiltros = consultas.length > 5
  const sinLeer = consultas.filter((c) => c.respuestaSinLeer && (c.autorId === usuario.id || c.iniciadaPor === "soporte")).length
  // Al administrador le tocan las que esperan su respuesta (el personal escribió último y no están resueltas ni escaladas).
  const porResponder = esPersonal ? consultas.filter((c) => c.destino === "admin" && c.ultimoMensajeDe === "optica" && c.estado !== "resuelta").length : 0
  const tarjeta = TARJETA[variante] || TARJETA.consultas
  const vacio = VACIOS[variante] || VACIOS.consultas
  const botonNueva = !esPersonal && puedeEscribir && (
    <button type="button" onClick={onNueva} className={CLASE_ACCION_PRINCIPAL + " px-5 py-2.5"} style={{ background: GRAD_MARCA }}><MessageSquarePlus size={15} aria-hidden="true" /> Nueva consulta</button>
  )

  if (consultas.length === 0) {
    return (
      <Vacio Icono={MessageSquarePlus} titulo={vacio.titulo} texto={vacio.texto}>
        {esPersonal
          ? <button type="button" onClick={onAccionVacia} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Publicar un aviso al personal</button>
          : botonNueva}
      </Vacio>
    )
  }
  return (
    <div className="space-y-3">
      <section aria-label={tarjeta.titulo} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: INK }}>{tarjeta.titulo}</h2>
            <p className="text-sm text-slate-500">{tarjeta.texto}</p>
          </div>
          {botonNueva}
        </div>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-2">
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
          <div className="border-t border-slate-100">
            <Vacio Icono={MessageSquarePlus} titulo={filtro === "abiertas" ? "No tienes consultas abiertas" : "Ninguna consulta está resuelta todavía"} texto="Cambia el filtro para ver las demás.">
              <button type="button" onClick={() => setFiltro("todas")} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Ver todas</button>
            </Vacio>
          </div>
        ) : (
          <ContenedorLista etiqueta={tarjeta.etiqueta} encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
            {visibles.map((c) => {
              const nueva = c.respuestaSinLeer && (c.autorId === usuario.id || c.iniciadaPor === "soporte")
              return (
                <li key={c.id} className={"relative grid grid-cols-1 items-center gap-x-3 gap-y-1 px-5 py-3.5 transition-colors hover:bg-slate-50/70 " + COLUMNAS + (nueva ? " bg-blue-50/40" : "")}>
                  <div className="min-w-0">
                    <button type="button" onClick={() => onAbrir(c.id)} className="block max-w-full truncate text-left text-sm font-bold hover:text-blue-700 hover:underline underline-offset-2 cursor-pointer before:absolute before:inset-0 before:content-['']" style={{ color: INK }}>{c.asunto}</button>
                    <p className="truncate text-xs text-slate-500">{lineaDeConsulta(c, { usuario, esPersonal, conVariasPersonas })}</p>
                    {nueva && <p className="text-xs font-bold text-blue-700">{c.iniciadaPor === "soporte" ? "Mensaje nuevo del soporte" : "Respuesta nueva"}</p>}
                  </div>
                  <p className="text-sm text-slate-600">{fechaLegible(diaDeRegistro(c.creadaEn))}</p>
                  <div className="flex flex-wrap items-center gap-1.5"><InsigniaEstado estado={c.estado} /><InsigniaUrgencia urgencia={c.urgencia} /></div>
                  <span className="hidden text-slate-400 lg:block" aria-hidden="true">›</span>
                </li>
              )
            })}
          </ContenedorLista>
        )}
      </section>
    </div>
  )
}
