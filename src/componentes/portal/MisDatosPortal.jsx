"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, AlertCircle, CheckCircle2, LogOut, Phone, IdCard, Bell, ShieldCheck } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { esTelefonoValido, esEmailValido } from "../../utilidades/validaciones"
import { cambiarMisPermisos, leerMisPermisos } from "../../utilidades/permisosMensajes"
import { Cascaron } from "../AtencionPaciente"
import PermisosMensajes from "../PermisosMensajes"
import { Tarjeta } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_PELIGRO, ESTILO_PRINCIPAL } from "./estilos"

// Mis datos: teléfono y correo se cambian aquí (y se reflejan en el perfil y en las citas del personal); el resto solo lo corrige la óptica.
export default function MisDatosPortal({ usuario, nombreOptica, citas, consultas, visitas = 0, compras = 0, puntos = null, alActualizarUsuario, onCambiarClave, onCerrarSesion }) {
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [motivoEliminar, setMotivoEliminar] = useState("")
  const [enviandoEliminar, setEnviandoEliminar] = useState(false)
  const [solicitudEliminarEnviada, setSolicitudEliminarEnviada] = useState(false)
  const [errorPrivacidad, setErrorPrivacidad] = useState("")
  const [descargando, setDescargando] = useState(false)

  // Derecho de acceso: el servidor arma el archivo con los datos personales y clínicos del paciente, sin campos internos.
  const descargarMisDatos = async () => {
    if (descargando) return
    setErrorPrivacidad("")
    setDescargando(true)
    let datos = null
    if (supabase) {
      const { data, error } = await supabase.rpc("exportar_mis_datos_paciente", { p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null, p_token: usuario?.token })
      if (error || !data) { setDescargando(false); setErrorPrivacidad("No pudimos preparar tus datos. Intenta de nuevo en un momento."); return }
      datos = data
    } else {
      datos = { perfil: { nombre: usuario?.nombre, cedula: usuario?.cedula }, citas, consultas, exportado_en: hoyISO() }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }))
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = "mis-datos-" + hoyISO() + ".json"
    enlace.click()
    URL.revokeObjectURL(url)
    setDescargando(false)
  }

  const confirmarSolicitudEliminar = async () => {
    if (!supabase || enviandoEliminar) return
    setEnviandoEliminar(true)
    setErrorPrivacidad("")
    const { data, error } = await supabase.rpc("solicitar_eliminacion_paciente", {
      p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
      p_token: usuario?.token,
      p_motivo: motivoEliminar.trim() || null,
    })
    setEnviandoEliminar(false)
    if (error || !data) { setErrorPrivacidad("No pudimos enviar tu solicitud. Intenta de nuevo."); return }
    setSolicitudEliminarEnviada(true)
  }

  const iniciales = (usuario?.nombre || "Paciente").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
  const desde = usuario?.fechaRegistro ? `${nombreMes(Number(String(usuario.fechaRegistro).slice(5, 7)) - 1)} de ${String(usuario.fechaRegistro).slice(0, 4)}` : ""
  const nacimiento = usuario?.fecha_nacimiento || usuario?.fechaNacimiento
  return (
    <div className="space-y-5 sm:space-y-6">
      <h1 className="sr-only">Mis datos</h1>
      <section aria-label="Tu cuenta" className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded-[20px] bg-pt-marino px-5 py-5 text-white sm:px-[42px] sm:py-7">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-heading text-2xl font-bold sm:h-20 sm:w-20 sm:text-3xl" style={{ background: "var(--portal-acento, #1D5FD6)", color: "var(--portal-texto-boton, #FFFFFF)" }}>{iniciales}</div>
          <div className="min-w-0">
            <p className="break-words font-heading text-2xl font-bold leading-tight tracking-tight sm:text-[34px]">{usuario?.nombre || "Paciente"}</p>
            <p className="mt-1 text-base text-white/85">Paciente de {nombreOptica}{desde ? ` desde ${desde}` : ""}</p>
          </div>
        </div>
        <dl className="flex shrink-0 gap-3">
          {[[visitas, visitas === 1 ? "visita" : "visitas"], [compras, compras === 1 ? "compra" : "compras"], ...(puntos ? [[puntos.puntos, "puntos", true]] : [])].map(([n, t, verde]) => (
            <div key={t} className="min-w-[78px] rounded-2xl bg-white/10 px-4 py-3 text-center sm:min-w-[96px]">
              <dd className={"font-heading text-[28px] font-bold leading-none tabular-nums " + (verde ? "text-[#6EE7A8]" : "text-white")}>{n}</dd>
              <dt className="mt-1 text-base text-white/85">{t}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="pt-fila pt-fila--dos">
        <Seccion id="contacto" titulo="Cómo te contactamos" Icono={Phone}>
          <MisDatosContacto usuario={usuario} onActualizado={alActualizarUsuario} />
        </Seccion>

        <Seccion id="personales" titulo="Tus datos personales" Icono={IdCard}>
          <dl className="divide-y divide-pt-borde">
            {[["Cédula", usuario?.cedula || "No registrada"], ["Fecha de nacimiento", nacimiento ? formatoFecha(nacimiento, "largoSinDia") || nacimiento : "No registrada"]].map(([t, v]) => (
              <div key={t} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4 first:pt-0">
                <div className="min-w-0"><dt className="text-base text-pt-texto">{t}</dt><dd className="text-lg font-semibold text-pt-marino">{v}</dd></div>
                <p className="text-base text-pt-texto">Lo corrige la óptica</p>
              </div>
            ))}
          </dl>
        </Seccion>

        <Seccion id="mensajes" titulo="Mensajes que quieres recibir" Icono={Bell}>
          <MisPermisosMensajes usuario={usuario} />
        </Seccion>

        <Seccion id="seguridad" titulo="Seguridad y privacidad" Icono={ShieldCheck}>
          {errorPrivacidad && !modalEliminarAbierto && (
            <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorPrivacidad}</div>
          )}
          <ul className="divide-y divide-pt-borde">
            <Accion titulo="Contraseña" texto="Protege el acceso a tu cuenta" boton="Cambiar" onClick={onCambiarClave} etiqueta="Cambiar contraseña" />
            <Accion titulo="Una copia de tus datos" texto="Tus datos, citas e historial en un archivo" boton={descargando ? "Preparando…" : "Descargar"} onClick={descargarMisDatos} deshabilitado={descargando} etiqueta="Descargar una copia de mis datos" />
            <Accion peligro titulo="Eliminar mi cuenta" texto="Le pedimos a la óptica que borre tu cuenta y tus datos" boton="Solicitar" onClick={() => { setMotivoEliminar(""); setSolicitudEliminarEnviada(false); setErrorPrivacidad(""); setModalEliminarAbierto(true) }} etiqueta="Pedir que eliminen mi cuenta" />
          </ul>
          {onCerrarSesion && <button type="button" onClick={() => onCerrarSesion()} className={BOTON_SECUNDARIO + " mt-4 w-full lg:hidden"}><LogOut size={20} aria-hidden="true" /> Cerrar sesión</button>}
        </Seccion>
      </div>

      {modalEliminarAbierto && (
        <Cascaron
          pantallaCompletaEnCelular
          titulo={solicitudEliminarEnviada ? "Solicitud enviada" : "¿Eliminar tu cuenta?"}
          subtitulo={solicitudEliminarEnviada ? nombreOptica + " revisará tu pedido." : "Tus datos y tu cuenta"}
          Icono={solicitudEliminarEnviada ? CheckCircle2 : ShieldAlert}
          ancho="max-w-md"
          onCerrar={() => !enviandoEliminar && setModalEliminarAbierto(false)}
          pie={solicitudEliminarEnviada ? (<>
            <span />
            <button type="button" onClick={() => setModalEliminarAbierto(false)} className={BOTON_SECUNDARIO}>Cerrar</button>
          </>) : (<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setModalEliminarAbierto(false)} disabled={enviandoEliminar} className={BOTON_SECUNDARIO}>Cancelar</button>
              <button type="button" onClick={confirmarSolicitudEliminar} disabled={enviandoEliminar} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">
                {enviandoEliminar ? "Enviando…" : "Sí, solicitar"}
              </button>
            </div>
          </>)}
        >
          <div className="p-5">
            {solicitudEliminarEnviada ? (
              <p className="text-lg text-slate-700">{nombreOptica} revisará tu pedido y se pondrá en contacto contigo.</p>
            ) : (
              <>
                <p className="text-lg text-slate-700">Le avisamos a {nombreOptica} para que elimine tu cuenta y tus datos. Esto no borra nada al instante — la óptica te contactará.</p>
                {errorPrivacidad && (
                  <div role="alert" className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700">
                    <AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorPrivacidad}
                  </div>
                )}
                <textarea
                  rows={3} value={motivoEliminar} onChange={(e) => setMotivoEliminar(e.target.value)} maxLength={500}
                  aria-label="Motivo (opcional)"
                  placeholder="¿Por qué quieres eliminar tu cuenta? (opcional)"
                  className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 outline-none transition focus-visible:border-red-400 focus-visible:bg-white"
                />
              </>
            )}
          </div>
        </Cascaron>
      )}
    </div>
  )
}

