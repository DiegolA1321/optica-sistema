import { describe, it, expect } from "vitest"
import { FILTROS_LISTA, conjuntosLista, conteosLista, cumpleFiltroLista, proximaCitaPorPaciente, etiquetaEstadoClinico } from "./listaPacientes"
import { esInactivo } from "./fidelizacion"
import { pacientesSinAtender } from "./inicio"
import { saldosPorPaciente } from "./saldosVentas"
import { hoyISO, fechaAISO, isoAFechaLocal } from "./disponibilidad"

const hoy = hoyISO()
const dias = (n) => { const d = isoAFechaLocal(hoy); d.setDate(d.getDate() + n); return fechaAISO(d) }
const paciente = (id, extra = {}) => ({ id, nombre: `Paciente ${id}`, fechaRegistro: dias(-100), estadoClinico: "Activo", ...extra })
const consulta = (pacienteId, fecha, extra = {}) => ({ id: `k-${pacienteId}-${fecha}`, pacienteId, fecha, creadoEn: `${fecha}T10:00:00Z`, ...extra })
const factura = (id, pacienteId, montoTotal) => ({ id, pacienteId, estado: "pendiente_pago", montoTotal, creadoEn: `${dias(-3)}T10:00:00Z` })

const pacientes = [
  paciente("nuevo", { fechaRegistro: hoy }),
  paciente("viejo-con-consulta"),
  paciente("vencido"),
  paciente("saldo"),
  paciente("alta", { estadoClinico: "De alta" }),
  paciente("sin-consulta"),
]
const consultas = [
  consulta("viejo-con-consulta", dias(-30)),
  consulta("vencido", dias(-900), { proximoControl: dias(-300) }),
  consulta("saldo", dias(-20)),
  consulta("alta", dias(-800)),
]
const facturas = [factura("f1", "saldo", 80), factura("f2", "saldo", 20)]

describe("los filtros de la lista", () => {
  const conjuntos = conjuntosLista({ pacientes, consultas, facturas })
  const n = conteosLista(pacientes, conjuntos)

  it("son los seis que sirven, en orden, cada uno con su explicación", () => {
    expect(FILTROS_LISTA.map((f) => f.etiqueta)).toEqual(["Todos", "Nuevos este mes", "Control vencido", "Con saldo pendiente", "Sin consulta", "Dados de alta"])
    expect(FILTROS_LISTA.every((f) => f.ayuda.length > 20)).toBe(true)
  })
  it("Todos es el total de pacientes", () => {
    expect(n.Todos).toBe(pacientes.length)
  })
  it("Nuevos este mes: los registrados en el mes en curso", () => {
    expect([...conjuntos.NuevosMes]).toContain("nuevo")
    expect(n.NuevosMes).toBe(pacientes.filter((p) => cumpleFiltroLista(p, "NuevosMes", conjuntos)).length)
  })
  it("Control vencido cuenta igual que el Inicio y Reportes (esInactivo)", () => {
    expect(n.ControlVencido).toBe(pacientes.filter((p) => esInactivo(p, consultas)).length)
    expect(conjuntos.ControlVencido.has("vencido")).toBe(true)
    expect(conjuntos.ControlVencido.has("alta")).toBe(false) // el tratamiento finalizado no tiene control pendiente
  })
  it("Con saldo pendiente cuenta igual que Ventas (saldosPorPaciente)", () => {
    expect(n.ConSaldo).toBe(saldosPorPaciente({ pacientes, facturas, abonos: [], ventas: [] }).length)
    expect([...conjuntos.ConSaldo]).toEqual(["saldo"])
  })
  it("Sin consulta cuenta igual que el Inicio (pacientesSinAtender)", () => {
    expect(n.SinConsulta).toBe(pacientesSinAtender(pacientes, consultas).length)
    expect(conjuntos.SinConsulta.has("sin-consulta")).toBe(true)
    expect(conjuntos.SinConsulta.has("saldo")).toBe(false)
  })
  it("Dados de alta: los que tienen el tratamiento finalizado", () => {
    expect([...conjuntos.DadosDeAlta]).toEqual(["alta"])
  })
  it("el número de cada filtro es el de filas que deja en la lista (regla 5)", () => {
    for (const f of FILTROS_LISTA) expect(pacientes.filter((p) => cumpleFiltroLista(p, f.id, conjuntos)).length, f.id).toBe(n[f.id])
  })
  it("un filtro que no existe (ya quitado) no oculta a nadie", () => {
    expect(cumpleFiltroLista(pacientes[0], "Recientes", conjuntos)).toBe(true)
  })
})

describe("etiquetaEstadoClinico", () => {
  it("«De alta» se lee «Tratamiento finalizado»; lo demás no cambia", () => {
    expect(etiquetaEstadoClinico("De alta")).toBe("Tratamiento finalizado")
    expect(etiquetaEstadoClinico("Activo")).toBe("Activo")
  })
})

describe("la próxima cita de cada paciente", () => {
  const cita = (id, pacienteId, fecha, hora, estado = "Pendiente") => ({ id, pacienteId, fecha, hora, estado })
  it("es la más cercana que sigue en pie desde hoy, con la hora real (PM después de AM)", () => {
    const mapa = proximaCitaPorPaciente([
      cita("a", "p1", dias(5), "09:00 AM"), cita("b", "p1", dias(2), "04:00 PM"), cita("c", "p1", dias(2), "09:30 AM"),
      cita("d", "p1", dias(-1), "09:00 AM"), cita("e", "p1", dias(1), "09:00 AM", "Cancelada"), cita("f", "p2", dias(3), "10:00 AM", "Atendida"),
    ], hoy)
    expect(mapa.get("p1").id).toBe("c")
    expect(mapa.has("p2")).toBe(false)
  })
  it("una atención abierta hoy cuenta; una de ayer, no", () => {
    const mapa = proximaCitaPorPaciente([cita("x", "p1", hoy, "09:00 AM", "En Atención"), cita("y", "p2", dias(-1), "09:00 AM", "En Atención")], hoy)
    expect(mapa.get("p1").id).toBe("x")
    expect(mapa.has("p2")).toBe(false)
  })
})
