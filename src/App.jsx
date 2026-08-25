import React, { useState, useEffect } from 'react';
import Login from './paginas/Login';
import Dashboard from './paginas/Dashboard';
import AgendarCitaPublica from './paginas/AgendarCitaPublica';
import PortalPaciente from './paginas/PortalPaciente';
import SuperadminPanel from './paginas/SuperadminPanel';
import { hoyISO } from './utilidades/disponibilidad';
import { supabase } from './lib/supabaseClient';

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

// Reconstruye la sesión activa (si hay una guardada) a partir de los pacientes ya
// cargados — se guarda sólo un tipo + pacienteId, nunca una copia del objeto
// paciente, para que la sesión restaurada refleje datos actuales y no una foto
// vieja de cuando inició sesión (ej. si el optómetra le editó el teléfono después).
function cargarSesion(pacientesActuales) {
  const sesion = cargarDeStorage('optica_sesion', null);
  if (!sesion) return { usuario: null, pantalla: 'login' };
  if (sesion.tipo === 'admin') {
    return { usuario: { nombre: 'Administrador', rol: 'admin' }, pantalla: 'dashboard' };
  }
  if (sesion.tipo === 'asistente' && sesion.asistenteId != null) {
    const asistentes = cargarDeStorage('optica_asistentes', []);
    const asistente = asistentes.find((a) => a.id === sesion.asistenteId);
    if (asistente) return { usuario: { ...asistente, rol: 'asistente' }, pantalla: 'dashboard' };
  }
  if (sesion.tipo === 'paciente' && sesion.pacienteId != null) {
    const paciente = pacientesActuales.find((p) => p.id === sesion.pacienteId);
    if (paciente) return { usuario: { ...paciente, rol: 'paciente' }, pantalla: 'panel_paciente' };
  }
  return { usuario: null, pantalla: 'login' };
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
  const [inventario, setInventario] = useState(() => cargarDeStorage('optica_inventario', INVENTARIO_SEED));
  const [consultas, setConsultas] = useState(() => cargarDeStorage('optica_consultas', []));
  const [disponibilidad, setDisponibilidad] = useState(() => migrarDisponibilidad(cargarDeStorage('optica_disponibilidad', DISPONIBILIDAD_SEED)));
  const [asistentes, setAsistentes] = useState(() => cargarDeStorage('optica_asistentes', []));
  const [parametrizacion, setParametrizacion] = useState(() => cargarDeStorage('optica_parametrizacion', PARAMETRIZACION_SEED));
  const [motivosConsulta, setMotivosConsulta] = useState(() => cargarDeStorage('optica_motivos_consulta', MOTIVOS_SEED));
  const [diagnosticosRapidos, setDiagnosticosRapidos] = useState(() => cargarDeStorage('optica_diagnosticos_rapidos', DIAGNOSTICOS_SEED));

  useEffect(() => {
    localStorage.setItem('optica_asistentes', JSON.stringify(asistentes));
  }, [asistentes]);

  useEffect(() => {
    localStorage.setItem('optica_parametrizacion', JSON.stringify(parametrizacion));
  }, [parametrizacion]);

  useEffect(() => {
    localStorage.setItem('optica_motivos_consulta', JSON.stringify(motivosConsulta));
  }, [motivosConsulta]);

  useEffect(() => {
    localStorage.setItem('optica_diagnosticos_rapidos', JSON.stringify(diagnosticosRapidos));
  }, [diagnosticosRapidos]);

  useEffect(() => {
    localStorage.setItem('optica_disponibilidad', JSON.stringify(disponibilidad));
  }, [disponibilidad]);

  useEffect(() => {
    localStorage.setItem('optica_pacientes', JSON.stringify(pacientes));
  }, [pacientes]);

  useEffect(() => {
    localStorage.setItem('optica_citas', JSON.stringify(citas));
  }, [citas]);

  useEffect(() => {
    localStorage.setItem('optica_inventario', JSON.stringify(inventario));
  }, [inventario]);

  useEffect(() => {
    localStorage.setItem('optica_consultas', JSON.stringify(consultas));
  }, [consultas]);

  const guardarSesion = (sesion) => {
    if (sesion) localStorage.setItem('optica_sesion', JSON.stringify(sesion));
    else localStorage.removeItem('optica_sesion');
  };

  // Rehidrata una sesión de superadmin/admin (Supabase Auth) al recargar la página.
  // Solo corre si cargarSesion() no encontró ya una sesión de asistente/paciente,
  // para no pelear con esa restauración síncrona.
  useEffect(() => {
    if (usuario || !supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single();
      if (!perfil) return;
      if (perfil.rol === 'superadmin') {
        setUsuario({ rol: 'superadmin', nombre: perfil.nombre, id: perfil.id });
        setPantallaActual('panel_superadmin');
      } else if (perfil.rol === 'admin') {
        const { data: optica } = await supabase.from('opticas').select('*').eq('id', perfil.optica_id).single();
        setUsuario({ rol: 'admin', nombre: perfil.nombre, id: perfil.id, opticaId: perfil.optica_id, opticaNombre: optica?.nombre });
        setPantallaActual('dashboard');
      }
    });
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
      setPantallaActual('dashboard');
      guardarSesion({ tipo: 'asistente', asistenteId: datosOUsuario.id });
    } else {
      setPantallaActual('panel_paciente');
      if (datosOUsuario.id != null) guardarSesion({ tipo: 'paciente', pacienteId: datosOUsuario.id });
    }
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setPantallaActual('login');
    guardarSesion(null);
    supabase?.auth.signOut();
  };

  return (
    <>
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
          alSalir={cerrarSesion}
        />
      )}

      {/* 2. LANDING PAGE / LOGIN */}
      {pantallaActual === 'login' && (
        <div className="App-contenedor">
          <Login
            pacientes={pacientes}
            asistentes={asistentes}
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
          onVolver={() => setPantallaActual('login')}
        />
      )}

      {/* 4. PORTAL PACIENTE (PACIENTES CON CUENTA LOGUEADOS) */}
      {pantallaActual === 'panel_paciente' && (
        <PortalPaciente
          usuario={usuario}
          pacientes={pacientes}
          setPacientes={setPacientes}
          citas={citas}
          setCitas={setCitas}
          consultas={consultas}
          disponibilidad={disponibilidad}
          parametrizacion={parametrizacion}
          motivosConsulta={motivosConsulta}
          onCerrarSesion={cerrarSesion}
        />
      )}

      {/* 5. PANEL SUPERADMIN (CREA/ADMINISTRA ÓPTICAS) */}
      {pantallaActual === 'panel_superadmin' && (
        <SuperadminPanel usuario={usuario} alSalir={cerrarSesion} />
      )}
    </>
  );
}

export default App;
