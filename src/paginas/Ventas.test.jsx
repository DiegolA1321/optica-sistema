import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Ventas from "./Ventas"
import { ordenesAbiertas } from "../utilidades/ordenesLaboratorio"
import { hoyISO } from "../utilidades/disponibilidad"

const pacientes = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101", telefono: "0990000001" }, { id: "p2", nombre: "Luis Mora", cedula: "0202020202", telefono: "0990000002" }]
const factura = (id, extra = {}) => ({ id, pacienteId: "p1", numero: 1, estado: "pagada", metodoPago: "directo", montoTotal: 80, creadoEn: "2026-10-05T10:00:00Z", lineas: [{ id: "l1", tipo: "luna", descripcion: "Luna: Monofocal", cantidad: 1, precioUnitario: 80, detalle: { tipo_lente: "monofocal", filtro_azul: true } }], ...extra })
const base = {
  usuario: { rol: "admin", opticaId: "o1", nombre: "Admin" }, pacientes, facturasVenta: [], pases: [], ordenesLab: [], abonos: [], equipo: [],
}
// Un destino pedido desde otro módulo; `periodo: "todo"` deja la lista en «Todas las fechas» (las pruebas no dependen de en qué mes se corren).
const ir = (tab, extra = {}) => ({ accionInicial: { tab, periodo: "todo", ...extra }, onAccionInicialConsumida: () => {} })
const tabla = () => screen.getByRole("list", { name: "Ventas" })
const filas = () => within(tabla()).getAllByRole("listitem")
const dato = (nombre) => screen.getByRole("button", { name: new RegExp(`^${nombre}`) })

beforeEach(() => { window.history.replaceState({}, "", "/") })

describe("Ventas — estructura", () => {
  it("solo hay dos pestañas, «Ventas» (la de siempre) y «Pedidos de lentes», con su número, y «Nueva venta» a la derecha", () => {
    render(<Ventas {...base} />)
    expect(screen.getByRole("heading", { level: 1, name: "Ventas" })).toBeInTheDocument()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent.replace(/\d+$/, "").trim())
    expect(tabs).toEqual(["Ventas", "Pedidos de lentes"])
    expect(screen.getByRole("tab", { name: /^Ventas/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("button", { name: /Nueva venta/i })[0]).toBeInTheDocument()
    for (const viejo of [/Por vender/, /Comprobantes/, /Cobros y saldos/, /Órdenes de laboratorio/]) expect(screen.queryByRole("tab", { name: viejo })).not.toBeInTheDocument()
  })

  it("sin ventas ni pedidos, cada pestaña dice qué pasa y qué hacer", () => {
    render(<Ventas {...base} />)
    expect(screen.getByText(/Todavía no hay ventas registradas/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar la primera venta/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: /Pedidos de lentes/ }))
    expect(screen.getByText(/Todavía no hay pedidos de lentes/i)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nueva venta/i }).length).toBeGreaterThan(1)
  })

  it("los enlaces de antes (cola, comprobantes, saldos, órdenes) llegan a su pestaña nueva", () => {
    for (const [antes, tab] of [["cola", /^Ventas/], ["porvender", /^Ventas/], ["comprobantes", /^Ventas/], ["cobros", /^Ventas/], ["ordenes", /Pedidos de lentes/]]) {
      window.history.replaceState({}, "", "/")
      const { unmount } = render(<Ventas {...base} {...ir(antes)} />)
      expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true")
      unmount()
    }
  })

  it("«Cobros y saldos» de antes llega a la lista con el dato «Por cobrar» puesto", () => {
    const f = [factura("a"), factura("b", { numero: 2, estado: "pendiente_pago", montoTotal: 100 })]
    render(<Ventas {...base} facturasVenta={f} {...ir("cobros")} />)
    expect(filas()).toHaveLength(1)
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
  })
})