// Una sección de «Mis datos»: ícono en su baldosa, título y contenido.
function Seccion({ id, titulo, Icono, children }) {
  return (
    <Tarjeta aria-labelledby={id} className="sm:px-[34px] sm:py-7">
      <div className="flex items-center gap-4 border-b border-pt-borde pb-4">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pt-suave text-pt-azul"><Icono size={22} /></span>
        <h2 id={id} className="font-heading text-xl font-bold text-pt-marino">{titulo}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </Tarjeta>
  )
}
// Una acción de «Seguridad y privacidad»: lo que hace y su botón (el de eliminar, en rojo).
function Accion({ titulo, texto, boton, onClick, deshabilitado = false, peligro = false, etiqueta }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className={"text-base font-semibold " + (peligro ? "text-red-700" : "text-pt-marino")}>{titulo}</p>
        <p className="text-base leading-snug text-pt-texto">{texto}</p>
      </div>
      <button type="button" onClick={onClick} disabled={deshabilitado} aria-label={etiqueta} className={(peligro ? BOTON_PELIGRO : BOTON_SECUNDARIO) + " shrink-0"}>{boton}</button>
    </li>
  )
}

// Los dos permisos para recibir mensajes: el paciente los ve y los cambia aquí, y la óptica los respeta (el servidor lo exige).
function MisPermisosMensajes({ usuario }) {
  const [permisos, setPermisos] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let vivo = true
    leerMisPermisos(typeof usuario?.id === "string" ? usuario.id : null, usuario?.token).then((r) => { if (!vivo) return; if (r.ok) setPermisos(r); else setError(r.error) })
    return () => { vivo = false }
  }, [usuario?.id, usuario?.token])
  const cambiar = async (cambios) => {
    const r = await cambiarMisPermisos(typeof usuario?.id === "string" ? usuario.id : null, usuario?.token, cambios)
    if (r.ok) setPermisos((p) => ({ ...p, ...(r.recordatorios !== undefined ? { recordatorios: r.recordatorios, promociones: r.promociones, actualizadoEn: r.actualizadoEn } : cambios) }))
    return r
  }
  return (
    <section aria-label="Permisos para recibir mensajes">
      {error ? <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {error}</p>
        : !permisos ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        : <PermisosMensajes recordatorios={permisos.recordatorios} promociones={permisos.promociones} actualizadoEn={permisos.actualizadoEn} onCambiar={cambiar} quien="yo" interruptor />}
    </section>
  )
}

