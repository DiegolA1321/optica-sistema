"use client"

import { useMemo } from "react"
import { CalendarDays, CalendarCheck, CalendarX, CalendarClock, CalendarOff, Percent } from "lucide-react"
import { Seccion, Caja, SinResultados, NumeroPulsable, TablaNumeros, REJILLA_TARJETAS } from "./bloques"
import { BarrasMes, BarraRepartida, CuadriculaDiaHora } from "./Graficas"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { responsableDeCita } from "../../utilidades/filtrosCitas"
import { nombreDeMiembro } from "../../utilidades/equipo"
import { hora } from "../../utilidades/formatoFecha"
import { cuadriculaInasistencias, tendenciaInasistencia, resumenCitasPor, efectividadControles, ORIGENES, VISITAS } from "../../utilidades/reportesDatos"
import { coincideSeguimiento } from "../../utilidades/filtrosCitas"
import { porcentaje } from "../../utilidades/reportesPeriodo"

const pct = (n) => (n == null ? "—" : `${n}%`)

// Citas — "¿Cómo usamos la agenda y quién viene?": cuántas citas hubo y cómo terminaron, cuándo fallan los pacientes (para saber
// cuándo reforzar los recordatorios), de dónde vienen, cuántos vuelven a su control y cómo le va a cada profesional.
export default function PestanaCitas({ r }) {
  const { act, ant, cols, abrir, f, datos, hoy, rango, esAdmin, equipo, tarjeta } = r
  const d = crearDestinos(r)
  const dc = (estado, extra = {}, rg) => { const x = d.citas(estado, rg); return { ...x, params: { ...x.params, ...extra } } }

  const tendencia = useMemo(() => tendenciaInasistencia(f.citas, hoy), [f.citas, hoy])
  const cuadricula = useMemo(() => cuadriculaInasistencias(act.cs), [act.cs])
  const porOrigen = useMemo(() => resumenCitasPor(act.cs, ORIGENES, (c) => c.origen), [act.cs])
  const porVisita = useMemo(() => resumenCitasPor(act.cs, VISITAS, (c) => (coincideSeguimiento(c, "primera", r.historial) ? "primera" : "seguimiento")), [act.cs, r.historial])
  const controles = useMemo(() => efectividadControles({ consultas: f.consultas, citas: datos.citas, pacientes: datos.pacientes, rango }), [f.consultas, datos.citas, datos.pacientes, rango])
  const porProfesional = useMemo(() => {
    const ids = [...new Set(act.cs.map((c) => responsableDeCita(c)))]
    const claves = ids.map((id) => ({ id: id ?? "ninguno", etiqueta: id ? nombreDeMiembro(equipo, id) || "Persona que ya no está en el equipo" : "Sin asignar", real: id }))
    return resumenCitasPor(act.cs, claves, (c) => responsableDeCita(c) ?? "ninguno").sort((a, b) => b.citas.length - a.citas.length)
  }, [act.cs, equipo])

  const abrirCitas = (titulo, lista, destino, columnas = cols.cita, valor = lista.length) => abrir({ titulo, valor, icono: CalendarDays, columnas, filas: lista, abrirEn: destino })
  // Los datos y el detalle de una tabla de grupos (origen, visita, profesional).
  const datosGrupos = (etiqueta, grupos) => () => ({ columnas: [col(etiqueta, (g) => g.etiqueta), col("Citas", (g) => g.citas.length, "entero"), col("Atendidas", (g) => g.atendidas.length, "entero"), col("No efectuadas", (g) => g.noAsistio.length, "entero"), col("Tasa de citas no efectuadas", (g) => g.tasa, "tasa")], filas: grupos })
  const detalleGrupos = (etiqueta, grupos) => () => ({ columnas: [col(etiqueta, (c) => c.__grupo), ...cols.cita], filas: grupos.flatMap((g) => g.citas.map((c) => ({ ...c, __grupo: g.etiqueta }))) })
  const canceladasPaciente = act.canceladas.filter((c) => c.canceladaPor === "paciente").length

  if (act.cs.length === 0 && f.citas.length === 0) {
    return <SinResultados texto={r.hay ? "Ninguna cita coincide con estos filtros. Quita algún filtro para ver más." : "Todavía no hay citas registradas. Se crean desde Citas médicas o cuando un paciente reserva en línea."} acciones={r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [{ etiqueta: "Ir a Citas médicas", onClick: () => r.onAbrirModulo?.("citas", {}) }]} />
  }

  return (
    <>
      <Seccion titulo="Citas del período">
        <div className={REJILLA_TARJETAS}>
          {tarjeta({ titulo: "Citas", valor: act.programadas.length, ayuda: "Citas con fecha en el período, sin las canceladas (esas se cuentan aparte). Es la suma de Atendidas, No efectuadas y Pendientes.", onClick: () => abrirCitas("Citas del período", act.programadas, dc("todas")) }, act.programadas.length, ant.programadas.length)}
          {tarjeta({ titulo: "Atendidas", valor: act.atendidas.length, ayuda: "Citas en las que el paciente fue atendido: la ficha clínica se guardó.", onClick: () => abrirCitas("Atendidas", act.atendidas, dc("atendida")) }, act.atendidas.length, ant.atendidas.length)}
          {tarjeta({ titulo: "No efectuadas", valor: act.noAsistio.length, ayuda: "Citas que no se realizaron: nadie las abrió antes de terminar su horario o la atención se inició y no se terminó. Se marcan solas.", onClick: () => abrirCitas("No efectuadas", act.noAsistio, dc("noAsistio")) }, act.noAsistio.length, ant.noAsistio.length, { buenoSiSube: false })}
          {tarjeta({ titulo: "Pendientes", valor: act.pendientes.length, ayuda: "Citas todavía por atender: pendientes, en espera o en atención.", onClick: () => abrirCitas("Pendientes", act.pendientes, dc("abiertas")) }, act.pendientes.length, ant.pendientes.length, { buenoSiSube: false })}
          {tarjeta({ titulo: "Canceladas", aparte: true, valor: act.canceladas.length, sub: `${canceladasPaciente} paciente · ${act.canceladas.length - canceladasPaciente} óptica`, ayuda: "Citas canceladas por el paciente o por la óptica. No suman en las demás tarjetas.", onClick: () => abrirCitas("Canceladas", act.canceladas, dc("cancelada"), cols.citaCancelada) })}
          {tarjeta({ titulo: "Tasa de citas no efectuadas", valor: pct(act.tasaInasist), sub: act.tasaInasist == null ? "Sin citas en el período" : undefined, ayuda: "De las citas del período que no se cancelaron, cuántas terminaron en No efectuada.", onClick: () => abrir({ titulo: `No efectuada: ${act.noAsistio.length} de ${act.programadas.length} citas`, valor: pct(act.tasaInasist), icono: Percent, columnas: cols.cita, filas: act.noAsistio, abrirEn: dc("noAsistio") }) }, act.tasaInasist ?? undefined, ant.tasaInasist, { buenoSiSube: false, puntos: true })}
        </div>
      </Seccion>

      <Seccion titulo="Cuándo fallan los pacientes">
        <Caja titulo="Citas no efectuadas por mes" exportar={r.bloque("Citas no efectuadas por mes", () => ({ columnas: [col("Mes", (m) => m.etiqueta), col("Citas", (m) => m.programadas.length, "entero"), col("No efectuadas", (m) => m.noAsistio.length, "entero"), col("Tasa de citas no efectuadas", (m) => m.tasa, "tasa")], filas: tendencia }), () => ({ columnas: cols.cita, filas: tendencia.flatMap((m) => m.programadas) }))} ayuda="Porcentaje de citas (sin las canceladas) que terminaron en No efectuada, mes a mes, en los últimos 12 meses con los filtros elegidos.">
          <BarrasMes
            datos={tendencia.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.tasa ?? 0, texto: pct(m.tasa), color: "#dc2626", tip: m.programadas.length ? `${m.etiqueta}: ${m.noAsistio.length} no efectuadas de ${m.programadas.length} citas (${m.tasa}%)` : `${m.etiqueta}: sin citas`, m }))}
            onElegir={(b) => abrir({ titulo: `No efectuadas · ${b.etiqueta}: ${b.m.noAsistio.length} de ${b.m.programadas.length} citas`, valor: pct(b.m.tasa), icono: CalendarX, columnas: cols.cita, filas: b.m.noAsistio, abrirEn: dc("noAsistio", {}, b.m) })}
          />
        </Caja>
        <Caja titulo="Citas no efectuadas por día y hora" exportar={r.bloque("Citas no efectuadas por día y hora",
          () => ({ columnas: [col("Día", (x) => x.dia), col("Hora", (x) => x.hora), col("Citas", (x) => x.citas, "entero"), col("No efectuadas", (x) => x.noAsistio, "entero"), col("Tasa de citas no efectuadas", (x) => x.tasa, "tasa")], filas: cuadricula.dias.flatMap((d) => cuadricula.horas.map((h) => { const c = cuadricula.celdas.get(`${d.id}-${h}`); return c ? { dia: d.etiqueta, hora: hora(`${h}:00`), citas: c.citas.length, noAsistio: c.noAsistio.length, tasa: porcentaje(c.noAsistio.length, c.citas.length) } : null }).filter(Boolean)) }),
          () => ({ columnas: cols.cita, filas: act.programadas }))} ayuda="Cuántas citas no se efectuaron en cada día de la semana y hora, en el período. Cuanto más rojo, más citas no efectuadas: ahí conviene reforzar los recordatorios.">
          {cuadricula.dias.length === 0
            ? <SinResultados texto="No hay citas en este período para armar la cuadrícula. Prueba con un período más largo." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
            : <CuadriculaDiaHora cuadricula={cuadricula} onElegir={({ dia, hora: h, celda, tip }) => abrir({ titulo: `No efectuadas · ${dia.etiqueta} ${hora(`${h}:00`)}: ${celda.noAsistio.length} de ${celda.citas.length} citas`, valor: celda.noAsistio.length, icono: CalendarX, columnas: cols.cita, filas: celda.noAsistio, abrirEn: dc("noAsistio"), filtros: `${tip} · ${r.filtrosTexto}` })} />}
        </Caja>
      </Seccion>

      <Seccion titulo="Quién viene">
        <div className="grid gap-3 lg:grid-cols-2">
          <TablaDeGrupos titulo="Por origen" exportar={r.bloque("Citas por origen", datosGrupos("Origen", porOrigen), detalleGrupos("Origen", porOrigen))} ayuda="De dónde llegó la cita: Web (la reservó el paciente) o Recepción (la agendó el personal). Mismo criterio que el filtro Origen de Citas." grupos={porOrigen} etiquetaGrupo="Origen" abrirLista={(g, lista, nombre, valor) => abrirCitas(`${g.etiqueta} · ${nombre}`, lista, dc(nombre === "No efectuadas" ? "noAsistio" : nombre === "Atendidas" ? "atendida" : "todas", { origen: g.id }), cols.cita, valor)} />
          <TablaDeGrupos titulo="Por tipo de visita" exportar={r.bloque("Citas por tipo de visita", datosGrupos("Visita", porVisita), detalleGrupos("Visita", porVisita))} ayuda="Primera vez: el paciente no tenía ninguna atención antes de esa cita. Seguimiento: ya se había atendido. Mismo criterio que el filtro Visita de Citas." grupos={porVisita} etiquetaGrupo="Visita" abrirLista={(g, lista, nombre, valor) => abrirCitas(`${g.etiqueta} · ${nombre}`, lista, dc(nombre === "No efectuadas" ? "noAsistio" : nombre === "Atendidas" ? "atendida" : "todas", { visita: g.id }), cols.cita, valor)} />
        </div>
      </Seccion>

      <Seccion titulo="Controles">
        <Caja titulo="Efectividad de los controles" exportar={r.bloque("Efectividad de los controles", () => ({ columnas: [col("Control", (x) => x.n), col("Pacientes", (x) => x.v, "entero")], filas: [{ n: "Controles que vencían", v: controles.filas.length }, { n: "Agendaron", v: controles.agendaron.length }, { n: "Sin agendar", v: controles.sinAgendar.length }] }), () => ({ columnas: cols.control, filas: controles.filas }))} ayuda="De los pacientes cuyo control recomendado vencía en el período, cuántos ya agendaron o volvieron. Un control vence a los días que indicó el optómetra en su última ficha.">
          {controles.filas.length === 0 ? (
            <SinResultados texto="Ningún control vencía en este período. Prueba con un período más largo." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                <NumeroPulsable valor={controles.agendaron.length} nombre={`Agendaron: ${controles.agendaron.length}. Ver la lista`} onClick={() => abrir({ titulo: `Agendaron su control: ${controles.agendaron.length} de ${controles.filas.length}`, valor: pct(porcentaje(controles.agendaron.length, controles.filas.length)), icono: CalendarCheck, columnas: cols.control, filas: controles.agendaron })} />
                {" "}de{" "}
                <NumeroPulsable valor={controles.filas.length} nombre={`Controles que vencían: ${controles.filas.length}. Ver la lista`} onClick={() => abrir({ titulo: "Controles que vencían en el período", valor: controles.filas.length, icono: CalendarClock, columnas: cols.control, filas: controles.filas })} />
                {" "}pacientes cuyo control vencía en el período agendaron ({pct(porcentaje(controles.agendaron.length, controles.filas.length))}).
              </p>
              <BarraRepartida
                segmentos={[
                  { id: "si", etiqueta: "Agendaron", valor: controles.agendaron.length, color: "#059669", tip: `Agendaron: ${controles.agendaron.length}` },
                  { id: "no", etiqueta: "Sin agendar", valor: controles.sinAgendar.length, color: "#d97706", tip: `Sin agendar: ${controles.sinAgendar.length}` },
                ]}
                onElegir={(s) => abrir({ titulo: s.etiqueta, valor: s.valor, icono: s.id === "si" ? CalendarCheck : CalendarOff, columnas: cols.control, filas: s.id === "si" ? controles.agendaron : controles.sinAgendar })}
              />
            </div>
          )}
        </Caja>
      </Seccion>

      {esAdmin && (
        <Seccion titulo="Por profesional">
          <Caja titulo="Citas, atendidas y no efectuadas por profesional" exportar={r.bloque("Citas por profesional", datosGrupos("Profesional", porProfesional), detalleGrupos("Profesional", porProfesional))} ayuda="Cada cita cuenta para una sola persona: quien la atendió o, si todavía no, a quien está asignada. Mismo criterio que el filtro Profesional de Citas.">
            <TablaDeGrupos grupos={porProfesional} etiquetaGrupo="Profesional" sinCaja abrirLista={(g, lista, nombre, valor) => abrirCitas(`${g.etiqueta} · ${nombre}`, lista, dc(nombre === "No efectuadas" ? "noAsistio" : nombre === "Atendidas" ? "atendida" : "todas", { profesional: g.real || "ninguno" }), cols.cita, valor)} />
          </Caja>
        </Seccion>
      )}
    </>
  )
}

