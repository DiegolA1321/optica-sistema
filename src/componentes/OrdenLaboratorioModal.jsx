import CampoFecha from "./CampoFecha"
"use client"

import { hoyISO } from "../utilidades/disponibilidad"
import { sumarDiasISO } from "../utilidades/controles"
import { useEffect, useRef, useState } from "react"
import { Package, Printer } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { Cascaron } from "./AtencionPaciente"
import { useParametrizacion } from "./ParametrizacionContexto"
import { ENTREGAS } from "../utilidades/ventasModulo"
import { fechaDePedidoPorDefecto } from "../utilidades/pedidosVenta"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, mensajeDeError } from "../utilidades/permisos"
import { registrarLog } from "../utilidades/logs"
import { medidasTexto } from "../utilidades/inventarioKardex"
import { imprimirHtml, datosOpticaProforma } from "../utilidades/proforma"
import { numeroComprobante, datosOrdenDeLinea } from "../utilidades/comprobantes"
import {
  EVENTO_ORDEN, MATERIALES_LENTE, TIPOS_LENTE, datosInicialesOrden, datosParaRpc, validarOrden, mapOrden, numeroOrden, armarHtmlOrdenDosCopias, alturasDeTexto, textoDeAlturas,
} from "../utilidades/ordenesLaboratorio"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

const avisarOrdenGuardada = (orden) => window.dispatchEvent(new CustomEvent(EVENTO_ORDEN, { detail: orden }))

// Lo mínimo de la consulta que necesita la orden, a partir de la fila de la vista `consultas`.
const consultaMinima = (c) => ({
  od: c.datos_clinicos?.od, oi: c.datos_clinicos?.oi, medidas: c.datos_clinicos?.medidas, lenteRecomendado: c.lente_recomendado,
})

