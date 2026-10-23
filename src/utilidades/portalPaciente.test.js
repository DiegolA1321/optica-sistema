import { describe, it, expect } from "vitest"
import {
  citasProximas, citasHistorial, NOTA_ESTADO_CITA, mapOrdenPaciente, ordenesAbiertasDelPaciente, nombreDeLosLentes,
  textoOrdenPaciente, proximoPasoLentes, identidadDeLaOptica, pasosDeLosLentes, proximoControlDelPaciente, textoControl, saldoDelPaciente, contactoDeLaOptica, tieneContacto, AYUDA_RECETA,
} from "./portalPaciente"
import { colorLegible } from "./marcaOptica"

// "Hoy" fijo: 17 de octubre de 2026, mediodía (hora de Ecuador ya convertida: la función recibe un Date local).
const HOY = new Date(2026, 9, 17, 12, 0, 0)

describe("citas del portal", () => {
  const citas = [
    { id: 1, fecha: "2026-10-20", hora: "03:00 PM", estado: "Pendiente" },
    { id: 2, fecha: "2026-10-20", hora: "09:00 AM", estado: "Pendiente" },
    { id: 3, fecha: "2026-10-01", hora: "10:00 AM", estado: "Atendida" },
    { id: 4, fecha: "2026-09-10", hora: "10:00 AM", estado: "No Asistió" },
    { id: 5, fecha: "2026-10-25", hora: "10:00 AM", estado: "Cancelada" },
    { id: 6, fecha: "2026-10-18", hora: "10:00 AM", estado: "En Espera" },
  ]
  it("las próximas van por fecha y hora (12 h) y no incluyen lo resuelto", () => {
    expect(citasProximas(citas).map((c) => c.id)).toEqual([6, 2, 1])
  })
  it("el historial trae atendidas, no efectuada y canceladas, de la más reciente a la más antigua", () => {
    expect(citasHistorial(citas).map((c) => c.id)).toEqual([5, 3, 4])
  })
  it("todo estado tiene su nota en palabras sencillas", () => {
    for (const e of ["Pendiente", "En Espera", "En Atención", "Atendida", "No Asistió", "Cancelada"]) expect(NOTA_ESTADO_CITA[e]).toMatch(/\./)
  })
})

describe("lentes (pedidos)", () => {
  const fila = { id: "o1", numero: 7, estado: "enviada", fecha_prometida: "2026-10-25", tipo_lente: "progresivo", montura: "Ray-Ban", factura_id: "f1", creada_en: "2026-10-10T15:00:00Z", lista_el: null, entregada_el: null }
  it("mapea la fila con los mismos nombres que el personal", () => {
    expect(mapOrdenPaciente(fila)).toMatchObject({ id: "o1", numero: 7, estado: "enviada", fechaPrometida: "2026-10-25", tipoLente: "progresivo", facturaId: "f1" })
  })
  it("enviada: «En proceso» con la fecha estimada, en azul como en Ventas", () => {
    expect(textoOrdenPaciente(mapOrdenPaciente(fila), HOY)).toEqual({ clave: "enviada", tono: "azul", titulo: "En proceso", detalle: "Fecha estimada: 25 oct 2026." })
  })
  it("enviada con la fecha vencida: sigue diciendo «En proceso», en rojo como «Atrasada» de Ventas, y manda a llamar", () => {
    const t = textoOrdenPaciente(mapOrdenPaciente({ ...fila, fecha_prometida: "2026-10-10" }), HOY)
    expect(t).toMatchObject({ clave: "atrasada", tono: "rojo", titulo: "En proceso" })
    expect(t.detalle).toMatch(/Llama a la óptica/)
  })
  it("lista: «Listo», en verde, con desde cuándo", () => {
    const t = textoOrdenPaciente(mapOrdenPaciente({ ...fila, estado: "lista", lista_el: "2026-10-16T14:00:00Z" }), HOY)
    expect(t).toMatchObject({ clave: "lista", tono: "verde", titulo: "Listo" })
    expect(t.detalle).toBe("Están en la óptica desde el 16 oct 2026. Pasa a recogerlos.")
  })
  it("entregada: «Entregado», en gris", () => {
    expect(textoOrdenPaciente(mapOrdenPaciente({ ...fila, estado: "entregada", entregada_el: "2026-10-16T14:00:00Z" }), HOY)).toMatchObject({ clave: "entregada", tono: "gris", titulo: "Entregado", detalle: "Los recibiste el 16 oct 2026." })
  })
  it("solo las enviadas y las listas son «abiertas» (las que van en el Resumen)", () => {
    const o = ["enviada", "lista", "entregada"].map((estado) => mapOrdenPaciente({ ...fila, estado }))
    expect(ordenesAbiertasDelPaciente(o).map((x) => x.estado)).toEqual(["enviada", "lista"])
  })
  it("nombra los lentes sin términos técnicos", () => {
    expect(nombreDeLosLentes({ tipoLente: "progresivo", montura: "Ray-Ban" })).toBe("Lentes progresivos con la montura Ray-Ban")
    expect(nombreDeLosLentes({ tipoLente: "monofocal", montura: "" })).toBe("Lentes monofocales")
  })
})

