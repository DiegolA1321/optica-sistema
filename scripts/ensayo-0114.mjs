// Ensayo de la migración 0114 (CRM v2: consentimiento, historial de contactos, campañas y plantillas): la aplica DENTRO de una transacción,
// repite lo que hace la pantalla PUBLICADA con los pacientes (insertar y editar por la vista) y prueba lo nuevo con distintos usuarios,
// con el paciente desde su portal y sin sesión. SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/ensayo-0114.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0114_crm_v2.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

// Ejecuta como `uid` (sesión real de la base: rol authenticated con sus claims) SIN deshacer, para encadenar pasos.
const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  let hecho = false
  try { const r = await fn(); hecho = true; return r } finally { if (hecho) await c.query("reset role") }
}
const intenta = async (uid, fn) => { await c.query("savepoint i"); try { const r = await comoSigue(uid, fn); await c.query("release savepoint i"); return { r } } catch (e) { await c.query("rollback to savepoint i"); await c.query("reset role"); return { e: e.message } } }
const anonimo = async (fn) => {
  await c.query("savepoint a")
  try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); await c.query("release savepoint a"); return { r } } catch (e) { await c.query("rollback to savepoint a"); await c.query("reset role"); return { e: e.message } }
}
const directo = async (fn) => { await c.query("savepoint d"); try { const r = await fn(); await c.query("release savepoint d"); return { r } } catch (e) { await c.query("rollback to savepoint d"); return { e: e.message } } }

