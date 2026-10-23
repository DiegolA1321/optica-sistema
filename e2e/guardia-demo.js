// La Óptica Demo es de SOLO LECTURA para las pruebas (regla 40): todo lo que crea o cambia datos corre en la óptica de pruebas.
// Esta guardia lo hace cumplir: en una sesión de la Demo, cualquier escritura a la API de datos se cancela y se anota; al terminar
// la corrida, verificar-demo.js falla si quedó alguna anotación. Se permiten solo las llamadas que el sistema hace al entrar y que
// no escriben datos de la óptica (permisos y sus niveles, quién es el administrador principal, equipo, el contador de visitas de la página pública y el inicio de sesión y las compras de un paciente (producto y fecha), que se pide por POST pero solo lee).
import fs from 'node:fs'

export const ARCHIVO_ESCRITURAS_DEMO = 'test-results/escrituras-demo.log'
const PERMITIDAS = /\/rest\/v1\/rpc\/(mis_permisos|equipo_optica|verificar_login_paciente|registrar_visita|permisos_por_nivel_vigentes|soy_administrador_principal|abonos_anulados|compras_de_paciente|mis_citas_paciente|mis_consultas_paciente|mis_compras_paciente|mis_ordenes_paciente|mi_control_paciente|mis_citas_detalle_paciente|mis_referidos_paciente|mis_solicitudes_lentes_paciente|obtener_paciente_por_id|horas_ocupadas_publicas|mis_permisos_mensajes|datos_transferencia_paciente|mi_solicitud_medidas_paciente|plantillas_de_avisos|agenda_profesionales|pagina_publica_datos|profesionales_agendamiento)$/

// Marcar un aviso interno como leído al abrir Soporte: no cambia datos de la óptica que importen, y en la Demo se cancela sin fallar la corrida.
const CANCELAR_SIN_FALLAR = /\/rest\/v1\/rpc\/lecturas_avisos_internos$/

export async function protegerDemo(page) {
  await page.route(/\/rest\/v1\//, async (route) => {
    const peticion = route.request()
    const metodo = peticion.method()
    const ruta = new URL(peticion.url()).pathname
    if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS' || PERMITIDAS.test(ruta)) return route.continue()
    if (CANCELAR_SIN_FALLAR.test(ruta)) return route.abort()
    fs.mkdirSync('test-results', { recursive: true })
    fs.appendFileSync(ARCHIVO_ESCRITURAS_DEMO, `${metodo} ${ruta}\n`)
    return route.abort()
  })
}
