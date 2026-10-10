"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { ahoraEcuador } from "../utilidades/horaEcuador"

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
import RequiereAtencionPorArea from "../componentes/RequiereAtencionPorArea"
import { puede } from "../utilidades/permisosUi"
import { textoDiagnostico, textoEspera, diasEnEspera } from "../utilidades/pasesVenta"
import { ventasDelMes, nombresResumidos, agendaOptometra, plantillaInicio, citasPropias, esCitaPropia, resumenHoy, resumenPeriodo, citasParaLista, creadosEsteMes, PERIODOS_DESENLACE, agendaHoyOProximas, fichasSinTerminar, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "../utilidades/inicio"
import { NOMBRE_MODULO, detalleActividad, moduloDeRegistro } from "../utilidades/logs"
import { puedeNivel } from "../utilidades/roles"
import { saldoFactura } from "../utilidades/abonos"
import { ordenesAtrasadas, ordenesListasSinAvisar, atrasosPorLaboratorio } from "../utilidades/ordenesLaboratorio"
import { INK, GRAD_MARCA } from "@/lib/tema"

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
  // En una vista de rol manda el permiso de ese rol (igual que el menú); si no, el del usuario.
  const puedeV = (modulo, nivel = "ver") => (vista?.tipo === "rol" ? puedeNivel(vista.permisos, modulo, nivel) : puede(usuario, modulo, nivel))
  // Período del "Desenlace de las citas" y de la lista de abajo: hoy, esta semana, este mes o todas.
  const [periodo, setPeriodo] = useState("hoy")
  // Tarjeta del desenlace elegida (atendida | noAsistio | cancelada): la lista de citas de abajo muestra solo esas. Volver a tocarla la quita.
  const [tarjeta, setTarjeta] = useState(null)
  // Tarjeta de "Para vender" elegida (listos | proformas | saldos): la lista de abajo muestra esa.
  const [tarjetaVenta, setTarjetaVenta] = useState("listos")

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
      const hoy = ahoraEcuador()
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
    const hoy = ahoraEcuador()
    return pacientes.filter((p) => {
      const f = parseFechaFlexible(p.fechaRegistro)
      return f && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
    }).length
  }, [pacientes])

  // Fila de una cita — compartida entre "Últimas citas / Agenda cercana" (que
  // puede mostrar historial cuando no hay nada hoy) y "Mi agenda" (siempre
  // hoy, así que mostrarFecha va fijo en false).
  // accion (opcional): botón al costado de la fila, p. ej. "Atender" en la agenda del optómetra.
  const renderFilaCita = (cita, idx, mostrarFecha, accion = null, marca = null) => (
    <div key={cita.id || idx} data-cita-id={cita.id} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 py-1.5 first:pt-0 last:pb-0">
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
            <span className="font-sans text-xs font-medium text-slate-500">
              {(() => { const f = parseFechaFlexible(cita.fecha); return f ? fechaCorta(f) : "" })()}
            </span>
          ) : (
            cita.espera && <span className="font-sans text-xs font-medium text-amber-600">{cita.espera} esp</span>
          )}
        </div>
        <div className={"flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 font-mono text-xs font-bold " + (cita.colorAvatar || "bg-blue-50 text-blue-600")}>
          {cita.iniciales || (cita.paciente || cita.nombre || "P").substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-800">{cita.paciente || cita.nombre}</h5>
          <p className="text-xs text-slate-500">{cita.motivo || "Consulta general"}</p>
        </div>
      </div>
      {/* Mismo criterio de color usado en Citas.jsx/Pacientes.jsx esta
          sesión: Pendiente=ámbar (acá caía en gris por defecto,
          cuarta repetición del mismo patrón encontrada en el sistema). */}
      <span className="flex shrink-0 items-center gap-2">
      {marca && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{marca}</span>}
      <span className={"rounded-full px-3 py-1 text-xs font-bold " + (
        cita.estado === "En Espera" ? "border border-violet-200/60 bg-violet-50 text-violet-700"
          : cita.estado === "En Atención" ? "border border-blue-200/60 bg-blue-50 text-blue-700"
          : cita.estado === "Atendida" ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
          : cita.estado === "No Asistió" ? "border border-red-200/60 bg-red-50 text-red-700"
          : cita.estado === "Cancelada" ? "border border-slate-200/60 bg-slate-50 text-slate-600"
          : "border border-amber-200/60 bg-amber-50 text-amber-700")}>
        {cita.estado || "Pendiente"}
      </span>
      </span>
    </button>
    {accion && <button type="button" onClick={accion.onClick} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer">{accion.etiqueta}</button>}
    </div>
  )


  // ─── Inicio por rol (R52-R56) ───
  // La vista activa decide qué Inicio se ve; cada fila de tarjetas habla de una sola cosa y lo dice en su título.
  const plantilla = plantillaInicio(vista, usuario)
  const veCitas = puedeV("citas", "ver")
  const veVentas = puedeV("ventas", "ver")
  const veInventario = puedeV("inventario", "ver")
  const veCrm = puedeV("crm", "ver")
  const esVistaOptometra = plantilla === "optometra"
  const citasVista = useMemo(() => (esVistaOptometra ? citasPropias(citas, usuario?.id) : citas), [citas, esVistaOptometra, usuario?.id])
  const hoyVista = useMemo(() => resumenHoy(citasVista), [citasVista])
  const desenlace = useMemo(() => resumenPeriodo(citasVista, periodo), [citasVista, periodo])
  const citasLista = useMemo(() => citasParaLista(citasVista, periodo, tarjeta), [citasVista, periodo, tarjeta])
  const sinAtender = useMemo(() => pacientesSinAtender(pacientes, consultas).length, [pacientes, consultas])
  const saldos = useMemo(() => saldosPorCobrar(facturasVenta, abonos), [facturasVenta, abonos])
  const facturasConSaldo = useMemo(() => facturasVenta.map((f) => ({ f, saldo: saldoFactura(f, abonos) })).filter((x) => x.saldo > 0).sort((a, b) => (a.f.creadoEn < b.f.creadoEn ? -1 : 1)), [facturasVenta, abonos])
  const listos = useMemo(() => pasesListos(pases), [pases])
  const proformas = useMemo(() => proformasEnSeguimiento(pases), [pases])
  const atencionesVista = esVistaOptometra ? atencionesAntiguas.filter(({ cita }) => esCitaPropia(cita, usuario?.id)) : atencionesAntiguas
  // Las tarjetas solo llevan a su lista (un clic en cualquier parte). Las acciones de crear van aparte, como atajos, para
  // que una misma tarjeta no haga dos cosas distintas según dónde se toque.
  const atajosAdmin = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos">
      {puedeV("pacientes", "crear") && <button type="button" onClick={onCrearPacienteRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Users size={14} aria-hidden="true" /> Registrar paciente</button>}
      {puedeV("citas", "crear") && <button type="button" onClick={onAgendarRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Calendar size={14} aria-hidden="true" /> Agendar cita</button>}
      {puedeV("inventario", "crear") && <button type="button" onClick={onCrearProductoRapido} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><Package size={14} aria-hidden="true" /> Añadir producto</button>}
    </div>
  )
  // Cuánto se dio de alta este mes: cada total lo dice junto al número, con la misma lógica en las tres tarjetas.
  const citasEsteMes = useMemo(() => creadosEsteMes(citas, "creadoEn"), [citas])
  const productosEsteMes = useMemo(() => creadosEsteMes(inventario, "creadoEn"), [inventario])
  const ventasMes = useMemo(() => ventasDelMes(facturasVenta), [facturasVenta])
  const filaTotales = (
    <FilaTarjetas
      titulo="Totales"
      descripcion="Todo lo registrado y lo nuevo de este mes"
      acciones={atajosAdmin}
      neutro
      compacta
      tarjetas={[
        { id: "pacientes", titulo: "Pacientes", valor: pacientes.length, desc: `+${pacientesEsteMes} este mes`, icono: Users, onClick: () => setVista?.("pacientes") },
        { id: "citas", titulo: "Citas", valor: citas.length, desc: `+${citasEsteMes} este mes`, icono: Calendar, onClick: () => setVista?.("citas") },
        veVentas && { id: "ventas", titulo: "Ventas", valor: dinero(ventasMes.totalVendido), desc: `+${dinero(ventasMes.total)} este mes · ${ventasMes.cantidad} ${ventasMes.cantidad === 1 ? "venta" : "ventas"}`, icono: ShoppingBag, onClick: () => setVista?.("ventas") },
        { id: "productos", titulo: "Productos", valor: inventario.length, desc: `+${productosEsteMes} este mes`, icono: Package, onClick: () => setVista?.("inventario") },
      ].filter(Boolean)}
    />
  )

  // ─── Desenlace de las citas + lista: un solo control (el período y, si se quiere, la tarjeta) para las dos cosas ───
  const ETIQUETA_PERIODO = { hoy: "hoy", semana: "esta semana", mes: "este mes", siempre: "todas" }
  const NOMBRE_TARJETA = { atendida: "Atendidas", noAsistio: "No asistieron", pendiente: "Pendientes", cancelada: "Canceladas" }
  const enAtencionN = desenlace.enAtencion
  const elegirTarjeta = (id) => setTarjeta((actual) => (actual === id ? null : id))
  const selectorPeriodo = (
    <div role="group" aria-label="Período del desenlace" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5">
      {PERIODOS_DESENLACE.map(([id, etiqueta]) => (
        <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} className={"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (periodo === id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={periodo === id ? { background: GRAD_MARCA } : undefined}>{etiqueta}</button>
      ))}
    </div>
  )
  // Quien atiende ve su desenlace sin lista debajo (su agenda ya está arriba): las tarjetas son informativas.
  const tarjetaDe = (clave, extra) => ({ ...extra, ...(esVistaOptometra ? {} : { seleccionada: tarjeta === clave, onClick: () => elegirTarjeta(clave) }) })
  const textoSuma = `${desenlace.registradas} ${desenlace.registradas === 1 ? "cita" : "citas"} = ${desenlace.atendidas} + ${desenlace.noAtendidas} + ${desenlace.pendientes}`
  const filaDesenlace = (
    <FilaTarjetas
      titulo={`${esVistaOptometra ? "Desenlace de mis citas" : "Desenlace de las citas"} · ${ETIQUETA_PERIODO[periodo]}`}
      descripcion={tarjeta ? `${citasLista.length} ${citasLista.length === 1 ? "cita" : "citas"} · ${NOMBRE_TARJETA[tarjeta].toLowerCase()}` : `${textoSuma}${desenlace.canceladas > 0 ? ` · ${desenlace.canceladas} ${desenlace.canceladas === 1 ? "cancelada aparte" : "canceladas aparte"}` : ""}`}
      acciones={selectorPeriodo}
      compacta
      tarjetas={[
        tarjetaDe("atendida", { id: "atendidas", titulo: "Atendidas", valor: desenlace.atendidas, desc: enAtencionN > 0 ? `${enAtencionN} en atención ahora` : undefined, icono: CheckCircle2, color: "green" }),
        tarjetaDe("noAsistio", { id: "noAsistieron", titulo: "No asistieron", valor: desenlace.noAtendidas, icono: UserX, color: "red" }),
        tarjetaDe("pendiente", { id: "pendientes", titulo: "Pendientes", valor: desenlace.pendientes, icono: Clock, color: "amber" }),
        tarjetaDe("cancelada", { id: "canceladas", titulo: "Canceladas", valor: desenlace.canceladas, desc: "Aparte", icono: Ban, color: "slate", aparte: true }),
      ]}
    />
  )
  const sinTerminar = useMemo(() => fichasSinTerminar(citas, usuario?.id), [citas, usuario?.id])

  // La lista de citas sigue el período y la tarjeta del desenlace: se ven las primeras y el resto está en Citas.
  const LIMITE_LISTA = 8
  const TITULO_LISTA = esVistaOptometra
    ? { hoy: "Mi agenda de hoy", semana: "Mis citas de la semana", mes: "Mis citas del mes", siempre: "Todas mis citas" }
    : { hoy: "Citas del día", semana: "Citas de la semana", mes: "Citas del mes", siempre: "Todas las citas" }
  const verTodasEnCitas = () => (onVerCitas ? onVerCitas(tarjeta || "todas", periodo) : setVista?.("citas"))
  const accionFila = (cita) => {
    if (!esVistaOptometra || !puedeV("consultas", "crear") || !esHoy(cita.fecha)) return null
    if (cita.estado === "En Atención") return { etiqueta: "Retomar", onClick: () => onAtenderCita?.(cita) }
    if (cita.estado === "Pendiente" || cita.estado === "En Espera") return { etiqueta: "Atender", onClick: () => onAtenderEnCitas?.(cita) }
    return null
  }
  // El siguiente paciente, destacado a lo ancho, con "Atender" bien visible. Quien ya llegó (En espera) va antes que quien está Pendiente.
  const siguiente = hoyVista.siguiente
  const agendaOpt = agendaOptometra(citasVista)
  const bSiguiente = (
    <div aria-label="Siguiente paciente" className="flex h-full flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-blue-200/60 bg-blue-50/50 px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Siguiente paciente</p>
        {siguiente ? (
          <>
            <p className="truncate text-lg font-semibold" style={{ color: INK }}>{siguiente.paciente} <span className="font-mono text-sm font-bold text-slate-500">· {siguiente.hora}</span></p>
            <p className="truncate text-sm text-slate-500">{siguiente.motivo || "Consulta general"}{siguiente.estado === "En Espera" ? " · ya llegó" : ""}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No queda nadie por atender hoy.</p>
        )}
      </div>
      {siguiente && puedeV("consultas", "crear") && (
        <button type="button" onClick={() => onAtenderEnCitas?.(siguiente)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
          Atender <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
  // Fichas que dejó abiertas hoy (las de días anteriores son un aviso de "Requiere tu atención"): una tarjeta solo si hay alguna.
  const fichasAbiertas = esVistaOptometra ? sinTerminar.filter((c) => esHoy(c.fecha)) : []
  const bFichas = fichasAbiertas.length > 0 && (
    <div aria-label="Fichas sin terminar" className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fichas sin terminar</p>
        <p className="font-serif text-2xl font-semibold leading-tight" style={{ color: INK }}>{fichasAbiertas.length}</p>
        <p className="truncate text-sm text-slate-500">{nombresResumidos(fichasAbiertas.map((c) => c.paciente))}</p>
      </div>
      <div>
        {fichasAbiertas.length === 1 && puedeV("consultas", "crear")
          ? <button type="button" onClick={() => onAtenderCita?.(fichasAbiertas[0])} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Retomar</button>
          : <button type="button" onClick={() => (onVerCitas ? onVerCitas("enAtencion", "hoy") : setVista?.("citas"))} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Ver</button>}
      </div>
    </div>
  )
  const hayHero = agendaOpt.modo === "hoy"
  const bDiaOptometra = (hayHero || bFichas) && (
    <section aria-label="Tu día" className="space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tu día</h2>
      <div className={"grid grid-cols-1 gap-4 " + (hayHero && bFichas ? "lg:grid-cols-3" : "")}>
        {hayHero && <div className={bFichas ? "lg:col-span-2" : ""}>{bSiguiente}</div>}
        {bFichas}
      </div>
    </section>
  )
  // Su agenda: todas las citas de hoy con su estado y su botón (el siguiente lleva la marca "Siguiente"); sin citas hoy, su próxima jornada con citas.
  const nAgenda = agendaOpt.citas.length
  const esperaAgenda = agendaOpt.citas.filter((c) => c.estado === "En Espera").length
  const textoCitas = `${nAgenda} ${nAgenda === 1 ? "cita" : "citas"}`
  const tituloAgendaOpt = agendaOpt.modo === "proxima" ? `Mi próxima jornada con citas · ${formatoFecha(agendaOpt.fecha, "calendario")}` : "Mi agenda de hoy"
  const bAgendaOptometra = (
    <section aria-label={tituloAgendaOpt} className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{tituloAgendaOpt}{nAgenda > 0 ? ` · ${textoCitas}` : ""}{agendaOpt.modo === "hoy" && esperaAgenda > 0 ? ` · ${esperaAgenda} en espera` : ""}</h2>
        {nAgenda > 0 && <button type="button" onClick={() => (onVerCitas ? onVerCitas("todas", agendaOpt.modo === "hoy" ? "hoy" : "siempre") : setVista?.("citas"))} className="ml-auto flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todas en Citas <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="divide-y divide-slate-100 px-5 py-4">
          {agendaOpt.modo === "vacia" ? (
            <EstadoVacio compacto icon={Calendar} texto="No tienes citas por venir." />
          ) : (
            agendaOpt.citas.map((cita, idx) => renderFilaCita(cita, idx, false, accionFila(cita), agendaOpt.modo === "hoy" && siguiente && cita.id === siguiente.id ? "Siguiente" : null))
          )}
        </div>
      </div>
    </section>
  )
  const bCitasPeriodo = (
    <section aria-label={TITULO_LISTA[periodo]} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{TITULO_LISTA[periodo]}{tarjeta ? ` · ${NOMBRE_TARJETA[tarjeta]}` : ""}{esVistaOptometra && periodo === "hoy" ? ` · ${hoyVista.enEspera} en espera` : ""}{plantilla === "recepcion" && periodo === "hoy" ? ` · ${hoyVista.pendientes} por llegar · ${hoyVista.enEspera} en sala de espera` : ""}</h2>
        {citasLista.length > 0 && <p className="text-xs text-slate-400">{citasLista.length > LIMITE_LISTA ? `Primeras ${LIMITE_LISTA} de ${citasLista.length}` : `${citasLista.length} ${citasLista.length === 1 ? "cita" : "citas"}`}</p>}
        {citasLista.length > 0 && <button type="button" onClick={verTodasEnCitas} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todas en Citas <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="divide-y divide-slate-100 px-5 py-4">
          {citasLista.length === 0 ? (
            <EstadoVacio compacto icon={Calendar} texto={tarjeta ? "Ninguna cita con ese resultado en el período." : periodo === "hoy" ? (esVistaOptometra ? "Hoy no tienes citas." : "Hoy no hay citas.") : "No hay citas en el período."} />
          ) : (
            citasLista.slice(0, LIMITE_LISTA).map((cita, idx) => renderFilaCita(cita, idx, periodo !== "hoy", accionFila(cita)))
          )}
        </div>
      </div>
    </section>
  )
  const filaVender = (
    <FilaTarjetas
      titulo="Para vender"
      descripcion="Lo que espera a quien vende"
      acciones={atajosAdmin}
      tarjetas={[
        { id: "listos", titulo: "Listos para venta", valor: listos.length, desc: "Esperan que se les atienda", icono: ShoppingBag, color: "green", seleccionada: tarjetaVenta === "listos", onClick: () => setTarjetaVenta("listos") },
        { id: "proformas", titulo: "Proformas en seguimiento", valor: proformas.length, desc: "Lo pensarán", icono: FileText, color: "blue", seleccionada: tarjetaVenta === "proformas", onClick: () => setTarjetaVenta("proformas") },
        { id: "saldos", titulo: "Saldos por cobrar", valor: dinero(saldos.total), desc: saldos.cantidad === 0 ? "Nada pendiente" : `en ${saldos.cantidad} ${saldos.cantidad === 1 ? "venta" : "ventas"}`, icono: Wallet, color: saldos.cantidad > 0 ? "amber" : "slate", seleccionada: tarjetaVenta === "saldos", onClick: () => setTarjetaVenta("saldos") },
      ]}
    />
  )
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
  // Lo que la tarjeta elegida de "Para vender" lista abajo. Del diagnóstico solo se muestra lo clínico (lo que va antes de " — "):
  // el texto del tratamiento es el mismo en todas las filas.
  const TITULO_VENDER = { listos: "Listos para venta", proformas: "Proformas en seguimiento", saldos: "Saldos por cobrar" }
  const pasesDeLaLista = (tarjetaVenta === "proformas" ? proformas : listos).slice().sort((a, b) => (a.pasadaEn < b.pasadaEn ? -1 : 1))
  const esListaSaldos = tarjetaVenta === "saldos"
  const nVender = esListaSaldos ? facturasConSaldo.length : pasesDeLaLista.length
  const bListaVender = (
    <section aria-label={TITULO_VENDER[tarjetaVenta]} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{TITULO_VENDER[tarjetaVenta]}</h2>
        {nVender > 0 && (
          <p className="text-xs text-slate-400">
            {esListaSaldos ? `${plural(nVender, "venta", "ventas")} · ${dinero(saldos.total)}` : `${plural(nVender, "paciente espera", "pacientes esperan")}, el más antiguo primero`}
            {nVender > LIMITE_LISTA ? ` · primeras ${LIMITE_LISTA}` : ""}
          </p>
        )}
        {nVender > 0 && <button type="button" onClick={() => (esListaSaldos ? onVerSaldos?.() : onVerCola?.())} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{esListaSaldos ? "Ver saldos" : "Ver la cola"} <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {nVender === 0 ? (
          <EstadoVacio compacto icon={esListaSaldos ? Wallet : ShoppingBag} texto={esListaSaldos ? "No hay saldos por cobrar." : tarjetaVenta === "proformas" ? "Nadie tiene una proforma en seguimiento." : "Cuando el optómetra pase a un paciente a la óptica, aparece aquí."} />
        ) : (
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {esListaSaldos
              ? facturasConSaldo.slice(0, LIMITE_LISTA).map(({ f, saldo }) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onVerSaldos?.()} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{pacientes.find((x) => x.id === f.pacienteId)?.nombre || "Paciente"}</span>
                      <span className="block truncate text-xs text-slate-500">Venta del {fechaLegible(f.creadoEn)} · total {dinero(f.montoTotal)}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Saldo {dinero(saldo)}</span>
                  </button>
                </li>
              ))
              : pasesDeLaLista.slice(0, LIMITE_LISTA).map((pase) => {
                const paciente = pacientes.find((x) => x.id === pase.pacienteId)
                const consulta = consultas.find((x) => x.id === pase.consultaId)
                const diagnostico = String(textoDiagnostico(consulta) || "").split(" — ")[0]
                return (
                  <li key={pase.id}>
                    <button type="button" onClick={() => onVerCola?.()} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-800">{paciente?.nombre || "Paciente"}</span>
                        <span className="block truncate text-xs text-slate-500">{diagnostico || consulta?.motivo || "Consulta"}{pase.proformaEntregadaEn ? " · con proforma" : ""}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{textoEspera(diasEnEspera(pase))}</span>
                    </button>
                  </li>
                )
              })}
          </ul>
        )}
      </div>
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

  const hayInactivos = inactivos.length > 0

  // ─── Requiere tu atención: todo lo pendiente, en un solo bloque ───
  const incAtenciones = ["administrador", "optometra", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incOrdenes = ["administrador", "ventas"].includes(plantilla) || (plantilla === "general" && veVentas)
  const incControles = (["administrador", "optometra", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incControlesPorAgendar = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incCanceladas = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incStock = veInventario && plantilla !== "optometra" // quien puede ver el inventario ve el aviso; "Reabastecer" solo con inventario: editar
  const incPorConfirmar = ["administrador", "recepcion"].includes(plantilla)
  // Pacientes que se registraron solos al agendar por la web (R15) y cuyos datos recepción todavía no confirma (R22).
  const porConfirmar = pacientes.filter((p) => p.origen === "paciente" && !p.confirmadoRecepcion)
  const incCumple = (["administrador", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incSaldos = veVentas && plantilla !== "optometra"
  const incSinConsulta = puedeV("pacientes", "ver") && plantilla !== "ventas" && plantilla !== "optometra"
  // Los avisos de "Requiere tu atención", cada uno con su área (citas, pacientes, ventas, inventario): UNA línea por tipo de aviso
  // (regla 38) con su cantidad, los nombres resumidos y una sola acción. Con un solo caso la acción lo resuelve; con varios abre la lista.
  const construirAvisos = () => {
    const filas = []
    const poner = (area, fila) => filas.push({ area, ...fila })
    const uno = (n, singular, varios) => (n === 1 ? singular : varios)
    if (incAtenciones && atencionesVista.length > 0) {
      const n = atencionesVista.length
      const unica = atencionesVista[0].cita
      poner("citas", {
        id: "atenciones", cantidad: n, tono: "urgente",
        texto: uno(n, "atención abierta de un día anterior", "atenciones abiertas de días anteriores"),
        nombres: nombresResumidos(atencionesVista.map(({ cita }) => cita.paciente)),
        accion: n === 1 && puedeV("consultas", "crear") ? { etiqueta: "Ingresar", onClick: () => onAtenderCita?.(unica) } : { etiqueta: "Ver", onClick: () => irACitas() },
      })
    }
    if (incControlesPorAgendar && sinAgendar.length > 0) {
      const n = sinAgendar.length
      const { paciente, fechaControl, consulta } = sinAgendar[0]
      poner("citas", {
        id: "controles-sin-agendar", cantidad: n,
        texto: uno(n, "control sin agendar", "controles sin agendar"),
        nombres: nombresResumidos(sinAgendar.map((x) => x.paciente.nombre)),
        accion: n === 1 && puedeV("citas", "crear") ? { etiqueta: "Agendar", onClick: () => onAgendarControl?.(paciente, fechaAISO(fechaControl), asignadoDelControl(consulta, equipo)) } : { etiqueta: "Ver", onClick: () => (onVerPacientes ? onVerPacientes({ rapido: "ControlSinAgendar" }) : setVista?.("pacientes")) },
      })
    }
    // Ausencias registradas en "Mi horario" con citas abiertas de esa persona: solo para quien puede reasignar (permiso, no rol).
    if (puedeReasignarCitas) {
      const grupos = citasPorReasignar(citas, disponibilidad, hoyISO())
      const n = grupos.reduce((suma, g) => suma + g.citas.length, 0)
      if (n > 0) poner("citas", {
        id: "ausencias", cantidad: n,
        texto: uno(n, "cita por reasignar por una ausencia", "citas por reasignar por ausencias"),
        nombres: nombresResumidos(grupos.map((g) => `${g.personaNombre || etiquetaMiembro(equipo, g.personaId)} el ${formatoFecha(g.fecha, "medioSinAnio")}`)),
        accion: { etiqueta: "Reasignar", onClick: () => setReasignarGrupo(grupos[0]) },
      })
    }
    if (incCanceladas && paraReagendar.length > 0) {
      const n = paraReagendar.length
      poner("citas", {
        id: "reagendar", cantidad: n,
        texto: uno(n, "cita por reagendar (cancelada o sin asistir)", "citas por reagendar (canceladas o sin asistir)"),
        nombres: nombresResumidos(paraReagendar.map((c) => c.paciente)),
        accion: n === 1 && puedeV("citas", "crear") ? { etiqueta: "Reagendar", onClick: () => onReagendarCancelada?.(paraReagendar[0]) } : { etiqueta: "Ver", onClick: () => onVerCitas?.("todas", "reagendar") },
      })
    }
    if (incPorConfirmar && porConfirmar.length > 0) {
      const n = porConfirmar.length
      poner("pacientes", {
        id: "por-confirmar", cantidad: n,
        texto: uno(n, "paciente de la web con los datos sin confirmar", "pacientes de la web con los datos sin confirmar"),
        nombres: nombresResumidos(porConfirmar.map((p) => p.nombre)),
        accion: n === 1
          ? (puedeV("pacientes", "editar") ? { etiqueta: "Confirmar datos", onClick: () => setConfirmarPaciente(porConfirmar[0]) } : { etiqueta: "Ver paciente", onClick: () => onVerPerfilPaciente?.(porConfirmar[0].id) })
          : { etiqueta: "Revisar", onClick: () => (onVerPacientes ? onVerPacientes({}) : setVista?.("pacientes")) },
      })
    }
    if (incControles && hayInactivos) poner("pacientes", {
      id: "controles", cantidad: inactivos.length,
      texto: esVistaOptometra ? "de tus pacientes con el control vencido" : uno(inactivos.length, "paciente con el control vencido", "pacientes con el control vencido"),
      nombres: nombresResumidos(inactivos.map(({ paciente }) => paciente.nombre)),
      accion: puedeV("crm", "crear") ? { etiqueta: "Ver en CRM", onClick: () => setVista?.("crm") } : null,
    })
    if (incSinConsulta && sinAtender > 0) poner("pacientes", {
      id: "sin-consulta", cantidad: sinAtender, tono: "suave",
      texto: uno(sinAtender, "paciente registrado sin ninguna consulta", "pacientes registrados sin ninguna consulta"),
      accion: { etiqueta: "Ver", onClick: () => (onVerPacientes ? onVerPacientes({ correccion: "Sin evaluación" }) : setVista?.("pacientes")) },
    })
    if (incCumple && cumpleaneros.length > 0) {
      const hoyN = cumpleaneros.filter((c) => c.esHoy).length
      poner("pacientes", {
        id: "cumple", cantidad: cumpleaneros.length, tono: "suave",
        texto: hoyN === 0 ? uno(cumpleaneros.length, "cumpleaños cercano", "cumpleaños cercanos") : hoyN === cumpleaneros.length ? "cumpleaños hoy" : `cumpleaños (${hoyN} hoy)`,
        nombres: nombresResumidos(cumpleaneros.map((c) => c.nombre)),
        accion: puedeV("crm", "crear") ? { etiqueta: "Saludar", onClick: () => setVista?.("crm") } : null,
      })
    }
    if (incOrdenes && listasSinAvisar.length > 0) poner("ventas", {
      id: "ordenes-listas", cantidad: listasSinAvisar.length,
      texto: uno(listasSinAvisar.length, "orden de laboratorio lista sin avisar al paciente", "órdenes de laboratorio listas sin avisar a los pacientes"),
      nombres: nombresResumidos(listasSinAvisar.map((o) => pacientes.find((p) => p.id === o.pacienteId)?.nombre || "Paciente")),
      accion: { etiqueta: puedeV("ventas", "editar") ? "Avisar" : "Ver", onClick: () => onVerOrdenes?.("listas") },
    })
    if (incOrdenes && atrasadas.length > 0) poner("ventas", {
      id: "ordenes-atrasadas", cantidad: atrasadas.length, tono: "urgente",
      texto: uno(atrasadas.length, "orden atrasada", "órdenes atrasadas"),
      nombres: atrasosPorLaboratorio(ordenesLab).map((a) => `${a.laboratorio}: ${a.atrasadas}`).join(" · "),
      accion: { etiqueta: "Ver", onClick: () => onVerOrdenes?.("atrasadas") },
    })
    if (incSaldos && saldos.cantidad > 0) poner("ventas", {
      id: "saldos", cantidad: saldos.cantidad,
      texto: uno(saldos.cantidad, "venta con saldo pendiente", "ventas con saldo pendiente"),
      nombres: dinero(saldos.total),
      accion: { etiqueta: "Ver saldos", onClick: () => onVerSaldos?.() },
    })
    if (incStock && productosBajoStock.length > 0) poner("inventario", {
      id: "stock", cantidad: productosBajoStock.length,
      texto: uno(productosBajoStock.length, "producto con stock bajo", "productos con stock bajo"),
      nombres: nombresResumidos(productosBajoStock.map((p) => `${p.nombre} (${p.stock})`)),
      accion: puedeV("inventario", "editar") ? { etiqueta: "Reabastecer", onClick: () => (onReabastecerProducto ? onReabastecerProducto(productosBajoStock[0].id) : setVista?.("inventario")) } : null,
    })
    return filas
  }
  // Inicio del administrador y del optómetra: un bloque por área, solo los que le corresponden por sus permisos.
  const avisosPorArea = construirAvisos()
  const filasDe = (area) => avisosPorArea.filter((f) => f.area === area)
  const irACitas = () => {
    if (!onVerCitas) return setVista?.("citas")
    if (paraReagendar.length > 0 || atencionesVista.length === 0) onVerCitas("todas", "reagendar")
    else onVerCitas("enAtencion", "siempre")
  }
  // Un bloque solo existe si el rol tiene avisos de esa área; el que existe y está vacío dice "todo en orden".
  const aplicaCitas = incAtenciones || incControlesPorAgendar || incCanceladas || puedeReasignarCitas
  const aplicaPacientes = incPorConfirmar || incControles || incSinConsulta || incCumple
  const aplicaVentas = incOrdenes || incSaldos
  const bloquesAtencion = [
    veCitas && aplicaCitas && { id: "citas", titulo: "Citas", icono: Calendar, filas: filasDe("citas"), onVerTodo: irACitas },
    puedeV("pacientes", "ver") && aplicaPacientes && { id: "pacientes", titulo: "Pacientes", icono: Users, filas: filasDe("pacientes"), onVerTodo: () => (onVerPacientes ? onVerPacientes({}) : setVista?.("pacientes")) },
    veVentas && aplicaVentas && { id: "ventas", titulo: "Ventas", icono: ShoppingBag, filas: filasDe("ventas"), onVerTodo: () => setVista?.("ventas") },
    veInventario && plantilla !== "optometra" && { id: "inventario", titulo: "Inventario", icono: Package, filas: filasDe("inventario"), onVerTodo: () => (onVerStockBajo ? onVerStockBajo() : setVista?.("inventario")) },
  ].filter(Boolean)
  const bRequiereAreas = <RequiereAtencionPorArea bloques={bloquesAtencion} />

  // Ningún Inicio lleva línea de resumen (repetía lo de más abajo); solo queda el aviso de óptica suspendida.
  const bSuspendida = !opticaActiva && (
    <p role="status" className="flex items-center gap-2 text-sm"><span className="rounded-full border border-red-200/60 bg-red-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">Óptica suspendida</span></p>
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

  // ─── 6. Registro de actividad, compacto: las últimas 5 acciones (solo el administrador) ───
  const bActividad = actividadReciente.length > 0 && (
    <section aria-label="Registro de actividad" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Registro de actividad</h2>
        <button type="button" onClick={() => setVista?.("usuarios")} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todo <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white px-5 py-1 shadow-sm">
        {actividadReciente.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
            <p className="min-w-0 truncate text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
              {detalleActividad(l.detalle) && <span className="text-slate-500"> — {detalleActividad(l.detalle)}</span>}
              <span className="text-slate-400"> · {NOMBRE_MODULO[moduloDeRegistro(l)] || l.modulo}</span>
            </p>
            <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{fechaHoraLegible(l.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="w-full space-y-4 text-left">
      <style>{`
        @keyframes inRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .in-rise { animation: inRise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .in-rise { animation: none !important; } }
      `}</style>

      {bSuspendida}
      {bDejarCita}
      {bConfirmarPaciente}
      {bReasignar}

      {plantilla === "administrador" && (
        <>
          {filaTotales}
          {bRequiereAreas}
          <div className="space-y-3">
            {filaDesenlace}
            {bCitasPeriodo}
          </div>
          {bActividad}
        </>
      )}

      {plantilla === "optometra" && (
        <>
          <div className="flex justify-end">{atajosAdmin}</div>
          {bDiaOptometra}
          {bAgendaOptometra}
          {bRequiereAreas}
          {filaDesenlace}
        </>
      )}

      {plantilla === "recepcion" && (
        <>
          <div className="flex justify-end">{atajosAdmin}</div>
          {bRequiereAreas}
          {filaDesenlace}
          {bCitasPeriodo}
        </>
      )}

      {plantilla === "ventas" && (
        <>
          {filaVender}
          {bRequiereAreas}
          {bListaVender}
        </>
      )}

      {plantilla === "general" && (
        <>
          {veVentas ? filaVender : <div className="flex justify-end">{atajosAdmin}</div>}
          {bRequiereAreas}
          {veCitas && filaDesenlace}
          {veCitas && bCitasPeriodo}
          {veVentas && bListaVender}
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

function EstadoVacio({ icon: Icon, texto, compacto = false }) {
  if (compacto) {
    return (
      <p className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-slate-500"><Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" /> {texto}</p>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300">
        <Icon size={22} />
      </div>
      <p className="text-xs font-medium text-slate-500">{texto}</p>
    </div>
  )
}
