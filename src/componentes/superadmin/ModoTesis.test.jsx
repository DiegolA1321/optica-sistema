import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

// El modo de la tesis: el sistema es para una sola óptica y la capa comercial (vender el sistema a otras ópticas) está oculta.
vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: false }))
const mock = vi.hoisted(() => ({ modo: "estado", ofrecidas: [], noUsan: [], llamadas: [], falloAyuda: "" }))
// El estado del sistema llega de estado_sistema() (migración 0121): aquí, con datos de ejemplo.
vi.mock("../../lib/supabaseClient", async () => {
  const { estadoDeMuestra } = await import("../../utilidades/estadoSistema")
  const q = { select: () => q, eq: () => q, gte: () => q, is: () => q, gt: () => Promise.resolve({ data: [], error: null }), lte: () => Promise.resolve({ count: 0, error: null }) }
  // Lo ofrecido (ayudas_ofrecidas) y lo que la óptica decidió (modulos_no_usados), como los entrega la base
  const tabla = (datos) => { const t = { select: () => t, eq: () => t, order: () => Promise.resolve({ data: datos(), error: null }), then: (ok) => ok({ data: datos(), error: null }) }; return t }
  const from = (nombre) => (nombre === "ayudas_ofrecidas" ? tabla(() => mock.ofrecidas) : nombre === "modulos_no_usados" ? tabla(() => mock.noUsan) : q)
  const rpc = (nombre, args) => {
    if (nombre === "estado_sistema") return Promise.resolve(mock.modo === "error" ? { data: null, error: { message: "no existe" } } : { data: estadoDeMuestra(Date.now(), mock.modo === "lento" ? "lento" : "estado"), error: null })
    if (nombre === "ofrecer_ayuda") { mock.llamadas.push({ nombre, args }); return Promise.resolve(mock.falloAyuda ? { data: null, error: { message: mock.falloAyuda } } : { data: [{ id: "c-nueva", numero: 62 }], error: null }) }
    return Promise.resolve({ data: [], error: null })
  }
  return { supabase: { from, rpc } }
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

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00Z")); mock.modo = "estado"; mock.ofrecidas = []; mock.noUsan = []; mock.llamadas = []; mock.falloAyuda = "" })
afterEach(() => { vi.useRealTimers() })

const montar = (extra = {}) => render(
  <InicioSuperadmin opticas={opticas} datos={datos(todosLosModulos)} consultas={[]} actividad={acciones} incluirPrueba={false} onIncluirPrueba={vi.fn()}
    onAbrir={vi.fn()} onNuevoAviso={vi.fn()} onEntrarComo={vi.fn()} onAviso={vi.fn()} onAuditoria={vi.fn()} {...extra} />,
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
    expect(within(within(atencion).getByRole("region", { name: "Requiere tu atención: Soporte" })).getByRole("button", { name: "1 consulta urgente abierta" })).toBeInTheDocument()
    expect(within(within(atencion).getByRole("region", { name: "Requiere tu atención: Sistema" })).getByRole("button", { name: "1 componente lento" })).toBeInTheDocument()
    expect(within(atencion).queryByRole("region", { name: "Requiere tu atención: La óptica" })).toBeNull()
    expect(atencion.textContent).toMatch(/La óptica: todo en orden/)
  })

  it("«La óptica» reúne los módulos sin uso en 30 días", async () => {
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await screen.findByText("Todo funciona correctamente")
    const optica = within(atencion).getByRole("region", { name: "Requiere tu atención: La óptica" })
    expect(within(optica).getByRole("button", { name: "6 módulos sin uso en 30 días" })).toBeInTheDocument()
    expect(atencion.textContent).toMatch(/Sistema y Soporte: todo en orden/)
  })
})