const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const paula = await perfil("Paula Optómetra Pruebas")
  if (!admin || !paula) throw new Error("Faltan perfiles de la óptica de pruebas")
  const ajena = (await c.query("select id from perfiles where optica_id <> $1 and rol = 'admin' limit 1", [optica])).rows[0]?.id
  const nombreAdmin = (await c.query("select nombre from perfiles where id = $1", [admin])).rows[0].nombre

  // ── Antes de aplicar
  const antes = {
    pacientes: (await c.query("select count(*)::int n from pacientes_base")).rows[0].n,
    columnasVista: (await c.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pacientes' order by ordinal_position")).rows.map((r) => r.column_name),
    insert: await sobrecargas("pacientes_instead_insert"),
    update: await sobrecargas("pacientes_instead_update"),
  }
  console.log(`(antes: ${antes.pacientes} pacientes, la vista tiene ${antes.columnasVista.length} columnas)`)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const n of ["registrar_contacto_crm", "registrar_resultado_contacto_crm", "crear_campana_crm", "guardar_plantilla_crm", "cambiar_consentimiento_paciente", "mis_permisos_mensajes", "actualizar_consentimiento_paciente", "registrar_permisos_cita_publica", "optica_de_crm"]) {
    ok((await sobrecargas(n)) === 1, `${n}: una sola versión`)
  }
  ok((await sobrecargas("pacientes_instead_insert")) === antes.insert && (await sobrecargas("pacientes_instead_update")) === antes.update, "los disparadores de la vista siguen siendo una sola versión (sin sobrecargas duplicadas)")

  // ── 1. Lo que ya existía no cambia
  const despuesCols = (await c.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pacientes' order by ordinal_position")).rows.map((r) => r.column_name)
  ok(antes.columnasVista.every((col, i) => despuesCols[i] === col), "la vista conserva sus columnas en el mismo orden (las nuevas van al final)")
  ok(despuesCols.slice(antes.columnasVista.length).join(",") === "acepta_recordatorios,acepta_promociones,consentimiento_actualizado_en,consentimiento_actualizado_por", "…y las cuatro nuevas son: " + despuesCols.slice(antes.columnasVista.length).join(", "))
  ok((await c.query("select count(*)::int n from pacientes_base")).rows[0].n === antes.pacientes, "no se perdió ningún paciente")
  const defecto = (await c.query("select count(*) filter (where acepta_recordatorios and not acepta_promociones)::int bien, count(*)::int total from pacientes_base")).rows[0]
  ok(defecto.bien === defecto.total, `todos los pacientes existentes quedan: recordatorios sí, promociones no (${defecto.bien} de ${defecto.total})`)
  ok((await c.query("select count(*)::int n from consentimientos_historial")).rows[0].n === 0, "la migración no inventa un historial de consentimiento")

  // ── 2. Lo que hace la pantalla publicada con los pacientes (insertar y editar por la vista)
  let x = await intenta(admin, async () => (await c.query("insert into pacientes (optica_id, nombre, cedula, telefono, correo, fecha_nacimiento) values ($1, 'ENSAYO 0114 Uno', '0900000014', '0991111111', 'e14@x.com', '1990-05-05') returning id, acepta_recordatorios, acepta_promociones", [optica])).rows[0])
  ok(x.r && x.r.acepta_recordatorios === true && x.r.acepta_promociones === false, "crear un paciente como lo hace la pantalla publicada: funciona y nace con recordatorios sí / promociones no" + (x.e ? " — " + x.e : ""))
  const pac = x.r?.id
  x = await intenta(admin, () => c.query("update pacientes set nombre = 'ENSAYO 0114 Uno B', telefono = '0992222222' where id = $1", [pac]))
  ok(!x.e, "editar un paciente como lo hace la pantalla publicada: funciona" + (x.e ? " — " + x.e : ""))
  let p = (await c.query("select nombre, telefono, acepta_recordatorios, acepta_promociones, consentimiento_actualizado_en from pacientes_base where id = $1", [pac])).rows[0]
  ok(p.nombre === "ENSAYO 0114 Uno B" && p.telefono === "0992222222", "…y guarda los cambios")
  ok(p.acepta_recordatorios === true && p.acepta_promociones === false && p.consentimiento_actualizado_en !== null, "…sin tocar los permisos")
  const ini = (await c.query("select id, permiso, valor, origen, cambiado_por from consentimientos_historial where paciente_id = $1 order by permiso", [pac])).rows
  const inicialesIds = ini.map((r) => r.id)
  ok(ini.length === 2 && ini[0].permiso === "promociones" && ini[0].valor === false && ini[1].permiso === "recordatorios" && ini[1].valor === true && ini.every((r) => r.origen === "personal" && r.cambiado_por === admin), "…y al nacer queda anotado con qué permisos y quién lo registró (2 líneas), sin más historial al editar")

  // ── 3. Cambiar los permisos desde el personal
  const cambiar = (uid, a, b, origen = "personal") => comoSigue(uid, async () => (await c.query("select cambiar_consentimiento_paciente($1,$2,$3,$4) r", [pac, a, b, origen])).rows[0].r)
  x = await intenta(admin, () => cambiar(admin, null, true))
  ok(x.r && x.r.acepta_promociones === true && x.r.acepta_recordatorios === true && x.r.actualizado_por === nombreAdmin, "el administrador activa 'Promociones': queda guardado con su nombre")
  let h = (await c.query("select permiso, valor, origen, cambiado_por, cambiado_por_nombre from consentimientos_historial where paciente_id = $1 and id <> all($2::uuid[]) order by cambiado_en, permiso", [pac, inicialesIds])).rows
  ok(h.length === 1 && h[0].permiso === "promociones" && h[0].valor === true && h[0].origen === "personal" && h[0].cambiado_por === admin, "…y deja una línea en el historial: promociones sí, origen personal, quién fue")
  x = await intenta(admin, () => cambiar(admin, true, true))
  ok(!x.e && (await c.query("select count(*)::int n from consentimientos_historial where paciente_id = $1", [pac])).rows[0].n === 3, "repetir el mismo valor no deja historial")
  x = await intenta(admin, () => cambiar(admin, false, null, "crm"))
  h = (await c.query("select permiso, valor, origen from consentimientos_historial where paciente_id = $1 and id <> all($2::uuid[]) order by cambiado_en, permiso", [pac, inicialesIds])).rows
  ok(x.r && x.r.acepta_recordatorios === false && x.r.acepta_promociones === true && h.length === 2 && h[1].permiso === "recordatorios" && h[1].valor === false && h[1].origen === "crm", "los dos permisos son independientes: quitar recordatorios no quita promociones (origen crm)")
  x = await intenta(admin, () => cambiar(admin, true, null, "paciente"))
  ok(/Origen no válido/.test(x.e || ""), "el personal no puede hacerse pasar por el paciente: " + x.e)
  const logs = (await c.query("select accion, detalle, usuario_nombre from logs_optica where modulo = 'pacientes' and detalle like 'ENSAYO 0114 Uno B%' order by created_at")).rows
  ok(logs.length === 2 && /Promociones y saludos: sí/.test(logs[0].detalle) && /Recordatorios de salud: no/.test(logs[1].detalle) && logs[0].usuario_nombre === nombreAdmin, "cada cambio queda en la actividad de la óptica, con quién lo hizo")
  await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") // sin sesión: como un script con acceso directo
  await c.query("update pacientes_base set acepta_recordatorios = true where id = $1", [pac])
  h = (await c.query("select origen, cambiado_por_nombre from consentimientos_historial where paciente_id = $1 and origen = 'sistema'", [pac])).rows[0] || {}
  ok(h.origen === "sistema" && h.cambiado_por_nombre === "Sistema", "un cambio directo en la base (sin sesión) también queda anotado, como 'Sistema'")

  // ── 4. El paciente desde su portal
  await c.query("update pacientes_base set sesion_token = 'token-ensayo-0114', sesion_token_creado_en = now() where id = $1", [pac])
  const portal = (token, a, b) => anonimo(async () => (await c.query("select actualizar_consentimiento_paciente($1,$2,$3,$4) r", [pac, token, a, b])).rows[0].r)
  x = await anonimo(async () => (await c.query("select mis_permisos_mensajes($1,'token-ensayo-0114') r", [pac])).rows[0].r)
  ok(x.r && x.r.ok === true && x.r.recordatorios === true && x.r.promociones === true, "el paciente ve sus permisos desde el portal")
  x = await anonimo(async () => (await c.query("select mis_permisos_mensajes($1,'inventado') r", [pac])).rows[0].r)
  ok(x.r && x.r.ok === false && x.r.error === "sesion", "con un token inventado no ve nada")
  x = await portal("token-ensayo-0114", null, false)
  ok(x.r && x.r.ok === true && x.r.promociones === false && x.r.recordatorios === true, "el paciente quita 'Promociones' desde su portal")
  h = (await c.query("select permiso, valor, origen, cambiado_por, cambiado_por_nombre from consentimientos_historial where paciente_id = $1 and origen = 'paciente'", [pac])).rows
  ok(h.length === 1 && h[0].permiso === "promociones" && h[0].valor === false && h[0].cambiado_por === null && h[0].cambiado_por_nombre === "ENSAYO 0114 Uno B", "…y queda: lo cambió el propio paciente (con su nombre, sin usuario del personal)")
  x = await portal("inventado", false, false)
  ok(x.r && x.r.ok === false && x.r.error === "sesion", "con un token inventado no cambia nada")
  x = await portal("token-ensayo-0114", null, null)
  ok(x.r && x.r.ok === false, "sin indicar qué permiso: se rechaza")
  ok((await c.query("select acepta_promociones, acepta_recordatorios from pacientes_base where id = $1", [pac])).rows[0].acepta_promociones === false, "…y los permisos siguen como estaban")
  x = await anonimo(() => c.query("select cambiar_consentimiento_paciente($1,true,true,'personal')", [pac]))
  ok(/permission denied/.test(x.e || ""), "sin sesión del personal no se puede usar la función del personal: " + x.e)

  // ── 5. Permisos del personal
  const darRol = async (uid, permisos, nombre) => {
    await c.query("delete from perfil_roles where perfil_id = $1", [uid])
    const rol = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, $2, $3::jsonb, '{}'::jsonb, false) returning id", [optica, nombre, JSON.stringify(permisos)])).rows[0].id
    await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [uid, rol])
  }
  await darRol(paula, { citas: ["ver"] }, "Ensayo 0114 sin CRM")
  x = await intenta(paula, () => cambiar(paula, true, true))
  ok(/No tienes permiso/.test(x.e || ""), "sin CRM 'crear' ni Pacientes 'editar' no se cambian los permisos de un paciente: " + x.e)
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from crm_contactos")).rows[0].n)
  ok(x.r === 0, "sin CRM 'ver' no se lee el historial de contactos")
  await darRol(paula, { crm: ["ver"] }, "Ensayo 0114 CRM ver")
  x = await intenta(paula, () => cambiar(paula, true, true))
  ok(/No tienes permiso/.test(x.e || ""), "con CRM 'ver' solo se mira: " + x.e)
  const contactar = (uid, pid, motivo, canal = "whatsapp", mensaje = "Hola", campana = null, resultado = null, volver = null) =>
    comoSigue(uid, async () => (await c.query("select registrar_contacto_crm($1,$2,$3,$4,$5,$6,$7) r", [pid, motivo, canal, mensaje, campana, resultado, volver])).rows[0].r)
  x = await intenta(paula, () => contactar(paula, pac, "control_vencido"))
  ok(/No tienes permiso/.test(x.e || ""), "con CRM 'ver' tampoco se registra un contacto: " + x.e)
  await darRol(paula, { crm: ["ver", "crear"] }, "Ensayo 0114 CRM crear")
  x = await intenta(paula, () => cambiar(paula, true, null, "crm"))
  ok(x.r && x.r.acepta_recordatorios === true, "con CRM 'crear' se cambian los permisos desde el CRM")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('cumpleanos','Feliz cumple {nombre}, de {optica}.')")))
  ok(/No tienes permiso/.test(x.e || ""), "…pero editar las plantillas pide CRM 'editar': " + x.e)

  // ── 6. Contactos
  await c.query("update pacientes_base set acepta_recordatorios = true, acepta_promociones = false where id = $1", [pac])
  x = await intenta(paula, () => contactar(paula, pac, "control_vencido", "whatsapp", "Hola, tu control"))
  ok(x.r, "registrar un contacto por control vencido" + (x.e ? " — " + x.e : ""))
  const c1 = x.r
  let fila = (await c.query("select * from crm_contactos where id = $1", [c1])).rows[0]
  ok(fila.resultado === null && fila.creado_por === paula && !!fila.creado_por_nombre && fila.canal === "whatsapp" && fila.mensaje === "Hola, tu control", "…con quién lo hizo, el canal y el mensaje, sin resultado todavía")
  x = await intenta(paula, () => contactar(paula, pac, "promocion"))
  ok(/no aceptó recibir promociones/.test(x.e || ""), "el servidor no deja escribirle por promociones a quien no las aceptó: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac, "inventado"))
  ok(/Motivo no válido/.test(x.e || ""), "motivo inventado: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac, "cumpleanos", "telepatia"))
  ok(/Canal no válido/.test(x.e || ""), "canal inventado: " + x.e)
  const resultado = (uid, id, r, volver = null) => comoSigue(uid, () => c.query("select registrar_resultado_contacto_crm($1,$2,$3)", [id, r, volver]))
  x = await intenta(paula, () => resultado(paula, c1, "volver_a_contactar", null))
  ok(/fecha futura/.test(x.e || ""), "volver a contactar sin fecha: " + x.e)
  x = await intenta(paula, () => resultado(paula, c1, "volver_a_contactar", "2020-01-01"))
  ok(/fecha futura/.test(x.e || ""), "volver a contactar con una fecha pasada: " + x.e)
  x = await intenta(paula, () => resultado(paula, c1, "no_respondio", "2099-01-01"))
  ok(/solo va con ese resultado/.test(x.e || ""), "una fecha de volver con otro resultado: " + x.e)
  const en3 = (await c.query("select ((now() at time zone 'America/Guayaquil')::date + 3)::text d")).rows[0].d
  x = await intenta(paula, () => resultado(paula, c1, "volver_a_contactar", en3))
  fila = (await c.query("select * from crm_contactos where id = $1", [c1])).rows[0]
  ok(!x.e && fila.resultado === "volver_a_contactar" && String(fila.volver_el.toISOString?.() ?? fila.volver_el).includes(en3.slice(0, 10)) && !!fila.resultado_por_nombre, "volver a contactar en 3 días: queda con su fecha y quién lo anotó" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, () => resultado(paula, c1, "no_respondio"))
  fila = (await c.query("select * from crm_contactos where id = $1", [c1])).rows[0]
  ok(!x.e && fila.resultado === "no_respondio" && fila.volver_el === null, "corregir el resultado a otro limpia la fecha")
  x = await intenta(paula, () => contactar(paula, pac, "control_vencido", "llamada", "", null, "agendo"))
  ok(x.r && (await c.query("select resultado from crm_contactos where id = $1", [x.r])).rows[0].resultado === "agendo", "anotar de una vez una llamada con su resultado")

  // un contacto no se reescribe ni se borra, ni por el personal ni con acceso directo a la base
  x = await intenta(admin, () => c.query("update crm_contactos set mensaje = 'otro' where id = $1", [c1]))
  ok(/permission denied/.test(x.e || ""), "el administrador no puede editar un contacto a mano: " + x.e)
  x = await intenta(admin, () => c.query("delete from crm_contactos where id = $1", [c1]))
  ok(/permission denied/.test(x.e || ""), "…ni borrarlo: " + x.e)
  x = await directo(() => c.query("update crm_contactos set mensaje = 'otro' where id = $1", [c1]))
  ok(/solo admite que se anote su resultado/.test(x.e || ""), "ni siquiera con acceso directo a la base se cambia el mensaje: " + x.e)
  x = await directo(() => c.query("delete from crm_contactos where id = $1", [c1]))
  ok(/no se puede borrar/.test(x.e || ""), "…ni se borra: " + x.e)

  // ── 7. "No desea recibir mensajes"
  const pac2 = (await c.query("insert into pacientes_base (optica_id, nombre, telefono) values ($1, 'ENSAYO 0114 Dos', '0993333333') returning id", [optica])).rows[0].id
  await c.query("update pacientes_base set acepta_promociones = true where id = $1", [pac2])
  x = await intenta(paula, () => contactar(paula, pac2, "control_vencido", "whatsapp", "Hola"))
  const c2 = x.r
  x = await intenta(paula, () => resultado(paula, c2, "no_desea_mensajes"))
  p = (await c.query("select acepta_recordatorios, acepta_promociones from pacientes_base where id = $1", [pac2])).rows[0]
  ok(!x.e && p.acepta_recordatorios === false && p.acepta_promociones === false, "'No desea recibir mensajes' desactiva los dos permisos" + (x.e ? " — " + x.e : ""))
  const hh = (await c.query("select permiso, valor, origen, cambiado_por from consentimientos_historial where paciente_id = $1 and valor = false and origen = 'crm' order by permiso", [pac2])).rows
  ok(hh.length === 2 && hh.every((r) => r.origen === "crm" && r.cambiado_por === paula), "…con su historial: los dos, origen crm, quién lo anotó")
  x = await intenta(paula, () => contactar(paula, pac2, "control_vencido"))
  ok(/no desea recibir mensajes/.test(x.e || ""), "a partir de ahí el servidor no deja escribirle: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac2, "control_vencido", "llamada", "", null, "no_desea_mensajes"))
  ok(!x.e, "…pero sí se puede anotar que, por otra vía, volvió a decir que no quiere" + (x.e ? " — " + x.e : ""))

  // ── 8. Campañas y plantillas
  x = await intenta(paula, () => comoSigue(paula, async () => (await c.query("select crear_campana_crm('Control vencido de octubre','control_vencido','Hola {nombre}, de {optica}: es hora de tu control.') r")).rows[0].r))
  const camp = x.r
  ok(camp, "crear una campaña" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select crear_campana_crm('Mala','otro grupo','Hola, este es un mensaje')")))
  ok(/Grupo no válido/.test(x.e || ""), "grupo inventado: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select crear_campana_crm('ab','promociones','Hola, este es un mensaje')")))
  ok(/nombre/.test(x.e || ""), "sin nombre: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select crear_campana_crm('Corta','promociones','Hola')")))
  ok(/mensaje/.test(x.e || ""), "mensaje muy corto: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac, "promocion", "whatsapp", "Mensaje de campaña", camp))
  const cc = (await c.query("select motivo, campana_id from crm_contactos where id = $1", [x.r])).rows[0]
  ok(x.r && cc.motivo === "control_vencido" && cc.campana_id === camp, "enviar a un paciente dentro de una campaña: el motivo sale del grupo de la campaña, no de lo que diga el navegador")
  x = await intenta(paula, () => contactar(paula, pac, "control_vencido", "whatsapp", "x", "00000000-0000-0000-0000-000000000000"))
  ok(/campaña no existe/.test(x.e || ""), "una campaña que no existe: " + x.e)
  await darRol(paula, { crm: ["ver", "crear", "editar"] }, "Ensayo 0114 CRM editar")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('cumpleanos','Feliz cumple {nombre}, de {optica}.')")))
  ok(!x.e, "con CRM 'editar' se guarda una plantilla" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('cumpleanos','Feliz cumple {nombre}, de {optica}. Que lo disfrutes.')")))
  ok(!x.e && (await c.query("select count(*)::int n from crm_plantillas where optica_id = $1 and motivo = 'cumpleanos'", [optica])).rows[0].n === 1, "guardarla de nuevo la reemplaza (una sola por motivo)")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('cumpleanos','   ')")))
  ok(!x.e && (await c.query("select count(*)::int n from crm_plantillas where optica_id = $1 and motivo = 'cumpleanos'", [optica])).rows[0].n === 0, "guardarla vacía vuelve al mensaje base")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('otro','Un mensaje largo')")))
  ok(/Motivo no válido/.test(x.e || ""), "motivo inventado en la plantilla: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select guardar_plantilla_crm('postventa',$1)", ["x".repeat(501)])))
  ok(/demasiado largo/.test(x.e || ""), "plantilla de más de 500 caracteres: " + x.e)
  const log = (await c.query("select accion, detalle from logs_optica where modulo = 'crm'")).rows
  ok(log.some((l) => l.accion === "Creó una campaña" && l.detalle === "Control vencido de octubre"), "crear una campaña queda en la actividad")

  // ── 9. Lectura: la propia óptica con CRM 'ver'; nadie más
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from crm_contactos")).rows[0].n)
  ok(x.r >= 4, "con CRM 'ver' se lee el historial de contactos (" + x.r + ")")
  x = await anonimo(() => c.query("select count(*)::int n from crm_contactos"))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se lee nada: " + x.e)
  x = await anonimo(() => c.query("select registrar_contacto_crm($1,'control_vencido')", [pac]))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se registra nada: " + x.e)
  x = await anonimo(() => c.query("select count(*)::int n from consentimientos_historial"))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se lee el historial de permisos: " + x.e)
  if (ajena) {
    x = await intenta(ajena, async () => (await c.query("select (select count(*)::int from crm_contactos where optica_id = $1) a, (select count(*)::int from crm_campanas where optica_id = $1) b, (select count(*)::int from consentimientos_historial where optica_id = $1) d", [optica])).rows[0])
    ok(x.r && x.r.a === 0 && x.r.b === 0 && x.r.d === 0, "el administrador de otra óptica no lee contactos, campañas ni permisos de esta")
    x = await intenta(ajena, () => contactar(ajena, pac, "control_vencido"))
    ok(/no existe/.test(x.e || ""), "…ni registra un contacto de un paciente de esta óptica: " + x.e)
    x = await intenta(ajena, () => cambiar(ajena, true, true))
    ok(/no existe/.test(x.e || ""), "…ni cambia sus permisos: " + x.e)
    x = await intenta(ajena, () => resultado(ajena, c1, "agendo"))
    ok(/no existe/.test(x.e || ""), "…ni anota un resultado en un contacto de esta óptica: " + x.e)
  }

  // ── 9b. Cada motivo pide su permiso: cumpleaños = "Promociones y saludos"; control = "Recordatorios de salud"
  const pac3 = (await c.query("insert into pacientes_base (optica_id, nombre, telefono) values ($1, 'ENSAYO 0114 Tres', '0994444444') returning id", [optica])).rows[0].id
  await c.query("update pacientes_base set acepta_recordatorios = true, acepta_promociones = false where id = $1", [pac3])
  x = await intenta(paula, () => contactar(paula, pac3, "cumpleanos"))
  ok(/no aceptó recibir promociones y saludos/.test(x.e || ""), "sin 'Promociones y saludos' el servidor no deja escribirle por su cumpleaños: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac3, "control_proximo"))
  ok(x.r, "…pero sí por su control (Recordatorios de salud)" + (x.e ? " — " + x.e : ""))
  await c.query("update pacientes_base set acepta_recordatorios = false, acepta_promociones = true where id = $1", [pac3])
  x = await intenta(paula, () => contactar(paula, pac3, "cumpleanos"))
  ok(x.r, "con 'Promociones y saludos' sí se le escribe por su cumpleaños" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, () => contactar(paula, pac3, "control_vencido"))
  ok(/no aceptó recibir recordatorios de salud/.test(x.e || ""), "…y sin 'Recordatorios de salud' no se le escribe por su control: " + x.e)
  x = await intenta(paula, () => contactar(paula, pac3, "postventa"))
  ok(/recordatorios de salud/.test(x.e || ""), "…ni por el seguimiento de su compra: " + x.e)

  // ── 9c. Los permisos que el paciente elige al reservar por la web
  let slot = 0
  const nuevoWeb = async (nombre, minutos = 0, citas = 1) => {
    const p = (await c.query("insert into pacientes_base (optica_id, nombre, telefono, origen) values ($1, $2, '0995555555', 'paciente') returning id", [optica, nombre])).rows[0].id
    if (minutos) await c.query("update pacientes_base set created_at = now() - ($2 || ' minutes')::interval where id = $1", [p, String(minutos)])
    const ids = []
    for (let i = 0; i < citas; i++) ids.push((await c.query("insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, motivo, origen) values ($1,$2,$3, current_date + 40 + $4::int, '03:00 PM', 'Pendiente', 'Control', 'paciente') returning id", [optica, p, nombre, ++slot])).rows[0].id)
    return { p, cita: ids[0] }
  }
  const web = (cita, a, b) => anonimo(async () => (await c.query("select registrar_permisos_cita_publica($1,$2,$3) r", [cita, a, b])).rows[0].r)
  let w = await nuevoWeb("ENSAYO 0114 Web Nuevo")
  x = await web(w.cita, true, true)
  p = (await c.query("select acepta_recordatorios, acepta_promociones, consentimiento_actualizado_por from pacientes_base where id = $1", [w.p])).rows[0]
  ok(x.r === true && p.acepta_recordatorios === true && p.acepta_promociones === true && p.consentimiento_actualizado_por === "ENSAYO 0114 Web Nuevo", "el paciente que reserva por la web elige sus permisos justo al reservar (queda a su nombre)")
  h = (await c.query("select origen, cambiado_por from consentimientos_historial where paciente_id = $1 and permiso = 'promociones' order by cambiado_en", [w.p])).rows
  ok(h.some((r) => r.origen === "paciente" && r.cambiado_por === null), "…y en el historial como cambio del propio paciente")
  w = await nuevoWeb("ENSAYO 0114 Web Viejo", 60)
  x = await web(w.cita, false, true)
  ok(x.r === false && (await c.query("select acepta_recordatorios from pacientes_base where id = $1", [w.p])).rows[0].acepta_recordatorios === true, "un paciente que ya existía (registrado hace más de 15 minutos) no puede cambiar sus permisos así")
  w = await nuevoWeb("ENSAYO 0114 Web DosCitas", 0, 2)
  x = await web(w.cita, false, true)
  ok(x.r === false, "tampoco uno con más de una cita (quien reserva con la cédula de otro)")
  x = await web("00000000-0000-0000-0000-000000000000", true, true)
  ok(x.r === false, "una cita que no existe: se rechaza")
  w = await nuevoWeb("ENSAYO 0114 Web Nulo")
  x = await web(w.cita, null, true)
  ok(x.r === false, "sin indicar los dos permisos: se rechaza")

  // ── 10. Los correos automáticos respetan el permiso (no se ejecutan: enviarían de verdad; se comprueba su definición y que sigan siendo una sola)
  for (const [n, permiso, texto] of [["enviar_saludos_cumpleanos", "acepta_promociones", "'Promociones y saludos'"], ["enviar_recordatorios_citas", "acepta_recordatorios", "'Recordatorios de salud'"]]) {
    const def = (await c.query("select pg_get_functiondef(oid) d from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows
    ok(def.length === 1 && def[0].d.includes(permiso), `${n}: una sola versión y ahora respeta ${texto}`)
  }

  // ── 11. Anonimizar y borrar un paciente se llevan su historial sin tropezar con la protección
  x = await directo(() => c.query("delete from pacientes_base where id = $1", [pac2]))
  ok(!x.e, "borrar un paciente (como lo hace 'Eliminar paciente') borra también su historial de contactos y de permisos" + (x.e ? " — " + x.e : ""))
  ok((await c.query("select count(*)::int n from crm_contactos where paciente_id = $1", [pac2])).rows[0].n === 0, "…no queda nada suelto")

  console.log(fallos === 0 ? "\nTODO BIEN: " + "la migración 0114 pasa el ensayo (se revierte, no deja nada)." : `\n${fallos} PRUEBA(S) FALLARON.`)
} catch (e) {
  console.error("ERROR EN EL ENSAYO:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log("(rollback: la base queda exactamente como estaba)")
  process.exit(fallos ? 1 : 0)
}
