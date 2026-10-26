import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Calendar, Bell } from "lucide-react"
import ResolutionGuard from "../ResolutionGuard"
import ShellCelular from "./ShellCelular"
import MasCelular from "./MasCelular"
import ModuloDeComputadora from "./ModuloDeComputadora"
import NotificacionesCelular from "./NotificacionesCelular"
import { ANCHO_ESCRITORIO, esSoloComputadora, avisarSoloComputadora, TEXTO_SOLO_COMPUTADORA } from "../../utilidades/modoCelular"

const ancho = (px) => Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px })
afterEach(() => ancho(1024))

describe("el límite del modo celular", () => {
  it("es 1093 px: de ahí en adelante, la computadora de siempre", () => {
    expect(ANCHO_ESCRITORIO).toBe(1093)
  })
  it("Ventas, Inventario, Reportes, CRM, Usuarios, Configuración y Soporte son de computadora; Inicio, Citas, Pacientes y Horario no", () => {
    for (const id of ["ventas", "inventario", "reportes", "crm", "usuarios", "configuracion", "mensajes"]) expect(esSoloComputadora(id)).toBe(true)
    for (const id of ["inicio", "citas", "pacientes", "horario", "consultas"]) expect(esSoloComputadora(id)).toBe(false)
  })
  it("una acción de computadora en una pantalla adaptada avisa «Esto se hace desde la computadora» sin salir de la pantalla", () => {
    const alAviso = vi.fn()
    window.addEventListener("aviso-global", alAviso)
    avisarSoloComputadora()
    window.removeEventListener("aviso-global", alAviso)
    expect(alAviso.mock.calls[0][0].detail.texto).toBe(TEXTO_SOLO_COMPUTADORA)
    expect(TEXTO_SOLO_COMPUTADORA).toBe("Esto se hace desde la computadora.")
  })
})

describe("ResolutionGuard con modo celular", () => {
  it("el panel del personal por debajo de 1093 px ya no muestra el mensaje de pantalla muy pequeña", () => {
    ancho(390)
    render(<ResolutionGuard sinBloqueoBajo={ANCHO_ESCRITORIO}><p>contenido</p></ResolutionGuard>)
    expect(screen.getByText("contenido")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
  it("el panel del superadmin (sin modo celular) sigue con su aviso", () => {
    ancho(390)
    render(<ResolutionGuard><p>contenido</p></ResolutionGuard>)
    expect(screen.getByRole("alert")).toHaveTextContent("Nivel de Zoom No Soportado")
  })
})

describe("ShellCelular", () => {
  it("cabecera con el nombre de la sección y las notificaciones, y la barra de abajo con la pestaña activa", async () => {
    const alNotificaciones = vi.fn()
    const alInicio = vi.fn()
    render(
      <ShellCelular usuario={{ opticaNombre: "Óptica Demo" }} titulo="Agenda" subtitulo="Hoy · 8 citas" avisos={12} onNotificaciones={alNotificaciones}
        pestanas={[{ id: "inicio", nombre: "Inicio", icono: Calendar, onClick: alInicio }, { id: "mas", nombre: "Más", icono: Bell, onClick: () => {} }]} pestanaActiva="mas">
        <p>cuerpo</p>
      </ShellCelular>,
    )
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument()
    expect(screen.getByText("Hoy · 8 citas")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Notificaciones: 12" }))
    expect(alNotificaciones).toHaveBeenCalled()
    const barra = screen.getByRole("navigation", { name: "Menú del panel" })
    expect(within(barra).getByRole("button", { name: "Más" })).toHaveAttribute("aria-current", "page")
    expect(within(barra).getByRole("button", { name: "Inicio" })).not.toHaveAttribute("aria-current")
    await userEvent.click(within(barra).getByRole("button", { name: "Inicio" }))
    expect(alInicio).toHaveBeenCalled()
    expect(screen.getByText("cuerpo")).toBeInTheDocument()
  })
})

describe("Más", () => {
  it("lista lo que sí se usa, «Solo en computadora» (cada persona ve solo lo que puede usar) y «Cerrar sesión»", async () => {
    const alSalir = vi.fn()
    const alVentas = vi.fn()
    render(
      <MasCelular filas={[{ id: "n", nombre: "Notificaciones", cuenta: 2, onClick: () => {} }, { id: "c", nombre: "Mi cuenta", onClick: () => {} }]}
        filasComputadora={[{ id: "ventas", nombre: "Ventas", onClick: alVentas }]} onCerrarSesion={alSalir} />,
    )
    expect(screen.getByRole("button", { name: /Mi cuenta/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Inventario/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^Ventas/ }))
    expect(alVentas).toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }))
    expect(alSalir).toHaveBeenCalled()
  })
  it("sin módulos de computadora (un rol que no usa ninguno) no dibuja la sección", () => {
    render(<MasCelular filas={[{ id: "c", nombre: "Mi cuenta", onClick: () => {} }]} filasComputadora={[]} onCerrarSesion={() => {}} />)
    expect(screen.queryByText("Solo en computadora")).not.toBeInTheDocument()
  })
  it("quien tiene más de una vista puede cambiarla", async () => {
    const cambiar = vi.fn()
    render(<MasCelular filas={[]} filasComputadora={[]} vistas={[{ id: "a", nombre: "Administrador" }, { id: "o", nombre: "Optómetra" }]} vista={{ id: "a" }} onCambiarVista={cambiar} onCerrarSesion={() => {}} />)
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Optómetra" }))
    expect(cambiar).toHaveBeenCalledWith("o")
  })
})

describe("Módulo de computadora", () => {
  it("explica que el módulo se usa desde la computadora y ofrece los módulos que sí se pueden usar", async () => {
    const alAgenda = vi.fn()
    render(<ModuloDeComputadora nombre="Ventas" botones={[{ id: "citas", nombre: "Agenda", onClick: alAgenda }, { id: "inicio", nombre: "Inicio", onClick: () => {} }]} />)
    expect(screen.getByRole("heading", { name: "Este módulo se usa desde la computadora" })).toBeInTheDocument()
    expect(screen.getByText(/Ventas tiene tablas y formularios/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Agenda" }))
    expect(alAgenda).toHaveBeenCalled()
  })
})

describe("Notificaciones", () => {
  it("cada alerta abre lo que abre en la computadora, y sin alertas dice que todo está al día", async () => {
    const abrir = vi.fn()
    const { rerender } = render(<NotificacionesCelular alertas={[{ icon: Bell, color: "#2563eb", bg: "#eff6ff", texto: "Respondieron tu consulta", sub: "Asunto", onAbrir: abrir }]} />)
    await userEvent.click(screen.getByRole("button", { name: /Respondieron tu consulta/ }))
    expect(abrir).toHaveBeenCalled()
    rerender(<NotificacionesCelular alertas={[]} />)
    expect(screen.getByText("Todo al día")).toBeInTheDocument()
  })
})
