// Órdenes de laboratorio (R36-R37, migración 0087): lógica pura. Cuando una venta
// incluye lentes se genera una orden por par; pasa por enviada → lista →
// entregada (o cancelada si se anula la venta). "Atrasada" no es un estado
// guardado: es una orden enviada cuya fecha prometida ya pasó.
import { fechaAISO } from "./disponibilidad"
import { fechaLegible } from "./formatoFecha"

export const MATERIALES_LENTE = ["CR-39", "Policarbonato", "Alto índice 1.67", "Trivex", "Vidrio"]

export const TIPOS_LENTE = [
  { id: "monofocal", label: "Monofocal" },
  { id: "bifocal", label: "Bifocal" },
  { id: "progresivo", label: "Progresivo" },
]

export const ETIQUETA_ESTADO = {
  enviada: "Enviada al laboratorio",
  lista: "Lista para entregar",
  entregada: "Entregada",
  cancelada: "Cancelada",
  atrasada: "Atrasada",
}

export const numeroOrden = (n) => `OL-${String(n ?? 0).padStart(4, "0")}`

const iso = fechaAISO

export const estaAtrasada = (orden, hoy = new Date()) => orden?.estado === "enviada" && !!orden.fechaPrometida && orden.fechaPrometida < iso(hoy)

// El estado que se muestra: una enviada vencida se ve como "atrasada".
export const estadoVisible = (orden, hoy = new Date()) => (estaAtrasada(orden, hoy) ? "atrasada" : orden?.estado)

export const diasDeAtraso = (orden, hoy = new Date()) => {
  if (!estaAtrasada(orden, hoy)) return 0
  const [a, m, d] = orden.fechaPrometida.split("-").map(Number)
  return Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(a, m - 1, d)) / 86400000)
}

export const ordenesAtrasadas = (ordenes, hoy = new Date()) => ordenes.filter((o) => estaAtrasada(o, hoy))
export const ordenesListasSinAvisar = (ordenes) => ordenes.filter((o) => o.estado === "lista" && !o.pacienteAvisadoEn)
export const ordenesAbiertas = (ordenes) => ordenes.filter((o) => o.estado === "enviada" || o.estado === "lista")

// Cuántas atrasadas tiene cada laboratorio (las órdenes sin laboratorio van juntas).
export function atrasosPorLaboratorio(ordenes, hoy = new Date()) {
  const mapa = new Map()
  for (const o of ordenesAtrasadas(ordenes, hoy)) {
    const lab = o.laboratorio || "Sin laboratorio"
    mapa.set(lab, (mapa.get(lab) || 0) + 1)
  }
  return [...mapa.entries()].map(([laboratorio, atrasadas]) => ({ laboratorio, atrasadas })).sort((a, b) => b.atrasadas - a.atrasadas || a.laboratorio.localeCompare(b.laboratorio))
}

// Laboratorios ya usados en la óptica, el más usado primero (para sugerir al escribir).
export function laboratoriosUsados(ordenes) {
  const cuenta = new Map()
  for (const o of ordenes) {
    const l = (o.laboratorio || "").trim()
    if (l) cuenta.set(l, (cuenta.get(l) || 0) + 1)
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l)
}

