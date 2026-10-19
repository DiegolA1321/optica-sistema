// Clases y textos que comparten las pestañas de Ventas (regla 18).
// Botón de la acción de un vacío o de una fila: el principal es azul de la marca; el secundario, blanco con borde.
export const CLASE_ACCION_PRINCIPAL = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60"
export const CLASE_ACCION_SECUNDARIA = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60"

// Texto de una cantidad con su unidad: "1 orden", "3 órdenes".
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

export const BOTON_CERRAR = "rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"

// El color de cada estado de una orden de laboratorio (regla 14): enviada = en curso, lista = terminada, atrasada = urgente.
export const TONO_ESTADO_ORDEN = { enviada: "azul", lista: "verde", entregada: "gris", cancelada: "gris", atrasada: "rojo" }

// Las columnas de la lista de comprobantes, iguales en el encabezado y en cada fila (regla 1): en el módulo con el paciente; en el perfil, sin él.
export const COLUMNAS_COMPROBANTES = "lg:grid-cols-[5rem_6.5rem_minmax(0,1.4fr)_6rem_9.5rem_11.5rem_5.5rem]"
// Las columnas se reparten el ancho (fr con mínimos): en una pantalla grande el contenido se reparte y el centro de la fila no queda vacío.
export const COLUMNAS_COMPROBANTES_PERFIL = "lg:grid-cols-[minmax(5rem,0.7fr)_minmax(6.5rem,0.8fr)_minmax(6rem,0.7fr)_minmax(9.5rem,1fr)_minmax(0,1.6fr)_5.5rem]"
export const ENCABEZADO_COMPROBANTES = [{ texto: "Número" }, { texto: "Fecha" }, { texto: "Paciente" }, { texto: "Total", derecha: true }, { texto: "Estado" }, { texto: "Factura electrónica" }, { texto: "" }]
export const ENCABEZADO_COMPROBANTES_PERFIL = [{ texto: "Número" }, { texto: "Fecha" }, { texto: "Total", derecha: true }, { texto: "Estado" }, { texto: "Factura electrónica" }, { texto: "" }]