describe("Ventas — la lista y su franja de datos", () => {
  const hoyIso = `${hoyISO()}T15:00:00Z`
  const facturas = [
    factura("a", { numero: 1, facturaElectronica: "001-001-000000123", pagos: [{ metodo: "efectivo", monto: 80 }] }),
    factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100, creadoEn: hoyIso, lineas: [{ id: "l2", tipo: "producto", descripcion: "Estuche", cantidad: 1, precioUnitario: 40 }, { id: "l3", tipo: "producto", descripcion: "Líquido", cantidad: 1, precioUnitario: 60 }] }),
    factura("c", { numero: 3, estado: "anulada" }),
  ]
  const abonos = [{ id: "x", facturaId: "b", monto: 30, fecha: hoyISO(), creadoEn: hoyIso, pagos: [{ metodo: "tarjeta", monto: 30 }] }]
  const verificar = [{ id: "t1", facturaId: "b", monto: 30, pacienteNombre: "Luis Mora", facturaNumero: 2, creadoEn: hoyIso }]

  it("cada fila trae fecha, paciente con su comprobante, detalle, total, pagado y estado del pago; la anulada no sale", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    expect(filas()).toHaveLength(2)
    expect(screen.queryByText("CV-0003")).not.toBeInTheDocument()
    const a = filas().find((li) => li.textContent.includes("CV-0001"))
    expect(a).toHaveTextContent("Ana Prueba")
    expect(a).toHaveTextContent("Lentes monofocales")
    expect(a).toHaveTextContent("lunas filtro azul")
    expect(a).toHaveTextContent("Pagada")
    const b = filas().find((li) => li.textContent.includes("CV-0002"))
    expect(b).toHaveTextContent("Estuche y Líquido")
    expect(b).toHaveTextContent("2 productos")
    expect(b).toHaveTextContent("$100.00")
    expect(b).toHaveTextContent("$30.00")
    expect(b).toHaveTextContent("Debe $70.00")
    expect(screen.getByRole("tab", { name: /^Ventas/ })).toHaveTextContent("2") // sin la anulada
  })

  it("la franja suma lo que se ve: vendido = cobrado + por cobrar", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    const franja = screen.getByRole("list", { name: "Resumen de las ventas" })
    expect(within(franja).getByRole("button", { name: /^Vendido/ })).toHaveTextContent("$180.00")
    expect(within(franja).getByRole("button", { name: /^Vendido/ })).toHaveTextContent("2 ventas")
    expect(within(franja).getByRole("button", { name: /^Cobrado/ })).toHaveTextContent("$110.00")
    expect(within(franja).getByRole("button", { name: /^Por cobrar/ })).toHaveTextContent("$70.00")
    expect(within(franja).getByRole("button", { name: /^Por cobrar/ })).toHaveTextContent("1 venta con saldo")
  })

  it("cada dato filtra la lista al pulsarlo, con el filtro a la vista y fácil de quitar", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    fireEvent.click(dato("Por cobrar"))
    expect(filas()).toHaveLength(1)
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    expect(dato("Por cobrar")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("status")).toHaveTextContent(/Por cobrar/)
    fireEvent.click(screen.getByRole("button", { name: /Quitar el filtro/ }))
    expect(filas()).toHaveLength(2)
    fireEvent.click(dato("Cobrado"))
    expect(filas()).toHaveLength(1)
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    fireEvent.click(dato("Vendido")) // «ver todas»
    expect(filas()).toHaveLength(2)
  })

  it("un pago por verificar se ve en la franja, en la fila («Verificar $30.00») y en el detalle, con «Revisar»", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} pagosPorVerificar={verificar} {...ir("ventas")} />)
    expect(dato("Pago por verificar")).toHaveTextContent("$30.00")
    expect(dato("Pago por verificar")).toHaveTextContent("1 transferencia")
    expect(filas().find((li) => li.textContent.includes("CV-0002"))).toHaveTextContent("Verificar $30.00")
    fireEvent.click(dato("Pago por verificar"))
    expect(filas()).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: /Ver la venta CV-0002/ }))
    const d = screen.getByRole("dialog", { name: "Venta CV-0002" })
    expect(within(d).getByText("Pago por verificar")).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: "Revisar" })).toBeInTheDocument()
  })

  it("«Lentes en el laboratorio» lleva a Pedidos de lentes con ese filtro", () => {
    const ordenes = [{ id: "o1", numero: 1, pacienteId: "p1", estado: "enviada", fechaPrometida: "2099-01-01", laboratorio: "Lab A", facturaId: "a" }, { id: "o2", numero: 2, pacienteId: "p2", estado: "lista", fechaPrometida: "2099-01-01", laboratorio: "Lab B", facturaId: "b" }]
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} ordenesLab={ordenes} {...ir("ventas")} />)
    expect(dato("Lentes en el laboratorio")).toHaveTextContent("1")
    fireEvent.click(dato("Lentes en el laboratorio"))
    expect(screen.getByRole("tab", { name: /Pedidos de lentes/ })).toHaveAttribute("aria-selected", "true")
    expect(within(screen.getByRole("list", { name: "Pedidos de lentes" })).getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("En el laboratorio")
  })

  it("«Filtrar» ofrece las ventas anuladas y la forma de pago", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    const panel = screen.getByRole("dialog", { name: "Filtrar" })
    fireEvent.click(within(panel).getByRole("button", { name: "Con anuladas" }))
    expect(screen.getByText("CV-0003")).toBeInTheDocument()
    expect(screen.getByText("Anulada")).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole("button", { name: "Con anuladas" })) // un clic más lo quita
    fireEvent.click(within(panel).getByRole("button", { name: "Tarjeta" }))
    expect(filas()).toHaveLength(1)
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
  })

  it("busca por paciente, CV, cédula y factura electrónica, y el selector dice que mira todas las fechas", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} />) // abre en «Este mes»
    expect(screen.getByRole("button", { name: "Período de las ventas" })).toHaveTextContent("Este mes")
    fireEvent.change(screen.getByLabelText("Buscar paciente o comprobante"), { target: { value: "000000123" } })
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    expect(screen.queryByText("CV-0002")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Período de las ventas" })).toHaveTextContent("Todas las fechas")
    fireEvent.change(screen.getByLabelText("Buscar paciente o comprobante"), { target: { value: "0202" } })
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Buscar paciente o comprobante"), { target: { value: "zzz" } })
    expect(screen.getByText(/Ninguna venta coincide con la búsqueda/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Quitar filtros" })).toBeInTheDocument()
  })

  it("el período abre en «Este mes» y se cambia a Hoy, Esta semana o Elegir fechas; lo vacío ofrece ver todas las fechas", () => {
    const dosEpocas = [factura("a", { creadoEn: "2020-01-05T10:00:00Z" }), facturas[1]]
    render(<Ventas {...base} facturasVenta={dosEpocas} abonos={abonos} />)
    expect(filas()).toHaveLength(1) // solo la de este mes: la de 2020 cae fuera
    fireEvent.click(screen.getByRole("button", { name: "Período de las ventas" }))
    const menu = screen.getByRole("menu", { name: "Período de las ventas" })
    for (const o of ["Hoy", "Esta semana", "Este mes", "Elegir fechas"]) expect(within(menu).getByRole("menuitemradio", { name: new RegExp(o) })).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Hoy" }))
    expect(screen.getByRole("button", { name: "Período de las ventas" })).toHaveTextContent("Hoy")
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
  })

  it("sin ventas en el período dice qué hacer", () => {
    render(<Ventas {...base} facturasVenta={[factura("a", { creadoEn: "2020-01-05T10:00:00Z" })]} />)
    expect(screen.getByText(/No hay ventas en este período/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las fechas" }))
    expect(filas()).toHaveLength(1)
  })

  it("pulsar una venta abre su detalle completo: líneas, abonos con su método, saldo, estado de los lentes y sus acciones", () => {
    const ordenes = [{ id: "o2", numero: 2, pacienteId: "p2", estado: "lista", fechaPrometida: "2099-01-01", laboratorio: "Lab B", facturaId: "b", tipoLente: "progresivo" }]
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} ordenesLab={ordenes} {...ir("ventas")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver la venta CV-0002 de Luis Mora/ }))
    const d = screen.getByRole("dialog", { name: "Venta CV-0002" })
    expect(within(d).getByText("Estuche")).toBeInTheDocument()
    expect(within(d).getByText("Tarjeta")).toBeInTheDocument()
    expect(within(d).getByText("Saldo")).toBeInTheDocument()
    expect(within(d).getByText("Estado de los lentes")).toBeInTheDocument()
    expect(within(d).getByText("Listo · sin avisar")).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Imprimir comprobante/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Anular venta/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Corregir el abono de \$30\.00/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: "Registrar abono" })).toBeInTheDocument()
  })

  it("quien no puede editar no corrige ni registra abonos; quien no puede eliminar no anula", () => {
    const usuario = { rol: "asistente", opticaId: "o1", permisosNivel: { ventas: ["ver", "crear"] } }
    render(<Ventas {...base} usuario={usuario} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver la venta CV-0002/ }))
    const d = screen.getByRole("dialog", { name: "Venta CV-0002" })
    expect(within(d).queryByRole("button", { name: /Corregir/ })).not.toBeInTheDocument()
    expect(within(d).queryByRole("button", { name: "Registrar abono" })).not.toBeInTheDocument()
    expect(within(d).queryByRole("button", { name: /Anular venta/ })).not.toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Imprimir comprobante/ })).toBeInTheDocument()
  })

  it("sin permiso de crear no ofrece «Nueva venta»", () => {
    const usuario = { rol: "asistente", opticaId: "o1", permisosNivel: { ventas: ["ver"] } }
    render(<Ventas {...base} usuario={usuario} facturasVenta={facturas} abonos={abonos} {...ir("ventas")} />)
    expect(screen.queryByRole("button", { name: /Nueva venta/i })).not.toBeInTheDocument()
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
  })
})

