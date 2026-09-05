"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ShoppingCart, Search, X, AlertTriangle } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { registrarLog } from "../utilidades/logs"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD_VENTA = "linear-gradient(135deg,#34d399,#059669)" // verde: acción de venta/dinero

// Modal de venta compartido entre Inventario.jsx (producto ya elegido, hay
// que buscar al paciente) y Pacientes.jsx (paciente ya elegido, hay que
// buscar el producto) — caso "Vender producto" de la reunión con el ing:
// verificar stock, elegir método de pago (directo/tarjeta/cuotas) y dejar
// registrada la venta en la tabla `ventas` (migración 0047).
export default function VentaProductoModal({
  usuario,
  pacientes = [],
  inventario = [],
  setInventario,
  pacienteFijo = null,
  productoFijo = null,
  onGuardado,
  onCerrar,
}) {
  const opticaId = usuario?.opticaId

  const [pacienteId, setPacienteId] = useState(pacienteFijo?.id ?? null)
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdownPaciente, setMostrarDropdownPaciente] = useState(false)

  const [productoId, setProductoId] = useState(productoFijo?.id ?? null)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false)

  const [cantidad, setCantidad] = useState("1")
  const [metodoPago, setMetodoPago] = useState("directo")
  const [cuotasTotales, setCuotasTotales] = useState("3")
  const [estadoPago, setEstadoPago] = useState("completado")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const pacienteSeleccionado = pacienteFijo || pacientes.find((p) => p.id === pacienteId) || null
  const productoSeleccionado = productoFijo || inventario.find((p) => p.id === productoId) || null

  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    if (!q) return pacientes.slice(0, 8)
    return pacientes.filter((p) => p.nombre?.toLowerCase().includes(q) || p.cedula?.includes(q)).slice(0, 8)
  }, [pacientes, busquedaPaciente])

  const productosFiltrados = useMemo(() => {
    const disponibles = inventario.filter((p) => (Number(p.stock) || 0) > 0)
    const q = busquedaProducto.trim().toLowerCase()
    if (!q) return disponibles.slice(0, 8)
    return disponibles.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [inventario, busquedaProducto])

  const cantidadNum = parseInt(cantidad, 10) || 0
  const montoTotal = productoSeleccionado ? (Number(productoSeleccionado.precio) || 0) * cantidadNum : 0

  const cambiarMetodoPago = (m) => {
    setMetodoPago(m)
    setEstadoPago(m === "cuotas" ? "pendiente" : "completado")
  }

  const confirmarVenta = async (e) => {
    e.preventDefault()
    if (!pacienteSeleccionado) { setError("Selecciona el paciente que se lleva el producto."); return }
    if (!productoSeleccionado) { setError("Selecciona qué producto se vendió."); return }
    if (!cantidadNum || cantidadNum <= 0) { setError("Ingresa una cantidad válida."); return }
    if (cantidadNum > (Number(productoSeleccionado.stock) || 0)) { setError(`Solo hay ${productoSeleccionado.stock} u. disponibles en bodega.`); return }
    const cuotasNum = metodoPago === "cuotas" ? parseInt(cuotasTotales, 10) : null
    if (metodoPago === "cuotas" && (!cuotasNum || cuotasNum < 1)) { setError("Ingresa un número de cuotas válido."); return }

    setGuardando(true)
    setError("")

    const nuevaVenta = {
      pacienteId: pacienteSeleccionado.id,
      productoId: productoSeleccionado.id,
      productoNombre: productoSeleccionado.nombre,
      cantidad: cantidadNum,
      precioUnitario: Number(productoSeleccionado.precio) || 0,
      montoTotal,
      metodoPago,
      cuotasTotales: cuotasNum,
      cuotasPagadas: 0,
      estado: estadoPago,
      creadoEn: new Date().toISOString(),
    }

    if (supabase && opticaId) {
      const { data, error: errorInsert } = await supabase
        .from("ventas")
        .insert({
          optica_id: opticaId,
          paciente_id: nuevaVenta.pacienteId,
          producto_id: nuevaVenta.productoId,
          producto_nombre: nuevaVenta.productoNombre,
          cantidad: nuevaVenta.cantidad,
          precio_unitario: nuevaVenta.precioUnitario,
          monto_total: nuevaVenta.montoTotal,
          metodo_pago: nuevaVenta.metodoPago,
          cuotas_totales: nuevaVenta.cuotasTotales,
          cuotas_pagadas: 0,
          estado: nuevaVenta.estado,
          registrado_por: usuario?.id || null,
        })
        .select()
        .single()
      if (errorInsert) {
        setError("No se pudo registrar la venta. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
      nuevaVenta.id = data.id
      nuevaVenta.creadoEn = data.created_at

      const stockNuevo = (Number(productoSeleccionado.stock) || 0) - cantidadNum
      const { error: errorStock } = await supabase.from("inventario").update({ stock: stockNuevo }).eq("id", productoSeleccionado.id)
      if (!errorStock && setInventario) {
        setInventario((prev) => prev.map((p) => (p.id === productoSeleccionado.id ? { ...p, stock: stockNuevo } : p)))
      }
    } else {
      nuevaVenta.id = Date.now()
      if (setInventario) {
        setInventario((prev) => prev.map((p) => (p.id === productoSeleccionado.id ? { ...p, stock: (Number(p.stock) || 0) - cantidadNum } : p)))
      }
    }

    setGuardando(false)
    registrarLog(usuario, "inventario", "Vendió un producto", `${nuevaVenta.productoNombre} a ${pacienteSeleccionado.nombre}`)
    onGuardado?.(nuevaVenta)
    onCerrar?.()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD_VENTA }}>
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>Vender producto</h2>
              <p className="text-xs text-slate-500">Se descuenta del inventario y queda registrado el pago.</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={confirmarVenta} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">

            {/* ─── Paciente ─── */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente</label>
              {pacienteFijo ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{pacienteFijo.nombre}</div>
              ) : pacienteSeleccionado ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <span className="text-sm font-semibold text-emerald-800">{pacienteSeleccionado.nombre}</span>
                  <button type="button" onClick={() => { setPacienteId(null); setBusquedaPaciente("") }} className="text-sm font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text" placeholder="Buscar paciente por nombre o cédula..."
                    value={busquedaPaciente}
                    onFocus={() => setMostrarDropdownPaciente(true)}
                    onChange={(e) => { setBusquedaPaciente(e.target.value); setMostrarDropdownPaciente(true) }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                  {mostrarDropdownPaciente && pacientesFiltrados.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {pacientesFiltrados.map((p) => (
                        <li key={p.id} onClick={() => { setPacienteId(p.id); setMostrarDropdownPaciente(false) }} className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                          {p.nombre} {p.cedula && <span className="font-mono text-xs text-slate-400">· {p.cedula}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {mostrarDropdownPaciente && busquedaPaciente && pacientesFiltrados.length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-500">Ningún paciente coincide con la búsqueda.</p>
                  )}
                </div>
              )}
            </div>

            {/* ─── Producto ─── */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Producto</label>
              {productoFijo ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-sm font-semibold text-slate-700">{productoFijo.nombre}</span>
                  <span className="font-mono text-xs text-slate-500">{productoFijo.stock} u. · ${Number(productoFijo.precio).toFixed(2)}</span>
                </div>
              ) : productoSeleccionado ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <span className="text-sm font-semibold text-emerald-800">{productoSeleccionado.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-emerald-700">{productoSeleccionado.stock} u. · ${Number(productoSeleccionado.precio).toFixed(2)}</span>
                    <button type="button" onClick={() => { setProductoId(null); setBusquedaProducto("") }} className="text-sm font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                  {mostrarDropdownProducto && productosFiltrados.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {productosFiltrados.map((p) => (
                        <li key={p.id} onClick={() => { setProductoId(p.id); setMostrarDropdownProducto(false) }} className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                          <span>{p.nombre}</span>
                          <span className="font-mono text-xs text-slate-400">{p.stock} u. · ${Number(p.precio).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {mostrarDropdownProducto && busquedaProducto && productosFiltrados.length === 0 && (
                    <p className="mt-1.5 text-xs text-slate-500">Ningún producto con stock coincide.</p>
                  )}
                </div>
              )}
            </div>

            {/* ─── Cantidad + método de pago ─── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cantidad</label>
                <input type="number" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Total</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-right font-mono text-sm font-bold text-slate-800">${montoTotal.toFixed(2)}</div>
              </div>
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

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Estado del pago</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEstadoPago("completado")}
                  className="flex-1 rounded-xl border py-2 text-sm font-semibold transition cursor-pointer"
                  style={estadoPago === "completado" ? { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", color: "#059669" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                  Completado
                </button>
                <button type="button" onClick={() => setEstadoPago("pendiente")}
                  className="flex-1 rounded-xl border py-2 text-sm font-semibold transition cursor-pointer"
                  style={estadoPago === "pendiente" ? { backgroundColor: "#fffbeb", borderColor: "#fde68a", color: "#b45309" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                  Pendiente
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
          </div>

          <div className="flex gap-3 border-t border-slate-100 p-6 pt-4">
            <button type="button" onClick={onCerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
              style={{ background: GRAD_VENTA, boxShadow: "0 12px 24px -12px rgba(5,150,105,0.5)" }}>
              {guardando ? "Registrando..." : "Registrar venta"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