// Datos con los que arranca la orden: lo que existe en la consulta; la vendedora completa el resto.
// La ficha guarda un solo DP, que se precarga como DP de lejos.
export function datosInicialesOrden(consulta, { montura = "", luna = null } = {}) {
  const vacio = { esfera: "", cilindro: "", eje: "", adicion: "" }
  const ojo = (o) => ({ ...vacio, esfera: o?.esfera || "", cilindro: o?.cilindro || "", eje: o?.eje || "" })
  const m = consulta?.medidas || {}
  const adicion = m.adicion || ""
  const lente = (consulta?.lenteRecomendado || "").toLowerCase()
  const tipo = /progres/.test(lente) ? "progresivo" : /bifocal/.test(lente) ? "bifocal" : "monofocal"
  // La luna de la venta (tipo, material, tratamientos) manda sobre lo que se deduce de la ficha.
  const deLuna = Object.fromEntries(Object.entries(luna || {}).filter(([, v]) => v !== undefined))
  return {
    recetaOd: { ...ojo(consulta?.od), adicion },
    recetaOi: { ...ojo(consulta?.oi), adicion },
    dpLejos: m.dp || "",
    dpCerca: "",
    alturaMontaje: m.alt || "",
    tipoLente: tipo,
    material: "",
    antirreflejo: false,
    filtroAzul: false,
    fotocromatico: false,
    otrosTratamientos: "",
    montura,
    monturaMedidas: "",
    laboratorio: "",
    fechaPrometida: "",
    // Las observaciones son para lo que el laboratorio debe saber además de los datos de la orden. Ya no se
    // precargan con el lente recomendado de la consulta: si la venta lleva otro lente, la nota quedaba contradiciendo la orden.
    observaciones: "",
    ...deLuna,
  }
}

// Objeto que recibe crear_orden_laboratorio / actualizar_orden_laboratorio.
export const datosParaRpc = (d) => ({
  receta_od: d.recetaOd, receta_oi: d.recetaOi,
  dp_lejos: d.dpLejos, dp_cerca: d.dpCerca, altura_montaje: d.alturaMontaje,
  tipo_lente: d.tipoLente, material: d.material,
  antirreflejo: !!d.antirreflejo, filtro_azul: !!d.filtroAzul, fotocromatico: !!d.fotocromatico, otros_tratamientos: d.otrosTratamientos,
  montura: d.montura, montura_medidas: d.monturaMedidas, laboratorio: d.laboratorio,
  fecha_prometida: d.fechaPrometida, observaciones: d.observaciones,
})

export function validarOrden(d) {
  if (!d.tipoLente) return "Elige el tipo de lente."
  if (!d.fechaPrometida) return "Indica la fecha prometida de entrega."
  return ""
}

export const tratamientos = (o) => [o.antirreflejo && "Antirreflejo", o.filtroAzul && "Filtro azul", o.fotocromatico && "Fotocromático", o.otrosTratamientos].filter(Boolean)
const tipoLabel = (id) => TIPOS_LENTE.find((t) => t.id === id)?.label || id

export function mensajeLentesListos({ paciente, opticaNombre, orden }) {
  const nombre = (paciente?.nombre || "").split(" ")[0]
  return `Hola${nombre ? ` ${nombre}` : ""}, te escribimos de ${opticaNombre || "tu óptica"}: tus lentes (orden ${numeroOrden(orden.numero)}) ya están listos para retirar. Te esperamos.`
}

const escapar = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const v = (t) => (t && String(t).trim() ? escapar(t) : "—")
// Medida en milímetros (DP y altura): "62" → "62 mm"; si ya trae la unidad, se deja igual.
const mm = (t) => (t && String(t).trim() ? (/mms*$/i.test(String(t).trim()) ? escapar(t) : `${escapar(String(t).trim())} mm`) : "—")
const ojoFila = (nombre, r = {}) => `<tr><th>${nombre}</th><td>${v(r.esfera)}</td><td>${v(r.cilindro)}</td><td>${v(r.eje)}</td><td>${v(r.adicion)}</td></tr>`

const ESTILO = `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0E2B33;margin:28px;font-size:13px}
h1{font-size:19px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:16px 0 6px}
p{margin:3px 0}table{border-collapse:collapse}th,td{padding:6px 12px;border:1px solid #cbd5e1;text-align:center}th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#475569}
.contacto{color:#475569;font-size:12px}.caja{margin-top:14px;padding:10px 12px;border:1px dashed #94a3b8;border-radius:6px;font-size:12px;color:#334155}
.num{font-size:22px;font-weight:700;letter-spacing:.04em}.fila{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}`

const contactoOptica = (d = {}) => [d.direccion, d.telefono && `Tel. ${d.telefono}`, d.ruc && `RUC ${d.ruc}`].filter(Boolean).map(escapar).join(" · ")

