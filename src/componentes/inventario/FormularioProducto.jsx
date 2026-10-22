"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, Pencil, Plus } from "lucide-react"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import CampoCategoria from "../CampoCategoria"
import CampoImagenProducto from "../CampoImagenProducto"
import { CATEGORIA_MONTURA, margenDe } from "../../utilidades/inventarioKardex"
import { UMBRAL_STOCK_MAXIMO, TOPE_STOCK, productoExistente } from "../../utilidades/inventario"
import { dinero } from "../../utilidades/formatoMoneda"

const CAMPO = "w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 "
const OK = "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50"
const MAL = "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100"
const ETIQUETA = "mb-1.5 block text-sm font-semibold text-slate-600"

const texto = (v) => (v === null || v === undefined ? "" : String(v))
const entero = (v) => (v === "" ? null : Math.max(0, parseInt(v, 10) || 0) || null)

// Crear y editar son el mismo formulario (regla 31): mismos campos y mismo botón principal; el título dice el modo.
// Al crear se pide la existencia inicial; al editar la existencia no se toca aquí: se cambia con "Registrar ingreso" o "Ajustar stock",
// que dejan su motivo en el kárdex. Lo de siempre va a la vista (categoría, descripción, existencia, precio, costo, mínimo y máximo); los datos de la montura son opcionales y van plegados mientras estén vacíos.
// El stock mínimo y el máximo son «Usar el general» (los de Configuración → Inventario) o uno propio. Si el producto ya existe (activo o descontinuado) se avisa en el momento y, si está descontinuado, se ofrece reactivarlo.
export default function FormularioProducto({ producto = null, categorias, setCategorias, umbralStock, maximoStock = UMBRAL_STOCK_MAXIMO, opticaId, productos = [], puedeVerCosto = true, sinAnimarFondo = false, onGuardar, onCerrar, onReactivar = null }) {
  const editando = !!producto
  const [d, setD] = useState(() => ({
    nombre: producto?.nombre || "", categoria: producto?.categoria || categorias[0] || CATEGORIA_MONTURA,
    stock: "", precio: producto ? texto(producto.precio) : "", costo: texto(producto?.costo), critico: texto(producto?.critico), maximo: texto(producto?.maximo), observacion: producto?.observacion || "",
    codigo: producto?.codigo || "", marca: producto?.marca || "", modelo: producto?.modelo || "", color: producto?.color || "", proveedor: producto?.proveedor || "",
    calibre: texto(producto?.calibre), puente: texto(producto?.puente), varilla: texto(producto?.varilla), imagen: producto?.imagen_url || null,
  }))
  const hayDatos = !!(d.codigo || d.marca || d.modelo || d.color || d.proveedor || d.calibre || d.puente || d.varilla || d.imagen || d.observacion)
  const [abierto, setAbierto] = useState(editando && hayDatos)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const set = (campo, valor) => setD((p) => ({ ...p, [campo]: valor }))
  const esMontura = d.categoria === CATEGORIA_MONTURA
  const precioNum = parseFloat(d.precio)
  const margen = d.costo !== "" && !isNaN(precioNum) ? margenDe({ precio: precioNum, costo: parseFloat(d.costo) }) : null
  // El producto que ya se llama así (activo o descontinuado): se avisa mientras se escribe, no al guardar.
  const existente = productoExistente(productos, d.nombre, producto?.id)

  const enviar = async (e) => {
    e.preventDefault()
    const stockNum = parseInt(d.stock, 10)
    const costoNum = d.costo === "" ? null : parseFloat(d.costo)
    const errs = {}
    if (!d.nombre.trim()) errs.nombre = "Escribe una descripción para el producto."
    if (!editando && (d.stock === "" || isNaN(stockNum) || stockNum < 0)) errs.stock = "Ingresa una cantidad válida (0 o más)."
    if (d.precio === "" || isNaN(precioNum) || precioNum < 0) errs.precio = "Ingresa un precio válido."
    if (costoNum !== null && (isNaN(costoNum) || costoNum < 0)) errs.costo = "El costo debe ser 0 o más."
    if (!errs.nombre && existente) {
      errs.nombre = existente.activo === false
        ? `«${existente.nombre}» ya existe pero está descontinuado. Reactívalo en vez de crear uno nuevo.`
        : `Ya existe «${existente.nombre}» en el inventario. Ábrelo y usa «Registrar ingreso» para sumar unidades.`
    }
    const minimoNum = d.critico === "" ? null : parseInt(d.critico, 10)
    const maximoNum = d.maximo === "" ? null : parseInt(d.maximo, 10)
    if (minimoNum !== null && !(minimoNum >= 0 && minimoNum <= TOPE_STOCK)) errs.critico = `El mínimo debe estar entre 0 y ${TOPE_STOCK}.`
    if (maximoNum !== null && !(maximoNum >= 1 && maximoNum <= TOPE_STOCK)) errs.maximo = `El máximo debe estar entre 1 y ${TOPE_STOCK}.`
    if (!errs.critico && !errs.maximo && (maximoNum !== null || minimoNum !== null) && (maximoNum ?? maximoStock) <= (minimoNum ?? umbralStock)) errs.maximo = "El máximo debe ser mayor que el mínimo."
    const codigo = d.codigo.trim()
    if (codigo) {
      const igual = productos.find((p) => p.id !== producto?.id && (p.codigo || "").trim().toLowerCase() === codigo.toLowerCase())
      if (igual) errs.codigo = `El código ya lo tiene «${igual.nombre}».`
    }
    for (const campo of ["calibre", "puente", "varilla"]) if (d[campo] !== "" && !(parseInt(d[campo], 10) >= 1 && parseInt(d[campo], 10) <= 300)) errs[campo] = "Entre 1 y 300 mm."
    setErrores(errs)
    if (Object.keys(errs).length > 0) {
      if (errs.codigo || errs.calibre || errs.puente || errs.varilla) setAbierto(true)
      return
    }
    const cambios = {
      nombre: d.nombre.trim(), categoria: d.categoria, precio: precioNum, observacion: d.observacion.trim(),
      critico: minimoNum, imagen_url: d.imagen || null,
      codigo: codigo || null, marca: d.marca.trim() || null, modelo: d.modelo.trim() || null, color: d.color.trim() || null, proveedor: d.proveedor.trim() || null,
      calibre: esMontura ? entero(d.calibre) : null, puente: esMontura ? entero(d.puente) : null, varilla: esMontura ? entero(d.varilla) : null,
      ...(puedeVerCosto ? { costo: costoNum } : {}),
      // El máximo solo viaja si hay algo que guardar o cambió: así un producto que no lo usa se guarda igual que siempre.
      ...((editando ? maximoNum !== (producto.maximo ?? null) : maximoNum !== null) ? { stock_maximo: maximoNum } : {}),
      ...(editando ? {} : { stock: stockNum }),
    }
    setGuardando(true)
    const error = await onGuardar(cambios)
    setGuardando(false)
    if (error) setErrores({ general: error })
  }

  return (
    <Cascaron
      titulo={editando ? "Editar producto" : "Agregar producto"}
      subtitulo={editando ? producto.nombre : "Monturas y accesorios. Las lunas se escriben en la venta."}
      Icono={editando ? Pencil : Plus} ancho="max-w-xl" sinAnimarFondo={sinAnimarFondo} onCerrar={onCerrar} formulario={{ onSubmit: enviar, noValidate: true }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar={editando ? "Guardar cambios" : "Guardar producto"} guardando={guardando} />}
    >
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <label className={ETIQUETA}>Categoría</label>
            <CampoCategoria valor={d.categoria} onChange={(v) => set("categoria", v)} categorias={categorias} setCategorias={setCategorias} />
          </div>
          <div>
            <label htmlFor="inv-nombre" className={ETIQUETA}>Descripción</label>
            <input id="inv-nombre" type="text" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Montura 1, marco negro, modelo X" className={CAMPO + (errores.nombre ? MAL : OK)} />
          </div>
        </div>
        {/* El producto que ya existe, avisado en el momento. */}
        {existente && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="min-w-0">
              Ya existe <strong>«{existente.nombre}»</strong> en <strong>{existente.activo === false ? "Descontinuados" : "Activos"}</strong> ({Number(existente.stock) || 0} u.).
              {existente.activo !== false && " Para sumar unidades, registra un ingreso."}
            </p>
            {existente.activo === false && onReactivar && <button type="button" onClick={() => onReactivar(existente)} className="shrink-0 text-sm font-bold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">Reactivarlo</button>}
          </div>
        )}
        {errores.nombre && !existente && <p className="-mt-2 text-xs font-medium text-red-600">{errores.nombre}</p>}

        <div className={"grid grid-cols-1 gap-3 " + (puedeVerCosto ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {editando ? (
            <div>
              <span className={ETIQUETA}>Existencia</span>
              <p className="rounded-xl border border-slate-200/60 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">{Number(producto.stock) || 0} u.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="inv-stock" className={ETIQUETA}>Existencia inicial</label>
              <input id="inv-stock" type="number" min="0" step="1" value={d.stock} onChange={(e) => set("stock", e.target.value)} placeholder="10" className={CAMPO + (errores.stock ? MAL : OK)} />
              {errores.stock && <p className="mt-1 text-xs font-medium text-red-600">{errores.stock}</p>}
            </div>
          )}
          <div>
            <label htmlFor="inv-precio" className={ETIQUETA}>Precio</label>
            <input id="inv-precio" type="number" min="0" step="0.01" value={d.precio} onChange={(e) => set("precio", e.target.value)} placeholder="45.00" className={CAMPO + (errores.precio ? MAL : OK)} />
            {errores.precio && <p className="mt-1 text-xs font-medium text-red-600">{errores.precio}</p>}
          </div>
          {puedeVerCosto && (
            <div>
              <label htmlFor="inv-costo" className={ETIQUETA}>Costo (opcional)</label>
              <input id="inv-costo" type="number" min="0" step="0.01" value={d.costo} onChange={(e) => set("costo", e.target.value)} placeholder="22.00" className={CAMPO + (errores.costo ? MAL : OK)} />
              {errores.costo ? <p className="mt-1 text-xs font-medium text-red-600">{errores.costo}</p> : margen && <p className="mt-1 text-xs text-slate-500">Margen: {dinero(margen.monto)}{margen.porcentaje !== null ? ` (${margen.porcentaje}%)` : ""}</p>}
            </div>
          )}
        </div>
        {editando && <p className="-mt-2 text-xs text-slate-500">La existencia se cambia con «Registrar ingreso» o «Ajustar stock».</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="inv-critico" className={ETIQUETA}>Stock mínimo</label>
            <input id="inv-critico" type="number" min="0" step="1" value={d.critico} onChange={(e) => set("critico", e.target.value)} placeholder={`Usar el general (${umbralStock})`} className={CAMPO + (errores.critico ? MAL : OK)} />
            {errores.critico && <p className="mt-1 text-xs font-medium text-red-600">{errores.critico}</p>}
          </div>
          <div>
            <label htmlFor="inv-maximo" className={ETIQUETA}>Stock máximo</label>
            <input id="inv-maximo" type="number" min="1" step="1" value={d.maximo} onChange={(e) => set("maximo", e.target.value)} placeholder={`Usar el general (${maximoStock})`} className={CAMPO + (errores.maximo ? MAL : OK)} />
            {errores.maximo && <p className="mt-1 text-xs font-medium text-red-600">{errores.maximo}</p>}
          </div>
        </div>
        <p className="-mt-2 text-sm text-slate-500">Los valores generales se cambian en Configuración → Inventario. Aquí solo si este producto necesita otros. El máximo no limita: solo avisa.</p>

        <div className="rounded-xl border border-slate-200/60">
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-left cursor-pointer hover:bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">{esMontura ? "Datos de la montura y foto" : "Foto y más datos del producto"} <span className="font-normal text-slate-500">(opcionales)</span></span>
            <ChevronDown size={16} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
          </button>
          {abierto && (
            <div className="space-y-3 border-t border-slate-100 p-3.5">
              <CampoImagenProducto opticaId={opticaId} valor={d.imagen} onCambio={(v) => set("imagen", v)} />
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="inv-codigo" className={ETIQUETA}>Código</label><input id="inv-codigo" value={d.codigo} onChange={(e) => set("codigo", e.target.value)} maxLength={40} className={CAMPO + (errores.codigo ? MAL : OK)} />{errores.codigo && <p className="mt-1 text-xs font-medium text-red-600">{errores.codigo}</p>}</div>
                <div><label htmlFor="inv-marca" className={ETIQUETA}>Marca</label><input id="inv-marca" value={d.marca} onChange={(e) => set("marca", e.target.value)} maxLength={60} className={CAMPO + OK} /></div>
                <div><label htmlFor="inv-modelo" className={ETIQUETA}>Modelo</label><input id="inv-modelo" value={d.modelo} onChange={(e) => set("modelo", e.target.value)} maxLength={60} className={CAMPO + OK} /></div>
                <div><label htmlFor="inv-color" className={ETIQUETA}>Color</label><input id="inv-color" value={d.color} onChange={(e) => set("color", e.target.value)} maxLength={40} className={CAMPO + OK} /></div>
              </div>
              {esMontura && (
                <fieldset>
                  <legend className={ETIQUETA}>Medidas (mm)</legend>
                  <div className="grid grid-cols-3 gap-3">
                    {[["calibre", "Calibre", "52"], ["puente", "Puente", "18"], ["varilla", "Varilla", "140"]].map(([campo, nombre, ejemplo]) => (
                      <div key={campo}>
                        <input aria-label={nombre} type="number" min="1" max="300" step="1" value={d[campo]} onChange={(e) => set(campo, e.target.value)} placeholder={`${nombre} · ${ejemplo}`} className={CAMPO + (errores[campo] ? MAL : OK)} />
                        {errores[campo] && <p className="mt-1 text-xs font-medium text-red-600">{errores[campo]}</p>}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Cuando una venta incluye esta montura, el pedido las trae escritas (calibre-puente-varilla).</p>
                </fieldset>
              )}
              <div><label htmlFor="inv-proveedor" className={ETIQUETA}>Proveedor</label><input id="inv-proveedor" value={d.proveedor} onChange={(e) => set("proveedor", e.target.value)} maxLength={80} className={CAMPO + OK} /></div>
              <div>
                <label htmlFor="inv-observacion" className={ETIQUETA}>Observación</label>
                <textarea id="inv-observacion" value={d.observacion} onChange={(e) => set("observacion", e.target.value)} rows={2} placeholder="Ej. Incluye estuche." className={CAMPO + "resize-none " + OK} />
              </div>
            </div>
          )}
        </div>
        {errores.general && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {errores.general}</div>
        )}
      </div>
    </Cascaron>
  )
}
