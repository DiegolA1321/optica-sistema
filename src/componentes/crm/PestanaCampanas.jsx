"use client"

import { useMemo } from "react"
import { Megaphone, MessageSquareText } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio, Insignia } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { ConteoCitas } from "../FiltrosCitas"
import { GRUPOS_CAMPANA, destinatariosCampana } from "../../utilidades/crmContactos"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { hoyISO } from "../../utilidades/disponibilidad"

const COLUMNAS = "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_6rem]"
const ENCABEZADO = [{ texto: "Campaña" }, { texto: "Grupo" }, { texto: "Creada" }, { texto: "Envíos" }, { texto: "" }]

// Pestaña "Campañas": un mensaje preparado para un grupo. Aquí se ven las campañas y cuánto va de cada una; se crean desde el botón de la
// cabecera y se envían una por una (cada envío por WhatsApp queda marcado y en Seguimiento).
export default function PestanaCampanas({ campanas, contactos, pacientes, consultas, puedeCrear, puedeVerPlantillas, onNueva, onAbrir, onPlantillas }) {
  const hoy = hoyISO()
  const progreso = useMemo(() => {
    const enviados = new Map()
    for (const c of contactos) if (c.campanaId) { if (!enviados.has(c.campanaId)) enviados.set(c.campanaId, new Set()); enviados.get(c.campanaId).add(c.pacienteId) }
    const porGrupo = new Map()
    return new Map(campanas.map((k) => {
      if (!porGrupo.has(k.grupo)) porGrupo.set(k.grupo, new Set(destinatariosCampana(k.grupo, { pacientes, consultas, hoy }).pacientes.map((p) => p.id)))
      const ya = enviados.get(k.id) || new Set()
      const todos = new Set([...porGrupo.get(k.grupo), ...ya])
      return [k.id, { enviados: ya.size, total: todos.size }]
    }))
  }, [campanas, contactos, pacientes, consultas, hoy])

  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <ConteoCitas texto={campanas.length === 0 ? "Sin campañas" : plural(campanas.length, "campaña", "campañas")} />
        {puedeVerPlantillas && <button type="button" onClick={onPlantillas} className={CLASE_ACCION_SECUNDARIA}><MessageSquareText size={14} aria-hidden="true" /> Plantillas</button>}
      </div>

      {campanas.length === 0 ? (
        <Vacio Icono={Megaphone} titulo="Todavía no hay campañas" texto="Una campaña es un mensaje para un grupo: control vencido, quienes llevan más de un año sin venir, cumpleaños del mes o quienes aceptan promociones. El sistema prepara la lista y tú envías cada mensaje.">
          {puedeCrear && <button type="button" onClick={onNueva} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Megaphone size={15} aria-hidden="true" /> Crear la primera campaña</button>}
        </Vacio>
      ) : (
        <ContenedorLista etiqueta="Campañas" encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
          {campanas.map((k) => {
            const p = progreso.get(k.id) || { enviados: 0, total: 0 }
            const completa = p.total > 0 && p.enviados >= p.total
            return (
              <li key={k.id} className={"grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-4 py-3 " + COLUMNAS}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: INK }}>{k.nombre}</p>
                  <p className="truncate text-xs text-slate-500">{k.mensaje}</p>
                </div>
                <div><Insignia tono={k.grupo === "promociones" ? "gris" : "azul"}>{GRUPOS_CAMPANA[k.grupo]?.etiqueta || k.grupo}</Insignia></div>
                <p className="text-sm text-slate-600">{fechaLegible(diaDeRegistro(k.creadaEn))}{k.creadaPorNombre && <span className="block truncate text-xs text-slate-500">{k.creadaPorNombre}</span>}</p>
                <div className="min-w-0">
                  <p className="text-sm text-slate-700"><span className="font-semibold tabular-nums">{p.enviados}</span> de <span className="tabular-nums">{p.total}</span> enviados</p>
                  <div className="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${p.total ? Math.round((p.enviados / p.total) * 100) : 0}%`, background: completa ? "#059669" : GRAD_MARCA }} />
                  </div>
                </div>
                <div className="flex lg:justify-end">
                  <button type="button" onClick={() => onAbrir(k.id)} aria-label={`Abrir la campaña ${k.nombre}`} className={CLASE_ACCION_SECUNDARIA.replace("px-3.5", "px-3")}>{completa || !puedeCrear ? "Ver" : "Enviar"}</button>
                </div>
              </li>
            )
          })}
        </ContenedorLista>
      )}
    </div>
  )
}
