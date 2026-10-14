import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Ventas from "./Ventas"
import { resumenSaldos, saldosPorPaciente, textoSaldos } from "../utilidades/saldosVentas"
import { ordenesAbiertas } from "../utilidades/ordenesLaboratorio"
import { hoyISO } from "../utilidades/disponibilidad"

const pacientes = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101", telefono: "0990000001" }, { id: "p2", nombre: "Luis Mora", cedula: "0202020202", telefono: "0990000002" }]
const factura = (id, extra = {}) => ({ id, pacienteId: "p1", numero: 1, estado: "pagada", metodoPago: "directo", montoTotal: 80, creadoEn: "2026-10-05T10:00:00Z", lineas: [{ id: "l1", tipo: "luna", descripcion: "Luna: Monofocal", cantidad: 1, precioUnitario: 80 }], facturaElectronica: "", ...extra })
const base = {
  usuario: { rol: "admin", opticaId: "o1", nombre: "Admin" }, pacientes, facturasVenta: [], pases: [], ordenesLab: [], abonos: [], equipo: [],
}
const ir = (tab, extra = {}) => ({ accionInicial: { tab, ...extra }, onAccionInicialConsumida: () => {} })

beforeEach(() => { window.history.replaceState({}, "", "/") })

describe("Ventas — estructura", () => {
  it("la cabecera solo dice Ventas, con 'Nueva venta' a la derecha, y hay cuatro pestañas con su número, en el orden de la venta", () => {
    render(<Ventas {...base} />)
    expect(screen.getByRole("heading", { level: 1, name: "Ventas" })).toBeInTheDocument()
    expect(screen.queryByText(/Pacientes por vender, comprobantes/i)).not.toBeInTheDocument()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent.replace(/\d+$/, "").trim())
    expect(tabs).toEqual(["Por vender", "Comprobantes", "Órdenes de laboratorio", "Cobros y saldos"])
    expect(screen.getByRole("tab", { name: /Por vender/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("button", { name: /Nueva venta/i })[0]).toBeInTheDocument()
  })

  it("la pestaña de los comprobantes ya no se llama como el módulo", () => {
    render(<Ventas {...base} />)
    expect(screen.queryByRole("tab", { name: /^Ventas/ })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Comprobantes/ })).toBeInTheDocument()
  })

  it("sin ventas, cada pestaña dice qué pasa y qué hacer", () => {
    render(<Ventas {...base} />)
    expect(screen.getByText(/No hay pacientes esperando para venta/i)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nueva venta/i }).length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole("tab", { name: /Comprobantes/ }))
    expect(screen.getByText(/Todavía no hay ventas registradas/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar la primera venta/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: /Órdenes de laboratorio/ }))
    expect(screen.getByText(/Todavía no hay órdenes de laboratorio/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ver los comprobantes/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: /Cobros y saldos/ }))
    expect(screen.getByText(/Hoy todavía no se ha cobrado nada/i)).toBeInTheDocument()
    expect(screen.getByText(/No hay saldos por cobrar/i)).toBeInTheDocument()
  })

  it("los enlaces de antes (tab=ventas, cola, saldos) siguen llegando a su pestaña", () => {
    const { unmount } = render(<Ventas {...base} {...ir("ventas")} />)
    expect(screen.getByRole("tab", { name: /Comprobantes/ })).toHaveAttribute("aria-selected", "true")
    unmount()
    window.history.replaceState({}, "", "/")
    render(<Ventas {...base} {...ir("saldos")} />)
    expect(screen.getByRole("tab", { name: /Cobros y saldos/ })).toHaveAttribute("aria-selected", "true")
  })
})

