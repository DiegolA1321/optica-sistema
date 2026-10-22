// Crear el pedido de una venta que incluye algo que se encarga afuera (las lunas), sin ventana intermedia: la entrega («Retira en la óptica» o «Envío a domicilio», con la dirección) y la fecha aproximada en que
// estará listo se eligen en «Nueva venta»; lo demás (la receta, el tipo de luna, la montura y sus medidas) se arma con lo que ya hay en la consulta y en la venta.
import { supabase } from "../lib/supabaseClient"
import { datosInicialesOrden, datosParaRpc, mapOrden, EVENTO_ORDEN } from "./ordenesLaboratorio"
import { datosOrdenDeLinea, lunaDe } from "./comprobantes"
import { medidasTexto } from "./inventarioKardex"
import { sumarDiasISO } from "./controles"
import { hoyISO } from "./disponibilidad"
import { diasDePedido } from "./ventasModulo"

// La fecha aproximada de entrega por defecto: hoy más los días que configure la óptica (Configuración → Ventas), o 7.
export const fechaDePedidoPorDefecto = (parametrizacion, hoy = hoyISO()) => sumarDiasISO(hoy, diasDePedido(parametrizacion))

// Los datos del pedido (lo que recibe crear_orden_laboratorio) a partir de la venta guardada.
export function datosDePedido({ factura, consulta = null, entrega = "retira", direccion = "", fecha, inventario = [] }) {
  const lineaMontura = (factura.lineas || []).find((l) => l.tipo === "producto")
  const producto = lineaMontura?.productoId ? inventario.find((p) => p.id === lineaMontura.productoId) : null
  const base = datosInicialesOrden(consulta, {
    montura: lineaMontura?.descripcion || "", luna: datosOrdenDeLinea(lunaDe(factura.lineas || [])), monturaMedidas: producto ? medidasTexto(producto) : "",
  })
  return { ...base, fechaPrometida: fecha, entrega: entrega === "envio" ? "envio" : "retira", direccionEntrega: entrega === "envio" ? String(direccion || "").trim() : "" }
}

// Crea el pedido en la base y avisa a toda la pantalla (EVENTO_ORDEN). Devuelve { ok, error? }; si falla, la venta ya quedó guardada y el pedido se puede crear desde su detalle.
export async function crearPedidoDeVenta(args) {
  if (!supabase) return { ok: true }
  // Sin la consulta a la mano (una venta suelta), se trae la de la venta para precargar la receta.
  let consulta = args.consulta
  if (!consulta && args.factura.consultaId) {
    const { data } = await supabase.from("consultas").select("datos_clinicos, lente_recomendado").eq("id", args.factura.consultaId).maybeSingle()
    if (data) consulta = { od: data.datos_clinicos?.od, oi: data.datos_clinicos?.oi, medidas: data.datos_clinicos?.medidas, lenteRecomendado: data.lente_recomendado }
  }
  const datos = datosDePedido({ ...args, consulta })
  const { data: id, error } = await supabase.rpc("crear_orden_laboratorio", { p_factura_id: args.factura.id, p_datos: datosParaRpc(datos) })
  if (error) return { ok: false, error }
  const { data: fila } = await supabase.from("ordenes_laboratorio").select("*").eq("id", id).maybeSingle()
  if (fila && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_ORDEN, { detail: mapOrden(fila) }))
  return { ok: true }
}
