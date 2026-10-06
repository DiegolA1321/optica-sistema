import { describe, it, expect } from "vitest"
import { puedeNivel, normalizarPermisosRol, unirPermisos, alcanceDeRoles, modulosVisibles, permisosCompletos, resumenPermisos, menuDePermisos } from "./roles"
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
