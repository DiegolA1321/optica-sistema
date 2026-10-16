import { describe, it, expect } from "vitest"
import {
  esDePrueba, opticasDelNegocio, sinPruebas, ingresosDelPeriodo, porCobrarAl, serieIngresos, estadoAl, clientesDelPeriodo, serieClientes,
  saludDeOptica, saludDeLaRed, contarSalud, ultimoIngresoDe, usoDeLaRed, modulosUsadosPor, embudoLeads, filtrarActividad, contarPorTipo, tipoDeAccion,
  textoDeAccion, cambioDeAccion,
} from "./superadminNegocio"
import { rangoDePeriodo, rangoAnterior, variacion } from "./reportesPeriodo"

// "Hoy" fijo: 16 oct. 2026, 10:00 (hora de pared de Ecuador).
const HOY = new Date(2026, 9, 16, 10, 0, 0)
const HOY_ISO = "2026-10-16"
const ins = (d) => `${d}T15:00:00Z` // mediodía de Ecuador

const opticas = [
  { id: "o1", nombre: "Óptica Real Uno", activa: true, estado_pago: "al_dia", created_at: ins("2026-01-10") },
  { id: "o2", nombre: "Óptica Real Dos", activa: true, estado_pago: "vencido", created_at: ins("2026-09-20") },
  { id: "o3", nombre: "Óptica Demo", activa: true, estado_pago: "al_dia", created_at: ins("2026-02-01"), es_de_prueba: true },
  { id: "o4", nombre: "Óptica Cerrada", activa: false, estado_pago: "al_dia", created_at: ins("2026-03-01") },
]

describe("ópticas de prueba", () => {
  it("se excluyen por defecto y se pueden incluir", () => {
    expect(esDePrueba(opticas[2])).toBe(true)
    expect(opticasDelNegocio(opticas).map((o) => o.id)).toEqual(["o1", "o2", "o4"])
    expect(opticasDelNegocio(opticas, true)).toHaveLength(4)
  })
  it("sinPruebas quita lo de una óptica de prueba y conserva lo que no es de ninguna óptica", () => {
    const items = [{ id: 1, optica_id: "o1" }, { id: 2, optica_id: "o3" }, { id: 3, optica_id: null }]
    expect(sinPruebas(items, opticas).map((x) => x.id)).toEqual([1, 3])
    expect(sinPruebas(items, opticas, true)).toHaveLength(3)
  })
})

describe("ingresos y comparación con el período anterior", () => {
  const facturas = [
    { id: "f1", optica_id: "o1", monto: "30", estado: "pagada", emitida_at: ins("2026-10-02"), pagada_at: ins("2026-10-05") },
    { id: "f2", optica_id: "o2", monto: "30", estado: "pendiente", emitida_at: ins("2026-10-03"), pagada_at: null },
    { id: "f3", optica_id: "o1", monto: "30", estado: "pagada", emitida_at: ins("2026-09-02"), pagada_at: ins("2026-09-04") },
    { id: "f4", optica_id: "o2", monto: "30", estado: "pendiente", emitida_at: ins("2026-08-20"), pagada_at: null },
  ]
  const rango = rangoDePeriodo("mes", {}, HOY)
  const previo = rangoAnterior("mes", rango, HOY)
  it("lo facturado y lo cobrado del período y del anterior equivalente (1–16 contra 1–16)", () => {
    const a = ingresosDelPeriodo(facturas, rango), p = ingresosDelPeriodo(facturas, previo)
    expect([a.facturado, a.cobrado]).toEqual([60, 30])
    expect([p.facturado, p.cobrado]).toEqual([30, 30])
    expect(variacion(a.facturado, p.facturado, { baseMinima: 100 })).toMatchObject({ tono: "bueno", flecha: "↑" })
  })
  it("por cobrar y vencidas (más de 30 días) al cierre de cada día", () => {
    const hoy = porCobrarAl(facturas, HOY_ISO)
    expect(hoy.pendientes.map((f) => f.id)).toEqual(["f2", "f4"])
    expect(hoy.vencidas.map((f) => f.id)).toEqual(["f4"])
    expect(hoy.monto).toBe(60)
    expect(porCobrarAl(facturas, "2026-09-30").pendientes.map((f) => f.id)).toEqual(["f4"])
    expect(porCobrarAl(facturas, "2026-10-04").pendientes.map((f) => f.id)).toContain("f1")
  })
  it("la serie de 12 meses termina en el mes en curso", () => {
    const s = serieIngresos(facturas, HOY)
    expect(s).toHaveLength(12)
    expect(s[11].facturado).toBe(60)
    expect(s[10].cobrado).toBe(30)
  })
})

