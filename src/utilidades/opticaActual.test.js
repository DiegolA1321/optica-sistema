import { describe, it, expect, vi, beforeEach } from "vitest"

const { consultas, fila, publico, principal } = vi.hoisted(() => {
  const consultas = []
  const fila = { id: "o1", slug: "demo", nombre: "Demo" }
  const publico = {
    from: (tabla) => {
      const q = { tabla, filtros: [] }
      consultas.push(q)
      const cadena = {
        select: () => cadena,
        eq: (col, val) => { q.filtros.push([col, val]); return cadena },
        maybeSingle: () => Promise.resolve({ data: q.filtros[0][0] === "slug" && q.filtros[0][1] !== "demo" ? null : fila }),
      }
      return cadena
    },
  }
  const principal = { from: vi.fn(() => { throw new Error("la lectura pública no debe usar el cliente con sesión") }) }
  return { consultas, fila, publico, principal }
})

vi.mock("../lib/supabaseClient", () => ({ supabase: principal, obtenerClientePublico: () => publico }))

import { resolverOpticaPublica, OPTICA_ID_DEFAULT } from "./opticaActual"

describe("resolverOpticaPublica", () => {
  beforeEach(() => { consultas.length = 0 })
  it("lee opticas_publicas con el cliente sin sesión, por slug", async () => {
    expect(await resolverOpticaPublica("demo")).toEqual(fila)
    expect(principal.from).not.toHaveBeenCalled()
    expect(consultas).toHaveLength(1)
    expect(consultas[0]).toMatchObject({ tabla: "opticas_publicas", filtros: [["slug", "demo"]] })
  })
  it("si el slug no existe cae en la óptica por defecto, también sin sesión", async () => {
    expect(await resolverOpticaPublica("no-existe")).toEqual(fila)
    expect(consultas.map((c) => c.filtros[0])).toEqual([["slug", "no-existe"], ["id", OPTICA_ID_DEFAULT]])
    expect(principal.from).not.toHaveBeenCalled()
  })
})
