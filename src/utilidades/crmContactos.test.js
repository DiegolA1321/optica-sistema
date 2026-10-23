import { describe, it, expect } from "vitest"
import {
  motivosDe, listaParaContactar, contarPorMotivo, filtrarPorMotivo, avisosDelCrm, estadoDelMotivo, resultadoEfectivo, citaPosterior,
  aceptaRecordatorios, aceptaPromociones, puedeContactarPor, permisoDeMotivo, armarMensaje, plantillaDe, PLANTILLAS_BASE,
  destinatariosCampana, resumenSeguimiento, rankingReferidores, rankingFrecuentes, rankingPuntaje, fechaEnDias, MOTIVO_PROMOCION, insertarEnCursor, VARIABLES_PLANTILLA, variablesDe, MOTIVOS_DE_AVISO, ETIQUETA_MOTIVO, alNombreActual,
} from "./crmContactos"
import { diasCumpleEnVentana, esInactivo } from "./fidelizacion"
import { hoyISO } from "./disponibilidad"

const hoy = hoyISO()
const dia = (n) => fechaEnDias(n, hoy)
const marca = (n, hora = "12:00:00") => `${dia(n)}T${hora}-05:00` // un instante de ese día en Ecuador
const nacer = (n, anio = 1985) => `${anio}${dia(n).slice(4)}` // nacimiento cuyo cumpleaños cae `n` días desde hoy
const paciente = (id, extra = {}) => ({ id, nombre: `Paciente ${id}`, telefono: "0990000000", fechaRegistro: dia(-10), fechaNacimiento: "1990-02-02", ...extra })
const idsDe = (filas) => filas.map((f) => f.id).sort()
const motivosIds = (p, extra = {}) => motivosDe(p, { hoy, ...extra }).map((m) => m.id)
const contacto = (pacienteId, motivo, extra = {}) => ({ id: `c-${pacienteId}-${motivo}-${Math.random()}`, pacienteId, motivo, canal: "whatsapp", resultado: null, volverEl: null, campanaId: null, creadoEn: marca(0), ...extra })

describe("quién entra en cada motivo", () => {
  it("control vencido: el mismo criterio que el Inicio y Reportes (esInactivo)", () => {
    const vencido = paciente("a", { fechaRegistro: dia(-200) })
    const alDia = paciente("b", { fechaRegistro: dia(-20) })
    expect(esInactivo(vencido, [])).toBe(true)
    expect(motivosIds(vencido)).toContain("control_vencido")
    expect(motivosIds(alDia)).toEqual([])
  })

  it("control próximo: vence en los siguientes 30 días y todavía no está vencido", () => {
    expect(motivosIds(paciente("a", { fechaRegistro: dia(-160) }))).toEqual(["control_proximo"]) // vence en 20 días
    expect(motivosIds(paciente("b", { fechaRegistro: dia(-150) }))).toEqual(["control_proximo"]) // vence en 30 días: el límite entra
    expect(motivosIds(paciente("c", { fechaRegistro: dia(-149) }))).toEqual([]) // en 31 días: todavía no
    expect(motivosIds(paciente("d", { fechaRegistro: dia(-180) }))).toEqual(["control_vencido"]) // vence hoy: ya es control vencido
  })

  it("el intervalo que fijó el optómetra manda sobre los 180 días", () => {
    const p = paciente("a", { fechaRegistro: dia(-400) })
    const consultas = [{ id: "k1", pacienteId: "a", fecha: dia(-40), proximoControlDias: 60 }] // vence en 20 días
    expect(motivosIds(p, { consultas })).toEqual(["control_proximo"])
  })

  it("sin visitar: más de 12 meses; con 365 días justos todavía no", () => {
    expect(motivosIds(paciente("a", { fechaRegistro: dia(-366) }))).toContain("sin_visitar")
    expect(motivosIds(paciente("b", { fechaRegistro: dia(-365) }))).not.toContain("sin_visitar")
  })

  it("quien tiene control vencido y lleva más de un año sin venir está en los dos (los dos números son verdad)", () => {
    expect(motivosIds(paciente("a", { fechaRegistro: dia(-500) }))).toEqual(expect.arrayContaining(["control_vencido", "sin_visitar"]))
  })

  it("cumpleaños: la ventana del Inicio, de 5 días atrás a 7 adelante", () => {
    expect(motivosIds(paciente("a", { fechaNacimiento: nacer(0) }))).toEqual(["cumpleanos"])
    expect(motivosIds(paciente("b", { fechaNacimiento: nacer(7) }))).toEqual(["cumpleanos"])
    expect(motivosIds(paciente("c", { fechaNacimiento: nacer(8) }))).toEqual([])
    expect(motivosIds(paciente("d", { fechaNacimiento: nacer(-5) }))).toEqual(["cumpleanos"])
    expect(motivosIds(paciente("e", { fechaNacimiento: nacer(-6) }))).toEqual([])
    expect(diasCumpleEnVentana(nacer(3), new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10))))).toBe(3)
  })

  it("seguimiento después de la compra: lentes entregados hace 7 a 15 días", () => {
    const orden = (n, estado = "entregada") => [{ id: `o${n}`, pacienteId: "a", estado, historial: [{ estado: "enviada", cambiadoEn: marca(-30) }, { estado, cambiadoEn: marca(-n) }] }]
    const p = paciente("a")
    expect(motivosIds(p, { ordenes: orden(6) })).toEqual([])
    expect(motivosIds(p, { ordenes: orden(7) })).toEqual(["postventa"])
    expect(motivosIds(p, { ordenes: orden(15) })).toEqual(["postventa"])
    expect(motivosIds(p, { ordenes: orden(16) })).toEqual([])
    expect(motivosIds(p, { ordenes: orden(10, "lista") })).toEqual([]) // solo las entregadas
    expect(motivosIds(paciente("z"), { ordenes: orden(10) })).toEqual([]) // la orden es de otro paciente
  })

  it("un paciente de alta no tiene nada pendiente", () => {
    expect(motivosIds(paciente("a", { fechaRegistro: dia(-500), estadoClinico: "De alta" }))).toEqual([])
  })
})

