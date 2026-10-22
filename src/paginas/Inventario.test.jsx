import React, { useState } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"

// Sin base de datos: la pantalla trabaja en memoria (las pruebas nunca tocan una base real aunque haya un .env.local).
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
// Imprimir abre la ventana de impresión: aquí solo se comprueba lo que se mandaría imprimir.
vi.mock("../utilidades/proforma", async (original) => ({ ...(await original()), imprimirHtml: vi.fn() }))
import { imprimirHtml } from "../utilidades/proforma"
import Inventario from "./Inventario"

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const soloVer = { id: "u2", rol: "asistente", nombre: "Vera", opticaId: "o1", permisosNivel: { inventario: ["ver"], ventas: ["ver"] } }
// Quien ve el inventario pero no Ventas (el Optómetra): el servidor no le entrega comprobantes, así que no hay "Sin vender" ni pestaña Ventas.
const sinVentas = { id: "u3", rol: "asistente", nombre: "Paula", opticaId: "o1", permisosNivel: { inventario: ["ver"] } }
const ahora = new Date().toISOString()
const producto = (id, nombre, stock, extra = {}) => ({ id, nombre, categoria: "Monturas", stock, precio: 10, creadoEn: ahora, activo: true, ...extra })

// La pantalla con su estado, como la monta el sistema.
function Con({ inicial, usuario = admin, ...props }) {
  const [inv, setInv] = useState(inicial)
  return <Inventario usuario={usuario} inventario={inv} setInventario={setInv} categorias={["Monturas", "Accesorios"]} umbralStock={10} maximoStock={30} {...props} />
}
const filaDe = (nombre) => screen.getByRole("button", { name: `Ver el detalle de ${nombre}` })
const dato = (nombre) => within(screen.getByRole("list", { name: "Resumen del inventario" })).getByRole("button", { name: new RegExp("^" + nombre) })
const lista = () => screen.getByRole("list", { name: /^Productos (activos|descontinuados)$/ })
const filas = () => within(lista()).getAllByRole("listitem")
const fila = (nombre) => filas().find((li) => li.textContent.includes(nombre))
const pildora = (nombre) => within(screen.getByRole("group", { name: "Filtrar el inventario" })).getByRole("button", { name: nombre })

beforeEach(() => { imprimirHtml.mockClear() })

describe("Inventario — estructura", () => {
  it("se llama 'Inventario', sus ítems son 'productos', el botón es 'Agregar producto' y hay dos pestañas con su número", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5), producto("b", "Vieja", 3, { activo: false })]} />)
    expect(screen.getByRole("heading", { level: 1, name: "Inventario" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agregar producto/ })).toBeInTheDocument()
    expect(screen.getAllByRole("tab").map((t) => t.textContent.replace(/\s+/g, " ").trim())).toEqual(["Activos1", "Descontinuados1"])
    expect(screen.getByRole("tab", { name: /^Activos/ })).toHaveAttribute("aria-selected", "true")
    expect(document.body.textContent).not.toMatch(/bodega/i)
  })

  it("usa un solo nombre, 'Monturas', y nunca 'Armazón'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    expect(document.body.textContent).toMatch(/Montura/)
    expect(document.body.textContent).not.toMatch(/armaz[oó]n|armazones/i)
  })

  it("sin productos dice que no hay y ofrece agregar el primero", () => {
    render(<Con inicial={[]} />)
    expect(screen.getByText("No hay productos en el inventario")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Agregar el primero" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Imprimir hoja de conteo/ })).not.toBeInTheDocument()
  })
})

