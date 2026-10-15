import React, { useState } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"

// Sin base de datos: la pantalla trabaja en memoria (las pruebas nunca tocan una base real aunque haya un .env.local).
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
import Inventario from "./Inventario"

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const soloVer = { id: "u2", rol: "asistente", nombre: "Vera", opticaId: "o1", permisosNivel: { inventario: ["ver"] } }
const ahora = new Date().toISOString()
const producto = (id, nombre, stock, extra = {}) => ({ id, nombre, categoria: "Montura", stock, precio: 10, creadoEn: ahora, activo: true, ...extra })

// La pantalla con su estado, como la monta el sistema.
function Con({ inicial, usuario = admin, ...props }) {
  const [inv, setInv] = useState(inicial)
  return <Inventario usuario={usuario} inventario={inv} setInventario={setInv} categorias={["Montura", "Accesorios"]} {...props} />
}
const filaDe = (nombre) => screen.getByRole("button", { name: `Ver el detalle de ${nombre}` })

describe("Inventario", () => {
  it("se llama 'Inventario', sus ítems son 'productos' y el botón es 'Agregar producto'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    expect(screen.getByRole("heading", { level: 1, name: "Inventario" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agregar producto/ })).toBeInTheDocument()
    expect(screen.getByText("Valor del inventario")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/bodega/i)
  })

  it("usa un solo nombre, 'Montura', y nunca 'Armazón'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    expect(document.body.textContent).toMatch(/Montura/)
    expect(document.body.textContent).not.toMatch(/armaz[oó]n|armazones/i)
    expect(screen.getByText(/Existencias de monturas y accesorios/)).toBeInTheDocument()
  })

  it("sin productos no ofrece filtros y dice que no hay productos en el inventario", () => {
    render(<Con inicial={[]} />)
    expect(screen.queryByRole("button", { name: /Nuevos este mes/ })).not.toBeInTheDocument()
    expect(screen.getByText("No hay productos en el inventario.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Agregar el primero" })).toBeInTheDocument()
  })

  it("todos los filtros muestran su número, y el número es lo que lista", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5), producto("b", "Montura 2", 8), producto("c", "Estuche", 20, { categoria: "Accesorios" })]} />)
    const filtros = screen.getByRole("group", { name: "Filtros" })
    expect(within(filtros).getByRole("button", { name: "Todas (3)" })).toBeInTheDocument()
    expect(within(filtros).getByRole("button", { name: "Montura (2)" })).toBeInTheDocument()
    expect(within(filtros).getByRole("button", { name: "Accesorios (1)" })).toBeInTheDocument()
    expect(within(filtros).getByRole("button", { name: "Nuevos este mes (3)" })).toBeInTheDocument()
    fireEvent.click(within(filtros).getByRole("button", { name: "Montura (2)" }))
    expect(screen.getByText("Mostrando 2 de 2")).toBeInTheDocument()
    fireEvent.click(within(filtros).getByRole("button", { name: "Accesorios (1)" }))
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
  })

  it("los números de los filtros siguen a la búsqueda", () => {
    render(<Con inicial={[producto("a", "Montura roja", 5), producto("b", "Montura negra", 8), producto("c", "Estuche rojo", 20, { categoria: "Accesorios" })]} />)
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar producto" }), { target: { value: "rojo" } })
    const filtros = screen.getByRole("group", { name: "Filtros" })
    expect(within(filtros).getByRole("button", { name: "Todas (1)" })).toBeInTheDocument()
    expect(within(filtros).getByRole("button", { name: "Montura (0)" })).toBeInTheDocument()
    expect(within(filtros).getByRole("button", { name: "Accesorios (1)" })).toBeInTheDocument()
  })

  it("busca también por código, marca y color", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { codigo: "RB-3025", marca: "Ray" }), producto("b", "Montura 2", 8, { color: "Carey" })]} />)
    const caja = screen.getByRole("textbox", { name: "Buscar producto" })
    fireEvent.change(caja, { target: { value: "rb-3025" } })
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
    fireEvent.change(caja, { target: { value: "carey" } })
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
  })
})

