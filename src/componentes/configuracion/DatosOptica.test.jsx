import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import DatosOptica from "./DatosOptica"

const CORTA = "https://maps.app.goo.gl/ZMMY8KdKNcP67PAB7"
const LARGA = "https://www.google.com/maps/place/%C3%92PTICA+SOLNA-VISI%C3%92N/@-0.7862055,-80.2372332,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d-0.7862109!4d-80.2346583?entry=tts"

// setParametrizacion como el real: recibe una función y devuelve { error }.
const montar = (parametrizacion = {}) => {
  let guardado = null
  const setParametrizacion = vi.fn(async (fn) => { guardado = fn(parametrizacion); return { error: null } })
  const onExito = vi.fn(), onError = vi.fn()
  render(<DatosOptica parametrizacion={parametrizacion} setParametrizacion={setParametrizacion} onExito={onExito} onError={onError} />)
  return { setParametrizacion, onExito, onError, guardado: () => guardado }
}
const boton = () => screen.getByRole("button", { name: "Guardar datos de la óptica" })

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url: LARGA }) }))) })
afterEach(() => vi.unstubAllGlobals())

describe("Datos de la óptica", () => {
  it("no deja guardar sin cambios y muestra lo ya guardado", () => {
    montar({ opticaDireccion: "Av. Principal 1", opticaTelefono: "0991234567", opticaMapaUrl: CORTA, opticaMapaNombre: "ÒPTICA SOLNA-VISIÒN", opticaMapaLat: -0.7862109, opticaMapaLng: -80.2346583 })
    expect(boton()).toBeDisabled()
    expect(screen.getByLabelText("Dirección")).toHaveValue("Av. Principal 1")
    expect(screen.getByLabelText("Enlace de Google Maps")).toHaveValue(CORTA)
    expect(screen.getByText(/Ubicada: ÒPTICA SOLNA-VISIÒN/)).toBeInTheDocument()
  })

  it("con el enlace corto de Google Maps guarda el lugar y sus coordenadas, y avisa", async () => {
    const m = montar({ opticaRuc: "1790000000001", opticaTelefono: "0991234567" })
    fireEvent.change(screen.getByLabelText("Enlace de Google Maps"), { target: { value: CORTA } })
    fireEvent.click(boton())
    await waitFor(() => expect(m.onExito).toHaveBeenCalledWith("Datos de la óptica guardados correctamente."))
    expect(fetch).toHaveBeenCalledWith("/api/resolver-mapa?url=" + encodeURIComponent(CORTA))
    expect(m.guardado()).toMatchObject({ opticaRuc: "1790000000001", opticaTelefono: "0991234567", opticaMapaUrl: CORTA, opticaMapaNombre: "ÒPTICA SOLNA-VISIÒN", opticaMapaLat: -0.7862109, opticaMapaLng: -80.2346583 })
  })

  it("un enlace que no es de Google Maps no se guarda y dice qué hacer", async () => {
    const m = montar()
    fireEvent.change(screen.getByLabelText("Enlace de Google Maps"), { target: { value: "https://ejemplo.com/mi-optica" } })
    fireEvent.click(boton())
    expect(await screen.findByRole("alert")).toHaveTextContent(/enlace de Google Maps/)
    expect(m.setParametrizacion).not.toHaveBeenCalled()
  })

  it("si el servidor no abre el enlace, lo dice y no guarda", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    const m = montar()
    fireEvent.change(screen.getByLabelText("Enlace de Google Maps"), { target: { value: CORTA } })
    fireEvent.click(boton())
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo abrir el enlace/)
    expect(m.setParametrizacion).not.toHaveBeenCalled()
  })

  it("al vaciar el enlace se quita el mapa; cambiar solo la dirección conserva el mapa", async () => {
    const guardada = { opticaMapaUrl: CORTA, opticaMapaNombre: "X", opticaMapaLat: -0.78, opticaMapaLng: -80.23 }
    const a = montar(guardada)
    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 5" } })
    fireEvent.click(boton())
    await waitFor(() => expect(a.onExito).toHaveBeenCalled())
    expect(a.guardado()).toMatchObject({ opticaDireccion: "Calle 5", opticaMapaUrl: CORTA, opticaMapaLat: -0.78 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("vaciar el enlace borra el mapa", async () => {
    const m = montar({ opticaMapaUrl: CORTA, opticaMapaNombre: "X", opticaMapaLat: -0.78, opticaMapaLng: -80.23 })
    fireEvent.change(screen.getByLabelText("Enlace de Google Maps"), { target: { value: "" } })
    fireEvent.click(boton())
    await waitFor(() => expect(m.onExito).toHaveBeenCalled())
    expect(m.guardado()).toMatchObject({ opticaMapaUrl: "", opticaMapaNombre: "", opticaMapaLat: null, opticaMapaLng: null })
  })

  it("si no se pudo guardar, avisa con el error", async () => {
    const onError = vi.fn()
    render(<DatosOptica parametrizacion={{}} setParametrizacion={async () => ({ error: { message: "x" } })} onError={onError} />)
    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 5" } })
    fireEvent.click(boton())
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/No se pudieron guardar/)))
  })
})
