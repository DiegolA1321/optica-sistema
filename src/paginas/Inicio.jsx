"use client"

import { etiquetaEstadoCita } from "../utilidades/estadosCita"
import { dinero } from "../utilidades/formatoMoneda"
import { numeroComprobante } from "../utilidades/comprobantes"
import { ahoraEcuador } from "../utilidades/horaEcuador"

import { fechaHoraLegible, fechaCorta, fechaLegible, formatoFecha, nombreMes as nombreMesDe } from "../utilidades/formatoFecha"
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
  CalendarOff,
  UserPlus,
} from "lucide-react"
import { listaParaContactar, puedeContactarPor } from "../utilidades/crmContactos"
import { esInactivo } from "../utilidades/fidelizacion"
import { controlesSinAgendar, asignadoDelControl, citasParaReagendar } from "../utilidades/controles"
import { fechaAISO, hoyISO, esHoy } from "../utilidades/disponibilidad"
import { citasPorReasignar } from "../utilidades/reasignacion"
import { miembrosActivos } from "../utilidades/equipo"
import ReasignarCitasModal from "../componentes/ReasignarCitasModal"
import { parseFechaFlexible } from "../utilidades/disponibilidad"
import { esStockBajo, esSobrestock, maximoDe, UMBRAL_STOCK_BAJO, UMBRAL_STOCK_MAXIMO } from "../utilidades/inventario"
import { supabase } from "../lib/supabaseClient"
import { etiquetaMiembro } from "../utilidades/equipo"
import { atencionesAbiertasAntiguas, textoAtencionAbierta, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import FilaTarjetas from "../componentes/FilaTarjetas"
import RequiereAtencionPorArea, { BotonRequierenAtencion } from "../componentes/RequiereAtencionPorArea"
import AvisosInicio from "../componentes/AvisosInicio"
import { particionarDescartados, TIPOS_DESCARTABLES } from "../utilidades/avisosDescartados"
import { citasPorContactar, motivoDeLaCita, TIPO_AVISO_CONTACTAR } from "../utilidades/contactarPaciente"
import { useEscribirPorWhatsApp } from "../componentes/EscribirPorWhatsApp"
import VentanaTotal from "../componentes/VentanaTotal"
import ParaEmpezar from "../componentes/ParaEmpezar"
import VentanaActividad from "../componentes/VentanaActividad"
import { puede } from "../utilidades/permisosUi"
import { textoDiagnostico, textoEspera, diasEnEspera, esDelPortal, etiquetaInteres } from "../utilidades/pasesVenta"
import { textoAvisoContacto } from "../utilidades/avisosContacto"
import { ventasDelMes, nombresResumidos, agendaOptometra, plantillaInicio, citasPropias, esCitaPropia, resumenHoy, resumenPeriodo, citasParaLista, creadosEsteMes, PERIODOS_DESENLACE, agendaHoyOProximas, fichasSinTerminar, pacientesSinAtender, proformasEnSeguimiento, pasesListos } from "../utilidades/inicio"
import { NOMBRE_MODULO, detalleActividad, moduloDeRegistro } from "../utilidades/logs"
import { puedeNivel } from "../utilidades/roles"
import { saldoFactura } from "../utilidades/abonos"
import { saldosPorPaciente, resumenSaldos, textoSaldos, textoSaldosSinNumero } from "../utilidades/saldosVentas"
import { ordenesAtrasadas, ordenesListasSinAvisar, numeroOrden } from "../utilidades/ordenesLaboratorio"
import { etiquetaEntrega } from "../utilidades/ventasModulo"
import { INK, GRAD_MARCA } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  onVerPacientes,
  setPacientes,
  umbralStock = UMBRAL_STOCK_BAJO,
  maximoStock = UMBRAL_STOCK_MAXIMO,
  setVista,
  onVerCrm, // abre el CRM con un motivo: { filtro }
  paraContactar, // la lista "Para contactar" del CRM ({ filas }), o null mientras carga; sin ella (pruebas) se calcula sin contactos
  setCitas,
  solicitudesEliminacion = [], // pacientes que pidieron eliminar su cuenta desde el portal (pendientes)
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
  descartes = new Map(), // los avisos descartados vigentes (clave «tipo|clave» → descarte)
  onDescartar, // async (tipo, clave, motivo, detalle) → { error? }
  onRestaurar, // async (tipo, clave) → { error? }
  seguimientoContacto = new Map(), // por cita por contactar: { motivo, contactadaEn, sinSeguimiento }
  onContactarPaciente, // (cita) → abre WhatsApp con la plantilla del CRM, lo anota en el Seguimiento del CRM y deja la cita como «contactada»
  onCrearPacienteRapido,
  onCrearProductoRapido,
  onReabastecerProducto,
  onVerPerfilPaciente,
  ordenesLab = [],
  onVerOrdenes,
  onVerSaldos,
  onVerStockBajo,
  onVerSobrestock,
  vista = null,
  avisosContacto = [],
  onAtenderAvisoContacto,
  pagosPorVerificar = [],
  pases = [],
  facturasVenta = [],
  abonos = [],
  ventas = [],
  onVerTotal,
  onVerCitas,
  nombreUsuario = "Diego",
  opticaNombre,
  disponibilidad,
  puedeReasignarCitas = false,
  soloAvisosDe = null, // "citas" | "pacientes" | "ventas" | "inventario": en vez del Inicio, solo el botón "Requieren atención" de ese módulo
}) {
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
  const escribirPorWhatsApp = useEscribirPorWhatsApp()
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
    if (!esAdmin || soloAvisosDe || !supabase || !usuario?.opticaId) return
    supabase
      .from("logs_optica")
      .select("*")
      .eq("optica_id", usuario.opticaId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setActividadReciente(data || []))
  }, [esAdmin, usuario?.opticaId])

  // Control vencido y cumpleaños salen de la lista "Para contactar" del CRM: el aviso cuenta EXACTAMENTE lo mismo que esa lista (solo los que hoy
  // hay que contactar: sin los que ya se contactaron y descansan, ni los que no aceptaron ese tipo de mensaje).
  const listaCrm = useMemo(() => (paraContactar !== undefined ? paraContactar : listaParaContactar({ pacientes, consultas, ordenes: ordenesLab, pases, facturas: facturasVenta, citas, contactos: [] })), [paraContactar, pacientes, consultas, ordenesLab, pases, facturasVenta, citas])
  const cumpleaneros = useMemo(() => (listaCrm?.filas || []).flatMap((f) => { const m = f.motivos.find((x) => x.id === "cumpleanos"); return m ? [{ id: f.id, nombre: f.paciente.nombre, diasCumple: m.dias, esHoy: m.dias === 0 }] : [] }).sort((x, y) => x.diasCumple - y.diasCumple), [listaCrm])

  // Controles que el optómetra dejó "para agendar después" (o cuya cita se canceló) y siguen sin cita.
  const sinAgendar = useMemo(() => controlesSinAgendar(pacientes, consultas, citas), [pacientes, consultas, citas])
  // «Contactar al paciente»: las citas no efectuadas y las canceladas por el paciente que nadie retomó (30 días), menos las descartadas.
  const paraReagendar = useMemo(() => citasPorContactar(citas, descartes), [citas, descartes])
  const contactarDescartadas = useMemo(() => citasParaReagendar(citas).filter((c) => descartes.has(`${TIPO_AVISO_CONTACTAR}|${c.id}`)), [citas, descartes])

  // Pacientes con el control vencido por contactar hoy, el más atrasado primero.
  const inactivos = useMemo(() => (listaCrm?.filas || []).flatMap((f) => { const m = f.motivos.find((x) => x.id === "control_vencido"); return m ? [{ paciente: f.paciente, dias: m.dias }] : [] }).sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0)), [listaCrm])

  // Productos con stock bajo (por debajo de su mínimo), el más crítico primero. Se muestran una sola vez en
  // todo el Inicio, como una fila de "Requiere tu atención", con el reabastecimiento a un clic.
  // Solo los productos activos: los descontinuados no cuentan (el Inventario tampoco los cuenta ni los lista), así los números coinciden.
  const productosActivos = useMemo(() => inventario.filter((p) => p.activo !== false), [inventario])
  const productosBajoStock = useMemo(() => productosActivos.filter((p) => esStockBajo(p, umbralStock)).sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0)), [productosActivos, umbralStock])
  // Sobrestock: más unidades que su máximo (el general de Configuración → Inventario o el propio); el que más se pasa, primero. Solo avisa: el máximo no limita nada.
  const productosSobrestock = useMemo(() => productosActivos.filter((p) => esSobrestock(p, maximoStock, umbralStock)).sort((a, b) => ((Number(b.stock) || 0) - maximoDe(b, maximoStock)) - ((Number(a.stock) || 0) - maximoDe(a, maximoStock))), [productosActivos, maximoStock, umbralStock])

  // Para "Mi agenda" (vista del optómetra, D4): pacientes en atención ahora
  // mismo (no acotado a hoy, mismo criterio sin fecha que ya usa el badge de
  // Citas.jsx) y lo que todavía le falta atender de la agenda de hoy.
  const pacientesEnAtencion = useMemo(() => citas.filter((c) => c.estado === "En Atención" && diasAtencionAbierta(c) === null), [citas])
  // Atenciones que se abrieron un día anterior y nadie cerró.
  const atencionesAntiguas = useMemo(() => atencionesAbiertasAntiguas(citas), [citas])
  const [actividadAbierta, setActividadAbierta] = useState(false) // la ventana del Registro de actividad
  const [totalAbierto, setTotalAbierto] = useState(null) // id de la tarjeta de Totales cuya ventana está abierta
  const [dejarCita, setDejarCita] = useState(null)
  const [reasignarGrupo, setReasignarGrupo] = useState(null) // { fecha, personaId, personaNombre, citas } de una ausencia con citas por pasar
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
        {etiquetaEstadoCita(cita.estado)}
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
  const pacientesSinConsulta = useMemo(() => pacientesSinAtender(pacientes, consultas), [pacientes, consultas])
  const sinAtender = pacientesSinConsulta.length
  // Los saldos con el criterio de Ventas, para que el Inicio y esa pantalla cuenten lo mismo: { ventas, pacientes, total }.
  const saldos = useMemo(() => resumenSaldos(saldosPorPaciente({ pacientes, facturas: facturasVenta, abonos, ventas })), [pacientes, facturasVenta, abonos, ventas])
  const facturasConSaldo = useMemo(() => facturasVenta.map((f) => ({ f, saldo: saldoFactura(f, abonos) })).filter((x) => x.saldo > 0).sort((a, b) => (a.f.creadoEn < b.f.creadoEn ? -1 : 1)), [facturasVenta, abonos])
  const listos = useMemo(() => pasesListos(pases), [pases])
  // «Por vender» vive en «Para contactar» del CRM: quien no ve el CRM mira la lista sin poder abrirla.
  const irAPorVender = () => { if (veCrm) (onVerCrm ? onVerCrm({ filtro: "por_vender" }) : setVista?.("crm")) }
  const proformas = useMemo(() => proformasEnSeguimiento(pases), [pases])
  const atencionesVista = esVistaOptometra ? atencionesAntiguas.filter(({ cita }) => esCitaPropia(cita, usuario?.id)) : atencionesAntiguas
  // Las tarjetas solo llevan a su lista (un clic en cualquier parte). Las acciones de crear van aparte, como atajos, para
  // que una misma tarjeta no haga dos cosas distintas según dónde se toque.
  const atajosAdmin = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos">
      {puedeV("pacientes", "crear") && <button type="button" onClick={onCrearPacienteRapido} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><span aria-hidden="true">+</span> Registrar paciente</button>}
      {puedeV("citas", "crear") && <button type="button" onClick={onAgendarRapido} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><span aria-hidden="true">+</span> Agendar cita</button>}
      {puedeV("inventario", "crear") && <button type="button" onClick={onCrearProductoRapido} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"><span aria-hidden="true">+</span> Agregar producto</button>}
    </div>
  )
  // Cuánto se dio de alta este mes: cada total lo dice junto al número, con la misma lógica en las tres tarjetas.
  const citasVigentes = useMemo(() => citas.filter((c) => c.estado !== "Cancelada"), [citas])
  const citasEsteMes = useMemo(() => creadosEsteMes(citasVigentes, "creadoEn"), [citasVigentes])
  const productosEsteMes = useMemo(() => creadosEsteMes(productosActivos, "creadoEn"), [productosActivos])
  const ventasMes = useMemo(() => ventasDelMes(facturasVenta, undefined, abonos), [facturasVenta, abonos])
  // La ventana de cada total: todo lo registrado o lo nuevo de este mes. Cada opción abre el módulo con ese mismo número (regla 42).
  const nombreMes = nombreMesDe(ahoraEcuador().getMonth()).toLowerCase()
  const verTotal = (modulo, opcion) => () => (onVerTotal ? onVerTotal(modulo, opcion) : setVista?.(modulo))
  const totalesVentana = {
    pacientes: { id: "pacientes", titulo: "Pacientes", modulo: "Pacientes", icono: Users, opciones: [
      { id: "todos", etiqueta: "Todos los pacientes", detalle: "Todo lo registrado", valor: pacientes.length, onClick: verTotal("pacientes", "todos") },
      { id: "mes", etiqueta: "Nuevos este mes", detalle: `Registrados en ${nombreMes}`, valor: pacientesEsteMes, onClick: verTotal("pacientes", "mes") },
    ] },
    citas: { id: "citas", titulo: "Citas", modulo: "Citas", icono: Calendar, opciones: [
      { id: "todas", etiqueta: "Todas las citas", detalle: "Todas las fechas, sin las canceladas", valor: citasVigentes.length, onClick: verTotal("citas", "todas") },
      { id: "mes", etiqueta: "Agendadas este mes", detalle: `Agendadas en ${nombreMes}, sin las canceladas`, valor: citasEsteMes, onClick: verTotal("citas", "mes") },
    ] },
    ventas: { id: "ventas", titulo: "Ventas", modulo: "Ventas", icono: ShoppingBag, opciones: [
      { id: "todas", etiqueta: "Todas las ventas", detalle: `${dinero(ventasMes.totalVendido)} vendido · ${dinero(ventasMes.totalCobrado)} cobrado, sin las anuladas`, valor: ventasMes.cantidadTotal, onClick: verTotal("ventas", "todas") },
      { id: "mes", etiqueta: "Vendidas este mes", detalle: `${dinero(ventasMes.total)} vendido · ${dinero(ventasMes.cobrado)} cobrado en ${nombreMes}`, valor: ventasMes.cantidad, onClick: verTotal("ventas", "mes") },
    ] },
    productos: { id: "productos", titulo: "Productos", modulo: "Inventario", icono: Package, opciones: [
      { id: "todos", etiqueta: "Todos los productos", detalle: "Todo el inventario", valor: productosActivos.length, onClick: verTotal("inventario", "todos") },
      { id: "mes", etiqueta: "Nuevos este mes", detalle: `Dados de alta en ${nombreMes}`, valor: productosEsteMes, onClick: verTotal("inventario", "mes") },
    ] },
  }
  const filaTotales = (
    <FilaTarjetas
      titulo="Totales"
      descripcion="lo registrado y lo nuevo de este mes"
      acciones={atajosAdmin}
      variante="totales"
      compacta
      tarjetas={[
        { id: "pacientes", titulo: "Pacientes", valor: pacientes.length, desc: `+${pacientesEsteMes} este mes`, icono: Users, color: "azul", onClick: () => setTotalAbierto("pacientes") },
        { id: "citas", titulo: "Citas", valor: citasVigentes.length, desc: `+${citasEsteMes} este mes`, icono: Calendar, color: "violet", onClick: () => setTotalAbierto("citas") },
        veVentas && { id: "ventas", titulo: "Ventas", valor: dinero(ventasMes.totalVendido), desc: `+${dinero(ventasMes.total)} este mes`, icono: ShoppingBag, color: "green", onClick: () => setTotalAbierto("ventas") },
        { id: "productos", titulo: "Productos", valor: productosActivos.length, desc: `+${productosEsteMes} este mes`, icono: Package, color: "amber", onClick: () => setTotalAbierto("productos") },
      ].filter(Boolean)}
    />
  )

  // ─── Desenlace de las citas + lista: un solo control (el período y, si se quiere, la tarjeta) para las dos cosas ───
  const ETIQUETA_PERIODO = { hoy: "hoy", semana: "esta semana", mes: "este mes", siempre: "todas" }
  const NOMBRE_TARJETA = { atendida: "Atendidas", noAsistio: "No efectuadas", pendiente: "Pendientes", cancelada: "Canceladas" }
  const enAtencionN = desenlace.enAtencion
  const elegirTarjeta = (id) => setTarjeta((actual) => (actual === id ? null : id))
  // El administrador no ve el detalle de las citas aquí abajo (es lo mismo que el módulo Citas): sus cuatro tarjetas llevan a Citas con ese mismo estado y período (regla 42).
  const resumenSolo = plantilla === "administrador"
  const estadoEnCitas = { atendida: "atendida", noAsistio: "noAsistio", pendiente: "abiertas", cancelada: "cancelada" }
  const irACitas = (estado = "todas") => () => (onVerCitas ? onVerCitas(estado, periodo) : setVista?.("citas"))
  const botonIrACitas = (
    <button type="button" onClick={irACitas()} className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
      Ir a Citas <ArrowRight size={14} aria-hidden="true" />
    </button>
  )
  const selectorPeriodo = (
    <div role="group" aria-label="Período del desenlace" className="flex flex-wrap items-center gap-1">
      {PERIODOS_DESENLACE.map(([id, etiqueta]) => (
        <button key={id} type="button" aria-pressed={periodo === id} onClick={() => setPeriodo(id)} className={"rounded-full px-3.5 py-1 text-[13px] font-semibold transition-colors cursor-pointer " + (periodo === id ? "text-white" : "text-slate-600 hover:text-slate-900")} style={periodo === id ? { background: GRAD_MARCA } : undefined}>{etiqueta}</button>
      ))}
    </div>
  )
  // Igual que en el administrador: tocar una tarjeta lista debajo esas citas (las propias, en la vista de quien atiende).
  const tarjetaDe = (clave, extra) => (resumenSolo ? { ...extra, onClick: irACitas(estadoEnCitas[clave]) } : { ...extra, seleccionada: tarjeta === clave, onClick: () => elegirTarjeta(clave) })
  const filaDesenlace = (
    <FilaTarjetas
      titulo={`${esVistaOptometra ? "Desenlace de mis citas" : "Desenlace de las citas"} · ${ETIQUETA_PERIODO[periodo]}`}
      descripcion={tarjeta ? `${citasLista.length} ${citasLista.length === 1 ? "cita" : "citas"} · ${NOMBRE_TARJETA[tarjeta].toLowerCase()}` : undefined}
      acciones={<div className="flex flex-wrap items-center gap-3">{selectorPeriodo}{botonIrACitas}</div>}
      variante="desenlace"
      compacta
      tarjetas={[
        tarjetaDe("atendida", { id: "atendidas", titulo: "Atendidas", valor: desenlace.atendidas, desc: enAtencionN > 0 ? `${enAtencionN} en atención ahora` : undefined, icono: CheckCircle2, color: "green" }),
        tarjetaDe("noAsistio", { id: "noAsistieron", titulo: "No efectuadas", valor: desenlace.noAtendidas, icono: UserX, color: "red" }),
        tarjetaDe("pendiente", { id: "pendientes", titulo: "Pendientes", valor: desenlace.pendientes, icono: Clock, color: "amber" }),
        tarjetaDe("cancelada", { id: "canceladas", titulo: "Canceladas", valor: desenlace.canceladas, desc: desenlace.canceladas > 0 ? `${desenlace.canceladas} ${desenlace.canceladas === 1 ? "cancelada aparte" : "canceladas aparte"}` : "Aparte", icono: Ban, color: "slate" }),
      ]}
    />
  )
  const sinTerminar = useMemo(() => fichasSinTerminar(citas, usuario?.id), [citas, usuario?.id])

  // La lista de citas sigue el período y la tarjeta del desenlace: se ven las primeras y el resto está en Citas.
  const LIMITE_LISTA = 8
  const TITULO_LISTA = esVistaOptometra
    ? { hoy: "Mi agenda de hoy", semana: "Mis citas de la semana", mes: "Mis citas del mes", siempre: "Todas mis citas" }
    : { hoy: "Citas del día", semana: "Citas de la semana", mes: "Citas del mes", siempre: "Todas las citas" }
  // "Pendientes" agrupa tres estados que Citas no tiene juntos: ahí el enlace abre todas las del período y lo dice.
  const textoVerEnCitas = !tarjeta ? "Ver todas en Citas" : tarjeta === "pendiente" ? "Ver todas las del período en Citas" : `Ver ${NOMBRE_TARJETA[tarjeta].toLowerCase()} en Citas`
  const verTodasEnCitas = () => (onVerCitas ? onVerCitas(tarjeta && tarjeta !== "pendiente" ? tarjeta : "todas", periodo) : setVista?.("citas"))
  const accionFila = (cita) => {
    if (!esVistaOptometra || !puedeV("consultas", "crear") || !esHoy(cita.fecha)) return null
    if (cita.estado === "En Atención") return { etiqueta: "Seguir atendiendo", onClick: () => onAtenderCita?.(cita) }
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
          ? <button type="button" onClick={() => onAtenderCita?.(fichasAbiertas[0])} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Seguir atendiendo</button>
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
        {nAgenda > 0 && <button type="button" onClick={() => (onVerCitas ? (agendaOpt.modo === "hoy" ? onVerCitas("todas", "hoy") : onVerCitas("todas", "dia", agendaOpt.fecha)) : setVista?.("citas"))} className="ml-auto flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver en Citas · {agendaOpt.modo === "hoy" ? "hoy" : formatoFecha(agendaOpt.fecha, "corto")} <ArrowRight size={14} aria-hidden="true" /></button>}
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
        {citasLista.length > 0 && <button type="button" onClick={verTodasEnCitas} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{textoVerEnCitas} <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="divide-y divide-slate-100 px-5 py-4">
          {citasLista.length === 0 ? (
            <EstadoVacio compacto icon={Calendar} texto={tarjeta ? "Ninguna cita con ese resultado en el período." : periodo === "hoy" ? (esVistaOptometra ? "Hoy no tienes citas." : "Hoy no hay citas.") : "No hay citas en el período."} accion={!tarjeta && periodo === "hoy" && puedeV("citas", "crear") && onAgendarRapido ? { etiqueta: "Agendar cita", onClick: onAgendarRapido } : null} />
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
      descripcion="lo que espera a quien vende"
      acciones={atajosAdmin}
      variante="totales"
      tarjetas={[
        { id: "listos", titulo: "Listos para venta", valor: listos.length, desc: "Esperan que se les atienda", icono: ShoppingBag, color: "green", seleccionada: tarjetaVenta === "listos", onClick: () => setTarjetaVenta("listos") },
        { id: "proformas", titulo: "Proformas en seguimiento", valor: proformas.length, desc: "Lo pensarán", icono: FileText, color: "azul", seleccionada: tarjetaVenta === "proformas", onClick: () => setTarjetaVenta("proformas") },
        { id: "saldos", titulo: "Saldos por cobrar", valor: dinero(saldos.total), desc: saldos.ventas === 0 ? "Nada pendiente" : textoSaldos(saldos, { conTotal: false }), icono: Wallet, color: saldos.cantidad > 0 ? "amber" : "slate", seleccionada: tarjetaVenta === "saldos", onClick: () => setTarjetaVenta("saldos") },
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
            {esListaSaldos ? textoSaldos(saldos) : `${plural(nVender, "paciente espera", "pacientes esperan")}, el más antiguo primero`}
            {nVender > LIMITE_LISTA ? ` · primeras ${LIMITE_LISTA}` : ""}
          </p>
        )}
        {nVender > 0 && <button type="button" onClick={() => (esListaSaldos ? onVerSaldos?.() : irAPorVender())} className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{esListaSaldos ? "Ver saldos" : "Ver en el CRM"} <ArrowRight size={14} aria-hidden="true" /></button>}
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
                    <button type="button" onClick={() => irAPorVender()} className="group -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-800">{paciente?.nombre || "Paciente"}</span>
                        <span className="block truncate text-xs text-slate-500">{esDelPortal(pase) ? "Desde el portal · " + etiquetaInteres(pase.interes) : diagnostico || consulta?.motivo || "Consulta"}{pase.proformaEntregadaEn ? " · con proforma" : ""}</span>
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
    return soloAvisosDe ? null : <InicioSkeleton />
  }

  const hayInactivos = inactivos.length > 0

  // ─── Requiere tu atención: todo lo pendiente, en un solo bloque ───
  const incAtenciones = ["administrador", "optometra", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incOrdenes = ["administrador", "ventas"].includes(plantilla) || (plantilla === "general" && veVentas)
  const incControles = (["administrador", "optometra", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incControlesPorAgendar = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incCanceladas = ["administrador", "recepcion"].includes(plantilla) || (plantilla === "general" && veCitas)
  const incStock = veInventario && plantilla !== "optometra" // quien puede ver el inventario ve el aviso; "Reabastecer" solo con inventario: editar
  // Un paciente que pide eliminar su cuenta desde el portal es una decisión del administrador de la óptica: tiene que verla sin entrar al perfil.
  const incEliminacion = plantilla === "administrador" && puedeV("pacientes", "editar")
  const incCumple = (["administrador", "recepcion"].includes(plantilla) || plantilla === "general") && veCrm
  const incSaldos = veVentas && plantilla !== "optometra"
  const incSinConsulta = puedeV("pacientes", "ver") && plantilla !== "ventas" && plantilla !== "optometra"
  // Los avisos de "Requiere tu atención", cada uno con su área (citas, pacientes, ventas, inventario): UNA línea por tipo de aviso (regla 38) y,
  // detrás, la lista de sus casos con la acción de cada uno (ventana estándar, regla 43). El enlace "Abrir en …" lleva el número que se verá allí,
  // calculado con la definición del propio módulo (regla 42).
  const construirAvisos = () => {
    const filas = []
    const poner = (area, fila) => filas.push({ area, ...fila })
    const uno = (n, singular, varios) => (n === 1 ? singular : varios)
    const nombreDe = (id, respaldo = "Paciente") => pacientes.find((p) => p.id === id)?.nombre || respaldo
    const enCitas = (estado, periodo, fecha) => () => (onVerCitas ? onVerCitas(estado, periodo, fecha) : setVista?.("citas"))
    // Al CRM con el motivo: la lista de allá es la misma que cuenta este aviso, así que el número que se leyó es el que se ve.
    const abrirCrm = (params) => () => (onVerCrm ? onVerCrm(params) : setVista?.("crm"))
    const enPacientes = (filtro) => () => (onVerPacientes ? onVerPacientes(filtro) : setVista?.("pacientes"))
    const puedeAgendar = puedeV("citas", "crear")
    const puedeAtenderAqui = puedeV("consultas", "crear")
    // «Descartar» (decisión de la persona, con motivo): lo descartado sale de la tarjetita y queda abajo, en «Descartados», con «Volver a mostrar».
    // La tarjetita cuenta lo que se ve; el enlace «Abrir en …» dice el número TOTAL del módulo (con lo descartado), que es el que se verá allí (regla 42).
    const descarteDe = (tipo, lista, claveDe, nombreDeItem) => {
      const { visibles, descartados } = particionarDescartados(lista, tipo, claveDe, descartes)
      const extra = !onDescartar ? {} : {
        descartable: {
          motivos: TIPOS_DESCARTABLES[tipo].motivos,
          onDescartar: async (caso, motivo, detalle) => {
            const r = await onDescartar(tipo, caso.id, motivo, detalle)
            if (!r?.error) onAviso?.({ texto: `Aviso de ${caso.nombre} descartado.`, accion: { etiqueta: "Deshacer", onClick: () => onRestaurar?.(tipo, caso.id) } })
            return r
          },
        },
        descartados: descartados.map(({ item, descarte }) => ({
          id: claveDe(item), nombre: nombreDeItem(item), motivo: descarte.motivo, por: descarte.por,
          onRestaurar: async () => { const r = await onRestaurar?.(tipo, claveDe(item)); if (!r?.error) onAviso?.(`El aviso de ${nombreDeItem(item)} vuelve a mostrarse.`) },
        })),
      }
      return { visibles, total: lista.length, hay: visibles.length > 0 || (descartados.length > 0 && !!onDescartar), extra }
    }
    if (incAtenciones && atencionesVista.length > 0) {
      const n = atencionesVista.length
      const abiertasEnCitas = citasVista.filter((c) => c.estado === "En Atención").length
      poner("citas", {
        id: "atenciones", cantidad: n, tono: "urgente", corto: uno(n, "atención abierta", "atenciones abiertas"),
        texto: uno(n, "atención abierta de un día anterior", "atenciones abiertas de días anteriores"),
        nombres: nombresResumidos(atencionesVista.map(({ cita }) => cita.paciente)),
        enlace: { texto: `Abrir en Citas · En atención (${abiertasEnCitas})`, onClick: enCitas("enAtencion", "siempre") },
        casos: atencionesVista.map(({ cita, dias }) => ({
          id: cita.id, nombre: cita.paciente,
          insignia: { texto: textoAtencionAbierta(dias), tono: "urgente" },
          detalle: `${fechaLegible(cita.fecha)}, ${cita.hora} · ${cita.motivo || "Consulta general"}`,
          accion: puedeAtenderAqui ? { etiqueta: "Seguir atendiendo", navega: true, onClick: () => onAtenderCita?.(cita) } : null,
        })),
      })
    }
    const dControl = incControlesPorAgendar ? descarteDe("citas:control_sin_agendar", sinAgendar, (x) => x.paciente.id, (x) => x.paciente.nombre) : null
    if (dControl?.hay) {
      const n = dControl.visibles.length
      poner("citas", {
        id: "controles-sin-agendar", cantidad: n, corto: uno(n, "control sin agendar", "controles sin agendar"),
        texto: uno(n, "control sin agendar", "controles sin agendar"),
        enlace: { texto: `Abrir en Pacientes · Control sin agendar (${dControl.total})`, onClick: enPacientes({ rapido: "ControlSinAgendar" }) },
        casos: dControl.visibles.map(({ paciente, fechaControl, consulta }) => ({
          id: paciente.id, nombre: paciente.nombre,
          detalle: `Control recomendado para el ${fechaLegible(fechaAISO(fechaControl))} · consulta del ${fechaLegible(consulta.fecha)}`,
          accion: puedeAgendar ? { etiqueta: "Agendar", onClick: () => onAgendarControl?.(paciente, fechaAISO(fechaControl), asignadoDelControl(consulta, equipo)) } : { etiqueta: "Ver paciente", navega: true, onClick: () => onVerPerfilPaciente?.(paciente.id) },
        })),
        ...dControl.extra,
      })
    }
    // Ausencias registradas en "Mi horario" con citas abiertas de esa persona: solo para quien puede reasignar (permiso, no rol).
    if (puedeReasignarCitas) {
      const grupos = citasPorReasignar(citas, disponibilidad, hoyISO())
      const n = grupos.reduce((suma, g) => suma + g.citas.length, 0)
      if (n > 0) poner("citas", {
        id: "ausencias", cantidad: n, corto: uno(n, "cita por reasignar", "citas por reasignar"),
        texto: uno(n, "cita por reasignar por una ausencia", "citas por reasignar por ausencias"),
        nombres: nombresResumidos(grupos.map((g) => `${g.personaNombre || etiquetaMiembro(equipo, g.personaId)} el ${formatoFecha(g.fecha, "medioSinAnio")}`)),
        casos: grupos.flatMap((g) => g.citas.map((c) => ({
          id: c.id, nombre: c.paciente,
          detalle: `${fechaLegible(c.fecha)}, ${c.hora} · ausencia de ${g.personaNombre || etiquetaMiembro(equipo, g.personaId)}`,
          accion: { etiqueta: "Reasignar", onClick: () => setReasignarGrupo(g) },
        }))),
      })
    }
    const hayContactar = paraReagendar.length > 0 || (contactarDescartadas.length > 0 && !!onDescartar)
    if (incCanceladas && hayContactar) {
      const n = paraReagendar.length
      const puedeEscribir = puedeV("citas", "ver") && !!onContactarPaciente
      poner("citas", {
        id: "contactar", cantidad: n, corto: "por contactar",
        texto: uno(n, "paciente por contactar", "pacientes por contactar"),
        // «Contactar al paciente» reemplaza a «Citas por reagendar»: la lista de Citas con esa tarea tiene exactamente estos mismos pacientes.
        enlace: { texto: `Abrir en Citas · Contactar al paciente (${n})`, onClick: enCitas("todas", "reagendar") },
        casos: paraReagendar.map((c) => {
          const seg = seguimientoContacto.get(c.id)
          const motivo = motivoDeLaCita(c, seguimientoContacto)
          const acciones = []
          // Una cita sin paciente registrado no se puede reagendar desde aquí: se abre en su día.
          acciones.push(c.pacienteId && puedeAgendar ? { etiqueta: "Reagendar", onClick: () => onReagendarCancelada?.(c) } : { etiqueta: "Ver cita", navega: true, onClick: enCitas("todas", "dia", c.fecha) })
          if (puedeEscribir && c.telefono) acciones.push({ etiqueta: "Escribir por WhatsApp", onClick: () => onContactarPaciente(c) })
          return {
            id: c.id, nombre: c.paciente,
            insignia: c.estado === "No Asistió" ? { texto: "No efectuada", tono: "urgente" } : { texto: "Canceló el paciente", tono: "neutro" },
            detalle: `${fechaLegible(c.fecha)}, ${c.hora} · ${motivo}${seg?.contactadaEn ? ` · Contactado el ${fechaLegible(String(seg.contactadaEn).slice(0, 10))}` : ""}`,
            acciones,
          }
        }),
        ...(onDescartar ? {
          descartable: {
            motivos: TIPOS_DESCARTABLES[TIPO_AVISO_CONTACTAR].motivos,
            onDescartar: async (caso, motivoDescarte, detalle) => {
              const r = await onDescartar(TIPO_AVISO_CONTACTAR, caso.id, motivoDescarte, detalle)
              if (!r?.error) onAviso?.({ texto: `Aviso de ${caso.nombre} descartado.`, accion: { etiqueta: "Deshacer", onClick: () => onRestaurar?.(TIPO_AVISO_CONTACTAR, caso.id) } })
              return r
            },
          },
          descartados: contactarDescartadas.map((c) => {
            const d = descartes.get(`${TIPO_AVISO_CONTACTAR}|${c.id}`)
            return { id: c.id, nombre: c.paciente, motivo: d.motivo, por: d.por, onRestaurar: async () => { const r = await onRestaurar?.(TIPO_AVISO_CONTACTAR, c.id); if (!r?.error) onAviso?.(`El aviso de ${c.paciente} vuelve a mostrarse.`) } }
          }),
        } : {}),
      })
    }
    if (incEliminacion && solicitudesEliminacion.length > 0) {
      const n = solicitudesEliminacion.length
      const nombreDe2 = (id) => pacientes.find((p) => p.id === id)?.nombre || "Paciente"
      poner("pacientes", {
        id: "eliminacion", tono: "urgente", cantidad: n, corto: uno(n, "pide eliminar su cuenta", "piden eliminar su cuenta"),
        texto: uno(n, "paciente pidió eliminar su cuenta", "pacientes pidieron eliminar su cuenta"),
        nombres: nombresResumidos(solicitudesEliminacion.map((x) => nombreDe2(x.pacienteId))),
        casos: solicitudesEliminacion.map((x) => ({
          id: x.id, nombre: nombreDe2(x.pacienteId),
          insignia: { texto: "Pidió eliminar su cuenta", tono: "urgente" },
          detalle: `Lo pidió el ${fechaLegible(String(x.creadoEn || "").slice(0, 10)) || "—"}${x.motivo ? ` · Motivo: ${x.motivo}` : ""}`,
          accion: { etiqueta: "Ver paciente", navega: true, onClick: () => onVerPerfilPaciente?.(x.pacienteId) },
        })),
      })
    }
    const dVencido = incControles && hayInactivos ? descarteDe("pacientes:control_vencido", inactivos, ({ paciente }) => paciente.id, ({ paciente }) => paciente.nombre) : null
    if (dVencido?.hay) {
      const n = dVencido.visibles.length
      poner("pacientes", {
        id: "controles", cantidad: n, corto: "control vencido",
        texto: esVistaOptometra ? "de tus pacientes con el control vencido" : uno(n, "paciente con el control vencido", "pacientes con el control vencido"),
        // «Ver todo» lleva a Pacientes con el filtro «Control vencido» (resolver el aviso es agendar el control, no mirar el CRM).
        enlace: puedeV("pacientes", "ver") ? { texto: `Abrir en Pacientes · Control vencido (${pacientes.filter((p) => esInactivo(p, consultas)).length})`, onClick: enPacientes({ rapido: "ControlVencido" }) } : undefined,
        casos: dVencido.visibles.map(({ paciente, dias }) => ({
          id: paciente.id, nombre: paciente.nombre,
          detalle: `Control vencido hace ${dias} ${dias === 1 ? "día" : "días"}`,
          acciones: [
            puedeAgendar ? { etiqueta: "Agendar control", onClick: () => onAgendarControl?.(paciente, hoyISO(), undefined) } : { etiqueta: "Ver paciente", navega: true, onClick: () => onVerPerfilPaciente?.(paciente.id) },
            ...(puedeV("pacientes", "ver") && paciente.telefono && puedeContactarPor(paciente, "control_vencido") ? [{ etiqueta: "WhatsApp", onClick: () => escribirPorWhatsApp({ paciente, motivo: "control_vencido" }) }] : []),
          ],
        })),
        ...dVencido.extra,
      })
    }
    // Un paciente cambió su teléfono o su correo desde su portal: «Marta Zambrano actualizó su teléfono». Se queda hasta que se marca como visto.
    if (puedeV("pacientes", "ver") && avisosContacto.length > 0) poner("pacientes", {
      id: "contacto-actualizado", tono: "info", cantidad: avisosContacto.length, corto: uno(avisosContacto.length, "cambió su contacto", "cambiaron su contacto"),
      texto: uno(avisosContacto.length, "paciente actualizó su contacto desde su portal", "pacientes actualizaron su contacto desde su portal"),
      nombres: nombresResumidos(avisosContacto.map((a) => nombreDe(a.pacienteId))),
      casos: avisosContacto.map((a) => ({ id: a.id, nombre: nombreDe(a.pacienteId), detalle: textoAvisoContacto(nombreDe(a.pacienteId), a.campos).replace(/^.*? actualizó /, "Actualizó "), accion: { etiqueta: "Visto", onClick: () => onAtenderAvisoContacto?.(a.id) } })),
    })
    // Un paciente pidió sus medidas (distancia pupilar y montaje) desde su portal: el aviso se quita al marcarla atendida en su perfil.
    const pidenMedidas = pacientes.filter((p) => p.medidasSolicitadasEn)
    if (puedeV("pacientes", "ver") && pidenMedidas.length > 0) poner("pacientes", {
      id: "medidas-solicitadas", tono: "info", cantidad: pidenMedidas.length, corto: uno(pidenMedidas.length, "pide sus medidas", "piden sus medidas"),
      texto: uno(pidenMedidas.length, "paciente pidió sus medidas de montaje desde su portal", "pacientes pidieron sus medidas de montaje desde su portal"),
      nombres: nombresResumidos(pidenMedidas.map((p) => p.nombre)),
      casos: pidenMedidas.map((p) => ({ id: p.id, nombre: p.nombre, detalle: "Pidió su distancia pupilar y medidas de montaje", accion: { etiqueta: "Responder", navega: true, onClick: () => onVerPerfilPaciente?.(p.id, "graduacion") } })),
    })
    const dSinConsulta = incSinConsulta && sinAtender > 0 ? descarteDe("pacientes:sin_consulta", pacientesSinConsulta, (p) => p.id, (p) => p.nombre) : null
    if (dSinConsulta?.hay) {
      const n = dSinConsulta.visibles.length
      poner("pacientes", {
        id: "sin-consulta", tono: "info", cantidad: n, corto: "sin consulta",
        texto: uno(n, "paciente registrado sin ninguna consulta", "pacientes registrados sin ninguna consulta"),
        enlace: { texto: `Abrir en Pacientes · Sin consulta (${dSinConsulta.total})`, onClick: enPacientes({ rapido: "SinConsulta" }) },
        casos: dSinConsulta.visibles.map((p) => ({
          id: p.id, nombre: p.nombre,
          detalle: `Registrado el ${fechaLegible(p.fechaRegistro) || "—"}`,
          accion: { etiqueta: "Ver paciente", navega: true, onClick: () => onVerPerfilPaciente?.(p.id) },
        })),
        ...dSinConsulta.extra,
      })
    }
    if (incCumple && cumpleaneros.length > 0) {
      const hoyN = cumpleaneros.filter((c) => c.esHoy).length
      poner("pacientes", {
        id: "cumple", tono: "info", cantidad: cumpleaneros.length, corto: uno(cumpleaneros.length, "cumpleaños cercano", "cumpleaños cercanos"),
        texto: hoyN === 0 ? uno(cumpleaneros.length, "cumpleaños cercano", "cumpleaños cercanos") : hoyN === cumpleaneros.length ? "cumpleaños hoy" : `cumpleaños (${hoyN} hoy)`,
        nombres: nombresResumidos(cumpleaneros.map((c) => c.nombre)),
        casos: cumpleaneros.map((c) => ({
          id: c.id, nombre: c.nombre,
          detalle: c.esHoy ? "Cumple años hoy" : c.diasCumple > 0 ? `Cumple años en ${c.diasCumple} ${c.diasCumple === 1 ? "día" : "días"}` : `Cumplió años hace ${-c.diasCumple} ${c.diasCumple === -1 ? "día" : "días"}`,
          accion: puedeV("crm", "crear") ? { etiqueta: "Saludar", navega: true, onClick: abrirCrm({ filtro: "cumpleanos" }) } : null,
        })),
      })
    }
    // Pagos por transferencia que los pacientes reportan desde su portal: esperan que Ventas revise el comprobante (el mismo número que en Ventas · Cobros y saldos).
    if (incSaldos && pagosPorVerificar.length > 0) poner("ventas", {
      id: "pagos-por-verificar", cantidad: pagosPorVerificar.length, corto: uno(pagosPorVerificar.length, "pago por verificar", "pagos por verificar"),
      texto: uno(pagosPorVerificar.length, "pago por transferencia por verificar", "pagos por transferencia por verificar"),
      nombres: nombresResumidos(pagosPorVerificar.map((p) => p.pacienteNombre || nombreDe(p.pacienteId))),
      enlace: { texto: `Abrir en Ventas · Pagos por verificar (${pagosPorVerificar.length})`, onClick: () => onVerSaldos?.() },
      casos: pagosPorVerificar.map((p) => ({ id: p.id, nombre: p.pacienteNombre || nombreDe(p.pacienteId), detalle: `${dinero(p.monto)} · compra ${numeroComprobante(p.facturaNumero)}`, accion: { etiqueta: "Revisar", navega: true, onClick: () => onVerSaldos?.() } })),
    })
    // Pacientes que recibieron su diagnóstico (o pidieron lentes desde su portal) y no han comprado: salen de Ventas y viven en «Para contactar» del CRM. El aviso cuenta
    // EXACTAMENTE esa lista (sin quien ya se contactó y descansa), así que el número que se lee es el que se ve allá; la acción es la misma ventana de Contactar de todo el sistema.
    const porVender = incSaldos ? (listaCrm?.filas || []).flatMap((f) => { const m = f.motivos.find((x) => x.id === "por_vender"); return m ? [{ paciente: f.paciente, dias: m.dias, detalle: m.detalle, pase: m.pase }] : [] }).sort((x, y) => (y.dias ?? 0) - (x.dias ?? 0)) : []
    const dPorVender = porVender.length > 0 ? descarteDe("ventas:por_vender", porVender, ({ pase }) => pase.id, ({ paciente }) => paciente.nombre) : null
    if (dPorVender?.hay) {
      const n = dPorVender.visibles.length
      poner("ventas", {
        id: "por-vender", cantidad: n, corto: uno(n, "por vender", "por vender"),
        texto: uno(n, "paciente recibió su diagnóstico y no ha comprado", "pacientes recibieron su diagnóstico y no han comprado"),
        nombres: nombresResumidos(dPorVender.visibles.map(({ paciente }) => paciente.nombre)),
        enlace: veCrm ? { texto: `Abrir en CRM · Por vender (${dPorVender.total})`, onClick: abrirCrm({ filtro: "por_vender" }) } : undefined,
        casos: dPorVender.visibles.map(({ paciente, detalle, pase }) => ({
          id: pase.id, nombre: paciente.nombre, detalle,
          accion: paciente.telefono && puedeContactarPor(paciente, "por_vender") ? { etiqueta: "Contactar", onClick: () => escribirPorWhatsApp({ paciente, motivo: "por_vender" }) } : { etiqueta: "Ver paciente", navega: true, onClick: () => onVerPerfilPaciente?.(paciente.id) },
        })),
        ...dPorVender.extra,
      })
    }
    if (incOrdenes && listasSinAvisar.length > 0) {
      poner("ventas", {
        id: "ordenes-listas", cantidad: listasSinAvisar.length, corto: uno(listasSinAvisar.length, "pedido sin avisar", "pedidos sin avisar"),
        texto: uno(listasSinAvisar.length, "pedido listo sin avisar al paciente", "pedidos listos sin avisar a los pacientes"),
        nombres: nombresResumidos(listasSinAvisar.map((o) => nombreDe(o.pacienteId))),
        enlace: { texto: `Abrir en Ventas · Listos sin avisar (${listasSinAvisar.length})`, onClick: () => onVerOrdenes?.("sinavisar") },
        casos: listasSinAvisar.map((o) => ({
          id: o.id, nombre: nombreDe(o.pacienteId),
          detalle: `${numeroOrden(o.numero)} · ${etiquetaEntrega(o)} · listo para entregar`,
          accion: { etiqueta: puedeV("ventas", "editar") ? "Contactar" : "Ver", navega: true, onClick: () => onVerOrdenes?.("sinavisar") },
        })),
      })
    }
    if (incOrdenes && atrasadas.length > 0) poner("ventas", {
      id: "ordenes-atrasadas", cantidad: atrasadas.length, tono: "urgente", corto: uno(atrasadas.length, "pedido atrasado", "pedidos atrasados"),
      texto: uno(atrasadas.length, "pedido atrasado", "pedidos atrasados"),
      nombres: nombresResumidos([...new Set(atrasadas.map((o) => nombreDe(o.pacienteId)))]),
      enlace: { texto: `Abrir en Ventas · Pedidos atrasados (${atrasadas.length})`, onClick: () => onVerOrdenes?.("atrasadas") },
      casos: atrasadas.map((o) => ({
        id: o.id, nombre: nombreDe(o.pacienteId),
        insignia: { texto: "Atrasado", tono: "urgente" },
        detalle: `${numeroOrden(o.numero)} · ${etiquetaEntrega(o)} · listo hacia el ${fechaLegible(o.fechaPrometida) || "—"}`,
        accion: { etiqueta: "Ver", navega: true, onClick: () => onVerOrdenes?.("atrasadas") },
      })),
    })
    if (incSaldos && saldos.ventas > 0) {
      poner("ventas", {
        id: "saldos", cantidad: saldos.ventas, corto: uno(saldos.ventas, "venta con saldo", "ventas con saldo"),
        texto: textoSaldosSinNumero(saldos),
        enlace: { texto: `Abrir en Ventas · Saldos por cobrar (${saldos.pacientes} ${saldos.pacientes === 1 ? "paciente" : "pacientes"})`, onClick: () => onVerSaldos?.() },
        casos: facturasConSaldo.map(({ f, saldo }) => ({
          id: f.id, nombre: nombreDe(f.pacienteId),
          detalle: `Venta del ${fechaLegible(String(f.creadoEn).slice(0, 10))} · total ${dinero(f.montoTotal)} · saldo ${dinero(saldo)}`,
          accion: { etiqueta: "Ver saldos", navega: true, onClick: () => onVerSaldos?.() },
        })),
      })
    }
    const dStock = incStock && productosBajoStock.length > 0 ? descarteDe("inventario:stock_bajo", productosBajoStock, (p) => p.id, (p) => p.nombre) : null
    if (dStock?.hay) {
      const n = dStock.visibles.length
      poner("inventario", {
        id: "stock", cantidad: n, corto: "con stock bajo",
        texto: uno(n, "producto con stock bajo", "productos con stock bajo"),
        enlace: { texto: `Abrir en Inventario · Stock bajo (${dStock.total})`, onClick: () => (onVerStockBajo ? onVerStockBajo() : setVista?.("inventario")) },
        casos: dStock.visibles.map((p) => ({
          id: p.id, nombre: p.nombre,
          detalle: `Quedan ${p.stock} ${Number(p.stock) === 1 ? "unidad" : "unidades"}`,
          accion: puedeV("inventario", "editar") ? { etiqueta: "Reabastecer", navega: true, onClick: () => (onReabastecerProducto ? onReabastecerProducto(p.id) : setVista?.("inventario")) } : null,
        })),
        ...dStock.extra,
      })
    }
    // Sobrestock: «tienes bastante de esto». Sin acción de reabastecer (sobra): abre la lista de Inventario con el filtro «Sobrestock».
    const dSobre = incStock && productosSobrestock.length > 0 ? descarteDe("inventario:sobrestock", productosSobrestock, (p) => p.id, (p) => p.nombre) : null
    if (dSobre?.hay) {
      const n = dSobre.visibles.length
      poner("inventario", {
        id: "sobrestock", cantidad: n, corto: "con sobrestock",
        texto: uno(n, "producto con sobrestock", "productos con sobrestock"),
        enlace: { texto: `Abrir en Inventario · Sobrestock (${dSobre.total})`, onClick: () => (onVerSobrestock ? onVerSobrestock() : setVista?.("inventario")) },
        casos: dSobre.visibles.map((p) => ({
          id: p.id, nombre: p.nombre,
          detalle: `Tiene ${p.stock} ${Number(p.stock) === 1 ? "unidad" : "unidades"} (su máximo es ${maximoDe(p, maximoStock)})`,
          accion: { etiqueta: "Ver", navega: true, onClick: () => (onVerSobrestock ? onVerSobrestock() : setVista?.("inventario")) },
        })),
        ...dSobre.extra,
      })
    }
    return filas
  }
  // Inicio del administrador y del optómetra: un bloque por área, solo los que le corresponden por sus permisos.
  const avisosPorArea = construirAvisos()
  const filasDe = (area) => avisosPorArea.filter((f) => f.area === area)
  // Un bloque solo existe si el rol tiene avisos de esa área; el que existe y está vacío dice "todo en orden".
  const aplicaCitas = incAtenciones || incControlesPorAgendar || incCanceladas || puedeReasignarCitas
  const aplicaPacientes = incEliminacion || incControles || incSinConsulta || incCumple
  const aplicaVentas = incOrdenes || incSaldos
  const bloquesAtencion = [
    veCitas && aplicaCitas && { id: "citas", titulo: "Citas", modulo: "Citas", icono: Calendar, filas: filasDe("citas"), onVerTodo: () => setVista?.("citas") },
    puedeV("pacientes", "ver") && aplicaPacientes && { id: "pacientes", titulo: "Pacientes", modulo: "Pacientes", icono: Users, filas: filasDe("pacientes"), onVerTodo: () => (onVerPacientes ? onVerPacientes({}) : setVista?.("pacientes")) },
    veVentas && aplicaVentas && { id: "ventas", titulo: "Ventas", modulo: "Ventas", icono: ShoppingBag, filas: filasDe("ventas"), onVerTodo: () => setVista?.("ventas") },
    veInventario && plantilla !== "optometra" && { id: "inventario", titulo: "Inventario", modulo: "Inventario", icono: Package, filas: filasDe("inventario"), onVerTodo: () => setVista?.("inventario") },
  ].filter(Boolean)
  const bRequiereAreas = <RequiereAtencionPorArea bloques={bloquesAtencion} />
  // Lo que el administrador publica para su personal (el administrador no es destinatario de los suyos: a él no se le dibuja nada).
  const bAvisos = usuario?.id && !esAdmin ? <AvisosInicio usuario={usuario} /> : null
  // Óptica recién creada: el administrador ve por dónde empezar en vez de cuatro "Todo en orden" (R17).
  const opticaSinDatos = !cargaInicial && pacientes.length === 0 && citas.length === 0 && inventario.length === 0
  const bParaEmpezar = <ParaEmpezar pasos={[
    { id: "horario", titulo: "Revisa tu horario", texto: "Los pacientes solo reservan en los espacios que abras.", icono: Clock, onClick: () => setVista?.("horario") },
    { id: "equipo", titulo: "Suma a tu equipo", texto: "Crea los usuarios y asígnales su rol.", icono: Users, onClick: () => setVista?.("usuarios") },
    { id: "paciente", titulo: "Registra al primer paciente", texto: "Con su cédula y teléfono basta.", icono: UserPlus, onClick: () => setVista?.("pacientes") },
    { id: "productos", titulo: "Agrega tus productos", texto: "Monturas y accesorios, con su existencia y precio.", icono: Package, onClick: () => setVista?.("inventario") },
  ]} />

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

  // ─── 6. Registro de actividad, compacto: las últimas 5 acciones (solo el administrador) ───
  const bActividad = actividadReciente.length > 0 && (
    <section aria-label="Registro de actividad" className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Registro de actividad</h2>
        <button type="button" onClick={() => setActividadAbierta(true)} aria-label="Abrir el registro de actividad" className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todo <ArrowRight size={14} aria-hidden="true" /></button>
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

  // En un módulo: solo el botón con los avisos de esa área (los mismos números y acciones de aquí) y las ventanas que esas acciones abren.
  if (soloAvisosDe) {
    const bloque = bloquesAtencion.find((b) => b.id === soloAvisosDe)
    return (
      <>
        {bloque && <BotonRequierenAtencion bloque={bloque} />}
        {bDejarCita}
        {bReasignar}
      </>
    )
  }

  return (
    <div className="w-full space-y-4 text-left">
      <style>{`
        @keyframes inRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .in-rise { animation: inRise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .in-rise { animation: none !important; } }
      `}</style>

      {bSuspendida}
      {bDejarCita}
      {bReasignar}
      {actividadAbierta && <VentanaActividad opticaId={usuario?.opticaId} onCerrar={() => setActividadAbierta(false)} />}
      {totalAbierto && totalesVentana[totalAbierto] && <VentanaTotal total={totalesVentana[totalAbierto]} onCerrar={() => setTotalAbierto(null)} />}

      {plantilla === "administrador" && (
        <>
          {filaTotales}
          {opticaSinDatos && bParaEmpezar}
          {bRequiereAreas}
          {filaDesenlace}
          {bActividad}
        </>
      )}

      {plantilla === "optometra" && (
        <>
          <div className="flex justify-end">{atajosAdmin}</div>
          <div className="space-y-3">
            {filaDesenlace}
            {/* Hoy sin tarjeta elegida la lista sería su agenda de abajo repetida: solo aparece al elegir tarjeta o un período mayor */}
            {(tarjeta || periodo !== "hoy") && bCitasPeriodo}
          </div>
          {bDiaOptometra}
          {bAgendaOptometra}
          {bRequiereAreas}
          {bAvisos}
        </>
      )}

      {plantilla === "recepcion" && (
        <>
          <div className="flex justify-end">{atajosAdmin}</div>
          {bRequiereAreas}
          {bAvisos}
          {filaDesenlace}
          {bCitasPeriodo}
        </>
      )}

      {plantilla === "ventas" && (
        <>
          {filaVender}
          {bRequiereAreas}
          {bAvisos}
          {bListaVender}
        </>
      )}

      {plantilla === "general" && (
        <>
          {veVentas ? filaVender : <div className="flex justify-end">{atajosAdmin}</div>}
          {bRequiereAreas}
          {bAvisos}
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

function EstadoVacio({ icon: Icon, texto, compacto = false, accion = null }) {
  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-4 text-sm font-medium text-slate-500">
        <Icon size={16} className="shrink-0 text-slate-400" aria-hidden="true" /> <span>{texto}</span>
        {accion && <button type="button" onClick={accion.onClick} className="ml-auto rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">{accion.etiqueta}</button>}
      </div>
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
