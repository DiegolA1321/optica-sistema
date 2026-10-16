import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import PermisosMensajes from "./PermisosMensajes"

describe("PermisosMensajes: los dos permisos para recibir mensajes", () => {
  it("son dos interruptores independientes, cada uno con su nombre", () => {
    render(<PermisosMensajes recordatorios promociones={false} onCambiar={vi.fn()} />)
    expect(screen.getByRole("switch", { name: "Recordatorios de salud" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Promociones y saludos" })).not.toBeChecked()
  })
  it("cambiar uno manda solo ese permiso y no toca el otro", async () => {
    const onCambiar = vi.fn(async () => ({ ok: true }))
    render(<PermisosMensajes recordatorios promociones={false} onCambiar={onCambiar} />)
    fireEvent.click(screen.getByRole("switch", { name: "Promociones y saludos" }))
    await waitFor(() => expect(onCambiar).toHaveBeenCalledWith({ promociones: true }))
    fireEvent.click(screen.getByRole("switch", { name: "Recordatorios de salud" }))
    await waitFor(() => expect(onCambiar).toHaveBeenLastCalledWith({ recordatorios: false }))
  })
  it("si no se pudo guardar, lo dice", async () => {
    render(<PermisosMensajes recordatorios promociones={false} onCambiar={async () => ({ ok: false, error: "No se pudo guardar. Revisa tu conexión e intenta de nuevo." })} />)
    fireEvent.click(screen.getByRole("switch", { name: "Promociones y saludos" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar")
  })
  it("sin permiso para cambiarlos solo se muestran (sin interruptores)", () => {
    render(<PermisosMensajes recordatorios promociones={false} />)
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getAllByText(/^(Sí|No)$/).map((e) => e.textContent)).toEqual(["Sí", "No"])
  })
  it("dice quién y cuándo los cambió, o que nunca se cambiaron", () => {
    const { rerender } = render(<PermisosMensajes recordatorios promociones={false} />)
    expect(screen.getByText(/Aún no se han cambiado sus permisos: los recordatorios de salud están activos y las promociones y saludos, no/)).toBeInTheDocument()
    rerender(<PermisosMensajes recordatorios promociones actualizadoPor="Ana Admin" actualizadoEn="2026-10-14T15:30:00-05:00" />)
    expect(screen.getByText(/Último cambio de Ana Admin: 14 oct 2026/)).toBeInTheDocument()
    rerender(<PermisosMensajes recordatorios promociones={false} quien="yo" />)
    expect(screen.getByText(/Aún no has cambiado tus permisos/)).toBeInTheDocument()
  })
})
