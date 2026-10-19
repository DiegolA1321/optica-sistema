import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { GraduacionVigente, CambioGraduacion, VistaGraduacion } from "./Graduacion"
import GraduacionPerfil from "./GraduacionPerfil"
import HojaReceta, { numeroDeReceta } from "../HojaReceta"
import { imprimirHojaReceta } from "../../utilidades/imprimirHojaReceta"

const receta = (extra = {}) => ({
  id: "c1", fecha: "2026-04-20", pacienteId: "p1", diagnostico: "Miopía", indicaciones: "Usa tus lentes todo el día.", lenteRecomendado: "Progresivo con filtro azul",
  profesionalNombre: "Dra. Paula Andrade", profesionalRegistro: "REG-9",
  od: { esfera: "-1.75", cilindro: "-0.50", eje: "90", avSc: "20/60", avCc: "20/20" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avCc: "20/25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" }, ...extra,
})
const anterior = receta({ id: "c0", fecha: "2025-11-21", indicaciones: "Control en 6 meses.", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.00", cilindro: "-0.75", eje: "80", avCc: "20/25" } })

describe("La graduación, un solo componente con dos versiones", () => {
  it("la versión del paciente usa palabras simples y la del personal la notación técnica, con los mismos valores", () => {
    const { unmount } = render(<GraduacionVigente receta={receta()} version="paciente" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("Tienes miopía leve")
    expect(document.body.textContent).not.toMatch(/\bOD\b|\bOI\b/)
    unmount()
    render(<GraduacionVigente receta={receta()} version="personal" />)
    const od = screen.getByRole("region", { name: "Ojo derecho" })
    expect(od).toHaveTextContent("OD · Ojo derecho")
    for (const v of ["−1.75", "Esfera", "Cilindro", "−0.50", "Eje", "90°", "Sin corrección", "20/60", "Con su corrección actual", "20/20"]) expect(od).toHaveTextContent(v)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("OI · Ojo izquierdo")
    expect(document.body.textContent).toContain("Adición+1.00")
    expect(document.body.textContent).toContain("Distancia pupilar (DP)62")
    expect(document.body.textContent).toContain("Altura de montaje18")
    // la vista técnica NO lleva las frases para el paciente (solo con «Explicar al paciente»)
    expect(od).not.toHaveTextContent("Tienes miopía")
  })

  it("en la versión del personal, sin esfera va «Sin registrar» (pequeño y gris) y con receta anterior dice cuánto cambió y desde cuándo", () => {
    const { unmount } = render(<GraduacionVigente receta={receta({ oi: { cilindro: "-0.75" } })} version="personal" />)
    const oi = screen.getByRole("region", { name: "Ojo izquierdo" })
    expect(oi).toHaveTextContent("Sin registrar")
    expect(oi.querySelector("p.text-5xl")).toBeNull()
    unmount()
    render(<GraduacionVigente receta={receta()} anterior={anterior} version="personal" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("0.25 más de miopía desde noviembre")
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("0.25 más de miopía desde noviembre")
  })

  it("en la versión del personal, donde un dato no se registró dice «No registrado», no un guion", () => {
    render(<GraduacionVigente receta={receta({ oi: { esfera: "-1.25" }, medidas: {} })} version="personal" />)
    const oi = screen.getByRole("region", { name: "Ojo izquierdo" })
    expect(oi).toHaveTextContent("No registrado")
    expect(oi.textContent.match(/No registrado/g).length).toBeGreaterThanOrEqual(3) // cilindro, eje y las dos agudezas
    expect(document.body.textContent).toContain("Sin adición, distancia pupilar ni altura de montaje en esta receta.")
    expect(document.body.textContent).not.toContain("—")
  })

  it("datos incompletos: un ojo sin ninguna medida es UNA línea («Sin datos del ojo izquierdo en esta receta»), no una cuadrícula de «No registrado»", () => {
    const { unmount } = render(<GraduacionVigente receta={receta({ oi: {} })} version="personal" />)
    const oi = screen.getByRole("region", { name: "Ojo izquierdo" })
    expect(oi).toHaveTextContent("Sin datos del ojo izquierdo en esta receta.")
    expect(oi).not.toHaveTextContent("No registrado")
    unmount()
    render(<GraduacionVigente receta={receta({ od: {} })} version="paciente" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("Sin datos del ojo derecho en esta receta.")
  })

  it("un ojo marcado «Ojo no evaluado» dice su motivo en todas las vistas (portal, personal y receta impresa)", () => {
    const r = receta({ oi: {}, ojoNoEvaluado: { od: "", oi: "Prótesis ocular" } })
    const { unmount } = render(<GraduacionVigente receta={r} version="personal" />)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("Ojo no evaluado: Prótesis ocular")
    unmount()
    const { unmount: u2 } = render(<GraduacionVigente receta={r} version="paciente" />)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("Ojo no evaluado: Prótesis ocular")
    u2()
    render(<HojaReceta optica={{ nombre: "Óptica" }} paciente={{ nombre: "Marta" }} receta={r} />)
    expect(document.querySelector("[data-hoja-receta]")).toHaveTextContent("Ojo no evaluado: Prótesis ocular")
  })

  it("con una medida suelta (solo la DP) las medidas se muestran y lo que falta dice «No registrado»", () => {
    render(<GraduacionVigente receta={receta({ medidas: { dp: "62" } })} version="personal" />)
    expect(document.body.textContent).toContain("Distancia pupilar (DP)62")
    expect(document.body.textContent).toContain("AdiciónNo registrado")
  })

  it("cada tarjeta de ojo se pulsa y abre «Historia de este ojo»: todas sus recetas en una tabla y la gráfica de su esfera; una fila elige esa receta", () => {
    const filas = [receta(), anterior]
    render(<VistaGraduacion recetas={filas} version="personal" titulo="Graduación" />)
    fireEvent.click(screen.getByRole("button", { name: /Ver la historia del ojo derecho/ }))
    const ventana = screen.getByRole("dialog", { name: /Historia de este ojo · OD/ })
    expect(within(ventana).getByRole("img", { name: /Gráfica de la esfera del ojo derecho/ })).toBeInTheDocument()
    const tabla = within(ventana).getByRole("button", { name: /Ver la receta del 21 de noviembre de 2025/ })
    expect(tabla).toHaveTextContent("−1.50")
    expect(within(ventana).getAllByRole("button", { name: /Ver la receta del/ })).toHaveLength(2)
    fireEvent.click(tabla)
    expect(screen.queryByRole("dialog", { name: /Historia de este ojo/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Elegir otra receta/ })).not.toHaveTextContent("vigente")
  })

  it("la posición de los ojos: en el paciente el derecho va a la derecha; en el personal también: ojo izquierdo a la izquierda y derecho a la derecha", () => {
    const { unmount } = render(<GraduacionVigente receta={receta()} version="paciente" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" }).className).toMatch(/order-2/)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" }).className).toMatch(/order-1/)
    unmount()
    render(<GraduacionVigente receta={receta()} version="personal" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" }).className).toMatch(/order-2/)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" }).className).toMatch(/order-1/)
  })

  it("el antes → ahora dice lo mismo en las dos versiones: la misma cuenta, con palabras distintas", () => {
    const { unmount } = render(<CambioGraduacion consultas={[receta(), anterior]} version="paciente" />)
    expect(screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })).toHaveTextContent("0.25 más de miopía")
    unmount()
    render(<CambioGraduacion consultas={[receta(), anterior]} version="personal" />)
    const s = screen.getByRole("region", { name: "Cambio desde la consulta anterior" })
    expect(s).toHaveTextContent("OD · Ojo derecho")
    expect(s).toHaveTextContent("0.25 más de miopía")
  })
})

