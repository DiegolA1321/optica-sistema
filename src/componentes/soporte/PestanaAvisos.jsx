"use client"

import { useState } from "react"
import { Check, ChevronDown, Megaphone, Plus, Trash2 } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Insignia, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { fechaHoraLegible, formatoFecha } from "../../utilidades/formatoFecha"
import { destinoLegible, estaVencido, textoLeidoPor } from "../../utilidades/comunicacionInterna"
import { hoyISO } from "../../utilidades/disponibilidad"

// Pestaña "Avisos": los del sistema (del soporte, para todas las ópticas) y los internos (del administrador a su personal), juntos, con su fecha. Los no leídos
// van primero y destacados; cada uno se marca como leído a mano, para que nadie pierda un aviso solo por haber abierto la pestaña.
// El administrador publica ("Nuevo aviso"), ve a quién va cada aviso interno y cuántos lo leyeron, y puede retirarlo.
export default function PestanaAvisos({ avisos, esAdmin = false, lecturas = {}, destinatarios = {}, onMarcar, onMarcarTodos, onVerAyuda, onNuevo, onRetirar, accionVacio = "Ver la ayuda" }) {
  const [retirando, setRetirando] = useState(null)
  const hoy = hoyISO()
  const mios = (a) => a.origen === "interno" && esAdmin
  const sinLeer = avisos.filter((a) => !a.leido && !mios(a)).length

  if (avisos.length === 0) {
    return (
      <Vacio Icono={Megaphone} titulo={esAdmin ? "Todavía no hay avisos" : "Todavía no hay avisos"}
        texto={esAdmin ? "Publica un aviso para todo tu personal, para un rol o para una persona. Aquí también aparecen las novedades y los mantenimientos del soporte del sistema." : "Aquí aparecen los avisos de tu administrador y las novedades, los mantenimientos y los comunicados del soporte."}>
        {esAdmin
          ? <button type="button" onClick={onNuevo} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Plus size={15} aria-hidden="true" /> Nuevo aviso</button>
          : <button type="button" onClick={onVerAyuda} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{accionVacio}</button>}
      </Vacio>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <p role="status" className="text-sm font-semibold text-slate-600">{plural(avisos.length, "aviso", "avisos")}{sinLeer > 0 && <span className="ml-2 font-bold text-blue-700">{plural(sinLeer, "nuevo", "nuevos")}</span>}</p>
        {sinLeer > 1 && <button type="button" onClick={onMarcarTodos} className={CLASE_ACCION_SECUNDARIA}><Check size={14} aria-hidden="true" /> Marcar todos como leídos</button>}
      </div>
      <ul role="list" aria-label="Avisos" className="space-y-3">
        {avisos.map((a) => {
          const interno = a.origen === "interno"
          const propio = mios(a)
          const vencido = interno && estaVencido(a.aviso, hoy)
          const lec = lecturas[a.id]
          const nuevo = !a.leido && !propio
          return (
            <li key={`${a.origen}-${a.id}`} className={"rounded-2xl border bg-white p-4 shadow-sm " + (nuevo ? "border-blue-300 ring-2 ring-blue-50" : "border-slate-200/60")}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={"text-sm " + (nuevo ? "font-bold" : "font-semibold text-slate-700")} style={nuevo ? { color: INK } : undefined}>{a.titulo}</h3>
                {nuevo && <Insignia tono="azul">Nuevo</Insignia>}
                {interno ? <Insignia tono="gris" title="Lo publicó el administrador de tu óptica">{propio ? "Para tu personal" : "De tu administrador"}</Insignia> : <Insignia tono="gris" title="Lo publicó el soporte del sistema">Del sistema</Insignia>}
                {!interno && !a.general && <Insignia tono="gris" title="Este aviso es solo para tu óptica">Para tu óptica</Insignia>}
                {vencido && <Insignia tono="gris">Vencido</Insignia>}
                <span className="ml-auto text-xs text-slate-500">{fechaHoraLegible(a.creadoEn, { anio: true })}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.cuerpo}</p>
              {interno && (
                <p className="mt-2 text-xs text-slate-500">
                  {propio ? `Para: ${destinoLegible(a.aviso, destinatarios)}` : `De ${a.autorNombre}`}
                  {a.venceEl ? ` · ${vencido ? "Venció" : "Vence"} el ${formatoFecha(a.venceEl, "medio")}` : ""}
                </p>
              )}
              {propio && (
                <div className="mt-3 space-y-2">
                  <details className="group rounded-xl border border-slate-200/60 bg-slate-50/60">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                      {textoLeidoPor(lec)}
                      <ChevronDown size={15} className="ml-auto shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    {lec && lec.personas.length > 0 && (
                      <ul role="list" aria-label={`Quién leyó «${a.titulo}»`} className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                        {lec.personas.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                            <span className="min-w-0 truncate text-slate-700">{p.nombre}</span>
                            {p.leidoEn ? <span className="shrink-0 text-xs font-semibold text-emerald-700">Leído · {fechaHoraLegible(p.leidoEn, { anio: true })}</span> : <span className="shrink-0 text-xs text-slate-500">Sin leer</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  {retirando === a.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">¿Retirar este aviso? Nadie volverá a verlo.</span>
                      <button type="button" onClick={() => { onRetirar(a.id); setRetirando(null) }} className={CLASE_ACCION_SECUNDARIA}>Sí, retirar</button>
                      <button type="button" onClick={() => setRetirando(null)} className={CLASE_ACCION_SECUNDARIA}>No</button>
                    </div>
                  ) : <button type="button" onClick={() => setRetirando(a.id)} className={CLASE_ACCION_SECUNDARIA}><Trash2 size={14} aria-hidden="true" /> Retirar aviso</button>}
                </div>
              )}
              {nuevo && <button type="button" onClick={() => onMarcar(a)} className={CLASE_ACCION_SECUNDARIA + " mt-3"}><Check size={14} aria-hidden="true" /> Marcar como leído</button>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
