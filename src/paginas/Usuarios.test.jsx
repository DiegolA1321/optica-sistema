import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const rpc = vi.fn()
const tablas = {
  roles: [{ id: "r1", nombre: "Ventas", descripcion: "", es_predefinido: true, atiende_pacientes: false, permisos: { ventas: ["ver"] }, alcance: {}, inicio: "ventas" }],
  perfil_roles: [{ perfil_id: "p-vera", rol_id: "r1" }],
  perfiles: [{ id: "p-vera", nombre: "Vera Mora", email: "vera@optica.test", etiqueta_rol: "", es_optometra: false, cedula: "", registro_profesional: "", activo: true }],
}
const consulta = (tabla) => {
  const c = { select: () => c, eq: () => c, order: () => c, then: (ok) => Promise.resolve({ data: tablas[tabla], error: null }).then(ok) }
  return c
}
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: (...a) => rpc(...a), from: (t) => consulta(t) }, crearClienteTemporal: vi.fn() }))
vi.mock("../utilidades/sesionPermisos", () => ({ cargarMisPermisos: vi.fn() }))

import Usuarios from "./Usuarios"

const admin = { id: "u-admin", rol: "admin", nombre: "Ana", opticaId: "o1", correo: "ana@optica.test" }
const Con = () => { const [a, setA] = React.useState([]); return <Usuarios usuario={admin} asistentes={a} setAsistentes={setA} /> }

beforeEach(() => {
  rpc.mockReset()
  rpc.mockImplementation((nombre) => Promise.resolve({ data: nombre === "permisos_por_nivel_vigentes" ? true : nombre === "soy_administrador_principal" ? true : null, error: null }))
  window.history.replaceState({}, "", "/")
})

describe("Usuarios: desactivar", () => {
  it("la ventana explica que no podrá ingresar, que su historial se conserva, que se puede reactivar y que no existe «eliminar»", async () => {
    render(<Con />)
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar a Vera Mora" }))
    const v = screen.getByRole("dialog", { name: "¿Desactivar a Vera Mora?" })
    expect(v).toHaveTextContent("Vera Mora · Ventas")
    expect(v).toHaveTextContent("No podrá ingresar al sistema desde este momento.")
    expect(v).toHaveTextContent("Su historial se conserva: las ventas, abonos y registros que hizo siguen a su nombre.")
    expect(v).toHaveTextContent("Puedes reactivar la cuenta cuando quieras, con sus mismos roles.")
    expect(v).toHaveTextContent("No existe «eliminar» un usuario: borraría quién hizo cada cosa en el sistema.")
    expect(within(v).queryByRole("button", { name: /Eliminar/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Eliminar a Vera/ })).toBeNull() // tampoco en la lista
  })

  it("Desactivar llama a la función de la base y confirma; Cancelar no hace nada", async () => {
    render(<Con />)
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar a Vera Mora" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }))
    expect(rpc).not.toHaveBeenCalledWith("desactivar_usuario", expect.anything())
    fireEvent.click(screen.getByRole("button", { name: "Desactivar a Vera Mora" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar", exact: true }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("desactivar_usuario", { p_perfil_id: "p-vera", p_motivo: null }))
    expect(await screen.findByText(/Vera Mora fue desactivado. Ya no puede entrar./)).toBeInTheDocument()
  })
})
