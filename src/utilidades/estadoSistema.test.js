import { describe, it, expect } from "vitest"
import {
  COMPONENTES, rapidez, haceTiempo, componentesConEstado, estadoGeneral, verificacionAtrasada, historial30, disponibilidad30, queHacer, avisosDeSistema,
  estadoDeMuestra, nombreTarea, cadaCuanto,
} from "./estadoSistema"

const AHORA = new Date("2026-10-16T15:00:00Z").getTime()
const ult = (estado, extra = {}) => ({ estado, latencia_ms: 5, detalle: null, referencia_at: null, creado_at: new Date(AHORA - 6 * 60000).toISOString(), ...extra })
const datos = (estados) => ({ ultimos: COMPONENTES.map((c) => ({ componente: c.id, ...ult(estados[c.id] || "operativo") })), historial: [], fallos: [], tareas: [] })

describe("los cinco componentes", () => {
  it("tienen nombres que se entienden, no internos", () => {
    expect(COMPONENTES.map((c) => c.nombre)).toEqual(["Inicio de sesión", "Datos", "Archivos", "Tareas automáticas", "Correo"])
  })
})

describe("rapidez con referencia (no un número suelto)", () => {
  it("Rápido, Normal o Lento, solo donde se mide un tiempo", () => {
    expect(rapidez("datos", 5)).toEqual({ nombre: "Rápido", referencia: "menos de 0,2 s" })
    expect(rapidez("sesion", 300)).toEqual({ nombre: "Normal", referencia: "menos de 0,8 s" })
    expect(rapidez("archivos", 900)).toEqual({ nombre: "Lento", referencia: "0,8 s o más" })
    expect(rapidez("tareas", 5)).toBeNull()
    expect(rapidez("correo", 5)).toBeNull()
    expect(rapidez("datos", null)).toBeNull()
  })
})

describe("estado general: el peor de los cinco", () => {
  it("con fallas gana a lento", () => {
    expect(estadoGeneral(componentesConEstado(datos({ datos: "lento", archivos: "con_fallas" }))).estado).toBe("con_fallas")
    expect(estadoGeneral(componentesConEstado(datos({ datos: "lento" }))).estado).toBe("lento")
  })
  it("falta configurar el correo no es una falla: sigue Operativo y se dice qué falta", () => {
    const g = estadoGeneral(componentesConEstado(datos({ correo: "no_configurado" })))
    expect(g.estado).toBe("operativo")
    expect(g.sinConfigurar).toEqual(["Correo"])
  })
  it("sin verificaciones dice «Sin verificar»", () => {
    expect(estadoGeneral(componentesConEstado(null)).nombre).toBe("Sin verificar")
  })
})

describe("verificación atrasada", () => {
  it("avisa cuando la última tiene más de 45 minutos", () => {
    expect(verificacionAtrasada(componentesConEstado(datos({})), AHORA)).toBe(false)
    expect(verificacionAtrasada(componentesConEstado(datos({})), AHORA + 60 * 60000)).toBe(true)
  })
})

describe("haceTiempo", () => {
  it("minutos, horas y días", () => {
    expect(haceTiempo(new Date(AHORA - 5 * 60000).toISOString(), AHORA)).toBe("hace 5 min")
    expect(haceTiempo(new Date(AHORA - 2 * 3600000).toISOString(), AHORA)).toBe("hace 2 horas")
    expect(haceTiempo(new Date(AHORA - 3 * 86400000).toISOString(), AHORA)).toBe("hace 3 días")
    expect(haceTiempo("", AHORA)).toBe("")
  })
})

describe("historial de 30 días", () => {
  it("un cuadro por día con el peor estado de ese día", () => {
    const d = { historial: [
      { componente: "datos", dia: "2026-10-16", operativo: 90, lento: 0, con_fallas: 0, no_configurado: 0, latencia_media: 4 },
      { componente: "datos", dia: "2026-10-15", operativo: 80, lento: 4, con_fallas: 0, no_configurado: 0, latencia_media: 9 },
      { componente: "datos", dia: "2026-10-14", operativo: 70, lento: 4, con_fallas: 2, no_configurado: 0, latencia_media: 9 },
      { componente: "correo", dia: "2026-10-16", operativo: 0, lento: 0, con_fallas: 0, no_configurado: 96, latencia_media: null },
    ] }
    const dias = historial30(d, "datos", "2026-10-16")
    expect(dias).toHaveLength(30)
    expect(dias[29]).toMatchObject({ dia: "2026-10-16", estado: "operativo" })
    expect(dias[28].estado).toBe("lento")
    expect(dias[27].estado).toBe("con_fallas")
    expect(dias[0].estado).toBeNull()
    expect(historial30(d, "correo", "2026-10-16")[29].estado).toBe("no_configurado")
  })
  it("el porcentaje operativo se calcula con las verificaciones de los 30 días", () => {
    const d = { historial: [{ componente: "datos", dia: "2026-10-16", operativo: 98, lento: 1, con_fallas: 1, no_configurado: 0 }] }
    expect(disponibilidad30(d, "datos")).toBe(98)
    expect(disponibilidad30(d, "archivos")).toBeNull()
  })
})

describe("qué hacer", () => {
  it("tiene pasos para cada estado que lo necesita y no repite el detalle de la verificación", () => {
    for (const c of COMPONENTES) {
      expect(queHacer(c.id, "con_fallas").length).toBeGreaterThan(0)
    }
    expect(queHacer("correo", "no_configurado").length).toBeGreaterThan(0)
    expect(queHacer("datos", "operativo")[0]).toMatch(/nada que hacer/)
  })
})

describe("avisos del área Sistema", () => {
  it("un aviso por tipo de problema con un caso por componente; «No configurado» no es un aviso", () => {
    const filas = avisosDeSistema(componentesConEstado(datos({ datos: "lento", archivos: "con_fallas", sesion: "con_fallas", correo: "no_configurado" })))
    expect(filas.map((f) => [f.id, f.cantidad, f.texto])).toEqual([["con_fallas", 2, "componentes con fallas"], ["lento", 1, "componente lento"]])
    expect(filas[0].casos.map((c) => c.nombre)).toEqual(["Inicio de sesión", "Archivos"])
    expect(avisosDeSistema(componentesConEstado(datos({ correo: "no_configurado" })))).toEqual([])
  })
})

describe("datos de muestra y nombres de tareas", () => {
  it("la muestra trae los cinco componentes y 30 días de cada uno", () => {
    const m = estadoDeMuestra(AHORA)
    expect(m.ultimos).toHaveLength(5)
    expect(m.historial.filter((h) => h.componente === "datos")).toHaveLength(30)
  })
  it("las tareas se llaman en voz de la persona", () => {
    expect(nombreTarea("marcar_no_asistio_automatico")).toBe("Marcar «No efectuada»")
    expect(cadaCuanto("*/15 * * * *")).toBe("cada 15 minutos")
  })
})
