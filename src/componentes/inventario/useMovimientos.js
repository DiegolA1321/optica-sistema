import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

// Un movimiento del kárdex tal como lo usa la pantalla (la tabla es `movimientos_inventario`, migración 0111).
export const COLUMNAS_MOVIMIENTO = "id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia, usuario_id, usuario_nombre, created_at, seq"
export const mapMovimiento = (m) => ({
  id: m.id, seq: m.seq, productoId: m.producto_id, tipo: m.tipo, cantidad: Number(m.cantidad) || 0, stockResultante: Number(m.stock_resultante) || 0,
  motivo: m.motivo || "", referencia: m.referencia || null, usuarioId: m.usuario_id || null, usuarioNombre: m.usuario_nombre || "", creadoEn: m.created_at,
})

// De más reciente a más antiguo (la fecha y, si coincide, el orden de registro).
export const masRecientePrimero = (a, b) => (a.creadoEn === b.creadoEn ? (b.seq || 0) - (a.seq || 0) : a.creadoEn < b.creadoEn ? 1 : -1)

const TOPE = 300

// El historial de un producto. Se pide al abrir su detalle y otra vez cuando algo lo cambia (`version`). Sin base de datos (pruebas) queda vacío.
export function useMovimientos(productoId, version = 0) {
  const [estado, setEstado] = useState({ movimientos: [], cargando: !!productoId && !!supabase, error: "", hayMas: false })
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!productoId || !supabase) { setEstado({ movimientos: [], cargando: false, error: "", hayMas: false }); return }
    let vivo = true
    setEstado((e) => ({ ...e, cargando: true, error: "" }))
    supabase.from("movimientos_inventario").select(COLUMNAS_MOVIMIENTO).eq("producto_id", productoId)
      .order("created_at", { ascending: false }).order("seq", { ascending: false }).limit(TOPE + 1)
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) { setEstado({ movimientos: [], cargando: false, error: "No se pudo cargar el historial. Revisa tu conexión e intenta de nuevo.", hayMas: false }); return }
        const filas = (data || []).map(mapMovimiento)
        setEstado({ movimientos: filas.slice(0, TOPE), cargando: false, error: "", hayMas: filas.length > TOPE })
      })
    return () => { vivo = false }
  }, [productoId, version, intento])
  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  return { ...estado, recargar }
}

const PAGINA = 1000
const MAXIMO = 20000

// Todos los movimientos de la óptica (los más recientes primero), para la pestaña Inventario de Reportes y sus exportaciones. Se piden por páginas
// de 1000 solo cuando `activo` se vuelve verdadero (una sola vez); si hay más de 20 000, avisa que faltan los más antiguos.
export function useTodosLosMovimientos(activo) {
  const [estado, setEstado] = useState({ movimientos: [], cargando: false, error: "", truncado: false, listo: false })
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!activo || !supabase) return
    let vivo = true
    setEstado((e) => ({ ...e, cargando: true, error: "" }))
    ;(async () => {
      const todos = []
      let truncado = false
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase.from("movimientos_inventario").select(COLUMNAS_MOVIMIENTO)
          .order("created_at", { ascending: false }).order("seq", { ascending: false }).range(desde, desde + PAGINA - 1)
        if (!vivo) return
        if (error) { setEstado({ movimientos: [], cargando: false, error: "No se pudieron cargar los movimientos del inventario. Revisa tu conexión e intenta de nuevo.", truncado: false, listo: false }); return }
        todos.push(...(data || []).map(mapMovimiento))
        if ((data || []).length < PAGINA) break
        if (todos.length >= MAXIMO) { truncado = true; break }
      }
      if (vivo) setEstado({ movimientos: todos, cargando: false, error: "", truncado, listo: true })
    })()
    return () => { vivo = false }
  }, [activo, intento])
  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  // Entre que se pide y llega el primer resultado ya se cuenta como cargando (sin un parpadeo con datos vacíos).
  const cargando = estado.cargando || (activo && !!supabase && !estado.listo && !estado.error)
  return { ...estado, cargando, recargar }
}
