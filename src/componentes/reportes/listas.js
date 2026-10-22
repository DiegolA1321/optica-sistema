// Las columnas esenciales de cada lista que se abre al pulsar un número de Reportes. Lo demás va en "Exportar".
// La columna sin `ancho` es la elástica (el nombre del paciente): recorta con puntos suspensivos y muestra el nombre completo al pasar el cursor.
import { fechaLegible } from "../../utilidades/formatoFecha"
import { dinero } from "../../utilidades/formatoMoneda"
import { etiquetaEstadoCita } from "../../utilidades/estadosCita"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { numeroOrden, estaAtrasada, ETIQUETA_ESTADO } from "../../utilidades/ordenesLaboratorio"
import { categoriasDeConsulta } from "../../utilidades/reportesDiagnosticos"
import { diasVencido } from "../../utilidades/fidelizacion"
import { cobradoDeFactura } from "../../utilidades/vendidoCobrado"
import { saldoDeFactura, nombreMetodo } from "../../utilidades/reportesDatos"
import { comoLlego } from "../../utilidades/comoLlego"

const FECHA = 124, MONTO = 116, ESTADO = 116

// Una columna para un Excel de datos resumidos: su título, cómo se calcula de cada fila y su tipo (texto, fecha, dinero, entero, tasa, decimal).
export const col = (titulo, fn, tipo = "texto") => ({ titulo, tipo, valor: (f) => String(fn(f) ?? ""), ...(tipo === "texto" ? {} : { crudo: fn }) })

