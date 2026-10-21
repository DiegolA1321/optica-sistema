import { cargarProductos } from './utilidades/cargarProductos'
import { PARAMS_DE_SECCION } from './utilidades/urlEstado'
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { puede } from './utilidades/permisosUi';
import Login from './paginas/Login';
import ResolutionGuard from './componentes/ResolutionGuard';
import { hoyISO, fechaAISO } from './utilidades/disponibilidad';
import { supabase, marcarSesionEsperada, habiaSesionGuardada } from './lib/supabaseClient';
import { MENSAJE_SESION_VENCIDA, MENSAJE_SESION_CERRADA_EN_OTRA_PESTANA, MENSAJE_CIERRE_POR_INACTIVIDAD, EVENTO_GUARDAR_BORRADOR, EVENTO_SESION_PERDIDA, registrarActividad, tiempoSinActividad, segundosParaCerrar, seguirConectado, guardarMotivoCierre, leerMotivoCierre } from './utilidades/sesionPestanas';
import { resolverOpticaPublica } from './utilidades/opticaActual';
import { resolverSitio } from './utilidades/resolverSitio';
import { mapOrden, EVENTO_ORDEN } from './utilidades/ordenesLaboratorio';
import { cargarMisPermisos, MENSAJE_CUENTA_DESACTIVADA } from './utilidades/sesionPermisos';
import { mapAbono, EVENTO_ABONO, EVENTO_ABONO_QUITADO, EVENTO_ABONO_ANULADO } from './utilidades/abonos';
import { lazyConReintento } from './utilidades/lazyConReintento';
import GuardiaClaveTemporal from './componentes/GuardiaClaveTemporal';
import { borrarTodosLosBorradores } from './utilidades/borradorFicha';

// Login se queda como import normal: es la pantalla de entrada más común
// (cualquier visitante público, paciente o staff pasa por acá primero) — el
// resto de "pantallas" son mutuamente excluyentes entre sí y bastante
// pesadas (paneles completos), así que se cargan bajo demanda: un paciente
// nunca necesita bajar el código de SuperadminPanel, un visitante público
// nunca necesita el de PortalPaciente, etc.
const PaginaVenta = lazyConReintento(() => import('./paginas/PaginaVenta'), 'PaginaVenta');
const AvisoInactividad = lazyConReintento(() => import('./componentes/AvisoInactividad'), 'AvisoInactividad');
const Dashboard = lazyConReintento(() => import('./paginas/Dashboard'), 'Dashboard');
const AgendarCitaPublica = lazyConReintento(() => import('./paginas/AgendarCitaPublica'), 'AgendarCitaPublica');
const PortalPaciente = lazyConReintento(() => import('./paginas/PortalPaciente'), 'PortalPaciente');
const SuperadminPanel = lazyConReintento(() => import('./paginas/SuperadminPanel'), 'SuperadminPanel');
const ConfirmarCita = lazyConReintento(() => import('./paginas/ConfirmarCita'), 'ConfirmarCita');
const EncuestaSatisfaccion = lazyConReintento(() => import('./paginas/EncuestaSatisfaccion'), 'EncuestaSatisfaccion');
const PaginaLegal = lazyConReintento(() => import('./paginas/PaginaLegal'), 'PaginaLegal');

// ─── Datos de arranque (solo se usan si no hay nada guardado aún) ───
// Cédulas con dígito verificador real (algoritmo módulo 10) — antes eran
// secuencias inventadas que no habrían pasado la validación real de
// esCedulaValida una vez esta dejó de aceptar "cualquier cosa de 10 dígitos".
const PACIENTES_SEED = [
  { id: 1, nombre: "Carlos Alberto Mendoza", cedula: "1312345679", telefono: "0987654321", correo: "carlos@ejemplo.com", fecha_nacimiento: "1990-11-24", ultimaConsulta: "13/10/2026", estadoClinico: "Activo" },
  { id: 2, nombre: "María Elena Anchundia", cedula: "1309876546", telefono: "0991234567", correo: "maria@ejemplo.com", fecha_nacimiento: "1985-03-15", ultimaConsulta: "10/10/2026", estadoClinico: "Activo" },
  { id: 3, nombre: "Jorge Zambrano Pico", cedula: "1315556660", telefono: "0995554443", correo: "jorge@ejemplo.com", fecha_nacimiento: "1995-07-06", ultimaConsulta: "06/07/2026", estadoClinico: "Activo" },
];

// fecha se calcula al arrancar (hoyISO()) para que las citas semilla
// siempre aparezcan "hoy" sin importar en qué fecha se corra la demo.
const CITAS_SEED = [
  { id: 1, fecha: hoyISO(), hora: "10:30 AM", pacienteId: 2, paciente: "María Elena Anchundia", iniciales: "MA", motivo: "Adaptación de Lentes", estado: "En Espera", espera: "1h", colorAvatar: "bg-blue-100 text-blue-700" },
  { id: 2, fecha: hoyISO(), hora: "11:45 AM", pacienteId: 3, paciente: "Jorge Zambrano Pico", iniciales: "JZ", motivo: "Consulta General", estado: "Pendiente", espera: "30m", colorAvatar: "bg-slate-100 text-slate-700" },
];

// Antes tenía 2 productos de muestra ("Armazón Ray-Ban Aviator Metal"...) —
// a diferencia de PACIENTES_SEED/CITAS_SEED (que solo se ven en un
// navegador sin caché previa), esto se veía en CADA login real, brevemente,
// antes de que resolviera el fetch real a Supabase — un admin real podía
// ver por un instante inventario de otro que no era el suyo.
const INVENTARIO_SEED = [];

// Horario habitual del optómetra + parámetros de agenda (ver src/utilidades/disponibilidad.js)
// Parametrización de la óptica (feedback del asesor, 2026-08-20): lo que el
// sistema soporta es fijo, pero cada óptica decide qué de eso usa y qué
// políticas aplica de cara al paciente. Antes esto estaba fijo en el código
// (medidas siempre protegidas) — ahora lo decide el administrador.
const PARAMETRIZACION_SEED = {
  mostrarMedidasPaciente: false, // ¿el paciente ve la distancia pupilar y la altura de montaje en el portal? (la receta se ve siempre)
  manejaProgresion: true, // ¿ofrece esta óptica adaptación de lentes progresivos?
}

// Catálogos editables por el administrador (feedback del asesor, 2026-08-20):
// las etiquetas que trae el sistema por defecto son un punto de partida, no
// una lista fija — cada óptica agrega/renombra/elimina según su propio
// lenguaje clínico.
const MOTIVOS_SEED = ["Consulta General", "Adaptación de Lentes", "Examen de Control", "Garantía / Ajuste"]
const CATEGORIAS_INVENTARIO_SEED = ["Monturas", "Accesorios"]
// Categorías fijas de diagnóstico (caso de la reunión con el ing: se pueden
// marcar varias a la vez en la ficha clínica, así que ya no hacen falta
// combos como "Miopía y astigmatismo" — se seleccionan ambas por separado).
const DIAGNOSTICOS_SEED = [
  "Miopía",
  "Hipermetropía",
  "Astigmatismo",
  "Presbicia",
  "Ambliopía",
  "Sin alteración refractiva",
]

// Cada día se maneja como dos sesiones independientes (mañana/tarde) en vez
// de un solo rango + una pausa de almuerzo global — el hueco entre el fin de
// la mañana y el inicio de la tarde ya funciona como esa pausa, sin tener que
// configurarla aparte (feedback del asesor, 2026-08-21).
const SESION_SEED = (activo, inicio, fin) => ({ activo, inicio, fin })
const DISPONIBILIDAD_SEED = {
  horarioSemanal: {
    domingo: { manana: SESION_SEED(false, "09:00", "13:00"), tarde: SESION_SEED(false, "14:00", "18:00") },
    lunes: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(true, "14:00", "18:00") },
    martes: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(true, "14:00", "18:00") },
    miercoles: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(true, "14:00", "18:00") },
    jueves: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(true, "14:00", "18:00") },
    viernes: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(true, "14:00", "18:00") },
    sabado: { manana: SESION_SEED(true, "09:00", "13:00"), tarde: SESION_SEED(false, "14:00", "18:00") },
  },
  duracionCita: 40,
  excepciones: {},
};

function cargarDeStorage(clave, porDefecto) {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : porDefecto;
  } catch (error) {
    console.error(`Error al cargar ${clave} de localStorage:`, error);
    return porDefecto;
  }
}

// Migra un día de horario del formato viejo ({activo, inicio, fin} + pausa
// global) al nuevo (sesiones independientes mañana/tarde) — instalaciones que
// ya tenían datos guardados antes de este cambio no deben romperse al abrir
// Horario.jsx. Un rango activo que cruza el mediodía se separa en las dos
// sesiones tomando el corte típico de almuerzo (13:00–14:00).
function migrarDiaHorario(d) {
  if (!d || d.manana !== undefined) {
    return d || { manana: { activo: false, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } }
  }
  const inicio = d.inicio || "09:00"
  const fin = d.fin || "18:00"
  if (d.activo && fin > "13:30") {
    return { manana: { activo: true, inicio, fin: "13:00" }, tarde: { activo: true, inicio: "14:00", fin } }
  }
  return { manana: { activo: !!d.activo, inicio, fin }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } }
}

function migrarDisponibilidad(disp) {
  if (!disp) return disp
  const horarioSemanal = {}
  for (const [dia, d] of Object.entries(disp.horarioSemanal || {})) {
    horarioSemanal[dia] = migrarDiaHorario(d)
  }
  const excepciones = {}
  for (const [fecha, exc] of Object.entries(disp.excepciones || {})) {
    excepciones[fecha] = migrarDiaHorario(exc)
  }
  const { pausa, ...resto } = disp
  return { ...resto, horarioSemanal, excepciones }
}