describe("La vista completa de una receta (selector, antes → ahora, indicaciones)", () => {
  const tres = [receta(), anterior, receta({ id: "c00", fecha: "2025-03-01", indicaciones: "Primera receta.", od: { esfera: "-0.50" }, oi: { esfera: "-0.75" } })]

  it("sin más de una receta, el selector es un rótulo y no aparecen comparar ni el antes → ahora", () => {
    render(<VistaGraduacion recetas={[receta()]} titulo="Mi receta" />)
    expect(screen.queryByRole("button", { name: /Elegir otra receta/ })).not.toBeInTheDocument()
    expect(screen.getByText("20 abr 2026 · vigente")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Comparar dos recetas" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: /Cómo cambió/ })).not.toBeInTheDocument()
  })

  it("al elegir otra receta cambia toda la vista: los ojos, el antes → ahora (contra la anterior a esa) y las indicaciones", () => {
    render(<VistaGraduacion recetas={tres} titulo="Mi receta" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("−1.75")
    expect(screen.getByRole("region", { name: "Lo que te indicó tu optómetra" })).toHaveTextContent("Usa tus lentes todo el día.")
    fireEvent.click(screen.getByRole("button", { name: /Elegir otra receta/ }))
    fireEvent.click(screen.getByRole("option", { name: /21 de noviembre de 2025/ }))
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("−1.50")
    expect(screen.getByRole("region", { name: "Lo que te indicó tu optómetra" })).toHaveTextContent("Control en 6 meses.")
    expect(screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })).toHaveTextContent("Mar 2025")
    // la más antigua no tiene receta anterior: no hay antes → ahora
    fireEvent.click(screen.getByRole("button", { name: /Elegir otra receta/ }))
    fireEvent.click(screen.getByRole("option", { name: /1 de marzo de 2025/ }))
    expect(screen.queryByRole("region", { name: /Cómo cambió/ })).not.toBeInTheDocument()
  })

  it("«Comparar dos recetas» compara la elegida con la anterior a ella, y «Descargar» entrega la elegida", () => {
    const entregar = vi.fn()
    render(<VistaGraduacion recetas={tres} titulo="Mi receta" accion={{ texto: "Descargar receta", onClick: entregar }} />)
    fireEvent.click(screen.getByRole("button", { name: /Elegir otra receta/ }))
    fireEvent.click(screen.getByRole("option", { name: /21 de noviembre de 2025/ }))
    fireEvent.click(screen.getByRole("button", { name: "Comparar dos recetas" }))
    const v = screen.getByRole("dialog", { name: "Comparar dos recetas" })
    expect(within(v).getByLabelText("Primera receta")).toHaveValue("c00")
    expect(within(v).getByLabelText("Segunda receta")).toHaveValue("c0")
    fireEvent.click(within(v).getAllByRole("button", { name: "Cerrar" }).pop())
    fireEvent.click(screen.getByRole("button", { name: "Descargar receta" }))
    expect(entregar).toHaveBeenCalledWith(expect.objectContaining({ id: "c0" }))
  })

  it("el filtro por año del selector deja solo las recetas de ese año", () => {
    render(<VistaGraduacion recetas={tres} titulo="Mi receta" />)
    fireEvent.click(screen.getByRole("button", { name: /Elegir otra receta/ }))
    const menu = screen.getByRole("listbox", { name: "Recetas del paciente" })
    fireEvent.click(within(menu.parentElement).getByRole("button", { name: "2026" }))
    expect(within(menu).getAllByRole("option")).toHaveLength(1)
    fireEvent.click(within(menu.parentElement).getByRole("button", { name: "2025" }))
    expect(within(menu).getAllByRole("option")).toHaveLength(2)
  })
})

