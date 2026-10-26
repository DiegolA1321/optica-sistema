import { useConsulta } from "../componentes/portal/useAncho"

// El panel del personal tiene dos versiones: la de computadora (desde 1093 px de ancho, igual que siempre) y la de celular y tablet (por debajo de 1093 px).
// Es la única definición del límite: el modo celular se decide aquí y en ningún otro lugar.
export const ANCHO_ESCRITORIO = 1093
export const useModoCelular = () => !useConsulta(`(min-width: ${ANCHO_ESCRITORIO}px)`, true)

// Los módulos que en el celular se ven como «Se usa desde la computadora» (tablas y formularios que necesitan una pantalla grande), con el nombre que lleva su aviso.
export const MODULOS_SOLO_COMPUTADORA = ["ventas", "inventario", "reportes", "crm", "usuarios", "configuracion", "mensajes"]
export const esSoloComputadora = (id) => MODULOS_SOLO_COMPUTADORA.includes(id)

// Una acción de un módulo de computadora que aparece en una pantalla adaptada (por ejemplo «Nueva venta» o «Registrar abono» en el perfil) se ve igual,
// pero al tocarla solo dice esto, sin salir de la pantalla.
export const TEXTO_SOLO_COMPUTADORA = "Esto se hace desde la computadora."
export function avisarSoloComputadora() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("aviso-global", { detail: { texto: TEXTO_SOLO_COMPUTADORA, tipo: "error" } }))
}
