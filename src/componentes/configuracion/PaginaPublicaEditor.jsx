"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Eye, ImagePlus, Loader2, Plus, Save, Trash2, Undo2, AlertTriangle, Info } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import AvisoFlotante, { useAvisoTemporal } from "../AvisoFlotante"
import ConfirmarEliminarModal from "../ConfirmarEliminarModal"
import LogoOptica from "../LogoOptica"
import VistaPrevia from "../VistaPrevia"
import { INK } from "@/lib/tema"
import { PALETA_MARCA, esColorValido, colorLegible, degradadoMarca, anosAtendiendo, pacientesRedondeado, COLOR_POR_DEFECTO } from "../../utilidades/marcaOptica"
import {
  TIPOS_LOGO, TIPOS_IMAGEN_PRINCIPAL, formularioDesdeMarca, avisoDeContraste, errorDeAno, errorDeArchivo, construirMarca, formularioTrasGuardar,
  hayCambios, mover, idNuevo,
} from "../../utilidades/paginaPublicaEditor"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const CAMPO = "w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"
const BOTON_ICONO = "rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"

const Seccion = ({ titulo, ayuda, children }) => (
  <section className="rounded-xl border border-slate-200/60 bg-white p-4">
    <h3 className="text-sm font-bold" style={{ color: INK }}>{titulo}</h3>
    {ayuda && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{ayuda}</p>}
    <div className="mt-3 space-y-3">{children}</div>
  </section>
)

const Etiqueta = ({ children, ...p }) => <label className="mb-1 block text-xs font-semibold text-slate-600" {...p}>{children}</label>

