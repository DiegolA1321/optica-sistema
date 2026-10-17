import { GRAD_MARCA } from "@/lib/tema"

// Botones del portal del paciente: texto de 16 px y al menos 48 px de alto (regla 48).
export const BOTON_PRINCIPAL = "inline-flex min-h-12 items-center justify-center gap-2 text-center rounded-xl px-5 py-3 text-base font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
export const BOTON_SECUNDARIO = "inline-flex min-h-12 items-center justify-center gap-2 text-center rounded-xl border border-slate-200/60 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
export const BOTON_PELIGRO = "inline-flex min-h-12 items-center justify-center gap-2 text-center rounded-xl border border-red-200 bg-white px-5 py-3 text-base font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
export const ESTILO_PRINCIPAL = { background: GRAD_MARCA }
