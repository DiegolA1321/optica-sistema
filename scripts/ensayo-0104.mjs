// Ensayo de la migración 0104 (datos de contacto del paciente: propagación a citas y consultas + "Mis datos" del portal).
// Aplica la migración dentro de una transacción y SIEMPRE revierte: no queda nada en la base.
//   node --env-file=.env.local scripts/ensayo-0104.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0104_propagar_datos_paciente.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

// Ejecuta fn con un rol de la API (anon o authenticated con la sesión de un perfil) y deshace sus cambios.
// Con `conservar` los cambios se quedan (dentro de la transacción del ensayo).
const como = async (rol, claims, fn, conservar = false) => {
  await c.query("savepoint r")
  try {
    await c.query(`set local role ${rol}`)
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)])
    const r = await fn()
    await c.query("reset role")
    if (!conservar) await c.query("rollback to savepoint r")
    return { r }
  } catch (e) {
    await c.query("rollback to savepoint r")
    await c.query("reset role")
    return { e: e.message }
  }
}

try {
  await c.query("begin")
  const [optica] = await q("select id from opticas where slug = 'v8twzq'")
  ok(!!optica, "óptica de pruebas encontrada (slug v8twzq)")
  const OP = optica.id
  const [admin] = await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP])
  const claimsAdmin = { sub: admin.id, role: "authenticated", aal: "aal2" }

  await c.query(sql)
  ok(true, "la migración se aplica sin errores")
  ok((await q("select count(*)::int n from pg_proc where proname = 'actualizar_contacto_paciente'"))[0].n === 1, "una sola versión de actualizar_contacto_paciente (sin sobrecargas)")
  const firma = (await q("select proargnames from pg_proc where proname = 'actualizar_contacto_paciente'"))[0].proargnames
  ok(JSON.stringify(firma) === JSON.stringify(["p_paciente_id", "p_token", "p_telefono", "p_correo"]), "la función solo recibe id, token, teléfono y correo (no hay forma de pasar nombre, cédula ni nacimiento)")

  // ── Datos de prueba: el paciente A (con citas y consultas), un homónimo H de la misma óptica y un tercero T
  const [A] = await q(`select p.* from pacientes_base p where p.optica_id = $1 and p.anonimizado_en is null
                        and exists (select 1 from citas_base c where c.paciente_id = p.id) and exists (select 1 from consultas_base k where k.paciente_id = p.id) limit 1`, [OP])
  ok(!!A, "hay un paciente con citas y consultas en la óptica de pruebas")
  const clonar = async (origen, cedula, nombre) => {
    await c.query("drop table if exists t_p"); await c.query("create temp table t_p as select * from pacientes_base where id = $1", [origen.id])
    await c.query("update t_p set id = gen_random_uuid(), cedula = $1, nombre = $2, usuario = null, clave_temporal = null, sesion_token = null", [cedula, nombre])
    const [n] = await q("insert into pacientes_base select * from t_p returning id")
    await c.query("drop table if exists t_c"); await c.query("create temp table t_c as select * from citas_base where paciente_id = $1 limit 2", [origen.id])
    await c.query("update t_c set id = gen_random_uuid(), paciente_id = $1, paciente = $2, codigo = null, fecha = '2032-01-01'::date + (floor(random() * 2000))::int, estado = 'Atendida'", [n.id, nombre])
    await c.query("insert into citas_base select * from t_c")
    await c.query("drop table if exists t_k"); await c.query("create temp table t_k as select * from consultas_base where paciente_id = $1 limit 1", [origen.id])
    await c.query("update t_k set id = gen_random_uuid(), paciente_id = $1, paciente = $2", [n.id, nombre])
    await c.query("insert into consultas_base select * from t_k")
    return n.id
  }
  const H = await clonar(A, "0900000001", A.nombre)            // homónimo: mismo nombre exacto, otro paciente
  const T = await clonar(A, "0900000002", "Tercero de ensayo")  // otro paciente cualquiera
  const tok = async (id, t, edad = "0 days") => c.query(`update pacientes_base set sesion_token = $2, sesion_token_creado_en = now() - interval '${edad}' where id = $1`, [id, t])
  await tok(A.id, "tok-A"); await tok(H, "tok-H"); await tok(T, "tok-T")

  const foto = async (id) => ({
    p: (await q("select nombre, cedula, telefono, correo, fecha_nacimiento::text fn from pacientes_base where id = $1", [id]))[0],
    citas: await q("select id, paciente, cedula, telefono, correo from citas_base where paciente_id = $1 order by id", [id]),
    cons: await q("select id, paciente from consultas_base where paciente_id = $1 order by id", [id]),
  })
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const hA0 = await foto(H), tA0 = await foto(T)
  const nCitasA = (await foto(A.id)).citas.length, nConsA = (await foto(A.id)).cons.length

  // ── 1. Cambio del personal (vista `pacientes`, como administrador de la óptica)
  let x = await como("authenticated", claimsAdmin, async () => {
    await c.query("update pacientes set nombre = 'Nombre Nuevo Ensayo', telefono = '0911111111', correo = 'staff@nuevo.com', cedula = '0999999990' where id = $1", [A.id])
    return await foto(A.id)
  })
  ok(!x.e && x.r.citas.length === nCitasA && x.r.citas.every((z) => z.paciente === "Nombre Nuevo Ensayo" && z.telefono === "0911111111" && z.correo === "staff@nuevo.com" && z.cedula === "0999999990"),
    `personal: las ${nCitasA} citas del paciente quedan con nombre, cédula, teléfono y correo nuevos` + (x.e ? " — " + x.e : ""))
  ok(!x.e && x.r.cons.length === nConsA && x.r.cons.every((z) => z.paciente === "Nombre Nuevo Ensayo"), `personal: las ${nConsA} consultas del paciente quedan con el nombre nuevo`)
  ok(igual(await foto(H), hA0) && igual(await foto(T), tA0), "personal: el homónimo y otro paciente no cambian (ni sus citas ni sus consultas)")

  // "Sin Correo" (relleno del formulario) deja el correo de la cita vacío
  x = await como("authenticated", claimsAdmin, async () => {
    await c.query("update pacientes set correo = 'Sin Correo' where id = $1", [A.id])
    return await foto(A.id)
  })
  ok(!x.e && x.r.citas.every((z) => z.correo === null), "personal: 'Sin Correo' deja vacío el correo de las citas (el recordatorio no lo toma como dirección)")

  // ── 2. Cambio desde el portal
  const nombreA = A.nombre
  const portal = (id, token, tel, cor) => como("anon", null, async () => (await c.query("select actualizar_contacto_paciente($1,$2,$3,$4) r", [id, token, tel, cor])).rows[0].r, true)
  x = await portal(A.id, "tok-A", "0988888888", "Nuevo@Correo.com")
  ok(!x.e && x.r.ok === true && x.r.telefono === "0988888888" && x.r.correo === "Nuevo@Correo.com", "portal: el paciente cambia su teléfono y su correo " + JSON.stringify(x.r ?? x.e))
  let f = await foto(A.id)
  ok(f.citas.every((z) => z.telefono === "0988888888" && z.correo === "Nuevo@Correo.com"), "portal: se refleja en todas las citas de ese paciente")
  ok(f.p.nombre === nombreA && f.p.cedula === A.cedula && f.p.fn === (await q("select fecha_nacimiento::text fn from pacientes_base where id = $1", [A.id]))[0].fn, "portal: nombre, cédula y fecha de nacimiento siguen igual")
  ok(f.cons.every((z) => z.paciente === nombreA), "portal: las consultas conservan el nombre (no cambió)")
  ok(igual(await foto(H), hA0) && igual(await foto(T), tA0), "portal: el homónimo y otro paciente no cambian")
  const logs = await q("select accion, usuario_id, modulo, detalle from logs_optica where optica_id = $1 and accion like 'El paciente actualizó%' order by created_at desc limit 1", [OP])
  ok(logs[0]?.accion === "El paciente actualizó su teléfono y su correo" && logs[0].usuario_id === null && logs[0].modulo === "pacientes", "portal: queda en la actividad de la óptica: «" + logs[0]?.accion + "»")
  // los recordatorios toman el correo de la cita primero: ahora es el nuevo
  const resuelto = await q("select coalesce(nullif(c.correo, ''), nullif(p.correo, ''), nullif(p.correo, 'Sin Correo')) r from citas c left join pacientes p on p.id = c.paciente_id where c.paciente_id = $1", [A.id])
  ok(resuelto.length > 0 && resuelto.every((z) => z.r === "Nuevo@Correo.com"), "recordatorios: el correo que usan es el nuevo")

  x = await portal(A.id, "tok-A", "0977777777", null)
  ok(x.r?.ok === true && (await foto(A.id)).p.correo === "Nuevo@Correo.com", "portal: cambiar solo el teléfono deja el correo como estaba")
  const antesLogs = (await q("select count(*)::int n from logs_optica where optica_id = $1", [OP]))[0].n
  x = await portal(A.id, "tok-A", "0977777777", "nuevo@correo.com")
  ok(x.r?.ok === true && x.r.cambio === false && (await q("select count(*)::int n from logs_optica where optica_id = $1", [OP]))[0].n === antesLogs, "portal: guardar lo mismo no cambia nada ni llena la actividad")

  // ── 3. Seguridad
  const antes = await foto(A.id)
  x = await portal(A.id, "tok-H", "0966666666", null); ok(x.r?.ok === false && x.r.error === "sesion" && igual(await foto(A.id), antes), "un paciente no puede cambiar los datos de otro (token ajeno)")
  x = await portal(H, "tok-A", "0966666666", null); ok(x.r?.ok === false && igual(await foto(H), hA0), "…ni con el id del otro y su propio token")
  x = await portal(A.id, "token-inventado", "0966666666", null); ok(x.r?.ok === false, "token inventado: rechazado")
  x = await portal(A.id, null, "0966666666", null); ok(x.r?.ok === false, "sin token: rechazado")
  await tok(T, "tok-vencido", "31 days")
  x = await portal(T, "tok-vencido", "0966666666", null); ok(x.r?.ok === false && igual(await foto(T), tA0), "sesión vencida (más de 30 días): rechazada")
  for (const [tel, cor, que] of [["123456", null, "teléfono corto"], ["12345678901", null, "teléfono largo"], ["09abc12345", null, "teléfono con letras"], ["098 888 8888", null, "teléfono con espacios"], [null, "sin-arroba", "correo sin @"], [null, "a@b", "correo sin dominio"], [null, "a b@c.com", "correo con espacio"], [null, null, "sin datos"]]) {
    x = await portal(A.id, "tok-A", tel, cor)
    ok(x.r?.ok === false && igual(await foto(A.id), antes), `formato inválido (${que}): rechazado y no cambia nada`)
  }
  x = await como("anon", null, async () => (await c.query("update pacientes set nombre = 'Hackeado', cedula = '0000000000' where id = $1 returning id", [A.id])).rowCount)
  ok(x.e || x.r === 0, "el portal no puede editar al paciente directamente (nombre/cédula): " + (x.e ?? "0 filas"))
  x = await como("anon", null, async () => (await c.query("update pacientes_base set nombre = 'Hackeado' where id = $1 returning id", [A.id])).rowCount)
  ok(x.e || x.r === 0, "…ni en la tabla base: " + (x.e ?? "0 filas"))
  ok(igual(await foto(A.id), antes), "tras los intentos, el paciente sigue igual")
  x = await como("anon", null, async () => (await c.query("select propagar_datos_paciente()")).rows)
  ok(!!x.e, "la función del trigger no se puede llamar desde la API")

  // ── 4. La anonimización sigue dando el mismo resultado con y sin el trigger
  // Las columnas cifradas llevan un valor aleatorio distinto en cada cifrado: se comparan DESCIFRADAS (vistas), no sus bytes.
  const sinCifrar = "(select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(%T%)) where key not like '%\_enc' and key not in ('updated_at', 'sesion_token_creado_en'))";
  const instantanea = async (id) => ({
    p: (await q("select " + sinCifrar.replace("%T%", "p") + " || jsonb_build_object('ec', descifrar_clinico(p.estado_clinico_enc), 'ev', descifrar_clinico(p.evolucion_enc), 'co', descifrar_clinico(p.estado_correccion_enc)) j from pacientes_base p where id = $1", [id]))[0].j,
    citas: (await q("select (select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(c)) where key <> 'updated_at') j from citas c where paciente_id = $1 order by id", [id])).map((z) => z.j),
    cons: (await q("select (select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(k)) where key <> 'updated_at') j from consultas k where paciente_id = $1 order by id", [id])).map((z) => z.j),
  })
  const anonimizar = async (id) => como("authenticated", claimsAdmin, async () => { await c.query("select anonimizar_paciente($1)", [id]); return await instantanea(id) })
  const conTrigger = await anonimizar(A.id)
  await c.query("alter table pacientes_base disable trigger propagar_datos_paciente_trigger")
  const sinTrigger = await anonimizar(A.id)
  await c.query("alter table pacientes_base enable trigger propagar_datos_paciente_trigger")
  ok(!conTrigger.e && !sinTrigger.e, "la anonimización corre con y sin el trigger" + (conTrigger.e ? " — " + conTrigger.e : "") + (sinTrigger.e ? " — " + sinTrigger.e : ""))
  const diferencias = (a, b, ruta = "") => (a && b && typeof a === "object" && typeof b === "object")
    ? [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diferencias(a[k], b[k], ruta + "." + k))
    : (JSON.stringify(a) === JSON.stringify(b) ? [] : [ruta + ": " + JSON.stringify(a) + " ≠ " + JSON.stringify(b)])
  const dif = conTrigger.r && sinTrigger.r ? diferencias(conTrigger.r, sinTrigger.r) : ["(sin datos)"]
  if (dif.length) console.log("   diferencias:", dif.slice(0, 6))
  ok(dif.length === 0, "la anonimización deja exactamente el mismo resultado (paciente, citas y consultas) con el trigger que sin él")
  ok(conTrigger.r?.citas.every((z) => z.paciente === "Paciente anonimizado" && z.cedula === null && z.telefono === null && z.correo === null), "…y las citas quedan sin datos personales")
  ok(igual(await foto(H), hA0), "anonimizar a un paciente no toca a su homónimo")

  // ── 5. Lo que ya usa el sistema publicado sigue funcionando
  x = await como("authenticated", claimsAdmin, async () => {
    const [n] = (await c.query("insert into pacientes (optica_id, nombre, cedula, telefono, correo, fecha_nacimiento) values ($1,'Alta de ensayo','0900000003','0999999999','alta@ensayo.com','1990-01-01') returning id", [OP])).rows
    await c.query("update pacientes set referido_por = 'x' where id = $1", [n.id])
    await c.query("update pacientes set telefono = '0944444444' where id = $1", [n.id])
    return (await c.query("select telefono from pacientes where id = $1", [n.id])).rows[0].telefono
  })
  ok(x.r === "0944444444", "el personal sigue dando de alta y editando pacientes por la vista" + (x.e ? " — " + x.e : ""))
  await tok(T, "tok-T")
  x = await portal(T, "tok-T", "0933333333", null); ok(x.r?.ok === true, "un paciente con sesión vigente puede cambiar su teléfono")
  x = await como("anon", null, async () => (await c.query("select solicitar_medidas_paciente($1,$2) r", [T, "tok-T"])).rows[0].r)
  ok(x.r === true, "solicitar_medidas_paciente (función ya existente del portal) sigue funcionando")
} catch (e) {
  console.log("✘ error inesperado:", e.message); fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTodo bien (la transacción se revirtió: nada cambió en la base)." : `\n${fallos} fallo(s). Se revirtió.`)
process.exit(fallos ? 1 : 0)
