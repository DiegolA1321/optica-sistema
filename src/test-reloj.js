// Solo se carga con HORA_SIMULADA: fija "ahora" (solo Date; los temporizadores siguen reales) para comprobar que ninguna prueba
// depende de la hora del día ni de la zona horaria del equipo. Se usa desde scripts/probar-zonas-y-horas.mjs.
import { vi } from 'vitest'

vi.useFakeTimers({ toFake: ['Date'], now: new Date(process.env.HORA_SIMULADA) })