describe("Ventas — Por vender", () => {
  const pases = [
    { id: "ps1", pacienteId: "p1", consultaId: "c1", estado: "listo", pasadaEn: "2026-10-05T10:00:00Z", proformaEntregadaEn: "2026-10-06T10:00:00Z", proformaTotal: 85 },
    { id: "ps2", pacienteId: "p2", consultaId: "c2", estado: "listo", pasadaEn: "2026-03-05T10:00:00Z" },
    { id: "ps3", pacienteId: "p2", consultaId: "c3", estado: "descartado", pasadaEn: "2026-08-05T10:00:00Z", motivoDescarte: "precio" },
  ]
  const consultas = [
    { id: "c1", fecha: "2026-10-05", pacienteId: "p1", diagnostico: "Miopía — Corrección óptica indicada según refracción", lenteRecomendado: "Monofocal" },
    { id: "c2", fecha: "2026-03-05", pacienteId: "p2" }, { id: "c3", fecha: "2026-08-05", pacienteId: "p2" },
  ]

  it("cada fila lleva el diagnóstico y el lente en una línea, sin la frase de plantilla, y una sola acción", () => {
    render(<Ventas {...base} pases={pases} consultas={consultas} />)
    const lista = screen.getByRole("list", { name: "Pacientes por vender" })
    const fila = within(lista).getAllByRole("listitem").find((li) => li.textContent.includes("Ana Prueba"))
    expect(fila).toHaveTextContent("Miopía · Lente: Monofocal")
    expect(fila).not.toHaveTextContent(/Corrección óptica indicada/)
    expect(fila).toHaveTextContent("Proforma $85.00")
    expect(within(fila).getAllByRole("button")).toHaveLength(2) // el nombre (abre el detalle) y la acción
    expect(within(fila).getByRole("button", { name: "Tomar datos del diagnóstico" })).toBeInTheDocument()
  })

  it("el número de la pestaña es el de pacientes por vender, el mismo que cuenta el Inicio", () => {
    render(<Ventas {...base} pases={pases} consultas={consultas} />)
    expect(screen.getByRole("tab", { name: /Por vender/ })).toHaveTextContent("2")
    expect(screen.getByText("2 pacientes por vender")).toBeInTheDocument()
  })

  it("el detalle trae la proforma, 'No compró' y 'Escribir por WhatsApp'; un clic en el nombre lo abre", () => {
    render(<Ventas {...base} pases={pases} consultas={consultas} />)
    fireEvent.click(screen.getByRole("button", { name: "Ana Prueba" }))
    const d = screen.getByRole("dialog", { name: /Por vender: Ana Prueba/ })
    expect(within(d).getByText(/Entregada el .* · \$85\.00/)).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Escribir por WhatsApp/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /No compró/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: "Tomar datos del diagnóstico" })).toBeInTheDocument()
  })

  it("quien lleva más de 30 días esperando se marca, y los filtros separan con y sin proforma", () => {
    render(<Ventas {...base} pases={pases} consultas={consultas} />)
    expect(screen.getByTitle(/Lleva más de 30 días esperando/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    const panel = screen.getByRole("dialog", { name: /Filtrar los pacientes por vender/ })
    fireEvent.click(within(panel).getByRole("button", { name: "Con proforma" }))
    expect(screen.getByText("1 paciente con proforma")).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole("button", { name: "No compraron" }))
    expect(screen.getByText("1 paciente no compró")).toBeInTheDocument()
    expect(screen.getByText("Por el precio")).toBeInTheDocument()
  })

  it("se busca por nombre o cédula y, sin resultados, ofrece quitar los filtros", () => {
    render(<Ventas {...base} pases={pases} consultas={consultas} />)
    fireEvent.change(screen.getByLabelText(/Buscar paciente/), { target: { value: "0202" } })
    expect(screen.queryByText("Ana Prueba")).not.toBeInTheDocument()
    expect(screen.getByText("Luis Mora")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Buscar paciente/), { target: { value: "zzz" } })
    expect(screen.getByText(/Ningún paciente coincide con la búsqueda/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Quitar filtros" })).toBeInTheDocument()
  })

  it("sin permiso de crear no ofrece 'Nueva venta' ni las acciones, pero sí ve la lista", () => {
    const usuario = { rol: "asistente", opticaId: "o1", permisosNivel: { ventas: ["ver"] } }
    render(<Ventas {...base} usuario={usuario} pases={pases} consultas={consultas} />)
    expect(screen.queryByRole("button", { name: /Nueva venta/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tomar datos del diagnóstico/i })).not.toBeInTheDocument()
    expect(screen.getByText("Ana Prueba")).toBeInTheDocument()
  })
})

