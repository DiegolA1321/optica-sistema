import { describe, it, expect } from "vitest"
import { puedeAtenderCita, puedeEditarCita, puedeAgendarOtraCita, puedeCancelarCita, esPrimeraVez, coincideEstado, coincideOrigen, coincideSeguimiento, coincideResponsable, responsableDeCita, citaPasaFiltros, contarCon, totalDelAlcance, periodosFiltro, requiereConfirmarOtroDia } from "./filtrosCitas"

const ahora = new Date(2026, 9, 6, 10, 0) // 6 oct 2026, 10:00

describe("esPrimeraVez", () => {
  const cita = { id: "c2", pacienteId: "p1", fecha: "2026-10-10" }
  it("sin consultas previas es primera vez", () => {
    expect(esPrimeraVez(cita, [])).toBe(true)
  })
  it("con una consulta anterior es seguimiento", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p1", citaId: "c1", fecha: "2026-09-01" }])).toBe(false)
  })
  it("la consulta de la propia cita no le quita la etiqueta", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p1", citaId: "c2", fecha: "2026-10-10" }])).toBe(true)
  })
  it("una consulta de otro paciente no cuenta", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p2", citaId: "x", fecha: "2026-09-01" }])).toBe(true)
  })
  it("una cita sin paciente vinculado es primera vez", () => {
    expect(esPrimeraVez({ id: "c3", pacienteId: null, fecha: "2026-10-10" }, [])).toBe(true)
  })
})

