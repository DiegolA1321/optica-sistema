import { describe, it, expect } from "vitest"
import { sumarDiasISO, diaHabilMasCercano, controlesSinAgendar, asignadoDelControl, citasParaReagendar } from "./controles"

const SESION = (activo, inicio, fin) => ({ activo, inicio, fin })
// Lunes a viernes abierto de 09:00 a 12:00; sábado y domingo cerrado.
const ABIERTO = { manana: SESION(true, "09:00", "12:00"), tarde: SESION(false, "14:00", "18:00") }
const CERRADO = { manana: SESION(false, "09:00", "12:00"), tarde: SESION(false, "14:00", "18:00") }
const DISPONIBILIDAD = {
  duracionCita: 40,
  horarioSemanal: { lunes: ABIERTO, martes: ABIERTO, miercoles: ABIERTO, jueves: ABIERTO, viernes: ABIERTO, sabado: CERRADO, domingo: CERRADO },
}

describe("sumarDiasISO", () => {
  it("suma y resta días cruzando el mes", () => {
    expect(sumarDiasISO("2026-10-30", 3)).toBe("2026-11-02")
    expect(sumarDiasISO("2026-11-02", -3)).toBe("2026-10-30")
  })
})

describe("diaHabilMasCercano", () => {
  const hoy = "2026-10-07"
  it("devuelve el mismo día si está abierto y con cupo", () => {
    expect(diaHabilMasCercano("2026-11-06", DISPONIBILIDAD, [], { hoy })).toBe("2026-11-06") // viernes
  })
  it("un sábado cerrado sugiere el viernes anterior (empate: el día anterior)", () => {
    expect(diaHabilMasCercano("2026-11-07", DISPONIBILIDAD, [], { hoy })).toBe("2026-11-06")
  })
  it("un domingo cerrado sugiere el lunes, que está más cerca que el viernes", () => {
    expect(diaHabilMasCercano("2026-11-08", DISPONIBILIDAD, [], { hoy })).toBe("2026-11-09")
  })
  it("nunca sugiere un día anterior a hoy", () => {
    expect(diaHabilMasCercano("2026-10-10", DISPONIBILIDAD, [], { hoy: "2026-10-09" })).toBe("2026-10-09")
  })
  it("sin ningún día abierto cerca devuelve null", () => {
    expect(diaHabilMasCercano("2026-11-07", { horarioSemanal: {} }, [], { hoy })).toBeNull()
  })
})

describe("controlesSinAgendar", () => {
  const paciente = { id: "p1", nombre: "Ana Pérez", estadoClinico: "Activo", fechaRegistro: "2026-01-01" }
  const consulta = (extra = {}) => ({ id: "c1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-10-07", proximoControlDias: 30, controlAgenda: "despues", ...extra })

  it("lista al paciente que se dejó para agendar después y no tiene cita", () => {
    const r = controlesSinAgendar([paciente], [consulta()], [])
    expect(r).toHaveLength(1)
    expect(r[0].paciente.id).toBe("p1")
    expect(r[0].fechaControl.getMonth()).toBe(10) // noviembre
  })
  it("no lista a quien ya tiene una cita pendiente posterior a la ficha", () => {
    const cita = { id: "k1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-11-06", estado: "Pendiente" }
    expect(controlesSinAgendar([paciente], [consulta()], [cita])).toHaveLength(0)
  })
  it("si la cita del control se canceló o no asistió, vuelve a aparecer", () => {
    for (const estado of ["Cancelada", "No Asistió"]) {
      const cita = { id: "k1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-11-06", estado }
      expect(controlesSinAgendar([paciente], [consulta({ controlAgenda: "ahora" })], [cita])).toHaveLength(1)
    }
  })
  it("una cita del mismo día de la ficha no cuenta como control", () => {
    const cita = { id: "k1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-10-07", estado: "Pendiente" }
    expect(controlesSinAgendar([paciente], [consulta()], [cita])).toHaveLength(1)
  })
  it("fichas antiguas, sin elección explícita, no entran", () => {
    expect(controlesSinAgendar([paciente], [consulta({ controlAgenda: null })], [])).toHaveLength(0)
  })
  it("un paciente de alta no tiene control pendiente", () => {
    expect(controlesSinAgendar([{ ...paciente, estadoClinico: "De alta" }], [consulta()], [])).toHaveLength(0)
  })
  it("solo cuenta la ficha más reciente", () => {
    const vieja = consulta({ id: "c0", fecha: "2026-01-10", controlAgenda: "despues" })
    const nueva = consulta({ id: "c2", fecha: "2026-10-07", controlAgenda: null })
    expect(controlesSinAgendar([paciente], [vieja, nueva], [])).toHaveLength(0)
  })
  it("ordena por la fecha del control, el más próximo primero", () => {
    const otro = { id: "p2", nombre: "Luis Mora", estadoClinico: "Activo" }
    const c2 = { id: "c9", pacienteId: "p2", paciente: "Luis Mora", fecha: "2026-10-01", proximoControlDias: 30, controlAgenda: "despues" }
    const r = controlesSinAgendar([paciente, otro], [consulta(), c2], [])
    expect(r.map((x) => x.paciente.id)).toEqual(["p2", "p1"])
  })
})

