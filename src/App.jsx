import React, { useState, useEffect, Suspense, lazy } from 'react';
import Login from './paginas/Login';
import { hoyISO } from './utilidades/disponibilidad';
import { supabase } from './lib/supabaseClient';
import { resolverOpticaPublica } from './utilidades/opticaActual';
import { resolverSitio } from './utilidades/resolverSitio';

// Login se queda como import normal: es la pantalla de entrada más común
// (cualquier visitante público, paciente o staff pasa por acá primero) — el
// resto de "pantallas" son mutuamente excluyentes entre sí y bastante
// pesadas (paneles completos), así que se cargan bajo demanda: un paciente
// nunca necesita bajar el código de SuperadminPanel, un visitante público
// nunca necesita el de PortalPaciente, etc.
const PaginaVenta = lazy(() => import('./paginas/PaginaVenta'));
const Dashboard = lazy(() => import('./paginas/Dashboard'));
const AgendarCitaPublica = lazy(() => import('./paginas/AgendarCitaPublica'));
const PortalPaciente = lazy(() => import('./paginas/PortalPaciente'));
const SuperadminPanel = lazy(() => import('./paginas/SuperadminPanel'));
const ConfirmarCita = lazy(() => import('./paginas/ConfirmarCita'));
const PaginaLegal = lazy(() => import('./paginas/PaginaLegal'));

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

const INVENTARIO_SEED = [
  { id: 1, nombre: "Armazón Ray-Ban Aviator Metal", categoria: "Armazones", stock: 12, precio: 145.0 },
  { id: 2, nombre: "Líquido Limpiador Anti-Fog Premium", categoria: "Accesorios", stock: 25, precio: 5.5 },
];

// Horario habitual del optómetra + parámetros de agenda (ver src/utilidades/disponibilidad.js)
// Parametrización de la óptica (feedback del asesor, 2026-08-20): lo que el
// sistema soporta es fijo, pero cada óptica decide qué de eso usa y qué
// políticas aplica de cara al paciente. Antes esto estaba fijo en el código
// (medidas siempre protegidas) — ahora lo decide el administrador.
const PARAMETRIZACION_SEED = {
  mostrarMedidasPaciente: false, // ¿el paciente ve esfera/cilindro/eje sin costo adicional?
  manejaProgresion: true, // ¿ofrece esta óptica adaptación de lentes progresivos?
}

