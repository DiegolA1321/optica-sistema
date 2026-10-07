"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Receipt, Search, X, AlertTriangle, Plus, ArrowLeft, Wrench, Printer, Stethoscope, UserX, ChevronDown } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { registrarLog } from "../utilidades/logs"
import { UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import CampoCategoria from "../componentes/CampoCategoria"
import CampoImagenProducto from "../componentes/CampoImagenProducto"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import OrdenLaboratorioModal from "../componentes/OrdenLaboratorioModal"
import { esLineaDeLente } from "../utilidades/ordenesLaboratorio"
import { mapAbono, EVENTO_ABONO } from "../utilidades/abonos"
import { textoDiagnostico } from "../utilidades/pasesVenta"

// ─── Paleta de firma (paleta de venta/dinero) ───
const GRAD_VENTA = "linear-gradient(135deg,#34d399,#059669)" // verde: acción de venta/dinero
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul, tipo "producto"
const VIOLETA = "#7c3aed" // tipo "servicio"

// Panel de cobro ÚNICO (propuesta de flujo de atención, Ronda 4): el mismo
// panel se usa al guardar la ficha clínica (consulta + lente precargados,
// "Más tarde" / "Cobrar y finalizar"), desde el perfil del paciente ("Nueva
// venta", vacío) y para cobrar un cobro pendiente. Una venta de un producto
// es una factura de una línea.
//
// Punto 06 del Diagnóstico Maestro: factura con líneas múltiples (producto
// y/o servicio) y un solo método de pago para el total. Desde la Ronda 4 es
// también el único camino de venta (reemplazó a VentaProductoModal, que se
// retiró junto con "Vender" de Inventario).
// Un servicio (examen, ajuste, garantía) no tiene producto_id y no
// descuenta inventario — ver crear_factura_venta (migración 0072).
export default function ComprobanteVentaModal({
  usuario,
  inventario = [],
  setInventario,
  categorias = [],
  setCategorias,
  pacienteFijo,
  // Sin pacienteFijo (venta iniciada desde Inventario) el panel pide elegir
  // al paciente de esta lista.
  pacientes = [],
  // Precarga una línea al abrir (ej. el lente que el optómetra ya vinculó
  // en la ficha clínica) — "listo para cobrar en un solo paso" en vez de
  // obligar a volver a buscar el mismo producto que ya se eligió antes.
  // Si el producto ya no existe o se quedó sin stock, se ignora en
  // silencio y el modal abre vacío, como siempre.
  lineaInicial,
  // Varias líneas precargadas: [{ tipo: "servicio", descripcion, cantidad,
  // precioUnitario }, { tipo: "producto", productoId, cantidad }]. Los
  // productos sin stock (o ya inexistentes) se omiten en silencio.
  lineasIniciales,
  titulo = "Nueva venta",
  subtitulo = "Varios productos/servicios, un solo pago.",
  etiquetaGuardar = "Guardar venta",
  // Si se pasa, el botón secundario es "Más tarde" (en vez de "Cancelar").
  onMasTarde,
  // Encadena la factura a la consulta/cita de origen — mismos parámetros
  // que ya usa ConsultaMedica.jsx al crear la factura desde su propio
  // editor embebido (ver crear_factura_venta, migración 0072).
  consultaId = null,
  citaId = null,
  // Venta desde la cola de "Listo para venta" (R35): datos de la consulta que se
  // muestran de solo lectura, y las acciones de proforma y "No compró".
  // diagnostico es la consulta ({ fecha, motivo, diagnostico, diagnosticoCategorias,
  // lenteRecomendado, indicaciones, od, oi }). onProforma({ lineas, total, incluirMedidas })
  // imprime el presupuesto; no guarda nada ni toca el stock.
  diagnostico = null,
  onProforma,
  onNoCompro,
  // "Nueva venta" de un paciente con un pase abierto: ofrece vincular la venta
  // a esa consulta para que cierre el pase ({ consultaId, citaId, etiqueta }).
  vinculoSugerido = null,
  onGuardado,
  onCerrar,
}) {
  const opticaId = usuario?.opticaId
  const [vincular, setVincular] = useState(true)
  // R36: una venta con lentes genera su orden de laboratorio. El check se sugiere
  // solo cuando hay una línea que parece lente, pero se puede marcar a mano.
  const [crearOrden, setCrearOrden] = useState(null)
  const [ordenPara, setOrdenPara] = useState(null) // factura recién guardada, a la espera de su orden
  const [incluirMedidas, setIncluirMedidas] = useState(false)
  const [verMedidas, setVerMedidas] = useState(false)
  const consultaIdEfectivo = consultaId ?? (vinculoSugerido && vincular ? vinculoSugerido.consultaId : null)
  const citaIdEfectivo = citaId ?? (vinculoSugerido && vincular ? vinculoSugerido.citaId : null)

  const [lineas, setLineas] = useState(() => {
    const iniciales = lineasIniciales || (lineaInicial?.productoId ? [{ tipo: "producto", ...lineaInicial }] : [])
    const out = []
    for (const l of iniciales) {
      if (l.tipo === "servicio" || !l.productoId) {
        out.push({ tipo: "servicio", productoId: null, descripcion: l.descripcion || "Servicio", cantidad: Math.max(1, l.cantidad || 1), precioUnitario: Math.max(0, Number(l.precioUnitario) || 0) })
        continue
      }
      const p = inventario.find((x) => x.id === l.productoId)
      if (!p || (Number(p.stock) || 0) <= 0) continue
      const cant = Math.min(Math.max(1, l.cantidad || 1), Number(p.stock) || 1)
      out.push({ tipo: "producto", productoId: p.id, descripcion: p.nombre, cantidad: cant, precioUnitario: Number(p.precio) || 0 })
    }
    return out
  })
  const [tipoLinea, setTipoLinea] = useState("producto")

  const [productoId, setProductoId] = useState(null)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false)
  const [cantidadProducto, setCantidadProducto] = useState("1")

  const [descServicio, setDescServicio] = useState("")
  const [cantidadServicio, setCantidadServicio] = useState("1")
  const [precioServicio, setPrecioServicio] = useState("")

  // Alta rápida de producto sin salir del flujo — mismo caso de la reunión
  // con el ing, ya resuelto antes en el modal de venta rápida (retirado).
  const CATEGORIAS_NP = categorias.length > 0 ? categorias : ["Armazones", "Accesorios"]
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [npNombre, setNpNombre] = useState("")
  const [npCategoria, setNpCategoria] = useState(CATEGORIAS_NP[0] || "Armazones")
  const [npStock, setNpStock] = useState("1")
  const [npPrecio, setNpPrecio] = useState("")
  const [npObservacion, setNpObservacion] = useState("")
  const [npCritico, setNpCritico] = useState("")
  const [npImagenUrl, setNpImagenUrl] = useState(null)
  const [erroresNp, setErroresNp] = useState({})
  const [guardandoNp, setGuardandoNp] = useState(false)

  const [pacienteSel, setPacienteSel] = useState(null)
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdownPaciente, setMostrarDropdownPaciente] = useState(false)
  const paciente = pacienteFijo || pacienteSel
  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    const base = q ? pacientes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cedula || "").includes(q)) : pacientes
    return base.slice(0, 8)
  }, [pacientes, busquedaPaciente])

  const [metodoPago, setMetodoPago] = useState("directo")
  const [cuotasTotales, setCuotasTotales] = useState("3")
  const [abonoInicial, setAbonoInicial] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const productoSeleccionado = inventario.find((p) => p.id === productoId) || null

  const productosFiltrados = useMemo(() => {
    const disponibles = inventario.filter((p) => (Number(p.stock) || 0) > 0)
    const q = busquedaProducto.trim().toLowerCase()
    if (!q) return disponibles.slice(0, 8)
    return disponibles.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [inventario, busquedaProducto])

  const total = useMemo(() => lineas.reduce((sum, l) => sum + l.cantidad * l.precioUnitario, 0), [lineas])

  const limpiarCamposProducto = () => {
    setProductoId(null)
    setBusquedaProducto("")
    setCantidadProducto("1")
  }

  const agregarLineaProducto = () => {
    if (!productoSeleccionado) return
    const cant = parseInt(cantidadProducto, 10) || 0
    if (cant <= 0) { setError("Ingresa una cantidad válida."); return }
    if (cant > (Number(productoSeleccionado.stock) || 0)) { setError(`Solo hay ${productoSeleccionado.stock} u. disponibles en bodega.`); return }
    setLineas((prev) => [...prev, {
      tipo: "producto",
      productoId: productoSeleccionado.id,
      descripcion: productoSeleccionado.nombre,
      cantidad: cant,
      precioUnitario: Number(productoSeleccionado.precio) || 0,
    }])
    setError("")
    limpiarCamposProducto()
  }

  const agregarLineaServicio = () => {
    const desc = descServicio.trim()
    const precio = parseFloat(precioServicio)
    const cant = parseInt(cantidadServicio, 10) || 0
    if (!desc) { setError("Escribe una descripción para el servicio."); return }
    if (isNaN(precio) || precio < 0) { setError("Ingresa un precio válido."); return }
    if (cant <= 0) { setError("Ingresa una cantidad válida."); return }
    setLineas((prev) => [...prev, { tipo: "servicio", productoId: null, descripcion: desc, cantidad: cant, precioUnitario: precio }])
    setError("")
    setDescServicio("")
    setCantidadServicio("1")
    setPrecioServicio("")
  }

  const quitarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx))
  // El precio de un servicio (p. ej. la consulta precargada con su costo
  // base) es editable en el momento; puede ser 0. El de un producto sale de
  // inventario.
  const editarPrecioLinea = (idx, valor) => setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, precioTexto: valor, precioUnitario: Math.max(0, parseFloat(valor) || 0) } : l)))

  const abrirAltaProducto = () => {
    setNpNombre(busquedaProducto)
    setNpCategoria(CATEGORIAS_NP[0] || "Armazones")
    setNpStock("1")
    setNpPrecio("")
    setNpObservacion("")
    setNpCritico("")
    setNpImagenUrl(null)
    setErroresNp({})
    setAgregandoProducto(true)
  }

  const cancelarAltaProducto = () => { setAgregandoProducto(false); setErroresNp({}) }

  const guardarProductoRapido = async (e) => {
    e.preventDefault()
    const stockNum = parseInt(npStock, 10)
    const precioNum = parseFloat(npPrecio)
    const errs = {}
    if (!npNombre.trim()) errs.nombre = "Escribe una descripción para el producto."
    if (npStock === "" || isNaN(stockNum) || stockNum < 0) errs.stock = "Ingresa una cantidad válida (0 o más)."
    if (npPrecio === "" || isNaN(precioNum) || precioNum < 0) errs.precio = "Ingresa un precio válido."
    const duplicado = inventario.find((p) => p.nombre.trim().toLowerCase() === npNombre.trim().toLowerCase())
    if (!errs.nombre && duplicado) {
      errs.nombre = `Ya existe "${duplicado.nombre}" en bodega (${duplicado.stock} u.). Búscalo arriba en vez de crearlo de nuevo.`
    }
    setErroresNp(errs)
    if (Object.keys(errs).length > 0) return

    const nuevo = {
      nombre: npNombre,
      categoria: npCategoria,
      stock: stockNum,
      precio: precioNum,
      observacion: npObservacion || "",
      critico: npCritico === "" ? null : Math.max(0, parseInt(npCritico, 10) || 0),
      imagen_url: npImagenUrl || null,
    }

    setGuardandoNp(true)
    if (supabase && opticaId) {
      const { data, error: errorInsert } = await supabase.from("inventario").insert({ ...nuevo, optica_id: opticaId }).select().single()
      if (errorInsert) {
        setErroresNp({ general: esErrorSinPermiso(errorInsert) ? MENSAJE_SIN_PERMISO : "No se pudo registrar el producto. Revisa tu conexión e intenta de nuevo." })
        setGuardandoNp(false)
        return
      }
      nuevo.id = data.id
    } else {
      nuevo.id = Date.now()
    }

    setInventario?.((prev) => [nuevo, ...prev])
    registrarLog(usuario, "inventario", "Agregó un producto al inventario", nuevo.nombre)
    setGuardandoNp(false)
    setAgregandoProducto(false)
    setProductoId(nuevo.id)
    setBusquedaProducto("")
  }

  const cambiarMetodoPago = (m) => setMetodoPago(m)
  const hayLente = lineas.some(esLineaDeLente)
  const incluyeLentes = crearOrden ?? hayLente

  const imprimirProforma = () => {
    if (lineas.length === 0) { setError("Agrega al menos una línea para armar la proforma."); return }
    if (lineas.some((l) => l.precioTexto !== undefined && (l.precioTexto.trim() === "" || Number.isNaN(parseFloat(l.precioTexto)) || parseFloat(l.precioTexto) < 0))) {
      setError("Revisa los precios: cada uno debe ser un número de 0 en adelante."); return
    }
    setError("")
    onProforma?.({ lineas, total, incluirMedidas })
  }

  const confirmarFactura = async (e) => {
    e.preventDefault()
    if (!paciente) { setError("Selecciona el paciente de esta venta."); return }
    if (lineas.length === 0) { setError("Agrega al menos una línea antes de guardar."); return }
    if (lineas.some((l) => l.precioTexto !== undefined && (l.precioTexto.trim() === "" || Number.isNaN(parseFloat(l.precioTexto)) || parseFloat(l.precioTexto) < 0))) {
      setError("Revisa los precios: cada uno debe ser un número de 0 en adelante."); return
    }
    const cuotasNum = metodoPago === "cuotas" ? parseInt(cuotasTotales, 10) : null
    if (metodoPago === "cuotas" && (!cuotasNum || cuotasNum < 1)) { setError("Ingresa un número de cuotas válido."); return }
    const abonoNum = metodoPago === "abonos" && abonoInicial.trim() !== "" ? Math.round(parseFloat(abonoInicial) * 100) / 100 : 0
    if (metodoPago === "abonos" && abonoInicial.trim() !== "" && (!(abonoNum > 0) || abonoNum > total)) { setError("El abono inicial debe ser mayor que cero y no superar el total."); return }

    setGuardando(true)
    setError("")

    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase
        .rpc("crear_factura_venta", {
          p_optica_id: opticaId,
          p_paciente_id: paciente.id,
          p_metodo_pago: metodoPago,
          p_lineas: lineas.map((l) => ({
            producto_id: l.productoId,
            tipo: l.tipo,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precioUnitario,
          })),
          p_cita_id: citaIdEfectivo,
          p_consulta_id: consultaIdEfectivo,
          p_cuotas_totales: cuotasNum,
          p_registrado_por: usuario?.id || null,
        })
        .single()
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo generar la factura. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
      // Las líneas de producto ya descontaron su stock dentro de la propia
      // transacción (crear_factura_venta) — se refleja acá para que
      // Inventario/el resto de la sesión lo vean sin recargar.
      if (setInventario) {
        setInventario((prev) => prev.map((p) => {
          const linea = lineas.find((l) => l.tipo === "producto" && l.productoId === p.id)
          return linea ? { ...p, stock: Math.max(0, (Number(p.stock) || 0) - linea.cantidad) } : p
        }))
      }
      registrarLog(usuario, "pacientes", titulo === "Nueva venta" ? "Registró una venta" : "Generó una factura", `${paciente.nombre} · ${lineas.length} línea(s) · $${total.toFixed(2)}`)
      let estadoFinal = data.estado
      let avisoAbono = ""
      if (abonoNum > 0) {
        // El abono inicial se registra justo después de crear la venta (misma función que cualquier otro abono).
        const { data: ab, error: errorAbono } = await supabase.rpc("registrar_abono", { p_factura_id: data.id, p_monto: abonoNum, p_nota: "Abono inicial" }).single()
        if (errorAbono) {
          avisoAbono = "La venta se guardó, pero el abono inicial no se pudo registrar: regístralo desde el perfil del paciente."
        } else {
          estadoFinal = ab.estado
          const { data: filas } = await supabase.from("abonos_factura").select("*").eq("factura_id", data.id)
          ;(filas || []).forEach((f) => window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(f) })))
        }
      }
      const facturaGuardada = {
        id: data.id, pacienteId: paciente.id, citaId: citaIdEfectivo, consultaId: consultaIdEfectivo,
        metodoPago, cuotasTotales: cuotasNum, cuotasPagadas: 0, montoTotal: data.monto_total,
        estado: estadoFinal, creadoEn: data.created_at,
        lineas,
      }
      if (avisoAbono) window.dispatchEvent(new CustomEvent("aviso-global", { detail: avisoAbono }))
      onGuardado?.(facturaGuardada)
      if (incluyeLentes) {
        setGuardando(false)
        setOrdenPara(facturaGuardada)
        return
      }
    }

    setGuardando(false)
    onCerrar?.()
  }

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c)
  const refModal = useModalAccesible(true, onCerrar)

  // Venta guardada con lentes: sigue la orden de laboratorio (cerrarla o crearla después termina el flujo).
  if (ordenPara) {
    return (
      <OrdenLaboratorioModal
        paciente={paciente}
        facturaId={ordenPara.id}
        consultaId={ordenPara.consultaId}
        consulta={diagnostico}
        monturaInicial={ordenPara.lineas.find((l) => l.tipo === "producto")?.descripcion || ""}
        usuario={usuario}
        onCerrar={() => onCerrar?.()}
      />
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-labelledby="factura-modal-titulo" className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD_VENTA }}>
              <Receipt size={20} />
            </div>
            <div>
              <h2 id="factura-modal-titulo" className="text-lg font-bold" style={{ color: INK }}>{titulo}</h2>
              <p className="text-xs text-slate-500">{subtitulo}</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={confirmarFactura} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">

            <div className="relative">
              <label htmlFor="factura-paciente" className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente</label>
              {pacienteFijo ? (
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{pacienteFijo.nombre}</div>
              ) : pacienteSel ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-2.5">
                  <span className="truncate text-sm font-semibold text-emerald-800">{pacienteSel.nombre}</span>
                  <button type="button" onClick={() => { setPacienteSel(null); setBusquedaPaciente("") }} aria-label="Cambiar paciente" className="text-sm font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="factura-paciente"
                      type="text"
                      placeholder="Busca al paciente por nombre o cédula..."
                      value={busquedaPaciente}
                      onFocus={() => setMostrarDropdownPaciente(true)}
                      onChange={(e) => { setBusquedaPaciente(e.target.value); setMostrarDropdownPaciente(true) }}
                      className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                    />
                  </div>
                  {mostrarDropdownPaciente && pacientesFiltrados.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                      {pacientesFiltrados.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => { setPacienteSel(p); setMostrarDropdownPaciente(false); setError("") }} className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                            <span className="truncate">{p.nombre}</span>
                            {p.cedula && <span className="shrink-0 font-mono text-xs text-slate-500">{p.cedula}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mostrarDropdownPaciente && busquedaPaciente.trim() && pacientesFiltrados.length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-500">Ningún paciente coincide. Regístralo primero en Pacientes.</p>
                  )}
                </>
              )}
            </div>

            {vinculoSugerido && !consultaId && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                <input type="checkbox" checked={vincular} onChange={(e) => setVincular(e.target.checked)} className="mt-0.5 accent-emerald-600" />
                <span><span className="font-bold">{vinculoSugerido.etiqueta}</span><br />Si es esta venta, queda vinculada a la consulta y el paciente sale de la lista de espera. Desmárcalo si es otra compra.</span>
              </label>
            )}

            {diagnostico && (
              <section aria-label="Datos del diagnóstico" className="space-y-1.5 rounded-xl border border-blue-200/60 bg-blue-50/40 p-3 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700"><Stethoscope size={13} aria-hidden="true" /> Datos del diagnóstico · {fechaLegible(diagnostico.fecha)}</p>
                {diagnostico.motivo && <p className="text-slate-600"><span className="font-semibold text-slate-700">Motivo:</span> {diagnostico.motivo}</p>}
                {textoDiagnostico(diagnostico) && (
                  <p className="text-slate-600"><span className="font-semibold text-slate-700">Diagnóstico:</span> {textoDiagnostico(diagnostico)}</p>
                )}
                {diagnostico.lenteRecomendado && <p className="text-slate-600"><span className="font-semibold text-slate-700">Lente recomendado:</span> {diagnostico.lenteRecomendado}</p>}
                {diagnostico.indicaciones && <p className="text-slate-600"><span className="font-semibold text-slate-700">Indicaciones:</span> {diagnostico.indicaciones}</p>}
                <button type="button" onClick={() => setVerMedidas((v) => !v)} aria-expanded={verMedidas} className="flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">
                  <ChevronDown size={13} className={"transition-transform " + (verMedidas ? "rotate-180" : "")} aria-hidden="true" /> {verMedidas ? "Ocultar medidas" : "Ver medidas"}
                </button>
                {verMedidas && (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-white p-2 font-mono text-xs">
                    {[["OD", diagnostico.od], ["OI", diagnostico.oi]].map(([ojo, o]) => (
                      <p key={ojo}><span className="font-bold text-blue-700">{ojo}:</span> {o?.esfera || o?.cilindro || o?.eje ? `${o?.esfera || "—"} | ${o?.cilindro || "—"} | ${o?.eje || "—"}°` : "No registrada"}</p>
                    ))}
                  </div>
                )}
                {onProforma && (
                  <label className="flex cursor-pointer items-center gap-2 pt-0.5 text-xs text-slate-600">
                    <input type="checkbox" checked={incluirMedidas} onChange={(e) => setIncluirMedidas(e.target.checked)} className="accent-blue-600" />
                    Incluir las medidas en la proforma impresa
                  </label>
                )}
              </section>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Líneas</label>
              {lineas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-4 text-center text-xs text-slate-500">
                  Todavía no agregaste ninguna línea.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {lineas.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {l.tipo === "producto" ? (
                          <MiniaturaProducto url={inventario.find((p) => p.id === l.productoId)?.imagen_url} alt={l.descripcion} size={24} />
                        ) : (
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600">
                            <Wrench size={13} />
                          </span>
                        )}
                        <span className="truncate text-sm font-semibold text-slate-700">{l.descripcion}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {l.tipo === "servicio" ? (
                          <span className="flex items-center gap-1 font-mono text-xs text-slate-500">
                            {l.cantidad} × $
                            <input
                              type="number" min="0" step="0.01" inputMode="decimal"
                              aria-label={`Precio de ${l.descripcion}`}
                              value={l.precioTexto ?? String(l.precioUnitario)}
                              onChange={(e) => editarPrecioLinea(i, e.target.value)}
                              className="w-20 rounded-md border border-slate-300 px-1.5 py-1 text-right text-xs outline-none focus-visible:border-blue-500"
                            />
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-slate-500">{l.cantidad} × ${l.precioUnitario.toFixed(2)} = ${(l.cantidad * l.precioUnitario).toFixed(2)}</span>
                        )}
                        <button type="button" onClick={() => quitarLinea(i)} aria-label="Quitar línea" className="text-sm font-bold text-slate-400 hover:text-red-600 cursor-pointer">×</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {agregandoProducto ? (
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarProductoRapido(e) } }}>
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={cancelarAltaProducto} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
                    <ArrowLeft size={13} /> Volver a buscar
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-700">Producto nuevo</span>
                </div>
                <div className="space-y-3">
                  <CampoImagenProducto opticaId={opticaId} valor={npImagenUrl} onCambio={setNpImagenUrl} />
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Categoría</label>
                    <CampoCategoria valor={npCategoria} onChange={setNpCategoria} categorias={CATEGORIAS_NP} setCategorias={setCategorias} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Descripción del producto</label>
                    <input type="text" required value={npNombre} onChange={(e) => setNpNombre(e.target.value)} placeholder="Ej. Lentes Oakley Holbrook"
                      className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.nombre ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                    {erroresNp.nombre && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.nombre}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Stock inicial</label>
                      <input type="number" min="0" step="1" required value={npStock} onChange={(e) => setNpStock(e.target.value)}
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.stock ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                      {erroresNp.stock && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.stock}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Precio ($)</label>
                      <input type="number" min="0" step="0.01" required value={npPrecio} onChange={(e) => setNpPrecio(e.target.value)} placeholder="45.00"
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.precio ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                      {erroresNp.precio && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.precio}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Stock mínimo (alerta) <span className="normal-case text-slate-500">(opcional — por defecto {UMBRAL_STOCK_BAJO})</span></label>
                    <input type="number" min="0" step="1" value={npCritico} onChange={(e) => setNpCritico(e.target.value)} placeholder={String(UMBRAL_STOCK_BAJO)}
                      className="w-full rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Observación <span className="normal-case text-slate-500">(opcional)</span></label>
                    <input type="text" value={npObservacion} onChange={(e) => setNpObservacion(e.target.value)} placeholder="Ej. Color negro mate, incluye estuche."
                      className="w-full rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                  </div>
                  {erroresNp.general && (
                    <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                      <AlertTriangle size={14} /> {erroresNp.general}
                    </div>
                  )}
                  <button type="button" onClick={guardarProductoRapido} disabled={guardandoNp}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer" style={{ background: GRAD }}>
                    {guardandoNp ? "Guardando..." : "Guardar y usar en esta factura"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTipoLinea("producto")}
                    className="flex-1 rounded-xl border py-2 text-sm font-bold transition cursor-pointer"
                    style={tipoLinea === "producto" ? { background: GRAD, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                    Producto
                  </button>
                  <button type="button" onClick={() => setTipoLinea("servicio")}
                    className="flex-1 rounded-xl border py-2 text-sm font-bold transition cursor-pointer"
                    style={tipoLinea === "servicio" ? { backgroundColor: VIOLETA, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                    Servicio
                  </button>
                </div>

                {tipoLinea === "producto" ? (
                  <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                    {productoSeleccionado ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <MiniaturaProducto url={productoSeleccionado.imagen_url} alt={productoSeleccionado.nombre} size={22} />
                          <span className="truncate text-sm font-semibold text-emerald-800">{productoSeleccionado.nombre}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-emerald-700">{productoSeleccionado.stock} u. · ${Number(productoSeleccionado.precio).toFixed(2)}</span>
                          <button type="button" onClick={limpiarCamposProducto} className="text-sm font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text" placeholder="Buscar producto con stock..."
                          value={busquedaProducto}
                          onFocus={() => setMostrarDropdownProducto(true)}
                          onChange={(e) => { setBusquedaProducto(e.target.value); setMostrarDropdownProducto(true) }}
                          className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                        />
                        {mostrarDropdownProducto && productosFiltrados.length > 0 && (
                          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                            {productosFiltrados.map((p) => (
                              <li key={p.id} onClick={() => { setProductoId(p.id); setMostrarDropdownProducto(false) }} className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                                <span className="flex min-w-0 items-center gap-2">
                                  <MiniaturaProducto url={p.imagen_url} alt={p.nombre} size={24} />
                                  <span className="truncate">{p.nombre}</span>
                                </span>
                                <span className="shrink-0 font-mono text-xs text-slate-400">{p.stock} u. · ${Number(p.precio).toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {mostrarDropdownProducto && busquedaProducto && productosFiltrados.length === 0 && (
                          <p className="mt-1.5 text-xs text-slate-500">Ningún producto con stock coincide.</p>
                        )}
                        <button type="button" onClick={abrirAltaProducto} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          <Plus size={13} /> ¿No lo encuentras? Registrar producto nuevo
                        </button>
                      </div>
                    )}
                    {productoSeleccionado && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600">Cantidad</label>
                        <input type="number" min="1" max={productoSeleccionado.stock} value={cantidadProducto} onChange={(e) => setCantidadProducto(e.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                        <button type="button" onClick={agregarLineaProducto} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white cursor-pointer" style={{ background: INK }}>+ Agregar línea</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                    <input type="text" placeholder="Descripción del servicio (ej. Examen visual, ajuste, garantía...)" value={descServicio} onChange={(e) => setDescServicio(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">Cantidad</label>
                      <input type="number" min="1" value={cantidadServicio} onChange={(e) => setCantidadServicio(e.target.value)} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      <label className="text-xs font-semibold text-slate-600">Precio</label>
                      <input type="number" min="0" step="0.01" value={precioServicio} onChange={(e) => setPrecioServicio(e.target.value)} placeholder="0.00" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      <button type="button" onClick={agregarLineaServicio} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white cursor-pointer" style={{ background: INK }}>+ Agregar línea</button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-semibold text-slate-600">Total</span>
                  <span className="font-mono text-xl font-bold text-slate-800">${total.toFixed(2)}</span>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={incluyeLentes} onChange={(e) => setCrearOrden(e.target.checked)} className="mt-0.5 accent-blue-600" />
                  <span><span className="font-semibold">Esta venta incluye lentes</span><br /><span className="text-xs text-slate-500">Al guardarla se abre la orden de laboratorio, con la receta ya cargada.</span></span>
                </label>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Método de pago</label>
                  <div className="flex gap-2">
                    {[{ v: "directo", t: "Directo" }, { v: "tarjeta", t: "Tarjeta" }, { v: "cuotas", t: "Cuotas" }, { v: "abonos", t: "Abonos" }].map((m) => (
                      <button key={m.v} type="button" onClick={() => cambiarMetodoPago(m.v)}
                        className="flex-1 rounded-xl border py-2 text-sm font-semibold transition cursor-pointer"
                        style={metodoPago === m.v ? { background: GRAD_VENTA, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                        {m.t}
                      </button>
                    ))}
                  </div>
                </div>

                {metodoPago === "cuotas" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Número de cuotas</label>
                    <input type="number" min="1" step="1" value={cuotasTotales} onChange={(e) => setCuotasTotales(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                  </div>
                )}

                {metodoPago === "abonos" && (
                  <div>
                    <label htmlFor="abono-inicial" className="mb-1.5 block text-sm font-semibold text-slate-700">Abono inicial (opcional)</label>
                    <input id="abono-inicial" type="number" min="0" step="0.01" max={total} value={abonoInicial} onChange={(e) => setAbonoInicial(e.target.value)} placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                    <p className="mt-1 text-xs text-slate-500">El resto queda como saldo y se cobra con abonos de monto y fecha libres.</p>
                  </div>
                )}

                {error && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={14} /> {error}
                  </div>
                )}
              </>
            )}
          </div>

          {!agregandoProducto && (
            <div className="space-y-3 border-t border-slate-100 p-6 pt-4">
              {(onProforma || onNoCompro) && (
                <div className="flex items-center justify-between gap-3">
                  {onProforma ? (
                    <button type="button" onClick={imprimirProforma} className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                      <Printer size={14} aria-hidden="true" /> Imprimir proforma
                    </button>
                  ) : <span />}
                  {onNoCompro && (
                    <button type="button" onClick={onNoCompro} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-red-700 cursor-pointer">
                      <UserX size={14} aria-hidden="true" /> No compró
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-3">
              <button type="button" onClick={onMasTarde || onCerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
                {onMasTarde ? "Más tarde" : "Cancelar"}
              </button>
              <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
                style={{ background: GRAD_VENTA, boxShadow: "0 12px 24px -12px rgba(5,150,105,0.5)" }}>
                {guardando ? "Guardando..." : etiquetaGuardar}
              </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  )
}
