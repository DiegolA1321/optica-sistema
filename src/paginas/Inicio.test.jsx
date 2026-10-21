import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Inicio from "./Inicio"
import { listaParaContactar, fechaEnDias } from "../utilidades/crmContactos"
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
// Una tarjetita de «Requiere tu atención»: su nombre accesible es «N frase completa»; a la vista solo lleva el número y una leyenda corta, nunca nombres.
const tarj = (nombreArea, nombre) => within(area(nombreArea)).getByRole("button", { name: nombre })
const sinTarj = (nombre) => expect(screen.queryByRole("button", { name: nombre })).not.toBeInTheDocument()
const antes = (a, b) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

describe("Inicio del administrador", () => {
  it("Totales: cuatro tarjetas iguales (pacientes, citas, ventas del mes en dólares y productos), cada una con su '+N este mes'", () => {
    render(<Inicio {...base} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    for (const t of ["Pacientes", "Citas", "Ventas", "Productos"]) expect(within(totales).getByText(t)).toBeInTheDocument()
    expect(within(totales).getAllByRole("button", { name: /: / })).toHaveLength(4)
    expect(within(totales).getByText("+2 este mes")).toBeInTheDocument() // los dos pacientes se registraron hoy
    expect(within(totales).getByText("$100.00")).toBeInTheDocument() // el total vendido (la venta de la prueba no tiene fecha de este mes)
    expect(within(totales).getByText("+$0.00 vendido este mes · 0 ventas")).toBeInTheDocument()
    expect(within(totales).queryByText("Pacientes sin atender")).not.toBeInTheDocument()
  })

  it("Totales: Ventas muestra el total vendido y debajo '+$ vendido este mes · N ventas', con la misma lógica que las demás", () => {
    const ahora = new Date().toISOString()
    render(<Inicio {...base} facturasVenta={[{ id: "f1", estado: "pagada", montoTotal: 100.5, creadoEn: ahora }, { id: "f2", estado: "pagada", montoTotal: 20, creadoEn: ahora }, { id: "f3", estado: "anulada", montoTotal: 999, creadoEn: ahora }]} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByText("$120.50")).toBeInTheDocument()
    expect(within(totales).getByText("+$120.50 vendido este mes · 2 ventas")).toBeInTheDocument()
  })

  it("el dinero sale con separador de miles: $3,915.50", () => {
    const ahora = new Date().toISOString()
    render(<Inicio {...base} facturasVenta={[{ id: "f1", estado: "pagada", montoTotal: 3000, creadoEn: ahora }, { id: "f2", estado: "pagada", montoTotal: 915.5, creadoEn: "2020-01-01T10:00:00Z" }]} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByText("$3,915.50")).toBeInTheDocument()
    expect(within(totales).getByText("+$3,000.00 vendido este mes · 1 venta")).toBeInTheDocument()
  })

  it("el orden es Totales, Requiere tu atención y Desenlace de las citas, con 'Ir a Citas' junto al período; sin la lista de citas de abajo", () => {
    render(<Inicio {...base} />)
    const orden = ["Totales", "Requiere tu atención", "Desenlace de las citas · hoy"].map((n) => screen.getByRole("region", { name: n }))
    for (let i = 0; i < orden.length - 1; i++) antes(orden[i], orden[i + 1])
    expect(screen.getByRole("group", { name: "Período del desenlace" })).toHaveTextContent("HoyEsta semanaEste mesTodas")
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true")
    expect(within(orden[2]).getByRole("button", { name: "Ir a Citas" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Citas del día" })).not.toBeInTheDocument() // el detalle vive en el módulo Citas
    expect(screen.queryByLabelText("Resumen del día")).not.toBeInTheDocument()
  })

  it("Totales: cada tarjeta lleva su propio tinte suave (no los colores de estado)", () => {
    render(<Inicio {...base} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    const fondos = within(totales).getAllByRole("button", { name: /: / }).map((b) => b.parentElement.style.backgroundColor)
    expect(fondos.every(Boolean)).toBe(true)
    expect(new Set(fondos).size).toBe(4) // cuatro tintes distintos
  })

  it("el selector de período usa el color del sistema, no el negro", () => {
    render(<Inicio {...base} />)
    const fondo = screen.getByRole("button", { name: "Hoy" }).style.background
    expect(fondo).toContain("linear-gradient")
    expect(fondo).not.toContain("14, 43, 51")
  })

  it("Requiere tu atención: cada tipo de aviso es UNA tarjetita con el número grande y una leyenda corta, sin nombres de pacientes; 'Ver todo' sin número", () => {
    const abiertas = [1, 2, 3, 4, 5].map((n) => ({ id: "ab" + n, fecha: "2020-01-0" + n, hora: "09:00 AM", estado: "En Atención", paciente: "Abierta " + n, pacienteId: "x" + n }))
    render(<Inicio {...base} citas={[...base.citas, ...abiertas]} />)
    const citas = area("Citas")
    expect(within(citas).getAllByRole("listitem")).toHaveLength(1) // las 5 atenciones abiertas son UNA tarjetita
    expect(tarj("Citas", "5 atenciones abiertas de días anteriores")).toHaveTextContent(/^5\s*atenciones abiertas$/)
    expect(citas).not.toHaveTextContent(/Abierta \d/) // ni un nombre de paciente en la tarjeta
    expect(within(citas).queryByRole("button", { name: "Seguir atendiendo" })).not.toBeInTheDocument()
    expect(within(citas).getByRole("button", { name: "Ver todo en Citas" })).toHaveTextContent(/^Ver todo$/)
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).not.toHaveTextContent(/Ver todo \(/)
  })

  const hace200 = fechaEnDias(-200) // control vencido, pero con visita dentro del último año
  it("el aviso de control vencido cuenta exactamente lo mismo que 'Para contactar' del CRM: sin los que ya se contactaron ni los que no aceptaron recordatorios", () => {
    const pacientes = [
      { id: "a", nombre: "Ana Vencida", fechaRegistro: hace200 },
      { id: "b", nombre: "Beto Contactado", fechaRegistro: hace200 },
      { id: "c", nombre: "Carla Sin Permiso", fechaRegistro: hace200, aceptaRecordatorios: false },
    ]
    const contactos = [{ id: "k", pacienteId: "b", motivo: "control_vencido", resultado: "no_respondio", creadoEn: new Date().toISOString() }]
    const lista = listaParaContactar({ pacientes, consultas: [], ordenes: [], citas: [], contactos })
    expect(lista.filas.map((f) => f.id)).toEqual(["a"])
    render(<Inicio {...base} pacientes={pacientes} consultas={[]} citas={[]} pases={[]} paraContactar={lista} />)
    fireEvent.click(tarj("Pacientes", "1 paciente con el control vencido"))
    const ventanaControl = screen.getByRole("dialog", { name: "1 paciente con el control vencido" })
    expect(ventanaControl).toHaveTextContent("Ana Vencida")
    expect(ventanaControl).not.toHaveTextContent("Beto Contactado")
    expect(ventanaControl).not.toHaveTextContent("Carla Sin Permiso")
  })

  it("mientras el CRM carga no se avisa de controles ni de cumpleaños (no se cuenta algo que luego bajaría)", () => {
    render(<Inicio {...base} pacientes={[{ id: "a", nombre: "Ana Vencida", fechaRegistro: hace200 }]} consultas={[]} citas={[]} pases={[]} paraContactar={null} />)
    sinTarj(/con el control vencido/)
  })

  it("cada área muestra como máximo tres tarjetitas y dice cuántos avisos más hay; su número es la suma de todos sus avisos", () => {
    const mmdd = hoy.slice(5)
    const pacientes = [
      { id: "p1", nombre: "Control Vencido", fechaRegistro: hoy },
      { id: "p2", nombre: "Sin Consulta Dos", fechaRegistro: hoy },
      { id: "p3", nombre: "Web Sin Confirmar", origen: "paciente", confirmadoRecepcion: false, cedula: "1710034065", telefono: "0991234567", correo: "w@x.com" },
      { id: "p4", nombre: "Cumple Hoy", fechaRegistro: hoy, fechaNacimiento: "1990-" + mmdd, aceptaPromociones: true },
    ]
    const consultas = [{ id: "k1", pacienteId: "p1", paciente: "Control Vencido", fecha: "2020-01-01", motivo: "Control", proximoControlDias: 30 }]
    render(<Inicio {...base} pacientes={pacientes} consultas={consultas} citas={[]} pases={[]} />)
    const tarjeta = area("Pacientes")
    expect(within(tarjeta).getAllByRole("listitem")).toHaveLength(3) // máximo tres tarjetitas
    expect(within(tarjeta).getByRole("button", { name: "Ver los 1 avisos más de Pacientes" })).toHaveTextContent("1 aviso más") // la cuarta (el cumpleaños) queda tras «1 aviso más»
    const suma = within(tarjeta).getAllByRole("listitem").reduce((n, li) => n + Number(li.textContent.match(/^\d+/)[0]), 0) + 1
    expect(within(tarjeta).getByText(String(suma))).toBeInTheDocument() // el número del área cuenta todos sus avisos
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).not.toHaveTextContent(/Ver todo \(/)
    // la ventana de «1 aviso más» trae los cuatro tipos, también el que no cabía
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Ver los 1 avisos más de Pacientes" }))
    const ventana = screen.getByRole("dialog", { name: `Pacientes · ${suma} avisos` })
    expect(within(ventana).getAllByRole("heading", { level: 3 })).toHaveLength(4)
    expect(ventana).toHaveTextContent("Cumple Hoy")
  })

  it("un aviso, también el de un solo caso, abre la ventana con sus casos y la acción de cada uno; el enlace 'Abrir en …' dice adónde lleva y con qué número", () => {
    const reagendadas = []
    const pedidos = []
    const una = { id: "cn", fecha: hoy, hora: "02:00 PM", estado: "No Asistió", paciente: "Paciente Cuatro", pacienteId: "p4", motivo: "Control" }
    const { unmount } = render(<Inicio {...base} citas={[...base.citas, una]} onReagendarCancelada={(c) => reagendadas.push(c.id)} />)
    expect(area("Citas")).not.toHaveTextContent("Paciente Cuatro") // la tarjetita no lleva nombres
    fireEvent.click(tarj("Citas", /1 cita por reagendar/))
    const ventana = screen.getByRole("dialog", { name: "1 cita por reagendar" })
    expect(ventana).toHaveTextContent("Paciente Cuatro")
    expect(ventana).toHaveTextContent("No efectuada")
    fireEvent.click(within(ventana).getByRole("button", { name: "Reagendar" }))
    expect(reagendadas).toEqual(["cn"])
    expect(screen.getByRole("dialog", { name: "1 cita por reagendar" })).toBeInTheDocument() // resolver un caso no cierra la lista
    unmount()
    const otra = { ...una, id: "cx", estado: "Cancelada", canceladaPor: "paciente", paciente: "Paciente Tres", pacienteId: "p3" }
    render(<Inicio {...base} citas={[...base.citas, una, otra]} onReagendarCancelada={(c) => reagendadas.push(c.id)} onVerCitas={(...a) => pedidos.push(a)} />)
    fireEvent.click(tarj("Citas", /2 citas por reagendar/))
    const dos = screen.getByRole("dialog", { name: "2 citas por reagendar" })
    expect(within(dos).getAllByRole("button", { name: "Reagendar" })).toHaveLength(2)
    expect(dos).toHaveTextContent("Canceló el paciente")
    fireEvent.click(within(dos).getByRole("button", { name: /^Abrir en Citas · Para reagendar \(2\)/ }))
    expect(pedidos).toEqual([["todas", "reagendar", undefined]])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument() // el enlace sale a Citas y cierra la ventana
  })

  it("Ventas incluye los saldos por cobrar; sus enlaces llevan a donde dicen y las áreas en orden llevan a su módulo", () => {
    const saldos = []
    const stock = []
    render(<Inicio {...base} onVerSaldos={() => saldos.push("saldos")} onVerStockBajo={() => stock.push("bajo")} onVerOrdenes={() => {}} />)
    fireEvent.click(tarj("Ventas", /ventas? con saldo/))
    const ventas = screen.getByRole("dialog", { name: /ventas? con saldo/ })
    expect(ventas).toHaveTextContent("1 venta con saldo · 1 paciente")
    expect(ventas).toHaveTextContent("Venta del") // cada caso con su detalle
    expect(ventas).toHaveTextContent("saldo $60.00")
    fireEvent.click(within(ventas).getByRole("button", { name: "Ver saldos" }))
    expect(saldos).toEqual(["saldos"])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument() // la acción que sale del Inicio cierra la ventana
    fireEvent.click(tarj("Inventario", /producto con stock bajo/))
    fireEvent.click(within(screen.getByRole("dialog", { name: /producto con stock bajo/ })).getByRole("button", { name: "Abrir en Inventario · Stock bajo (1)" }))
    expect(stock).toEqual(["bajo"])
    // «Ver todo» de un área con un solo tipo de aviso lleva al módulo ya filtrado, con el mismo número
    fireEvent.click(within(area("Inventario")).getByRole("button", { name: "Ver todo en Inventario" }))
    expect(stock).toEqual(["bajo", "bajo"])
  })

  it("el stock bajo sale una sola vez y su umbral viene de Configuración", () => {
    const { unmount } = render(<Inicio {...base} />)
    expect(screen.getAllByRole("button", { name: /producto con stock bajo/i })).toHaveLength(1)
    expect(screen.queryByText(/alertas? de stock bajo/i)).not.toBeInTheDocument()
    unmount()
    render(<Inicio {...base} umbralStock={50} />)
    expect(tarj("Inventario", /2 productos con stock bajo/)).toBeInTheDocument()
  })

  it("Control sin agendar: la línea abre el caso con su botón Agendar; la cita del control lo quita", () => {
    const consultas = [{ id: "k1", pacienteId: "p1", paciente: "Paciente Uno", fecha: hoy, motivo: "Control", proximoControlDias: 30, controlAgenda: "despues" }]
    const citasSinControl = base.citas.filter((c) => c.pacienteId !== "p1")
    const agendados = []
    const equipo = [{ id: "u7", nombre: "Ana" }]
    const { unmount } = render(<Inicio {...base} equipo={equipo} consultas={consultas.map((c) => ({ ...c, profesionalNombre: "Ana" }))} citas={citasSinControl} onAgendarControl={(p, f, a) => agendados.push([p.id, f, a])} />)
    expect(area("Citas")).not.toHaveTextContent("Paciente Uno")
    fireEvent.click(tarj("Citas", /1 control sin agendar/))
    const ventana = screen.getByRole("dialog", { name: "1 control sin agendar" })
    expect(ventana).toHaveTextContent("Control recomendado para el")
    fireEvent.click(within(ventana).getByRole("button", { name: "Agendar" }))
    expect(agendados).toHaveLength(1)
    expect(agendados[0][0]).toBe("p1")
    expect(agendados[0][2]).toBe("u7") // la cita se asigna por defecto a quien atendió la consulta
    unmount()
    const { unmount: u2 } = render(<Inicio {...base} consultas={consultas} citas={citasSinControl} {...rol("recepcion", PERMISOS_RECEPCION)} />)
    expect(screen.getByRole("button", { name: /control sin agendar/ })).toBeInTheDocument() // recepción también lo ve
    u2()
    const futura = { id: "c9", fecha: "2099-01-01", hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" }
    render(<Inicio {...base} consultas={consultas} citas={[...citasSinControl, futura]} />)
    sinTarj(/control sin agendar/)
  })

  it("pacientes de la web con datos sin verificar: la ventana ofrece 'Verificar datos (registro web)'; el optómetra no los ve", () => {
    const pacientes = [
      ...base.pacientes,
      { id: "p3", nombre: "Web Sin Confirmar", origen: "paciente", confirmadoRecepcion: false, cedula: "1710034065", telefono: "0991234567", correo: "w@x.com" },
      { id: "p4", nombre: "Web Ya Confirmado", origen: "paciente", confirmadoRecepcion: true },
      { id: "p5", nombre: "Registrado Por Recepción", origen: "staff", confirmadoRecepcion: true },
    ]
    const { unmount } = render(<Inicio {...base} pacientes={pacientes} />)
    const fila = area("Pacientes")
    expect(fila).not.toHaveTextContent(/Web Sin Confirmar|Web Ya Confirmado|Registrado Por Recepción/) // sin nombres en la tarjetita
    fireEvent.click(within(fila).getByRole("button", { name: /datos sin verificar/ }))
    const ventana = screen.getByRole("dialog", { name: /1 paciente de la web con los datos sin verificar/ })
    expect(ventana).toHaveTextContent("Web Sin Confirmar")
    expect(ventana).not.toHaveTextContent(/Web Ya Confirmado|Registrado Por Recepción/)
    expect(ventana).toHaveTextContent("Cédula 1710034065")
    fireEvent.click(within(ventana).getByRole("button", { name: "Verificar datos (registro web)" }))
    expect(screen.getByRole("dialog", { name: "Verificar datos del paciente (registro web)" })).toBeInTheDocument() // encima de la lista, que sigue abierta
    unmount()
    render(<Inicio {...base} pacientes={pacientes} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    sinTarj(/datos sin verificar/)
  })

  it("un paciente que pidió eliminar su cuenta desde el portal aparece en «Requiere tu atención» del administrador, con su motivo; el optómetra no lo ve", () => {
    const solicitudes = [{ id: "s1", pacienteId: "p2", motivo: "Ya no uso la óptica", estado: "pendiente", creadoEn: "2026-10-16T15:00:00Z" }]
    const { unmount } = render(<Inicio {...base} solicitudesEliminacion={solicitudes} />)
    const fila = area("Pacientes")
    expect(fila).not.toHaveTextContent("Paciente Dos")
    fireEvent.click(within(fila).getByRole("button", { name: /pidió eliminar su cuenta/ }))
    const ventana = screen.getByRole("dialog", { name: /1 paciente pidió eliminar su cuenta/ })
    expect(ventana).toHaveTextContent("Paciente Dos")
    expect(ventana).toHaveTextContent("Lo pidió el 16 oct 2026 · Motivo: Ya no uso la óptica")
    unmount()
    render(<Inicio {...base} solicitudesEliminacion={solicitudes} {...rol("optometra", PERMISOS_OPTOMETRA)} />)
    sinTarj(/pidió eliminar su cuenta/)
  })

  it("'N pacientes registrados sin ninguna consulta' abre sus casos y el enlace abre Pacientes ya filtrado con el mismo número", () => {
    const pedidos = []
    render(<Inicio {...base} onVerPacientes={(f) => pedidos.push(f)} />)
    fireEvent.click(tarj("Pacientes", /^1 paciente registrado sin ninguna consulta/))
    const ventana = screen.getByRole("dialog", { name: /1 paciente registrado sin ninguna consulta/ })
    expect(ventana).toHaveTextContent("Paciente Dos")
    fireEvent.click(within(ventana).getByRole("button", { name: "Abrir en Pacientes · Sin consulta (1)" }))
    expect(pedidos).toEqual([{ correccion: "Sin evaluación" }])
  })

  it("crear va en los atajos y las tarjetas de totales solo llevan a su lista", () => {
    const pedidos = []
    render(<Inicio {...base} setVista={(v) => pedidos.push(v)} onCrearPacienteRapido={() => pedidos.push("crear")} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    expect(within(totales).getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    fireEvent.click(within(totales).getByRole("button", { name: /^Pacientes:/ }))
    fireEvent.click(within(screen.getByRole("dialog", { name: "Pacientes" })).getByRole("button", { name: /^Abrir en Pacientes · Todos los pacientes/ })) // la tarjeta abre su ventana y la opción lleva al módulo
    fireEvent.click(within(totales).getByRole("button", { name: /Registrar paciente/ }))
    expect(pedidos).toEqual(["pacientes", "crear"])
  })

  it("sin nada pendiente: las cuatro tarjetas siguen ahí, del mismo tamaño, dicen 'Todo en orden' y ofrecen el mismo 'Ver todo' hacia su módulo", () => {
    const vistas = []
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} facturasVenta={[]} abonos={[]} setVista={(v) => vistas.push(v)} />)
    for (const nombre of ["Citas", "Pacientes", "Ventas", "Inventario"]) {
      expect(area(nombre)).toHaveTextContent("Todo en orden")
      fireEvent.click(within(area(nombre)).getByRole("button", { name: `Ver todo en ${nombre}` }))
    }
    expect(vistas).toEqual(["citas", "pacientes", "ventas", "inventario"])
  })

})

describe("Desenlace del administrador", () => {
  it("las canceladas van aparte y no hay una cuenta escrita que repita los números de las tarjetas", () => {
    const cancelada = { id: "cx", fecha: hoy, hora: "03:00 PM", estado: "Cancelada", canceladaPor: "paciente", paciente: "Paciente Tres", pacienteId: "p3" }
    render(<Inicio {...base} citas={[...base.citas, cancelada]} />)
    const region = screen.getByRole("region", { name: "Desenlace de las citas · hoy" })
    expect(region).toHaveTextContent("1 cancelada aparte")
    expect(region).not.toHaveTextContent(/citas? = /)
    expect(within(region).getByRole("button", { name: /^Atendidas: 1/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^No efectuadas: 0/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^Pendientes: 2/ })).toBeInTheDocument()
    expect(within(region).getByRole("button", { name: /^Canceladas: 1\. Aparte/ })).toBeInTheDocument()
  })

  it("las tarjetas del desenlace del administrador llevan a Citas con su mismo estado y período, y no hay lista debajo", () => {
    const llamadas = []
    render(<Inicio {...base} onVerCitas={(...a) => llamadas.push(a)} />)
    const region = screen.getByRole("region", { name: "Desenlace de las citas · hoy" })
    const tarjetas = within(region).getAllByRole("button", { name: /^(Atendidas|No efectuadas|Pendientes|Canceladas):/ })
    expect(tarjetas).toHaveLength(4)
    for (const t of tarjetas) expect(t).not.toHaveAttribute("aria-pressed") // ya no se «seleccionan»: se abren en Citas
    for (const nombre of [/^Atendidas:/, /^No efectuadas:/, /^Pendientes:/, /^Canceladas:/]) fireEvent.click(within(region).getByRole("button", { name: nombre }))
    fireEvent.click(within(region).getByRole("button", { name: "Ir a Citas" }))
    expect(llamadas).toEqual([["atendida", "hoy"], ["noAsistio", "hoy"], ["abiertas", "hoy"], ["cancelada", "hoy"], ["todas", "hoy"]])
    expect(screen.queryByRole("region", { name: "Citas del día" })).not.toBeInTheDocument()
  })

  it("cambia de período con el selector y lo dice en el título", () => {
    render(<Inicio {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Todas" }))
    expect(screen.getByRole("region", { name: "Desenlace de las citas · todas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true")
  })

  it("recepción: la tarjeta filtra la lista de abajo y el enlace lleva a Citas con el mismo estado y período, y dice qué abre", () => {
    const llamadas = []
    render(<Inicio {...base} {...rol("recepcion", PERMISOS_RECEPCION)} onVerCitas={(...a) => llamadas.push(a)} />)
    const lista = () => screen.getByRole("region", { name: /^(Citas del día|Todas las citas)$/ })
    expect(within(lista()).getByText("En espera")).toBeInTheDocument()
    expect(within(lista()).getByRole("button", { name: "Ver todas en Citas" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Atendidas:/ }))
    expect(screen.getByRole("button", { name: /^Atendidas:/ })).toHaveAttribute("aria-pressed", "true")
    expect(within(lista()).queryByText("En espera")).not.toBeInTheDocument()
    expect(within(lista()).getByText("Atendida")).toBeInTheDocument()
    fireEvent.click(within(lista()).getByRole("button", { name: "Ver atendidas en Citas" }))
    fireEvent.click(screen.getByRole("button", { name: /^Atendidas:/ })) // volver a tocarla la quita
    expect(within(lista()).getByText("En espera")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Todas" }))
    fireEvent.click(screen.getByRole("button", { name: /^Canceladas:/ }))
    expect(within(lista()).getByText("Ninguna cita con ese resultado en el período.")).toBeInTheDocument()
    expect(within(lista()).queryByRole("button", { name: /en Citas$/ })).not.toBeInTheDocument()
    expect(llamadas).toEqual([["atendida", "hoy"]])
  })

  it("recepción: Pendientes lista las que todavía no tienen desenlace (pendientes y en espera)", () => {
    render(<Inicio {...base} {...rol("recepcion", PERMISOS_RECEPCION)} />)
    fireEvent.click(screen.getByRole("button", { name: /^Pendientes:/ }))
    const lista = screen.getByRole("region", { name: "Citas del día" })
    expect(lista).toHaveTextContent("Citas del día · Pendientes")
    expect(within(lista).getByText("En espera")).toBeInTheDocument()
    expect(within(lista).getByText("Pendiente")).toBeInTheDocument()
    expect(within(lista).queryByText("Atendida")).not.toBeInTheDocument()
  })
})

describe("Inicio del optómetra", () => {
  it("primero el desenlace de sus citas, luego su día (siguiente paciente) y su agenda, y al final sus avisos; sin totales ni tarjeta de citas de hoy", () => {
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
    antes(desenlace, dia)
    antes(dia, agenda)
    antes(agenda, avisos)
    expect(screen.getByRole("group", { name: "Atajos" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Requiere tu atención: Ventas" })).not.toBeInTheDocument()
    expect(within(desenlace).getByRole("button", { name: /^Atendidas/ })).toBeInTheDocument() // igual que el administrador: la tarjeta abre su lista
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

  it("el siguiente paciente trae Atender y las fichas abiertas traen Retomar (su tarjeta y la fila de la agenda) o Ingresar (un día anterior, desde la ventana de avisos)", () => {
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
    const retomarBtns = screen.getAllByRole("button", { name: "Seguir atendiendo" })
    expect(retomarBtns).toHaveLength(2) // la tarjeta "Fichas sin terminar" y la fila de la agenda
    retomarBtns.forEach((b) => fireEvent.click(b))
    fireEvent.click(tarj("Citas", /atención abierta de un día anterior/))
    fireEvent.click(within(screen.getByRole("dialog", { name: /1 atención abierta de un día anterior/ })).getByRole("button", { name: "Seguir atendiendo" })) // la de un día anterior
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
    expect(tarj("Pacientes", "1 de tus pacientes con el control vencido")).toBeInTheDocument()
    sinTarj(/stock bajo/) // el inventario no es suyo, aunque pueda verlo
    expect(screen.queryByRole("region", { name: "Requiere tu atención: Inventario" })).not.toBeInTheDocument()
    sinTarj(/sin ninguna consulta/)
    fireEvent.click(within(area("Pacientes")).getByRole("button", { name: /de tus pacientes con el control vencido/ }))
    const ventana = screen.getByRole("dialog", { name: /de tus pacientes con el control vencido/ })
    expect(within(ventana).queryByRole("button", { name: "Ver en CRM" })).not.toBeInTheDocument() // sin permiso de CRM para escribir: solo ve al paciente
    expect(within(ventana).getByRole("button", { name: "Ver paciente" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Agregar producto/ })).not.toBeInTheDocument()
    unmount()
    render(<Inicio {...props} {...rol("optometra", { citas: ["ver"], inventario: ["ver", "crear", "editar"], crm: ["ver", "crear"], pacientes: ["ver"] })} />)
    fireEvent.click(within(area("Pacientes")).getByRole("button", { name: /de tus pacientes con el control vencido/ }))
    expect(within(screen.getByRole("dialog", { name: /de tus pacientes con el control vencido/ })).getByRole("button", { name: "Ver en CRM" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agregar producto/ })).toBeInTheDocument()
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
    expect(within(atencion).getByRole("button", { name: /1 orden atrasada/ })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Órdenes de laboratorio" })).not.toBeInTheDocument()
    expect(screen.getByText("Paciente Uno", { selector: "span" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /producto con stock bajo/i })).toHaveLength(1)
    expect(within(atencion).getByRole("button", { name: /1 venta con saldo · 1 paciente/ })).toBeInTheDocument()
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
