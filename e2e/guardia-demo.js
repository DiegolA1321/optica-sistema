// La Óptica Demo es de SOLO LECTURA para las pruebas (regla 40): todo lo que crea o cambia datos corre en la óptica de pruebas.
// Esta guardia lo hace cumplir: en una sesión de la Demo, cualquier escritura a la API de datos se cancela y se anota; al terminar
// la corrida, verificar-demo.js falla si quedó alguna anotación. Se permiten solo las llamadas que el sistema hace al entrar y que
// no escriben datos de la óptica (permisos, equipo, el contador de visitas de la página pública y el inicio de sesión).
import fs from 'node:fs'

export const ARCHIVO_ESCRITURAS_DEMO = 'test-results/escrituras-demo.log'
const PERMITIDAS = /\/rest\/v1\/rpc\/(mis_permisos|equipo_optica|verificar_login_paciente|registrar_visita)$/

export async function protegerDemo(page) {
  await page.route(/\/rest\/v1\//, async (route) => {
    const peticion = route.request()
    const metodo = peticion.method()
    const ruta = new URL(peticion.url()).pathname
    if (metodo === 'GET' || metodo === 'HEAD' || metodo === 'OPTIONS' || PERMITIDAS.test(ruta)) return route.continue()
    fs.mkdirSync('test-results', { recursive: true })
    fs.appendFileSync(ARCHIVO_ESCRITURAS_DEMO, `${metodo} ${ruta}\n`)
    return route.abort()
  })
}
