"use client"

import { useEffect, useMemo, useState } from "react"
import { useParamUrl } from "../utilidades/urlEstado"
import { FlaskConical, Receipt, ShoppingBag, ShoppingCart, Wallet } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import ModalesVentas from "../componentes/ModalesVentas"
import OrdenesLaboratorio from "../componentes/OrdenesLaboratorio"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaPorVender from "../componentes/ventas/PestanaPorVender"
import PestanaComprobantes from "../componentes/ventas/PestanaComprobantes"
import PestanaCobros from "../componentes/ventas/PestanaCobros"
import DetalleComprobante from "../componentes/ventas/DetalleComprobante"
import { useOrdenesLab } from "../componentes/ventas/useOrdenesLab"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { useVentas } from "../utilidades/useVentas"
import { puede } from "../utilidades/permisosUi"
import { ordenesAbiertas } from "../utilidades/ordenesLaboratorio"
import { saldosPorPaciente } from "../utilidades/saldosVentas"
import { formatoFecha, fechaLegible } from "../utilidades/formatoFecha"
import { numeroComprobante } from "../utilidades/comprobantes"
import { periodoDeDestino } from "../utilidades/periodoLista"
import { filtroDeOrdenesValido } from "../utilidades/ventasModulo"

const TABS = ["porvender", "comprobantes", "ordenes", "cobros"]
// Los nombres de antes (los usan los enlaces del Inicio, de Reportes y las direcciones guardadas).
const TAB_ANTIGUO = { cola: "porvender", ventas: "comprobantes", saldos: "cobros" }