describe("Inventario — la franja de datos", () => {
  const vieja = "2026-01-05T15:00:00Z"
  const datos = [
    producto("a", "Montura 1", 5, { costo: 4, precio: 10, creadoEn: vieja }), producto("b", "Montura 2", 50, { precio: 20 }),
    producto("c", "Estuche", 30, { categoria: "Accesorios", precio: 2, costo: 1 }), producto("d", "Vieja", 7, { activo: false }),
  ]

  it("trae los cinco datos: productos activos con sus unidades, valor, stock bajo, sobrestock y sin vender en 90 días", () => {
    render(<Con inicial={datos} />)
    const franja = screen.getByRole("list", { name: "Resumen del inventario" })
    const botones = within(franja).getAllByRole("button")
    expect(botones.map((b) => b.querySelector("span").textContent.trim())).toEqual(["Productos activos", "Valor del inventario", "Stock bajo", "Sobrestock", "Sin vender en 90 días"])
    expect(botones[0]).toHaveTextContent("385 unidades")
    expect(botones[1]).toHaveTextContent("$1,110.00a precio de venta · $50.00 a costo")
    expect(botones[2]).toHaveTextContent("Stock bajo1bajo su mínimo")
    expect(botones[3]).toHaveTextContent("Sobrestock1sobre su máximo")
    expect(botones[4]).toHaveTextContent("Sin vender en 90 días1$50.00 parados")
  })

  it("cada dato cuenta los mismos productos que filtra la lista", () => {
    render(<Con inicial={datos} />)
    fireEvent.click(dato("Stock bajo"))
    expect(filas()).toHaveLength(1)
    expect(fila("Montura 1")).toBeTruthy()
    expect(dato("Stock bajo")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(dato("Stock bajo")) // un clic más lo quita
    expect(filas()).toHaveLength(3)
    fireEvent.click(dato("Sobrestock"))
    expect(filas()).toHaveLength(1)
    expect(fila("Montura 2")).toBeTruthy() // 50 u. con máximo 30
    fireEvent.click(dato("Productos activos"))
    expect(filas()).toHaveLength(3)
  })

  it("«Sin vender en 90 días» filtra con su filtro a la vista y fácil de quitar", () => {
    render(<Con inicial={datos} />)
    fireEvent.click(dato("Sin vender en 90 días"))
    expect(filas()).toHaveLength(1)
    expect(fila("Montura 1")).toBeTruthy() // vieja y nunca vendida
    expect(screen.getByRole("status")).toHaveTextContent("Sin vender en 90 días")
    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Sin vender en 90 días" }))
    expect(filas()).toHaveLength(3)
  })

  it("«Valor del inventario» abre su desglose, con el costo solo para quien puede editar", () => {
    render(<Con inicial={datos} />)
    fireEvent.click(dato("Valor del inventario"))
    expect(screen.getByRole("dialog", { name: "Valor del inventario" })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("sin ningún costo solo dice 'a precio de venta'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    expect(dato("Valor del inventario")).toHaveTextContent(/a precio de venta$/)
  })

  it("quien no tiene Ventas no ve «Sin vender» (no tiene con qué calcularlo)", () => {
    render(<Con inicial={datos} usuario={sinVentas} />)
    expect(screen.queryByRole("button", { name: /^Sin vender en 90 días/ })).not.toBeInTheDocument()
    expect(dato("Valor del inventario")).toBeInTheDocument()
  })

  it("quien solo puede ver no ve el costo en ninguna parte", () => {
    render(<Con inicial={datos} usuario={soloVer} />)
    expect(dato("Valor del inventario")).not.toHaveTextContent(/costo/)
    expect(screen.queryByRole("button", { name: /Imprimir hoja de conteo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Agregar producto/ })).not.toBeInTheDocument()
  })

  it("los productos descontinuados no cuentan en la franja", () => {
    render(<Con inicial={datos} />)
    expect(dato("Productos activos")).toHaveTextContent("3")
    expect(dato("Productos activos")).not.toHaveTextContent("92") // 85 + 7
  })
})

describe("Inventario — la lista", () => {
  const productos = [
    producto("a", "Estuche rígido", 4, { categoria: "Accesorios", codigo: "EST-01", critico: 5, maximo: 30, precio: 6 }),
    producto("b", "Líquido limpiador 60 ml", 38, { categoria: "Accesorios", codigo: "LIQ-60", precio: 4.5 }),
    producto("c", "Montura 10, infantil flexible", 3, { codigo: "MON-10", critico: 5, maximo: 20, precio: 38 }),
    producto("d", "Cordón para gafas", 17, { categoria: "Accesorios", codigo: "COR-01", precio: 3.5 }),
  ]

  it("cada producto trae su nombre con su código, categoría, existencia con su mínimo y su máximo, precio y estado", () => {
    render(<Con inicial={productos} />)
    const estuche = fila("Estuche rígido")
    expect(estuche).toHaveTextContent("EST-01")
    expect(estuche).toHaveTextContent("Accesorios")
    expect(estuche).toHaveTextContent("4 u.")
    expect(estuche).toHaveTextContent("mín 5 · máx 30")
    expect(estuche).toHaveTextContent("$6.00")
    expect(estuche).toHaveTextContent("Stock bajo")
    expect(fila("Líquido")).toHaveTextContent("mín 10 · máx 30") // el mínimo general (10) y el máximo general (30)
    expect(fila("Líquido")).toHaveTextContent("Sobrestock")
    expect(fila("Montura 10")).toHaveTextContent("mín 5 · máx 20")
    expect(fila("Cordón")).not.toHaveTextContent(/Stock bajo|Sobrestock/)
  })

  it("cada producto lleva su barrita de color: rojo si está bajo, ámbar si sobra y verde si está en orden", () => {
    render(<Con inicial={productos} />)
    const barra = (nombre) => fila(nombre).querySelector('[aria-hidden="true"] > div')
    expect(barra("Estuche rígido").style.background).toBe("rgb(220, 38, 38)")
    expect(barra("Líquido").style.background).toBe("rgb(180, 83, 9)")
    expect(barra("Cordón").style.background).toBe("rgb(22, 163, 74)")
    expect(barra("Líquido").style.width).toBe("100%") // el máximo no limita, pero la barra no pasa de llena
    expect(barra("Cordón").style.width).toBe("57%") // 17 de 30
  })

  it("las píldoras filtran: Todos, cada categoría, Stock bajo y Sobrestock", () => {
    render(<Con inicial={productos} />)
    const grupo = screen.getByRole("group", { name: "Filtrar el inventario" })
    expect(within(grupo).getAllByRole("button").map((b) => b.textContent)).toEqual(["Todos", "Monturas", "Accesorios", "Stock bajo", "Sobrestock"])
    expect(pildora("Todos")).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(pildora("Monturas"))
    expect(filas()).toHaveLength(1)
    fireEvent.click(pildora("Accesorios"))
    expect(filas()).toHaveLength(3)
    fireEvent.click(pildora("Stock bajo"))
    expect(filas()).toHaveLength(2) // el Estuche (4 u., mín 5) y la Montura 10 (3 u., mín 5)
    fireEvent.click(pildora("Sobrestock"))
    expect(filas()).toHaveLength(1)
    expect(fila("Líquido")).toBeTruthy()
    fireEvent.click(pildora("Todos"))
    expect(filas()).toHaveLength(4)
  })

  it("busca por nombre, código, marca y color; sin resultados ofrece quitar los filtros", () => {
    render(<Con inicial={[...productos, producto("e", "Montura 11", 8, { marca: "Ray", color: "Carey" })]} />)
    const caja = screen.getByLabelText("Buscar producto o código")
    fireEvent.change(caja, { target: { value: "liq-60" } })
    expect(filas()).toHaveLength(1) // por su código
    fireEvent.change(caja, { target: { value: "carey" } })
    expect(filas()).toHaveLength(1)
    fireEvent.change(caja, { target: { value: "zzz" } })
    expect(screen.getByText("Ningún producto coincide con el filtro")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }))
    expect(filas()).toHaveLength(5)
  })

  it("desde el aviso del Inicio llega con el filtro puesto (stock bajo, sobrestock, nuevos este mes)", () => {
    const { unmount } = render(<Con inicial={productos} verStockBajoAlEntrar />)
    expect(filas()).toHaveLength(2)
    expect(pildora("Stock bajo")).toHaveAttribute("aria-pressed", "true")
    unmount()
    const otra = render(<Con inicial={productos} verSobrestockAlEntrar />)
    expect(filas()).toHaveLength(1)
    expect(pildora("Sobrestock")).toHaveAttribute("aria-pressed", "true")
    otra.unmount()
    render(<Con inicial={[producto("n", "Nueva", 5), producto("v", "Vieja", 5, { creadoEn: "2026-01-05T15:00:00Z" })]} verNuevosAlEntrar />)
    expect(filas()).toHaveLength(1)
    expect(screen.getByRole("status")).toHaveTextContent("Nuevos este mes")
    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Nuevos este mes" }))
    expect(filas()).toHaveLength(2)
  })

  it("la fila se pulsa entera y abre el detalle en la ventana estándar con todas las acciones y sin 'Eliminar'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { marca: "Ray", color: "Negro", costo: 4, precio: 10, calibre: 52, puente: 18, varilla: 140 })]} />)
    expect(within(lista()).queryByRole("button", { name: /Editar|Eliminar|Vender|Desactivar|Reactivar/i })).not.toBeInTheDocument()
    fireEvent.click(filaDe("Montura 1"))
    const ventana = screen.getByRole("dialog", { name: "Producto Montura 1" })
    for (const nombre of ["Editar", "Ajustar stock", "Registrar ingreso", "Descontinuar"]) expect(within(ventana).getByRole("button", { name: new RegExp(nombre) })).toBeInTheDocument()
    expect(within(ventana).queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument()
    expect(within(ventana).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Movimientos", "Ventas (0)"])
    expect(within(ventana).getByText("52-18-140 mm")).toBeInTheDocument()
    expect(within(ventana).getByText(/\$6\.00 · 60%/)).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("el detalle dice el mínimo y el máximo del producto y si usa el general", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { critico: 3 })]} />)
    fireEvent.click(filaDe("Montura 1"))
    const ventana = screen.getByRole("dialog")
    expect(within(ventana).getByText("Stock mínimo").closest("div")).toHaveTextContent("3 u.")
    expect(within(ventana).getByText("Stock mínimo").closest("div")).not.toHaveTextContent("el general")
    expect(within(ventana).getByText("Stock máximo").closest("div")).toHaveTextContent("30 u. (el general)")
  })

  it("quien solo puede ver abre el detalle pero no ve acciones ni costo", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { costo: 4 })]} usuario={soloVer} />)
    fireEvent.click(filaDe("Montura 1"))
    const ventana = screen.getByRole("dialog")
    for (const nombre of ["Editar", "Ajustar stock", "Registrar ingreso", "Descontinuar"]) expect(within(ventana).queryByRole("button", { name: new RegExp(nombre) })).not.toBeInTheDocument()
    expect(within(ventana).queryByText("Costo")).not.toBeInTheDocument()
  })
})

