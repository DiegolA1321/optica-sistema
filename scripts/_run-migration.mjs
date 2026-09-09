import pg from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/_run-migration.mjs <archivo.sql>");
  process.exit(1);
}
const sql = readFileSync(file, "utf8");

// I11: "create or replace function" que cambia de firma (agrega/quita un
// parámetro) sin un "drop function" previo no reemplaza la función vieja —
// crea un segundo overload silencioso, y Postgres empieza a elegir entre
// las dos según los argumentos de cada llamador. Este bug exacto rompió
// crear_cita_publica() en producción DOS VECES en este proyecto (migraciones
// 0031→0035 y 0040→0042), ambas veces sin ningún error en el momento de
// aplicar la migración — el error solo aparecía después, en llamadas reales
// desde el frontend. Esto detecta la firma después de aplicar y avisa si
// quedó más de un overload para un nombre que esta migración tocó.
const nombresTocados = [...sql.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?"?(\w+)"?/gi)].map((m) => m[1]);

const client = new pg.Client();
await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("OK: migración aplicada -", file);

  if (nombresTocados.length > 0) {
    const { rows } = await client.query(
      `select proname, count(*)::int as overloads
       from pg_proc
       where pronamespace = 'public'::regnamespace and proname = any($1)
       group by proname
       having count(*) > 1`,
      [[...new Set(nombresTocados)]]
    );
    if (rows.length > 0) {
      console.warn("\n⚠️  AVISO (I11 — función duplicada silenciosa):");
      for (const r of rows) {
        console.warn(`   "${r.proname}" ahora tiene ${r.overloads} versiones en la base — si esta migración quiso REEMPLAZAR la firma anterior (no agregar una sobrecarga a propósito), falta un "drop function" de la versión vieja antes del "create or replace".`);
      }
      console.warn("   Verificar con: select oid, proname, pg_get_function_identity_arguments(oid) from pg_proc where proname = '<nombre>';\n");
    }
  }
} catch (err) {
  await client.query("rollback");
  console.error("ERROR, se revirtió todo:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
