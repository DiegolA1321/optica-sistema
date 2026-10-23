import { Check } from "lucide-react"
import { INK } from "@/lib/tema"
import { horaSinCero as horaTexto } from "../../utilidades/formatoFecha"
import { linkWhatsApp } from "../../utilidades/whatsapp"
import { cuandoTexto, descargarIcs, enlaceComoLlegar } from "../../utilidades/agendarWeb"

const BOTON = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold transition-colors hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"

// Paso 3: la cita quedó agendada. «Agregar a mi calendario» baja un .ics (Ecuador); «Cómo llegar» y «Escribir por WhatsApp» solo aparecen si la óptica tiene dirección y teléfono.
export default function PasoListo({ fecha, hora, motivo, profesional, codigo, direccion, telefono, nombreOptica, duracionMinutos }) {
  const linea = [cuandoTexto(fecha, hora), motivo + (profesional ? ` con ${profesional}` : "")].filter(Boolean).join(" · ")
  const mapa = enlaceComoLlegar(direccion)
  const mensajeWhatsApp = `Hola, tengo una cita el ${cuandoTexto(fecha, horaTexto(hora))}. Mi código es ${codigo}.`
  const agregarAlCalendario = () => descargarIcs({
    codigo, fecha, hora, duracionMinutos,
    titulo: `Cita en ${nombreOptica}${motivo ? ` · ${motivo}` : ""}`,
    direccion,
    descripcion: profesional ? `Te atiende ${profesional}.` : "",
  })
  return (
    <div className="ac-step space-y-5 py-2 text-center">
      <div className="ac-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check size={32} strokeWidth={3} aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-serif text-3xl font-bold sm:text-4xl" style={{ color: INK }}>¡Tu cita está agendada!</h2>
        <p className="mt-2 text-base text-slate-700 sm:text-lg">{linea}</p>
        {codigo && <p className="mt-1 text-sm text-slate-600">Código de tu cita: <span className="font-mono text-base font-bold tracking-wide" style={{ color: INK }}>{codigo}</span></p>}
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={agregarAlCalendario} className={BOTON} style={{ color: INK }}>Agregar a mi calendario</button>
        {mapa && <a href={mapa} target="_blank" rel="noopener noreferrer" className={BOTON} style={{ color: INK }}>Cómo llegar</a>}
        {telefono && <a href={linkWhatsApp(telefono, mensajeWhatsApp)} target="_blank" rel="noopener noreferrer" className={BOTON} style={{ color: INK }}>Escribir por WhatsApp</a>}
      </div>

      <p className="rounded-xl bg-slate-50 px-4 py-3 text-left text-base text-slate-700">
        <strong style={{ color: INK }}>Qué llevar:</strong> tus lentes actuales y llega 10 minutos antes. Si no puedes venir, avísanos por WhatsApp.
      </p>
      <p className="text-sm leading-relaxed text-slate-600">
        La óptica ya ve tu cita en su agenda. Si quieres ver tus citas y tu receta en línea, pide en la óptica el acceso a tu portal.
      </p>
    </div>
  )
}
