"use client"

import { useEffect, useState } from "react"
import { Image as ImageIcon, Save, Loader2, Check } from "lucide-react"
import { supabase } from "../lib/supabaseClient"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const SERVICIOS_VACIOS = () => Array.from({ length: 3 }, () => ({ titulo: "", texto: "", features: ["", "", ""], imagenUrl: "" }))

const marcaAFormulario = (marca, logoUrl) => ({
  nombreMarca: marca?.nombreMarca || "",
  eslogan: marca?.eslogan || "",
  colorAcento: marca?.colorAcento || "#2563EB",
  colorSecundario: marca?.colorSecundario || "",
  serviciosActivos: marca?.serviciosActivos !== false,
  mensaje: marca?.mensaje || "",
  servicios: marca?.servicios?.length === 3
    ? marca.servicios.map((s) => ({ titulo: s.titulo || "", texto: s.texto || "", features: [s.features?.[0] || "", s.features?.[1] || "", s.features?.[2] || ""], imagenUrl: s.imagenUrl || "" }))
    : SERVICIOS_VACIOS(),
  // "Oscuro" es el logo histórico (columna logo_url): se usa en la barra
  // superior, el pie de página y el encabezado del modal de login — los tres
  // sitios donde el logo va sobre un fondo oscuro. "Claro" es nuevo (dentro
  // de marca, sin migración): pedido de Diego — un logo pensado para fondo
  // claro no se ve bien ahí, y viceversa. Se usa en la imagen grande del
  // hero (fondo porcelana); si no está, cae al logo oscuro (comportamiento
  // de antes de este cambio), y si tampoco hay ninguno, a la ilustración.
  logoUrl: logoUrl || "",
  logoUrlClaro: marca?.logoUrlClaro || "",
})