describe("la lista Para contactar", () => {
  const pacientes = [
    paciente("venc", { fechaRegistro: dia(-200) }),
    paciente("prox", { fechaRegistro: dia(-160) }),
    paciente("cumple", { fechaNacimiento: nacer(0), aceptaPromociones: true }),
    paciente("dos", { fechaRegistro: dia(-200), fechaNacimiento: nacer(2), aceptaPromociones: true }),
    paciente("alDia"),
  ]
  const lista = (extra = {}) => listaParaContactar({ pacientes, hoy, ...extra })

  it("trae un paciente una sola vez aunque tenga dos motivos, y cuenta cada motivo", () => {
    const { filas } = lista()
    expect(idsDe(filas)).toEqual(["cumple", "dos", "prox", "venc"])
    const n = contarPorMotivo(filas)
    expect(n.total).toBe(4)
    expect(n.por).toMatchObject({ control_vencido: 2, control_proximo: 1, cumpleanos: 2, sin_visitar: 0, postventa: 0 })
  })

  it("filtrar por motivo trae exactamente el número que dice el filtro", () => {
    const { filas } = lista()
    const n = contarPorMotivo(filas)
    for (const m of Object.keys(n.por)) expect(filtrarPorMotivo(filas, m)).toHaveLength(n.por[m])
    expect(filtrarPorMotivo(filas, "todos")).toHaveLength(n.total)
  })

  it("quien no acepta recordatorios no aparece, y se dice cuántos se dejaron fuera", () => {
    const sinPermiso = pacientes.map((p) => (p.id === "venc" ? { ...p, aceptaRecordatorios: false } : p))
    const { filas, sinPermiso: fuera } = listaParaContactar({ pacientes: sinPermiso, hoy })
    expect(idsDe(filas)).not.toContain("venc")
    expect(fuera).toBe(1)
  })

  it("sin teléfono el paciente sigue en la lista (se ve, pero no se le puede escribir por WhatsApp)", () => {
    const { filas } = listaParaContactar({ pacientes: [paciente("a", { fechaRegistro: dia(-200), telefono: "" })], hoy })
    expect(filas[0].telefono).toBe("")
  })

  it("el que hay que retomar hoy y el que quedó sin resultado van primero", () => {
    const contactos = [
      contacto("prox", "control_proximo"), // contactado sin anotar qué pasó
      contacto("venc", "control_vencido", { resultado: "volver_a_contactar", volverEl: dia(0), creadoEn: marca(-3) }),
    ]
    const { filas } = lista({ contactos })
    expect(filas[0].id).toBe("venc")
    expect(filas[0].reaparece).toBe(true)
    expect(filas[1].id).toBe("prox")
  })
})

