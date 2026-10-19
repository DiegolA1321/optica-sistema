"use client"

import { ScanEye, Eye, History, Layers, Glasses, CheckCircle, AlertCircle } from "lucide-react"
import { validarOjo, validarAdicion, transponer } from "../../utilidades/refraccion"
import { LISTA_AGUDEZA, LISTA_JAEGER, agudezaDelEstado } from "../../utilidades/agudeza"
import { METODOS_OBJETIVA, BASES_PRISMA, ojoDeForm, estadoCorreccionDeForm } from "../../utilidades/fichaDatos"
import { Tarjeta, Obligatorio, Etiqueta, Numero, Lista, Texto, OjosLadoALado, CuadroOjo, BotonTexto, CLASE_INPUT } from "./piezas"

const Trio = ({ pre, f, set, errs = {}, ancho }) => (
  <div className="flex gap-1.5">
    <Numero id={`${pre}Esfera`} etiqueta="Esf." valor={f[`${pre}Esfera`]} onCambiar={(v) => set(`${pre}Esfera`, v)} placeholder="0.00" error={errs.esfera} ancho={ancho || "w-[3.75rem]"} />
    <Numero id={`${pre}Cilindro`} etiqueta="Cil." valor={f[`${pre}Cilindro`]} onCambiar={(v) => set(`${pre}Cilindro`, v)} placeholder="0.00" error={errs.cilindro} ancho={ancho || "w-[3.75rem]"} />
    <Numero id={`${pre}Eje`} etiqueta="Eje" valor={f[`${pre}Eje`]} onCambiar={(v) => set(`${pre}Eje`, v)} tipo="entero" maxLength={3} placeholder="0" error={errs.eje} ancho="w-[3.25rem]" />
  </div>
)

