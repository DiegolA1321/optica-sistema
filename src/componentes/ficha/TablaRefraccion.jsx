"use client"

import { History } from "lucide-react"
import { filtrarNumeroDecimalConSigno } from "../../utilidades/validaciones"
import { normalizarDioptria, conSigno, pasoDioptria, normalizarEje, pasoEje } from "../../utilidades/dioptrias"

// La refracción como la escriben los optómetras: una tabla con una fila por ojo (OD arriba y OI abajo, como en la receta) y una columna por dato: esfera, cilindro, eje, agudeza visual sin y con
// lentes, y —una sola vez para los dos ojos— la adición y la distancia pupilar. Se avanza con Tab de un campo al siguiente (de izquierda a derecha y de arriba abajo).
//   Esfera, cilindro y adición van de 0,25 en 0,25 con signo: al salir del campo lo escrito se lleva al cuarto más cercano; «+» y «−» cambian el signo y ↑ ↓ suben o bajan 0,25.
//   El eje solo acepta de 0 a 180. «Ojo no evaluado» deja la fila con su motivo (por ejemplo, una prótesis ocular).
const campo = (error) => "h-12 w-full rounded-lg border bg-white px-1 text-center text-base font-semibold tabular-nums text-slate-900 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 " + (error ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")

function CampoDioptria({ id, etiqueta, valor, onCambiar, error }) {
  return (
    <input id={id} aria-label={etiqueta} aria-invalid={Boolean(error)} inputMode="decimal" autoComplete="off" placeholder="0.00" value={valor} className={campo(error)}
      onChange={(e) => onCambiar(filtrarNumeroDecimalConSigno(e.target.value))}
      onBlur={() => { const n = normalizarDioptria(valor); if (n !== valor) onCambiar(n) }}
      onKeyDown={(e) => {
        if (e.key === "+" || e.key === "-" || e.key === "−") { e.preventDefault(); onCambiar(conSigno(valor, e.key === "+" ? 1 : -1)) }
        else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); onCambiar(pasoDioptria(valor, e.key === "ArrowUp" ? 0.25 : -0.25)) }
      }} />
  )
}

function CampoEje({ id, etiqueta, valor, onCambiar, error }) {
  return (
    <input id={id} aria-label={etiqueta} aria-invalid={Boolean(error)} inputMode="numeric" autoComplete="off" placeholder="0" maxLength={3} value={valor} className={campo(error)}
      onChange={(e) => onCambiar(normalizarEje(e.target.value))}
      onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); onCambiar(pasoEje(valor, e.key === "ArrowUp" ? 1 : -1)) } }} />
  )
}

