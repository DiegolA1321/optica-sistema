import { describe, it, expect } from "vitest"
import { puedeNivel, normalizarPermisosRol, unirPermisos, alcanceDeRoles, alcanceDeRolNuevo, alcanceParaGuardar, partirDeRol, alcanceDe, OPCIONES_ALCANCE, modulosVisibles, permisosCompletos, resumenPermisos, menuDePermisos } from "./roles"
import { validarClaveNueva, MENSAJE_CLAVE_SEGURA } from "./validaciones"

describe("roles y permisos por nivel", () => {
  it("un nivel implica ver y se descartan módulos o niveles que no existen", () => {
    expect(normalizarPermisosRol({ pacientes: ["editar"], magia: ["ver"], reportes: ["eliminar"] })).toEqual({ pacientes: ["ver", "editar"] })
    expect(normalizarPermisosRol({ citas: [] })).toEqual({})
  })
  it("puedeNivel solo concede lo que está escrito", () => {
    const p = { inventario: ["ver"], pacientes: ["ver", "crear"] }
    expect(puedeNivel(p, "inventario", "ver")).toBe(true)
    expect(puedeNivel(p, "inventario", "crear")).toBe(false)
    expect(puedeNivel(p, "citas", "ver")).toBe(false)
    expect(puedeNivel(undefined, "citas")).toBe(false)
  })
  it("los permisos de varios roles se suman", () => {
    const suma = unirPermisos([{ inventario: ["ver"], citas: ["ver", "crear"] }, { inventario: ["ver", "crear", "editar"] }])
    expect(suma.inventario).toEqual(["ver", "crear", "editar"])
    expect(suma.citas).toEqual(["ver", "crear"])
  })
  it("el alcance más amplio gana, y sin rol que dé acceso es todo", () => {
    const optometra = { permisos: { citas: ["ver"] }, alcance: { citas: "propio" } }
    const recepcion = { permisos: { citas: ["ver"] }, alcance: {} }
    expect(alcanceDeRoles([optometra], "citas")).toBe("propio")
    expect(alcanceDeRoles([optometra, recepcion], "citas")).toBe("todo")
    expect(alcanceDeRoles([optometra], "reportes")).toBe("todo")
  })
  it("el alcance «los que atiende» está entre «solo las suyas» y «toda la óptica»", () => {
    const atiende = { permisos: { consultas: ["ver"] }, alcance: { consultas: "atiende" } }
    const suyas = { permisos: { consultas: ["ver"] }, alcance: { consultas: "propio" } }
    const todo = { permisos: { consultas: ["ver"] }, alcance: {} }
    expect(alcanceDeRoles([suyas, atiende], "consultas")).toBe("atiende")
    expect(alcanceDeRoles([suyas, atiende, todo], "consultas")).toBe("todo")
    expect(OPCIONES_ALCANCE.consultas.map((o) => o.id)).toEqual(["propio", "atiende", "todo"])
    expect(OPCIONES_ALCANCE.citas.map((o) => o.id)).not.toContain("atiende")
  })
  it("un rol nuevo parte de lo más restrictivo; lo que se guarda lleva el alcance de cada módulo que el rol tiene", () => {
    expect(alcanceDeRolNuevo()).toEqual({ citas: "propio", consultas: "propio", reportes: "propio" })
    expect(alcanceParaGuardar({ citas: "propio", consultas: "atiende" }, { citas: ["ver"], consultas: ["ver"] })).toEqual({ citas: "propio", consultas: "atiende" })
    expect(alcanceParaGuardar({ citas: "propio" }, { pacientes: ["ver"] })).toEqual({}) // sin citas ni fichas ni reportes no hay alcance que guardar
    expect(alcanceDe({}, "citas")).toBe("todo") // un valor ausente vale «toda la óptica», como en la base
  })
  it("«Partir de» un rol copia sus permisos, su alcance y si atiende pacientes", () => {
    const optometra = { permisos: { citas: ["ver", "crear"], consultas: ["editar"] }, alcance: { citas: "propio", consultas: "atiende" }, atiende_pacientes: true, inicio: "optometra" }
    expect(partirDeRol(optometra)).toEqual({ permisos: { citas: ["ver", "crear"], consultas: ["ver", "editar"] }, alcance: { citas: "propio", consultas: "atiende", reportes: "todo" }, atiende: true, inicio: "optometra" })
  })
  it("el menú sale de lo que se puede ver", () => {
    const p = normalizarPermisosRol({ citas: ["ver"], inventario: ["ver", "crear"], mensajes: [] })
    expect(menuDePermisos(p)).toEqual(["Citas médicas", "Inventario"])
    expect(modulosVisibles(p).citas).toBe(true)
    expect(modulosVisibles(p).pacientes).toBe(false)
    expect(Object.keys(permisosCompletos())).toContain("ventas")
  })
  it("resume lo que puede hacer", () => {
    expect(resumenPermisos({ inventario: ["ver"], pacientes: ["ver", "crear", "editar"] })).toEqual([
      { modulo: "Pacientes", texto: "ver, crear, editar" },
      { modulo: "Inventario", texto: "solo ver" },
    ])
  })
})

describe("regla de contraseña única", () => {
  it("exige 8 caracteres con letras y números en todas las formas de crear cuentas", () => {
    expect(validarClaveNueva("123456")).toBe(MENSAJE_CLAVE_SEGURA)
    expect(validarClaveNueva("soloLetras")).toBe(MENSAJE_CLAVE_SEGURA)
    expect(validarClaveNueva("corta1")).toBe(MENSAJE_CLAVE_SEGURA)
    expect(validarClaveNueva("Segura123")).toBe("")
  })
})

describe("clave temporal del portal", () => {
  it("siempre cumple la regla de contraseña", async () => {
    const { generarClaveTemporal } = await import("./validaciones")
    for (let i = 0; i < 300; i++) expect(validarClaveNueva(generarClaveTemporal())).toBe("")
  })
})

describe("menú con Ventas (Bloque E)", () => {
  it("Ventas aparece en el menú entre Pacientes y Inventario según el permiso ventas:ver", () => {
    expect(menuDePermisos({ pacientes: ["ver"], ventas: ["ver", "crear"], inventario: ["ver"] })).toEqual(["Pacientes", "Ventas", "Inventario"])
    expect(menuDePermisos({ pacientes: ["ver"], inventario: ["ver"] })).toEqual(["Pacientes", "Inventario"])
  })
})

describe("Mi horario y Horario de la óptica son dos permisos distintos", () => {
  it("'Mi horario' solo se ve (cada quien edita el suyo) y 'Horario de la óptica' se ve o se edita", async () => {
    const { MODULOS_PERMISO } = await import("./roles")
    const mio = MODULOS_PERMISO.find((m) => m.id === "horario")
    const general = MODULOS_PERMISO.find((m) => m.id === "horario_optica")
    expect(mio.nombre).toBe("Mi horario")
    expect(mio.niveles).toEqual(["ver"])
    expect(general.nombre).toBe("Horario de la óptica")
    expect(general.niveles).toEqual(["ver", "editar"])
    expect(general.sensible).toBe(true) // delegarlo es darle a alguien el horario de toda la óptica
  })
})