describe("Ventas — Pedidos de lentes", () => {
  const ordenes = [
    { id: "o1", numero: 1, pacienteId: "p1", estado: "enviada", fechaPrometida: "2020-01-01", laboratorio: "Lab A", facturaId: "a", tipoLente: "progresivo" },
    { id: "o2", numero: 2, pacienteId: "p2", estado: "lista", fechaPrometida: "2099-01-01", laboratorio: "Lab B", facturaId: "b", tipoLente: "monofocal" },
    { id: "o3", numero: 3, pacienteId: "p1", estado: "entregada", fechaPrometida: "2099-01-01", laboratorio: "Lab A", facturaId: "a", tipoLente: "bifocal" },
    { id: "o4", numero: 4, pacienteId: "p2", estado: "lista", fechaPrometida: "2099-01-01", laboratorio: "Lab B", facturaId: "b", pacienteAvisadoEn: "2026-10-01T10:00:00Z" },
  ]
  const facturas = [factura("a"), factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100 })]
  const lista = () => screen.getByRole("list", { name: "Pedidos de lentes" })
  const pedidos = () => within(lista()).getAllByRole("listitem")

  it("el número de la pestaña son los pedidos en curso y la lista arranca en «En curso»", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    expect(screen.getByRole("tab", { name: /Pedidos de lentes/ })).toHaveTextContent(String(ordenesAbiertas(ordenes).length))
    expect(screen.getByRole("button", { name: /^En curso/ })).toHaveAttribute("aria-pressed", "true")
    expect(pedidos()).toHaveLength(3)
    expect(screen.queryByText("OL-0003")).not.toBeInTheDocument()
  })

  it("cada fila trae pedido, paciente con sus lentes, laboratorio, fecha prometida, estado y UNA acción según el momento", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    const de = (n) => pedidos().find((li) => li.textContent.includes(n))
    const [atrasado, sinAvisar, avisado] = [de("OL-0001"), de("OL-0002"), de("OL-0004")]
    expect(atrasado).toHaveTextContent("OL-0001")
    expect(atrasado).toHaveTextContent("Ana Prueba")
    expect(atrasado).toHaveTextContent("Lentes progresivos")
    expect(atrasado).toHaveTextContent("Lab A")
    expect(atrasado).toHaveTextContent(/Atrasado \d+ días/)
    expect(within(atrasado).getByRole("button", { name: "Marcar listo" })).toBeInTheDocument()
    expect(sinAvisar).toHaveTextContent("Listo · sin avisar")
    expect(within(sinAvisar).getByRole("button", { name: "Contactar" })).toBeInTheDocument()
    expect(avisado).toHaveTextContent("Listo · avisado")
    expect(within(avisado).getByRole("button", { name: "Entregar" })).toBeInTheDocument()
    for (const li of [atrasado, sinAvisar, avisado]) expect(within(li).queryByRole("button", { name: /Imprimir|Editar|Otro pedido|Volver/ })).not.toBeInTheDocument()
  })

  it("los filtros son En curso, Atrasados, Listos sin avisar, Entregados y Todos, con el número de lo que listan", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    const grupo = screen.getByRole("group", { name: "Estado de los pedidos" })
    expect(within(grupo).getAllByRole("button").map((b) => b.textContent.replace(/\s+/g, " ").trim())).toEqual(["En curso", "Atrasados · 1", "Listos sin avisar · 1", "Entregados", "Todos"])
    fireEvent.click(within(grupo).getByRole("button", { name: /Atrasados/ }))
    expect(pedidos()).toHaveLength(1)
    fireEvent.click(within(grupo).getByRole("button", { name: /Listos sin avisar/ }))
    expect(pedidos()).toHaveLength(1)
    expect(screen.getByText("OL-0002")).toBeInTheDocument()
    fireEvent.click(within(grupo).getByRole("button", { name: "Entregados" }))
    expect(screen.getByText("OL-0003")).toBeInTheDocument()
    fireEvent.click(within(grupo).getByRole("button", { name: "Todos" }))
    expect(pedidos()).toHaveLength(4)
  })

  it("se filtra por laboratorio y, sin resultados, dice qué hacer", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    fireEvent.change(screen.getByLabelText("Laboratorio"), { target: { value: "Lab B" } })
    expect(pedidos()).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: /Atrasados/ }))
    expect(screen.getByText(/Sin pedidos de Lab B con este estado/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ver los pedidos en curso" })).toBeInTheDocument()
  })

  it("llega con el filtro que pidió el Inicio, con los nombres de antes (listas) o los de ahora", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes", { filtro: "sinavisar" })} />)
    expect(screen.getByRole("button", { name: /^Listos sin avisar/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("OL-0002")).toBeInTheDocument()
    expect(screen.queryByText("OL-0001")).not.toBeInTheDocument()
  })

  it("dice dónde se administran los laboratorios", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    expect(screen.getByText("Los laboratorios se administran en Configuración → Laboratorios.")).toBeInTheDocument()
  })

  it("el detalle trae la receta, la venta relacionada, el historial y las acciones", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("pedidos")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el pedido OL-0002/ }))
    const d = screen.getByRole("dialog", { name: /Pedido de lentes OL-0002/ })
    for (const n of [/Imprimir copias/, /Editar/, /Otro pedido/, /Volver al estado anterior/]) expect(within(d).getByRole("button", { name: n })).toBeInTheDocument()
    expect(within(d).getByText("CV-0002")).toBeInTheDocument()
    expect(within(d).getByText("Receta")).toBeInTheDocument()
    expect(within(d).getByText("Historial de estados")).toBeInTheDocument()
  })
})
