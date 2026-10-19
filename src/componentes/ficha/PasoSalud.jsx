"use client"

import { Eye, ScanEye, Droplet, Palette } from "lucide-react"
import { METODOS_PIO, PRUEBAS_COLOR, SIN_HALLAZGOS } from "../../utilidades/fichaDatos"
import { filtrarSoloNumeros } from "../../utilidades/validaciones"
import { Tarjeta, Etiqueta, Texto, AreaTexto, Lista, Numero, OjosLadoALado, CuadroOjo, BotonTexto } from "./piezas"

// Paso 4 · Salud ocular (opcional, se puede saltar): biomicroscopía y fondo de ojo por ojo, presión intraocular (con método y hora) y test de color.
export default function PasoSalud({ f, set, setVarios }) {
  const otro = (P) => (P === "Od" ? "Oi" : "Od")
  const BIO = ["Parpados", "Cornea", "Camara"]
  const bioOjo = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return (
      <CuadroOjo lado={lado}>
        <div className="space-y-2">
          <Texto id={`bio${P}Parpados`} etiqueta="Párpados y conjuntiva" valor={f[`bio${P}Parpados`]} onCambiar={(v) => set(`bio${P}Parpados`, v)} ancho="w-full" />
          <Texto id={`bio${P}Cornea`} etiqueta="Córnea" valor={f[`bio${P}Cornea`]} onCambiar={(v) => set(`bio${P}Cornea`, v)} ancho="w-full" />
          <Texto id={`bio${P}Camara`} etiqueta="Cámara anterior y cristalino" valor={f[`bio${P}Camara`]} onCambiar={(v) => set(`bio${P}Camara`, v)} ancho="w-full" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <BotonTexto onClick={() => setVarios(Object.fromEntries(BIO.map((k) => [`bio${P}${k}`, SIN_HALLAZGOS])))}>Sin hallazgos</BotonTexto>
          <BotonTexto onClick={() => setVarios(Object.fromEntries(BIO.map((k) => [`bio${P}${k}`, f[`bio${otro(P)}${k}`]])))}>Igual en el otro ojo</BotonTexto>
        </div>
      </CuadroOjo>
    )
  }
  const fondoOjo = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return (
      <CuadroOjo lado={lado}>
        <AreaTexto id={`fondo${P}`} etiqueta="Hallazgos" valor={f[`fondo${P}`]} onCambiar={(v) => set(`fondo${P}`, v)} filas={3} ancho="w-full" />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <BotonTexto onClick={() => set(`fondo${P}`, SIN_HALLAZGOS)}>Sin hallazgos</BotonTexto>
          <BotonTexto onClick={() => set(`fondo${P}`, f[`fondo${otro(P)}`])}>Igual en el otro ojo</BotonTexto>
        </div>
      </CuadroOjo>
    )
  }
  return (
    <div className="space-y-3">
      <p role="note" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">Este paso es opcional: se puede saltar con «Siguiente» y la ficha queda como «Omitido».</p>
      <Tarjeta titulo="Biomicroscopía" icono={Eye} derecha={<Etiqueta>Lámpara de hendidura</Etiqueta>}>
        <OjosLadoALado izquierdo={bioOjo("oi")} derecho={bioOjo("od")} />
      </Tarjeta>
      <Tarjeta titulo="Fondo de ojo" icono={ScanEye}>
        <OjosLadoALado izquierdo={fondoOjo("oi")} derecho={fondoOjo("od")} />
      </Tarjeta>
      <Tarjeta titulo="Presión intraocular" icono={Droplet}>
        <div className="flex flex-wrap gap-3">
          <Numero id="pioOd" etiqueta="OD (mmHg)" valor={f.pioOd} onCambiar={(v) => set("pioOd", filtrarSoloNumeros(v, 2))} tipo="libre" placeholder="14" />
          <Numero id="pioOi" etiqueta="OI (mmHg)" valor={f.pioOi} onCambiar={(v) => set("pioOi", filtrarSoloNumeros(v, 2))} tipo="libre" placeholder="15" />
          <div className="shrink-0">
            <label htmlFor="pioHora" className="mb-1 block text-xs font-semibold text-slate-500">Hora de la medición</label>
            <input id="pioHora" type="time" value={f.pioHora} onChange={(e) => set("pioHora", e.target.value)} className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500" />
          </div>
          <Lista id="pioMetodo" etiqueta="Método" valor={f.pioMetodo} onCambiar={(v) => set("pioMetodo", v)} opciones={METODOS_PIO} ancho="w-56" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Test de color" icono={Palette}>
        <div className="flex flex-wrap gap-3">
          <Lista id="colorPrueba" etiqueta="Prueba" valor={f.colorPrueba} onCambiar={(v) => set("colorPrueba", v)} opciones={PRUEBAS_COLOR} ancho="w-44" />
          <Texto id="colorResultado" etiqueta="Resultado" valor={f.colorResultado} onCambiar={(v) => set("colorResultado", v)} placeholder="Ej. Ishihara 14 de 14" ancho="w-60" />
        </div>
      </Tarjeta>
    </div>
  )
}
