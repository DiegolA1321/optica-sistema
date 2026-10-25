import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import PaginaPublica from "./PaginaPublica"

const CORTA = "https://maps.app.goo.gl/ZMMY8KdKNcP67PAB7"
const montar = (settings) => render(<PaginaPublica opticaPublica={{ nombre: "Óptica Solna Vision", marca: {}, settings }} disponibilidad={null} datos={null} abrirLogin={() => {}} alAgendar={() => {}} />)

describe("Contacto de la página pública", () => {
  it("con el enlace de Google Maps: mapa por coordenadas, «Cómo llegar» al enlace y el nombre del lugar como dirección", () => {
    montar({ opticaMapaUrl: CORTA, opticaMapaNombre: "ÒPTICA SOLNA-VISIÒN", opticaMapaLat: -0.7862109, opticaMapaLng: -80.2346583 })
    expect(screen.getByTitle("Mapa de Óptica Solna Vision")).toHaveAttribute("src", "https://www.google.com/maps?q=-0.7862109,-80.2346583&z=17&output=embed")
    expect(screen.getByRole("link", { name: /Cómo llegar/ })).toHaveAttribute("href", CORTA)
    expect(screen.getByText("ÒPTICA SOLNA-VISIÒN")).toBeInTheDocument()
  })

  it("con dirección escrita y enlace: muestra la dirección y el mapa sale del enlace", () => {
    montar({ opticaDireccion: "Av. Principal 1, Manta", opticaMapaUrl: CORTA, opticaMapaNombre: "ÒPTICA SOLNA-VISIÒN", opticaMapaLat: -0.78, opticaMapaLng: -80.23 })
    expect(screen.getByText("Av. Principal 1, Manta")).toBeInTheDocument()
    expect(screen.getByTitle("Mapa de Óptica Solna Vision").getAttribute("src")).toContain("q=-0.78,-80.23")
  })

  it("sin enlace, el mapa y «Cómo llegar» salen de la dirección escrita, como antes", () => {
    montar({ opticaDireccion: "Av. 9 de Octubre 123" })
    expect(screen.getByTitle("Mapa de Óptica Solna Vision").getAttribute("src")).toContain(encodeURIComponent("Av. 9 de Octubre 123"))
    expect(screen.getByRole("link", { name: /Cómo llegar/ }).getAttribute("href")).toContain(encodeURIComponent("Av. 9 de Octubre 123"))
  })

  it("sin dirección ni enlace: mensaje claro y sin mapa", () => {
    montar({})
    expect(screen.getByText("La óptica aún no ha publicado su dirección.")).toBeInTheDocument()
    expect(screen.queryByTitle("Mapa de Óptica Solna Vision")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Cómo llegar/ })).not.toBeInTheDocument()
  })

  it("un enlace guardado que no es de Google Maps se ignora", () => {
    montar({ opticaMapaUrl: "https://evil.com/x", opticaMapaLat: 1, opticaMapaLng: 1 })
    expect(screen.queryByTitle("Mapa de Óptica Solna Vision")).not.toBeInTheDocument()
  })
})