// Las órdenes viejas traen una nota automática "Lente recomendado: …" copiada de la consulta. Lo que se fabrica es
// lo que dice la propia orden (tipo y material), así que esa nota automática no se imprime en la copia del laboratorio.
export const observacionesParaLaboratorio = (orden) => (/^s*lente recomendado:/i.test(orden?.observaciones || "") ? "" : (orden?.observaciones || "").trim())

// Copia para el laboratorio: todo lo que hace falta para fabricar. Sin precios ni datos de contacto del paciente.
export function armarHtmlOrdenLaboratorio({ opticaNombre = "Óptica", opticaDatos = {}, paciente = {}, orden }) {
  const trat = tratamientos(orden)
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Orden ${numeroOrden(orden.numero)} — Laboratorio</title><style>${ESTILO}</style></head><body>
<div class="fila"><div><h1>${escapar(opticaNombre)}</h1>${contactoOptica(opticaDatos) ? `<p class="contacto">${contactoOptica(opticaDatos)}</p>` : ""}<p><b>Orden de laboratorio</b> · copia para el laboratorio</p></div><div class="num">${numeroOrden(orden.numero)}</div></div>
<p><b>Paciente:</b> ${escapar(paciente.nombre)}</p>
<p><b>Laboratorio:</b> ${v(orden.laboratorio)} &nbsp; <b>Fecha de la orden:</b> ${escapar(fechaLegible(orden.creadaEn))} &nbsp; <b>Entrega prometida:</b> ${escapar(fechaLegible(orden.fechaPrometida))}${orden.facturaNumero ? ` &nbsp; <b>Comprobante de venta:</b> ${escapar(orden.facturaNumero)}` : ""}</p>
<h2>Receta</h2>
<table><thead><tr><th></th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th></tr></thead><tbody>${ojoFila("OD", orden.recetaOd)}${ojoFila("OI", orden.recetaOi)}</tbody></table>
<p style="margin-top:8px"><b>DP lejos:</b> ${mm(orden.dpLejos)} &nbsp; <b>DP cerca:</b> ${mm(orden.dpCerca)} &nbsp; <b>Altura de montaje:</b> ${mm(orden.alturaMontaje)}</p>
<h2>Lente</h2>
<p><b>Tipo:</b> ${escapar(tipoLabel(orden.tipoLente))} &nbsp; <b>Material:</b> ${v(orden.material)}</p>
<p><b>Tratamientos:</b> ${trat.length ? trat.map(escapar).join(", ") : "Ninguno"}</p>
<h2>Montura</h2>
<p>${v(orden.montura)}${orden.monturaMedidas ? ` · medidas: ${escapar(orden.monturaMedidas)}` : ""}</p>
${observacionesParaLaboratorio(orden) ? `<h2>Observaciones</h2><p>${escapar(observacionesParaLaboratorio(orden))}</p>` : ""}
</body></html>`
}

// Copia para el paciente: comprobante para retirar. Sin graduación salvo que se pida (privacidad).
export function armarHtmlOrdenPaciente({ opticaNombre = "Óptica", opticaDatos = {}, paciente = {}, orden, incluirGraduacion = false }) {
  const trat = tratamientos(orden)
  const ojo = (n, r = {}) => (r.esfera || r.cilindro || r.eje ? `${n}: ${v(r.esfera)} | ${v(r.cilindro)} | ${v(r.eje)}°${r.adicion ? ` | ADD ${escapar(r.adicion)}` : ""}` : "")
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Orden ${numeroOrden(orden.numero)} — Paciente</title><style>${ESTILO}</style></head><body>
<div class="fila"><div><h1>${escapar(opticaNombre)}</h1>${contactoOptica(opticaDatos) ? `<p class="contacto">${contactoOptica(opticaDatos)}</p>` : ""}<p><b>Comprobante de orden de lentes</b> · copia para el paciente</p></div><div class="num">${numeroOrden(orden.numero)}</div></div>
<p><b>Paciente:</b> ${escapar(paciente.nombre)}</p>
<p><b>Fecha de la orden:</b> ${escapar(fechaLegible(orden.creadaEn))}${orden.facturaNumero ? ` · <b>Comprobante de venta:</b> ${escapar(orden.facturaNumero)}` : ""}</p>
<p><b>Entrega estimada:</b> ${escapar(fechaLegible(orden.fechaPrometida))}</p>
<h2>Tu pedido</h2>
<p><b>Lente:</b> ${escapar(tipoLabel(orden.tipoLente))}${orden.material ? `, ${escapar(orden.material)}` : ""}</p>
<p><b>Tratamientos:</b> ${trat.length ? trat.map(escapar).join(", ") : "Ninguno"}</p>
${orden.montura ? `<p><b>Montura:</b> ${escapar(orden.montura)}</p>` : ""}
${incluirGraduacion ? `<h2>Graduación</h2><p>${[ojo("OD", orden.recetaOd), ojo("OI", orden.recetaOi)].filter(Boolean).map((x) => x).join("</p><p>") || "No registrada"}</p>` : ""}
<div class="caja">Presenta este comprobante para retirar tus lentes. Te avisaremos cuando estén listos${opticaDatos.telefono ? `; para consultas llama al ${escapar(opticaDatos.telefono)}` : ""}.</div>
</body></html>`
}

