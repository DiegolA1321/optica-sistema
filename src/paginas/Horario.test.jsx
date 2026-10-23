import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

// La base es de mentira: devuelve las filas que cada prueba pone y anota las llamadas a las funciones del servidor y al almacenamiento.
const base = vi.hoisted(() => ({ tablas: {}, rpc: null, subir: null, quitar: null, firmar: null }))
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (tabla) => { const q = { select: () => q, eq: () => q, order: () => q, then: (res, rej) => Promise.resolve({ data: base.tablas[tabla] || [], error: null }).then(res, rej) }; return q },
    rpc: (...a) => base.rpc(...a),
    storage: { from: () => ({ upload: (...a) => base.subir(...a), remove: (...a) => base.quitar(...a), createSignedUrl: (...a) => base.firmar(...a) }) },
  },
}))

import Horario from "./Horario"
import { hoyISO } from "../utilidades/disponibilidad"

const turno = (inicio, fin, activo = true) => ({ activo, inicio, fin })
const dia = () => ({ manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00") })
const cerrado = () => ({ manana: turno("09:00", "13:00", false), tarde: turno("14:00", "18:00", false) })
const disponibilidad = () => ({
  horarioSemanal: { lunes: dia(), martes: dia(), miercoles: dia(), jueves: dia(), viernes: dia(), sabado: { manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00", false) }, domingo: cerrado() },
  excepciones: {}, duracionCita: 60,
})
const admin = { id: "u-admin", rol: "admin", nombre: "Administrador Demo", opticaId: "o1" }
const paula = { id: "u-paula", rol: "asistente", nombre: "Paula Andrade", opticaId: "o1", permisosNivel: { horario: ["ver"] } }
const equipo = [
  { id: "u-admin", nombre: "Administrador Demo", rol: "admin", esOptometra: true, activo: true },
  { id: "u-paula", nombre: "Paula Andrade", rol: "asistente", esOptometra: true, activo: true },
  { id: "u-rosa", nombre: "Rosa Bravo", rol: "asistente", esOptometra: false, activo: true },
  { id: "u-vieja", nombre: "Ex Empleada", rol: "asistente", esOptometra: false, activo: false },
]
const props = (usuario, extra = {}) => ({ usuario, disponibilidad: disponibilidad(), setDisponibilidad: vi.fn(() => Promise.resolve({ error: null })), citas: [], setCitas: vi.fn(), equipo, onCambioAgenda: vi.fn(), onReagendarCita: vi.fn(), ...extra })
const ausencia = (extra = {}) => ({ id: "a1", usuario_id: "u-paula", usuario_nombre: "Paula Andrade", tipo: "cita_medica", fecha_desde: "2099-01-05", fecha_hasta: "2099-01-05", franja: "todo", motivo: null, documento_ruta: null, documento_nombre: null, estado: "pendiente", motivo_rechazo: null, creada_en: "2026-10-20T10:00:00Z", ...extra })
const mañana = (hoy = hoyISO()) => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

beforeEach(() => {
  window.history.replaceState({}, "", "/")
  base.tablas = { horarios_usuario: [], ausencias_personal: [], perfil_roles: [], roles: [] }
  base.rpc = vi.fn(async () => ({ data: null, error: null }))
  base.subir = vi.fn(async () => ({ error: null }))
  base.quitar = vi.fn(async () => ({ error: null }))
  base.firmar = vi.fn(async () => ({ data: { signedUrl: "https://firmada.test/doc" }, error: null }))
})

describe("Mi horario (todos los roles)", () => {
  it("sin tabs ni edición: su horario de solo lectura, que parte del de la óptica, y la nota de que lo asigna la administración", async () => {
    render(<Horario {...props(paula)} />)
    expect(screen.getByRole("heading", { level: 1, name: "Mi horario" })).toBeInTheDocument()
    expect(screen.queryByRole("tab")).toBeNull()
    expect(await screen.findByText("Tu horario de trabajo")).toBeInTheDocument()
    expect(screen.getByText("Lo asigna la administración. Si necesitas un cambio, escríbele desde Soporte.")).toBeInTheDocument()
    const semana = within(screen.getByRole("list", { name: "Semana" }))
    expect(semana.getAllByRole("listitem")).toHaveLength(7)
    const lunes = semana.getByText("Lunes").closest("li")
    expect(lunes).toHaveTextContent("Mañana: 9:00 AM a 1:00 PM")
    expect(lunes).toHaveTextContent("Tarde: 2:00 PM a 6:00 PM")
    expect(semana.getByText("Miércoles").closest("li")).toHaveTextContent("Tarde: 2:00 PM a 6:00 PM")
    expect(semana.getByText("Sábado").closest("li")).toHaveTextContent("Tarde: no trabaja")
    expect(semana.getByText("Domingo").closest("li")).toHaveTextContent("Mañana: no trabaja")
    expect(document.querySelectorAll("input[type=time]")).toHaveLength(0) // no se edita
  })

  it("muestra el horario propio que le asignó la administración (medio tiempo)", async () => {
    base.tablas.horarios_usuario = [{ usuario_id: "u-paula", usa_horario_optica: false, horario_semanal: { lunes: { manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00", false) } } }]
    render(<Horario {...props(paula)} />)
    const lunes = (await screen.findByText("Lunes")).closest("li")
    await waitFor(() => expect(screen.getByText("Martes").closest("li")).toHaveTextContent("Mañana: no trabaja"))
    expect(lunes).toHaveTextContent("Mañana: 9:00 AM a 1:00 PM")
    expect(screen.getByText("Martes").closest("li")).toHaveTextContent("Tarde: no trabaja")
  })

  it("quien ve el horario de la óptica lo tiene como una segunda pestaña, de referencia", async () => {
    render(<Horario {...props({ ...paula, permisosNivel: { horario: ["ver"], horario_optica: ["ver"] } })} />)
    expect(await screen.findByRole("tab", { name: "Mi horario" })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(screen.getByRole("tab", { name: "Horario de la óptica" }))
    expect(screen.getByText(/Solo el administrador, o quien tenga delegado el horario de la óptica, puede editarlo/)).toBeInTheDocument()
  })

  it("sus ausencias con su estado; las canceladas no se ven, y una pendiente se puede retirar", async () => {
    base.tablas.ausencias_personal = [
      ausencia({ id: "a1", fecha_desde: "2099-01-05", fecha_hasta: "2099-01-05", estado: "pendiente" }),
      ausencia({ id: "a2", fecha_desde: "2098-09-02", fecha_hasta: "2098-09-02", franja: "tarde", tipo: "otro", motivo: "Capacitación", estado: "aprobada" }),
      ausencia({ id: "a3", fecha_desde: "2098-08-02", fecha_hasta: "2098-08-02", estado: "cancelada" }),
      ausencia({ id: "a4", usuario_id: "u-rosa", usuario_nombre: "Rosa Bravo" }),
      ausencia({ id: "a5", fecha_desde: "2098-07-02", fecha_hasta: "2098-07-02", estado: "rechazada", motivo_rechazo: "Ese día falta personal" }),
    ]
    const p = props(paula)
    render(<Horario {...p} />)
    const lista = within(await screen.findByRole("list", { name: "Ausencias" }))
    expect(lista.getAllByRole("listitem")).toHaveLength(3)
    expect(lista.getByText("5 ene · todo el día")).toBeInTheDocument()
    expect(lista.getByText("Por aprobar")).toBeInTheDocument()
    expect(lista.getByText("Aprobada")).toBeInTheDocument()
    expect(lista.getByText("2 sept · tarde")).toBeInTheDocument()
    expect(lista.getByText("Otro · Capacitación")).toBeInTheDocument()
    expect(lista.getByText("Rechazada")).toBeInTheDocument()
    expect(lista.getByText("Motivo: Ese día falta personal")).toBeInTheDocument()
    fireEvent.click(lista.getByRole("button", { name: /Retirar la solicitud del 5 ene/ }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("retirar_ausencia", { p_id: "a1" }))
    await waitFor(() => expect(p.onCambioAgenda).toHaveBeenCalled())
  })

  it("«Esta semana» solo la ve quien atiende pacientes: citas agendadas y horas libres", async () => {
    const { unmount } = render(<Horario {...props(paula)} />)
    expect(await screen.findByRole("region", { name: "Esta semana" })).toHaveTextContent(/0 citas agendadas · \d+(\.\d)? horas libres/)
    unmount()
    render(<Horario {...props({ ...paula, id: "u-rosa", nombre: "Rosa Bravo" })} />)
    await screen.findByText("Tu horario de trabajo")
    expect(screen.queryByRole("region", { name: "Esta semana" })).toBeNull()
  })
})

describe("Solicitar ausencia", () => {
  const abrir = async (p = props(paula)) => {
    render(<Horario {...p} />)
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar ausencia" }))
    return screen.getByRole("dialog", { name: "Solicitar ausencia" })
  }

  it("tiene el tipo, el día o los días, todo el día / mañana / tarde, el motivo y el documento (opcionales) y avisa que la decide la administración", async () => {
    const v = await abrir()
    expect(v).toHaveTextContent("La aprueba o rechaza la administración")
    expect([...within(v).getByLabelText("Tipo").options].map((o) => o.textContent)).toEqual(["Cita médica", "Vacaciones", "Permiso personal", "Calamidad", "Otro"])
    for (const o of ["Todo el día", "Mañana", "Tarde", "Varios días"]) expect(within(v).getByRole("button", { name: o })).toBeInTheDocument()
    expect(within(v).getByRole("button", { name: "Todo el día" })).toHaveAttribute("aria-pressed", "true")
    expect(within(v).getByText(/Motivo/)).toBeInTheDocument()
    expect(v).toHaveTextContent("PDF o foto, hasta 5 MB. Solo lo ve la administración.")
    expect(within(v).queryByLabelText("Último día de la ausencia")).toBeNull()
    fireEvent.click(within(v).getByRole("button", { name: "Varios días" }))
    expect(within(v).getByLabelText(/Último día de la ausencia/)).toBeInTheDocument()
  })

  it("avisa si tiene citas en ese tiempo", async () => {
    const hoy = hoyISO()
    const cita = (id, hora) => ({ id, fecha: hoy, hora, estado: "Pendiente", asignadoA: "u-paula", paciente: "P" + id })
    const v = await abrir(props(paula, { citas: [cita("1", "11:00 PM"), cita("2", "11:30 PM")] }))
    expect(v).toHaveTextContent("Tienes 2 citas ese día: la administración las verá para reagendarlas si aprueba.")
    fireEvent.click(within(v).getByRole("button", { name: "Mañana" }))
    expect(v).not.toHaveTextContent("Tienes 2 citas") // las de la noche no están en la mañana
  })

  it("envía la solicitud con sus datos y el documento en su carpeta privada, y lo confirma", async () => {
    const p = props(paula)
    const v = await abrir(p)
    fireEvent.change(within(v).getByLabelText("Tipo"), { target: { value: "vacaciones" } })
    fireEvent.change(within(v).getByPlaceholderText("Ej. Control médico programado"), { target: { value: "Viaje" } })
    const pdf = new File(["x".repeat(2048)], "certificado.pdf", { type: "application/pdf" })
    fireEvent.change(within(v).getByLabelText("Elegir el documento de respaldo"), { target: { files: [pdf] } })
    expect(within(v).getByText("certificado.pdf")).toBeInTheDocument()
    fireEvent.click(within(v).getByRole("button", { name: "Enviar solicitud" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("solicitar_ausencia", expect.objectContaining({ p_tipo: "vacaciones", p_desde: hoyISO(), p_hasta: hoyISO(), p_franja: "todo", p_motivo: "Viaje", p_doc_nombre: "certificado.pdf" })))
    const [ruta] = base.subir.mock.calls[0]
    expect(ruta).toMatch(/^o1\/u-paula\/.+certificado\.pdf$/)
    expect(base.rpc.mock.calls.find((c) => c[0] === "solicitar_ausencia")[1].p_doc_ruta).toBe(ruta)
    expect(await screen.findByText(/Solicitud enviada/)).toBeInTheDocument()
    await waitFor(() => expect(p.onCambioAgenda).toHaveBeenCalled())
    expect(screen.queryByRole("dialog", { name: "Solicitar ausencia" })).toBeNull()
  })

  it("«Quitar» saca el documento y un archivo que no sirve se rechaza sin subir nada", async () => {
    const v = await abrir()
    const entrada = within(v).getByLabelText("Elegir el documento de respaldo")
    fireEvent.change(entrada, { target: { files: [new File(["x"], "nota.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })] } })
    expect(within(v).getByRole("alert")).toHaveTextContent("PDF o una foto")
    fireEvent.change(entrada, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } })
    expect(within(v).queryByRole("alert")).toBeNull()
    fireEvent.click(within(v).getByRole("button", { name: "Quitar" }))
    expect(within(v).queryByText("foto.jpg")).toBeNull()
    fireEvent.click(within(v).getByRole("button", { name: "Enviar solicitud" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("solicitar_ausencia", expect.objectContaining({ p_doc_ruta: null, p_doc_nombre: null })))
    expect(base.subir).not.toHaveBeenCalled()
  })

  it("si la base la rechaza, dice por qué y quita el documento que ya había subido", async () => {
    base.rpc = vi.fn(async () => ({ data: null, error: { message: "Ya tienes una ausencia pendiente o aprobada en esos días." } }))
    const v = await abrir()
    fireEvent.change(within(v).getByLabelText("Elegir el documento de respaldo"), { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar solicitud" }))
    expect(await within(v).findByRole("alert")).toHaveTextContent("Ya tienes una ausencia pendiente o aprobada en esos días.")
    expect(base.quitar).toHaveBeenCalledWith([base.subir.mock.calls[0][0]])
    expect(screen.getByRole("dialog", { name: "Solicitar ausencia" })).toBeInTheDocument()
  })
})

describe("Horario del administrador", () => {
  it("«Horario», con sus tres pestañas, y el botón de las ausencias por aprobar", async () => {
    base.tablas.ausencias_personal = [ausencia(), ausencia({ id: "a2", usuario_id: "u-rosa", usuario_nombre: "Rosa Bravo", estado: "aprobada" })]
    render(<Horario {...props(admin)} />)
    expect(screen.getByRole("heading", { level: 1, name: "Horario" })).toBeInTheDocument()
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(tabs[0]).toBe("Horario de la óptica")
    expect(tabs[1]).toMatch(/^Horarios del personal3$/) // las 3 personas activas
    await waitFor(() => expect(screen.getByRole("tab", { name: /Ausencias/ })).toHaveTextContent("1"))
    expect(screen.getByRole("button", { name: "Ausencias · 1 por aprobar" })).toBeInTheDocument()
    expect(screen.getAllByText(/Excepciones puntuales/).length).toBeGreaterThan(0) // abre en el horario de la óptica, que sigue editándose ahí
    fireEvent.click(screen.getByRole("button", { name: "Ausencias · 1 por aprobar" }))
    expect(screen.getByRole("tab", { name: /Ausencias/ })).toHaveAttribute("aria-selected", "true")
  })

  describe("Horarios del personal", () => {
    const abrir = async (p = props(admin)) => {
      window.history.replaceState({}, "", "/?tab=equipo")
      render(<Horario {...p} />)
      return screen.findByRole("region", { name: /^Horario de /i })
    }

    it("la lista de las personas con su rol y su jornada, y la semana de la elegida con mañana y tarde por día", async () => {
      base.tablas.horarios_usuario = [{ usuario_id: "u-paula", usa_horario_optica: false, horario_semanal: { lunes: { manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00", false) } } }]
      base.tablas.perfil_roles = [{ perfil_id: "u-paula", rol_id: "r1" }, { perfil_id: "u-rosa", rol_id: "r2" }]
      base.tablas.roles = [{ id: "r1", nombre: "Optómetra" }, { id: "r2", nombre: "Recepción" }]
      await abrir()
      const nav = within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" }))
      expect(nav.getAllByRole("button")).toHaveLength(3) // sin la persona desactivada
      await waitFor(() => expect(nav.getByText(/Paula Andrade/).closest("button")).toHaveTextContent("Optómetra · Medio tiempo · 4 h/sem"))
      expect(nav.getByText("Administrador Demo").closest("button")).toHaveTextContent("Administrador · Horario de la óptica")
      expect(nav.getByText("Rosa Bravo").closest("button")).toHaveTextContent("Recepción · Horario de la óptica")
      expect(screen.getByRole("button", { name: "Usar el horario de la óptica" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Copiar a…" })).toBeInTheDocument()
      const semana = within(screen.getByRole("list", { name: "Semana" }))
      expect(semana.getAllByRole("listitem")).toHaveLength(7)
      expect(semana.getByText("Domingo").closest("li")).toHaveTextContent("Mañana: no trabajaTarde: no trabaja")
      expect(screen.getByText("Debe estar dentro del horario de la óptica. Las citas ya agendadas fuera del nuevo horario se avisan antes de guardar.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Guardar horario" })).toBeDisabled()
    })

    it("elegir a otra persona muestra su semana; un turno se activa o se apaga (medio tiempo)", async () => {
      await abrir()
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      expect(await screen.findByRole("region", { name: "Horario de Rosa Bravo" })).toBeInTheDocument()
      expect(screen.getByRole("switch", { name: "Lunes: tarde" })).toHaveAttribute("aria-checked", "true")
      fireEvent.click(screen.getByRole("switch", { name: "Lunes: tarde" }))
      expect(screen.getByRole("switch", { name: "Lunes: tarde" })).toHaveAttribute("aria-checked", "false")
      expect(within(screen.getByText("Lunes").closest("li")).getByText("Tarde: no trabaja")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Guardar horario" })).toBeEnabled()
    })

    it("guarda con la función de la base, confirma y le avisa a la agenda; «Usar el horario de la óptica» devuelve a quien lo tenía propio", async () => {
      const p = props(admin)
      await abrir(p)
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await screen.findByRole("region", { name: "Horario de Rosa Bravo" })
      fireEvent.click(screen.getByRole("switch", { name: "Lunes: tarde" }))
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_horario_persona", expect.objectContaining({ p_usuario: "u-rosa", p_usa_optica: false })))
      const horario = base.rpc.mock.calls.find((c) => c[0] === "guardar_horario_persona")[1].p_horario
      expect(horario.lunes.tarde.activo).toBe(false)
      expect(horario.lunes.manana).toEqual(turno("09:00", "13:00"))
      expect(await screen.findByText("Horario de Rosa Bravo guardado.")).toBeInTheDocument()
      await waitFor(() => expect(p.onCambioAgenda).toHaveBeenCalled())
    })

    it("«Usar el horario de la óptica» se guarda como tal (sin horario propio)", async () => {
      base.tablas.horarios_usuario = [{ usuario_id: "u-rosa", usa_horario_optica: false, horario_semanal: { lunes: { manana: turno("09:00", "13:00"), tarde: turno("14:00", "18:00", false) } } }]
      await abrir()
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await waitFor(() => expect(screen.getByRole("switch", { name: "Lunes: tarde" })).toHaveAttribute("aria-checked", "false"))
      fireEvent.click(screen.getByRole("button", { name: "Usar el horario de la óptica" }))
      expect(screen.getByRole("switch", { name: "Lunes: tarde" })).toHaveAttribute("aria-checked", "true")
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_horario_persona", { p_usuario: "u-rosa", p_usa_optica: true, p_horario: null }))
    })

    it("un turno fuera del horario de la óptica no se guarda y dice cuál es", async () => {
      await abrir()
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await screen.findByRole("region", { name: "Horario de Rosa Bravo" })
      fireEvent.change(screen.getByLabelText("Lunes, mañana: desde"), { target: { value: "08:00" } }) // la óptica abre a las 9
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      expect(await screen.findByRole("alert")).toHaveTextContent("Debe estar dentro del horario de la óptica: lunes (mañana) queda fuera.")
      expect(base.rpc).not.toHaveBeenCalledWith("guardar_horario_persona", expect.anything())
    })

    it("si quedan citas agendadas fuera del nuevo horario, las lista y deja guardar de todas formas o cancelar", async () => {
      const lunes = "2099-01-05"
      const citas = [{ id: "c1", paciente: "Ana Pérez", fecha: lunes, hora: "03:00 PM", estado: "Pendiente", asignadoA: "u-rosa" }]
      await abrir(props(admin, { citas }))
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await screen.findByRole("region", { name: "Horario de Rosa Bravo" })
      fireEvent.click(screen.getByRole("switch", { name: "Lunes: tarde" }))
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      const aviso = await screen.findByRole("dialog", { name: "Hay citas fuera de este horario" })
      expect(aviso).toHaveTextContent("Ana Pérez")
      expect(base.rpc).not.toHaveBeenCalledWith("guardar_horario_persona", expect.anything())
      fireEvent.click(within(aviso).getByRole("button", { name: "Cancelar" }))
      expect(base.rpc).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      fireEvent.click(within(await screen.findByRole("dialog", { name: "Hay citas fuera de este horario" })).getByRole("button", { name: "Guardar de todas formas" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_horario_persona", expect.objectContaining({ p_usuario: "u-rosa" })))
    })

    it("«Copiar a…» pasa el horario a las personas que se elijan, cada una por la función de la base", async () => {
      await abrir()
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await screen.findByRole("region", { name: "Horario de Rosa Bravo" })
      fireEvent.click(screen.getByRole("switch", { name: "Viernes: tarde" })) // un horario distinto del de la óptica
      fireEvent.click(screen.getByRole("button", { name: "Copiar a…" }))
      const v = screen.getByRole("dialog", { name: "Copiar el horario a…" })
      const personas = within(within(v).getByRole("list", { name: "Personas" }))
      expect(personas.getAllByRole("listitem")).toHaveLength(2) // sin ella misma
      fireEvent.click(personas.getByRole("checkbox", { name: /Paula Andrade/ }))
      fireEvent.click(within(v).getByRole("button", { name: "Copiar" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_horario_persona", expect.objectContaining({ p_usuario: "u-paula", p_usa_optica: false })))
      expect(await screen.findByText("Horario de Rosa Bravo copiado a 1 persona.")).toBeInTheDocument()
    })

    it("un error de la base se dice con su mensaje y no se da por guardado", async () => {
      base.rpc = vi.fn(async () => ({ data: null, error: { message: "El horario debe estar dentro del de la óptica. lunes, mañana: queda fuera del horario de la óptica." } }))
      await abrir()
      fireEvent.click(within(screen.getByRole("navigation", { name: "Personal que atiende o trabaja" })).getByText("Rosa Bravo"))
      await screen.findByRole("region", { name: "Horario de Rosa Bravo" })
      fireEvent.click(screen.getByRole("switch", { name: "Lunes: tarde" }))
      fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }))
      expect(await screen.findByRole("alert")).toHaveTextContent("El horario debe estar dentro del de la óptica.")
      expect(screen.queryByText("Horario de Rosa Bravo guardado.")).toBeNull()
    })
  })

  describe("Ausencias", () => {
    const abrir = async (p = props(admin)) => {
      window.history.replaceState({}, "", "/?tab=ausencias")
      render(<Horario {...p} />)
      return screen.findByRole("list", { name: "Ausencias" })
    }
    const hoy = hoyISO()

    it("las solicitudes con persona, cuándo, motivo, documento y estado; las pendientes primero", async () => {
      base.tablas.ausencias_personal = [
        ausencia({ id: "v", usuario_id: "u-rosa", usuario_nombre: "Rosa Bravo", fecha_desde: "2098-10-15", fecha_hasta: "2098-10-19", tipo: "vacaciones", estado: "aprobada" }),
        ausencia({ id: "p", documento_ruta: "o1/u-paula/x-certificado.pdf", documento_nombre: "certificado.pdf", fecha_desde: "2099-10-30", fecha_hasta: "2099-10-30" }),
        ausencia({ id: "c", estado: "cancelada" }),
      ]
      const lista = within(await abrir())
      const filas = lista.getAllByRole("listitem")
      expect(filas).toHaveLength(2)
      expect(filas[0]).toHaveTextContent("Paula Andrade")
      expect(filas[0]).toHaveTextContent("30 oct · todo el día")
      expect(filas[0]).toHaveTextContent("Cita médica")
      expect(filas[0]).toHaveTextContent("Ver documento (certificado.pdf)")
      expect(filas[0]).toHaveTextContent("Por aprobar")
      expect(within(filas[0]).getByRole("button", { name: /Aprobar la ausencia de Paula/ })).toBeInTheDocument()
      expect(within(filas[0]).getByRole("button", { name: /Rechazar la ausencia de Paula/ })).toBeInTheDocument()
      expect(filas[1]).toHaveTextContent("15 al 19 oct")
      expect(filas[1]).toHaveTextContent("Aprobada")
      expect(screen.getByText("Al aprobar una ausencia")).toBeInTheDocument()
    })

    it("«Ver documento» pide una dirección firmada del almacenamiento privado y la abre", async () => {
      base.tablas.ausencias_personal = [ausencia({ documento_ruta: "o1/u-paula/x-certificado.pdf", documento_nombre: "certificado.pdf" })]
      const abierta = { location: { href: "" }, close: vi.fn() }
      vi.spyOn(window, "open").mockReturnValue(abierta)
      await abrir()
      fireEvent.click(screen.getByRole("button", { name: /Ver documento/ }))
      await waitFor(() => expect(base.firmar).toHaveBeenCalledWith("o1/u-paula/x-certificado.pdf", 300))
      await waitFor(() => expect(abierta.location.href).toBe("https://firmada.test/doc"))
      window.open.mockRestore()
    })

    it("aprobar sin citas en ese tiempo aprueba y lo confirma", async () => {
      const p = props(admin)
      base.tablas.ausencias_personal = [ausencia()]
      await abrir(p)
      fireEvent.click(screen.getByRole("button", { name: /Aprobar la ausencia de Paula/ }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("resolver_ausencia", { p_id: "a1", p_aprobar: true, p_motivo: null }))
      expect(await screen.findByText(/Ausencia aprobada. Ese tiempo queda bloqueado en la agenda y en la web./)).toBeInTheDocument()
      await waitFor(() => expect(p.onCambioAgenda).toHaveBeenCalled())
    })

    it("aprobar con citas en ese tiempo las lista para reasignarlas o reagendarlas antes de aprobar", async () => {
      const dia = mañana(hoy)
      base.tablas.ausencias_personal = [ausencia({ fecha_desde: dia, fecha_hasta: dia })]
      const citas = [{ id: "c1", paciente: "Ana Pérez", fecha: dia, hora: "10:00 AM", estado: "Pendiente", asignadoA: "u-paula" }, { id: "c2", paciente: "Luis Mora", fecha: dia, hora: "11:00 AM", estado: "Pendiente", asignadoA: "u-paula" }]
      const p = props(admin, { citas })
      await abrir(p)
      fireEvent.click(screen.getByRole("button", { name: /Aprobar la ausencia de Paula/ }))
      const v = await screen.findByRole("dialog", { name: /Paula Andrade tiene 2 citas en ese tiempo/ })
      expect(base.rpc).not.toHaveBeenCalledWith("resolver_ausencia", expect.anything()) // todavía no
      expect(within(v).getAllByRole("listitem")).toHaveLength(2)
      // reasignar una a otro profesional (el administrador atiende)
      fireEvent.change(within(v).getByLabelText("Pasar la cita de Ana Pérez a"), { target: { value: "u-admin" } })
      fireEvent.click(within(v).getByRole("button", { name: "Reasignar la cita de Ana Pérez" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("reasignar_cita", { p_cita_id: "c1", p_nuevo: "u-admin" }))
      await waitFor(() => expect(within(v).getAllByRole("listitem")).toHaveLength(1))
      expect(p.setCitas).toHaveBeenCalled()
      // reagendar la otra abre Citas con esa cita
      fireEvent.click(within(v).getByRole("button", { name: "Reagendar la cita de Luis Mora" }))
      expect(p.onReagendarCita).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }))
      // aprobar igual: queda la que no se pasó
      fireEvent.click(within(v).getByRole("button", { name: "Aprobar igual" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("resolver_ausencia", { p_id: "a1", p_aprobar: true, p_motivo: null }))
    })

    it("rechazar pide el motivo y se lo manda a la persona", async () => {
      base.tablas.ausencias_personal = [ausencia()]
      await abrir()
      fireEvent.click(screen.getByRole("button", { name: /Rechazar la ausencia de Paula/ }))
      const v = await screen.findByRole("dialog", { name: /¿Rechazar la ausencia de Paula Andrade\?/ })
      fireEvent.click(within(v).getByRole("button", { name: "Rechazar" }))
      expect(within(v).getByRole("alert")).toHaveTextContent("Escribe el motivo del rechazo.")
      expect(base.rpc).not.toHaveBeenCalledWith("resolver_ausencia", expect.anything())
      fireEvent.change(within(v).getByRole("textbox"), { target: { value: "Ese día falta personal" } })
      fireEvent.click(within(v).getByRole("button", { name: "Rechazar" }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("resolver_ausencia", { p_id: "a1", p_aprobar: false, p_motivo: "Ese día falta personal" }))
      expect(await screen.findByText(/Ausencia rechazada. La persona recibe el aviso con tu motivo./)).toBeInTheDocument()
    })

    it("una ausencia aprobada que viene se puede retirar para devolver ese tiempo a la agenda", async () => {
      base.tablas.ausencias_personal = [ausencia({ estado: "aprobada", fecha_desde: "2099-01-05", fecha_hasta: "2099-01-05" })]
      await abrir()
      fireEvent.click(screen.getByRole("button", { name: /Retirar la ausencia aprobada de Paula/ }))
      await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("retirar_ausencia", { p_id: "a1" }))
    })

    it("sin solicitudes lo dice", async () => {
      window.history.replaceState({}, "", "/?tab=ausencias")
      render(<Horario {...props(admin)} />)
      expect(await screen.findByText("Todavía no hay solicitudes de ausencia")).toBeInTheDocument()
    })
  })
})

describe("El administrador en la vista de otro rol ve lo de ese rol", () => {
  it("«Mi horario», sin las pestañas del administrador", async () => {
    render(<Horario {...props({ ...admin, enVistaDeRol: true, permisosNivel: { horario: ["ver"] } })} />)
    expect(screen.getByRole("heading", { level: 1, name: "Mi horario" })).toBeInTheDocument()
    expect(screen.queryByRole("tab")).toBeNull()
    expect(await screen.findByText("Tu horario de trabajo")).toBeInTheDocument()
  })
})
