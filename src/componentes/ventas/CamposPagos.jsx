"use client"

import { Plus, X } from "lucide-react"
import { dinero } from "../../utilidades/formatoMoneda"
import { METODOS_COBRO, MAX_FORMAS_DE_PAGO, filasParaTotal, sumaPagos, pagosDeFormulario, redondear } from "../../utilidades/pagos"

const CAMPO = "h-9 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

export const FILAS_INICIALES = () => [{ metodo: "efectivo", monto: "" }]

// Cómo se paga un cobro (la venta al contado o un abono): un método, o varios a la vez ("Dividir el pago"). Con un solo método el monto
// es el total; con varios, cada fila lleva su monto y se dice lo que falta repartir. El padre guarda las filas y las revisa con revisarPagos.
export default function CamposPagos({ filas, onChange, total, idBase = "pago" }) {
  const efectivas = filasParaTotal(filas, total)
  const restante = redondear(total - sumaPagos(pagosDeFormulario(efectivas)))
  const dividido = filas.length > 1

  const cambiar = (i, campo, valor) => onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)))
  const quitar = (i) => onChange(filas.filter((_, j) => j !== i))
  const dividir = () => {
    if (filas.length >= MAX_FORMAS_DE_PAGO) return
    const metodoNuevo = METODOS_COBRO.find((m) => !filas.some((f) => f.metodo === m.id))?.id || "efectivo"
    if (filas.length === 1) {
      // Al dividir, la mitad queda en la primera forma de pago y la otra mitad en la nueva.
      const mitad = redondear(total / 2)
      onChange([{ ...filas[0], monto: String(mitad) }, { metodo: metodoNuevo, monto: String(redondear(total - mitad)) }])
      return
    }
    onChange([...filas, { metodo: metodoNuevo, monto: restante > 0 ? String(restante) : "" }])
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-slate-700">{dividido ? "Formas de pago" : "Forma de pago"}</legend>
      <ul className="space-y-2">
        {efectivas.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <select aria-label={dividido ? `Método del pago ${i + 1}` : "Método de pago"} value={f.metodo} onChange={(e) => cambiar(i, "metodo", e.target.value)} className={CAMPO + " min-w-0 flex-1 cursor-pointer"}>
              {METODOS_COBRO.map((m) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
            </select>
            {dividido ? (
              <input aria-label={`Monto del pago ${i + 1}`} id={`${idBase}-monto-${i}`} type="number" inputMode="decimal" min="0" step="0.01" value={f.monto} onChange={(e) => cambiar(i, "monto", e.target.value)} placeholder="0.00" className={CAMPO + " w-28 text-right font-mono"} />
            ) : (
              <span className="w-28 text-right font-mono text-sm font-semibold text-slate-700" aria-label="Monto del pago">{dinero(total)}</span>
            )}
            {dividido ? (
              <button type="button" onClick={() => quitar(i)} aria-label={`Quitar el pago ${i + 1}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={15} aria-hidden="true" /></button>
            ) : <span className="w-9 shrink-0" aria-hidden="true" />}
          </li>
        ))}
      </ul>
      <div className="flex min-h-[1.5rem] items-center justify-between gap-3">
        {filas.length < MAX_FORMAS_DE_PAGO && total > 0 ? (
          <button type="button" onClick={dividir} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer"><Plus size={14} aria-hidden="true" /> Dividir el pago</button>
        ) : <span />}
        {dividido && (
          <p role="status" className={"text-sm font-semibold " + (restante === 0 ? "text-slate-500" : "text-amber-700")}>
            {restante === 0 ? "Todo repartido" : restante > 0 ? `Faltan ${dinero(restante)}` : `Se pasa ${dinero(-restante)}`}
          </p>
        )}
      </div>
    </fieldset>
  )
}
