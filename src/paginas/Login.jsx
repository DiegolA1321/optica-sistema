import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"
import { cargarMisPermisos, MENSAJE_CUENTA_DESACTIVADA } from "../utilidades/sesionPermisos"
import usePaginaPublicaDatos from "../utilidades/usePaginaPublicaDatos"
import PaginaPublica from "../componentes/publica/PaginaPublica"
import VentanaIngreso from "../componentes/publica/VentanaIngreso"
import IngresoSuperadmin from "../componentes/publica/IngresoSuperadmin"

// Ingreso del sistema. Dos pantallas: la página pública de la óptica (con la ventana «Iniciar sesión» encima: un solo acceso
// para pacientes y equipo) y, en ?sitio=admin, el ingreso del superadmin. Aquí vive la lógica del ingreso (contraseña, MFA,
// perfiles); lo que se ve está en componentes/publica/.
export default function Login({ pacientes = [], opticaPublica = null, disponibilidad = null, soloModal = false, resolviendoOptica = false, avisoInicial = null, AlTenerExito = () => {}, AlIrARegistro = () => {} }) {
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarModal, setMostrarModal] = useState(false)
  const [errorLogin, setErrorLogin] = useState("")
  const [enviando, setEnviando] = useState(false)
  // Verificación en dos pasos (MFA/TOTP) — null hasta que un admin/asistente/superadmin con la verificación activada entra con su
  // contraseña; a partir de ahí se pide el código antes de dar acceso (ver SeccionMfa.jsx para dónde se activa).
  const [mfaPendiente, setMfaPendiente] = useState(null)
  const [codigoMfa, setCodigoMfa] = useState("")
  const datosPublicos = usePaginaPublicaDatos(soloModal ? null : opticaPublica?.id)

  // Ciberseguridad: si App.jsx cerró la sesión sola por inactividad, muestra el aviso aquí — y abre la ventana para que se vea
  // (en el sitio de una óptica el ingreso vive en una ventana cerrada por defecto).
  useEffect(() => {
    if (!avisoInicial?.texto) return
    setErrorLogin(avisoInicial.texto)
    if (!soloModal) setMostrarModal(true)
  }, [avisoInicial, soloModal])

  const abrirLogin = () => {
    setErrorLogin("")
    setMostrarModal(true)
  }
  const cerrarLogin = () => setMostrarModal(false)

  // Resuelve el perfil real (superadmin/admin/asistente) y llama a
  // AlTenerExito — factorizado aparte de manejarEnvio porque se necesita
  // llamar desde dos lugares: justo tras la contraseña (si la cuenta no
  // tiene MFA activado) o tras verificar el código MFA (si sí lo tiene).
  // Devuelve true si ya se manejó el caso (éxito o un error específico ya
  // mostrado), false si no hubo perfil coincidente y debe caer al mensaje
  // genérico de "usuario o contraseña incorrectos".
  const completarLoginConPerfil = async (userId) => {
    const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", userId).single()
    if (perfil && perfil.activo === false) {
      await supabase.auth.signOut()
      setErrorLogin(MENSAJE_CUENTA_DESACTIVADA)
      return true
    }
    if (perfil?.rol === "superadmin") {
      // Modo anteproyecto: MODO_SAAS_VISIBLE solo oculta, dentro del panel,
      // los widgets que revelan el lado comercial multi-óptica — el acceso
      // (login) del superadmin nunca se bloquea. Ver
      // [[project_ocultar_saas_anteproyecto]].
      AlTenerExito({ rol: "superadmin", nombre: perfil.nombre, id: perfil.id })
      return true
    }
    // El admin/asistente de una óptica solo puede entrar por el link de SU
    // PROPIA óptica — antes cualquier cuenta real (de cualquier óptica)
    // autenticaba en el link de cualquier otra, y aunque no se filtraba
    // ningún dato ajeno (el resto del flujo igual carga por
    // perfil.optica_id, nunca por lo que diga la URL), confundía y permitía
    // "probar" credenciales de una óptica contra el link de otra.
    // opticaPublica ya resuelve siempre a alguna óptica (la del slug, o la
    // de referencia si no hay slug), así que esta comparación aplica sin
    // excepción para todo lo que no sea superadmin.
    if (perfil && perfil.optica_id !== opticaPublica?.id) {
      await supabase.auth.signOut()
      setErrorLogin("Esta cuenta no pertenece a esta óptica.")
      return true
    }
    if (perfil?.rol === "admin") {
      const { data: optica } = await supabase.from("opticas").select("*").eq("id", perfil.optica_id).single()
      if (optica && !optica.activa) {
        await supabase.auth.signOut()
        setErrorLogin("Esta óptica fue suspendida. Contacta al administrador del sistema para reactivarla.")
        return true
      }
      const extrasAdmin = await cargarMisPermisos(supabase)
      AlTenerExito({
        ...(extrasAdmin || {}),
        rol: "admin",
        nombre: perfil.nombre,
        id: perfil.id,
        opticaId: perfil.optica_id,
        opticaNombre: optica?.nombre,
        opticaMarca: optica?.marca || null,
        opticaLogoUrl: optica?.logo_url || null,
        registroProfesional: perfil.registro_profesional || null,
        esOptometra: !!perfil.es_optometra,
      })
      return true
    }
    if (perfil?.rol === "asistente") {
      const { data: optica } = await supabase.from("opticas").select("*").eq("id", perfil.optica_id).single()
      if (optica && !optica.activa) {
        await supabase.auth.signOut()
        setErrorLogin("Esta óptica fue suspendida. Contacta al administrador del sistema para reactivarla.")
        return true
      }
      const extrasAsistente = await cargarMisPermisos(supabase)
      AlTenerExito({
        ...(extrasAsistente || {}),
        rol: "asistente",
        nombre: perfil.nombre,
        id: perfil.id,
        opticaId: perfil.optica_id,
        opticaNombre: optica?.nombre,
        opticaMarca: optica?.marca || null,
        opticaLogoUrl: optica?.logo_url || null,
        registroProfesional: perfil.registro_profesional || null,
        permisos: extrasAsistente?.permisos || perfil.permisos || {},
        esOptometra: !!perfil.es_optometra,
      })
      return true
    }
    return false
  }

  // Paso 2 del login cuando la cuenta tiene verificación en dos pasos
  // activada (ver la comprobación de aal en manejarEnvio, más abajo).
  const verificarCodigoMfa = async (e) => {
    e.preventDefault()
    if (enviando || !mfaPendiente) return
    setErrorLogin("")
    setEnviando(true)
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaPendiente.factorId,
      challengeId: mfaPendiente.challengeId,
      code: codigoMfa.trim(),
    })
    if (error) {
      setErrorLogin("Código incorrecto. Verifica la app de autenticación e intenta de nuevo.")
      setEnviando(false)
      return
    }
    const userId = mfaPendiente.userId
    setMfaPendiente(null)
    setCodigoMfa("")
    await completarLoginConPerfil(userId)
    setEnviando(false)
  }

  const cancelarMfa = async () => {
    await supabase.auth.signOut()
    setMfaPendiente(null)
    setCodigoMfa("")
    setErrorLogin("")
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (enviando) return
    setErrorLogin("")
    // La óptica del sitio se resuelve en segundo plano. Enviar antes de que llegue mandaba el RPC del
    // paciente sin p_optica_id (404) y comparaba el perfil contra una óptica aún vacía ("no pertenece a esta óptica").
    if (resolviendoOptica) { setErrorLogin("Estamos cargando los datos de la óptica. Intenta de nuevo en un momento."); return }
    setEnviando(true)
    try {
      const u = usuario.trim().toLowerCase()

      // Acceso de demostración fijo para el portal del paciente — solo en
      // desarrollo local (import.meta.env.DEV), nunca en el build de
      // producción: Vite reemplaza este flag por una constante en build time
      // y elimina la rama muerta, así que el usuario/clave fijos no llegan
      // a los archivos generados en dist/. Útil para probar el portal sin
      // tener que crear un paciente primero.
      if (import.meta.env.DEV && u === "paciente@gmail.com" && password === "123456") {
        const demo = pacientes.find((p) => p.nombre === "María Elena Anchundia") || {
          id: 2,
          nombre: "María Elena Anchundia",
          cedula: "1309876546",
          telefono: "0991234567",
          correo: "maria@ejemplo.com",
          fecha_nacimiento: "1985-03-15",
        }
        AlTenerExito({ ...demo, rol: "paciente" })
        return
      }

      // Cuentas reales de paciente: la contraseña se verifica en el servidor
      // (función SECURITY DEFINER) — antes se comparaba contra el estado
      // local `pacientes`, que solo tiene datos reales si un admin ya iniciió
      // sesión antes en ese mismo navegador. Para el paciente real, en su
      // propio dispositivo, esa comparación nunca podía funcionar.
      // Solo con una óptica resuelta: el acceso de superadmin (?sitio=admin) no tiene óptica ni pacientes, y sin
      // p_optica_id la función no existe para el servidor (404 inútil en cada inicio de sesión).
      if (supabase && opticaPublica?.id) {
        const { data: filas } = await supabase.rpc("verificar_login_paciente", {
          p_usuario: usuario.trim(),
          p_clave: password,
          p_optica_id: opticaPublica?.id,
        })
        const fila = filas?.[0]
        if (fila?.bloqueado) {
          setErrorLogin(`Demasiados intentos fallidos. Intenta de nuevo en ${fila.minutos_restantes} minuto${fila.minutos_restantes === 1 ? "" : "s"}.`)
          setEnviando(false)
          return
        }
        if (fila?.id) {
          AlTenerExito({
            id: fila.id, nombre: fila.nombre, cedula: fila.cedula, telefono: fila.telefono, correo: fila.correo,
            fecha_nacimiento: fila.fecha_nacimiento, ultimaConsulta: fila.ultima_consulta, estadoClinico: fila.estado_clinico,
            referidoPor: fila.referido_por, evolucion: fila.evolucion, estadoCorreccion: fila.estado_correccion,
            fechaRegistro: fila.fecha_registro, tieneCuenta: fila.tiene_cuenta,
            rol: "paciente", token: fila.sesion_token,
          })
          return
        }
      }

      // Superadmin / admin por óptica: cuentas reales en Supabase Auth.
      // `supabase` es null si aún no se configuró .env.local (ver supabaseClient.js).
      const { data, error } = supabase
        ? await supabase.auth.signInWithPassword({ email: usuario.trim(), password })
        : { data: null, error: true }
      if (!error && data?.user) {
        // Verificación en dos pasos: si esta cuenta tiene un factor TOTP
        // verificado, Supabase la deja en aal1 tras la contraseña y solo
        // sube a aal2 después del código — se pide acá antes de resolver el
        // perfil. Envuelto en try/catch a propósito: si esta comprobación
        // fallara por lo que sea, el login de alguien SIN MFA activado
        // nunca debe quedar bloqueado por eso.
        try {
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
            const { data: factoresData } = await supabase.auth.mfa.listFactors()
            const factor = factoresData?.totp?.find((f) => f.status === "verified")
            if (factor) {
              const { data: challenge, error: errorChallenge } = await supabase.auth.mfa.challenge({ factorId: factor.id })
              if (!errorChallenge) {
                setMfaPendiente({ factorId: factor.id, challengeId: challenge.id, userId: data.user.id })
                return
              }
            }
          }
        } catch {
          // seguir con el login normal
        }

        const manejado = await completarLoginConPerfil(data.user.id)
        if (manejado) return
      }

      setErrorLogin("Usuario o contraseña incorrectos. Verifica tus datos o pídelos de nuevo al optómetra.")
    } finally {
      setEnviando(false)
    }
  }

  // Una visita por carga de página — solo para el sitio real de una óptica
  // (no en el modo soloModal, que es el login directo del superadmin y no
  // cuenta como visita de un cliente).
  useEffect(() => {
    if (!soloModal && opticaPublica?.id) {
      supabase?.rpc('registrar_visita', { p_tipo: 'optica_publica', p_optica_id: opticaPublica.id }).then(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opticaPublica?.id])

  const propsIngreso = {
    usuario, setUsuario, password, setPassword, errorLogin, enviando, resolviendoOptica,
    mfaPendiente, codigoMfa, setCodigoMfa, manejarEnvio, verificarCodigoMfa, cancelarMfa,
  }

  if (soloModal) return <IngresoSuperadmin {...propsIngreso} />

  return (
    <>
      <PaginaPublica
        opticaPublica={opticaPublica}
        disponibilidad={disponibilidad}
        datos={datosPublicos}
        abrirLogin={abrirLogin}
        alAgendar={(motivo) => AlIrARegistro(typeof motivo === "string" ? motivo : undefined)}
      />
      {mostrarModal && (
        <VentanaIngreso
          {...propsIngreso}
          opticaPublica={opticaPublica}
          disponibilidad={disponibilidad}
          onCerrar={cerrarLogin}
          onAgendar={() => {
            cerrarLogin()
            AlIrARegistro()
          }}
        />
      )}
    </>
  )
}