describe("qué pasa después de contactar", () => {
  const p = [paciente("a", { fechaRegistro: dia(-200) })]
  const filasCon = (contactos, citas = []) => listaParaContactar({ pacientes: p, contactos, citas, hoy }).filas
  const c = (extra) => contacto("a", "control_vencido", extra)

  it("sin contacto aparece; con contacto sin resultado sigue y pide anotar qué pasó", () => {
    expect(filasCon([])).toHaveLength(1)
    const [fila] = filasCon([c({})])
    expect(fila.sinResultado).toBeTruthy()
  })

  it("no respondió: descansa 3 días y vuelve", () => {
    expect(filasCon([c({ resultado: "no_respondio", creadoEn: marca(0) })])).toHaveLength(0)
    expect(filasCon([c({ resultado: "no_respondio", creadoEn: marca(-2) })])).toHaveLength(0)
    expect(filasCon([c({ resultado: "no_respondio", creadoEn: marca(-3) })])).toHaveLength(1)
  })

  it("volver a contactar en 3 días: no aparece hasta esa fecha y entonces reaparece solo", () => {
    const hecho = c({ resultado: "volver_a_contactar", volverEl: dia(3), creadoEn: marca(0) })
    expect(filasCon([hecho])).toHaveLength(0)
    expect(listaParaContactar({ pacientes: p, contactos: [hecho], hoy: dia(2) }).filas).toHaveLength(0)
    const [fila] = listaParaContactar({ pacientes: p, contactos: [hecho], hoy: dia(3) }).filas
    expect(fila.reaparece).toBe(true)
    expect(fila.paciente.id).toBe("a")
  })

  it("agendó: descansa 30 días; no le interesa: 180", () => {
    expect(filasCon([c({ resultado: "agendo", creadoEn: marca(-29) })])).toHaveLength(0)
    expect(filasCon([c({ resultado: "agendo", creadoEn: marca(-30) })])).toHaveLength(1)
    expect(filasCon([c({ resultado: "no_le_interesa", creadoEn: marca(-179) })])).toHaveLength(0)
    expect(filasCon([c({ resultado: "no_le_interesa", creadoEn: marca(-180) })])).toHaveLength(1)
  })

  it("si el paciente agenda una cita después del contacto, el contacto queda resuelto solo", () => {
    const hecho = c({ creadoEn: marca(-2) })
    const cita = { id: "ct", pacienteId: "a", estado: "Pendiente", fecha: dia(5), creadoEn: marca(-1) }
    expect(citaPosterior(hecho, [cita])).toBe(true)
    expect(resultadoEfectivo(hecho, [cita])).toBe("agendo")
    expect(filasCon([hecho], [cita])).toHaveLength(0)
    // una cita agendada ANTES del contacto, o cancelada, no lo resuelve
    expect(citaPosterior(hecho, [{ ...cita, creadoEn: marca(-5) }])).toBe(false)
    expect(citaPosterior(hecho, [{ ...cita, estado: "Cancelada" }])).toBe(false)
    expect(citaPosterior(hecho, [{ ...cita, estado: "No Asistió" }])).toBe(false)
  })

  it("un contacto por otro motivo no hace descansar a este", () => {
    expect(filasCon([contacto("a", "cumpleanos", { resultado: "agendo" })])).toHaveLength(1)
  })

  it("no desea recibir mensajes: el contacto lo oculta aunque el permiso todavía no se haya guardado", () => {
    expect(filasCon([c({ resultado: "no_desea_mensajes" })])).toHaveLength(0)
    expect(estadoDelMotivo([c({ resultado: "no_desea_mensajes" })], [], hoy).oculto).toBe(true)
  })
})

describe("requieren atención", () => {
  it("cumpleaños de hoy, los que toca retomar hoy y los contactos sin resultado de días anteriores", () => {
    const pacientes = [paciente("cumple", { fechaNacimiento: nacer(0), aceptaPromociones: true }), paciente("vuelve", { fechaRegistro: dia(-200) }), paciente("viejo", { fechaRegistro: dia(-200) })]
    const contactos = [
      contacto("vuelve", "control_vencido", { resultado: "volver_a_contactar", volverEl: dia(0), creadoEn: marca(-3) }),
      contacto("viejo", "control_vencido", { creadoEn: marca(-2) }),
      contacto("viejo", "control_vencido", { creadoEn: marca(-1), campanaId: "camp" }), // los de campaña no piden resultado
    ]
    const { filas } = listaParaContactar({ pacientes, contactos, hoy })
    const a = avisosDelCrm(filas, contactos, hoy)
    expect(a.cumpleHoy.map((f) => f.id)).toEqual(["cumple"])
    expect(a.vuelven.map((f) => f.id)).toEqual(["vuelve"])
    expect(a.sinResultado.map((x) => x.pacienteId)).toEqual(["viejo"])
  })
  it("un contacto de hoy sin resultado todavía no es un aviso", () => {
    const contactos = [contacto("a", "control_vencido")]
    expect(avisosDelCrm([], contactos, hoy).sinResultado).toEqual([])
  })
})

