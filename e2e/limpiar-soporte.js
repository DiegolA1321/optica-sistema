// Borra las consultas y mensajes de soporte que crean las pruebas, SOLO de la óptica de pruebas (slug v8twzq) y solo los que empiezan con "E2E ",
// para que no queden en la bandeja del superadmin. Los archivos de las capturas no se pueden borrar (el almacenamiento no lo permite a propósito).
import pg from 'pg'
import { SLUG_PRUEBAS } from './ayudas.js'

export async function limpiarSoporteDePruebas() {
  const c = new pg.Client()
  await c.connect()
  try {
    const o = (await c.query('select id from opticas where slug = $1', [SLUG_PRUEBAS])).rows[0]?.id
    if (!o) return
    const a = await c.query("delete from soporte_consultas where optica_id = $1 and asunto like 'E2E %'", [o])
    const b = await c.query("delete from mensajes where optica_id = $1 and tipo = 'consulta' and asunto like 'E2E %'", [o])
    const c2 = await c.query("delete from avisos_internos where optica_id = $1 and titulo like 'E2E %'", [o]).catch(() => ({ rowCount: 0 })) // la tabla existe desde la migración 0116
    console.log(`[soporte] limpiadas ${a.rowCount} consultas, ${b.rowCount} mensajes y ${c2.rowCount} avisos internos de prueba`)
  } finally { await c.end() }
}
