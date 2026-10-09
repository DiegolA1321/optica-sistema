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
const vistaRol = (inicio) => ({ id: "r", nombre: "Rol", tipo: "rol", inicio, permisos: {}, alcance: {} })

describe("Inicio por rol", () => {
  it("administrador: Totales con el mes, Requiere tu atención por área, desenlace de hoy y la lista; el stock bajo una sola vez", () => {
    render(<Inicio {...base} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByText("Pacientes registrados")).toBeInTheDocument()
    expect(within(totales).getByText("Citas registradas")).toBeInTheDocument()
    expect(within(totales).getByText("Productos en inventario")).toBeInTheDocument()
    expect(within(totales).getByText("+2 este mes")).toBeInTheDocument() // los dos pacientes se registraron hoy
    expect(within(totales).queryByText("Pacientes sin atender")).not.toBeInTheDocument()
    for (const area of ["Citas", "Pacientes", "Ventas", "Inventario"]) expect(screen.getByLabelText(`Requiere tu atención: ${area}`)).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Desenlace de las citas · hoy" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Período del desenlace" })).toHaveTextContent("HoyEsta semanaEste mesTodas")
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Citas del día" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
    expect(screen.queryByText(/¡Bienvenido/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/1 producto con stock bajo/i)).toHaveLength(1)
    expect(screen.queryByText(/alertas? de stock bajo/i)).not.toBeInTheDocument()
  })

  it("administrador: el orden es Totales, Requiere tu atención, Desenlace y Citas del día", () => {
    render(<Inicio {...base} />)
    const orden = ["Totales", "Requiere tu atención", "Desenlace de las citas · hoy", "Citas del día"].map((n) => screen.getByRole("region", { name: n }))
    for (let i = 0; i < orden.length - 1; i++) expect(orden[i].compareDocumentPosition(orden[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("administrador: cada bloque muestra sus tres avisos más importantes y 'Ver todo (N)'", () => {
    const abiertas = [1, 2, 3, 4, 5].map((n) => ({ id: "ab" + n, fecha: "2020-01-0" + n, hora: "09:00 AM", estado: "En Atención", paciente: "Abierta " + n, pacienteId: "x" + n }))
    render(<Inicio {...base} citas={[...base.citas, ...abiertas]} />)
    const bloque = screen.getByRole("region", { name: "Requiere tu atención: Citas" })
    expect(within(bloque).getAllByText(/^Atención abierta de un día anterior/)).toHaveLength(3)
    expect(within(bloque).getByRole("button", { name: /^Ver todo \(5\)/ })).toBeInTheDocument()
  })

  it("administrador: Ventas incluye los saldos por cobrar y su 'Ver todo' lleva a Saldos; Inventario lleva al stock bajo", () => {
    const saldos = []
    const stock = []
    render(<Inicio {...base} onVerSaldos={() => saldos.push("saldos")} onVerStockBajo={() => stock.push("bajo")} onVerOrdenes={() => {}} />)
    const ventas = screen.getByRole("region", { name: "Requiere tu atención: Ventas" })
    expect(ventas).toHaveTextContent("1 venta con saldo pendiente: $60.00")
    fireEvent.click(within(ventas).getByRole("button", { name: "Ver saldos" }))
    expect(saldos).toEqual(["saldos"])
    fireEvent.click(within(screen.getByRole("region", { name: "Requiere tu atención: Inventario" })).getByRole("button", { name: /^Ver todo/ }))
    expect(stock).toEqual(["bajo"])
  })

  it("administrador y recepción: aviso de \"Control sin agendar\" con su botón Agendar; la cita del control lo quita", () => {
    const consultas = [{ id: "k1", pacienteId: "p1", paciente: "Paciente Uno", fecha: hoy, motivo: "Control", proximoControlDias: 30, controlAgenda: "despues" }]
    const citasSinControl = base.citas.filter((c) => c.pacienteId !== "p1")
    const agendados = []
    const equipo = [{ id: "u7", nombre: "Ana" }]
    const { unmount } = render(<Inicio {...base} equipo={equipo} consultas={consultas.map((c) => ({ ...c, profesionalNombre: "Ana" }))} citas={citasSinControl} onAgendarControl={(p, f, a) => agendados.push([p.id, f, a])} />)
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(within(atencion).getByText("Control sin agendar: Paciente Uno")).toBeInTheDocument()
    fireEvent.click(within(atencion).getByRole("button", { name: "Agendar" }))
    expect(agendados).toHaveLength(1)
    expect(agendados[0][0]).toBe("p1")
    expect(agendados[0][2]).toBe("u7") // la cita se asigna por defecto a quien atendió la consulta
    unmount()
    // Recepción también lo ve
    const { unmount: u2 } = render(<Inicio {...base} consultas={consultas} citas={citasSinControl} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver", "crear"], pacientes: ["ver"] } }} vista={vistaRol("recepcion")} />)
    expect(screen.getByText("Control sin agendar: Paciente Uno")).toBeInTheDocument()
    u2()
    // Con una cita pendiente posterior a la ficha, el aviso desaparece
    const futura = { id: "c9", fecha: "2099-01-01", hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" }
    render(<Inicio {...base} consultas={consultas} citas={[...citasSinControl, futura]} />)
    expect(screen.queryByText(/Control sin agendar:/)).not.toBeInTheDocument()
  })

  it("optómetra: sus citas (sin las asignadas a otra persona), atajos, siguiente paciente, sin totales ni stock ni resumen", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver", "crear"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} />)
    const lista = screen.getByRole("region", { name: "Mi agenda de hoy" })
    expect(within(lista).getByLabelText("Siguiente paciente")).toBeInTheDocument()
    expect(within(lista).getAllByText("Paciente Uno").length).toBeGreaterThan(0)
    expect(within(lista).queryByText("Paciente Dos")).not.toBeInTheDocument() // asignada a otra persona
    expect(screen.getByRole("region", { name: "Desenlace de mis citas · hoy" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Requiere tu atención: Ventas" })).not.toBeInTheDocument()
  })

  it("optómetra: el siguiente paciente es quien ya llegó (En espera) aunque otro tenga hora antes, y el título de la agenda cuenta cuántos esperan", () => {
    const citas = [
      { id: "c1", fecha: hoy, hora: "08:00 AM", estado: "Pendiente", paciente: "Aún No Llega", pacienteId: "p1" },
      { id: "c2", fecha: hoy, hora: "11:00 AM", estado: "En Espera", paciente: "Ya Llegó Uno", pacienteId: "p2" },
      { id: "c3", fecha: hoy, hora: "12:00 PM", estado: "En Espera", paciente: "Ya Llegó Dos", pacienteId: "p3" },
    ]
    render(<Inicio {...base} citas={citas} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} />)
    const destacado = screen.getByLabelText("Siguiente paciente")
    expect(destacado).toHaveTextContent("Ya Llegó Uno")
    expect(destacado).toHaveTextContent("ya llegó")
    expect(screen.getByRole("heading", { name: "Mi agenda de hoy · 2 en espera" })).toBeInTheDocument()
  })

  it("recepción: misma estructura que el administrador (avisos por área, desenlace y citas del día), sin línea de resumen ni tarjetas aparte de Hoy", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente" }} vista={vistaRol("recepcion")} />)
    expect(screen.getByRole("button", { name: /Agendar cita/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar paciente/ })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Desenlace de las citas · hoy" })).toBeInTheDocument()
    // Por llegar y sala de espera van en la cabecera de la lista, no en tarjetas aparte
    const lista = screen.getByRole("region", { name: "Citas del día" })
    expect(within(lista).getByRole("heading", { level: 2 })).toHaveTextContent("1 por llegar · 1 en sala de espera")
    expect(screen.queryByText("Citas de hoy")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
  })

  it("ventas: lo que espera a quien vende, con la cola y las órdenes y el stock en un solo bloque de atención", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { ventas: ["ver", "crear"], inventario: ["ver"] } }} vista={vistaRol("ventas")} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.getByText("Listos para venta", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("Saldos por cobrar")).toBeInTheDocument()
    expect(screen.getByText("$60.00")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Listos para venta" })).toBeInTheDocument()
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(atencion).toHaveTextContent(/1 orden atrasada/)
    expect(screen.queryByRole("region", { name: "Órdenes de laboratorio" })).not.toBeInTheDocument()
    expect(screen.getByText("Paciente Uno", { selector: "span" })).toBeInTheDocument()
    expect(screen.getAllByText(/1 producto con stock bajo/i)).toHaveLength(1)
    // Los saldos por cobrar también son un aviso (por ítem), igual que en el administrador
    expect(atencion).toHaveTextContent(/1 venta con saldo pendiente/)
  })

  it("ventas: la tarjeta elegida de 'Para vender' cambia la lista de abajo", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { ventas: ["ver", "crear"], inventario: ["ver"] } }} vista={vistaRol("ventas")} />)
    expect(screen.getByRole("button", { name: /^Listos para venta:/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByText("Saldo $60.00")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Saldos por cobrar:/ }))
    expect(screen.getByRole("region", { name: "Saldos por cobrar", hidden: false })).toBeInTheDocument()
    expect(screen.getByText("Saldo $60.00")).toBeInTheDocument()
    // el texto del tratamiento ya no se repite en cada fila
    fireEvent.click(screen.getByRole("button", { name: /^Listos para venta:/ }))
    expect(screen.queryByText(/Corrección óptica indicada/)).not.toBeInTheDocument()
  })

  it("rol propio: solo los bloques de los módulos que puede ver", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { ventas: ["ver"] } }} vista={vistaRol("general")} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Hoy" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
  })

  it("sin nada pendiente: cada bloque dice \"Todo en orden\"", () => {
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} facturasVenta={[]} abonos={[]} />)
    // Sin avisos no hay tarjetas altas y vacías: las cuatro áreas van en una franja compacta
    const franja = screen.getByRole("list", { name: "Áreas sin avisos" })
    expect(within(franja).getAllByRole("listitem")).toHaveLength(4)
    expect(franja).toHaveTextContent(/todo en orden/i)
    expect(screen.queryByText("Ver todo", { exact: false })).not.toBeInTheDocument()
  })

  it("recepción sin nada pendiente: franja de 'todo en orden' y sin línea de resumen", () => {
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} usuario={{ ...base.usuario, rol: "asistente" }} vista={vistaRol("recepcion")} />)
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Áreas sin avisos" })).toHaveTextContent(/todo en orden/i)
  })

  it("administrador: quien no asistió también aparece para reagendar, igual que en Citas", () => {
    const noAsistio = { id: "cn", fecha: hoy, hora: "02:00 PM", estado: "No Asistió", paciente: "Paciente Cuatro", pacienteId: "p4", motivo: "Control" }
    const reagendadas = []
    render(<Inicio {...base} citas={[...base.citas, noAsistio]} onReagendarCancelada={(c) => reagendadas.push(c.id)} />)
    const bloque = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(bloque).toHaveTextContent("No asistió a su cita: Paciente Cuatro")
    fireEvent.click(within(bloque).getAllByRole("button", { name: "Reagendar" })[0])
    expect(reagendadas).toEqual(["cn"])
  })

  it("administrador: aviso de cita cancelada por el paciente con botón Reagendar", () => {
    const reagendadas = []
    const cancelada = { id: "cx", fecha: hoy, hora: "03:00 PM", estado: "Cancelada", canceladaPor: "paciente", paciente: "Paciente Tres", pacienteId: "p3", motivo: "Control" }
    render(<Inicio {...base} citas={[...base.citas, cancelada]} onReagendarCancelada={(c) => reagendadas.push(c.id)} />)
    const bloque = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(bloque).toHaveTextContent("Cita cancelada por el paciente: Paciente Tres")
    fireEvent.click(within(bloque).getByRole("button", { name: "Reagendar" }))
    expect(reagendadas).toEqual(["cx"])
  })

  it("el desenlace cambia de período con el selector y lo dice en el título", () => {
    render(<Inicio {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Todas" }))
    expect(screen.getByRole("region", { name: "Desenlace de las citas · todas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true")
  })

  it("la tarjeta del desenlace filtra la lista de abajo y el enlace lleva a Citas con el mismo estado y período", () => {
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
    // Sin canceladas no hay nada que ver: un solo mensaje y ningún enlace a Citas
    expect(within(lista()).getByText("Ninguna cita con ese resultado en el período.")).toBeInTheDocument()
    expect(within(lista()).queryByRole("button", { name: "Ver todas en Citas" })).not.toBeInTheDocument()
    expect(llamadas).toEqual([["atendida", "hoy"]])
  })

  it("las tarjetas del desenlace se llaman Atendidas, No asistieron y Canceladas", () => {
    render(<Inicio {...base} />)
    expect(screen.getByRole("button", { name: /^No asistieron:/ })).toBeInTheDocument()
    expect(screen.queryByText("No atendidas")).not.toBeInTheDocument()
  })

  it("optómetra: el siguiente paciente trae Atender y las fichas abiertas traen Retomar (en el aviso y en la agenda)", () => {
    const atender = []
    const retomar = []
    const citas = [
      { id: "c1", fecha: hoy, hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" },
      { id: "c8", fecha: hoy, hora: "08:00 AM", estado: "En Atención", paciente: "Paciente Dos", pacienteId: "p2", atendidoPor: "u1" },
      { id: "c9", fecha: "2020-01-01", hora: "09:00 AM", estado: "En Atención", paciente: "Paciente Tres", pacienteId: "p3", atendidoPor: "u1" },
    ]
    render(<Inicio {...base} citas={citas} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} onAtenderEnCitas={(c) => atender.push(c.id)} onAtenderCita={(c) => retomar.push(c.id)} />)
    fireEvent.click(within(screen.getByLabelText("Siguiente paciente")).getByRole("button", { name: /^Atender/ }))
    expect(atender).toEqual(["c1"])
    const retomarBtns = screen.getAllByRole("button", { name: "Retomar" })
    expect(retomarBtns).toHaveLength(2) // el aviso "Ficha sin terminar" y la fila de la agenda
    retomarBtns.forEach((b) => fireEvent.click(b))
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" })) // la de un día anterior
    expect(retomar).toEqual(["c8", "c8", "c9"])
  })

  it("quien solo puede mirar el inventario ve '1 producto con stock bajo' y 'Ver inventario', sin 'Reabastecer'", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver"], inventario: ["ver"] } }} vista={vistaRol("optometra")} />)
    const bloque = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(bloque).toHaveTextContent(/1 producto con stock bajo/)
    expect(screen.getByRole("button", { name: "Ver inventario" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reabastecer" })).not.toBeInTheDocument()
  })

  it("administrador y recepción: pacientes de la web con datos sin confirmar traen 'Confirmar datos'; el optómetra no los ve", () => {
    const pacientes = [
      ...base.pacientes,
      { id: "p3", nombre: "Web Sin Confirmar", origen: "paciente", confirmadoRecepcion: false, cedula: "1710034065", telefono: "0991234567", correo: "w@x.com" },
      { id: "p4", nombre: "Web Ya Confirmado", origen: "paciente", confirmadoRecepcion: true },
      { id: "p5", nombre: "Registrado Por Recepción", origen: "staff", confirmadoRecepcion: true },
    ]
    const { unmount } = render(<Inicio {...base} pacientes={pacientes} />)
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(within(atencion).getByText("Datos sin confirmar: Web Sin Confirmar")).toBeInTheDocument()
    expect(within(atencion).queryByText(/Web Ya Confirmado|Registrado Por Recepción/)).not.toBeInTheDocument()
    fireEvent.click(within(atencion).getByRole("button", { name: "Confirmar datos" }))
    expect(screen.getByRole("dialog", { name: "Confirmar datos del paciente" })).toBeInTheDocument()
    unmount()
    render(<Inicio {...base} pacientes={pacientes} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} />)
    expect(screen.queryByText(/Datos sin confirmar:/)).not.toBeInTheDocument()
  })

  it("administrador: 'N pacientes registrados sin ninguna consulta' es un aviso del bloque Pacientes y abre Pacientes ya filtrado", () => {
    const pedidos = []
    render(<Inicio {...base} onVerPacientes={(f) => pedidos.push(f)} />)
    const fila = screen.getByText(/1 paciente registrado sin ninguna consulta/).closest("li")
    fireEvent.click(within(fila).getByRole("button", { name: "Ver pacientes" }))
    expect(pedidos).toEqual([{ correccion: "Sin evaluación" }])
  })
  it("el stock mínimo sale del umbral que le pasa Configuración", () => {
    render(<Inicio {...base} umbralStock={50} />)
    expect(screen.getAllByText(/2 productos con stock bajo/i)).toHaveLength(1)
  })

  it("optómetra: la ficha sin terminar de hoy aparece como aviso solo cuando hay una atención abierta suya", () => {
    const citas = [...base.citas, { id: "c9", fecha: hoy, hora: "08:00 AM", estado: "En Atención", paciente: "Paciente Dos", pacienteId: "p2", atendidoPor: "u1" }]
    const { unmount } = render(<Inicio {...base} citas={citas} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver", "crear"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} />)
    expect(screen.getByText("Ficha sin terminar: Paciente Dos")).toBeInTheDocument()
    unmount()
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver", "crear"], consultas: ["ver", "crear"] } }} vista={vistaRol("optometra")} />)
    expect(screen.queryByText(/Ficha sin terminar:/)).not.toBeInTheDocument()
  })

  it("administrador: crear va en los atajos y las tarjetas de totales solo llevan a su lista", () => {
    const pedidos = []
    render(<Inicio {...base} setVista={(v) => pedidos.push(v)} onCrearPacienteRapido={() => pedidos.push("crear")} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    fireEvent.click(within(totales).getByRole("button", { name: /Pacientes registrados/ }))
    fireEvent.click(within(totales).getByRole("button", { name: /Registrar paciente/ }))
    expect(pedidos).toEqual(["pacientes", "crear"])
  })
})