describe("consentimiento", () => {
  it("recordatorios de salud: sí por defecto; promociones: no por defecto", () => {
    expect(aceptaRecordatorios({})).toBe(true)
    expect(aceptaRecordatorios({ aceptaRecordatorios: false })).toBe(false)
    expect(aceptaPromociones({})).toBe(false)
    expect(aceptaPromociones({ aceptaPromociones: true })).toBe(true)
  })
  it("los dos permisos son independientes", () => {
    const soloSalud = { aceptaRecordatorios: true, aceptaPromociones: false }
    const soloPromo = { aceptaRecordatorios: false, aceptaPromociones: true }
    expect(puedeContactarPor(soloSalud, "control_vencido")).toBe(true)
    expect(puedeContactarPor(soloSalud, "cumpleanos")).toBe(false)
    expect(puedeContactarPor(soloSalud, MOTIVO_PROMOCION)).toBe(false)
    expect(puedeContactarPor(soloPromo, "control_vencido")).toBe(false)
    expect(puedeContactarPor(soloPromo, "cumpleanos")).toBe(true)
    expect(puedeContactarPor(soloPromo, MOTIVO_PROMOCION)).toBe(true)
  })
  it("la campaña de promociones solo trae a quien aceptó, y dice cuántos quedaron fuera", () => {
    const pacientes = [paciente("a", { aceptaPromociones: true }), paciente("b"), paciente("c", { aceptaPromociones: true, aceptaRecordatorios: false })]
    const r = destinatariosCampana("promociones", { pacientes, hoy })
    expect(r.pacientes.map((p) => p.id)).toEqual(["a", "c"]) // el permiso de promociones no depende del de recordatorios
    expect(r.sinPermiso).toBe(1)
  })
  it("las campañas de salud respetan los recordatorios", () => {
    const pacientes = [paciente("a", { fechaRegistro: dia(-200) }), paciente("b", { fechaRegistro: dia(-200), aceptaRecordatorios: false })]
    const r = destinatariosCampana("control_vencido", { pacientes, hoy })
    expect(r.pacientes.map((p) => p.id)).toEqual(["a"])
    expect(r.sinPermiso).toBe(1)
  })
})

describe("campañas: los grupos", () => {
  it("sin visitar y cumpleaños del mes", () => {
    const pacientes = [paciente("a", { fechaRegistro: dia(-400) }), paciente("b", { fechaRegistro: dia(-300) }), paciente("c", { fechaNacimiento: `1980-${hoy.slice(5, 7)}-15`, aceptaPromociones: true }), paciente("d", { fechaNacimiento: "1980-01-15" })]
    expect(destinatariosCampana("sin_visitar", { pacientes, hoy }).pacientes.map((p) => p.id)).toEqual(["a"])
    const mes = destinatariosCampana("cumpleanos_mes", { pacientes, hoy }).pacientes.map((p) => p.id)
    expect(mes).toContain("c")
    if (hoy.slice(5, 7) !== "01") expect(mes).not.toContain("d")
  })
  it("un grupo que no existe no trae a nadie", () => {
    expect(destinatariosCampana("otro", { pacientes: [paciente("a")], hoy })).toEqual({ pacientes: [], sinPermiso: 0, excluidos: [] })
  })
})

