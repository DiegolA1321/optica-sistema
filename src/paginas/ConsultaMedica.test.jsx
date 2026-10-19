import React from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import { hoyISO } from "../utilidades/disponibilidad"
import ConsultaMedica from "./ConsultaMedica"

// jsdom no implementa scrollIntoView — el propio componente lo llama al cambiar de paso, sin relación con lo que se prueba acá.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const PACIENTE = { id: "p1", nombre: "Paciente De Prueba", cedula: "0000000000", fechaNacimiento: "1974-03-10" }

const propsBase = (extra = {}) => ({
  usuario: { nombre: "Optómetra de prueba" }, pacientes: [PACIENTE], consultas: [], setConsultas: () => {}, inventario: [], parametrizacion: {},
  diagnosticosRapidos: ["Miopía", "Miopía y astigmatismo", "Sin alteración refractiva"], motivosConsulta: ["Consulta General"], citas: [], ...extra,
})
const renderFicha = (extra) => render(<ConsultaMedica {...propsBase(extra)} />)

const irAPaso = (n, nombre) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Paso ${n}: ${nombre}`) }))
const siguiente = () => fireEvent.click(screen.getByRole("button", { name: /^Siguiente$/i }))

// Elige al paciente (la ficha sin paciente precargado) y pasa el aviso de primera consulta; deja el motivo elegido (paso 1).
function empezar() {
  fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
  fireEvent.click(screen.getByText(PACIENTE.nombre))
  fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
  fireEvent.change(screen.getByLabelText(/^Motivo$/i), { target: { value: "Consulta General" } })
}
// Todo lo obligatorio de los pasos 2 y 3.
function llenarMedidas() {
  irAPaso(2, "Agudeza visual")
  fireEvent.change(screen.getByLabelText("Ojo derecho, sin corrección"), { target: { value: "20/50" } })
  fireEvent.change(screen.getByLabelText("Ojo izquierdo, sin corrección"), { target: { value: "20/40" } })
  irAPaso(3, "Refracción")
  for (const [id, v] of [["odEsfera", "-1.75"], ["odCilindro", "-0.75"], ["odEje", "10"], ["oiEsfera", "-1.50"], ["oiCilindro", "-0.50"], ["oiEje", "90"]]) fireEvent.change(document.getElementById(id), { target: { value: v } })
}
const terminar = () => fireEvent.click(screen.getByRole("button", { name: /Terminar atención/i }))

describe("ConsultaMedica — los cinco pasos", () => {
  it("la barra tiene los cinco pasos, con su estado, y deja ir a cualquiera", () => {
    renderFicha()
    empezar()
    const barra = screen.getByRole("navigation", { name: "Pasos de la ficha clínica" })
    for (const [n, nombre] of [[1, "Anamnesis"], [2, "Agudeza visual"], [3, "Refracción"], [4, "Salud ocular"], [5, "Diagnóstico y receta"]]) expect(within(barra).getByRole("button", { name: new RegExp(`^Paso ${n}: ${nombre}`) })).toBeInTheDocument()
    expect(within(barra).getByRole("button", { name: /^Paso 1: Anamnesis, Completo/ })).toBeInTheDocument()
    expect(within(barra).getByRole("button", { name: /^Paso 2: Agudeza visual, Incompleto/ })).toBeInTheDocument()
    expect(within(barra).getByRole("button", { name: /^Paso 4: Salud ocular, Opcional/ })).toBeInTheDocument()
    irAPaso(5, "Diagnóstico y receta")
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
    // saltar la salud ocular la deja como «Omitido», no «Visto»
    expect(within(barra).getByRole("button", { name: /^Paso 4: Salud ocular, Omitido/ })).toBeInTheDocument()
  })

  it("el motivo viene del catálogo de la óptica y lo que cuenta el paciente va aparte como detalle", () => {
    renderFicha()
    fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
    const motivo = screen.getByLabelText(/^Motivo$/i)
    expect([...motivo.querySelectorAll("option")].map((o) => o.textContent)).toEqual(expect.arrayContaining(["Consulta General", "Otros"]))
    expect(screen.getByLabelText(/Lo que cuenta el paciente/i)).toBeInTheDocument()
  })

  it("las categorías de diagnóstico son las del catálogo de la óptica", () => {
    renderFicha()
    empezar()
    irAPaso(5, "Diagnóstico y receta")
    for (const c of ["Miopía", "Miopía y astigmatismo", "Sin alteración refractiva", "Otro"]) expect(screen.getByRole("button", { name: c })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Presbicia" })).not.toBeInTheDocument()
  })

  it("el control no viene marcado y obliga a elegir entre agendar ahora o después", () => {
    renderFicha()
    empezar()
    llenarMedidas()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    expect(screen.getByRole("radio", { name: /Agendar ahora/i })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: /Agendar después/i })).not.toBeChecked()
    terminar()
    expect(screen.getAllByText(/Elige si el próximo control se agenda ahora o después/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: /Agendar ahora/i }))
    terminar()
    expect(screen.getAllByText(/Elige la fecha y la hora del control/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("un tratamiento finalizado no pide agendar ningún control", () => {
    renderFicha()
    empezar()
    llenarMedidas()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByLabelText(/Tratamiento finalizado/i))
    expect(screen.queryByRole("radio", { name: /Agendar ahora/i })).not.toBeInTheDocument()
    terminar()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  // Regresión del bug del ing (29-sept): «Siguiente» y «Terminar atención» no pueden ser el mismo nodo <button> (disparaba un submit fantasma).
  it("'Siguiente' y 'Terminar atención' son nodos <button> distintos, y llegar al paso 5 no muestra errores", () => {
    renderFicha()
    empezar()
    irAPaso(4, "Salud ocular")
    const nodoSiguiente = screen.getByRole("button", { name: /^Siguiente$/i })
    fireEvent.click(nodoSiguiente)
    const nodoGuardar = screen.getByRole("button", { name: /Terminar atención/i })
    expect(nodoGuardar).not.toBe(nodoSiguiente)
    expect(screen.queryByText(/Falta completar este paso/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Selecciona al menos una categoría de diagnóstico/i)).not.toBeInTheDocument()
  })

  it("al terminar sin lo obligatorio lleva al primer paso que falta y lo dice", () => {
    renderFicha()
    empezar()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
    expect(screen.getAllByRole("alert").some((a) => /agudeza sin corrección/i.test(a.textContent))).toBe(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("elegir 'Otro' como categoría de diagnóstico y terminar sin detalle muestra el error dedicado", () => {
    renderFicha()
    empezar()
    llenarMedidas()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByRole("button", { name: "Otro" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
    expect(screen.getAllByText(/Describe el diagnóstico en el detalle/i).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: /Terminar atención/i })).toBeInTheDocument()
  })

  it("la refracción arranca vacía: ningún valor por defecto, solo placeholders", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    for (const id of ["odEsfera", "odCilindro", "odEje", "oiEsfera", "oiCilindro", "oiEje", "objOdEsfera", "adicionOd"]) expect(document.getElementById(id).value).toBe("")
    // un campo vacío muestra «—», nunca un número de ejemplo que parezca un dato
    for (const id of ["odEsfera", "kOdK1", "prismaOdCant", "dpOd"]) { const el = document.getElementById(id); if (el) expect(el).toHaveAttribute("placeholder", "—") }
  })

  it("ojo izquierdo a la izquierda y derecho a la derecha en las tarjetas lado a lado", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    const final = screen.getByText("Refracción final").closest("section")
    const grupos = within(final).getAllByRole("group").filter((g) => /^Ojo (izquierdo|derecho)$/.test(g.getAttribute("aria-label")))
    expect(grupos.map((g) => g.getAttribute("aria-label"))).toEqual(["Ojo izquierdo", "Ojo derecho"])
  })

  it("la receta exige los dos ojos: con uno medido, el otro se mide o se marca «Ojo no evaluado» con su motivo", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("odEsfera"), { target: { value: "-1.75" } })
    // el paso 3 queda incompleto mientras falte el otro ojo
    expect(screen.getByRole("button", { name: /^Paso 3: Refracción, Incompleto/ })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Ojo no evaluado/i })[0]) // el izquierdo (va primero)
    expect(screen.getByRole("button", { name: /^Paso 3: Refracción, Incompleto/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/¿Por qué no se evaluó?/i), { target: { value: "Prótesis ocular" } })
    expect(screen.getByRole("button", { name: /^Paso 3: Refracción, Completo/ })).toBeInTheDocument()
  })

  it("un cilindro sin eje se señala", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("odCilindro"), { target: { value: "-1.00" } })
    expect(screen.getByText(/Indica el eje del cilindro/i)).toBeInTheDocument()
    fireEvent.change(document.getElementById("odEje"), { target: { value: "90" } })
    expect(screen.queryByText(/Indica el eje del cilindro/i)).not.toBeInTheDocument()
  })

  it("un cilindro positivo ofrece la transposición y la receta usa los valores transpuestos", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("oiEsfera"), { target: { value: "-1.50" } })
    fireEvent.change(document.getElementById("oiCilindro"), { target: { value: "0.50" } })
    fireEvent.change(document.getElementById("oiEje"), { target: { value: "90" } })
    expect(screen.getByText(/El cilindro va en negativo/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Transponer" }))
    expect(document.getElementById("oiEsfera")).toHaveValue("-1.00")
    expect(document.getElementById("oiCilindro")).toHaveValue("-0.50")
    expect(document.getElementById("oiEje")).toHaveValue("180")
    expect(screen.queryByText(/El cilindro va en negativo/i)).not.toBeInTheDocument()
    // La vista previa del paso 5 muestra lo mismo que quedó escrito, no los valores de antes.
    irAPaso(5, "Diagnóstico y receta")
    const resumen = document.querySelector("[data-receta-resumen]")
    expect(resumen).toHaveTextContent("−1.00")
    expect(resumen).toHaveTextContent("−0.50")
    expect(resumen).toHaveTextContent("180°")
    expect(resumen).not.toHaveTextContent("−1.50")
  })

  it("la esfera fuera de −30 a +30 y el eje fuera de 1–180 se señalan al escribir", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("odEsfera"), { target: { value: "-31" } })
    expect(screen.getByText(/La esfera va de −30 a \+30/)).toBeInTheDocument()
    fireEvent.change(document.getElementById("odEsfera"), { target: { value: "-1.30" } })
    expect(screen.getAllByRole("alert").some((a) => /0.25 en 0.25/.test(a.textContent))).toBe(true)
    fireEvent.change(document.getElementById("odCilindro"), { target: { value: "-1" } })
    fireEvent.change(document.getElementById("odEje"), { target: { value: "181" } })
    expect(screen.getByText(/El eje va de 1° a 180°/)).toBeInTheDocument()
  })

  it("la adición se destaca en azul para quien tiene 40 años o más y arranca «igual en ambos ojos»", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    expect(screen.getByLabelText(/Igual en ambos ojos/i)).toBeChecked()
    const tarjeta = screen.getByRole("heading", { name: /Adición/ }).closest("section")
    expect(tarjeta.className).toMatch(/blue/)
    expect(tarjeta.className).not.toMatch(/amber|yellow/)
    fireEvent.change(document.getElementById("adicionOd"), { target: { value: "0.25" } })
    expect(screen.getByText(/La adición va de \+0.50 a \+4.00/)).toBeInTheDocument()
  })

  it("la agudeza con la receta nueva se escribe en el paso 3 y se ve en la tabla del paso 2 (un solo dato)", () => {
    renderFicha()
    empezar()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("avOdRx"), { target: { value: "20/25" } })
    fireEvent.change(screen.getByLabelText("Ojo derecho: letras falladas"), { target: { value: "2" } })
    irAPaso(2, "Agudeza visual")
    expect(document.querySelector('[data-av-rx="Od"]')).toHaveTextContent("20/25 −2")
  })

  it("la lista de agudeza trae las líneas de la cartilla y las cuatro anotaciones sin cartilla", () => {
    renderFicha()
    empezar()
    irAPaso(2, "Agudeza visual")
    const opciones = [...screen.getByLabelText("Ojo derecho, sin corrección").querySelectorAll("option")].map((o) => o.textContent)
    expect(opciones).toEqual(expect.arrayContaining(["20/20", "20/25", "20/30", "Cuenta dedos", "Movimiento de manos", "Percepción de luz", "No percibe luz"]))
  })

  it("el cover test es una lista con su magnitud y su distancia", () => {
    renderFicha()
    empezar()
    irAPaso(2, "Agudeza visual")
    const tipos = [...document.getElementById("coverTipo").querySelectorAll("option")].map((o) => o.textContent)
    expect(tipos).toEqual(expect.arrayContaining(["Ortoforia", "Endoforia", "Exoforia", "Hiperforia", "Endotropia", "Exotropia", "Hipertropia"]))
    expect(document.getElementById("coverMagnitud")).toBeInTheDocument()
    expect(document.getElementById("coverDistancia")).toBeInTheDocument()
  })

  it("antecedentes: opciones rápidas «Ninguno» y «Ninguna conocida», y los familiares nuevos", () => {
    renderFicha()
    empezar()
    for (const n of ["Ninguno", "Ninguna conocida"]) expect(screen.getAllByRole("button", { name: n }).length).toBeGreaterThan(0)
    for (const n of ["Estrabismo", "Queratocono", "Catarata", "Degeneración macular"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sí" }))
    // «Qué usa» son botones, no una lista nativa
    for (const n of ["Lentes", "Lentes de contacto", "Ambos"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument()
    expect(document.getElementById("tipoLentes")).toBeNull()
  })

  it("salud ocular por ojo con «Sin hallazgos» e «Igual en el otro ojo»", () => {
    renderFicha()
    empezar()
    irAPaso(4, "Salud ocular")
    const izq = screen.getAllByRole("group", { name: "Ojo izquierdo" })[0]
    fireEvent.click(within(izq).getAllByRole("button", { name: "Sin hallazgos" })[0])
    expect(document.getElementById("bioOiCornea")).toHaveValue("Sin hallazgos")
    const der = screen.getAllByRole("group", { name: "Ojo derecho" })[0]
    fireEvent.click(within(der).getAllByRole("button", { name: "Igual en el otro ojo" })[0])
    expect(document.getElementById("bioOdCornea")).toHaveValue("Sin hallazgos")
    // la hora con el formato del sistema (03:20 PM), y la presión de cada ojo con el izquierdo a la izquierda
    expect(screen.getByRole("group", { name: "Hora de la medición" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Hora de la medición: hora"), { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText("Hora de la medición: minutos"), { target: { value: "20" } })
    fireEvent.change(screen.getByLabelText("Hora de la medición: AM o PM"), { target: { value: "PM" } })
    const pio = screen.getByRole("heading", { name: /Presión intraocular/ }).closest("section")
    expect(within(pio).getAllByRole("group").filter((g) => /^Ojo/.test(g.getAttribute("aria-label"))).map((g) => g.getAttribute("aria-label"))).toEqual(["Ojo izquierdo", "Ojo derecho"])
  })

  it("distancia pupilar: total, de cada ojo y de cerca", () => {
    renderFicha()
    empezar()
    irAPaso(2, "Agudeza visual")
    for (const id of ["dp", "dpOd", "dpOi", "dpCerca"]) expect(document.getElementById(id)).toBeInTheDocument()
  })

  it("elegir motivo \"Otros\" abre el detalle con foco y exige describirlo", () => {
    renderFicha()
    fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    fireEvent.click(screen.getByRole("button", { name: /Entendido, completar antecedentes/i }))
    fireEvent.change(screen.getByLabelText(/^Motivo$/i), { target: { value: "Otros" } })
    expect(screen.getByLabelText(/Describe el motivo/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Paso 1: Anamnesis, Incompleto/ })).toBeInTheDocument()
  })

  it("el panel de contexto muestra al paciente, sus alergias y las últimas visitas, que se abren en solo lectura", () => {
    const previa = { id: "c0", fecha: "2026-04-20", pacienteId: "p1", paciente: PACIENTE.nombre, motivo: "Examen de Control", alergias: "Penicilina", antecedentes: "", usaLentes: true, od: { esfera: "-1.25", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.00", cilindro: "-0.75", eje: "85", avCc: "20/25" }, medidas: { adicion: "+1.00" }, diagnostico: "Miopía", creadoEn: "a" }
    renderFicha({ consultas: [previa] })
    fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    const panel = screen.getByRole("complementary", { name: "Contexto del paciente" })
    expect(panel).toHaveTextContent("Paciente De Prueba")
    expect(panel).toHaveTextContent(/Penicilina/)
    expect(panel).toHaveTextContent("−1.25 −0.50 × 90°")
    // los antecedentes ya registrados se precargan (resumidos) en vez de pedirse de nuevo
    expect(screen.getByText(/Ya registrados el/)).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole("button", { name: /Examen de Control/ }))
    expect(screen.getByRole("heading", { name: /Ficha del/ })).toBeInTheDocument()
  })

  it("al terminar la atención aparece 'Atención terminada' con Pasar a la óptica, y 'Cobrar ahora' abre el cobro con la consulta precargada", () => {
    renderFicha({ parametrizacion: { costosMotivo: { "Consulta General": 15 } } })
    empezar()
    llenarMedidas()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByRole("button", { name: "Miopía" }))
    fireEvent.click(screen.getByRole("radio", { name: /Agendar después/i }))
    terminar()
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

  it("con cita, el motivo viene de la cita (con «Cambiar»), no del texto libre", async () => {
    const deHoy = { id: "c1", paciente: PACIENTE.nombre, pacienteId: "p1", fecha: hoyISO(), hora: "09:00 AM", estado: "Pendiente", motivo: "Consulta General" }
    render(<ConsultaMedica {...props([deHoy])} />)
    expect(await screen.findByText(/\(de la cita\)/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeInTheDocument()
  })
})

describe("ConsultaMedica — guardado automático del borrador", () => {
  const ficha = () => render(<ConsultaMedica usuario={{ id: "u1", nombre: "Optómetra" }} pacientes={[PACIENTE]} consultas={[]} inventario={[]} parametrizacion={{}} diagnosticosRapidos={["Miopía"]} motivosConsulta={["Consulta General"]} citas={[]} pacienteInicial={PACIENTE} />)

  it("mientras se escribe se guarda solo y lo dice con discreción", async () => {
    localStorage.clear()
    ficha()
    fireEvent.click(await screen.findByRole("button", { name: /Entendido, completar antecedentes/i }))
    await new Promise((r) => setTimeout(r, 500))
    fireEvent.change(screen.getByLabelText(/^Motivo$/i), { target: { value: "Consulta General" } })
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("odEsfera"), { target: { value: "-2.25" } })
    await waitFor(() => expect(JSON.stringify(Object.values(localStorage))).toContain("-2.25"), { timeout: 4000 })
    expect(screen.getByText(/Guardado (ahora|hace)/)).toBeInTheDocument()
  })

  it("al volver a abrirla ofrece recuperar lo que estaba a medias", async () => {
    localStorage.clear()
    localStorage.setItem("ficha-borrador:u1:p1:directa", JSON.stringify({ v: 1, guardadoEn: Date.now(), datos: { motivo: "Consulta General", odEsfera: "-1.75" } }))
    ficha()
    expect(await screen.findByText(/Hay una ficha a medias de este paciente/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }))
    expect(screen.queryByText(/Hay una ficha a medias/i)).not.toBeInTheDocument()
  })
})

describe("ConsultaMedica — correcciones de la revisión", () => {
  it("la distancia pupilar total se calcula sola con la de cada ojo, y avisa si no coincide", () => {
    renderFicha()
    empezar()
    irAPaso(2, "Agudeza visual")
    fireEvent.change(document.getElementById("dpOd"), { target: { value: "31" } })
    fireEvent.change(document.getElementById("dpOi"), { target: { value: "30.5" } })
    expect(document.getElementById("dp")).toHaveValue("61.5")
    expect(screen.queryByText(/La suma de los dos ojos/)).not.toBeInTheDocument()
    fireEvent.change(document.getElementById("dp"), { target: { value: "64" } })
    expect(screen.getByText(/La suma de los dos ojos es 61.5 mm y el total escrito es 64 mm/)).toBeInTheDocument()
  })

  it("test de color: resultado «14 de 14» e interpretación Normal o Alterado", () => {
    renderFicha()
    empezar()
    irAPaso(4, "Salud ocular")
    expect(screen.getByLabelText(/Resultado \(láminas acertadas\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Alterado" }))
    expect(screen.getByRole("button", { name: "Alterado" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute("aria-pressed", "false")
  })

  it("«Lente a recomendar» va en azul, no en amarillo (el amarillo es advertencia)", () => {
    renderFicha()
    empezar()
    irAPaso(5, "Diagnóstico y receta")
    fireEvent.click(screen.getByLabelText(/Añadir recomendación de lente/))
    const bloque = screen.getByText("Lente a recomendar").closest("div.rounded-xl")
    expect(bloque.className).toMatch(/blue/)
    expect(bloque.className).not.toMatch(/amber|yellow/)
    expect(bloque.getAttribute("style") || "").not.toMatch(/200,\s*162/)
  })

  it("diagnóstico sugerido: con esfera negativa y cilindro sugiere «Miopía y astigmatismo»; con adición avisa de presbicia; el optómetra lo confirma", () => {
    renderFicha()
    empezar()
    llenarMedidas()
    irAPaso(3, "Refracción")
    fireEvent.change(document.getElementById("adicionOd"), { target: { value: "1.50" } })
    irAPaso(5, "Diagnóstico y receta")
    const sug = screen.getByRole("status", { name: "Diagnóstico sugerido" })
    expect(sug).toHaveTextContent("Miopía y astigmatismo")
    expect(sug).toHaveTextContent("Tiene adición")
    // no se marca solo
    expect(screen.getByRole("button", { name: "Miopía y astigmatismo" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(within(sug).getByRole("button", { name: "Usar la sugerencia" }))
    expect(screen.getByRole("button", { name: "Miopía y astigmatismo" })).toHaveAttribute("aria-pressed", "true")
  })

  it("antecedentes precargados: lo guardado que coincide con una opción la marca", () => {
    const previa = { id: "c0", fecha: "2026-04-20", pacienteId: "p1", paciente: PACIENTE.nombre, motivo: "Control", alergias: "Penicilina", antecedentes: "Hipertensión", antecedentesFamiliares: "", usaLentes: true, od: {}, oi: {}, creadoEn: "a",
      ficha: { anamnesis: { antMedicos: { chips: [], detalle: "Hipertensión" }, antFamiliares: { chips: [], detalle: "" }, alergias: { chips: [], detalle: "Penicilina" }, medicamentos: { chips: [], detalle: "Losartán 50 mg" }, usaLentes: "si" } } }
    renderFicha({ consultas: [previa] })
    fireEvent.change(screen.getByLabelText(/Paciente \*/i), { target: { value: "Paciente De" } })
    fireEvent.click(screen.getByText(PACIENTE.nombre))
    fireEvent.click(screen.getByRole("button", { name: /actualizar/ }))
    expect(screen.getByRole("button", { name: "Penicilina" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Hipertensión" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Antihipertensivos" })).toHaveAttribute("aria-pressed", "true")
    expect(document.getElementById("alergiasDetalle")).toHaveValue("")
  })
})