function Interruptor({ activo, onClick, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={onClick}
      className={"relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer " + (activo ? "" : "bg-slate-200")} style={activo ? { background: GRAD } : undefined}>
      <span className={"absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform " + (activo ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}

// Subir una imagen al bucket público `logos` ({optica_id}/…), el mismo de siempre. Devuelve { url } o { error }.
async function subirImagen(opticaId, archivo, prefijo) {
  const extension = (archivo.name.split(".").pop() || "png").toLowerCase()
  const ruta = `${opticaId}/${prefijo}${Date.now()}.${extension}`
  const { error } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined })
  if (error) return { error: "No se pudo subir la imagen. Intenta de nuevo." }
  return { url: supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl }
}

// El número de optómetras es solo un conteo (optometrasTotal); en la página salen con nombre y foto solo quienes lo activaron en Mi cuenta.
const contarOptometras = (d) => (Number.isFinite(d?.optometrasTotal) ? d.optometrasTotal : Array.isArray(d?.optometras) ? d.optometras.length : null)

// ─── Lo que se ve en la vista previa: el inicio y sus secciones, con los cambios sin guardar. Todo inerte (nada se pulsa). ───
function MuestraDeLaPagina({ f, nombreOptica, datos }) {
  const color = colorLegible(f.colorAcento).color
  const nombre = f.nombreMarca.trim() || nombreOptica
  const anos = anosAtendiendo(f.anoFundacion && !errorDeAno(f.anoFundacion) ? Number(f.anoFundacion) : null)
  const pacientes = pacientesRedondeado(datos?.pacientesAtendidos)
  const optometras = contarOptometras(datos)
  const cifras = [
    f.mostrarAnos && anos && { valor: String(anos), nombre: anos === 1 ? "año atendiendo" : "años atendiendo" },
    f.mostrarPacientes && { valor: pacientes || "—", nombre: "pacientes atendidos" },
    f.mostrarOptometras && { valor: optometras == null ? "—" : String(optometras), nombre: "optómetras" },
  ].filter(Boolean)
  const servicios = f.servicios.filter((s) => s.titulo.trim() && s.texto.trim())
  const preguntas = f.preguntas.filter((q) => q.p.trim() && q.r.trim())
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-xl border border-slate-200 bg-white" data-muestra-pagina>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <LogoOptica url={f.logoUrl} nombre={nombre} color={color} tamano={36} ancho="ancho" />
        <p className="truncate text-sm font-bold" style={{ color: INK }}>{nombre}</p>
        <span className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: degradadoMarca(color) }}>Agendar cita</span>
      </div>
      <div className="grid gap-4 px-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <p className="font-serif text-xl font-bold leading-tight" style={{ color: INK }}>{f.eslogan.trim() || "Ve el mundo con claridad."}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.mensaje.trim()}</p>
        </div>
        {f.imagenPrincipalUrl ? (
          <img src={f.imagenPrincipalUrl} alt="" className="h-28 w-40 rounded-xl object-cover" />
        ) : (
          <span className="grid h-28 w-40 place-items-center rounded-xl text-white" style={{ background: degradadoMarca(color) }} aria-hidden="true"><Eye size={44} className="animate-pulse" /></span>
        )}
      </div>
      <div className="border-t border-slate-100 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quiénes somos</p>
        <p className="mt-1 text-sm text-slate-700">{f.historia.trim()}</p>
        <p className="mt-1 text-sm italic text-slate-600">{f.mision.trim()}</p>
        {cifras.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cifras.map((c) => (
              <div key={c.nombre} className="rounded-lg border border-slate-200 px-3 py-1.5 text-center"><p className="text-base font-bold" style={{ color }}>{c.valor}</p><p className="text-xs text-slate-600">{c.nombre}</p></div>
            ))}
          </div>
        )}
      </div>
      {servicios.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Servicios</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {servicios.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-2.5"><p className="text-sm font-bold" style={{ color: INK }}>{s.titulo}</p><p className="mt-0.5 text-xs text-slate-600">{s.texto}</p></div>
            ))}
          </div>
        </div>
      )}
      {preguntas.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Preguntas frecuentes</p>
          <ul className="mt-2 space-y-1.5">
            {preguntas.map((q) => <li key={q.id} className="text-sm"><b style={{ color: INK }}>{q.p}</b> <span className="text-slate-600">{q.r}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// Editor de «Página pública»: lo que ve el paciente antes de ingresar o agendar. Un solo editor para la Configuración de cada óptica y para el panel del superadmin.
//   opticaId, nombreOptica, marca, logoUrl: la óptica que se edita · motivos: los motivos de consulta de esa óptica (para el motivo de cada servicio)
//   onGuardado({ marca, logoUrl }): quien llama refresca su estado en memoria · onNavegar(seccion): enlace de la nota «lo que ya existe no se escribe dos veces».
export default function PaginaPublicaEditor({ opticaId, nombreOptica = "Tu óptica", marca, logoUrl, motivos = [], onGuardado, onNavegar }) {
  const [base, setBase] = useState(() => formularioDesdeMarca(marca, nombreOptica, logoUrl))
  const [form, setForm] = useState(base)
  const [aviso, avisar] = useAvisoTemporal()
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState("") // "logo" | "imagen" | ""
  const [errorLogo, setErrorLogo] = useState("")
  const [errorImagen, setErrorImagen] = useState("")
  const [confirmarPerdida, setConfirmarPerdida] = useState(null) // { aMedias: n } mientras se pregunta
  const [datos, setDatos] = useState(null) // pagina_publica_datos: { optometras, pacientesAtendidos }
  const marcaRef = useRef(marca)
  marcaRef.current = marca

  // Otra óptica (el superadmin abre otro detalle): se empieza de cero con la suya.
  useEffect(() => {
    const nuevo = formularioDesdeMarca(marcaRef.current, nombreOptica, logoUrl)
    setBase(nuevo)
    setForm(nuevo)
    setErrorLogo("")
    setErrorImagen("")
  }, [opticaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Los números automáticos reales (pacientes atendidos y optómetras) salen de una función de la base; si todavía no existe o falla, se muestra «—» sin romper nada.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        if (!supabase?.rpc || !opticaId) return
        const { data, error } = await supabase.rpc("pagina_publica_datos", { p_optica_id: opticaId })
        if (vivo && !error && data) setDatos(data)
      } catch { /* sin datos: «—» */ }
    })()
    return () => { vivo = false }
  }, [opticaId])

  const sucio = hayCambios(form, base)
  useEffect(() => {
    if (!sucio) return undefined
    const alSalir = (e) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", alSalir)
    return () => window.removeEventListener("beforeunload", alSalir)
  }, [sucio])

  const poner = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }))
  const cambiarItem = (lista, id, campo, valor) => setForm((p) => ({ ...p, [lista]: p[lista].map((x) => (x.id === id ? { ...x, [campo]: valor } : x)) }))
  const quitarItem = (lista, id) => setForm((p) => ({ ...p, [lista]: p[lista].filter((x) => x.id !== id) }))
  const moverItem = (lista, i, delta) => setForm((p) => ({ ...p, [lista]: mover(p[lista], i, delta) }))

  const subir = async (archivo, que) => {
    if (!archivo) return
    const esLogo = que === "logo"
    const setError = esLogo ? setErrorLogo : setErrorImagen
    const problema = errorDeArchivo(archivo, { tipos: esLogo ? TIPOS_LOGO : TIPOS_IMAGEN_PRINCIPAL, nombre: esLogo ? "El logo" : "La imagen" })
    if (problema) { setError(problema); return }
    setError("")
    setSubiendo(que)
    const r = await subirImagen(opticaId, archivo, esLogo ? "" : "principal-")
    setSubiendo("")
    if (r.error) { setError(r.error); return }
    setForm((p) => ({ ...p, [esLogo ? "logoUrl" : "imagenPrincipalUrl"]: r.url }))
  }

  const contraste = avisoDeContraste(form.colorAcento)
  const colorInvalido = !esColorValido(form.colorAcento)
  const errorAno = errorDeAno(form.anoFundacion)

  const guardar = async (confirmado = false) => {
    if (errorAno) { avisar(`No se pudo guardar. ${errorAno}`); return }
    if (colorInvalido) { avisar("No se pudo guardar: escribe el color como #RRGGBB, por ejemplo #2563EB."); return }
    const r = construirMarca(form, marcaRef.current)
    const aMedias = r.serviciosAMedias.length + r.preguntasAMedias.length + r.razonesAMedias.length + r.opinionesAMedias.length
    if (aMedias > 0 && !confirmado) { setConfirmarPerdida({ aMedias }); return }
    setConfirmarPerdida(null)
    setGuardando(true)
    const nuevoLogo = form.logoUrl.trim() || null
    let error = null
    try {
      ;({ error } = await supabase.from("opticas").update({ marca: r.marca, logo_url: nuevoLogo }).eq("id", opticaId))
    } catch (e) { error = e }
    setGuardando(false)
    if (error) { avisar("No se pudo guardar la página pública. Revisa tu conexión e intenta de nuevo."); return }
    const siguiente = formularioTrasGuardar({ ...form, logoUrl: nuevoLogo || "" }, r.marca)
    setBase(siguiente)
    setForm(siguiente)
    onGuardado?.({ marca: r.marca, logoUrl: nuevoLogo })
    avisar(r.colorAjustado ? `Página pública guardada. El color se ajustó a ${r.marca.colorAcento} para que el texto se lea.` : "Página pública guardada.")
  }

  // Los enlaces de la nota sacan de esta pantalla (Horario) o de esta pestaña: con cambios sin guardar primero se avisa.
  const salirA = (ir) => { if (sucio && ir) { avisar("No puedes salir todavía: tienes cambios sin guardar. Guárdalos o descártalos."); return } ir() }

  const descartar = () => { setForm(base); setErrorLogo(""); setErrorImagen(""); avisar("Se descartaron los cambios sin guardar.") }

  const anos = anosAtendiendo(form.anoFundacion && !errorAno ? Number(form.anoFundacion) : null)
  const valorAuto = {
    anos: anos ? `${anos} ${anos === 1 ? "año" : "años"}` : "— (escribe el año de fundación)",
    pacientes: pacientesRedondeado(datos?.pacientesAtendidos) || "—",
    optometras: contarOptometras(datos) == null ? "—" : String(contarOptometras(datos)),
  }
  const numeros = [
    { clave: "mostrarAnos", etiqueta: "Años atendiendo", valor: valorAuto.anos },
    { clave: "mostrarPacientes", etiqueta: "Pacientes atendidos", valor: valorAuto.pacientes },
    { clave: "mostrarOptometras", etiqueta: "Optómetras", valor: valorAuto.optometras },
  ]
  const listaMotivos = [...motivos]

  return (
    <div className="space-y-4">
      {aviso && <AvisoFlotante texto={aviso} />}

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
        <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-relaxed">
          El horario sale de{" "}
          <button type="button" onClick={() => salirA(() => onNavegar?.("horario"))} className="font-semibold underline underline-offset-2 cursor-pointer">Horario</button>
          ; la dirección, el teléfono y el mapa, de «Datos de la óptica» (la tarjeta de arriba).
          {" "}El nombre, el registro y la foto de cada optómetra salen de Usuarios. Aquí no se escriben dos veces.
        </p>
      </div>

      <Seccion titulo="Logo y nombre" ayuda="Aparecen en la página pública, el ingreso, el agendamiento, el portal del paciente y los documentos que imprimes.">
        <div className="flex flex-wrap items-center gap-3">
          <LogoOptica url={form.logoUrl} nombre={form.nombreMarca || nombreOptica} color={colorLegible(form.colorAcento).color} tamano={56} ancho="ancho" />
          <label className={"inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-within:ring-2 focus-within:ring-blue-300 " + (subiendo === "logo" ? "pointer-events-none opacity-60" : "")}>
            {subiendo === "logo" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
            {subiendo === "logo" ? "Subiendo…" : form.logoUrl ? "Cambiar logo" : "Subir logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Subir logo"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, "logo"); e.target.value = "" }} />
          </label>
          {form.logoUrl && <button type="button" onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))} className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-red-700 cursor-pointer">Quitar logo</button>}
        </div>
        {errorLogo && <p role="alert" className="text-sm font-medium text-red-600">{errorLogo}</p>}
        <p className="text-xs leading-relaxed text-slate-500">PNG, JPG, WEBP o SVG, hasta 2 MB. Lo mejor es un logo con fondo transparente: se muestra entero, sin deformarse ni cortarse. Sin logo se ve el ojo de marca con tu color.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Etiqueta htmlFor="pp-nombre">Nombre que ve el público</Etiqueta>
            <input id="pp-nombre" value={form.nombreMarca} onChange={poner("nombreMarca")} maxLength={80} placeholder={nombreOptica} className={CAMPO} />
            <p className="mt-1 text-xs text-slate-500">Si lo dejas vacío se usa «{nombreOptica}».</p>
          </div>
          <div>
            <Etiqueta htmlFor="pp-eslogan">Eslogan</Etiqueta>
            <input id="pp-eslogan" value={form.eslogan} onChange={poner("eslogan")} maxLength={90} className={CAMPO} />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Color principal" ayuda="Se usa en la página pública, la ventana de ingreso, el agendamiento y el portal del paciente. El sistema del personal mantiene sus colores.">
        <div role="group" aria-label="Colores sugeridos" className="flex flex-wrap gap-2">
          {PALETA_MARCA.map((c) => {
            const activo = form.colorAcento.toUpperCase() === c.color
            return (
              <button key={c.color} type="button" onClick={() => setForm((p) => ({ ...p, colorAcento: c.color }))} aria-pressed={activo} aria-label={`${c.nombre} ${c.color}`} title={c.nombre}
                className={"h-9 w-9 rounded-full border-2 transition-transform cursor-pointer " + (activo ? "scale-110 border-slate-900" : "border-white ring-1 ring-slate-300")} style={{ background: c.color }} />
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="color" aria-label="Elegir otro color" value={esColorValido(form.colorAcento) ? form.colorAcento.trim().toLowerCase() : COLOR_POR_DEFECTO.toLowerCase()}
            onChange={(e) => setForm((p) => ({ ...p, colorAcento: e.target.value.toUpperCase() }))} className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200/60 bg-slate-50 p-0.5" />
          <input aria-label="Color en formato #RRGGBB" value={form.colorAcento} onChange={(e) => setForm((p) => ({ ...p, colorAcento: e.target.value.trim().toUpperCase() }))} maxLength={7}
            aria-invalid={colorInvalido} className={CAMPO + " w-32 font-mono"} />
        </div>
        {colorInvalido && <p role="alert" className="text-sm font-medium text-red-600">Escribe el color como #RRGGBB, por ejemplo #2563EB.</p>}
        {contraste && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50 p-2.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{contraste.texto} <span className="ml-1 inline-block h-3 w-3 rounded-full align-middle ring-1 ring-slate-300" style={{ background: contraste.ajustado }} aria-hidden="true" /></span>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Inicio" ayuda="Lo primero que ve el paciente.">
        <div>
          <Etiqueta htmlFor="pp-mensaje">Texto del inicio</Etiqueta>
          <textarea id="pp-mensaje" rows={3} value={form.mensaje} onChange={poner("mensaje")} maxLength={280} className={CAMPO + " resize-none"} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {form.imagenPrincipalUrl && <img src={form.imagenPrincipalUrl} alt="Imagen principal actual" className="h-16 w-24 rounded-lg border border-slate-200 object-cover" />}
          <label className={"inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-within:ring-2 focus-within:ring-blue-300 " + (subiendo === "imagen" ? "pointer-events-none opacity-60" : "")}>
            {subiendo === "imagen" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
            {subiendo === "imagen" ? "Subiendo…" : form.imagenPrincipalUrl ? "Cambiar imagen principal" : "Subir imagen principal"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Subir imagen principal"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, "imagen"); e.target.value = "" }} />
          </label>
          {form.imagenPrincipalUrl && <button type="button" onClick={() => setForm((p) => ({ ...p, imagenPrincipalUrl: "" }))} className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-red-700 cursor-pointer">Quitar imagen</button>}
        </div>
        {errorImagen && <p role="alert" className="text-sm font-medium text-red-600">{errorImagen}</p>}
        <p className="text-xs leading-relaxed text-slate-500">PNG, JPG o WEBP, hasta 2 MB. Si no subes una imagen, se ve el ojo animado con el color de tu óptica.</p>
      </Seccion>

      <Seccion titulo="Quiénes somos" ayuda="Tu historia y los números que respaldan a tu óptica.">
        <div>
          <Etiqueta htmlFor="pp-historia">Historia</Etiqueta>
          <textarea id="pp-historia" rows={3} value={form.historia} onChange={poner("historia")} maxLength={600} className={CAMPO + " resize-none"} />
        </div>
        <div>
          <Etiqueta htmlFor="pp-mision">Misión</Etiqueta>
          <textarea id="pp-mision" rows={2} value={form.mision} onChange={poner("mision")} maxLength={300} className={CAMPO + " resize-none"} />
        </div>
        <div className="max-w-xs">
          <Etiqueta htmlFor="pp-ano">Año de fundación</Etiqueta>
          <input id="pp-ano" inputMode="numeric" value={form.anoFundacion} onChange={(e) => setForm((p) => ({ ...p, anoFundacion: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Ej. 2015" aria-invalid={!!errorAno} className={CAMPO + (errorAno ? " border-red-400" : "")} />
          {errorAno && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{errorAno}</p>}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-600">Números automáticos (se calculan solos; elige cuáles mostrar)</p>
          <p className="mb-1.5 text-xs text-slate-500">Cada optómetra decide si aparece en la página pública desde Mi cuenta.</p>
          <ul className="space-y-1.5">
            {numeros.map((n) => (
              <li key={n.clave} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-700">{n.etiqueta}</p><p className="text-sm text-slate-600">Saldría: <b>{n.valor}</b></p></div>
                <Interruptor activo={form[n.clave]} etiqueta={`Mostrar «${n.etiqueta}»`} onClick={() => setForm((p) => ({ ...p, [n.clave]: !p[n.clave] }))} />
              </li>
            ))}
          </ul>
        </div>
      </Seccion>

      <Seccion titulo="Servicios" ayuda="Lo que ofreces. Cada servicio puede llevar al motivo de cita que corresponde. Los que no tengan título y texto no se guardan.">
        {form.servicios.length === 0 && <p className="text-sm italic text-slate-600">Todavía no hay servicios: agrega el primero.</p>}
        {form.servicios.map((s, i) => (
          <div key={s.id} className="rounded-lg border border-slate-200/60 bg-slate-50 p-3" data-servicio>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Servicio {i + 1}</p>
              <div className="flex items-center">
                <button type="button" className={BOTON_ICONO} disabled={i === 0} onClick={() => moverItem("servicios", i, -1)} aria-label={`Subir el servicio ${i + 1}${s.titulo ? `: ${s.titulo}` : ""}`}><ArrowUp size={15} /></button>
                <button type="button" className={BOTON_ICONO} disabled={i === form.servicios.length - 1} onClick={() => moverItem("servicios", i, 1)} aria-label={`Bajar el servicio ${i + 1}${s.titulo ? `: ${s.titulo}` : ""}`}><ArrowDown size={15} /></button>
                <button type="button" className={BOTON_ICONO + " hover:text-red-600"} onClick={() => quitarItem("servicios", s.id)} aria-label={`Quitar el servicio ${i + 1}${s.titulo ? `: ${s.titulo}` : ""}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <input value={s.titulo} onChange={(e) => cambiarItem("servicios", s.id, "titulo", e.target.value)} maxLength={60} placeholder="Título (ej. Examen visual completo)" aria-label={`Título del servicio ${i + 1}`} className={CAMPO + " font-semibold"} />
              <textarea rows={2} value={s.texto} onChange={(e) => cambiarItem("servicios", s.id, "texto", e.target.value)} maxLength={200} placeholder="Descripción breve" aria-label={`Texto del servicio ${i + 1}`} className={CAMPO + " resize-none"} />
              {listaMotivos.length > 0 ? (
                <select value={s.motivo} onChange={(e) => cambiarItem("servicios", s.id, "motivo", e.target.value)} aria-label={`Motivo de cita del servicio ${i + 1}`} className={CAMPO}>
                  <option value="">Sin motivo de cita</option>
                  {s.motivo && !listaMotivos.includes(s.motivo) && <option value={s.motivo}>{s.motivo} (ya no está en tus motivos)</option>}
                  {listaMotivos.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input value={s.motivo} onChange={(e) => cambiarItem("servicios", s.id, "motivo", e.target.value)} placeholder="Motivo de cita (opcional)" aria-label={`Motivo de cita del servicio ${i + 1}`} className={CAMPO} />
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setForm((p) => ({ ...p, servicios: [...p.servicios, { id: idNuevo("s", p.servicios), titulo: "", texto: "", motivo: "" }] }))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Plus size={14} aria-hidden="true" /> Agregar servicio</button>
      </Seccion>

      <Seccion titulo="Preguntas frecuentes" ayuda="Lo que tus pacientes suelen preguntar. Las que no tengan pregunta y respuesta no se guardan.">
        {form.preguntas.length === 0 && <p className="text-sm italic text-slate-600">Todavía no hay preguntas: agrega la primera.</p>}
        {form.preguntas.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-slate-200/60 bg-slate-50 p-3" data-pregunta>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pregunta {i + 1}</p>
              <div className="flex items-center">
                <button type="button" className={BOTON_ICONO} disabled={i === 0} onClick={() => moverItem("preguntas", i, -1)} aria-label={`Subir la pregunta ${i + 1}${q.p ? `: ${q.p}` : ""}`}><ArrowUp size={15} /></button>
                <button type="button" className={BOTON_ICONO} disabled={i === form.preguntas.length - 1} onClick={() => moverItem("preguntas", i, 1)} aria-label={`Bajar la pregunta ${i + 1}${q.p ? `: ${q.p}` : ""}`}><ArrowDown size={15} /></button>
                <button type="button" className={BOTON_ICONO + " hover:text-red-600"} onClick={() => quitarItem("preguntas", q.id)} aria-label={`Quitar la pregunta ${i + 1}${q.p ? `: ${q.p}` : ""}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <input value={q.p} onChange={(e) => cambiarItem("preguntas", q.id, "p", e.target.value)} maxLength={120} placeholder="Pregunta" aria-label={`Texto de la pregunta ${i + 1}`} className={CAMPO + " font-semibold"} />
              <textarea rows={2} value={q.r} onChange={(e) => cambiarItem("preguntas", q.id, "r", e.target.value)} maxLength={300} placeholder="Respuesta" aria-label={`Respuesta de la pregunta ${i + 1}`} className={CAMPO + " resize-none"} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setForm((p) => ({ ...p, preguntas: [...p.preguntas, { id: idNuevo("p", p.preguntas), p: "", r: "" }] }))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Plus size={14} aria-hidden="true" /> Agregar pregunta</button>
      </Seccion>

      <Seccion titulo="Por qué elegirnos" ayuda="Tres razones que salen en «Quiénes somos» mientras ningún optómetra haya activado «Mostrarme en la página pública»; si alguno lo activó, sale su tarjeta en su lugar. Las que no tengan título y texto no se guardan.">
        {form.razones.length === 0 && <p className="text-sm italic text-slate-600">Todavía no hay razones: agrega la primera.</p>}
        {form.razones.map((r, i) => (
          <div key={r.id} className="rounded-lg border border-slate-200/60 bg-slate-50 p-3" data-razon>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Razón {i + 1}</p>
              <div className="flex items-center">
                <button type="button" className={BOTON_ICONO} disabled={i === 0} onClick={() => moverItem("razones", i, -1)} aria-label={`Subir la razón ${i + 1}`}><ArrowUp size={15} /></button>
                <button type="button" className={BOTON_ICONO} disabled={i === form.razones.length - 1} onClick={() => moverItem("razones", i, 1)} aria-label={`Bajar la razón ${i + 1}`}><ArrowDown size={15} /></button>
                <button type="button" className={BOTON_ICONO + " hover:text-red-600"} onClick={() => quitarItem("razones", r.id)} aria-label={`Quitar la razón ${i + 1}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <input value={r.titulo} onChange={(e) => cambiarItem("razones", r.id, "titulo", e.target.value)} maxLength={50} placeholder="Título (ej. Equipos de precisión)" aria-label={`Título de la razón ${i + 1}`} className={CAMPO + " font-semibold"} />
              <input value={r.texto} onChange={(e) => cambiarItem("razones", r.id, "texto", e.target.value)} maxLength={120} placeholder="Una línea que lo explique" aria-label={`Texto de la razón ${i + 1}`} className={CAMPO} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setForm((p) => ({ ...p, razones: [...p.razones, { id: idNuevo("r", p.razones), titulo: "", texto: "" }] }))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Plus size={14} aria-hidden="true" /> Agregar razón</button>
      </Seccion>

      <Seccion titulo="Lo que dicen nuestros pacientes" ayuda="Opcional: opiniones que tú escribes (con el permiso de quien las dio). Sin ninguna, esta sección no aparece en la página.">
        {form.opiniones.length === 0 && <p className="text-sm italic text-slate-600">Todavía no hay opiniones: la sección no se muestra.</p>}
        {form.opiniones.map((o, i) => (
          <div key={o.id} className="rounded-lg border border-slate-200/60 bg-slate-50 p-3" data-opinion>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Opinión {i + 1}</p>
              <div className="flex items-center">
                <button type="button" className={BOTON_ICONO} disabled={i === 0} onClick={() => moverItem("opiniones", i, -1)} aria-label={`Subir la opinión ${i + 1}`}><ArrowUp size={15} /></button>
                <button type="button" className={BOTON_ICONO} disabled={i === form.opiniones.length - 1} onClick={() => moverItem("opiniones", i, 1)} aria-label={`Bajar la opinión ${i + 1}`}><ArrowDown size={15} /></button>
                <button type="button" className={BOTON_ICONO + " hover:text-red-600"} onClick={() => quitarItem("opiniones", o.id)} aria-label={`Quitar la opinión ${i + 1}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <textarea rows={2} value={o.texto} onChange={(e) => cambiarItem("opiniones", o.id, "texto", e.target.value)} maxLength={240} placeholder="Lo que dijo el paciente" aria-label={`Texto de la opinión ${i + 1}`} className={CAMPO + " resize-none"} />
              <input value={o.nombre} onChange={(e) => cambiarItem("opiniones", o.id, "nombre", e.target.value)} maxLength={60} placeholder="Nombre (ej. María G.)" aria-label={`Nombre de quien dio la opinión ${i + 1}`} className={CAMPO} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setForm((p) => ({ ...p, opiniones: [...p.opiniones, { id: idNuevo("o", p.opiniones), texto: "", nombre: "" }] }))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Plus size={14} aria-hidden="true" /> Agregar opinión</button>
      </Seccion>

      <VistaPrevia leyenda="Así quedará con los cambios de arriba, antes de guardar">
        <MuestraDeLaPagina f={form} nombreOptica={nombreOptica} datos={datos} />
      </VistaPrevia>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white px-1 py-3 shadow-[0_-10px_14px_-12px_rgba(14,43,51,0.35)]">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => guardar()} disabled={guardando || !sucio || !!subiendo}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD }}>
            {guardando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={descartar} disabled={guardando || !sucio}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"><Undo2 size={15} aria-hidden="true" /> Descartar cambios</button>
          {sucio && <span role="status" className="text-sm font-semibold text-amber-700">Tienes cambios sin guardar.</span>}
        </div>
      </div>

      {confirmarPerdida && (
        <ConfirmarEliminarModal titulo="¿Guardar sin lo que quedó a medias?"
          mensaje={`Hay ${confirmarPerdida.aMedias} ${confirmarPerdida.aMedias === 1 ? "servicio o pregunta escrito a medias" : "servicios, preguntas, razones u opiniones escritos a medias"} (falta el título o el texto). Si sigues, no se guardan. Puedes volver y completarlos.`}
          etiquetaConfirmar="Guardar sin ellos" onCancelar={() => setConfirmarPerdida(null)} onConfirmar={() => guardar(true)} />
      )}
    </div>
  )
}