describe("mensajes", () => {
  it("la plantilla guardada manda; si está vacía, la base", () => {
    expect(plantillaDe("control_vencido", { control_vencido: "Hola {nombre}" })).toBe("Hola {nombre}")
    expect(plantillaDe("control_vencido", { control_vencido: "   " })).toBe(PLANTILLAS_BASE.control_vencido)
    expect(plantillaDe("cumpleanos")).toBe(PLANTILLAS_BASE.cumpleanos)
  })
  it("reemplaza {nombre} y {óptica}; el nombre va tal como está guardado", () => {
    const texto = armarMensaje("Hola {nombre}, de {óptica}.", { paciente: { nombre: "Rosa Bravo Cedeño" }, opticaNombre: "Óptica Solna" })
    expect(texto).toBe("Hola Rosa Bravo Cedeño, de Óptica Solna.")
  })
  it("sin nombre de óptica no deja la variable a la vista", () => {
    expect(armarMensaje("De {óptica}", { paciente: { nombre: "A" } })).toBe("De tu óptica")
  })
  it("los mensajes guardados con los nombres viejos se siguen entendiendo", () => {
    expect(armarMensaje("De {optica}: tu control es el {control}", { paciente: { nombre: "A" }, opticaNombre: "Solna" })).toBe("De Solna: tu control es el pronto")
  })
  it("{fecha_del_control} sin fecha dice 'pronto'", () => {
    expect(armarMensaje("Control: {fecha_del_control}", { paciente: { nombre: "A" } })).toBe("Control: pronto")
  })
  it("una variable se inserta donde está el cursor, no al final", () => {
    const r = insertarEnCursor("Hola , bienvenido", "{nombre}", 5, 5)
    expect(r.texto).toBe("Hola {nombre}, bienvenido")
    expect(r.cursor).toBe(5 + "{nombre}".length)
  })
  it("reemplaza lo seleccionado y separa con espacios solo cuando hace falta", () => {
    expect(insertarEnCursor("De hola mundo", "{óptica}", 3, 7).texto).toBe("De {óptica} mundo")
    expect(insertarEnCursor("Hola", "{nombre}", 4, 4).texto).toBe("Hola {nombre}")
    expect(insertarEnCursor("Hola ", "{nombre}", 5, 5).texto).toBe("Hola {nombre}")
    expect(insertarEnCursor("", "{nombre}", 0, 0).texto).toBe("{nombre}")
  })
  it("sin cursor conocido va al final", () => {
    expect(insertarEnCursor("Hola", "{nombre}").texto).toBe("Hola {nombre}")
  })
  it("las variables tienen nombre claro y explicación; las propias de un aviso solo se ofrecen en su motivo", () => {
    expect(VARIABLES_PLANTILLA.map((v) => v.id)).toEqual(["{nombre}", "{optica}", "{telefono_optica}", "{fecha_control}", "{fecha_cita}", "{orden}", "{entrega}", "{medidas}"])
    expect(VARIABLES_PLANTILLA.every((v) => v.ayuda.length > 5)).toBe(true)
    expect(variablesDe("cumpleanos").map((v) => v.id)).toEqual(["{nombre}", "{optica}", "{telefono_optica}"])
    expect(variablesDe("cita_no_efectuada").map((v) => v.id)).toEqual(["{nombre}", "{optica}", "{telefono_optica}", "{fecha_cita}"]) // los datos que muestra el diseño
    expect(variablesDe("control_vencido").map((v) => v.id)).toContain("{fecha_control}")
    expect(variablesDe().map((v) => v.id)).toEqual(["{nombre}", "{optica}", "{telefono_optica}", "{fecha_control}"]) // una campaña no tiene cita ni pedido
    expect(variablesDe("cita_no_efectuada").map((v) => v.id)).not.toContain("{medidas}")
    expect(variablesDe("medidas_montaje").map((v) => v.id)).toContain("{medidas}")
    expect(variablesDe("lentes_listos").map((v) => v.id)).toContain("{orden}")
    expect(variablesDe("lentes_listos_envio").map((v) => v.id)).toContain("{entrega}")
  })
  it("cada motivo de aviso tiene su plantilla base, su etiqueta y usa solo variables que existen", () => {
    const ids = VARIABLES_PLANTILLA.map((v) => v.id)
    for (const m of Object.keys(MOTIVOS_DE_AVISO)) {
      expect(PLANTILLAS_BASE[m], m).toBeTruthy()
      expect(ETIQUETA_MOTIVO[m], m).toBeTruthy()
      for (const usada of PLANTILLAS_BASE[m].match(/{[^}]+}/g) || []) expect(ids, `${m} usa ${usada}`).toContain(usada)
    }
  })
  it("los avisos arman su mensaje con lo propio de cada uno", () => {
    const paciente = { nombre: "Rosa Bravo Cedeño" }
    const cita = armarMensaje(plantillaDe("cita_no_efectuada"), { paciente, opticaNombre: "Óptica Sol", cita: { fecha: "2026-10-20", hora: "04:00 PM" } })
    expect(cita).toBe("Hola Rosa Bravo Cedeño, notamos que no pudiste venir a tu cita del martes, 20 de octubre a las 04:00 PM. ¿Te ayudamos a agendar una nueva? Escríbenos. — Óptica Sol") // sin teléfono configurado se quita «llámanos al …»
    expect(armarMensaje(plantillaDe("cita_no_efectuada"), { paciente, opticaNombre: "Óptica Sol", opticaTelefono: "042 345 678", cita: { fecha: "2026-10-20", hora: "04:00 PM" } })).toContain("Escríbenos o llámanos al 042 345 678. — Óptica Sol")
    expect(armarMensaje(plantillaDe("lentes_listos"), { paciente, opticaNombre: "Visión", orden: "OL-0007" })).toContain("(orden OL-0007)")
    const medidas = armarMensaje(plantillaDe("medidas_montaje"), { paciente, opticaNombre: "Solna", medidas: { dp: "62", altura: "18 mm" } })
    expect(medidas).toContain("• Distancia pupilar: 62 mm\n• Altura de montaje: 18 mm")
    expect(medidas).not.toContain("18 mm mm")
    expect(armarMensaje(plantillaDe("medidas_montaje"), { paciente, opticaNombre: "Solna", medidas: { dp: "62", altura: "" } })).not.toContain("Altura")
  })
  it("la plantilla que la óptica personalizó manda sobre la base también en los avisos", () => {
    const propia = armarMensaje(plantillaDe("lentes_listos", { lentes_listos: "{nombre}, ya puedes pasar por tus lentes a {optica}." }), { paciente: { nombre: "Ana" }, opticaNombre: "Visión" })
    expect(propia).toBe("Ana, ya puedes pasar por tus lentes a Visión.")
  })
  it("lo que la óptica guardó con los nombres de antes se sigue entendiendo", () => {
    const viejo = "Hola {nombre}, de {óptica}: tu cita {fecha_de_la_cita} y tu control {fecha_del_control}."
    expect(alNombreActual(viejo)).toBe("Hola {nombre}, de {optica}: tu cita {fecha_cita} y tu control {fecha_control}.")
    expect(armarMensaje(viejo, { paciente: { nombre: "Ana" }, opticaNombre: "Visión", cita: { fecha: "2026-10-20", hora: "04:00 PM" } })).toContain("de Visión: tu cita martes, 20 de octubre")
  })
  it("pedido listo tiene una plantilla para quien retira y otra para el envío (con su dirección)", () => {
    const paciente = { nombre: "Ana" }
    expect(armarMensaje(plantillaDe("lentes_listos"), { paciente, opticaNombre: "Visión", orden: "OL-0007", entrega: { tipo: "retira" } })).toContain("Te esperamos en la óptica para retirarlo.")
    expect(armarMensaje(plantillaDe("lentes_listos_envio"), { paciente, opticaNombre: "Visión", orden: "OL-0007", entrega: { tipo: "envio", direccion: "Av. Colón" } })).toContain("Te lo enviaremos a Av. Colón.")
    expect(ETIQUETA_MOTIVO.lentes_listos).toBe("Pedido listo (retira)")
    expect(ETIQUETA_MOTIVO.lentes_listos_envio).toBe("Pedido listo (envío)")
  })
  it("con ejemplo, las variables de un aviso llevan un dato de muestra", () => {
    expect(armarMensaje("{fecha_cita} · {orden} · {medidas}", { ejemplo: true })).toContain("martes 20 de octubre a las 04:00 PM · 000012 · • Distancia pupilar")
  })
  it("el control vencido es un recordatorio de salud, no una promoción", () => {
    expect(PLANTILLAS_BASE.control_vencido).not.toMatch(/promoci|oferta|descuento/i)
  })
  it("todas las plantillas base son cortas y nombran a la óptica", () => {
    for (const t of Object.values(PLANTILLAS_BASE)) {
      expect(t.length).toBeLessThanOrEqual(200)
      expect(t).toContain("{optica}")
      expect(t).toContain("{nombre}")
    }
  })
})