// Módulo de Ventas: lo operativo de la venta, en el orden en que pasa. Por vender (pacientes con receta que esperan su venta), Comprobantes (las ventas
// registradas), Órdenes de laboratorio y Cobros y saldos (lo cobrado en el día y lo que se debe). El análisis va en Reportes.
// Los datos siguen viniendo de Dashboard; esta página solo los muestra y abre las mismas ventanas que usa el perfil del paciente.
export default function Ventas({
  usuario, cargaInicial = false, parametrizacion, pacientes = [], consultas = [], inventario = [], setInventario,
  categoriasInventario = [], setCategoriasInventario, ventas = [], facturasVenta = [], setFacturasVenta,
  pases = [], setPases, ordenesLab = [], setOrdenesLab, abonos = [], abonosAnulados = [], equipo = [],
  accionInicial, onAccionInicialConsumida, onVerPaciente, onAviso, avisosDelModulo = null,
}) {
  const puedeVender = puede(usuario, "ventas", "crear")
  const puedeEditar = puede(usuario, "ventas", "editar")
  const puedeAnular = puede(usuario, "ventas", "eliminar")

  const [tabUrl, setTab] = useParamUrl("tab", "porvender", [...TABS, ...Object.keys(TAB_ANTIGUO)])
  const tab = TAB_ANTIGUO[tabUrl] || tabUrl
  const [destino, setDestino] = useState({ n: 0 }) // lo que pidió otro módulo: se reinicia la pestaña con esos filtros
  const [nuevaVenta, setNuevaVenta] = useState(false)
  const [detalleId, setDetalleId] = useState(null)

  const notificar = (msg, tipo) => onAviso?.(msg, tipo)
  const v = useVentas({ usuario, parametrizacion, pacientes, consultas, pases, setPases, setOrdenesLab, facturasVenta, setFacturasVenta, abonos, ventas, setInventario, notificar, avisarError: (msg) => notificar(msg, "error") })
  const abonar = (factura, paciente) => v.setAbonoPara({ factura, paciente })
  const ordenesApi = useOrdenesLab({
    ordenes: ordenesLab, setOrdenes: setOrdenesLab, pacientes, equipo, usuario, facturas: facturasVenta, abonos,
    onAbonar: abonar, onAviso: notificar, onVerComprobante: (f) => setDetalleId(f.id),
  })

  // Destino pedido desde el Inicio, Reportes o el menú: { tab, filtro, estado, desde, hasta, periodo, sinFE, texto }
  useEffect(() => {
    if (!accionInicial) return
    const pedida = TAB_ANTIGUO[accionInicial.tab] || accionInicial.tab
    if (pedida) setTab(pedida)
    setDestino((d) => ({
      n: d.n + 1,
      filtroOrdenes: filtroDeOrdenesValido(accionInicial.filtro),
      filtroCola: accionInicial.filtroCola || "todos",
      comprobantes: {
        periodo: periodoDeDestino(accionInicial),
        estado: !accionInicial.estado || accionInicial.estado === "vigentes" || accionInicial.estado === "todas" ? "todos" : accionInicial.estado,
        sinFE: !!accionInicial.sinFE,
        texto: accionInicial.texto || "",
      },
    }))
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial])

  const saldos = useMemo(() => saldosPorPaciente({ pacientes, facturas: facturasVenta, abonos, ventas }), [pacientes, facturasVenta, abonos, ventas])
  const pacienteDe = (id) => pacientes.find((p) => p.id === id) || null
  const verPaciente = (p) => p && onVerPaciente?.(p.id)
  const detalle = detalleId ? facturasVenta.find((f) => f.id === detalleId) || null : null

  const pestanas = [
    { id: "porvender", etiqueta: "Por vender", cuenta: v.colaListos.length, Icono: ShoppingBag },
    { id: "comprobantes", etiqueta: "Comprobantes", cuenta: facturasVenta.filter((f) => f.estado !== "anulada").length, Icono: Receipt },
    { id: "ordenes", etiqueta: "Órdenes de laboratorio", cuenta: ordenesAbiertas(ordenesLab).length, Icono: FlaskConical },
    { id: "cobros", etiqueta: "Cobros y saldos", cuenta: saldos.length, Icono: Wallet },
  ]

  // Excel de "Cobrado": el mismo modelo del reporte "Cobros del período" de Reportes, de un solo día.
  const exportarCobros = async (dia) => {
    try {
      const { modeloCobros, descargarModelo } = await import("../utilidades/reportesExcel")
      const rango = { inicio: dia, fin: dia }
      await descargarModelo(modeloCobros({ facturas: facturasVenta, abonos, pacientes, rango }), { usuario, opticaNombre: usuario?.opticaNombre, usuarioNombre: usuario?.nombre, rango, filtrosTexto: "ninguno" })
      notificar(`Se descargó lo cobrado el ${formatoFecha(dia, "medio")}.`)
    } catch {
      notificar("No se pudo descargar el Excel. Vuelve a intentarlo.", "error")
    }
  }

  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}><ShoppingBag size={24} aria-hidden="true" /></div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Ventas</h1>
        </div>
        <AccionesDeCabecera avisos={avisosDelModulo}>
          {puedeVender && (
            <button type="button" onClick={() => setNuevaVenta(true)} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <ShoppingCart size={18} aria-hidden="true" /> Nueva venta
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      {cargaInicial && facturasVenta.length === 0 && pases.length === 0 && ordenesLab.length === 0 ? (
        <TablaSkeleton />
      ) : (
        <>
          <div role="tablist" aria-label="Secciones de ventas" className="flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            {pestanas.map(({ id, etiqueta, cuenta, Icono }) => {
              const activo = tab === id
              return (
                <button key={id} type="button" role="tab" id={`ventas-tab-${id}`} aria-selected={activo} aria-controls="ventas-panel" onClick={() => setTab(id)}
                  className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
                  style={activo ? { background: GRAD_MARCA } : undefined}>
                  <Icono size={14} aria-hidden="true" /> {etiqueta}
                  <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{cuenta}</span>
                </button>
              )
            })}
          </div>

          <div id="ventas-panel" role="tabpanel" aria-labelledby={`ventas-tab-${tab}`}>
            {tab === "porvender" && (
              <PestanaPorVender key={destino.n} filtroInicial={destino.filtroCola} v={v} usuario={usuario} puedeVender={puedeVender} onVerPaciente={onVerPaciente} onNuevaVenta={() => setNuevaVenta(true)} />
            )}
            {tab === "comprobantes" && (
              <PestanaComprobantes
                key={destino.n}
                facturas={facturasVenta} abonos={abonos} pacientes={pacientes}
                puedeVender={puedeVender} puedeEditar={puedeEditar} inicial={destino.comprobantes}
                onNuevaVenta={() => setNuevaVenta(true)}
                onAbrir={(f) => setDetalleId(f.id)}
                onAbonar={(f) => abonar(f, pacienteDe(f.pacienteId))}
                onVerPaciente={verPaciente}
              />
            )}
            {tab === "ordenes" && (
              <OrdenesLaboratorio
                key={destino.n} api={ordenesApi}
                ordenes={ordenesLab} pacientes={pacientes} filtroInicial={destino.filtroOrdenes}
                onVerPerfil={verPaciente} onVerComprobantes={() => setTab("comprobantes")}
              />
            )}
            {tab === "cobros" && (
              <PestanaCobros
                facturas={facturasVenta} abonos={abonos} abonosAnulados={abonosAnulados} pacientes={pacientes} ventas={ventas} ordenes={ordenesLab}
                puedeEditar={puedeEditar}
                onCobrar={abonar}
                onVerComprobante={(f) => setDetalleId(f.id)}
                onVerPaciente={verPaciente}
                onExportar={exportarCobros}
              />
            )}
          </div>
        </>
      )}

      {detalle && (
        <DetalleComprobante
          factura={detalle} paciente={pacienteDe(detalle.pacienteId)} abonos={abonos} abonosAnulados={abonosAnulados} ordenes={ordenesLab} equipo={equipo} usuario={usuario} parametrizacion={parametrizacion}
          v={v} ordenesApi={ordenesApi} puedeVender={puedeVender} puedeEditar={puedeEditar} puedeAnular={puedeAnular} onAviso={notificar}
          onCerrar={() => setDetalleId(null)} onVerPaciente={(p) => { setDetalleId(null); verPaciente(p) }}
        />
      )}
      {nuevaVenta && (
        <ComprobanteVentaModal
          usuario={usuario}
          inventario={inventario}
          setInventario={setInventario}
          categorias={categoriasInventario}
          setCategorias={setCategoriasInventario}
          pacientes={pacientes}
          vinculoParaPaciente={(p) => {
            const pase = pases.find((x) => x.pacienteId === p.id && x.estado === "listo")
            if (!pase) return null
            const c = consultas.find((k) => k.id === pase.consultaId)
            return { consultaId: pase.consultaId, citaId: pase.citaId, etiqueta: `¿Esta venta es de la consulta del ${fechaLegible(c?.fecha) || "paciente"}? (listo para venta)` }
          }}
          onGuardado={(factura) => { v.registrarFactura(factura); notificar(`Venta ${numeroComprobante(factura.numero)} registrada.`) }}
          onCerrar={() => setNuevaVenta(false)}
        />
      )}
      <ModalesVentas
        v={v} usuario={usuario} parametrizacion={parametrizacion} inventario={inventario} setInventario={setInventario}
        categoriasInventario={categoriasInventario} setCategoriasInventario={setCategoriasInventario} abonos={abonos} ordenesLab={ordenesLab}
      />
      {ordenesApi.ventanas}
    </div>
  )
}
