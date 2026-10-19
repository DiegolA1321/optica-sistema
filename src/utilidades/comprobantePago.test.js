import { describe, it, expect } from "vitest"
import { problemaDelComprobante, MAX_BYTES_COMPROBANTE, ESTADO_PAGO } from "./comprobantePago"

describe("el comprobante de la transferencia", () => {
  it("pide un archivo", () => expect(problemaDelComprobante(null)).toMatch(/Elige la foto/))
  it("acepta fotos JPG y PNG y PDF", () => {
    expect(problemaDelComprobante({ type: "image/jpeg", size: 9_000_000 })).toBe("") // las fotos se reducen antes de enviarlas
    expect(problemaDelComprobante({ type: "image/png", size: 100 })).toBe("")
    expect(problemaDelComprobante({ type: "application/pdf", size: 500_000 })).toBe("")
  })
  it("rechaza otros tipos y PDF de más de 2 MB", () => {
    expect(problemaDelComprobante({ type: "application/zip", size: 10 })).toMatch(/foto \(JPG o PNG\) o un PDF/)
    expect(problemaDelComprobante({ type: "application/pdf", size: MAX_BYTES_COMPROBANTE + 1 })).toMatch(/más de 2 MB/)
  })
  it("dice cada estado en palabras del paciente", () => {
    expect(ESTADO_PAGO.por_verificar.nombre).toBe("Pago en verificación")
    expect(ESTADO_PAGO.confirmado.nombre).toBe("Pago confirmado")
  })
})
