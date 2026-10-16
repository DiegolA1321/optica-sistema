// Estilos que comparten las pestañas del CRM (la píldora de un filtro).
export const CLASE_PILDORA = (activa) =>
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " +
  (activa ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")
