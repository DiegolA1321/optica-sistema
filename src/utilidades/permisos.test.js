import { describe, it, expect } from "vitest"
import { mensajeDeError, MENSAJE_SIN_PERMISO } from "./permisos"

describe("mensajeDeError", () => {
  it("un permiso negado se dice en español, nunca el error crudo de la base", () => {
    expect(mensajeDeError({ code: "42501", message: "permission denied for table roles" })).toBe(MENSAJE_SIN_PERMISO)
    expect(mensajeDeError({ message: "permission denied for function desactivar_usuario" })).toBe(MENSAJE_SIN_PERMISO)
  })
  it("un error técnico en inglés cae al texto de la acción", () => {
    expect(mensajeDeError({ message: 'null value in column "nombre" violates not-null constraint' }, "No se pudo guardar.")).toBe("No se pudo guardar.")
    expect(mensajeDeError({ message: "JWT expired" }, "No se pudo guardar.")).toBe("No se pudo guardar.")
  })
  it("el mensaje en español de nuestras propias funciones se conserva", () => {
    expect(mensajeDeError({ message: "No puedes desactivar al administrador principal." })).toBe("No puedes desactivar al administrador principal.")
  })
  it("sin error devuelve el texto por defecto", () => {
    expect(mensajeDeError(null, "x")).toBe("x")
  })
})
