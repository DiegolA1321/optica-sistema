"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { useEffect, useMemo, useState } from "react"
import { useParamUrl } from "../utilidades/urlEstado"
import { AlertCircle, CheckCircle, FlaskConical, Search, ShoppingBag, ShoppingCart, Wallet, Receipt, UserX } from "lucide-react"
import { INK } from "@/lib/tema"
import ColaVentas from "../componentes/ColaVentas"
import OrdenesLaboratorio from "../componentes/OrdenesLaboratorio"
import FilaComprobante from "../componentes/FilaComprobante"
import ModalesVentas from "../componentes/ModalesVentas"
import TablaSkeleton from "../componentes/TablaSkeleton"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { useVentas } from "../utilidades/useVentas"
import { puede } from "../utilidades/permisosUi"
import { ordenesAbiertas, ordenesAtrasadas, ordenesListasSinAvisar } from "../utilidades/ordenesLaboratorio"
import { saldosPorPaciente, totalPorCobrar, filtrarComprobantes } from "../utilidades/saldosVentas"
import { fechaLegible } from "../utilidades/formatoFecha"
import { numeroComprobante, LEYENDA_INTERNO } from "../utilidades/comprobantes"
import { coincideTexto } from "../utilidades/busqueda"

const GRAD = "linear-gradient(135deg,#34d399,#059669)" // verde de venta/dinero, como el modal de venta
const POR_PAGINA = 40

