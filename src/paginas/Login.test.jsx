import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

const base = vi.hoisted(() => ({ rpc: null }))
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => base.rpc(...a),
    auth: {},
  },
}))

import Login from "./Login"
import EstilosPublica from "../componentes/publica/EstilosPublica"

const turno = { activo: true, inicio: "00:00", fin: "23:58" }
const diaAbierto = () => ({ manana: turno, tarde: { activo: false, inicio: "14:00", fin: "18:00" } })
const disponibilidad = {
  horarioSemanal: { lunes: diaAbierto(), martes: diaAbierto(), miercoles: diaAbierto(), jueves: diaAbierto(), viernes: diaAbierto(), sabado: diaAbierto(), domingo: diaAbierto() },
  excepciones: {},
}
const optica = (extra = {}) => ({
  id: "o1",
  nombre: "Óptica Demo",
  logo_url: null,
  marca: {},
  settings: { opticaDireccion: "Av. Francisco de Orellana 1234, Guayaquil", opticaTelefono: "0987654321" },
  ...extra,
})

const pintar = (props = {}) => render(<Login opticaPublica={optica()} disponibilidad={disponibilidad} {...props} />)

beforeEach(() => {
  base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos" ? { data: null, error: { message: "no existe" } } : { data: null, error: null }))
})

describe("Página pública: barra y menú", () => {
  it("el menú lleva a cada sección de la misma página y «Iniciar sesión» es el único acceso de arriba", () => {
    pintar()
    const cabecera = screen.getByRole("banner")
    const menu = within(cabecera).getByRole("navigation", { name: "Secciones de la página" })
    const esperado = { "Quiénes somos": "#quienes-somos", Servicios: "#servicios", "Cómo agendar": "#como-agendar", Preguntas: "#preguntas", Contacto: "#contacto" }
    for (const [texto, href] of Object.entries(esperado)) {
      expect(within(menu).getByRole("link", { name: texto })).toHaveAttribute("href", href)
      expect(document.querySelector(href)).not.toBeNull()
    }
    expect(within(cabecera).getAllByRole("button", { name: "Iniciar sesión" })).toHaveLength(1)
    expect(within(cabecera).queryByRole("button", { name: /agend/i })).toBeNull()
  })

  it("en pantalla angosta el botón de menú despliega los enlaces", () => {
    pintar()
    expect(screen.queryByRole("navigation", { name: "Menú de secciones" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }))
    const movil = screen.getByRole("navigation", { name: "Menú de secciones" })
    expect(within(movil).getAllByRole("link")).toHaveLength(5)
  })
})

