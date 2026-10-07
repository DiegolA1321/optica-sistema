"use client"

import { fechaHoraLegible, fechaCorta } from "../utilidades/formatoFecha"
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
} from "lucide-react"
import { diasDesdeUltimaVisita, esInactivo } from "../utilidades/fidelizacion"
import { parseFechaFlexible } from "../utilidades/disponibilidad"
import { esStockBajo, UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { supabase } from "../lib/supabaseClient"
import { etiquetaMiembro } from "../utilidades/equipo"
import { atencionesAbiertasAntiguas, textoAtencionAbierta, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import FilaTarjetas from "../componentes/FilaTarjetas"
import RequiereAtencion from "../componentes/RequiereAtencion"
import { puede } from "../utilidades/permisosUi"
import { textoDiagnostico, textoEspera, diasEnEspera } from "../utilidades/pasesVenta"
import { plantillaInicio, citasPropias, esCitaPropia, resumenHoy, resumenPeriodo, agendaHoyOProximas, fichasSinTerminar, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "../utilidades/inicio"
import { NOMBRE_MODULO } from "../utilidades/logs"
import { ordenesAtrasadas, ordenesListasSinAvisar, atrasosPorLaboratorio } from "../utilidades/ordenesLaboratorio"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  onVerPacientes,
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
  onCrearPacienteRapido,
  onCrearProductoRapido,
  onReabastecerProducto,
  onVerPerfilPaciente,
  ordenesLab = [],
  onVerOrdenes,
  vista = null,
  pases = [],
  facturasVenta = [],
  abonos = [],
  onVerCola,
  onVerCitas,
  nombreUsuario = "Diego",
  opticaNombre,
}) {
  const [cumpleaneros, setCumpleaneros] = useState([])
  // Período del "Desenlace de las citas": el mes en curso o todo lo registrado.
  const [periodo, setPeriodo] = useState("mes")

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
  const renderFilaCita = (cita, idx, mostrarFecha) => (
    <button
      type="button"
      key={cita.id || idx}
      onClick={() => (cita.pacienteId && onVerPerfilPaciente ? onVerPerfilPaciente(cita.pacienteId) : setVista?.("citas"))}
      title={cita.pacienteId ? `Ver ficha de ${cita.paciente || cita.nombre}` : "Ver en la agenda completa"}
      className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 py-3.5 text-left transition-colors first:pt-0 last:pb-0 hover:bg-slate-50/80 cursor-pointer"
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
        cita.estado === "En Espera" ? "border border-amber-200/60 bg-amber-50 text-amber-700"
          : cita.estado === "En Atención" ? "border border-blue-200/60 bg-blue-50 text-blue-700"
          : cita.estado === "Atendida" ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700"
          : cita.estado === "No Asistió" ? "border border-red-200/60 bg-red-50 text-red-700"
          : cita.estado === "Cancelada" ? "border border-slate-200/60 bg-slate-50 text-slate-600"
          : "border border-amber-200/60 bg-amber-50 text-amber-700")}>
        {cita.estado || "Pendiente"}
      </span>
    </button>
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
  const desenlace = useMemo(() => resumenPeriodo(citas, periodo), [citas, periodo])
  const sinAtender = useMemo(() => pacientesSinAtender(pacientes, consultas).length, [pacientes, consultas])
  const saldos = useMemo(() => saldosPorCobrar(facturasVenta, abonos), [facturasVenta, abonos])
  const listos = useMemo(() => pasesListos(pases), [pases])
  const proformas = useMemo(() => proformasEnSeguimiento(pases), [pases])
  const atencionesVista = esVistaOptometra ? atencionesAntiguas.filter(({ cita }) => esCitaPropia(cita, usuario?.id)) : atencionesAntiguas
  const dinero = (n) => "$" + (Number(n) || 0).toFixed(2)
  const filaTotales = (
    <FilaTarjetas
      titulo="Totales"
      descripcion="Todo lo registrado hasta hoy"
      tarjetas={[
        { id: "pacientes", titulo: "Pacientes registrados", valor: pacientes.length, desc: pacientesEsteMes > 0 ? `+${pacientesEsteMes} este mes` : "En la base de datos", icono: Users, color: "slate", onClick: () => setVista?.("pacientes"), cta: puede(usuario, "pacientes", "crear") ? "Registrar paciente" : null, onCta: onCrearPacienteRapido },
        { id: "sinAtender", titulo: "Pacientes sin atender", valor: sinAtender, desc: "Sin ninguna consulta", icono: Users, color: "amber", onClick: () => (onVerPacientes ? onVerPacientes({ correccion: "Sin evaluación" }) : setVista?.("pacientes")) },
        { id: "citas", titulo: "Citas registradas", valor: citas.length, desc: "Desde el inicio", icono: Calendar, color: "blue", onClick: () => setVista?.("citas"), cta: puede(usuario, "citas", "crear") ? "Agendar cita" : null, onCta: onAgendarRapido },
        { id: "productos", titulo: "Productos en inventario", valor: inventario.length, desc: "Registrados", icono: Package, color: "slate", onClick: () => setVista?.("inventario"), cta: puede(usuario, "inventario", "crear") ? "Añadir producto" : null, onCta: onCrearProductoRapido },
      ]}
    />
  )
  const etiquetaPeriodo = periodo === "mes" ? "este mes" : "desde siempre"
  const selectorPeriodo = (
    <div role="group" aria-label="Período del desenlace" className="flex rounded-lg border border-slate-200/60 bg-white p-0.5">
      {[["mes", "Este mes"], ["siempre", "Desde siempre"]].map(([id, etiqueta]) => (
        <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} className={"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (periodo === id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={periodo === id ? { background: INK } : undefined}>{etiqueta}</button>
      ))}
    </div>
  )
  const filaDesenlace = (
    <FilaTarjetas
      titulo={`Desenlace de las citas · ${etiquetaPeriodo}`}
      descripcion={`${desenlace.registradas} ${desenlace.registradas === 1 ? "cita" : "citas"} en el período`}
      acciones={selectorPeriodo}
      tarjetas={[
        { id: "atendidas", titulo: "Atendidas", valor: desenlace.atendidas, desc: "Ver en Citas", icono: CheckCircle2, color: "green", onClick: () => onVerCitas?.("atendida", periodo) },
        { id: "noAtendidas", titulo: "No atendidas", valor: desenlace.noAtendidas, desc: "No asistieron", icono: UserX, color: "red", onClick: () => onVerCitas?.("noAsistio", periodo) },
        { id: "canceladas", titulo: "Canceladas", valor: desenlace.canceladas, desc: "Ver en Citas", icono: Ban, color: "slate", onClick: () => onVerCitas?.("cancelada", periodo) },
      ]}
    />
  )
  const sinTerminar = useMemo(() => fichasSinTerminar(citas, usuario?.id), [citas, usuario?.id])
  const filaHoyOptometra = (
    <FilaTarjetas
      titulo="Hoy"
      descripcion="Tu agenda del día"
      tarjetas={[
        { id: "mias", titulo: "Mis citas de hoy", valor: hoyVista.total, desc: hoyVista.total === 1 ? "cita agendada" : "citas agendadas", icono: Calendar, color: "blue", onClick: () => setVista?.("citas") },
        { id: "siguiente", titulo: "Siguiente paciente", valor: hoyVista.siguiente ? hoyVista.siguiente.hora : "—", desc: hoyVista.siguiente ? hoyVista.siguiente.paciente : "No queda nadie por atender", icono: Clock, color: "slate", onClick: () => (hoyVista.siguiente && puede(usuario, "consultas", "crear") ? onAtenderEnCitas?.(hoyVista.siguiente) : setVista?.("citas")), cta: hoyVista.siguiente && puede(usuario, "consultas", "crear") ? "Atender" : null, onCta: () => onAtenderEnCitas?.(hoyVista.siguiente) },
        // Solo aparece si hay alguna atención abierta propia; sin ninguna, no ocupa lugar.
        ...(sinTerminar.length > 0 ? [{ id: "sinTerminar", titulo: "Fichas sin terminar", valor: sinTerminar.length, desc: sinTerminar.length === 0 ? "Ninguna atención abierta" : sinTerminar.length === 1 ? sinTerminar[0].paciente : `${sinTerminar[0].paciente} y ${sinTerminar.length - 1} más`, icono: Activity, color: sinTerminar.length > 0 ? "amber" : "slate", onClick: () => (sinTerminar.length > 0 && puede(usuario, "consultas", "crear") ? onAtenderCita?.(sinTerminar[0]) : setVista?.("citas")), cta: sinTerminar.length > 0 && puede(usuario, "consultas", "crear") ? "Retomar" : null, onCta: () => onAtenderCita?.(sinTerminar[0]) }] : []),
        { id: "atendidos", titulo: "Atendidos hoy", valor: hoyVista.atendidas, desc: "Fichas terminadas", icono: CheckCircle2, color: "green", onClick: () => onVerCitas?.("atendida") },
      ]}
    />
  )
  const filaHoyRecepcion = (
    <FilaTarjetas
      titulo="Hoy"
      descripcion="El movimiento del día"
      tarjetas={[
        { id: "hoy", titulo: "Citas de hoy", valor: hoyVista.total, desc: hoyVista.total === 1 ? "cita agendada" : "citas agendadas", icono: Calendar, color: "blue", onClick: () => setVista?.("citas") },
        { id: "porLlegar", titulo: "Por llegar", valor: hoyVista.pendientes, desc: "Pendientes", icono: Clock, color: "slate", onClick: () => onVerCitas?.("pendiente") },
        { id: "espera", titulo: "En sala de espera", valor: hoyVista.enEspera, desc: "Ya llegaron", icono: Users, color: "amber", onClick: () => setVista?.("citas") },
        { id: "noAsistieron", titulo: "No asistieron", valor: hoyVista.noAsistieron, desc: "Hoy", icono: UserX, color: "red", onClick: () => onVerCitas?.("noAsistio") },
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
  const incStock = veInventario // quien puede ver el inventario ve el aviso; "Reabastecer" solo con inventario: editar
  const incCumple = (["administrador", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const nombresPaciente = (lista) => lista.slice(0, 3).map((o) => pacientes.find((p) => p.id === o.pacienteId)?.nombre || "Paciente").join(", ") + (lista.length > 3 ? ` y ${lista.length - 3} más` : "")
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

  const filasAtencion = []
  if (incAtenciones) {
    atencionesVista.slice(0, 4).forEach(({ cita, dias }) => filasAtencion.push({
      id: "atencion-" + cita.id,
      icono: Activity,
      titulo: `Atención abierta de un día anterior: ${cita.paciente}`,
      detalle: textoAtencionAbierta(dias) + (cita.atendidoPor ? ` · ${etiquetaMiembro(equipo, cita.atendidoPor)}` : ""),
      acciones: [
        ...(puede(usuario, "consultas", "crear") ? [{ etiqueta: "Ingresar", principal: true, onClick: () => onAtenderCita?.(cita) }] : []),
        { etiqueta: "Dejar de atender", onClick: () => setDejarCita(cita) },
      ],
    }))
    if (atencionesVista.length > 4) filasAtencion.push({ id: "atenciones-mas", icono: Activity, titulo: `Y ${plural(atencionesVista.length - 4, "atención abierta más", "atenciones abiertas más")}`, acciones: [{ etiqueta: "Ver en Citas", onClick: () => onVerCitas?.("enAtencion", "siempre") }] })
  }
  if (incOrdenes && listasSinAvisar.length > 0) filasAtencion.push({
    id: "ordenes-listas", icono: FlaskConical,
    titulo: `${plural(listasSinAvisar.length, "orden de laboratorio lista", "órdenes de laboratorio listas")} sin avisar al paciente`,
    detalle: nombresPaciente(listasSinAvisar),
    acciones: [{ etiqueta: "Avisar", principal: true, onClick: () => onVerOrdenes?.("listas") }],
  })
  if (incOrdenes && atrasadas.length > 0) filasAtencion.push({
    id: "ordenes-atrasadas", icono: FlaskConical,
    titulo: plural(atrasadas.length, "orden atrasada", "órdenes atrasadas"),
    detalle: atrasosPorLaboratorio(ordenesLab).map((a) => `${a.laboratorio}: ${a.atrasadas}`).join(" · "),
    acciones: [{ etiqueta: "Ver atrasadas", onClick: () => onVerOrdenes?.("atrasadas") }],
  })
  if (incControles && hayInactivos) filasAtencion.push({
    id: "controles", icono: Clock,
    titulo: plural(inactivos.length, "paciente con el control vencido", "pacientes con el control vencido"),
    detalle: inactivos.slice(0, 3).map(({ paciente, dias }) => `${paciente.nombre} (hace ${dias} días)`).join(", ") + (inactivos.length > 3 ? ` y ${inactivos.length - 3} más` : ""),
    acciones: [{ etiqueta: "Gestionar en CRM", onClick: () => setVista?.("crm") }],
  })
  if (incStock && productosBajoStock.length > 0) filasAtencion.push({
    id: "stock", icono: Package,
    titulo: plural(productosBajoStock.length, "producto con stock bajo", "productos con stock bajo"),
    detalle: productosBajoStock.slice(0, 3).map((p) => `${p.nombre} (${p.stock})`).join(", ") + (productosBajoStock.length > 3 ? ` y ${productosBajoStock.length - 3} más` : ""),
    acciones: [
      ...(puede(usuario, "inventario", "editar") ? [{ etiqueta: "Reabastecer", principal: true, onClick: () => (onReabastecerProducto ? onReabastecerProducto(productosBajoStock[0].id) : setVista?.("inventario")) }] : []),
      { etiqueta: "Ver inventario", onClick: () => setVista?.("inventario") },
    ],
  })
  if (incCumple && cumpleaneros.length > 0) filasAtencion.push({
    id: "cumple", icono: Cake,
    titulo: cumpleaneros.some((c) => c.esHoy) ? `${plural(cumpleaneros.filter((c) => c.esHoy).length, "cumpleaños hoy", "cumpleaños hoy")} para saludar` : `${plural(cumpleaneros.length, "cumpleaños cercano", "cumpleaños cercanos")} para saludar`,
    detalle: cumpleaneros.slice(0, 3).map((c) => c.nombre).join(", ") + (cumpleaneros.length > 3 ? ` y ${cumpleaneros.length - 3} más` : ""),
    acciones: [{ etiqueta: "Saludar en CRM", onClick: () => setVista?.("crm") }],
  })
  const bRequiere = <RequiereAtencion filas={filasAtencion} />

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

  const bDejarCita = dejarCita && (
    <ConfirmarDejarDeAtender
      cita={dejarCita}
      usuario={usuario}
      setCitas={setCitas}
      onCancelar={() => setDejarCita(null)}
      onHecho={(mensaje) => { setDejarCita(null); onAviso?.(mensaje) }}
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

      {bResumenDia}
      {bDejarCita}

      {plantilla === "administrador" && (
        <>
          {filaTotales}
          {filaDesenlace}
          {bRequiere}
          {bHoy(true)}
          {bActividad}
        </>
      )}

      {plantilla === "optometra" && (
        <>
          {filaHoyOptometra}
          {bRequiere}
          {bHoy(false, true)}
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
