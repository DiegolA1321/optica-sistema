import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import RolesPanel from "./RolesPanel"
import ModalMisRoles from "./ModalMisRoles"

const rol = (id, nombre, extra = {}) => ({ id, nombre, descripcion: "", es_predefinido: false, atiende_pacientes: false, permisos: { citas: ["ver"] }, alcance: {}, inicio: "general", ...extra })
const base = { usuario: { id: "u1", opticaId: "o1" }, asignaciones: [], onCambio: () => {}, onExito: () => {} }

describe("RolesPanel — quitar roles", () => {
  it("un rol predefinido sin personas se puede quitar y también restaurar", () => {
    render(<RolesPanel {...base} roles={[rol("r1", "Optómetra", { es_predefinido: true, clave: "optometra" }), rol("r2", "Recepción", { es_predefinido: true, clave: "recepcion" }), rol("r3", "Ventas", { es_predefinido: true, clave: "ventas" })]} />)
    expect(screen.getByRole("button", { name: "Eliminar Optómetra" })).toBeEnabled()
    expect(screen.getByRole("button", { name: /Restaurar Optómetra a sus valores originales/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Restaurar roles predefinidos/ })).not.toBeInTheDocument()
  })

  it("un rol con personas asignadas no se puede quitar", () => {
    render(<RolesPanel {...base} asignaciones={[{ perfil_id: "p1", rol_id: "r1" }]} roles={[rol("r1", "Optómetra", { es_predefinido: true, clave: "optometra" })]} />)
    expect(screen.getByRole("button", { name: "Eliminar Optómetra" })).toBeDisabled()
  })

  it("si faltan predefinidos ofrece restaurarlos y dice cuántos", () => {
    render(<RolesPanel {...base} roles={[rol("r1", "Optómetra", { es_predefinido: true, clave: "optometra" })]} />)
    expect(screen.getByRole("button", { name: "Restaurar roles predefinidos (2)" })).toBeInTheDocument()
  })

  it("al quitar un predefinido avisa que se puede recuperar", () => {
    render(<RolesPanel {...base} roles={[rol("r1", "Ventas", { es_predefinido: true, clave: "ventas" })]} />)
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Ventas" }))
    expect(screen.getByText(/podrás recuperarlo con «Restaurar roles predefinidos»/)).toBeInTheDocument()
  })
})

describe("ModalMisRoles", () => {
  const roles = [rol("r1", "Optómetra", { es_predefinido: true, atiende_pacientes: true }), rol("r2", "Ventas", { es_predefinido: true })]
  it("el administrador marca roles y se guardan; sin cambios no deja guardar", async () => {
    const onGuardar = vi.fn().mockResolvedValue(null)
    render(<ModalMisRoles roles={roles} elegidosIniciales={[]} onGuardar={onGuardar} onCerrar={() => {}} />)
    expect(screen.getByRole("button", { name: "Guardar mis roles" })).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Optómetra/))
    fireEvent.click(screen.getByRole("button", { name: "Guardar mis roles" }))
    await waitFor(() => expect(onGuardar).toHaveBeenCalledWith(["r1"]))
  })
  it("muestra el error que devuelve la base", async () => {
    render(<ModalMisRoles roles={roles} elegidosIniciales={["r1"]} onGuardar={async () => "Solo el administrador principal puede cambiar sus propios roles."} onCerrar={() => {}} />)
    fireEvent.click(screen.getByLabelText(/Ventas/))
    fireEvent.click(screen.getByRole("button", { name: "Guardar mis roles" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/administrador principal/)
  })
})