describe("Página pública: ajustes de la segunda revisión", () => {
  it("arriba queda solo «Iniciar sesión» junto al menú: el teléfono está en Contacto y en el botón flotante", () => {
    pintar()
    const cabecera = screen.getByRole("banner")
    expect(within(cabecera).queryByRole("link", { name: /Llamar/ })).toBeNull()
    expect(within(cabecera).queryByText("0987654321")).toBeNull()
    expect(within(cabecera).getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument()
    expect(within(document.querySelector("#contacto")).getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+593987654321")
    expect(document.querySelector("[data-whatsapp-flotante]")).not.toBeNull()
  })

  it("sin teléfono configurado no hay botón flotante de WhatsApp", () => {
    pintar({ opticaPublica: optica({ settings: { opticaDireccion: "Av. X" } }) })
    expect(document.querySelector("[data-whatsapp-flotante]")).toBeNull()
  })

  it("el contenido de las secciones usa un contenedor de 1296 px con 48 px de relleno: 1200 px de contenido como máximo", () => {
    pintar()
    for (const id of ["#inicio", "#quienes-somos", "#servicios", "#como-agendar", "#preguntas", "#contacto"]) {
      const contenedor = document.querySelector(`${id} > div`)
      expect(contenedor.className, id).toContain("max-w-[1296px]")
      expect(contenedor.className, id).toContain("lg:px-12")
    }
  })

  it("«Por qué elegirnos» muestra las tres razones (editables) cuando ningún optómetra activó «Mostrarme»", () => {
    pintar()
    const caja = document.querySelector("[data-por-que-elegirnos]")
    expect(within(caja).getAllByRole("listitem")).toHaveLength(3)
    expect(within(caja).getByText("Equipos de precisión")).toBeInTheDocument()
  })

  it("las razones salen de la configuración de la óptica", () => {
    pintar({ opticaPublica: optica({ marca: { razones: [{ id: "a", titulo: "Entrega rápida", texto: "Lentes en 48 horas" }] } }) })
    const caja = document.querySelector("[data-por-que-elegirnos]")
    expect(within(caja).getAllByRole("listitem")).toHaveLength(1)
    expect(within(caja).getByText("Entrega rápida")).toBeInTheDocument()
  })

  it("si un optómetra activó «Mostrarme» sale su tarjeta y no «Por qué elegirnos»", async () => {
    base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos"
      ? { data: { optometras: [{ id: "p1", nombre: "Paula Andrade", registro: "1234", foto: null }], optometrasTotal: 1, pacientesAtendidos: 40 }, error: null }
      : { data: null, error: null }))
    pintar()
    expect(await screen.findByText("Paula Andrade")).toBeInTheDocument()
    expect(document.querySelector("[data-por-que-elegirnos]")).toBeNull()
  })

  it("cada servicio lleva su ícono de color", () => {
    pintar()
    expect(document.querySelectorAll("#servicios [data-icono-servicio]").length).toBe(3)
  })

  it("«Cómo agendar» va en una sola fila con el botón al final y sigue el orden del agendamiento", () => {
    pintar()
    const seccion = document.querySelector("#como-agendar")
    const items = within(seccion).getAllByRole("listitem")
    expect(items).toHaveLength(4)
    expect(within(items[0]).getByText("Motivo, fecha y hora")).toBeInTheDocument()
    expect(within(items[1]).getByText("Tus datos")).toBeInTheDocument()
    expect(within(items[3]).getByRole("button", { name: "Agenda tu cita" })).toBeInTheDocument()
  })

  it("«Lo que dicen nuestros pacientes» solo aparece si la óptica escribió opiniones", () => {
    const { unmount } = pintar()
    expect(document.querySelector("#opiniones")).toBeNull()
    unmount()
    pintar({ opticaPublica: optica({ marca: { opiniones: [{ id: "o1", texto: "Muy buena atención", nombre: "María G." }] } }) })
    const seccion = document.querySelector("#opiniones")
    expect(within(seccion).getByText(/Muy buena atención/)).toBeInTheDocument()
    expect(within(seccion).getByText("María G.")).toBeInTheDocument()
  })

  it("las preguntas frecuentes van en dos columnas", () => {
    pintar()
    expect(document.querySelector("#preguntas .md\\:grid-cols-2")).not.toBeNull()
  })

  it("el botón flotante de WhatsApp abre el chat con el mensaje ya escrito", () => {
    pintar()
    const boton = document.querySelector("[data-whatsapp-flotante]")
    expect(boton).not.toBeNull()
    const href = boton.getAttribute("href")
    expect(href).toContain("phone=593987654321")
    expect(decodeURIComponent(href)).toContain("Óptica Demo")
  })
})

describe("Página pública: inicio", () => {
  it("tiene una sola acción principal en el inicio y la píldora sale del horario", () => {
    pintar()
    const inicio = document.querySelector("#inicio")
    expect(within(inicio).getAllByRole("button")).toHaveLength(1)
    expect(within(inicio).getByRole("button", { name: "Agenda tu cita en línea" })).toBeInTheDocument()
    expect(within(inicio).getByText(/Abierto · hasta las \d{1,2}:\d{2} (AM|PM)/)).toBeInTheDocument()
    expect(within(inicio).getByText("Sin crear cuenta · Confirmación inmediata · Datos protegidos")).toBeInTheDocument()
    expect(screen.queryByText(/Ya soy paciente/)).toBeNull()
    expect(screen.queryByText(/Conoce nuestros servicios/)).toBeNull()
  })

  it("el eslogan por defecto va en dos líneas y uno propio se muestra tal cual", () => {
    const { unmount } = pintar()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ve el mundo con claridad.")
    expect(screen.getByText("con claridad.")).toHaveClass("italic")
    unmount()
    pintar({ opticaPublica: optica({ marca: { eslogan: "Tu mirada, nuestro cuidado." } }) })
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu mirada, nuestro cuidado.")
  })

  it("las tres tarjetas flotantes están y se ocultan en pantallas angostas", () => {
    pintar()
    for (const t of ["Tu próxima cita", "Tus lentes", "Tu receta"]) {
      const tarjeta = screen.getByText(t).closest("div[aria-hidden='true']")
      expect(tarjeta).toHaveClass("hidden", "lg:block")
    }
  })

  it("todo el movimiento se apaga con prefers-reduced-motion", () => {
    const { container } = render(<EstilosPublica />)
    const css = container.querySelector("style").textContent
    const bloque = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"))
    for (const clase of ["lg-flota", "lg-pupila", "lg-spin", "lg-rise", "lg-focus", "lg-modal", "lg-luz"]) expect(bloque).toContain(`.${clase}`)
    expect(bloque).toContain("animation: none")
    expect(bloque).toContain("scroll-behavior: auto")
  })

  it("sin imagen principal dibuja el ojo animado; con imagen, la imagen", () => {
    const { unmount } = pintar()
    expect(screen.getByRole("img", { name: "Ilustración de un ojo" })).toBeInTheDocument()
    unmount()
    pintar({ opticaPublica: optica({ marca: { imagenPrincipalUrl: "https://ejemplo.test/foto.jpg" } }) })
    expect(screen.queryByRole("img", { name: "Ilustración de un ojo" })).toBeNull()
    expect(document.querySelector("#inicio img[src='https://ejemplo.test/foto.jpg']")).not.toBeNull()
  })
})

