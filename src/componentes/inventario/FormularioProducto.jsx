"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, Pencil, Plus } from "lucide-react"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import CampoCategoria from "../CampoCategoria"
import CampoImagenProducto from "../CampoImagenProducto"
import { CATEGORIA_MONTURA, margenDe } from "../../utilidades/inventarioKardex"
import { dinero } from "../../utilidades/formatoMoneda"

const CAMPO = "w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 "
const OK = "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50"
const MAL = "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100"
const ETIQUETA = "mb-1.5 block text-sm font-semibold text-slate-700"

const texto = (v) => (v === null || v === undefined ? "" : String(v))
const entero = (v) => (v === "" ? null : Math.max(0, parseInt(v, 10) || 0) || null)

// Crear y editar son el mismo formulario (regla 31): mismos campos y mismo botón principal; el título dice el modo.
// Al crear se pide la existencia inicial; al editar la existencia no se toca aquí: se cambia con "Registrar ingreso" o "Ajustar stock",
// que dejan su motivo en el kárdex. Los datos de la montura son opcionales y van plegados mientras estén vacíos.
export default function FormularioProducto({ producto = null, categorias, setCategorias, umbralStock, opticaId, productos = [], puedeVerCosto = true, sinAnimarFondo = false, onGuardar, onCerrar }) {
  const editando = !!producto
  const [d, setD] = useState(() => ({
    nombre: producto?.nombre || "", categoria: producto?.categoria || categorias[0] || CATEGORIA_MONTURA,
    stock: "", precio: producto ? texto(producto.precio) : "", costo: texto(producto?.costo), critico: texto(producto?.critico), observacion: producto?.observacion || "",
    codigo: producto?.codigo || "", marca: producto?.marca || "", modelo: producto?.modelo || "", color: producto?.color || "", proveedor: producto?.proveedor || "",
    calibre: texto(producto?.calibre), puente: texto(producto?.puente), varilla: texto(producto?.varilla), imagen: producto?.imagen_url || null,
  }))
  const hayDatos = !!(d.codigo || d.marca || d.modelo || d.color || d.proveedor || d.calibre || d.puente || d.varilla || d.costo)
  const [abierto, setAbierto] = useState(editando && hayDatos)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const set = (campo, valor) => setD((p) => ({ ...p, [campo]: valor }))
  const esMontura = d.categoria === CATEGORIA_MONTURA
  const precioNum = parseFloat(d.precio)
  const margen = d.costo !== "" && !isNaN(precioNum) ? margenDe({ precio: precioNum, costo: parseFloat(d.costo) }) : null

  const enviar = async (e) => {
    e.preventDefault()
    const stockNum = parseInt(d.stock, 10)
    const costoNum = d.costo === "" ? null : parseFloat(d.costo)
    const errs = {}
    if (!d.nombre.trim()) errs.nombre = "Escribe una descripción para el producto."
    if (!editando && (d.stock === "" || isNaN(stockNum) || stockNum < 0)) errs.stock = "Ingresa una cantidad válida (0 o más)."
    if (d.precio === "" || isNaN(precioNum) || precioNum < 0) errs.precio = "Ingresa un precio válido."
    if (costoNum !== null && (isNaN(costoNum) || costoNum < 0)) errs.costo = "El costo debe ser 0 o más."
    const repetido = productos.find((p) => p.id !== producto?.id && p.nombre.trim().toLowerCase() === d.nombre.trim().toLowerCase())
    if (!errs.nombre && repetido) {
      errs.nombre = repetido.activo === false
        ? `"${repetido.nombre}" ya existe pero está descontinuado. Reactívalo desde "Ver descontinuados" en vez de crear uno nuevo.`
        : `Ya existe "${repetido.nombre}" en el inventario. Ábrelo y usa "Registrar ingreso" para sumar unidades.`
    }
    const codigo = d.codigo.trim()
    if (codigo) {
      const igual = productos.find((p) => p.id !== producto?.id && (p.codigo || "").trim().toLowerCase() === codigo.toLowerCase())
      if (igual) errs.codigo = `El código ya lo tiene "${igual.nombre}".`
    }
    for (const campo of ["calibre", "puente", "varilla"]) if (d[campo] !== "" && !(parseInt(d[campo], 10) >= 1 && parseInt(d[campo], 10) <= 300)) errs[campo] = "Entre 1 y 300 mm."
    setErrores(errs)
    if (Object.keys(errs).length > 0) {
      if (errs.codigo || errs.calibre || errs.puente || errs.varilla || errs.costo) setAbierto(true)
      return
    }
    const cambios = {
      nombre: d.nombre.trim(), categoria: d.categoria, precio: precioNum, observacion: d.observacion.trim(),
      critico: d.critico === "" ? null : Math.max(0, parseInt(d.critico, 10) || 0), imagen_url: d.imagen || null,
      codigo: codigo || null, marca: d.marca.trim() || null, modelo: d.modelo.trim() || null, color: d.color.trim() || null, proveedor: d.proveedor.trim() || null,
      calibre: esMontura ? entero(d.calibre) : null, puente: esMontura ? entero(d.puente) : null, varilla: esMontura ? entero(d.varilla) : null,
      ...(puedeVerCosto ? { costo: costoNum } : {}),
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
      subtitulo={editando ? producto.nombre : "Describe la montura o el accesorio. Las lunas no van en el inventario: se escriben al vender."}
      Icono={editando ? Pencil : Plus} ancho="max-w-xl" sinAnimarFondo={sinAnimarFondo} onCerrar={onCerrar} formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar={editando ? "Guardar cambios" : "Guardar producto"} guardando={guardando} />}
    >
      <div className="space-y-4 p-6">
        <CampoImagenProducto opticaId={opticaId} valor={d.imagen} onCambio={(v) => set("imagen", v)} />
        <div>
          <label className={ETIQUETA}>Categoría</label>
          <CampoCategoria valor={d.categoria} onChange={(v) => set("categoria", v)} categorias={categorias} setCategorias={setCategorias} />
        </div>
        <div>
          <label htmlFor="inv-nombre" className={ETIQUETA}>Descripción de la montura o accesorio</label>
          <input id="inv-nombre" type="text" required value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Montura 1, marco negro, modelo X" className={CAMPO + (errores.nombre ? MAL : OK)} />
          {errores.nombre && <p className="mt-1 text-xs font-medium text-red-600">{errores.nombre}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {editando ? (
            <div>
              <span className={ETIQUETA}>Existencia</span>
              <p className="rounded-xl border border-slate-200/60 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">{Number(producto.stock) || 0} u.</p>
              <p className="mt-1 text-xs text-slate-500">Se cambia con «Registrar ingreso» o «Ajustar stock».</p>
            </div>
          ) : (
            <div>
              <label htmlFor="inv-stock" className={ETIQUETA}>Existencia inicial</label>
              <input id="inv-stock" type="number" min="0" step="1" required value={d.stock} onChange={(e) => set("stock", e.target.value)} placeholder="10" className={CAMPO + (errores.stock ? MAL : OK)} />
              {errores.stock && <p className="mt-1 text-xs font-medium text-red-600">{errores.stock}</p>}
            </div>
          )}
          <div>
            <label htmlFor="inv-precio" className={ETIQUETA}>Precio ($)</label>
            <input id="inv-precio" type="number" min="0" step="0.01" required value={d.precio} onChange={(e) => set("precio", e.target.value)} placeholder="45.00" className={CAMPO + (errores.precio ? MAL : OK)} />
            {errores.precio && <p className="mt-1 text-xs font-medium text-red-600">{errores.precio}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/60">
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-left cursor-pointer hover:bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">{esMontura ? "Datos de la montura" : "Más datos del producto"} <span className="font-normal text-slate-500">(opcionales)</span></span>
            <ChevronDown size={16} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
          </button>
          {abierto && (
            <div className="space-y-3 border-t border-slate-100 p-3.5">
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
                  <p className="mt-1 text-xs text-slate-500">Cuando una venta incluye esta montura, la orden de laboratorio las trae escritas (calibre-puente-varilla).</p>
                </fieldset>
              )}
              <div className={"grid gap-3 " + (puedeVerCosto ? "grid-cols-2" : "grid-cols-1")}>
                <div><label htmlFor="inv-proveedor" className={ETIQUETA}>Proveedor</label><input id="inv-proveedor" value={d.proveedor} onChange={(e) => set("proveedor", e.target.value)} maxLength={80} className={CAMPO + OK} /></div>
                {puedeVerCosto && (
                  <div>
                    <label htmlFor="inv-costo" className={ETIQUETA}>Costo ($)</label>
                    <input id="inv-costo" type="number" min="0" step="0.01" value={d.costo} onChange={(e) => set("costo", e.target.value)} placeholder="22.00" className={CAMPO + (errores.costo ? MAL : OK)} />
                    {errores.costo ? <p className="mt-1 text-xs font-medium text-red-600">{errores.costo}</p> : margen && <p className="mt-1 text-xs text-slate-500">Margen: {dinero(margen.monto)}{margen.porcentaje !== null ? ` (${margen.porcentaje}%)` : ""}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="inv-critico" className={ETIQUETA}>Stock mínimo (alerta) <span className="font-normal text-slate-500">(opcional · vacío = {umbralStock})</span></label>
          <input id="inv-critico" type="number" min="0" step="1" value={d.critico} onChange={(e) => set("critico", e.target.value)} placeholder={String(umbralStock)} className={CAMPO + OK} />
        </div>
        <div>
          <label htmlFor="inv-observacion" className={ETIQUETA}>Observación <span className="font-normal text-slate-500">(opcional)</span></label>
          <textarea id="inv-observacion" value={d.observacion} onChange={(e) => set("observacion", e.target.value)} rows={2} placeholder="Ej. Incluye estuche." className={CAMPO + "resize-none " + OK} />
        </div>
        {errores.general && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {errores.general}</div>
        )}
      </div>
    </Cascaron>
  )
}
