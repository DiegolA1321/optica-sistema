import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { ProveedorFidelidad, armarFidelidad } from "../componentes/FidelidadContexto"
import { ProveedorLaboratorios, armarLaboratorios } from "../componentes/LaboratoriosContexto"
import { PROGRAMA_POR_DEFECTO } from "../utilidades/programaFidelidad"

const PACIENTES = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101" }]
const PRODUCTO = { id: "x1", nombre: "Armazón Test", stock: 3, precio: 40 }
const total = (valor) => screen.getByLabelText(`Total ${valor}`)

describe("ComprobanteVentaModal — panel de cobro único", () => {
  it("sin paciente fijo pide elegir uno, y la línea precargada del producto aparece", () => {
    render(
      <ComprobanteVentaModal
        usuario={{}}
        inventario={[PRODUCTO]}
        pacientes={PACIENTES}
        lineasIniciales={[{ tipo: "producto", productoId: "x1", cantidad: 1 }]}
        onCerrar={() => {}}
      />
    )
    expect(screen.getByText("Armazón Test")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByText(/Selecciona el paciente de esta venta/i)).toBeInTheDocument()

    fireEvent.focus(screen.getByLabelText("Paciente"))
    fireEvent.click(screen.getByText("Ana Prueba"))
    expect(screen.getByRole("button", { name: /Cambiar paciente/i })).toBeInTheDocument()
    expect(screen.getByText("Ana Prueba · 0101010101")).toBeInTheDocument()
  })

  it("con 'Más tarde' el botón secundario cambia y el precio del servicio es editable", () => {
    render(
      <ComprobanteVentaModal
        usuario={{}}
        pacienteFijo={PACIENTES[0]}
        lineasIniciales={[{ tipo: "servicio", descripcion: "Consulta", cantidad: 1, precioUnitario: 15 }]}
        etiquetaGuardar="Cobrar y finalizar"
        onMasTarde={() => {}}
        onCerrar={() => {}}
      />
    )
    expect(screen.getByRole("button", { name: "Más tarde" })).toBeInTheDocument()
    const precio = screen.getByLabelText(/Precio de Consulta/i)
    fireEvent.change(precio, { target: { value: "0" } })
    expect(precio).toHaveValue(0)
    expect(total("$0.00")).toBeInTheDocument()
  })

  it("el título y el subtítulo son los del diseño, y no hay casilla «Esta venta incluye lentes» ni campo de factura electrónica", () => {
    render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    expect(screen.getByRole("dialog", { name: /Nueva venta/ })).toBeInTheDocument()
    expect(screen.getByText("Montura, lunas y servicios")).toBeInTheDocument()
    expect(screen.queryByLabelText(/Esta venta incluye lentes/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Factura electrónica/i)).not.toBeInTheDocument()
  })
})