describe("próximo control", () => {
  it("usa los días que fijó el optómetra y la misma cuenta del personal", () => {
    const c = proximoControlDelPaciente({ ultima_consulta: "2026-10-01", proximo_control_dias: 30, de_alta: false }, HOY)
    expect(c).toMatchObject({ iso: "2026-10-31", dias: 14, vencido: false, pronto: true })
  })
  it("sin días fijados usa el umbral de 180 días del sistema", () => {
    expect(proximoControlDelPaciente({ ultima_consulta: "2026-10-01", proximo_control_dias: null, de_alta: false }, HOY).iso).toBe("2027-03-30")
  })
  it("vencido", () => {
    const c = proximoControlDelPaciente({ ultima_consulta: "2026-01-01", proximo_control_dias: 90, de_alta: false }, HOY)
    expect(c.vencido).toBe(true)
    expect(textoControl(c)).toMatch(/Ya pasó la fecha/)
  })
  it("un paciente sin consulta o dado de alta no tiene próximo control", () => {
    expect(proximoControlDelPaciente({ ultima_consulta: null, proximo_control_dias: null, de_alta: false }, HOY)).toBeNull()
    expect(proximoControlDelPaciente({ ultima_consulta: "2026-10-01", proximo_control_dias: 30, de_alta: true }, HOY)).toBeNull()
    expect(proximoControlDelPaciente(null, HOY)).toBeNull()
  })
  it("las frases concuerdan en singular y plural", () => {
    expect(textoControl({ vencido: false, pronto: true, dias: 0 })).toBe("Es hoy.")
    expect(textoControl({ vencido: false, pronto: true, dias: 1 })).toBe("Es mañana.")
    expect(textoControl({ vencido: false, pronto: true, dias: 5 })).toBe("Faltan 5 días.")
    expect(textoControl({ vencido: false, pronto: false, dias: 90 })).toMatch(/optómetra/)
  })
})

describe("saldo", () => {
  it("suma solo lo que se debe de las compras con saldo (el mismo número de Cobros y saldos)", () => {
    expect(saldoDelPaciente([{ estado: "pendiente_pago", saldo: 40 }, { estado: "pagada", saldo: 0 }, { estado: "pendiente_pago", saldo: "10.5" }])).toBe(50.5)
    expect(saldoDelPaciente([])).toBe(0)
    expect(saldoDelPaciente([{ estado: "pendiente_pago", saldo: -5 }])).toBe(0)
  })
})

describe("la óptica", () => {
  const horarioSemanal = { lunes: { manana: { activo: true, inicio: "09:00", fin: "13:00" } }, martes: { manana: { activo: true, inicio: "09:00", fin: "13:00" } } }
  it("arma teléfono, WhatsApp y horario", () => {
    const c = contactoDeLaOptica({ parametrizacion: { opticaDireccion: " Av. 9 de Octubre 123 ", opticaTelefono: "0991234567" }, disponibilidad: { horarioSemanal }, nombre: "Óptica Solna", paciente: "Ana" })
    expect(c.direccion).toBe("Av. 9 de Octubre 123")
    expect(c.telefonoHref).toBe("tel:+593991234567")
    expect(c.whatsappUrl).toContain("phone=593991234567")
    expect(decodeURIComponent(c.whatsappUrl)).toContain("Hola, soy Ana de Óptica Solna.")
    expect(c.horario[0].etiqueta).toBe("Lunes a Martes")
    expect(tieneContacto(c)).toBe(true)
  })
  it("sin datos cargados, no hay contacto que mostrar", () => {
    const c = contactoDeLaOptica({})
    expect(c).toMatchObject({ direccion: "", telefono: "", telefonoHref: "", whatsappUrl: "", horario: [] })
    expect(tieneContacto(c)).toBe(false)
  })
})

describe("receta", () => {
  it("cada valor tiene su explicación sencilla", () => {
    expect(Object.keys(AYUDA_RECETA).sort()).toEqual(["adicion", "agudeza", "cilindro", "eje", "esfera"])
  })
})

