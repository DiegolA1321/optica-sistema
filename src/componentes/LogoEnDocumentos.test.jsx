import React from "react"
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import HojaReceta from "./HojaReceta"
import HojaConteo from "./inventario/HojaConteo"
import LogoImpreso, { anchoDeLogo } from "./LogoImpreso"
import { datosOpticaReceta } from "../utilidades/datosReceta"
import { armarHtmlProforma, datosOpticaProforma, logoHtml } from "../utilidades/proforma"
import { armarHtmlComprobante } from "../utilidades/imprimirComprobante"
import dashboardFuente from "../paginas/Dashboard.jsx?raw"
import portalFuente from "../paginas/PortalPaciente.jsx?raw"

const LOGO = "https://cdn/logos/o1/logo.svg"

// Todos los lugares leen el MISMO logo (opticas.logo_url): el del sistema (usuario.opticaLogoUrl) o el de la óptica pública del portal.
describe("el logo de la óptica en los documentos y las pantallas", () => {
  it("la receta y el diagnóstico impreso lo dibujan entero (contain) con tamaño máximo", () => {
    const { container } = render(<HojaReceta optica={{ nombre: "Visión", logoUrl: LOGO }} paciente={{ nombre: "Ana" }} receta={{ fecha: "2026-10-01", id: "abc" }} />)
    const img = container.querySelector("[data-logo] img")
    expect(img).toHaveAttribute("src", LOGO)
    expect(img.style.objectFit).toBe("contain")
    expect(container.querySelector("[data-logo]").style.maxWidth).toBe("150px")
    const completo = render(<HojaReceta completo optica={{ nombre: "Visión", logoUrl: LOGO }} paciente={{ nombre: "Ana" }} receta={{ fecha: "2026-10-01", id: "abc" }} />)
    expect(completo.container.querySelector("[data-logo] img")).toHaveAttribute("src", LOGO)
  })

  it("sin logo no queda un hueco ni una imagen rota", () => {
    const { container } = render(<HojaReceta optica={{ nombre: "Visión" }} paciente={{}} receta={{ fecha: "2026-10-01", id: "abc" }} />)
    expect(container.querySelector("[data-logo]")).toBeNull()
  })

  it("la hoja de conteo usa el mismo logo, con su lugar marcado para el PDF", () => {
    const { container } = render(<HojaConteo optica={{ nombre: "Visión", logoUrl: LOGO, logoAncho: 90 }} secciones={[]} fecha="23 de octubre" />)
    const marca = container.querySelector("[data-logo]")
    expect(marca.querySelector("img")).toHaveAttribute("src", LOGO)
    expect(marca.style.width).toBe("90px")
  })

  it("receta, diagnóstico y hoja de conteo leen el logo de la óptica actual", () => {
    expect(datosOpticaReceta({ opticaLogoUrl: LOGO, opticaNombre: "Visión" }, {}).logoUrl).toBe(LOGO)
    expect(datosOpticaReceta({ opticaNombre: "Visión" }, {}).logoUrl).toBe("")
  })

  it("proforma y comprobante llevan el logo arriba del nombre, entero y con tamaño máximo", () => {
    const opticaDatos = datosOpticaProforma({}, LOGO)
    expect(opticaDatos.logoUrl).toBe(LOGO)
    const proforma = armarHtmlProforma({ opticaNombre: "Visión", opticaDatos, paciente: { nombre: "Ana" }, lineas: [] })
    expect(proforma).toContain(`src="${LOGO}"`)
    expect(proforma).toMatch(/object-fit:contain/)
    expect(proforma).toMatch(/max-height:56px/)
    const comprobante = armarHtmlComprobante({ opticaNombre: "Visión", opticaDatos, paciente: { nombre: "Ana" }, factura: { id: "f", numero: 1, lineas: [], creadoEn: "2026-10-01" } })
    expect(comprobante).toContain(`src="${LOGO}"`)
    expect(armarHtmlProforma({ opticaNombre: "Visión", opticaDatos: datosOpticaProforma({}), paciente: {}, lineas: [] })).not.toContain("<img")
    expect(logoHtml("")).toBe("")
  })

  it("el ancho del logo en el PDF sigue su proporción sin pasarse del máximo", () => {
    expect(anchoDeLogo(1)).toBe(52)
    expect(anchoDeLogo(4)).toBe(150)
    expect(anchoDeLogo(0.2)).toBe(26)
    expect(render(<LogoImpreso url="" />).container.innerHTML).toBe("")
  })

  it("la barra del personal y el portal del paciente usan el componente LogoOptica con el logo de la óptica", () => {
    expect(dashboardFuente).toMatch(/<LogoOptica url=\{usuario\?\.opticaLogoUrl\}/)
    expect(portalFuente).toMatch(/<LogoOptica url=\{logoUrl\}/)
  })
})
