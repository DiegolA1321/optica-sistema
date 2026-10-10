import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const actualizar = vi.fn()
let metadatos = {}
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { user_metadata: metadatos } } } }),
      updateUser: (...a) => actualizar(...a),
    },
  },
}))

import GuardiaClaveTemporal from "./GuardiaClaveTemporal"

const abrir = () => render(<GuardiaClaveTemporal alSalir={() => {}}><p>La aplicación</p></GuardiaClaveTemporal>)
const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })

beforeEach(() => { actualizar.mockReset(); metadatos = {} })

describe("Contraseña temporal: cambio obligatorio en el primer ingreso", () => {
  it("una cuenta normal entra directo", async () => {
    abrir()
    expect(await screen.findByText("La aplicación")).toBeInTheDocument()
    expect(screen.queryByText("Crea tu contraseña")).not.toBeInTheDocument()
  })

  it("con contraseña temporal no entra a la aplicación hasta elegir la suya", async () => {
    metadatos = { clave_temporal: true }
    abrir()
    expect(await screen.findByRole("heading", { name: "Crea tu contraseña" })).toBeInTheDocument()
    expect(screen.queryByText("La aplicación")).not.toBeInTheDocument()
  })

  it("rechaza una contraseña floja o que no coincide, sin llamar a la base", async () => {
    metadatos = { clave_temporal: true }
    abrir()
    await screen.findByRole("heading", { name: "Crea tu contraseña" })
    escribir(/^Contraseña nueva/, "corta")
    escribir("Repite la contraseña", "corta")
    fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/al menos 8 caracteres/)
    escribir(/^Contraseña nueva/, "Buena-Clave9")
    escribir("Repite la contraseña", "Otra-Clave9")
    fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Las dos contraseñas no coinciden.")
    expect(actualizar).not.toHaveBeenCalled()
  })

  it("guarda la contraseña y quita la marca en la misma llamada, y deja entrar", async () => {
    metadatos = { clave_temporal: true }
    actualizar.mockResolvedValue({ error: null })
    abrir()
    await screen.findByRole("heading", { name: "Crea tu contraseña" })
    escribir(/^Contraseña nueva/, "Buena-Clave9")
    escribir("Repite la contraseña", "Buena-Clave9")
    fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }))
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith({ password: "Buena-Clave9", data: { clave_temporal: false } }))
    expect(await screen.findByText("La aplicación")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Contraseña guardada")
  })

  it("si elige la misma contraseña temporal lo dice con claridad", async () => {
    metadatos = { clave_temporal: true }
    actualizar.mockResolvedValue({ error: { message: "New password should be different from the old password." } })
    abrir()
    await screen.findByRole("heading", { name: "Crea tu contraseña" })
    escribir(/^Contraseña nueva/, "Opt-ABCD12")
    escribir("Repite la contraseña", "Opt-ABCD12")
    fireEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Elige una contraseña distinta de la temporal.")
    expect(screen.queryByText("La aplicación")).not.toBeInTheDocument()
  })
})