describe("Inicio del superadmin: íconos en las ventanas", () => {
  it("los componentes y los módulos llevan su ícono, no sus iniciales", async () => {
    mock.modo = "lento"
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await within(atencion).findByRole("region", { name: "Requiere tu atención: Sistema" })
    fireEvent.click(within(atencion).getByRole("button", { name: /componente/ }))
    const v = await screen.findByRole("dialog")
    expect(v.querySelector("svg.lucide-database")).not.toBeNull() // Datos
    expect(within(v).queryByText("D")).toBeNull()
    fireEvent.click(within(v).getAllByRole("button", { name: "Cerrar" }).at(-1))
    fireEvent.click(within(atencion).getByRole("button", { name: /módulos sin uso/ }))
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

  it("un módulo sin uso ofrece ayuda: abre la ventana con el mensaje propuesto, la vista previa y «Enviar a la óptica»; uno en uso no", async () => {
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    const v = await screen.findByRole("dialog", { name: "Ventas" })
    fireEvent.click(within(v).getByRole("button", { name: "Ofrecer ayuda" }))
    const o = await screen.findByRole("dialog", { name: "Ofrecer ayuda con Ventas" })
    expect(within(o).getByLabelText("Mensaje para el administrador")).toHaveValue("Vimos que en los últimos 30 días no usaron Ventas. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí.")
    const vista = within(o).getByRole("region", { name: "Vista previa" })
    expect(vista.textContent).toMatch(/El soporte te ofrece ayuda con Ventas/)
    for (const t of ["Ver la guía de Ventas", "Responder", "No usamos este módulo"]) expect(vista.textContent).toContain(t)
    expect(within(o).getByRole("button", { name: "Enviar a la óptica" })).toBeEnabled()
    expect(o.textContent).not.toMatch(/https?:|localhost|vercel/i) // la guía no va como dirección escrita
    // un módulo en uso no ofrece ayuda
    fireEvent.click(within(o).getAllByRole("button", { name: "Cancelar" })[0])
    fireEvent.click(within(lista).getByRole("button", { name: /^Citas médicas:/ }))
    const c = await screen.findByRole("dialog", { name: "Citas médicas" })
    expect(within(c).queryByRole("button", { name: "Ofrecer ayuda" })).toBeNull()
  })

  it("enviar la ayuda crea la consulta de Soporte, avisa con su número y deja la actividad", async () => {
    const onAviso = vi.fn(); const onAuditoria = vi.fn()
    montar({ datos: datos({ citas: ins("2026-10-10") }), onAviso, onAuditoria })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Ventas" })).getByRole("button", { name: "Ofrecer ayuda" }))
    const o = await screen.findByRole("dialog", { name: "Ofrecer ayuda con Ventas" })
    fireEvent.change(within(o).getByLabelText("Mensaje para el administrador"), { target: { value: "Hola, ¿te ayudamos con Ventas?" } })
    fireEvent.click(within(o).getByRole("button", { name: "Enviar a la óptica" }))
    await waitFor(() => expect(onAviso).toHaveBeenCalled())
    expect(mock.llamadas).toEqual([{ nombre: "ofrecer_ayuda", args: { p_optica: "o1", p_modulo: "ventas", p_mensaje: "Hola, ¿te ayudamos con Ventas?" } }])
    expect(onAviso.mock.calls[0][0]).toMatch(/Ayuda ofrecida con Ventas: SOP-0062/)
    expect(onAuditoria).toHaveBeenCalledWith("ofrecer_ayuda", expect.objectContaining({ opticaId: "o1", detalle: "Ventas (SOP-0062)" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ofrecer ayuda con Ventas" })).toBeNull())
  })

  it("si el servidor no la deja pasar (por ejemplo, ya se ofreció), lo dice en la misma ventana", async () => {
    mock.falloAyuda = "Ya se ofreció ayuda con este módulo el 10/10/2026. Podrás volver a ofrecerla el 09/11/2026."
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Ventas" })).getByRole("button", { name: "Ofrecer ayuda" }))
    const o = await screen.findByRole("dialog", { name: "Ofrecer ayuda con Ventas" })
    fireEvent.click(within(o).getByRole("button", { name: "Enviar a la óptica" }))
    expect(await within(o).findByRole("alert")).toHaveTextContent(/Ya se ofreció ayuda con este módulo el 10\/10\/2026/)
  })

  it("con ayuda ya ofrecida (menos de 30 días) no vuelve el botón: dice cuándo se ofreció y cuándo se podrá volver", async () => {
    mock.ofrecidas = [{ modulo: "ventas", ofrecida_en: "2026-10-10T15:00:00Z", consulta: { numero: 61, estado: "respondida" } }]
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    await waitFor(() => expect(screen.getByRole("region", { name: "Requiere tu atención" }).textContent).toMatch(/Ayuda ofrecida|módulos sin uso/))
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    const v = await screen.findByRole("dialog", { name: "Ventas" })
    const ayuda = await within(v).findByRole("region", { name: "Ayuda" })
    expect(ayuda.textContent).toMatch(/Ayuda ofrecida el 10 oct/)
    expect(ayuda.textContent).toMatch(/SOP-0061/)
    expect(ayuda.textContent).toMatch(/podrás volver a ofrecerla el 9 nov/)
    expect(within(v).queryByRole("button", { name: "Ofrecer ayuda" })).toBeNull()
  })

  it("pasados 30 días el botón vuelve", async () => {
    mock.ofrecidas = [{ modulo: "ventas", ofrecida_en: "2026-09-10T15:00:00Z", consulta: { numero: 50, estado: "resuelta" } }]
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    const v = await screen.findByRole("dialog", { name: "Ventas" })
    expect(await within(v).findByText(/Ayuda ofrecida el 10 sep/)).toBeInTheDocument()
    expect(within(v).getByRole("button", { name: "Ofrecer ayuda" })).toBeInTheDocument()
  })

  it("en «Requiere tu atención», un módulo con ayuda ofrecida lo dice y lleva a Soporte en vez de ofrecerla otra vez", async () => {
    mock.ofrecidas = [{ modulo: "ventas", ofrecida_en: "2026-10-10T15:00:00Z", consulta: { numero: 61, estado: "respondida" } }]
    const onAbrir = vi.fn()
    montar({ datos: datos({ citas: ins("2026-10-10") }), onAbrir })
    const atencion = await screen.findByRole("region", { name: "Requiere tu atención" })
    await screen.findByText("Todo funciona correctamente")
    await waitFor(() => expect(within(atencion).getByRole("region", { name: "Requiere tu atención: La óptica" })).toBeInTheDocument())
    fireEvent.click(within(atencion).getByRole("button", { name: /módulos sin uso/ }))
    const v = await screen.findByRole("dialog")
    await waitFor(() => expect(within(v).getByText(/Ayuda ofrecida el 10 oct/)).toBeInTheDocument())
    expect(within(v).getAllByRole("button", { name: "Ofrecer ayuda" })).toHaveLength(5) // los otros cinco módulos sin uso; Ventas ya tiene ayuda ofrecida
    fireEvent.click(within(v).getByRole("button", { name: "Ver en Soporte" }))
    expect(onAbrir).toHaveBeenCalledWith("soporte", expect.objectContaining({ tab: "consultas", estado: "todas" }))
  })

  it("«No usamos este módulo»: se ve como decisión de la óptica, no cuenta como sin uso y sale de «Requiere tu atención»", async () => {
    mock.noUsan = [{ modulo: "ventas", marcado_en: "2026-10-12T15:00:00Z", marcado_nombre: "Andrés Mora" }]
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    const fila = await within(lista).findByRole("button", { name: /^Ventas: No lo usan por decisión de la óptica/ })
    expect(fila.textContent).toMatch(/no lo usan por decisión de la óptica/)
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    await waitFor(() => expect(within(atencion).getByRole("button", { name: /5 módulos sin uso en 30 días/ })).toBeInTheDocument()) // eran 6: Ventas ya no cuenta
    expect(atencion.textContent).not.toMatch(/Ventas/)
    fireEvent.click(fila)
    const v = await screen.findByRole("dialog", { name: "Ventas" })
    expect((await within(v).findByRole("region", { name: "Ayuda" })).textContent).toMatch(/La óptica indicó que no usa este módulo el 12 oct/)
    expect(within(v).queryByRole("button", { name: "Ofrecer ayuda" })).toBeNull()
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

describe("Ofrecer ayuda: límite del mensaje y vista previa", () => {
  const abrirVentana = async () => {
    montar({ datos: datos({ citas: ins("2026-10-10") }) })
    const lista = await screen.findByRole("list", { name: "Módulos" })
    fireEvent.click(within(lista).getByRole("button", { name: /^Ventas:/ }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Ventas" })).getByRole("button", { name: "Ofrecer ayuda" }))
    return await screen.findByRole("dialog", { name: "Ofrecer ayuda con Ventas" })
  }

  it("el contador «N de 2000» solo aparece desde 1800 caracteres y el cuadro no pasa de 2000", async () => {
    const o = await abrirVentana()
    const campo = within(o).getByLabelText("Mensaje para el administrador")
    expect(campo).toHaveAttribute("maxlength", "2000")
    expect(within(o).queryByText(/de 2000/)).toBeNull()
    fireEvent.change(campo, { target: { value: "a".repeat(1799) } })
    expect(within(o).queryByText(/de 2000/)).toBeNull()
    fireEvent.change(campo, { target: { value: "a".repeat(1800) } })
    expect(within(o).getByText("1800 de 2000")).toBeInTheDocument()
  })

  it("la vista previa se ve como muestra: etiqueta, borde punteado, botones atenuados que no se pulsan", async () => {
    const o = await abrirVentana()
    const vista = within(o).getByRole("region", { name: "Vista previa" })
    expect(vista.className).toMatch(/border-dashed/)
    expect(within(vista).getByText("Así lo verá el administrador")).toBeInTheDocument()
    expect(within(vista).queryAllByRole("button")).toHaveLength(0)
    const guia = within(vista).getByText(/Ver la guía de Ventas/)
    expect(guia).toHaveAttribute("aria-disabled", "true")
    expect(guia).toHaveAttribute("title", "El administrador podrá usar este botón")
    expect(guia.className).toMatch(/opacity-50/)
    expect(vista.textContent).toMatch(/el administrador podrá usarlos/)
  })
})
