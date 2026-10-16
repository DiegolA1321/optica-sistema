"use client"

import { useCallback, useEffect, useState } from "react"
import { Megaphone } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import TablaSkeleton from "../TablaSkeleton"
import PestanaAvisos from "./PestanaAvisos"
import { BOTON_CERRAR } from "../ventas/estilos"
import { avisosUnificados } from "../../utilidades/comunicacionInterna"
import { avisarCambioSoporte, leerAvisosInternos, marcarAvisosInternosLeidos } from "../../utilidades/soporteDatos"

// Los avisos de la óptica para quien no tiene el permiso de Soporte (y por eso no ve esa sección): son comunicación de la óptica y le llegan a todo el
// personal destinatario. Se abre desde la campanita; se marcan como leídos a mano, igual que en la pestaña Avisos.
export default function VentanaAvisosInternos({ usuario, onCerrar }) {
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState("")
  const cargar = useCallback(async () => {
    const r = await leerAvisosInternos(usuario.id, false)
    if (r.error) setError(r.error)
    else { setError(""); setEstado(r) }
  }, [usuario.id])
  useEffect(() => { cargar() }, [cargar])

  const avisos = estado ? avisosUnificados({ internos: estado.datos.filter((a) => a.autorId !== usuario.id), leidosInternos: estado.leidos }) : []
  const marcar = async (a) => { await marcarAvisosInternosLeidos([a.id]); await cargar(); avisarCambioSoporte() }
  const marcarTodos = async () => { await marcarAvisosInternosLeidos(null); await cargar(); avisarCambioSoporte() }

  return (
    <Cascaron titulo="Avisos de tu administrador" subtitulo="Lo que tu administrador le avisa al personal" Icono={Megaphone} onCerrar={onCerrar} ancho="max-w-2xl"
      pie={<><span /><button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button></>}>
      <div className="px-5 py-4">
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        {estado === null && !error ? <TablaSkeleton /> : <PestanaAvisos avisos={avisos} onMarcar={marcar} onMarcarTodos={marcarTodos} onVerAyuda={onCerrar} accionVacio="Cerrar" />}
      </div>
    </Cascaron>
  )
}