describe("Inventario: las tarjetas de arriba se comportan igual", () => {
  const datos = [producto("a", "Montura 1", 5, { costo: 4, precio: 10 }), producto("b", "Montura 2", 50, { precio: 20 }), producto("c", "Estuche", 30, { categoria: "Accesorios", precio: 2, costo: 1 }), producto("d", "Vieja", 7, { activo: false })]
  const tarjeta = (nombre) => screen.getByRole("button", { name: new RegExp("^" + nombre + ":") })

  it("son cuatro, todas se pulsan, y su número cuenta solo los productos activos", () => {
    render(<Con inicial={datos} umbralStock={10} />)
    expect(tarjeta("Productos")).toHaveAccessibleName(/Productos: 3/)
    expect(tarjeta("Unidades en stock")).toHaveAccessibleName(/Unidades en stock: 85/)
    expect(tarjeta("Valor del inventario")).toHaveAccessibleName(/Valor del inventario: \$1,110\.00/)
    expect(tarjeta("Stock bajo")).toHaveAccessibleName(/Stock bajo: 1/)
  })

  it("'Stock bajo' filtra la tabla (y se quita con otro clic o con Limpiar) y 'Productos' la muestra completa", () => {
    render(<Con inicial={datos} umbralStock={10} />)
    fireEvent.click(tarjeta("Stock bajo"))
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
    expect(tarjeta("Stock bajo")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }))
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument()
    expect(tarjeta("Stock bajo")).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(tarjeta("Stock bajo"))
    fireEvent.click(tarjeta("Stock bajo"))
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument()
    fireEvent.click(tarjeta("Stock bajo"))
    fireEvent.click(tarjeta("Productos"))
    expect(screen.getByText("Mostrando 3 de 3")).toBeInTheDocument()
  })

  it("'Unidades en stock' y 'Valor del inventario' abren su detalle en la ventana estándar, por categoría", () => {
    render(<Con inicial={datos} umbralStock={10} />)
    fireEvent.click(tarjeta("Unidades en stock"))
    let ventana = screen.getByRole("dialog", { name: "Unidades en stock" })
    expect(within(ventana).getByText("Montura")).toBeInTheDocument()
    expect(within(ventana).getByText("55")).toBeInTheDocument() // 5 + 50
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(tarjeta("Valor del inventario"))
    ventana = screen.getByRole("dialog", { name: "Valor del inventario" })
    expect(within(ventana).getAllByText("A precio de venta").length).toBeGreaterThan(0)
    expect(within(ventana).getAllByText("A costo").length).toBeGreaterThan(0)
  })

  it("cada fila de la ventana lleva a la tabla filtrada por esa categoría", () => {
    render(<Con inicial={datos} umbralStock={10} />)
    fireEvent.click(tarjeta("Unidades en stock"))
    fireEvent.click(screen.getByRole("button", { name: "Ver los productos de Accesorios en la tabla" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
  })

  it("el valor del inventario dice que es a precio de venta y, si hay costo, lo muestra también a costo", () => {
    render(<Con inicial={datos} umbralStock={10} />)
    expect(tarjeta("Valor del inventario")).toHaveAccessibleName(/a precio de venta · \$.* a costo/)
    expect(tarjeta("Valor del inventario")).toHaveAccessibleName(/\$50\.00 a costo/) // 5×4 + 30×1 (Montura 2 no tiene costo y no suma)
  })

  it("sin ningún costo solo dice 'a precio de venta'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    expect(tarjeta("Valor del inventario")).toHaveAccessibleName(/a precio de venta$/)
  })

  it("quien solo puede ver no ve el costo en ninguna parte", () => {
    render(<Con inicial={datos} usuario={soloVer} umbralStock={10} />)
    expect(tarjeta("Valor del inventario").getAttribute("aria-label")).not.toMatch(/costo/)
    fireEvent.click(tarjeta("Valor del inventario"))
    expect(within(screen.getByRole("dialog")).queryByText("A costo")).not.toBeInTheDocument()
  })

  it("las tarjetas con ⓘ explican su definición y las cuatro tienen el mismo estilo de ícono (el color solo es para un estado)", () => {
    const { container } = render(<Con inicial={datos} umbralStock={10} />)
    expect(screen.getAllByRole("button", { name: /^Qué es / })).toHaveLength(4)
    const baldosas = [...container.querySelectorAll("div.grid.h-11.w-11.rounded-xl")]
    expect(baldosas).toHaveLength(4)
    expect(baldosas.filter((b) => b.className.includes("bg-slate-100"))).toHaveLength(3)
    expect(baldosas.filter((b) => b.className.includes("bg-amber-50"))).toHaveLength(1) // solo la de stock bajo, porque hay un producto por agotarse
  })
})

