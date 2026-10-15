// A dónde lleva el "Abrir en …" de cada lista de Reportes: el módulo con el mismo período y los mismos filtros, para que se vea
// el mismo número. Si el módulo no puede reproducir los filtros (Ventas y Pacientes no filtran por motivo, origen, visita o
// profesional), el texto lo dice (regla 42: un enlace que no puede llevar a lo mismo dice adónde lleva).
export function crearDestinos(r) {
  const { rango, paramsFiltros, hay } = r
  const sinFiltros = hay ? " (sin los filtros)" : ""
  return {
    // estado: todas | atendida | noAsistio | cancelada | abiertas (pendiente, en espera y en atención)
    citas: (estado, r2 = rango) => ({ modulo: "citas", etiqueta: "Abrir en Citas", params: { estado, desde: r2.inicio, hasta: r2.fin, ...paramsFiltros } }),
    // Los comprobantes de Ventas: estado (vigentes | saldo | pagadas), período y, si se pide, solo los sin factura electrónica.
    ventas: (extra = {}, r2 = rango) => ({ modulo: "ventas", etiqueta: `Abrir en Ventas${sinFiltros}`, params: { tab: "comprobantes", estado: "todos", desde: r2.inicio, hasta: r2.fin, ...extra } }),
    ordenes: (filtro) => ({ modulo: "ventas", etiqueta: "Abrir en Ventas", params: { tab: "ordenes", filtro } }),
    // Inventario no tiene filtros que reproduzcan estas listas: abre la lista completa y el texto lo dice (regla 42).
    inventario: () => ({ modulo: "inventario", etiqueta: "Abrir Inventario (lista completa)", params: {} }),
    cola: () => ({ modulo: "ventas", etiqueta: "Abrir en Ventas", params: { tab: "porvender" } }),
    // Pacientes registrados en el período (su fecha de registro).
    pacientesNuevos: (r2 = rango) => ({ modulo: "pacientes", etiqueta: `Abrir en Pacientes${sinFiltros}`, params: { accion: "filtrar", desde: r2.inicio, hasta: r2.fin } }),
    pacientes: (params = {}, etiqueta = "Abrir en Pacientes") => ({ modulo: "pacientes", etiqueta: `${etiqueta}${sinFiltros}`, params: { accion: "filtrar", ...params } }),
    // Las consultas no tienen una lista propia en otro módulo: se abre la lista de pacientes y el texto lo dice.
    consultas: () => ({ modulo: "pacientes", etiqueta: "Abrir Pacientes (lista completa)", params: { accion: "filtrar" } }),
  }
}