describe("Inventario — descontinuados y reactivar", () => {
  const inicial = [producto("a", "Montura 1", 5), producto("b", "Montura 2", 8), producto("c", "Estuche rígido", 4, { categoria: "Accesorios", activo: false })]

  it("la pestaña «Descontinuados» lista solo esos, sin franja ni píldoras, y cada uno tiene «Reactivar»", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("tab", { name: /Descontinuados/ }))
    expect(screen.queryByRole("list", { name: "Resumen del inventario" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Filtrar el inventario" })).not.toBeInTheDocument()
    expect(filas()).toHaveLength(1)
    expect(filas()[0]).toHaveTextContent("Estuche rígido")
    expect(within(filas()[0]).getByRole("button", { name: "Reactivar Estuche rígido" })).toBeInTheDocument()
  })

  it("reactivar confirma con su aviso, el producto vuelve a Activos y, si era el último, la lista vuelve sola a Activos", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("tab", { name: /Descontinuados/ }))
    fireEvent.click(screen.getByRole("button", { name: "Reactivar Estuche rígido" }))
    expect(await screen.findByText(/"Estuche rígido" reactivado/)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /^Activos/ })).toHaveAttribute("aria-selected", "true")
    expect(filas()).toHaveLength(3)
    expect(screen.getByRole("tab", { name: /Descontinuados/ })).toHaveTextContent("0")
  })

  it("sin descontinuados dice qué pasa y qué hacer", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    fireEvent.click(screen.getByRole("tab", { name: /Descontinuados/ }))
    expect(screen.getByText("No hay productos descontinuados")).toBeInTheDocument()
  })

  it("quien no puede editar ve «Descontinuado» pero no puede reactivar", () => {
    render(<Con inicial={inicial} usuario={soloVer} />)
    fireEvent.click(screen.getByRole("tab", { name: /Descontinuados/ }))
    expect(screen.queryByRole("button", { name: /Reactivar/ })).not.toBeInTheDocument()
    expect(filas()[0]).toHaveTextContent("Descontinuado")
  })

  it("descontinuar pide confirmación, conserva el producto y se puede reactivar; no hay forma de eliminar", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /Descontinuar/ }))
    const ventana = screen.getByRole("dialog", { name: "Descontinuar producto" })
    expect(within(ventana).getByText(/Los productos no se eliminan/)).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Descontinuar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(filas()).toHaveLength(1)
    expect(screen.getByRole("tab", { name: /Descontinuados/ })).toHaveTextContent("2")
    fireEvent.click(screen.getByRole("tab", { name: /Descontinuados/ }))
    expect(fila("Montura 1")).toHaveTextContent("5 u.")
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Reactivar/ }))
    expect(await screen.findByText(/"Montura 1" reactivado/)).toBeInTheDocument()
  })
})