describe("Inventario: la fila resume y el detalle tiene las acciones", () => {
  const inicial = [producto("a", "Montura 1", 5, { marca: "Ray", color: "Negro", costo: 4, precio: 10, calibre: 52, puente: 18, varilla: 140 })]

  it("la tabla tiene cuatro columnas y ningún botón de acción por fila", () => {
    render(<Con inicial={inicial} />)
    const tabla = screen.getByRole("table")
    expect(within(tabla).getAllByRole("columnheader").map((c) => c.textContent.trim())).toEqual(["Producto", "Categoría", "Existencia", "Precio"])
    expect(within(tabla).queryByRole("button", { name: /Editar|Eliminar|Vender|reporte|Desactivar/i })).not.toBeInTheDocument()
    expect(within(tabla).getByText("Ray · Negro")).toBeInTheDocument()
  })

  it("al hacer clic en la fila se abre el detalle en la ventana estándar, con todas las acciones y sin 'Eliminar'", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("row", { name: /Montura 1/ }))
    const ventana = screen.getByRole("dialog", { name: "Producto Montura 1" })
    for (const nombre of ["Editar", "Ajustar stock", "Registrar ingreso", "Descontinuar"]) expect(within(ventana).getByRole("button", { name: new RegExp(nombre) })).toBeInTheDocument()
    expect(within(ventana).queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(within(ventana).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Movimientos", "Ventas (0)"])
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("el resumen del detalle muestra las medidas, el costo y el margen (con permiso de editar)", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    const ventana = screen.getByRole("dialog")
    expect(within(ventana).getByText("52-18-140 mm")).toBeInTheDocument()
    expect(within(ventana).getByText("Costo")).toBeInTheDocument()
    expect(within(ventana).getByText(/\$6\.00 · 60%/)).toBeInTheDocument() // margen: 10 − 4
  })

  it("quien solo puede ver abre el detalle pero no ve acciones ni costo", () => {
    render(<Con inicial={inicial} usuario={soloVer} />)
    fireEvent.click(filaDe("Montura 1"))
    const ventana = screen.getByRole("dialog")
    for (const nombre of ["Editar", "Ajustar stock", "Registrar ingreso", "Descontinuar"]) expect(within(ventana).queryByRole("button", { name: new RegExp(nombre) })).not.toBeInTheDocument()
    expect(within(ventana).queryByText("Costo")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Conteo físico/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Agregar producto/ })).not.toBeInTheDocument()
  })

  it("la pestaña de ventas conserva el reporte del producto y la de movimientos nunca queda en blanco", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("tab", { name: /Ventas/ }))
    expect(screen.getByText("Todavía no se ha vendido este producto.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Movimientos" }))
    expect(screen.getByText("Todavía no hay movimientos de este producto.")).toBeInTheDocument()
  })
})

