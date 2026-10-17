import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"

// El modo de la tesis: el sistema es para una sola óptica y la capa comercial (vender el sistema a otras ópticas) está oculta.
vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: false }))
const mock = vi.hoisted(() => ({ modo: "estado" }))
// El estado del sistema llega de estado_sistema() (migración 0121): aquí, con datos de ejemplo.
vi.mock("../../lib/supabaseClient", async () => {
  const { estadoDeMuestra } = await import("../../utilidades/estadoSistema")
  const q = { select: () => q, eq: () => q, gte: () => q, is: () => q, gt: () => Promise.resolve({ data: [], error: null }), lte: () => Promise.resolve({ count: 0, error: null }) }
  const rpc = (nombre) => {
    if (nombre === "estado_sistema") return Promise.resolve(mock.modo === "error" ? { data: null, error: { message: "no existe" } } : { data: estadoDeMuestra(Date.now(), mock.modo === "lento" ? "lento" : "estado"), error: null })
    return Promise.resolve({ data: [], error: null })
  }
  return { supabase: { from: () => q, rpc } }
})

import InicioSuperadmin from "./InicioSuperadmin"
import { filtrarActividad, contarPorTipo, tiposVisibles, textoDeAccion, nombreDestino, ACCIONES_COMERCIALES, MODULOS_USO } from "../../utilidades/superadminNegocio"

