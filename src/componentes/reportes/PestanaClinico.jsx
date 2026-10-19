"use client"

import { useMemo, useState } from "react"
import { Stethoscope, AlertTriangle, ShieldCheck, Eye } from "lucide-react"
import { Seccion, Caja, SinResultados, NumeroPulsable, REJILLA_TARJETAS_4 } from "./bloques"
import { BarrasLista, BarraRepartida } from "./Graficas"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { nombreMes } from "../../utilidades/formatoFecha"
import { etiquetaCorreccion, AYUDA_CORRECCION } from "../../utilidades/correccion"
import { aniosConConsultas } from "../../utilidades/reportesDiagnosticos"
import { diagnosticosDelPeriodo, diagnosticosPorEdad, diagnosticosPorMes, pacientesPorCorreccion, pacientesControlVencido, pacientesDeAlta, ESTADOS_CORRECCION, GRUPOS_EDAD } from "../../utilidades/reportesDatos"

const COLOR_CORRECCION = { "Bien corregido": "#059669", "Requiere ajuste": "#dc2626", "Sin evaluar": "#475569", "Sin evaluación": "#d97706" }
const LIMITE = 8
const MESES = Array.from({ length: 12 }, (_, i) => i)

// Clínico — "¿Qué atendemos y cómo están nuestros pacientes?": las consultas y los diagnósticos del período (por frecuencia, por mes y
// año y por edad) y, a hoy, cómo están corregidos los pacientes y a quiénes les toca volver.
export default function PestanaClinico({ r }) {
  const { act, ant, cols, abrir, f, historial, tarjeta, hoy } = r
  const d = crearDestinos(r)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [verTodos, setVerTodos] = useState(false)

  const dxPeriodo = useMemo(() => diagnosticosDelPeriodo(act.cons), [act.cons])
  const dxEdad = useMemo(() => diagnosticosPorEdad(act.cons, r.datos.pacientes, LIMITE), [act.cons, r.datos.pacientes])
  const anios = useMemo(() => aniosConConsultas(f.consultas, hoy.getFullYear()), [f.consultas, hoy])
  const dxMensual = useMemo(() => diagnosticosPorMes(f.consultas, anio), [f.consultas, anio])
  const filasMes = verTodos ? dxMensual.filas : dxMensual.filas.slice(0, LIMITE)
  const porCorreccion = useMemo(() => pacientesPorCorreccion(f.pacientes), [f.pacientes])
  const vencidos = useMemo(() => pacientesControlVencido(f.pacientes, historial), [f.pacientes, historial])
  const deAlta = useMemo(() => pacientesDeAlta(f.pacientes), [f.pacientes])

  const abrirConsultas = (titulo, lista, valor = lista.length) => abrir({ titulo, valor, icono: Stethoscope, columnas: cols.consulta, filas: lista, abrirEn: d.consultas() })
  const sinConsultas = f.consultas.length === 0

  return (
    <>
      <Seccion titulo="En el período">
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "Consultas", valor: act.cons.length, ayuda: "Fichas clínicas guardadas en el período.", onClick: () => abrirConsultas("Consultas realizadas", act.cons) }, act.cons.length, ant.cons.length)}
        </div>
      </Seccion>

      <Seccion titulo="Diagnósticos del período">
        <Caja titulo="Más frecuentes" exportar={r.bloque("Diagnósticos más frecuentes",
          () => ({ columnas: [col("Diagnóstico", (x) => x.diagnostico), col("Pacientes", (x) => x.pacientes, "entero")], filas: dxPeriodo }),
          () => ({ columnas: [col("Diagnóstico", (c) => c.__dx), ...cols.consulta], filas: dxPeriodo.flatMap((x) => x.consultas.map((c) => ({ ...c, __dx: x.diagnostico }))) }))} ayuda="Pacientes distintos con cada diagnóstico en las consultas del período. Un paciente con varias fichas cuenta una vez por diagnóstico.">
          {dxPeriodo.length === 0 ? (
            <SinResultados texto={sinConsultas ? "Todavía no hay consultas con diagnóstico. Se llenan al guardar una ficha clínica." : "No hay diagnósticos en este período. Prueba con otro período o quita los filtros."} acciones={sinConsultas ? [] : [{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }, ...(r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [])]} />
          ) : (
            <BarrasLista
              ancho="w-56"
              filas={dxPeriodo.slice(0, LIMITE).map((x) => ({ id: x.clave, etiqueta: x.diagnostico, valor: x.pacientes, tip: `${x.diagnostico}: ${x.pacientes} paciente${x.pacientes === 1 ? "" : "s"}`, x }))}
              onElegir={(b) => abrirConsultas(`Diagnóstico: ${b.etiqueta}`, b.x.consultas, b.valor)}
            />
          )}
        </Caja>

        <Caja
          titulo="Por mes y por año"
          exportar={r.bloque(`Diagnósticos por mes en ${anio}`,
            () => ({ columnas: [col("Diagnóstico", (x) => x.diagnostico), ...MESES.map((m) => col(nombreMes(m, "corto"), (x) => x.meses[m], "entero")), col("Año", (x) => x.anio, "entero")], filas: dxMensual.filas }),
            () => ({ columnas: [col("Diagnóstico", (c) => c.__dx), ...cols.consulta], filas: dxMensual.filas.flatMap((x) => x.consultasAnio.map((c) => ({ ...c, __dx: x.diagnostico }))) }))}
          ayuda="Pacientes distintos con cada diagnóstico, mes a mes, en el año elegido (todo el año, no solo el período). La columna Año cuenta cada paciente una vez."
          derecha={(
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Año
              <select aria-label="Año de los diagnósticos" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200/60 bg-white px-2 text-sm font-normal text-slate-700">
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          )}
        >
          {dxMensual.filas.length === 0 ? (
            <SinResultados texto={`No hay diagnósticos registrados en ${anio}. Elige otro año o quita los filtros.`} acciones={r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : []} />
          ) : (
            <>
              <table className="w-full table-fixed text-sm" aria-label={`Diagnósticos por mes en ${anio}`}>
                <colgroup><col />{MESES.map((m) => <col key={m} style={{ width: 42 }} />)}<col style={{ width: 60 }} /></colgroup>
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="py-2 pr-2 text-left">Diagnóstico</th>
                    {MESES.map((m) => <th key={m} scope="col" className="px-0.5 text-center">{nombreMes(m, "corto")}</th>)}
                    <th scope="col" className="px-0.5 text-right">Año</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasMes.map((x) => (
                    <tr key={x.diagnostico}>
                      <th scope="row" className="truncate py-1.5 pr-2 text-left font-semibold text-slate-700" title={x.diagnostico}>{x.diagnostico}</th>
                      {MESES.map((m) => (
                        <td key={m} className="px-0.5 text-center"><NumeroPulsable texto={x.meses[m] || "·"} valor={x.meses[m]} nombre={`${x.diagnostico}, ${nombreMes(m)} de ${anio}: ${x.meses[m]} pacientes. Ver la lista`} onClick={() => abrirConsultas(`${x.diagnostico} · ${nombreMes(m)} de ${anio}`, x.consultasMes[m], x.meses[m])} /></td>
                      ))}
                      <td className="px-0.5 text-right"><NumeroPulsable valor={x.anio} nombre={`${x.diagnostico}, ${anio}: ${x.anio} pacientes. Ver la lista`} onClick={() => abrirConsultas(`${x.diagnostico} · ${anio}`, x.consultasAnio, x.anio)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dxMensual.filas.length > LIMITE && (
                <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">{verTodos ? "Ver solo los más frecuentes" : `Ver los ${dxMensual.filas.length} diagnósticos`}</button>
              )}
            </>
          )}
        </Caja>

        <Caja titulo="Por grupo de edad" exportar={r.bloque("Diagnósticos por grupo de edad",
          () => { const todos = diagnosticosPorEdad(act.cons, r.datos.pacientes, 1000); return { columnas: [col("Diagnóstico", (x) => x.diagnostico), ...GRUPOS_EDAD.map((g) => col(g.etiqueta, (x) => x.porGrupo[g.id].length, "entero")), col("Sin fecha de nacimiento", (x) => x.porGrupo.sinDato.length, "entero"), col("Total", (x) => x.total, "entero")], filas: todos.filas } },
          () => { const todos = diagnosticosPorEdad(act.cons, r.datos.pacientes, 1000); return { columnas: [col("Diagnóstico", (c) => c.__dx), col("Grupo de edad", (c) => c.__grupo), ...cols.consulta], filas: todos.filas.flatMap((x) => [...GRUPOS_EDAD.map((g) => [g.etiqueta, x.porGrupo[g.id]]), ["Sin fecha de nacimiento", x.porGrupo.sinDato]].flatMap(([grupo, lista]) => lista.map((c) => ({ ...c, __dx: x.diagnostico, __grupo: grupo })))) } })} ayuda="Pacientes distintos con cada diagnóstico en el período, según la edad que tenían el día de la consulta.">
          {dxEdad.filas.length === 0 ? (
            <SinResultados texto="No hay diagnósticos en este período para repartir por edad. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
          ) : (
            <table className="w-full table-fixed text-sm" aria-label="Diagnósticos por grupo de edad">
              <colgroup><col />{GRUPOS_EDAD.map((g) => <col key={g.id} style={{ width: 112 }} />)}{dxEdad.haySinDato && <col style={{ width: 112 }} />}<col style={{ width: 72 }} /></colgroup>
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="py-2 pr-2 text-left">Diagnóstico</th>
                  {GRUPOS_EDAD.map((g) => <th key={g.id} scope="col" className="truncate px-1 text-right">{g.etiqueta}</th>)}
                  {dxEdad.haySinDato && <th scope="col" className="truncate px-1 text-right">Sin edad</th>}
                  <th scope="col" className="px-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dxEdad.filas.map((x) => (
                  <tr key={x.clave}>
                    <th scope="row" className="truncate py-1.5 pr-2 text-left font-semibold text-slate-700" title={x.diagnostico}>{x.diagnostico}</th>
                    {GRUPOS_EDAD.map((g) => <td key={g.id} className="px-1 text-right"><NumeroPulsable valor={x.porGrupo[g.id].length} nombre={`${x.diagnostico}, ${g.etiqueta}: ${x.porGrupo[g.id].length} pacientes. Ver la lista`} onClick={() => abrirConsultas(`${x.diagnostico} · ${g.etiqueta}`, x.porGrupo[g.id])} /></td>)}
                    {dxEdad.haySinDato && <td className="px-1 text-right"><NumeroPulsable valor={x.porGrupo.sinDato.length} nombre={`${x.diagnostico}, sin fecha de nacimiento: ${x.porGrupo.sinDato.length} pacientes. Ver la lista`} onClick={() => abrirConsultas(`${x.diagnostico} · sin fecha de nacimiento`, x.porGrupo.sinDato)} /></td>}
                    <td className="px-1 text-right"><NumeroPulsable valor={x.total} nombre={`${x.diagnostico}: ${x.total} pacientes en total. Ver la lista`} onClick={() => abrirConsultas(`${x.diagnostico} · todas las edades`, Object.values(x.porGrupo).flat(), x.total)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Caja>
      </Seccion>

      <Seccion titulo="Los pacientes hoy" ayuda="Estado de hoy: no cambia con el período. Sí sigue el motivo, el origen, la visita y el profesional elegidos.">
        <Caja titulo="Estado de corrección" exportar={r.bloque("Estado de corrección",
          () => ({ columnas: [col("Estado", (x) => etiquetaCorreccion(x)), col("Pacientes", (x) => porCorreccion[x].length, "entero")], filas: ESTADOS_CORRECCION }),
          () => ({ columnas: [col("Estado de corrección", (p) => p.__estado), ...cols.paciente], filas: ESTADOS_CORRECCION.flatMap((e) => porCorreccion[e].map((p) => ({ ...p, __estado: etiquetaCorreccion(e) }))) }))} aHoy ayuda="Cómo ve cada paciente con la corrección de su última ficha (con la receta nueva; en fichas anteriores, con sus lentes). Sin evaluar: tuvo consulta pero no se anotó su agudeza visual. Sin consulta: nunca se ha atendido.">
          {f.pacientes.length === 0 ? (
            <SinResultados texto="Todavía no hay pacientes con estos filtros. Se registran desde Pacientes." acciones={r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [{ etiqueta: "Ir a Pacientes", onClick: () => r.onAbrirModulo?.("pacientes", {}) }]} />
          ) : (
            <BarraRepartida
              segmentos={ESTADOS_CORRECCION.map((e) => ({ id: e, etiqueta: etiquetaCorreccion(e), valor: porCorreccion[e].length, color: COLOR_CORRECCION[e], tip: `${etiquetaCorreccion(e)}: ${porCorreccion[e].length}${AYUDA_CORRECCION[e] ? ` · ${AYUDA_CORRECCION[e]}` : ""}`, lista: porCorreccion[e], estado: e }))}
              onElegir={(s) => abrir({ titulo: s.etiqueta, valor: s.valor, icono: Eye, columnas: cols.paciente, filas: s.lista, abrirEn: d.pacientes({ correccion: s.estado }), filtros: `A hoy · ${r.filtrosTexto}` })}
            />
          )}
        </Caja>
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "Control vencido", aHoy: true, valor: vencidos.length, ayuda: "Pacientes cuyo próximo control recomendado ya pasó. No incluye a los que tienen el tratamiento finalizado.", onClick: () => abrir({ titulo: "Control vencido", valor: vencidos.length, icono: AlertTriangle, columnas: cols.controlVencido, filas: vencidos, abrirEn: d.pacientes({ rapido: "ControlVencido" }), filtros: `A hoy · ${r.filtrosTexto}` }) })}
          {tarjeta({ titulo: "Tratamientos finalizados", aHoy: true, valor: deAlta.length, ayuda: "Pacientes dados de alta desde la ficha clínica (casilla Tratamiento finalizado).", onClick: () => abrir({ titulo: "Tratamientos finalizados", valor: deAlta.length, icono: ShieldCheck, columnas: cols.paciente, filas: deAlta, abrirEn: d.pacientes({ estado: "De alta" }), filtros: `A hoy · ${r.filtrosTexto}` }) })}
        </div>
      </Seccion>
    </>
  )
}
