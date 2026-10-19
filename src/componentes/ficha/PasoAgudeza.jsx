"use client"

import { Eye, Glasses, Move, Ruler } from "lucide-react"
import { LISTA_AGUDEZA, LISTA_JAEGER, textoAgudeza } from "../../utilidades/agudeza"
import { TIPOS_COVER, DISTANCIAS_COVER } from "../../utilidades/fichaDatos"
import { Tarjeta, Obligatorio, Numero, Texto, Lista, OjosLadoALado, CuadroOjo, BotonTexto, Campo, CLASE_INPUT } from "./piezas"

// Una celda de la tabla de agudeza: la línea leída y, debajo, las letras falladas.
function CeldaAv({ id, etiqueta, valor, falladas, onValor, onFalladas, error }) {
  return (
    <div className="mx-auto flex w-full max-w-[9rem] flex-col items-stretch gap-1">
      <select id={id} aria-label={etiqueta} value={valor} onChange={(e) => onValor(e.target.value)} aria-invalid={Boolean(error)}
        className={CLASE_INPUT + "w-full px-1.5 text-xs font-semibold " + (error ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}>
        <option value="">—</option>
        {LISTA_AGUDEZA.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <label className="flex items-center justify-center gap-1 text-xs text-slate-500">Falladas
        <input aria-label={etiqueta + ": letras falladas"} type="text" inputMode="numeric" maxLength={2} value={falladas} onChange={(e) => onFalladas(e.target.value.replace(/\D/g, "").slice(0, 2))} disabled={!valor || !/^20\//.test(valor)}
          className="w-9 rounded border border-slate-300 bg-white px-1 py-0.5 text-center font-mono text-xs disabled:bg-slate-100" />
      </label>
    </div>
  )
}

// Paso 2 · Agudeza visual: la tabla de la prueba de las letras (ojo derecho, izquierdo y ambos; sin corrección, con su corrección actual y con la receta nueva), la de cerca (Jaeger), los lentes actuales,
// la distancia pupilar, el cover test y la motilidad. La agudeza con la receta nueva se escribe en el paso 3 (es un solo dato) y aquí se ve.
export default function PasoAgudeza({ f, set, setVarios, errores, ultimaConsulta, onIrARefraccion }) {
  const filas = [["Od", "Ojo derecho"], ["Oi", "Ojo izquierdo"], ["Amb", "Ambos ojos"]]
  const copiarUltima = () => {
    const a = ultimaConsulta
    setVarios({ actOdEsfera: a?.od?.esfera || "", actOdCilindro: a?.od?.cilindro || "", actOdEje: a?.od?.eje || "", actOiEsfera: a?.oi?.esfera || "", actOiCilindro: a?.oi?.cilindro || "", actOiEje: a?.oi?.eje || "", actAdicion: a?.medidas?.adicionOd || a?.medidas?.adicion || "" })
  }
  const hayUltima = ultimaConsulta && ["od", "oi"].some((l) => ultimaConsulta[l]?.esfera || ultimaConsulta[l]?.cilindro)
  const ojoActual = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return (
      <CuadroOjo lado={lado}>
        <div className="flex gap-1.5">
          <Numero id={`act${P}Esfera`} etiqueta="Esf." valor={f[`act${P}Esfera`]} onCambiar={(v) => set(`act${P}Esfera`, v)} placeholder="0.00" ancho="w-[3.75rem]" />
          <Numero id={`act${P}Cilindro`} etiqueta="Cil." valor={f[`act${P}Cilindro`]} onCambiar={(v) => set(`act${P}Cilindro`, v)} placeholder="0.00" ancho="w-[3.75rem]" />
          <Numero id={`act${P}Eje`} etiqueta="Eje" valor={f[`act${P}Eje`]} onCambiar={(v) => set(`act${P}Eje`, v)} tipo="entero" maxLength={3} placeholder="0" ancho="w-[3.25rem]" />
        </div>
      </CuadroOjo>
    )
  }
  const errAv = errores.avOdSc || errores.avOiSc
  return (
    <div className="space-y-3">
      <Tarjeta titulo="Agudeza visual" icono={Eye} derecha={<Obligatorio />} ayuda="Prueba de las letras. Elige la línea leída y, si falló letras, cuántas («20/25 −2»). Obligatoria: la de cada ojo sin corrección.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="w-20 border border-slate-200 bg-slate-50 p-1.5 text-left font-semibold" />
                <th className="border border-slate-200 bg-slate-50 p-1.5 font-semibold">Sin corrección</th>
                <th className="border border-slate-200 bg-slate-50 p-1.5 font-semibold">Con su corrección actual</th>
                <th className="border border-slate-200 bg-slate-50 p-1.5 font-semibold">Con la receta nueva</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(([P, nombre]) => (
                <tr key={P}>
                  <th scope="row" className="border border-slate-200 bg-slate-50 p-1.5 text-left font-semibold text-slate-700">{nombre}</th>
                  <td className="border border-slate-200 p-1.5"><CeldaAv id={`av${P}Sc`} etiqueta={`${nombre}, sin corrección`} valor={f[`av${P}Sc`]} falladas={f[`av${P}ScF`]} onValor={(v) => set(`av${P}Sc`, v)} onFalladas={(v) => set(`av${P}ScF`, v)} error={errores[`av${P}Sc`]} /></td>
                  <td className="border border-slate-200 p-1.5"><CeldaAv id={`av${P}Cc`} etiqueta={`${nombre}, con su corrección actual`} valor={f[`av${P}Cc`]} falladas={f[`av${P}CcF`]} onValor={(v) => set(`av${P}Cc`, v)} onFalladas={(v) => set(`av${P}CcF`, v)} /></td>
                  <td className="border border-slate-200 p-1.5 text-center" data-av-rx={P}>
                    {f[`av${P}Rx`] ? <span className="font-mono font-semibold text-slate-800">{textoAgudeza(f[`av${P}Rx`], f[`av${P}RxF`])}</span> : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="border border-slate-200 bg-slate-50 p-1.5 text-left font-semibold text-slate-700">De cerca (Jaeger)</th>
                {["Sc", "Cc"].map((c) => (
                  <td key={c} className="border border-slate-200 p-1.5">
                    <select aria-label={`De cerca, ${c === "Sc" ? "sin corrección" : "con su corrección actual"}`} value={f[`cerca${c}`]} onChange={(e) => set(`cerca${c}`, e.target.value)} className={CLASE_INPUT + "mx-auto block w-full max-w-[9rem] border-slate-300 px-1.5 text-xs font-semibold"}>
                      <option value="">—</option>{LISTA_JAEGER.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                ))}
                <td className="border border-slate-200 p-1.5 text-center" data-av-rx="Cerca">{f.cercaRx ? <span className="font-mono font-semibold text-slate-800">{f.cercaRx}</span> : <span className="text-slate-400">—</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">La agudeza con la receta nueva se escribe en el paso 3. <BotonTexto onClick={onIrARefraccion}>Ir a Refracción</BotonTexto></p>
        {errAv && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errAv}</p>}
      </Tarjeta>

      <Tarjeta titulo="Lentes actuales" icono={Glasses} derecha={hayUltima ? <BotonTexto onClick={copiarUltima}>Copiar de la última receta</BotonTexto> : null} ayuda="Lo que el paciente usa hoy (de su lensómetro o de su receta anterior).">
        <OjosLadoALado izquierdo={ojoActual("oi")} derecho={ojoActual("od")} />
        <div className="mt-3"><Numero id="actAdicion" etiqueta="Adición actual" valor={f.actAdicion} onCambiar={(v) => set("actAdicion", v)} placeholder="+0.00" ancho="w-20" /></div>
      </Tarjeta>

      <Tarjeta titulo="Distancia pupilar" icono={Ruler}>
        <div className="flex flex-wrap gap-3">
          <Numero id="dp" etiqueta="Total (mm)" valor={f.dp} onCambiar={(v) => set("dp", v)} placeholder="62" />
          <Numero id="dpOd" etiqueta="OD (mm)" valor={f.dpOd} onCambiar={(v) => set("dpOd", v)} placeholder="31" />
          <Numero id="dpOi" etiqueta="OI (mm)" valor={f.dpOi} onCambiar={(v) => set("dpOi", v)} placeholder="31" />
          <Numero id="dpCerca" etiqueta="De cerca (mm, opcional)" valor={f.dpCerca} onCambiar={(v) => set("dpCerca", v)} placeholder="59" ancho="w-24" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Cover test y motilidad" icono={Move}>
        <div className="flex flex-wrap gap-3">
          <Lista id="coverTipo" etiqueta="Cover test — tipo" valor={f.coverTipo} onCambiar={(v) => set("coverTipo", v)} opciones={TIPOS_COVER} ancho="w-40" />
          <Numero id="coverMagnitud" etiqueta="Magnitud (Δ)" valor={f.coverMagnitud} onCambiar={(v) => set("coverMagnitud", v)} placeholder="4" ancho="w-20" />
          <Lista id="coverDistancia" etiqueta="Distancia" valor={f.coverDistancia} onCambiar={(v) => set("coverDistancia", v)} opciones={DISTANCIAS_COVER} ancho="w-36" />
        </div>
        <div className="mt-3"><Texto id="testMotor" etiqueta="Motilidad ocular" valor={f.testMotor} onCambiar={(v) => set("testMotor", v)} placeholder="Ej. movimientos suaves y completos en las nueve posiciones" /></div>
      </Tarjeta>
    </div>
  )
}
