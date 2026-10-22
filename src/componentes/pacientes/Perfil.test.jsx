import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import CabeceraPerfil from "./CabeceraPerfil"
import ResumenPerfil from "./ResumenPerfil"
import ComprasPerfil from "./ComprasPerfil"
import { AsistenciaCitas, CicloControl } from "./TarjetasCitas"

const paciente = { id: "p1", nombre: "Diego Alarcón", cedula: "1314160654", telefono: "0980525195", correo: "diego@gmail.com", estadoClinico: "Activo", fechaRegistro: "2025-04-10", fecha_nacimiento: "1989-10-07" }
const pestanas = [{ id: "resumen", etiqueta: "Resumen" }, { id: "citas", etiqueta: "Citas", cuenta: 3 }, { id: "diagnostico", etiqueta: "Diagnóstico", cuenta: 2 }, { id: "pagos", etiqueta: "Compras" }]

describe("Cabecera del perfil", () => {
  const montar = (extra = {}) => render(<CabeceraPerfil paciente={paciente} edad="37 años" pestanas={pestanas} pestana="resumen" onPestana={() => {}} acciones={[{ id: "a", etiqueta: "Historia clínica", onClick: () => {} }, { id: "b", etiqueta: "Datos", onClick: () => {} }]} atender={<button type="button">Atender</button>} {...extra} />)

  it("el nombre y, en una línea debajo, documento, teléfono, correo y edad; sin «Activo» ni «Portal activo»", () => {
    montar()
    expect(screen.getByRole("heading", { name: "Diego Alarcón" })).toBeInTheDocument()
    const header = screen.getByRole("banner", { name: "Perfil del paciente" })
    expect(header).toHaveTextContent("Cédula 1314160654")
    expect(header).toHaveTextContent("0980525195")
    expect(header).toHaveTextContent("diego@gmail.com")
    expect(header).toHaveTextContent("37 años")
    expect(screen.queryByText("Activo")).not.toBeInTheDocument()
    expect(screen.queryByText(/Portal activo/)).not.toBeInTheDocument()
  })
  it("solo muestra una etiqueta cuando hay algo fuera de lo normal", () => {
    montar({ paciente: { ...paciente, estadoClinico: "De alta" } })
    expect(screen.getByText("Tratamiento finalizado")).toBeInTheDocument()
  })
  it("la pestaña activa se marca con aria-selected y el único botón de esa fila es Atender", () => {
    montar()
    const lista = screen.getByRole("tablist", { name: "Secciones del paciente" })
    expect(within(lista).getByRole("tab", { name: /Resumen/ })).toHaveAttribute("aria-selected", "true")
    expect(within(lista).getByRole("tab", { name: /Citas/ })).toHaveAttribute("aria-selected", "false")
    expect(within(lista).getByRole("tab", { name: /Citas/ })).toHaveTextContent("3")
    expect(screen.getByRole("button", { name: "Atender" })).toBeInTheDocument()
  })
  it("cambia de pestaña al pulsarla", () => {
    const onPestana = vi.fn()
    montar({ onPestana })
    fireEvent.click(screen.getByRole("tab", { name: /Compras/ }))
    expect(onPestana).toHaveBeenCalledWith("pagos")
  })
})

const fid = { nivel: { nombre: "Nuevo", desde: 0 }, siguiente: { nombre: "Frecuente", desde: 30, descuento: 5 }, faltan: 10, puntos: { total: 20 }, referidos: 0, programa: { porReferido: 15 }, diasCumple: 350, edad: 36, onCrm: () => {} }
const montarResumen = (extra = {}) => render(<ResumenPerfil paciente={paciente} pacientes={[paciente]} citas={[]} consultas={[]} compras={[]} avisos={[]} totales={{ sinMontos: false, nCompras: 2, comprado: 265, saldo: 25 }} fidelidad={fid} referidosLista={[]} {...extra} />)

