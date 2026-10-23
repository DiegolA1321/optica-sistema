import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const rpc = vi.fn()
let perfil = { foto_url: "", mostrar_en_publica: false }
let errorLectura = null
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (errorLectura ? { data: null, error: errorLectura } : { data: perfil, error: null }) }) }) }),
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://x/logos/o/fotos/p.png" } }) }) },
  },
}))
import MiPresenciaPublica from "./MiPresenciaPublica"

const usuario = { id: "p1", opticaId: "o1", nombre: "Paula" }

describe("MiPresenciaPublica", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); perfil = { foto_url: "", mostrar_en_publica: false }; errorLectura = null })

  it("«Mostrarme» viene desactivado por defecto y lo activa solo la propia persona", async () => {
    const avisar = vi.fn()
    render(<MiPresenciaPublica usuario={usuario} onAviso={avisar} />)
    const caja = await screen.findByRole("checkbox", { name: /Mostrarme en la página pública/ })
    expect(caja).not.toBeChecked()
    await userEvent.click(caja)
    expect(rpc).toHaveBeenCalledWith("guardar_mi_visibilidad_publica", { p_mostrar: true })
    await waitFor(() => expect(caja).toBeChecked())
    expect(avisar).toHaveBeenCalledWith("Ahora apareces en la página pública.")
  })

  it("si la base aún no tiene las columnas, no se muestra nada", async () => {
    errorLectura = { message: "column does not exist" }
    const { container } = render(<MiPresenciaPublica usuario={usuario} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.querySelector("[data-mi-presencia-publica]")).toBeNull()
  })

  it("la foto propia se guarda con guardar_mi_foto (no con la del administrador)", async () => {
    render(<MiPresenciaPublica usuario={usuario} onAviso={() => {}} />)
    await screen.findByRole("checkbox")
    const archivo = new File(["x"], "yo.png", { type: "image/png" })
    await userEvent.upload(screen.getByLabelText("Subir foto"), archivo)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("guardar_mi_foto", expect.objectContaining({ p_foto_url: expect.stringContaining("logos/o/fotos/p.png") })))
    expect(rpc).not.toHaveBeenCalledWith("guardar_foto_de", expect.anything())
  })
})