// Teléfono y correo se pueden cambiar desde el portal (cada uno con su «Cambiar»); el resto (nombre, cédula, nacimiento) solo lo corrige la óptica.
// El portal inicia sesión con la cédula (o el usuario), no con el correo: cambiar el correo no cambia cómo entra el paciente.
const sinDato = (v) => !v || /^sin /i.test(String(v).trim())
function MisDatosContacto({ usuario, onActualizado }) {
  const [editando, setEditando] = useState("") // "telefono" | "correo" | ""
  const [valor, setValor] = useState("")
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const actual = { telefono: sinDato(usuario?.telefono) ? "" : usuario.telefono, correo: sinDato(usuario?.correo) ? "" : usuario.correo }
  const empezar = (campo) => { setValor(actual[campo]); setError(""); setErrorGeneral(""); setAviso(""); setEditando(campo) }
  const cancelar = () => { setEditando(""); setError(""); setErrorGeneral("") }

  const guardar = async (e) => {
    e?.preventDefault()
    const nuevo = valor.trim()
    if (editando === "telefono") {
      if (!nuevo) { setError("Ingresa tu teléfono."); return }
      if (!esTelefonoValido(nuevo, false)) { setError("El teléfono debe tener entre 7 y 10 dígitos, sin espacios ni guiones."); return }
    } else {
      if (!nuevo) { setError("Ingresa tu correo."); return }
      if (!esEmailValido(nuevo, false)) { setError("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    }
    setError("")
    const cambia = editando === "telefono" ? nuevo !== actual.telefono : nuevo.toLowerCase() !== actual.correo.toLowerCase()
    if (!cambia) { setEditando(""); return }
    setGuardando(true)
    setErrorGeneral("")
    let guardado = nuevo
    if (supabase) {
      const { data, error: errorRpc } = await supabase.rpc("actualizar_contacto_paciente", {
        p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
        p_token: usuario?.token,
        p_telefono: editando === "telefono" ? nuevo : null,
        p_correo: editando === "correo" ? nuevo : null,
      })
      setGuardando(false)
      if (errorRpc || !data) { setErrorGeneral("No pudimos guardar tus cambios. Revisa tu conexión e intenta de nuevo."); return }
      if (data.ok !== true) {
        setErrorGeneral(data.error === "sesion" ? "Tu sesión venció. Cierra sesión y vuelve a entrar para cambiar tus datos." : data.error || "No pudimos guardar tus cambios.")
        return
      }
      guardado = editando === "telefono" ? data.telefono : data.correo
    } else {
      setGuardando(false)
    }
    onActualizado?.({ [editando]: guardado })
    setAviso(editando === "telefono" ? "Listo: actualizamos tu teléfono." : "Listo: actualizamos tu correo.")
    setEditando("")
    setTimeout(() => setAviso(""), 6000)
  }

  const caja = (campo, etiqueta, inputProps) => (
    <div className="border-t border-pt-borde py-4 first:border-t-0 first:pt-0">
      {editando === campo ? (
        <form onSubmit={guardar} noValidate>
          <label htmlFor={"mis-datos-" + campo} className="text-base text-pt-texto">{etiqueta}</label>
          <input id={"mis-datos-" + campo} value={valor} onChange={(e) => setValor(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "mis-datos-error" : undefined} className={"mt-1 min-h-12 w-full rounded-xl border px-3 py-2 text-xl font-semibold text-pt-marino outline-none transition-colors focus-visible:ring-2 " + (error ? "border-red-300 focus-visible:ring-red-100" : "border-pt-azul/50 focus-visible:ring-blue-100")} {...inputProps} />
          {error && <p id="mis-datos-error" role="alert" className="mt-1.5 flex items-center gap-1 text-base font-medium text-red-600"><AlertCircle size={16} aria-hidden="true" /> {error}</p>}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancelar} disabled={guardando} className={BOTON_SECUNDARIO}>Cancelar</button>
            <button type="submit" disabled={guardando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base text-pt-texto">{etiqueta}</p>
            <p className={"break-all text-lg leading-snug " + (actual[campo] ? "font-semibold text-pt-marino" : "text-pt-texto")}>{actual[campo] || "Sin registrar"}</p>
          </div>
          <button type="button" onClick={() => empezar(campo)} aria-label={"Cambiar " + etiqueta.toLowerCase()} className={BOTON_SECUNDARIO + " shrink-0 px-4"}>Cambiar</button>
        </div>
      )}
    </div>
  )
  return (
    <div>
      {aviso && <div role="status" className="flex items-center gap-2 rounded-xl bg-[#E3F4EA] px-4 py-3 text-lg font-semibold text-[#166534]"><CheckCircle2 size={20} aria-hidden="true" /> {aviso}</div>}
      {caja("telefono", "Teléfono y WhatsApp", { type: "tel", inputMode: "numeric", maxLength: 10, autoComplete: "tel" })}
      {caja("correo", "Correo", { type: "email", autoComplete: "email" })}
      {errorGeneral && <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorGeneral}</p>}
    </div>
  )
}