describe("clientes: el estado de cada óptica en una fecha", () => {
  const eventos = [
    { optica_id: "o4", accion: "suspender_optica", created_at: ins("2026-10-10") },
    { optica_id: "o1", accion: "suspender_optica", created_at: ins("2026-06-01") },
    { optica_id: "o1", accion: "reactivar_optica", created_at: ins("2026-06-15") },
  ]
  it("deshace las suspensiones y reactivaciones posteriores", () => {
    expect(estadoAl(opticas[3], HOY_ISO, eventos)).toBe("suspendida")
    expect(estadoAl(opticas[3], "2026-10-09", eventos)).toBe("activa")
    expect(estadoAl(opticas[0], "2026-06-10", eventos)).toBe("suspendida")
    expect(estadoAl(opticas[0], "2026-07-01", eventos)).toBe("activa")
    expect(estadoAl(opticas[1], "2026-09-01", eventos)).toBe("inexistente")
  })
  it("activas, nuevas, suspendidas y dadas de baja del período, contra el período anterior", () => {
    const sin = opticasDelNegocio(opticas)
    const rango = rangoDePeriodo("mes", {}, HOY)
    const previo = rangoAnterior("mes", rango, HOY)
    const a = clientesDelPeriodo(sin, eventos, rango), p = clientesDelPeriodo(sin, eventos, previo)
    expect(a.activas.map((o) => o.id)).toEqual(["o1", "o2"])
    expect(a.suspendidas.map((o) => o.id)).toEqual(["o4"])
    expect(a.bajas.map((o) => o.id)).toEqual(["o4"])
    expect(a.nuevas).toHaveLength(0)
    expect(p.activas.map((o) => o.id)).toEqual(["o1", "o4"])
    expect(p.bajas).toHaveLength(0)
    // septiembre entero: nació Óptica Real Dos
    const sept = clientesDelPeriodo(sin, eventos, rangoDePeriodo("mesPasado", {}, HOY))
    expect(sept.nuevas.map((o) => o.id)).toEqual(["o2"])
  })
  it("la serie de 12 meses cuenta las activas al cierre de cada mes", () => {
    const s = serieClientes(opticasDelNegocio(opticas), eventos, HOY)
    expect(s).toHaveLength(12)
    expect(s[11].activas.map((o) => o.id)).toEqual(["o1", "o2"])
    expect(s[10].activas.map((o) => o.id)).toEqual(["o1", "o2", "o4"])
  })
})

