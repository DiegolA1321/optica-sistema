import { estadoAtencionHoy } from "../../utilidades/disponibilidad"
import { formatearTelefonoEC, linkWhatsApp } from "../../utilidades/whatsapp"

const NAVY = "#0B1633"

// «¿Olvidaste tu contraseña?»: la óptica le da una contraseña temporal y, al ingresar con ella, la persona crea una nueva
// (esa lógica no cambia). Aquí solo se le dice a quién escribir o llamar, con el mensaje de WhatsApp ya escrito.
export default function OlvidoClave({ opticaPublica, disponibilidad, usuario = "", onVolver, botonCerrar }) {
  const telefono = (opticaPublica?.settings?.opticaTelefono || "").trim()
  const direccion = (opticaPublica?.settings?.opticaDireccion || "").trim()
  const numero = telefono ? formatearTelefonoEC(telefono) : ""
  const cedula = /^\d+$/.test(usuario.trim()) ? usuario.trim() : "…"
  const mensaje = `Hola, olvidé mi contraseña del portal. Mi cédula es ${cedula}.`
  const estado = disponibilidad?.horarioSemanal ? estadoAtencionHoy(disponibilidad).texto.replace(/\b0(\d:\d\d)/g, "$1") : ""
  const lineaInfo = [estado, direccion].filter(Boolean).join(" · ")

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onVolver} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:underline cursor-pointer">← Volver</button>
        {botonCerrar}
      </div>
      <h2 id="titulo-login" className="mt-1 font-serif text-2xl font-bold leading-tight sm:text-[1.7rem]" style={{ color: NAVY }}>¿Olvidaste tu contraseña?</h2>
      <p className="mt-2 text-base leading-relaxed text-slate-700">
        {numero
          ? "Escríbenos o llámanos: la óptica te da una contraseña temporal, y al ingresar con ella creas una nueva."
          : "Pide tu contraseña temporal en la óptica: te la damos y, al ingresar con ella, creas una nueva."}
      </p>
      {numero && (
        <div className="mt-4 flex flex-col gap-3">
          <a href={linkWhatsApp(telefono, mensaje)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl bg-green-700 px-4 text-base font-semibold text-white transition-colors hover:bg-green-800">Escribir por WhatsApp</a>
          <a href={"tel:+" + numero} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold transition-colors hover:bg-slate-50" style={{ color: NAVY }}>Llamar al {telefono}</a>
        </div>
      )}
      {lineaInfo && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">{lineaInfo}</p>}
      {numero && <p className="mt-4 text-xs leading-relaxed text-slate-500">El mensaje de WhatsApp va ya escrito: "{mensaje}"</p>}
    </div>
  )
}
