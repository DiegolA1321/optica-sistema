// «Contactar al paciente» (reunión del 20 oct., D4; reemplaza a «Citas por reagendar»): toda cita «No efectuada» y toda cita cancelada por el paciente aparece aquí, con
//   · «Reagendar» (abre la agenda con el paciente elegido; la cita nueva hereda el borrador de la ficha, si lo hay),
//   · «Escribir por WhatsApp» (mensaje ya redactado según el motivo; queda como «contactada» en el seguimiento de la cita),
//   · «Descartar» (con motivo).
// A los 30 días sin atender deja de aparecer y su seguimiento dice «Sin seguimiento». Nada se reagenda solo. Lógica pura + un hook que lee el seguimiento de esas citas.
import { useEffect, useMemo, useState } from "react"
import { citasParaReagendar } from "./controles"
import { leerEventosDeCitas } from "./eventosCita"
import { formatoFecha } from "./formatoFecha"
import { claveBorrador, leerBorrador, guardarBorrador } from "./borradorFicha"
import { supabase } from "../lib/supabaseClient"

export const TIPO_AVISO_CONTACTAR = "citas:contactar_paciente"
export const DIAS_PARA_SIN_SEGUIMIENTO = 30

// Las citas por contactar: las de citasParaReagendar (una por paciente, la más reciente, sin otra cita activa ni atendida después, de los últimos 30 días) menos las descartadas.
export const citasPorContactar = (citas, descartes = new Map(), opciones) => citasParaReagendar(citas, opciones).filter((c) => !descartes.has(`${TIPO_AVISO_CONTACTAR}|${c.id}`))

// Qué pasó con la cita, en palabras: el motivo guardado («El paciente no asistió», «La atención se inició y no se terminó», «El paciente no puede asistir»…).
// Sin seguimiento guardado (una cita anterior a la migración 0134) se deduce de su estado.
export function motivoDeLaCita(cita, seguimiento) {
  const guardado = seguimiento?.get(cita.id)?.motivo
  if (guardado) return guardado
  return cita.estado === "No Asistió" ? "El paciente no asistió" : "El paciente canceló su cita"
}

// Seguimiento de las citas por contactar: el motivo de cada una, cuándo se le escribió y si ya está «sin seguimiento». Se vuelve a leer cuando cambian las citas (o cada minuto).
export function useSeguimientoDeContacto(citas, habilitado) {
  const ids = useMemo(() => citasParaReagendar(citas).map((c) => c.id), [citas])
  const clave = ids.join(",")
  const [seguimiento, setSeguimiento] = useState(() => new Map())
  useEffect(() => {
    if (!habilitado || !supabase || ids.length === 0 || import.meta.env.MODE === "test") return undefined
    let vivo = true
    const cargar = async () => {
      const eventos = await leerEventosDeCitas(ids)
      if (!vivo) return
      const mapa = new Map()
      for (const e of eventos) {
        const previo = mapa.get(e.citaId) || { motivo: "", contactadaEn: null, sinSeguimiento: false }
        if (e.tipo === "no_efectuada" || e.tipo === "cancelada") previo.motivo = e.datos?.motivo || previo.motivo
        if (e.tipo === "contactada") previo.contactadaEn = e.en
        if (e.tipo === "sin_seguimiento") previo.sinSeguimiento = true
        mapa.set(e.citaId, previo)
      }
      setSeguimiento(mapa)
    }
    cargar()
    const t = setInterval(() => { if (!document.hidden) cargar() }, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [clave, habilitado]) // eslint-disable-line react-hooks/exhaustive-deps
  return seguimiento
}

// «Escribir por WhatsApp» queda en el seguimiento de la cita (sin esperar la respuesta: lo que importa es abrir WhatsApp dentro del clic).
export const registrarContacto = (citaId, medio = "whatsapp") => (supabase ? supabase.rpc("registrar_contacto_cita", { p_cita_id: citaId, p_medio: medio }) : Promise.resolve({}))

// La cita nueva hereda el borrador de la ficha de la que no se efectuó: el borrador vive en este navegador, con la clave (persona, paciente, cita); se copia a la clave de la cita nueva.
// Devuelve true si había un borrador que heredar.
export function heredarBorrador(usuarioId, pacienteId, citaOrigenId, citaNuevaId) {
  const origen = claveBorrador(usuarioId, pacienteId, citaOrigenId)
  const destino = claveBorrador(usuarioId, pacienteId, citaNuevaId)
  const b = leerBorrador(origen)
  if (!b || !destino || origen === destino) return false
  return guardarBorrador(destino, b.datos, b.guardadoEn)
}
