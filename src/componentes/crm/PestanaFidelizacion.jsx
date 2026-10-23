"use client"

import { useMemo, useState } from "react"
import { Cake, Gift, MessageCircle, Search, Star, Users } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { Insignia } from "../ventas/Lista"
import { ConteoCitas } from "../FiltrosCitas"
import { NombrePaciente } from "./piezas"
import { CLASE_PILDORA } from "./estilosCrm"
import { puedeContactarPor, rankingFrecuentes, rankingReferidores } from "../../utilidades/crmContactos"
import { conPuestos, cumpleanosDelMes, rankingPorPuntos, saludadoEnElAnio } from "../../utilidades/crmResumen"
import { useFidelidadCon } from "../FidelidadContexto"

import { diaSemanaCorto, fechaLegible, formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { MINIMO_CLIENTE_FRECUENTE, ultimaVisita } from "../../utilidades/fidelizacion"
import { fechaAISO, hoyISO, isoAFechaLocal } from "../../utilidades/disponibilidad"

const POR_PAGINA = 30
const COLUMNAS = "lg:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const VISTAS = {
  puntaje: { id: "puntaje", etiqueta: "Puntaje de fidelidad", Icono: Star, columna: "Puntos", unidad: (n) => `${n} pts`, vacio: ["Todavía nadie suma puntos", "Los puntos se ganan por consulta, por paciente referido y por lo que se paga (se configura en Configuración › Fidelización)."],
    ayuda: "Los puntos del programa de fidelización: por consulta, por referido y por lo pagado" },
  frecuentes: { id: "frecuentes", etiqueta: "Más frecuentes", Icono: Users, columna: "Consultas", unidad: (n) => `${n} consultas`, vacio: ["Todavía nadie es paciente frecuente", `Se vuelve frecuente quien tiene ${MINIMO_CLIENTE_FRECUENTE} o más consultas.`],
    ayuda: `Pacientes con ${MINIMO_CLIENTE_FRECUENTE} o más consultas registradas` },
  referidores: { id: "referidores", etiqueta: "Más refieren", Icono: Gift, columna: "Referidos", unidad: (n) => `${n} ${n === 1 ? "referido" : "referidos"}`, vacio: ["Todavía nadie ha referido a otro paciente", "Aparecen aquí cuando un paciente nuevo dice quién lo refirió al registrarse."],
    ayuda: "Pacientes que trajeron a otros" },
}
const ORDEN = ["puntaje", "frecuentes", "referidores"]

// «Vie 24 oct»: el día de la semana y la fecha.
const diaYFecha = (iso) => `${diaSemanaCorto(isoAFechaLocal(iso).getDay())} ${formatoFecha(iso, "medioSinAnio")}`

