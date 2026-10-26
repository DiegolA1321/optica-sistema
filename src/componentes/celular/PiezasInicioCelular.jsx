"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { TONOS, ordenarPorUrgencia, VentanaAvisos } from "../RequiereAtencionPorArea"

// Las piezas del Inicio en celular y tablet (por debajo de 1093 px): los mismos números, los mismos avisos y las mismas ventanas que en la computadora,
// con otra disposición. Cada una recibe ya calculado lo que muestra (el Inicio es quien lo cuenta, así los números son los mismos en las dos versiones).

const TARJETA = "rounded-3xl border border-slate-200/80 bg-white shadow-sm"

// Los totales en dos columnas. tarjetas: [{ id, titulo, valor, desc, onClick }].
export function TotalesCelular({ tarjetas }) {
  if (tarjetas.length === 0) return null
  return (
    <section aria-label="Totales" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tarjetas.map((t) => (
        <button key={t.id} type="button" onClick={t.onClick} aria-label={`${t.titulo}: ${t.valor}. ${t.desc || ""}`} className={TARJETA + " flex min-h-[112px] cursor-pointer flex-col items-start justify-start px-4 py-3.5 text-left"}>
          <span className="block text-base text-slate-600">{t.titulo}</span>
          <span className="block font-serif text-[32px] font-bold leading-tight" style={{ color: INK }}>{t.valor}</span>
          {t.desc && <span className="block text-base leading-snug text-slate-600">{t.desc}</span>}
        </button>
      ))}
    </section>
  )
}

// «Requiere tu atención» en filas que se tocan: una por tipo de aviso, con su punto de urgencia, su número y su leyenda. Al tocar una abre la MISMA ventana de la computadora
// (con cada caso, su detalle, sus acciones y el enlace «Abrir en …»). bloques: los mismos [{ id, titulo, icono, filas }] del Inicio de la computadora.
export function RequiereAtencionCelular({ bloques }) {
  const [abierto, setAbierto] = useState(null) // { bloqueId, filaId }
  if (bloques.length === 0) return null
  const filas = ordenarPorUrgencia(bloques.flatMap((b) => b.filas.map((f) => ({ ...f, bloqueId: b.id }))))
  const bloqueAbierto = abierto ? bloques.find((b) => b.id === abierto.bloqueId) : null
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className={TARJETA + " px-4 pb-2 pt-4"}>
      <h2 className="border-b border-slate-100 pb-3 text-xl font-bold" style={{ color: INK }}>Requiere tu atención</h2>
      {filas.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-lg text-slate-700"><CheckCircle2 size={20} className="shrink-0 text-emerald-600" aria-hidden="true" /> Todo en orden</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filas.map((f) => {
            const tono = TONOS[f.tono] || TONOS.pendiente
            return (
              <li key={`${f.bloqueId}-${f.id}`}>
                <button type="button" onClick={() => setAbierto({ bloqueId: f.bloqueId, filaId: f.id })} aria-label={`${f.cantidad ?? 1} ${f.texto}`} className="fila-tocable min-h-14 py-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tono.punto }} />
                  <span className="w-10 shrink-0 text-center font-serif text-[26px] font-bold leading-none" style={{ color: tono.numero }}>{f.cantidad ?? 1}</span>
                  <span className="min-w-0 flex-1 text-lg leading-snug text-slate-800">{f.corto || f.texto}</span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {bloqueAbierto && <VentanaAvisos bloque={bloqueAbierto} filaId={abierto.filaId} soloFila onCerrar={() => setAbierto(null)} />}
    </section>
  )
}

// La próxima cita del día (la que sigue por atender; quien ya llegó va antes), con su enlace a la agenda y, a quien atiende pacientes, «Atender».
// cita: { hora, paciente, motivo, estado } o null (hoy no queda nadie por atender).
export function ProximaCitaCelular({ cita, hora, alVerAgenda, alAtender }) {
  return (
    <section aria-label="Próxima cita" className={TARJETA + " px-4 py-4"}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: INK }}>Próxima cita</h2>
        <button type="button" onClick={alVerAgenda} className="cursor-pointer text-lg font-semibold text-blue-600">Ver agenda</button>
      </div>
      {cita ? (
        <div className="mt-1 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl leading-snug" style={{ color: INK }}><span className="font-bold">{hora}</span> · {cita.paciente}</p>
            <p className="text-lg leading-snug text-slate-600">{cita.motivo || "Consulta general"}{cita.estado === "En Espera" ? " · ya llegó" : ""}</p>
          </div>
          {alAtender && <button type="button" onClick={alAtender} className="shrink-0 cursor-pointer rounded-xl px-5 text-lg font-bold text-white" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>Atender</button>}
        </div>
      ) : (
        <p className="mt-1 text-lg text-slate-600">No queda nadie por atender hoy.</p>
      )}
    </section>
  )
}
