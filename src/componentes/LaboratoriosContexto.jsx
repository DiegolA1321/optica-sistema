"use client"

// El catálogo de laboratorios de la óptica (Configuración → Laboratorios) a la mano de cualquier pantalla: «Nueva venta», el pedido de lentes y la lista de pedidos eligen el laboratorio del mismo catálogo.
// El Dashboard lo arma con la parametrización y cada pantalla pide `useLaboratorios()`. Sin proveedor (una pantalla probada sola) el catálogo está vacío.
import { createContext, useContext } from "react"
import { laboratoriosActivos, laboratoriosDe } from "../utilidades/laboratorios"

const Contexto = createContext(null)
export const ProveedorLaboratorios = Contexto.Provider
const VACIO = { activos: [], catalogo: [], parametrizacion: null }

// { activos: ["Visión Norte"], catalogo: [{ nombre, activo }], parametrizacion }
export const armarLaboratorios = (parametrizacion) => ({ activos: laboratoriosActivos(parametrizacion), catalogo: laboratoriosDe(parametrizacion), parametrizacion })
export const useLaboratorios = () => useContext(Contexto) || VACIO
