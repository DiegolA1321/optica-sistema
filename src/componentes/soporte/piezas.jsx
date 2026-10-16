"use client"

// Piezas que comparten las dos mitades de Soporte (la óptica y el superadmin), para que se vean y se comporten igual (regla 18).
import { useEffect, useRef, useState } from "react"
import { Download, FileSpreadsheet, FileText, Image as IconoImagen, Paperclip, X } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import { ACEPTAR_ADJUNTOS, MAX_ADJUNTOS, esImagenAdjunto, estadoDe, extensionDe, nombreUrgencia, problemaDeArchivo, tamanoLegible } from "../../utilidades/soporte"
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
// Las imágenes se ven; los documentos (PDF, Word, Excel) solo se descargan, nunca se abren dentro del sistema.
export function CapturaSubida({ adjunto }) {
  const [url, setUrl] = useState("")
  const [fallo, setFallo] = useState(false)
  const imagen = esImagenAdjunto(adjunto)
  useEffect(() => {
    let vigente = true
    urlDeCaptura(adjunto.ruta, imagen ? null : adjunto.nombre).then((u) => { if (!vigente) return; if (u) setUrl(u); else setFallo(true) })
    return () => { vigente = false }
  }, [adjunto.ruta, adjunto.nombre, imagen])
  if (!imagen) {
    const Icono = extensionDe(adjunto.nombre) === "xlsx" ? FileSpreadsheet : FileText
    if (fallo) return <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500"><Icono size={13} aria-hidden="true" /> {adjunto.nombre} (no disponible)</span>
    return (
      <a href={url || undefined} download={adjunto.nombre} aria-label={`Descargar ${adjunto.nombre}`} title={`Descargar ${adjunto.nombre}`}
        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
        <Icono size={16} className="shrink-0 text-blue-700" aria-hidden="true" />
        <span className="min-w-0 truncate">{adjunto.nombre}</span>
        {adjunto.bytes ? <span className="shrink-0 text-xs font-normal text-slate-500">{tamanoLegible(adjunto.bytes)}</span> : null}
        <Download size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
      </a>
    )
  }
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
  const deAdmin = mensaje.de === "admin"
  return (
    <div className={"flex " + (esMio ? "justify-end" : "justify-start")}>
      <div className={"max-w-[85%] rounded-2xl border px-4 py-3 " + (interna ? "border-amber-200 bg-amber-50" : deSoporte || deAdmin ? "border-blue-100 bg-blue-50/70" : "border-slate-200/60 bg-white")}>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="font-bold text-slate-700">{deSoporte ? (mensaje.autorNombre && mensaje.autorNombre !== "Soporte" ? `${mensaje.autorNombre} · Soporte` : "Soporte") : deAdmin ? `${mensaje.autorNombre} · Administrador` : mensaje.autorNombre}</span>
          <span>{fechaHoraLegible(mensaje.creadoEn, { anio: true })}</span>
          {interna && <span className="font-bold text-amber-800">Nota interna: la óptica no la ve</span>}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm" style={{ color: INK }}>{mensaje.cuerpo}</p>
        {mensaje.adjuntos?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{mensaje.adjuntos.map((a) => <CapturaSubida key={a.ruta} adjunto={a} />)}</div>}
      </div>
    </div>
  )
}

// Elegir hasta 3 archivos (imágenes, PDF, Word o Excel de hasta 10 MB), con su vista previa y la X para quitarlos. No sube nada: entrega los archivos.
export function CampoCapturas({ archivos, onCambiar, deshabilitado = false, id = "soporte-capturas" }) {
  const entrada = useRef(null)
  const [error, setError] = useState("")
  const vistas = useRef(new Map())
  const urlDe = (a) => { if (!vistas.current.has(a)) vistas.current.set(a, URL.createObjectURL(a)); return vistas.current.get(a) }
  useEffect(() => () => { for (const u of vistas.current.values()) URL.revokeObjectURL(u) }, [])

  const agregar = (lista) => {
    const nuevos = []
    for (const a of Array.from(lista || [])) {
      const problema = problemaDeArchivo(a)
      if (problema) { setError(problema); return }
      nuevos.push(a)
    }
    if (archivos.length + nuevos.length > MAX_ADJUNTOS) { setError(`Puedes adjuntar hasta ${MAX_ADJUNTOS} archivos.`); return }
    setError("")
    onCambiar([...archivos, ...nuevos])
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {archivos.map((a, i) => (
          esImagenAdjunto(a) ? (
            <div key={`${a.name}-${i}`} className="relative h-16 w-20 overflow-hidden rounded-lg border border-slate-200/60 bg-slate-100">
              <img src={urlDe(a)} alt={`Vista previa: ${a.name}`} className="h-full w-full object-cover" />
              <button type="button" onClick={() => onCambiar(archivos.filter((_, j) => j !== i))} aria-label={`Quitar ${a.name}`} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"><X size={12} aria-hidden="true" /></button>
            </div>
          ) : (
            <div key={`${a.name}-${i}`} className="relative flex h-16 w-44 items-center gap-2 rounded-lg border border-slate-200/60 bg-slate-50 py-2 pl-3 pr-7">
              {extensionDe(a.name) === "xlsx" ? <FileSpreadsheet size={20} className="shrink-0 text-blue-700" aria-hidden="true" /> : <FileText size={20} className="shrink-0 text-blue-700" aria-hidden="true" />}
              <span className="min-w-0 text-xs font-semibold text-slate-700"><span className="block truncate">{a.name}</span><span className="font-normal text-slate-500">{tamanoLegible(a.size)}</span></span>
              <button type="button" onClick={() => onCambiar(archivos.filter((_, j) => j !== i))} aria-label={`Quitar ${a.name}`} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"><X size={12} aria-hidden="true" /></button>
            </div>
          )
        ))}
        {archivos.length < MAX_ADJUNTOS && (
          <>
            <input ref={entrada} id={id} type="file" accept={ACEPTAR_ADJUNTOS} multiple className="sr-only" disabled={deshabilitado} onChange={(e) => { agregar(e.target.files); e.target.value = "" }} />
            <button type="button" disabled={deshabilitado} onClick={() => entrada.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
              <Paperclip size={14} aria-hidden="true" /> Adjuntar archivo
            </button>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">{archivos.length > 0 ? `${archivos.length} de ${MAX_ADJUNTOS}: ${archivos.map((a) => tamanoLegible(a.size)).join(", ")}. ` : ""}Imágenes, PDF, Word (.docx) o Excel (.xlsx) de hasta 10 MB.</p>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
    </div>
  )
}
