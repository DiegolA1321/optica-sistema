"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { esDeEsteMes } from "../utilidades/inicio"
import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  Package,
  Search,
  AlertTriangle,
  CheckCircle,
  Boxes,
  DollarSign,
  Plus,
  Archive,
  ClipboardCheck,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react"
import { esStockBajo, UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { valorInventario, CATEGORIA_MONTURA, etiquetaMovimiento } from "../utilidades/inventarioKardex"
import { tieneVentasDeProducto } from "../utilidades/ventas"
import { mapProducto } from "../utilidades/mapProducto"
import { registrarLog } from "../utilidades/logs"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { supabase } from "../lib/supabaseClient"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import { Cascaron } from "../componentes/AtencionPaciente"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import TarjetaInventario from "../componentes/inventario/TarjetaInventario"
import FormularioProducto from "../componentes/inventario/FormularioProducto"
import MovimientoModal from "../componentes/inventario/MovimientoModal"
import DetalleProducto from "../componentes/inventario/DetalleProducto"
import ConteoFisico from "../componentes/inventario/ConteoFisico"
import VentanaResumen from "../componentes/inventario/VentanaResumen"
import { puede } from "../utilidades/permisosUi"
import { INK, GRAD_MARCA } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const CATEGORIAS_FALLBACK = [CATEGORIA_MONTURA, "Accesorios"]
const COLOR_CAT = {
  [CATEGORIA_MONTURA]: { fg: "#2563EB", bg: "#eff6ff" },
  Accesorios: { fg: "#7c3aed", bg: "#f5f3ff" },
}
const catColor = (c) => COLOR_CAT[c] || { fg: "#475569", bg: "#f1f5f9" }

// El mensaje de un error de una función de la base: lo que ella misma explica ("No hay tantas unidades…") se muestra tal cual; lo demás, genérico.
const mensajeDeError = (error, generico) => {
  if (esErrorSinPermiso(error)) return MENSAJE_SIN_PERMISO
  if (error?.code === "P0001" && error.message) return error.message
  return generico
}

export default function Inventario({
  usuario,
  umbralStock = UMBRAL_STOCK_BAJO,
  cargaInicial = false,
  inventario: productos = [],
  setInventario: setProductos,
  categorias = [],
  setCategorias,
  pacientes = [],
  ventas = [],
  facturasVenta = [],
  abrirModalAlEntrar = false,
  onModalAlEntrarConsumido,
  overlaySolo = false,
  onOverlayCerrado,
  onAviso,
  productoIdParaReabastecer = null,
  onProductoParaReabastecerConsumido,
  verStockBajoAlEntrar = false,
  verNuevosAlEntrar = false,
  avisosDelModulo = null,
  onVerNuevosConsumido,
  onVerStockBajoConsumido,
  onVerPerfil,
}) {
  const opticaId = usuario?.opticaId
  const puedeNivel = (nivel) => puede(usuario, "inventario", nivel)
  // Catálogo de categorías editable desde Configuración.
  const CATEGORIAS = categorias.length > 0 ? categorias : CATEGORIAS_FALLBACK
  const [busqueda, setBusqueda] = useState("")
  // Modo compacto opcional — ver más filas sin scroll cuando el catálogo crece. Persiste por navegador (preferencia visual).
  const [compacto, setCompacto] = useState(() => { try { return localStorage.getItem("optica_inventario_compacto") === "1" } catch { return false } })
  const alternarCompacto = () => setCompacto((v) => { try { localStorage.setItem("optica_inventario_compacto", !v ? "1" : "0") } catch {} return !v })
  const celdaY = compacto ? "py-1.5" : "py-3"
  const [guardadoExitoso, setGuardadoExitoso] = useState("")
  // Toda acción confirma con el aviso flotante del sistema; sin él (pruebas) se muestra en la página.
  const avisar = (mensaje) => {
    if (onAviso) { onAviso(mensaje); return }
    setGuardadoExitoso(mensaje)
    setTimeout(() => setGuardadoExitoso(""), 3000)
  }

  const [filtroCategoria, setFiltroCategoria] = useState("Todas")
  const [soloBajo, setSoloBajo] = useState(false)
  const [soloNuevos, setSoloNuevos] = useState(false) // altas de este mes (el "+N este mes" de Inicio)
  // Descontinuados (activo: false) ocultos por defecto: no estorban el día a día, pero siguen encontrables, reactivables y con su historial intacto.
  const [verDescontinuados, setVerDescontinuados] = useState(false)

  // Las ventanas. Un producto se abre por su id para que siempre muestre lo último.
  const [detalleId, setDetalleId] = useState(null)
  const [pestanaDetalle, setPestanaDetalle] = useState("resumen")
  const [formulario, setFormulario] = useState(null) // null | "crear" | producto (editar)
  const [movimiento, setMovimiento] = useState(null) // null | { modo: "ingreso" | "ajuste", productoId }
  const [conteo, setConteo] = useState(false)
  const [resumenAbierto, setResumenAbierto] = useState(null) // null | "unidades" | "valor"
  const [porDescontinuar, setPorDescontinuar] = useState(null)
  const [descontinuando, setDescontinuando] = useState(false)
  const [errorDescontinuar, setErrorDescontinuar] = useState("")
  const [versionMovimientos, setVersionMovimientos] = useState(0)
  const [detalleReaparece, setDetalleReaparece] = useState(false)

  const detalle = detalleId == null ? null : productos.find((p) => p.id === detalleId) || null
  const hayVentanaSobreElDetalle = !!(formulario || movimiento || porDescontinuar)
  const abrirDetalle = (p, pestana = "resumen") => { setPestanaDetalle(pestana); setDetalleReaparece(false); setDetalleId(p.id) }
  const cerrarDetalle = () => { setDetalleId(null); setDetalleReaparece(false) }
  // Una ventana abierta desde el detalle lo reemplaza mientras dura y el detalle vuelve al cerrarla.
  const abrirSobreDetalle = (abrir) => { if (detalle) setDetalleReaparece(true); abrir() }

  // Acceso directo desde "Agregar producto" en Inicio: abre el formulario sin pasar primero por la tabla completa.
  useEffect(() => {
    if (abrirModalAlEntrar) {
      setFormulario("crear")
      onModalAlEntrarConsumido?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirModalAlEntrar])

  // Abierto sobre Inicio: al cerrarse el formulario se avisa para desmontar esta vista oculta.
  const abrioSobreInicio = useRef(false)
  useEffect(() => {
    if (!overlaySolo) return
    if (formulario) abrioSobreInicio.current = true
    else if (abrioSobreInicio.current) onOverlayCerrado?.()
  }, [formulario]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Reabastecer" desde la alerta de stock bajo en Inicio: salta directo a registrar el ingreso de ESE producto (nunca hacer buscar dos veces lo ya señalado).
  useEffect(() => {
    if (!productoIdParaReabastecer) return
    const prod = productos.find((p) => p.id === productoIdParaReabastecer)
    if (prod && puedeNivel("editar")) setMovimiento({ modo: "ingreso", productoId: prod.id })
    onProductoParaReabastecerConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoIdParaReabastecer])

  // Desde "Ver todo" del bloque Inventario del Inicio: la lista ya acotada al stock bajo.
  useEffect(() => {
    if (!verStockBajoAlEntrar) return
    setSoloBajo(true); setSoloNuevos(false); setFiltroCategoria("Todas"); setVerDescontinuados(false)
    onVerStockBajoConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verStockBajoAlEntrar])

  // Desde "Nuevos este mes" de la tarjeta Productos del Inicio: la lista ya acotada a las altas de este mes.
  useEffect(() => {
    if (!verNuevosAlEntrar) return
    setSoloNuevos(true); setSoloBajo(false); setFiltroCategoria("Todas"); setVerDescontinuados(false)
    onVerNuevosConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verNuevosAlEntrar])

  // ─── Datos y acciones ───
  // Cada una devuelve null si salió bien o el mensaje de error para mostrarlo en su ventana.
  const hayBase = !!(supabase && opticaId)

  const crearProducto = async (cambios) => {
    let nuevo = { ...cambios, id: null, creadoEn: null }
    if (hayBase) {
      const { data, error } = await supabase.from("inventario").insert({ ...cambios, optica_id: opticaId }).select().single()
      if (error) return mensajeDeError(error, "No se pudo registrar el producto. Revisa tu conexión e intenta de nuevo.")
      nuevo = mapProducto(data)
    } else {
      nuevo = { ...mapProducto({ ...cambios, id: Date.now(), created_at: new Date().toISOString() }), stock: cambios.stock }
    }
    setProductos([nuevo, ...productos])
    registrarLog(usuario, "inventario", "Agregó un producto al inventario", nuevo.nombre)
    avisar("Producto añadido al inventario.")
    setFormulario(null)
    return null
  }

  const editarProducto = async (producto, cambios) => {
    if (hayBase) {
      const { data: actualizados, error } = await supabase.from("inventario").update(cambios).eq("id", producto.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizados })) return MENSAJE_SIN_PERMISO
      if (error) return mensajeDeError(error, "No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.")
    }
    setProductos(productos.map((p) => (p.id === producto.id ? { ...p, ...mapProducto({ ...p, ...cambios, created_at: p.creadoEn }), stock: p.stock } : p)))
    registrarLog(usuario, "inventario", "Editó un producto del inventario", cambios.nombre)
    avisar("Cambios guardados correctamente.")
    setFormulario(null)
    return null
  }

  // Ingreso, merma, devolución o ajuste: pasan por la función de la base, que valida, deja el movimiento (con motivo y quién) y devuelve la existencia.
  const registrarMovimiento = async (producto, { tipo, cambio, motivo }) => {
    let nuevoStock
    if (hayBase) {
      const { data, error } = await supabase.rpc("registrar_movimiento_inventario", { p_producto_id: producto.id, p_tipo: tipo, p_cantidad: cambio, p_motivo: motivo })
      if (error) return mensajeDeError(error, "No se pudo registrar el movimiento. Revisa tu conexión e intenta de nuevo.")
      nuevoStock = Number(data)
    } else {
      nuevoStock = (Number(producto.stock) || 0) + cambio
    }
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, stock: nuevoStock } : p)))
    setVersionMovimientos((v) => v + 1)
    registrarLog(usuario, "inventario", `${etiquetaMovimiento(tipo)}: ${cambio > 0 ? "+" : "−"}${Math.abs(cambio)} u.`, producto.nombre)
    avisar(`${etiquetaMovimiento(tipo)} registrado: ${producto.nombre} queda con ${nuevoStock} u.`)
    setMovimiento(null)
    return null
  }

  const confirmarConteo = async (conteos) => {
    let resultados
    if (hayBase) {
      const { data, error } = await supabase.rpc("registrar_conteo_inventario", { p_conteos: conteos })
      if (error) return mensajeDeError(error, "No se pudo registrar el conteo. Revisa tu conexión e intenta de nuevo.")
      resultados = (data || []).map((r) => ({ id: r.producto_id, despues: Number(r.despues) }))
    } else {
      resultados = conteos.map((c) => ({ id: c.producto_id, despues: c.contado }))
    }
    const nuevos = new Map(resultados.map((r) => [r.id, r.despues]))
    setProductos((prev) => prev.map((p) => (nuevos.has(p.id) ? { ...p, stock: nuevos.get(p.id) } : p)))
    setVersionMovimientos((v) => v + 1)
    registrarLog(usuario, "inventario", "Registró un conteo físico", `${resultados.length} ajuste${resultados.length === 1 ? "" : "s"}`)
    avisar(`Conteo físico registrado: ${resultados.length} ajuste${resultados.length === 1 ? "" : "s"}.`)
    setConteo(false)
    return null
  }

  // Un producto no se elimina nunca: se descontinúa (deja de poder venderse) y conserva su historial; se puede reactivar.
  const cambiarActivo = async (producto, activo) => {
    if (hayBase) {
      const { data: actualizados, error } = await supabase.from("inventario").update({ activo }).eq("id", producto.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizados })) return MENSAJE_SIN_PERMISO
      if (error) return mensajeDeError(error, activo ? "No se pudo reactivar el producto. Revisa tu conexión e intenta de nuevo." : "No se pudo descontinuar el producto. Revisa tu conexión e intenta de nuevo.")
    }
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo } : p)))
    registrarLog(usuario, "inventario", activo ? "Reactivó un producto del inventario" : "Descontinuó un producto del inventario", producto.nombre)
    avisar(activo ? `"${producto.nombre}" reactivado: ya puede volver a venderse.` : `"${producto.nombre}" descontinuado: conserva su historial y puedes reactivarlo.`)
    return null
  }
  const confirmarDescontinuar = async () => {
    setDescontinuando(true)
    const error = await cambiarActivo(porDescontinuar, false)
    setDescontinuando(false)
    if (error) { setErrorDescontinuar(error); return }
    setPorDescontinuar(null)
    setErrorDescontinuar("")
    if (verDescontinuados === false) cerrarDetalle()
  }

  // ─── Lo que se ve ───
  const activos = useMemo(() => productos.filter((p) => p.activo !== false), [productos])
  const descontinuados = useMemo(() => productos.filter((p) => p.activo === false), [productos])
  const coincideTexto = (p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return [p.nombre, p.categoria, p.codigo, p.marca, p.modelo, p.color].some((v) => (v || "").toLowerCase().includes(q))
  }
  // Los números de los filtros cuentan lo mismo que listan: siguen a la búsqueda (regla 5).
  const base = verDescontinuados ? descontinuados : activos
  const buscados = useMemo(() => activos.filter(coincideTexto), [activos, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuentaCategoria = (c) => buscados.filter((p) => c === "Todas" || p.categoria === c).length
  const cuentaNuevos = buscados.filter((p) => esDeEsteMes(p.creadoEn)).length
  const cuentaDescontinuados = descontinuados.filter(coincideTexto).length

  const productosFiltrados = base.filter((p) =>
    coincideTexto(p) && (filtroCategoria === "Todas" || p.categoria === filtroCategoria) && (!soloBajo || esStockBajo(p, umbralStock)) && (!soloNuevos || esDeEsteMes(p.creadoEn)))

  // Orden de la tabla — mismo patrón orden/cambiarOrden/IconoOrden que CRM y Pacientes.
  const [orden, setOrden] = useState({ campo: null, dir: "asc" })
  const cambiarOrden = (campo) => setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }))
  const IconoOrden = ({ campo }) => {
    if (orden.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" aria-hidden="true" />
    return orden.dir === "asc" ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />
  }
  const ariaOrden = (campo) => (orden.campo === campo ? (orden.dir === "asc" ? "ascending" : "descending") : "none")
  const productosOrdenados = !orden.campo ? productosFiltrados : [...productosFiltrados].sort((a, b) => {
    let cmp
    if (orden.campo === "nombre" || orden.campo === "categoria") cmp = (a[orden.campo] || "").localeCompare(b[orden.campo] || "", "es")
    else cmp = (Number(a[orden.campo]) || 0) - (Number(b[orden.campo]) || 0)
    return orden.dir === "asc" ? cmp : -cmp
  })

  // Corte de rango — mismo criterio que Pacientes.jsx.
  const [cantidadVisible, setCantidadVisible] = useState(25)
  useEffect(() => { setCantidadVisible(25) }, [busqueda, filtroCategoria, soloBajo, soloNuevos, verDescontinuados])
  const productosVisibles = productosOrdenados.slice(0, cantidadVisible)
  const maxStockVisible = Math.max(1, ...productosVisibles.map((p) => Number(p.stock) || 0))

  // Resumen de arriba: siempre sobre los productos activos, que son los de la tabla.
  const resumen = useMemo(() => {
    const unidades = activos.reduce((a, p) => a + (Number(p.stock) || 0), 0)
    return { total: activos.length, unidades, valor: valorInventario(activos), bajos: activos.filter((p) => esStockBajo(p, umbralStock)).length, nuevos: activos.filter((p) => esDeEsteMes(p.creadoEn)).length }
  }, [activos, umbralStock])
  const verCosto = puedeNivel("editar")
  const valorConCosto = verCosto && resumen.valor.hayCosto

  const limpiarFiltros = () => { setBusqueda(""); setFiltroCategoria("Todas"); setSoloBajo(false); setSoloNuevos(false); setVerDescontinuados(false) }
  const hayFiltro = !!(busqueda || filtroCategoria !== "Todas" || soloBajo || soloNuevos || verDescontinuados)
  const elegirCategoria = (c) => { setFiltroCategoria(c); setSoloBajo(false); setSoloNuevos(false); setVerDescontinuados(false) }
  const alternarNuevos = () => { const nuevo = !soloNuevos; setSoloNuevos(nuevo); if (nuevo) { setFiltroCategoria("Todas"); setSoloBajo(false); setVerDescontinuados(false) } }
  const alternarBajo = () => { const nuevo = !soloBajo; setBusqueda(""); setSoloBajo(nuevo); if (nuevo) { setFiltroCategoria("Todas"); setSoloNuevos(false); setVerDescontinuados(false) } }
  const alternarDescontinuados = () => { const nuevo = !verDescontinuados; setVerDescontinuados(nuevo); if (nuevo) { setFiltroCategoria("Todas"); setSoloBajo(false); setSoloNuevos(false) } }
  const verCategoriaDesdeResumen = (c) => { setResumenAbierto(null); setBusqueda(""); elegirCategoria(c) }

  const pill = (activo) => "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")
  const estiloPill = (activo) => (activo ? { background: GRAD_MARCA } : undefined)
  const ventasDe = (id) => tieneVentasDeProducto(ventas, facturasVenta, id)

  return (
    <div className={"w-full space-y-6 text-left" + (overlaySolo ? " hidden" : "")} style={{ animation: "rise-in 320ms ease-out both" }}>
      {/* ─── CABECERA ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Package size={24} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Inventario</h1>
            <p className="text-sm text-slate-500">Existencias de monturas y accesorios. Las lunas se escriben en la venta.</p>
          </div>
        </div>

        <AccionesDeCabecera avisos={avisosDelModulo}>
          {puedeNivel("editar") && (
            <button type="button" onClick={() => setConteo(true)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">
              <ClipboardCheck size={18} aria-hidden="true" /> Conteo físico
            </button>
          )}
          {puedeNivel("crear") && (
            <button type="button" onClick={() => setFormulario("crear")} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Plus size={18} aria-hidden="true" /> Agregar producto
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      {guardadoExitoso && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle className="shrink-0 text-emerald-500" size={20} aria-hidden="true" />
          <p className="text-sm font-semibold">{guardadoExitoso}</p>
        </div>
      )}

      {/* ─── RESUMEN: cuatro tarjetas iguales; cada una filtra la tabla o abre su detalle en la ventana estándar ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaInventario icono={Package} titulo="Productos" valor={resumen.total} sub={resumen.total > 0 ? `+${resumen.nuevos} este mes` : "Todavía no hay productos"} onClick={limpiarFiltros}
          ayuda="Los productos activos (monturas y accesorios). Un clic muestra todos en la tabla; los descontinuados no cuentan." />
        <TarjetaInventario icono={Boxes} titulo="Unidades en stock" valor={resumen.unidades} sub="Ver por categoría" onClick={() => setResumenAbierto("unidades")}
          ayuda="La suma de la existencia de los productos activos. Un clic la desglosa por categoría." />
        <TarjetaInventario icono={DollarSign} titulo="Valor del inventario" valor={dinero(resumen.valor.aPrecio)}
          sub={valorConCosto ? `a precio de venta · ${dinero(resumen.valor.aCosto)} a costo` : "a precio de venta"} onClick={() => setResumenAbierto("valor")}
          ayuda={"A precio de venta: existencia × precio de cada producto activo." + (verCosto ? " Con el costo registrado también se muestra a costo (existencia × costo) y la ganancia posible." : "")} />
        <TarjetaInventario icono={AlertTriangle} titulo="Stock bajo" valor={resumen.bajos} sub={resumen.bajos > 0 ? "Conviene reabastecerlos" : "Todo con existencia"} alerta={resumen.bajos > 0} activa={soloBajo} onClick={alternarBajo}
          ayuda="Productos activos con existencia igual o menor a su mínimo. Un clic filtra la tabla." />
      </div>

      {/* ─── TABLA ─── */}
      <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Package size={16} aria-hidden="true" /></span>
            {verDescontinuados ? "Productos descontinuados" : "Stock disponible"}
          </h2>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true" />
              <input type="text" aria-label="Buscar producto" placeholder="Buscar producto, código o marca…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
            </div>
            <button type="button" onClick={alternarCompacto} title={compacto ? "Vista normal" : "Vista compacta"} aria-pressed={compacto}
              className={"flex shrink-0 items-center rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer " + (compacto ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200/60 text-slate-500 hover:bg-slate-50")}>
              <Boxes size={16} aria-hidden="true" /> <span className="ml-1.5 hidden sm:inline">{compacto ? "Vista normal" : "Vista compacta"}</span>
            </button>
          </div>
        </div>

        {/* Filtros: todos con su número (siguen a la búsqueda) */}
        {(resumen.total > 0 || descontinuados.length > 0) && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
            {["Todas", ...CATEGORIAS].map((c) => {
              const activo = filtroCategoria === c && !soloBajo && !soloNuevos && !verDescontinuados
              return (
                <button key={c} type="button" aria-pressed={activo} onClick={() => elegirCategoria(c)} className={pill(activo)} style={estiloPill(activo)}>
                  {c} ({cuentaCategoria(c)})
                </button>
              )
            })}
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <button type="button" onClick={alternarNuevos} aria-pressed={soloNuevos} className={pill(soloNuevos)} style={estiloPill(soloNuevos)} title="Productos dados de alta este mes">
              Nuevos este mes ({cuentaNuevos})
            </button>
            {descontinuados.length > 0 && (
              <button type="button" onClick={alternarDescontinuados} aria-pressed={verDescontinuados} className={pill(verDescontinuados)} style={estiloPill(verDescontinuados)} title="Conservan su historial; no aparecen para vender">
                <Archive size={12} aria-hidden="true" /> Descontinuados ({cuentaDescontinuados})
              </button>
            )}
            {hayFiltro && <button type="button" onClick={limpiarFiltros} className="rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">Limpiar</button>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Productos del inventario. Pulsa un producto para ver su detalle.</caption>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                {[["nombre", "Producto"], ["categoria", "Categoría"], ["stock", "Existencia"], ["precio", "Precio"]].map(([campo, titulo]) => (
                  <th key={campo} scope="col" aria-sort={ariaOrden(campo)} className={"px-4 " + celdaY}>
                    <button type="button" onClick={() => cambiarOrden(campo)} className="flex cursor-pointer select-none items-center gap-1 font-bold uppercase tracking-wide">{titulo} <IconoOrden campo={campo} /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {cargaInicial && productos.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={"skeleton-" + i}>
                    <td colSpan={4} className="px-4 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-200/70" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
                          <div className="h-2.5 w-1/6 animate-pulse rounded bg-slate-200/60" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Package size={22} aria-hidden="true" /></div>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {productos.length === 0 ? "No hay productos en el inventario." : hayFiltro ? "Ningún producto coincide con el filtro." : "No hay productos activos."}
                    </p>
                    {productos.length === 0 && puedeNivel("crear") && (
                      <button type="button" onClick={() => setFormulario("crear")} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Agregar el primero</button>
                    )}
                    {productos.length > 0 && hayFiltro && (
                      <button type="button" onClick={limpiarFiltros} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Limpiar los filtros</button>
                    )}
                  </td>
                </tr>
              ) : (
                productosVisibles.map((prod) => {
                  const col = catColor(prod.categoria)
                  const bajo = prod.activo !== false && esStockBajo(prod, umbralStock)
                  const sub = [prod.marca, prod.modelo, prod.color].filter(Boolean).join(" · ")
                  return (
                    <tr key={prod.id} onClick={() => abrirDetalle(prod)} className="cursor-pointer transition-colors hover:bg-slate-50/70">
                      <td className={"px-4 " + celdaY}>
                        <div className="flex items-center gap-2.5">
                          <MiniaturaProducto url={prod.imagen_url} alt="" size={compacto ? 24 : 32} />
                          <div className="min-w-0">
                            <button type="button" onClick={(e) => { e.stopPropagation(); abrirDetalle(prod) }} aria-label={`Ver el detalle de ${prod.nombre}`} className="block max-w-[28rem] truncate text-left font-bold text-slate-800 hover:text-blue-700 cursor-pointer">{prod.nombre}</button>
                            {!compacto && sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
                          </div>
                          {prod.activo === false && <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Descontinuado</span>}
                        </div>
                      </td>
                      <td className={"px-4 " + celdaY}>
                        <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: col.bg, color: col.fg }}>{prod.categoria}</span>
                      </td>
                      <td className={"px-4 " + celdaY}>
                        <div className="flex items-center gap-2">
                          <span className={"font-mono font-bold " + (bajo ? "text-amber-600" : "text-slate-800")}>{prod.stock} u.</span>
                          {bajo && <AlertTriangle size={14} className="text-amber-500" aria-label="Stock bajo" />}
                        </div>
                        {!compacto && (
                          <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.round(((Number(prod.stock) || 0) / maxStockVisible) * 100))}%`, background: bajo ? "#D97706" : GRAD }} />
                          </div>
                        )}
                      </td>
                      <td className={"px-4 font-mono font-bold text-slate-600 " + celdaY}>{dinero(Number(prod.precio))}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {productosFiltrados.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>Mostrando {productosVisibles.length} de {productosFiltrados.length}</span>
            {cantidadVisible < productosFiltrados.length && (
              <button type="button" onClick={() => setCantidadVisible((v) => v + 25)} className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Mostrar 25 más</button>
            )}
          </div>
        )}
      </div>

      {/* ─── VENTANAS ─── */}
      {detalle && !hayVentanaSobreElDetalle && (
        <DetalleProducto
          producto={detalle} umbralStock={umbralStock} usuarioPuede={puedeNivel} ventas={ventas} facturasVenta={facturasVenta} pacientes={pacientes}
          versionMovimientos={versionMovimientos} pestana={pestanaDetalle} onPestana={setPestanaDetalle} sinAnimarFondo={detalleReaparece}
          onIngreso={() => abrirSobreDetalle(() => setMovimiento({ modo: "ingreso", productoId: detalle.id }))}
          onAjustar={() => abrirSobreDetalle(() => setMovimiento({ modo: "ajuste", productoId: detalle.id }))}
          onEditar={() => abrirSobreDetalle(() => setFormulario(detalle))}
          onDescontinuar={() => abrirSobreDetalle(() => { setErrorDescontinuar(""); setPorDescontinuar(detalle) })}
          onReactivar={() => cambiarActivo(detalle, true)}
          onVerPerfil={onVerPerfil} onCerrar={cerrarDetalle}
        />
      )}

      {formulario && (
        <FormularioProducto
          producto={formulario === "crear" ? null : formulario} categorias={CATEGORIAS} setCategorias={setCategorias} umbralStock={umbralStock} opticaId={opticaId} productos={productos}
          puedeVerCosto={verCosto} sinAnimarFondo={!!detalle}
          onGuardar={(cambios) => (formulario === "crear" ? crearProducto(cambios) : editarProducto(formulario, cambios))}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {movimiento && productos.find((p) => p.id === movimiento.productoId) && (
        <MovimientoModal
          modo={movimiento.modo} producto={productos.find((p) => p.id === movimiento.productoId)} sinAnimarFondo={!!detalle}
          onRegistrar={(datos) => registrarMovimiento(productos.find((p) => p.id === movimiento.productoId), datos)}
          onCerrar={() => setMovimiento(null)}
        />
      )}

      {conteo && <ConteoFisico productos={activos} categorias={CATEGORIAS} onConfirmar={confirmarConteo} onCerrar={() => setConteo(false)} />}

      {resumenAbierto && (
        <VentanaResumen modo={resumenAbierto} productos={activos} categorias={CATEGORIAS} verCosto={verCosto} onVerCategoria={verCategoriaDesdeResumen} onCerrar={() => setResumenAbierto(null)} />
      )}

      {porDescontinuar && (
        <Cascaron
          titulo="Descontinuar producto" subtitulo={porDescontinuar.nombre} Icono={Archive} ancho="max-w-md" sinAnimarFondo={!!detalle}
          onCerrar={() => !descontinuando && setPorDescontinuar(null)}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={descontinuando} onClick={() => { setPorDescontinuar(null); setErrorDescontinuar("") }} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={descontinuando} onClick={confirmarDescontinuar} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 cursor-pointer disabled:opacity-50">{descontinuando ? "Descontinuando…" : "Descontinuar"}</button>
            </div>
          </>}
        >
          <div className="space-y-3 p-6">
            <p className="text-sm text-slate-600">
              {ventasDe(porDescontinuar.id)
                ? "Este producto tiene ventas registradas. Descontinuarlo no pierde ese historial: deja de poder elegirse en una venta nueva y puedes reactivarlo cuando quieras."
                : "El producto deja de poder elegirse en una venta nueva. Conserva su historial y puedes reactivarlo cuando quieras. Los productos no se eliminan."}
            </p>
            {(Number(porDescontinuar.stock) || 0) > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Todavía tiene {porDescontinuar.stock} unidad{Number(porDescontinuar.stock) === 1 ? "" : "es"}: dejarán de contarse en los totales del inventario. Si ya no están, regístralo antes con «Ajustar stock».</p>
            )}
            {errorDescontinuar && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {errorDescontinuar}</div>
            )}
          </div>
        </Cascaron>
      )}
    </div>
  )
}
