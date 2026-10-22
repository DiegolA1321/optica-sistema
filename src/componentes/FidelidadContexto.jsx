"use client"

// El programa de fidelización a la mano de cualquier pantalla (Resumen del paciente, «Nueva venta», CRM): el Dashboard lo arma con los datos que ya tiene (pacientes, consultas, comprobantes y
// abonos) y cada pantalla pide `useFidelidad()`. Una sola cuenta (utilidades/programaFidelidad.js). Sin proveedor (una pantalla probada sola) devuelve la regla por defecto sin datos.
import { createContext, useContext } from "react"
import { PROGRAMA_POR_DEFECTO, puntosDe, nivelDe, beneficioDe } from "../utilidades/programaFidelidad"

const Contexto = createContext(null)
export const ProveedorFidelidad = Contexto.Provider

const SIN_PROVEEDOR = {
  programa: PROGRAMA_POR_DEFECTO,
  de: (paciente) => { const puntos = puntosDe({ paciente, programa: PROGRAMA_POR_DEFECTO }); return { puntos, ...nivelDe(puntos.total, PROGRAMA_POR_DEFECTO), beneficio: null } },
}
export const useFidelidad = () => useContext(Contexto) || SIN_PROVEEDOR

// Para las pantallas que reciben sus propios datos: con el programa de la óptica, o (sin proveedor) con lo que reciben.
export function useFidelidadCon({ pacientes, consultas, facturas = [], abonos = [] }) {
  const ctx = useFidelidad()
  return ctx.real ? ctx : armarFidelidad({ programa: ctx.programa, pacientes, consultas, facturas, abonos })
}

// { programa, de(paciente) → { puntos: { total, consultas, referidos, compras }, nivel, siguiente, faltan, beneficio } }
export function armarFidelidad({ programa, pacientes, consultas, facturas, abonos }) {
  return {
    programa,
    real: true, // armado con los datos de la óptica (sin esto, una pantalla probada sola calcula con lo que ella misma recibe)
    de: (paciente) => {
      const datos = { paciente, consultas, pacientes, facturas, abonos }
      const puntos = puntosDe({ ...datos, programa })
      return { puntos, ...nivelDe(puntos.total, programa), beneficio: beneficioDe(datos, programa) }
    },
  }
}