describe("Inventario: movimientos, descontinuar y conteo físico", () => {
  const inicial = [producto("a", "Montura 1", 5, { proveedor: "Distribuidora X" }), producto("b", "Montura 2", 8)]
  const existenciaEnTabla = (nombre) => within(screen.getByRole("row", { name: new RegExp(nombre) })).getByText(/ u\.$/).textContent

  it("'Registrar ingreso' pide el motivo y suma a la existencia", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }))
    const ventana = screen.getByRole("dialog", { name: "Registrar ingreso" })
    expect(within(ventana).getByLabelText(/Motivo o referencia/)).toHaveValue("Compra a Distribuidora X")
    fireEvent.change(within(ventana).getByLabelText("Unidades recibidas"), { target: { value: "7" } })
    expect(within(ventana).getByText(/5/).closest("p")).toHaveTextContent("Existencia: 5 → 12")
    fireEvent.change(within(ventana).getByLabelText(/Motivo o referencia/), { target: { value: "ab" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Registrar ingreso" }))
    expect(within(ventana).getByText(/Escribe el motivo/)).toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText(/Motivo o referencia/), { target: { value: "Factura 001-123" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Registrar ingreso" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Registrar ingreso" })).not.toBeInTheDocument())
    expect(screen.getByRole("dialog", { name: "Producto Montura 1" })).toBeInTheDocument() // el detalle vuelve
    expect(screen.getByText(/Ingreso por compra registrado: Montura 1 queda con 12 u\./)).toBeInTheDocument()
  })

  it("'Ajustar stock' por conteo manda la existencia final, y una merma no puede dejarla en negativo", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 2"))
    fireEvent.click(screen.getByRole("button", { name: /Ajustar stock/ }))
    const ventana = screen.getByRole("dialog", { name: "Ajustar stock" })
    fireEvent.change(within(ventana).getByLabelText("Unidades que hay realmente"), { target: { value: "6" } })
    expect(within(ventana).getByText(/Existencia:/).closest("p")).toHaveTextContent("Existencia: 8 → 6")
    fireEvent.click(within(ventana).getByRole("radio", { name: /Merma o pérdida/ }))
    fireEvent.change(within(ventana).getByLabelText("Unidades"), { target: { value: "20" } })
    fireEvent.change(within(ventana).getByLabelText(/Motivo/), { target: { value: "Se rompieron" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar ajuste" }))
    expect(within(ventana).getByText(/Solo hay 8 unidades/)).toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText("Unidades"), { target: { value: "3" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar ajuste" }))
    expect(screen.getByText(/Merma o pérdida registrado: Montura 2 queda con 5 u\./)).toBeInTheDocument()
  })

  it("el formulario de editar no deja cambiar la existencia a mano: manda a 'Registrar ingreso' o 'Ajustar stock'", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /^Editar/ }))
    const ventana = screen.getByRole("dialog", { name: "Editar producto" })
    expect(within(ventana).queryByLabelText(/Existencia inicial/)).not.toBeInTheDocument()
    expect(within(ventana).getByText(/Se cambia con «Registrar ingreso» o «Ajustar stock»/)).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Guardar cambios" })).toHaveAttribute("type", "submit")
  })

  it("descontinuar pide confirmación, conserva el producto y se puede reactivar; no hay forma de eliminar", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /Descontinuar/ }))
    const ventana = screen.getByRole("dialog", { name: "Descontinuar producto" })
    expect(within(ventana).getByText(/Los productos no se eliminan/)).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Descontinuar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByText("Mostrando 1 de 1")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Descontinuados (1)" }))
    expect(existenciaEnTabla("Montura 1")).toBe("5 u.")
    fireEvent.click(filaDe("Montura 1"))
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /Reactivar/ })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Reactivar/ }))
    expect(await screen.findByText(/"Montura 1" reactivado/)).toBeInTheDocument()
  })

  it("'Conteo físico': se cuenta, se ven las diferencias y al confirmar quedan como ajustes", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("button", { name: /Conteo físico/ }))
    const ventana = screen.getByRole("dialog", { name: "Conteo físico" })
    expect(within(ventana).getByRole("button", { name: "Revisar diferencias" })).toBeDisabled()
    fireEvent.change(within(ventana).getByLabelText("Contado de Montura 1"), { target: { value: "3" } })
    fireEvent.change(within(ventana).getByLabelText("Contado de Montura 2"), { target: { value: "8" } })
    expect(within(ventana).getByText(/2 contados · 1 con diferencia/)).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Revisar diferencias" }))
    expect(within(ventana).getByText(/«Conteo físico»/)).toBeInTheDocument()
    const filas = within(ventana).getAllByRole("row").slice(1)
    expect(filas).toHaveLength(1) // solo la que difiere
    expect(filas[0]).toHaveTextContent("Montura 1")
    expect(filas[0]).toHaveTextContent("−2")
    fireEvent.click(within(ventana).getByRole("button", { name: "Confirmar conteo" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Conteo físico registrado: 1 ajuste.")).toBeInTheDocument()
    expect(existenciaEnTabla("Montura 1")).toBe("3 u.")
    expect(existenciaEnTabla("Montura 2")).toBe("8 u.")
  })

  it("el conteo no deja revisar una cantidad que no tiene sentido", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("button", { name: /Conteo físico/ }))
    const ventana = screen.getByRole("dialog", { name: "Conteo físico" })
    fireEvent.change(within(ventana).getByLabelText("Contado de Montura 1"), { target: { value: "-4" } })
    expect(within(ventana).getByRole("button", { name: "Revisar diferencias" })).toBeDisabled()
  })
})

