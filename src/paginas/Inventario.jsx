"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { esDeEsteMes } from "../utilidades/inicio"
import React, { useState, useMemo, useEffect, useRef } from "react"
import { Package, Plus, Archive, AlertTriangle, ChevronUp, ChevronDown, ArrowUpDown, Printer, Undo2 } from "lucide-react"
import { UMBRAL_STOCK_BAJO, UMBRAL_STOCK_MAXIMO, estadoDeStock, minimoDe, maximoDe, proporcionDeStock } from "../utilidades/inventario"
import { valorInventario, CATEGORIA_MONTURA, etiquetaMovimiento, monturasSinVender } from "../utilidades/inventarioKardex"
import { htmlHojaConteo } from "../utilidades/conteoImpresion"
import { imprimirHtml } from "../utilidades/proforma"
import { ahoraEcuador } from "../utilidades/horaEcuador"
import { fechaAISO } from "../utilidades/disponibilidad"
import { tieneVentasDeProducto } from "../utilidades/ventas"
import { mapProducto } from "../utilidades/mapProducto"
import { registrarLog } from "../utilidades/logs"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { supabase } from "../lib/supabaseClient"
import AccionesDeCabecera from "../componentes/AccionesDeCabecera"
import { Cascaron } from "../componentes/AtencionPaciente"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import FormularioProducto from "../componentes/inventario/FormularioProducto"
import MovimientoModal from "../componentes/inventario/MovimientoModal"
import DetalleProducto from "../componentes/inventario/DetalleProducto"
import VentanaResumen from "../componentes/inventario/VentanaResumen"
import { Insignia, Vacio } from "../componentes/ventas/Lista"
import { FiltroActivo, FranjaDatos, Pestanas, Pildoras, CampoBusqueda } from "../componentes/ventas/Piezas"
import { CLASE_ACCION_SECUNDARIA } from "../componentes/ventas/estilos"
import { puede } from "../utilidades/permisosUi"
import { INK, GRAD_MARCA } from "@/lib/tema"

const CATEGORIAS_FALLBACK = [CATEGORIA_MONTURA, "Accesorios"]
// La barrita de la existencia: rojo = por debajo de su mínimo, ámbar = por encima de su máximo, verde = en orden (el color solo comunica estado, regla 14).
const COLOR_BARRA = { bajo: "#DC2626", sobre: "#B45309", normal: "#16A34A" }
const COLUMNAS = "lg:grid-cols-[minmax(0,2fr)_minmax(6rem,0.8fr)_minmax(12rem,2fr)_5.5rem_minmax(7.5rem,0.9fr)_1rem]"

// El mensaje de un error de una función de la base: lo que ella misma explica ("No hay tantas unidades…") se muestra tal cual; lo demás, genérico.
const mensajeDeError = (error, generico) => {
  if (esErrorSinPermiso(error)) return MENSAJE_SIN_PERMISO
  if (error?.code === "P0001" && error.message) return error.message
  return generico
}

