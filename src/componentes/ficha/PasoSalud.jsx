"use client"

import { Eye, ScanEye, Droplet, Palette } from "lucide-react"
import { METODOS_PIO, PRUEBAS_COLOR, INTERPRETACIONES_COLOR, SIN_HALLAZGOS } from "../../utilidades/fichaDatos"
import { filtrarSoloNumeros } from "../../utilidades/validaciones"
import { Tarjeta, Etiqueta, Texto, AreaTexto, Lista, Numero, Opciones, HoraAmPm, OjosLadoALado, CuadroOjo, BotonTexto } from "./piezas"

// Paso 2 · Examen, bloque Salud ocular (opcional): biomicroscopía y fondo de ojo por ojo, presión intraocular (por ojo, con método y hora) y test de color.
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
  const pioOjo = (lado) => {
    const P = lado === "od" ? "Od" : "Oi"
    return <CuadroOjo lado={lado}><Numero id={`pio${P}`} etiqueta="mmHg" valor={f[`pio${P}`]} onCambiar={(v) => set(`pio${P}`, filtrarSoloNumeros(v, 2))} tipo="libre" /></CuadroOjo>
  }
  return (
    <div className="space-y-3">
      <Tarjeta titulo="Biomicroscopía" icono={Eye} derecha={<Etiqueta>Lámpara de hendidura</Etiqueta>}>
        <OjosLadoALado izquierdo={bioOjo("oi")} derecho={bioOjo("od")} />
      </Tarjeta>
      <Tarjeta titulo="Fondo de ojo" icono={ScanEye}>
        <OjosLadoALado izquierdo={fondoOjo("oi")} derecho={fondoOjo("od")} />
      </Tarjeta>
      <Tarjeta titulo="Presión intraocular" icono={Droplet}>
        <OjosLadoALado izquierdo={pioOjo("oi")} derecho={pioOjo("od")} />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <HoraAmPm id="pioHora" etiqueta="Hora de la medición" valor={f.pioHora} onCambiar={(v) => set("pioHora", v)} />
          <Lista id="pioMetodo" etiqueta="Método" valor={f.pioMetodo} onCambiar={(v) => set("pioMetodo", v)} opciones={METODOS_PIO} ancho="w-full max-w-xs" />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Test de color" icono={Palette}>
        <div className="flex flex-wrap items-end gap-3">
          <Lista id="colorPrueba" etiqueta="Prueba" valor={f.colorPrueba} onCambiar={(v) => set("colorPrueba", v)} opciones={PRUEBAS_COLOR} ancho="w-44" />
          <Texto id="colorResultado" etiqueta="Resultado" valor={f.colorResultado} onCambiar={(v) => set("colorResultado", v)} placeholder="Ej. 14 de 14" ancho="w-40" />
          <div><p className="mb-1 text-xs font-semibold text-slate-500">Interpretación</p><Opciones etiqueta="Interpretación" opciones={INTERPRETACIONES_COLOR} valor={f.colorInterpretacion} onCambiar={(v) => set("colorInterpretacion", v)} /></div>
        </div>
      </Tarjeta>
    </div>
  )
}