describe("seguimiento y fidelización", () => {
  it("cuenta contactados, agendaron y la tasa de respuesta", () => {
    const contactos = [
      contacto("a", "control_vencido", { resultado: "agendo" }),
      contacto("b", "control_vencido", { resultado: "no_respondio" }),
      contacto("c", "control_vencido", { resultado: "no_le_interesa" }),
      contacto("d", "control_vencido", { resultado: null, creadoEn: marca(-2) }),
    ]
    const citas = [{ pacienteId: "d", estado: "Pendiente", creadoEn: marca(-1) }] // d agendó sin que nadie lo anotara
    const r = resumenSeguimiento(contactos, citas)
    expect(r).toMatchObject({ contactos: 4, pacientes: 4, agendaron: 2, respondieron: 3, tasaRespuesta: 75 })
  })
  it("sin contactos no hay tasa (no 0 %)", () => {
    expect(resumenSeguimiento([], []).tasaRespuesta).toBeNull()
  })
  it("los rankings traen a todos, no solo cinco", () => {
    const pacientes = Array.from({ length: 12 }, (_, i) => paciente(`p${i}`))
    const referidos = pacientes.slice(1).map((p) => ({ ...p, referidoPorId: "p0" }))
    const todos = [pacientes[0], ...referidos]
    expect(rankingReferidores(todos)).toEqual([{ paciente: pacientes[0], valor: 11 }])
    const consultas = pacientes.flatMap((p) => [1, 2, 3].map((k) => ({ id: `${p.id}-${k}`, pacienteId: p.id, fecha: dia(-k) })))
    expect(rankingFrecuentes(pacientes, consultas)).toHaveLength(12)
    expect(rankingPuntaje(todos, consultas)[0]).toMatchObject({ valor: 11 * 15 + 3 * 10 })
  })
})

