// Una óptica nueva nace sin nada guardado en su configuración (parametrizacion vacía, sin plantillas, sin textos de la página): todo lo que necesita sale de estos valores por defecto.
// La parte de la base (roles predefinidos, recordatorios activos) la comprueba scripts/historial/verificar-optica-nueva.mjs.
import { describe, it, expect } from "vitest"
import { programaDe, errorDePrograma, PROGRAMA_POR_DEFECTO } from "./programaFidelidad"
import { PLANTILLAS_BASE, plantillaDe, VARIABLES_PLANTILLA } from "./crmContactos"
import { MOTIVOS_PERSONAL, MOTIVOS_PACIENTE } from "./motivosCancelacion"
import { recordatorioDeConteo, DIAS_CONTEO_POR_DEFECTO } from "./recordatorioConteo"
import { umbralStock, umbralMaximo, UMBRAL_STOCK_BAJO, UMBRAL_STOCK_MAXIMO } from "./inventario"
import { paginaPublica, colorMarca, COLOR_POR_DEFECTO, ESLOGAN_POR_DEFECTO } from "./marcaOptica"

const marcaNueva = { nombreMarca: "Óptica Nueva", eslogan: "Ve el mundo con claridad.", colorAcento: "#2563EB" } // lo que escribe el panel del superadmin
const sinNada = {} // parametrizacion de una óptica que nadie ha configurado

describe("óptica nueva: valores por defecto", () => {
  it("fidelización: programa activo, con tres niveles válidos", () => {
    const p = programaDe(sinNada)
    expect(p.activo).toBe(true)
    expect(p.niveles.map((n) => n.nombre)).toEqual(["Nuevo", "Frecuente", "Preferente"])
    expect(p.niveles[0].desde).toBe(0)
    expect(errorDePrograma(p)).toBe("")
    expect(p).toMatchObject({ porConsulta: PROGRAMA_POR_DEFECTO.porConsulta, porReferido: PROGRAMA_POR_DEFECTO.porReferido })
  })

  it("plantillas del CRM: los doce motivos tienen texto sin que la óptica guarde ninguno", () => {
    expect(Object.keys(PLANTILLAS_BASE)).toHaveLength(12)
    for (const motivo of Object.keys(PLANTILLAS_BASE)) {
      const t = plantillaDe(motivo, {})
      expect(t.length).toBeGreaterThan(20)
      // todo dato automático que usa la plantilla existe en la lista de datos automáticos
      for (const v of t.match(/\{[a-z_]+\}/g) || []) expect(VARIABLES_PLANTILLA.map((x) => x.id)).toContain(v)
    }
    expect(plantillaDe("lentes_listos_envio", {})).toContain("{entrega}")
    expect(plantillaDe("cita_no_efectuada", {})).toContain("{fecha_cita}")
  })

  it("motivos de cancelación: lista fija para el personal y para el portal, siempre con «Otro»", () => {
    expect(MOTIVOS_PERSONAL.map((m) => m.id)).toEqual(["paciente_no_puede", "paciente_llamada", "optica_no_puede", "otro"])
    expect(MOTIVOS_PACIENTE.map((m) => m.id)).toEqual(["paciente_no_puede", "paciente_ya_no_necesita", "otro"])
  })

  it("stock mínimo (10) y máximo (30) generales, y recordatorio del conteo activo cada 30 días", () => {
    expect(umbralStock(sinNada)).toBe(UMBRAL_STOCK_BAJO)
    expect(UMBRAL_STOCK_BAJO).toBe(10)
    expect(umbralMaximo(sinNada)).toBe(UMBRAL_STOCK_MAXIMO)
    expect(UMBRAL_STOCK_MAXIMO).toBe(30)
    expect(recordatorioDeConteo(sinNada)).toEqual({ activo: true, dias: DIAS_CONTEO_POR_DEFECTO })
    expect(DIAS_CONTEO_POR_DEFECTO).toBe(30)
  })

  it("página pública: textos de ejemplo, color de la marca y sin opiniones inventadas", () => {
    const p = paginaPublica(marcaNueva, "Óptica Nueva")
    expect(p.nombre).toBe("Óptica Nueva")
    expect(p.eslogan).toBe(ESLOGAN_POR_DEFECTO)
    expect(p.textoInicio.length).toBeGreaterThan(20)
    expect(p.servicios.length).toBeGreaterThan(0)
    expect(p.preguntas.length).toBeGreaterThan(0)
    expect(p.razones).toHaveLength(3)
    expect(p.quienesSomos.historia.length).toBeGreaterThan(20)
    expect(p.opiniones).toEqual([]) // sin opiniones la sección no se dibuja
    expect(p.color).toBe(colorMarca({ colorAcento: COLOR_POR_DEFECTO }))
  })

  it("página pública: una óptica sin marca guardada tampoco queda vacía", () => {
    const p = paginaPublica(null, "Tu óptica")
    expect(p.servicios.length).toBeGreaterThan(0)
    expect(p.razones).toHaveLength(3)
  })
})