describe("Página pública: secciones editables", () => {
  it("sin configuración usa los ejemplos y muestra las cinco secciones", () => {
    pintar()
    expect(screen.getByText("Examen visual completo")).toBeInTheDocument()
    expect(screen.getAllByText("Agendar este servicio →")).toHaveLength(3)
    expect(screen.getByText("¿Cuánto dura un examen visual?")).toBeInTheDocument()
    expect(document.querySelectorAll("details")).toHaveLength(4)
    expect(document.querySelector("details")).toHaveAttribute("open")
    expect(screen.getByText("Tu cita en tres pasos, sin crear cuenta")).toBeInTheDocument()
  })

  it("los servicios y las preguntas salen de la configuración de la óptica", () => {
    pintar({
      opticaPublica: optica({
        marca: {
          serviciosPagina: [{ id: "a", titulo: "Terapia visual", texto: "Ejercicios guiados.", motivo: "Examen de Control" }],
          preguntas: [{ id: "q", p: "¿Aceptan seguros?", r: "Sí, varios." }],
        },
      }),
    })
    expect(screen.getByText("Terapia visual")).toBeInTheDocument()
    expect(screen.queryByText("Examen visual completo")).toBeNull()
    expect(screen.getByText("¿Aceptan seguros?")).toBeInTheDocument()
    expect(document.querySelectorAll("details")).toHaveLength(1)
  })

  it("«Agendar este servicio» abre el agendamiento con ESE motivo", () => {
    const alIr = vi.fn()
    pintar({
      AlIrARegistro: alIr,
      opticaPublica: optica({ marca: { serviciosPagina: [{ id: "a", titulo: "Terapia visual", texto: "x", motivo: "Examen de Control" }] } }),
    })
    fireEvent.click(screen.getByRole("button", { name: "Agendar este servicio →" }))
    expect(alIr).toHaveBeenCalledWith("Examen de Control")
    fireEvent.click(within(document.querySelector("#inicio")).getByRole("button", { name: "Agenda tu cita en línea" }))
    expect(alIr).toHaveBeenLastCalledWith(undefined)
  })

  it("muestra solo los números activos y con dato; sin optómetras no hay tarjeta", async () => {
    const marca = { quienesSomos: { anoFundacion: 2014, mostrarAnos: true, mostrarPacientes: true, mostrarOptometras: true } }
    const { unmount } = pintar({ opticaPublica: optica({ marca }) })
    expect(screen.getByText("Cuidamos tu vista desde 2014")).toBeInTheDocument()
    expect(screen.getByText("años atendiendo")).toBeInTheDocument()
    expect(screen.queryByText("pacientes")).toBeNull()
    expect(screen.queryByText(/optómetra/i)).toBeNull()
    expect(document.querySelector("#quienes-somos [data-por-que-elegirnos]")).not.toBeNull() // nadie activó «Mostrarme»: «Por qué elegirnos»
    unmount()

    base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos"
      ? { data: { optometras: [{ id: "p1", nombre: "Paula Andrade", registro: "1234", foto: null }], optometrasTotal: 1, pacientesAtendidos: 3012 }, error: null }
      : { data: null, error: null }))
    pintar({ opticaPublica: optica({ marca }) })
    expect(await screen.findByText("Paula Andrade")).toBeInTheDocument()
    expect(screen.getByText("Optómetra · Reg. 1234")).toBeInTheDocument()
    expect(screen.getByText("PA")).toBeInTheDocument()
    expect(screen.getByText("3.000+")).toBeInTheDocument()
    expect(screen.getByText("optómetra")).toBeInTheDocument()
  })

  it("el número de optómetras usa el total aunque nadie aparezca en la página; sin total no se muestra", async () => {
    const marca = { quienesSomos: { mostrarOptometras: true } }
    base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos"
      ? { data: { optometras: [], optometrasTotal: 2, pacientesAtendidos: 0 }, error: null }
      : { data: null, error: null }))
    const { unmount } = pintar({ opticaPublica: optica({ marca }) })
    expect(await screen.findByText("optómetras")).toBeInTheDocument()
    expect(document.querySelector("#quienes-somos [data-por-que-elegirnos]")).not.toBeNull() // nadie activó «Mostrarme»: «Por qué elegirnos»
    unmount()
    base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos"
      ? { data: { optometras: [{ id: "p1", nombre: "Paula Andrade", registro: null, foto: null }], pacientesAtendidos: 0 }, error: null }
      : { data: null, error: null }))
    pintar({ opticaPublica: optica({ marca }) })
    expect(await screen.findByText("Paula Andrade")).toBeInTheDocument()
    expect(screen.queryByText("optómetra")).toBeNull()
  })

  it("cada número se oculta con su casilla", async () => {
    base.rpc = vi.fn((nombre) => Promise.resolve(nombre === "pagina_publica_datos"
      ? { data: { optometras: [{ id: "p1", nombre: "Paula Andrade", registro: null, foto: null }], optometrasTotal: 2, pacientesAtendidos: 500 }, error: null }
      : { data: null, error: null }))
    pintar({ opticaPublica: optica({ marca: { quienesSomos: { anoFundacion: 2014, mostrarAnos: false, mostrarPacientes: false, mostrarOptometras: false } } }) })
    expect(await screen.findByText("Paula Andrade")).toBeInTheDocument()
    expect(screen.queryByText("años atendiendo")).toBeNull()
    expect(screen.queryByText("pacientes")).toBeNull()
    expect(screen.queryByText("optómetra")).toBeNull()
  })

  it("el contacto usa la dirección y el teléfono de Configuración, con mapa y botones", () => {
    pintar()
    const contacto = document.querySelector("#contacto")
    expect(within(contacto).getByText("Av. Francisco de Orellana 1234, Guayaquil")).toBeInTheDocument()
    expect(within(contacto).getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain("phone=593987654321")
    expect(within(contacto).getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+593987654321")
    expect(within(contacto).getByRole("link", { name: "Cómo llegar" }).getAttribute("href")).toContain("google.com/maps")
    expect(contacto.querySelector("iframe").getAttribute("src")).toContain("https://www.google.com/maps?q=")
    expect(contacto.querySelector("iframe").getAttribute("src")).toContain("output=embed")
  })

  it("sin dirección ni teléfono no hay botones muertos ni un hueco vacío", () => {
    pintar({ opticaPublica: optica({ settings: {} }) })
    const contacto = document.querySelector("#contacto")
    expect(contacto.querySelector("iframe")).toBeNull()
    expect(within(contacto).queryByRole("link")).toBeNull()
    expect(within(contacto).getByText(/El mapa aparecerá cuando la óptica configure su dirección/)).toBeInTheDocument()
  })

  it("el pie lleva la política de privacidad y el acceso", () => {
    pintar()
    const pie = screen.getByRole("contentinfo")
    expect(within(pie).getByText(/© \d{4} Óptica Demo/)).toBeInTheDocument()
    expect(within(pie).getByRole("button", { name: "Política de privacidad" })).toBeInTheDocument()
    fireEvent.click(within(pie).getByRole("button", { name: "Iniciar sesión" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})

describe("Ventana de ingreso", () => {
  const abrir = (props) => {
    pintar(props)
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Iniciar sesión" }))
    return screen.getByRole("dialog")
  }

  it("trae los campos del diseño, «Recordarme» marcada y sin las píldoras de roles", () => {
    const ventana = abrir()
    expect(within(ventana).getByRole("heading", { name: "Ingresa a Óptica Demo" })).toBeInTheDocument()
    expect(within(ventana).getByText("Pacientes y equipo de la óptica")).toBeInTheDocument()
    expect(within(ventana).getByLabelText("Cédula o usuario")).toHaveAttribute("placeholder", "Ej. 0912345678 o tu usuario")
    const clave = within(ventana).getByLabelText("Contraseña")
    expect(clave).toHaveAttribute("type", "password")
    fireEvent.click(within(ventana).getByRole("button", { name: "Mostrar contraseña" }))
    expect(clave).toHaveAttribute("type", "text")
    expect(within(ventana).getByRole("checkbox", { name: "Recordarme" })).toBeChecked()
    expect(within(ventana).getByRole("button", { name: "¿Olvidaste tu contraseña?" })).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Ingresar" })).toBeInTheDocument()
    expect(within(ventana).queryByText("Administración")).toBeNull()
    expect(within(ventana).queryByText(/un solo acceso/)).toBeNull()
  })

  it("«Agenda tu primera cita» cierra la ventana y lleva al agendamiento", () => {
    const alIr = vi.fn()
    const ventana = abrir({ AlIrARegistro: alIr })
    fireEvent.click(within(ventana).getByRole("button", { name: "Agenda tu primera cita" }))
    expect(alIr).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Escape y la X cierran la ventana", () => {
    abrir()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: "Iniciar sesión" }))
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("«¿Olvidaste tu contraseña?» muestra el mensaje de WhatsApp ya escrito y vuelve", () => {
    const ventana = abrir()
    fireEvent.change(within(ventana).getByLabelText("Cédula o usuario"), { target: { value: "0912345678" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "¿Olvidaste tu contraseña?" }))
    expect(within(ventana).getByRole("heading", { name: "¿Olvidaste tu contraseña?" })).toBeInTheDocument()
    expect(within(ventana).getByText(/la óptica te da una contraseña temporal, y al ingresar con ella creas una nueva/)).toBeInTheDocument()
    const wa = within(ventana).getByRole("link", { name: "Escribir por WhatsApp" })
    expect(decodeURIComponent(wa.getAttribute("href"))).toContain("Hola, olvidé mi contraseña del portal. Mi cédula es 0912345678.")
    expect(within(ventana).getByRole("link", { name: "Llamar al 0987654321" })).toHaveAttribute("href", "tel:+593987654321")
    expect(within(ventana).getByText(/Abierto hoy hasta las \d{1,2}:\d{2} (AM|PM) · Av\. Francisco de Orellana/)).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "← Volver" }))
    expect(within(ventana).getByRole("button", { name: "Ingresar" })).toBeInTheDocument()
  })

  it("si lo escrito no es una cédula, el mensaje deja «…»", () => {
    const ventana = abrir()
    fireEvent.change(within(ventana).getByLabelText("Cédula o usuario"), { target: { value: "maria" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "¿Olvidaste tu contraseña?" }))
    const wa = within(ventana).getByRole("link", { name: "Escribir por WhatsApp" })
    expect(decodeURIComponent(wa.getAttribute("href"))).toContain("Mi cédula es ….")
  })

  it("sin teléfono configurado no hay botones muertos", () => {
    const ventana = abrir({ opticaPublica: optica({ settings: { opticaDireccion: "Calle 1" } }) })
    fireEvent.click(within(ventana).getByRole("button", { name: "¿Olvidaste tu contraseña?" }))
    expect(within(ventana).queryByRole("link", { name: /WhatsApp/ })).toBeNull()
    expect(within(ventana).queryByRole("link", { name: /Llamar/ })).toBeNull()
    expect(within(ventana).getByText(/Pide tu contraseña temporal en la óptica/)).toBeInTheDocument()
    expect(within(ventana).getByText(/Calle 1/)).toBeInTheDocument()
  })
})

describe("Ingreso del superadmin", () => {
  it("es una tarjeta con Mostrar contraseña, Sistema operativo y Soporte técnico", () => {
    render(<Login soloModal opticaPublica={null} />)
    expect(screen.getByRole("heading", { name: "Administración del sistema" })).toBeInTheDocument()
    expect(screen.getByText("Acceso restringido · se registra cada ingreso")).toBeInTheDocument()
    expect(screen.getByLabelText("Correo")).toBeInTheDocument()
    const clave = screen.getByLabelText("Contraseña")
    expect(clave).toHaveAttribute("type", "password")
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }))
    expect(clave).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument()
    expect(screen.getByText("Sistema operativo")).toBeInTheDocument()
    expect(screen.getByText("¿Problemas? Soporte técnico")).toBeInTheDocument()
    expect(screen.queryByText(/Bienvenido de nuevo/)).toBeNull()
  })

  it("con el autocompletado del navegador los campos siguen oscuros", () => {
    render(<Login soloModal opticaPublica={null} />)
    for (const campo of [screen.getByLabelText("Correo"), screen.getByLabelText("Contraseña")]) expect(campo.className).toContain("ing-oscuro")
    const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join(" ")
    expect(css).toContain(".ing-oscuro:-webkit-autofill")
    expect(css).toContain("-webkit-box-shadow: 0 0 0 1000px #17233F inset")
    expect(css).toContain("-webkit-text-fill-color: #fff")
  })
})
