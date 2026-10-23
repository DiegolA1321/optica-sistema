import { describe, it, expect } from "vitest"
import {
  horaOfrecida, disponibleEnMinuto, semanaDeLaOptica, semanaDe, horasPorSemana, resumenDeJornada, turnosFueraDeLaOptica, citasFueraDelHorario, citasEnAusencia,
  textoCuando, diasDelRango, problemaDeDocumento, estaAusente, horaCorta, resumenSemanaPersona,
} from "./agendaPersonal"
import { slotsDisponibles, diaTieneCupo } from "./disponibilidad"
import { citasPorReasignar, ausenteEnHorario } from "./reasignacion"

const turno = (inicio, fin, activo = true) => ({ activo, inicio, fin })
const diaOptica = () => ({ manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00") })
const cerrado = () => ({ manana: turno("09:00", "13:00", false), tarde: turno("14:00", "18:00", false) })
// La óptica abre de lunes a viernes, mañana y tarde; sábado y domingo cerrada.
const optica = (extra = {}) => ({
  horarioSemanal: { lunes: diaOptica(), martes: diaOptica(), miercoles: diaOptica(), jueves: diaOptica(), viernes: diaOptica(), sabado: cerrado(), domingo: cerrado() },
  excepciones: {}, duracionCita: 60, ...extra,
})
const LUNES = "2099-01-05"
const MARTES = "2099-01-06"
const min = (h, m = 0) => h * 60 + m
// Paula trabaja solo los lunes por la mañana (9 a 13).
const soloLunesManana = { id: "paula", usaOptica: false, horario: { lunes: { manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00", false) } }, ausencias: [] }
const usaOptica = (id, ausencias = []) => ({ id, usaOptica: true, horario: null, ausencias })

describe("quién atiende a qué hora", () => {
  it("sin profesionales marcados se ofrece lo que ofrece la óptica (como siempre)", () => {
    expect(horaOfrecida(optica(), LUNES, min(15))).toBe(true)
    expect(horaOfrecida(optica({ profesionales: [] }), LUNES, min(15))).toBe(true)
  })
  it("con horario propio solo se ofrece lo que trabaja la persona, y nunca fuera del horario de la óptica", () => {
    const d = optica({ profesionales: [soloLunesManana] })
    expect(horaOfrecida(d, LUNES, min(10))).toBe(true)
    expect(horaOfrecida(d, LUNES, min(15))).toBe(false) // la tarde no trabaja
    expect(horaOfrecida(d, MARTES, min(10))).toBe(false) // el martes no trabaja
    expect(disponibleEnMinuto(soloLunesManana, "2099-01-10", min(10), optica())).toBe(false) // sábado: la óptica cerrada manda
  })
  it("quien usa el horario de la óptica trabaja cuando la óptica atiende", () => {
    const d = optica({ profesionales: [usaOptica("rosa")] })
    expect(horaOfrecida(d, MARTES, min(15))).toBe(true)
    expect(horaOfrecida(d, "2099-01-10", min(10))).toBe(false)
  })
  it("una ausencia de todo el día, de la mañana o de la tarde bloquea solo ese tiempo", () => {
    const todo = optica({ profesionales: [usaOptica("rosa", [{ desde: LUNES, hasta: LUNES, franja: "todo" }])] })
    expect(horaOfrecida(todo, LUNES, min(10))).toBe(false)
    expect(horaOfrecida(todo, LUNES, min(16))).toBe(false)
    expect(horaOfrecida(todo, MARTES, min(10))).toBe(true)
    const manana = optica({ profesionales: [usaOptica("rosa", [{ desde: LUNES, hasta: LUNES, franja: "manana" }])] })
    expect(horaOfrecida(manana, LUNES, min(10))).toBe(false)
    expect(horaOfrecida(manana, LUNES, min(15))).toBe(true)
    const tarde = optica({ profesionales: [usaOptica("rosa", [{ desde: LUNES, hasta: LUNES, franja: "tarde" }])] })
    expect(horaOfrecida(tarde, LUNES, min(10))).toBe(true)
    expect(horaOfrecida(tarde, LUNES, min(15))).toBe(false)
  })
  it("varios días: bloquea todos los del rango", () => {
    const d = optica({ profesionales: [usaOptica("rosa", [{ desde: LUNES, hasta: "2099-01-07", franja: "todo" }])] })
    for (const dia of [LUNES, MARTES, "2099-01-07"]) expect(horaOfrecida(d, dia, min(10))).toBe(false)
    expect(horaOfrecida(d, "2099-01-08", min(10))).toBe(true)
    expect(estaAusente(d.profesionales[0], "2099-01-08", min(10), d)).toBe(false)
  })
  it("con varios profesionales se ofrece la hora si alguno atiende; con uno solo, la agenda de esa persona", () => {
    const d = optica({ profesionales: [usaOptica("rosa", [{ desde: LUNES, hasta: LUNES, franja: "todo" }]), soloLunesManana] })
    expect(horaOfrecida(d, LUNES, min(10))).toBe(true) // Paula sí atiende
    expect(horaOfrecida(d, LUNES, min(15))).toBe(false) // Rosa ausente y Paula no trabaja por la tarde
    expect(horaOfrecida(d, LUNES, min(10), "rosa")).toBe(false) // la agenda de Rosa
    expect(horaOfrecida(d, LUNES, min(10), "paula")).toBe(true)
    expect(horaOfrecida(d, LUNES, min(15), "alguien-que-no-atiende")).toBe(false) // quien no es profesional no restringe: cuenta lo de todos
  })
})

describe("las horas que ofrecen la agenda y la web", () => {
  it("slotsDisponibles y diaTieneCupo salen del horario y de las ausencias", () => {
    const sin = slotsDisponibles(LUNES, optica(), []).map((s) => s.hora)
    expect(sin.length).toBe(8) // 4 de la mañana y 4 de la tarde (60 min)
    const d = optica({ profesionales: [soloLunesManana] })
    expect(slotsDisponibles(LUNES, d, []).map((s) => s.hora)).toEqual(sin.slice(0, 4))
    expect(slotsDisponibles(MARTES, d, [])).toEqual([])
    expect(diaTieneCupo(MARTES, d, [])).toBe(false)
    expect(diaTieneCupo(LUNES, d, [], { publico: true })).toBe(true)
    expect(slotsDisponibles(LUNES, d, [], { profesionalId: "paula" }).length).toBe(4)
  })
  it("una cita ocupada sigue marcándose ocupada", () => {
    const d = optica({ profesionales: [soloLunesManana] })
    const s = slotsDisponibles(LUNES, d, [{ fecha: LUNES, hora: "10:00 AM", estado: "Pendiente" }])
    expect(s.find((x) => x.hora === "10:00 AM").libre).toBe(false)
    expect(s.find((x) => x.hora === "09:00 AM").libre).toBe(true)
  })
})

describe("el horario de una persona", () => {
  it("parte del de la óptica, cuenta sus horas y se resume como medio tiempo o tiempo completo", () => {
    const d = optica()
    expect(semanaDeLaOptica(d).lunes.tarde).toEqual(turno("14:00", "18:00"))
    expect(horasPorSemana(semanaDeLaOptica(d))).toBe(40) // 5 días × (4 + 4)
    expect(resumenDeJornada(usaOptica("a"), d)).toBe("Horario de la óptica")
    expect(resumenDeJornada(soloLunesManana, d)).toBe("Medio tiempo · 4 h/sem")
    expect(resumenDeJornada({ id: "x", usaOptica: false, horario: semanaDeLaOptica(d), ausencias: [] }, d)).toBe("Tiempo completo · 40 h/sem")
    expect(resumenDeJornada({ id: "x", usaOptica: false, horario: {}, ausencias: [] }, d)).toBe("Sin turnos")
    expect(semanaDe(soloLunesManana, d).martes.manana.activo).toBe(false)
  })
  it("un turno debe quedar entero dentro del horario de la óptica de ese día", () => {
    const d = optica()
    const semana = semanaDeLaOptica(d)
    expect(turnosFueraDeLaOptica(semana, d)).toEqual([])
    semana.lunes.manana = turno("08:00", "13:00") // empieza antes de que abra
    semana.sabado.manana = turno("09:00", "13:00") // la óptica cierra los sábados
    semana.martes.tarde = turno("14:00", "19:00") // termina después de que cierra
    expect(turnosFueraDeLaOptica(semana, d)).toEqual([{ dia: "lunes", turno: "manana" }, { dia: "martes", turno: "tarde" }, { dia: "sabado", turno: "manana" }])
  })
  it("las citas abiertas de la persona que quedan fuera de su nuevo horario se avisan antes de guardar", () => {
    const citas = [
      { id: "c1", fecha: LUNES, hora: "10:00 AM", estado: "Pendiente", asignadoA: "paula" },
      { id: "c2", fecha: LUNES, hora: "03:00 PM", estado: "Pendiente", asignadoA: "paula" }, // por la tarde: fuera
      { id: "c3", fecha: MARTES, hora: "10:00 AM", estado: "En Espera", asignadoA: "paula" }, // martes: fuera
      { id: "c4", fecha: LUNES, hora: "03:00 PM", estado: "Pendiente", asignadoA: "otra" }, // de otra persona
      { id: "c5", fecha: LUNES, hora: "03:00 PM", estado: "Atendida", asignadoA: "paula" }, // ya atendida
      { id: "c6", fecha: "2020-01-06", hora: "03:00 PM", estado: "Pendiente", asignadoA: "paula" }, // ya pasó
    ]
    const fuera = citasFueraDelHorario({ persona: "paula", semanaNueva: semanaDe(soloLunesManana, optica()), citas, disponibilidad: optica(), hoy: "2099-01-01" })
    expect(fuera.map((c) => c.id)).toEqual(["c2", "c3"])
    expect(citasFueraDelHorario({ persona: "paula", usaOptica: true, citas, disponibilidad: optica(), hoy: "2099-01-01" }).map((c) => c.id)).toEqual([])
  })
})

describe("ausencias", () => {
  it("se listan las citas abiertas de la persona dentro de la ausencia, en orden", () => {
    const citas = [
      { id: "c2", fecha: LUNES, hora: "11:00 AM", estado: "Pendiente", asignadoA: "p" },
      { id: "c1", fecha: LUNES, hora: "09:00 AM", estado: "Pendiente", asignadoA: "p" },
      { id: "c3", fecha: LUNES, hora: "03:00 PM", estado: "Pendiente", asignadoA: "p" }, // la tarde no está en la ausencia
      { id: "c4", fecha: LUNES, hora: "09:00 AM", estado: "Pendiente", asignadoA: "q" },
    ]
    const r = citasEnAusencia({ ausencia: { fechaDesde: LUNES, fechaHasta: LUNES, franja: "manana" }, personaId: "p", citas, disponibilidad: optica() })
    expect(r.map((c) => c.id)).toEqual(["c1", "c2"])
    expect(citasEnAusencia({ ausencia: { fechaDesde: LUNES, fechaHasta: LUNES, franja: "todo" }, personaId: "p", citas, disponibilidad: optica() })).toHaveLength(3)
  })
  it("una ausencia aprobada con citas abiertas aparece en «citas por reasignar» y marca a la persona ausente", () => {
    const d = optica({ profesionales: [usaOptica("p", [{ desde: LUNES, hasta: MARTES, franja: "todo" }])] })
    const citas = [{ id: "c1", fecha: LUNES, hora: "10:00 AM", estado: "Pendiente", asignadoA: "p" }, { id: "c2", fecha: "2099-01-07", hora: "10:00 AM", estado: "Pendiente", asignadoA: "p" }]
    const g = citasPorReasignar(citas, d, "2099-01-01")
    expect(g.map((x) => [x.fecha, x.personaId, x.citas.map((c) => c.id)])).toEqual([[LUNES, "p", ["c1"]]])
    expect(ausenteEnHorario(d, "p", LUNES, "10:00 AM")).toBe(true)
    expect(ausenteEnHorario(d, "p", "2099-01-07", "10:00 AM")).toBe(false)
  })
  it("el texto de cuándo y el rango de días", () => {
    expect(textoCuando({ fechaDesde: "2026-10-30", fechaHasta: "2026-10-30", franja: "todo" })).toBe("30 oct · todo el día")
    expect(textoCuando({ fechaDesde: "2026-11-04", fechaHasta: "2026-11-04", franja: "manana" })).toBe("4 nov · mañana")
    expect(textoCuando({ fechaDesde: "2026-10-15", fechaHasta: "2026-10-19", franja: "todo" })).toBe("15 al 19 oct")
    expect(textoCuando({ fechaDesde: "2026-10-30", fechaHasta: "2026-11-02", franja: "todo" })).toBe("30 oct al 2 nov")
    expect(diasDelRango("2026-10-30", "2026-11-01")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"])
  })
  it("el documento de respaldo es un PDF o una foto de hasta 5 MB", () => {
    expect(problemaDeDocumento(null)).toBe("")
    expect(problemaDeDocumento({ type: "application/pdf", size: 240 * 1024 })).toBe("")
    expect(problemaDeDocumento({ type: "image/jpeg", size: 1024 })).toBe("")
    expect(problemaDeDocumento({ type: "application/msword", size: 1024 })).toMatch(/PDF o una foto/)
    expect(problemaDeDocumento({ type: "application/pdf", size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
  })
})

describe('lo que se ve en Mi horario', () => {
  it('la hora sin cero adelante, como en el diseño', () => {
    expect([horaCorta('09:00'), horaCorta('13:00'), horaCorta('14:30'), horaCorta('00:15'), horaCorta('12:00')]).toEqual(['9:00 AM', '1:00 PM', '2:30 PM', '12:15 AM', '12:00 PM'])
  })
  it('esta semana: las citas agendadas (sin canceladas) y las horas libres según su horario y sus ausencias', () => {
    const lunes = '2099-01-05'
    const ahora = new Date(2099, 0, 5, 7, 0) // el lunes, antes de abrir
    const p = { id: 'paula', usaOptica: false, horario: { lunes: { manana: turno('09:00', '13:00'), tarde: turno('14:00', '18:00', false) }, martes: { manana: turno('09:00', '13:00'), tarde: turno('14:00', '18:00', false) } }, ausencias: [] }
    const citas = [
      { id: 'a', fecha: lunes, hora: '09:00 AM', estado: 'Pendiente', asignadoA: 'paula' },
      { id: 'b', fecha: lunes, hora: '10:00 AM', estado: 'Cancelada', asignadoA: 'paula' },
      { id: 'c', fecha: '2099-01-06', hora: '09:00 AM', estado: 'Atendida', asignadoA: 'paula' },
      { id: 'd', fecha: lunes, hora: '09:00 AM', estado: 'Pendiente', asignadoA: 'otra' },
    ]
    const d = optica()
    // lunes y martes por la mañana: 4 + 4 horas de 60 min; ocupadas 2 (a y c): quedan 6 horas libres
    expect(resumenSemanaPersona({ lunes, profesional: p, citas, disponibilidad: d, duracion: 60, ahora })).toEqual({ citas: 2, horasLibres: 6 })
    const conAusencia = { ...p, ausencias: [{ desde: '2099-01-06', hasta: '2099-01-06', franja: 'todo' }] }
    expect(resumenSemanaPersona({ lunes, profesional: conAusencia, citas, disponibilidad: d, duracion: 60, ahora }).horasLibres).toBe(3)
  })
})
