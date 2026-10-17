"use client"

import { useEffect, useState } from "react"
import { KeyRound, Lock, Download, ShieldAlert, AlertCircle, CheckCircle2 } from "lucide-react"
import { INK } from "@/lib/tema"
import { supabase } from "../../lib/supabaseClient"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { esTelefonoValido, esEmailValido } from "../../utilidades/validaciones"
import { cambiarMisPermisos, leerMisPermisos } from "../../utilidades/permisosMensajes"
import { Cascaron } from "../AtencionPaciente"
import PermisosMensajes from "../PermisosMensajes"
import { TituloPagina } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_PELIGRO, ESTILO_PRINCIPAL } from "./estilos"

// Mis datos: teléfono y correo se cambian aquí (y se reflejan en el perfil y en las citas del personal); el resto solo lo corrige la óptica.
export default function MisDatosPortal({ usuario, nombreOptica, citas, consultas, alActualizarUsuario, onCambiarClave }) {
  const primerNombre = usuario?.nombre?.split(" ")[0] || "Paciente"
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

  return (
    <div className="space-y-5">
      <TituloPagina subtitulo="Tus datos personales y de contacto.">Mis datos</TituloPagina>

      <div className="pt-fila pt-fila--7-5 pt-fila--arriba">
      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: "var(--portal-grad)", color: "var(--portal-texto-boton)" }}>{primerNombre[0]?.toUpperCase()}</div>
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold" style={{ color: INK }}>{usuario?.nombre || "Paciente"}</h2>
            <p className="text-lg text-slate-600">Paciente de {nombreOptica}</p>
          </div>
        </div>

        <MisDatosContacto usuario={usuario} onActualizado={alActualizarUsuario} />
        <MisPermisosMensajes usuario={usuario} />

        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-semibold" style={{ color: INK }}>Contraseña</p>
            <p className="text-base text-slate-600">Cámbiala cuando quieras por seguridad.</p>
          </div>
          <button type="button" onClick={onCambiarClave} className={BOTON_SECUNDARIO + " w-full sm:w-auto"}><KeyRound size={20} aria-hidden="true" /> Cambiar contraseña</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold" style={{ color: INK }}>Privacidad y tus datos</h2>
        <p className="mt-1 text-lg text-slate-600">Tus datos son tuyos — puedes descargarlos o pedirnos que los eliminemos cuando quieras.</p>

        {errorPrivacidad && !modalEliminarAbierto && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700">
            <AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorPrivacidad}
          </div>
        )}

        <div className="mt-4 flex flex-col items-start gap-3 border-t border-slate-100 pt-5">
          <div>
            <p className="text-lg font-semibold" style={{ color: INK }}>Una copia de tus datos</p>
            <p className="text-base text-slate-600">Un archivo con tus datos personales, tus citas y tu historial clínico, incluidos tus antecedentes y alergias.</p>
          </div>
          <button type="button" onClick={descargarMisDatos} disabled={descargando} className={BOTON_SECUNDARIO + " w-full"}>
            <Download size={20} aria-hidden="true" /> {descargando ? "Preparando…" : "Descargar mis datos"}
          </button>
        </div>

        <div className="mt-4 flex flex-col items-start gap-3 border-t border-slate-100 pt-5">
          <div>
            <p className="text-lg font-semibold text-red-600">Eliminar mi cuenta</p>
            <p className="text-base text-slate-600">Le pedimos a {nombreOptica} que elimine tu cuenta y tus datos.</p>
          </div>
          <button type="button" onClick={() => { setMotivoEliminar(""); setSolicitudEliminarEnviada(false); setErrorPrivacidad(""); setModalEliminarAbierto(true) }} className={BOTON_PELIGRO + " w-full"}>
            <ShieldAlert size={20} aria-hidden="true" /> Solicitar eliminación
          </button>
        </div>
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
    <section aria-label="Permisos para recibir mensajes" className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="text-lg font-bold" style={{ color: INK }}>Mensajes que quieres recibir</h3>
      <p className="mb-3 mt-0.5 text-base text-slate-600">Tú decides. Puedes cambiarlo cuando quieras.</p>
      {error ? <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {error}</p>
        : !permisos ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        : <PermisosMensajes recordatorios={permisos.recordatorios} promociones={permisos.promociones} actualizadoEn={permisos.actualizadoEn} onCambiar={cambiar} quien="yo" grande />}
    </section>
  )
}

