import { describe, it, expect, vi } from "vitest"

// Sin base de datos: aquí se prueba solo cómo se arma el pedido de una venta.
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
import { datosDePedido, fechaDePedidoPorDefecto, crearPedidoDeVenta } from "./pedidosVenta"
import { datosParaRpc, validarOrden } from "./ordenesLaboratorio"

const factura = { id: "f1", lineas: [
  { tipo: "producto", productoId: "p1", descripcion: "Ray-Ban RB123", cantidad: 1 },
  { tipo: "luna", descripcion: "Luna: Progresivo", cantidad: 1, detalle: { tipo_lente: "progresivo", material: "CR-39", antirreflejo: true } },
] }
const inventario = [{ id: "p1", calibre: 52, puente: 18, varilla: 140 }]

describe("el pedido de una venta con lunas", () => {
  it("la fecha aproximada es hoy más los días de la óptica, o 7", () => {
    expect(fechaDePedidoPorDefecto({}, "2026-10-22")).toBe("2026-10-29")
    expect(fechaDePedidoPorDefecto({ diasPedido: 10 }, "2026-10-22")).toBe("2026-11-01")
    expect(fechaDePedidoPorDefecto(null, "2026-10-22")).toBe("2026-10-29")
  })

  it("trae la montura, sus medidas y la luna de la venta, con la entrega y la fecha elegidas", () => {
    const d = datosDePedido({ factura, entrega: "retira", fecha: "2026-10-29", inventario })
    expect(d).toMatchObject({ montura: "Ray-Ban RB123", monturaMedidas: "52-18-140", tipoLente: "progresivo", fechaPrometida: "2026-10-29", entrega: "retira", direccionEntrega: "" })
    expect(validarOrden(d)).toBe("")
  })

  it("con envío lleva la dirección (sin espacios sobrantes); sin envío la dirección se descarta", () => {
    expect(datosDePedido({ factura, entrega: "envio", direccion: "  Av. Sol 12  ", fecha: "2026-10-29" })).toMatchObject({ entrega: "envio", direccionEntrega: "Av. Sol 12" })
    expect(datosDePedido({ factura, entrega: "retira", direccion: "Av. Sol 12", fecha: "2026-10-29" }).direccionEntrega).toBe("")
  })

  it("lo que recibe la base lleva la entrega y la dirección; el envío sin dirección no se valida", () => {
    const d = datosDePedido({ factura, entrega: "envio", direccion: "Av. Sol 12", fecha: "2026-10-29" })
    expect(datosParaRpc(d)).toMatchObject({ entrega: "envio", direccion_entrega: "Av. Sol 12", fecha_prometida: "2026-10-29" })
    expect(validarOrden({ ...d, direccionEntrega: " " })).toBe("Escribe la dirección de envío.")
    expect(validarOrden({ ...d, fechaPrometida: "" })).toBe("Indica la fecha aproximada en que estará listo.")
  })

  it("sin base de datos no falla", async () => {
    expect(await crearPedidoDeVenta({ factura, fecha: "2026-10-29" })).toEqual({ ok: true })
  })
})
