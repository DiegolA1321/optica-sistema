"use client"

// La parametrización de la óptica (Configuración) a la mano de cualquier pantalla: «Nueva venta» toma de ella los días que tarda un pedido en estar listo (Configuración → Ventas).
// El Dashboard la provee y cada pantalla pide `useParametrizacion()`. Sin proveedor (una pantalla probada sola) vale null y se usan los valores por defecto.
import { createContext, useContext } from "react"

const Contexto = createContext(null)
export const ProveedorParametrizacion = Contexto.Provider
export const useParametrizacion = () => useContext(Contexto)