// Teléfono y correo se pueden cambiar desde el portal; el resto (nombre, cédula, nacimiento) solo lo corrige la óptica.
// El portal inicia sesión con la cédula (o el usuario), no con el correo: cambiar el correo no cambia cómo entra el paciente.
const sinDato = (v) => !v || /^sin /i.test(String(v).trim())
function MisDatosContacto({ usuario, onActualizado }) {
  const [editando, setEditando] = useState(false)
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const telActual = sinDato(usuario?.telefono) ? "" : usuario.telefono
  const corActual = sinDato(usuario?.correo) ? "" : usuario.correo
  const nacimiento = usuario?.fecha_nacimiento || usuario?.fechaNacimiento
  const empezar = () => { setTelefono(telActual); setCorreo(corActual); setErrores({}); setErrorGeneral(""); setAviso(""); setEditando(true) }
  const cancelar = () => { setEditando(false); setErrores({}); setErrorGeneral("") }

  const guardar = async (e) => {
    e?.preventDefault()
    const tel = telefono.trim()
    const cor = correo.trim()
    const errs = {}
    if (!tel) errs.telefono = "Ingresa tu teléfono."
    else if (!esTelefonoValido(tel, false)) errs.telefono = "El teléfono debe tener entre 7 y 10 dígitos, sin espacios ni guiones."
    if (!cor) errs.correo = "Ingresa tu correo."
    else if (!esEmailValido(cor, false)) errs.correo = "Ingresa un correo válido (ej. nombre@dominio.com)."
    setErrores(errs)
    if (Object.keys(errs).length > 0) return
    const cambiaTel = tel !== telActual
    const cambiaCor = cor.toLowerCase() !== corActual.toLowerCase()
    if (!cambiaTel && !cambiaCor) { setEditando(false); return }
    setGuardando(true)
    setErrorGeneral("")
    let nuevoTel = tel
    let nuevoCor = cor
    if (supabase) {
      const { data, error } = await supabase.rpc("actualizar_contacto_paciente", {
        p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
        p_token: usuario?.token,
        p_telefono: cambiaTel ? tel : null,
        p_correo: cambiaCor ? cor : null,
      })
      setGuardando(false)
      if (error || !data) { setErrorGeneral("No pudimos guardar tus cambios. Revisa tu conexión e intenta de nuevo."); return }
      if (data.ok !== true) {
        setErrorGeneral(data.error === "sesion" ? "Tu sesión venció. Cierra sesión y vuelve a entrar para cambiar tus datos." : data.error || "No pudimos guardar tus cambios.")
        return
      }
      nuevoTel = data.telefono
      nuevoCor = data.correo
    } else {
      setGuardando(false)
    }
    onActualizado?.({ telefono: nuevoTel, correo: nuevoCor })
    setEditando(false)
    setAviso(cambiaTel && cambiaCor ? "Listo: actualizamos tu teléfono y tu correo." : cambiaTel ? "Listo: actualizamos tu teléfono." : "Listo: actualizamos tu correo.")
    setTimeout(() => setAviso(""), 6000)
  }

  const fijo = (label, valor) => (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="flex items-center justify-between text-base font-semibold text-slate-600">{label} <Lock size={16} aria-label="Solo la óptica puede cambiarlo" /></p>
      <p className="mt-1 break-words text-lg font-semibold text-slate-800">{valor || "No registrado"}</p>
    </div>
  )
  const campo = (id, label, valor, setValor, error, props) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label htmlFor={id} className="flex items-center justify-between text-base font-semibold text-slate-600">{label}</label>
      <input id={id} value={valor} onChange={(e) => setValor(e.target.value)} aria-invalid={!!error} aria-describedby={error ? id + "-error" : undefined} className={"mt-1 min-h-12 w-full rounded-lg border px-3 py-2 text-lg font-semibold outline-none transition-colors focus-visible:ring-2 " + (error ? "border-red-300 focus-visible:ring-red-100" : "border-blue-300 focus-visible:ring-blue-100")} style={{ color: INK }} {...props} />
      {error && <p id={id + "-error"} role="alert" className="mt-1.5 flex items-center gap-1 text-base font-medium text-red-600"><AlertCircle size={16} aria-hidden="true" /> {error}</p>}
    </div>
  )
  const editable = (label, valor) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center justify-between text-base font-semibold text-slate-600">{label}
        <button type="button" onClick={empezar} className="inline-flex min-h-11 items-center px-2 text-base font-bold text-blue-700 hover:underline cursor-pointer">Editar</button>
      </p>
      <p className={"mt-1 break-all text-lg " + (valor ? "font-semibold" : "text-slate-500")} style={valor ? { color: INK } : undefined}>{valor || "Sin registrar"}</p>
    </div>
  )
  return (
    <form onSubmit={guardar} noValidate className="mt-5">
      {aviso && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-lg font-semibold text-emerald-700"><CheckCircle2 size={20} aria-hidden="true" /> {aviso}</div>}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {fijo("Nombre", usuario?.nombre)}
        {fijo("Cédula", usuario?.cedula)}
        {fijo("Fecha de nacimiento", nacimiento ? formatoFecha(nacimiento, "medio") || nacimiento : "")}
        {fijo("Paciente desde", usuario?.fechaRegistro ? formatoFecha(usuario.fechaRegistro, "medio") : "")}
        {editando ? campo("mis-datos-telefono", "Teléfono", telefono, setTelefono, errores.telefono, { type: "tel", inputMode: "numeric", maxLength: 10, autoComplete: "tel" }) : editable("Teléfono", telActual)}
        {editando ? campo("mis-datos-correo", "Correo", correo, setCorreo, errores.correo, { type: "email", autoComplete: "email" }) : editable("Correo", corActual)}
      </div>
      <p className="mt-3.5 flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-600"><Lock size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> Para corregir tu nombre, cédula o fecha de nacimiento, comunícate con la óptica. Tu teléfono y tu correo son donde te enviamos recordatorios y avisos.</p>
      {errorGeneral && <p role="alert" className="mt-3 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {errorGeneral}</p>}
      {editando && (
        <div className="mt-3.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={cancelar} disabled={guardando} className={BOTON_SECUNDARIO}>Cancelar</button>
          <button type="submit" disabled={guardando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      )}
    </form>
  )
}
