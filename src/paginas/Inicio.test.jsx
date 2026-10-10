import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Inicio from "./Inicio"
import { hoyISO } from "../utilidades/disponibilidad"

const hoy = hoyISO()
const base = {
  usuario: { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" },
  nombreUsuario: "Ana",
  pacientes: [{ id: "p1", nombre: "Paciente Uno", fechaRegistro: hoy }, { id: "p2", nombre: "Paciente Dos", fechaRegistro: hoy }],
  citas: [
    { id: "c1", fecha: hoy, hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" },
    { id: "c2", fecha: hoy, hora: "10:00 AM", estado: "En Espera", paciente: "Paciente Dos", pacienteId: "p2", asignadoA: "otra" },
    { id: "c3", fecha: hoy, hora: "11:00 AM", estado: "Atendida", paciente: "Paciente Uno", pacienteId: "p1" },
  ],
  consultas: [{ id: "k1", pacienteId: "p1", fecha: hoy, motivo: "Control" }],
  inventario: [{ id: "i1", nombre: "Montura A", stock: 1, stockMinimo: 5, precio: 50 }, { id: "i2", nombre: "Montura B", stock: 40, stockMinimo: 5, precio: 50 }],
  pases: [{ id: "s1", estado: "listo", pacienteId: "p1", consultaId: "k1", pasadaEn: new Date().toISOString(), proformaEntregadaEn: new Date().toISOString() }],
  facturasVenta: [{ id: "f1", estado: "pendiente_pago", montoTotal: 100, pacienteId: "p1" }],
  abonos: [{ id: "a1", facturaId: "f1", monto: 40 }],
  ordenesLab: [{ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2020-01-01", pacienteId: "p1", laboratorio: "Lab Norte" }],
}
// Un rol: el usuario y su vista llevan los mismos permisos (en una vista de rol mandan los del rol, igual que el menú).
const rol = (inicio, permisos) => ({ usuario: { ...base.usuario, rol: "asistente", permisosNivel: permisos }, vista: { id: "r", nombre: "Rol", tipo: "rol", inicio, permisos, alcance: {} } })
const PERMISOS_RECEPCION = { citas: ["ver", "crear", "editar"], pacientes: ["ver", "crear", "editar"], crm: ["ver", "crear"] }
const PERMISOS_OPTOMETRA = { citas: ["ver", "crear"], consultas: ["ver", "crear"] }
const area = (nombre) => screen.getByRole("region", { name: `Requiere tu atención: ${nombre}` })
const antes = (a, b) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

describe("Inicio del administrador", () => {
  it("Totales: cuatro tarjetas iguales (pacientes, citas, ventas del mes en dólares y productos), cada una con su '+N este mes'", () => {
    render(<Inicio {...base} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    for (const t of ["Pacientes", "Citas", "Ventas", "Productos"]) expect(within(totales).getByText(t)).toBeInTheDocument()
    expect(within(totales).getAllByRole("button", { name: /: / })).toHaveLength(4)
    expect(within(totales).getByText("+2 este mes")).toBeInTheDocument() // los dos pacientes se registraron hoy
    expect(within(totales).getByText("$100.00")).toBeInTheDocument() // el total vendido (la venta de la prueba no tiene fecha de este mes)
    expect(within(totales).getByText("+$0.00 este mes · 0 ventas")).toBeInTheDocument()
    expect(within(totales).queryByText("Pacientes sin atender")).not.toBeInTheDocument()
  })

  it("Totales: Ventas muestra el total vendido y debajo '+$ este mes · N ventas', con la misma lógica que las demás", () => {
    const ahora = new Date().toISOString()
    render(<Inicio {...base} facturasVenta={[{ id: "f1", estado: "pagada", montoTotal: 100.5, creadoEn: ahora }, { id: "f2", estado: "pagada", montoTotal: 20, creadoEn: ahora }, { id: "f3", estado: "anulada", montoTotal: 999, creadoEn: ahora }]} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByText("$120.50")).toBeInTheDocument()
    expect(within(totales).getByText("+$120.50 este mes · 2 ventas")).toBeInTheDocument()
  })

  it("el dinero sale con separador de miles: $3,915.50", () => {
    const ahora = new Date().toISOString()
    render(<Inicio {...base} facturasVenta={[{ id: "f1", estado: "pagada", montoTotal: 3000, creadoEn: ahora }, { id: "f2", estado: "pagada", montoTotal: 915.5, creadoEn: "2020-01-01T10:00:00Z" }]} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByText("$3,915.50")).toBeInTheDocument()
    expect(within(totales).getByText("+$3,000.00 este mes · 1 venta")).toBeInTheDocument()
  })

  it("el orden es Totales, Requiere tu atención, Desenlace y Citas del día", () => {
    render(<Inicio {...base} />)
    const orden = ["Totales", "Requiere tu atención", "Desenlace de las citas · hoy", "Citas del día"].map((n) => screen.getByRole("region", { name: n }))
    for (let i = 0; i < orden.length - 1; i++) antes(orden[i], orden[i + 1])
    expect(screen.getByRole("group", { name: "Período del desenlace" })).toHaveTextContent("HoyEsta semanaEste mesTodas")
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
  })

  it("el selector de período usa el color del sistema, no el negro", () => {
    render(<Inicio {...base} />)
    const fondo = screen.getByRole("button", { name: "Hoy" }).style.background
    expect(fondo).toContain("linear-gradient")
    expect(fondo).not.toContain("14, 43, 51")
  })

  it("Requiere tu atención: una línea por tipo con su número, sus nombres y una sola acción; el total una sola vez y 'Ver todo' sin número", () => {
    const abiertas = [1, 2, 3, 4, 5].map((n) => ({ id: "ab" + n, fecha: "2020-01-0" + n, hora: "09:00 AM", estado: "En Atención", paciente: "Abierta " + n, pacienteId: "x" + n }))
    render(<Inicio {...base} citas={[...base.citas, ...abiertas]} />)
    const citas = area("Citas")
    expect(within(citas).getAllByRole("listitem")).toHaveLength(1) // las 5 atenciones abiertas son UNA línea
    expect(citas).toHaveTextContent("5 atenciones abiertas de días anteriores · Abierta 1, Abierta 2, Abierta 3 y 2 más")
    expect(within(citas).getAllByRole("button")).toHaveLength(2) // su acción y "Ver todo"
    expect(within(citas).getByRole("button", { name: "Ver" })).toBeInTheDocument()
    expect(within(citas).getByRole("button", { name: "Ver todo en Citas" })).toHaveTextContent(/^Ver todo$/)
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).not.toHaveTextContent(/Ver todo \(/)
  })

  it("cada tarjeta muestra como máximo tres avisos y dice cuántos elementos más hay; su número es la suma de todos sus avisos", () => {
    const mmdd = hoy.slice(5)
    const pacientes = [
      { id: "p1", nombre: "Control Vencido", fechaRegistro: hoy },
      { id: "p2", nombre: "Sin Consulta Dos", fechaRegistro: hoy },
      { id: "p3", nombre: "Web Sin Confirmar", origen: "paciente", confirmadoRecepcion: false, cedula: "1710034065", telefono: "0991234567", correo: "w@x.com" },
      { id: "p4", nombre: "Cumple Hoy", fechaRegistro: hoy, fechaNacimiento: "1990-" + mmdd },
    ]
    const consultas = [{ id: "k1", pacienteId: "p1", paciente: "Control Vencido", fecha: "2020-01-01", motivo: "Control", proximoControlDias: 30 }]
    render(<Inicio {...base} pacientes={pacientes} consultas={consultas} citas={[]} pases={[]} />)
    const tarjeta = area("Pacientes")
    expect(within(tarjeta).getAllByRole("listitem")).toHaveLength(3) // máximo tres avisos
    expect(tarjeta).toHaveTextContent("1 elemento más") // el cuarto (el cumpleaños) queda tras "Ver todo →"
    const suma = within(tarjeta).getAllByRole("listitem").reduce((n, li) => n + Number(li.querySelector("p span.font-bold").textContent), 0) + 1
    expect(within(tarjeta).getByRole("banner")).toHaveTextContent(String(suma)) // el número de la tarjeta cuenta todos sus avisos
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).not.toHaveTextContent(/Ver todo \(/)
  })

  it("un aviso con un solo caso trae la acción que lo resuelve; con varios, abre la lista", () => {
    const reagendadas = []
    const pedidos = []
    const una = { id: "cn", fecha: hoy, hora: "02:00 PM", estado: "No Asistió", paciente: "Paciente Cuatro", pacienteId: "p4", motivo: "Control" }
    const { unmount } = render(<Inicio {...base} citas={[...base.citas, una]} onReagendarCancelada={(c) => reagendadas.push(c.id)} />)
    expect(area("Citas")).toHaveTextContent("1 cita por reagendar (cancelada o sin asistir) · Paciente Cuatro")
    fireEvent.click(within(area("Citas")).getByRole("button", { name: "Reagendar" }))
    expect(reagendadas).toEqual(["cn"])
    unmount()
    const otra = { ...una, id: "cx", estado: "Cancelada", canceladaPor: "paciente", paciente: "Paciente Tres", pacienteId: "p3" }
    render(<Inicio {...base} citas={[...base.citas, una, otra]} onReagendarCancelada={(c) => reagendadas.push(c.id)} onVerCitas={(...a) => pedidos.push(a)} />)
    expect(area("Citas")).toHaveTextContent("2 citas por reagendar (canceladas o sin asistir) · Paciente Cuatro y Paciente Tres")
    fireEvent.click(within(area("Citas")).getByRole("button", { name: "Ver" }))
    expect(pedidos).toEqual([["todas", "reagendar"]])
    expect(reagendadas).toEqual(["cn"])
  })

  it("Ventas incluye los saldos por cobrar; cada área tiene su 'Ver todo →' hacia su módulo", () => {
    const saldos = []
    const stock = []
    const vistas = []
    render(<Inicio {...base} onVerSaldos={() => saldos.push("saldos")} onVerStockBajo={() => stock.push("bajo")} onVerOrdenes={() => {}} setVista={(v) => vistas.push(v)} />)
    const ventas = area("Ventas")
    expect(ventas).toHaveTextContent("1 venta con saldo pendiente · $60.00")
    fireEvent.click(within(ventas).getByRole("button", { name: "Ver saldos" }))
    expect(saldos).toEqual(["saldos"])
    fireEvent.click(within(area("Inventario")).getByRole("button", { name: "Ver todo en Inventario" }))
    expect(stock).toEqual(["bajo"])
    fireEvent.click(within(ventas).getByRole("button", { name: "Ver todo en Ventas" }))
    expect(vistas).toEqual(["ventas"])
  })

  it("el stock bajo sale una sola vez y su umbral viene de Configuración", () => {
    const { unmount } = render(<Inicio {...base} />)
    expect(screen.getAllByText(/producto con stock bajo/i)).toHaveLength(1)
    expect(screen.queryByText(/alertas? de stock bajo/i)).not.toBeInTheDocument()
    unmount()
    render(<Inicio {...base} umbralStock={50} />)
    expect(area("Inventario")).toHaveTextContent(/2 productos con stock bajo/)
  })

  it("Control sin agendar: una línea con su botón Agendar; la cita del control la quita", () => {
    const consultas = [{ id: "k1", pacienteId: "p1", paciente: "Paciente Uno", fecha: hoy, motivo: "Control", proximoControlDias: 30, controlAgenda: "despues" }]
    const citasSinControl = base.citas.filter((c) => c.pacienteId !== "p1")
    const agendados = []
    const equipo = [{ id: "u7", nombre: "Ana" }]
    const { unmount } = render(<Inicio {...base} equipo={equipo} consultas={consultas.map((c) => ({ ...c, profesionalNombre: "Ana" }))} citas={citasSinControl} onAgendarControl={(p, f, a) => agendados.push([p.id, f, a])} />)
    expect(area("Citas")).toHaveTextContent("1 control sin agendar · Paciente Uno")
    fireEvent.click(within(area("Citas")).getByRole("button", { name: "Agendar" }))
    expect(agendados).toHaveLength(1)
    expect(agendados[0][0]).toBe("p1")
    expect(agendados[0][2]).toBe("u7") // la cita se asigna por defecto a quien atendió la consulta
    unmount()
    const { unmount: u2 } = render(<Inicio {...base} consultas={consultas} citas={citasSinControl} {...rol("recepcion", PERMISOS_RECEPCION)} />)
    expect(screen.getByText(/control sin agendar/)).toBeInTheDocument() // recepción también lo ve
    u2()
    const futura = { id: "c9", fecha: "2099-01-01", hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" }
    render(<Inicio {...base} consultas={consultas} citas={[...citasSinControl, futura]} />)
    expect(screen.queryByText(/control sin agendar/)).not.toBeInTheDocument()
  })

  it("pacientes de la web con datos sin confirmar: 'Confirmar datos'; el optómetra no los ve", () => {
    const pacientes = [
      ...base.pacientes,
      { id: "p3", nombre: "Web Sin Confirmar", origen: "paciente", confirmadoRecepcion: false, cedula: "1710034065", telefono: "0991234567", correo: "w@x.com" },
      { id: "p4", nombre: "Web Ya Confirmado", origen: "paciente", confirmadoRecepcion: true },
      { id: "p5", nombre: "Registrado Por Recepción", origen: "staff", confirmadoRecepcion: true },
    ]
    const { unmount } = render(<Inicio {...base} pacientes={pacientes} />)
    const fila = area("Pacientes")
    expect(fila).toHaveTextContent("1 paciente de la web con los datos sin confirmar · Web Sin Confirmar")
    expect(fila).not.toHaveTextContent(/Web Ya Confirmado|Registrado Por Recepción/)
    fireEvent.click(within(fila).getByRole("button", { name: "Confirmar datos" }))
    expect(screen.getByRole("dialog", { name: "Confirmar datos del paciente" })).toBeInTheDocument()
    unmount()
    render(<Inicio {...base} pacientes={pacientes} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    expect(screen.queryByText(/datos sin confirmar/)).not.toBeInTheDocument()
  })

  it("'N pacientes registrados sin ninguna consulta' es una línea del área Pacientes y abre Pacientes ya filtrado", () => {
    const pedidos = []
    render(<Inicio {...base} onVerPacientes={(f) => pedidos.push(f)} />)
    const fila = screen.getByText(/paciente registrado sin ninguna consulta/).closest("li")
    expect(fila).toHaveTextContent(/^1 paciente registrado sin ninguna consulta/)
    fireEvent.click(within(fila).getByRole("button", { name: "Ver" }))
    expect(pedidos).toEqual([{ correccion: "Sin evaluación" }])
  })

  it("crear va en los atajos y las tarjetas de totales solo llevan a su lista", () => {
    const pedidos = []
    render(<Inicio {...base} setVista={(v) => pedidos.push(v)} onCrearPacienteRapido={() => pedidos.push("crear")} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    fireEvent.click(within(totales).getByRole("button", { name: /^Pacientes:/ }))
    fireEvent.click(within(totales).getByRole("button", { name: /Registrar paciente/ }))
    expect(pedidos).toEqual(["pacientes", "crear"])
  })

  it("sin nada pendiente: las cuatro tarjetas siguen ahí, del mismo tamaño, y dicen 'Todo en orden'", () => {
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} facturasVenta={[]} abonos={[]} />)
    for (const nombre of ["Citas", "Pacientes", "Ventas", "Inventario"]) {
      expect(area(nombre)).toHaveTextContent("Todo en orden")
      expect(within(area(nombre)).getByRole("button", { name: `Ver todo en ${nombre}` })).toBeInTheDocument()
    }
  })
})

describe("Desenlace del administrador", () => {
  it("las partes suman el total del título y las canceladas van aparte", () => {
    const cancelada = { id: "cx", fecha: hoy, hora: "03:00 PM", estado: "Cancelada", canceladaPor: "paciente", paciente: "Paciente Tres", pacienteId: "p3" }
    render(<Inicio {...base} citas={[...base.citas, cancelada]} />)
    const region = screen.getByRole("region", { name: "Desenlace de las citas · hoy" })
    expect(region).toHaveTextContent("3 citas = 1 + 0 + 2 · 1 cancelada aparte")
    expect(within(region).getByRole("button", { name: /^Atendidas: 1/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^No asistieron: 0/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^Pendientes: 2/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^Canceladas: 1\. Aparte/ })).toBeInTheDocument()
  })

  it("cambia de período con el selector y lo dice en el título", () => {
    render(<Inicio {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Todas" }))
    expect(screen.getByRole("region", { name: "Desenlace de las citas · todas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true")
  })

  it("la tarjeta filtra la lista de abajo y el enlace lleva a Citas con el mismo estado y período", () => {
    const llamadas = []
    render(<Inicio {...base} onVerCitas={(...a) => llamadas.push(a)} />)
    const lista = () => screen.getByRole("region", { name: /^(Citas del día|Todas las citas)$/ })
    expect(within(lista()).getByText("En Espera")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Atendidas:/ }))
    expect(screen.getByRole("button", { name: /^Atendidas:/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(lista()).queryByText("En Espera")).not.toBeInTheDocument()
    expect(within(lista()).getByText("Atendida")).toBeInTheDocument()
    fireEvent.click(within(lista()).getByRole("button", { name: "Ver todas en Citas" }))
    fireEvent.click(screen.getByRole("button", { name: /^Atendidas:/ })) // volver a tocarla la quita
    expect(within(lista()).getByText("En Espera")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Todas" }))
    fireEvent.click(screen.getByRole("button", { name: /^Canceladas:/ }))
    expect(within(lista()).getByText("Ninguna cita con ese resultado en el período.")).toBeInTheDocument()
    expect(within(lista()).queryByRole("button", { name: "Ver todas en Citas" })).not.toBeInTheDocument()
    expect(llamadas).toEqual([["atendida", "hoy"]])
  })

  it("Pendientes lista las que todavía no tienen desenlace (pendientes y en espera)", () => {
    render(<Inicio {...base} />)
    fireEvent.click(screen.getByRole("button", { name: /^Pendientes:/ }))
    const lista = screen.getByRole("region", { name: "Citas del día" })
    expect(lista).toHaveTextContent("Citas del día · Pendientes")
    expect(within(lista).getByText("En Espera")).toBeInTheDocument()
    expect(within(lista).getByText("Pendiente")).toBeInTheDocument()
    expect(within(lista).queryByText("Atendida")).not.toBeInTheDocument()
  })
})

describe("Inicio del optómetra", () => {
  it("primero el siguiente paciente destacado a lo ancho y su agenda, después sus avisos y al final el desenlace; sin totales ni tarjeta de citas de hoy", () => {
    render(<Inicio {...base} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    const dia = screen.getByRole("region", { name: "Tu día" })
    const hero = within(dia).getByLabelText("Siguiente paciente")
    expect(hero).toHaveTextContent("Paciente Uno")
    expect(within(hero).getByRole("button", { name: /^Atender/ })).toBeInTheDocument()
    expect(within(dia).queryByLabelText("Fichas sin terminar")).not.toBeInTheDocument() // solo cuando hay alguna
    expect(screen.queryByText("Mis citas de hoy")).not.toBeInTheDocument()
    expect(screen.queryByText("Atendidos hoy")).not.toBeInTheDocument()
    const agenda = screen.getByRole("region", { name: "Mi agenda de hoy" })
    expect(agenda).toHaveTextContent("Paciente Uno")
    expect(agenda).not.toHaveTextContent("Paciente Dos") // asignada a otra persona
    const avisos = screen.getByRole("region", { name: "Requiere tu atención" })
    const desenlace = screen.getByRole("region", { name: "Desenlace de mis citas · hoy" })
    antes(dia, agenda)
    antes(agenda, avisos)
    antes(avisos, desenlace)
    expect(screen.getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Requiere tu atención: Ventas" })).not.toBeInTheDocument()
    expect(within(desenlace).queryByRole("button", { name: /^Atendidas/ })).toBeNull() // su desenlace es informativo
  })

  it("el número de citas va en el título de la agenda y las filas llevan primero el estado y al final la acción", () => {
    render(<Inicio {...base} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    expect(screen.getByRole("heading", { name: "Mi agenda de hoy · 2 citas" })).toBeInTheDocument()
    const fila = within(screen.getByRole("region", { name: "Mi agenda de hoy" })).getByText("Pendiente").closest("[data-cita-id]")
    expect(fila).toHaveTextContent("Siguiente") // el siguiente lleva su marca; el botón grande está arriba
    const botones = within(fila).getAllByRole("button")
    expect(botones[botones.length - 1]).toHaveTextContent("Atender") // la acción, al final
    expect(fila.textContent.indexOf("Pendiente")).toBeLessThan(fila.textContent.indexOf("Atender"))
  })

  it("sin citas hoy muestra su próxima jornada con citas (y solo esa), sin siguiente paciente", () => {
    const manana = new Date(); manana.setDate(manana.getDate() + 1)
    const pasado = new Date(); pasado.setDate(pasado.getDate() + 3)
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const citas = [
      { id: "f1", fecha: iso(manana), hora: "09:00 AM", estado: "Pendiente", paciente: "Mañana Uno", pacienteId: "p1" },
      { id: "f2", fecha: iso(manana), hora: "10:00 AM", estado: "Pendiente", paciente: "Mañana Dos", pacienteId: "p2" },
      { id: "f3", fecha: iso(pasado), hora: "09:00 AM", estado: "Pendiente", paciente: "Pasado Uno", pacienteId: "p3" },
    ]
    render(<Inicio {...base} citas={citas} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    const agenda = screen.getByRole("region", { name: /^Mi próxima jornada con citas · / })
    expect(agenda).toHaveTextContent("Mañana Uno")
    expect(agenda).toHaveTextContent("Mañana Dos")
    expect(agenda).not.toHaveTextContent("Pasado Uno")
    expect(screen.queryByLabelText("Siguiente paciente")).not.toBeInTheDocument()
  })

  it("el siguiente paciente es quien ya llegó (En espera) aunque otro tenga hora antes, y el título de la agenda cuenta las citas y cuántos esperan", () => {
    const citas = [
      { id: "c1", fecha: hoy, hora: "08:00 AM", estado: "Pendiente", paciente: "Aún No Llega", pacienteId: "p1" },
      { id: "c2", fecha: hoy, hora: "11:00 AM", estado: "En Espera", paciente: "Ya Llegó Uno", pacienteId: "p2" },
      { id: "c3", fecha: hoy, hora: "12:00 PM", estado: "En Espera", paciente: "Ya Llegó Dos", pacienteId: "p3" },
    ]
    render(<Inicio {...base} citas={citas} {...rol("optometra", { citas: ["ver"], consultas: ["ver", "crear"] })} />)
    const destacado = screen.getByLabelText("Siguiente paciente")
    expect(destacado).toHaveTextContent("Ya Llegó Uno")
    expect(destacado).toHaveTextContent("ya llegó")
    expect(destacado).not.toHaveTextContent("Aún No Llega")
    expect(screen.getByRole("heading", { name: "Mi agenda de hoy · 3 citas · 2 en espera" })).toBeInTheDocument()
  })

  it("el siguiente paciente trae Atender y las fichas abiertas traen Retomar (su tarjeta y la fila de la agenda) o Ingresar (un día anterior)", () => {
    const atender = []
    const retomar = []
    const citas = [
      { id: "c1", fecha: hoy, hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" },
      { id: "c8", fecha: hoy, hora: "08:00 AM", estado: "En Atención", paciente: "Paciente Dos", pacienteId: "p2", atendidoPor: "u1" },
      { id: "c9", fecha: "2020-01-01", hora: "09:00 AM", estado: "En Atención", paciente: "Paciente Tres", pacienteId: "p3", atendidoPor: "u1" },
    ]
    render(<Inicio {...base} citas={citas} {...rol("optometra", { citas: ["ver"], consultas: ["ver", "crear"] })} onAtenderEnCitas={(c) => atender.push(c.id)} onAtenderCita={(c) => retomar.push(c.id)} />)
    fireEvent.click(within(screen.getByLabelText("Siguiente paciente")).getByRole("button", { name: /^Atender/ }))
    expect(atender).toEqual(["c1"])
    const retomarBtns = screen.getAllByRole("button", { name: "Retomar" })
    expect(retomarBtns).toHaveLength(2) // la tarjeta "Fichas sin terminar" y la fila de la agenda
    retomarBtns.forEach((b) => fireEvent.click(b))
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" })) // la de un día anterior
    expect(retomar).toEqual(["c8", "c8", "c9"])
  })

  it("la ficha sin terminar de hoy es una tarjeta solo cuando hay una, y no se repite en 'Requiere tu atención'", () => {
    const citas = [...base.citas, { id: "c9", fecha: hoy, hora: "08:00 AM", estado: "En Atención", paciente: "Paciente Dos", pacienteId: "p2", atendidoPor: "u1" }]
    const { unmount } = render(<Inicio {...base} citas={citas} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    const tarjeta = screen.getByLabelText("Fichas sin terminar")
    expect(tarjeta).toHaveTextContent("1")
    expect(tarjeta).toHaveTextContent("Paciente Dos")
    expect(screen.getByLabelText("Siguiente paciente")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).not.toHaveTextContent(/ficha/i) // ni en la tarjeta de Citas
    unmount()
    render(<Inicio {...base} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    expect(screen.queryByLabelText("Fichas sin terminar")).not.toBeInTheDocument()
  })

  it("sus avisos son solo los suyos: controles vencidos 'de tus pacientes', sin inventario ni pacientes sin consulta, y sin acciones que su rol no puede usar", () => {
    const vencido = { id: "k9", pacienteId: "p1", paciente: "Paciente Uno", fecha: "2020-01-01", motivo: "Control", proximoControlDias: 30 }
    const props = { ...base, consultas: [vencido] }
    const { unmount } = render(<Inicio {...props} {...rol("optometra", { citas: ["ver"], inventario: ["ver"], crm: ["ver"], pacientes: ["ver"] })} />)
    expect(area("Pacientes")).toHaveTextContent("1 de tus pacientes con el control vencido")
    expect(screen.queryByText(/stock bajo/)).not.toBeInTheDocument() // el inventario no es suyo, aunque pueda verlo
    expect(screen.queryByRole("region", { name: "Requiere tu atención: Inventario" })).not.toBeInTheDocument()
    expect(screen.queryByText(/sin ninguna consulta/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ver en CRM" })).not.toBeInTheDocument() // sin permiso de CRM para escribir
    expect(screen.queryByRole("button", { name: /Añadir producto/ })).not.toBeInTheDocument()
    unmount()
    render(<Inicio {...props} {...rol("optometra", { citas: ["ver"], inventario: ["ver", "crear", "editar"], crm: ["ver", "crear"], pacientes: ["ver"] })} />)
    expect(screen.getByRole("button", { name: "Ver en CRM" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Añadir producto/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reabastecer" })).not.toBeInTheDocument()
  })
})

describe("Inicio de recepción y ventas", () => {
  it("recepción: misma estructura que el administrador (avisos por área, desenlace y citas del día), sin línea de resumen ni totales", () => {
    render(<Inicio {...base} {...rol("recepcion", PERMISOS_RECEPCION)} />)
    expect(screen.getByRole("button", { name: /Agendar cita/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar paciente/ })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Desenlace de las citas · hoy" })).toBeInTheDocument()
    const lista = screen.getByRole("region", { name: "Citas del día" })
    expect(within(lista).getByRole("heading", { level: 2 })).toHaveTextContent("1 por llegar · 1 en sala de espera")
    expect(screen.queryByText("Citas de hoy")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
  })

  it("recepción sin nada pendiente: sus tarjetas dicen 'Todo en orden'", () => {
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} {...rol("recepcion", PERMISOS_RECEPCION)} />)
    expect(screen.getAllByText("Todo en orden").length).toBeGreaterThan(0)
  })

  it("ventas: lo que espera a quien vende, con la cola y las órdenes y el stock en un solo bloque de atención", () => {
    render(<Inicio {...base} {...rol("ventas", { ventas: ["ver", "crear"], inventario: ["ver"] })} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.getByText("Listos para venta", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("Saldos por cobrar")).toBeInTheDocument()
    expect(screen.getByText("$60.00", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Listos para venta" })).toBeInTheDocument()
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(atencion).toHaveTextContent(/1 orden atrasada/)
    expect(screen.queryByRole("region", { name: "Órdenes de laboratorio" })).not.toBeInTheDocument()
    expect(screen.getByText("Paciente Uno", { selector: "span" })).toBeInTheDocument()
    expect(screen.getAllByText(/producto con stock bajo/i)).toHaveLength(1)
    expect(atencion).toHaveTextContent(/1 venta con saldo pendiente/)
  })

  it("ventas: la tarjeta elegida de 'Para vender' cambia la lista de abajo", () => {
    render(<Inicio {...base} {...rol("ventas", { ventas: ["ver", "crear"], inventario: ["ver"] })} />)
    expect(screen.getByRole("button", { name: /^Listos para venta:/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByText("Saldo $60.00")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Saldos por cobrar:/ }))
    expect(screen.getByRole("region", { name: "Saldos por cobrar", hidden: false })).toBeInTheDocument()
    expect(screen.getByText("Saldo $60.00")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Listos para venta:/ }))
    expect(screen.queryByText(/Corrección óptica indicada/)).not.toBeInTheDocument()
  })

  it("rol propio: solo los bloques de los módulos que puede ver", () => {
    render(<Inicio {...base} {...rol("general", { ventas: ["ver"] })} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Hoy" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
  })
})
