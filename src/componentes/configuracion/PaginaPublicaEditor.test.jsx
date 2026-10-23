import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const update = vi.fn()
const eq = vi.fn()
const upload = vi.fn()
const rpc = vi.fn()
vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({ update: (v) => { update(v); return { eq: (...a) => { eq(...a); return Promise.resolve({ error: null }) } } } }),
    storage: { from: () => ({ upload: (...a) => { upload(...a); return Promise.resolve({ error: null }) }, getPublicUrl: (r) => ({ data: { publicUrl: "https://cdn/" + r } }) }) },
    rpc: (...a) => rpc(...a),
  },
}))
import PaginaPublicaEditor from "./PaginaPublicaEditor"

const marcaVieja = { nombreMarca: "Visión", colorAcento: "#2563EB", servicios: [{ titulo: "viejo" }], logoUrlClaro: "https://x/c.png" }
const montar = (extra = {}) => {
  const onGuardado = vi.fn()
  render(<PaginaPublicaEditor opticaId="o1" nombreOptica="Visión" marca={marcaVieja} logoUrl="" motivos={["Consulta General", "Examen de Control"]} onGuardado={onGuardado} {...extra} />)
  return { onGuardado }
}
const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar" }))

beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { pacientesAtendidos: 287, optometrasTotal: 2, optometras: [] }, error: null }) })

