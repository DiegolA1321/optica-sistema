import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const rpc = vi.fn(() => Promise.resolve({ error: null }))
const upload = vi.fn(() => Promise.resolve({ error: null }))
vi.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), storage: { from: () => ({ upload: (...a) => upload(...a), getPublicUrl: (r) => ({ data: { publicUrl: "https://cdn/" + r } }) }) } },
}))
import FotoProfesional from "./FotoProfesional"

beforeEach(() => vi.clearAllMocks())

describe("FotoProfesional", () => {
  it("sube a {optica}/fotos/{perfil}.ext y la guarda con la función de la base", async () => {
    const onCambio = vi.fn()
    const onAviso = vi.fn()
    render(<FotoProfesional opticaId="o1" perfilId="p1" nombre="Ana" onCambio={onCambio} onAviso={onAviso} />)
    fireEvent.change(screen.getByLabelText("Subir foto"), { target: { files: [new File(["x"], "yo.png", { type: "image/png" })] } })
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
    expect(upload.mock.calls[0][0]).toBe("o1/fotos/p1.png")
    expect(rpc).toHaveBeenCalledWith("guardar_foto_de", expect.objectContaining({ p_perfil: "p1", p_foto_url: expect.stringContaining("https://cdn/o1/fotos/p1.png") }))
    expect(onAviso).toHaveBeenCalledWith("Foto de Ana actualizada.")
  })

  it("rechaza un tipo o un peso no válido sin subir", () => {
    render(<FotoProfesional opticaId="o1" perfilId="p1" />)
    fireEvent.change(screen.getByLabelText("Subir foto"), { target: { files: [new File(["x"], "a.svg", { type: "image/svg+xml" })] } })
    expect(screen.getByRole("alert")).toHaveTextContent(/PNG, JPG o WEBP/)
    expect(upload).not.toHaveBeenCalled()
  })

  it("quitar la foto manda null", async () => {
    const onCambio = vi.fn()
    render(<FotoProfesional opticaId="o1" perfilId="p1" nombre="Ana" url="https://cdn/x.png" onCambio={onCambio} />)
    fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }))
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(""))
    expect(rpc).toHaveBeenCalledWith("guardar_foto_de", { p_perfil: "p1", p_foto_url: null })
  })
})