// ─── Mapeo snake_case (Supabase) → camelCase (resto del sistema) ───
// Antes vivían inline dentro de hidratarOpticaId, duplicadas ahí y en el
// flujo del paciente (login real + restaurar sesión + "mis citas/consultas").
// Un solo lugar evita que las dos copias se desincronicen con el tiempo.
function mapPaciente(p) {
  return {
    id: p.id, nombre: p.nombre, cedula: p.cedula, telefono: p.telefono, correo: p.correo,
    fecha_nacimiento: p.fecha_nacimiento, ultimaConsulta: p.ultima_consulta, estadoClinico: p.estado_clinico,
    referidoPor: p.referido_por, referidoPorId: p.referido_por_id, evolucion: p.evolucion, estadoCorreccion: p.estado_correccion,
    fechaRegistro: p.fecha_registro, tieneCuenta: p.tiene_cuenta, usuario: p.usuario, claveTemporal: p.clave_temporal,
    ultimoSaludoCumpleAnio: p.ultimo_saludo_cumple_anio,
    // origen (migración 0067, "creado por staff" vs. "por el paciente/sistema")
    // faltaba en esta lista blanca — se guardaba bien pero nunca volvía a
    // llegar al frontend después de recargar. Encontrado auditando el
    // sistema conectado, no en una prueba en vivo de esta sesión.
    origen: p.origen,
    // confirmado_recepcion (migración 0077, D2) — mismo hallazgo que origen:
    // si no está en esta lista blanca, se guarda bien pero desaparece del
    // frontend en el siguiente reload.
    confirmadoRecepcion: p.confirmado_recepcion,
    // medidas_solicitadas_en (migración 0080) — mismo hallazgo, otra vez.
    medidasSolicitadasEn: p.medidas_solicitadas_en,
    // Permisos para recibir mensajes (migración 0114). Mismo hallazgo de siempre: sin estar aquí se guardan bien pero no vuelven al recargar.
    // Si la base todavía no tiene las columnas llegan como undefined y valen lo de siempre (recordatorios sí, promociones no).
    aceptaRecordatorios: p.acepta_recordatorios, aceptaPromociones: p.acepta_promociones,
    consentimientoActualizadoEn: p.consentimiento_actualizado_en, consentimientoActualizadoPor: p.consentimiento_actualizado_por,
  }
}
function mapCita(c) {
  const partes = (c.paciente || '').trim().split(' ').filter(Boolean)
  const iniciales = partes.length > 1 ? (partes[0][0] + partes[1][0]).toUpperCase() : (partes[0]?.[0] || 'P').toUpperCase()
  return {
    id: c.id, fecha: c.fecha, hora: c.hora, pacienteId: c.paciente_id, paciente: c.paciente, cedula: c.cedula, telefono: c.telefono, correo: c.correo, motivo: c.motivo, motivoPublico: c.motivo_publico, triage: c.triage || null, iniciales, estado: c.estado, codigo: c.codigo || null,
    // origen (0067) y duracionMinutos (0068) — mismo hallazgo que en
    // mapPaciente: el ícono de origen en Citas.jsx y la detección de
    // solapamiento por duración personalizada solo funcionaban con el dato
    // recién creado en memoria, nunca con uno recargado desde la base.
    origen: c.origen, duracionMinutos: c.duracion_minutos,
    // cancelada_por (0078) — mismo hallazgo que origen/duracionMinutos: sin
    // esto en el whitelist, el badge de "Cancelada" solo distinguía quién
    // canceló en el registro recién creado en memoria, nunca al recargar.
    canceladaPor: c.cancelada_por,
    // confirmada_at (0031): cuándo el paciente (enlace del recordatorio) o recepción confirmó la asistencia.
    confirmadaAt: c.confirmada_at || null, recordatorioEnviadoAt: c.recordatorio_enviado_at || null,
    // created_at: "Agendada el" en el detalle de la cita (R12).
    creadoEn: c.created_at,
    // Responsable (0083): quién debería atender y quién atendió de verdad.
    asignadoA: c.asignado_a || null, atendidoPor: c.atendido_por || null,
    // Quién la tenía antes de la primera reasignación (0100).
    asignadoOriginal: c.asignado_original || null,
  }
}
// Pase a venta ("Listo para venta", 0085): el paciente que el optómetra dejó
// esperando a quien vende. estado: listo | vendido | descartado.
function mapPase(p) {
  return {
    id: p.id, consultaId: p.consulta_id, pacienteId: p.paciente_id, citaId: p.cita_id,
    estado: p.estado, pasadaPor: p.pasada_por, pasadaEn: p.pasada_en, cerradaEn: p.cerrada_en || null, facturaId: p.factura_id,
    // 0086: motivo de "No compró" y proforma entregada (fecha y monto).
    motivoDescarte: p.motivo_descarte || null, detalleDescarte: p.detalle_descarte || null,
    proformaEntregadaEn: p.proforma_entregada_en || null, proformaTotal: p.proforma_total != null ? Number(p.proforma_total) : null,
    // 0129: solicitud hecha por el paciente desde el portal (origen 'portal', sin consulta): qué le interesa, su comentario y cuándo la tomó el personal.
    origen: p.origen || "consulta", interes: p.interes || null, comentarioPaciente: p.comentario_paciente || null, enAtencionEn: p.en_atencion_en || null,
  }
}
function mapConsulta(c) {
  return {
    id: c.id, fecha: c.fecha, pacienteId: c.paciente_id, paciente: c.paciente, motivo: c.motivo,
    usaLentes: c.usa_lentes, antecedentes: c.antecedentes, alergias: c.alergias, antecedentesFamiliares: c.antecedentes_familiares,
    retinoscopia: c.datos_clinicos?.retinoscopia, od: c.datos_clinicos?.od, oi: c.datos_clinicos?.oi,
    medidas: c.datos_clinicos?.medidas, examen: c.datos_clinicos?.examen,
    // Lo nuevo de la ficha de cinco pasos (anamnesis, lentes actuales, cover test, objetiva, queratometría, salud ocular): solo el personal.
    ficha: c.datos_clinicos?.ficha || null,
    // Un ojo que no se evaluó, con su motivo (por ejemplo, una prótesis ocular): { od: "motivo", oi: "" }. Sin eso, una receta lleva los dos ojos.
    ojoNoEvaluado: c.datos_clinicos?.ojo_no_evaluado || null,
    // Producto de inventario vinculado al lente recomendado (jsonb, sin columna
    // propia): permite precargarlo al cobrar "más tarde" desde Citas o el perfil.
    lenteProductoId: c.datos_clinicos?.lente_producto_id || null,
    // Qué decidió el optómetra con el próximo control: "ahora" (se agendó al guardar la ficha) o "despues" (queda como aviso).
    controlAgenda: c.datos_clinicos?.control_agenda || null,
    // Quién atendió la consulta: la cita del control se le asigna por defecto.
    controlAsignadoA: c.datos_clinicos?.control_asignado_a || null,
    diagnostico: c.diagnostico, diagnosticoCategorias: c.diagnostico_categorias || [], lenteRecomendado: c.lente_recomendado, indicaciones: c.indicaciones,
    proximoControlDias: c.proximo_control_dias, evolucionCalculada: c.evolucion_calculada, estadoCorreccion: c.estado_correccion,
    productoId: c.producto_id, productoNombre: c.producto_nombre, montoVenta: c.monto_venta != null ? Number(c.monto_venta) : null,
    profesionalNombre: c.profesional_nombre, profesionalRegistro: c.profesional_registro, imagenes: c.imagenes || [],
    // detalle_consulta (migración 0069, esta misma sesión) — se guardaba
    // bien pero al faltar acá era un campo de solo-escritura: no había
    // forma de volver a verlo una vez guardada la ficha.
    detalleConsulta: c.detalle_consulta,
    // created_at: desempate para historialPaciente en ConsultaMedica.jsx
    // cuando dos consultas del mismo paciente comparten la misma `fecha`
    // (un dato editable, no una marca de tiempo) — sin esto, "cuál se
    // registró más reciente" no tenía ninguna fuente fiable.
    creadoEn: c.created_at,
    // cita_id (0079) — vínculo con la cita que originó esta consulta, sin
    // el cual Citas.jsx no puede mostrar la fecha real de atención cuando
    // difiere de la fecha agendada (punto 3, reunión 29 sept.).
    citaId: c.cita_id,
    // profesional_id (0093): quién registró la consulta; sirve para el alcance "solo lo propio".
    profesionalId: c.profesional_id || null,
  }
}
function mapVenta(v) {
  return {
    id: v.id, pacienteId: v.paciente_id, productoId: v.producto_id, productoNombre: v.producto_nombre,
    cantidad: v.cantidad, precioUnitario: Number(v.precio_unitario), montoTotal: Number(v.monto_total),
    metodoPago: v.metodo_pago, cuotasTotales: v.cuotas_totales, cuotasPagadas: v.cuotas_pagadas,
    estado: v.estado, creadoEn: v.created_at,
  }
}
function mapFacturaVenta(f) {
  return {
    id: f.id, pacienteId: f.paciente_id, citaId: f.cita_id, consultaId: f.consulta_id,
    metodoPago: f.metodo_pago, cuotasTotales: f.cuotas_totales, cuotasPagadas: f.cuotas_pagadas,
    montoTotal: Number(f.monto_total), estado: f.estado, creadoEn: f.created_at,
    // Nombre técnico facturas_venta; en pantalla es un "comprobante de venta interno" (migración 0094).
    numero: f.numero ?? null, facturaElectronica: f.factura_electronica || "",
    // Quién la registró, cómo se pagó al contado (lista de pagos por método) y, si se anuló, quién, cuándo y por qué.
    registradoPor: f.registrado_por || null, pagos: Array.isArray(f.pagos) ? f.pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })) : null,
    // 0130: el teléfono y el correo del paciente el día en que se emitió el comprobante (no cambian aunque después los cambie el paciente).
    pacienteTelefono: f.paciente_telefono || null, pacienteCorreo: f.paciente_correo || null,
    anuladaPor: f.anulada_por || null, anuladaEn: f.anulada_at || null, anuladaMotivo: f.anulada_motivo || "",
    // facturas_venta_lineas llega embebida por el select de abajo (join por
    // factura_id) — sin esto, `lineas` solo existía para una factura recién
    // creada en la misma sesión (ComprobanteVentaModal arma el objeto local con
    // sus líneas al guardar) y desaparecía en cualquier recarga de página,
    // porque este mapper nunca la incluía.
    lineas: (f.facturas_venta_lineas || []).map((l) => ({
      id: l.id, productoId: l.producto_id, tipo: l.tipo, descripcion: l.descripcion,
      cantidad: l.cantidad, precioUnitario: Number(l.precio_unitario), detalle: l.detalle || null,
      descuentoTipo: l.descuento_tipo || null, descuentoValor: l.descuento_valor == null ? null : Number(l.descuento_valor), descuentoMonto: Number(l.descuento_monto) || 0, descuentoMotivo: l.descuento_motivo || "",
    })),
  }
}
function mapRespuestaSatisfaccion(r) {
  return { id: r.id, citaId: r.cita_id, puntaje: r.puntaje, comentario: r.comentario, creadoEn: r.created_at }
}
function mapSolicitudEliminacion(s) {
  return { id: s.id, pacienteId: s.paciente_id, motivo: s.motivo, estado: s.estado, creadoEn: s.created_at }
}

