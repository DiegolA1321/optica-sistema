import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import Inicio from "./Inicio"
import { hoyISO } from "../utilidades/disponibilidad"

// Los números del día son los mismos en todas partes del Inicio, con cualquier dato: la agenda, las tarjetas y el desenlace cuentan lo mismo.
// Los datos se generan con una semilla fija (cada corrida es igual) y se cuentan aquí con un cálculo independiente del que usa la pantalla.
const hoy = hoyISO()
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const semilla = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const ESTADOS = ["Pendiente", "Pendiente", "En Espera", "En Atención", "Atendida", "Atendida", "No Asistió", "Cancelada"]
const YO = "u1"

function generarCitas(azar) {
  const n = Math.floor(azar() * 13) // de 0 a 12 citas
  return Array.from({ length: n }, (_, i) => {
    const quien = azar()
    const minutos = Math.floor(azar() * 9 * 2) // cada media hora, de 08:00 a 16:30
    const h24 = 8 + Math.floor(minutos / 2), m = minutos % 2 ? "30" : "00"
    const h12 = h24 % 12 || 12
    return {
      id: "c" + i, paciente: "Paciente " + i, pacienteId: "p" + i,
      fecha: azar() < 0.75 ? hoy : azar() < 0.5 ? dia(-1) : dia(1),
      hora: `${String(h12).padStart(2, "0")}:${m} ${h24 >= 12 ? "PM" : "AM"}`,
      estado: ESTADOS[Math.floor(azar() * ESTADOS.length)],
      asignadoA: quien < 0.5 ? YO : quien < 0.7 ? "otra" : undefined,
      atendidoPor: azar() < 0.2 ? YO : undefined,
    }
  })
}

const propias = (c) => c.asignadoA === YO || c.atendidoPor === YO || (!c.asignadoA && !c.atendidoPor)
const optometra = { usuario: { id: YO, rol: "asistente", nombre: "Paula", opticaId: "o1", permisosNivel: { citas: ["ver", "crear"], consultas: ["ver", "crear"] } }, vista: { id: "r", nombre: "Rol", tipo: "rol", inicio: "optometra", permisos: { citas: ["ver", "crear"], consultas: ["ver", "crear"] }, alcance: {} } }
const base = { nombreUsuario: "Paula", pacientes: [], consultas: [], inventario: [], pases: [], facturasVenta: [], abonos: [], ordenesLab: [] }
const cita = (n) => `${n} ${n === 1 ? "cita" : "citas"}`
const ID_FILAS = "[data-cita-id]"