function SelectorAv({ id, etiqueta, valor, onCambiar, escalas }) {
  return (
    <select id={id} aria-label={etiqueta} value={valor} onChange={(e) => onCambiar(e.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-1 text-base font-semibold text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100">
      <option value="">—</option>
      {escalas.map((e) => <option key={e} value={e}>{e}</option>)}
    </select>
  )
}

const OJOS = [["od", "OD", "Ojo derecho", "#1d4ed8"], ["oi", "OI", "Ojo izquierdo", "#0891b2"]]

export default function TablaRefraccion({ ojos, onCambiar, medidas, onMedida, manejaProgresion = true, errores = {}, limpiarError, escalas = [], copiar = null, bloqueada = false }) {
  const cambiar = (ojo, c, v) => { onCambiar(ojo, c, v); if (c === "esfera" || c === "cilindro") limpiarError?.(`${ojo}_${c}`); if (c === "cilindro" || c === "eje") limpiarError?.(`${ojo}_eje`); if (c === "noEval" || c === "motivo") { limpiarError?.(`${ojo}_motivo`); limpiarError?.(`${ojo}_esfera`) } }
  const mensajes = OJOS.flatMap(([k, sigla]) => ["esfera", "cilindro", "eje", "motivo"].map((c) => errores[`${k}_${c}`] && `${sigla}: ${errores[`${k}_${c}`]}`)).filter(Boolean)
  const th = "px-0.5 pb-1 text-left text-sm font-bold leading-tight text-slate-600"
  return (
    <div className="space-y-3">
      {copiar && (
        <button type="button" onClick={copiar.accion} disabled={bloqueada} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-base font-semibold text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-50">
          <History size={16} aria-hidden="true" /> Copiar de la visita anterior ({copiar.fechaTexto})
        </button>
      )}
      <div className="overflow-x-auto">
        <table aria-label="Refracción: una fila por ojo" className="w-full min-w-[34rem] table-fixed border-separate border-spacing-x-1 border-spacing-y-1.5 text-left">
          <colgroup>
            <col className="w-[3.4rem]" /><col /><col /><col className="w-[3.6rem]" /><col className="w-[4.6rem]" /><col className="w-[4.6rem]" />
            {manejaProgresion && <col />}<col className="w-[3.8rem]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={th}>Ojo</th>
              <th scope="col" className={th}>Esfera <span className="font-normal text-slate-500">D</span></th>
              <th scope="col" className={th}>Cilindro <span className="font-normal text-slate-500">D</span></th>
              <th scope="col" className={th}>Eje <span className="font-normal text-slate-500">°</span></th>
              <th scope="col" className={th}>AV sin lentes</th>
              <th scope="col" className={th}>AV con lentes</th>
              {manejaProgresion && <th scope="col" className={th}>Adición <span className="font-normal text-slate-500">D</span></th>}
              <th scope="col" className={th}>DP <span className="font-normal text-slate-500">mm</span></th>
            </tr>
          </thead>
          <tbody>
            {OJOS.map(([k, sigla, nombre, color], i) => {
              const o = ojos[k]
              return (
                <tr key={k} data-ojo={k}>
                  <th scope="row" className="align-middle" aria-label={nombre}>
                    <span className="grid h-9 w-10 place-items-center rounded-lg text-base font-bold text-white" style={{ backgroundColor: color }} title={nombre}>{sigla}</span>
                  </th>
                  {o.noEval ? (
                    <td colSpan={5} className="align-middle">
                      <input aria-label={`¿Por qué no se evaluó el ${nombre.toLowerCase()}?`} aria-invalid={Boolean(errores[`${k}_motivo`])} maxLength={120} value={o.motivo} placeholder="¿Por qué no se evaluó? Por ejemplo: prótesis ocular" onChange={(e) => cambiar(k, "motivo", e.target.value)}
                        className={"h-12 w-full rounded-lg border bg-white px-3 text-base text-slate-900 outline-none focus-visible:border-blue-500 " + (errores[`${k}_motivo`] ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                    </td>
                  ) : (
                    <>
                      <td><CampoDioptria id={`${sigla}-esf`} etiqueta={`Esfera ${nombre}`} valor={o.esfera} onCambiar={(v) => cambiar(k, "esfera", v)} error={errores[`${k}_esfera`]} /></td>
                      <td><CampoDioptria id={`${sigla}-cil`} etiqueta={`Cilindro ${nombre}`} valor={o.cilindro} onCambiar={(v) => cambiar(k, "cilindro", v)} error={errores[`${k}_cilindro`]} /></td>
                      <td><CampoEje id={`${sigla}-eje`} etiqueta={`Eje ${nombre}`} valor={o.eje} onCambiar={(v) => cambiar(k, "eje", v)} error={errores[`${k}_eje`]} /></td>
                      <td><SelectorAv id={`${sigla}-avsc`} etiqueta={`Agudeza visual sin lentes ${nombre}`} valor={o.avSc} onCambiar={(v) => cambiar(k, "avSc", v)} escalas={escalas} /></td>
                      <td><SelectorAv id={`${sigla}-avcc`} etiqueta={`Agudeza visual con lentes ${nombre}`} valor={o.avCc} onCambiar={(v) => cambiar(k, "avCc", v)} escalas={escalas} /></td>
                    </>
                  )}
                  {i === 0 && manejaProgresion && <td rowSpan={2} className="align-middle"><CampoDioptria id="add" etiqueta="Adición" valor={medidas.adicion} onCambiar={(v) => onMedida("adicion", v)} /></td>}
                  {i === 0 && <td rowSpan={2} className="align-middle"><input id="dp" aria-label="Distancia pupilar en milímetros" inputMode="numeric" autoComplete="off" placeholder="62" maxLength={4} value={medidas.dp} onChange={(e) => onMedida("dp", e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))} className={campo(false)} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {OJOS.map(([k, , nombre]) => (
          <label key={k} className="flex min-h-10 cursor-pointer items-center gap-2 text-base font-medium text-slate-700">
            <input type="checkbox" checked={ojos[k].noEval} disabled={bloqueada} onChange={(e) => cambiar(k, "noEval", e.target.checked)} className="h-5 w-5 accent-blue-600" /> {nombre} no evaluado
          </label>
        ))}
      </div>
      {mensajes.length > 0 && <ul role="alert" className="space-y-0.5 text-base font-medium text-red-600">{mensajes.map((m) => <li key={m}>{m}</li>)}</ul>}
      <p className="text-sm text-slate-500">Con el teclado: <kbd className="rounded border border-slate-300 bg-slate-50 px-1">+</kbd> y <kbd className="rounded border border-slate-300 bg-slate-50 px-1">−</kbd> cambian el signo, <kbd className="rounded border border-slate-300 bg-slate-50 px-1">↑</kbd> <kbd className="rounded border border-slate-300 bg-slate-50 px-1">↓</kbd> suben o bajan 0,25 (en el eje, de 1 en 1) y <kbd className="rounded border border-slate-300 bg-slate-50 px-1">Tab</kbd> pasa al campo siguiente. Los valores se llevan al 0,25 más cercano.</p>
    </div>
  )
}
