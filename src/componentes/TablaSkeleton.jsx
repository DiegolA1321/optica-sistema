// B3: el patrón de skeleton ya existía en SuperadminPanel.jsx (que fetchea
// sus propios datos) pero no en Pacientes/Citas/Inventario, cuyos datos
// vienen como props ya resueltos por App.jsx — sin loading state propio no
// había dónde engancharlo. Reusa el mismo lenguaje visual (animate-pulse +
// bg-slate-200/70) en vez de inventar uno nuevo.
export default function TablaSkeleton({ filas = 5 }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200/70" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
              <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-200/60" />
            </div>
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  )
}