describe("asignadoDelControl", () => {
  const equipo = [{ id: "u1", nombre: "Paula Optómetra" }, { id: "u2", nombre: "Luis Baja", activo: false }]
  it("usa el id guardado en la ficha", () => {
    expect(asignadoDelControl({ controlAsignadoA: "u9", profesionalNombre: "Paula Optómetra" }, equipo)).toBe("u9")
  })
  it("en fichas anteriores busca al profesional por su nombre", () => {
    expect(asignadoDelControl({ profesionalNombre: "Paula Optómetra" }, equipo)).toBe("u1")
  })
  it("si la persona está desactivada, o no se encuentra, no asigna a nadie", () => {
    expect(asignadoDelControl({ profesionalNombre: "Luis Baja" }, equipo)).toBe("")
    expect(asignadoDelControl({ profesionalNombre: "Otra" }, equipo)).toBe("")
    expect(asignadoDelControl(null, equipo)).toBe("")
  })
})

describe("citasParaReagendar", () => {
  const hoy = "2026-10-07"
  const cancelada = (id, fecha, extra = {}) => ({ id, fecha, hora: "09:00 AM", estado: "Cancelada", canceladaPor: "paciente", paciente: "Ana", pacienteId: "p1", ...extra })
  it("lista las canceladas por el paciente, no las de recepción", () => {
    const r = citasParaReagendar([cancelada("c1", "2026-10-08"), cancelada("c2", "2026-10-09", { canceladaPor: "recepcion", pacienteId: "p2", paciente: "Luis" })], { hoy })
    expect(r.map((c) => c.id)).toEqual(["c1"])
  })
  it("una sola por paciente (la más reciente) y las más próximas primero", () => {
    const r = citasParaReagendar([cancelada("c1", "2026-10-01"), cancelada("c2", "2026-10-05"), cancelada("c3", "2026-10-02", { pacienteId: "p2", paciente: "Luis" })], { hoy })
    expect(r.map((c) => c.id)).toEqual(["c3", "c2"])
  })
  it("desaparece si el paciente ya reagendó (cita activa o atendida posterior)", () => {
    expect(citasParaReagendar([cancelada("c1", "2026-10-05"), { id: "c9", fecha: "2026-10-12", estado: "Pendiente", pacienteId: "p1", paciente: "Ana" }], { hoy })).toEqual([])
    expect(citasParaReagendar([cancelada("c1", "2026-10-05"), { id: "c9", fecha: "2026-10-06", estado: "Atendida", pacienteId: "p1", paciente: "Ana" }], { hoy })).toEqual([])
  })
  it("una cita posterior cancelada o que no asistió no cuenta como reagendada: queda la más reciente", () => {
    const r = citasParaReagendar([cancelada("c1", "2026-10-05"), { id: "c9", fecha: "2026-10-06", estado: "No Asistió", pacienteId: "p1", paciente: "Ana" }], { hoy })
    expect(r.map((c) => c.id)).toEqual(["c9"])
  })
  it("incluye a quienes no asistieron, y no a quienes ya fueron atendidos después", () => {
    const noAsistio = (id, fecha, extra = {}) => ({ id, fecha, hora: "09:00 AM", estado: "No Asistió", paciente: "Luis", pacienteId: "p2", ...extra })
    expect(citasParaReagendar([noAsistio("n1", "2026-10-06")], { hoy }).map((c) => c.id)).toEqual(["n1"])
    expect(citasParaReagendar([noAsistio("n1", "2026-10-06"), { id: "a1", fecha: "2026-10-07", estado: "Atendida", pacienteId: "p2", paciente: "Luis" }], { hoy })).toEqual([])
  })
  it("ignora las canceladas de hace más de 30 días", () => {
    expect(citasParaReagendar([cancelada("c1", "2026-08-01")], { hoy })).toEqual([])
  })
})