const ins = (d) => `${d}T15:00:00Z`
const opticas = [
  { id: "o1", nombre: "Óptica Solna Vision", slug: "solna", activa: true, estado_pago: "al_dia", created_at: ins("2026-01-10") },
  { id: "o3", nombre: "Óptica Demo", slug: "demo", activa: true, estado_pago: "al_dia", created_at: ins("2026-02-01"), es_de_prueba: true },
]
const todosLosModulos = Object.fromEntries(MODULOS_USO.map((m) => [m.id, ins("2026-10-10")]))
const uso = (modulos) => [{ optica_id: "o1", citas: 10, consultas: 6, ventas: 4, personas_activas: 3, previo: { personas_activas: 2 }, modulos }]
const acciones = [
  { id: "a1", accion: "responder_mensaje", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Solna Vision", detalle: "SOP-0001", created_at: ins("2026-10-15") },
  { id: "a2", accion: "actualizar_pago", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Solna Vision", antes: "pendiente", despues: "vencido", created_at: ins("2026-10-14") },
  { id: "a3", accion: "renombrar_optica", actor_nombre: "Diego", optica_id: "o3", optica_nombre: "QA Módulo Cinco", antes: "asdasd", created_at: ins("2026-10-13") },
  { id: "a4", accion: "publicar_anuncio", actor_nombre: "Diego", optica_id: null, optica_nombre: "Todas las ópticas", detalle: "Mantenimiento", created_at: ins("2026-10-12") },
]
const consultaUrgente = { id: "c1", numero: 61, asunto: "No puedo imprimir", urgencia: "urgente", estado: "recibida", ultimoMensajeDe: "optica", opticaId: "o1" }
const datos = (modulos) => ({ cargando: false, facturas: [], eventos: [], personas: [], uso: uso(modulos), sinServidor: false, recargar: vi.fn() })

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00Z")); mock.modo = "estado" })
afterEach(() => { vi.useRealTimers() })

const montar = (extra = {}) => render(
  <InicioSuperadmin opticas={opticas} datos={datos(todosLosModulos)} consultas={[]} actividad={acciones} incluirPrueba={false} onIncluirPrueba={vi.fn()}
    onAbrir={vi.fn()} onNuevoAviso={vi.fn()} onEntrarComo={vi.fn()} onOfrecerAyuda={vi.fn()} {...extra} />,
)

describe("modo de la tesis (una sola óptica, capa comercial oculta)", () => {
  it("un aviso general no habla de varias ópticas y las suscripciones son acciones comerciales", () => {
    const aviso = { accion: "publicar_anuncio", optica_id: null, optica_nombre: "Todas las ópticas", detalle: "Mantenimiento" }
    expect(textoDeAccion(aviso, false)).toBe("publicó un aviso general: Mantenimiento")
    expect(nombreDestino(aviso, false)).toBe("Todo el sistema")
    expect(textoDeAccion(aviso, true)).toBe("publicó un aviso para Todas las ópticas: Mantenimiento")
    expect(ACCIONES_COMERCIALES).toEqual(expect.arrayContaining(["cambiar_suscripcion", "actualizar_pago", "generar_factura", "pagar_factura", "cambiar_estado_lead"]))
  })

  it("el nombre es siempre «entornos de prueba» (nunca «ópticas de prueba»)", async () => {
    montar()
    await screen.findByRole("region", { name: "Estado del sistema" })
    expect(document.body.textContent).not.toMatch(/ópticas de prueba/i)
    expect(textoDeAccion({ accion: "marcar_optica_prueba", despues: "Óptica de prueba", optica_nombre: "Demo" }, false)).toBe("marcó como entorno de prueba a Demo")
  })

  it("la actividad oculta los tipos Pagos y Leads y sus acciones, con el número de las demás", () => {
    expect(tiposVisibles(false).map((t) => t.id)).toEqual(["todas", "opticas", "accesos", "soporte", "avisos", "superadmins"])
    expect(filtrarActividad(acciones, { opticas, saas: false }).map((a) => a.id)).toEqual(["a1", "a4"])
    const n = contarPorTipo(acciones, { opticas, saas: false })
    expect(n.pagos).toBeUndefined()
  })
})

describe("Inicio del superadmin: estructura y atajos", () => {
  it("atajos pequeños, el interruptor de los entornos de prueba, sin selector de período y sin «Crear óptica»", async () => {
    montar()
    const atajos = await screen.findByRole("group", { name: "Atajos" })
    expect(within(atajos).getByRole("button", { name: /Nuevo aviso/ })).toBeInTheDocument()
    expect(within(atajos).getByRole("button", { name: /Ver consultas/ })).toBeInTheDocument()
    expect(screen.getByText("Incluir entornos de prueba", { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Crear óptica/ })).toBeNull()
    expect(screen.queryByText(/Período/)).toBeNull()
    expect(screen.queryByRole("region", { name: "Soporte" })).toBeNull() // las consultas pendientes ya están en «Requiere tu atención»
  })

  it("«Entrar a la óptica» está desactivado con su motivo mientras no haya permiso de acceso del soporte", async () => {
    montar()
    const boton = await screen.findByRole("button", { name: /Entrar a la óptica/ })
    expect(boton).toBeDisabled()
    expect(boton.parentElement).toHaveAttribute("title", expect.stringMatching(/administrador de la óptica debe permitir el acceso del soporte/))
  })

  it("los atajos llevan a lo que prometen", async () => {
    const onAbrir = vi.fn(); const onNuevoAviso = vi.fn()
    montar({ onAbrir, onNuevoAviso })
    const atajos = await screen.findByRole("group", { name: "Atajos" })
    fireEvent.click(within(atajos).getByRole("button", { name: /Nuevo aviso/ }))
    expect(onNuevoAviso).toHaveBeenCalled()
    fireEvent.click(within(atajos).getByRole("button", { name: /Ver consultas/ }))
    expect(onAbrir).toHaveBeenCalledWith("soporte", expect.objectContaining({ tab: "consultas", estado: "abiertas" }))
  })
})

describe("Inicio del superadmin: franja de estado", () => {
  it("todo en orden: «Todo funciona correctamente», cuándo se verificó y los cinco componentes con su estado", async () => {
    montar()
    const franja = await screen.findByRole("region", { name: "Estado del sistema" })
    expect(await within(franja).findByText("Todo funciona correctamente")).toBeInTheDocument()
    expect(franja.textContent).toMatch(/Verificado hace 6 min/)
    expect(within(franja).getByRole("button", { name: /Verificar ahora/ })).toBeInTheDocument()
    expect(within(franja).getByRole("button", { name: /^Datos: Rápido/ })).toBeInTheDocument()
    expect(within(franja).getByRole("button", { name: /^Inicio de sesión: Rápido/ })).toBeInTheDocument()
    expect(within(franja).getByRole("button", { name: /^Tareas automáticas: Operativo/ })).toBeInTheDocument()
    expect(within(franja).getByRole("button", { name: /^Correo: No configurado/ })).toBeInTheDocument()
    expect(franja.textContent).not.toMatch(/\bms\b/) // la rapidez es Rápido/Normal/Lento, no un número suelto
  })

  it("un componente lento: «Hay componentes lentos»", async () => {
    mock.modo = "lento"
    montar()
    const franja = await screen.findByRole("region", { name: "Estado del sistema" })
    expect(await within(franja).findByText("Hay componentes lentos")).toBeInTheDocument()
    expect(within(franja).getByRole("button", { name: /^Datos: Lento/ })).toBeInTheDocument()
  })

  it("sin poder verificar: «No se pudo verificar el estado» y nunca «todo en orden»", async () => {
    mock.modo = "error"
    montar()
    const franja = await screen.findByRole("region", { name: "Estado del sistema" })
    expect(await within(franja).findByText("No se pudo verificar el estado")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Todo funciona correctamente/)
    expect(document.body.textContent).not.toMatch(/Sistema[^.]*todo en orden/)
    // Basta con la franja de arriba: «Requiere tu atención» no lo repite ni da el Sistema por en orden
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(atencion.textContent).not.toMatch(/no se pudo verificar/i)
    expect(within(atencion).queryByRole("region", { name: "Requiere tu atención: Sistema" })).toBeNull()
    expect(atencion.textContent).toMatch(/Soporte y La óptica: todo en orden/)
    expect(atencion.textContent).not.toMatch(/Sistema/)
  })

  it("al pulsar un componente se abre su ventana con historial de 30 días, fallos y qué hacer", async () => {
    montar()
    const franja = await screen.findByRole("region", { name: "Estado del sistema" })
    fireEvent.click(await within(franja).findByRole("button", { name: /^Correo: No configurado/ }))
    const v = await screen.findByRole("dialog", { name: "Correo" })
    expect(within(v).getByText("Qué hacer")).toBeInTheDocument()
    expect(within(v).getByText(/remitente con dominio propio/)).toBeInTheDocument()
    expect(within(v).getByText("Últimos 30 días")).toBeInTheDocument()
    expect(within(v).getByText("Fallos recientes")).toBeInTheDocument()
  })
})

describe("Inicio del superadmin: requiere tu atención", () => {
  it("todo en orden: una sola línea, sin tarjetas vacías ni «Nada pendiente»", async () => {
    montar()
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await screen.findByText("Todo funciona correctamente")
    expect(atencion.textContent).toMatch(/Sistema, Soporte y La óptica: todo en orden/)
    expect(within(atencion).queryAllByRole("region")).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/Nada pendiente en esta área/)
  })

  it("con avisos: solo las áreas que los tienen, y las demás en una línea al costado", async () => {
    mock.modo = "lento"
    montar({ consultas: [consultaUrgente] })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await within(atencion).findByRole("region", { name: "Requiere tu atención: Sistema" })
    expect(within(atencion).getByRole("region", { name: "Requiere tu atención: Soporte" })).toHaveTextContent("1 consulta urgente abierta")
    expect(within(atencion).getByRole("region", { name: "Requiere tu atención: Sistema" })).toHaveTextContent("1 componente lento")
    expect(within(atencion).queryByRole("region", { name: "Requiere tu atención: La óptica" })).toBeNull()
    expect(atencion.textContent).toMatch(/La óptica: todo en orden/)
  })

  it("«La óptica» reúne los módulos sin uso en 30 días", async () => {
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await screen.findByText("Todo funciona correctamente")
    const optica = within(atencion).getByRole("region", { name: "Requiere tu atención: La óptica" })
    expect(optica).toHaveTextContent("6 módulos sin uso en 30 días")
    expect(atencion.textContent).toMatch(/Sistema y Soporte: todo en orden/)
  })
})

describe("Inicio del superadmin: íconos en las ventanas", () => {
  it("los componentes y los módulos llevan su ícono, no sus iniciales", async () => {
    mock.modo = "lento"
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await within(atencion).findByRole("region", { name: "Requiere tu atención: Sistema" })
    fireEvent.click(within(atencion).getByRole("button", { name: "Abrir los avisos de Sistema" }))
    const v = await screen.findByRole("dialog")
    expect(v.querySelector("svg.lucide-database")).not.toBeNull() // Datos
    expect(within(v).queryByText("D")).toBeNull()
    fireEvent.click(within(v).getAllByRole("button", { name: "Cerrar" }).at(-1))
    fireEvent.click(within(atencion).getByRole("button", { name: "Abrir los avisos de La óptica" }))
    const w = await screen.findByRole("dialog")
    expect(w.querySelector("svg.lucide-shopping-bag")).not.toBeNull() // Ventas
    expect(w.querySelector("svg.lucide-calendar")).toBeNull() // Citas está en uso: no aparece
    for (const ini of ["V", "I", "CY", "R"]) expect(within(w).queryByText(ini)).toBeNull()
  })

  it("las ventanas de un componente y de un módulo llevan el ícono de su menú", async () => {
    montar()
    const franja = await screen.findByRole("region", { name: "Estado del sistema" })
    fireEvent.click(await within(franja).findByRole("button", { name: /^Correo:/ }))
    const v = await screen.findByRole("dialog", { name: "Correo" })
    expect(v.querySelector("svg.lucide-mail")).not.toBeNull()
  })
})

describe("Inicio del superadmin: uso de la óptica y actividad reciente", () => {
  it("los siete módulos son una lista corta con su punto y su última vez, sin letra grande ni naranja", async () => {
    montar({ datos: datos({ citas: ins("2026-10-06") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    expect(within(lista).getAllByRole("listitem")).toHaveLength(7)
    expect(within(lista).getByRole("button", { name: /^Citas médicas: En uso · última vez hace 10 días/ })).toBeInTheDocument()
    expect(within(lista).getAllByText("sin uso en 30 días")).toHaveLength(6)
    expect(lista.innerHTML).not.toMatch(/amber|orange/)
    expect(lista.innerHTML).not.toMatch(/text-2xl|text-xl|text-lg/)
  })

  it("las personas activas llevan su comparación y abren el personal", async () => {
    montar()
    const region = await screen.findByRole("region", { name: "Uso de la óptica" })
    const boton = within(region).getByRole("button", { name: /^Personas activas: 3/ })
    // con números pequeños, «3 (antes 2)» (la regla de Reportes), no «↑ 50 %»
    expect(boton.textContent).toBe("Personas activas en 30 días3(antes 2)")
    expect(boton.textContent).not.toMatch(/%/)
    fireEvent.click(boton)
    expect(await screen.findByRole("dialog", { name: "Personal de la óptica" })).toBeInTheDocument()
  })

  it("con muchas personas la comparación es en porcentaje, con su flecha", async () => {
    montar({ datos: { ...datos(todosLosModulos), uso: [{ optica_id: "o1", personas_activas: 30, previo: { personas_activas: 20 }, modulos: todosLosModulos }] } })
    const region = await screen.findByRole("region", { name: "Uso de la óptica" })
    expect(within(region).getByRole("button", { name: /^Personas activas: 30/ }).textContent).toMatch(/30↑ 50%/)
  })

  it("cada fila de módulos y de actividad se ve pulsable (flecha) y lo es; cada tarjeta tiene su «Ver todo» abajo", async () => {
    const onAbrir = vi.fn()
    montar({ onAbrir })
    const uso = await screen.findByRole("region", { name: "Uso de la óptica" })
    const act = screen.getByRole("region", { name: "Actividad reciente" })
    for (const li of within(uso).getAllByRole("listitem")) expect(li.querySelector("svg.lucide-chevron-right")).not.toBeNull()
    for (const li of within(act).getAllByRole("listitem")) expect(li.querySelector("svg.lucide-chevron-right")).not.toBeNull()
    // «Ver todo» en cada tarjeta, y lleva a lo que promete
    fireEvent.click(within(uso).getByRole("button", { name: "Ver todo el uso de la óptica" }))
    expect(onAbrir).toHaveBeenCalledWith("opticas", expect.objectContaining({ abrir: "o1" }))
    expect(within(act).getByRole("button", { name: "Ver toda la actividad" }).textContent).toMatch(/^Ver todo/)
  })

  it("una acción de la actividad abre su detalle en la ventana estándar", async () => {
    montar()
    const act = await screen.findByRole("region", { name: "Actividad reciente" })
    fireEvent.click(within(act).getByRole("button", { name: /respondió una consulta/ }))
    const v = await screen.findByRole("dialog")
    expect(within(v).getByText("Qué cambió")).toBeInTheDocument()
    expect(within(v).getByText("Quién y dónde")).toBeInTheDocument()
  })

  it("un módulo sin uso ofrece ayuda y entrega el módulo para preparar el aviso; uno en uso no", async () => {
    const onOfrecerAyuda = vi.fn()
    montar({ datos: datos({ citas: ins("2026-10-10") }), onOfrecerAyuda })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    const v = await screen.findByRole("dialog", { name: "Ventas" })
    fireEvent.click(within(v).getByRole("button", { name: "Ofrecer ayuda" }))
    expect(onOfrecerAyuda).toHaveBeenCalledWith("ventas", expect.objectContaining({ id: "o1" }))
    fireEvent.click(within(lista).getByRole("button", { name: /^Citas médicas:/ }))
    const c = await screen.findByRole("dialog", { name: "Citas médicas" })
    expect(within(c).queryByRole("button", { name: "Ofrecer ayuda" })).toBeNull()
  })

  it("la actividad reciente no lleva pagos ni entornos de prueba, salvo que se active el interruptor", async () => {
    const { unmount } = montar()
    const act = await screen.findByRole("region", { name: "Actividad reciente" })
    expect(within(act).getByText(/respondió una consulta/)).toBeInTheDocument()
    expect(within(act).getByText(/publicó un aviso general/)).toBeInTheDocument()
    expect(within(act).queryByText(/marcó el pago/)).toBeNull()
    expect(within(act).queryByText(/asdasd|QA Módulo Cinco/)).toBeNull()
    expect(within(act).getByRole("button", { name: "Ver toda la actividad" })).toBeInTheDocument()
    unmount()
    montar({ incluirPrueba: true })
    const act2 = await screen.findByRole("region", { name: "Actividad reciente" })
    expect(within(act2).getByText(/asdasd/)).toBeInTheDocument()
  })

  it("«Ver toda la actividad» lleva a Actividad", async () => {
    const onAbrir = vi.fn()
    montar({ onAbrir })
    fireEvent.click(await screen.findByRole("button", { name: "Ver toda la actividad" }))
    expect(onAbrir).toHaveBeenCalledWith("actividad", {})
  })
})

describe("Inicio del superadmin: mientras carga el estado no afirma nada", () => {
  it("dice «Verificando el estado…», ni «todo funciona» ni «no se pudo verificar», y no da el Sistema por en orden", async () => {
    montar()
    // Primer instante: la lectura del estado todavía no terminó
    expect(screen.getByText("Verificando el estado…")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Todo funciona correctamente|No se pudo verificar/)
    expect(document.body.textContent).not.toMatch(/Sistema[^.]*todo en orden/)
    expect(await screen.findByText("Todo funciona correctamente")).toBeInTheDocument()
  })
})

describe("Inicio del superadmin: mientras llega el uso no afirma nada", () => {
  it("no dice «0 personas» ni «módulos sin uso» hasta tener el dato", async () => {
    montar({ datos: { ...datos({}), cargando: true } })
    expect(screen.getByLabelText("Cargando el uso de la óptica")).toBeInTheDocument()
    await screen.findByText("Todo funciona correctamente")
    expect(document.body.textContent).not.toMatch(/módulos? sin uso/)
    expect(document.body.textContent).not.toMatch(/La óptica: todo en orden|Sistema, Soporte y La óptica/)
    expect(screen.queryByRole("button", { name: /^Personas activas/ })).toBeNull()
  })
})