describe("Inventario: sus ventanas son la ventana estándar", () => {
  it("'Agregar producto' abre la ventana estándar con Cancelar y Guardar producto, y se cierra con Escape", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    expect(ventana.tagName).toBe("FORM")
    expect(within(ventana).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Guardar producto" })).toHaveAttribute("type", "submit")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("los datos de la montura son opcionales y van plegados: se guardan sin llenarlos", () => {
    render(<Con inicial={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    expect(within(ventana).queryByLabelText("Marca")).not.toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText(/Descripción de la montura/), { target: { value: "Montura azul" } })
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "4" } })
    fireEvent.change(within(ventana).getByLabelText("Precio ($)"), { target: { value: "30" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Producto añadido al inventario.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ver el detalle de Montura azul" })).toBeInTheDocument()
  })

  it("el despliegue 'Datos de la montura' trae código, marca, modelo, color, medidas, proveedor y costo", () => {
    render(<Con inicial={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    fireEvent.click(within(ventana).getByRole("button", { name: /Datos de la montura/ }))
    for (const nombre of ["Código", "Marca", "Modelo", "Color", "Calibre", "Puente", "Varilla", "Proveedor", "Costo ($)"]) expect(within(ventana).getByLabelText(nombre)).toBeInTheDocument()
  })

  it("las medidas solo se piden para una montura, no para un accesorio", () => {
    render(<Con inicial={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    fireEvent.click(within(ventana).getByRole("button", { name: /Datos de la montura/ }))
    expect(within(ventana).getByLabelText("Calibre")).toBeInTheDocument()
  })

  it("un código repetido no se acepta", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { codigo: "RB-1" })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    fireEvent.click(within(ventana).getByRole("button", { name: /Datos de la montura/ }))
    fireEvent.change(within(ventana).getByLabelText(/Descripción de la montura/), { target: { value: "Otra montura" } })
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "1" } })
    fireEvent.change(within(ventana).getByLabelText("Precio ($)"), { target: { value: "5" } })
    fireEvent.change(within(ventana).getByLabelText("Código"), { target: { value: "rb-1" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(within(ventana).getByText(/El código ya lo tiene "Montura 1"/)).toBeInTheDocument()
  })
})
