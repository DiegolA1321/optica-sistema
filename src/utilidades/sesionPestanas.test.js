import { describe, it, expect, beforeEach } from 'vitest'
import { tiempoSinActividad, registrarActividad, guardarMotivoCierre, leerMotivoCierre, esLlamadaAnonima, LIMITE_INACTIVIDAD_MS } from './sesionPestanas'

beforeEach(() => { window.localStorage.clear() })

describe('inactividad compartida entre pestañas', () => {
  it('cuenta desde el último movimiento de CUALQUIER pestaña, no solo de la propia', () => {
    const ahora = 10_000_000
    // Esta pestaña lleva 16 minutos quieta, pero otra se movió hace 1 minuto.
    window.localStorage.setItem('optica_ultima_actividad', String(ahora - 60_000))
    expect(tiempoSinActividad(ahora - 16 * 60_000, ahora)).toBe(60_000)
    expect(tiempoSinActividad(ahora - 16 * 60_000, ahora)).toBeLessThan(LIMITE_INACTIVIDAD_MS)
  })
  it('si nadie se movió, vale el movimiento de la propia pestaña', () => {
    const ahora = 10_000_000
    expect(tiempoSinActividad(ahora - 20 * 60_000, ahora)).toBe(20 * 60_000)
  })
  it('registrarActividad no escribe más de una vez cada 2 segundos', () => {
    registrarActividad(1_000_000)
    registrarActividad(1_000_500)
    expect(window.localStorage.getItem('optica_ultima_actividad')).toBe('1000000')
    registrarActividad(1_003_000)
    expect(window.localStorage.getItem('optica_ultima_actividad')).toBe('1003000')
  })
})

describe('motivo del cierre de sesión', () => {
  it('lo lee quien se entera enseguida y lo ignora si ya es viejo', () => {
    guardarMotivoCierre('Tu sesión se cerró por inactividad.', 5_000)
    expect(leerMotivoCierre(10_000)).toBe('Tu sesión se cerró por inactividad.')
    expect(leerMotivoCierre(5_000 + 31_000)).toBeNull()
  })
})

describe('llamada anónima', () => {
  it('reconoce la clave pública y no el token de una persona', () => {
    expect(esLlamadaAnonima('Bearer clave-publica', 'clave-publica')).toBe(true)
    expect(esLlamadaAnonima('Bearer token-de-persona', 'clave-publica')).toBe(false)
    expect(esLlamadaAnonima('', 'clave-publica')).toBe(false)
  })
})
