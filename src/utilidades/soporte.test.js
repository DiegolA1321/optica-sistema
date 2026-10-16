import { describe, it, expect } from "vitest"
import {
  MODULOS_SOPORTE, TIPOS_CONSULTA, tipoDeArchivo, esImagenAdjunto, URGENCIAS, ESTADOS_CONSULTA, codigoConsulta, problemaDeCaptura, nombreSeguro, contextoDeConsulta, navegadorLegible,
  ordenarBandeja, ordenarMisConsultas, filtrarBandeja, desdeDePeriodo, PERIODOS_SOPORTE, indicadoresSoporte, duracionLegible, avisosConLeido, tiempoEstimado, nombreModulo, mapConsulta,
} from "./soporte"

const c = (extra) => ({ id: Math.random().toString(36).slice(2), numero: 1, opticaId: "o1", autorNombre: "Ana", asunto: "Algo", modulo: "citas", urgencia: "normal", estado: "recibida", ultimoMensajeDe: "optica", creadaEn: "2026-10-10T10:00:00Z", ...extra })

describe("nombres y códigos", () => {
  it("el código lleva ceros: SOP-0007", () => {
    expect(codigoConsulta(7)).toBe("SOP-0007")
    expect(codigoConsulta(1234)).toBe("SOP-1234")
    expect(codigoConsulta(null)).toBe("SOP-0000")
  })
  it("los nueve módulos del pedido están, con sus nombres", () => {
    const nombres = MODULOS_SOPORTE.map((m) => m.nombre)
    for (const n of ["Citas", "Pacientes", "Ventas", "Inventario", "Reportes", "CRM", "Mi horario", "Usuarios y permisos", "Configuración"]) expect(nombres).toContain(n)
    expect(nombreModulo("no-existe")).toBe("Otro")
  })
  it("tipos, urgencias y estados son los del pedido", () => {
    expect(TIPOS_CONSULTA.map((t) => t.nombre)).toEqual(["Problema", "Pregunta", "Sugerencia"])
    expect(URGENCIAS.map((u) => u.nombre)).toEqual(["Normal", "Urgente"])
    expect(URGENCIAS[1].ayuda).toBe("Urgente: no puedo atender, vender o cobrar.")
    expect(ESTADOS_CONSULTA.map((e) => e.nombre)).toEqual(["Recibida", "En revisión", "Respondida", "Resuelta"])
  })
  it("lo urgente es el mismo día hábil, nunca un número de horas, y lo configurado manda", () => {
    expect(tiempoEstimado("urgente")).toBe("el mismo día hábil")
    expect(tiempoEstimado("normal")).toBe("en un máximo de 1 día hábil")
    expect(tiempoEstimado("urgente", { tiempo_urgente: "en 3 horas hábiles" })).toBe("en 3 horas hábiles")
    expect(tiempoEstimado("normal", { tiempo_urgente: "x" })).toBe("en un máximo de 1 día hábil")
  })
  it("promete un tiempo distinto a lo urgente", () => {
    expect(tiempoEstimado("urgente")).not.toBe(tiempoEstimado("normal"))
    expect(tiempoEstimado("lo-que-sea")).toBe(tiempoEstimado("normal"))
  })
})

