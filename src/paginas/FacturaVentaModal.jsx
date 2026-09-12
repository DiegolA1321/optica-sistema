"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Receipt, Search, X, AlertTriangle, Plus, ArrowLeft, Wrench } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { registrarLog } from "../utilidades/logs"
import { UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import CampoCategoria from "../componentes/CampoCategoria"
import CampoImagenProducto from "../componentes/CampoImagenProducto"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con VentaProductoModal.jsx) ───
const GRAD_VENTA = "linear-gradient(135deg,#34d399,#059669)" // verde: acción de venta/dinero
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul, tipo "producto"
const VIOLETA = "#7c3aed" // tipo "servicio"

// Punto 06 del Diagnóstico Maestro: factura con líneas múltiples (producto
// y/o servicio) y un solo método de pago para el total — a diferencia de
// VentaProductoModal.jsx (un producto = una venta), que sigue existiendo
// tal cual para la venta simple (decisión de Diego: no se toca).
// Un servicio (examen, ajuste, garantía) no tiene producto_id y no
// descuenta inventario — ver crear_factura_venta (migración 0072).
export default function FacturaVentaModal({
  usuario,
  inventario = [],
  setInventario,
  categorias = [],
  setCategorias,
  pacienteFijo,
  // Precarga una línea al abrir (ej. el lente que el optómetra ya vinculó
  // en la ficha clínica) — "listo para cobrar en un solo paso" en vez de
  // obligar a volver a buscar el mismo producto que ya se eligió antes.
  // Si el producto ya no existe o se quedó sin stock, se ignora en
  // silencio y el modal abre vacío, como siempre.
  lineaInicial,
  // Encadena la factura a la consulta/cita de origen — mismos parámetros
  // que ya usa ConsultaMedica.jsx al crear la factura desde su propio
  // editor embebido (ver crear_factura_venta, migración 0072).
  consultaId = null,
  citaId = null,
  onGuardado,
  onCerrar,
}) {
  const opticaId = usuario?.opticaId

  const [lineas, setLineas] = useState(() => {
    if (!lineaInicial?.productoId) return []
    const p = inventario.find((x) => x.id === lineaInicial.productoId)
    if (!p || (Number(p.stock) || 0) <= 0) return []
    const cant = Math.min(Math.max(1, lineaInicial.cantidad || 1), Number(p.stock) || 1)
    return [{ tipo: "producto", productoId: p.id, descripcion: p.nombre, cantidad: cant, precioUnitario: Number(p.precio) || 0 }]
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
  // con el ing ya resuelto en VentaProductoModal.jsx, reutilizado tal cual.
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

  const [metodoPago, setMetodoPago] = useState("directo")
  const [cuotasTotales, setCuotasTotales] = useState("3")
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

  const confirmarFactura = async (e) => {
    e.preventDefault()
    if (lineas.length === 0) { setError("Agrega al menos una línea antes de guardar."); return }
    const cuotasNum = metodoPago === "cuotas" ? parseInt(cuotasTotales, 10) : null
    if (metodoPago === "cuotas" && (!cuotasNum || cuotasNum < 1)) { setError("Ingresa un número de cuotas válido."); return }

    setGuardando(true)
    setError("")

    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase
        .rpc("crear_factura_venta", {
          p_optica_id: opticaId,
          p_paciente_id: pacienteFijo.id,
          p_metodo_pago: metodoPago,
          p_lineas: lineas.map((l) => ({
            producto_id: l.productoId,
            tipo: l.tipo,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precioUnitario,
          })),
          p_cita_id: citaId,
          p_consulta_id: consultaId,
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
      registrarLog(usuario, "pacientes", "Generó una factura", `${pacienteFijo.nombre} · ${lineas.length} línea(s) · $${total.toFixed(2)}`)
      onGuardado?.({
        id: data.id, pacienteId: pacienteFijo.id, citaId, consultaId,
        metodoPago, cuotasTotales: cuotasNum, cuotasPagadas: 0, montoTotal: data.monto_total,
        estado: data.estado, creadoEn: data.created_at,
        lineas,
      })
    }

    setGuardando(false)
    onCerrar?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD_VENTA }}>
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>Nueva factura</h2>
              <p className="text-xs text-slate-500">Varios productos/servicios, un solo pago.</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={confirmarFactura} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{pacienteFijo?.nombre}</div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Líneas</label>
              {lineas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-4 text-center text-xs text-slate-500">
                  Todavía no agregaste ninguna línea.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {lineas.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
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
                        <span className="font-mono text-xs text-slate-500">{l.cantidad} × ${l.precioUnitario.toFixed(2)} = ${(l.cantidad * l.precioUnitario).toFixed(2)}</span>
                        <button type="button" onClick={() => quitarLinea(i)} aria-label="Quitar línea" className="text-sm font-bold text-slate-400 hover:text-red-600 cursor-pointer">×</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {agregandoProducto ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarProductoRapido(e) } }}>
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
                      className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 " + (erroresNp.nombre ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                    {erroresNp.nombre && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.nombre}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Stock inicial</label>
                      <input type="number" min="0" step="1" required value={npStock} onChange={(e) => setNpStock(e.target.value)}
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 " + (erroresNp.stock ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                      {erroresNp.stock && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.stock}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Precio ($)</label>
                      <input type="number" min="0" step="0.01" required value={npPrecio} onChange={(e) => setNpPrecio(e.target.value)} placeholder="45.00"
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 " + (erroresNp.precio ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                      {erroresNp.precio && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresNp.precio}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Stock mínimo (alerta) <span className="normal-case text-slate-500">(opcional — por defecto {UMBRAL_STOCK_BAJO})</span></label>
                    <input type="number" min="0" step="1" value={npCritico} onChange={(e) => setNpCritico(e.target.value)} placeholder={String(UMBRAL_STOCK_BAJO)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Observación <span className="normal-case text-slate-500">(opcional)</span></label>
                    <input type="text" value={npObservacion} onChange={(e) => setNpObservacion(e.target.value)} placeholder="Ej. Color negro mate, incluye estuche."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
                  </div>
                  {erroresNp.general && (
                    <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
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
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
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
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                        />
                        {mostrarDropdownProducto && productosFiltrados.length > 0 && (
                          <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
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
                  <span className="text-sm font-semibold text-slate-600">Total factura</span>
                  <span className="font-mono text-xl font-bold text-slate-800">${total.toFixed(2)}</span>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Método de pago</label>
                  <div className="flex gap-2">
                    {[{ v: "directo", t: "Directo" }, { v: "tarjeta", t: "Tarjeta" }, { v: "cuotas", t: "Cuotas" }].map((m) => (
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
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" />
                  </div>
                )}

                {error && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={14} /> {error}
                  </div>
                )}
              </>
            )}
          </div>

          {!agregandoProducto && (
            <div className="flex gap-3 border-t border-slate-100 p-6 pt-4">
              <button type="button" onClick={onCerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
                style={{ background: GRAD_VENTA, boxShadow: "0 12px 24px -12px rgba(5,150,105,0.5)" }}>
                {guardando ? "Guardando..." : "Guardar factura"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  )
}