describe("PaginaPublicaEditor", () => {
  it("precarga los ejemplos y no deja guardar sin cambios", () => {
    montar()
    expect(screen.getByLabelText("Título del servicio 1")).toHaveValue("Examen visual completo")
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  it("agrega, edita, ordena y quita un servicio y una pregunta", () => {
    montar()
    fireEvent.click(screen.getByRole("button", { name: /Agregar servicio/ }))
    expect(screen.getAllByText(/^Servicio \d$/)).toHaveLength(4)
    fireEvent.change(screen.getByLabelText("Título del servicio 4"), { target: { value: "Nuevo" } })
    fireEvent.click(screen.getByRole("button", { name: "Subir el servicio 4: Nuevo" }))
    expect(screen.getByLabelText("Título del servicio 3")).toHaveValue("Nuevo")
    fireEvent.click(screen.getByRole("button", { name: "Quitar el servicio 3: Nuevo" }))
    expect(screen.getAllByText(/^Servicio \d$/)).toHaveLength(3)
    fireEvent.click(screen.getByRole("button", { name: /Agregar pregunta/ }))
    expect(screen.getAllByText(/^Pregunta \d$/)).toHaveLength(5)
    fireEvent.change(screen.getByLabelText("Texto de la pregunta 5"), { target: { value: "¿Q?" } })
    fireEvent.click(screen.getByRole("button", { name: "Subir la pregunta 5: ¿Q?" }))
    expect(screen.getByLabelText("Texto de la pregunta 4")).toHaveValue("¿Q?")
    fireEvent.click(screen.getByRole("button", { name: "Quitar la pregunta 4: ¿Q?" }))
    expect(screen.getAllByText(/^Pregunta \d$/)).toHaveLength(4)
  })

  it("avisa cuando el color es muy claro con el color al que se ajusta", () => {
    montar()
    fireEvent.change(screen.getByLabelText("Color en formato #RRGGBB"), { target: { value: "#FDE047" } })
    expect(screen.getByText(/Ese color es muy claro/)).toHaveTextContent(/Lo ajustamos a #[0-9A-F]{6}/)
  })

  it("guarda mezclando con la marca existente (conserva claves viejas) y con el color ajustado", async () => {
    const { onGuardado } = montar()
    fireEvent.change(screen.getByLabelText("Color en formato #RRGGBB"), { target: { value: "#FDE047" } })
    guardar()
    await waitFor(() => expect(update).toHaveBeenCalled())
    const { marca } = update.mock.calls[0][0]
    expect(marca.servicios).toEqual([{ titulo: "viejo" }])
    expect(marca.logoUrlClaro).toBe("https://x/c.png")
    expect(marca.colorAcento).not.toBe("#FDE047")
    expect(marca.serviciosPagina.length).toBe(3)
    expect(eq).toHaveBeenCalledWith("id", "o1")
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
    expect(await screen.findByText(/Página pública guardada/)).toBeInTheDocument()
  })

  it("pregunta antes de descartar un servicio escrito a medias", async () => {
    montar()
    fireEvent.click(screen.getByRole("button", { name: /Agregar servicio/ }))
    fireEvent.change(screen.getByLabelText("Título del servicio 4"), { target: { value: "Sin texto" } })
    guardar()
    expect(await screen.findByText(/escrito a medias/)).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin ellos" }))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][0].marca.serviciosPagina).toHaveLength(3)
  })

  it("valida el año de fundación y no guarda", () => {
    montar()
    fireEvent.change(screen.getByLabelText("Año de fundación"), { target: { value: "1850" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/entre 1900/)
    guardar()
    expect(update).not.toHaveBeenCalled()
  })

  it("muestra el valor automático de cada número y la casilla lo oculta en la vista previa", async () => {
    montar()
    fireEvent.change(screen.getByLabelText("Año de fundación"), { target: { value: "2015" } })
    expect((await screen.findAllByText("250+")).length).toBeGreaterThan(0)
    expect(screen.getByText("11 años")).toBeInTheDocument()
    const muestra = document.querySelector("[data-muestra-pagina]")
    expect(within(muestra).getByText("pacientes atendidos")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar «Pacientes atendidos»" }))
    expect(within(muestra).queryByText("pacientes atendidos")).toBeNull()
  })

  it("la vista previa refleja lo escrito sin guardar y está rotulada", () => {
    montar()
    fireEvent.change(screen.getByLabelText("Título del servicio 1"), { target: { value: "Servicio sin guardar" } })
    expect(within(document.querySelector("[data-muestra-pagina]")).getByText("Servicio sin guardar")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Vista previa" })).toBeInTheDocument()
    expect(screen.getByText("Tienes cambios sin guardar.")).toBeInTheDocument()
  })

  it("si la función de la base no existe, los números salen como — sin romper", async () => {
    rpc.mockRejectedValue(new Error("no existe"))
    montar()
    expect((await screen.findAllByText(/Saldría/)).length).toBe(3)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })

  it("rechaza un logo con tipo no válido sin subirlo", () => {
    montar()
    fireEvent.change(screen.getByLabelText("Subir logo"), { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } })
    expect(screen.getByRole("alert")).toHaveTextContent(/PNG, JPG, WEBP o SVG/)
    expect(upload).not.toHaveBeenCalled()
  })

  it("acepta un SVG, lo sube a la carpeta de la óptica y lo guarda como logo_url", async () => {
    montar()
    fireEvent.change(screen.getByLabelText("Subir logo"), { target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] } })
    await waitFor(() => expect(upload).toHaveBeenCalled())
    expect(upload.mock.calls[0][0]).toMatch(/^o1\/\d+\.svg$/)
    await screen.findByRole("button", { name: "Quitar logo" })
    guardar()
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][0].logo_url).toMatch(/^https:\/\/cdn\/o1\//)
  })

  it("quitar imagen deja la imagen principal vacía (vuelve el ojo animado)", async () => {
    montar({ marca: { ...marcaVieja, imagenPrincipalUrl: "https://x/i.png" } })
    fireEvent.click(screen.getByRole("button", { name: "Quitar imagen" }))
    guardar()
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][0].marca.imagenPrincipalUrl).toBe("")
  })

  it("descartar vuelve a lo guardado", () => {
    montar()
    fireEvent.change(screen.getByLabelText("Título del servicio 1"), { target: { value: "Otro" } })
    fireEvent.click(screen.getByRole("button", { name: /Descartar cambios/ }))
    expect(screen.getByLabelText("Título del servicio 1")).toHaveValue("Examen visual completo")
  })
})
