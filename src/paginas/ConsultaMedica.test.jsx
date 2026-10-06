import React from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import ConsultaMedica from "./ConsultaMedica"

// jsdom no implementa scrollIntoView — el propio componente lo llama al
// cambiar de paso (autoscroll al inicio del formulario), sin relación con lo
// que se prueba acá.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const PACIENTE = { id: "p1", nombre: "Paciente De Prueba", cedula: "0000000000" }

function renderFicha() {
  return render(
    <ConsultaMedica
      usuario={{ nombre: "Optómetra de prueba" }}
      pacientes={[PACIENTE]}
      consultas={[]}
      inventario={[]}
      parametrizacion={{}}
      diagnosticosRapidos={["Miopía"]}
      motivosConsulta={["Consulta General"]}
      citas={[]}
    />
  )
}

// Lleva la ficha desde el inicio hasta el paso Refracción, con un paciente
// sin historial (abre en Anamnesis) — mismo camino que reprodujo el bug del
// 29 de septiembre con un clic real en "Siguiente".
function avanzarHastaRefraccion() {
  fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
  fireEvent.click(screen.getByText(PACIENTE.nombre))
  // "Primera consulta" (sin historial) interrumpe con un aviso que hay que cerrar.
  fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
  // El motivo se decide en el paso 1 (sin cita, es el selector obligatorio).
  fireEvent.change(screen.getByLabelText(/Motivo de la consulta/i), { target: { value: "Consulta General" } })
  fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))
}