describe("cada motivo pide su permiso", () => {
  const pacientes = [
    paciente("a", { fechaRegistro: dia(-200), fechaNacimiento: nacer(1) }), // control vencido + cumpleaños, con los permisos de siempre
    paciente("b", { fechaRegistro: dia(-200), fechaNacimiento: nacer(1), aceptaPromociones: true }),
    paciente("c", { fechaRegistro: dia(-200), fechaNacimiento: nacer(1), aceptaPromociones: true, aceptaRecordatorios: false }),
  ]
  const r = listaParaContactar({ pacientes, hoy })
  const motivosDeFila = (id) => (r.filas.find((f) => f.id === id)?.motivos || []).map((m) => m.id)

  it("el cumpleaños es de 'Promociones y saludos' y el control, de 'Recordatorios de salud'", () => {
    expect(permisoDeMotivo("cumpleanos")).toBe("promociones")
    expect(permisoDeMotivo("promocion")).toBe("promociones")
    for (const m of ["control_vencido", "control_proximo", "sin_visitar", "postventa"]) expect(permisoDeMotivo(m)).toBe("recordatorios")
  })
  it("sin promociones y saludos no se le ofrece el cumpleaños, pero sí su control", () => {
    expect(motivosDeFila("a")).toEqual(["control_vencido"])
  })
  it("con los dos permisos aparecen los dos motivos", () => {
    expect(motivosDeFila("b")).toEqual(["control_vencido", "cumpleanos"])
  })
  it("sin recordatorios de salud queda solo el saludo", () => {
    expect(motivosDeFila("c")).toEqual(["cumpleanos"])
  })
  it("dice cuántos pacientes tienen algún motivo que no se les puede ofrecer", () => {
    expect(r.sinPermiso).toBe(2) // a (sin saludos) y c (sin recordatorios)
  })
  it("quien apagó los dos permisos no aparece", () => {
    const r2 = listaParaContactar({ pacientes: [paciente("d", { fechaRegistro: dia(-200), fechaNacimiento: nacer(0), aceptaRecordatorios: false, aceptaPromociones: false })], hoy })
    expect(r2.filas).toEqual([])
    expect(r2.sinPermiso).toBe(1)
  })
  it("el control vencido de la lista es el de esInactivo salvo quien no aceptó recordatorios o ya se contactó", () => {
    const esperado = pacientes.filter((p) => esInactivo(p, []) && p.aceptaRecordatorios !== false).length
    expect(contarPorMotivo(r.filas).por.control_vencido).toBe(esperado)
  })
  it("un control vencido que descansa por un contacto no está, pero el cumpleaños sí", () => {
    const rr = listaParaContactar({ pacientes: [pacientes[1]], contactos: [contacto("b", "control_vencido", { resultado: "agendo", creadoEn: marca(0) })], hoy })
    expect(rr.filas[0].motivos.map((m) => m.id)).toEqual(["cumpleanos"])
  })
})

