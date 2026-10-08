// Ensayo de la migración 0097: la aplica DENTRO de una transacción, comprueba que `authenticated` conserva cada
// escritura directa que usa la app (lista sacada de buscar .insert/.update/.upsert/.delete en src/) y que pierde las demás,
// y SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/ensayo-0097.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0097_authenticated_sin_escritura_directa_innecesaria.sql", import.meta.url), "utf8")

// tabla/vista → verbos que la app usa escribiendo directo (src/**/*.jsx y src/**/*.js, sin pruebas)
const USADAS = {
  pacientes: ["INSERT", "UPDATE"], citas: ["INSERT", "UPDATE"], consultas: ["INSERT", "UPDATE"],
  pacientes_base: ["INSERT", "UPDATE"], citas_base: ["INSERT", "UPDATE"], consultas_base: ["INSERT", "UPDATE"],
  inventario: ["INSERT", "UPDATE", "DELETE"], ventas: ["UPDATE"],
  opticas: ["INSERT", "UPDATE"], perfiles: ["INSERT", "UPDATE"], roles: ["INSERT", "UPDATE", "DELETE"], perfil_roles: ["INSERT", "UPDATE", "DELETE"],
  disponibilidad: ["INSERT", "UPDATE"], horarios_usuario: ["INSERT", "UPDATE"], mensajes: ["INSERT", "UPDATE"],
  avisos: ["INSERT", "DELETE"], logs_optica: ["INSERT"], auditoria: ["INSERT"], facturas: ["INSERT", "UPDATE"], leads: ["UPDATE"],
}
// tablas que solo se tocan por RPC: no deben conservar escritura directa
const SOLO_RPC = ["abonos_factura", "facturas_venta", "facturas_venta_lineas", "ordenes_laboratorio", "ordenes_laboratorio_historial", "pases_a_venta",
  "contador_comprobantes_venta", "contador_ordenes_laboratorio", "limite_solicitudes", "notificaciones_enviadas", "respuestas_satisfaccion",
  "solicitudes_eliminacion_paciente", "visitas"]

const c = new pg.Client()
await c.connect()
let fallos = 0
try {
  await c.query("begin")
  await c.query(sql)
  const tiene = async (rel, verbo) => (await c.query("select has_table_privilege('authenticated', $1, $2) ok", ["public." + rel, verbo])).rows[0].ok
  for (const [rel, verbos] of Object.entries(USADAS)) {
    for (const v of verbos) {
      const ok = await tiene(rel, v)
      if (!ok) { fallos++; console.log(`✘ FALTA  ${v.padEnd(6)} en ${rel}`) }
    }
  }
  for (const rel of SOLO_RPC) {
    for (const v of ["INSERT", "UPDATE", "DELETE"]) {
      if (await tiene(rel, v)) { fallos++; console.log(`✘ SOBRA  ${v.padEnd(6)} en ${rel} (solo debería escribirse por RPC)`) }
    }
  }
  // lectura intacta en todo
  const sinLectura = (await c.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','v','p') and not has_table_privilege('authenticated', c.oid, 'SELECT')`)).rows.map((r) => r.relname)
  if (sinLectura.length) { fallos++; console.log("✘ Sin SELECT para authenticated:", sinLectura.join(", ")) }
  // lo que authenticated conserva con escritura y no está en la lista de la app (para revisarlo a ojo)
  const conservadas = (await c.query(`select table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
    where grantee='authenticated' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE') group by 1 order by 1`)).rows
  console.log("\nTras la 0097, authenticated escribe directo en:")
  for (const r of conservadas) console.log("  ", r.table_name.padEnd(22), r.p, USADAS[r.table_name] ? "" : "  ← no figura en la lista de la app")
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\n✓ La 0097 conserva todas las escrituras directas de la app (transacción revertida: la base no cambió)." : `\n✘ ${fallos} problema(s) (transacción revertida).`)
process.exit(fallos === 0 ? 0 : 1)
