// Suite de regresión de RLS (hallazgo I2 de la auditoría 2026-09-09).
//
// No usa Vitest/jsdom porque necesita una conexión real a Postgres para
// simular exactamente lo que hace PostgREST: cambia a `role authenticated`
// y setea `request.jwt.claim.sub` (lo que lee auth.uid() — verificado leyendo
// el código fuente real de la función) para que las políticas RLS se evalúen
// tal cual lo harían para un usuario real, sin pasar por la API HTTP ni
// necesitar una service role key.
//
// Crea sus propias filas de prueba (ópticas + perfiles + auth.users mínimos)
// con nombres marcados "RLS_TEST_*", y las borra siempre al final (éxito o
// error) para no dejar basura en la base real.
//
// Uso: node scripts/test-rls.mjs   (necesita las mismas PG* env vars que
// scripts/_run-migration.mjs — cárgalas desde .env.local antes de correrlo)

import pg from "pg";

const client = new pg.Client();
await client.connect();

const marca = `RLS_TEST_${Date.now()}`;
let opticaA, opticaB, adminA, adminB, pacienteA;
let fallos = 0;
const resultados = [];

function afirmar(nombre, cond, detalle = "") {
  const ok = !!cond;
  resultados.push({ nombre, ok, detalle });
  if (!ok) fallos++;
  console.log(`${ok ? "✅" : "❌"} ${nombre}${detalle ? " — " + detalle : ""}`);
}

// Ejecuta una query COMO si fuera un usuario autenticado real (mismo
// mecanismo que PostgREST: cambia de rol y setea el claim que auth.uid() lee).
async function comoUsuario(userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return await fn();
  } finally {
    await client.query("rollback"); // nunca persiste nada hecho "como usuario" — solo lee/prueba
  }
}