describe("«Por vender» vive en Para contactar (motivo «Recibió su diagnóstico y no ha comprado»)", () => {
  const pase = (id, pacienteId, extra = {}) => ({ id, pacienteId, estado: "listo", pasadaEn: `${dia(-3)}T15:00:00Z`, ...extra })
  const alDia = { fechaRegistro: dia(-20) } // sin control vencido ni cumpleaños: el único motivo posible es por vender

  it("un paciente con un pase abierto entra con ese motivo, los días que lleva y su proforma", () => {
    const p = paciente("a", alDia)
    const m = motivosDe(p, { hoy, pases: [pase("x", "a", { proformaEntregadaEn: `${dia(-2)}T10:00:00Z`, proformaTotal: 85 })] })
    expect(m.map((x) => x.id)).toEqual(["por_vender"])
    expect(m[0]).toMatchObject({ dias: 3, detalle: "Recibió su diagnóstico hace 3 días · con proforma" })
    expect(m[0].pase.proformaTotal).toBe(85)
  })
  it("una solicitud del portal lo dice con sus palabras", () => {
    const m = motivosDe(paciente("a", alDia), { hoy, pases: [pase("x", "a", { origen: "portal", pasadaEn: `${hoy}T10:00:00Z` })] })
    expect(m[0].detalle).toBe("Pidió lentes desde su portal hoy")
  })
  it("sin pase abierto (vendido o descartado) o de otro paciente no entra", () => {
    const p = paciente("a", alDia)
    expect(motivosIds(p, { pases: [pase("x", "a", { estado: "vendido" }), pase("y", "a", { estado: "descartado" }), pase("z", "otro")] })).toEqual([])
  })
  it("si compró algo después de recibir su diagnóstico (aunque no quedara vinculado) ya no está por vender; una venta anulada o anterior no cuenta", () => {
    const p = paciente("a", alDia)
    const pases = [pase("x", "a")]
    const compra = (extra) => ({ pacienteId: "a", estado: "pagada", creadoEn: `${dia(-1)}T10:00:00Z`, ...extra })
    expect(motivosIds(p, { pases, facturas: [compra()] })).toEqual([])
    expect(motivosIds(p, { pases, facturas: [compra({ estado: "anulada" })] })).toEqual(["por_vender"])
    expect(motivosIds(p, { pases, facturas: [compra({ creadoEn: `${dia(-9)}T10:00:00Z` })] })).toEqual(["por_vender"])
  })
  it("un paciente dado de alta sigue con su compra pendiente", () => {
    expect(motivosIds(paciente("a", { ...alDia, estadoClinico: "De alta" }), { pases: [pase("x", "a")] })).toEqual(["por_vender"])
  })
  it("es de «Recordatorios de salud»: sin ese permiso no se le ofrece", () => {
    expect(permisoDeMotivo("por_vender")).toBe("recordatorios")
    const sin = paciente("a", { ...alDia, aceptaRecordatorios: false })
    const r = listaParaContactar({ pacientes: [sin, paciente("b", alDia)], pases: [pase("x", "a"), pase("y", "b")], hoy })
    expect(r.filas.map((f) => f.id)).toEqual(["b"])
    expect(r.sinPermiso).toBe(1)
  })
  it("la lista y el conteo lo cuentan una sola vez por paciente, y un contacto reciente lo hace descansar", () => {
    const pacientes = [paciente("a", alDia), paciente("b", alDia)]
    const pases = [pase("x", "a"), pase("y", "a"), pase("z", "b")]
    const r = listaParaContactar({ pacientes, pases, hoy })
    expect(contarPorMotivo(r.filas)).toMatchObject({ total: 2, por: { por_vender: 2 } })
    expect(filtrarPorMotivo(r.filas, "por_vender")).toHaveLength(2)
    const descansa = listaParaContactar({ pacientes, pases, contactos: [contacto("a", "por_vender", { resultado: "no_le_interesa", creadoEn: marca(-1) })], hoy })
    expect(descansa.filas.map((f) => f.id)).toEqual(["b"])
  })
  it("tiene su etiqueta y su plantilla de mensaje, y no está entre los motivos de aviso de otro módulo", () => {
    expect(ETIQUETA_MOTIVO.por_vender).toBe("Por vender")
    expect(PLANTILLAS_BASE.por_vender).toMatch(/proforma/)
    expect(MOTIVOS_DE_AVISO.por_vender).toBeUndefined()
  })
})