describe("Resumen del perfil", () => {
  it("la franja: paciente desde, total comprado, saldo y cómo llegó (nunca vacío)", () => {
    montarResumen()
    const franja = screen.getByRole("region", { name: "Datos del paciente" })
    expect(franja).toHaveTextContent("Paciente desde")
    expect(franja).toHaveTextContent("abr 2025")
    expect(franja).toHaveTextContent("$265.00")
    expect(franja).toHaveTextContent("$25.00")
    expect(franja).toHaveTextContent("Por su cuenta")
    expect(franja).not.toHaveTextContent("Cumple") // la edad ya está en la cabecera
  })
  it("«Cómo llegó» dice referido por (con enlace a su perfil) o por la web", () => {
    const ana = { id: "a1", nombre: "Ana Ruiz" }
    const onAbrirPaciente = vi.fn()
    const { unmount } = montarResumen({ paciente: { ...paciente, referidoPorId: "a1", referidoPor: "Ana Ruiz" }, pacientes: [paciente, ana], onAbrirPaciente })
    fireEvent.click(screen.getByRole("button", { name: "Ana Ruiz" }))
    expect(onAbrirPaciente).toHaveBeenCalledWith(ana)
    unmount()
    montarResumen({ paciente: { ...paciente, origen: "paciente" } })
    expect(screen.getByRole("region", { name: "Datos del paciente" })).toHaveTextContent("Por la web")
  })
  it("los avisos son etiquetas con su acción y solo aquí", () => {
    const onClick = vi.fn()
    montarResumen({ avisos: [{ id: "c", tono: "ambar", texto: "Control sin agendar · 5 abr 2027", accion: { etiqueta: "Agendar", onClick } }] })
    const lista = screen.getByRole("list", { name: "Avisos del paciente" })
    expect(lista).toHaveTextContent("Control sin agendar · 5 abr 2027")
    fireEvent.click(within(lista).getByRole("button", { name: "Agendar" }))
    expect(onClick).toHaveBeenCalled()
  })
  it("el cumpleaños dice la edad que cumplirá y cuándo; la fidelización es compacta", () => {
    montarResumen()
    const f = screen.getByRole("region", { name: "Fidelización" })
    expect(f).toHaveTextContent("Cumplirá 37 · en 350 días")
    expect(f).toHaveTextContent("Nuevo · 20 pts")
    expect(f).toHaveTextContent("Faltan 10 para Frecuente (5 % de descuento)")
    expect(within(f).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "67")
    expect(f).toHaveTextContent("+15 pts por cada uno")
  })
  it("sin atenciones ni actividad dice qué pasa y ofrece agendar", () => {
    const onAgendar = vi.fn()
    montarResumen({ onAgendar })
    expect(screen.getByRole("region", { name: "Última atención" })).toHaveTextContent("Todavía no tiene una atención registrada")
    expect(screen.getAllByRole("button", { name: "Agendar cita" }).length).toBeGreaterThan(0)
  })
  it("la última atención muestra diagnóstico, receta, indicaciones y quién atendió", () => {
    montarResumen({ consultas: [{ id: "k1", fecha: "2026-10-07", diagnostico: "Astigmatismo", indicaciones: "usar lentes todo el día", profesionalNombre: "Paula Andrade", od: { esfera: "0.25", cilindro: "-0.75", eje: "10" }, oi: { esfera: "0.25", cilindro: "-1.00", eje: "170" } }] })
    const u = screen.getByRole("region", { name: "Última atención" })
    expect(u).toHaveTextContent("Astigmatismo")
    expect(u).toHaveTextContent("OI +0.25 −1.00 × 170 · OD +0.25 −0.75 × 10")
    expect(u).toHaveTextContent("Atendió: Paula Andrade · 7 oct 2026")
  })
})

describe("Compras del perfil", () => {
  const factura = { id: "f1", numero: 21, estado: "pendiente_pago", montoTotal: 265, creadoEn: "2026-10-08T15:00:00Z", lineas: [{ descripcion: "Lentes progresivos" }, { descripcion: "Montura Ray-Ban" }] }
  const props = { comprobantes: [{ clave: "factura-f1", factura }], abonos: [{ id: "a1", facturaId: "f1", monto: 120, fecha: "2026-10-09" }], ordenes: [{ id: "o1", facturaId: "f1", estado: "enviada" }], totales: { sinMontos: false, n: 1, comprado: 265, saldo: 145, anuladas: 0 }, puedeVender: true }
  it("el título con la cuenta y «+ Nueva venta», y a la derecha el total comprado y el saldo", () => {
    const onNuevaVenta = vi.fn()
    render(<ComprasPerfil {...props} onNuevaVenta={onNuevaVenta} onAbrir={() => {}} />)
    const s = screen.getByRole("region", { name: "Compras del paciente" })
    expect(s).toHaveTextContent("Compras · 1")
    expect(s).toHaveTextContent("Total comprado $265.00")
    expect(s).toHaveTextContent("Saldo $145.00")
    fireEvent.click(screen.getByRole("button", { name: "+ Nueva venta" }))
    expect(onNuevaVenta).toHaveBeenCalled()
  })
  it("cada compra en columnas: fecha, compra con su detalle, lentes, total y pago; al pulsarla abre su detalle", () => {
    const onAbrir = vi.fn()
    render(<ComprasPerfil {...props} onAbrir={onAbrir} />)
    const fila = screen.getByRole("list").querySelector("li")
    expect(fila).toHaveTextContent("Lentes progresivos · CV-0021")
    expect(fila).toHaveTextContent("Montura Ray-Ban")
    expect(fila).toHaveTextContent("En proceso")
    expect(fila).toHaveTextContent("$265.00")
    expect(fila).toHaveTextContent("Debe $145.00")
    fireEvent.click(screen.getByRole("button", { name: /Ver la compra/ }))
    expect(onAbrir).toHaveBeenCalledWith(factura)
  })
  it("sin compras lo dice y no repite el texto de «Listo para venta»", () => {
    render(<ComprasPerfil {...props} comprobantes={[]} totales={{ ...props.totales, n: 0, comprado: 0, saldo: 0 }} onAbrir={() => {}} />)
    expect(screen.getByText("Este paciente todavía no tiene compras registradas.")).toBeInTheDocument()
    expect(document.body.textContent).not.toContain("Listo para venta")
  })
})

