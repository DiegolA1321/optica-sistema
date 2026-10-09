"use client"

import { fechaHoraLegible, fechaCorta, fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { useState, useEffect, useMemo } from "react"
import {
  Users,
  Calendar,
  Package,
  ArrowRight,
  Cake,
  Clock,
  Activity,
  FlaskConical,
  ShoppingBag,
  FileText,
  Wallet,
  CheckCircle2,
  UserX,
  Ban,
  UserCheck,
  CalendarOff,
} from "lucide-react"
import ConfirmarDatosPacienteModal from "../componentes/ConfirmarDatosPacienteModal"
import { diasDesdeUltimaVisita, esInactivo } from "../utilidades/fidelizacion"
import { controlesSinAgendar, asignadoDelControl, citasParaReagendar } from "../utilidades/controles"
import { fechaAISO, hoyISO, esHoy } from "../utilidades/disponibilidad"
import { citasPorReasignar } from "../utilidades/reasignacion"
import { miembrosActivos } from "../utilidades/equipo"
import ReasignarCitasModal from "../componentes/ReasignarCitasModal"
import { parseFechaFlexible } from "../utilidades/disponibilidad"
import { esStockBajo, UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { supabase } from "../lib/supabaseClient"
import { etiquetaMiembro } from "../utilidades/equipo"
import { atencionesAbiertasAntiguas, textoAtencionAbierta, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import FilaTarjetas from "../componentes/FilaTarjetas"
import RequiereAtencion from "../componentes/RequiereAtencion"
import RequiereAtencionPorArea from "../componentes/RequiereAtencionPorArea"
import { puede } from "../utilidades/permisosUi"
import { textoDiagnostico, textoEspera, diasEnEspera } from "../utilidades/pasesVenta"
import { plantillaInicio, citasPropias, esCitaPropia, resumenHoy, resumenPeriodo, citasParaLista, creadosEsteMes, PERIODOS_DESENLACE, agendaHoyOProximas, fichasSinTerminar, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "../utilidades/inicio"
import { NOMBRE_MODULO } from "../utilidades/logs"
import { ordenesAtrasadas, ordenesListasSinAvisar, atrasosPorLaboratorio } from "../utilidades/ordenesLaboratorio"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  onVerPacientes,
  setPacientes,
  umbralStock = UMBRAL_STOCK_BAJO,
  setVista,
  setCitas,
  onAviso,
  onAtenderCita,
  onAtenderEnCitas,
  equipo = [],
  usuario,
  opticaActiva = true,
  cargaInicial = false,
  pacientes = [],
  citas = [],
  inventario = [],
  consultas = [],
  onAgendarRapido,
  onAgendarControl,
  onReagendarCancelada,
  onCrearPacienteRapido,
  onCrearProductoRapido,
  onReabastecerProducto,
  onVerPerfilPaciente,
  ordenesLab = [],
  onVerOrdenes,
  onVerSaldos,
  onVerStockBajo,
  vista = null,
  pases = [],
  facturasVenta = [],
  abonos = [],
  onVerCola,
  onVerCitas,
  nombreUsuario = "Diego",
  opticaNombre,
  disponibilidad,
  puedeReasignarCitas = false,
}) {
  const [cumpleaneros, setCumpleaneros] = useState([])
  // Período del "Desenlace de las citas" y de la lista de abajo: hoy, esta semana, este mes o todas.
  const [periodo, setPeriodo] = useState("hoy")
  // Tarjeta del desenlace elegida (atendida | noAsistio | cancelada): la lista de citas de abajo muestra solo esas. Volver a tocarla la quita.
  const [tarjeta, setTarjeta] = useState(null)

  // "Actividad reciente" (sección 6 del pedido de UI: qué cambió, no solo
  // el número actual) — reusa logs_optica, la misma fuente que ya
  // alimenta "Actividad" en Usuarios.jsx. RLS solo la deja leer al admin
  // principal, así que además de pedirla solo para ese rol acá, el propio
  // RLS es la red de seguridad real si algún día cambia el gate del lado
  // del cliente.
  const esAdmin = usuario?.rol === "admin"
  const listasSinAvisar = useMemo(() => ordenesListasSinAvisar(ordenesLab), [ordenesLab])
  const atrasadas = useMemo(() => ordenesAtrasadas(ordenesLab), [ordenesLab])
  // D4 (reunión 29 sept.): "optómetra" es un flag (perfiles.es_optometra) que
  // puede tener tanto un admin como un asistente — no un tercer rol. Un
  // asistente marcado como tal ve su agenda del día en vez de la vista
  // global del equipo; un admin marcado la ve ADEMÁS de la vista global
  // (nunca pierde su vista de equipo, solo gana la sección "Mi agenda").
  const esOptometra = !!usuario?.esOptometra
  const [actividadReciente, setActividadReciente] = useState([])
  useEffect(() => {
    if (!esAdmin || !supabase || !usuario?.opticaId) return
    supabase
      .from("logs_optica")
      .select("*")
      .eq("optica_id", usuario.opticaId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setActividadReciente(data || []))
  }, [esAdmin, usuario?.opticaId])

  // Ventana de cumpleaños: -5 a +7 días, igual que CRM.jsx y el centro de
  // notificaciones de Dashboard.jsx (antes esta lista solo miraba 5 días
  // hacia atrás, así que un cumpleaños de HOY dejaba de listarse aquí en
  // cuanto pasaba la medianoche del día siguiente).
  useEffect(() => {
    const obtenerCumpleaneros = () => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      return pacientes
        .map((paciente) => {
          const fn = paciente.fecha_nacimiento || paciente.fechaNacimiento
          if (!fn) return null
          const partes = String(fn).split(/[-/T]/)
          if (partes.length < 3) return null
          const mesPac = Number.parseInt(partes[1], 10)
          const diaPac = Number.parseInt(partes[2], 10)
          if (!mesPac || !diaPac) return null

          let dias = null
          for (const yr of [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1]) {
            const candidato = new Date(yr, mesPac - 1, diaPac)
            candidato.setHours(0, 0, 0, 0)
            const diff = Math.round((candidato - hoy) / 86400000)
            if (diff >= -5 && diff <= 7 && (dias === null || Math.abs(diff) < Math.abs(dias))) dias = diff
          }
          if (dias === null) return null

          const nacimiento = new Date(fn)
          let edad = "N/A"
          if (!isNaN(nacimiento.getTime())) {
            let calc = hoy.getFullYear() - nacimiento.getFullYear()
            const m = hoy.getMonth() - nacimiento.getMonth()
            if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) calc--
            edad = calc
          }
          return { ...paciente, edad, diasCumple: dias, esHoy: dias === 0 }
        })
        .filter(Boolean)
        .sort((a, b) => a.diasCumple - b.diasCumple)
    }

    setCumpleaneros(obtenerCumpleaneros())
  }, [pacientes])

  // Controles que el optómetra dejó "para agendar después" (o cuya cita se canceló) y siguen sin cita.
  const sinAgendar = useMemo(() => controlesSinAgendar(pacientes, consultas, citas), [pacientes, consultas, citas])
  const paraReagendar = useMemo(() => citasParaReagendar(citas), [citas])

  // Pacientes que no visitan hace tiempo (adherencia a controles visuales)
  const inactivos = useMemo(() => {
    return pacientes
      .filter((p) => esInactivo(p, consultas))
      .map((p) => ({ paciente: p, dias: diasDesdeUltimaVisita(p, consultas) }))
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
  }, [pacientes, consultas])

  // Productos con stock bajo (por debajo de su mínimo), el más crítico primero. Se muestran una sola vez en
  // todo el Inicio, como una fila de "Requiere tu atención", con el reabastecimiento a un clic.
  const productosBajoStock = useMemo(() => inventario.filter((p) => esStockBajo(p, umbralStock)).sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0)), [inventario, umbralStock])

  // Para "Mi agenda" (vista del optómetra, D4): pacientes en atención ahora
  // mismo (no acotado a hoy, mismo criterio sin fecha que ya usa el badge de
  // Citas.jsx) y lo que todavía le falta atender de la agenda de hoy.
  const pacientesEnAtencion = useMemo(() => citas.filter((c) => c.estado === "En Atención" && diasAtencionAbierta(c) === null), [citas])
  // Atenciones que se abrieron un día anterior y nadie cerró.
  const atencionesAntiguas = useMemo(() => atencionesAbiertasAntiguas(citas), [citas])
  const [dejarCita, setDejarCita] = useState(null)
  const [reasignarGrupo, setReasignarGrupo] = useState(null) // { fecha, personaId, personaNombre, citas } de una ausencia con citas por pasar
  const [confirmarPaciente, setConfirmarPaciente] = useState(null) // paciente de la web cuyos datos recepción aún no confirma
  // Señal de "qué cambió" en el KPI de pacientes (antes solo mostraba el
  // número del momento, sin ningún punto de comparación) — cuántos se
  // registraron este mes calendario, contra fechaRegistro real.
  const pacientesEsteMes = useMemo(() => {
    const hoy = new Date()
    return pacientes.filter((p) => {
      const f = parseFechaFlexible(p.fechaRegistro)
      return f && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
    }).length
  }, [pacientes])

  // Fila de una cita — compartida entre "Últimas citas / Agenda cercana" (que
  // puede mostrar historial cuando no hay nada hoy) y "Mi agenda" (siempre
  // hoy, así que mostrarFecha va fijo en false).
  // accion (opcional): botón al costado de la fila, p. ej. "Atender" en la agenda del optómetra.
  const renderFilaCita = (cita, idx, mostrarFecha, accion = null) => (
    <div key={cita.id || idx} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 py-1.5 first:pt-0 last:pb-0">
    <button
      type="button"
      onClick={() => (cita.pacienteId && onVerPerfilPaciente ? onVerPerfilPaciente(cita.pacienteId) : setVista?.("citas"))}
      title={cita.pacienteId ? `Ver ficha de ${cita.paciente || cita.nombre}` : "Ver en la agenda completa"}
      className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50/80 cursor-pointer"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex w-20 flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5 font-mono text-xs font-bold text-slate-700 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
          <span>{cita.hora || "09:00 AM"}</span>
          {mostrarFecha ? (
            <span className="font-sans text-[10px] font-medium text-slate-500">
              {(() => { const f = parseFechaFlexible(cita.fecha); return f ? fechaCorta(f) : "" })()}
            </span>
          ) : (
            cita.espera && <span className="font-sans text-[10px] font-medium text-amber-600">{cita.espera} esp</span>
          )}
        </div>
        <div className={"flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 font-mono text-xs font-bold " + (cita.colorAvatar || "bg-blue-50 text-blue-600")}>
          {cita.iniciales || (cita.paciente || cita.nombre || "P").substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-800">{cita.paciente || cita.nombre}</h5>
          <p className="text-[11px] text-slate-500">{cita.motivo || "Consulta general"}</p>
        </div>
      </div>
      {/* Mismo criterio de color usado en Citas.jsx/Pacientes.jsx esta
          sesión: Pendiente=ámbar (acá caía en gris por defecto,
          cuarta repetición del mismo patrón encontrada en el sistema). */}
      <span className={"rounded-full px-3 py-1 text-[11px] font-bold " + (
        cita.estado === "En Espera" ? "border border-violet-200/60 bg-violet-50 text-violet-700"
          : cita.estado === "En Atención" ? "border border-blue-200/60 bg-blue-50 text-blue-700"
          : cita.estado === "Atendida" ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
          : cita.estado === "No Asistió" ? "border border-red-200/60 bg-red-50 text-red-700"
          : cita.estado === "Cancelada" ? "border border-slate-200/60 bg-slate-50 text-slate-600"
          : "border border-amber-200/60 bg-amber-50 text-amber-700")}>
        {cita.estado || "Pendiente"}
      </span>
    </button>
    {accion && <button type="button" onClick={accion.onClick} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer">{accion.etiqueta}</button>}
    </div>
  )


  // ─── Inicio por rol (R52-R56) ───
  // La vista activa decide qué Inicio se ve; cada fila de tarjetas habla de una sola cosa y lo dice en su título.
  const plantilla = plantillaInicio(vista, usuario)
  const veCitas = puede(usuario, "citas", "ver")
  const veVentas = puede(usuario, "ventas", "ver")
  const veInventario = puede(usuario, "inventario", "ver")
  const veCrm = puede(usuario, "crm", "ver")
  const esVistaOptometra = plantilla === "optometra"
  const citasVista = useMemo(() => (esVistaOptometra ? citasPropias(citas, usuario?.id) : citas), [citas, esVistaOptometra, usuario?.id])
  const hoyVista = useMemo(() => resumenHoy(citasVista), [citasVista])
  const desenlace = useMemo(() => resumenPeriodo(citasVista, periodo), [citasVista, periodo])
  const citasLista = useMemo(() => citasParaLista(citasVista, periodo, tarjeta), [citasVista, periodo, tarjeta])
  const sinAtender = useMemo(() => pacientesSinAtender(pacientes, consultas).length, [pacientes, consultas])
  const saldos = useMemo(() => saldosPorCobrar(facturasVenta, abonos), [facturasVenta, abonos])
  const listos = useMemo(() => pasesListos(pases), [pases])
  const proformas = useMemo(() => proformasEnSeguimiento(pases), [pases])
  const atencionesVista = esVistaOptometra ? atencionesAntiguas.filter(({ cita }) => esCitaPropia(cita, usuario?.id)) : atencionesAntiguas
  const dinero = (n) => "$" + (Number(n) || 0).toFixed(2)
  // Las tarjetas solo llevan a su lista (un clic en cualquier parte). Las acciones de crear van aparte, como atajos, para
  // que una misma tarjeta no haga dos cosas distintas según dónde se toque.
  const atajosAdmin = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos">
      {puede(usuario, "pacientes", "crear") && <button type="button" onClick={onCrearPacienteRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Users size={14} aria-hidden="true" /> Registrar paciente</button>}
      {puede(usuario, "citas", "crear") && <button type="button" onClick={onAgendarRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Calendar size={14} aria-hidden="true" /> Agendar cita</button>}
      {puede(usuario, "inventario", "crear") && <button type="button" onClick={onCrearProductoRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Package size={14} aria-hidden="true" /> Añadir producto</button>}
    </div>
  )
  // Cuánto se dio de alta este mes: cada total lo dice junto al número, con la misma lógica en las tres tarjetas.
  const citasEsteMes = useMemo(() => creadosEsteMes(citas, "creadoEn"), [citas])
  const productosEsteMes = useMemo(() => creadosEsteMes(inventario, "creadoEn"), [inventario])
  const filaTotales = (
    <FilaTarjetas
      titulo="Totales"
      descripcion="Todo lo registrado y lo nuevo de este mes"
      acciones={atajosAdmin}
      tarjetas={[
        { id: "pacientes", titulo: "Pacientes registrados", valor: pacientes.length, desc: `+${pacientesEsteMes} este mes`, icono: Users, color: "slate", onClick: () => setVista?.("pacientes") },
        { id: "citas", titulo: "Citas registradas", valor: citas.length, desc: `+${citasEsteMes} este mes`, icono: Calendar, color: "blue", onClick: () => setVista?.("citas") },
        { id: "productos", titulo: "Productos en inventario", valor: inventario.length, desc: `+${productosEsteMes} este mes`, icono: Package, color: "slate", onClick: () => setVista?.("inventario") },
      ]}
    />
  )

  // ─── Desenlace de las citas + lista: un solo control (el período y, si se quiere, la tarjeta) para las dos cosas ───
  const ETIQUETA_PERIODO = { hoy: "hoy", semana: "esta semana", mes: "este mes", siempre: "todas" }
  const NOMBRE_TARJETA = { atendida: "Atendidas", noAsistio: "No asistieron", cancelada: "Canceladas" }
  const enAtencionN = (esVistaOptometra ? pacientesEnAtencion.filter((c) => esCitaPropia(c, usuario?.id)) : pacientesEnAtencion).length
  const elegirTarjeta = (id) => setTarjeta((actual) => (actual === id ? null : id))
  const selectorPeriodo = (
    <div role="group" aria-label="Período del desenlace" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5">
      {PERIODOS_DESENLACE.map(([id, etiqueta]) => (
        <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} className={"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (periodo === id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={periodo === id ? { background: INK } : undefined}>{etiqueta}</button>
      ))}
    </div>
  )
  const filaDesenlace = (
    <FilaTarjetas
      titulo={`${esVistaOptometra ? "Desenlace de mis citas" : "Desenlace de las citas"} · ${ETIQUETA_PERIODO[periodo]}`}
      descripcion={`${desenlace.registradas} ${desenlace.registradas === 1 ? "cita" : "citas"} en el período`}
      acciones={selectorPeriodo}
      tarjetas={[
        { id: "atendidas", titulo: "Atendidas", valor: desenlace.atendidas, desc: enAtencionN > 0 ? `${enAtencionN} en atención ahora` : "Ver en la lista", icono: CheckCircle2, color: "green", seleccionada: tarjeta === "atendida", onClick: () => elegirTarjeta("atendida") },
        { id: "noAsistieron", titulo: "No asistieron", valor: desenlace.noAtendidas, desc: "Ver en la lista", icono: UserX, color: "red", seleccionada: tarjeta === "noAsistio", onClick: () => elegirTarjeta("noAsistio") },
        { id: "canceladas", titulo: "Canceladas", valor: desenlace.canceladas, desc: "Ver en la lista", icono: Ban, color: "slate", seleccionada: tarjeta === "cancelada", onClick: () => elegirTarjeta("cancelada") },
      ]}
    />
  )
  const sinTerminar = useMemo(() => fichasSinTerminar(citas, usuario?.id), [citas, usuario?.id])

  // La lista de citas sigue el período y la tarjeta del desenlace: se ven las primeras y el resto está en Citas.
  const LIMITE_LISTA = 8
  const TITULO_LISTA = esVistaOptometra
    ? { hoy: "Mis citas de hoy", semana: "Mis citas de la semana", mes: "Mis citas del mes", siempre: "Todas mis citas" }
    : { hoy: "Citas del día", semana: "Citas de la semana", mes: "Citas del mes", siempre: "Todas las citas" }
  const verTodasEnCitas = () => (onVerCitas ? onVerCitas(tarjeta || "todas", periodo) : setVista?.("citas"))
  const accionFila = (cita) => {
    if (!esVistaOptometra || !puede(usuario, "consultas", "crear") || !esHoy(cita.fecha)) return null
    if (cita.estado === "En Atención") return { etiqueta: "Retomar", onClick: () => onAtenderCita?.(cita) }
    if (cita.estado === "Pendiente" || cita.estado === "En Espera") return { etiqueta: "Atender", onClick: () => onAtenderEnCitas?.(cita) }
    return null
  }
  // El siguiente paciente, destacado arriba de la agenda del optómetra, con "Atender" bien visible.
  const siguiente = hoyVista.siguiente
  const bSiguiente = (
    <div aria-label="Siguiente paciente" className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-blue-100 bg-blue-50/50 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Siguiente paciente</p>
        {siguiente ? (
          <>
            <p className="truncate text-lg font-semibold" style={{ color: INK }}>{siguiente.paciente} <span className="font-mono text-sm font-bold text-slate-500">· {siguiente.hora}</span></p>
            <p className="truncate text-xs text-slate-500">{siguiente.motivo || "Consulta general"}{siguiente.estado === "En Espera" ? " · ya llegó" : ""}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No queda nadie por atender hoy.</p>
        )}
      </div>
      {siguiente && puede(usuario, "consultas", "crear") && (
        <button type="button" onClick={() => onAtenderEnCitas?.(siguiente)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
          Atender <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
  const bCitasPeriodo = (
    <section aria-label={TITULO_LISTA[periodo]} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{TITULO_LISTA[periodo]}{tarjeta ? ` · ${NOMBRE_TARJETA[tarjeta]}` : ""}</h2>
        <p className="text-xs text-slate-400">{citasLista.length === 0 ? "Sin citas en el período" : citasLista.length > LIMITE_LISTA ? `Primeras ${LIMITE_LISTA} de ${citasLista.length}` : `${citasLista.length} ${citasLista.length === 1 ? "cita" : "citas"}`}</p>
        <button type="button" onClick={verTodasEnCitas} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todas en Citas <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {esVistaOptometra && bSiguiente}
        <div className="divide-y divide-slate-100 px-5 py-4">
          {citasLista.length === 0 ? (
            <EstadoVacio icon={Calendar} texto={tarjeta ? "Ninguna cita con ese resultado en el período." : "No hay citas en el período."} />
          ) : (
            citasLista.slice(0, LIMITE_LISTA).map((cita, idx) => renderFilaCita(cita, idx, periodo !== "hoy", accionFila(cita)))
          )}
        </div>
      </div>
    </section>
  )
  const filaHoyRecepcion = (
    <FilaTarjetas
      titulo="Hoy"
      descripcion="El movimiento del día"
      tarjetas={[
        { id: "hoy", titulo: "Citas de hoy", valor: hoyVista.total, desc: hoyVista.total === 1 ? "cita agendada" : "citas agendadas", icono: Calendar, color: "blue", onClick: () => setVista?.("citas") },
        { id: "porLlegar", titulo: "Por llegar", valor: hoyVista.pendientes, desc: "Pendientes", icono: Clock, color: "slate", onClick: () => onVerCitas?.("pendiente", "hoy") },
        { id: "espera", titulo: "En sala de espera", valor: hoyVista.enEspera, desc: "Ya llegaron", icono: Users, color: "violet", onClick: () => onVerCitas?.("enEspera", "hoy") },
        { id: "noAsistieron", titulo: "No asistieron", valor: hoyVista.noAsistieron, desc: "Hoy", icono: UserX, color: "red", onClick: () => onVerCitas?.("noAsistio", "hoy") },
      ]}
    />
  )
  const filaVender = (
    <FilaTarjetas
      titulo="Para vender"
      descripcion="Lo que espera a quien vende"
      tarjetas={[
        { id: "listos", titulo: "Listos para venta", valor: listos.length, desc: "Esperan que se les atienda", icono: ShoppingBag, color: "green", onClick: () => onVerCola?.() },
        { id: "proformas", titulo: "Proformas en seguimiento", valor: proformas.length, desc: "Lo pensarán", icono: FileText, color: "blue", onClick: () => onVerCola?.() },
        { id: "saldos", titulo: "Saldos por cobrar", valor: dinero(saldos.total), desc: saldos.cantidad === 0 ? "Nada pendiente" : `en ${saldos.cantidad} ${saldos.cantidad === 1 ? "venta" : "ventas"}`, icono: Wallet, color: saldos.cantidad > 0 ? "amber" : "slate", onClick: () => setVista?.("pacientes") },
      ]}
    />
  )
  const atajosRecepcion = (
    <div className="flex flex-wrap gap-3" role="group" aria-label="Atajos">
      {puede(usuario, "pacientes", "crear") && <button type="button" onClick={onCrearPacienteRapido} className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Users size={16} aria-hidden="true" /> Registrar paciente</button>}
      {puede(usuario, "citas", "crear") && <button type="button" onClick={onAgendarRapido} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}><Calendar size={16} aria-hidden="true" /> Agendar cita</button>}
    </div>
  )
  const bColaVender = (
    <section aria-label="Pacientes por vender" className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShoppingBag size={18} aria-hidden="true" /></div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: INK }}>Listos para venta</h4>
            <p className="text-[11px] text-slate-500">{listos.length === 0 ? "Nadie espera por ahora" : `${listos.length} ${listos.length === 1 ? "paciente espera" : "pacientes esperan"}, el más antiguo primero`}</p>
          </div>
        </div>
        <button type="button" onClick={() => onVerCola?.()} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver la cola <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      {listos.length === 0 ? (
        <EstadoVacio icon={ShoppingBag} texto="Cuando el optómetra pase a un paciente a la óptica, aparece aquí." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {listos.slice().sort((a, b) => (a.pasadaEn < b.pasadaEn ? -1 : 1)).slice(0, 5).map((pase) => {
            const paciente = pacientes.find((x) => x.id === pase.pacienteId)
            const consulta = consultas.find((x) => x.id === pase.consultaId)
            const diagnostico = textoDiagnostico(consulta)
            return (
              <li key={pase.id}>
                <button type="button" onClick={() => onVerCola?.()} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{paciente?.nombre || "Paciente"}</span>
                    <span className="block truncate text-[11px] text-slate-500">{diagnostico || consulta?.motivo || "Consulta"}{pase.proformaEntregadaEn ? " · con proforma" : ""}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{textoEspera(diasEnEspera(pase))}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
  // Mismo criterio que Citas/Pacientes/Inventario (cargaInicial && sin datos
  // todavía): antes Inicio no recibía este prop y era el único módulo que
  // podía mostrar "0 pacientes / 0 citas hoy" durante un parpadeo mientras
  // App.jsx aún hidrataba — justo la primera pantalla que ve el usuario al
  // entrar. Estrictamente prohibido por CLAUDE.md ("pantallas vacías o
  // parpadeos durante la petición de datos").
  // Mientras hidrata no se calcula nada: con las consultas todavía vacías, todos los pacientes salían "sin atender"
  // y con el control vencido. Los datos en caché de pacientes/citas no bastan para los números del Inicio.
  if (cargaInicial) {
    return <InicioSkeleton />
  }

  // ─── 1. Resumen del día: una sola línea ───
  const enAtencionAhora = (esVistaOptometra ? pacientesEnAtencion.filter((c) => esCitaPropia(c, usuario?.id)) : pacientesEnAtencion)
  const agenda = agendaHoyOProximas(citasVista)
  const hayInactivos = inactivos.length > 0

  // ─── 4. Requiere tu atención: todo lo pendiente, en un solo bloque ───
  const incAtenciones = ["administrador", "optometra", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incOrdenes = ["administrador", "ventas"].includes(plantilla) || (plantilla === "general" && veVentas)
  const incControles = (["administrador", "optometra", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incControlesPorAgendar = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incCanceladas = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incStock = veInventario // quien puede ver el inventario ve el aviso; "Reabastecer" solo con inventario: editar
  const incPorConfirmar = ["administrador", "recepcion"].includes(plantilla)
  // Pacientes que se registraron solos al agendar por la web (R15) y cuyos datos recepción todavía no confirma (R22).
  const porConfirmar = pacientes.filter((p) => p.origen === "paciente" && !p.confirmadoRecepcion)
  const incCumple = (["administrador", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incSaldos = veVentas && plantilla === "administrador"
  const incSinConsulta = puede(usuario, "pacientes", "ver")
  const nombresPaciente = (lista) => lista.slice(0, 3).map((o) => pacientes.find((p) => p.id === o.pacienteId)?.nombre || "Paciente").join(", ") + (lista.length > 3 ? ` y ${lista.length - 3} más` : "")
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

  // Los avisos de "Requiere tu atención", cada uno con su área (citas, pacientes, ventas, inventario) y, si agrupa varios, su cantidad.
  // nuevo = Inicio del administrador y del optómetra: salen todos, sin recortes ni filas "Y N más" (cada bloque muestra los tres primeros),
  // y se suman los avisos nuevos. Los demás roles siguen con la lista única recortada.
  const construirAvisos = (nuevo) => {
    const tope = (n) => (nuevo ? Infinity : n)
    const filas = []
    const poner = (area, fila) => filas.push({ area, ...fila })
    if (incAtenciones) {
      atencionesVista.slice(0, tope(4)).forEach(({ cita, dias }) => poner("citas", {
        id: "atencion-" + cita.id,
        icono: Activity,
        titulo: `Atención abierta de un día anterior: ${cita.paciente}`,
        detalle: textoAtencionAbierta(dias) + (cita.atendidoPor ? ` · ${etiquetaMiembro(equipo, cita.atendidoPor)}` : ""),
        acciones: [
          ...(puede(usuario, "consultas", "crear") ? [{ etiqueta: "Ingresar", principal: true, onClick: () => onAtenderCita?.(cita) }] : []),
          { etiqueta: "Dejar de atender", onClick: () => setDejarCita(cita) },
        ],
      }))
      if (atencionesVista.length > tope(4)) poner("citas", { id: "atenciones-mas", icono: Activity, titulo: `Y ${plural(atencionesVista.length - 4, "atención abierta más", "atenciones abiertas más")}`, acciones: [{ etiqueta: "Ver en Citas", onClick: () => onVerCitas?.("enAtencion", "siempre") }] })
    }
    // Las fichas que el optómetra dejó abiertas hoy (las de días anteriores ya salen arriba).
    if (nuevo && esVistaOptometra) {
      const yaListadas = new Set(atencionesVista.map(({ cita }) => cita.id))
      sinTerminar.filter((c) => !yaListadas.has(c.id)).forEach((cita) => poner("citas", {
        id: "ficha-sin-terminar-" + cita.id,
        icono: Activity,
        titulo: `Ficha sin terminar: ${cita.paciente}`,
        detalle: `Cita de las ${cita.hora}, todavía en atención`,
        acciones: puede(usuario, "consultas", "crear") ? [{ etiqueta: "Retomar", principal: true, onClick: () => onAtenderCita?.(cita) }] : [],
      }))
    }
    if (incOrdenes && listasSinAvisar.length > 0) poner("ventas", {
      id: "ordenes-listas", icono: FlaskConical, cantidad: listasSinAvisar.length,
      titulo: `${plural(listasSinAvisar.length, "orden de laboratorio lista", "órdenes de laboratorio listas")} sin avisar al paciente`,
      detalle: nombresPaciente(listasSinAvisar),
      acciones: [{ etiqueta: "Avisar", principal: true, onClick: () => onVerOrdenes?.("listas") }],
      verTodo: () => onVerOrdenes?.("listas"),
    })
    if (incOrdenes && atrasadas.length > 0) poner("ventas", {
      id: "ordenes-atrasadas", icono: FlaskConical, cantidad: atrasadas.length,
      titulo: plural(atrasadas.length, "orden atrasada", "órdenes atrasadas"),
      detalle: atrasosPorLaboratorio(ordenesLab).map((a) => `${a.laboratorio}: ${a.atrasadas}`).join(" · "),
      acciones: [{ etiqueta: "Ver atrasadas", onClick: () => onVerOrdenes?.("atrasadas") }],
      verTodo: () => onVerOrdenes?.("atrasadas"),
    })
    if (nuevo && incSaldos && saldos.cantidad > 0) poner("ventas", {
      id: "saldos", icono: Wallet, cantidad: saldos.cantidad,
      titulo: `${plural(saldos.cantidad, "venta con saldo pendiente", "ventas con saldo pendiente")}: ${dinero(saldos.total)}`,
      acciones: [{ etiqueta: "Ver saldos", onClick: () => onVerSaldos?.() }],
      verTodo: () => onVerSaldos?.(),
    })
    if (incControlesPorAgendar) {
      sinAgendar.slice(0, tope(3)).forEach(({ paciente, fechaControl, consulta }) => poner("citas", {
        id: "control-sin-agendar-" + paciente.id,
        icono: Calendar,
        titulo: `Control sin agendar: ${paciente.nombre}`,
        detalle: `Control recomendado para el ${fechaLegible(fechaAISO(fechaControl))}, todavía sin cita`,
        acciones: [
          ...(puede(usuario, "citas", "crear") ? [{ etiqueta: "Agendar", principal: true, onClick: () => onAgendarControl?.(paciente, fechaAISO(fechaControl), asignadoDelControl(consulta, equipo)) }] : []),
          { etiqueta: "Ver paciente", onClick: () => onVerPerfilPaciente?.(paciente.id) },
        ],
      }))
      if (sinAgendar.length > tope(3)) poner("citas", {
        id: "controles-sin-agendar-mas", icono: Calendar,
        titulo: `Y ${plural(sinAgendar.length - 3, "control sin agendar más", "controles sin agendar más")}`,
        acciones: [{ etiqueta: "Ver pacientes", onClick: () => onVerPacientes ? onVerPacientes({ rapido: "ControlSinAgendar" }) : setVista?.("pacientes") }],
      })
    }
    // Ausencias registradas en "Mi horario" con citas abiertas de esa persona: solo para quien puede reasignar (permiso, no rol).
    if (puedeReasignarCitas) {
      citasPorReasignar(citas, disponibilidad, hoyISO()).slice(0, tope(3)).forEach((g) => poner("citas", {
        id: "ausencia-" + g.personaId + "-" + g.fecha,
        icono: CalendarOff,
        titulo: `${g.personaNombre || etiquetaMiembro(equipo, g.personaId)} estará ausente el ${formatoFecha(g.fecha, "largo")}`,
        detalle: plural(g.citas.length, "cita por reasignar", "citas por reasignar"),
        acciones: [{ etiqueta: "Reasignar citas", principal: true, onClick: () => setReasignarGrupo(g) }],
      }))
    }
    if (incCanceladas) {
      paraReagendar.slice(0, tope(3)).forEach((cita) => poner("citas", {
        id: "reagendar-" + cita.id,
        icono: cita.estado === "No Asistió" ? UserX : Ban,
        titulo: cita.estado === "No Asistió" ? `No asistió a su cita: ${cita.paciente}` : `Cita cancelada por el paciente: ${cita.paciente}`,
        detalle: `Era el ${fechaLegible(cita.fecha)} a las ${cita.hora}${cita.motivo ? ` · ${cita.motivo}` : ""}, todavía sin reagendar`,
        acciones: [
          ...(puede(usuario, "citas", "crear") ? [{ etiqueta: "Reagendar", principal: true, onClick: () => onReagendarCancelada?.(cita) }] : []),
          { etiqueta: "Ver en Citas", onClick: () => onVerCitas?.("todas", "reagendar") },
        ],
      }))
      if (paraReagendar.length > tope(3)) poner("citas", {
        id: "reagendar-mas", icono: Ban,
        titulo: `Y ${plural(paraReagendar.length - 3, "cita para reagendar más", "citas para reagendar más")}`,
        acciones: [{ etiqueta: "Ver en Citas", onClick: () => onVerCitas?.("todas", "reagendar") }],
      })
    }
    if (incPorConfirmar && porConfirmar.length > 0) {
      porConfirmar.slice(0, tope(3)).forEach((paciente) => poner("pacientes", {
        id: "confirmar-paciente-" + paciente.id,
        icono: UserCheck,
        titulo: `Datos sin confirmar: ${paciente.nombre}`,
        detalle: "Se registró solo al agendar por la web: revisa que su cédula, teléfono y correo estén bien",
        acciones: [
          ...(puede(usuario, "pacientes", "editar") ? [{ etiqueta: "Confirmar datos", principal: true, onClick: () => setConfirmarPaciente(paciente) }] : []),
          { etiqueta: "Ver paciente", onClick: () => onVerPerfilPaciente?.(paciente.id) },
        ],
        verTodo: () => (onVerPacientes ? onVerPacientes({}) : setVista?.("pacientes")),
      }))
      if (porConfirmar.length > tope(3)) poner("pacientes", {
        id: "confirmar-pacientes-mas", icono: UserCheck,
        titulo: `Y ${plural(porConfirmar.length - 3, "paciente de la web por confirmar más", "pacientes de la web por confirmar más")}`,
        acciones: [{ etiqueta: "Ver pacientes", onClick: () => (onVerPacientes ? onVerPacientes({}) : setVista?.("pacientes")) }],
      })
    }
    if (incControles && hayInactivos) poner("pacientes", {
      id: "controles", icono: Clock, cantidad: inactivos.length,
      titulo: plural(inactivos.length, "paciente con el control vencido", "pacientes con el control vencido"),
      detalle: inactivos.slice(0, 3).map(({ paciente, dias }) => `${paciente.nombre} (hace ${dias} días)`).join(", ") + (inactivos.length > 3 ? ` y ${inactivos.length - 3} más` : ""),
      acciones: [{ etiqueta: "Gestionar en CRM", onClick: () => setVista?.("crm") }],
      verTodo: () => setVista?.("crm"),
    })
    if (nuevo && incSinConsulta && sinAtender > 0) poner("pacientes", {
      id: "sin-consulta", icono: Users, cantidad: sinAtender,
      titulo: `${plural(sinAtender, "paciente registrado", "pacientes registrados")} sin ninguna consulta`,
      acciones: [{ etiqueta: "Ver pacientes", onClick: () => (onVerPacientes ? onVerPacientes({ correccion: "Sin evaluación" }) : setVista?.("pacientes")) }],
      verTodo: () => (onVerPacientes ? onVerPacientes({ correccion: "Sin evaluación" }) : setVista?.("pacientes")),
    })
    if (incStock && productosBajoStock.length > 0) poner("inventario", {
      id: "stock", icono: Package, cantidad: productosBajoStock.length,
      titulo: plural(productosBajoStock.length, "producto con stock bajo", "productos con stock bajo"),
      detalle: productosBajoStock.slice(0, 3).map((p) => `${p.nombre} (${p.stock})`).join(", ") + (productosBajoStock.length > 3 ? ` y ${productosBajoStock.length - 3} más` : ""),
      acciones: [
        ...(puede(usuario, "inventario", "editar") ? [{ etiqueta: "Reabastecer", principal: true, onClick: () => (onReabastecerProducto ? onReabastecerProducto(productosBajoStock[0].id) : setVista?.("inventario")) }] : []),
        { etiqueta: "Ver inventario", onClick: () => setVista?.("inventario") },
      ],
    })
    if (incCumple && cumpleaneros.length > 0) poner("pacientes", {
      id: "cumple", icono: Cake, cantidad: cumpleaneros.length,
      titulo: cumpleaneros.some((c) => c.esHoy) ? `${plural(cumpleaneros.filter((c) => c.esHoy).length, "cumpleaños hoy", "cumpleaños hoy")} para saludar` : `${plural(cumpleaneros.length, "cumpleaños cercano", "cumpleaños cercanos")} para saludar`,
      detalle: cumpleaneros.slice(0, 3).map((c) => c.nombre).join(", ") + (cumpleaneros.length > 3 ? ` y ${cumpleaneros.length - 3} más` : ""),
      acciones: [{ etiqueta: "Saludar en CRM", onClick: () => setVista?.("crm") }],
      verTodo: () => setVista?.("crm"),
    })
    return filas
  }
  const filasAtencion = construirAvisos(false)
  const bRequiere = <RequiereAtencion filas={filasAtencion} />

  // Inicio del administrador y del optómetra: un bloque por área, solo los que le corresponden por sus permisos.
  const avisosPorArea = construirAvisos(true)
  const filasDe = (area) => avisosPorArea.filter((f) => f.area === area)
  const irACitas = () => {
    if (!onVerCitas) return setVista?.("citas")
    if (paraReagendar.length > 0 || atencionesVista.length === 0) onVerCitas("todas", "reagendar")
    else onVerCitas("enAtencion", "siempre")
  }
  const bloquesAtencion = [
    veCitas && { id: "citas", titulo: "Citas", icono: Calendar, filas: filasDe("citas"), onVerTodo: irACitas },
    puede(usuario, "pacientes", "ver") && { id: "pacientes", titulo: "Pacientes", icono: Users, filas: filasDe("pacientes"), onVerTodo: () => (filasDe("pacientes")[0]?.verTodo ?? (() => setVista?.("pacientes")))() },
    veVentas && plantilla === "administrador" && { id: "ventas", titulo: "Ventas", icono: ShoppingBag, filas: filasDe("ventas"), onVerTodo: () => (filasDe("ventas")[0]?.verTodo ?? (() => setVista?.("ventas")))() },
    veInventario && { id: "inventario", titulo: "Inventario", icono: Package, filas: filasDe("inventario"), onVerTodo: () => (onVerStockBajo ? onVerStockBajo() : setVista?.("inventario")) },
  ].filter(Boolean)
  const bRequiereAreas = <RequiereAtencionPorArea bloques={bloquesAtencion} />

  const segmentosDia = []
  if (plantilla === "administrador") segmentosDia.push(plural(hoyVista.total, "cita hoy", "citas hoy"), `${enAtencionAhora.length} en atención ahora`)
  else if (plantilla === "recepcion" || (plantilla === "general" && veCitas)) segmentosDia.push(plural(hoyVista.total, "cita hoy", "citas hoy"))
  else if (plantilla === "optometra") segmentosDia.push(plural(hoyVista.total, "cita tuya hoy", "citas tuyas hoy"), ...(sinTerminar.length > 0 ? [plural(sinTerminar.length, "ficha sin terminar", "fichas sin terminar")] : []))
  else if (plantilla === "ventas" || (plantilla === "general" && veVentas)) segmentosDia.push(plural(listos.length, "paciente espera su venta", "pacientes esperan su venta"))
  const bResumenDia = (
    <p aria-label="Resumen del día" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
      {segmentosDia.map((s, i) => (<span key={i} className="font-medium">{s}<span className="ml-2 text-slate-300" aria-hidden="true">·</span></span>))}
      {filasAtencion.length > 0 ? (
        <button type="button" onClick={() => document.getElementById("requiere-atencion")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="font-bold text-amber-700 underline-offset-2 hover:underline cursor-pointer">
          {plural(filasAtencion.length, "pendiente que requiere tu atención", "pendientes que requieren tu atención")}
        </button>
      ) : (
        <span className="font-bold text-emerald-700">Todo en orden</span>
      )}
      {!opticaActiva && <span className="rounded-full border border-red-200/60 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700">Óptica suspendida</span>}
    </p>
  )

  // Administrador y optómetra ya no llevan la línea de resumen (repetía lo de más abajo); solo queda el aviso de óptica suspendida.
  const bSuspendida = !opticaActiva && (
    <p role="status" className="flex items-center gap-2 text-sm"><span className="rounded-full border border-red-200/60 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700">Óptica suspendida</span></p>
  )

  const bDejarCita = dejarCita && (
    <ConfirmarDejarDeAtender
      cita={dejarCita}
      usuario={usuario}
      setCitas={setCitas}
      onCancelar={() => setDejarCita(null)}
      onHecho={(mensaje) => { setDejarCita(null); onAviso?.(mensaje) }}
    />
  )

  const bReasignar = reasignarGrupo && (
    <ReasignarCitasModal
      grupo={reasignarGrupo}
      personas={miembrosActivos(equipo).filter((m) => m.esOptometra)}
      disponibilidad={disponibilidad}
      onCerrar={() => setReasignarGrupo(null)}
      onHecho={(hechas, completo) => {
        setCitas?.((previas) => previas.map((c) => { const h = hechas.find((x) => x.id === c.id); return h ? { ...c, asignadoA: h.asignadoA, asignadoOriginal: h.asignadoOriginal } : c }))
        if (completo) setReasignarGrupo(null)
        onAviso?.(`${plural(hechas.length, "cita reasignada", "citas reasignadas")}.`)
      }}
    />
  )

  const bConfirmarPaciente = confirmarPaciente && (
    <ConfirmarDatosPacienteModal
      soloConfirmar
      usuario={usuario}
      paciente={confirmarPaciente}
      pacientes={pacientes}
      setPacientes={setPacientes}
      onCerrar={() => setConfirmarPaciente(null)}
      onConfirmado={(p) => { setConfirmarPaciente(null); onAviso?.(`Datos de ${p.nombre} confirmados.`) }}
    />
  )

  // ─── 5. Hoy: quién está en atención ahora y la agenda del día (o las próximas si hoy no hay) ───
  // conFilaHoy: el rol ya tiene una fila de tarjetas titulada "Hoy"; así la agenda no repite el título.
  const bHoy = (conAtencion, conFilaHoy = false) => (
    <section aria-label={conFilaHoy ? (agenda.modo === "hoy" ? "Agenda de hoy" : "Próximas citas") : "Hoy"} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{conFilaHoy ? (agenda.modo === "hoy" ? "Agenda de hoy" : "Próximas citas") : "Hoy"}</h2>
        <p className="text-xs text-slate-400">{agenda.modo === "hoy" ? "En orden de hora" : "Hoy no hay citas: estas son las próximas"}</p>
        <button type="button" onClick={() => setVista?.("citas")} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver agenda completa <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {conAtencion && (
          <div aria-label="En atención ahora" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-3.5">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
              <Activity size={17} className="text-blue-600" aria-hidden="true" /> En atención ahora
              <span className="font-serif text-lg" aria-live="polite">{enAtencionAhora.length}</span>
            </span>
            {enAtencionAhora.length === 0 ? (
              <span className="text-sm text-slate-500">Nadie está en atención en este momento.</span>
            ) : (
              enAtencionAhora.map((c) => (
                <span key={c.id} className="flex max-w-full items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="truncate">{c.paciente}</span>
                  <span className="shrink-0 font-normal text-blue-600/80">· {etiquetaMiembro(equipo, c.atendidoPor) || "Sin registro"}</span>
                </span>
              ))
            )}
          </div>
        )}
        <div className="divide-y divide-slate-100 px-5 py-4">
          {agenda.citas.length === 0 ? (
            <EstadoVacio icon={Calendar} texto="No hay citas hoy ni próximas." />
          ) : (
            agenda.citas.map((cita, idx) => renderFilaCita(cita, idx, agenda.modo === "proximas"))
          )}
        </div>
      </div>
    </section>
  )

  // ─── 6. Registro de actividad, compacto: las últimas 5 acciones (solo el administrador) ───
  const bActividad = actividadReciente.length > 0 && (
    <section aria-label="Registro de actividad" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Registro de actividad</h2>
        <p className="text-xs text-slate-400">Qué cambió y quién lo hizo</p>
        <button type="button" onClick={() => setVista?.("usuarios")} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todo <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white px-5 py-1 shadow-sm">
        {actividadReciente.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
            <p className="min-w-0 truncate text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
              {l.detalle && <span className="text-slate-500"> — {l.detalle}</span>}
              <span className="text-slate-400"> · {NOMBRE_MODULO[l.modulo] || l.modulo}</span>
            </p>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">{fechaHoraLegible(l.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="w-full space-y-6 text-left">
      <style>{`
        @keyframes inRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .in-rise { animation: inRise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .in-rise { animation: none !important; } }
      `}</style>

      {plantilla === "administrador" || plantilla === "optometra" ? bSuspendida : bResumenDia}
      {bDejarCita}
      {bConfirmarPaciente}
      {bReasignar}

      {plantilla === "administrador" && (
        <>
          {filaTotales}
          {bRequiereAreas}
          {filaDesenlace}
          {bCitasPeriodo}
          {bActividad}
        </>
      )}

      {plantilla === "optometra" && (
        <>
          <div className="flex justify-end">{atajosAdmin}</div>
          {bRequiereAreas}
          {filaDesenlace}
          {bCitasPeriodo}
        </>
      )}

      {plantilla === "recepcion" && (
        <>
          {filaHoyRecepcion}
          {atajosRecepcion}
          {bRequiere}
          {bHoy(false, true)}
        </>
      )}

      {plantilla === "ventas" && (
        <>
          {filaVender}
          {bRequiere}
          {bColaVender}
        </>
      )}

      {plantilla === "general" && (
        <>
          {veCitas && filaHoyRecepcion}
          {veVentas && filaVender}
          {bRequiere}
          {veCitas && bHoy(false, true)}
          {veVentas && bColaVender}
          {!veCitas && !veVentas && !veInventario && !veCrm && (
            <EstadoVacio icon={Users} texto="Tu rol no tiene un resumen propio: usa el menú para entrar a tus módulos." />
          )}
        </>
      )}

    </div>
  )
}

// ─── Subcomponentes ───

// Refleja la forma real del panel (hero + 3 tarjetas + 2 secciones) en vez
// de un skeleton genérico, para que no haya salto de layout cuando llegan
// los datos reales — mismo lenguaje visual (animate-pulse + slate-200/70)
// que TablaSkeleton.jsx.
function InicioSkeleton() {
  return (
    <div className="w-full space-y-6 text-left">
      <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200/70" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200/60 bg-slate-100/70" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200/70" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3.5 py-1.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-200/60" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function EstadoVacio({ icon: Icon, texto }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300">
        <Icon size={22} />
      </div>
      <p className="text-xs font-medium text-slate-500">{texto}</p>
    </div>
  )
}