// Crear (o corregir) la orden de laboratorio de una venta con lentes (R36).
// Trae de la consulta lo que existe; quien vende completa el resto.
export default function OrdenLaboratorioModal({
  paciente, facturaId, consultaId = null, consulta = null, monturaInicial = "", lunaInicial = null, facturaNumero = null, orden = null,
  usuario, opticaDatos: datosIniciales = {}, onCreada, onActualizada, onCerrar,
}) {
  const parametrizacion = useParametrizacion()
  const [opticaDatos, setOpticaDatos] = useState(datosIniciales)
  // El formulario aparece de inmediato con lo que ya se sabe; lo que hay que leer de la base (la consulta, las líneas de la venta, las medidas de la montura) llega después y se nota en un aviso,
  // sin pisar lo que la persona ya escribió (cada campo tocado se recuerda en `tocados`).
  const [d, setD] = useState(() => (orden
    ? { ...orden }
    : { ...datosInicialesOrden(consulta, { montura: monturaInicial, luna: lunaInicial && Object.keys(lunaInicial).length > 0 ? lunaInicial : null }), fechaPrometida: fechaDePedidoPorDefecto(parametrizacion) }))
  const [materialOtro, setMaterialOtro] = useState(!!orden?.material && !MATERIALES_LENTE.includes(orden.material))
  const [cargandoDatos, setCargandoDatos] = useState(!orden && !!supabase && (!!facturaId || (!consulta && !!consultaId)))
  const tocados = useRef(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }

  useEffect(() => {
    if (orden || !cargandoDatos) return
    // `vivo` evita que un armado anterior (por ejemplo el primero que React descarta al montar en desarrollo) llegue tarde.
    let vivo = true
    const NO_SE_PISA = ["fechaPrometida", "entrega", "direccionEntrega", "laboratorio"]
    const aplicar = (base) => setD((p) => {
      const n = { ...p }
      for (const k of Object.keys(base)) if (!tocados.current.has(k) && !NO_SE_PISA.includes(k)) n[k] = base[k]
      return n
    })
    ;(async () => {
      // La consulta y las líneas de la venta se piden a la vez; las medidas de la montura, en cuanto se sabe cuál es.
      const [{ data: c }, { data: lineas }] = await Promise.all([
        consulta || !consultaId ? { data: null } : supabase.from("consultas").select("datos_clinicos, lente_recomendado").eq("id", consultaId).maybeSingle(),
        facturaId ? supabase.from("facturas_venta_lineas").select("tipo, descripcion, detalle, producto_id").eq("factura_id", facturaId).in("tipo", ["producto", "luna"]) : { data: null },
      ])
      // La montura es la primera línea de producto de la venta y la luna (tipo, material, tratamientos) sale de su línea de luna: se escriben una sola vez, en la venta.
      const lineaMontura = (lineas || []).find((l) => l.tipo === "producto")
      const montura = monturaInicial || lineaMontura?.descripcion || ""
      const luna = lunaInicial && Object.keys(lunaInicial).length > 0 ? lunaInicial : datosOrdenDeLinea((lineas || []).find((l) => l.tipo === "luna"))
      const deConsulta = consulta || (c ? consultaMinima(c) : null)
      if (vivo) aplicar(datosInicialesOrden(deConsulta, { montura, luna, monturaMedidas: "" }))
      if (lineaMontura?.producto_id) {
        const { data: producto } = await supabase.from("inventario").select("calibre, puente, varilla").eq("id", lineaMontura.producto_id).maybeSingle()
        if (vivo) aplicar({ monturaMedidas: medidasTexto(producto) })
      }
      if (vivo) setCargandoDatos(false)
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Los datos de contacto de la óptica para las copias.
  // Se piden aquí para que el modal funcione igual desde cualquier pantalla que lo abra.
  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vivo = true
    supabase.from("opticas").select("settings").eq("id", usuario.opticaId).maybeSingle().then(({ data }) => {
      if (vivo && data) setOpticaDatos(datosOpticaProforma(data.settings, usuario?.opticaLogoUrl))
    })
    return () => { vivo = false }
  }, [usuario?.opticaId])

  const set = (campo, valor) => { tocados.current.add(campo); setD((p) => ({ ...p, [campo]: valor })) }
  const setOjo = (ojo, campo, valor) => { tocados.current.add(ojo); setD((p) => ({ ...p, [ojo]: { ...p[ojo], [campo]: valor } })) }

  const guardar = async (imprimir) => {
    const msg = validarOrden(d)
    if (msg) { setError(msg); return }
    setGuardando(true)
    setError("")
    let guardada = null
    if (supabase) {
      const rpc = orden
        ? supabase.rpc("actualizar_orden_laboratorio", { p_orden_id: orden.id, p_datos: datosParaRpc(d) })
        : supabase.rpc("crear_orden_laboratorio", { p_factura_id: facturaId, p_datos: datosParaRpc(d) })
      const { data, error: errorRpc } = await rpc
      if (errorRpc) {
        setError(mensajeDeError(errorRpc, "No se pudo guardar la orden. Revisa tu conexión e intenta de nuevo."))
        setGuardando(false)
        return
      }
      const id = orden ? orden.id : data
      const { data: fila, error: errorLeer } = await supabase.from("ordenes_laboratorio").select("*").eq("id", id).maybeSingle()
      if (errorLeer || !fila) {
        setError("La orden se guardó, pero no se pudo leer de nuevo. Recarga la página para verla.")
        setGuardando(false)
        return
      }
      guardada = mapOrden(fila)
    }
    registrarLog(usuario, "ventas", orden ? "Corrigió un pedido" : "Creó un pedido", `${paciente?.nombre || ""} · ${guardada ? numeroOrden(guardada.numero) : ""}`)
    setGuardando(false)
    if (guardada) {
      avisarOrdenGuardada(guardada)
      ;(orden ? onActualizada : onCreada)?.(guardada, { imprimir })
    }
    if (imprimir && guardada) {
      // El número del comprobante va en las dos copias (R36). Si no llegó por props, se lee de la venta.
      let numeroVenta = facturaNumero
      if (numeroVenta == null && supabase && facturaId) {
        const { data: f } = await supabase.from("facturas_venta").select("numero").eq("id", facturaId).maybeSingle()
        numeroVenta = f?.numero ?? null
      }
      imprimirHtml(armarHtmlOrdenDosCopias({ opticaNombre: usuario?.opticaNombre, opticaDatos, paciente, orden: { ...guardada, facturaNumero: numeroVenta != null ? numeroComprobante(numeroVenta) : "" } }))
    }
    onCerrar()
  }

  return (
    <Cascaron
      titulo={orden ? `Pedido ${numeroOrden(orden.numero)}` : "Pedido"}
      subtitulo={`${paciente?.nombre || ""}${!orden ? " · se precargó lo que hay en la consulta" : ""}`}
      Icono={Package}
      ancho="max-w-2xl"
      onCerrar={cerrar}
      pie={(
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={cerrar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">{orden ? "Cancelar" : "Crear después"}</button>
          <button type="button" onClick={() => guardar(false)} disabled={guardando || cargandoDatos} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">{guardando ? "Guardando…" : orden ? "Guardar cambios" : "Crear orden"}</button>
          {!orden && (
            <button type="button" onClick={() => guardar(true)} disabled={guardando || cargandoDatos} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
              <Printer size={14} aria-hidden="true" /> Crear e imprimir copias
            </button>
          )}
        </div>
      )}
    >
      <div className="space-y-4 px-5 py-4">
        {cargandoDatos && (
          <p role="status" aria-busy="true" className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" /> Cargando la receta y la montura de la venta…
          </p>
        )}
        {(
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Entrega</span>
                <select value={d.entrega === "envio" ? "envio" : "retira"} onChange={(e) => set("entrega", e.target.value)} className={CAMPO + " cursor-pointer"}>
                  {ENTREGAS.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
                </select>
              </label>
              <div className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Listo hacia el *</span>
                <CampoFecha id="orden-fecha-prometida" etiqueta="Fecha aproximada en que estará listo" requerido valor={d.fechaPrometida} onCambiar={(v) => set("fechaPrometida", v)} min={sumarDiasISO(hoyISO(), -365)} max={sumarDiasISO(hoyISO(), 365)} />
              </div>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Tipo de lente *</span>
                <select value={d.tipoLente} onChange={(e) => set("tipoLente", e.target.value)} className={CAMPO}>
                  {TIPOS_LENTE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            </div>

            {d.entrega === "envio" && (
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Dirección de envío *</span>
                <input value={d.direccionEntrega || ""} onChange={(e) => set("direccionEntrega", e.target.value)} maxLength={200} placeholder="Calle, número, ciudad y una referencia" className={CAMPO} />
              </label>
            )}

            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Receta</legend>
              <div className="grid grid-cols-[2.5rem_repeat(4,minmax(0,1fr))] items-center gap-2">
                <span />
                {["Esfera", "Cilindro", "Eje", "Adición"].map((h) => <span key={h} className="text-center text-xs font-semibold text-slate-500">{h}</span>)}
                {[["recetaOd", "OD"], ["recetaOi", "OI"]].map(([ojo, nombre]) => (
                  <div key={ojo} className="contents">
                    <span className="text-sm font-bold text-blue-700">{nombre}</span>
                    {["esfera", "cilindro", "eje", "adicion"].map((campo) => (
                      <input key={campo} aria-label={`${nombre} ${campo}`} value={d[ojo][campo]} onChange={(e) => setOjo(ojo, campo, e.target.value)} maxLength={8} className={CAMPO + " text-center font-mono"} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[["dpLejos", "DP lejos"], ["dpCerca", "DP cerca"]].map(([k, l]) => (
                  <label key={k} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{l}</span>
                    <input value={d[k]} onChange={(e) => set(k, e.target.value)} maxLength={10} className={CAMPO + " font-mono"} />
                  </label>
                ))}
              </div>
              {/* La altura de montaje depende de la montura: se toma aquí, por ojo, no en la ficha clínica. */}
              <div role="group" aria-label="Altura de montaje" className="mt-3">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Altura de montaje (mm), con la montura elegida</span>
                <div className="flex items-end gap-3">
                  {[["od", "Ojo derecho"], ["oi", "Ojo izquierdo"]].map(([lado, l]) => (
                    <label key={lado} className="block w-32"><span className="mb-1 block text-xs text-slate-500">{l}</span>
                      <input aria-label={`Altura de montaje, ${l.toLowerCase()}`} value={alturasDeTexto(d.alturaMontaje)[lado]} onChange={(e) => { const a = alturasDeTexto(d.alturaMontaje); set("alturaMontaje", textoDeAlturas(lado === "od" ? e.target.value : a.od, lado === "oi" ? e.target.value : a.oi)) }} maxLength={5} inputMode="decimal" placeholder="18" className={CAMPO + " text-center font-mono"} />
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Lente</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="orden-material" className="mb-1 block text-xs font-semibold text-slate-600">Material</label>
                  <select id="orden-material" value={materialOtro ? "__otro" : d.material} onChange={(e) => { if (e.target.value === "__otro") { setMaterialOtro(true); set("material", "") } else { setMaterialOtro(false); set("material", e.target.value) } }} className={CAMPO}>
                    <option value="">Sin especificar</option>
                    {MATERIALES_LENTE.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="__otro">Otro…</option>
                  </select>
                  {materialOtro && <input aria-label="Material (otro)" value={d.material} onChange={(e) => set("material", e.target.value)} maxLength={60} placeholder="Escribe el material" className={CAMPO + " mt-2"} />}
                </div>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1.5 pb-1.5 text-sm text-slate-700">
                  {[["antirreflejo", "Antirreflejo"], ["filtroAzul", "Filtro azul"], ["fotocromatico", "Fotocromático"]].map(([k, l]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={d[k]} onChange={(e) => set(k, e.target.checked)} className="accent-blue-600" />{l}</label>
                  ))}
                </div>
              </div>
              <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Otros tratamientos</span>
                <input value={d.otrosTratamientos} onChange={(e) => set("otrosTratamientos", e.target.value)} maxLength={120} className={CAMPO} />
              </label>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Montura</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Montura</span>
                  <input value={d.montura} onChange={(e) => set("montura", e.target.value)} maxLength={120} className={CAMPO} />
                </label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Medidas (calibre-puente-varilla)</span>
                  <input value={d.monturaMedidas} onChange={(e) => set("monturaMedidas", e.target.value)} maxLength={40} placeholder="52-18-140" className={CAMPO + " font-mono"} />
                </label>
              </div>
            </fieldset>

            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Observaciones</span>
              <textarea rows={2} value={d.observaciones} onChange={(e) => set("observaciones", e.target.value)} maxLength={400} className={CAMPO + " resize-none"} />
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          </>
        )}
      </div>

    </Cascaron>
  )
}
