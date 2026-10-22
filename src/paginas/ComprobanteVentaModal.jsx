"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { dioptriaTexto } from "../utilidades/refraccion"
import { useMemo, useState } from "react"
import { Receipt, Search, AlertTriangle, Plus, ArrowLeft, Printer, Stethoscope, UserX, ChevronDown, BadgePercent, X } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { registrarLog } from "../utilidades/logs"
import { UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, mensajeDeError } from "../utilidades/permisos"
import { puede } from "../utilidades/permisosUi"
import { useFidelidad } from "../componentes/FidelidadContexto"
import { useLaboratorios } from "../componentes/LaboratoriosContexto"
import { Cascaron } from "../componentes/AtencionPaciente"
import CamposPagos, { FILAS_INICIALES } from "../componentes/ventas/CamposPagos"
import { brutoLinea, descuentoLinea, subtotalLinea, totalesDeLineas, errorDeDescuento, lineaParaRpc, TIPOS_DESCUENTO } from "../utilidades/descuentos"
import { filasParaTotal, revisarPagos, modalidadDePagos, textoPagos, redondear } from "../utilidades/pagos"
import CampoCategoria from "../componentes/CampoCategoria"
import CampoImagenProducto from "../componentes/CampoImagenProducto"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import OrdenLaboratorioModal from "../componentes/OrdenLaboratorioModal"
import { esLineaDeLente, TIPOS_LENTE, MATERIALES_LENTE } from "../utilidades/ordenesLaboratorio"
import { TRATAMIENTOS_LUNA, descripcionLuna, detalleLuna, datosOrdenDeLinea, lunaDe, lunaDeTexto } from "../utilidades/comprobantes"
import { mapAbono, EVENTO_ABONO } from "../utilidades/abonos"
import { textoDiagnostico } from "../utilidades/pasesVenta"
import { diagnosticoCorto } from "../utilidades/ventasModulo"
import { laboratoriosParaElegir } from "../utilidades/laboratorios"

// ─── Colores: el color de cada pestaña llena toda la píldora (sin borde de otro tono); el azul de la marca es el de los botones principales ───
const AZUL = "#2563EB" // montura / accesorio
const VIOLETA = "#7c3aed" // tipo "servicio"
const AZUL_LUNA = "#0e7490" // tipo "luna"
const PESTANAS_LINEA = [{ id: "producto", etiqueta: "Montura", color: AZUL }, { id: "luna", etiqueta: "Luna", color: AZUL_LUNA }, { id: "servicio", etiqueta: "Servicio", color: VIOLETA }]
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"

