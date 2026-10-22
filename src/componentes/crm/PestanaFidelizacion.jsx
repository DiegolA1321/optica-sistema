"use client"

import { useMemo, useState } from "react"
import { Gift, Search, Star, Users } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { ConteoCitas } from "../FiltrosCitas"
import { NombrePaciente } from "./piezas"
import { CLASE_PILDORA } from "./estilosCrm"
import { rankingFrecuentes, rankingReferidores } from "../../utilidades/crmContactos"
import { useFidelidadCon } from "../FidelidadContexto"

// El ranking de puntos con las reglas del programa de la óptica (Configuración › Fidelización): consultas, referidos y lo pagado.
const rankingPuntajePrograma = (pacientes, de) => pacientes.map((p) => ({ paciente: p, valor: de(p).puntos.total })).filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor || a.paciente.nombre.localeCompare(b.paciente.nombre))
import { fechaLegible } from "../../utilidades/formatoFecha"
import { MINIMO_CLIENTE_FRECUENTE, ultimaVisita } from "../../utilidades/fidelizacion"
import { fechaAISO } from "../../utilidades/disponibilidad"

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

// Pestaña "Fidelización": los rankings completos (con todos los nombres) y el puntaje. Es para conocer a los mejores pacientes, no una lista de tareas:
// por eso aquí no hay botones de contacto.
export default function PestanaFidelizacion({ pacientes, consultas, onVerPerfil }) {
  const { de } = useFidelidadCon({ pacientes, consultas })
  const [vista, setVista] = useState("puntaje")
  const [texto, setTexto] = useState("")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const rankings = useMemo(() => ({
    puntaje: rankingPuntajePrograma(pacientes, de), frecuentes: rankingFrecuentes(pacientes, consultas), referidores: rankingReferidores(pacientes),
  }), [pacientes, consultas, de])
  const def = VISTAS[vista]
  const ultimaDe = (p) => { const f = ultimaVisita(p, consultas); return f ? fechaLegible(fechaAISO(f)) : "—" }
  const buscando = texto.trim() !== ""
  const lista = useMemo(() => {
    const q = sinTildes(texto.trim())
    // El lugar es el del ranking completo, no el de la búsqueda: buscar a alguien no lo manda al primer puesto.
    return rankings[vista].map((x, i) => ({ ...x, lugar: i + 1 })).filter((x) => !q || sinTildes(x.paciente.nombre).includes(q))
  }, [rankings, vista, texto])
  const n = lista.length
  const cambiarVista = (id) => { setVista(id); setVisibles(POR_PAGINA) }

  return (
    <div className="space-y-3">
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
          <span className="hidden text-xs text-slate-500 sm:inline">{def.ayuda}</span>
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