export function crearColumnas({ pacientes = [], abonos = [], historial = [] }) {
  const porId = new Map(pacientes.map((p) => [p.id, p]))
  const nombre = (id, respaldo = "") => porId.get(id)?.nombre || respaldo || "—"
  const estadoOrden = (o) => (estaAtrasada(o) ? ETIQUETA_ESTADO.atrasada : ETIQUETA_ESTADO[o.estado] || o.estado)
  const cobradoDe = (f) => (f.estado === "anulada" ? 0 : cobradoDeFactura(f, abonos))
  return {
    nombre,
    consulta: [
      { titulo: "Fecha", ancho: FECHA, valor: (f) => fechaLegible(f.fecha), tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Paciente", valor: (f) => nombre(f.pacienteId, f.paciente) },
      { titulo: "Motivo", ancho: 160, valor: (f) => f.motivo || "—" },
      { titulo: "Diagnóstico", ancho: 170, valor: (f) => categoriasDeConsulta(f).join(", ") || "—" },
    ],
    pacienteNuevo: [
      { titulo: "Registro", ancho: FECHA, valor: (f) => fechaLegible(f.fechaRegistro), tipo: "fecha", crudo: (f) => f.fechaRegistro },
      { titulo: "Paciente", valor: (f) => f.nombre },
      { titulo: "Teléfono", ancho: 130, valor: (f) => f.telefono || "—" },
      { titulo: "Cédula", ancho: 130, valor: (f) => f.cedula || "—" },
      { titulo: "Cómo llegó", ancho: 190, valor: (f) => comoLlego(f, pacientes).texto },
    ],
    cita: [
      { titulo: "Fecha", ancho: FECHA, valor: (f) => fechaLegible(f.fecha), tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Hora", ancho: 100, valor: (f) => f.hora || "—" },
      { titulo: "Paciente", valor: (f) => f.paciente || nombre(f.pacienteId) },
      { titulo: "Motivo", ancho: 150, valor: (f) => f.motivo || "—" },
      { titulo: "Estado", ancho: ESTADO, valor: (f) => etiquetaEstadoCita(f.estado) },
    ],
    citaCancelada: [
      { titulo: "Fecha", ancho: FECHA, valor: (f) => fechaLegible(f.fecha), tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Paciente", valor: (f) => f.paciente || nombre(f.pacienteId) },
      { titulo: "Cancelada por", ancho: 140, valor: (f) => (f.canceladaPor === "paciente" ? "El paciente" : "La óptica") },
      { titulo: "Estado", ancho: ESTADO, valor: (f) => etiquetaEstadoCita(f.estado) },
    ],
    factura: [
      { titulo: "Comprobante", ancho: 148, valor: (f) => (f.numero == null ? "Venta suelta" : numeroComprobante(f.numero)) },
      { titulo: "Paciente", valor: (f) => nombre(f.pacienteId) },
      { titulo: "Total", ancho: MONTO, derecha: true, valor: (f) => dinero(f.montoTotal), tipo: "dinero", crudo: (f) => Number(f.montoTotal) || 0 },
      { titulo: "Saldo", ancho: MONTO, derecha: true, valor: (f) => dinero(saldoDeFactura(f, cobradoDe(f))), tipo: "dinero", crudo: (f) => saldoDeFactura(f, cobradoDe(f)) },
      { titulo: "Estado", ancho: ESTADO, valor: (f) => (f.estado === "anulada" ? "Anulada" : f.estado === "pendiente_pago" ? "Con saldo" : "Pagada") },
    ],
    // Una fila por pago: { fecha, monto, factura }
    pago: [
      { titulo: "Fecha", ancho: FECHA, valor: (f) => fechaLegible(f.fecha), tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Paciente", valor: (f) => (f.factura ? nombre(f.factura.pacienteId) : "Venta sin comprobante") },
      { titulo: "Comprobante", ancho: 148, valor: (f) => (f.factura ? numeroComprobante(f.factura.numero) : "—") },
      { titulo: "Monto", ancho: MONTO, derecha: true, valor: (f) => dinero(f.monto), tipo: "dinero", crudo: (f) => f.monto },
      { titulo: "Método", ancho: 120, valor: (f) => nombreMetodo(f.factura?.metodoPago) },
    ],
    // Una fila por línea vendida: { factura, linea, cantidad }
    linea: [
      { titulo: "Comprobante", ancho: 148, valor: (f) => numeroComprobante(f.factura.numero) },
      { titulo: "Paciente", valor: (f) => nombre(f.factura.pacienteId) },
      { titulo: "Detalle", ancho: 170, valor: (f) => f.linea.descripcion || "—" },
      { titulo: "Cantidad", ancho: 96, derecha: true, valor: (f) => f.cantidad, tipo: "entero" },
    ],
    paciente: [
      { titulo: "Paciente", valor: (f) => f.nombre },
      { titulo: "Teléfono", ancho: 140, valor: (f) => f.telefono || "—" },
      { titulo: "Cédula", ancho: 130, valor: (f) => f.cedula || "—" },
    ],
    controlVencido: [
      { titulo: "Paciente", valor: (f) => f.nombre },
      { titulo: "Teléfono", ancho: 140, valor: (f) => f.telefono || "—" },
      { titulo: "Días de retraso", ancho: 140, derecha: true, valor: (f) => diasVencido(f, historial) ?? "—" },
    ],
    // Una fila por control: { paciente, consulta, fechaControl, agendo }
    control: [
      { titulo: "Paciente", valor: (f) => f.paciente.nombre },
      { titulo: "Teléfono", ancho: 140, valor: (f) => f.paciente.telefono || "—" },
      { titulo: "Control era el", ancho: FECHA + 16, valor: (f) => fechaLegible(f.fechaControl), tipo: "fecha", crudo: (f) => f.fechaControl },
      { titulo: "¿Agendó?", ancho: 100, valor: (f) => (f.agendo ? "Sí" : "No") },
    ],
    orden: [
      { titulo: "Orden", ancho: 100, valor: (f) => numeroOrden(f.numero) },
      { titulo: "Paciente", valor: (f) => nombre(f.pacienteId) },
      { titulo: "Laboratorio", ancho: 150, valor: (f) => f.laboratorio || "Sin laboratorio" },
      { titulo: "Prometida", ancho: FECHA, valor: (f) => (f.fechaPrometida ? fechaLegible(f.fechaPrometida) : "—") },
      { titulo: "Estado", ancho: 130, valor: estadoOrden },
    ],
    // Los atendidos con receta y si compraron (los ids salen del embudo).
    consultaCompra: (compraron) => [
      { titulo: "Fecha", ancho: FECHA, valor: (f) => fechaLegible(f.fecha), tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Paciente", valor: (f) => nombre(f.pacienteId, f.paciente) },
      { titulo: "Motivo", ancho: 160, valor: (f) => f.motivo || "—" },
      { titulo: "¿Compró?", ancho: 100, valor: (f) => (compraron.has(f.id) ? "Sí" : "No") },
    ],
  }
}
