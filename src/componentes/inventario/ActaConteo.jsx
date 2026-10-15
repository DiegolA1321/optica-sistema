"use client"

import { ClipboardList, Printer } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import { imprimirHtml } from "../../utilidades/proforma"
import { htmlActaConteo } from "../../utilidades/conteoImpresion"
import { GRAD_MARCA, INK } from "@/lib/tema"

const signo = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
const dineroConSigno = (n) => (n < 0 ? `−${dinero(Math.abs(n))}` : dinero(n))
const TONO = (n) => (n > 0 ? "text-emerald-700" : n < 0 ? "text-red-600" : "text-slate-500")

// El acta de un conteo físico ya registrado: fecha, quién contó, los productos con diferencia y lo que valen en dinero.
// «Imprimir o guardar PDF» abre la impresión del navegador (ahí se elige «Guardar como PDF»).
export default function ActaConteo({ acta, opticaNombre, titulo = "Acta del conteo", sinAnimarFondo = false, onCerrar }) {
  const conCosto = acta.valorCosto != null
  const imprimir = () => imprimirHtml(htmlActaConteo({ opticaNombre, acta }))
  const caja = "rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"
  return (
    <Cascaron
      titulo={titulo} subtitulo={`${fechaHoraLegible(acta.creadoEn, { anio: true })} · contó ${acta.usuarioNombre || "—"}`} Icono={ClipboardList} ancho="max-w-3xl" sinAnimarFondo={sinAnimarFondo} onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">Las diferencias quedaron como ajustes por conteo en el historial de cada producto.</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          <button type="button" onClick={imprimir} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD_MARCA }}><Printer size={15} aria-hidden="true" /> Imprimir o guardar PDF</button>
        </div>
      </>}
    >
      <div className="space-y-4 px-5 py-4">
        <div className={"grid gap-3 " + (conCosto ? "grid-cols-4" : "grid-cols-3")}>
          <div className={caja}><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{acta.contados}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Productos contados</p></div>
          <div className={caja}><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{acta.contados - acta.iguales}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Con diferencia ({acta.sobrantes} sobran · {acta.faltantes} faltan)</p></div>
          <div className={caja}><p className={"font-serif text-xl font-semibold " + TONO(acta.valorPrecio)}>{dineroConSigno(acta.valorPrecio)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Diferencia a precio de venta</p></div>
          {conCosto && <div className={caja}><p className={"font-serif text-xl font-semibold " + TONO(acta.valorCosto)}>{dineroConSigno(acta.valorCosto)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Diferencia a costo</p></div>}
        </div>
        {acta.detalle.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-slate-600">Lo contado coincidió con el sistema: no hubo diferencias.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Productos con diferencia</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2">Producto</th>
                  <th scope="col" className="w-[80px] px-3 py-2 text-right">Sistema</th>
                  <th scope="col" className="w-[80px] px-3 py-2 text-right">Contado</th>
                  <th scope="col" className="w-[90px] px-3 py-2 text-right">Diferencia</th>
                  <th scope="col" className="w-[104px] px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {acta.detalle.map((d) => (
                  <tr key={d.productoId || d.nombre}>
                    <td className="truncate px-3 py-2 font-semibold text-slate-800" title={d.nombre}>{d.nombre}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{d.antes}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{d.contado}</td>
                    <td className={"px-3 py-2 text-right font-mono font-bold tabular-nums " + TONO(d.diferencia)}>{signo(d.diferencia)}</td>
                    <td className={"px-3 py-2 text-right font-mono tabular-nums " + TONO(d.diferencia)}>{dineroConSigno(d.diferencia * d.precio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Cascaron>
  )
}
