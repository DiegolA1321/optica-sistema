import { useCallback, useEffect, useState } from "react"
import { misCompras } from "../../utilidades/facturaElectronicaApi"
import { misOrdenes, miControl } from "../../utilidades/portalDatos"

// Compras (con su saldo), órdenes de laboratorio y control del paciente, pedidos una sola vez para todo el portal (Resumen y Mis compras leen lo mismo).
export function usePortalDatos(usuario) {
  const pacienteId = typeof usuario?.id === "string" ? usuario.id : null
  const token = usuario?.token
  const [estado, setEstado] = useState({ cargando: true, compras: [], errorCompras: "", ordenes: [], control: null })
  const cargar = useCallback(() => {
    let vivo = true
    Promise.all([misCompras(pacienteId, token), misOrdenes(pacienteId, token), miControl(pacienteId, token)]).then(([c, o, k]) => {
      if (vivo) setEstado({ cargando: false, compras: c.compras, errorCompras: c.error || "", ordenes: o.ordenes, control: k })
    })
    return () => { vivo = false }
  }, [pacienteId, token])
  useEffect(() => cargar(), [cargar])
  return estado
}