describe("La pestaña «Graduación» del perfil del personal", () => {
  const props = { consultas: [anterior, receta()], paciente: { nombre: "Marta Zambrano", cedula: "0934070830" }, usuario: { opticaNombre: "Óptica Solna Vision" } }

  it("es la misma vista del portal, en versión técnica, con comparar, imprimir y «Explicar al paciente» (sin «Cambio» ni «Tendencia»: los cubren comparar y la historia de cada ojo)", () => {
    render(<GraduacionPerfil {...props} />)
    expect(screen.getByRole("heading", { name: "Graduación" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Elegir otra receta/ })).toHaveTextContent("20 abr 2026 · vigente")
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("OD · Ojo derecho")
    expect(screen.queryByRole("region", { name: "Cambio desde la consulta anterior" })).not.toBeInTheDocument()
    expect(screen.queryByText("Tendencia de graduación medida")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Comparar dos recetas" }))
    expect(screen.getByRole("dialog", { name: "Comparar dos recetas" })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.getByRole("region", { name: "Indicaciones" })).toHaveTextContent("Usa tus lentes todo el día.")
    expect(screen.getByRole("button", { name: "Comparar dos recetas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Imprimir receta" })).toBeInTheDocument()
    expect(screen.queryByText(/Tienes miopía leve/)).not.toBeInTheDocument()
    // «Explicar al paciente» cambia la vista a la de palabras simples del portal, y vuelve
    fireEvent.click(screen.getByRole("button", { name: "Explicar al paciente" }))
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("Tienes miopía leve")
    fireEvent.click(screen.getByRole("button", { name: "Volver a la vista técnica" }))
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("OD · Ojo derecho")
  })

  it("sin recetas (consultas sin medidas) dice qué pasa en vez de quedar vacío", () => {
    render(<GraduacionPerfil consultas={[{ id: "x", fecha: "2026-01-01", od: {}, oi: {} }]} paciente={{}} usuario={{}} />)
    expect(screen.getByText("Este paciente todavía no tiene una receta")).toBeInTheDocument()
  })
})

describe("La hoja de la receta (la misma para el optómetra y el paciente)", () => {
  it("lleva el membrete, los datos del paciente, la tabla de graduación, el lente, las indicaciones, el profesional con su firma y la fecha", () => {
    render(<HojaReceta optica={{ nombre: "Óptica Solna Vision", direccion: "Av. Principal 123", telefono: "0991234567" }} paciente={{ nombre: "Marta Zambrano", cedula: "0934070830", edad: 72 }} receta={receta()} />)
    const hoja = document.querySelector("[data-hoja-receta]")
    for (const t of ["Óptica Solna Vision", "Av. Principal 123 · 0991234567", "Receta óptica", numeroDeReceta(receta()), "Marta Zambrano", "0934070830", "72 años", "Esfera", "Cilindro", "Eje", "Con su corrección actual", "−1.75", "Adición", "Distancia pupilar", "Lente recomendado", "Progresivo con filtro azul", "Indicaciones y cuidados", "Usa tus lentes todo el día.", "Dra. Paula Andrade", "Reg. Prof. REG-9", "20 de abril de 2026"]) {
      expect(hoja.textContent).toContain(t)
    }
  })
  it("sin permiso de medidas no imprime la distancia pupilar ni la altura", () => {
    render(<HojaReceta optica={{ nombre: "X" }} paciente={{ nombre: "Y" }} receta={receta()} mostrarMedidas={false} />)
    expect(document.body.textContent).not.toContain("Distancia pupilar")
    expect(document.body.textContent).toContain("Adición")
  })
  it("imprimirHojaReceta monta la hoja en una capa, imprime y la quita al terminar", () => {
    window.print = vi.fn()
    imprimirHojaReceta({ optica: { nombre: "Óptica Solna Vision" }, paciente: { nombre: "Marta Zambrano" }, receta: receta() })
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(document.getElementById("print-hoja-receta")?.textContent).toContain("Marta Zambrano")
    expect(document.body.classList.contains("imprimiendo-hoja-receta")).toBe(true)
    window.dispatchEvent(new Event("afterprint"))
    expect(document.getElementById("print-hoja-receta")).toBeNull()
    expect(document.body.classList.contains("imprimiendo-hoja-receta")).toBe(false)
  })
})
