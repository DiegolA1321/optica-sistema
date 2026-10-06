"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Users,
  AlertTriangle,
  Calendar,
  Package,
  ArrowRight,
  Cake,
  MessageCircle,
  Clock,
  History,
  TrendingUp,
  Stethoscope,
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
import { esHoy, minutosDesdeMedianoche, parseFechaFlexible } from "../utilidades/disponibilidad"
import { esStockBajo } from "../utilidades/inventario"
import { supabase } from "../lib/supabaseClient"
import { etiquetaMiembro } from "../utilidades/equipo"
import { atencionesAbiertasAntiguas, textoAtencionAbierta, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import FilaTarjetas from "../componentes/FilaTarjetas"
import { puede } from "../utilidades/permisosUi"
import { fechaLegible } from "../utilidades/formatoFecha"
import { textoDiagnostico, textoEspera, diasEnEspera } from "../utilidades/pasesVenta"
import { plantillaInicio, citasPropias, esCitaPropia, resumenHoy, resumenMes, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "../utilidades/inicio"
import { NOMBRE_MODULO } from "../utilidades/logs"
import { ordenesAtrasadas, ordenesListasSinAvisar, atrasosPorLaboratorio, ordenesAbiertas, estaAtrasada, numeroOrden } from "../utilidades/ordenesLaboratorio"
import { INK, GOLD, ACCION_CONFIRMAR } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  setVista,
  setCitas,
  onAviso,
  onAtenderCita,
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
  const esOptometraNoAdmin = esOptometra && !esAdmin
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
      .slice(0, 5)
  }, [pacientes, consultas])

  const enviarFelicitacionWhatsApp = (nombre, celular) => {
    if (!celular) return
    const numLimpio = celular.toString().replace(/\D/g, "")
    const mensaje = encodeURIComponent(
      `¡Hola, ${nombre}! Te saludamos de parte de ${opticaNombre || "tu óptica"}. Queremos desearte un feliz cumpleaños. Por ser tu mes especial, cuentas con un examen de control visual de cortesía.`
    )
    window.open(`https://wa.me/${numLimpio}?text=${mensaje}`, "_blank")
  }

  // Solo las alertas de inventario REALES (stock por debajo del mínimo), no el total de productos
  const productosBajoStock = useMemo(() => inventario.filter(esStockBajo), [inventario])

  // Prioridad automática de reabastecimiento (pedido explícito de Diego:
  // "que ordene automáticamente... muestra primero los ítems en estado
  // crítico"): primero los que ya están por debajo de su mínimo (esStockBajo,
  // que compara contra el umbral propio de cada producto, no solo el número
  // crudo), ordenados de menor a mayor entre ellos; después el resto,
  // también ascendente. Reemplaza el toggle "mayor/menor stock" — este
  // widget es una alerta de reabastecimiento, no un explorador del
  // inventario completo (eso ya lo cubre el módulo Inventario).
  const productosPrioridadReabastecimiento = useMemo(() => {
    const bajos = inventario.filter(esStockBajo).sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))
    const resto = inventario.filter((p) => !esStockBajo(p)).sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))
    return [...bajos, ...resto].slice(0, 5)
  }, [inventario])

  // Citas agendadas para la fecha de hoy (antes esto mostraba TODAS las citas
  // jamás agendadas — el primer número que ve el optómetra al entrar era falso
  // y crecía para siempre). Se ordenan por hora, más temprano primero.
  const citasHoy = useMemo(
    () => citas.filter((c) => esHoy(c.fecha) && c.estado !== "Cancelada").sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)),
    [citas]
  )

  // Para "Mi agenda" (vista del optómetra, D4): pacientes en atención ahora
  // mismo (no acotado a hoy, mismo criterio sin fecha que ya usa el badge de
  // Citas.jsx) y lo que todavía le falta atender de la agenda de hoy.
  const pacientesEnAtencion = useMemo(() => citas.filter((c) => c.estado === "En Atención" && diasAtencionAbierta(c) === null), [citas])
  // Atenciones que se abrieron un día anterior y nadie cerró.
  const atencionesAntiguas = useMemo(() => atencionesAbiertasAntiguas(citas), [citas])
  const [dejarCita, setDejarCita] = useState(null)
  const citasPendientesHoy = useMemo(
    () => citasHoy.filter((c) => !["Atendida", "No Asistió", "Cancelada"].includes(c.estado)),
    [citasHoy]
  )

  // El ing probó este panel con la agenda vacía para el día y vio un hueco
  // en blanco ("Últimas citas... para evitar que se vea así vacío"). Si no
  // hay citas hoy, cae a las más recientes ya pasadas (más reciente primero)
  // como recordatorio de contexto, en vez de un estado vacío.
  const citasParaMostrar = useMemo(() => {
    if (citasHoy.length > 0) return citasHoy
    return [...citas]
      .filter((c) => c.estado !== "Cancelada")
      .sort((a, b) => {
        const fa = parseFechaFlexible(a.fecha)?.getTime() ?? 0
        const fb = parseFechaFlexible(b.fecha)?.getTime() ?? 0
        if (fb !== fa) return fb - fa
        return minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora)
      })
      .slice(0, 5)
  }, [citas, citasHoy])
  const mostrandoHistorial = citasHoy.length === 0 && citasParaMostrar.length > 0

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
              {(() => { const f = parseFechaFlexible(cita.fecha); return f ? f.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "" })()}
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
  const citasDelDia = hoyVista.citas
  const mes = useMemo(() => resumenMes(citas), [citas])
  const sinAtender = useMemo(() => pacientesSinAtender(pacientes, consultas).length, [pacientes, consultas])
  const saldos = useMemo(() => saldosPorCobrar(facturasVenta, abonos), [facturasVenta, abonos])
  const listos = useMemo(() => pasesListos(pases), [pases])
  const proformas = useMemo(() => proformasEnSeguimiento(pases), [pases])
  const atencionesVista = esVistaOptometra ? atencionesAntiguas.filter(({ cita }) => esCitaPropia(cita, usuario?.id)) : atencionesAntiguas
  const dinero = (n) => "$" + (Number(n) || 0).toFixed(2)
  const ordenesAbiertasLista = useMemo(() => ordenesAbiertas(ordenesLab).sort((a, b) => (estaAtrasada(b) - estaAtrasada(a)) || (a.fechaPrometida < b.fechaPrometida ? -1 : 1)).slice(0, 5), [ordenesLab])

  const filaTotales = (
    <FilaTarjetas
      titulo="Totales"
      descripcion="Todo lo registrado hasta hoy"
      tarjetas={[
        { id: "pacientes", titulo: "Pacientes registrados", valor: pacientes.length, desc: pacientesEsteMes > 0 ? `+${pacientesEsteMes} este mes` : "En la base de datos", icono: Users, color: "slate", onClick: () => setVista?.("pacientes"), cta: puede(usuario, "pacientes", "crear") ? "Registrar paciente" : null, onCta: onCrearPacienteRapido },
        { id: "citas", titulo: "Citas registradas", valor: citas.length, desc: "Desde el inicio", icono: Calendar, color: "blue", onClick: () => setVista?.("citas"), cta: puede(usuario, "citas", "crear") ? "Agendar cita" : null, onCta: onAgendarRapido },
        { id: "productos", titulo: "Productos en inventario", valor: inventario.length, desc: "Registrados", icono: Package, color: "slate", onClick: () => setVista?.("inventario"), cta: puede(usuario, "inventario", "crear") ? "Añadir producto" : null, onCta: onCrearProductoRapido },
      ]}
    />
  )
  const filaMes = (
    <FilaTarjetas
      titulo="Citas de este mes"
      descripcion={`${mes.registradas} ${mes.registradas === 1 ? "cita" : "citas"} en el mes`}
      tarjetas={[
        { id: "atendidas", titulo: "Atendidas", valor: mes.atendidas, desc: "Ver en Citas", icono: CheckCircle2, color: "green", onClick: () => onVerCitas?.("atendida") },
        { id: "noAtendidas", titulo: "No atendidas", valor: mes.noAtendidas, desc: "No asistieron", icono: UserX, color: "red", onClick: () => onVerCitas?.("noAsistio") },
        { id: "canceladas", titulo: "Canceladas", valor: mes.canceladas, desc: "Ver en Citas", icono: Ban, color: "slate", onClick: () => onVerCitas?.("cancelada") },
        { id: "sinAtender", titulo: "Pacientes sin atender", valor: sinAtender, desc: "Todavía sin ninguna consulta", icono: Users, color: "amber", onClick: () => setVista?.("pacientes") },
      ]}
    />
  )
  const filaHoyOptometra = (
    <FilaTarjetas
      titulo="Hoy"
      descripcion="Tu agenda del día"
      tarjetas={[
        { id: "mias", titulo: "Mis citas de hoy", valor: hoyVista.total, desc: hoyVista.total === 1 ? "cita agendada" : "citas agendadas", icono: Calendar, color: "blue", onClick: () => setVista?.("citas") },
        { id: "siguiente", titulo: "Siguiente paciente", valor: hoyVista.siguiente ? hoyVista.siguiente.hora : "—", desc: hoyVista.siguiente ? hoyVista.siguiente.paciente : "No queda nadie por atender", icono: Clock, color: "slate", onClick: hoyVista.siguiente ? () => onAtenderCita?.(hoyVista.siguiente) : undefined },
        { id: "enAtencion", titulo: "En atención ahora", valor: hoyVista.enAtencion, desc: "Pacientes con la ficha abierta", icono: Activity, color: "amber", onClick: () => setVista?.("citas") },
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
        { id: "atrasadas", titulo: "Órdenes atrasadas", valor: atrasadas.length, desc: "Pasó la fecha prometida", icono: FlaskConical, color: atrasadas.length > 0 ? "red" : "slate", onClick: () => onVerOrdenes?.("atrasadas") },
        { id: "sinAvisar", titulo: "Lentes listos sin avisar", valor: listasSinAvisar.length, desc: "Avisa al paciente", icono: MessageCircle, color: listasSinAvisar.length > 0 ? "amber" : "slate", onClick: () => onVerOrdenes?.("listas") },
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
  const bOrdenes = (
    <section aria-label="Órdenes de laboratorio" className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><FlaskConical size={18} aria-hidden="true" /></div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: INK }}>Órdenes de laboratorio</h4>
            <p className="text-[11px] text-slate-500">{ordenesAbiertas(ordenesLab).length === 0 ? "No hay órdenes abiertas" : `${ordenesAbiertas(ordenesLab).length} abiertas${atrasadas.length > 0 ? ` · ${atrasadas.length} atrasadas` : ""}`}</p>
          </div>
        </div>
        <button type="button" onClick={() => onVerOrdenes?.("abiertas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver órdenes <ArrowRight size={14} aria-hidden="true" /></button>
      </div>
      {ordenesAbiertasLista.length === 0 ? (
        <EstadoVacio icon={FlaskConical} texto="Las órdenes se crean al vender lentes." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {ordenesAbiertasLista.map((o) => {
            const paciente = pacientes.find((x) => x.id === o.pacienteId)
            const atrasada = estaAtrasada(o)
            return (
              <li key={o.id}>
                <button type="button" onClick={() => onVerOrdenes?.(o.estado === "lista" ? "listas" : atrasada ? "atrasadas" : "abiertas")} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800"><span className="font-mono">{numeroOrden(o.numero)}</span> · {paciente?.nombre || "Paciente"}</span>
                    <span className="block truncate text-[11px] text-slate-500">{o.laboratorio ? o.laboratorio + " · " : ""}Entrega {fechaLegible(o.fechaPrometida)}</span>
                  </span>
                  <span className={"shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold " + (atrasada ? "border-red-200/60 bg-red-50 text-red-700" : o.estado === "lista" ? "border-emerald-200/60 bg-emerald-50 text-emerald-700" : "border-blue-200/60 bg-blue-50 text-blue-700")}>{atrasada ? "Atrasada" : o.estado === "lista" ? (o.pacienteAvisadoEn ? "Lista · avisado" : "Lista · avisar") : "En el laboratorio"}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const hoyFecha = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Mismo criterio que Citas/Pacientes/Inventario (cargaInicial && sin datos
  // todavía): antes Inicio no recibía este prop y era el único módulo que
  // podía mostrar "0 pacientes / 0 citas hoy" durante un parpadeo mientras
  // App.jsx aún hidrataba — justo la primera pantalla que ve el usuario al
  // entrar. Estrictamente prohibido por CLAUDE.md ("pantallas vacías o
  // parpadeos durante la petición de datos").
  if (cargaInicial && pacientes.length === 0 && citas.length === 0 && inventario.length === 0) {
    return <InicioSkeleton />
  }

  const bHero = (
    <>
      {/* ─── HERO / BIENVENIDA (claro) ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <svg aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 text-blue-600" viewBox="0 0 400 400" fill="none" stroke="currentColor" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.14), transparent 70%)" }} />

        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Panel principal
            </span>
            <h1 className="mt-2 font-serif text-2xl font-semibold italic tracking-tight sm:text-3xl" style={{ color: INK }}>
              ¡Bienvenido, {nombreUsuario}!
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              {`Tienes ${citasDelDia.length} ${citasDelDia.length === 1 ? "cita" : "citas"} para hoy${cumpleaneros.length > 0 ? ` y ${cumpleaneros.length} de cumpleaños por saludar` : ""}. Aquí está tu resumen del día.`}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2.5 md:items-end">
            <span className="rounded-xl border border-slate-200/60 bg-slate-50 px-3.5 py-2 text-xs font-semibold capitalize text-slate-600">
              {hoyFecha}
            </span>
            {/* Antes era texto fijo, sin relación con opticas.activa — decía
                "activo" aunque la óptica estuviera suspendida. Ahora refleja
                el estado real (ver App.jsx: hidratación + polling cada
                2.5 min contra opticas.activa). */}
            {opticaActiva ? (
              <span className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Módulo clínico activo</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Óptica suspendida</span>
              </span>
            )}
          </div>
        </div>
      </div>


    </>
  )

  const bAtenciones = (
    <>
      {/* ─── ATENCIONES ABIERTAS DE DÍAS ANTERIORES: se pueden retomar o cerrar ─── */}
      {atencionesVista.length > 0 && (
        <section aria-label="Atenciones abiertas de días anteriores" className="space-y-2 rounded-2xl border border-amber-300/70 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
            {atencionesVista.length === 1 ? "Hay 1 atención abierta de un día anterior" : `Hay ${atencionesVista.length} atenciones abiertas de días anteriores`}
          </p>
          <ul className="divide-y divide-amber-200/70">
            {atencionesVista.map(({ cita, dias }) => (
              <li key={cita.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-amber-950">{cita.paciente}</p>
                  <p className="text-xs text-amber-800">{textoAtencionAbierta(dias)}{cita.atendidoPor ? ` · ${etiquetaMiembro(equipo, cita.atendidoPor)}` : ""}</p>
                </div>
                <button type="button" onClick={() => onAtenderCita?.(cita)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 cursor-pointer">Ingresar</button>
                <button type="button" onClick={() => setDejarCita(cita)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer">Dejar de atender</button>
              </li>
            ))}
          </ul>
        </section>
      )}

    </>
  )

  const bOrdenesAlerta = (
    <>
      {/* ─── ÓRDENES DE LABORATORIO (R37): lentes listos sin avisar y órdenes atrasadas ─── */}
      {(listasSinAvisar.length > 0 || atrasadas.length > 0) && (
        <section aria-label="Órdenes de laboratorio que necesitan atención" className="space-y-2 rounded-2xl border border-blue-200/70 bg-blue-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <FlaskConical size={16} className="shrink-0 text-blue-600" aria-hidden="true" />
            Órdenes de laboratorio que necesitan atención
          </p>
          <ul className="divide-y divide-blue-200/70">
            {listasSinAvisar.length > 0 && (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
                <p className="min-w-0 flex-1 text-sm text-blue-950">
                  <span className="font-semibold">{listasSinAvisar.length === 1 ? "1 orden lista" : `${listasSinAvisar.length} órdenes listas`}</span> sin avisar al paciente
                  <span className="block text-xs text-blue-800">{listasSinAvisar.slice(0, 3).map((o) => pacientes.find((p) => p.id === o.pacienteId)?.nombre || "Paciente").join(", ")}{listasSinAvisar.length > 3 ? ` y ${listasSinAvisar.length - 3} más` : ""}</span>
                </p>
                <button type="button" onClick={() => onVerOrdenes?.("listas")} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer">Avisar</button>
              </li>
            )}
            {atrasadas.length > 0 && (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2">
                <p className="min-w-0 flex-1 text-sm text-blue-950">
                  <span className="font-semibold">{atrasadas.length === 1 ? "1 orden atrasada" : `${atrasadas.length} órdenes atrasadas`}</span>
                  <span className="block text-xs text-blue-800">{atrasosPorLaboratorio(ordenesLab).map((a) => `${a.laboratorio}: ${a.atrasadas}`).join(" · ")}</span>
                </p>
                <button type="button" onClick={() => onVerOrdenes?.("atrasadas")} className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-800 transition-colors hover:bg-blue-100 cursor-pointer">Ver atrasadas</button>
              </li>
            )}
          </ul>
        </section>
      )}

    </>
  )

  const bDejarCita = (
    <>
      {dejarCita && (
        <ConfirmarDejarDeAtender
          cita={dejarCita}
          usuario={usuario}
          setCitas={setCitas}
          onCancelar={() => setDejarCita(null)}
          onHecho={(mensaje) => { setDejarCita(null); onAviso?.(mensaje) }}
        />
      )}


    </>
  )

  const bEnAtencion = (
    <>
      {/* ─── EN ATENCIÓN AHORA (R21): el administrador ve cuántas citas se están
          atendiendo y quién las atiende; se actualiza solo. ─── */}
      {(
        <section aria-label="En atención ahora" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-blue-200/60 bg-blue-50 text-blue-600"><Activity size={20} aria-hidden="true" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">En atención ahora</p>
              <p className="font-serif text-2xl font-semibold leading-none" style={{ color: INK }} aria-live="polite">{pacientesEnAtencion.length}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {pacientesEnAtencion.length === 0 ? (
              <p className="text-sm text-slate-500">Nadie está en atención en este momento.</p>
            ) : (
              pacientesEnAtencion.map((c) => (
                <span key={c.id} className="flex max-w-full items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="truncate">{c.paciente}</span>
                  <span className="shrink-0 font-normal text-blue-600/80">· {etiquetaMiembro(equipo, c.atendidoPor) || "Sin registro"}</span>
                </span>
              ))
            )}
          </div>
          <button type="button" onClick={() => setVista?.("citas")} className="flex shrink-0 items-center gap-1 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
            Ver en Citas <ArrowRight size={13} aria-hidden="true" />
          </button>
        </section>
      )}


    </>
  )

  const bCumple = (
    <>
      {/* ─── CUMPLEAÑEROS ─── */}
      {cumpleaneros.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: GOLD, boxShadow: "0 10px 20px -8px rgba(200,162,78,0.6)" }}>
              <Cake size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold" style={{ color: "#7c5e14" }}>
                {cumpleaneros.some((c) => c.esHoy)
                  ? `¡${cumpleaneros.filter((c) => c.esHoy).length > 1 ? "Hoy cumplen años" : "Hoy cumple años"}!`
                  : "Cumpleaños cercanos"}
              </h4>
              <p className="mt-0.5 text-xs" style={{ color: "#96742a" }}>
                Una excelente oportunidad para saludarlos y fidelizarlos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cumpleaneros.map((c, i) => (
                  <span
                    key={c.id || i}
                    className={"flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm " + (c.esHoy ? "ring-2 ring-offset-1" : "")}
                    style={{ borderColor: "rgba(200,162,78,0.3)", color: "#7c5e14", ...(c.esHoy ? { "--tw-ring-color": GOLD } : {}) }}
                  >
                    {c.esHoy && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white" style={{ backgroundColor: GOLD }}>Hoy</span>}
                    {c.nombre} ({c.edad} años)
                    <button
                      type="button"
                      onClick={() => enviarFelicitacionWhatsApp(c.nombre, c.contacto || c.telefono || c.celular)}
                      className={"flex items-center justify-center rounded-lg p-1 transition-colors cursor-pointer " + ACCION_CONFIRMAR}
                      title="Enviar felicitación por WhatsApp"
                      aria-label="Enviar felicitación por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


    </>
  )

  const bInactivos = (
    <>
      {/* ─── PACIENTES POR RECONECTAR ─── */}
      {inactivos.length > 0 && (
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#f87171,#dc2626)", boxShadow: "0 10px 20px -8px rgba(220,38,38,0.5)" }}>
              <Clock size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800">Pacientes con el control vencido</h4>
              <p className="mt-0.5 text-xs text-red-600/80">
                Ya pasó la fecha de su próximo control recomendado. Un recordatorio ayuda a que no pierdan su seguimiento visual.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {inactivos.map(({ paciente, dias }) => (
                  <span key={paciente.id} className="rounded-xl border border-red-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm">
                    {paciente.nombre} · hace {dias} días
                  </span>
                ))}
              </div>
              <button type="button" onClick={() => setVista?.("crm")} className="mt-3 flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 cursor-pointer">
                Gestionar en CRM <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  )

  const bCitasCercanas = (
    <>
        {/* Citas de hoy */}
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                <Calendar size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Últimas citas / Agenda cercana</h4>
                <p className="text-[11px] text-slate-500">{mostrandoHistorial ? "Sin citas hoy — últimas registradas" : "Orden cronológico"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver agenda completa <ArrowRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {citasParaMostrar.length === 0 ? (
              <EstadoVacio icon={Calendar} texto="Todavía no hay citas registradas." />
            ) : (
              citasParaMostrar.map((cita, idx) => renderFilaCita(cita, idx, mostrandoHistorial))
            )}
          </div>
        </section>


    </>
  )

  const bAgendaHoy = (
    <>
        {/* Citas de hoy */}
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                <Calendar size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Agenda de hoy</h4>
                <p className="text-[11px] text-slate-500">En orden de hora</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver agenda completa <ArrowRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {hoyVista.citas.length === 0 ? (
              <EstadoVacio icon={Calendar} texto="No hay citas agendadas para hoy." />
            ) : (
              hoyVista.citas.map((cita, idx) => renderFilaCita(cita, idx, false))
            )}
          </div>
        </section>


    </>
  )

  const bStock = (
    <>
        {/* Inventario: prioridad automática de reabastecimiento — sin
            toggle, siempre primero lo crítico (pedido explícito de Diego).
            Cada fila es un botón: un clic manda directo al modal de
            editar/sumar stock de ESE producto en Inventario.jsx. */}
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Reabastecimiento</h4>
                <p className="text-[11px] text-slate-500">
                  {productosBajoStock.length === 0 ? "Ningún producto con stock bajo" : `${productosBajoStock.length} ${productosBajoStock.length === 1 ? "producto con stock bajo" : "productos con stock bajo"}`}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("inventario")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver inventario <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {productosPrioridadReabastecimiento.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">No hay productos registrados en el inventario.</p>
            ) : (
              (() => {
                const maxVista = Math.max(1, ...productosPrioridadReabastecimiento.map((p) => Number(p.stock) || 0))
                return productosPrioridadReabastecimiento.map((prod, idx) => {
                  const stock = Number(prod.stock) || 0
                  const pct = Math.max(4, Math.round((stock / maxVista) * 100))
                  const bajo = esStockBajo(prod)
                  return (
                    <button
                      type="button"
                      key={prod.id || idx}
                      onClick={() => (onReabastecerProducto ? onReabastecerProducto(prod.id) : setVista?.("inventario"))}
                      title={`Reabastecer ${prod.nombre}`}
                      className="group -mx-2 flex w-[calc(100%+1rem)] flex-col rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-amber-50/70 cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 transition-colors group-hover:text-amber-700">{prod.nombre}</span>
                        <span className="flex items-center gap-1.5">
                          <span className={"font-mono font-bold " + (bajo ? "text-amber-600" : "text-slate-700")}>{prod.stock}</span>
                          <ArrowRight size={12} className="text-slate-400 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: bajo ? "#F59E0B" : "#2563EB" }} />
                      </div>
                    </button>
                  )
                })
              })()
            )}
          </div>
        </section>

    </>
  )

  const bMiAgenda = (
    <>
      {/* ─── MI AGENDA (D4, reunión 29 sept.): para quien esté marcado
          es_optometra=true — su agenda de hoy, con "en atención" ya
          visible en el badge de cada fila. Para un asistente-optómetra es
          la única vista de citas de Inicio; para un admin-optómetra se
          suma a la vista global de arriba, no la reemplaza. La agenda es
          compartida entre todos los optómetras de la óptica (no hay hoy
          una columna que asigne cada cita a una persona en particular). ─── */}
      {(
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                <Stethoscope size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Mi agenda</h4>
                <p className="text-[11px] text-slate-500">
                  {hoyVista.pendientes + hoyVista.enEspera} {hoyVista.pendientes + hoyVista.enEspera === 1 ? "cita por atender" : "citas por atender"} hoy
                  {hoyVista.enAtencion > 0 ? ` · ${hoyVista.enAtencion} en atención` : ""}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver mis citas <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {citasDelDia.length === 0 ? (
              <EstadoVacio icon={Stethoscope} texto="No tienes citas agendadas para hoy." />
            ) : (
              citasDelDia.map((cita, idx) => renderFilaCita(cita, idx, false))
            )}
          </div>
        </section>
      )}


    </>
  )

  const bActividad = (
    <>
      {/* ─── REGISTRO DE ACTIVIDAD (solo admin principal, misma fuente que
          Usuarios.jsx — responde "qué cambió", que el resto del panel no
          contestaba). Título/copy ajustados para que se lea como registro
          de auditoría, no como un atajo de navegación — no es el mismo
          widget que ING1 pidió quitar (aquella "búsqueda rápida de
          paciente" ya no existe); esta sección viene de un pedido distinto
          (exponer "Actividad" también al admin de la óptica). ─── */}
      {actividadReciente.length > 0 && (
        <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <History size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Registro de actividad</h4>
                <p className="text-[11px] text-slate-500">Qué cambió y quién lo hizo</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("usuarios")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver todo <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {actividadReciente.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
                    {l.detalle && <span className="text-slate-500"> — {l.detalle}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{NOMBRE_MODULO[l.modulo] || l.modulo}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">{new Date(l.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </>
  )

  return (
    <div className="w-full space-y-6 text-left">
      <style>{`
        @keyframes inRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .in-rise { animation: inRise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .in-rise { animation: none !important; } }
      `}</style>

      {bHero}
      {bDejarCita}

      {plantilla === "administrador" && (
        <>
          {bAtenciones}
          {bOrdenesAlerta}
          {filaTotales}
          {filaMes}
          {bEnAtencion}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{bCitasCercanas}{bStock}</div>
          {bCumple}
          {bInactivos}
          {bActividad}
        </>
      )}

      {plantilla === "optometra" && (
        <>
          {bAtenciones}
          {filaHoyOptometra}
          {bMiAgenda}
          {bInactivos}
        </>
      )}

      {plantilla === "recepcion" && (
        <>
          {bAtenciones}
          {filaHoyRecepcion}
          {atajosRecepcion}
          {bAgendaHoy}
          {bCumple}
          {bInactivos}
        </>
      )}

      {plantilla === "ventas" && (
        <>
          {bOrdenesAlerta}
          {filaVender}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{bColaVender}{bOrdenes}</div>
          {veInventario && bStock}
        </>
      )}

      {plantilla === "general" && (
        <>
          {veCitas && bAtenciones}
          {veVentas && bOrdenesAlerta}
          {veCitas && filaHoyRecepcion}
          {veVentas && filaVender}
          {veCitas && bAgendaHoy}
          {veVentas && <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{bColaVender}{bOrdenes}</div>}
          {veInventario && bStock}
          {veCrm && bCumple}
          {veCrm && bInactivos}
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
      <div className="h-36 animate-pulse rounded-3xl border border-slate-200/60 bg-slate-100/70 sm:h-32" />
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
