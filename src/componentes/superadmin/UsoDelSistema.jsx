"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, HandHelping, Users } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { ICONO_MODULO } from "./iconos"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { haceDias, textoUsoModulo, MODULOS_USO } from "../../utilidades/superadminNegocio"
import { personalDeLaOptica, usoDeModulo } from "./useEstadoSistema"

const CLASE_BOTON = "rounded-lg border border-slate-200/60 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"

// El módulo de la Ayuda que corresponde a cada módulo de uso (la ficha clínica se explica dentro de Pacientes).
export const AYUDA_DE_MODULO = { citas: "citas", pacientes: "pacientes", consultas: "pacientes", ventas: "ventas", inventario: "inventario", crm: "crm", reportes: "reportes" }

// El enlace a la Ayuda de un módulo, dentro de la óptica (Soporte → Ayuda, con el módulo ya elegido).
export function enlaceAyudaDeModulo(modulo, slug, origen = typeof window !== "undefined" ? window.location.origin : "") {
  const params = new URLSearchParams({ ...(slug ? { optica: slug } : {}), seccion: "mensajes", tab: "ayuda", modulo: AYUDA_DE_MODULO[modulo] || "" })
  return `${origen}/?${params}`
}

// Un módulo: cuándo se usó en los últimos 30 días y qué roles lo usan (sin datos de pacientes ni del negocio). Sin uso, ofrece ayuda.
export function VentanaModulo({ modulo, hoyClave, opticaIds, onOfrecerAyuda, onCerrar }) {
  const [uso, setUso] = useState(null)
  useEffect(() => {
    let vigente = true
    usoDeModulo(opticaIds, modulo.id).then((r) => { if (vigente) setUso(r) })
    return () => { vigente = false }
  }, [modulo.id, opticaIds.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinUso = !modulo.ultima
  const dias = uso?.dias || []
  const [a, m, d] = hoyClave.split("-").map(Number)
  const cuadros = Array.from({ length: 30 }, (_, i) => {
    const f = new Date(Date.UTC(a, m - 1, d - (29 - i))).toISOString().slice(0, 10)
    return { dia: f, usado: dias.some((x) => x.dia === f) }
  })
  const ofrecer = () => { onCerrar(); onOfrecerAyuda(modulo.id) }
  return (
    <Cascaron
      titulo={modulo.nombre} subtitulo={textoUsoModulo(modulo.ultima, hoyClave)} Icono={ICONO_MODULO[modulo.id] || HandHelping} ancho="max-w-lg" onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">Solo se ve cuándo y quién (por rol): nunca datos de pacientes ni del negocio.</span>
        <div className="ml-auto flex items-center gap-2">
          {sinUso && <button type="button" onClick={ofrecer} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer">Ofrecer ayuda</button>}
          <button type="button" onClick={onCerrar} className={CLASE_BOTON}>Cerrar</button>
        </div>
      </>}
    >
      <div className="space-y-5 p-5">
        {!uso ? <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" aria-label="Cargando el uso del módulo" /> : uso.error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo leer el uso de este módulo. Vuelve a intentarlo.</p>
        ) : (
          <>
            <section aria-label="Últimos 30 días">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Últimos 30 días</h3>
              <div className="flex gap-0.5" role="img" aria-label={`Días en que se usó ${modulo.nombre} en los últimos 30 días`}>
                {cuadros.map((c) => <span key={c.dia} title={`${c.dia}: ${c.usado ? "se usó" : "sin uso"}`} className={"h-7 min-w-0 flex-1 rounded-sm " + (c.usado ? "bg-emerald-500" : "bg-slate-200")} />)}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Verde: ese día alguien usó el módulo. {dias.length === 1 ? "Se usó 1 día" : `Se usó ${dias.length} días`} de 30.</p>
            </section>
            <section aria-label="Roles que lo usan">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Roles que lo usan</h3>
              {uso.roles.length === 0 ? <p className="text-sm text-slate-600">Ningún rol lo usó en los últimos 30 días.</p> : (
                <ul className="flex flex-wrap gap-1.5">{uso.roles.map((r) => <li key={r} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-700">{r}</li>)}</ul>
              )}
            </section>
            {dias.length > 0 && (
              <section aria-label="Cuándo se usó">
                <h3 className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cuándo se usó</h3>
                <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/60">
                  {dias.map((x) => <li key={x.dia} className="flex items-center gap-3 px-3 py-1.5 text-sm"><span className="w-28 shrink-0 font-semibold" style={{ color: INK }}>{fechaLegible(x.dia)}</span><span className="text-slate-600">{x.roles.join(" · ")}</span></li>)}
                </ul>
              </section>
            )}
            {sinUso && <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800"><HandHelping size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Nadie usó este módulo en 30 días. «Ofrecer ayuda» prepara un aviso para el administrador de la óptica con el enlace a la Ayuda de {modulo.nombre}; lo revisas antes de enviarlo.</p>}
          </>
        )}
      </div>
    </Cascaron>
  )
}

// El personal de la óptica con su rol y su último ingreso (lo que abre «Personas activas»).
export function VentanaPersonal({ opticaId, hoyClave, onCerrar }) {
  const [r, setR] = useState(null)
  useEffect(() => {
    let vigente = true
    personalDeLaOptica(opticaId).then((x) => { if (vigente) setR(x) })
    return () => { vigente = false }
  }, [opticaId])
  const activas = (r?.datos || []).filter((p) => p.activa_30d).length
  return (
    <Cascaron
      titulo="Personal de la óptica" subtitulo={r && !r.error ? `${activas} de ${r.datos.length} activas en los últimos 30 días` : "Rol y último ingreso"} Icono={Users} ancho="max-w-lg" onCerrar={onCerrar}
      pie={<><span className="text-xs text-slate-500">Activa = hizo algo en el sistema en los últimos 30 días.</span><button type="button" onClick={onCerrar} className={"ml-auto " + CLASE_BOTON}>Cerrar</button></>}
    >
      {!r ? <div className="m-5 h-24 animate-pulse rounded-xl bg-slate-200/70" aria-label="Cargando el personal" /> : r.error ? (
        <p role="alert" className="m-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">No se pudo leer el personal. Vuelve a intentarlo.</p>
      ) : r.datos.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-600">La óptica todavía no tiene personal registrado.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {r.datos.map((p) => (
            <li key={p.nombre + p.rol} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold" style={{ color: INK }}>{p.nombre}</span>
                <span className="block text-xs text-slate-500">{p.rol}{p.activo === false ? " · desactivada" : ""}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-slate-600">
                <span className="block">{p.ultimo_ingreso ? `Último ingreso ${haceDias(p.ultimo_ingreso, hoyClave)}` : "Nunca ingresó"}</span>
                {p.activa_30d ? <span className="flex items-center justify-end gap-1 font-semibold text-emerald-700"><CheckCircle2 size={12} aria-hidden="true" /> Activa</span> : <span className="font-semibold text-slate-500">Sin actividad en 30 días</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Cascaron>
  )
}
