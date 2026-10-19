"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { dioptriaTexto } from "../utilidades/refraccion"
import { useMemo, useState } from "react"
import { Receipt, Search, AlertTriangle, Plus, ArrowLeft, Wrench, Printer, Stethoscope, UserX, ChevronDown, Glasses, BadgePercent } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { registrarLog } from "../utilidades/logs"
import { UMBRAL_STOCK_BAJO } from "../utilidades/inventario"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { puede } from "../utilidades/permisosUi"
import { Cascaron } from "../componentes/AtencionPaciente"
import CamposPagos, { FILAS_INICIALES } from "../componentes/ventas/CamposPagos"
import { brutoLinea, descuentoLinea, subtotalLinea, totalesDeLineas, errorDeDescuento, lineaParaRpc, TIPOS_DESCUENTO } from "../utilidades/descuentos"
import { filasParaTotal, revisarPagos, modalidadDePagos, textoPagos } from "../utilidades/pagos"
import CampoCategoria from "../componentes/CampoCategoria"
import CampoImagenProducto from "../componentes/CampoImagenProducto"
import MiniaturaProducto from "../componentes/MiniaturaProducto"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import OrdenLaboratorioModal from "../componentes/OrdenLaboratorioModal"
import { esLineaDeLente, TIPOS_LENTE, MATERIALES_LENTE } from "../utilidades/ordenesLaboratorio"
import { LEYENDA_INTERNO, TRATAMIENTOS_LUNA, descripcionLuna, detalleLuna, datosOrdenDeLinea, lunaDe, normalizarFacturaElectronica } from "../utilidades/comprobantes"
import { mapAbono, EVENTO_ABONO } from "../utilidades/abonos"
import { textoDiagnostico } from "../utilidades/pasesVenta"

// ─── Colores: el azul de la marca para los botones principales; el color de cada tipo de línea solo distingue el tipo ───
const GRAD = GRAD_MARCA // montura / accesorio
const VIOLETA = "#7c3aed" // tipo "servicio"
const AZUL_LUNA = "#0e7490" // tipo "luna"

