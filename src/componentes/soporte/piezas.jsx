"use client"

// Piezas que comparten las dos mitades de Soporte (la óptica y el superadmin), para que se vean y se comporten igual (regla 18).
import { useEffect, useRef, useState } from "react"
import { Image as IconoImagen, Paperclip, X } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import { MAX_ADJUNTOS, estadoDe, nombreUrgencia, problemaDeCaptura, tamanoLegible } from "../../utilidades/soporte"
import { urlDeCaptura } from "../../utilidades/soporteDatos"

export function InsigniaEstado({ estado }) {
  const e = estadoDe(estado)
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${e.clase}`}>{e.nombre}</span>
}

// La urgencia solo se marca cuando es urgente: el color comunica algo (regla 14), y "Normal" no necesita etiqueta.
export function InsigniaUrgencia({ urgencia }) {
  if (urgencia !== "urgente") return null
  return <span className="inline-flex items-center whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">{nombreUrgencia(urgencia)}</span>
}

// Una captura ya subida: se pide una dirección temporal porque el almacenamiento es privado.
export function CapturaSubida({ adjunto }) {
  const [url, setUrl] = useState("")
  const [fallo, setFallo] = useState(false)
  useEffect(() => {
    let vigente = true
    urlDeCaptura(adjunto.ruta).then((u) => { if (!vigente) return; if (u) setUrl(u); else setFallo(true) })
    return () => { vigente = false }
  }, [adjunto.ruta])
  if (fallo) return <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500"><IconoImagen size={13} aria-hidden="true" /> {adjunto.nombre} (no disponible)</span>
  return (
    <a href={url || undefined} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la captura ${adjunto.nombre}`} title={adjunto.nombre}
      className="group block h-24 w-32 overflow-hidden rounded-lg border border-slate-200/60 bg-slate-100">
      {url ? <img src={url} alt={`Captura: ${adjunto.nombre}`} className="h-full w-full object-cover transition-opacity group-hover:opacity-90" /> : <span className="grid h-full w-full animate-pulse place-items-center text-slate-300"><IconoImagen size={20} aria-hidden="true" /></span>}
    </a>
  )
}

// Un mensaje de la conversación. "soporte" a la izquierda en azul claro; la óptica a la derecha; la nota interna, en ámbar y con su aviso.
export function BurbujaMensaje({ mensaje, esMio }) {
  const interna = mensaje.interna
  const deSoporte = mensaje.de === "soporte"
  return (
    <div className={"flex " + (esMio ? "justify-end" : "justify-start")}>
      <div className={"max-w-[85%] rounded-2xl border px-4 py-3 " + (interna ? "border-amber-200 bg-amber-50" : deSoporte ? "border-blue-100 bg-blue-50/70" : "border-slate-200/60 bg-white")}>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="font-bold text-slate-700">{deSoporte ? (mensaje.autorNombre && mensaje.autorNombre !== "Soporte" ? `${mensaje.autorNombre} · Soporte` : "Soporte") : mensaje.autorNombre}</span>
          <span>{fechaHoraLegible(mensaje.creadoEn, { anio: true })}</span>
          {interna && <span className="font-bold text-amber-800">Nota interna: la óptica no la ve</span>}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm" style={{ color: INK }}>{mensaje.cuerpo}</p>
        {mensaje.adjuntos?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{mensaje.adjuntos.map((a) => <CapturaSubida key={a.ruta} adjunto={a} />)}</div>}
      </div>
    </div>
  )
}

// Elegir hasta 3 capturas (imágenes de hasta 5 MB), con su vista previa y la X para quitarlas. No sube nada: entrega los archivos.
export function CampoCapturas({ archivos, onCambiar, deshabilitado = false, id = "soporte-capturas" }) {
  const entrada = useRef(null)
  const [error, setError] = useState("")
  const vistas = useRef(new Map())
  const urlDe = (a) => { if (!vistas.current.has(a)) vistas.current.set(a, URL.createObjectURL(a)); return vistas.current.get(a) }
  useEffect(() => () => { for (const u of vistas.current.values()) URL.revokeObjectURL(u) }, [])

  const agregar = (lista) => {
    const nuevos = []
    for (const a of Array.from(lista || [])) {
      const problema = problemaDeCaptura(a)
      if (problema) { setError(problema); return }
      nuevos.push(a)
    }
    if (archivos.length + nuevos.length > MAX_ADJUNTOS) { setError(`Puedes adjuntar hasta ${MAX_ADJUNTOS} capturas.`); return }
    setError("")
    onCambiar([...archivos, ...nuevos])
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {archivos.map((a, i) => (
          <div key={`${a.name}-${i}`} className="relative h-16 w-20 overflow-hidden rounded-lg border border-slate-200/60 bg-slate-100">
            <img src={urlDe(a)} alt={`Vista previa: ${a.name}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onCambiar(archivos.filter((_, j) => j !== i))} aria-label={`Quitar ${a.name}`} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"><X size={12} aria-hidden="true" /></button>
          </div>
        ))}
        {archivos.length < MAX_ADJUNTOS && (
          <>
            <input ref={entrada} id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" disabled={deshabilitado} onChange={(e) => { agregar(e.target.files); e.target.value = "" }} />
            <button type="button" disabled={deshabilitado} onClick={() => entrada.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
              <Paperclip size={14} aria-hidden="true" /> Adjuntar captura
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{archivos.length > 0 ? `${archivos.length} de ${MAX_ADJUNTOS}: ${archivos.map((a) => tamanoLegible(a.size)).join(", ")}. ` : ""}Imágenes PNG, JPG, WebP o GIF de hasta 5 MB.</p>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  )
}
