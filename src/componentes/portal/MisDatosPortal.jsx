"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, AlertCircle, CheckCircle2, LogOut } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { esTelefonoValido, esEmailValido } from "../../utilidades/validaciones"
import { cambiarMisPermisos, leerMisPermisos } from "../../utilidades/permisosMensajes"
import { Cascaron } from "../AtencionPaciente"
import PermisosMensajes from "../PermisosMensajes"
import { Tarjeta, TituloTarjeta } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_PELIGRO, ESTILO_PRINCIPAL } from "./estilos"

// Mis datos: teléfono y correo se cambian aquí (y se reflejan en el perfil y en las citas del personal); el resto solo lo corrige la óptica.
export default function MisDatosPortal({ usuario, nombreOptica, citas, consultas, alActualizarUsuario, onCambiarClave, onCerrarSesion }) {
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

  const iniciales = (usuario?.nombre || "Paciente").split(/s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
  const desde = usuario?.fechaRegistro ? `${nombreMes(Number(String(usuario.fechaRegistro).slice(5, 7)) - 1)} de ${String(usuario.fechaRegistro).slice(0, 4)}` : ""
  const nacimiento = usuario?.fecha_nacimiento || usuario?.fechaNacimiento
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pt-suave font-heading text-xl font-bold text-pt-azul sm:h-[60px] sm:w-[60px] sm:text-2xl">{iniciales}</div>
        <div className="min-w-0">
          <h1 className="break-words font-heading text-2xl font-bold leading-tight tracking-tight text-pt-marino sm:text-[28px]">{usuario?.nombre || "Paciente"}</h1>
          <p className="text-base text-pt-texto sm:text-base">Paciente de {nombreOptica}{desde ? ` desde ${desde}` : ""}</p>
        </div>
      </div>

      <div className="pt-fila pt-fila--7-5 pt-fila--arriba">
        <Tarjeta aria-labelledby="contacto" className="sm:px-[30px] sm:py-7">
          <TituloTarjeta id="contacto">Cómo te contactamos</TituloTarjeta>
          <MisDatosContacto usuario={usuario} onActualizado={alActualizarUsuario} />
          <MisPermisosMensajes usuario={usuario} />
        </Tarjeta>

        <div className="space-y-5 sm:space-y-6">
          <Tarjeta aria-labelledby="personales">
            <TituloTarjeta id="personales">Tus datos personales</TituloTarjeta>
            <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-base">
              <dt className="text-pt-texto">Cédula</dt><dd className="font-semibold text-pt-marino">{usuario?.cedula || "No registrada"}</dd>
              <dt className="text-pt-texto">Nacimiento</dt><dd className="font-semibold text-pt-marino">{nacimiento ? formatoFecha(nacimiento, "largoSinDia") || nacimiento : "No registrado"}</dd>
            </dl>
            <p className="mt-4 text-base leading-relaxed text-pt-texto">Si alguno está mal, avísanos en la óptica y lo corregimos.</p>
          </Tarjeta>

          <Tarjeta aria-labelledby="cuenta">
            <TituloTarjeta id="cuenta">Tu cuenta</TituloTarjeta>
            {errorPrivacidad && !modalEliminarAbierto && (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorPrivacidad}</div>
            )}
            <div className="mt-4 space-y-3">
              <button type="button" onClick={onCambiarClave} className={BOTON_SECUNDARIO + " w-full"}>Cambiar contraseña</button>
              <button type="button" onClick={descargarMisDatos} disabled={descargando} className={BOTON_SECUNDARIO + " w-full"}>{descargando ? "Preparando…" : "Descargar una copia de mis datos"}</button>
              <button type="button" onClick={() => { setMotivoEliminar(""); setSolicitudEliminarEnviada(false); setErrorPrivacidad(""); setModalEliminarAbierto(true) }} className={BOTON_PELIGRO + " w-full"}>Pedir que eliminen mi cuenta</button>
              {onCerrarSesion && <button type="button" onClick={() => onCerrarSesion()} className={BOTON_SECUNDARIO + " w-full lg:hidden"}><LogOut size={20} aria-hidden="true" /> Cerrar sesión</button>}
            </div>
          </Tarjeta>
        </div>
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
    <section aria-label="Permisos para recibir mensajes" className="mt-7">
      <h3 className="mb-4 text-[17px] font-bold text-pt-marino">Mensajes que quieres recibir</h3>
      {error ? <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {error}</p>
        : !permisos ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        : <PermisosMensajes recordatorios={permisos.recordatorios} promociones={permisos.promociones} actualizadoEn={permisos.actualizadoEn} onCambiar={cambiar} quien="yo" casilla />}
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
    <div className="rounded-2xl border border-pt-borde px-4 py-3.5 sm:px-5">
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
    <div className="mt-5 space-y-4">
      {aviso && <div role="status" className="flex items-center gap-2 rounded-xl bg-[#E3F4EA] px-4 py-3 text-lg font-semibold text-[#166534]"><CheckCircle2 size={20} aria-hidden="true" /> {aviso}</div>}
      {caja("telefono", "Teléfono", { type: "tel", inputMode: "numeric", maxLength: 10, autoComplete: "tel" })}
      {caja("correo", "Correo", { type: "email", autoComplete: "email" })}
      {errorGeneral && <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorGeneral}</p>}
    </div>
  )
}