describe("capturas", () => {
  it("acepta imágenes, PDF, Word y Excel de hasta 10 MB y rechaza el resto con un texto claro", () => {
    expect(problemaDeCaptura({ name: "a.png", type: "image/png", size: 1000 })).toBe("")
    expect(problemaDeCaptura({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBe("")
    expect(problemaDeCaptura({ name: "carta.docx", type: "", size: 1000 })).toBe("")
    expect(problemaDeCaptura({ name: "datos.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 1000 })).toBe("")
    expect(problemaDeCaptura({ name: "g.png", type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/más de 10 MB/)
    expect(problemaDeCaptura({ name: "g.pdf", type: "application/pdf", size: 6 * 1024 * 1024 })).toBe("")
    expect(problemaDeCaptura(null)).toMatch(/No se pudo/)
  })
  it("bloquea los archivos con macros y cualquier otro tipo", () => {
    expect(problemaDeCaptura({ name: "m.xlsm", type: "application/vnd.ms-excel.sheet.macroEnabled.12", size: 1000 })).toMatch(/macros/)
    expect(problemaDeCaptura({ name: "m.DOCM", type: "", size: 1000 })).toMatch(/macros/)
    expect(problemaDeCaptura({ name: "x.exe", type: "application/x-msdownload", size: 1000 })).toMatch(/no se acepta/)
    expect(problemaDeCaptura({ name: "x", type: "", size: 1000 })).toMatch(/no se acepta/)
    expect(problemaDeCaptura({ name: "falso.xlsx", type: "application/zip", size: 1000 })).toMatch(/no se acepta/)
  })
  it("el tipo con el que se sube sale de la extensión, y las imágenes se distinguen de los documentos", () => {
    expect(tipoDeArchivo({ name: "carta.docx", type: "" })).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(esImagenAdjunto({ nombre: "a.png", tipo: "image/png" })).toBe(true)
    expect(esImagenAdjunto({ nombre: "a.pdf", tipo: "application/pdf" })).toBe(false)
    expect(esImagenAdjunto({ nombre: "foto.JPG" })).toBe(true)
  })
  it("el nombre guardado no lleva tildes ni caracteres raros", () => {
    expect(nombreSeguro("Captura de pantalla (ñandú) 1.png")).toBe("Captura-de-pantalla-nandu-1.png")
    expect(nombreSeguro("")).toBe("captura")
  })
})

describe("contexto que agrega el sistema", () => {
  it("lleva quién, el rol, la pantalla y el navegador", () => {
    const ctx = contextoDeConsulta({ usuario: { nombre: "Ana Pérez", rol: "admin" }, pantalla: "Citas médicas", agente: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" })
    expect(ctx).toMatchObject({ quien: "Ana Pérez", rol: "Administrador", pantalla: "Citas médicas", navegador: "Chrome 141 · Windows" })
  })
  it("reconoce los navegadores comunes", () => {
    expect(navegadorLegible("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0")).toBe("Edge 141 · Windows")
    expect(navegadorLegible("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15")).toBe("Safari 17 · macOS")
    expect(navegadorLegible("")).toBe("No disponible")
  })
})

describe("orden de la bandeja del superadmin", () => {
  it("las urgentes primero, y entre ellas las que esperan al soporte antes que las que esperan a la óptica", () => {
    const lista = [
      c({ id: "normal", urgencia: "normal" }),
      c({ id: "urgente-respondida", urgencia: "urgente", ultimoMensajeDe: "soporte", estado: "respondida" }),
      c({ id: "urgente-espera", urgencia: "urgente" }),
      c({ id: "resuelta-urgente", urgencia: "urgente", estado: "resuelta" }),
    ]
    expect(ordenarBandeja(lista).map((x) => x.id)).toEqual(["urgente-espera", "urgente-respondida", "normal", "resuelta-urgente"])
  })
  it("a igual prioridad, la que lleva más esperando va primero", () => {
    const lista = [c({ id: "nueva", creadaEn: "2026-10-12T10:00:00Z" }), c({ id: "vieja", creadaEn: "2026-10-10T10:00:00Z" })]
    expect(ordenarBandeja(lista).map((x) => x.id)).toEqual(["vieja", "nueva"])
  })
  it("no modifica la lista original", () => {
    const lista = [c({ id: "a", urgencia: "normal" }), c({ id: "b", urgencia: "urgente" })]
    ordenarBandeja(lista)
    expect(lista.map((x) => x.id)).toEqual(["a", "b"])
  })
})

describe("Mis consultas (óptica)", () => {
  it("las que tienen respuesta sin leer van primero; las resueltas al final", () => {
    const lista = [c({ id: "resuelta", estado: "resuelta" }), c({ id: "abierta" }), c({ id: "con-respuesta", respuestaSinLeer: true, estado: "respondida" })]
    expect(ordenarMisConsultas(lista).map((x) => x.id)).toEqual(["con-respuesta", "abierta", "resuelta"])
  })
})

describe("filtros de la bandeja", () => {
  const lista = [
    c({ id: "1", numero: 7, estado: "recibida", urgencia: "urgente", modulo: "ventas", opticaId: "o1", asunto: "No cobra" }),
    c({ id: "2", numero: 8, estado: "resuelta", urgencia: "normal", modulo: "citas", opticaId: "o2", asunto: "Duda de horario" }),
    c({ id: "3", numero: 9, estado: "respondida", urgencia: "normal", modulo: "citas", opticaId: "o2", asunto: "Otra cosa", autorNombre: "Luis" }),
  ]
  it("por estado, urgencia, módulo y óptica", () => {
    expect(filtrarBandeja(lista, { estado: "resuelta" }).map((x) => x.id)).toEqual(["2"])
    expect(filtrarBandeja(lista, { urgencia: "urgente" }).map((x) => x.id)).toEqual(["1"])
    expect(filtrarBandeja(lista, { modulo: "citas" }).map((x) => x.id)).toEqual(["2", "3"])
    expect(filtrarBandeja(lista, { opticaId: "o2", estado: "respondida" }).map((x) => x.id)).toEqual(["3"])
  })
  it("'abiertas' deja fuera solo las resueltas", () => {
    expect(filtrarBandeja(lista, { estado: "abiertas" }).map((x) => x.id)).toEqual(["1", "3"])
  })
  it("busca por código, asunto, autor u óptica", () => {
    expect(filtrarBandeja(lista, { busqueda: "sop-0008" }).map((x) => x.id)).toEqual(["2"])
    expect(filtrarBandeja(lista, { busqueda: "cobra" }).map((x) => x.id)).toEqual(["1"])
    expect(filtrarBandeja(lista, { busqueda: "luis" }).map((x) => x.id)).toEqual(["3"])
    expect(filtrarBandeja(lista, { busqueda: "solna" }, (id) => (id === "o2" ? "Óptica Solna" : "")).map((x) => x.id)).toEqual(["2", "3"])
  })
})

describe("período de la bandeja y de los indicadores", () => {
  it("'todo' no acota; los demás cuentan hacia atrás desde ahora", () => {
    const ahora = Date.parse("2026-10-15T12:00:00Z")
    expect(desdeDePeriodo("todo", ahora)).toBeNull()
    expect(desdeDePeriodo("7", ahora)).toBe("2026-10-08T12:00:00.000Z")
    expect(desdeDePeriodo("30", ahora)).toBe("2026-09-15T12:00:00.000Z")
    expect(PERIODOS_SOPORTE.map((x) => x.id)).toEqual(["7", "30", "90", "todo"])
  })
  it("la bandeja deja fuera lo anterior al período, y los indicadores usan el mismo corte", () => {
    const lista = [c({ id: "vieja", creadaEn: "2026-09-01T10:00:00Z" }), c({ id: "nueva", creadaEn: "2026-10-14T10:00:00Z" })]
    expect(filtrarBandeja(lista, { desde: "2026-10-01T00:00:00Z" }).map((x) => x.id)).toEqual(["nueva"])
    expect(indicadoresSoporte(lista, { desde: "2026-10-01T00:00:00Z" }).total).toBe(1)
  })
})

describe("indicadores", () => {
  const lista = [
    c({ id: "a", creadaEn: "2026-10-10T10:00:00Z", primeraRespuestaEn: "2026-10-10T10:30:00Z", resueltaEn: "2026-10-10T12:00:00Z", estado: "resuelta", calificacion: 5, modulo: "citas" }),
    c({ id: "b", creadaEn: "2026-10-10T10:00:00Z", primeraRespuestaEn: "2026-10-10T11:30:00Z", resueltaEn: "2026-10-11T10:00:00Z", estado: "resuelta", calificacion: 4, modulo: "citas" }),
    c({ id: "c", creadaEn: "2026-10-12T10:00:00Z", urgencia: "urgente", modulo: "ventas" }),
  ]
  it("tiempo de primera respuesta y de resolución (mediana), satisfacción y módulos con más consultas", () => {
    const i = indicadoresSoporte(lista)
    expect(i.total).toBe(3)
    expect(i.abiertas).toBe(1)
    expect(i.urgentesAbiertas).toBe(1)
    expect(i.sinResponder).toBe(1)
    expect(i.primeraRespuestaMin).toBe(60) // mediana de 30 y 90
    expect(i.resolucionMin).toBe(Math.round((120 + 1440) / 2))
    expect(i.satisfaccion).toBe(4.5)
    expect(i.calificadas).toBe(2)
    expect(i.porModulo[0]).toMatchObject({ modulo: "citas", nombre: "Citas", total: 2 })
  })
  it("sin datos no inventa números", () => {
    const i = indicadoresSoporte([])
    expect(i).toMatchObject({ total: 0, primeraRespuestaMin: null, resolucionMin: null, satisfaccion: null })
    expect(duracionLegible(null)).toBe("—")
  })
  it("se acota por fechas", () => {
    expect(indicadoresSoporte(lista, { desde: "2026-10-11T00:00:00Z" }).total).toBe(1)
  })
  it("las duraciones se leen bien", () => {
    expect(duracionLegible(0)).toBe("menos de 1 min")
    expect(duracionLegible(35)).toBe("35 min")
    expect(duracionLegible(130)).toBe("2 h 10 min")
    expect(duracionLegible(120)).toBe("2 h")
    expect(duracionLegible(60 * 28)).toBe("1 día 4 h")
    expect(duracionLegible(60 * 48)).toBe("2 días")
  })
})

describe("avisos del sistema", () => {
  it("los no leídos van primero y destacados; los generales se distinguen de los puntuales", () => {
    const mensajes = [
      { id: "1", tipo: "anuncio", asunto: "Viejo", cuerpo: "x", created_at: "2026-10-01T10:00:00Z", optica_id: null },
      { id: "2", tipo: "anuncio", asunto: "Nuevo", cuerpo: "y", created_at: "2026-10-12T10:00:00Z", optica_id: "o1" },
      { id: "3", tipo: "consulta", asunto: "No es aviso", cuerpo: "z", created_at: "2026-10-13T10:00:00Z", optica_id: "o1" },
    ]
    const r = avisosConLeido(mensajes, ["1"])
    expect(r.map((a) => a.id)).toEqual(["2", "1"])
    expect(r[0]).toMatchObject({ leido: false, general: false })
    expect(r[1]).toMatchObject({ leido: true, general: true })
  })
})

describe("de la base a la pantalla", () => {
  it("convierte los nombres de las columnas", () => {
    const m = mapConsulta({ id: "x", numero: 3, optica_id: "o", autor_nombre: "Ana", modulo: "citas", urgencia: "urgente", estado: "respondida", respuesta_sin_leer: true, creada_en: "2026-10-10T10:00:00Z", contexto: null })
    expect(m).toMatchObject({ id: "x", numero: 3, opticaId: "o", autorNombre: "Ana", urgencia: "urgente", respuestaSinLeer: true, contexto: {} })
  })
})