describe("ComprobanteVentaModal — montura, luna y servicio", () => {
  it("las tres pestañas se ven con su color completo (el fondo y el borde del mismo tono) y la lupa va dentro del campo de búsqueda", () => {
    render(<ComprobanteVentaModal usuario={{}} inventario={[PRODUCTO]} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    const grupo = screen.getByRole("group", { name: "Qué se agrega a la venta" })
    expect(within(grupo).getAllByRole("button").map((b) => b.textContent)).toEqual(["Montura", "Luna", "Servicio"])
    const montura = within(grupo).getByRole("button", { name: "Montura" })
    expect(montura).toHaveAttribute("aria-pressed", "true")
    expect(montura.style.backgroundColor).toBe(montura.style.borderColor)
    fireEvent.click(within(grupo).getByRole("button", { name: "Luna" }))
    const luna = within(grupo).getByRole("button", { name: "Luna" })
    expect(luna.style.backgroundColor).toBe(luna.style.borderColor)
    expect(luna.style.backgroundColor).not.toBe("")
    fireEvent.click(within(grupo).getByRole("button", { name: "Montura" }))
    const campo = screen.getByPlaceholderText("Buscar montura o accesorio en stock")
    expect(campo.parentElement.querySelector("svg")).not.toBeNull() // la lupa comparte el cuadro del campo
  })

  it("un producto elegido en la lista entra con 1 unidad, y su cantidad se cambia en su fila sin pasar del stock", () => {
    render(<ComprobanteVentaModal usuario={{}} inventario={[PRODUCTO]} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    fireEvent.focus(screen.getByPlaceholderText("Buscar montura o accesorio en stock"))
    fireEvent.click(screen.getByRole("button", { name: /Armazón Test/ }))
    expect(screen.getByRole("list", { name: "Detalle de la venta" })).toHaveTextContent("Armazón Test")
    expect(total("$40.00")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Cantidad de Armazón Test"), { target: { value: "9" } })
    expect(screen.getByLabelText("Cantidad de Armazón Test")).toHaveValue(3) // hay 3
    expect(total("$120.00")).toBeInTheDocument()
  })

  it("agrega una línea de luna con su precio, sin tocar el inventario, y avisa que se creará el pedido de lentes", () => {
    render(<ComprobanteVentaModal usuario={{}} inventario={[PRODUCTO]} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    expect(screen.queryByText(/se creará el pedido de lentes/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Luna" }))
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "CR-39" } })
    fireEvent.click(screen.getByLabelText("Antirreflejo"))
    fireEvent.change(screen.getByLabelText("Precio de la luna"), { target: { value: "55" } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar luna/i }))
    expect(screen.getByText("Luna: Monofocal · CR-39 · antirreflejo")).toBeInTheDocument()
    expect(total("$55.00")).toBeInTheDocument()
    expect(screen.getByText("Incluye lunas: se creará el pedido de lentes.")).toBeInTheDocument()
  })

  it("con lunas se elige el laboratorio del catálogo de la óptica; sin catálogo dice dónde agregarlos", () => {
    const luna = [{ tipo: "luna", descripcion: "Luna: Progresivo", cantidad: 1, precioUnitario: 180 }]
    const catalogo = armarLaboratorios({ laboratorios: [{ nombre: "Visión Norte", activo: true }, { nombre: "Óptica Lab", activo: true }, { nombre: "Viejo Lab", activo: false }] })
    const { unmount } = render(<ProveedorLaboratorios value={catalogo}><ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={luna} onCerrar={() => {}} /></ProveedorLaboratorios>)
    const select = screen.getByLabelText("Laboratorio del pedido de lentes")
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Elegir", "Visión Norte", "Óptica Lab"]) // el desactivado no se ofrece
    unmount()
    render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={luna} onCerrar={() => {}} />)
    expect(screen.getByText(/Configuración → Laboratorios/)).toBeInTheDocument()
  })

  it("no ofrece un producto descontinuado", () => {
    render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} inventario={[{ ...PRODUCTO, activo: false }]} onCerrar={() => {}} />)
    fireEvent.focus(screen.getByPlaceholderText(/Buscar montura o accesorio/i))
    expect(screen.queryByText("Armazón Test")).not.toBeInTheDocument()
  })
})