// Una tabla de grupos de citas (origen, visita o profesional): citas, atendidas, no efectuadas y su tasa. Cada número se pulsa.
function TablaDeGrupos({ titulo, ayuda, grupos, etiquetaGrupo, abrirLista, exportar, sinCaja = false }) {
  const tabla = (
    <TablaNumeros titulos={[etiquetaGrupo, "Citas", "Atendidas", "No efectuadas", "Tasa"]} anchoNumeros={86} etiqueta={titulo || etiquetaGrupo}>
      {grupos.map((g) => (
        <tr key={g.id}>
          <th scope="row" className="truncate py-2 pr-2 text-left font-semibold text-slate-700" title={g.etiqueta}>{g.etiqueta}</th>
          <td className="px-1 text-right"><NumeroPulsable valor={g.citas.length} nombre={`${g.etiqueta}: ${g.citas.length} citas. Ver la lista`} onClick={() => abrirLista(g, g.citas, "Citas")} /></td>
          <td className="px-1 text-right"><NumeroPulsable valor={g.atendidas.length} nombre={`${g.etiqueta}: ${g.atendidas.length} atendidas. Ver la lista`} onClick={() => abrirLista(g, g.atendidas, "Atendidas")} /></td>
          <td className="px-1 text-right"><NumeroPulsable valor={g.noAsistio.length} nombre={`${g.etiqueta}: ${g.noAsistio.length} no efectuadas. Ver la lista`} onClick={() => abrirLista(g, g.noAsistio, "No efectuadas")} /></td>
          <td className="px-1 text-right"><NumeroPulsable valor={g.noAsistio.length} texto={pct(g.tasa)} nombre={`${g.etiqueta}: tasa de citas no efectuadas ${pct(g.tasa)}. Ver la lista`} onClick={() => abrirLista(g, g.noAsistio, "No efectuadas", pct(g.tasa))} /></td>
        </tr>
      ))}
    </TablaNumeros>
  )
  return sinCaja ? tabla : <Caja titulo={titulo} ayuda={ayuda} exportar={exportar}>{tabla}</Caja>
}