describe("coincideEstado", () => {
  it("todas deja pasar cualquier estado", () => {
    expect(coincideEstado({ estado: "Cancelada" }, "todas", ahora)).toBe(true)
  })
  it("separa pendientes, en atención, atendidas y canceladas", () => {
    expect(coincideEstado({ estado: "Pendiente" }, "pendiente", ahora)).toBe(true)
    expect(coincideEstado({ estado: "En Atención" }, "enAtencion", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Atendida" }, "atendida", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Cancelada" }, "cancelada", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Atendida" }, "pendiente", ahora)).toBe(false)
  })
  it("noAsistio: solo las citas marcadas No asistió", () => {
    expect(coincideEstado({ estado: "No Asistió" }, "noAsistio", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Pendiente", fecha: "2026-10-05", hora: "9:00" }, "noAsistio", ahora)).toBe(false)
    expect(coincideEstado({ estado: "Atendida" }, "noAsistio", ahora)).toBe(false)
  })
})

describe("origen y seguimiento", () => {
  it("filtra por origen", () => {
    expect(coincideOrigen({ origen: "paciente" }, "paciente")).toBe(true)
    expect(coincideOrigen({ origen: "staff" }, "paciente")).toBe(false)
    expect(coincideOrigen({ origen: "staff" }, "todos")).toBe(true)
  })
  it("filtra por primera vez o seguimiento", () => {
    const cita = { id: "c2", pacienteId: "p1", fecha: "2026-10-10" }
    const consultas = [{ pacienteId: "p1", citaId: "c1", fecha: "2026-09-01" }]
    expect(coincideSeguimiento(cita, "seguimiento", consultas)).toBe(true)
    expect(coincideSeguimiento(cita, "primera", consultas)).toBe(false)
    expect(coincideSeguimiento(cita, "todos", consultas)).toBe(true)
  })
})

describe("coincideResponsable", () => {
  it("todos deja pasar todo", () => {
    expect(coincideResponsable({ asignadoA: null }, "todos")).toBe(true)
  })
  it("el responsable es quien atendió y, si no, a quien está asignada", () => {
    expect(responsableDeCita({ asignadoA: "u1", atendidoPor: "u2" })).toBe("u2")
    expect(responsableDeCita({ asignadoA: "u1", atendidoPor: null })).toBe("u1")
    expect(responsableDeCita({ asignadoA: null, atendidoPor: null })).toBe(null)
  })
  it("una persona deja solo las citas de las que es responsable, sin repetirse en otra", () => {
    const cita = { asignadoA: "u1", atendidoPor: "u2" }
    expect(coincideResponsable(cita, "u2")).toBe(true)
    expect(coincideResponsable(cita, "u1")).toBe(false)
    expect(coincideResponsable({ asignadoA: "u1", atendidoPor: null }, "u1")).toBe(true)
  })
  it("ninguno solo deja las citas sin asignar y sin atender", () => {
    expect(coincideResponsable({ asignadoA: null, atendidoPor: null }, "ninguno")).toBe(true)
    expect(coincideResponsable({ asignadoA: "u1", atendidoPor: null }, "ninguno")).toBe(false)
    expect(coincideResponsable({ asignadoA: null, atendidoPor: "u2" }, "ninguno")).toBe(false)
  })
})

describe("puedeCancelarCita", () => {
  it("no se cancela lo ya atendido ni lo ya cancelado", () => {
    expect(puedeCancelarCita({ estado: "Atendida" })).toBe(false)
    expect(puedeCancelarCita({ estado: "Cancelada" })).toBe(false)
    for (const estado of ["No Asistió", "En Atención"]) expect(puedeCancelarCita({ estado })).toBe(false)
    for (const estado of ["Pendiente", "En Espera"]) expect(puedeCancelarCita({ estado })).toBe(true)
  })
})

describe("acciones según el estado de la cita", () => {
  const c = (estado) => ({ estado })
  it("solo se atiende lo que sigue abierto: no lo atendido, cancelado ni lo que no asistió", () => {
    for (const e of ["Pendiente", "En Espera", "En Atención"]) expect(puedeAtenderCita(c(e))).toBe(true)
    for (const e of ["Atendida", "Cancelada", "No Asistió"]) expect(puedeAtenderCita(c(e))).toBe(false)
  })
  it("solo se edita lo que sigue abierto: no lo atendido, cancelado ni lo que no asistió", () => {
    for (const e of ["Atendida", "Cancelada", "No Asistió"]) expect(puedeEditarCita(c(e))).toBe(false)
    for (const e of ["Pendiente", "En Espera", "En Atención"]) expect(puedeEditarCita(c(e))).toBe(true)
  })
  it("quien no asistió ofrece agendar otra cita; el resto no", () => {
    expect(puedeAgendarOtraCita(c("No Asistió"))).toBe(true)
    expect(puedeAgendarOtraCita(c("Pendiente"))).toBe(false)
  })
})

describe("filtros combinados y conteos", () => {
  const cita = (id, o) => ({ id, paciente: `Paciente ${id}`, estado: "Pendiente", origen: "staff", fecha: "2026-10-12", pacienteId: id, asignadoA: null, atendidoPor: null, ...o })
  const citas = [
    cita("a", { origen: "paciente" }),
    cita("b", { origen: "paciente", estado: "Atendida" }),
    cita("c", { origen: "staff" }),
    cita("d", { origen: "paciente", estado: "Cancelada" }),
    cita("e", { origen: "paciente", fecha: "2026-11-02" }),
  ]
  const base = { estado: "todas", origen: "todos", seguimiento: "todos", responsable: "todos", texto: "", periodo: { filtro: "todas", desde: "", hasta: "" }, ventana: null }
  const pasan = (f) => citas.filter((c) => citaPasaFiltros(c, f)).map((c) => c.id)

  it("'Todas' son las activas: las canceladas solo salen con el estado Canceladas", () => {
    expect(pasan(base)).toEqual(["a", "b", "c", "e"])
    expect(pasan({ ...base, estado: "cancelada" })).toEqual(["d"])
  })
  it("el conteo de cada opción respeta todos los demás filtros pero no el propio", () => {
    const f = { ...base, origen: "paciente" }
    expect(contarCon(citas, f, [], { estado: "todas" })).toBe(3) // a, b, e
    expect(contarCon(citas, f, [], { estado: "pendiente" })).toBe(2) // a, e
    expect(contarCon(citas, f, [], { estado: "cancelada" })).toBe(1) // d
    expect(contarCon(citas, f, [], { origen: "staff" })).toBe(1) // c, sin el filtro de origen propio
  })
  it("la búsqueda cuenta en todas las opciones", () => {
    expect(contarCon(citas, { ...base, texto: "paciente a" }, [], { origen: "paciente" })).toBe(1)
    expect(contarCon(citas, { ...base, texto: "paciente a" }, [], { origen: "staff" })).toBe(0)
  })
  it("un rango de fechas manda sobre Hoy/Esta semana/Todas", () => {
    const f = { ...base, periodo: { filtro: "hoy", desde: "2026-11-01", hasta: "2026-11-30" } }
    expect(pasan(f)).toEqual(["e"])
  })
  it("en Semana y Mes el periodo visible recorta, y el total es el de ese periodo", () => {
    const f = { ...base, ventana: { desde: "2026-10-01", hasta: "2026-10-31" } }
    expect(pasan(f)).toEqual(["a", "b", "c"])
    expect(totalDelAlcance(citas, f)).toBe(3)
    expect(totalDelAlcance(citas, { ...f, estado: "cancelada" })).toBe(4)
  })
  it("el total sin filtros no cuenta las canceladas", () => {
    expect(totalDelAlcance(citas, base)).toBe(4)
  })
})

describe("atajos del periodo y búsqueda en todas las fechas", () => {
  it("los periodos son Hoy, Semana y Mes; 'Para reagendar' y 'Todas' aparecen solo mientras están activos", () => {
    expect(periodosFiltro().map((p) => p.etiqueta)).toEqual(["Hoy", "Semana", "Mes"])
    expect(periodosFiltro("reagendar").map((p) => p.id)).toEqual(["hoy", "semana", "mes", "reagendar"])
    expect(periodosFiltro("todas").map((p) => p.id)).toEqual(["hoy", "semana", "mes", "todas"])
  })

  const cita = (id, o) => ({ id, paciente: `Paciente ${id}`, estado: "Pendiente", origen: "staff", fecha: "2026-10-08", pacienteId: id, asignadoA: null, atendidoPor: null, confirmadaAt: null, ...o })
  const citas = [
    cita("a", { fecha: "2026-10-05" }), // lunes: ya pasó, pero es de esta semana
    cita("b", { fecha: "2026-10-11", estado: "Atendida" }), // domingo
    cita("c", { fecha: "2026-10-12" }), // lunes siguiente
    cita("d", { estado: "No Asistió", fecha: "2026-10-06" }),
    cita("e", { estado: "Cancelada", canceladaPor: "paciente", fecha: "2026-10-05" }),
    cita("f", { fecha: "2026-10-04" }), // domingo anterior
  ]
  const base = { estado: "todas", origen: "todos", seguimiento: "todos", responsable: "todos", texto: "", ventana: null, rangos: { hoy: { desde: "2026-10-08", hasta: "2026-10-08" }, semana: { desde: "2026-10-05", hasta: "2026-10-11" }, mes: { desde: "2026-10-01", hasta: "2026-10-31" } }, idsReagendar: new Set(["d", "e"]) }
  const con = (filtro, extra = {}) => citas.filter((c) => citaPasaFiltros(c, { ...base, periodo: { filtro, desde: "", hasta: "" }, ...extra })).map((c) => c.id)

  it("'Semana' va de lunes a domingo e incluye los días ya pasados, como la vista Semana", () => {
    expect(con("semana")).toEqual(["a", "b", "d"])
  })
  it("'Hoy' sigue el día que se ve, también si no es hoy (con las flechas)", () => {
    expect(con("hoy")).toEqual(["c"].slice(0, 0))
    expect(con("hoy", { rangos: { ...base.rangos, hoy: { desde: "2026-10-12", hasta: "2026-10-12" } } })).toEqual(["c"])
  })
  it("'Mes' va del 1 al último día del mes en curso", () => {
    expect(con("mes")).toEqual(["a", "b", "c", "d", "f"])
  })
  it("'para reagendar' incluye canceladas y no asistidas aunque el estado esté en Todas", () => {
    expect(con("reagendar")).toEqual(["d", "e"])
  })
  it("la búsqueda mira todas las fechas e ignora el periodo; al borrarla, vuelve", () => {
    expect(con("semana", { texto: "paciente c" })).toEqual(["c"])
    expect(con("semana", { texto: "" })).toEqual(["a", "b", "d"])
  })
})

describe("requiereConfirmarOtroDia", () => {
  it("pide confirmar solo las citas de otro día; las de hoy y las atenciones abiertas entran directo", () => {
    expect(requiereConfirmarOtroDia({ estado: "Pendiente", fecha: "2026-10-09" }, "2026-10-08")).toBe(true)
    expect(requiereConfirmarOtroDia({ estado: "En Espera", fecha: "2026-10-07" }, "2026-10-08")).toBe(true)
    expect(requiereConfirmarOtroDia({ estado: "Pendiente", fecha: "2026-10-08" }, "2026-10-08")).toBe(false)
    expect(requiereConfirmarOtroDia({ estado: "En Atención", fecha: "2026-10-07" }, "2026-10-08")).toBe(false)
    expect(requiereConfirmarOtroDia({ estado: "Pendiente", fecha: "" }, "2026-10-08")).toBe(false)
  })
})