// Módulo de Ventas (Bloque E, 3.4 de vision-sistema.md): lo que antes estaba repartido entre Pacientes
// y el Inventario. Por vender (cola "Listo para venta"), comprobantes de venta internos, órdenes de
// laboratorio y saldos por cobrar. Los datos siguen viniendo de Dashboard; esta página solo los muestra
// y abre los mismos modales que usa el perfil del paciente.
export default function Ventas({
  usuario, cargaInicial = false, parametrizacion, pacientes = [], consultas = [], inventario = [], setInventario,
  categoriasInventario = [], setCategoriasInventario, ventas = [], facturasVenta = [], setFacturasVenta,
  pases = [], setPases, ordenesLab = [], setOrdenesLab, abonos = [], equipo = [],
  accionInicial, onAccionInicialConsumida, onVerPaciente, onAviso,
}) {
  const puedeVender = puede(usuario, "ventas", "crear")
  const puedeEditar = puede(usuario, "ventas", "editar")
  const puedeAnular = puede(usuario, "ventas", "eliminar")

  const [tab, setTab] = useParamUrl("tab", "cola", ["cola", "ventas", "ordenes", "saldos"]) // cola | ventas | ordenes | saldos
  const [verNoCompraron, setVerNoCompraron] = useState(false)
  const [filtroOrdenes, setFiltroOrdenes] = useState("abiertas")
  const [texto, setTexto] = useState("")
  const [textoCola, setTextoCola] = useState("")
  const [estado, setEstado] = useState("todas")
  const [sinFE, setSinFE] = useState(false)
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [nuevaVenta, setNuevaVenta] = useState(false)
  const [bannerError, setBannerError] = useState("")

  const notificar = (msg) => onAviso?.(msg)
  const avisarError = (msg) => { setBannerError(msg); setTimeout(() => setBannerError(""), 4500) }
  const v = useVentas({ usuario, parametrizacion, pacientes, consultas, pases, setPases, setOrdenesLab, facturasVenta, setFacturasVenta, abonos, ventas, setInventario, notificar, avisarError })

  // Destino pedido desde el Inicio o el menú: { tab, filtro }
  useEffect(() => {
    if (!accionInicial) return
    if (accionInicial.tab) setTab(accionInicial.tab)
    if (accionInicial.tab === "ordenes") setFiltroOrdenes(accionInicial.filtro || "abiertas")
    if (accionInicial.tab === "cola") setVerNoCompraron(false)
    if (accionInicial.texto != null) { setTexto(accionInicial.texto); setEstado("todas"); setSinFE(false) }
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial])

  const saldos = useMemo(() => saldosPorPaciente({ pacientes, facturas: facturasVenta, abonos, ventas }), [pacientes, facturasVenta, abonos, ventas])
  const porCobrar = totalPorCobrar(saldos)
  const abiertas = ordenesAbiertas(ordenesLab).length
  const atrasadas = ordenesAtrasadas(ordenesLab).length
  const sinAvisar = ordenesListasSinAvisar(ordenesLab).length
  const comprobantes = useMemo(() => filtrarComprobantes(facturasVenta, { texto, estado, sinFacturaElectronica: sinFE, pacientes, abonos }), [facturasVenta, texto, estado, sinFE, pacientes, abonos])
  useEffect(() => { setVisibles(POR_PAGINA) }, [texto, estado, sinFE])

  const pacienteDe = (id) => pacientes.find((p) => p.id === id) || null
  const verPaciente = (p) => p && onVerPaciente?.(p.id)

  const tabs = [
    { id: "cola", etiqueta: "Por vender", valor: v.colaListos.length, icono: ShoppingBag, ayuda: "Pacientes que esperan su venta" },
    { id: "ventas", etiqueta: "Ventas", valor: facturasVenta.filter((f) => f.estado !== "anulada").length, icono: Receipt, ayuda: "Comprobantes de venta" },
    { id: "ordenes", etiqueta: "Órdenes de laboratorio", valor: abiertas, icono: FlaskConical, alerta: atrasadas + sinAvisar, ayuda: `${atrasadas} atrasada${atrasadas === 1 ? "" : "s"} · ${sinAvisar} lista${sinAvisar === 1 ? "" : "s"} sin avisar` },
    { id: "saldos", etiqueta: "Saldos por cobrar", valor: dinero(porCobrar), icono: Wallet, alerta: porCobrar > 0 ? 1 : 0, ayuda: `${saldos.length} paciente${saldos.length === 1 ? "" : "s"} con saldo` },
  ]

  return (
    <div className="w-full space-y-5 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      {bannerError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200/60 bg-red-50 p-3.5 text-red-900">
          <AlertCircle className="shrink-0 text-red-500" size={18} />
          <p className="text-sm font-semibold">{bannerError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD }}><ShoppingBag size={24} aria-hidden="true" /></div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Ventas</h1>
            <p className="text-sm text-slate-500">Pacientes por vender, comprobantes, órdenes de laboratorio y saldos.</p>
          </div>
        </div>
        {puedeVender && (
          <button type="button" onClick={() => setNuevaVenta(true)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
            <ShoppingCart size={16} aria-hidden="true" /> Nueva venta
          </button>
        )}
      </div>

      {cargaInicial && facturasVenta.length === 0 && pases.length === 0 && ordenesLab.length === 0 ? (
        <TablaSkeleton />
      ) : (
        <>
          <div role="tablist" aria-label="Secciones de ventas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tabs.map((t) => {
              const Icono = t.icono
              const activo = tab === t.id
              return (
                <button key={t.id} type="button" role="tab" id={`ventas-tab-${t.id}`} aria-selected={activo} aria-controls="ventas-panel" onClick={() => setTab(t.id)}
                  className={"flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors cursor-pointer " + (activo ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500" : "border-slate-200/60 bg-white hover:border-slate-300")}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Icono size={13} aria-hidden="true" /> {t.etiqueta}</span>
                    {t.alerta > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-label="Requiere atención" />}
                  </span>
                  <span className="text-2xl font-bold" style={{ color: INK }}>{t.valor}</span>
                  <span className="text-[11px] text-slate-500">{t.ayuda}</span>
                </button>
              )
            })}
          </div>

          <div id="ventas-panel" role="tabpanel" aria-labelledby={`ventas-tab-${tab}`} className="space-y-3">
            {tab === "cola" && (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" aria-pressed={!verNoCompraron} onClick={() => setVerNoCompraron(false)} className={"rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (!verNoCompraron ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}>
                    Listos para venta ({v.colaListos.length})
                  </button>
                  <button type="button" aria-pressed={verNoCompraron} onClick={() => setVerNoCompraron(true)} className={"flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (verNoCompraron ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}>
                    <UserX size={12} aria-hidden="true" /> No compraron ({v.colaDescartados.length})
                  </button>
                </div>
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input type="search" aria-label="Buscar paciente en la cola" placeholder="Buscar paciente por nombre o cédula…" value={textoCola} onChange={(e) => setTextoCola(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                </div>
                <ColaVentas
                  modo={verNoCompraron ? "descartados" : "listos"}
                  items={(verNoCompraron ? v.colaDescartados : v.colaListos).filter(({ paciente }) => coincideTexto(textoCola, paciente?.nombre, paciente?.cedula))}
                  busqueda={textoCola}
                  puedeActuar={puedeVender}
                  saldoDe={v.saldoDe}
                  reabriendoId={v.reabriendoId}
                  onTomarDatos={v.setVentaCola}
                  onNoCompro={v.setNoComproPara}
                  onReabrir={v.reabrirPase}
                  onVerPerfil={verPaciente}
                />
              </>
            )}

            {tab === "ventas" && (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[220px] flex-1">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input type="search" aria-label="Buscar comprobante" placeholder="Buscar por paciente, cédula, CV-0001 o factura electrónica…" value={texto} onChange={(e) => setTexto(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                  </div>
                  <select aria-label="Estado del comprobante" value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <option value="todas">Todos los estados</option>
                    <option value="pagadas">Pagadas</option>
                    <option value="saldo">Con saldo</option>
                    <option value="anuladas">Anuladas</option>
                  </select>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                    <input type="checkbox" checked={sinFE} onChange={(e) => setSinFE(e.target.checked)} className="accent-emerald-600" /> Sin factura electrónica
                  </label>
                </div>
                {comprobantes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Receipt size={24} aria-hidden="true" /></div>
                    <p className="text-sm font-semibold text-slate-600">{facturasVenta.length === 0 ? "Todavía no hay ventas registradas." : "Ninguna venta coincide con el filtro."}</p>
                    {facturasVenta.length === 0 && puedeVender && <button type="button" onClick={() => setNuevaVenta(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Registrar la primera venta</button>}
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" aria-label="Comprobantes de venta">
                      {comprobantes.slice(0, visibles).map((f) => {
                        const paciente = pacienteDe(f.pacienteId)
                        return (
                          <FilaComprobante
                            key={f.id} factura={f} abonos={abonos} ordenes={ordenesLab.filter((o) => o.facturaId === f.id)}
                            paciente={paciente} mostrarPaciente onVerPaciente={verPaciente}
                            puedeEditar={puedeEditar} puedeVender={puedeVender} puedeAnular={puedeAnular}
                            onAbonar={(fac) => v.setAbonoPara({ factura: fac, paciente })}
                            onOrden={(fac) => v.setOrdenParaVenta({ factura: fac, paciente })}
                            onAnular={(fac) => v.setAnularPara({ factura: fac, paciente })}
                            onFacturaElectronica={(fac) => v.setFacturaElectronicaPara({ factura: fac, paciente })}
                          />
                        )
                      })}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Mostrando {Math.min(visibles, comprobantes.length)} de {comprobantes.length}. {LEYENDA_INTERNO}</span>
                      {visibles < comprobantes.length && <button type="button" onClick={() => setVisibles((n) => n + POR_PAGINA)} className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Mostrar más</button>}
                    </div>
                  </>
                )}
              </>
            )}

            {tab === "ordenes" && (
              <OrdenesLaboratorio
                ordenes={ordenesLab}
                setOrdenes={setOrdenesLab}
                pacientes={pacientes}
                equipo={equipo}
                usuario={usuario}
                facturas={facturasVenta}
                abonos={abonos}
                onAbonar={(factura, paciente) => v.setAbonoPara({ factura, paciente })}
                filtroInicial={filtroOrdenes}
                onAviso={notificar}
                onVerPerfil={verPaciente}
              />
            )}

            {tab === "saldos" && (
              saldos.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle size={24} aria-hidden="true" /></div>
                  <p className="text-sm font-semibold text-slate-600">No hay saldos por cobrar.</p>
                  <p className="max-w-sm text-xs text-slate-500">Cuando una venta quede con abonos pendientes, el paciente aparece aquí con lo que debe.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" aria-label="Saldos por cobrar">
                  {saldos.map((s) => (
                    <li key={s.pacienteId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <button type="button" onClick={() => verPaciente(s.paciente)} className="truncate text-sm font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{s.paciente?.nombre || "Paciente"}</button>
                        <p className="text-[11px] text-slate-500">
                          {s.ventasPendientes.map((f) => numeroComprobante(f.numero)).join(", ") || "Ventas anteriores"}
                          {s.masAntigua ? ` · desde ${fechaLegible(s.masAntigua)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><Wallet size={12} aria-hidden="true" /> Debe {dinero(s.saldo)}</span>
                        {puedeEditar && s.ventasPendientes.map((f) => (
                          <button key={f.id} type="button" onClick={() => v.setAbonoPara({ factura: f, paciente: s.paciente })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
                            Abonar {numeroComprobante(f.numero)}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </>
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
    </div>
  )
}
