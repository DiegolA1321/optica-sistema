// Deja limpia la óptica de pruebas de lo que crea «Ofrecer ayuda» (migración 0122): las consultas iniciadas por el soporte, lo ofrecido y lo que la óptica
// decidió. Sin la migración no hay nada que limpiar. SOLO la óptica de pruebas (slug v8twzq).
import pg from 'pg'
import { SLUG_PRUEBAS } from './ayudas.js'

export async function limpiarAyudasDePruebas() {
  const c = new pg.Client()
  await c.connect()
  try {
    if (!(await c.query("select to_regclass('public.ayudas_ofrecidas') as t")).rows[0].t) return
    const o = (await c.query('select id from opticas where slug = $1', [SLUG_PRUEBAS])).rows[0]?.id
    if (!o) return
    const a = await c.query('delete from modulos_no_usados where optica_id = $1', [o])
    const b = await c.query('delete from ayudas_ofrecidas where optica_id = $1', [o])
    const d = await c.query("delete from soporte_consultas where optica_id = $1 and iniciada_por = 'soporte'", [o])
    console.log(`[ayuda] limpiadas ${d.rowCount} consultas, ${b.rowCount} ayudas ofrecidas y ${a.rowCount} módulos no usados de la óptica de pruebas`)
  } finally { await c.end() }
}

// ¿Está aplicada la migración 0122 (Ofrecer ayuda como conversación de Soporte)?
export async function hayOfrecerAyuda() {
  const c = new pg.Client()
  await c.connect()
  try { return !!(await c.query("select to_regclass('public.ayudas_ofrecidas') as t")).rows[0].t } finally { await c.end() }
}
