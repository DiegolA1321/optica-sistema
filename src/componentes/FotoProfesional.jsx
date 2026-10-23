"use client"

import { useState } from "react"
import { ImagePlus, Loader2, UserRound } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { TIPOS_IMAGEN_PRINCIPAL, errorDeArchivo } from "../utilidades/paginaPublicaEditor"

// La foto de un profesional que atiende (optómetra): sale en «Quiénes somos» de la página pública, junto a su nombre y su registro (que ya se editan en Usuarios).
// Se sube al bucket público `logos` ({optica_id}/fotos/{perfil_id}.ext, hasta 2 MB, PNG, JPG o WEBP) y se guarda en perfiles.foto_url (RPC guardar_foto_de) al instante, con su aviso.
// `onCambio(url)`: url nueva, o "" si se quitó. `onAviso(texto)`: el aviso flotante de la pantalla.
export default function FotoProfesional({ opticaId, perfilId, nombre = "", url = "", onCambio, onAviso }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState("")

  const guardarUrl = async (nueva) => {
    const { error: e } = await supabase.rpc("guardar_foto_de", { p_perfil: perfilId, p_foto_url: nueva || null }) // migración 0148: la base valida que sea del administrador de su óptica
    return e
  }

  const subir = async (archivo) => {
    const problema = errorDeArchivo(archivo, { tipos: TIPOS_IMAGEN_PRINCIPAL, nombre: "La foto" })
    if (problema) { setError(problema); return }
    setError("")
    setSubiendo(true)
    const extension = (archivo.name.split(".").pop() || "jpg").toLowerCase()
    const ruta = `${opticaId}/fotos/${perfilId}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined })
    if (errorSubida) { setSubiendo(false); setError("No se pudo subir la foto. Intenta de nuevo."); return }
    // El mismo nombre de archivo se reemplaza: el sufijo evita que se siga viendo la foto anterior guardada en el navegador.
    const nueva = `${supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl}?v=${Date.now()}`
    const e = await guardarUrl(nueva)
    setSubiendo(false)
    if (e) { setError("No se pudo guardar la foto. Revisa tu conexión e intenta de nuevo."); return }
    onCambio?.(nueva)
    onAviso?.(`Foto de ${nombre || "la persona"} actualizada.`)
  }

  const quitar = async () => {
    setError("")
    setSubiendo(true)
    const e = await guardarUrl("")
    setSubiendo(false)
    if (e) { setError("No se pudo quitar la foto. Revisa tu conexión e intenta de nuevo."); return }
    onCambio?.("")
    onAviso?.(`Foto de ${nombre || "la persona"} quitada.`)
  }

  return (
    <div data-foto-profesional>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Foto <span className="font-normal text-slate-500">· sale en la página pública, junto a su nombre y su registro</span></span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400">
          {url ? <img src={url} alt={nombre ? `Foto de ${nombre}` : "Foto"} className="h-full w-full object-cover" /> : <UserRound size={26} aria-hidden="true" />}
        </span>
        <label className={"inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-within:ring-2 focus-within:ring-blue-300 " + (subiendo ? "pointer-events-none opacity-60" : "")}>
          {subiendo ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
          {subiendo ? "Guardando…" : url ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Subir foto"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = "" }} />
        </label>
        {url && <button type="button" onClick={quitar} disabled={subiendo} className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-red-700 cursor-pointer disabled:opacity-50">Quitar foto</button>}
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">PNG, JPG o WEBP, hasta 2 MB.</p>
    </div>
  )
}