const cita = (id, fecha, estado) => ({ id, fecha, estado, hora: "10:00 AM", motivo: "Examen de control" })
describe("Asistencia a sus citas", () => {
  const citas = [cita(1, "2026-10-07", "Atendida"), cita(2, "2026-10-21", "No Asistió"), cita(3, "2026-04-20", "No Asistió")]
  it("dice «N de M citas atendidas (X %)», la leyenda con los pendientes y la alerta de dos faltas con «Contactar»", () => {
    const onContactar = vi.fn()
    render(<AsistenciaCitas citas={citas} faltas={[citas[1], citas[2]]} onFiltro={() => {}} onContactar={onContactar} />)
    const t = screen.getByRole("region", { name: "Asistencia a sus citas" })
    expect(t).toHaveTextContent("1 de 3 citas atendidas (33 %)")
    for (const x of ["1 atendida", "2 no efectuadas", "0 canceladas", "0 pendientes"]) expect(t).toHaveTextContent(x)
    expect(screen.getByRole("alert")).toHaveTextContent("Faltó a sus 2 últimas citas.")
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    expect(onContactar).toHaveBeenCalledTimes(1)
  })
  it("pulsar la tarjeta abre el detalle; los puntos de la leyenda filtran el historial; «Contactar» no activa la tarjeta", () => {
    const onFiltro = vi.fn()
    const onAbrir = vi.fn()
    render(<AsistenciaCitas citas={citas} faltas={[citas[1], citas[2]]} onFiltro={onFiltro} onAbrir={onAbrir} onContactar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /ver el detalle/ }))
    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(onFiltro).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "2 no efectuadas" }))
    expect(onFiltro).toHaveBeenLastCalledWith("noEfectuadas")
    expect(onAbrir).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    expect(onAbrir).toHaveBeenCalledTimes(1)
  })
  it("sin faltas seguidas no hay alerta y sin permiso para contactar no hay botón", () => {
    const { rerender } = render(<AsistenciaCitas citas={[cita(1, "2026-10-07", "Atendida")]} onFiltro={() => {}} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    rerender(<AsistenciaCitas citas={citas} faltas={[citas[1], citas[2]]} onFiltro={() => {}} />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Contactar" })).not.toBeInTheDocument()
  })
})

describe("Su ciclo de control", () => {
  const ciclo = { diasParaControl: 165, avance: 8, vencido: false }
  const inicio = { etiqueta: "Última consulta", fecha: "2026-10-07" }
  it("los días para el control, la barra con las dos fechas, el promedio y «Agendar control»", () => {
    const onAgendar = vi.fn()
    render(<CicloControl ciclo={ciclo} inicio={inicio} controlISO="2027-04-05" promedioMeses={6} onAgendar={onAgendar} onAbrir={() => {}} />)
    const t = screen.getByRole("region", { name: "Su ciclo de control" })
    expect(t).toHaveTextContent("165 días para su próximo control")
    expect(t).toHaveTextContent("Última consulta · 7 oct 2026")
    expect(t).toHaveTextContent("Control · 5 abr 2027")
    expect(t).toHaveTextContent("Viene en promedio cada 6 meses · aún sin cita agendada")
    expect(within(t).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "8")
    fireEvent.click(within(t).getByRole("button", { name: "Agendar control" }))
    expect(onAgendar).toHaveBeenCalledTimes(1)
  })
  it("con una sola consulta no dice el promedio y con cita agendada no ofrece agendar", () => {
    render(<CicloControl ciclo={ciclo} inicio={inicio} controlISO="2027-04-05" promedioMeses={null} citaPendiente={{ fecha: "2027-04-01" }} onAgendar={() => {}} onAbrir={() => {}} />)
    const t = screen.getByRole("region", { name: "Su ciclo de control" })
    expect(t).not.toHaveTextContent("Viene en promedio")
    expect(t).toHaveTextContent("ya tiene cita agendada el 1 abr 2027")
    expect(within(t).queryByRole("button", { name: "Agendar control" })).not.toBeInTheDocument()
  })
  it("sin control recomendado lo dice y muestra solo su última consulta", () => {
    render(<CicloControl ciclo={null} inicio={inicio} controlISO="" onAbrir={() => {}} />)
    const t = screen.getByRole("region", { name: "Su ciclo de control" })
    expect(t).toHaveTextContent("Sin control recomendado")
    expect(t).toHaveTextContent("Última consulta · 7 oct 2026")
    expect(within(t).queryByRole("progressbar")).not.toBeInTheDocument()
  })
  it("vencido: dice los días de retraso", () => {
    render(<CicloControl ciclo={{ diasParaControl: -30, avance: 100, vencido: true }} inicio={inicio} controlISO="2026-09-01" onAgendar={() => {}} onAbrir={() => {}} />)
    expect(screen.getByRole("region", { name: "Su ciclo de control" })).toHaveTextContent("30 días de retraso en su control")
  })
})