// Panel de venta ÚNICO (propuesta de flujo de atención, Ronda 4): el mismo
// panel se usa al guardar la ficha clínica (consulta + lente precargados,
// "Más tarde" / "Cobrar y finalizar"), desde el perfil del paciente ("Nueva
// venta", vacío) y para cobrar un cobro pendiente.
//
// El documento que genera es un "comprobante de venta interno" (no una factura
// electrónica del SRI). La tabla y la función conservan su nombre técnico
// (facturas_venta, crear_factura_venta); en pantalla nunca se llama "factura",
// salvo el campo opcional con el número de la factura electrónica emitida por fuera.
//
// Bloque E (R57-R59): una venta tiene montura y accesorios (productos de inventario,
// los únicos que descuentan stock), la luna (línea de texto con precio, migración 0094)
// y servicios, y un solo método de pago para el total. Desde la Ronda 4 es
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
  subtitulo = "Montura, lunas y servicios: pago completo, en cuotas o con abonos.",
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
  // Sin paciente fijo (venta desde el módulo de Ventas) la sugerencia depende del paciente elegido:
  // recibe el paciente y devuelve { consultaId, citaId, etiqueta } o null.
  vinculoParaPaciente = null,
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

  const [productoId, setProductoId] = useState(null)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false)
  const [cantidadProducto, setCantidadProducto] = useState("1")

  // Luna (texto + precio): los mismos catálogos de tipo, material y tratamientos de la orden de laboratorio.
  const [luna, setLuna] = useState({ tipoLente: "monofocal", material: "", antirreflejo: false, filtroAzul: false, fotocromatico: false, otrosTratamientos: "" })
  const [precioLuna, setPrecioLuna] = useState("")
  const [facturaElectronica, setFacturaElectronica] = useState("")

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
  const vinculo = vinculoSugerido || (paciente && vinculoParaPaciente ? vinculoParaPaciente(paciente) : null)
  const consultaIdEfectivo = consultaId ?? (vinculo && vincular ? vinculo.consultaId : null)
  const citaIdEfectivo = citaId ?? (vinculo && vincular ? vinculo.citaId : null)
  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    const base = q ? pacientes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cedula || "").includes(q)) : pacientes
    return base.slice(0, 8)
  }, [pacientes, busquedaPaciente])

  // Cómo se paga: completo (al contado, con uno o varios métodos), en cuotas o con abonos (con un abono inicial opcional, también dividible).
  const [modalidad, setModalidad] = useState("completo")
  const [filasPago, setFilasPago] = useState(FILAS_INICIALES)
  const [filasAbono, setFilasAbono] = useState(FILAS_INICIALES)
  const [cuotasTotales, setCuotasTotales] = useState("3")
  const [abonoInicial, setAbonoInicial] = useState("")
  // Descontar es de quien puede corregir cobros (Ventas: editar); la base lo vuelve a exigir.
  const puedeDescontar = puede(usuario, "ventas", "editar")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const productoSeleccionado = inventario.find((p) => p.id === productoId) || null

  const productosFiltrados = useMemo(() => {
    const disponibles = inventario.filter((p) => (Number(p.stock) || 0) > 0 && p.activo !== false)
    const q = busquedaProducto.trim().toLowerCase()
    if (!q) return disponibles.slice(0, 8)
    return disponibles.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [inventario, busquedaProducto])

  const { bruto, descuento: totalDescuento, total } = useMemo(() => totalesDeLineas(lineas), [lineas])

  const limpiarCamposProducto = () => {
    setProductoId(null)
    setBusquedaProducto("")
    setCantidadProducto("1")
  }

  const agregarLineaProducto = () => {
    if (!productoSeleccionado) return
    const cant = parseInt(cantidadProducto, 10) || 0
    if (cant <= 0) { setError("Ingresa una cantidad válida."); return }
    if (cant > (Number(productoSeleccionado.stock) || 0)) { setError(`Solo hay ${productoSeleccionado.stock} u. disponibles en el inventario.`); return }
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
      errs.nombre = `Ya existe "${duplicado.nombre}" en el inventario (${duplicado.stock} u.). Búscalo arriba en vez de crearlo de nuevo.`
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

  const editarDescuento = (idx, cambios) => setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)))
  const quitarDescuento = (idx) => { editarDescuento(idx, { descuentoTipo: null, descuentoValor: null, descuentoMotivo: "" }) }
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
    // Marcó "incluye lentes" pero no registró la luna: sin tipo ni material no hay orden de laboratorio que armar.
    if (incluyeLentes && !hayLente) { setTipoLinea("luna"); setError("Registra la luna (tipo, material y filtros) para armar la orden de laboratorio, o desmarca \"Esta venta incluye lentes\" si es solo un servicio o una montura."); return }
    if (lineas.some((l) => l.precioTexto !== undefined && (l.precioTexto.trim() === "" || Number.isNaN(parseFloat(l.precioTexto)) || parseFloat(l.precioTexto) < 0))) {
      setError("Revisa los precios: cada uno debe ser un número de 0 en adelante."); return
    }
    for (const l of lineas) { const msg = errorDeDescuento(l); if (msg) { setError(msg); return } }
    const cuotasNum = modalidad === "cuotas" ? parseInt(cuotasTotales, 10) : null
    if (modalidad === "cuotas" && (!cuotasNum || cuotasNum < 1)) { setError("Ingresa un número de cuotas válido."); return }
    const abonoNum = modalidad === "abonos" && abonoInicial.trim() !== "" ? Math.round(parseFloat(abonoInicial) * 100) / 100 : 0
    if (modalidad === "abonos" && abonoInicial.trim() !== "" && (!(abonoNum > 0) || abonoNum > total)) { setError("El abono inicial debe ser mayor que cero y no superar el total."); return }

    // Cómo se paga lo que se cobra ahora: la venta completa (al contado) o el abono inicial. Cada uno, con uno o varios métodos.
    let pagosContado = null
    let pagosAbono = null
    if (modalidad === "completo" && total > 0) {
      const r = revisarPagos(filasParaTotal(filasPago, total), total)
      if (r.error) { setError(r.error); return }
      pagosContado = r.pagos
    }
    if (abonoNum > 0) {
      const r = revisarPagos(filasParaTotal(filasAbono, abonoNum), abonoNum)
      if (r.error) { setError(r.error); return }
      pagosAbono = r.pagos
    }
    const metodoPago = modalidad === "completo" ? modalidadDePagos(pagosContado || []) : modalidad

    const fe = normalizarFacturaElectronica(facturaElectronica)
    if (fe.demasiadoLargo) { setError("El número de la factura electrónica es demasiado largo (máximo 60 caracteres)."); return }

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
          p_cuotas_totales: cuotasNum,
          p_registrado_por: usuario?.id || null,
          ...(fe.valor ? { p_factura_electronica: fe.valor } : {}),
          ...(pagosContado ? { p_pagos: pagosContado } : {}),
        })
        .single()
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo registrar la venta. Revisa tu conexión e intenta de nuevo.")
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
        // El abono inicial se registra justo después de crear la venta (misma función que cualquier otro abono).
        const { data: ab, error: errorAbono } = await supabase.rpc("registrar_abono", { p_factura_id: data.id, p_monto: abonoNum, p_nota: "Abono inicial", p_pagos: pagosAbono }).single()
        if (errorAbono) {
          avisoAbono = "La venta se guardó, pero el abono inicial no se pudo registrar: regístralo desde el comprobante."
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
        numero: data.numero ?? null, facturaElectronica: fe.valor,
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

  // Venta guardada con lentes: sigue la orden de laboratorio (cerrarla o crearla después termina el flujo).
  if (ordenPara) {
    return (
      <OrdenLaboratorioModal
        paciente={paciente}
        facturaId={ordenPara.id}
        consultaId={ordenPara.consultaId}
        consulta={diagnostico}
        monturaInicial={ordenPara.lineas.find((l) => l.tipo === "producto")?.descripcion || ""}
        lunaInicial={datosOrdenDeLinea(lunaDe(ordenPara.lineas))}
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
        <button type="button" onClick={onMasTarde || onCerrar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
          {onMasTarde ? "Más tarde" : "Cancelar"}
        </button>
        <button type="submit" disabled={guardando} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60 cursor-pointer" style={{ background: GRAD_MARCA }}>
          {guardando ? "Guardando..." : etiquetaGuardar}
        </button>
      </div>
    </>
  )

  return (
    <Cascaron titulo={titulo} subtitulo={subtitulo} Icono={Receipt} ancho="max-w-xl" onCerrar={onCerrar} formulario={{ onSubmit: confirmarFactura }} pie={pie}>
          <div className="space-y-4 p-5">

            <div className="relative">
              <label htmlFor="comprobante-paciente" className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente</label>
              {pacienteFijo ? (
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{pacienteFijo.nombre}</div>
              ) : pacienteSel ? (
                <div className="flex items-center justify-between rounded-xl border border-blue-200/60 bg-blue-50 px-3 py-2.5">
                  <span className="truncate text-sm font-semibold text-blue-800">{pacienteSel.nombre}</span>
                  <button type="button" onClick={() => { setPacienteSel(null); setBusquedaPaciente("") }} aria-label="Cambiar paciente" className="text-sm font-bold text-blue-600 hover:text-blue-800 cursor-pointer">×</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="comprobante-paciente"
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

            {vinculo && !consultaId && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-blue-200/60 bg-blue-50/60 p-3 text-xs text-blue-900">
                <input type="checkbox" checked={vincular} onChange={(e) => setVincular(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span><span className="font-bold">{vinculo.etiqueta}</span><br />Si es esta venta, queda vinculada a la consulta y el paciente sale de la lista de espera. Desmárcalo si es otra compra.</span>
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

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Detalle de la venta</label>
              {lineas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-4 text-center text-xs text-slate-500">
                  Todavía no agregaste la montura, la luna ni ningún servicio.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {lineas.map((l, i) => (
                    <div key={i} className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {l.tipo === "producto" ? (
                            <MiniaturaProducto url={inventario.find((p) => p.id === l.productoId)?.imagen_url} alt={l.descripcion} size={24} />
                          ) : l.tipo === "luna" ? (
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700">
                              <Glasses size={13} aria-hidden="true" />
                            </span>
                          ) : (
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600">
                              <Wrench size={13} />
                            </span>
                          )}
                          <span className="truncate text-sm font-semibold text-slate-700" title={l.descripcion}>{l.descripcion}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {l.tipo === "servicio" || l.tipo === "luna" ? (
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
                            <span className="font-mono text-xs text-slate-500">{l.cantidad} × {dinero(l.precioUnitario)} = {dinero(brutoLinea(l))}</span>
                          )}
                          <button type="button" onClick={() => quitarLinea(i)} aria-label="Quitar línea" className="text-sm font-bold text-slate-400 hover:text-red-600 cursor-pointer">×</button>
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
                        <button type="button" onClick={() => editarDescuento(i, { descuentoTipo: "porcentaje", descuentoValor: "", descuentoMotivo: "" })} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">
                          <BadgePercent size={13} aria-hidden="true" /> Aplicar descuento
                        </button>
                      )}
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
                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer" style={{ background: GRAD }}>
                    {guardandoNp ? "Guardando..." : "Guardar y usar en esta venta"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTipoLinea("producto")}
                    className="flex-1 rounded-xl border py-2 text-sm font-bold transition cursor-pointer"
                    style={tipoLinea === "producto" ? { background: GRAD, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                    Montura / accesorio
                  </button>
                  <button type="button" onClick={() => setTipoLinea("luna")}
                    className="flex-1 rounded-xl border py-2 text-sm font-bold transition cursor-pointer"
                    style={tipoLinea === "luna" ? { backgroundColor: AZUL_LUNA, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                    Luna
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
                      <div className="flex items-center justify-between rounded-xl border border-blue-200/60 bg-blue-50 px-3 py-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <MiniaturaProducto url={productoSeleccionado.imagen_url} alt={productoSeleccionado.nombre} size={22} />
                          <span className="truncate text-sm font-semibold text-blue-800">{productoSeleccionado.nombre}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-700">{productoSeleccionado.stock} u. · {dinero(Number(productoSeleccionado.precio))}</span>
                          <button type="button" onClick={limpiarCamposProducto} className="text-sm font-bold text-blue-600 hover:text-blue-800 cursor-pointer">×</button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text" placeholder="Buscar montura o accesorio con stock..."
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
                                <span className="shrink-0 font-mono text-xs text-slate-400">{p.stock} u. · {dinero(Number(p.precio))}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {mostrarDropdownProducto && busquedaProducto && productosFiltrados.length === 0 && (
                          <p className="mt-1.5 text-xs text-slate-500">Ninguna montura o accesorio con stock coincide.</p>
                        )}
                        <button type="button" onClick={abrirAltaProducto} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          <Plus size={13} /> ¿No lo encuentras? Registrar montura o accesorio nuevo
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
                ) : tipoLinea === "luna" ? (
                  <div className="space-y-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                    <p className="text-xs text-slate-500">La luna se escribe aquí, no sale del inventario. Lo que elijas llena la orden de laboratorio.</p>
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

                <div className="space-y-1 border-t border-slate-100 pt-3">
                  {totalDescuento > 0 && (
                    <>
                      <p className="flex items-center justify-between text-sm text-slate-600"><span>Subtotal</span><span className="font-mono">{dinero(bruto)}</span></p>
                      <p className="flex items-center justify-between text-sm text-slate-600"><span>Descuento</span><span className="font-mono">-{dinero(totalDescuento)}</span></p>
                    </>
                  )}
                  <p className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-600">Total</span><span className="font-mono text-xl font-bold text-slate-800">{dinero(total)}</span></p>
                </div>

                <div>
                  <label htmlFor="factura-electronica" className="mb-1.5 block text-sm font-semibold text-slate-700">Factura electrónica (SRI) <span className="font-normal text-slate-500">(opcional)</span></label>
                  <input id="factura-electronica" type="text" value={facturaElectronica}
                    onChange={(e) => setFacturaElectronica(e.target.value)}
                    onBlur={() => setFacturaElectronica((v) => normalizarFacturaElectronica(v).valor)}
                    placeholder="001-001-000000123"
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                  {facturaElectronica.trim() && !normalizarFacturaElectronica(facturaElectronica).formatoSri ? (
                    <p className="mt-1 text-xs text-amber-700">No tiene el formato 001-001-000000123 del SRI. Puedes guardarla igual si tu proveedor la numera distinto.</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Si ya emitiste la factura electrónica por fuera, escribe su número. Puedes agregarlo después. {LEYENDA_INTERNO}</p>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={incluyeLentes} onChange={(e) => { setCrearOrden(e.target.checked); if (e.target.checked && !hayLente) setTipoLinea("luna") }} className="mt-0.5 accent-blue-600" />
                  <span><span className="font-semibold">Esta venta incluye lentes</span><br /><span className="text-xs text-slate-500">Al guardarla se abre la orden de laboratorio, con la receta ya cargada. Si es solo un servicio (por ejemplo una extracción de cuerpo extraño) déjalo sin marcar.</span>{incluyeLentes && !hayLente && <span className="mt-1 block text-xs font-semibold text-amber-700">Falta registrar la luna: elige «Luna» arriba y agrega su tipo, material y filtros.</span>}</span>
                </label>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cómo paga</label>
                  <div role="group" aria-label="Cómo paga" className="flex gap-2">
                    {[{ v: "completo", t: "Pago completo" }, { v: "cuotas", t: "Cuotas" }, { v: "abonos", t: "Abonos" }].map((m) => (
                      <button key={m.v} type="button" aria-pressed={modalidad === m.v} onClick={() => setModalidad(m.v)}
                        className="flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors cursor-pointer"
                        style={modalidad === m.v ? { background: GRAD_MARCA, borderColor: "transparent", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>
                        {m.t}
                      </button>
                    ))}
                  </div>
                </div>

                {modalidad === "completo" && total > 0 && <CamposPagos filas={filasPago} onChange={setFilasPago} total={total} idBase="venta" />}

                {modalidad === "cuotas" && (
                  <div>
                    <label htmlFor="venta-cuotas" className="mb-1.5 block text-sm font-semibold text-slate-700">Número de cuotas</label>
                    <input id="venta-cuotas" type="number" min="1" step="1" value={cuotasTotales} onChange={(e) => setCuotasTotales(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                    <p className="mt-1 text-xs text-slate-500">Cada cuota se cobra después, desde el comprobante.</p>
                  </div>
                )}

                {modalidad === "abonos" && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="abono-inicial" className="mb-1.5 block text-sm font-semibold text-slate-700">Abono inicial (opcional)</label>
                      <input id="abono-inicial" type="number" min="0" step="0.01" max={total} value={abonoInicial} onChange={(e) => setAbonoInicial(e.target.value)} placeholder="0.00"
                        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-right font-mono text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                      <p className="mt-1 text-xs text-slate-500">El resto queda como saldo y se cobra con abonos de monto y fecha libres.</p>
                    </div>
                    {parseFloat(abonoInicial) > 0 && <CamposPagos filas={filasAbono} onChange={setFilasAbono} total={Math.round(parseFloat(abonoInicial) * 100) / 100} idBase="venta-abono" />}
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
    </Cascaron>
  )
}