describe("Los números del día coinciden en todo el Inicio, con cualquier dato", () => {
  it("optómetra: mis citas de hoy = agenda = desenlace de hoy; en espera, fichas y siguiente paciente cuadran", () => {
    const azar = semilla(20261010)
    for (let corrida = 0; corrida < 40; corrida++) {
      const citas = generarCitas(azar)
      const hoyMias = citas.filter((c) => c.fecha === hoy && propias(c))
      const vigentes = hoyMias.filter((c) => c.estado !== "Cancelada")
      const cuenta = (e) => vigentes.filter((c) => c.estado === e).length
      const esperados = {
        total: vigentes.length, atendidas: cuenta("Atendida"), noAsistio: cuenta("No Asistió"),
        pendientes: cuenta("Pendiente") + cuenta("En Espera") + cuenta("En Atención"), enEspera: cuenta("En Espera"),
        fichas: vigentes.filter((c) => c.estado === "En Atención" && c.atendidoPor === YO).length,
        canceladas: hoyMias.filter((c) => c.estado === "Cancelada").length,
      }
      const contexto = `corrida ${corrida}: ${JSON.stringify(citas.map((c) => [c.fecha === hoy ? "hoy" : c.fecha, c.estado, c.asignadoA || "-", c.atendidoPor || "-"]))}`
      const { container } = render(<Inicio {...base} citas={citas} {...optometra} />)

      // 1. Desenlace de hoy: "N citas = atendidas + no asistieron + pendientes"; las partes suman el total; las canceladas aparte
      const desenlace = screen.getByRole("region", { name: "Desenlace de mis citas · hoy" })
      expect(desenlace.textContent, contexto).toContain(`${cita(esperados.total)} = ${esperados.atendidas} + ${esperados.noAsistio} + ${esperados.pendientes}`)
      expect(esperados.atendidas + esperados.noAsistio + esperados.pendientes, contexto).toBe(esperados.total)
      if (esperados.canceladas > 0) expect(desenlace.textContent, contexto).toContain(`${esperados.canceladas} ${esperados.canceladas === 1 ? "cancelada aparte" : "canceladas aparte"}`)

      // 2. La agenda: su título cuenta lo mismo, tiene tantas filas como citas y cuenta cuántos esperan
      if (esperados.total > 0) {
        const agenda = screen.getByRole("region", { name: "Mi agenda de hoy" })
        const titulo = within(agenda).getByRole("heading", { level: 2 }).textContent
        expect(titulo, contexto).toContain(`Mi agenda de hoy · ${cita(esperados.total)}`)
        expect(agenda.querySelectorAll(ID_FILAS).length, contexto).toBe(esperados.total)
        if (esperados.enEspera > 0) expect(titulo, contexto).toContain(`${esperados.enEspera} en espera`)
        else expect(titulo, contexto).not.toContain("en espera")

        // 3. El siguiente paciente es de la agenda y quien ya llegó va antes que quien está pendiente
        const hero = screen.getByLabelText("Siguiente paciente")
        const porVenir = vigentes.filter((c) => !["Atendida", "No Asistió", "En Atención"].includes(c.estado))
        if (porVenir.length > 0) {
          const espera = porVenir.filter((c) => c.estado === "En Espera")
          if (espera.length > 0) expect(espera.some((c) => hero.textContent.includes(c.paciente)), contexto).toBe(true)
          else expect(porVenir.some((c) => hero.textContent.includes(c.paciente)), contexto).toBe(true)
          expect(agenda.textContent.includes("Siguiente"), contexto).toBe(true)
        }
      }

      // 4. Las fichas sin terminar: su tarjeta cuenta las de hoy, aparece solo si hay y nunca supera a los pendientes del desenlace
      const tarjetaFichas = container.querySelector('[aria-label="Fichas sin terminar"]')
      if (esperados.fichas > 0) {
        expect(tarjetaFichas, contexto).not.toBeNull()
        expect(tarjetaFichas.textContent, contexto).toContain(String(esperados.fichas))
        expect(esperados.fichas, contexto).toBeLessThanOrEqual(esperados.pendientes)
      } else {
        expect(tarjetaFichas, contexto).toBeNull()
      }
      cleanup()
    }
  })

  it("administrador: 'Citas del día' lista todas las del día (sin canceladas) y su número es el del desenlace", () => {
    const azar = semilla(7)
    for (let corrida = 0; corrida < 40; corrida++) {
      const citas = generarCitas(azar)
      const vigentes = citas.filter((c) => c.fecha === hoy && c.estado !== "Cancelada")
      const contexto = `corrida ${corrida}`
      render(<Inicio {...base} citas={citas} usuario={{ id: "a1", rol: "admin", nombre: "Ana", opticaId: "o1" }} />)
      const desenlace = screen.getByRole("region", { name: "Desenlace de las citas · hoy" })
      const atendidas = vigentes.filter((c) => c.estado === "Atendida").length
      const noAsistio = vigentes.filter((c) => c.estado === "No Asistió").length
      expect(desenlace.textContent, contexto).toContain(`${cita(vigentes.length)} = ${atendidas} + ${noAsistio} + ${vigentes.length - atendidas - noAsistio}`)
      const lista = screen.getByRole("region", { name: "Citas del día" })
      expect(lista.querySelectorAll(ID_FILAS).length, contexto).toBe(Math.min(vigentes.length, 8)) // se ven las primeras ocho; el resto está en Citas
      if (vigentes.length > 8) expect(lista.textContent, contexto).toContain(`Primeras 8 de ${vigentes.length}`)
      else if (vigentes.length > 0) expect(lista.textContent, contexto).toContain(cita(vigentes.length))
      cleanup()
    }
  })
})