describe("ConsultaMedica — navegación Refracción → Diagnóstico y receta", () => {
  // Regresión del bug reportado por el ing (29-sept, docs/feedback-ing/bug-diagnostico-receta.md):
  // "Siguiente" y "Terminar atención" compartían el mismo slot de JSX sin
  // key propia. React reutilizaba el mismo nodo <button> al cambiar de paso y
  // solo le mutaba el atributo type de "button" a "submit" a mitad del clic,
  // lo que disparaba un submit fantasma de intentarGuardar (que valida los 3
  // pasos) apenas se llegaba a Diagnóstico — mostrando el error de categoría sin que el usuario hubiera tocado nada todavía.
  it("'Siguiente' y 'Terminar atención' son nodos <button> distintos, no el mismo reutilizado", () => {
    // Esta es la comprobación que de verdad detecta la regresión: el bug real
    // (un clic real de mouse muta el type="button" a type="submit" A MITAD del
    // clic porque React reutiliza el nodo) solo ocurre en un navegador de
    // verdad — jsdom no reproduce esa condición de carrera con fireEvent, así
    // que no sirve para probar el síntoma directamente. Lo que sí es 100%
    // observable acá, con el mismo motor de reconciliación que usa React en
    // cualquier entorno, es la CAUSA: si "Siguiente" y "Terminar atención"
    // no tienen key propia, React reutiliza el mismo nodo del DOM entre un
    // paso y otro. Con key distinta (el fix), son dos nodos <button> distintos.
    renderFicha()
    avanzarHastaRefraccion()

    const nodoSiguiente = screen.getByRole("button", { name: /^Siguiente$/i })
    fireEvent.click(nodoSiguiente)
    const nodoGuardar = screen.getByRole("button", { name: /Terminar atención/i })

    expect(nodoGuardar).not.toBe(nodoSiguiente)
  })

  it("llegar a Diagnóstico con 'Siguiente' no dispara la validación de guardado ni muestra errores", () => {
    renderFicha()
    avanzarHastaRefraccion()

    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))

    expect(screen.queryByText(/No puedes continuar todavía/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Selecciona al menos una categoría de diagnóstico/i)).not.toBeInTheDocument()
    // El costo ya no se captura en la ficha: se cobra en el panel que aparece al guardar.
    expect(screen.queryByText(/Costo de la consulta/i)).not.toBeInTheDocument()
    // El botón visible en este paso debe seguir siendo "Terminar atención"
    // (type="submit"), no haberse reenviado/reseteado a otro estado.
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
  })

  it("elegir 'Otro' como categoría de diagnóstico y guardar sin detalle muestra el error dedicado", () => {
    renderFicha()
    avanzarHastaRefraccion()
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))

    fireEvent.click(screen.getByRole("button", { name: "Otro" }))

    fireEvent.click(screen.getByRole("button", { name: /Terminar atención/i }))

    expect(screen.getByText(/Describe el diagnóstico en el detalle/i)).toBeInTheDocument()
    // No debe haber avanzado a "guardado" — el botón sigue siendo el de guardar, no "Nueva consulta".
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
  })

  it("elegir 'Otro' y sí describir el detalle no muestra ese error al guardar", () => {
    renderFicha()
    avanzarHastaRefraccion()
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))

    fireEvent.click(screen.getByRole("button", { name: "Otro" }))
    fireEvent.change(screen.getByLabelText(/Detalle del diagnóstico personalizado/i), { target: { value: "Hallazgo descrito a mano por el optómetra." } })

    fireEvent.click(screen.getByRole("button", { name: /Terminar atención/i }))

    expect(screen.queryByText(/Describe el diagnóstico en el detalle/i)).not.toBeInTheDocument()
  })

  it("la refracción arranca vacía: ningún valor por defecto, solo placeholders", () => {
    renderFicha()
    avanzarHastaRefraccion()

    for (const id of ["OD-esf", "OD-cil", "OD-eje", "OI-esf", "OI-cil", "OI-eje", "dp", "alt", "avCerca", "add"]) {
      const el = document.getElementById(id)
      // Visión cercana arranca colapsada; las medidas de ojo sí están visibles.
      if (el) expect(el.value).toBe("")
    }
    expect(screen.getByLabelText("Esfera", { selector: "#OD-esf" })).toHaveAttribute("placeholder", "0.00")
    expect(screen.getAllByText("No registrado").length).toBeGreaterThan(0)
  })

  it("se puede pasar a Diagnóstico sin medir nada, pero un cilindro sin eje se señala", () => {
    renderFicha()
    avanzarHastaRefraccion()

    fireEvent.change(document.getElementById("OD-cil"), { target: { value: "-1.00" } })
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))
    expect(screen.getByText(/Indica el eje del cilindro/i)).toBeInTheDocument()

    fireEvent.change(document.getElementById("OD-eje"), { target: { value: "90" } })
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
  })

  it("elegir motivo \"Otros\" abre el detalle con foco y exige describirlo", () => {
    renderFicha()
    fireEvent.change(screen.getByLabelText(/Paciente */i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))

    fireEvent.change(screen.getByLabelText(/Motivo de la consulta/i), { target: { value: "Otros" } })
    const detalle = screen.getByLabelText(/Describe el motivo/i)
    expect(detalle).toHaveFocus()

    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))
    expect(screen.getByText("Describe el motivo.")).toBeInTheDocument()
  })

  it("al terminar la atención aparece 'Atención terminada' con Pasar a la óptica, y 'Cobrar ahora' abre el cobro con la consulta precargada", () => {
    render(
      <ConsultaMedica
        usuario={{ nombre: "Optómetra de prueba" }}
        pacientes={[PACIENTE]}
        consultas={[]}
        setConsultas={() => {}}
        inventario={[]}
        parametrizacion={{ costosMotivo: { "Consulta General": 15 } }}
        diagnosticosRapidos={["Miopía"]}
        motivosConsulta={["Consulta General"]}
        citas={[]}
      />
    )
    avanzarHastaRefraccion()
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("button", { name: /Terminar atención/i }))
    // Confirmación previa: "Terminar atención" también es el botón del modal
    const modal = screen.getByRole("dialog")
    fireEvent.click(within(modal).getByRole("button", { name: /Terminar atención/i }))

    return screen.findByText(/Atención terminada/i).then(async () => {
      expect(screen.getByRole("button", { name: /Pasar a la óptica/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: /Cobrar ahora/i }))
      await screen.findByText(/Cobrar la atención de Paciente De Prueba/i)
      expect(screen.getByRole("button", { name: /Cobrar y finalizar/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Más tarde/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Precio de Consulta/i)).toHaveValue(15)
    })
  })
})
