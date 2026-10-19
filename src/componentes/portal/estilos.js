// Botones del portal del paciente (diseño aprobado): texto de 17 px, 48 px de alto (regla 48), esquinas de 12 px. El color principal es el de la óptica (`--portal-acento`,
// azul #1D5FD6 si no tiene uno propio); el portal define --portal-acento y --portal-texto-boton en su raíz (ver `identidadDeLaOptica`).
const BASE = "inline-flex min-h-12 items-center justify-center gap-2 text-center rounded-xl px-5 py-2.5 text-base font-semibold leading-snug transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
export const BOTON_PRINCIPAL = BASE + " hover:brightness-110"
export const BOTON_SECUNDARIO = BASE + " border-[1.5px] border-slate-300/80 bg-white text-pt-marino hover:bg-slate-50"
export const BOTON_PELIGRO = BASE + " border-[1.5px] border-red-300 bg-white text-red-700 hover:bg-red-50"
// Sobre la franja oscura de la óptica: un botón blanco y otro transparente con borde claro.
export const BOTON_SOBRE_OSCURO = BASE + " bg-white text-pt-marino hover:bg-slate-100"
export const BOTON_BORDE_BLANCO = BASE + " border-[1.5px] border-white/35 text-white hover:bg-white/10"
// Enlace de texto del portal (por ejemplo «Ver mi receta completa»): azul, en negrita y de 44 px de alto al tocarlo.
export const ENLACE_AZUL = "inline-flex min-h-11 items-center gap-1 text-base font-semibold text-pt-azul hover:underline cursor-pointer"
export const ESTILO_PRINCIPAL = { background: "var(--portal-acento, #1D5FD6)", color: "var(--portal-texto-boton, #FFFFFF)" }