try {
  // ── Fixtures (como superusuario, sin RLS) ──
  const { rows: [oA] } = await client.query(
    `insert into opticas (nombre, slug) values ($1, $2) returning id`,
    [`${marca} Optica A`, `${marca.toLowerCase()}-a`]
  );
  opticaA = oA.id;
  const { rows: [oB] } = await client.query(
    `insert into opticas (nombre, slug) values ($1, $2) returning id`,
    [`${marca} Optica B`, `${marca.toLowerCase()}-b`]
  );
  opticaB = oB.id;

  for (const [label, opticaId] of [["A", opticaA], ["B", opticaB]]) {
    const { rows: [u] } = await client.query(
      `insert into auth.users (id, email, aud, role) values (gen_random_uuid(), $1, 'authenticated', 'authenticated') returning id`,
      [`${marca.toLowerCase()}-admin-${label}@example.invalid`]
    );
    const { rows: [p] } = await client.query(
      `insert into perfiles (id, optica_id, rol, nombre) values ($1, $2, 'admin', $3) returning id`,
      [u.id, opticaId, `Admin ${label} de prueba`]
    );
    if (label === "A") adminA = p.id; else adminB = p.id;
  }

  const { rows: [pac] } = await client.query(
    `insert into pacientes (optica_id, nombre, cedula) values ($1, $2, '9999999999') returning id`,
    [opticaA, `${marca} Paciente A`]
  );
  pacienteA = pac.id;

  console.log(`\nFixtures creados: óptica A=${opticaA}, óptica B=${opticaB}, admin A=${adminA}, admin B=${adminB}, paciente A=${pacienteA}\n`);

  // ── 1. Aislamiento entre ópticas: admin A no debe ver pacientes de A... espera, SÍ debe ──
  await comoUsuario(adminA, async () => {
    const { rows } = await client.query(`select id from pacientes where id = $1`, [pacienteA]);
    afirmar("Admin A puede leer un paciente de SU PROPIA óptica", rows.length === 1);
  });

  // ── 2. Aislamiento entre ópticas: admin B NO debe ver el paciente de la óptica A ──
  await comoUsuario(adminB, async () => {
    const { rows } = await client.query(`select id from pacientes where id = $1`, [pacienteA]);
    afirmar("Admin B NO puede leer un paciente de la óptica A (aislamiento multi-tenant)", rows.length === 0,
      rows.length > 0 ? `¡FUGA! devolvió ${rows.length} fila(s)` : "0 filas, correcto");
  });

  // ── 3. Admin B no puede EDITAR un paciente de la óptica A ──
  await comoUsuario(adminB, async () => {
    const { rowCount } = await client.query(`update pacientes set nombre = 'hackeado' where id = $1`, [pacienteA]);
    afirmar("Admin B NO puede modificar un paciente de la óptica A", rowCount === 0,
      rowCount > 0 ? "¡FUGA! el update afectó una fila" : "0 filas afectadas, correcto");
  });

  // ── 4. El bug histórico cerrado: un admin no puede auto-asignarse admin de OTRA óptica ──
  await comoUsuario(adminB, async () => {
    try {
      await client.query(`update perfiles set optica_id = $1 where id = $2`, [opticaA, adminB]);
      const { rows } = await client.query(`select optica_id from perfiles where id = $1`, [adminB]);
      afirmar("Admin B NO puede reasignarse a la óptica A (escalamiento de privilegios ya cerrado)", rows[0]?.optica_id !== opticaA,
        rows[0]?.optica_id === opticaA ? "¡REGRESIÓN! el cambio de optica_id se aplicó" : "bloqueado, correcto");
    } catch (e) {
      afirmar("Admin B NO puede reasignarse a la óptica A (escalamiento de privilegios ya cerrado)", true, "bloqueado con error: " + e.message.slice(0, 80));
    }
  });

  // ── 5. auth.uid() sin ninguna sesión (anon) no debe ver pacientes directo ──
  await client.query("begin");
  try {
    await client.query("set local role anon");
    const { rows } = await client.query(`select id from pacientes where id = $1`, [pacienteA]);
    afirmar("Un cliente anónimo (sin sesión) NO puede leer pacientes directo", rows.length === 0,
      rows.length > 0 ? "¡FUGA! anon leyó datos de pacientes" : "0 filas, correcto");
  } finally {
    await client.query("rollback");
  }

  // ── 6. No hay recursión infinita al leer perfiles (bug cerrado en 0017) ──
  await comoUsuario(adminA, async () => {
    try {
      const { rows } = await client.query(`select id from perfiles where id = $1`, [adminA]);
      afirmar("Leer perfiles no cae en recursión infinita (bug 0017 sigue cerrado)", rows.length === 1);
    } catch (e) {
      afirmar("Leer perfiles no cae en recursión infinita (bug 0017 sigue cerrado)", false, e.message.slice(0, 120));
    }
  });

  // ── 7b. I7: si la cuenta tiene MFA verificado, una sesión SIN aal2 no puede leer datos clínicos ──
  await client.query(
    `insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
     values (gen_random_uuid(), $1, 'test', 'totp', 'verified', 'x', now(), now())`,
    [adminA]
  );
  await comoUsuario(adminA, async () => {
    // comoUsuario no setea aal — por defecto una sesión sin ese claim no es aal2.
    const { rows } = await client.query(`select id from pacientes where id = $1`, [pacienteA]);
    afirmar("Con MFA verificado pero SIN aal2 en la sesión, NO se puede leer datos clínicos (I7)", rows.length === 0,
      rows.length > 0 ? "¡FUGA! el gate de MFA no bloqueó el acceso" : "0 filas, correcto");
  });

  // ── 7c. I7: la MISMA cuenta, con aal2 en la sesión, SÍ puede leer ──
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [adminA]);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: adminA, aal: "aal2" })]);
    const { rows } = await client.query(`select id from pacientes where id = $1`, [pacienteA]);
    afirmar("La misma cuenta CON aal2 en la sesión sí puede leer datos clínicos (I7 no bloquea de más)", rows.length === 1);
  } finally {
    await client.query("rollback");
  }

  // ── 8. limite_solicitudes: hallazgo I9 — confirma si sigue sin RLS (para no regresionar el fix cuando se aplique) ──
  const { rows: rlsCheck } = await client.query(
    `select relrowsecurity from pg_class where relname = 'limite_solicitudes'`
  );
  afirmar("limite_solicitudes tiene RLS habilitado (I9)", rlsCheck[0]?.relrowsecurity === true,
    rlsCheck[0]?.relrowsecurity ? "" : "todavía sin RLS — pendiente hasta que se aplique el fix de I9");

} catch (e) {
  console.error("\n💥 Error inesperado durante las pruebas (se limpian los fixtures de todas formas):", e.message);
  fallos++;
} finally {
  // ── Limpieza — siempre, pase lo que pase arriba ──
  await client.query("begin");
  try {
    if (pacienteA) await client.query(`delete from pacientes_base where id = $1`, [pacienteA]).catch(() => {});
    if (adminA) { await client.query(`delete from auth.mfa_factors where user_id = $1`, [adminA]).catch(() => {}); await client.query(`delete from perfiles where id = $1`, [adminA]).catch(() => {}); await client.query(`delete from auth.users where id = $1`, [adminA]).catch(() => {}); }
    if (adminB) { await client.query(`delete from perfiles where id = $1`, [adminB]).catch(() => {}); await client.query(`delete from auth.users where id = $1`, [adminB]).catch(() => {}); }
    if (opticaA) await client.query(`delete from opticas where id = $1`, [opticaA]).catch(() => {});
    if (opticaB) await client.query(`delete from opticas where id = $1`, [opticaB]).catch(() => {});
    await client.query("commit");
    console.log("\n🧹 Fixtures de prueba eliminados.");
  } catch (e) {
    await client.query("rollback");
    console.error("⚠️  No se pudo limpiar completamente:", e.message);
  }
  await client.end();
}

console.log(`\n${resultados.length - fallos}/${resultados.length} pruebas pasaron.`);
if (fallos > 0) {
  console.error(`\n❌ ${fallos} prueba(s) de RLS fallaron — revisar antes de confiar en el aislamiento multi-tenant.`);
  process.exitCode = 1;
} else {
  console.log("\n✅ Todas las pruebas de RLS pasaron.");
}