describe("línea de pasos de los lentes", () => {
  const o = (estado, fechaPrometida = "2026-10-25") => ({ estado, fechaPrometida })
  const nombres = (r) => r.pasos.map((p) => p.nombre + ":" + p.estado).join(" ")
  it("enviada: Pedido hecho, En proceso actual", () => {
    const r = pasosDeLosLentes(o("enviada"), HOY)
    expect(nombres(r)).toBe("Pedido:hecho En proceso:actual Listo:pendiente Entregado:pendiente")
    expect(r.tono).toBe("azul")
  })
  it("atrasada: sigue en proceso, en rojo como en Ventas", () => {
    const r = pasosDeLosLentes(o("enviada", "2026-10-10"), HOY)
    expect(r.actual).toBe(1)
    expect(r.tono).toBe("rojo")
  })
  it("lista y entregada avanzan el paso", () => {
    expect(pasosDeLosLentes(o("lista"), HOY)).toMatchObject({ actual: 2, tono: "verde" })
    expect(nombres(pasosDeLosLentes(o("entregada"), HOY))).toBe("Pedido:hecho En proceso:hecho Listo:hecho Entregado:hecho")
  })
})

describe("la óptica, hoy", () => {
  it("«Cómo llegar» abre el mapa con la dirección y el nombre; sin dirección no hay enlace", () => {
    const c = contactoDeLaOptica({ parametrizacion: { opticaDireccion: "Av. 9 de Octubre 123" }, nombre: "Óptica Solna" })
    expect(decodeURIComponent(c.comoLlegarUrl)).toContain("Av. 9 de Octubre 123, Óptica Solna")
    expect(contactoDeLaOptica({}).comoLlegarUrl).toBe("")
  })
  it("dice si está abierta hoy con la función de la página pública (con el horario cargado)", () => {
    const horarioSemanal = Object.fromEntries(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((d) => [d, { manana: { activo: true, inicio: "00:00", fin: "23:59" } }]))
    const c = contactoDeLaOptica({ disponibilidad: { horarioSemanal } })
    expect(c.hoy.abierto).toBe(true)
    expect(c.hoy.texto).toMatch(/Abierto hoy hasta las/)
    expect(contactoDeLaOptica({}).hoy).toBeNull()
  })
})

describe("identidad de la óptica", () => {
  it("sin color propio queda el azul aprobado del portal (#1D5FD6)", () => {
    const i = identidadDeLaOptica({})
    expect(i.acento).toBe("#1D5FD6")
    expect(i.textoBoton).toBe("#FFFFFF")
    expect(i.logoUrl).toBe("")
  })
  it("el azul del sistema que traen las ópticas por defecto no cuenta como un color propio", () => {
    expect(identidadDeLaOptica({ marca: { colorAcento: "#2563EB" } }).acento).toBe("#1D5FD6")
  })
  it("usa el color y el logo de la óptica", () => {
    const i = identidadDeLaOptica({ logo_url: "https://x/logo.png", marca: { colorAcento: "#7C3AED" } })
    expect(i.acento).toBe("#7C3AED")
    expect(i.logoUrl).toBe("https://x/logo.png")
  })
  it("un color mal escrito se ignora, y uno muy claro se oscurece para que el texto blanco de los botones se lea", () => {
    expect(identidadDeLaOptica({ marca: { colorAcento: "rojo" } }).acento).toBe("#1D5FD6")
    const claro = identidadDeLaOptica({ marca: { colorAcento: "#FDE047" } })
    expect(claro.acento).not.toBe("#FDE047")
    expect(claro.acento).toBe(colorLegible("#FDE047").color)
    expect(claro.textoBoton).toBe("#FFFFFF")
  })
})

describe("proximoPasoLentes: lo que sigue, en una frase", () => {
  const o = { estado: "enviada", fechaPrometida: "2026-10-22" }
  it("en proceso con fecha: cuándo retirarlos", () => expect(proximoPasoLentes(o, HOY)).toBe("Retíralos en la óptica desde el 22 de octubre."))
  it("sin fecha prometida: te avisan", () => expect(proximoPasoLentes({ estado: "enviada" }, HOY)).toBe("Te avisaremos cuando estén listos para retirar."))
  it("listos: retirarlos ya", () => expect(proximoPasoLentes({ estado: "lista" }, HOY)).toBe("Ya están listos: retíralos en la óptica."))
  it("entregados: nada que decir", () => expect(proximoPasoLentes({ estado: "entregada" }, HOY)).toBe(""))
})
