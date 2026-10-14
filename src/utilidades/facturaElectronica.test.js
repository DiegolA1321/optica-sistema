import { describe, it, expect } from "vitest"
import { digitoVerificador, validarClaveAcceso, numeroDeClave, claveEnGrupos, validarFechaAutorizacion, validarArchivo, revisarXml, mensajeFacturaWhatsApp, MAX_BYTES_PDF } from "./facturaElectronica"

// Una clave real en estructura: 04/10/2026 · factura · RUC · pruebas/producción · serie 001001 · secuencial 000001216 · código · emisión normal · verificador
const BASE = "04102026" + "01" + "1790000000001" + "1" + "001001" + "000001216" + "12345678" + "1"
const CLAVE = BASE + digitoVerificador(BASE)

describe("clave de acceso", () => {
  it("el dígito verificador es el módulo 11, con 11 → 0 y 10 → 1", () => {
    expect(CLAVE).toHaveLength(49)
    expect(CLAVE.endsWith("5")).toBe(true)
    // suma = 11k → 0; suma = 11k+1 → 10 → 1
    expect(digitoVerificador("0".repeat(48))).toBe(0)
    expect(digitoVerificador("0".repeat(47) + "1")).toBe(9) // 11 − 2
    const casos = new Set()
    for (let i = 0; i < 400; i++) casos.add(digitoVerificador(String(i).padStart(48, "0")))
    expect([...casos].every((d) => d >= 0 && d <= 9)).toBe(true)
  })
  it("acepta una clave correcta, con espacios o guiones", () => {
    const r = validarClaveAcceso(claveEnGrupos(CLAVE))
    expect(r).toMatchObject({ ok: true, clave: CLAVE, numero: "001-001-000001216", fechaEmision: "2026-10-04", ruc: "1790000000001", ambiente: "pruebas" })
  })
  it("dice qué le pasa a una clave mala", () => {
    expect(validarClaveAcceso("").vacia).toBe(true)
    expect(validarClaveAcceso("12ab").error).toMatch(/solo lleva números/)
    expect(validarClaveAcceso("123").error).toMatch(/49 dígitos y esta tiene 3/)
    expect(validarClaveAcceso(CLAVE.slice(0, 48) + "3").error).toBe("La clave de acceso no es válida: el dígito verificador debería ser 5.")
  })
  it("rechaza una fecha imposible y un comprobante que no es factura", () => {
    const mala = (b) => b + digitoVerificador(b)
    expect(validarClaveAcceso(mala("31022026" + BASE.slice(8))).error).toMatch(/fecha/)
    expect(validarClaveAcceso(mala(BASE.slice(0, 8) + "04" + BASE.slice(10))).error).toMatch(/no es de una factura/)
  })
  it("se cruza con el número de la factura", () => {
    expect(validarClaveAcceso(CLAVE, "001-001-000001216").ok).toBe(true)
    expect(validarClaveAcceso(CLAVE, "001001000001216").ok).toBe(true) // el número sin guiones también
    expect(validarClaveAcceso(CLAVE, "001-001-000000999").error).toMatch(/es de la factura 001-001-000001216, no de la 001-001-000000999/)
    expect(validarClaveAcceso(CLAVE, "FE-77").ok).toBe(true) // un proveedor con otra numeración no se cruza
    expect(numeroDeClave(CLAVE)).toBe("001-001-000001216")
  })
})

describe("fecha de autorización y archivos", () => {
  it("no puede ser futura ni anterior a la venta", () => {
    expect(validarFechaAutorizacion("", {})).toMatch(/Indica/)
    expect(validarFechaAutorizacion("2026-10-20", { hoy: "2026-10-13" })).toMatch(/futura/)
    expect(validarFechaAutorizacion("2026-10-01", { fechaVenta: "2026-10-04", hoy: "2026-10-13" })).toMatch(/anterior/)
    expect(validarFechaAutorizacion("2026-10-04", { fechaVenta: "2026-10-04", hoy: "2026-10-13" })).toBe("")
  })
  it("el PDF: extensión, tamaño y que empiece como un PDF", () => {
    expect(validarArchivo("pdf", { nombre: "f.pdf", bytes: 1000, inicio: "%PDF-1.7" })).toBe("")
    expect(validarArchivo("pdf", { nombre: "f.png", bytes: 1000, inicio: "%PDF-1.7" })).toMatch(/\.pdf/)
    expect(validarArchivo("pdf", { nombre: "f.pdf", bytes: MAX_BYTES_PDF + 1, inicio: "%PDF-" })).toMatch(/más de 5 MB/)
    expect(validarArchivo("pdf", { nombre: "f.pdf", bytes: 10, inicio: "hola" })).toMatch(/no es un PDF/)
    expect(validarArchivo("pdf", { nombre: "f.pdf", bytes: 0, inicio: "" })).toMatch(/vacío/)
  })
  it("el XML: extensión, tamaño y que empiece como XML", () => {
    expect(validarArchivo("xml", { nombre: "f.xml", bytes: 500, inicio: "<?xml version" })).toBe("")
    expect(validarArchivo("xml", { nombre: "f.xml", bytes: 3 * 1024 * 1024, inicio: "<?xml" })).toMatch(/más de 2 MB/)
    expect(validarArchivo("xml", { nombre: "f.xml", bytes: 10, inicio: "texto" })).toMatch(/no es un XML/)
  })
  it("el XML trae la misma clave de acceso y está bien formado", () => {
    const xml = `<?xml version="1.0"?><factura><infoTributaria><claveAcceso>${CLAVE}</claveAcceso></infoTributaria></factura>`
    expect(revisarXml(xml, CLAVE)).toBe("")
    expect(revisarXml(xml, "9".repeat(49))).toMatch(/misma clave/)
    expect(revisarXml("<factura><a></factura>", CLAVE)).toMatch(/bien formado/)
  })
})

describe("mensaje para el paciente", () => {
  it("lleva el enlace, el número y cuándo vence, sin adivinar el nombre", () => {
    const m = mensajeFacturaWhatsApp({ paciente: { nombre: "Rosa Bravo Cedeño" }, opticaNombre: "Óptica Demo", enlaces: [{ tipo: "pdf", url: "https://x/d?t=abc" }, { tipo: "xml", url: "https://x/d?t=def" }], numero: "001-001-000001216" })
    expect(m).toMatch(/^Hola, Rosa Bravo Cedeño, te escribimos de Óptica Demo\./)
    expect(m).toContain("factura electrónica 001-001-000001216:")
    expect(m).toContain("PDF (RIDE): https://x/d?t=abc")
    expect(m).toContain("XML: https://x/d?t=def")
    expect(m).toContain("vencen en 7 días")
  })
})