describe("ComprobanteVentaModal — último diagnóstico y «Usar como guía»", () => {
  const consultas = [
    { id: "c0", pacienteId: "p1", fecha: "2026-01-10", diagnostico: "Hipermetropía", lenteRecomendado: "Monofocal" },
    { id: "c1", pacienteId: "p1", fecha: "2026-10-07", diagnosticoCategorias: ["Miopía", "Astigmatismo"], lenteRecomendado: "Progresivo con filtro azul y antirreflejo" },
  ]
  const abrir = (extra = {}) => render(<ComprobanteVentaModal usuario={{}} pacientes={PACIENTES} consultas={consultas} onCerrar={() => {}} {...extra} />)

  it("al elegir al paciente aparece su último diagnóstico (el más reciente) con «Usar como guía»", () => {
    abrir()
    expect(screen.queryByText(/Último diagnóstico/)).not.toBeInTheDocument()
    fireEvent.focus(screen.getByLabelText("Paciente"))
    fireEvent.click(screen.getByText("Ana Prueba"))
    expect(screen.getByText(/Último diagnóstico \(7 oct\):/)).toBeInTheDocument()
    expect(screen.getByText(/Miopía, Astigmatismo · Progresivo con filtro azul y antirreflejo/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Usar como guía" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tomar datos del diagnóstico/ })).not.toBeInTheDocument()
  })

  it("«Usar como guía» lleva el tipo de luna y sus filtros a la venta", async () => {
    abrir({ pacienteFijo: PACIENTES[0] })
    fireEvent.click(screen.getByRole("button", { name: "Usar como guía" }))
    expect(await screen.findByText("Usado como guía")).toBeInTheDocument()
    expect(screen.getByLabelText("Tipo")).toHaveValue("progresivo")
    expect(screen.getByLabelText("Filtro azul")).toBeChecked()
    expect(screen.getByLabelText("Antirreflejo")).toBeChecked()
    expect(screen.getByLabelText("Fotocromático")).not.toBeChecked()
  })

  it("una solicitud del portal pendiente se toma al usar la guía, y si no se puede tomar, la guía no se aplica", async () => {
    const pases = [{ id: "ps", pacienteId: "p1", consultaId: "c1", estado: "listo", origen: "portal" }]
    const tomadas = []
    abrir({ pacienteFijo: PACIENTES[0], pases, onTomarSolicitud: async (p) => { tomadas.push(p.id); return false } })
    fireEvent.click(screen.getByRole("button", { name: "Usar como guía" }))
    await Promise.resolve()
    expect(tomadas).toEqual(["ps"])
    expect(screen.queryByText("Usado como guía")).not.toBeInTheDocument()
  })

  it("sin consultas del paciente no hay banner", () => {
    abrir({ pacienteFijo: PACIENTES[0], consultas: [] })
    expect(screen.queryByText(/Último diagnóstico/)).not.toBeInTheDocument()
  })
})

describe("ComprobanteVentaModal — descuentos y pagos divididos (Ventas v2)", () => {
  const servicio = [{ tipo: "servicio", descripcion: "Consulta", cantidad: 2, precioUnitario: 50 }]
  const abrir = (extra = {}) => render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} {...extra} />)

  it("un descuento en porcentaje baja el total y deja ver el subtotal", () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: /Descuento a esta línea/i }))
    fireEvent.change(screen.getByLabelText("Valor del descuento de Consulta"), { target: { value: "10" } })
    expect(total("$90.00")).toBeInTheDocument()
    expect(screen.getByText(/Subtotal/)).toBeInTheDocument()
    expect(screen.getByText("-$10.00", { selector: "span.font-mono" })).toBeInTheDocument()
  })
  it("el descuento exige su motivo antes de guardar", () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: /Descuento a esta línea/i }))
    fireEvent.change(screen.getByLabelText("Valor del descuento de Consulta"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByRole("alert")).toHaveTextContent(/motivo del descuento/i)
  })
  it("quien no puede editar Ventas no ve el descuento", () => {
    abrir({ usuario: { rol: "asistente", permisosNivel: { ventas: ["ver", "crear"] } } })
    expect(screen.queryByRole("button", { name: /Descuento a esta línea/i })).not.toBeInTheDocument()
  })
  it("dividir el pago reparte el total y avisa si no cuadra", () => {
    abrir()
    expect(screen.getByLabelText("Método de pago")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Dividir el pago/i }))
    expect(screen.getByLabelText("Monto del pago 1")).toHaveValue(50)
    expect(screen.getByLabelText("Monto del pago 2")).toHaveValue(50)
    expect(screen.getByText("Todo repartido")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Monto del pago 1"), { target: { value: "70" } })
    expect(screen.getByText("Se pasa $20.00")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Las formas de pago se pasan en $20.00.")
    fireEvent.change(screen.getByLabelText("Monto del pago 1"), { target: { value: "60" } })
    fireEvent.change(screen.getByLabelText("Monto del pago 2"), { target: { value: "30" } })
    expect(screen.getByText("Faltan $10.00")).toBeInTheDocument()
  })
  it("«Pago hoy» arranca en el total y sigue al total; con menos, el resto queda como saldo y el pago de hoy también se puede dividir", () => {
    abrir()
    expect(screen.getByLabelText("Pago hoy")).toHaveValue(100)
    fireEvent.click(screen.getByRole("button", { name: /Descuento a esta línea/i }))
    fireEvent.change(screen.getByLabelText("Valor del descuento de Consulta"), { target: { value: "10" } })
    expect(screen.getByLabelText("Pago hoy")).toHaveValue(90) // sigue al total mientras no se toque
    fireEvent.change(screen.getByLabelText("Pago hoy"), { target: { value: "30" } })
    expect(screen.getByText("Quedan $60.00 por cobrar: la venta queda con saldo y se cobra con abonos.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Dividir el pago/i }))
    expect(screen.getByLabelText("Monto del pago 1")).toHaveValue(15)
    expect(screen.getByLabelText("Monto del pago 2")).toHaveValue(15)
  })
  it("con «Pago hoy» en 0 no se pide forma de pago y toda la venta queda con saldo; no puede pasar del total", () => {
    abrir()
    fireEvent.change(screen.getByLabelText("Pago hoy"), { target: { value: "0" } })
    expect(screen.queryByLabelText("Método de pago")).not.toBeInTheDocument()
    expect(screen.getByText(/No se cobra nada hoy: toda la venta \(\$100\.00\) queda con saldo/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Pago hoy"), { target: { value: "150" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("El pago de hoy no puede pasar del total ($100.00).")
  })
})

describe("ComprobanteVentaModal — descuento sugerido por el nivel de fidelización", () => {
  const servicio = [{ tipo: "servicio", descripcion: "Consulta", cantidad: 2, precioUnitario: 50 }]
  // Cuatro consultas = 40 puntos: nivel Frecuente (desde 30) con 5 % de descuento sugerido.
  const consultas = [1, 2, 3, 4].map((n) => ({ id: "c" + n, pacienteId: "p1", fecha: "2026-0" + n + "-10" }))
  const fidelidad = armarFidelidad({ programa: PROGRAMA_POR_DEFECTO, pacientes: PACIENTES, consultas, facturas: [], abonos: [] })
  const abrir = (usuario) => render(<ProveedorFidelidad value={fidelidad}><ComprobanteVentaModal usuario={usuario} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} /></ProveedorFidelidad>)

  it("quien puede hacer descuentos ve el nivel del cliente y lo aplica a todas las líneas, con su motivo", () => {
    abrir({})
    expect(screen.getByText("Frecuente · 5 % sugerido")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Aplicar descuento" }))
    expect(total("$95.00")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Fidelización: nivel Frecuente")).toBeInTheDocument()
    expect(screen.getByText("Ya hay descuentos en esta venta")).toBeInTheDocument()
  })

  it("quien no tiene permiso de descuentos en Ventas no ve la sugerencia", () => {
    abrir({ rol: "asistente", permisosNivel: { ventas: ["ver", "crear"] } })
    expect(screen.queryByText(/% sugerido/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Aplicar descuento" })).not.toBeInTheDocument()
  })

  it("un cliente de nivel Nuevo (sin descuento) no ve ninguna sugerencia", () => {
    const poco = armarFidelidad({ programa: PROGRAMA_POR_DEFECTO, pacientes: PACIENTES, consultas: consultas.slice(0, 1), facturas: [], abonos: [] })
    render(<ProveedorFidelidad value={poco}><ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} /></ProveedorFidelidad>)
    expect(screen.queryByText(/% sugerido/)).not.toBeInTheDocument()
  })
})
