"use client"

import { useEffect, useMemo, useState } from "react"
import { useParamUrl } from "../utilidades/urlEstado"
import { Plus, ShoppingBag } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import ModalesVentas from "../componentes/ModalesVentas"
import TablaSkeleton from "../componentes/TablaSkeleton"
import PestanaVentas from "../componentes/ventas/PestanaVentas"
import PestanaPedidos from "../componentes/ventas/PestanaPedidos"
import { Pestanas } from "../componentes/ventas/Piezas"
import DetalleComprobante from "../componentes/ventas/DetalleComprobante"
import { useOrdenesLab } from "../componentes/ventas/useOrdenesLab"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { useVentas } from "../utilidades/useVentas"
import { puede } from "../utilidades/permisosUi"
import { ordenesAbiertas } from "../utilidades/ordenesLaboratorio"
import { numeroComprobante } from "../utilidades/comprobantes"
import { periodoDeDestino } from "../utilidades/periodoLista"
import { filtroDeOrdenesValido } from "../utilidades/ventasModulo"

const TABS = ["ventas", "pedidos"]
// Los nombres de antes (los usan los enlaces del Inicio, de Reportes y las direcciones guardadas): «Por vender» ya no es de Ventas (está en «Para contactar» del CRM) y
// «Comprobantes» y «Cobros y saldos» son una sola lista.
const TAB_ANTIGUO = { cola: "ventas", porvender: "ventas", comprobantes: "ventas", cobros: "ventas", saldos: "ventas", ordenes: "pedidos" }
const DATO_DE_ESTADO = { saldo: "porcobrar", pagadas: "cobrado" }

// Módulo de Ventas: solo lo vendido, en dos pestañas. «Ventas» (la lista de ventas con su franja de datos: vendido, cobrado, por cobrar, pagos por verificar y lentes en el laboratorio) y «Pedidos de lentes».
// El análisis va en Reportes. Los datos siguen viniendo de Dashboard; esta página solo los muestra y abre las mismas ventanas que usa el perfil del paciente.
export default function Ventas({
  usuario, cargaInicial = false, parametrizacion, pacientes = [], consultas = [], inventario = [], setInventario,
  categoriasInventario = [], setCategoriasInventario, ventas = [], facturasVenta = [], setFacturasVenta,
  pases = [], setPases, ordenesLab = [], setOrdenesLab, abonos = [], abonosAnulados = [], equipo = [],
  accionInicial, onAccionInicialConsumida, onVerPaciente, onAviso, avisosDelModulo = null, pagosPorVerificar = [], recargarPagos,
}) {
  const puedeVender = puede(usuario, "ventas", "crear")
  const puedeEditar = puede(usuario, "ventas", "editar")
  const puedeAnular = puede(usuario, "ventas", "eliminar")

  const [tabUrl, setTab] = useParamUrl("tab", "ventas", [...TABS, ...Object.keys(TAB_ANTIGUO)])
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

  // Destino pedido desde el Inicio, Reportes o el menú: { tab, dato, filtro, estado, desde, hasta, periodo, sinFE, texto }
  useEffect(() => {
    if (!accionInicial) return
    const pedida = TAB_ANTIGUO[accionInicial.tab] || accionInicial.tab
    if (pedida) setTab(pedida)
    setDestino((d) => ({
      n: d.n + 1,
      filtroPedidos: filtroDeOrdenesValido(accionInicial.filtro),
      ventas: {
        periodo: periodoDeDestino(accionInicial),
        dato: accionInicial.dato || DATO_DE_ESTADO[accionInicial.estado] || (accionInicial.tab === "cobros" || accionInicial.tab === "saldos" ? "porcobrar" : null),
        estado: accionInicial.estado === "anuladas" ? "anuladas" : "vigentes",
        sinFE: !!accionInicial.sinFE,
        texto: accionInicial.texto || "",
      },
    }))
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial])

  const pacienteDe = (id) => pacientes.find((p) => p.id === id) || null
  const verPaciente = (p) => p && onVerPaciente?.(p.id)
  const detalle = detalleId ? facturasVenta.find((f) => f.id === detalleId) || null : null
  const enCurso = useMemo(() => ordenesAbiertas(ordenesLab).length, [ordenesLab])
  const vigentes = useMemo(() => facturasVenta.filter((f) => f.estado !== "anulada").length, [facturasVenta])
  const pestanas = [
    { id: "ventas", titulo: "Ventas", cuenta: vigentes },
    { id: "pedidos", titulo: "Pedidos de lentes", cuenta: enCurso },
  ]

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
              <Plus size={18} aria-hidden="true" /> Nueva venta
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      {cargaInicial && facturasVenta.length === 0 && ordenesLab.length === 0 ? (
        <TablaSkeleton />
      ) : (
        <>
          <Pestanas etiqueta="Secciones de ventas" pestanas={pestanas} activa={tab} onCambiar={setTab} idBase="ventas" />

          <div id="ventas-panel" role="tabpanel" aria-labelledby={`ventas-tab-${tab}`}>
            {tab === "ventas" && (
              <PestanaVentas
                key={destino.n}
                facturas={facturasVenta} abonos={abonos} pacientes={pacientes} ordenes={ordenesLab} pagosPorVerificar={pagosPorVerificar}
                puedeVender={puedeVender} inicial={destino.ventas}
                onNuevaVenta={() => setNuevaVenta(true)}
                onAbrir={(f) => setDetalleId(f.id)}
                onVerPedidos={(filtro) => { setDestino((d) => ({ ...d, n: d.n + 1, filtroPedidos: filtroDeOrdenesValido(filtro) })); setTab("pedidos") }}
              />
            )}
            {tab === "pedidos" && (
              <PestanaPedidos
                key={destino.n} api={ordenesApi}
                ordenes={ordenesLab} parametrizacion={parametrizacion} filtroInicial={destino.filtroPedidos}
                puedeVender={puedeVender} onNuevaVenta={() => setNuevaVenta(true)}
              />
            )}
          </div>
        </>
      )}

      {detalle && (
        <DetalleComprobante
          factura={detalle} paciente={pacienteDe(detalle.pacienteId)} abonos={abonos} abonosAnulados={abonosAnulados} ordenes={ordenesLab} equipo={equipo} usuario={usuario} parametrizacion={parametrizacion}
          v={v} ordenesApi={ordenesApi} puedeVender={puedeVender} puedeEditar={puedeEditar} puedeAnular={puedeAnular} onAviso={notificar}
          pagosPorVerificar={pagosPorVerificar.filter((p) => p.facturaId === detalle.id)}
          onPagoConfirmado={(p, r) => {
            setFacturasVenta?.((prev) => prev.map((f) => (f.id === p.facturaId ? { ...f, estado: r.estado || f.estado, cuotasPagadas: r.cuotasPagadas ?? f.cuotasPagadas } : f)))
            notificar(r.estado === "pagada" ? `Pago confirmado: la venta de ${p.pacienteNombre || "el paciente"} quedó pagada.` : "Pago confirmado: quedó registrado como abono por transferencia.")
            recargarPagos?.()
          }}
          onPagoRechazado={() => { notificar("Pago rechazado: el paciente verá el motivo en su portal."); recargarPagos?.() }}
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
          consultas={consultas}
          pases={pases}
          parametrizacion={parametrizacion}
          onTomarSolicitud={v.tomarSolicitud}
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