// Panel de venta ÚNICO (propuesta de flujo de atención, Ronda 4): el mismo
// panel se usa al guardar la ficha clínica (consulta + lente precargados,
// "Más tarde" / "Cobrar y finalizar"), desde el perfil del paciente ("Nueva
// venta", vacío), desde Ventas y para cobrar un cobro pendiente.
//
// El documento que genera es un "comprobante de venta interno" (no una factura
// electrónica del SRI). La tabla y la función conservan su nombre técnico
// (facturas_venta, crear_factura_venta); en pantalla nunca se llama "factura",
// salvo el campo opcional con el número de la factura electrónica emitida por fuera.
//
// Una venta tiene montura y accesorios (productos de inventario, los únicos que
// descuentan stock), la luna (línea de texto con precio, migración 0094) y
// servicios; se paga hoy lo que se pueda (todo, parte o nada) y el resto queda
// como saldo. Con lunas, al guardar se crea el pedido de lentes (con su laboratorio).
// Un servicio (examen, ajuste, garantía) no tiene producto_id y no
// descuenta inventario — ver crear_factura_venta (migración 0072).
export default function ComprobanteVentaModal({
  usuario,
  inventario = [],
  setInventario,
  categorias = [],
  setCategorias,
  pacienteFijo,
  // Sin pacienteFijo (venta iniciada desde Ventas o Inventario) el panel pide elegir
  // al paciente de esta lista.
  pacientes = [],
  // Para «Usar como guía»: las consultas (para el último diagnóstico del paciente elegido) y sus pases a venta (la venta cierra el que esté abierto).
  consultas = [],
  pases = [],
  parametrizacion,
  // Una solicitud del portal se marca «En atención» al usar el diagnóstico como guía: devuelve false si no se pudo.
  onTomarSolicitud,
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
  subtitulo = "Montura, lunas y servicios",
  etiquetaGuardar = "Guardar venta",
  // Si se pasa, el botón secundario es "Más tarde" (en vez de "Cancelar").
  onMasTarde,
  // Encadena la factura a la consulta/cita de origen — mismos parámetros
  // que ya usa ConsultaMedica.jsx al crear la factura desde su propio
  // editor embebido (ver crear_factura_venta, migración 0072).
  consultaId = null,
  citaId = null,
  // Venta desde el perfil de un paciente listo para venta (R35): datos de la consulta que se
  // muestran de solo lectura, y las acciones de proforma y "No compró".
  // diagnostico es la consulta ({ fecha, motivo, diagnostico, diagnosticoCategorias,
  // lenteRecomendado, indicaciones, od, oi }). onProforma({ lineas, total, incluirMedidas })
  // imprime el presupuesto; no guarda nada ni toca el stock.
  diagnostico = null,
  onProforma,
  onNoCompro,
  // "Nueva venta" de un paciente con un pase abierto: la venta queda vinculada a esa consulta
  // para que cierre el pase ({ consultaId, citaId, etiqueta }).
  vinculoSugerido = null,
  // Sin paciente fijo la sugerencia depende del paciente elegido: recibe el paciente y devuelve { consultaId, citaId, etiqueta } o null.
  vinculoParaPaciente = null,
  onGuardado,
  onCerrar,
}) {
  const opticaId = usuario?.opticaId
  const { parametrizacion: parametrosLab } = useLaboratorios()
  const catalogo = parametrizacion || parametrosLab
  const [ordenPara, setOrdenPara] = useState(null) // factura recién guardada, a la espera de su pedido de lentes
  const [laboratorio, setLaboratorio] = useState("")
  const [guia, setGuia] = useState(null) // el último diagnóstico usado como guía
  const [incluirMedidas, setIncluirMedidas] = useState(false)
  const [verMedidas, setVerMedidas] = useState(false)

  const [lineas, setLineas] = useState(() => {
    const iniciales = lineasIniciales || (lineaInicial?.productoId ? [{ tipo: "producto", ...lineaInicial }] : [])
    const out = []
    for (const l of iniciales) {
      if (l.tipo === "luna") {
        out.push({ tipo: "luna", productoId: null, descripcion: l.descripcion || "Luna", cantidad: 1, precioUnitario: Math.max(0, Number(l.precioUnitario) || 0), detalle: l.detalle || null })
        continue
      }
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

  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false)

  // Luna (texto + precio): los mismos catálogos de tipo, material y tratamientos de la orden de laboratorio.
  const [luna, setLuna] = useState({ tipoLente: "monofocal", material: "", antirreflejo: false, filtroAzul: false, fotocromatico: false, otrosTratamientos: "" })
  const [precioLuna, setPrecioLuna] = useState("")

  const [descServicio, setDescServicio] = useState("")
  const [cantidadServicio, setCantidadServicio] = useState("1")
  const [precioServicio, setPrecioServicio] = useState("")

  // Alta rápida de producto sin salir del flujo — mismo caso de la reunión
  // con el ing, ya resuelto antes en el modal de venta rápida (retirado).
  const CATEGORIAS_NP = categorias.length > 0 ? categorias : ["Monturas", "Accesorios"]
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [npNombre, setNpNombre] = useState("")
  const [npCategoria, setNpCategoria] = useState(CATEGORIAS_NP[0] || "Monturas")
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
  // El pase abierto del paciente (recibió su diagnóstico y no ha comprado): la venta lo cierra sola.
  const paseAbierto = paciente ? pases.find((p) => p.pacienteId === paciente.id && p.estado === "listo") || null : null
  const vinculoDePase = paseAbierto ? { consultaId: paseAbierto.consultaId, citaId: paseAbierto.citaId } : null
  const vinculo = vinculoSugerido || (paciente && vinculoParaPaciente ? vinculoParaPaciente(paciente) : null) || vinculoDePase
  const consultaIdEfectivo = consultaId ?? guia?.id ?? vinculo?.consultaId ?? null
  const citaIdEfectivo = citaId ?? (guia && guia.id === vinculo?.consultaId ? vinculo?.citaId : guia ? null : vinculo?.citaId) ?? null
  const ultimaConsulta = useMemo(() => (paciente && !diagnostico && !consultaId
    ? consultas.filter((c) => c.pacienteId === paciente.id).slice().sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))[0] || null
    : null), [consultas, paciente, diagnostico, consultaId])
  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    const base = q ? pacientes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cedula || "").includes(q)) : pacientes
    return base.slice(0, 8)
  }, [pacientes, busquedaPaciente])

  // Cuánto se paga hoy (por defecto, todo) y cómo: un método, o varios a la vez («Dividir el pago»). Lo que no se paga hoy queda como saldo, con abonos de monto y fecha libres.
  const [pagoHoy, setPagoHoy] = useState(null) // null = sigue al total
  const [filasPago, setFilasPago] = useState(FILAS_INICIALES)
  // Descontar es de quien puede corregir cobros (Ventas: editar); la base lo vuelve a exigir.
  const puedeDescontar = puede(usuario, "ventas", "editar")
  const { de: fidelidadDe } = useFidelidad()
  const beneficioFidelidad = paciente ? fidelidadDe(paciente).beneficio : null
  const aplicarDescuentoFidelidad = () => setLineas((prev) => prev.map((l) => ({ ...l, descuentoTipo: "porcentaje", descuentoValor: beneficioFidelidad.descuento, descuentoMotivo: `Fidelización: nivel ${beneficioFidelidad.nivel.nombre}` })))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const productosFiltrados = useMemo(() => {
    const disponibles = inventario.filter((p) => (Number(p.stock) || 0) > 0 && p.activo !== false)
    const q = busquedaProducto.trim().toLowerCase()
    if (!q) return disponibles.slice(0, 8)
    return disponibles.filter((p) => [p.nombre, p.codigo, p.marca, p.modelo].some((v) => (v || "").toLowerCase().includes(q))).slice(0, 8)
  }, [inventario, busquedaProducto])

  const { bruto, descuento: totalDescuento, total } = useMemo(() => totalesDeLineas(lineas), [lineas])
  const pagoNum = pagoHoy === null ? total : redondear(parseFloat(pagoHoy) || 0)
  const textoPagoHoy = pagoHoy === null ? (total > 0 ? String(redondear(total)) : "0") : pagoHoy
  const saldoQueda = Math.max(0, redondear(total - pagoNum))

  // Un producto elegido en la lista entra a la venta con 1 unidad (si ya estaba, suma una, sin pasar del stock); la cantidad se cambia en su fila.
  const agregarProducto = (p) => {
    const stock = Number(p.stock) || 0
    const existente = lineas.findIndex((l) => l.tipo === "producto" && l.productoId === p.id)
    if (existente >= 0) {
      if (lineas[existente].cantidad + 1 > stock) { setError(`Solo hay ${stock} u. de «${p.nombre}» en el inventario.`); return }
      setLineas((prev) => prev.map((l, i) => (i === existente ? { ...l, cantidad: l.cantidad + 1 } : l)))
    } else {
      setLineas((prev) => [...prev, { tipo: "producto", productoId: p.id, descripcion: p.nombre, cantidad: 1, precioUnitario: Number(p.precio) || 0 }])
    }
    setError("")
    setBusquedaProducto("")
    setMostrarDropdownProducto(false)
  }
  const cambiarCantidad = (idx, valor) => setLineas((prev) => prev.map((l, i) => {
    if (i !== idx) return l
    const p = inventario.find((x) => x.id === l.productoId)
    const max = Number(p?.stock) || 1
    const n = Math.min(Math.max(1, parseInt(valor, 10) || 1), max)
    return { ...l, cantidad: n }
  }))

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

  const agregarLineaLuna = () => {
    const precio = parseFloat(precioLuna)
    if (!luna.tipoLente) { setError("Elige el tipo de luna."); return }
    if (isNaN(precio) || precio < 0) { setError("Ingresa el precio de la luna (0 o más)."); return }
    setLineas((prev) => [...prev, { tipo: "luna", productoId: null, descripcion: descripcionLuna(luna), cantidad: 1, precioUnitario: precio, detalle: detalleLuna(luna) }])
    setError("")
    setPrecioLuna("")
    setLuna((p) => ({ ...p, material: "", antirreflejo: false, filtroAzul: false, fotocromatico: false, otrosTratamientos: "" }))
  }

  const quitarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx))
  // El precio de un servicio (p. ej. la consulta precargada con su costo
  // base) es editable en el momento; puede ser 0. El de un producto sale de
  // inventario.
  const editarPrecioLinea = (idx, valor) => setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, precioTexto: valor, precioUnitario: Math.max(0, parseFloat(valor) || 0) } : l)))

  // «Usar como guía»: el último diagnóstico lleva a la luna lo que el optómetra recomendó (tipo y filtros), deja la venta vinculada a esa consulta y, si fue una solicitud del portal, la marca «En atención».
  const usarComoGuia = async () => {
    if (!ultimaConsulta) return
    if (paseAbierto && onTomarSolicitud && (await onTomarSolicitud(paseAbierto)) === false) return
    setLuna((p) => ({ ...p, ...lunaDeTexto(ultimaConsulta.lenteRecomendado) }))
    setTipoLinea("luna")
    setGuia(ultimaConsulta)
    const producto = ultimaConsulta.lenteProductoId ? inventario.find((p) => p.id === ultimaConsulta.lenteProductoId && p.activo !== false && (Number(p.stock) || 0) > 0) : null
    if (producto && !lineas.some((l) => l.productoId === producto.id)) agregarProducto(producto)
  }

  const abrirAltaProducto = () => {
    setNpNombre(busquedaProducto)
    setNpCategoria(CATEGORIAS_NP[0] || "Monturas")
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
      errs.nombre = duplicado.activo === false
        ? `Ya existe «${duplicado.nombre}» en Descontinuados (${duplicado.stock} u.). Reactívalo en Inventario en vez de crearlo de nuevo.`
        : `Ya existe «${duplicado.nombre}» en el inventario (${duplicado.stock} u.). Búscalo arriba en vez de crearlo de nuevo.`
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

    const guardado = { ...nuevo, activo: true }
    setInventario?.((prev) => [guardado, ...prev])
    registrarLog(usuario, "inventario", "Agregó un producto al inventario", nuevo.nombre)
    setGuardandoNp(false)
    setAgregandoProducto(false)
    setLineas((prev) => [...prev, { tipo: "producto", productoId: nuevo.id, descripcion: nuevo.nombre, cantidad: 1, precioUnitario: Number(nuevo.precio) || 0 }])
    setBusquedaProducto("")
  }

  const editarDescuento = (idx, cambios) => setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)))
  const quitarDescuento = (idx) => { editarDescuento(idx, { descuentoTipo: null, descuentoValor: null, descuentoMotivo: "" }) }
  // Con lunas en la venta se crea el pedido de lentes (no hay casilla que marcar).
  const incluyeLentes = lineas.some(esLineaDeLente)
  const laboratorios = laboratoriosParaElegir(catalogo, laboratorio)

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
    for (const l of lineas) { const msg = errorDeDescuento(l); if (msg) { setError(msg); return } }
    if (pagoHoy !== null && (pagoHoy.trim() === "" || Number.isNaN(parseFloat(pagoHoy)) || parseFloat(pagoHoy) < 0)) { setError("Revisa el pago de hoy: debe ser un monto de 0 en adelante."); return }
    if (pagoNum > total) { setError(`El pago de hoy no puede pasar del total (${dinero(total)}).`); return }

    // Se paga hoy todo (la venta queda pagada) o una parte (abono inicial; el resto es saldo). Cada cobro, con uno o varios métodos.
    const completo = pagoNum >= total
    let pagosContado = null
    let pagosAbono = null
    const abonoNum = completo ? 0 : pagoNum
    if (completo && total > 0) {
      const r = revisarPagos(filasParaTotal(filasPago, total), total)
      if (r.error) { setError(r.error); return }
      pagosContado = r.pagos
    }
    if (abonoNum > 0) {
      const r = revisarPagos(filasParaTotal(filasPago, abonoNum), abonoNum)
      if (r.error) { setError(r.error); return }
      pagosAbono = r.pagos
    }
    const metodoPago = completo ? modalidadDePagos(pagosContado || []) : "abonos"

    setGuardando(true)
    setError("")

    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase
        .rpc("crear_factura_venta", {
          p_optica_id: opticaId,
          p_paciente_id: paciente.id,
          p_metodo_pago: metodoPago,
          p_lineas: lineas.map(lineaParaRpc),
          p_cita_id: citaIdEfectivo,
          p_consulta_id: consultaIdEfectivo,
          p_cuotas_totales: null,
          p_registrado_por: usuario?.id || null,
          ...(pagosContado ? { p_pagos: pagosContado } : {}),
        })
        .single()
      if (errorRpc) {
        setError(mensajeDeError(errorRpc, "No se pudo registrar la venta. Revisa tu conexión e intenta de nuevo."))
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
      registrarLog(usuario, "ventas", "Registró una venta", `${paciente.nombre} · ${lineas.length} línea(s) · ${dinero(total)}${pagosContado ? ` · ${textoPagos(pagosContado)}` : ""}`)
      if (totalDescuento > 0) registrarLog(usuario, "ventas", "Aplicó un descuento", `${paciente.nombre} · ${dinero(totalDescuento)} · ${lineas.filter((l) => l.descuentoTipo).map((l) => `${l.descripcion}: ${String(l.descuentoMotivo).trim()}`).join("; ")}`)
      let estadoFinal = data.estado
      let avisoAbono = ""
      if (abonoNum > 0) {
        // El pago de hoy de una venta con saldo se registra justo después de crearla (misma función que cualquier otro abono).
        const { data: ab, error: errorAbono } = await supabase.rpc("registrar_abono", { p_factura_id: data.id, p_monto: abonoNum, p_nota: "Abono inicial", p_pagos: pagosAbono }).single()
        if (errorAbono) {
          avisoAbono = "La venta se guardó, pero el pago de hoy no se pudo registrar: regístralo desde la venta con «Registrar abono»."
        } else {
          estadoFinal = ab.estado
          const { data: filas } = await supabase.from("abonos_factura").select("*").eq("factura_id", data.id)
          ;(filas || []).forEach((f) => window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(f) })))
        }
      }
      const facturaGuardada = {
        id: data.id, pacienteId: paciente.id, citaId: citaIdEfectivo, consultaId: consultaIdEfectivo,
        metodoPago, cuotasTotales: null, cuotasPagadas: 0, montoTotal: data.monto_total,
        estado: estadoFinal, creadoEn: data.created_at,
        numero: data.numero ?? null, facturaElectronica: "",
        registradoPor: usuario?.id || null, pagos: pagosContado,
        lineas: lineas.map((l, i) => ({ ...l, id: `${data.id}-${i}`, descuentoMonto: descuentoLinea(l), descuentoMotivo: l.descuentoTipo ? String(l.descuentoMotivo).trim() : "" })),
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

  // Venta guardada con lentes: sigue el pedido de lentes (cerrarlo o crearlo después termina el flujo).
  if (ordenPara) {
    return (
      <OrdenLaboratorioModal
        paciente={paciente}
        facturaId={ordenPara.id}
        consultaId={ordenPara.consultaId}
        consulta={diagnostico || guia}
        monturaInicial={ordenPara.lineas.find((l) => l.tipo === "producto")?.descripcion || ""}
        lunaInicial={datosOrdenDeLinea(lunaDe(ordenPara.lineas))}
        laboratorioInicial={laboratorio}
        facturaNumero={ordenPara.numero}
        usuario={usuario}
        onCerrar={() => onCerrar?.()}
      />
    )
  }

  // Pie de la ventana: a la izquierda lo que se hace con la consulta (proforma, "No compró"); a la derecha, salir o registrar.
  const pie = agregandoProducto ? null : (
    <>
      {onProforma || onNoCompro ? (
        <div className="flex items-center gap-4">
          {onProforma && (
            <button type="button" onClick={imprimirProforma} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
              <Printer size={14} aria-hidden="true" /> Imprimir proforma
            </button>
          )}
          {onNoCompro && (
            <button type="button" onClick={onNoCompro} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">
              <UserX size={14} aria-hidden="true" /> No compró
            </button>
          )}
        </div>
      ) : <span />}
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onMasTarde || onCerrar} disabled={guardando} className="rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
          {onMasTarde ? "Más tarde" : "Cancelar"}
        </button>
        <button type="submit" disabled={guardando} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60 cursor-pointer" style={{ background: GRAD_MARCA }}>
          {guardando ? "Guardando..." : etiquetaGuardar}
        </button>
      </div>
    </>
  )

  return (
    <Cascaron titulo={titulo} subtitulo={subtitulo} Icono={Receipt} ancho="max-w-xl" onCerrar={onCerrar} formulario={{ onSubmit: confirmarFactura }} pie={pie}>
          <div className="space-y-4 p-5">

            <div className="relative">
              <label htmlFor="comprobante-paciente" className="mb-1.5 block text-sm font-semibold text-slate-600">Paciente</label>
              {pacienteFijo ? (
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">{pacienteFijo.nombre}{pacienteFijo.cedula ? ` · ${pacienteFijo.cedula}` : ""}</div>
              ) : pacienteSel ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5">
                  <span className="truncate text-sm font-medium text-slate-800">{pacienteSel.nombre}{pacienteSel.cedula ? ` · ${pacienteSel.cedula}` : ""}</span>
                  <button type="button" onClick={() => { setPacienteSel(null); setBusquedaPaciente(""); setGuia(null) }} aria-label="Cambiar paciente" className="rounded-md p-0.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"><X size={16} aria-hidden="true" /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="comprobante-paciente"
                      type="text"
                      placeholder="Busca al paciente por nombre o cédula..."
                      value={busquedaPaciente}
                      onFocus={() => setMostrarDropdownPaciente(true)}
                      onChange={(e) => { setBusquedaPaciente(e.target.value); setMostrarDropdownPaciente(true) }}
                      className={CAMPO + " pl-10"}
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

            {/* Su último diagnóstico, para vender con lo que ya se decidió en la consulta («Usar como guía» lleva el tipo de luna y sus filtros a la venta). */}
            {ultimaConsulta && (
              <div className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-slate-700">
                <p className="min-w-0">
                  <span className="font-bold text-slate-900">Último diagnóstico ({formatoFecha(ultimaConsulta.fecha, "medioSinAnio")}):</span>{" "}
                  {[diagnosticoCorto(ultimaConsulta), ultimaConsulta.lenteRecomendado].filter(Boolean).join(" · ") || "sin diagnóstico escrito"}
                </p>
                {guia ? <span className="shrink-0 text-sm font-semibold text-emerald-700">Usado como guía</span>
                  : <button type="button" onClick={usarComoGuia} className="shrink-0 text-sm font-bold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">Usar como guía</button>}
              </div>
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
                      <p key={ojo}><span className="font-bold text-blue-700">{ojo}:</span> {o?.esfera || o?.cilindro || o?.eje ? `${dioptriaTexto(o?.esfera) || "—"} | ${dioptriaTexto(o?.cilindro) || "—"} | ${o?.eje || "—"}°` : "No registrada"}</p>
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

            {agregandoProducto ? (
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardarProductoRapido(e) } }}>
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={cancelarAltaProducto} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
                    <ArrowLeft size={13} /> Volver a buscar
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-700">Montura o accesorio nuevo</span>
                </div>
                <div className="space-y-3">
                  <CampoImagenProducto opticaId={opticaId} valor={npImagenUrl} onCambio={setNpImagenUrl} />
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Categoría</label>
                    <CampoCategoria valor={npCategoria} onChange={setNpCategoria} categorias={CATEGORIAS_NP} setCategorias={setCategorias} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Descripción de la montura o accesorio</label>
                    <input type="text" required value={npNombre} onChange={(e) => setNpNombre(e.target.value)} placeholder="Ej. Montura 1, marco negro, modelo X"
                      className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.nombre ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                    {erroresNp.nombre && <p className="mt-1 text-xs font-medium text-red-600">{erroresNp.nombre}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Stock inicial</label>
                      <input type="number" min="0" step="1" required value={npStock} onChange={(e) => setNpStock(e.target.value)}
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.stock ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                      {erroresNp.stock && <p className="mt-1 text-xs font-medium text-red-600">{erroresNp.stock}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Precio ($)</label>
                      <input type="number" min="0" step="0.01" required value={npPrecio} onChange={(e) => setNpPrecio(e.target.value)} placeholder="45.00"
                        className={"w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 " + (erroresNp.precio ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                      {erroresNp.precio && <p className="mt-1 text-xs font-medium text-red-600">{erroresNp.precio}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Stock mínimo (alerta) <span className="normal-case text-slate-500">(opcional — si lo dejas vacío usa el stock mínimo general)</span></label>
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
                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer" style={{ background: GRAD_MARCA }}>
                    {guardandoNp ? "Guardando..." : "Guardar y usar en esta venta"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Pestañas: cada una llena su píldora con su color. */}
                <div role="group" aria-label="Qué se agrega a la venta" className="flex flex-wrap gap-2">
                  {PESTANAS_LINEA.map((t) => {
                    const activa = tipoLinea === t.id
                    return (
                      <button key={t.id} type="button" aria-pressed={activa} onClick={() => setTipoLinea(t.id)}
                        className={"rounded-full border px-5 py-2 text-sm font-semibold transition-colors cursor-pointer " + (activa ? "text-white" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50")}
                        style={activa ? { backgroundColor: t.color, borderColor: t.color } : undefined}>
                        {t.etiqueta}
                      </button>
                    )
                  })}
                </div>

                {tipoLinea === "producto" ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <label htmlFor="venta-buscar-producto" className="sr-only">Buscar montura o accesorio en stock</label>
                      <input
                        id="venta-buscar-producto" type="text" placeholder="Buscar montura o accesorio en stock"
                        value={busquedaProducto}
                        onFocus={() => setMostrarDropdownProducto(true)}
                        onChange={(e) => { setBusquedaProducto(e.target.value); setMostrarDropdownProducto(true) }}
                        className={CAMPO + " pl-10"}
                      />
                      {mostrarDropdownProducto && productosFiltrados.length > 0 && (
                        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                          {productosFiltrados.map((p) => (
                            <li key={p.id}>
                              <button type="button" onClick={() => agregarProducto(p)} className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                                <span className="flex min-w-0 items-center gap-2">
                                  <MiniaturaProducto url={p.imagen_url} alt={p.nombre} size={24} />
                                  <span className="truncate">{p.nombre}</span>
                                </span>
                                <span className="shrink-0 font-mono text-xs text-slate-500">{p.stock} u. · {dinero(Number(p.precio))}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {mostrarDropdownProducto && busquedaProducto && productosFiltrados.length === 0 && (
                      <p className="text-xs text-slate-500">Ninguna montura o accesorio con stock coincide.</p>
                    )}
                    <button type="button" onClick={abrirAltaProducto} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                      <Plus size={13} aria-hidden="true" /> ¿No lo encuentras? Registrar montura o accesorio nuevo
                    </button>
                  </div>
                ) : tipoLinea === "luna" ? (
                  <div className="space-y-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                    <p className="text-xs text-slate-500">La luna se escribe aquí, no sale del inventario. Lo que elijas llena el pedido de lentes.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="luna-tipo" className="mb-1 block text-xs font-semibold text-slate-600">Tipo</label>
                        <select id="luna-tipo" value={luna.tipoLente} onChange={(e) => setLuna((p) => ({ ...p, tipoLente: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                          {TIPOS_LENTE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="luna-material" className="mb-1 block text-xs font-semibold text-slate-600">Material</label>
                        <select id="luna-material" value={luna.material} onChange={(e) => setLuna((p) => ({ ...p, material: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                          <option value="">Sin indicar</option>
                          {MATERIALES_LENTE.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <fieldset>
                      <legend className="mb-1 text-xs font-semibold text-slate-600">Filtros y tratamientos</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {TRATAMIENTOS_LUNA.map((t) => (
                          <label key={t.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                            <input type="checkbox" checked={!!luna[t.id]} onChange={(e) => setLuna((p) => ({ ...p, [t.id]: e.target.checked }))} className="accent-cyan-700" /> {t.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <input type="text" aria-label="Otros tratamientos" placeholder="Otros (ej. endurecido, polarizado)" value={luna.otrosTratamientos} onChange={(e) => setLuna((p) => ({ ...p, otrosTratamientos: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-blue-500" />
                    <div className="flex items-center gap-2">
                      <label htmlFor="luna-precio" className="text-xs font-semibold text-slate-600">Precio de la luna</label>
                      <input id="luna-precio" type="number" min="0" step="0.01" inputMode="decimal" value={precioLuna} onChange={(e) => setPrecioLuna(e.target.value)} placeholder="0.00" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      <button type="button" onClick={agregarLineaLuna} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white cursor-pointer" style={{ background: INK }}>+ Agregar luna</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                    <input type="text" placeholder="Descripción del servicio (ej. Examen visual, ajuste, garantía...)" value={descServicio} onChange={(e) => setDescServicio(e.target.value)}
                      className={CAMPO} />
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-600">Cantidad</label>
                      <input type="number" min="1" value={cantidadServicio} onChange={(e) => setCantidadServicio(e.target.value)} className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      <label className="text-xs font-semibold text-slate-600">Precio</label>
                      <input type="number" min="0" step="0.01" value={precioServicio} onChange={(e) => setPrecioServicio(e.target.value)} placeholder="0.00" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      <button type="button" onClick={agregarLineaServicio} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-white cursor-pointer" style={{ background: INK }}>+ Agregar línea</button>
                    </div>
                  </div>
                )}

                {/* Lo que lleva la venta: filas compactas separadas por una línea fina. */}
                {lineas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-4 text-center text-xs text-slate-500">
                    Todavía no agregaste la montura, la luna ni ningún servicio.
                  </div>
                ) : (
                  <ul aria-label="Detalle de la venta" className="divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/70 bg-white">
                    {lineas.map((l, i) => (
                      <li key={i} className="px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            {l.tipo === "producto" && <MiniaturaProducto url={inventario.find((p) => p.id === l.productoId)?.imagen_url} alt={l.descripcion} size={24} />}
                            <span className="truncate text-sm font-medium text-slate-800" title={l.descripcion}>{l.descripcion}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3 text-sm text-slate-600">
                            {l.tipo === "producto" ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <input type="number" min="1" max={Number(inventario.find((p) => p.id === l.productoId)?.stock) || 1} inputMode="numeric" aria-label={`Cantidad de ${l.descripcion}`} value={l.cantidad} onChange={(e) => cambiarCantidad(i, e.target.value)}
                                    className="w-12 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-sm outline-none focus-visible:border-blue-500" /> u.
                                </span>
                                <span className="w-20 text-right font-mono text-slate-800">{dinero(brutoLinea(l))}</span>
                              </>
                            ) : (
                              <>
                                <span>{l.tipo === "luna" ? "par" : `${l.cantidad} u.`}</span>
                                <span className="flex items-center gap-0.5 font-mono text-slate-800">$
                                  <input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Precio de ${l.descripcion}`} value={l.precioTexto ?? String(l.precioUnitario)} onChange={(e) => editarPrecioLinea(i, e.target.value)}
                                    className="w-20 rounded-md border border-slate-200 px-1.5 py-0.5 text-right text-sm outline-none focus-visible:border-blue-500" />
                                </span>
                              </>
                            )}
                            <button type="button" onClick={() => quitarLinea(i)} aria-label={`Quitar ${l.descripcion}`} className="rounded-md p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"><X size={15} aria-hidden="true" /></button>
                          </span>
                        </div>
                        {l.descuentoTipo ? (
                          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-600">Descuento</span>
                              <select aria-label={`Tipo de descuento de ${l.descripcion}`} value={l.descuentoTipo} onChange={(e) => editarDescuento(i, { descuentoTipo: e.target.value })} className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-xs">
                                {TIPOS_DESCUENTO.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                              </select>
                              <input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Valor del descuento de ${l.descripcion}`} value={l.descuentoValor ?? ""} onChange={(e) => editarDescuento(i, { descuentoValor: e.target.value })} className="h-8 w-20 rounded-md border border-slate-300 px-1.5 text-right font-mono text-xs outline-none focus-visible:border-blue-500" />
                              <span className="ml-auto font-mono text-xs font-semibold text-slate-700">-{dinero(descuentoLinea(l))} → {dinero(subtotalLinea(l))}</span>
                              <button type="button" onClick={() => quitarDescuento(i)} className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer">Quitar</button>
                            </div>
                            <input type="text" maxLength={200} aria-label={`Motivo del descuento de ${l.descripcion}`} placeholder="Motivo del descuento (obligatorio)" value={l.descuentoMotivo || ""} onChange={(e) => editarDescuento(i, { descuentoMotivo: e.target.value })} className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs outline-none focus-visible:border-blue-500" />
                          </div>
                        ) : puedeDescontar && (
                          <button type="button" onClick={() => editarDescuento(i, { descuentoTipo: "porcentaje", descuentoValor: "", descuentoMotivo: "" })} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">
                            <BadgePercent size={13} aria-hidden="true" /> Aplicar descuento
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Con lunas se crea el pedido de lentes: el laboratorio se elige aquí (del catálogo de Configuración → Laboratorios). */}
                {incluyeLentes && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-700">Incluye lunas: se creará el pedido de lentes.</p>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      Laboratorio
                      <select aria-label="Laboratorio del pedido de lentes" value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)}
                        className="h-9 max-w-[11rem] cursor-pointer rounded-lg border border-slate-200/70 bg-white px-2.5 text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500">
                        <option value="">{laboratorios.length === 0 ? "Sin laboratorios" : "Elegir"}</option>
                        {laboratorios.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </label>
                    {laboratorios.length === 0 && <p className="w-full text-xs text-slate-500">Agrega tus laboratorios en Configuración → Laboratorios; puedes crear el pedido igual y elegirlo después.</p>}
                  </div>
                )}

                {/* El descuento que sugiere el nivel de fidelización del paciente (solo lo ve y lo aplica quien tiene permiso de descuentos; queda con su motivo) y el total. */}
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    {puedeDescontar && beneficioFidelidad?.descuento > 0 && lineas.length > 0 && (
                      <>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{beneficioFidelidad.nivel.nombre} · {beneficioFidelidad.descuento} % sugerido</span>
                        {lineas.some((l) => l.descuentoTipo)
                          ? <span className="text-sm text-slate-500">Ya hay descuentos en esta venta</span>
                          : <button type="button" onClick={aplicarDescuentoFidelidad} className="text-sm font-bold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">Aplicar descuento</button>}
                      </>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    {totalDescuento > 0 && (
                      <p className="text-xs text-slate-500">Subtotal <span className="font-mono">{dinero(bruto)}</span> · Descuento <span className="font-mono">-{dinero(totalDescuento)}</span></p>
                    )}
                    <p className="flex items-baseline justify-end gap-2"><span className="font-serif text-2xl font-bold" style={{ color: INK }}>Total</span><span className="font-serif text-3xl font-bold tabular-nums" style={{ color: INK }} aria-label={`Total ${dinero(total)}`}>{dinero(total)}</span></p>
                  </div>
                </div>

                {/* El pago de hoy: todo, una parte o nada (el resto queda como saldo) y con qué se paga. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="venta-pago-hoy" className="mb-1.5 block text-sm font-semibold text-slate-600">Pago hoy</label>
                    <input id="venta-pago-hoy" type="number" min="0" step="0.01" inputMode="decimal" value={textoPagoHoy} onChange={(e) => setPagoHoy(e.target.value)} className={CAMPO + " font-mono"} />
                  </div>
                  {pagoNum > 0 ? <CamposPagos filas={filasPago} onChange={setFilasPago} total={Math.min(pagoNum, total || pagoNum)} idBase="venta" /> : <div />}
                </div>
                {pagoNum < total && (
                  <p className="text-xs text-slate-500">{pagoNum > 0 ? `Quedan ${dinero(saldoQueda)} por cobrar: la venta queda con saldo y se cobra con abonos.` : `No se cobra nada hoy: toda la venta (${dinero(total)}) queda con saldo y se cobra con abonos.`}</p>
                )}

                {error && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertTriangle size={14} /> {error}
                  </div>
                )}
              </>
            )}
          </div>
    </Cascaron>
  )
}