// Fila de ordenes_laboratorio → objeto de la app.
export function mapOrden(o) {
  return {
    id: o.id, numero: o.numero, facturaId: o.factura_id, consultaId: o.consulta_id, pacienteId: o.paciente_id, citaId: o.cita_id,
    recetaOd: { esfera: "", cilindro: "", eje: "", adicion: "", ...(o.receta_od || {}) }, recetaOi: { esfera: "", cilindro: "", eje: "", adicion: "", ...(o.receta_oi || {}) },
    dpLejos: o.dp_lejos || "", dpCerca: o.dp_cerca || "", alturaMontaje: o.altura_montaje || "",
    tipoLente: o.tipo_lente, material: o.material || "",
    antirreflejo: !!o.antirreflejo, filtroAzul: !!o.filtro_azul, fotocromatico: !!o.fotocromatico, otrosTratamientos: o.otros_tratamientos || "",
    montura: o.montura || "", monturaMedidas: o.montura_medidas || "", laboratorio: o.laboratorio || "",
    fechaPrometida: o.fecha_prometida, observaciones: o.observaciones || "",
    estado: o.estado, creadaPor: o.creada_por, creadaEn: o.creada_en,
    pacienteAvisadoEn: o.paciente_avisado_en || null, pacienteAvisadoPor: o.paciente_avisado_por || null,
    // Cambios de estado con su fecha (solo llegan si la consulta los incluye): alimentan el tiempo de entrega de Reportes.
    historial: (o.ordenes_laboratorio_historial || []).map((h) => ({ estado: h.estado, cambiadoEn: h.cambiado_en })),
  }
}

// Las dos copias en un solo documento, cada una en su hoja (una sola ventana de impresión).
export function armarHtmlOrdenDosCopias(args) {
  const cuerpo = (h) => h.slice(h.indexOf("<body>") + 6, h.lastIndexOf("</body>"))
  const lab = armarHtmlOrdenLaboratorio(args)
  const pac = armarHtmlOrdenPaciente(args)
  return lab.replace("</body>", "").replace(/<title>.*?<\/title>/, `<title>Orden ${numeroOrden(args.orden.numero)}</title>`)
    .replace("<body>", `<body><div style="page-break-after:always">`) + `</div>${cuerpo(pac)}</body></html>`
}

// Cualquier pantalla puede abrir el modal de la orden; la lista (App.jsx) se entera por este evento.
export const EVENTO_ORDEN = "orden-laboratorio:guardada"
// ¿Esta línea de la venta es una luna? Las lunas son líneas de tipo "luna" (migración 0094); las ventas
// anteriores las escribían como servicio de texto libre, y eso se sigue reconociendo.
export const esLineaDeLente = (l) => l?.tipo === "luna" || (l?.tipo === "servicio" && /^(luna|lente|cristal)/i.test((l.descripcion || "").trim()))