describe("salud de cada óptica", () => {
  const hoy = HOY_ISO
  const personas = [{ optica_id: "o1", activo: true, ultimo_ingreso: ins("2026-10-15") }, { optica_id: "o2", activo: true, ultimo_ingreso: ins("2026-09-01") }, { optica_id: "o1", activo: false, ultimo_ingreso: ins("2026-10-16") }]
  const uso = [{ optica_id: "o1", citas: 10, consultas: 6, ventas: 4 }, { optica_id: "o2", citas: 0, consultas: 0, ventas: 0 }]
  it("el último ingreso ignora a quien está desactivado", () => {
    expect(ultimoIngresoDe("o1", personas)).toBe("2026-10-15")
    expect(ultimoIngresoDe("o9", personas)).toBe("")
  })
  it("una óptica al día, con uso y sin consultas abiertas es saludable", () => {
    const s = saludDeOptica({ optica: opticas[0], personas, uso: uso[0], facturas: [], consultas: [], hoyISO: hoy })
    expect(s.estado).toBe("saludable")
    expect(s.motivos).toEqual([])
    expect(s.usoTotal).toBe(20)
  })
  it("el pago vencido, sin uso y sin ingresar la ponen en riesgo y dice cada motivo", () => {
    const s = saludDeOptica({ optica: opticas[1], personas, uso: uso[1], facturas: [], consultas: [], hoyISO: hoy })
    expect(s.estado).toBe("riesgo")
    expect(s.motivos.map((m) => m.area).sort()).toEqual(["ingreso", "pago", "uso"])
    expect(s.motivos.find((m) => m.area === "ingreso").texto).toBe("Nadie ingresa hace 45 días")
  })
  it("los umbrales de ingreso: 8 días es atención, 31 es riesgo, 6 está bien", () => {
    const base = { optica: opticas[0], uso: uso[0], facturas: [], consultas: [], hoyISO: hoy }
    const con = (d) => saludDeOptica({ ...base, personas: [{ optica_id: "o1", ultimo_ingreso: ins(d) }] })
    expect(con("2026-10-08").estado).toBe("atencion")
    expect(con("2026-09-15").estado).toBe("riesgo")
    expect(con("2026-10-10").estado).toBe("saludable")
  })
  it("el pago pendiente es atención", () => {
    const s = saludDeOptica({ optica: { ...opticas[0], estado_pago: "pendiente" }, personas, uso: uso[0], facturas: [], consultas: [], hoyISO: hoy })
    expect(s.estado).toBe("atencion")
  })
  it("soporte: una abierta es atención, una urgente o tres abiertas es riesgo; las resueltas no cuentan", () => {
    const c = (id, estado, urgencia = "normal") => ({ id, opticaId: "o1", estado, urgencia })
    const base = { optica: opticas[0], personas, uso: uso[0], facturas: [], hoyISO: hoy }
    expect(saludDeOptica({ ...base, consultas: [c(1, "recibida")] }).estado).toBe("atencion")
    expect(saludDeOptica({ ...base, consultas: [c(1, "resuelta"), c(2, "resuelta", "urgente")] }).estado).toBe("saludable")
    expect(saludDeOptica({ ...base, consultas: [c(1, "recibida", "urgente")] }).estado).toBe("riesgo")
    expect(saludDeOptica({ ...base, consultas: [c(1, "recibida"), c(2, "en_revision"), c(3, "respondida")] }).estado).toBe("riesgo")
  })
  it("sin datos del servidor no inventa uso ni ingreso", () => {
    const s = saludDeOptica({ optica: opticas[0], personas: [], uso: null, facturas: [], consultas: [], hoyISO: hoy })
    expect(s.estado).toBe("saludable")
    expect(s.usoTotal).toBeNull()
  })
  it("la red: solo ópticas activas, en riesgo primero, y los conteos suman", () => {
    const filas = saludDeLaRed({ opticas: opticasDelNegocio(opticas), personas, uso, facturas: [], consultas: [], hoyISO: hoy })
    expect(filas.map((f) => f.optica.id)).toEqual(["o2", "o1"])
    expect(contarSalud(filas)).toEqual({ riesgo: 1, atencion: 0, saludable: 1 })
  })
})

describe("uso del sistema", () => {
  const uso = [
    { optica_id: "o1", citas: 10, consultas: 6, ventas: 4, personas_activas: 3, previo: { citas: 8, consultas: 6, ventas: 5, personas_activas: 2 }, modulos: { citas: 9, ventas: 2 } },
    { optica_id: "o3", citas: 99, consultas: 99, ventas: 99, personas_activas: 9, previo: {}, modulos: { citas: 50 } },
  ]
  it("suma solo las ópticas dadas (las de prueba quedan fuera) y compara con los 30 días anteriores", () => {
    const u = usoDeLaRed(uso, new Set(["o1", "o2"]))
    expect([u.personas, u.personasPrevio, u.citas, u.citasPrevio, u.ventas, u.ventasPrevio]).toEqual([3, 2, 10, 8, 4, 5])
    expect(u.porModulo.find((m) => m.id === "citas").acciones).toBe(9)
    expect(u.porModulo.find((m) => m.id === "crm").acciones).toBe(0)
  })
  it("los módulos que usó una óptica", () => {
    expect(modulosUsadosPor(uso[0]).map((m) => m.id)).toEqual(["citas", "ventas"])
    expect(modulosUsadosPor(null)).toEqual([])
  })
})