describe("Ventas — Comprobantes", () => {
  const hoyIso = `${hoyISO()}T15:00:00Z`
  const facturas = [
    factura("a", { numero: 1, facturaElectronica: "001-001-000000123", pagos: [{ metodo: "efectivo", monto: 80 }] }),
    factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100, creadoEn: hoyIso }),
    factura("c", { numero: 3, estado: "anulada" }),
  ]
  const abonos = [{ id: "x", facturaId: "b", monto: 30, fecha: hoyISO(), creadoEn: hoyIso, pagos: [{ metodo: "tarjeta", monto: 30 }] }]

  it("lista los comprobantes vigentes con estado, y la anulada solo con su filtro", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    expect(screen.getByRole("tab", { name: /Comprobantes/ })).toHaveTextContent("2") // sin la anulada, igual que el total del Inicio
    expect(screen.getByText("2 comprobantes")).toBeInTheDocument()
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    expect(screen.queryByText("CV-0003")).not.toBeInTheDocument()
    expect(screen.getByText("Con saldo $70.00")).toBeInTheDocument()
    expect(screen.getByText("Pagada")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    fireEvent.click(within(screen.getByRole("dialog", { name: /Filtrar los comprobantes/ })).getByRole("button", { name: "Anuladas" }))
    expect(screen.getByText("CV-0003")).toBeInTheDocument()
    expect(screen.getByText("Anulada")).toBeInTheDocument()
  })

  it("una fila solo lleva 'Abonar' si tiene saldo; las demás acciones están en el detalle", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    const lista = screen.getByRole("list", { name: "Comprobantes de venta" })
    expect(within(lista).getAllByRole("button", { name: "Abonar" })).toHaveLength(1)
    expect(within(lista).queryByRole("button", { name: /Anular|Otra orden|Crear orden|Corregir/ })).not.toBeInTheDocument()
  })

  it("el detalle muestra las líneas, los abonos con su método y quién, y ofrece reimprimir y anular", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el comprobante CV-0002/ }))
    const d = screen.getByRole("dialog", { name: "Comprobante CV-0002" })
    expect(within(d).getByText("Luna: Monofocal")).toBeInTheDocument()
    expect(within(d).getByText("Tarjeta")).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Imprimir comprobante/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Anular venta/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Corregir el abono de \$30\.00/ })).toBeInTheDocument()
    expect(within(d).getByRole("button", { name: "Abonar" })).toBeInTheDocument()
  })

  it("quien no puede editar no corrige abonos ni abona; quien no puede eliminar no anula", () => {
    const usuario = { rol: "asistente", opticaId: "o1", permisosNivel: { ventas: ["ver", "crear"] } }
    render(<Ventas {...base} usuario={usuario} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el comprobante CV-0002/ }))
    const d = screen.getByRole("dialog", { name: "Comprobante CV-0002" })
    expect(within(d).queryByRole("button", { name: /Corregir/ })).not.toBeInTheDocument()
    expect(within(d).queryByRole("button", { name: "Abonar" })).not.toBeInTheDocument()
    expect(within(d).queryByRole("button", { name: /Anular venta/ })).not.toBeInTheDocument()
    expect(within(d).getByRole("button", { name: /Imprimir comprobante/ })).toBeInTheDocument()
  })

  it("busca por CV, por cédula y por factura electrónica, y avisa que mira todas las fechas", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    fireEvent.change(screen.getByLabelText(/Buscar: paciente/), { target: { value: "000000123" } })
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    expect(screen.queryByText("CV-0002")).not.toBeInTheDocument()
    expect(screen.getByText(/Buscando en todas las fechas/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Buscar: paciente/), { target: { value: "0202" } })
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
  })

  it("el período es el de Citas: Hoy deja solo lo de hoy, y lo vacío ofrece ver todas las fechas", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }))
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    expect(screen.queryByText("CV-0001")).not.toBeInTheDocument()
    expect(screen.getByText("1 comprobante hoy")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Periodo anterior" }))
    expect(screen.getByText(/No hay ventas en este período/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las fechas" }))
    expect(screen.getByText("2 comprobantes")).toBeInTheDocument()
  })

  it("filtra por método de pago y por los que no tienen factura electrónica", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    const panel = screen.getByRole("dialog", { name: /Filtrar los comprobantes/ })
    fireEvent.click(within(panel).getByRole("button", { name: "Tarjeta" }))
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    expect(screen.queryByText("CV-0001")).not.toBeInTheDocument()
    fireEvent.click(within(panel).getByRole("button", { name: "Tarjeta" })) // un clic más lo quita
    fireEvent.click(within(panel).getByRole("button", { name: "Sin factura electrónica" }))
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    expect(screen.queryByText("CV-0001")).not.toBeInTheDocument()
  })
})

