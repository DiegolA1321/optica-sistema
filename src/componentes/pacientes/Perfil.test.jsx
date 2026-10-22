import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import CabeceraPerfil from "./CabeceraPerfil"
import ResumenPerfil from "./ResumenPerfil"
import ComprasPerfil from "./ComprasPerfil"
import { VisitasPorPeriodo, LineaDeVisitas } from "./VisitasPerfil"

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
    expect(fila).toHaveTextContent("En el laboratorio")
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

describe("Gráficas de visitas", () => {
  const citas = [{ id: "1", fecha: "2023-03-01", estado: "Atendida" }, { id: "2", fecha: "2024-05-01", estado: "Atendida" }, { id: "3", fecha: "2026-10-21", estado: "No Asistió" }]
  it("la línea de tiempo pone un punto por cita, con su estado, y los años de los extremos", () => {
    render(<LineaDeVisitas citas={citas} onElegir={() => {}} />)
    expect(screen.getAllByRole("button")).toHaveLength(3)
    expect(screen.getByText("2023")).toBeInTheDocument()
    expect(screen.getByText("2026")).toBeInTheDocument()
    expect(screen.getByText(/verde atendida, rojo no efectuada/)).toBeInTheDocument()
  })
  it("«Visitas por año» cambia a «Por trimestre»", () => {
    render(<VisitasPorPeriodo citas={citas} />)
    expect(screen.getByRole("heading", { name: "Visitas por año" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Por trimestre" }))
    expect(screen.getByRole("heading", { name: "Visitas por trimestre" })).toBeInTheDocument()
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
