import { describe, it, expect, vi, beforeEach } from "vitest"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: (...a) => rpc(...a) } }))
import { cambiarPermisosPaciente, leerMisPermisos, cambiarMisPermisos } from "./permisosMensajes"

beforeEach(() => rpc.mockReset())

describe("permisos para recibir mensajes", () => {
  it("el personal cambia solo el permiso que toca", async () => {
    rpc.mockResolvedValue({ data: {}, error: null })
    expect(await cambiarPermisosPaciente("p1", { promociones: true })).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith("cambiar_consentimiento_paciente", { p_paciente_id: "p1", p_recordatorios: null, p_promociones: true, p_origen: "personal" })
  })
  it("un rechazo del servidor llega con sus palabras; un error de red, con un mensaje general", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "No tienes permiso para cambiar los permisos de mensajes." } })
    expect((await cambiarPermisosPaciente("p1", { promociones: true })).error).toBe("No tienes permiso para cambiar los permisos de mensajes.")
    rpc.mockResolvedValueOnce({ data: null, error: { message: "TypeError: Failed to fetch" } })
    expect((await cambiarPermisosPaciente("p1", { promociones: true })).error).toMatch(/Revisa tu conexión/)
  })
  it("el paciente lee y cambia sus permisos con su sesión; con la sesión vencida se lo dice", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, recordatorios: true, promociones: false, actualizado_en: null }, error: null })
    expect(await leerMisPermisos("p1", "tok")).toEqual({ ok: true, recordatorios: true, promociones: false, actualizadoEn: null })
    expect(rpc).toHaveBeenCalledWith("mis_permisos_mensajes", { p_paciente_id: "p1", p_token: "tok" })
    rpc.mockResolvedValueOnce({ data: { ok: true, recordatorios: true, promociones: true, actualizado_en: "2026-10-15T10:00:00Z" }, error: null })
    expect(await cambiarMisPermisos("p1", "tok", { promociones: true })).toMatchObject({ ok: true, promociones: true })
    expect(rpc).toHaveBeenLastCalledWith("actualizar_consentimiento_paciente", { p_paciente_id: "p1", p_token: "tok", p_recordatorios: null, p_promociones: true })
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "sesion" }, error: null })
    expect((await cambiarMisPermisos("p1", "viejo", { promociones: false })).error).toMatch(/sesión venció/)
  })
})