// Reconstruye la sesión activa (si hay una guardada) a partir de los pacientes ya
// cargados — se guarda sólo un tipo + pacienteId, nunca una copia del objeto
// paciente, para que la sesión restaurada refleje datos actuales y no una foto
// vieja de cuando inició sesión (ej. si el optómetra le editó el teléfono después).
function cargarSesion(pacientesActuales) {
  const sesion = cargarDeStorage('optica_sesion', null);
  if (!sesion) return { usuario: null, pantalla: 'login' };
  if (sesion.tipo === 'paciente' && sesion.pacienteId != null) {
    const paciente = pacientesActuales.find((p) => p.id === sesion.pacienteId);
    if (paciente) return { usuario: { ...paciente, rol: 'paciente', token: sesion.token }, pantalla: 'panel_paciente' };
  }
  return { usuario: null, pantalla: 'login' };
}

// Fallback mientras carga el chunk de una pantalla (code-splitting: cada
// pantalla completa — Dashboard, SuperadminPanel, etc. — se baja bajo
// demanda, no todas juntas al entrar al sitio). Solo se ve un instante en
// una conexión normal; no vale la pena un spinner de marca completo acá.
function PantallaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#F7F5F0' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
    </div>
  );
}

function App() {
  // ─── Estado centralizado y persistente: única fuente de verdad para todo el sistema ───
  const [pacientes, setPacientes] = useState(() => cargarDeStorage('optica_pacientes', PACIENTES_SEED));

  // Pantallas disponibles: 'login', 'dashboard', 'registro_paciente', 'panel_paciente',
  // 'panel_superadmin'. Se restauran junto con la sesión para que recargar la página no
  // mande de vuelta al login si ya se había iniciado sesión.
  const [pantallaActual, setPantallaActual] = useState(() => cargarSesion(pacientes).pantalla);

  // Estado para conservar los datos del usuario logueado (sea admin o paciente)
  const [usuario, setUsuario] = useState(() => cargarSesion(pacientes).usuario);
  // Los abonos anulados son de Ventas: quien no tiene Ventas "ver" no los pide (el servidor se los negaría con un 400 en cada vuelta).
  const veVentasRef = useRef(true);
  veVentasRef.current = puede(usuario, 'ventas', 'ver');
  // Ciberseguridad: mensaje para el login cuando la sesión se cerró sola por
  // inactividad (ver el useEffect junto a cerrarSesion, más abajo).
  const [avisoSesion, setAvisoSesion] = useState(null);
  const [segundosInactividad, setSegundosInactividad] = useState(null);
  // true desde que ESTA pestaña cierra la sesión: el SIGNED_OUT que sigue es el suyo, no una sesión perdida.
  const cierrePropioRef = useRef(false);
  const [citas, setCitas] = useState(() => {
    const cargadas = cargarDeStorage('optica_citas', CITAS_SEED);
    // Registros muy antiguos (de antes de que CITAS_SEED tuviera id) pueden no
    // tenerlo — sin un id único, cualquier acción sobre "esta cita" (marcarla
    // atendida, cancelarla) puede terminar afectando también a otra cita distinta
    // que igualmente tenga el id vacío, porque undefined === undefined.
    let siguienteId = Date.now();
    const idsVistos = new Set();
    // Igual que con id ausente: registros guardados de antes de que CITAS_SEED
    // tuviera fecha quedarían sin ella, y esHoy()/etiquetaFecha() no saben
    // mostrar eso. Y si dos registros comparten el mismo id (dato viejo de
    // antes del fix de colisión de ids), React los renderiza con la misma
    // key y rompe la lista — se reasigna id al segundo que aparece repetido.
    return cargadas.map((c) => {
      let id = c.id != null ? c.id : siguienteId++;
      if (idsVistos.has(id)) id = siguienteId++;
      idsVistos.add(id);
      return { ...c, id, fecha: c.fecha || hoyISO() };
    });
  });
  const [inventario, setInventario] = useState(INVENTARIO_SEED);
  // J7: las cargas iniciales de abajo (pacientes/citas/consultas/inventario/
  // etc.) descartaban `error` — si Supabase fallaba (red caída, RLS negó el
  // acceso) la app quedaba con los datos viejos/vacíos sin ningún aviso,
  // indistinguible de "no hay datos" para quien está mirando la pantalla.
  const [erroresCarga, setErroresCarga] = useState([]);
  const registrarErrorCarga = (etiqueta) => setErroresCarga((prev) => (prev.includes(etiqueta) ? prev : [...prev, etiqueta]));
  // B3: skeleton en Pacientes/Citas/Inventario mientras resuelve la primera
  // carga real (solo importa en un navegador sin caché previa — con caché,
  // el estado ya arranca con datos reales y esto pasa a false casi de
  // inmediato). Empieza en true solo si hay sesión de staff, para no
  // bloquear nada en las pantallas públicas.
  const [cargaInicialStaff, setCargaInicialStaff] = useState(true);
  // Sin cache en localStorage a propósito (auditoría de seguridad,
  // 2026-09-09): `consultas` es la historia clínica completa ya descifrada
  // (diagnóstico, antecedentes, alergias) — cachearla en el navegador
  // anulaba en el cliente el cifrado AES que ya existe en la base de datos
  // (migración 0043). Se hidrata siempre desde Supabase (ver los dos
  // `setConsultas(...)` más abajo), igual que `ventas`.
  const [consultas, setConsultas] = useState([]);
  // Ventas de productos a pacientes (caso "Inventario" de la reunión con el
  // ing — migración 0047_ventas_productos.sql). Solo vive en Supabase, sin
  // seed ni localStorage: es un módulo nuevo, no hay datos viejos que migrar.
  const [ventas, setVentas] = useState([]);
  // Facturas de venta con líneas múltiples (Punto 06 del Diagnóstico
  // Maestro, migración 0072_facturas.sql) — camino nuevo, en paralelo a
  // `ventas` (camino viejo, una venta = un producto) mientras no se migre
  // ese historial (fase separada, no bloqueante, ver la propia migración).
  // Igual que `ventas`: solo vive en Supabase, sin seed ni localStorage.
  const [facturasVenta, setFacturasVenta] = useState([]);
  // Hallazgo real 2026-09-10: suspender una óptica (opticas.activa) solo
  // bloqueaba logins nuevos — una sesión ya abierta seguía con acceso
  // normal indefinidamente porque nada volvía a mirar este campo. Ahora la
  // RLS de las tablas que el staff usa a diario también exige
  // optica_activa_actual() (migración 0073), así que una sesión abierta sí
  // pierde acceso real cuando el superadmin suspende — este estado es solo
  // para AVISAR de forma clara por qué (ver el banner en Dashboard.jsx y el
  // badge en Inicio.jsx), no para controlar el acceso en sí.
  const [opticaActiva, setOpticaActiva] = useState(true);
  // Solo lectura desde Reportes — no hay wrapper de escritura porque nunca
  // se edita desde la app, solo se llena vía la página pública de la
  // encuesta (enviar_encuesta_satisfaccion, migración 0041).
  const [respuestasSatisfaccion, setRespuestasSatisfaccion] = useState([]);
  // Solicitudes de eliminación de cuenta que dejan los pacientes desde su
  // portal (migración 0045) — solo lectura + marcar atendida, el borrado
  // real lo sigue haciendo el admin con el flujo que ya existía en
  // Pacientes.jsx.
  const [solicitudesEliminacion, setSolicitudesEliminacion] = useState([]);
  const [disponibilidad, setDisponibilidadState] = useState(DISPONIBILIDAD_SEED);
  // Horario personal por usuario — caso "Mi horario" de la reunión con el
  // ing: distinto del horario general de arriba (que es el de la óptica,
  // público). null mientras no se sabe todavía si existe una fila propia.
  const [horarioPersonal, setHorarioPersonalState] = useState(null);
  const [asistentes, setAsistentes] = useState([]);
  // Equipo de la óptica (admin y asistentes) para "Asignado a" y para mostrar
  // quién atendió: perfiles solo deja leer el propio, así que viene de la
  // función equipo_optica() (0084).
  const [equipo, setEquipo] = useState([]);
  // Pacientes pasados a la óptica (cola de "Listo para venta").
  const [pasesVenta, setPasesVenta] = useState([]);
  const [ordenesLab, setOrdenesLab] = useState([]);
  const [abonos, setAbonos] = useState([]);
  // Los abonos anulados no cuentan en nada: se guardan aparte para mostrarlos (quién los anuló, cuándo y por qué).
  const [abonosAnulados, setAbonosAnulados] = useState([]);
  // Un abono registrado desde cualquier pantalla entra a la lista sin recargar.
  useEffect(() => {
    const alAbonar = (e) => setAbonos((prev) => [e.detail, ...prev.filter((a) => a.id !== e.detail.id)])
    const alQuitar = (e) => setAbonos((prev) => prev.filter((a) => a.id !== e.detail))
    const alAnular = (e) => setAbonosAnulados((prev) => [e.detail, ...prev.filter((a) => a.id !== e.detail.id)])
    window.addEventListener(EVENTO_ABONO, alAbonar)
    window.addEventListener(EVENTO_ABONO_QUITADO, alQuitar)
    window.addEventListener(EVENTO_ABONO_ANULADO, alAnular)
    return () => { window.removeEventListener(EVENTO_ABONO, alAbonar); window.removeEventListener(EVENTO_ABONO_QUITADO, alQuitar); window.removeEventListener(EVENTO_ABONO_ANULADO, alAnular) }
  }, []);
  // Una orden creada o corregida desde cualquier pantalla entra a la lista sin recargar.
  useEffect(() => {
    // El historial (que usan los reportes) no viaja en el evento: se conserva el que ya se tenía.
    const alGuardar = (e) => setOrdenesLab((prev) => [{ ...e.detail, historial: e.detail.historial ?? prev.find((o) => o.id === e.detail.id)?.historial ?? [] }, ...prev.filter((o) => o.id !== e.detail.id)])
    window.addEventListener(EVENTO_ORDEN, alGuardar)
    return () => window.removeEventListener(EVENTO_ORDEN, alGuardar)
  }, []);
  const [parametrizacion, setParametrizacionState] = useState(PARAMETRIZACION_SEED);
  const [motivosConsulta, setMotivosConsultaState] = useState(MOTIVOS_SEED);
  const [diagnosticosRapidos, setDiagnosticosRapidosState] = useState(DIAGNOSTICOS_SEED);
  const [categoriasInventario, setCategoriasInventarioState] = useState(CATEGORIAS_INVENTARIO_SEED);
  // Se resuelve una sola vez al montar (depende solo de la URL de esta carga
  // de página) — decide si esto es la página de venta, el login del
  // superadmin, o el sitio público de una óptica (con o sin slug).
  const [sitio] = useState(() => resolverSitio());
  // Datos públicos de la óptica resuelta (id/slug/nombre/logo/marca) para
  // que Login.jsx pueda personalizarse — null mientras no se resuelve o
  // cuando el sitio no es de tipo 'optica'.
  const [opticaPublica, setOpticaPublica] = useState(null);
  // El portal del paciente muestra esqueletos hasta que llegan sus citas y su receta (sin esto, un paciente con datos veía un instante la bienvenida de un paciente nuevo).
  const [cargandoDatosPaciente, setCargandoDatosPaciente] = useState(true);
  // Evita el parpadeo al recargar: si ya hay (o podría haber) una sesión de
  // Supabase Auth (superadmin/admin/asistente) por restaurar, no se sabe
  // todavía si pantallaActual='login' es la respuesta correcta o solo el
  // valor inicial mientras se espera el evento INITIAL_SESSION — mostrar
  // Login de entrada en ese caso es mostrar una pantalla que un instante
  // después puede resultar falsa. Arranca en false (nada que esperar) si ya
  // hay sesión de paciente resuelta, no hay supabase configurado, o el sitio
  // es la página de venta (pública siempre, sin importar sesión).
  const [restaurandoSesion, setRestaurandoSesion] = useState(
    () => !!supabase && sitio.modo !== 'venta' && !cargarSesion(pacientes).usuario
  );

  // Restaura la sesión de un paciente real al recargar la página. cargarSesion()
  // (más arriba) solo puede resolverla sincrónicamente si el pacienteId guardado
  // ya está en el `pacientes` local — eso solo pasa por casualidad (el mismo
  // navegador donde antes entró un admin). Para el caso real (el paciente en su
  // propio dispositivo, sin ese estado hidratado) hace falta ir a buscarlo.
  useEffect(() => {
    if (!supabase) return
    const sesion = cargarDeStorage('optica_sesion', null)
    if (sesion?.tipo !== 'paciente' || sesion.pacienteId == null) return
    // Sesión ya resuelta de forma sincrónica (el paciente estaba en el `pacientes` guardado de este navegador): igual hay que traer sus citas y recetas;
    // sin esto «Inicio», «Mis citas» y «Mi receta» se quedaban en esqueleto para siempre.
    const yaResuelta = usuario?.rol === 'paciente' && usuario?.id === sesion.pacienteId && usuario?.token === sesion.token
    // La sesión SIEMPRE se valida en el servidor, también cuando ya está resuelta de forma local: con un token vencido (la sesión del paciente expira) todas las funciones del portal
    // devuelven vacío, y el portal se abría como el de un paciente nuevo («Agenda tu primera cita») aunque tuviera citas, lentes y saldo.
    supabase.rpc('obtener_paciente_por_id', { p_paciente_id: sesion.pacienteId, p_token: sesion.token }).then(({ data }) => {
      const fila = data?.[0]
      if (!fila) { guardarSesion(null); setUsuario(null); setPantallaActual('login'); setAvisoSesion({ texto: 'Tu sesión venció. Vuelve a iniciar sesión.', id: Date.now() }); return }
      if (yaResuelta) { hidratarDatosPaciente(sesion.pacienteId, sesion.token); return }
      const pacienteMapeado = mapPaciente(fila)
      setUsuario({ ...pacienteMapeado, rol: 'paciente', token: sesion.token })
      setPantallaActual('panel_paciente')
      setPacientes([pacienteMapeado])
      hidratarDatosPaciente(fila.id, sesion.token)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auditoría de seguridad 2026-09-09: `pacientes.estadoClinico/evolucion/
  // estadoCorreccion` y `citas.triage` son datos de salud — se guardan en
  // memoria para la sesión actual pero se excluyen explícitamente de lo que
  // se persiste en localStorage, para no dejar historia clínica legible en
  // el navegador entre sesiones.
  useEffect(() => {
    const sinClinico = pacientes.map(({ estadoClinico, evolucion, estadoCorreccion, ...resto }) => resto);
    localStorage.setItem('optica_pacientes', JSON.stringify(sinClinico));
  }, [pacientes]);

  useEffect(() => {
    const sinTriage = citas.map(({ triage, ...resto }) => resto);
    localStorage.setItem('optica_citas', JSON.stringify(sinTriage));
  }, [citas]);

  // parametrizacion/motivosConsulta/diagnosticosRapidos viven en columnas de
  // `opticas` (settings/motivos_consulta/diagnosticos_rapidos); disponibilidad
  // e inventario son tablas propias — todo scoped por optica_id. Admin
  // logueado usa su propia optica_id (RLS normal); sin sesión (agendar cita
  // pública, portal de paciente, login público) se resuelve la óptica real
  // por el slug de resolverSitio() vía resolverOpticaPublica() — cae en
  // OPTICA_ID_DEFAULT si no hay slug o no hay dominio real todavía.
  useEffect(() => {
    if (!supabase) return
    // Bug real encontrado el 2026-09-09: esto decía literalmente rol==='admin'
    // — un asistente logueado nunca disparaba este fetch y quedaba con
    // Pacientes/Citas/Inventario/Consultas/Ventas completamente vacíos, sin
    // importar los permisos que el admin le hubiera delegado en Usuarios.jsx.
    // Nunca se notó porque no había ninguna cuenta de asistente creada en
    // producción todavía. RLS sigue protegiendo el aislamiento por óptica a
    // nivel de base de datos — este `if` solo decide si el navegador pide
    // los datos, no si tiene permiso para verlos.
    const esStaff = (usuario?.rol === 'admin' || usuario?.rol === 'asistente') && !!usuario?.opticaId

    if (esStaff) {
      supabase.from('opticas').select('settings, motivos_consulta, diagnosticos_rapidos, categorias_inventario, activa').eq('id', usuario.opticaId).maybeSingle().then(({ data }) => {
        if (!data) return
        setParametrizacionState(data.settings || PARAMETRIZACION_SEED)
        setMotivosConsultaState(data.motivos_consulta || MOTIVOS_SEED)
        setDiagnosticosRapidosState(data.diagnosticos_rapidos || DIAGNOSTICOS_SEED)
        setCategoriasInventarioState(data.categorias_inventario || CATEGORIAS_INVENTARIO_SEED)
        setOpticaActiva(data.activa !== false)
      })
      hidratarOpticaId(usuario.opticaId, true)
      return
    }

    if (sitio.modo !== 'optica') return
    resolverOpticaPublica(sitio.slug).then((data) => {
      if (!data) return
      setOpticaPublica(data)
      setParametrizacionState(data.settings || PARAMETRIZACION_SEED)
      setMotivosConsultaState(data.motivos_consulta || MOTIVOS_SEED)
      hidratarOpticaId(data.id, false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.opticaId, usuario?.rol])

  // Revisa cada 2.5 min si la óptica sigue activa — separado del efecto de
  // arriba porque ese solo corre cuando cambia la sesión, no con el tiempo.
  // opticas_select_own_admin (RLS) no exige activa a propósito (migración
  // 0073), así que esta lectura sigue funcionando aunque ya estén
  // suspendidos — es justo el canal que permite detectarlo y avisar.
  useEffect(() => {
    const esStaff = (usuario?.rol === 'admin' || usuario?.rol === 'asistente') && !!usuario?.opticaId
    if (!supabase || !esStaff) return
    const INTERVALO_MS = 150000
    const revisar = () => {
      supabase.from('opticas').select('activa').eq('id', usuario.opticaId).maybeSingle().then(({ data }) => {
        if (data) setOpticaActiva(data.activa !== false)
      })
    }
    const id = setInterval(revisar, INTERVALO_MS)
    return () => clearInterval(id)
  }, [usuario?.opticaId, usuario?.rol])

  // Revisa cada 2.5 min los permisos de quien tiene la sesión abierta (roles, niveles
  // y alcance): si el administrador se los cambia, el menú y los botones se actualizan
  // solos; si desactiva la cuenta, la sesión se cierra. No aplica a la impersonación
  // (ahí la sesión real es la del superadmin).
  useEffect(() => {
    if (!supabase || !usuario?.id || usuario?.impersonadoPor) return
    if (usuario.rol !== 'asistente' && usuario.rol !== 'admin') return
    const INTERVALO_MS = 150000
    const revisar = async () => {
      const extras = await cargarMisPermisos(supabase)
      if (!extras) return
      if (extras.activo === false) { cerrarSesion(MENSAJE_CUENTA_DESACTIVADA); return }
      setUsuario((prev) => {
        if (!prev) return prev
        const igual = JSON.stringify([prev.permisosNivel, prev.roles, prev.alcance]) === JSON.stringify([extras.permisosNivel, extras.roles, extras.alcance])
        return igual ? prev : { ...prev, ...extras }
      })
    }
    const id = setInterval(revisar, INTERVALO_MS)
    return () => clearInterval(id)
  }, [usuario?.id, usuario?.rol, usuario?.impersonadoPor])

  // Las citas se refrescan solas cada 20 segundos (y al volver a la pestaña)
  // para que "en atención ahora" y las citas nuevas del portal aparezcan sin
  // recargar. Solo trae las de los últimos días en adelante y las mezcla por id.
  useEffect(() => {
    if (!supabase || !usuario?.opticaId || (usuario.rol !== 'admin' && usuario.rol !== 'asistente')) return
    let enCurso = false
    const refrescar = async () => {
      if (enCurso || document.hidden) return
      enCurso = true
      try {
        const desde = new Date(Date.now() - 3 * 86400000)
        const iso = fechaAISO(desde)
        const { data: pasesData } = await supabase.from('pases_a_venta').select('*').eq('optica_id', usuario.opticaId)
        if (pasesData) setPasesVenta(pasesData.map(mapPase))
        const { data: ordenesData } = await supabase.from('ordenes_laboratorio').select('*, ordenes_laboratorio_historial(estado, cambiado_en)').eq('optica_id', usuario.opticaId)
        if (ordenesData) setOrdenesLab(ordenesData.map(mapOrden))
        const { data: abonosData } = await supabase.from('abonos_factura').select('*').eq('optica_id', usuario.opticaId)
        if (abonosData) setAbonos(abonosData.map(mapAbono))
        if (veVentasRef.current) {
          const { data: anuladosData } = await supabase.rpc('abonos_anulados')
          if (anuladosData) setAbonosAnulados(anuladosData.map(mapAbono))
        }
        // El inventario también se refresca: si el administrador cambia un precio o una cantidad, los demás roles lo ven sin cerrar sesión.
        const { data: nuevos } = await cargarProductos(supabase, usuario.opticaId)
        if (nuevos) {
          setInventario((prev) => (JSON.stringify(prev) === JSON.stringify(nuevos) ? prev : nuevos))
        }
        const { data } = await supabase.from('citas').select('*').eq('optica_id', usuario.opticaId).gte('fecha', iso)
        if (data) {
          setCitas((prev) => {
            const mapa = new Map(prev.map((c) => [c.id, c]))
            for (const fila of data) {
              const nueva = mapCita(fila)
              mapa.set(nueva.id, { ...(mapa.get(nueva.id) || {}), ...nueva })
            }
            return [...mapa.values()]
          })
        }
      } finally {
        enCurso = false
      }
    }
    const id = setInterval(refrescar, 20000)
    const alVolver = () => { if (!document.hidden) refrescar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alVolver) }
  }, [usuario?.opticaId, usuario?.rol])

  // Horario personal — aparte de la hidratación de arriba a propósito: es
  // personal de quien esté logueado (admin o asistente por igual), no un
  // dato público ni un dato exclusivo del admin como pacientes/inventario.
  useEffect(() => {
    if (!supabase || !usuario?.id || (usuario.rol !== 'admin' && usuario.rol !== 'asistente')) return
    supabase.from('horarios_usuario').select('horario_semanal, ausencias').eq('usuario_id', usuario.id).maybeSingle().then(({ data }) => {
      setHorarioPersonalState(data ? { horarioSemanal: data.horario_semanal || {}, ausencias: data.ausencias || {} } : { horarioSemanal: {}, ausencias: {} })
    })
  }, [usuario?.id, usuario?.rol])

  // Lo que dependía únicamente del optica_id ya resuelto (admin o público) —
  // separado del efecto de arriba para no repetir esta parte en las dos ramas.
  function hidratarOpticaId(opticaId, esAdmin) {
    supabase.from('disponibilidad').select('*').eq('optica_id', opticaId).maybeSingle().then(({ data }) => {
      if (!data) return
      setDisponibilidadState(migrarDisponibilidad({
        horarioSemanal: data.horario_semanal,
        excepciones: data.excepciones,
        duracionCita: data.duracion_cita,
      }))
    })

    if (esAdmin) {
      // B3: estas 3 son las que Pacientes/Citas/Inventario muestran como
      // tabla principal — cargaInicialStaff se apaga cuando las 3
      // resuelven (con o sin error, para no dejar el skeleton pegado si
      // Supabase falla) y esas páginas usan ese flag para mostrar el
      // skeleton en vez de "no hay datos todavía" mientras tanto.
      Promise.allSettled([
        cargarProductos(supabase, opticaId).then(({ data, error }) => {
          if (data) setInventario(data)
          else if (error) registrarErrorCarga('inventario')
        }),
        // pacientes/citas/consultas: hidratan el estado local con lo real de
        // Supabase al loguearse el admin. El estado sigue viviendo en App.jsx
        // (mismas props de siempre para Pacientes/Citas/ConsultaMedica/etc.) y
        // sigue espejándose en localStorage — así el portal de paciente y
        // agendar-cita-pública (que no tienen sesión real) siguen viendo algo
        // en ese mismo navegador, igual que antes de esta migración.
        supabase.from('pacientes').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data, error }) => {
          if (data) setPacientes(data.map(mapPaciente))
          else if (error) registrarErrorCarga('pacientes')
        }),
        supabase.from('citas').select('*').eq('optica_id', opticaId).then(({ data, error }) => {
          if (data) setCitas(data.map(mapCita))
          else if (error) registrarErrorCarga('citas')
        }),
        // Datos que el Inicio combina entre sí (consultas, ventas, pases, órdenes y abonos): se esperan junto con lo
        // demás para que el Inicio no calcule con una parte vacía (p. ej. todos los pacientes "sin atender" mientras llegan las consultas).
        supabase.from('consultas').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data, error }) => {
          if (data) setConsultas(data.map(mapConsulta))
          else if (error) registrarErrorCarga('consultas')
        }),
        supabase.from('facturas_venta').select('*, facturas_venta_lineas(*)').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data, error }) => {
          if (data) setFacturasVenta(data.map(mapFacturaVenta))
          else if (error) registrarErrorCarga('facturas')
        }),
        supabase.from('pases_a_venta').select('*').eq('optica_id', opticaId).then(({ data, error }) => {
          if (data) setPasesVenta(data.map(mapPase))
          else if (error) registrarErrorCarga('pacientes listos para venta')
        }),
        supabase.from('ordenes_laboratorio').select('*, ordenes_laboratorio_historial(estado, cambiado_en)').eq('optica_id', opticaId).then(({ data, error }) => {
          if (data) setOrdenesLab(data.map(mapOrden))
          else if (error) registrarErrorCarga('órdenes de laboratorio')
        }),
        supabase.from('abonos_factura').select('*').eq('optica_id', opticaId).then(({ data, error }) => {
          if (data) setAbonos(data.map(mapAbono))
          else if (error) registrarErrorCarga('abonos')
        }),
        // Los anulados se leen aparte; si la base todavía no tiene la función, simplemente no hay anulados que mostrar.
        veVentasRef.current ? supabase.rpc('abonos_anulados').then(({ data }) => { if (data) setAbonosAnulados(data.map(mapAbono)) }) : null,
      ]).then(() => setCargaInicialStaff(false))

      supabase.from('ventas').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data, error }) => {
        if (data) setVentas(data.map(mapVenta))
        else if (error) registrarErrorCarga('ventas')
      })

      supabase.from('respuestas_satisfaccion').select('*').eq('optica_id', opticaId).then(({ data, error }) => {
        if (data) setRespuestasSatisfaccion(data.map(mapRespuestaSatisfaccion))
        else if (error) registrarErrorCarga('encuestas de satisfacción')
      })

      supabase.from('solicitudes_eliminacion_paciente').select('*').eq('optica_id', opticaId).eq('estado', 'pendiente').then(({ data, error }) => {
        if (data) setSolicitudesEliminacion(data.map(mapSolicitudEliminacion))
        else if (error) registrarErrorCarga('solicitudes de eliminación')
      })

      supabase.rpc('equipo_optica').then(({ data, error }) => {
        if (data) setEquipo(data.map((m) => ({ id: m.id, nombre: m.nombre, rol: m.rol, esOptometra: !!m.es_optometra, activo: m.activo !== false })))
        else if (error) registrarErrorCarga('equipo de la óptica')
      })

      supabase.from('perfiles').select('id, nombre, email, permisos, etiqueta_rol, es_optometra, cedula, activo').eq('optica_id', opticaId).eq('rol', 'asistente').then(({ data, error }) => {
        if (data) setAsistentes(data.map((a) => ({ id: a.id, nombre: a.nombre, correo: a.email, permisos: a.permisos || {}, etiquetaRol: a.etiqueta_rol || '', esOptometra: !!a.es_optometra, cedula: a.cedula || '', activo: a.activo !== false })))
        else if (error) registrarErrorCarga('usuarios y permisos')
      })
    }
  }

  // Wrappers: actualizan el estado local al instante (misma firma de siempre,
  // aceptan función o valor) y persisten en Supabase en segundo plano. Solo
  // el administrador puede escribir (usuario.opticaId real) — sin eso, el
  // cambio queda solo en memoria de esta sesión, sin persistir.
  const marcarSolicitudEliminacionAtendida = async (solicitudId) => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('marcar_solicitud_eliminacion_atendida', { p_solicitud_id: solicitudId })
    if (error || !data) return
    setSolicitudesEliminacion((prev) => prev.filter((s) => s.id !== solicitudId))
  }

  // Responder la solicitud de medidas de montaje (migración 0132): `cerrar_solicitud_medidas` guarda qué se le contestó al paciente
  // ('enviadas' con sus valores, o 'cita' con la fecha y la hora), quita la marca medidas_solicitadas_en y lo deja en la actividad.
  const marcarMedidasAtendidas = async (pacienteId, { resultado, dp = null, altura = null, citaFecha = null, citaHora = null }) => {
    if (!supabase) return { error: new Error('Sin conexión a Supabase') }
    const { error } = await supabase.rpc('cerrar_solicitud_medidas', { p_paciente_id: pacienteId, p_resultado: resultado, p_dp: dp, p_altura: altura, p_cita_fecha: citaFecha, p_cita_hora: citaHora })
    if (!error) setPacientes((prev) => prev.map((p) => (p.id === pacienteId ? { ...p, medidasSolicitadasEn: null } : p)))
    return { error }
  }

  // Los 4 wrappers de abajo antes eran "optimista + fire-and-forget": si el
  // update a Supabase fallaba (red, RLS), el único rastro era un
  // console.error — la UI nunca se enteraba, así que Configuracion.jsx no
  // podía mostrar ni un toast de éxito real ni un error si la escritura no
  // llegaba a la base. Ahora cada uno devuelve la promesa del update (con su
  // `{ error }`) para que el llamador pueda confirmar el guardado de verdad,
  // sin tocar el resto de callers que ya ignoraban el valor de retorno.
  const setParametrizacion = (updater) => {
    let siguiente
    setParametrizacionState((prev) => {
      siguiente = typeof updater === 'function' ? updater(prev) : updater
      return siguiente
    })
    if (supabase && usuario?.opticaId) {
      return supabase.from('opticas').update({ settings: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
        if (error) console.error('No se pudo guardar la configuración de la óptica:', error.message)
        return { error }
      })
    }
    return Promise.resolve({ error: null })
  }

  const setMotivosConsulta = (updater) => {
    let siguiente
    setMotivosConsultaState((prev) => {
      siguiente = typeof updater === 'function' ? updater(prev) : updater
      return siguiente
    })
    if (supabase && usuario?.opticaId) {
      return supabase.from('opticas').update({ motivos_consulta: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
        if (error) console.error('No se pudieron guardar los motivos de consulta:', error.message)
        return { error }
      })
    }
    return Promise.resolve({ error: null })
  }

  const setDiagnosticosRapidos = (updater) => {
    let siguiente
    setDiagnosticosRapidosState((prev) => {
      siguiente = typeof updater === 'function' ? updater(prev) : updater
      return siguiente
    })
    if (supabase && usuario?.opticaId) {
      return supabase.from('opticas').update({ diagnosticos_rapidos: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
        if (error) console.error('No se pudieron guardar los diagnósticos rápidos:', error.message)
        return { error }
      })
    }
    return Promise.resolve({ error: null })
  }

  const setCategoriasInventario = (updater) => {
    let siguiente
    setCategoriasInventarioState((prev) => {
      siguiente = typeof updater === 'function' ? updater(prev) : updater
      return siguiente
    })
    if (supabase && usuario?.opticaId) {
      return supabase.from('opticas').update({ categorias_inventario: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
        if (error) console.error('No se pudieron guardar las categorías de inventario:', error.message)
        return { error }
      })
    }
    return Promise.resolve({ error: null })
  }

  // A diferencia de los otros wrappers de arriba, este devuelve la promesa
  // del upsert (con su { error } si falló) — Horario.jsx la usa en su botón
  // explícito "Guardar cambios" para no decirle al optómetra que guardó
  // cuando en realidad el guardado en Supabase falló en silencio.
  const setDisponibilidad = (updater) => {
    const siguiente = typeof updater === 'function' ? updater(disponibilidad) : updater
    setDisponibilidadState(siguiente)
    if (supabase && usuario?.opticaId) {
      return supabase.from('disponibilidad').upsert({
        optica_id: usuario.opticaId,
        horario_semanal: siguiente.horarioSemanal,
        excepciones: siguiente.excepciones,
        duracion_cita: siguiente.duracionCita,
      })
    }
    return Promise.resolve({ error: null })
  }

  // Pone en pantalla la excepción de un día tal como la dejó la base (null = el día volvió a su horario normal). No escribe: las funciones
  // registrar_ausencia / quitar_ausencia ya lo hicieron, solo con lo suyo de quien las llama.
  const reemplazarExcepcionLocal = (fecha, excepcion) => {
    setDisponibilidadState((prev) => {
      const excepciones = { ...(prev.excepciones || {}) }
      if (excepcion) excepciones[fecha] = excepcion
      else delete excepciones[fecha]
      return { ...prev, excepciones }
    })
  }

  // Mismo criterio que setDisponibilidad: acepta función o valor, persiste
  // en segundo plano (upsert porque la fila puede no existir todavía — es la
  // primera vez que este usuario toca "Mi horario") y devuelve el error si
  // lo hay, para que Horario.jsx pueda avisar si falló el guardado real.
  const setHorarioPersonal = (updater) => {
    const base = horarioPersonal || { horarioSemanal: {}, ausencias: {} }
    const siguiente = typeof updater === 'function' ? updater(base) : updater
    setHorarioPersonalState(siguiente)
    if (supabase && usuario?.id && usuario?.opticaId) {
      return supabase.from('horarios_usuario').upsert({
        usuario_id: usuario.id,
        optica_id: usuario.opticaId,
        horario_semanal: siguiente.horarioSemanal,
        ausencias: siguiente.ausencias,
      })
    }
    return Promise.resolve({ error: null })
  }

  const guardarSesion = (sesion) => {
    if (sesion) localStorage.setItem('optica_sesion', JSON.stringify(sesion));
    else localStorage.removeItem('optica_sesion');
  };

  // Rehidrata una sesión de superadmin/admin/asistente (Supabase Auth) al
  // recargar la página — o al llegar desde un link de recuperación de
  // contraseña (#access_token=...&type=recovery), que supabase-js procesa
  // de forma asíncrona un instante DESPUÉS del primer render. Por eso no
  // alcanza con getSession() una sola vez al montar (podía resolver antes
  // de que el token del link terminara de procesarse, dejando al usuario
  // varado en la landing pública) — onAuthStateChange cubre ambos casos: se
  // dispara una vez de entrada con la sesión que ya exista, y de nuevo si
  // aparece una más tarde. Solo corre si cargarSesion() no encontró ya una
  // sesión de paciente (el único tipo que sigue siendo local), para no
  // pelear con esa restauración síncrona. Se excluye explícitamente
  // sitio.modo === 'venta': la página de venta es pública y debe verse igual
  // para cualquiera, tenga o no una sesión de superadmin/admin activa en ese
  // mismo navegador — sin este guard, entrar a ?sitio=venta ya logueado te
  // mandaba derecho al panel en vez de mostrar la landing comercial.
  useEffect(() => {
    if (usuario || !supabase || sitio.modo === 'venta') return;
    const { data: suscripcion } = supabase.auth.onAuthStateChange(async (evento, session) => {
      // Deliberadamente NO se escucha 'SIGNED_IN' acá: Login.jsx ya llama a
      // AlTenerExito()/manejarExitoLogin sincrónicamente apenas termina su
      // propio flujo (incluida la verificación MFA cuando aplica). Si este
      // listener también reaccionara a SIGNED_IN, correría en paralelo su
      // propia consulta de perfil y pisaría/duplicaría ese setUsuario — una
      // carrera real que producía la pantalla "Algo salió mal" justo después
      // de iniciar sesión (y, para cuentas con MFA, podía incluso completar
      // el login saltándose el paso del código). TOKEN_REFRESHED/USER_UPDATED
      // tampoco se escuchan por la misma razón de siempre: un refresh de
      // token en segundo plano no debe reiniciar pantallaActual.
      if (!['INITIAL_SESSION', 'PASSWORD_RECOVERY'].includes(evento)) return;
      // El gate de carga (restaurandoSesion) solo se apaga en el `finally`,
      // después de que toda esta función terminó — incluidas las consultas
      // await de perfil/óptica de abajo. Apagarlo apenas se sabe que hay
      // sesión (antes de esperar esas consultas) dejaba una ventana real
      // donde el gate ya bajó pero `usuario`/`pantallaActual` todavía no se
      // habían actualizado — Login.jsx alcanzaba a pintarse en ese hueco
      // igual, solo que más corto. Con el flag apagándose recién al final,
      // cuando ya se llamó (o se decidió no llamar) a setUsuario, React
      // aplica ambos cambios de estado juntos y no hay hueco que mostrar.
      try {
        if (!session) {
          // Había una sesión guardada y ya no sirve (venció o se revocó): se dice, no se vuelve al ingreso en silencio.
          if (evento === 'INITIAL_SESSION' && habiaSesionGuardada) setAvisoSesion({ texto: MENSAJE_SESION_VENCIDA, id: Date.now() });
          return;
        }
        const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
        if (!perfil) return;
        // Una cuenta desactivada no entra, ni siquiera con una sesión que ya estaba abierta.
        if (perfil.activo === false) {
          await supabase.auth.signOut();
          setAvisoSesion({ texto: MENSAJE_CUENTA_DESACTIVADA, id: Date.now() });
          return;
        }
        if (perfil.rol === 'superadmin') {
          // El superadmin no pertenece a ninguna óptica en particular — si su
          // sesión de Supabase sigue activa en este navegador (ej. login previo
          // en otra pestaña) y el visitante entra al sitio público de UNA
          // óptica (modo 'optica', sin slug o con slug de cualquier óptica), no
          // debe colarse ahí dentro. Solo se sigue esa sesión en su propia
          // puerta de entrada (?sitio=admin).
          if (sitio.modo !== 'admin_sistema') return;
          setUsuario({ rol: 'superadmin', nombre: perfil.nombre, id: perfil.id });
          setPantallaActual('panel_superadmin');
        } else if (perfil.rol === 'admin') {
          const { data: optica } = await supabase.from('opticas').select('*').eq('id', perfil.optica_id).single();
          // Mismo problema que el superadmin arriba: si este admin tiene sesión
          // activa en el navegador y entra al sitio público de OTRA óptica (o a
          // la puerta del superadmin), no debe colarse a su propio dashboard —
          // solo se sigue la sesión en el sitio de su propia óptica (o en el
          // genérico sin slug, que es el caso normal en desarrollo).
          if (sitio.modo !== 'optica' || (sitio.slug && sitio.slug !== optica?.slug)) return;
          const extras = await cargarMisPermisos(supabase);
          setUsuario({ ...(extras || {}), rol: 'admin', nombre: perfil.nombre, id: perfil.id, opticaId: perfil.optica_id, opticaNombre: optica?.nombre, opticaMarca: optica?.marca || null, opticaLogoUrl: optica?.logo_url || null, registroProfesional: perfil.registro_profesional || null, esOptometra: !!perfil.es_optometra });
          setPantallaActual('dashboard');
        } else if (perfil.rol === 'asistente') {
          const { data: optica } = await supabase.from('opticas').select('*').eq('id', perfil.optica_id).single();
          if (sitio.modo !== 'optica' || (sitio.slug && sitio.slug !== optica?.slug)) return;
          const extras = await cargarMisPermisos(supabase);
          setUsuario({ ...(extras || {}), rol: 'asistente', nombre: perfil.nombre, id: perfil.id, opticaId: perfil.optica_id, opticaNombre: optica?.nombre, opticaMarca: optica?.marca || null, opticaLogoUrl: optica?.logo_url || null, registroProfesional: perfil.registro_profesional || null, permisos: extras?.permisos || perfil.permisos || {}, esOptometra: !!perfil.es_optometra });
          setPantallaActual('dashboard');
        }
      } finally {
        if (evento === 'INITIAL_SESSION') setRestaurandoSesion(false);
      }
    });
    return () => suscripcion.subscription.unsubscribe();
  }, []);

  // Manejador del login: Login.jsx siempre llama a esto con un objeto {..., rol}.
  const manejarExitoLogin = (datosOUsuario) => {
    setUsuario(datosOUsuario);
    if (datosOUsuario.rol === 'superadmin') {
      // Sesión real de Supabase Auth: la persiste supabase-js mismo, no optica_sesion.
      setPantallaActual('panel_superadmin');
    } else if (datosOUsuario.rol === 'admin') {
      // Sesión real de Supabase Auth: la persiste supabase-js mismo, no optica_sesion.
      // Cada login entra a Inicio, no a la última sección que Dashboard.jsx
      // recuerda en localStorage para sobrevivir un F5 dentro de la misma
      // sesión — ese recuerdo es para recargar la página, no para un login nuevo.
      localStorage.setItem('optica_seccion_activa', 'inicio');
      // Un login nuevo siempre entra con la vista de Administrador (la vista elegida solo sobrevive a un F5).
      try { localStorage.removeItem(`optica_vista_${datosOUsuario.id}`); } catch { /* sin almacenamiento */ }
      setPantallaActual('dashboard');
    } else if (datosOUsuario.rol === 'asistente') {
      // Sesión real de Supabase Auth: la persiste supabase-js mismo, no optica_sesion.
      localStorage.setItem('optica_seccion_activa', 'inicio');
      setPantallaActual('dashboard');
    } else {
      setPantallaActual('panel_paciente');
      if (datosOUsuario.id != null) {
        guardarSesion({ tipo: 'paciente', pacienteId: datosOUsuario.id, token: datosOUsuario.token });
        hidratarDatosPaciente(datosOUsuario.id, datosOUsuario.token);
      }
    }
  };

  // "Mis citas" y "Mi receta" del portal tenían el mismo problema que el
  // login: dependían de que hubiera una sesión de admin ya hidratada en ese
  // navegador. Se traen aparte, scoped solo a este paciente (mismo patrón
  // que crear_cita_publica/reagendar_cita_publica: función SECURITY
  // DEFINER, sin sesión real de Supabase Auth de por medio). Ciberseguridad:
  // el token de sesión (emitido por verificar_login_paciente) va aparte del
  // id — sin él, el RPC no devuelve nada, así que un pacienteId suelto ya no
  // alcanza para leer los datos de otra persona.
  const hidratarDatosPaciente = async (pacienteId, token) => {
    if (!supabase) { setCargandoDatosPaciente(false); return }
    setCargandoDatosPaciente(true)
    const [{ data: misCitas }, { data: misConsultas }] = await Promise.all([
      supabase.rpc('mis_citas_paciente', { p_paciente_id: pacienteId, p_token: token }),
      supabase.rpc('mis_consultas_paciente', { p_paciente_id: pacienteId, p_token: token }),
    ])
    if (misCitas) setCitas(misCitas.map(mapCita))
    if (misConsultas) setConsultas(misConsultas.map(mapConsulta))
    setCargandoDatosPaciente(false)
  };

  // Ciberseguridad: además de olvidar la sesión localmente, invalida el
  // token en el servidor — si no, "cerrar sesión" es solo cosmético y el
  // token seguiría funcionando para siempre si alguien lo copió antes.
  // `mensaje` (opcional) es lo que ve el paciente/admin en el login después
  // (cierre por inactividad, cambio de contraseña, etc.).
  const cerrarSesion = (mensaje, { conservarBorrador = false } = {}) => {
    if (usuario?.rol === 'paciente' && usuario?.id && usuario?.token && supabase) {
      supabase.rpc('invalidar_sesion_paciente', { p_paciente_id: usuario.id, p_token: usuario.token });
    }
    // Las demás pestañas se enteran del cierre (SIGNED_OUT) y dicen lo mismo que esta; esta no debe reaccionar a su propio cierre.
    cierrePropioRef.current = true;
    if (usuario?.rol !== 'paciente') guardarMotivoCierre(typeof mensaje === 'string' && mensaje ? mensaje : MENSAJE_SESION_CERRADA_EN_OTRA_PESTANA);
    // Cerrar la sesión estando dentro de una óptica también es una salida: se registra antes de cerrar la sesión real.
    const salida = usuario?.impersonadoPor ? registrarSalidaImpersonacion(usuario, 'al cerrar la sesión') : null;
    // Al cerrar sesión no queda ninguna ficha clínica a medias guardada en este equipo; salvo en el cierre por inactividad, donde el
    // borrador se conserva (24 h, solo para esa misma persona) para retomar la atención al volver a entrar.
    if (!conservarBorrador) borrarTodosLosBorradores();
    volverAlIngreso();
    Promise.resolve(salida).finally(() => supabase?.auth.signOut());
    // Se usa como onClick en varios botones: solo un texto es un aviso (si no, llega el evento del clic y abría el modal de login).
    if (typeof mensaje === 'string' && mensaje) setAvisoSesion({ texto: mensaje, id: Date.now() });
    else setAvisoSesion(null);
  };

  // Deja la pantalla en el ingreso: sin sección ni pestaña en la URL ni guardadas, para que el próximo login (o la landing) no
  // herede la pantalla donde se estaba. Lo usan el cierre de sesión y la sesión que se perdió.
  const volverAlIngreso = () => {
    setUsuario(null);
    setPantallaActual('login');
    guardarSesion(null);
    // Cerrar sesión siempre devuelve al inicio: sin sección ni pestaña en la URL ni guardadas, para que el próximo
    // login (o la landing) no herede la pantalla donde se estaba.
    try {
      localStorage.setItem('optica_seccion_activa', 'inicio');
      const params = new URLSearchParams(window.location.search);
      ['seccion', ...PARAMS_DE_SECCION].forEach((p) => params.delete(p));
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    } catch { /* sin almacenamiento/historial: no pasa nada */ }
  };

  // Entrar y salir de una óptica como administrador queda en dos lugares: la actividad del superadmin (panel "Actividad": quién,
  // qué óptica y cuándo) y la actividad de esa óptica (Usuarios y permisos), que es la que ve su administrador.
  const MARCA_IMPERSONACION = 'optica_impersonacion';
  const registrarSalidaImpersonacion = (u, motivo) => {
    try { sessionStorage.removeItem(MARCA_IMPERSONACION); } catch { /* sin almacenamiento: no pasa nada */ }
    const actor = u.impersonadoPor;
    if (!actor?.id || !u.opticaId) return Promise.resolve();
    // El servidor cierra la entrada y la deja en la actividad de la óptica y en la del superadmin.
    return Promise.resolve(supabase?.rpc('salir_de_optica', { p_optica: u.opticaId, p_nota: motivo || null })).catch(() => {});
  };

  // Impersonación de superadmin ("entrar como" el administrador de una
  // óptica) — caso #8 de la reunión con el ing. No es un cambio de sesión de
  // Supabase Auth: el superadmin sigue autenticado como él mismo (su propio
  // auth.uid()); lo único que cambia es el `usuario` local que ven
  // Dashboard/Pacientes/Inventario/etc. Es seguro porque cada tabla
  // operativa ya tiene una política RLS "_superadmin_all" (ver migración
  // 0007_operativos_core.sql y siguientes) que permite a es_superadmin()
  // leer/escribir cualquier optica_id sin importar qué diga este estado
  // local — así que aunque alguien manipulara este estado desde devtools,
  // Postgres seguiría rechazando la consulta si su sesión real no es
  // superadmin. `usuario.nombre` queda con el sufijo "(superadmin)" para que
  // cualquier registrarLog() que dispare mientras tanto (ya instrumentado en
  // cada módulo) quede visible como tal en "Actividad de esta óptica" —
  // trazabilidad real, no una identidad falsa del admin de esa óptica.
  const entrarComoOptica = (optica) => {
    if (usuario?.rol !== 'superadmin' || !optica?.id) return;
    const superadminReal = { id: usuario.id, nombre: usuario.nombre };
    // La entrada ya la validó y registró el servidor (autorización de la óptica y motivo) antes de llegar aquí.
    // Si la página se recarga estando dentro, la sesión vuelve sola al panel del superadmin: esta marca permite registrar esa salida.
    try { sessionStorage.setItem('optica_impersonacion', JSON.stringify({ actor: superadminReal, opticaId: optica.id, opticaNombre: optica.nombre })); } catch { /* sin almacenamiento */ }
    setUsuario({
      rol: 'admin',
      nombre: `${superadminReal.nombre} (superadmin)`,
      id: superadminReal.id,
      opticaId: optica.id,
      opticaNombre: optica.nombre,
      opticaMarca: optica.marca || null,
      opticaLogoUrl: optica.logo_url || null,
      impersonadoPor: superadminReal,
    });
    // Mismo criterio que manejarExitoLogin: Dashboard.jsx recuerda en
    // localStorage la última sección visitada (para que un F5 no mande a
    // Inicio) — sin este reset, entrar como el admin de una óptica podía
    // heredar la sección que dejó otra sesión/usuario en este navegador.
    localStorage.setItem('optica_seccion_activa', 'inicio');
    setPantallaActual('dashboard');
  };

  // Vuelve al panel de superadmin sin cerrar la sesión real (que nunca
  // cambió). Un F5 durante la impersonación también vuelve aquí solo:
  // onAuthStateChange rehidrata `usuario` desde el perfil real (superadmin),
  // deliberadamente no se intenta persistir el estado de impersonación
  // entre recargas — más simple y sin ambigüedad sobre qué "sesión" hay.
  const salirDeImpersonacion = () => {
    if (!usuario?.impersonadoPor) return;
    registrarSalidaImpersonacion(usuario);
    setUsuario({ rol: 'superadmin', nombre: usuario.impersonadoPor.nombre, id: usuario.impersonadoPor.id });
    setPantallaActual('panel_superadmin');
  };

  useEffect(() => {
    if (usuario?.rol !== 'superadmin' || usuario?.impersonadoPor) return;
    let marca = null;
    try { marca = JSON.parse(sessionStorage.getItem('optica_impersonacion') || 'null'); sessionStorage.removeItem('optica_impersonacion'); } catch { /* sin almacenamiento */ }
    if (marca?.actor?.id && marca.opticaId) {
      Promise.resolve(supabase?.rpc('salir_de_optica', { p_optica: marca.opticaId, p_nota: 'al recargar la página' })).catch(() => {});
    }
  }, [usuario?.rol, usuario?.impersonadoPor]);

  // Ciberseguridad: cierra sola la sesión (admin/asistente/superadmin vía
  // Supabase Auth, o paciente vía la sesión local) tras un rato sin
  // actividad real del usuario — evita dejar datos clínicos abiertos en un
  // dispositivo compartido. Cualquier click/tecla/scroll/toque reinicia el
  // conteo; llamadas de red o timers en segundo plano no cuentan.
  // El cierre usa siempre la última versión de cerrarSesion; el efecto no se reinicia cada vez que `usuario` cambia de objeto (cada
  // actualización de datos lo hace), porque reiniciarlo contaría como actividad y la inactividad nunca se cumpliría.
  const cerrarSesionRef = useRef(null);
  cerrarSesionRef.current = cerrarSesion;
  const inactividadIniciadaRef = useRef(false);
  const haySesion = !!usuario;
  useEffect(() => {
    if (!haySesion) return;
    let ultimoMovimiento = Date.now();
    let avisando = false;
    // La inactividad es de la persona, no de la pestaña: se cuenta con el último movimiento en CUALQUIERA de las pestañas abiertas.
    // Una pestaña olvidada no puede cerrar la sesión (que es una sola para todas) mientras se trabaja en otra.
    // Un minuto antes del cierre sale «¿Sigues ahí?»; mientras está, mover el mouse no reinicia nada: solo «Seguir conectado».
    const alMover = () => { if (avisando) return; ultimoMovimiento = Date.now(); registrarActividad(ultimoMovimiento); };
    const eventos = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((ev) => window.addEventListener(ev, alMover));
    // Entrar o abrir la página cuenta como actividad; que el efecto vuelva a armarse con la pantalla ya abierta, no.
    if (!inactividadIniciadaRef.current) { inactividadIniciadaRef.current = true; alMover(); } else ultimoMovimiento = Date.now() - tiempoSinActividad(Date.now());
    const revisar = () => {
      const restan = segundosParaCerrar(ultimoMovimiento);
      if (restan === null) {
        if (avisando) { avisando = false; ultimoMovimiento = Date.now(); setSegundosInactividad(null); }
        return;
      }
      // La ficha clínica abierta guarda su borrador al avisar y otra vez justo antes de cerrar.
      if (!avisando) window.dispatchEvent(new Event(EVENTO_GUARDAR_BORRADOR));
      avisando = true;
      setSegundosInactividad(restan);
      if (restan <= 0) {
        window.dispatchEvent(new Event(EVENTO_GUARDAR_BORRADOR));
        setSegundosInactividad(null);
        cerrarSesionRef.current(MENSAJE_CIERRE_POR_INACTIVIDAD, { conservarBorrador: true });
      }
    };
    const intervalo = setInterval(revisar, 1000);
    return () => {
      clearInterval(intervalo);
      eventos.forEach((ev) => window.removeEventListener(ev, alMover));
      setSegundosInactividad(null);
    };
  }, [haySesion, usuario?.id]);

  const seguirConectadoAhora = () => { seguirConectado(); setSegundosInactividad(null); };

  // Sesión perdida con la pantalla abierta (se cerró desde otra pestaña, venció o se revocó). Antes la pantalla seguía "dentro" y cada
  // acción fallaba con "no tienes permiso" o con errores de la base en inglés. Ahora se dice y se lleva al ingreso.
  useEffect(() => {
    const esPersonal = !!usuario && ['admin', 'asistente', 'superadmin'].includes(usuario.rol);
    marcarSesionEsperada(esPersonal);
    if (!esPersonal || !supabase) return;
    cierrePropioRef.current = false;
    let vencida = false;
    const sesionPerdida = (texto) => {
      if (vencida || cierrePropioRef.current) return;
      vencida = true;
      volverAlIngreso();
      setAvisoSesion({ texto, id: Date.now() });
    };
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') sesionPerdida(leerMotivoCierre() || MENSAJE_SESION_VENCIDA);
    });
    const alPerderLlamada = async () => {
      if (vencida || cierrePropioRef.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data?.session) { sesionPerdida(leerMotivoCierre() || MENSAJE_SESION_VENCIDA); return; }
      // Hay una sesión guardada: se comprueba con el servidor que todavía sirve (un 401 aislado no basta para sacar a nadie).
      const { error } = await supabase.auth.getUser();
      if (error && (error.status === 401 || error.status === 403 || /session|jwt|token/i.test(error.message || ''))) sesionPerdida(MENSAJE_SESION_VENCIDA);
    };
    window.addEventListener(EVENTO_SESION_PERDIDA, alPerderLlamada);
    return () => {
      suscripcion.subscription.unsubscribe();
      window.removeEventListener(EVENTO_SESION_PERDIDA, alPerderLlamada);
      marcarSesionEsperada(false);
    };
  }, [usuario?.id, usuario?.rol]);


  // Link "Confirmar mi asistencia" del correo de recordatorio (migración
  // 0031) — independiente de sitio/sesión, se muestra sobre cualquier otra
  // pantalla si la URL trae el parámetro.
  const citaAConfirmar = new URLSearchParams(window.location.search).get('confirmar_cita');
  // Link "Calificar mi visita" del correo de encuesta (migración 0041) —
  // mismo criterio que confirmar_cita: independiente de sitio/sesión.
  const citaAEncuestar = new URLSearchParams(window.location.search).get('encuesta_cita');
  // Política de privacidad / términos — enlaces del footer del login y de la
  // página de venta (?legal=privacidad o ?legal=terminos).
  const vistaLegal = new URLSearchParams(window.location.search).get('legal');

  // ResolutionGuard envuelve TODO el árbol de App — landing, login, agendar
  // cita pública, portal del paciente, dashboard administrativo y panel
  // superadmin — sin ninguna excepción por pantalla ni por sesión. Decisión
  // explícita: el sistema entero debe verse bien o bloquear, sin importar
  // quién entra ni desde qué dispositivo. Por eso el árbol de "qué pantalla
  // mostrar" se arma en `contenido` en vez de con returns tempranos — así
  // hay un solo punto de salida y el guard queda garantizado en todos.
  let contenido;
  if (citaAConfirmar) {
    contenido = (
      <Suspense fallback={<PantallaCargando />}>
        <ConfirmarCita />
      </Suspense>
    );
  } else if (citaAEncuestar) {
    contenido = (
      <Suspense fallback={<PantallaCargando />}>
        <EncuestaSatisfaccion citaId={citaAEncuestar} />
      </Suspense>
    );
  } else if (vistaLegal) {
    contenido = (
      <Suspense fallback={<PantallaCargando />}>
        <PaginaLegal
          vistaInicial={vistaLegal === 'terminos' ? 'terminos' : 'privacidad'}
          onVolver={() => {
            const url = new URL(window.location);
            url.searchParams.delete('legal');
            window.location.href = url.toString();
          }}
        />
      </Suspense>
    );
  } else if (restaurandoSesion) {
    // Mientras se espera saber si hay una sesión de Supabase Auth para
    // restaurar, no se muestra nada definitivo todavía — ni Login ni el
    // panel — para no parpadear de uno a otro en cuanto llegue la respuesta real.
    contenido = <PantallaCargando />;
  } else {
    contenido = (
    <Suspense fallback={<PantallaCargando />}>
      {/* 1. DASHBOARD ADMINISTRATIVO */}
      {pantallaActual === 'dashboard' && (
        <GuardiaClaveTemporal alSalir={cerrarSesion}>
        <Dashboard
          usuario={usuario}
          opticaActiva={opticaActiva}
          cargaInicialStaff={cargaInicialStaff}
          erroresCarga={erroresCarga}
          onCerrarErroresCarga={() => setErroresCarga([])}
          pacientes={pacientes}
          setPacientes={setPacientes}
          citas={citas}
          setCitas={setCitas}
          inventario={inventario}
          setInventario={setInventario}
          consultas={consultas}
          setConsultas={setConsultas}
          ventas={ventas}
          setVentas={setVentas}
          facturasVenta={facturasVenta}
          setFacturasVenta={setFacturasVenta}
          respuestasSatisfaccion={respuestasSatisfaccion}
          solicitudesEliminacion={solicitudesEliminacion}
          marcarSolicitudEliminacionAtendida={marcarSolicitudEliminacionAtendida}
          marcarMedidasAtendidas={marcarMedidasAtendidas}
          disponibilidad={disponibilidad}
          setDisponibilidad={setDisponibilidad}
          reemplazarExcepcionLocal={reemplazarExcepcionLocal}
          horarioPersonal={horarioPersonal}
          setHorarioPersonal={setHorarioPersonal}
          asistentes={asistentes}
          setAsistentes={setAsistentes}
          equipo={equipo}
          pases={pasesVenta}
          setPases={setPasesVenta}
          ordenesLab={ordenesLab}
          setOrdenesLab={setOrdenesLab}
          abonos={abonos}
          abonosAnulados={abonosAnulados}
          parametrizacion={parametrizacion}
          setParametrizacion={setParametrizacion}
          motivosConsulta={motivosConsulta}
          setMotivosConsulta={setMotivosConsulta}
          diagnosticosRapidos={diagnosticosRapidos}
          setDiagnosticosRapidos={setDiagnosticosRapidos}
          categoriasInventario={categoriasInventario}
          setCategoriasInventario={setCategoriasInventario}
          alSalir={cerrarSesion}
          onSalirImpersonacion={usuario?.impersonadoPor ? salirDeImpersonacion : null}
          alActualizarUsuario={(datos) => setUsuario((prev) => ({ ...prev, ...datos }))}
        />
        </GuardiaClaveTemporal>
      )}

      {/* 2. LANDING PAGE / LOGIN — qué se muestra depende de resolverSitio():
           dominio raíz → página de venta del sistema; subdominio admin →
           login directo del superadmin, sin la landing de ninguna óptica;
           subdominio de una óptica (o sin dominio real todavía) → landing +
           login de esa óptica, igual que siempre. */}
      {pantallaActual === 'login' && sitio.modo === 'venta' && (
        <PaginaVenta />
      )}
      {pantallaActual === 'login' && sitio.modo !== 'venta' && (
        <div className="App-contenedor">
          <Login
            pacientes={pacientes}
            asistentes={asistentes}
            opticaPublica={opticaPublica}
            disponibilidad={disponibilidad}
            avisoInicial={avisoSesion}
            soloModal={sitio.modo === 'admin_sistema'}
            resolviendoOptica={sitio.modo === 'optica' && !opticaPublica && !!supabase}
            AlTenerExito={manejarExitoLogin}
            AlIrARegistro={() => setPantallaActual('registro_paciente')}
          />
        </div>
      )}

      {/* 3. AGENDAR CITA PÚBLICA (VISITANTES SIN CUENTA) */}
      {pantallaActual === 'registro_paciente' && (
        <AgendarCitaPublica
          citas={citas}
          setCitas={setCitas}
          disponibilidad={disponibilidad}
          opticaId={opticaPublica?.id}
          opticaPublica={opticaPublica}
          parametrizacion={parametrizacion}
          motivosConsulta={motivosConsulta}
          onVolver={() => setPantallaActual('login')}
        />
      )}

      {/* 4. PORTAL PACIENTE (PACIENTES CON CUENTA LOGUEADOS) */}
      {pantallaActual === 'panel_paciente' && (
        <PortalPaciente
          usuario={usuario}
          citas={citas}
          setCitas={setCitas}
          consultas={consultas}
          disponibilidad={disponibilidad}
          opticaId={opticaPublica?.id}
          opticaPublica={opticaPublica}
          parametrizacion={parametrizacion}
          motivosConsulta={motivosConsulta}
          cargandoDatos={cargandoDatosPaciente}
          onCerrarSesion={cerrarSesion}
          alActualizarUsuario={(datos) => setUsuario((prev) => ({ ...prev, ...datos }))}
        />
      )}

      {/* 5. PANEL SUPERADMIN (CREA/ADMINISTRA ÓPTICAS) */}
      {pantallaActual === 'panel_superadmin' && (
        <GuardiaClaveTemporal alSalir={cerrarSesion}>
        <SuperadminPanel
          usuario={usuario}
          alSalir={cerrarSesion}
          alActualizarUsuario={(datos) => setUsuario((prev) => ({ ...prev, ...datos }))}
          alEntrarComo={entrarComoOptica}
        />
        </GuardiaClaveTemporal>
      )}
    </Suspense>
    );
  }

  // El personal y el superadmin (dashboard y panel) siguen con la guarda de tamaño y zoom; todo lo que ve un paciente o un visitante se adapta (regla 48).
  const pantallaDelPersonal = pantallaActual === 'dashboard' || pantallaActual === 'panel_superadmin';
  return (
    <ResolutionGuard desactivado={!pantallaDelPersonal}>
      {contenido}
      {segundosInactividad !== null && <Suspense fallback={null}><AvisoInactividad segundos={segundosInactividad} onSeguir={seguirConectadoAhora} /></Suspense>}
    </ResolutionGuard>
  );
}

export default App;