describe("Inventario — la hoja de conteo", () => {
  const inicial = [producto("a", "Montura 1", 5, { codigo: "M-1" }), producto("b", "Montura 2", 8), producto("c", "Vieja", 2, { activo: false })]

  it("«Conteo físico» ya no existe: queda «Imprimir hoja de conteo», sin historial de conteos", () => {
    render(<Con inicial={inicial} />)
    expect(screen.queryByRole("button", { name: /Conteo físico/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Historial de conteos/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Imprimir hoja de conteo/ })).toBeInTheDocument()
  })

  it("imprime todos los productos activos con su código, su descripción, su existencia en el sistema y una columna en blanco, y lo confirma", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("button", { name: /Imprimir hoja de conteo/ }))
    expect(imprimirHtml).toHaveBeenCalledTimes(1)
    const html = imprimirHtml.mock.calls[0][0]
    for (const texto of ["Código", "Descripción", "En el sistema", "Contado", "M-1", "Montura 1", "Montura 2", "Ajustar stock"]) expect(html).toContain(texto)
    expect(html).not.toContain("Vieja") // los descontinuados no se cuentan
    expect(html).toContain('<td class="n">5</td>')
    expect(screen.getByText("Hoja de conteo lista para imprimir.")).toBeInTheDocument()
  })
})

