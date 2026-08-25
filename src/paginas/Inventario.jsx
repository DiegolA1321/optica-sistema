"use client"

import React, { useState, useMemo } from "react"
import {
  Package,
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Boxes,
  DollarSign,
  X,
  Plus,
  Pencil,
} from "lucide-react"
import { esStockBajo } from "../utilidades/inventario"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const CATEGORIAS = ["Armazones", "Accesorios"]
const COLOR_CAT = {
  Armazones: { fg: "#2563EB", bg: "#eff6ff" },
  Accesorios: { fg: "#7c3aed", bg: "#f5f3ff" },
}
const catColor = (c) => COLOR_CAT[c] || { fg: "#475569", bg: "#f1f5f9" }

export default function Inventario({ inventario: productos = [], setInventario: setProductos }) {
  const [busqueda, setBusqueda] = useState("")
  const [nombre, setNombre] = useState("")
  const [categoria, setCategoria] = useState("Armazones")
  const [stock, setStock] = useState("")
  const [precio, setPrecio] = useState("")
  const [observacion, setObservacion] = useState("")
  const [guardadoExitoso, setGuardadoExitoso] = useState("")

  const [filtroCategoria, setFiltroCategoria] = useState("Todas")
  const [soloBajo, setSoloBajo] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [erroresForm, setErroresForm] = useState({})
  const [modalAbierto, setModalAbierto] = useState(false)

  // Reabastecer stock de un producto ya existente (evita crear duplicados)
  const [reabastecer, setReabastecer] = useState(null)
  const [cantidadReabastecer, setCantidadReabastecer] = useState("")
  const [errorReabastecer, setErrorReabastecer] = useState("")

  // Editar producto existente (nombre, categoría, stock, precio pueden variar)
  const [editando, setEditando] = useState(null)
  const [edNombre, setEdNombre] = useState("")
  const [edCategoria, setEdCategoria] = useState("Armazones")
  const [edStock, setEdStock] = useState("")
  const [edPrecio, setEdPrecio] = useState("")
  const [edObservacion, setEdObservacion] = useState("")
  const [erroresEdicion, setErroresEdicion] = useState({})

  const limpiarFormulario = () => {
    setNombre("")
    setCategoria("Armazones")
    setStock("")
    setPrecio("")
    setObservacion("")
    setErroresForm({})
  }

  const abrirModal = () => { limpiarFormulario(); setModalAbierto(true) }
  const cerrarModal = () => { setModalAbierto(false); limpiarFormulario() }

  const registrarProducto = (e) => {
    e.preventDefault()
    const stockNum = parseInt(stock, 10)
    const precioNum = parseFloat(precio)
    const errs = {}
    if (!nombre.trim()) errs.nombre = "Escribe una descripción para el producto."
    if (stock === "" || isNaN(stockNum) || stockNum < 0) errs.stock = "Ingresa una cantidad válida (0 o más)."
    if (precio === "" || isNaN(precioNum) || precioNum < 0) errs.precio = "Ingresa un precio válido."
    const duplicado = productos.find((p) => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
    if (!errs.nombre && duplicado) {
      errs.nombre = `Ya existe "${duplicado.nombre}" en bodega (${duplicado.stock} u.). Usa el botón "+" de esa fila para sumar stock, en vez de crear un producto duplicado.`
    }
    setErroresForm(errs)
    if (Object.keys(errs).length > 0) return

    const nuevo = {
      id: Date.now(),
      nombre,
      categoria,
      stock: stockNum,
      precio: precioNum,
      observacion: observacion || "",
    }

    setProductos([nuevo, ...productos])
    setGuardadoExitoso("Producto añadido al inventario.")
    setTimeout(() => setGuardadoExitoso(""), 3000)

    setModalAbierto(false)
    limpiarFormulario()
  }

  const confirmarEliminar = () => {
    if (porEliminar == null) return
    setProductos(productos.filter((p) => p.id !== porEliminar))
    setPorEliminar(null)
  }

  const abrirReabastecer = (prod) => {
    setReabastecer(prod)
    setCantidadReabastecer("")
    setErrorReabastecer("")
  }

  const confirmarReabastecer = (e) => {
    e.preventDefault()
    const cantidad = parseInt(cantidadReabastecer, 10)
    if (!cantidadReabastecer || isNaN(cantidad) || cantidad <= 0) {
      setErrorReabastecer("Ingresa una cantidad válida (mayor a 0).")
      return
    }
    setProductos(productos.map((p) => (p.id === reabastecer.id ? { ...p, stock: (Number(p.stock) || 0) + cantidad } : p)))
    setReabastecer(null)
    setGuardadoExitoso("Stock actualizado correctamente.")
    setTimeout(() => setGuardadoExitoso(""), 3000)
  }

  const abrirEditar = (prod) => {
    setEditando(prod)
    setEdNombre(prod.nombre)
    setEdCategoria(prod.categoria)
    setEdStock(String(prod.stock))
    setEdPrecio(String(prod.precio))
    setEdObservacion(prod.observacion || "")
    setErroresEdicion({})
  }

  const cerrarEditar = () => { setEditando(null); setErroresEdicion({}) }

  const guardarEdicion = (e) => {
    e.preventDefault()
    const stockNum = parseInt(edStock, 10)
    const precioNum = parseFloat(edPrecio)
    const errs = {}
    if (!edNombre.trim()) errs.nombre = "Escribe una descripción para el producto."
    if (edStock === "" || isNaN(stockNum) || stockNum < 0) errs.stock = "Ingresa una cantidad válida (0 o más)."
    if (edPrecio === "" || isNaN(precioNum) || precioNum < 0) errs.precio = "Ingresa un precio válido."
    const duplicado = productos.find((p) => p.id !== editando.id && p.nombre.trim().toLowerCase() === edNombre.trim().toLowerCase())
    if (!errs.nombre && duplicado) {
      errs.nombre = `Ya existe "${duplicado.nombre}" en bodega. Usa un nombre distinto.`
    }
    setErroresEdicion(errs)
    if (Object.keys(errs).length > 0) return

    setProductos(productos.map((p) => (p.id === editando.id ? {
      ...p,
      nombre: edNombre,
      categoria: edCategoria,
      stock: stockNum,
      precio: precioNum,
      observacion: edObservacion || "",
    } : p)))
    setEditando(null)
    setGuardadoExitoso("Cambios guardados correctamente.")
    setTimeout(() => setGuardadoExitoso(""), 3000)
  }

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase()
    const coincideTexto = p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
    const coincideCat = filtroCategoria === "Todas" || p.categoria === filtroCategoria
    const coincideBajo = !soloBajo || esStockBajo(p)
    return coincideTexto && coincideCat && coincideBajo
  })

  // Resumen (derivado de los datos reales)
  const resumen = useMemo(() => {
    const unidades = productos.reduce((a, p) => a + (Number(p.stock) || 0), 0)
    const valor = productos.reduce((a, p) => a + (Number(p.stock) || 0) * (Number(p.precio) || 0), 0)
    const bajos = productos.filter(esStockBajo)
    return { total: productos.length, unidades, valor, bajos }
  }, [productos])

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Package size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Control de inventario y bodega</h1>
            <p className="text-sm text-slate-500">Gestión de existencias de armazones y accesorios ópticos.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={abrirModal}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <Plus size={18} />
          Agregar producto
        </button>
      </div>

      {/* ─── ÉXITO ─── */}
      {guardadoExitoso && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle className="shrink-0 text-emerald-500" size={20} />
          <p className="text-sm font-semibold">{guardadoExitoso}</p>
        </div>
      )}

      {/* ─── RESUMEN ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ResumenCard icon={Package} valor={resumen.total} label="Productos" tile={GRAD} tileText="#fff" />
        <ResumenCard icon={Boxes} valor={resumen.unidades} label="Unidades en stock" tile="#f1f5f9" tileText="#475569" />
        <ResumenCard icon={DollarSign} valor={`$${resumen.valor.toFixed(2)}`} label="Valor de bodega" tile="#ecfdf5" tileText="#059669" />
        <ResumenCard icon={AlertTriangle} valor={resumen.bajos.length} label="Stock bajo" tile="#fffbeb" tileText="#d97706" />
      </div>

      {/* ─── ALERTA STOCK BAJO ─── */}
      {resumen.bajos.length > 0 && !soloBajo && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">
            {resumen.bajos.length} {resumen.bajos.length === 1 ? "producto está" : "productos están"} por agotarse:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {resumen.bajos.slice(0, 4).map((p) => (
              <span key={p.id} className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {p.nombre} · {p.stock}u
              </span>
            ))}
          </div>
          <button type="button" onClick={() => { setSoloBajo(true); setFiltroCategoria("Todas") }} className="ml-auto text-xs font-bold text-amber-700 underline-offset-2 hover:underline cursor-pointer">
            Ver solo stock bajo
          </button>
        </div>
      )}

      {/* ─── TABLA ─── */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Package size={16} /></span>
            Stock disponible
          </h4>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" />
          </div>
        </div>

        {/* Filtros: categorías + stock bajo */}
        <div className="flex flex-wrap items-center gap-2">
          {["Todas", ...CATEGORIAS].map((c) => {
            const activo = filtroCategoria === c && !soloBajo
            const col = c === "Todas" ? { fg: "#2563EB" } : catColor(c)
            return (
              <button key={c} type="button" onClick={() => { setFiltroCategoria(c); setSoloBajo(false) }}
                className="rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer"
                style={activo ? { backgroundColor: col.fg, borderColor: col.fg, color: "#fff" } : { borderColor: "rgba(14,43,51,0.12)", color: "#64748b", backgroundColor: "#fff" }}>
                {c}
              </button>
            )
          })}

          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

          <button type="button" onClick={() => { const nuevo = !soloBajo; setSoloBajo(nuevo); if (nuevo) setFiltroCategoria("Todas") }}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all cursor-pointer"
            style={soloBajo ? { backgroundColor: "#d97706", borderColor: "#d97706", color: "#fff" } : { borderColor: "#fde68a", color: "#b45309", backgroundColor: "#fffbeb" }}
            title="Filtrar productos por agotarse">
            <AlertTriangle size={12} />
            Stock bajo{resumen.bajos.length ? ` (${resumen.bajos.length})` : ""}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Ítem</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Existencia</th>
                <th className="px-4 py-3">Precio U.</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Package size={22} /></div>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {busqueda || filtroCategoria !== "Todas" || soloBajo ? "Ningún producto coincide con el filtro." : "No hay productos en bodega."}
                    </p>
                    {productos.length === 0 && (
                      <button type="button" onClick={abrirModal} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                        Agregar el primero
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((prod) => {
                  const col = catColor(prod.categoria)
                  const bajo = esStockBajo(prod)
                  return (
                    <tr key={prod.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{prod.nombre}</p>
                        {prod.observacion && <p className="mt-0.5 text-xs text-slate-500">{prod.observacion}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: col.bg, color: col.fg }}>{prod.categoria}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={"font-mono font-bold " + (bajo ? "text-amber-600" : "text-slate-800")}>{prod.stock} u.</span>
                          {bajo && <AlertTriangle size={14} className="text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">${Number(prod.precio).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => abrirEditar(prod)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Editar producto">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => abrirReabastecer(prod)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer" title="Agregar stock">
                            <PlusCircle size={16} />
                          </button>
                          <button type="button" onClick={() => setPorEliminar(prod.id)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 cursor-pointer" title="Eliminar producto">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL AGREGAR PRODUCTO ─── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarModal}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <PlusCircle size={20} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: INK }}>Ingresar producto</h2>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={registrarProducto} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Descripción del producto</label>
                <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Lentes Oakley Holbrook"
                  className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresForm.nombre ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                {erroresForm.nombre && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresForm.nombre}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Categoría</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white">
                  {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Stock</label>
                  <input type="number" min="0" step="1" required value={stock} onChange={(e) => setStock(e.target.value)} placeholder="10"
                    className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresForm.stock ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                  {erroresForm.stock && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresForm.stock}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Precio ($)</label>
                  <input type="number" min="0" step="0.01" required value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="45.00"
                    className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresForm.precio ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                  {erroresForm.precio && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresForm.precio}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Observación <span className="normal-case text-slate-500">(opcional)</span></label>
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} placeholder="Ej. Color negro mate, incluye estuche."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={cerrarModal} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Guardar en bodega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL EDITAR PRODUCTO ─── */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarEditar}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Pencil size={20} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: INK }}>Editar producto</h2>
              </div>
              <button type="button" onClick={cerrarEditar} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Descripción del producto</label>
                <input type="text" required value={edNombre} onChange={(e) => setEdNombre(e.target.value)} placeholder="Ej. Lentes Oakley Holbrook"
                  className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresEdicion.nombre ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                {erroresEdicion.nombre && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresEdicion.nombre}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Categoría</label>
                <select value={edCategoria} onChange={(e) => setEdCategoria(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white">
                  {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Stock</label>
                  <input type="number" min="0" step="1" required value={edStock} onChange={(e) => setEdStock(e.target.value)} placeholder="10"
                    className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresEdicion.stock ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                  {erroresEdicion.stock && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresEdicion.stock}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Precio ($)</label>
                  <input type="number" min="0" step="0.01" required value={edPrecio} onChange={(e) => setEdPrecio(e.target.value)} placeholder="45.00"
                    className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (erroresEdicion.precio ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")} />
                  {erroresEdicion.precio && <p className="mt-1 text-[11px] font-medium text-red-600">{erroresEdicion.precio}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Observación <span className="normal-case text-slate-500">(opcional)</span></label>
                <textarea value={edObservacion} onChange={(e) => setEdObservacion(e.target.value)} rows={2} placeholder="Ej. Color negro mate, incluye estuche."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" />
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={cerrarEditar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL ELIMINAR ─── */}
      {porEliminar != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPorEliminar(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: INK }}>Eliminar producto</h2>
            <p className="mt-1.5 text-sm text-slate-500">¿Seguro que deseas quitar este producto del inventario? Esta acción no se puede deshacer.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setPorEliminar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">Cancelar</button>
              <button type="button" onClick={confirmarEliminar} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL REABASTECER ─── */}
      {reabastecer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setReabastecer(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}>
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: INK }}>Agregar stock</h2>
                  <p className="text-xs text-slate-500">{reabastecer.nombre}</p>
                </div>
              </div>
              <button type="button" onClick={() => setReabastecer(null)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={confirmarReabastecer} className="space-y-4 p-5">
              <p className="rounded-lg bg-slate-50 p-2.5 text-center text-sm text-slate-600">
                Existencia actual: <span className="font-mono font-bold text-slate-800">{reabastecer.stock} u.</span>
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Unidades a agregar</label>
                <input
                  type="number" min="1" step="1" autoFocus value={cantidadReabastecer}
                  onChange={(e) => { setCantidadReabastecer(e.target.value); setErrorReabastecer("") }}
                  placeholder="Ej. 10"
                  className={"w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 " + (errorReabastecer ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")}
                />
                {errorReabastecer && <p className="mt-1 text-[11px] font-medium text-red-600">{errorReabastecer}</p>}
              </div>
              {cantidadReabastecer && !isNaN(parseInt(cantidadReabastecer, 10)) && parseInt(cantidadReabastecer, 10) > 0 && (
                <p className="text-center text-xs text-slate-500">
                  Nueva existencia: <span className="font-mono font-semibold text-emerald-600">{(Number(reabastecer.stock) || 0) + parseInt(cantidadReabastecer, 10)} u.</span>
                </p>
              )}
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setReabastecer(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer" style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}>
                  Agregar stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ResumenCard({ icon: Icon, valor, label, tile, tileText }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4" style={{ boxShadow: "0 1px 2px rgba(14,43,51,0.04)" }}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: tile, color: tileText }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-black leading-none" style={{ color: INK }}>{valor}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}