"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X, FlaskConical, Printer } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { registrarLog } from "../utilidades/logs"
import { imprimirHtml, datosOpticaProforma } from "../utilidades/proforma"
import { numeroComprobante, datosOrdenDeLinea } from "../utilidades/comprobantes"
import {
  EVENTO_ORDEN, MATERIALES_LENTE, TIPOS_LENTE, laboratoriosUsados, datosInicialesOrden, datosParaRpc, validarOrden, mapOrden, numeroOrden, armarHtmlOrdenDosCopias,
} from "../utilidades/ordenesLaboratorio"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const avisarOrdenGuardada = (orden) => window.dispatchEvent(new CustomEvent(EVENTO_ORDEN, { detail: orden }))

// Lo mínimo de la consulta que necesita la orden, a partir de la fila de la vista `consultas`.
const consultaMinima = (c) => ({
  od: c.datos_clinicos?.od, oi: c.datos_clinicos?.oi, medidas: c.datos_clinicos?.medidas, lenteRecomendado: c.lente_recomendado,
})

// Crear (o corregir) la orden de laboratorio de una venta con lentes (R36).
// Trae de la consulta lo que existe; quien vende completa el resto.
export default function OrdenLaboratorioModal({
  paciente, facturaId, consultaId = null, consulta = null, monturaInicial = "", lunaInicial = null, facturaNumero = null, orden = null,
  laboratoriosSugeridos: sugeridosIniciales = [], usuario, opticaDatos: datosIniciales = {}, onCreada, onActualizada, onCerrar,
}) {
  const [laboratoriosSugeridos, setLaboratoriosSugeridos] = useState(sugeridosIniciales)
  const [opticaDatos, setOpticaDatos] = useState(datosIniciales)
  const [d, setD] = useState(null)
  const [materialOtro, setMaterialOtro] = useState(!!orden?.material && !MATERIALES_LENTE.includes(orden.material))
  const [cargandoConsulta, setCargandoConsulta] = useState(!orden && !consulta && !!consultaId && !!supabase)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }
  const refModal = useModalAccesible(true, cerrar)

  useEffect(() => {
    if (orden) { setD({ ...orden }); return }
    // `vivo` evita que un armado anterior (por ejemplo el primero que React descarta al montar en desarrollo) llegue tarde
    // y pise con los datos iniciales lo que la persona ya escribió en el formulario.
    let vivo = true
    const armar = async (c) => {
      // La montura es la primera línea de producto de la venta y la luna (tipo, material, tratamientos) sale
      // de su línea de luna: se escriben una sola vez, en la venta (Bloque E).
      let montura = monturaInicial
      let luna = lunaInicial && Object.keys(lunaInicial).length > 0 ? lunaInicial : null
      if ((!montura || !luna) && supabase && facturaId) {
        const { data: lineas } = await supabase.from("facturas_venta_lineas").select("tipo, descripcion, detalle").eq("factura_id", facturaId).in("tipo", ["producto", "luna"])
        if (!montura) montura = (lineas || []).find((l) => l.tipo === "producto")?.descripcion || ""
        if (!luna) luna = datosOrdenDeLinea((lineas || []).find((l) => l.tipo === "luna"))
      }
      if (!vivo) return
      const base = datosInicialesOrden(c, { montura, luna })
      const entrega = new Date(); entrega.setDate(entrega.getDate() + 7)
      setD({ ...base, fechaPrometida: iso(entrega) })
    }
    if (consulta || !consultaId || !supabase) { armar(consulta); return () => { vivo = false } }
    supabase.from("consultas").select("datos_clinicos, lente_recomendado").eq("id", consultaId).maybeSingle().then(({ data }) => {
      if (!vivo) return
      armar(data ? consultaMinima(data) : null)
      setCargandoConsulta(false)
    })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sugerencias de laboratorio (los ya usados) y datos de contacto de la óptica para las copias.
  // Se piden aquí para que el modal funcione igual desde cualquier pantalla que lo abra.
  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vivo = true
    supabase.from("ordenes_laboratorio").select("laboratorio").not("laboratorio", "is", null).limit(300).then(({ data }) => {
      if (vivo && data) setLaboratoriosSugeridos(laboratoriosUsados(data.map((o) => ({ laboratorio: o.laboratorio }))))
    })
    supabase.from("opticas").select("settings").eq("id", usuario.opticaId).maybeSingle().then(({ data }) => {
      if (vivo && data) setOpticaDatos(datosOpticaProforma(data.settings))
    })
    return () => { vivo = false }
  }, [usuario?.opticaId])

  const set = (campo, valor) => setD((p) => ({ ...p, [campo]: valor }))
  const setOjo = (ojo, campo, valor) => setD((p) => ({ ...p, [ojo]: { ...p[ojo], [campo]: valor } }))

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
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo guardar la orden. Revisa tu conexión e intenta de nuevo.")
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
    registrarLog(usuario, "pacientes", orden ? "Corrigió una orden de laboratorio" : "Creó una orden de laboratorio", `${paciente?.nombre || ""} · ${guardada ? numeroOrden(guardada.numero) : ""}`)
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

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-labelledby="orden-lab-titulo" className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: GRAD }}><FlaskConical size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="orden-lab-titulo" className="text-base font-bold" style={{ color: INK }}>{orden ? `Orden ${numeroOrden(orden.numero)}` : "Nueva orden de laboratorio"}</h2>
              <p className="text-xs text-slate-500">{paciente?.nombre}{!orden && " · se precargó lo que hay en la consulta"}</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!d || cargandoConsulta ? (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando datos de la consulta">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Laboratorio</span>
                  <input list="laboratorios-usados" value={d.laboratorio} onChange={(e) => set("laboratorio", e.target.value)} maxLength={80} placeholder="¿A quién se envía?" className={CAMPO} />
                  <datalist id="laboratorios-usados">{laboratoriosSugeridos.map((l) => <option key={l} value={l} />)}</datalist>
                </label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Entrega prometida *</span>
                  <input type="date" value={d.fechaPrometida} onChange={(e) => set("fechaPrometida", e.target.value)} className={CAMPO} />
                </label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Tipo de lente *</span>
                  <select value={d.tipoLente} onChange={(e) => set("tipoLente", e.target.value)} className={CAMPO}>
                    {TIPOS_LENTE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>

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
                  {[["dpLejos", "DP lejos"], ["dpCerca", "DP cerca"], ["alturaMontaje", "Altura de montaje"]].map(([k, l]) => (
                    <label key={k} className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{l}</span>
                      <input value={d[k]} onChange={(e) => set(k, e.target.value)} maxLength={10} className={CAMPO + " font-mono"} />
                    </label>
                  ))}
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

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={cerrar} disabled={guardando} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">{orden ? "Cancelar" : "Crear después"}</button>
          <button type="button" onClick={() => guardar(false)} disabled={guardando || !d || cargandoConsulta} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">{guardando ? "Guardando…" : orden ? "Guardar cambios" : "Crear orden"}</button>
          {!orden && (
            <button type="button" onClick={() => guardar(true)} disabled={guardando || !d || cargandoConsulta} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
              <Printer size={14} aria-hidden="true" /> Crear e imprimir copias
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
