import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import VistaPrevia, { BotonDeMuestra, EtiquetaDeMuestra, textoBotonDeMuestra } from "./VistaPrevia"
import { Cascaron } from "./AtencionPaciente"

describe("una vista previa se ve como muestra", () => {
  it("lleva la etiqueta «Vista previa», un fondo y un borde distintos (punteado) y dice qué muestra", () => {
    render(<VistaPrevia leyenda="Así lo verá el administrador"><p>contenido</p></VistaPrevia>)
    const s = screen.getByRole("region", { name: "Vista previa" })
    expect(within(s).getByText("Vista previa")).toBeInTheDocument()
    expect(within(s).getByText("Así lo verá el administrador")).toBeInTheDocument()
    expect(s.className).toMatch(/border-dashed/)
    expect(s.className).toMatch(/bg-slate-100/)
  })

  it("los botones de muestra están atenuados, no son botones, no reaccionan al cursor y dicen quién podrá usarlos", () => {
    render(<VistaPrevia><BotonDeMuestra principal>Ver la guía</BotonDeMuestra><BotonDeMuestra>Responder</BotonDeMuestra></VistaPrevia>)
    expect(screen.queryAllByRole("button")).toHaveLength(0) // no se pueden pulsar ni enfocar
    for (const t of ["Ver la guía", "Responder"]) {
      const b = screen.getByText(t)
      expect(b).toHaveAttribute("aria-disabled", "true")
      expect(b).toHaveAttribute("title", "El administrador podrá usar este botón")
      expect(b.className).toMatch(/opacity-50/)
      expect(b.className).not.toMatch(/hover:|cursor-pointer/)
    }
    expect(textoBotonDeMuestra("La persona")).toBe("La persona podrá usar este botón")
  })

  it("las etiquetas de menú de una muestra también se atenúan y no parecen controles", () => {
    render(<EtiquetaDeMuestra>Inventario</EtiquetaDeMuestra>)
    const e = screen.getByText("Inventario")
    expect(e.className).toMatch(/border-dashed/)
    expect(e.className).not.toMatch(/shadow|hover:|cursor-pointer/)
  })
})

describe("el subtítulo de una ventana se ve completo", () => {
  it("no se corta con «…»", () => {
    const largo = "El administrador la recibe en Soporte como una conversación y puede responder cuando quiera, sin salir de ahí."
    render(<Cascaron titulo="Ofrecer ayuda" subtitulo={largo} onCerrar={() => {}}><p>cuerpo</p></Cascaron>)
    const sub = screen.getByText(largo)
    expect(sub.className).not.toMatch(/truncate/)
  })
})