describe("Ventas — Órdenes de laboratorio", () => {
  const ordenes = [
    { id: "o1", numero: 1, pacienteId: "p1", estado: "enviada", fechaPrometida: "2020-01-01", laboratorio: "Lab A", facturaId: "a" },
    { id: "o2", numero: 2, pacienteId: "p2", estado: "lista", fechaPrometida: "2099-01-01", laboratorio: "Lab B", facturaId: "b" },
    { id: "o3", numero: 3, pacienteId: "p1", estado: "entregada", fechaPrometida: "2099-01-01", laboratorio: "Lab A", facturaId: "a" },
  ]
  const facturas = [factura("a"), factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100 })]

  it("el número de la pestaña son las abiertas, y cada fila dice su estado, lo que falta y UNA acción", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes")} />)
    expect(screen.getByRole("tab", { name: /Órdenes de laboratorio/ })).toHaveTextContent(String(ordenesAbiertas(ordenes).length))
    const lista = screen.getByRole("list", { name: "Órdenes de laboratorio" })
    const filas = within(lista).getAllByRole("listitem")
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent(/Atrasada \d+ días/)
    expect(within(filas[0]).getByRole("button", { name: "Marcar lista" })).toBeInTheDocument()
    expect(filas[1]).toHaveTextContent("Falta avisar")
    expect(filas[1]).toHaveTextContent("Saldo $100.00")
    expect(within(filas[1]).getByRole("button", { name: "Avisar por WhatsApp" })).toBeInTheDocument()
    expect(within(filas[1]).queryByRole("button", { name: /Imprimir|Editar|Otra orden|Volver/ })).not.toBeInTheDocument()
  })

  it("ya no hay aviso de 'Atrasos por laboratorio': los atrasos están en el filtro", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes")} />)
    expect(screen.queryByText(/Atrasos por laboratorio/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    fireEvent.click(within(screen.getByRole("dialog", { name: /Filtrar las órdenes/ })).getByRole("button", { name: "Atrasadas" }))
    expect(screen.getByText("1 orden atrasada")).toBeInTheDocument()
  })

  it("llega con el filtro que pidió el Inicio, y filtra por estado y laboratorio", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes", { filtro: "listas" })} />)
    expect(screen.getByText("OL-0002")).toBeInTheDocument()
    expect(screen.queryByText("OL-0001")).not.toBeInTheDocument()
    expect(screen.getByText("1 orden lista")).toBeInTheDocument()
  })

  it("el detalle trae la receta, la factura relacionada, el historial y las acciones", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes")} />)
    fireEvent.click(screen.getByRole("button", { name: "Ver la orden OL-0002" }))
    const d = screen.getByRole("dialog", { name: /Orden de laboratorio OL-0002/ })
    for (const n of [/Imprimir copias/, /Editar/, /Otra orden/, /Volver al estado anterior/]) expect(within(d).getByRole("button", { name: n })).toBeInTheDocument()
    expect(within(d).getByText("CV-0002")).toBeInTheDocument()
    expect(within(d).getByText("Receta")).toBeInTheDocument()
    expect(within(d).getByText("Historial de estados")).toBeInTheDocument()
  })

  it("busca por paciente", () => {
    render(<Ventas {...base} ordenesLab={ordenes} facturasVenta={facturas} {...ir("ordenes", { filtro: "todas" })} />)
    fireEvent.change(screen.getByLabelText(/Buscar orden/), { target: { value: "luis" } })
    expect(screen.getByText("OL-0002")).toBeInTheDocument()
    expect(screen.queryByText("OL-0001")).not.toBeInTheDocument()
  })
})