// Catálogos editables por el administrador (feedback del asesor, 2026-08-20):
// las etiquetas que trae el sistema por defecto son un punto de partida, no
// una lista fija — cada óptica agrega/renombra/elimina según su propio
// lenguaje clínico.
const MOTIVOS_SEED = ["Consulta General", "Adaptación de Lentes", "Examen de Control", "Garantía / Ajuste"]
const CATEGORIAS_INVENTARIO_SEED = ["Armazones", "Accesorios"]
const DIAGNOSTICOS_SEED = [
  "Miopía",
  "Hipermetropía",
  "Astigmatismo",
  "Presbicia",
  "Miopía y astigmatismo",
  "Hipermetropía y astigmatismo",
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
    referidoPor: p.referido_por, evolucion: p.evolucion, estadoCorreccion: p.estado_correccion,
    fechaRegistro: p.fecha_registro, tieneCuenta: p.tiene_cuenta, usuario: p.usuario, claveTemporal: p.clave_temporal,
    ultimoSaludoCumpleAnio: p.ultimo_saludo_cumple_anio,
  }
}
function mapCita(c) {
  const partes = (c.paciente || '').trim().split(' ').filter(Boolean)
  const iniciales = partes.length > 1 ? (partes[0][0] + partes[1][0]).toUpperCase() : (partes[0]?.[0] || 'P').toUpperCase()
  return { id: c.id, fecha: c.fecha, hora: c.hora, pacienteId: c.paciente_id, paciente: c.paciente, cedula: c.cedula, telefono: c.telefono, motivo: c.motivo, motivoPublico: c.motivo_publico, iniciales, estado: c.estado }
}
function mapConsulta(c) {
  return {
    id: c.id, fecha: c.fecha, pacienteId: c.paciente_id, paciente: c.paciente, motivo: c.motivo,
    usaLentes: c.usa_lentes, antecedentes: c.antecedentes, alergias: c.alergias, antecedentesFamiliares: c.antecedentes_familiares,
    retinoscopia: c.datos_clinicos?.retinoscopia, od: c.datos_clinicos?.od, oi: c.datos_clinicos?.oi,
    medidas: c.datos_clinicos?.medidas, examen: c.datos_clinicos?.examen,
    diagnostico: c.diagnostico, lenteRecomendado: c.lente_recomendado, indicaciones: c.indicaciones,
    proximoControlDias: c.proximo_control_dias, evolucionCalculada: c.evolucion_calculada, estadoCorreccion: c.estado_correccion,
    productoId: c.producto_id, productoNombre: c.producto_nombre, profesionalNombre: c.profesional_nombre,
  }
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
  // Ciberseguridad: mensaje para el login cuando la sesión se cerró sola por
  // inactividad (ver el useEffect junto a cerrarSesion, más abajo).
  const [avisoSesion, setAvisoSesion] = useState(null);
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
  const [consultas, setConsultas] = useState(() => cargarDeStorage('optica_consultas', []));
  const [disponibilidad, setDisponibilidadState] = useState(DISPONIBILIDAD_SEED);
  const [asistentes, setAsistentes] = useState([]);
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

  // Restaura la sesión de un paciente real al recargar la página. cargarSesion()
  // (más arriba) solo puede resolverla sincrónicamente si el pacienteId guardado
  // ya está en el `pacientes` local — eso solo pasa por casualidad (el mismo
  // navegador donde antes entró un admin). Para el caso real (el paciente en su
  // propio dispositivo, sin ese estado hidratado) hace falta ir a buscarlo.
  useEffect(() => {
    if (!supabase) return
    const sesion = cargarDeStorage('optica_sesion', null)
    if (sesion?.tipo !== 'paciente' || sesion.pacienteId == null) return
    if (usuario?.rol === 'paciente' && usuario?.id === sesion.pacienteId && usuario?.token === sesion.token) return
    supabase.rpc('obtener_paciente_por_id', { p_paciente_id: sesion.pacienteId, p_token: sesion.token }).then(({ data }) => {
      const fila = data?.[0]
      if (!fila) { guardarSesion(null); setUsuario(null); setPantallaActual('login'); return }
      const pacienteMapeado = mapPaciente(fila)
      setUsuario({ ...pacienteMapeado, rol: 'paciente', token: sesion.token })
      setPantallaActual('panel_paciente')
      setPacientes([pacienteMapeado])
      hidratarDatosPaciente(fila.id, sesion.token)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('optica_pacientes', JSON.stringify(pacientes));
  }, [pacientes]);

  useEffect(() => {
    localStorage.setItem('optica_citas', JSON.stringify(citas));
  }, [citas]);

  useEffect(() => {
    localStorage.setItem('optica_consultas', JSON.stringify(consultas));
  }, [consultas]);

  // parametrizacion/motivosConsulta/diagnosticosRapidos viven en columnas de
  // `opticas` (settings/motivos_consulta/diagnosticos_rapidos); disponibilidad
  // e inventario son tablas propias — todo scoped por optica_id. Admin
  // logueado usa su propia optica_id (RLS normal); sin sesión (agendar cita
  // pública, portal de paciente, login público) se resuelve la óptica real
  // por el slug de resolverSitio() vía resolverOpticaPublica() — cae en
  // OPTICA_ID_DEFAULT si no hay slug o no hay dominio real todavía.
  useEffect(() => {
    if (!supabase) return
    const esAdmin = usuario?.rol === 'admin' && !!usuario?.opticaId

    if (esAdmin) {
      supabase.from('opticas').select('settings, motivos_consulta, diagnosticos_rapidos, categorias_inventario').eq('id', usuario.opticaId).maybeSingle().then(({ data }) => {
        if (!data) return
        setParametrizacionState(data.settings || PARAMETRIZACION_SEED)
        setMotivosConsultaState(data.motivos_consulta || MOTIVOS_SEED)
        setDiagnosticosRapidosState(data.diagnosticos_rapidos || DIAGNOSTICOS_SEED)
        setCategoriasInventarioState(data.categorias_inventario || CATEGORIAS_INVENTARIO_SEED)
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
      supabase.from('inventario').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setInventario(data.map((p) => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, stock: p.stock, precio: Number(p.precio), observacion: p.observacion || '' })))
      })

      // pacientes/citas/consultas: hidratan el estado local con lo real de
      // Supabase al loguearse el admin. El estado sigue viviendo en App.jsx
      // (mismas props de siempre para Pacientes/Citas/ConsultaMedica/etc.) y
      // sigue espejándose en localStorage — así el portal de paciente y
      // agendar-cita-pública (que no tienen sesión real) siguen viendo algo
      // en ese mismo navegador, igual que antes de esta migración.
      supabase.from('pacientes').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setPacientes(data.map(mapPaciente))
      })

      supabase.from('citas').select('*').eq('optica_id', opticaId).then(({ data }) => {
        if (data) setCitas(data.map(mapCita))
      })

      supabase.from('consultas').select('*').eq('optica_id', opticaId).order('created_at', { ascending: false }).then(({ data }) => {
        if (data) setConsultas(data.map(mapConsulta))
      })

      supabase.from('perfiles').select('id, nombre, email, permisos').eq('optica_id', opticaId).eq('rol', 'asistente').then(({ data }) => {
        if (data) setAsistentes(data.map((a) => ({ id: a.id, nombre: a.nombre, correo: a.email, permisos: a.permisos || {} })))
      })
    }
  }

  // Wrappers: actualizan el estado local al instante (misma firma de siempre,
  // aceptan función o valor) y persisten en Supabase en segundo plano. Solo
  // el administrador puede escribir (usuario.opticaId real) — sin eso, el
  // cambio queda solo en memoria de esta sesión, sin persistir.
  const setParametrizacion = (updater) => {
    setParametrizacionState((prev) => {
      const siguiente = typeof updater === 'function' ? updater(prev) : updater
      if (supabase && usuario?.opticaId) {
        supabase.from('opticas').update({ settings: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
          if (error) console.error('No se pudo guardar la configuración de la óptica:', error.message)
        })
      }
      return siguiente
    })
  }

  const setMotivosConsulta = (updater) => {
    setMotivosConsultaState((prev) => {
      const siguiente = typeof updater === 'function' ? updater(prev) : updater
      if (supabase && usuario?.opticaId) {
        supabase.from('opticas').update({ motivos_consulta: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
          if (error) console.error('No se pudieron guardar los motivos de consulta:', error.message)
        })
      }
      return siguiente
    })
  }

  const setDiagnosticosRapidos = (updater) => {
    setDiagnosticosRapidosState((prev) => {
      const siguiente = typeof updater === 'function' ? updater(prev) : updater
      if (supabase && usuario?.opticaId) {
        supabase.from('opticas').update({ diagnosticos_rapidos: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
          if (error) console.error('No se pudieron guardar los diagnósticos rápidos:', error.message)
        })
      }
      return siguiente
    })
  }

  const setCategoriasInventario = (updater) => {
    setCategoriasInventarioState((prev) => {
      const siguiente = typeof updater === 'function' ? updater(prev) : updater
      if (supabase && usuario?.opticaId) {
        supabase.from('opticas').update({ categorias_inventario: siguiente }).eq('id', usuario.opticaId).then(({ error }) => {
          if (error) console.error('No se pudieron guardar las categorías de inventario:', error.message)
        })
      }
      return siguiente
    })
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
      // Ignora TOKEN_REFRESHED/USER_UPDATED — si no, un refresh de token en
      // segundo plano mientras el usuario navega el panel reiniciaría
      // pantallaActual de vuelta a la pantalla de entrada.
      if (!session || !['INITIAL_SESSION', 'SIGNED_IN', 'PASSWORD_RECOVERY'].includes(evento)) return;
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
      if (!perfil) return;
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
        setUsuario({ rol: 'admin', nombre: perfil.nombre, id: perfil.id, opticaId: perfil.optica_id, opticaNombre: optica?.nombre, opticaMarca: optica?.marca || null });
        setPantallaActual('dashboard');
      } else if (perfil.rol === 'asistente') {
        const { data: optica } = await supabase.from('opticas').select('*').eq('id', perfil.optica_id).single();
        if (sitio.modo !== 'optica' || (sitio.slug && sitio.slug !== optica?.slug)) return;
        setUsuario({ rol: 'asistente', nombre: perfil.nombre, id: perfil.id, opticaId: perfil.optica_id, opticaNombre: optica?.nombre, opticaMarca: optica?.marca || null, permisos: perfil.permisos || {} });
        setPantallaActual('dashboard');
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
      setPantallaActual('dashboard');
    } else if (datosOUsuario.rol === 'asistente') {
      // Sesión real de Supabase Auth: la persiste supabase-js mismo, no optica_sesion.
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
    if (!supabase) return
    const [{ data: misCitas }, { data: misConsultas }] = await Promise.all([
      supabase.rpc('mis_citas_paciente', { p_paciente_id: pacienteId, p_token: token }),
      supabase.rpc('mis_consultas_paciente', { p_paciente_id: pacienteId, p_token: token }),
    ])
    if (misCitas) setCitas(misCitas.map(mapCita))
    if (misConsultas) setConsultas(misConsultas.map(mapConsulta))
  };

  // Ciberseguridad: además de olvidar la sesión localmente, invalida el
  // token en el servidor — si no, "cerrar sesión" es solo cosmético y el
  // token seguiría funcionando para siempre si alguien lo copió antes.
  // `mensaje` (opcional) es lo que ve el paciente/admin en el login después
  // (cierre por inactividad, cambio de contraseña, etc.).
  const cerrarSesion = (mensaje) => {
    if (usuario?.rol === 'paciente' && usuario?.id && usuario?.token && supabase) {
      supabase.rpc('invalidar_sesion_paciente', { p_paciente_id: usuario.id, p_token: usuario.token });
    }
    setUsuario(null);
    setPantallaActual('login');
    guardarSesion(null);
    supabase?.auth.signOut();
    if (mensaje) setAvisoSesion({ texto: mensaje, id: Date.now() });
  };

  // Ciberseguridad: cierra sola la sesión (admin/asistente/superadmin vía
  // Supabase Auth, o paciente vía la sesión local) tras un rato sin
  // actividad real del usuario — evita dejar datos clínicos abiertos en un
  // dispositivo compartido. Cualquier click/tecla/scroll/toque reinicia el
  // conteo; llamadas de red o timers en segundo plano no cuentan.
  useEffect(() => {
    if (!usuario) return;
    let temporizador;
    const reiniciar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        cerrarSesion('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.');
      }, 15 * 60 * 1000);
    };
    const eventos = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((ev) => window.addEventListener(ev, reiniciar));
    reiniciar();
    return () => {
      clearTimeout(temporizador);
      eventos.forEach((ev) => window.removeEventListener(ev, reiniciar));
    };
  }, [usuario]);

  // Link "Confirmar mi asistencia" del correo de recordatorio (migración
  // 0031) — independiente de sitio/sesión, se muestra sobre cualquier otra
  // pantalla si la URL trae el parámetro.
  const citaAConfirmar = new URLSearchParams(window.location.search).get('confirmar_cita');
  if (citaAConfirmar) {
    return (
      <Suspense fallback={<PantallaCargando />}>
        <ConfirmarCita citaId={citaAConfirmar} />
      </Suspense>
    );
  }

  // Política de privacidad / términos — enlaces del footer del login y de la
  // página de venta (?legal=privacidad o ?legal=terminos).
  const vistaLegal = new URLSearchParams(window.location.search).get('legal');
  if (vistaLegal) {
    return (
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
  }

  return (
    <Suspense fallback={<PantallaCargando />}>
      {/* 1. DASHBOARD ADMINISTRATIVO */}
      {pantallaActual === 'dashboard' && (
        <Dashboard
          usuario={usuario}
          pacientes={pacientes}
          setPacientes={setPacientes}
          citas={citas}
          setCitas={setCitas}
          inventario={inventario}
          setInventario={setInventario}
          consultas={consultas}
          setConsultas={setConsultas}
          disponibilidad={disponibilidad}
          setDisponibilidad={setDisponibilidad}
          asistentes={asistentes}
          setAsistentes={setAsistentes}
          parametrizacion={parametrizacion}
          setParametrizacion={setParametrizacion}
          motivosConsulta={motivosConsulta}
          setMotivosConsulta={setMotivosConsulta}
          diagnosticosRapidos={diagnosticosRapidos}
          setDiagnosticosRapidos={setDiagnosticosRapidos}
          categoriasInventario={categoriasInventario}
          setCategoriasInventario={setCategoriasInventario}
          alSalir={cerrarSesion}
        />
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
          onCerrarSesion={cerrarSesion}
        />
      )}

      {/* 5. PANEL SUPERADMIN (CREA/ADMINISTRA ÓPTICAS) */}
      {pantallaActual === 'panel_superadmin' && (
        <SuperadminPanel
          usuario={usuario}
          alSalir={cerrarSesion}
          alActualizarUsuario={(datos) => setUsuario((prev) => ({ ...prev, ...datos }))}
        />
      )}
    </Suspense>
  );
}

export default App;
