import React from "react"
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import { hoyISO } from "../utilidades/disponibilidad"
import { claveBorrador, guardarBorrador, leerBorrador } from "../utilidades/borradorFicha"
import ConsultaMedica from "./ConsultaMedica"

// jsdom no implementa scrollIntoView — la barra de pasos lo usa para saltar a cada sección, sin relación con lo que se prueba acá.
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

// Elige al paciente y el motivo (sin historial: la ficha abre con el aviso de primera consulta). La ficha es una sola página: no hay pasos que avanzar.
function elegirPacienteYMotivo() {
  fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
  fireEvent.click(screen.getByText(PACIENTE.nombre))
  // "Primera consulta" (sin historial) interrumpe con un aviso que hay que cerrar.
  fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
  // El motivo se decide primero (sin cita, es el selector obligatorio).
  fireEvent.change(screen.getByLabelText(/Motivo de la consulta/i), { target: { value: "Consulta General" } })
}
const terminar = () => fireEvent.click(screen.getByRole("button", { name: /Terminar atención/i }))

describe("ConsultaMedica — ficha de una sola página", () => {
  beforeEach(() => localStorage.clear())

  it("tiene los cinco pasos con nombres cortos y completos, y ya no hay «Siguiente», «Anterior» ni cuadro de «Avance»", () => {
    renderFicha()
    const barra = screen.getByRole("navigation", { name: "Pasos de la ficha" })
    for (const nombre of ["Motivo", "Refracción", "Examen", "Diagnóstico", "Receta"]) expect(within(barra).getByRole("button", { name: new RegExp("^" + nombre) })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Siguiente$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Anterior$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Avance$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Paso \d de/i)).not.toBeInTheDocument()
  })

  it("cada paso de la barra lleva a su sección", () => {
    renderFicha()
    const salto = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {})
    fireEvent.click(within(screen.getByRole("navigation", { name: "Pasos de la ficha" })).getByRole("button", { name: /^Refracción/ }))
    expect(salto).toHaveBeenCalled()
    expect(salto.mock.instances.at(-1).id).toBe("ficha-refraccion")
    salto.mockRestore()
  })

  it("cada sección dice cómo va: falta el paciente, falta un ojo, registrado", () => {
    renderFicha()
    expect(screen.getAllByText("Falta el paciente").length).toBeGreaterThan(0)
    elegirPacienteYMotivo()
    expect(screen.getAllByText("Registrado").length).toBeGreaterThan(0)
    fireEvent.change(document.getElementById("OD-esf"), { target: { value: "-1.75" } })
    expect(screen.getByText("Falta el ojo izquierdo")).toBeInTheDocument()
  })

  // El próximo control no se decide solo: ninguna opción viene marcada y no se puede terminar la atención sin elegir.
  it("el control no viene marcado y obliga a elegir entre agendar ahora o después", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    expect(screen.getByRole("radio", { name: /Agendar ahora/i })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: /Agendar después/i })).not.toBeChecked()
    terminar()
    expect(screen.getAllByText(/Elige si el próximo control se agenda ahora o después/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // "Agendar ahora" sin fecha y hora tampoco deja terminar
    fireEvent.click(screen.getByRole("radio", { name: /Agendar ahora/i }))
    terminar()
    expect(screen.getAllByText(/Elige la fecha y la hora del control/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("un tratamiento finalizado no pide agendar ningún control", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByLabelText(/Tratamiento finalizado/i))
    expect(screen.queryByRole("radio", { name: /Agendar ahora/i })).not.toBeInTheDocument()
    terminar()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  // Regresión del bug reportado por el ing (29-sept, docs/feedback-ing/bug-diagnostico-receta.md): un envío fantasma validaba la ficha sin que nadie la guardara.
  it("al abrir la ficha no aparece ningún error: nada se valida hasta intentar terminar la atención", () => {
    renderFicha()
    elegirPacienteYMotivo()
    expect(screen.queryByText(/No puedes continuar todavía/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Selecciona al menos una categoría de diagnóstico/i)).not.toBeInTheDocument()
    // El costo ya no se captura en la ficha: se cobra en el panel que aparece al guardar.
    expect(screen.queryByText(/Costo de la consulta/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toHaveAttribute("type", "submit")
  })

  it("elegir 'Otro' como categoría de diagnóstico y guardar sin detalle muestra el error dedicado", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Otro" }))
    terminar()
    expect(screen.getAllByText(/Describe el diagnóstico en el detalle/i).length).toBeGreaterThan(0)
    // No debe haber avanzado a "guardado" — el botón sigue siendo el de guardar, no "Nueva consulta".
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
  })

  it("elegir 'Otro' y sí describir el detalle no muestra ese error al guardar", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Otro" }))
    fireEvent.change(screen.getByLabelText(/Detalle del diagnóstico personalizado/i), { target: { value: "Hallazgo descrito a mano por el optómetra." } })
    terminar()
    expect(screen.queryByText(/Describe el diagnóstico en el detalle/i)).not.toBeInTheDocument()
  })

  it("la refracción es una tabla con el ojo derecho arriba y el izquierdo abajo, y arranca vacía", () => {
    renderFicha()
    elegirPacienteYMotivo()
    const tabla = screen.getByRole("table", { name: /Refracción/i })
    const filas = within(tabla).getAllByRole("row")
    expect(filas[1]).toHaveAttribute("data-ojo", "od")
    expect(filas[2]).toHaveAttribute("data-ojo", "oi")
    for (const id of ["OD-esf", "OD-cil", "OD-eje", "OI-esf", "OI-cil", "OI-eje", "dp", "alt", "avCerca", "add"]) {
      const el = document.getElementById(id)
      if (el) expect(el.value).toBe("")
    }
    expect(document.getElementById("OD-esf")).toHaveAttribute("placeholder", "0.00")
    expect(screen.getAllByText("No registrado").length).toBeGreaterThan(0)
  })

  it("la refracción: el signo, el cuarto de dioptría y el eje de 0 a 180", () => {
    renderFicha()
    elegirPacienteYMotivo()
    const esf = document.getElementById("OD-esf")
    fireEvent.keyDown(esf, { key: "-" })
    expect(esf.value).toBe("-")
    fireEvent.change(esf, { target: { value: "-1.60" } })
    fireEvent.blur(esf)
    expect(esf.value).toBe("-1.50")
    fireEvent.keyDown(esf, { key: "ArrowUp" })
    expect(esf.value).toBe("-1.25")
    const eje = document.getElementById("OD-eje")
    fireEvent.change(eje, { target: { value: "270" } })
    expect(Number(eje.value)).toBeLessThanOrEqual(180)
  })

  it("se puede terminar sin medir nada: sin ninguna medida no hay receta", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("la receta exige los dos ojos: con uno medido, el otro se mide o se marca «Ojo no evaluado» con su motivo", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.change(document.getElementById("OD-esf"), { target: { value: "-1.75" } })
    terminar()
    expect(screen.getByText(/Ingresa la esfera o marca «Ojo no evaluado»/i)).toBeInTheDocument()
    // «Ojo no evaluado» pide el motivo
    fireEvent.click(screen.getByRole("checkbox", { name: /Ojo izquierdo no evaluado/i }))
    terminar()
    expect(screen.getByText(/Di por qué no se evaluó este ojo/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/¿Por qué no se evaluó el ojo izquierdo\?/i), { target: { value: "Prótesis ocular" } })
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("un cilindro sin eje se señala", () => {
    renderFicha()
    elegirPacienteYMotivo()
    fireEvent.change(document.getElementById("OD-cil"), { target: { value: "-1.00" } })
    fireEvent.change(document.getElementById("OI-esf"), { target: { value: "-1.00" } })
    fireEvent.change(document.getElementById("OD-esf"), { target: { value: "-1.00" } })
    terminar()
    expect(screen.getByText(/Indica el eje del cilindro/i)).toBeInTheDocument()
  })

  it("elegir motivo \"Otros\" abre el detalle con foco y exige describirlo", () => {
    renderFicha()
    fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))

    fireEvent.change(screen.getByLabelText(/Motivo de la consulta/i), { target: { value: "Otros" } })
    const detalle = screen.getByLabelText(/Describe el motivo/i)
    expect(detalle).toHaveFocus()

    terminar()
    expect(screen.getByText("Describe el motivo.")).toBeInTheDocument()
  })

  it("la vista previa es la hoja que se imprime: el ojo derecho arriba y el izquierdo abajo", () => {
    renderFicha()
    elegirPacienteYMotivo()
    const hojas = document.querySelectorAll("[data-hoja-receta]")
    expect(hojas.length).toBeGreaterThan(0)
    const filas = [...hojas[0].querySelectorAll("tbody tr")].map((tr) => tr.textContent.slice(0, 2))
    expect(filas).toEqual(["OD", "OI"])
  })

  it("la cabecera del paciente muestra su edad (de la fecha de nacimiento) y sus alergias bien a la vista", () => {
    const nacido = { ...PACIENTE, fecha_nacimiento: "1990-06-15" }
    render(<ConsultaMedica usuario={{ id: "u1", nombre: "Optómetra" }} pacientes={[nacido]} consultas={[]} inventario={[]} parametrizacion={{}} diagnosticosRapidos={["Miopía"]} motivosConsulta={["Consulta General"]} citas={[]} pacienteInicial={nacido} />)
    expect(screen.getByText(/· \d+ años/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
    fireEvent.change(screen.getByLabelText(/^Alergias/), { target: { value: "Penicilina" } })
    expect(screen.getByText("Alergias: Penicilina")).toBeInTheDocument()
  })

  it("sin fecha de nacimiento la cabecera lo dice en vez de inventar una edad", () => {
    render(<ConsultaMedica usuario={{ id: "u1", nombre: "Optómetra" }} pacientes={[PACIENTE]} consultas={[]} inventario={[]} parametrizacion={{}} diagnosticosRapidos={[]} motivosConsulta={["Consulta General"]} citas={[]} pacienteInicial={PACIENTE} />)
    expect(screen.getByText(/edad sin registrar/i)).toBeInTheDocument()
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
    elegirPacienteYMotivo()
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
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

describe("ConsultaMedica — guardado automático", () => {
  beforeEach(() => localStorage.clear())
  const ficha = (extra = {}) => render(<ConsultaMedica usuario={{ id: "u1", nombre: "Optómetra" }} pacientes={[PACIENTE]} consultas={[]} inventario={[]} parametrizacion={{}} diagnosticosRapidos={["Miopía"]} motivosConsulta={["Consulta General"]} citas={[]} pacienteInicial={PACIENTE} {...extra} />)

  it("mientras se escribe, la ficha se guarda sola como borrador y la barra lo dice", async () => {
    ficha()
    fireEvent.click(await screen.findByRole("button", { name: /Entendido, completar antecedentes/i }))
    await new Promise((r) => setTimeout(r, 500)) // la ficha empieza a vigilar los cambios un instante después de abrir
    expect(screen.getByText(/se guarda solo mientras escribes/i)).toBeInTheDocument()
    fireEvent.change(document.getElementById("OD-esf"), { target: { value: "-2.25" } })
    await waitFor(() => expect(leerBorrador(claveBorrador("u1", "p1", null))?.datos.odEsfera).toBe("-2.25"), { timeout: 4000 })
    expect(screen.getByText(/Guardado (ahora|hace)/)).toBeInTheDocument()
  })

  it("al volver a abrir la ficha ofrece recuperar lo que estaba a medias", async () => {
    guardarBorrador(claveBorrador("u1", "p1", null), { motivo: "Consulta General", odEsfera: "-1.75", oiEsfera: "-1.50" })
    ficha()
    expect(await screen.findByText(/Hay una ficha a medias de este paciente/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))
    expect(document.getElementById("OD-esf").value).toBe("-1.75")
    expect(document.getElementById("OI-esf").value).toBe("-1.50")
    expect(screen.queryByText(/Hay una ficha a medias/i)).not.toBeInTheDocument()
  })

  it("«Empezar de cero» descarta el borrador", async () => {
    const k = claveBorrador("u1", "p1", null)
    guardarBorrador(k, { odEsfera: "-1.75" })
    ficha()
    fireEvent.click(await screen.findByRole("button", { name: "Empezar de cero" }))
    expect(leerBorrador(k)).toBeNull()
    expect(document.getElementById("OD-esf").value).toBe("")
  })

  it("«Guardar y salir» deja el borrador al día y cierra la ficha sin terminar la atención", async () => {
    const onCerrar = vi.fn()
    ficha({ onCerrar })
    fireEvent.click(await screen.findByRole("button", { name: /Entendido, completar antecedentes/i }))
    fireEvent.change(document.getElementById("OD-esf"), { target: { value: "-3.00" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar y salir/i }))
    expect(onCerrar).toHaveBeenCalled()
    expect(leerBorrador(claveBorrador("u1", "p1", null))?.datos.odEsfera).toBe("-3.00")
  })
})

describe("Entrar a la ficha desde una cita", () => {
  const props = (citas, extra = {}) => ({
    usuario: { id: "u1", nombre: "Optómetra de prueba", rol: "asistente" }, pacientes: [PACIENTE], consultas: [], inventario: [], parametrizacion: {},
    diagnosticosRapidos: [], motivosConsulta: ["Consulta General"], citas, pacienteInicial: PACIENTE, citaIdInicial: "c1", motivoInicial: "Consulta General", ...extra,
  })

  it("una cita de otro día se mueve a hoy al abrir su ficha: nunca queda 'En atención' con fecha futura", async () => {
    const futura = { id: "c1", paciente: PACIENTE.nombre, pacienteId: "p1", fecha: "2099-01-05", hora: "09:00 AM", estado: "Pendiente" }
    const cambios = []
    const avisos = []
    render(<ConsultaMedica {...props([futura], { setCitas: (f) => cambios.push(f), onAviso: (m) => avisos.push(m) })} />)
    await waitFor(() => expect(cambios.length).toBeGreaterThan(0))
    const final = cambios.reduce((lista, f) => f(lista), [futura])
    expect(final[0].fecha).toBe(hoyISO())
    expect(final[0].hora).toMatch(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/)
    expect(avisos.some((m) => /se movió a hoy/.test(m))).toBe(true)
  })

  it("una cita de hoy no se mueve ni avisa nada", async () => {
    const deHoy = { id: "c1", paciente: PACIENTE.nombre, pacienteId: "p1", fecha: hoyISO(), hora: "09:00 AM", estado: "Pendiente" }
    const cambios = []
    const avisos = []
    render(<ConsultaMedica {...props([deHoy], { setCitas: (f) => cambios.push(f), onAviso: (m) => avisos.push(m) })} />)
    await new Promise((r) => setTimeout(r, 60))
    expect(cambios.reduce((lista, f) => f(lista), [deHoy])[0].fecha).toBe(deHoy.fecha)
    expect(avisos).toEqual([])
  })
})
