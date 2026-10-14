import { useCallback, useEffect, useState } from "react"
import { EVENTO_FE_CAMBIADA, leerFacturaElectronica } from "../../utilidades/facturaElectronicaApi"

// Lo guardado de la factura electrónica de una venta (datos, archivos vigentes y últimos movimientos); se vuelve a leer cuando se registra o corrige.
export function useFacturaElectronica(facturaId, numero) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, archivos: { pdf: null, xml: null }, eventos: [] })
  const recargar = useCallback(() => leerFacturaElectronica(facturaId).then((r) => setEstado({ cargando: false, ...r })), [facturaId])
  useEffect(() => {
    recargar()
    const alCambiar = (e) => { if (e.detail === facturaId) recargar() }
    window.addEventListener(EVENTO_FE_CAMBIADA, alCambiar)
    return () => window.removeEventListener(EVENTO_FE_CAMBIADA, alCambiar)
  }, [facturaId, numero, recargar])
  return { ...estado, recargar }
}
