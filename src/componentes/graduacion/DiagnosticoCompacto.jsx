"use client"

import { INK } from "@/lib/tema"
import { valorD } from "../../utilidades/portalVistas"
import { textoAgudeza } from "../../utilidades/agudeza"
import { medidasLegibles, cambioPorOjo } from "../../utilidades/graduacion"
import { nombreMes } from "../../utilidades/formatoFecha"
import { textoDiagnostico } from "../../utilidades/pasesVenta"
import { ojoSinDatos } from "./Graduacion"
import OjoIlustrado from "./OjoIlustrado"

// Las piezas de la vista técnica de la pestaña Diagnóstico: tarjetas compactas, cada dato del tamaño de su contenido. OI a la izquierda y OD a la derecha, como se ven los ojos.
const CARTA = "rounded-2xl border border-slate-200/60 bg-white shadow-sm"
const LADOS = [["oi", "Ojo izquierdo", "OI"], ["od", "Ojo derecho", "OD"]]
const NOMBRE = { od: "ojo derecho", oi: "ojo izquierdo" }

// «Diagnóstico» (lo que se encontró, el motivo, las indicaciones y el lente recomendado) y «Agudeza visual» (una tabla pequeña, no estirada), lado a lado.
// Las dos tarjetas se pulsan enteras: «Diagnóstico» abre la atención completa y «Agudeza visual» abre su evolución (el enlace de cada una es el que cubre la tarjeta).
export function TarjetasDiagnostico({ consulta: k, onAtencion, onEvolucion }) {
  const fi = k.ficha || null
  const tex = (v) => (v == null || v === "" ? "—" : v)
  const conReceta = Boolean(k.od?.avRx || k.oi?.avRx)
  const ambos = fi?.agudeza?.ambos && Object.values(fi.agudeza.ambos).some(Boolean) ? fi.agudeza.ambos : null
  const filas = [["OI", k.oi, null], ["OD", k.od, null], ...(ambos ? [["Ambos", null, ambos]] : [])]
  const lente = k.lenteRecomendado
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <section aria-label="Diagnóstico" data-resumen={onAtencion ? "" : undefined} className={CARTA + " relative p-5 " + (onAtencion ? "transition-colors hover:bg-slate-50/70" : "")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold" style={{ color: INK }}>Diagnóstico</h2>
          {onAtencion && <button type="button" onClick={onAtencion} aria-haspopup="dialog" className="text-sm font-semibold text-blue-600 transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-blue-700 cursor-pointer">Ver la atención completa →</button>}
        </div>
        <p className="mt-2 text-[22px] font-bold leading-tight" style={{ color: INK }}>{textoDiagnostico(k) || "Sin diagnóstico registrado"}</p>
        <div className="mt-2 space-y-1.5 text-[15px] leading-snug text-slate-700">
          {k.motivo && <p className="text-slate-500">Motivo: {k.motivo}{k.detalleConsulta ? ` · ${k.detalleConsulta}` : ""}</p>}
          {k.indicaciones && <p>Indicaciones: {k.indicaciones}</p>}
          {lente && <p>Lente recomendado: {lente}</p>}
          {k.productoNombre && <p className="text-sm text-blue-700">Vinculado al inventario: <span className="font-semibold">{k.productoNombre}</span></p>}
        </div>
      </section>
      <section aria-label="Agudeza visual" data-resumen={onEvolucion ? "" : undefined} className={CARTA + " relative p-5 " + (onEvolucion ? "transition-colors hover:bg-slate-50/70" : "")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold" style={{ color: INK }}>Agudeza visual</h2>
          {onEvolucion && <button type="button" onClick={onEvolucion} aria-haspopup="dialog" className="text-sm font-semibold text-blue-600 transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-blue-700 cursor-pointer">Ver su evolución →</button>}
        </div>
        <table className="mt-3 border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <th scope="col" className="pb-2 pr-8"><span className="sr-only">Ojo</span></th>
              <th scope="col" className="pb-2 pr-8">Sin corrección</th>
              <th scope="col" className="pb-2 pr-8">Con su corrección actual</th>
              {conReceta && <th scope="col" className="pb-2">Con la receta nueva</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(([n, o, a]) => (
              <tr key={n}>
                <th scope="row" className="py-1.5 pr-8 text-left font-bold text-blue-600">{n}</th>
                <td className="py-1.5 pr-8 tabular-nums">{tex(textoAgudeza(a ? a.sc : o?.avSc, a ? a.scF : o?.avScF))}</td>
                <td className="py-1.5 pr-8 tabular-nums">{tex(textoAgudeza(a ? a.cc : o?.avCc, a ? a.ccF : o?.avCcF))}</td>
                {conReceta && <td className="py-1.5 tabular-nums">{tex(textoAgudeza(a ? a.rx : o?.avRx, a ? a.rxF : o?.avRxF))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

// «Refracción final»: los dos ojos, cada uno con su dibujo centrado en su mitad, la esfera grande, el cilindro y el eje, y cuánto cambió desde la receta anterior. Debajo, en una línea,
// la adición, la distancia pupilar y el prisma. Toda la mitad de un ojo se pulsa y abre su historia; «Historia de cada ojo →» abre la del izquierdo y desde ahí se pasa al derecho.
export function RefraccionPerfil({ receta, anterior = null, onOjo }) {
  const m = receta.medidas || {}
  const medidas = medidasLegibles(m)
  const dato = (titulo) => medidas.find(([t]) => t.startsWith(titulo))?.[1] || ""
  const linea = [
    ["Adición", dato("Adición") || "no registrada"],
    ["Distancia pupilar", dato("Distancia pupilar").replace(/^\s+/, "") || "no registrada"],
    ...(dato("Altura") ? [["Altura de montaje", dato("Altura")]] : []),
    ["Prisma", dato("Prisma") || "sin prisma"],
  ]
  const cambios = anterior ? cambioPorOjo([receta, anterior]) : null
  const desde = anterior ? nombreMes(Number(String(anterior.fecha).slice(5, 7)) - 1) : ""
  return (
    <section aria-label="Refracción final" className={CARTA}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <h2 className="text-base font-bold" style={{ color: INK }}>Refracción final</h2>
        {onOjo && <button type="button" onClick={() => onOjo("oi")} aria-haspopup="dialog" className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Historia de cada ojo →</button>}
      </div>
      <div className="grid gap-y-2 px-5 py-4 md:grid-cols-2 md:divide-x md:divide-slate-200/70">
        {LADOS.map(([lado, nombre, sigla], i) => {
          const o = receta[lado] || {}
          const cambio = cambios?.find((c) => c.lado === lado)
          const delta = !cambio?.texto ? "" : cambio.texto === "Sin cambios" ? `Sin cambios desde ${desde}` : `${cambio.texto} desde ${desde}`
          const sinDatos = ojoSinDatos(o)
          const cilindro = [valorD(o.cilindro) && `Cil ${valorD(o.cilindro)}`, o.eje && `Eje ${o.eje}°`].filter(Boolean).join(" · ")
          return (
            <section key={lado} data-lado={lado} aria-label={nombre} className={"flex min-w-0 items-center justify-center gap-5 rounded-xl py-1 " + (i === 0 ? "md:pr-6 " : "md:pl-6 ") + (onOjo ? "pt-abrible relative transition-colors hover:bg-slate-50/70" : "")}>
              <OjoIlustrado ancho={140} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600">{sigla} · {nombre}</p>
                {sinDatos ? (
                  <p className="mt-1 text-sm text-slate-500">{receta.ojoNoEvaluado?.[lado] ? `Ojo no evaluado: ${receta.ojoNoEvaluado[lado]}` : `Sin datos del ${NOMBRE[lado]} en esta receta`}</p>
                ) : (
                  <>
                    {valorD(o.esfera) ? <p className="font-serif text-[44px] font-bold leading-none tabular-nums" style={{ color: INK }}>{valorD(o.esfera)}</p> : <p className="py-2 text-sm text-slate-400">Esfera sin registrar</p>}
                    {cilindro && <p className="mt-1 text-[15px] text-slate-500">{cilindro}</p>}
                    {delta && <p className="text-[15px] text-slate-500">{delta}</p>}
                  </>
                )}
                {onOjo && <button type="button" onClick={() => onOjo(lado)} aria-haspopup="dialog" aria-label={`Ver la historia del ${NOMBRE[lado]}: todas sus recetas y cómo cambió su esfera`} className="pt-abrir absolute inset-0 rounded-[inherit] cursor-pointer" />}
              </div>
            </section>
          )
        })}
      </div>
      <dl aria-label="Medidas de la receta" className="flex flex-wrap gap-x-9 gap-y-1 border-t border-slate-100 px-5 py-3 text-[15px]">
        {linea.map(([t, v]) => <div key={t} className="flex items-baseline gap-1.5"><dt className="text-slate-500">{t}:</dt><dd className="font-medium text-slate-900">{v}</dd></div>)}
      </dl>
    </section>
  )
}