describe("Inventario — registrar ingreso y ajustar stock", () => {
  const inicial = [producto("a", "Montura 1", 5, { proveedor: "Distribuidora X" }), producto("b", "Montura 2", 8), producto("c", "Líquido limpiador 60 ml", 38, { categoria: "Accesorios", maximo: 30 })]

  it("«Registrar ingreso» pide solo las unidades (y el costo, si se quiere) y suma a la existencia", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }))
    const ventana = screen.getByRole("dialog", { name: "Registrar ingreso" })
    expect(within(ventana).getByText("Productos que llegaron")).toBeInTheDocument()
    expect(within(ventana).getByText("Montura 1").closest("p")).toHaveTextContent("hoy 5 u. · máximo 30")
    expect(within(ventana).queryByLabelText(/Motivo/)).not.toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText("Unidades que ingresan"), { target: { value: "7" } })
    fireEvent.change(within(ventana).getByLabelText("Costo por unidad (opcional)"), { target: { value: "2.5" } })
    expect(within(ventana).queryByRole("status")).not.toBeInTheDocument() // 12 u. no pasan del máximo
    fireEvent.click(within(ventana).getByRole("button", { name: "Registrar ingreso" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Registrar ingreso" })).not.toBeInTheDocument())
    expect(screen.getByRole("dialog", { name: "Producto Montura 1" })).toBeInTheDocument() // el detalle vuelve
    expect(screen.getByText(/Ingreso por compra registrado: Montura 1 queda con 12 u\. Costo actualizado\./)).toBeInTheDocument()
  })

  it("si el ingreso pasa del máximo avisa ANTES de registrar, sin bloquear: «Registrar igual»", async () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Líquido limpiador 60 ml"))
    fireEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }))
    const ventana = screen.getByRole("dialog", { name: "Registrar ingreso" })
    expect(within(ventana).getByRole("button", { name: "Registrar ingreso" })).toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText("Unidades que ingresan"), { target: { value: "20" } })
    expect(within(ventana).getByRole("status")).toHaveTextContent("Quedarías con 58 u., casi el doble de tu máximo (30). Puedes registrarlo igual.")
    expect(within(ventana).queryByRole("button", { name: "Registrar ingreso" })).not.toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Registrar igual" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Registrar ingreso" })).not.toBeInTheDocument())
    expect(screen.getByText(/queda con 58 u\./)).toBeInTheDocument()
  })

  it("un ingreso con cantidad inválida lo dice y no registra", () => {
    render(<Con inicial={inicial} />)
    fireEvent.click(filaDe("Montura 2"))
    fireEvent.click(screen.getByRole("button", { name: /Registrar ingreso/ }))
    const ventana = screen.getByRole("dialog", { name: "Registrar ingreso" })
    fireEvent.change(within(ventana).getByLabelText("Unidades que ingresan"), { target: { value: "0" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Registrar ingreso" }))
    expect(within(ventana).getByText(/mayor que cero/)).toBeInTheDocument()
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
})

describe("Inventario — agregar y editar producto", () => {
  const abrirAgregar = (inicial = []) => {
    render(<Con inicial={inicial} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    return screen.getByRole("dialog", { name: "Agregar producto" })
  }

  it("la ventana es la estándar, con el subtítulo del diseño, Cancelar y Guardar producto, y se cierra con Escape", () => {
    const ventana = abrirAgregar([producto("a", "Montura 1", 5)])
    expect(ventana.tagName).toBe("FORM")
    expect(within(ventana).getByText("Monturas y accesorios. Las lunas se escriben en la venta.")).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Guardar producto" })).toHaveAttribute("type", "submit")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("trae a la vista categoría, descripción, existencia inicial, precio, costo, stock mínimo y máximo (con «Usar el general») y la nota de Configuración", () => {
    const ventana = abrirAgregar()
    expect(within(ventana).getByText("Categoría")).toBeInTheDocument()
    for (const nombre of ["Descripción", "Existencia inicial", "Precio", "Costo (opcional)", "Stock mínimo", "Stock máximo"]) expect(within(ventana).getByLabelText(nombre)).toBeInTheDocument()
    expect(within(ventana).getByLabelText("Stock mínimo")).toHaveAttribute("placeholder", "Usar el general (10)")
    expect(within(ventana).getByLabelText("Stock máximo")).toHaveAttribute("placeholder", "Usar el general (30)")
    expect(within(ventana).getByText(/Los valores generales se cambian en Configuración → Inventario/)).toBeInTheDocument()
    expect(within(ventana).queryByLabelText("Marca")).not.toBeInTheDocument() // los datos de la montura van plegados
  })

  it("se guarda sin llenar lo opcional, con aviso, y el producto aparece en la lista", () => {
    const ventana = abrirAgregar()
    fireEvent.change(within(ventana).getByLabelText("Descripción"), { target: { value: "Montura azul" } })
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "4" } })
    fireEvent.change(within(ventana).getByLabelText("Precio"), { target: { value: "30" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByText("Producto añadido al inventario.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ver el detalle de Montura azul" })).toBeInTheDocument()
  })

  it("un mínimo y un máximo propios se guardan y se ven en la lista; el máximo debe ser mayor que el mínimo", () => {
    const ventana = abrirAgregar()
    fireEvent.change(within(ventana).getByLabelText("Descripción"), { target: { value: "Montura 10" } })
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "3" } })
    fireEvent.change(within(ventana).getByLabelText("Precio"), { target: { value: "38" } })
    fireEvent.change(within(ventana).getByLabelText("Stock mínimo"), { target: { value: "5" } })
    fireEvent.change(within(ventana).getByLabelText("Stock máximo"), { target: { value: "4" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(within(ventana).getByText("El máximo debe ser mayor que el mínimo.")).toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText("Stock máximo"), { target: { value: "20" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(fila("Montura 10")).toHaveTextContent("mín 5 · máx 20")
    expect(fila("Montura 10")).toHaveTextContent("Stock bajo")
  })

  it("si el producto ya existe en Descontinuados avisa en el momento y ofrece reactivarlo (aunque se escriba distinto)", async () => {
    const ventana = abrirAgregar([producto("c", "Estuche rígido", 4, { categoria: "Accesorios", activo: false })])
    fireEvent.change(within(ventana).getByLabelText("Descripción"), { target: { value: "estuche RIGIDO " } })
    const aviso = within(ventana).getByRole("status")
    expect(aviso).toHaveTextContent("Ya existe «Estuche rígido» en Descontinuados (4 u.).")
    fireEvent.click(within(aviso).getByRole("button", { name: "Reactivarlo" }))
    expect(await screen.findByText(/"Estuche rígido" reactivado/)).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Agregar producto" })).not.toBeInTheDocument()
    expect(fila("Estuche rígido")).toBeTruthy() // ahora está en Activos
  })

  it("si ya existe en Activos lo dice (sin ofrecer reactivarlo) y no deja crear un duplicado", () => {
    const ventana = abrirAgregar([producto("a", "Montura 1", 5)])
    fireEvent.change(within(ventana).getByLabelText("Descripción"), { target: { value: "Montura 1" } })
    expect(within(ventana).getByRole("status")).toHaveTextContent("Ya existe «Montura 1» en Activos (5 u.). Para sumar unidades, registra un ingreso.")
    expect(within(ventana).queryByRole("button", { name: "Reactivarlo" })).not.toBeInTheDocument()
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "1" } })
    fireEvent.change(within(ventana).getByLabelText("Precio"), { target: { value: "5" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(screen.getByRole("dialog", { name: "Agregar producto" })).toBeInTheDocument()
    expect(within(ventana).getByRole("status")).toHaveTextContent("Ya existe «Montura 1» en Activos")
  })

  it("quien solo puede crear no ve «Reactivarlo» (reactivar es de quien edita)", () => {
    const crea = { id: "u4", rol: "asistente", nombre: "Cris", opticaId: "o1", permisosNivel: { inventario: ["ver", "crear"] } }
    render(<Con inicial={[producto("c", "Estuche rígido", 4, { activo: false })]} usuario={crea} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Estuche rígido" } })
    expect(screen.getByRole("status")).toHaveTextContent("Ya existe «Estuche rígido» en Descontinuados")
    expect(screen.queryByRole("button", { name: "Reactivarlo" })).not.toBeInTheDocument()
  })

  it("el despliegue «Datos de la montura y foto» trae código, marca, modelo, color, medidas y proveedor", () => {
    const ventana = abrirAgregar()
    fireEvent.click(within(ventana).getByRole("button", { name: /Datos de la montura/ }))
    for (const nombre of ["Código", "Marca", "Modelo", "Color", "Calibre", "Puente", "Varilla", "Proveedor"]) expect(within(ventana).getByLabelText(nombre)).toBeInTheDocument()
  })

  it("un código repetido no se acepta", () => {
    const ventana = abrirAgregar([producto("a", "Montura 1", 5, { codigo: "RB-1" })])
    fireEvent.click(within(ventana).getByRole("button", { name: /Datos de la montura/ }))
    fireEvent.change(within(ventana).getByLabelText("Descripción"), { target: { value: "Otra montura" } })
    fireEvent.change(within(ventana).getByLabelText("Existencia inicial"), { target: { value: "1" } })
    fireEvent.change(within(ventana).getByLabelText("Precio"), { target: { value: "5" } })
    fireEvent.change(within(ventana).getByLabelText("Código"), { target: { value: "rb-1" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar producto" }))
    expect(within(ventana).getByText(/El código ya lo tiene «Montura 1»/)).toBeInTheDocument()
  })

  it("el formulario de editar no deja cambiar la existencia a mano: manda a 'Registrar ingreso' o 'Ajustar stock'", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5)]} />)
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /^Editar/ }))
    const ventana = screen.getByRole("dialog", { name: "Editar producto" })
    expect(within(ventana).queryByLabelText(/Existencia inicial/)).not.toBeInTheDocument()
    expect(within(ventana).getByText(/La existencia se cambia con «Registrar ingreso» o «Ajustar stock»/)).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Guardar cambios" })).toHaveAttribute("type", "submit")
  })

  it("al editar se cambia el máximo del producto y la lista lo muestra; dejarlo vacío vuelve al general", () => {
    render(<Con inicial={[producto("a", "Montura 1", 5, { maximo: 12 })]} />)
    expect(fila("Montura 1")).toHaveTextContent("máx 12")
    fireEvent.click(filaDe("Montura 1"))
    fireEvent.click(screen.getByRole("button", { name: /^Editar/ }))
    const ventana = screen.getByRole("dialog", { name: "Editar producto" })
    expect(within(ventana).getByLabelText("Stock máximo")).toHaveValue(12)
    fireEvent.change(within(ventana).getByLabelText("Stock máximo"), { target: { value: "" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar cambios" }))
    expect(screen.getByText("Cambios guardados correctamente.")).toBeInTheDocument()
    expect(fila("Montura 1")).toHaveTextContent("máx 30")
  })
})
