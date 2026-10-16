// Lo que el Resumen del superadmin necesita además de lo que el panel ya carga: todas las facturas de suscripción, las suspensiones y
// reactivaciones (para saber cuántas ópticas había activas en cada fecha) y el último ingreso y el uso de cada óptica (función
// `datos_negocio_superadmin` de la migración 0119). Si la función aún no existe en la base, el resto sigue funcionando y se dice "sin dato".
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

const TAMANO = 1000

// PostgREST entrega como máximo 1000 filas por consulta: se pide por tramos hasta que llegue uno incompleto.
async function leerTodo(armar) {
  const filas = []
  for (let desde = 0; desde < 20000; desde += TAMANO) {
    const { data, error } = await armar().range(desde, desde + TAMANO - 1)
    if (error) return { datos: filas, error }
    filas.push(...(data || []))
    if ((data || []).length < TAMANO) break
  }
  return { datos: filas, error: null }
}

export default function useDatosNegocio() {
  const [estado, setEstado] = useState({ cargando: true, facturas: [], eventos: [], personas: [], uso: [], sinServidor: false, error: "" })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    ;(async () => {
      const [fact, ev, rpc] = await Promise.all([
        leerTodo(() => supabase.from("facturas").select("id, optica_id, numero, periodo, monto, estado, emitida_at, pagada_at").order("emitida_at", { ascending: false })),
        leerTodo(() => supabase.from("auditoria").select("id, optica_id, accion, created_at").in("accion", ["suspender_optica", "reactivar_optica"]).order("created_at", { ascending: false })),
        supabase.rpc("datos_negocio_superadmin"),
      ])
      if (!vigente) return
      setEstado({
        cargando: false,
        facturas: fact.datos,
        eventos: ev.datos,
        personas: rpc.data?.personas || [],
        uso: rpc.data?.opticas || [],
        sinServidor: !!rpc.error,
        error: fact.error?.message || ev.error?.message || "",
      })
    })()
    return () => { vigente = false }
  }, [version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { ...estado, recargar }
}