describe("Cabecera sin edad", () => {
  it("sin edad no dice «0 años» ni deja un separador vacío", () => {
    render(<CabeceraPerfil paciente={{ ...paciente, correo: "" }} edad="" pestanas={pestanas} pestana="resumen" onPestana={() => {}} />)
    const t = screen.getByRole("banner").textContent
    expect(t).not.toMatch(/años|0 año/)
    expect(t).not.toMatch(/·\s*·/)
  })
})

describe("Ventana de asistencia", () => {
  const citas = [
    { id: "a", fecha: "2026-10-07", hora: "10:00 AM", estado: "Atendida", motivo: "Consulta general", atendidoPor: "u1" },
    { id: "b", fecha: "2026-10-21", hora: "09:00 AM", estado: "No Asistió", motivo: "Examen de control" },
    { id: "c", fecha: "2026-09-01", hora: "09:00 AM", estado: "Cancelada", motivo: "Control", canceladaPor: "paciente" },
    { id: "d", fecha: "2026-12-01", hora: "09:00 AM", estado: "Pendiente", motivo: "Control" },
  ]
  it("agrupa las citas por estado, dice por qué no se efectuó o se canceló y ofrece «Contactar»", async () => {
    const { default: VentanaAsistencia } = await import("./VentanaAsistencia")
    const onContactar = vi.fn()
    render(<VentanaAsistencia paciente={paciente} citas={citas} equipo={[{ id: "u1", nombre: "Paula Andrade" }]} onContactar={onContactar} onCerrar={() => {}} />)
    const v = screen.getByRole("dialog", { name: "Asistencia a sus citas" })
    for (const g of ["Atendidas · 1", "No efectuadas · 1", "Canceladas · 1", "Pendientes · 1"]) expect(v).toHaveTextContent(g)
    expect(within(v.querySelector('section[aria-label="No efectuadas"]')).getByText("El paciente no asistió")).toBeInTheDocument()
    expect(within(v.querySelector('section[aria-label="Canceladas"]')).getByText("El paciente canceló su cita")).toBeInTheDocument()
    expect(v).toHaveTextContent("Todavía no se le ha escrito desde el CRM.")
    fireEvent.click(within(v).getByRole("button", { name: "Contactar" }))
    expect(onContactar).toHaveBeenCalledTimes(1)
  })
  it("sin permiso para contactar no hay botón", async () => {
    const { default: VentanaAsistencia } = await import("./VentanaAsistencia")
    render(<VentanaAsistencia paciente={paciente} citas={citas} onCerrar={() => {}} />)
    expect(screen.queryByRole("button", { name: "Contactar" })).not.toBeInTheDocument()
  })
})

describe("Ciclo de control: «Hoy» nunca se encima con las fechas", () => {
  const inicio = { etiqueta: "Última consulta", fecha: "2026-10-07" }
  it("«Hoy» va arriba de la barra, en su marca, y las dos fechas debajo, en otra línea", () => {
    for (const avance of [0, 3, 50, 97, 100]) {
      const { container, unmount } = render(<CicloControl ciclo={{ diasParaControl: 10, avance, vencido: false }} inicio={inicio} controlISO="2027-04-05" onAbrir={() => {}} />)
      const hoy = [...container.querySelectorAll("span")].find((e) => e.textContent === "Hoy")
      const barra = container.querySelector('[role="progressbar"]')
      const fechas = [...container.querySelectorAll("span")].filter((e) => /^(Última consulta|Control) · /.test(e.textContent))
      expect(hoy.style.left).toBe(`${avance}%`)
      // en el documento: «Hoy» antes de la barra y las fechas después (otra línea distinta a la de «Hoy»)
      expect(hoy.compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      for (const f of fechas) expect(barra.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(fechas).toHaveLength(2)
      expect(hoy.parentElement).not.toBe(fechas[0].parentElement)
      unmount()
    }
  })
})