// Los cumpleaños del mes, por grupos, con la edad que cumple y «Saludar»: abre la ventana de Contactar con la plantilla de cumpleaños (el contacto queda registrado).
// Quien no aceptó saludos lo dice y no deja enviar; a quien ya se le saludó este año se le marca.
function Cumpleanos({ pacientes, contactos, puedeContactar, onSaludar, onVerPerfil }) {
  const hoy = hoyISO()
  const [mes, setMes] = useState(0) // 0 = este mes, 1 = el próximo
  const lista = useMemo(() => cumpleanosDelMes(pacientes, hoy, mes), [pacientes, hoy, mes])
  const base = isoAFechaLocal(hoy)
  const nombreDelMes = nombreMes(new Date(base.getFullYear(), base.getMonth() + mes, 1).getMonth(), "largo").toLowerCase()
  const grupos = (mes === 0 ? ["semana", "adelante", "pasaron"] : ["mes"]).map((g) => ({ id: g, filas: lista.filter((x) => x.grupo === g) })).filter((g) => g.filas.length > 0)
  const titulo = (g) => (g === "semana" ? "Esta semana" : g === "adelante" ? `Más adelante en ${nombreDelMes}` : g === "pasaron" ? "Ya pasaron este mes" : `Cumpleaños de ${nombreDelMes}`)

  return (
    <section aria-label="Cumpleaños" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800"><Cake size={16} aria-hidden="true" /> Cumpleaños <span className="text-sm font-semibold text-slate-500">({lista.length})</span></h2>
        <div role="group" aria-label="Mes de los cumpleaños" className="flex items-center gap-1.5">
          {[[0, "Este mes"], [1, "Próximo mes"]].map(([v, texto]) => (
            <button key={v} type="button" onClick={() => setMes(v)} aria-pressed={mes === v} className={CLASE_PILDORA(mes === v)} style={mes === v ? { background: GRAD_MARCA } : undefined}>{texto}</button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Nadie cumple años {mes === 0 ? "este mes" : "el próximo mes"}, o todavía no hay fechas de nacimiento registradas.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {grupos.map((g) => (
            <div key={g.id}>
              <p className="bg-slate-50/70 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{titulo(g.id)} <span className="font-semibold">({g.filas.length})</span></p>
              <ul role="list" aria-label={titulo(g.id)} className="divide-y divide-slate-100">
                {g.filas.map((x) => {
                  const p = x.paciente
                  const tel = p.telefono || p.contacto || p.celular || ""
                  const saludado = saludadoEnElAnio(p, x.fecha, contactos)
                  const acepta = puedeContactarPor(p, "cumpleanos")
                  return (
                    <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_8rem_6rem_minmax(8rem,auto)]">
                      <div className="min-w-0">
                        <NombrePaciente paciente={p} onVerPerfil={onVerPerfil} className="block max-w-full" />
                        <p className="text-xs text-slate-500">{tel || "Sin teléfono"}</p>
                      </div>
                      <span className="text-sm tabular-nums text-slate-700">{diaYFecha(x.fecha)}</span>
                      <span className="text-sm text-slate-500">{x.edad === null ? "" : x.pasado ? `Cumplió ${x.edad}` : `Cumple ${x.edad}`}</span>
                      <div className="col-span-2 flex justify-end sm:col-span-1">
                        {saludado ? <Insignia tono="verde">Saludado</Insignia>
                          : !acepta ? <span className="text-xs font-semibold text-amber-700">No acepta saludos</span>
                          : !puedeContactar ? <span className="text-xs text-slate-500">Sin permiso para contactar</span>
                          : <button type="button" onClick={() => onSaludar(p)} disabled={!tel} title={tel ? "Abre WhatsApp con el saludo de cumpleaños" : "Sin número registrado"} aria-label={`Saludar a ${p.nombre}`} className={CLASE_ACCION_PRINCIPAL.replace("px-3.5", "px-3")} style={{ background: GRAD_MARCA }}><MessageCircle size={14} aria-hidden="true" /> Saludar</button>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Pestaña "Fidelización": los cumpleaños del mes (con «Saludar») y los rankings completos (con todos los nombres) y el puntaje. Los rankings son para conocer a los mejores pacientes,
// no una lista de tareas: por eso ahí no hay botones de contacto. Con empates, comparten el mismo puesto.
export default function PestanaFidelizacion({ pacientes, consultas, contactos = [], puedeContactar = false, onSaludar, onVerPerfil, vistaInicial = "puntaje" }) {
  const { de } = useFidelidadCon({ pacientes, consultas })
  const [vista, setVista] = useState(VISTAS[vistaInicial] ? vistaInicial : "puntaje")
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const rankings = useMemo(() => ({
    puntaje: conPuestos(rankingPorPuntos(pacientes, de)), frecuentes: conPuestos(rankingFrecuentes(pacientes, consultas)), referidores: conPuestos(rankingReferidores(pacientes)),
  }), [pacientes, consultas, de])
  const def = VISTAS[vista]
  const ultimaDe = (p) => { const f = ultimaVisita(p, consultas); return f ? fechaLegible(fechaAISO(f)) : "—" }
  const buscando = texto.trim() !== ""
  const lista = useMemo(() => {
    const q = sinTildes(texto.trim())
    // El lugar es el del ranking completo, no el de la búsqueda: buscar a alguien no lo manda al primer puesto.
    return rankings[vista].filter((x) => !q || sinTildes(x.paciente.nombre).includes(q))
  }, [rankings, vista, texto])
  const n = lista.length
  const cambiarVista = (id) => { setVista(id); setVisibles(POR_PAGINA) }

  return (
    <div className="space-y-4">
      <Cumpleanos pacientes={pacientes} contactos={contactos} puedeContactar={puedeContactar} onSaludar={onSaludar} onVerPerfil={onVerPerfil} />
      <h2 className="px-1 pt-1 text-base font-bold text-slate-800">Ranking de fidelidad</h2>
      <div role="group" aria-label="Ranking" className="flex flex-wrap items-center gap-2">
        {ORDEN.map((id) => (
          <button key={id} type="button" onClick={() => cambiarVista(id)} aria-pressed={vista === id} className={CLASE_PILDORA(vista === id)} style={vista === id ? { background: GRAD_MARCA } : undefined}>
            {VISTAS[id].etiqueta} <span className="tabular-nums opacity-80">({rankings[id].length})</span>
          </button>
        ))}
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-3">
          <ConteoCitas texto={`${plural(n, "paciente", "pacientes")}${buscando ? " con esa búsqueda" : ""}`} />
          <span className="hidden text-xs text-slate-500 sm:inline">{def.ayuda}. Con empates, comparten el mismo puesto.</span>
        </div>
        {rankings[vista].length > 5 && (
          <div className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <label htmlFor="crm-fidelizacion-busqueda" className="sr-only">Buscar paciente</label>
            <input id="crm-fidelizacion-busqueda" type="text" value={texto} onChange={(e) => { setTexto(e.target.value); setVisibles(POR_PAGINA) }} placeholder="Buscar paciente"
              className="w-full rounded-xl border border-slate-200/60 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
          </div>
        )}
      </div>

      {rankings[vista].length === 0 ? (
        <Vacio Icono={def.Icono} titulo={def.vacio[0]} texto={def.vacio[1]} />
      ) : n === 0 ? (
        <Vacio Icono={Search} titulo="Ningún paciente coincide con la búsqueda"><button type="button" onClick={() => setTexto("")} className={CLASE_ACCION_SECUNDARIA}>Quitar la búsqueda</button></Vacio>
      ) : (
        <>
          <ContenedorLista etiqueta={def.etiqueta} encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={[{ texto: "#" }, { texto: "Paciente" }, { texto: def.columna, derecha: true }, { texto: "Última visita", derecha: true }]} />}>
            {lista.slice(0, visibles).map((x) => (
              <li key={x.paciente.id} className={"grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 " + COLUMNAS}>
                <span className="text-sm font-bold tabular-nums text-slate-500">{x.lugar}</span>
                <NombrePaciente paciente={x.paciente} onVerPerfil={onVerPerfil} className="block max-w-full" />
                <span className="text-right text-sm font-semibold tabular-nums text-slate-800">{def.unidad(x.valor)}</span>
                <span className="hidden text-right text-sm text-slate-500 lg:block">{ultimaDe(x.paciente)}</span>
              </li>
            ))}
          </ContenedorLista>
          {visibles < n && <div className="px-1"><button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button></div>}
        </>
      )}
    </div>
  )
}
