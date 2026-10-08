// Restablece la contraseña del administrador de la óptica de pruebas ("QA Test Claude") y la guarda en .env.test como
// E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, SIN mostrarla.
//
//   node --env-file=.env.local scripts/restablecer-clave-admin-pruebas.mjs              → ENSAYO: todo en una transacción que se
//                                                                                          revierte; no cambia nada ni escribe .env.test
//   node --env-file=.env.local scripts/restablecer-clave-admin-pruebas.mjs --ejecutar   → cambia la contraseña y guarda .env.test
//
// Solo toca la fila de auth.users de ese administrador (se comprueba que sea admin de "QA Test Claude" y que ninguna otra
// cuenta cambie). La contraseña nueva se verifica contra el hash guardado antes de confirmar.
import pg from "pg"
import fs from "node:fs"
import crypto from "node:crypto"

const OPTICA_ID = "dc6956ab-a507-4905-a122-47680c6d3b6d"
const EJECUTAR = process.argv.includes("--ejecutar")
const clave = `Qa-${crypto.randomBytes(6).toString("hex")}-${crypto.randomInt(10, 99)}Zq`

const c = new pg.Client()
await c.connect()
try {
  const admin = (await c.query(
    `select p.id, u.email from perfiles p join auth.users u on u.id = p.id
     where p.optica_id = $1 and p.rol = 'admin' and p.activo`, [OPTICA_ID])).rows
  if (admin.length !== 1) throw new Error(`Se esperaba un solo administrador activo en la óptica de pruebas y hay ${admin.length}.`)
  const { id, email } = admin[0]
  const hashesAntes = (await c.query("select id, encrypted_password from auth.users where id <> $1 order by id", [id])).rows

  await c.query("begin")
  const r = await c.query("update auth.users set encrypted_password = crypt($2, gen_salt('bf')), updated_at = now() where id = $1", [id, clave])
  if (r.rowCount !== 1) throw new Error("No se actualizó exactamente una cuenta.")
  const coincide = (await c.query("select encrypted_password = crypt($2, encrypted_password) ok from auth.users where id = $1", [id, clave])).rows[0].ok
  if (!coincide) throw new Error("La contraseña nueva no coincide con su hash: se revierte.")
  const hashesDespues = (await c.query("select id, encrypted_password from auth.users where id <> $1 order by id", [id])).rows
  if (JSON.stringify(hashesAntes) !== JSON.stringify(hashesDespues)) throw new Error("Cambió otra cuenta: se revierte.")

  if (EJECUTAR) {
    await c.query("commit")
    let texto = fs.existsSync(".env.test") ? fs.readFileSync(".env.test", "utf8") : ""
    if (texto && !texto.endsWith("\n")) texto += "\n"
    for (const [k, v] of Object.entries({ E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: clave })) {
      const re = new RegExp(`^${k}=.*$`, "m")
      texto = re.test(texto) ? texto.replace(re, () => `${k}=${v}`) : texto + `${k}=${v}\n`
    }
    fs.writeFileSync(".env.test", texto)
    console.log(`✓ Contraseña restablecida para ${email} y guardada en .env.test (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). No se muestra.`)
  } else {
    await c.query("rollback")
    console.log(`✓ ENSAYO correcto para ${email}: solo cambiaría su cuenta y el hash coincide (revertido; .env.test intacto). Para aplicar: --ejecutar`)
  }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