// Edición de "Personalización del login" (marca, mensaje de bienvenida,
// tarjetas de servicios, logo) — compartido entre SuperadminPanel.jsx
// (edita cualquier óptica, escogida como `detalle`) y Configuracion.jsx
// (el propio admin edita la suya). Migración 0052: el admin de una óptica
// ya puede escribir marca/logo_url de su propia fila, antes reservado al
// superadmin junto con nombre/slug/facturación.
export default function PersonalizacionLogin({ opticaId, marca, logoUrl, onGuardado }) {
  const [campo, setCampo] = useState(() => marcaAFormulario(marca, logoUrl))
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [subiendoLogoClaro, setSubiendoLogoClaro] = useState(false)
  const [errorLogo, setErrorLogo] = useState("")
  const [subiendoImagenServicio, setSubiendoImagenServicio] = useState(null)
  const [errorImagenServicio, setErrorImagenServicio] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Si cambia la óptica que se está editando (SuperadminPanel abre otro
  // detalle), o llegan datos frescos del servidor, se re-sincroniza el
  // formulario — mismo cálculo que al abrir por primera vez.
  useEffect(() => {
    setCampo(marcaAFormulario(marca, logoUrl))
  }, [opticaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const construirMarca = (c) => {
    const serviciosLimpios = c.servicios.map((s) => ({
      titulo: s.titulo.trim(), texto: s.texto.trim(), features: s.features.map((f) => f.trim()), imagenUrl: s.imagenUrl || "",
    }))
    const serviciosCompletos = serviciosLimpios.every((s) => s.titulo) ? serviciosLimpios : null
    return {
      nombreMarca: c.nombreMarca.trim(),
      eslogan: c.eslogan.trim(),
      colorAcento: c.colorAcento,
      colorSecundario: c.colorSecundario.trim(),
      serviciosActivos: c.serviciosActivos,
      mensaje: c.mensaje.trim(),
      logoUrlClaro: c.logoUrlClaro.trim(),
      ...(serviciosCompletos ? { servicios: serviciosCompletos } : {}),
    }
  }

  // Hallazgo B6: los campos de texto/color tenían onBlur={() => guardar()}
  // ADEMÁS del botón explícito "Guardar cambios" de más abajo — guardaban
  // solos al salir de cada campo, sin avisar nada, y de paso volvían inútil
  // a "Cancelar cambios" (la data ya se había guardado sola antes de que el
  // usuario llegara a hacer clic ahí). Se quita el autoguardado de los
  // campos de texto; los uploads de imagen y el switch de servicios sí
  // llaman a guardar() directo a propósito — son una acción explícita y
  // puntual del usuario (subir un archivo, marcar un checkbox), no una
  // tecla más de un campo que todavía se está editando.
  const guardar = async (campoActual = campo) => {
    setGuardando(true)
    const nuevaMarca = construirMarca(campoActual)
    const nuevoLogoUrl = campoActual.logoUrl.trim() || null
    const { error } = await supabase.from("opticas").update({ marca: nuevaMarca, logo_url: nuevoLogoUrl }).eq("id", opticaId)
    if (!error) {
      onGuardado?.({ marca: nuevaMarca, logoUrl: nuevoLogoUrl })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2500)
    }
    setGuardando(false)
  }

  const cancelarCambios = () => setCampo(marcaAFormulario(marca, logoUrl))

  const subirLogo = async (archivo) => {
    if (!archivo) return
    if (archivo.size > 2 * 1024 * 1024) { setErrorLogo("La imagen no puede pesar más de 2 MB."); return }
    setErrorLogo("")
    setSubiendoLogo(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
    const ruta = `${opticaId}/${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true })
    if (errorSubida) {
      setSubiendoLogo(false)
      setErrorLogo("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(ruta)
    const siguiente = { ...campo, logoUrl: data.publicUrl }
    setCampo(siguiente)
    setSubiendoLogo(false)
    guardar(siguiente)
  }

  const subirLogoClaro = async (archivo) => {
    if (!archivo) return
    if (archivo.size > 2 * 1024 * 1024) { setErrorLogo("La imagen no puede pesar más de 2 MB."); return }
    setErrorLogo("")
    setSubiendoLogoClaro(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
    const ruta = `${opticaId}/claro-${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true })
    if (errorSubida) {
      setSubiendoLogoClaro(false)
      setErrorLogo("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(ruta)
    const siguiente = { ...campo, logoUrlClaro: data.publicUrl }
    setCampo(siguiente)
    setSubiendoLogoClaro(false)
    guardar(siguiente)
  }

  const subirImagenServicio = async (archivo, i) => {
    if (!archivo) return
    if (archivo.size > 2 * 1024 * 1024) { setErrorImagenServicio("La imagen no puede pesar más de 2 MB."); return }
    setErrorImagenServicio("")
    setSubiendoImagenServicio(i)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
    const ruta = `${opticaId}/servicio-${i}-${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true })
    if (errorSubida) {
      setSubiendoImagenServicio(null)
      setErrorImagenServicio("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(ruta)
    const siguiente = { ...campo, servicios: campo.servicios.map((sv, j) => (j === i ? { ...sv, imagenUrl: data.publicUrl } : sv)) }
    setCampo(siguiente)
    setSubiendoImagenServicio(null)
    guardar(siguiente)
  }

  const alternarServiciosActivos = (activo) => {
    const siguiente = { ...campo, serviciosActivos: activo }
    setCampo(siguiente)
    guardar(siguiente)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-xl border border-slate-200 p-3.5">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Nombre de marca</label>
          <input
            type="text" value={campo.nombreMarca} onChange={(e) => setCampo((p) => ({ ...p, nombreMarca: e.target.value }))}            placeholder="Ej. Óptica Vision Plus"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Eslogan</label>
          <input
            type="text" value={campo.eslogan} onChange={(e) => setCampo((p) => ({ ...p, eslogan: e.target.value }))}            placeholder="Ej. Ve el mundo con claridad."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Color de acento</label>
            <div className="flex items-center gap-2">
              <input
                type="color" value={campo.colorAcento} onChange={(e) => setCampo((p) => ({ ...p, colorAcento: e.target.value }))}                className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              />
              <input
                type="text" value={campo.colorAcento} onChange={(e) => setCampo((p) => ({ ...p, colorAcento: e.target.value }))}                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Logo (fondo oscuro)</label>
            <div className="flex items-center gap-2">
              {campo.logoUrl && (
                <img src={campo.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-contain bg-white" />
              )}
              <label className={"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 " + (subiendoLogo ? "pointer-events-none opacity-60" : "")}>
                <ImageIcon size={13} />
                {subiendoLogo ? "Subiendo…" : "Subir imagen"}
                <input
                  type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = "" }}
                />
              </label>
            </div>
            {errorLogo && <p className="mt-1 text-[11px] font-medium text-red-600">{errorLogo}</p>}
            <p className="mt-1 text-[10px] text-slate-400">PNG, JPG, WEBP o SVG · máx. 2 MB. Va en la barra superior, el pie de página y el login — todos con fondo oscuro. También puedes pegar una URL:</p>
            <input
              type="text" value={campo.logoUrl} onChange={(e) => setCampo((p) => ({ ...p, logoUrl: e.target.value }))}              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Logo (fondo claro) <span className="normal-case text-slate-400">— opcional</span></label>
          <div className="flex items-center gap-2">
            {campo.logoUrlClaro && (
              <img src={campo.logoUrlClaro} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-contain bg-white" />
            )}
            <label className={"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 " + (subiendoLogoClaro ? "pointer-events-none opacity-60" : "")}>
              <ImageIcon size={13} />
              {subiendoLogoClaro ? "Subiendo…" : "Subir imagen"}
              <input
                type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogoClaro(f); e.target.value = "" }}
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Para la imagen grande del hero (fondo claro). Si no lo subís, se usa el logo de arriba ahí también. También podés pegar una URL:</p>
          <input
            type="text" value={campo.logoUrlClaro} onChange={(e) => setCampo((p) => ({ ...p, logoUrlClaro: e.target.value }))}            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Color secundario</label>
            <div className="flex items-center gap-2">
              <input
                type="color" value={campo.colorSecundario || "#0E2B33"} onChange={(e) => setCampo((p) => ({ ...p, colorSecundario: e.target.value }))}                className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              />
              <input
                type="text" value={campo.colorSecundario} onChange={(e) => setCampo((p) => ({ ...p, colorSecundario: e.target.value }))}                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Se mezcla con el color de acento en la barra superior del login.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Tarjetas de servicios</label>
            <label className="flex h-8 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox" checked={campo.serviciosActivos}
                onChange={(e) => alternarServiciosActivos(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Mostrar bloque de servicios
            </label>
            <p className="mt-1 text-[10px] text-slate-400">Si se desactiva, se oculta en el login y va directo a agendar cita.</p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Mensaje de bienvenida (hero)</label>
          <textarea
            rows={3} value={campo.mensaje} onChange={(e) => setCampo((p) => ({ ...p, mensaje: e.target.value }))}            placeholder="Ej. En Óptica Vision Plus cuidamos tu salud visual de principio a fin..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tarjetas de servicios del login <span className="font-normal normal-case text-slate-400">(completá las 3 para reemplazar las genéricas)</span>
        </p>
        <div className="space-y-3">
          {campo.servicios.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs font-semibold text-slate-400">Tarjeta {i + 1}</p>
              <div className="flex items-center gap-2">
                {s.imagenUrl && (
                  <img src={s.imagenUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-cover bg-white" />
                )}
                <label className={"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 " + (subiendoImagenServicio === i ? "pointer-events-none opacity-60" : "")}>
                  <ImageIcon size={13} />
                  {subiendoImagenServicio === i ? "Subiendo…" : "Imagen de la tarjeta"}
                  <input
                    type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagenServicio(f, i); e.target.value = "" }}
                  />
                </label>
              </div>
              {errorImagenServicio && <p className="text-[11px] font-medium text-red-600">{errorImagenServicio}</p>}
              <p className="text-[10px] text-slate-400">Si se sube, reemplaza el ícono automático en el login.</p>
              <input
                type="text" value={s.titulo}
                onChange={(e) => setCampo((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, titulo: e.target.value } : sv) }))}
                               placeholder="Título (ej. Exámenes optométricos)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
              />
              <textarea
                rows={2} value={s.texto}
                onChange={(e) => setCampo((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, texto: e.target.value } : sv) }))}
                               placeholder="Descripción breve"
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
              />
              <div className="space-y-1.5">
                {s.features.map((f, k) => (
                  <input
                    key={k} type="text" value={f}
                    onChange={(e) => setCampo((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, features: sv.features.map((ft, l) => l === k ? e.target.value : ft) } : sv) }))}
                                       placeholder={`Punto destacado ${k + 1}`}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:bg-white"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => guardar()}
            disabled={guardando}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition cursor-pointer disabled:opacity-60"
            style={{ background: GRAD }}
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={cancelarCambios}
            disabled={guardando}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-60"
          >
            Cancelar cambios
          </button>
          {guardadoOk && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <Check size={15} /> Guardado
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