// Un par «línea + letras falladas» para la agudeza con la receta nueva.
function AvRx({ P, nombre, f, set }) {
  return (
    <div className="flex items-end gap-1.5">
      <div className="w-36">
        <label htmlFor={`av${P}Rx`} className="mb-1 block text-xs font-semibold text-slate-500">{nombre}</label>
        <select id={`av${P}Rx`} value={f[`av${P}Rx`]} onChange={(e) => set(`av${P}Rx`, e.target.value)} className={CLASE_INPUT + "w-full border-slate-300 px-1.5 text-xs font-semibold"}>
          <option value="">—</option>{LISTA_AGUDEZA.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <label className="pb-1.5 text-xs text-slate-500">Falladas
        <input aria-label={`${nombre}: letras falladas`} type="text" inputMode="numeric" maxLength={2} value={f[`av${P}RxF`]} disabled={!/^20\//.test(f[`av${P}Rx`])} onChange={(e) => set(`av${P}RxF`, e.target.value.replace(/\D/g, "").slice(0, 2))}
          className="ml-1 w-9 rounded border border-slate-300 bg-white px-1 py-0.5 text-center font-mono text-xs disabled:bg-slate-100" />
      </label>
    </div>
  )
}

// Paso 3 · Refracción: objetiva, queratometría, refracción final de cada ojo (con transposición), adición, prisma y la agudeza con la receta nueva.
export default function PasoRefraccion({ f, set, setVarios, errores, edad, manejaProgresion = true, ultimaConsulta }) {
  // Lo que se escribe se valida al instante (rangos, pasos, cilindro negativo); lo que falta, solo al terminar.
  const vivo = (pre) => validarOjo({ esfera: f[`${pre}Esfera`], cilindro: f[`${pre}Cilindro`], eje: f[`${pre}Eje`] })
  const errOjo = (p) => {
    const v = vivo(p)
    const e = errores
    // El cilindro positivo no repite su mensaje en el campo: lo dice el aviso con el botón «Transponer».
    return { esfera: v.esfera || e[`${p}_esfera`], cilindro: v.transponible ? undefined : v.cilindro || e[`${p}_cilindro`], eje: v.eje || e[`${p}_eje`], transponible: Boolean(v.transponible) }
  }
  const transponerOjo = (p) => {
    const t = transponer({ esfera: f[`${p}Esfera`], cilindro: f[`${p}Cilindro`], eje: f[`${p}Eje`] })
    if (t) setVarios({ [`${p}Esfera`]: t.esfera, [`${p}Cilindro`]: t.cilindro, [`${p}Eje`]: t.eje })
  }
  const usarObjetiva = () => {
    const por = (o, p) => ({ [`${p}Esfera`]: f[`obj${o}Esfera`], [`${p}Cilindro`]: f[`obj${o}Cilindro`], [`${p}Eje`]: f[`obj${o}Eje`] })
    setVarios({ ...(f.odNoEval ? {} : por("Od", "od")), ...(f.oiNoEval ? {} : por("Oi", "oi")) })
  }
  const hayObjetiva = ["objOdEsfera", "objOdCilindro", "objOiEsfera", "objOiCilindro"].some((k) => String(f[k]).trim())
  const copiarAnterior = ultimaConsulta && ["od", "oi"].some((l) => ultimaConsulta[l]?.esfera || ultimaConsulta[l]?.cilindro) && !["odEsfera", "odCilindro", "oiEsfera", "oiCilindro"].some((k) => String(f[k]).trim())

  const finalOjo = (lado) => {
    const p = lado, P = lado === "od" ? "Od" : "Oi"
    const e = errOjo(p)
    const noEval = f[`${p}NoEval`]
    return (
      <CuadroOjo lado={lado} noEvaluado={noEval}>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={noEval} onChange={(ev) => set(`${p}NoEval`, ev.target.checked)} className="h-4 w-4 accent-blue-600" /> Ojo no evaluado
        </label>
        {noEval ? (
          <Texto id={`${p}MotivoNoEval`} etiqueta="¿Por qué no se evaluó?" valor={f[`${p}MotivoNoEval`]} onCambiar={(v) => set(`${p}MotivoNoEval`, v)} placeholder="Ej. prótesis ocular" error={errores[`${p}_motivo`]} ancho="w-full" maxLength={120} />
        ) : (
          <>
            <Trio pre={p} f={f} set={set} errs={e} />
            {e.transponible && (
              <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                El cilindro va en negativo. <button type="button" onClick={() => transponerOjo(p)} className="font-semibold text-blue-700 underline cursor-pointer">Transponer</button>
              </p>
            )}
          </>
        )}
      </CuadroOjo>
    )
  }

  const objetivaOjo = (lado) => <CuadroOjo lado={lado}><Trio pre={lado === "od" ? "objOd" : "objOi"} f={f} set={set} errs={errores[lado === "od" ? "objOd" : "objOi"]} /></CuadroOjo>
  const kOjo = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return (
      <CuadroOjo lado={lado}>
        <div className="flex gap-1.5">
          <Numero id={`k${P}K1`} etiqueta="K1" valor={f[`k${P}K1`]} onCambiar={(v) => set(`k${P}K1`, v)} placeholder="43.25" ancho="w-[3.75rem]" />
          <Numero id={`k${P}K2`} etiqueta="K2" valor={f[`k${P}K2`]} onCambiar={(v) => set(`k${P}K2`, v)} placeholder="44.00" ancho="w-[3.75rem]" />
          <Numero id={`k${P}Eje`} etiqueta="Eje" valor={f[`k${P}Eje`]} onCambiar={(v) => set(`k${P}Eje`, v)} tipo="entero" maxLength={3} placeholder="0" ancho="w-[3.25rem]" />
        </div>
      </CuadroOjo>
    )
  }

  const destacada = edad != null && edad >= 40
  const prismaOjo = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return (
      <CuadroOjo lado={lado}>
        <div className="flex gap-1.5">
          <Numero id={`prisma${P}Cant`} etiqueta="Cantidad (Δ)" valor={f[`prisma${P}Cant`]} onCambiar={(v) => set(`prisma${P}Cant`, v)} placeholder="2" ancho="w-[4.5rem]" />
          <Lista id={`prisma${P}Base`} etiqueta="Base" valor={f[`prisma${P}Base`]} onCambiar={(v) => set(`prisma${P}Base`, v)} opciones={BASES_PRISMA} ancho="w-28" />
        </div>
      </CuadroOjo>
    )
  }
  const estado = estadoCorreccionDeForm(f)
  const fuente = agudezaDelEstado(ojoDeForm(f, "od"), ojoDeForm(f, "oi"))

  return (
    <div className="space-y-3">
      <Tarjeta titulo="Refracción objetiva" icono={ScanEye} derecha={<Etiqueta>Opcional</Etiqueta>} ayuda="Punto de partida antes de refinar con la respuesta del paciente.">
        <Lista id="objMetodo" etiqueta="Método" valor={f.objMetodo} onCambiar={(v) => set("objMetodo", v)} opciones={METODOS_OBJETIVA} ancho="w-48" />
        <div className="mt-3"><OjosLadoALado izquierdo={objetivaOjo("oi")} derecho={objetivaOjo("od")} /></div>
        {hayObjetiva && <div className="mt-2"><BotonTexto onClick={usarObjetiva}>Usar como punto de partida</BotonTexto></div>}
      </Tarjeta>

      <Tarjeta titulo="Queratometría" icono={Layers} derecha={<Etiqueta>Opcional</Etiqueta>}>
        <OjosLadoALado izquierdo={kOjo("oi")} derecho={kOjo("od")} />
      </Tarjeta>

      <Tarjeta titulo="Refracción final" icono={Eye} derecha={<Obligatorio />} ayuda="La que va en la receta. Esfera −30 a +30 · cilindro negativo · eje 1–180 · de 0,25 en 0,25. Los dos ojos, o «Ojo no evaluado» con su motivo.">
        {copiarAnterior && <div className="mb-2"><BotonTexto icono={History} onClick={() => setVarios({ odEsfera: ultimaConsulta.od?.esfera || "", odCilindro: ultimaConsulta.od?.cilindro || "", odEje: ultimaConsulta.od?.eje || "", oiEsfera: ultimaConsulta.oi?.esfera || "", oiCilindro: ultimaConsulta.oi?.cilindro || "", oiEje: ultimaConsulta.oi?.eje || "" })}>Copiar de la visita anterior</BotonTexto></div>}
        <OjosLadoALado izquierdo={finalOjo("oi")} derecho={finalOjo("od")} />
      </Tarjeta>

      {manejaProgresion && (
        <Tarjeta titulo="Adición" icono={Glasses} resaltada={destacada} derecha={destacada ? <Etiqueta tono="azul">Paciente de {edad} años</Etiqueta> : null}
          ayuda={destacada ? "A partir de los 40 años se destaca: +0.50 a +4.00." : "Opcional: +0.50 a +4.00 si hace falta."}>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={f.adicionIgual} onChange={(e) => set("adicionIgual", e.target.checked)} className="h-4 w-4 accent-blue-600" /> Igual en ambos ojos
          </label>
          {f.adicionIgual ? (
            <Numero id="adicionOd" etiqueta="Adición" valor={f.adicionOd} onCambiar={(v) => set("adicionOd", v)} placeholder="+0.00" error={validarAdicion(f.adicionOd) || errores.adicionOd} ancho="w-20" />
          ) : (
            <OjosLadoALado
              izquierdo={<CuadroOjo lado="oi"><Numero id="adicionOi" etiqueta="Adición" valor={f.adicionOi} onCambiar={(v) => set("adicionOi", v)} placeholder="+0.00" error={validarAdicion(f.adicionOi) || errores.adicionOi} ancho="w-20" /></CuadroOjo>}
              derecho={<CuadroOjo lado="od"><Numero id="adicionOd" etiqueta="Adición" valor={f.adicionOd} onCambiar={(v) => set("adicionOd", v)} placeholder="+0.00" error={validarAdicion(f.adicionOd) || errores.adicionOd} ancho="w-20" /></CuadroOjo>} />
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Prisma" icono={Layers} derecha={<Etiqueta>Opcional</Etiqueta>}>
        <OjosLadoALado izquierdo={prismaOjo("oi")} derecho={prismaOjo("od")} />
      </Tarjeta>

      <Tarjeta titulo="Agudeza con la receta nueva" icono={CheckCircle} ayuda="Se escribe aquí y se ve también en la tabla del paso 2 (es un solo dato).">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <AvRx P="Od" nombre="Ojo derecho" f={f} set={set} />
          <AvRx P="Oi" nombre="Ojo izquierdo" f={f} set={set} />
          <AvRx P="Amb" nombre="Ambos ojos" f={f} set={set} />
          <Lista id="cercaRx" etiqueta="De cerca (Jaeger)" valor={f.cercaRx} onCambiar={(v) => set("cercaRx", v)} opciones={LISTA_JAEGER} vacio="—" ancho="w-28" />
        </div>
        {estado !== "Sin evaluar" && (
          <p className={"mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold " + (estado === "Bien corregido" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
            {estado === "Bien corregido" ? <CheckCircle size={13} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}
            Corrección: {estado === "Bien corregido" ? "efectiva" : "requiere ajuste"} <span className="font-normal">({fuente === "receta" ? "con la receta nueva" : "con sus lentes actuales"})</span>
          </p>
        )}
      </Tarjeta>
    </div>
  )
}
