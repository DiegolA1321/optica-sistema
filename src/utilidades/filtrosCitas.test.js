import { describe, it, expect } from "vitest"
import { puedeAtenderCita, puedeEditarCita, puedeAgendarOtraCita, puedeCancelarCita, esPrimeraVez, coincideEstado, coincideOrigen, coincideSeguimiento, coincideResponsable, citaPasaFiltros, contarCon, totalDelAlcance, proximoDiaDeAtencion, etiquetaDiaCorta, periodosFiltro } from "./filtrosCitas"

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
    expect(coincideResponsable({ asignadoA: null }, "asignadoA", "todos")).toBe(true)
  })
  it("ninguno solo deja las citas sin esa persona", () => {
    expect(coincideResponsable({ asignadoA: null }, "asignadoA", "ninguno")).toBe(true)
    expect(coincideResponsable({ asignadoA: "u1" }, "asignadoA", "ninguno")).toBe(false)
  })
  it("un id deja las citas de esa persona, por separado para asignado y atendido", () => {
    const cita = { asignadoA: "u1", atendidoPor: "u2" }
    expect(coincideResponsable(cita, "asignadoA", "u1")).toBe(true)
    expect(coincideResponsable(cita, "asignadoA", "u2")).toBe(false)
    expect(coincideResponsable(cita, "atendidoPor", "u2")).toBe(true)
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
  const base = { estado: "todas", origen: "todos", seguimiento: "todos", asignado: "todos", atendido: "todos", texto: "", periodo: { filtro: "todas", desde: "", hasta: "" }, ventana: null }
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
  it("un rango de fechas manda sobre Hoy/Próximas/Todas", () => {
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

describe("atajos por tarea y búsqueda en todas las fechas", () => {
  const sesion = (activo) => ({ activo, inicio: "09:00", fin: "12:00" })
  const abierto = { manana: sesion(true), tarde: sesion(false) }
  const cerrado = { manana: sesion(false), tarde: sesion(false) }
  const disp = { horarioSemanal: { lunes: abierto, martes: abierto, miercoles: abierto, jueves: abierto, viernes: abierto, sabado: cerrado, domingo: cerrado }, excepciones: {} }

  it("el día a confirmar es el próximo día de atención: un viernes, el lunes", () => {
    expect(proximoDiaDeAtencion(disp, "2026-10-09")).toBe("2026-10-12") // viernes 9 → lunes 12
    expect(proximoDiaDeAtencion(disp, "2026-10-07")).toBe("2026-10-08") // miércoles → jueves
    expect(etiquetaDiaCorta("2026-10-12")).toBe("Lun 12")
    expect(periodosFiltro("2026-10-12")[1]).toEqual({ id: "confirmar", etiqueta: "Lun 12 · por confirmar" })
  })
  it("sin horario cargado, el día a confirmar es mañana", () => {
    expect(proximoDiaDeAtencion({}, "2026-10-07")).toBe("2026-10-08")
  })

  const cita = (id, o) => ({ id, paciente: `Paciente ${id}`, estado: "Pendiente", origen: "staff", fecha: "2026-10-12", pacienteId: id, asignadoA: null, atendidoPor: null, confirmadaAt: null, ...o })
  const citas = [
    cita("a"), // lunes 12, sin confirmar
    cita("b", { confirmadaAt: "2026-10-08T10:00:00Z" }), // lunes 12, ya confirmada
    cita("c", { fecha: "2026-10-13" }), // otro día
    cita("d", { estado: "No Asistió", fecha: "2026-10-06" }),
    cita("e", { estado: "Cancelada", canceladaPor: "paciente", fecha: "2026-10-05" }),
  ]
  const base = { estado: "todas", origen: "todos", seguimiento: "todos", asignado: "todos", atendido: "todos", texto: "", ventana: null, diaConfirmar: "2026-10-12", idsReagendar: new Set(["d", "e"]) }
  const con = (filtro, extra = {}) => citas.filter((c) => citaPasaFiltros(c, { ...base, periodo: { filtro, desde: "", hasta: "" }, ...extra })).map((c) => c.id)

  it("'por confirmar' son las citas abiertas de ese día que aún no están confirmadas", () => {
    expect(con("confirmar")).toEqual(["a"])
  })
  it("'para reagendar' incluye canceladas y no asistidas aunque el estado esté en Todas", () => {
    expect(con("reagendar")).toEqual(["d", "e"])
  })
  it("la búsqueda mira todas las fechas e ignora el periodo; al borrarla, vuelve", () => {
    expect(con("confirmar", { texto: "paciente c" })).toEqual(["c"])
    expect(con("confirmar", { texto: "" })).toEqual(["a"])
  })
})