describe("leads: el mismo conteo que la sección Leads", () => {
  const leads = [
    { id: 1, estado: "nuevo", created_at: ins("2026-10-03") }, { id: 2, estado: "convertido", created_at: ins("2026-10-04") },
    { id: 3, estado: "convertido", created_at: ins("2026-09-04") }, { id: 4, estado: "descartado", created_at: ins("2026-10-10") },
  ]
  it("recibidos, convertidos y tasa del período", () => {
    const e = embudoLeads(leads, rangoDePeriodo("mes", {}, HOY))
    expect([e.recibidos.length, e.convertidos.length, e.tasa]).toEqual([3, 1, 33])
    expect(embudoLeads(leads, rangoDePeriodo("anio", {}, HOY)).recibidos.length).toBe(leads.length)
  })
})

describe("actividad: tipos, filtros y exclusión de las ópticas de prueba", () => {
  const act = [
    { id: 1, accion: "crear_optica", actor_id: "s1", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Real Uno", created_at: ins("2026-10-14") },
    { id: 2, accion: "entrar_como_optica", actor_id: "s1", actor_nombre: "Diego", optica_id: "o3", optica_nombre: "Óptica Demo", created_at: ins("2026-10-15") },
    { id: 3, accion: "publicar_anuncio", actor_id: "s2", actor_nombre: "Ana", optica_id: null, optica_nombre: "Todas las ópticas", detalle: "Mantenimiento", created_at: ins("2026-10-15") },
    { id: 4, accion: "actualizar_pago", actor_id: "s1", actor_nombre: "Diego", optica_id: "o2", optica_nombre: "Óptica Real Dos", antes: "pendiente", despues: "vencido", created_at: ins("2026-09-01") },
  ]
  it("cada acción pertenece a un tipo", () => {
    expect(["crear_optica", "entrar_como_optica", "responder_mensaje", "generar_factura", "publicar_anuncio", "crear_superadmin", "cambiar_estado_lead"].map(tipoDeAccion)).toEqual(["opticas", "accesos", "soporte", "pagos", "avisos", "superadmins", "leads"])
    expect(tipoDeAccion("otra")).toBe("otros")
  })
  it("por defecto no muestra lo de las ópticas de prueba; con el interruptor sí", () => {
    expect(filtrarActividad(act, { opticas }).map((a) => a.id)).toEqual([1, 3, 4])
    expect(filtrarActividad(act, { opticas, incluirPrueba: true })).toHaveLength(4)
  })
  it("filtra por tipo, período, óptica, persona y búsqueda", () => {
    expect(filtrarActividad(act, { opticas, tipo: "pagos" }).map((a) => a.id)).toEqual([4])
    expect(filtrarActividad(act, { opticas, rango: { inicio: "2026-10-01", fin: "2026-10-31" } }).map((a) => a.id)).toEqual([1, 3])
    expect(filtrarActividad(act, { opticas, opticaId: "o2" }).map((a) => a.id)).toEqual([4])
    expect(filtrarActividad(act, { opticas, actorId: "s2" }).map((a) => a.id)).toEqual([3])
    expect(filtrarActividad(act, { opticas, busqueda: "mantenimiento" }).map((a) => a.id)).toEqual([3])
  })
  it("el número de cada pestaña respeta los demás filtros y los tipos suman 'Todas'", () => {
    const n = contarPorTipo(act, { opticas })
    expect(n).toMatchObject({ todas: 3, opticas: 1, accesos: 0, avisos: 1, pagos: 1 })
    const suma = ["opticas", "accesos", "soporte", "pagos", "avisos", "superadmins", "leads"].reduce((s, k) => s + n[k], 0)
    expect(suma).toBe(n.todas)
    expect(contarPorTipo(act, { opticas, incluirPrueba: true }).accesos).toBe(1)
  })
  it("la frase y el cambio de una acción", () => {
    expect(textoDeAccion(act[0])).toBe("creó la óptica Óptica Real Uno")
    expect(textoDeAccion(act[3])).toBe("marcó el pago de Óptica Real Dos como vencido")
    expect(cambioDeAccion(act[3])).toEqual({ campo: "Estado del pago", antes: "pendiente", despues: "vencido" })
    expect(cambioDeAccion({ accion: "suspender_optica" })).toEqual({ campo: "Estado", antes: "Activa", despues: "Suspendida" })
    expect(cambioDeAccion(act[0])).toBeNull()
  })
})