describe("Ventas — Cobros y saldos", () => {
  const hoyIso = `${hoyISO()}T15:00:00Z`
  const facturas = [
    factura("a", { numero: 1, creadoEn: hoyIso, pagos: [{ metodo: "efectivo", monto: 50 }, { metodo: "tarjeta", monto: 30 }] }),
    factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100, creadoEn: "2026-10-01T10:00:00Z" }),
  ]
  const abonos = [{ id: "x", facturaId: "b", monto: 40, fecha: hoyISO(), creadoEn: hoyIso, pagos: [{ metodo: "transferencia", monto: 40 }] }]

  it("'Cobrado hoy' suma por método de pago (venta dividida y abono), con su lista", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("cobros")} />)
    expect(screen.getByRole("heading", { name: "Cobrado hoy" })).toBeInTheDocument()
    expect(screen.getByLabelText("Total cobrado: $120.00")).toBeInTheDocument()
    const metodos = screen.getByRole("list", { name: "Cobrado por método de pago" })
    expect(within(metodos).getByText("Efectivo").closest("li")).toHaveTextContent("$50.00")
    expect(within(metodos).getByText("Tarjeta").closest("li")).toHaveTextContent("$30.00")
    expect(within(metodos).getByText("Transferencia").closest("li")).toHaveTextContent("$40.00")
    expect(within(screen.getByRole("list", { name: "Cobros del día" })).getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByRole("button", { name: /Exportar a Excel/ })).toBeEnabled()
  })

  it("los saldos dicen lo mismo que el Inicio y su 'Cobrar' abre el abono del comprobante elegido", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} {...ir("cobros")} />)
    const resumen = resumenSaldos(saldosPorPaciente({ pacientes, facturas, abonos, ventas: [] }))
    expect(screen.getByText(textoSaldos(resumen, { conTotal: false }))).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Cobros y saldos/ })).toHaveTextContent(String(resumen.pacientes))
    fireEvent.click(screen.getByRole("button", { name: "Cobrar CV-0002" }))
    const d = screen.getByRole("dialog", { name: "Registrar abono" })
    expect(within(d).getByText("$60.00", { selector: "dd" })).toBeInTheDocument() // saldo: 100 − 40
  })

  it("los pacientes con lentes listos para entregar van primero", () => {
    const f = [factura("a", { estado: "pendiente_pago", montoTotal: 500, metodoPago: "abonos", pacienteId: "p1" }), factura("b", { numero: 2, pacienteId: "p2", estado: "pendiente_pago", montoTotal: 50, metodoPago: "abonos" })]
    const ordenes = [{ id: "o1", numero: 1, pacienteId: "p2", facturaId: "b", estado: "lista", fechaPrometida: "2099-01-01" }]
    render(<Ventas {...base} facturasVenta={f} ordenesLab={ordenes} {...ir("cobros")} />)
    const filas = within(screen.getByRole("list", { name: "Pacientes con saldo" })).getAllByRole("listitem", { hidden: false }).filter((li) => li.parentElement.getAttribute("aria-label") === "Pacientes con saldo")
    expect(filas[0]).toHaveTextContent("Luis Mora")
    expect(filas[0]).toHaveTextContent("Sus lentes están listos para entregar")
  })
})