// Inventario: las existencias de monturas y accesorios. Dos pestañas, «Activos» y «Descontinuados» (cada descontinuado se puede reactivar); arriba, la franja de datos (productos activos, valor, stock bajo,
// sobrestock y sin vender en 90 días), cuyos datos filtran la lista; cada producto con su existencia, su mínimo, su máximo y una barrita de color. El mínimo y el máximo son los generales de Configuración → Inventario
// o los propios del producto; el máximo no limita nada: solo avisa.
export default function Inventario({
  usuario,
  umbralStock = UMBRAL_STOCK_BAJO,
  maximoStock = UMBRAL_STOCK_MAXIMO,
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
  verSobrestockAlEntrar = false,
  verNuevosAlEntrar = false,
  avisosDelModulo = null,
  onVerNuevosConsumido,
  onVerStockBajoConsumido,
  onVerSobrestockConsumido,
  onVerPerfil,
}) {
  const opticaId = usuario?.opticaId
  const puedeNivel = (nivel) => puede(usuario, "inventario", nivel)
  const veVentas = puede(usuario, "ventas", "ver") // lo vendido es de Ventas: sin ese permiso no hay «Sin vender» ni pestaña Ventas en el producto
  // Catálogo de categorías editable desde Configuración.
  const CATEGORIAS = categorias.length > 0 ? categorias : CATEGORIAS_FALLBACK
  const [busqueda, setBusqueda] = useState("")
  const [guardadoExitoso, setGuardadoExitoso] = useState("")
  // Toda acción confirma con el aviso flotante del sistema; sin él (pruebas) se muestra en la página.
  const avisar = (mensaje) => {
    if (onAviso) { onAviso(mensaje); return }
    setGuardadoExitoso(mensaje)
    setTimeout(() => setGuardadoExitoso(""), 3000)
  }

  // La pestaña (activos o descontinuados) y el filtro de la lista: «todos», una categoría («cat:Monturas»), «bajo», «sobre», «sinvender» o «nuevos» (las altas de este mes: el «+N este mes» del Inicio).
  const [pestana, setPestana] = useState("activos")
  const [filtro, setFiltro] = useState("todos")

  // Las ventanas. Un producto se abre por su id para que siempre muestre lo último.
  const [detalleId, setDetalleId] = useState(null)
  const [pestanaDetalle, setPestanaDetalle] = useState("resumen")
  const [formulario, setFormulario] = useState(null) // null | "crear" | producto (editar)
  const [movimiento, setMovimiento] = useState(null) // null | { modo: "ingreso" | "ajuste", productoId }
  const [resumenAbierto, setResumenAbierto] = useState(null) // null | "valor"
  const [porDescontinuar, setPorDescontinuar] = useState(null)
  const [descontinuando, setDescontinuando] = useState(false)
  const [errorDescontinuar, setErrorDescontinuar] = useState("")
  const [versionMovimientos, setVersionMovimientos] = useState(0)
  const [detalleReaparece, setDetalleReaparece] = useState(false)

  const detalle = detalleId == null ? null : productos.find((p) => p.id === detalleId) || null
  const hayVentanaSobreElDetalle = !!(formulario || movimiento || porDescontinuar)
  const abrirDetalle = (p, pest = "resumen") => { setPestanaDetalle(pest); setDetalleReaparece(false); setDetalleId(p.id) }
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
    setPestana("activos"); setFiltro("bajo")
    onVerStockBajoConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verStockBajoAlEntrar])

  // Desde el aviso de sobrestock del Inicio: la lista ya acotada a los productos que pasan de su máximo.
  useEffect(() => {
    if (!verSobrestockAlEntrar) return
    setPestana("activos"); setFiltro("sobre")
    onVerSobrestockConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verSobrestockAlEntrar])

  // Desde "Nuevos este mes" de la tarjeta Productos del Inicio: la lista ya acotada a las altas de este mes.
  useEffect(() => {
    if (!verNuevosAlEntrar) return
    setPestana("activos"); setFiltro("nuevos")
    onVerNuevosConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verNuevosAlEntrar])

  // ─── Datos y acciones ───
  // Cada una devuelve null si salió bien o el mensaje de error para mostrarlo en su ventana.
  const hayBase = !!(supabase && opticaId)

  const crearProducto = async (cambios) => {
    const { costo = null, ...fila } = cambios
    let nuevo
    let avisoCosto = ""
    if (hayBase) {
      const { data, error } = await supabase.from("inventario").insert({ ...fila, optica_id: opticaId }).select().single()
      if (error) return mensajeDeError(error, "No se pudo registrar el producto. Revisa tu conexión e intenta de nuevo.")
      nuevo = mapProducto({ ...data, costo })
      if (costo !== null) {
        const { error: errorCosto } = await supabase.from("inventario_costos").insert({ producto_id: data.id, optica_id: opticaId, costo })
        if (errorCosto) { nuevo = { ...nuevo, costo: null }; avisoCosto = " Pero no se pudo guardar el costo: edítalo e inténtalo de nuevo." }
      }
    } else {
      nuevo = { ...mapProducto({ ...fila, costo, id: Date.now(), created_at: new Date().toISOString() }), stock: cambios.stock }
    }
    setProductos([nuevo, ...productos])
    registrarLog(usuario, "inventario", "Agregó un producto al inventario", nuevo.nombre)
    avisar("Producto añadido al inventario." + avisoCosto)
    setFormulario(null)
    return null
  }

  const editarProducto = async (producto, cambios) => {
    const { costo, ...fila } = cambios
    if (hayBase) {
      const { data: actualizados, error } = await supabase.from("inventario").update(fila).eq("id", producto.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizados })) return MENSAJE_SIN_PERMISO
      if (error) return mensajeDeError(error, "No se pudieron guardar los cambios. Revisa tu conexión e intenta de nuevo.")
      // El costo vive aparte y solo lo escribe quien puede editar: vacío lo quita.
      if (costo !== undefined) {
        const { error: errorCosto } = costo === null
          ? await supabase.from("inventario_costos").delete().eq("producto_id", producto.id)
          : await supabase.from("inventario_costos").upsert({ producto_id: producto.id, optica_id: opticaId, costo, updated_at: new Date().toISOString() })
        if (errorCosto) return mensajeDeError(errorCosto, "Se guardaron los cambios, pero no el costo. Revisa tu conexión e intenta de nuevo.")
      }
    }
    setProductos(productos.map((p) => (p.id === producto.id ? { ...p, ...mapProducto({ ...p, stock_maximo: p.maximo, ...fila, costo: costo === undefined ? p.costo : costo, created_at: p.creadoEn }), stock: p.stock } : p)))
    registrarLog(usuario, "inventario", "Editó un producto del inventario", cambios.nombre)
    avisar("Cambios guardados correctamente.")
    setFormulario(null)
    return null
  }

  // Ingreso, merma, devolución o ajuste: pasan por la función de la base, que valida, deja el movimiento (con motivo y quién) y devuelve la existencia.
  // Un ingreso con costo por unidad deja ese costo como el del producto (quien puede editar).
  const registrarMovimiento = async (producto, { tipo, cambio, motivo, costo }) => {
    let nuevoStock
    if (hayBase) {
      const { data, error } = await supabase.rpc("registrar_movimiento_inventario", { p_producto_id: producto.id, p_tipo: tipo, p_cantidad: cambio, p_motivo: motivo })
      if (error) return mensajeDeError(error, "No se pudo registrar el movimiento. Revisa tu conexión e intenta de nuevo.")
      nuevoStock = Number(data)
    } else {
      nuevoStock = (Number(producto.stock) || 0) + cambio
    }
    let costoNuevo = producto.costo
    let avisoCosto = ""
    if (costo !== undefined) {
      if (hayBase) {
        const { error: errorCosto } = await supabase.from("inventario_costos").upsert({ producto_id: producto.id, optica_id: opticaId, costo, updated_at: new Date().toISOString() })
        if (errorCosto) avisoCosto = " Pero no se pudo guardar el costo: edítalo en el producto."
        else costoNuevo = costo
      } else costoNuevo = costo
    }
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, stock: nuevoStock, costo: costoNuevo } : p)))
    setVersionMovimientos((v) => v + 1)
    registrarLog(usuario, "inventario", `${etiquetaMovimiento(tipo)}: ${cambio > 0 ? "+" : "−"}${Math.abs(cambio)} u.`, producto.nombre)
    avisar(`${etiquetaMovimiento(tipo)} registrado: ${producto.nombre} queda con ${nuevoStock} u.${costoNuevo !== producto.costo ? " Costo actualizado." : ""}${avisoCosto}`)
    setMovimiento(null)
    return null
  }

  // La hoja para contar en el estante: todos los productos activos con su existencia en el sistema y una columna en blanco para lo contado. Las diferencias se corrigen con «Ajustar stock».
  const imprimirHojaConteo = () => {
    imprimirHtml(htmlHojaConteo({ opticaNombre: usuario?.opticaNombre || "", productos: productos.filter((p) => p.activo !== false), fecha: ahoraEcuador() }))
    registrarLog(usuario, "inventario", "Imprimió la hoja de conteo", `${productos.filter((p) => p.activo !== false).length} productos`)
    avisar("Hoja de conteo lista para imprimir.")
  }

  // Un producto no se elimina nunca: se descontinúa (deja de poder venderse) y conserva su historial; se puede reactivar.
  const cambiarActivo = async (producto, activo) => {
    if (hayBase) {
      const { data: actualizados, error } = await supabase.from("inventario").update({ activo }).eq("id", producto.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizados })) return MENSAJE_SIN_PERMISO
      if (error) return mensajeDeError(error, activo ? "No se pudo reactivar el producto. Revisa tu conexión e intenta de nuevo." : "No se pudo descontinuar el producto. Revisa tu conexión e intenta de nuevo.")
    }
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo } : p)))
    // Al reactivar el último descontinuado, la pestaña «Descontinuados» queda vacía: la lista vuelve sola a los activos (si no, quedaba vacía y sin forma de salir).
    if (activo && !productos.some((p) => p.activo === false && p.id !== producto.id)) setPestana("activos")
    registrarLog(usuario, "inventario", activo ? "Reactivó un producto del inventario" : "Descontinuó un producto del inventario", producto.nombre)
    avisar(activo ? `"${producto.nombre}" reactivado: ya puede volver a venderse.` : `"${producto.nombre}" descontinuado: conserva su historial y puedes reactivarlo.`)
    return null
  }
  // «Reactivarlo» desde el aviso de «Agregar producto»: reactiva el que ya existía y cierra el formulario.
  const reactivarDesdeFormulario = async (producto) => {
    const error = await cambiarActivo(producto, true)
    if (error) return
    setFormulario(null)
  }
  const confirmarDescontinuar = async () => {
    setDescontinuando(true)
    const error = await cambiarActivo(porDescontinuar, false)
    setDescontinuando(false)
    if (error) { setErrorDescontinuar(error); return }
    setPorDescontinuar(null)
    setErrorDescontinuar("")
    if (pestana === "activos") cerrarDetalle()
  }

  // ─── Lo que se ve ───
  const activos = useMemo(() => productos.filter((p) => p.activo !== false), [productos])
  const descontinuados = useMemo(() => productos.filter((p) => p.activo === false), [productos])
  const coincideTexto = (p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return [p.nombre, p.categoria, p.codigo, p.marca, p.modelo, p.color].some((v) => (v || "").toLowerCase().includes(q))
  }
  const estadoDe = (p) => estadoDeStock(p, umbralStock, maximoStock)

  // La franja de arriba, siempre sobre los productos activos (los de la lista).
  const resumen = useMemo(() => {
    const unidades = activos.reduce((a, p) => a + (Number(p.stock) || 0), 0)
    return {
      total: activos.length, unidades, valor: valorInventario(activos),
      bajos: activos.filter((p) => estadoDeStock(p, umbralStock, maximoStock) === "bajo").length,
      sobre: activos.filter((p) => estadoDeStock(p, umbralStock, maximoStock) === "sobre").length,
    }
  }, [activos, umbralStock, maximoStock])
  const verCosto = puedeNivel("editar")
  const valorConCosto = verCosto && resumen.valor.hayCosto
  // Monturas con existencia que llevan 90 días o más sin venderse, y lo que representan en dinero (a hoy).
  const sinVender = useMemo(() => monturasSinVender({ productos: activos, facturas: facturasVenta, movimientos: [], fechaISO: fechaAISO(ahoraEcuador()) }), [activos, facturasVenta])
  const idsSinVender = useMemo(() => new Set(sinVender.map((f) => f.producto.id)), [sinVender])
  const dineroParado = sinVender.reduce((t, f) => t + f.valor, 0)

  const base = pestana === "descontinuados" ? descontinuados : activos
  const cumpleFiltro = (p) => {
    if (pestana === "descontinuados" || filtro === "todos") return true
    if (filtro.startsWith("cat:")) return p.categoria === filtro.slice(4)
    if (filtro === "bajo") return estadoDe(p) === "bajo"
    if (filtro === "sobre") return estadoDe(p) === "sobre"
    if (filtro === "sinvender") return idsSinVender.has(p.id)
    if (filtro === "nuevos") return esDeEsteMes(p.creadoEn)
    return true
  }
  const productosFiltrados = base.filter((p) => coincideTexto(p) && cumpleFiltro(p))

  // Orden de la tabla: por la columna que se pulse (el de siempre, sin pulsar, es el más nuevo primero).
  const [orden, setOrden] = useState({ campo: null, dir: "asc" })
  const cambiarOrden = (campo) => setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }))
  const productosOrdenados = !orden.campo ? productosFiltrados : [...productosFiltrados].sort((a, b) => {
    let cmp
    if (orden.campo === "nombre" || orden.campo === "categoria") cmp = (a[orden.campo] || "").localeCompare(b[orden.campo] || "", "es")
    else cmp = (Number(a[orden.campo]) || 0) - (Number(b[orden.campo]) || 0)
    return orden.dir === "asc" ? cmp : -cmp
  })

  // Corte de rango — mismo criterio que Pacientes.jsx.
  const [cantidadVisible, setCantidadVisible] = useState(25)
  useEffect(() => { setCantidadVisible(25) }, [busqueda, filtro, pestana])
  const productosVisibles = productosOrdenados.slice(0, cantidadVisible)

  const hayFiltro = filtro !== "todos" || busqueda.trim() !== ""
  const limpiarFiltros = () => { setBusqueda(""); setFiltro("todos") }
  const elegirFiltro = (id) => setFiltro((actual) => (actual === id ? "todos" : id))
  const cambiarPestana = (id) => { setPestana(id); setFiltro("todos") }
  const ventasDe = (id) => tieneVentasDeProducto(ventas, facturasVenta, id)

  const datos = [
    { id: "activos", etiqueta: "Productos activos", valor: String(resumen.total), sub: `${resumen.unidades} ${resumen.unidades === 1 ? "unidad" : "unidades"}`, activo: filtro === "todos", onClick: () => setFiltro("todos"), ayuda: "Los productos activos (monturas y accesorios). Pulsa para ver todos." },
    { id: "valor", etiqueta: "Valor del inventario", valor: dinero(resumen.valor.aPrecio), sub: valorConCosto ? `a precio de venta · ${dinero(resumen.valor.aCosto)} a costo` : "a precio de venta", onClick: () => setResumenAbierto("valor"), ayuda: "Existencia × precio de cada producto activo. Pulsa para ver el desglose." },
    { id: "bajo", etiqueta: "Stock bajo", punto: "rojo", valor: String(resumen.bajos), sub: "bajo su mínimo", activo: filtro === "bajo", onClick: () => elegirFiltro("bajo"), ayuda: "Productos con su mínimo o menos. Pulsa para ver solo esos." },
    { id: "sobre", etiqueta: "Sobrestock", punto: "ambar", valor: String(resumen.sobre), sub: "sobre su máximo", activo: filtro === "sobre", onClick: () => elegirFiltro("sobre"), ayuda: "Productos con más unidades que su máximo (solo avisa, no limita). Pulsa para ver solo esos." },
    ...(veVentas ? [{ id: "sinvender", etiqueta: "Sin vender en 90 días", valor: String(sinVender.length), sub: sinVender.length > 0 ? `${dinero(dineroParado)} parados` : resumen.total === 0 ? "sin productos todavía" : "todo se está moviendo", activo: filtro === "sinvender", onClick: () => elegirFiltro("sinvender"), ayuda: "Monturas activas con existencia que no se venden desde hace 90 días o más, o que nunca se vendieron (las registradas hace menos de 90 días no cuentan). Pulsa para ver solo esas." }] : []),
  ]
  const opcionesPildoras = [{ id: "todos", etiqueta: "Todos" }, ...CATEGORIAS.map((c) => ({ id: `cat:${c}`, etiqueta: c })), { id: "bajo", etiqueta: "Stock bajo" }, { id: "sobre", etiqueta: "Sobrestock" }]
  const pildoraDe = opcionesPildoras.some((o) => o.id === filtro) ? filtro : null
  const TEXTO_FILTRO = { sinvender: "Sin vender en 90 días", nuevos: "Nuevos este mes" }
  const encabezado = [["nombre", "Producto"], ["categoria", "Categoría"], ["stock", "Existencia"], ["precio", "Precio", true], [null, "Estado"], [null, ""]]
  const IconoOrden = ({ campo }) => (orden.campo !== campo ? <ArrowUpDown size={11} className="text-slate-300" aria-hidden="true" /> : orden.dir === "asc" ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />)
  const ariaOrden = (campo) => (orden.campo === campo ? (orden.dir === "asc" ? "ascending" : "descending") : "none")

  return (
    <div className={"w-full space-y-5 text-left" + (overlaySolo ? " hidden" : "")} style={{ animation: "rise-in 320ms ease-out both" }}>
      {/* ─── CABECERA ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD_MARCA, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Package size={24} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Inventario</h1>
        </div>

        <AccionesDeCabecera avisos={avisosDelModulo}>
          {puedeNivel("editar") && resumen.total > 0 && (
            <button type="button" onClick={imprimirHojaConteo} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">
              <Printer size={17} aria-hidden="true" /> Imprimir hoja de conteo
            </button>
          )}
          {puedeNivel("crear") && (
            <button type="button" onClick={() => setFormulario("crear")} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer" style={{ background: GRAD_MARCA, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
              <Plus size={18} aria-hidden="true" /> Agregar producto
            </button>
          )}
        </AccionesDeCabecera>
      </div>

      {guardadoExitoso && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm font-semibold">{guardadoExitoso}</p>
        </div>
      )}

      <Pestanas etiqueta="Secciones del inventario" idBase="inventario" activa={pestana} onCambiar={cambiarPestana}
        pestanas={[{ id: "activos", titulo: "Activos", cuenta: activos.length }, { id: "descontinuados", titulo: "Descontinuados", cuenta: descontinuados.length }]} />

      <div id="inventario-panel" role="tabpanel" aria-labelledby={`inventario-tab-${pestana}`} className="space-y-3">
        {/* ─── FRANJA DE DATOS: cada dato filtra la lista o abre su desglose ─── */}
        {pestana === "activos" && <FranjaDatos etiqueta="Resumen del inventario" datos={datos} />}

        {/* ─── FILTROS Y BÚSQUEDA ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pestana === "activos" ? <Pildoras etiqueta="Filtrar el inventario" opciones={opcionesPildoras} valor={pildoraDe} onCambiar={(id) => setFiltro(id)} /> : <span />}
          <CampoBusqueda id="inventario-busqueda" valor={busqueda} onCambio={setBusqueda} placeholder="Buscar producto o código" className="max-w-sm" />
        </div>
        {pestana === "activos" && TEXTO_FILTRO[filtro] && <FiltroActivo texto={TEXTO_FILTRO[filtro]} onQuitar={() => setFiltro("todos")} />}

        {/* ─── LISTA ─── */}
        {cargaInicial && productos.length === 0 ? (
          <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm" aria-label="Cargando el inventario">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={"skeleton-" + i} className="flex items-center gap-4 py-2">
                <div className="flex-1 space-y-1.5"><div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" /><div className="h-2.5 w-1/6 animate-pulse rounded bg-slate-200/60" /></div>
              </div>
            ))}
          </div>
        ) : productosFiltrados.length === 0 ? (
          productos.length === 0 ? (
            <Vacio Icono={Package} titulo="No hay productos en el inventario" texto="Agrega tus monturas y accesorios con su existencia y su precio.">
              {puedeNivel("crear") && <button type="button" onClick={() => setFormulario("crear")} className={CLASE_ACCION_SECUNDARIA}>Agregar el primero</button>}
            </Vacio>
          ) : hayFiltro ? (
            <Vacio Icono={Package} titulo="Ningún producto coincide con el filtro">
              <button type="button" onClick={limpiarFiltros} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
            </Vacio>
          ) : pestana === "descontinuados" ? (
            <Vacio Icono={Archive} titulo="No hay productos descontinuados" texto="Un producto que ya no vendes se descontinúa desde su detalle: deja de ofrecerse, conserva su historial y puedes reactivarlo." />
          ) : (
            <Vacio Icono={Package} titulo="No hay productos activos" texto="Los productos descontinuados están en su pestaña: desde ahí se pueden reactivar." />
          )
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div aria-hidden="true" className={"hidden gap-x-4 border-b border-slate-200/70 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 lg:grid " + COLUMNAS}>
              {encabezado.map(([campo, titulo, derecha], i) => (
                campo
                  ? <button key={i} type="button" tabIndex={-1} onClick={() => cambiarOrden(campo)} aria-sort={ariaOrden(campo)} className={"flex cursor-pointer select-none items-center gap-1 font-bold uppercase tracking-wider " + (derecha ? "justify-end" : "")}>{titulo} <IconoOrden campo={campo} /></button>
                  : <span key={i}>{titulo}</span>
              ))}
            </div>
            <ul role="list" aria-label={pestana === "activos" ? "Productos activos" : "Productos descontinuados"} data-lista="Productos del inventario" className="divide-y divide-slate-200/70">
              {productosVisibles.map((prod) => {
                const estado = pestana === "activos" ? estadoDe(prod) : "normal"
                const stock = Number(prod.stock) || 0
                return (
                  <li key={prod.id} data-fila className="relative px-5 py-3.5 transition-colors hover:bg-slate-50/70 lg:py-3">
                    <div className={"grid grid-cols-1 gap-x-4 gap-y-1.5 lg:items-center " + COLUMNAS}>
                      <button type="button" onClick={() => abrirDetalle(prod)} aria-label={`Ver el detalle de ${prod.nombre}`} className="absolute inset-0 cursor-pointer" />
                      <div className="flex min-w-0 items-center gap-2.5">
                        {prod.imagen_url && <MiniaturaProducto url={prod.imagen_url} alt="" size={32} />}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: INK }} title={prod.nombre}>{prod.nombre}</p>
                          {(prod.codigo || [prod.marca, prod.modelo, prod.color].some(Boolean)) && <p className="truncate font-mono text-xs text-slate-500">{prod.codigo || [prod.marca, prod.modelo, prod.color].filter(Boolean).join(" · ")}</p>}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700">{prod.categoria}</p>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-500"><span className="font-bold text-slate-900">{stock} u.</span> mín {minimoDe(prod, umbralStock)} · máx {maximoDe(prod, maximoStock)}</p>
                        {pestana === "activos" && (
                          <div className="mt-1 h-1.5 w-full max-w-[19rem] overflow-hidden rounded-full bg-slate-200/80" aria-hidden="true">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(stock > 0 ? 4 : 0, Math.round(proporcionDeStock(prod, maximoStock) * 100))}%`, background: COLOR_BARRA[estado] }} />
                          </div>
                        )}
                      </div>
                      <p data-col="monto" className="font-mono text-sm text-slate-800 lg:text-right">{dinero(Number(prod.precio))}</p>
                      <div data-col="estado" className="relative z-10 min-w-0">
                        {pestana === "descontinuados"
                          ? (puedeNivel("editar") ? <button type="button" onClick={() => cambiarActivo(prod, true)} aria-label={`Reactivar ${prod.nombre}`} className={CLASE_ACCION_SECUNDARIA}><Undo2 size={14} aria-hidden="true" /> Reactivar</button> : <Insignia tono="gris">Descontinuado</Insignia>)
                          : estado === "bajo" ? <Insignia tono="rojo">Stock bajo</Insignia>
                          : estado === "sobre" ? <Insignia tono="ambar">Sobrestock</Insignia> : null}
                      </div>
                      <span className="hidden text-slate-400 lg:block" aria-hidden="true">›</span>
                    </div>
                  </li>
                )
              })}
            </ul>
            {productosFiltrados.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200/70 px-5 py-3 text-xs text-slate-500">
                <span>Mostrando {productosVisibles.length} de {productosFiltrados.length}</span>
                {cantidadVisible < productosFiltrados.length && (
                  <button type="button" onClick={() => setCantidadVisible((v) => v + 25)} className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Mostrar 25 más</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── VENTANAS ─── */}
      {detalle && !hayVentanaSobreElDetalle && (
        <DetalleProducto
          producto={detalle} umbralStock={umbralStock} maximoStock={maximoStock} usuarioPuede={puedeNivel} veVentas={veVentas} ventas={ventas} facturasVenta={facturasVenta} pacientes={pacientes}
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
          producto={formulario === "crear" ? null : formulario} categorias={CATEGORIAS} setCategorias={setCategorias} umbralStock={umbralStock} maximoStock={maximoStock} opticaId={opticaId} productos={productos}
          puedeVerCosto={verCosto} sinAnimarFondo={!!detalle} onReactivar={puedeNivel("editar") ? reactivarDesdeFormulario : null}
          onGuardar={(cambios) => (formulario === "crear" ? crearProducto(cambios) : editarProducto(formulario, cambios))}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {movimiento && productos.find((p) => p.id === movimiento.productoId) && (
        <MovimientoModal
          modo={movimiento.modo} producto={productos.find((p) => p.id === movimiento.productoId)} maximo={maximoDe(productos.find((p) => p.id === movimiento.productoId), maximoStock)} puedeVerCosto={verCosto} sinAnimarFondo={!!detalle}
          onRegistrar={(datos) => registrarMovimiento(productos.find((p) => p.id === movimiento.productoId), datos)}
          onCerrar={() => setMovimiento(null)}
        />
      )}

      {resumenAbierto && (
        <VentanaResumen modo={resumenAbierto} productos={activos} descontinuados={descontinuados} categorias={CATEGORIAS} sinVender={sinVender} verCosto={verCosto}
          onVer={({ categoria }) => { setResumenAbierto(null); setBusqueda(""); if (categoria) setFiltro(`cat:${categoria}`) }} onVerProducto={(p) => { setResumenAbierto(null); abrirDetalle(p) }} onCerrar={() => setResumenAbierto(null)} />
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
