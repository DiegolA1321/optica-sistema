// Ensayo de las migraciones 0143 a 0146 (Ronda 5): las aplica EN ORDEN dentro de una transacción y prueba cada cosa con sesiones reales (el rol authenticated con las claims de cada persona de la óptica de pruebas).
// SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/historial/ensayo-0143-0146.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (n) => fs.readFileSync(new URL(`../../supabase/migrations/${n}`, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

// Corre fn como esa persona (authenticated + sus claims). Con `guardar`, lo que haga se queda dentro de la transacción; si no, se deshace.
let n = 0
const como = async (uid, fn, { guardar = false } = {}) => {
  const sp = `s${++n}`
  await c.query(`savepoint ${sp}`)
  try {
    await c.query("set local role authenticated")
    if (uid) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
    const r = await fn()
    await c.query("reset role")
    if (guardar) await c.query(`release savepoint ${sp}`); else await c.query(`rollback to savepoint ${sp}`)
    return { r }
  } catch (e) {
    await c.query(`rollback to savepoint ${sp}`)
    await c.query("reset role")
    return { e: e.message }
  }
}
const sumarDias = (iso, d) => { const f = new Date(`${iso}T12:00:00`); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}` }

try {
  await c.query("begin")
  const optica = (await q("select id from opticas where slug = 'v8twzq'"))[0].id // la óptica de pruebas
  const personas = await q("select id, nombre, rol, es_optometra from perfiles where optica_id = $1 and activo", [optica])
  const admin = personas.find((p) => p.rol === "admin")
  const paula = personas.find((p) => p.es_optometra && p.rol === "asistente")
  const rosa = personas.find((p) => p.nombre.startsWith("Rosa"))
  const vera = personas.find((p) => p.nombre.startsWith("Vera"))
  const ajeno = (await q("select p.id from perfiles p where p.optica_id <> $1 and p.rol = 'admin' and p.activo limit 1", [optica]))[0]?.id
  if (!admin || !paula || !rosa || !vera) throw new Error("Faltan personas en la óptica de pruebas")
  const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date::text d"))[0].d

  // ── Antes de aplicar: lo que no debe cambiar
  const antes = {
    horarios: (await q("select count(*)::int n from horarios_usuario"))[0].n,
    roles: (await q("select md5(string_agg(id::text || permisos::text || alcance::text, '|' order by id)) m from roles"))[0].m,
    consultas: (await q("select count(*)::int n from consultas_base"))[0].n,
  }
  for (const f of ["0143_registrar_conteo_inventario.sql", "0144_crm_plantilla_pedido_listo_envio.sql", "0145_alcance_atiende_y_cita_de_la_ficha.sql", "0146_horarios_por_persona_y_ausencias.sql"]) {
    await c.query(leer(f))
    ok(true, `${f} se aplica sin errores`)
  }
  const despues = {
    horarios: (await q("select count(*)::int n from horarios_usuario"))[0].n,
    roles: (await q("select md5(string_agg(id::text || permisos::text || alcance::text, '|' order by id)) m from roles"))[0].m,
    consultas: (await q("select count(*)::int n from consultas_base"))[0].n,
  }
  ok(antes.horarios === despues.horarios && antes.roles === despues.roles && antes.consultas === despues.consultas, "ningún dato existente cambia (horarios, roles y fichas iguales)")
  ok((await q("select count(*)::int n from horarios_usuario where not usa_horario_optica"))[0].n === 0, "todas las filas de horarios_usuario quedan «usa el horario de la óptica»")

  // ═════════ 0143 · registrar_conteo_inventario ═════════
  await q("update opticas set settings = coalesce(settings, '{}'::jsonb) || '{\"stockMinimo\": 7}'::jsonb where id = $1", [optica])
  let r = await como(vera.id, async () => { await c.query("select registrar_conteo_inventario($1::date)", [hoy]); return (await q("select settings from opticas where id = $1", [optica]))[0].settings })
  ok(r.r?.ultimoConteo === hoy && r.r?.stockMinimo === 7, "0143: quien maneja el inventario (Ventas) registra el conteo y no pisa el resto de la configuración" + (r.e ? " — " + r.e : ""))
  r = await como(rosa.id, async () => { await c.query("select registrar_conteo_inventario()"); return (await q("select settings->>'ultimoConteo' u from opticas where id = $1", [optica]))[0].u })
  ok(r.r === hoy, "0143: sin fecha usa hoy (Ecuador)" + (r.e ? " — " + r.e : ""))
  r = await como(vera.id, () => c.query("select registrar_conteo_inventario($1::date)", [sumarDias(hoy, 5)]))
  ok(!!r.e && /fecha del conteo/.test(r.e), "0143: una fecha futura se rechaza: " + r.e)
  if (ajeno) {
    const otra = (await q("select optica_id from perfiles where id = $1", [ajeno]))[0].optica_id
    const antesOtra = (await q("select settings->>'ultimoConteo' u from opticas where id = $1", [optica]))[0].u
    r = await como(ajeno, async () => { try { await c.query("select registrar_conteo_inventario($1::date)", [hoy]) } catch (e) { return e.message } return "ok" })
    const despuesNuestra = (await q("select settings->>'ultimoConteo' u from opticas where id = $1", [optica]))[0].u
    ok(despuesNuestra === antesOtra, "0143: la persona de otra óptica solo toca la suya (" + otra.slice(0, 8) + "…), nunca la de pruebas")
  }
  ok(!(await q("select has_function_privilege('anon','public.registrar_conteo_inventario(date)','execute') a"))[0].a, "0143: anon no puede ejecutarla")

  // ═════════ 0144 · plantilla de «Pedido listo (envío)» ═════════
  r = await como(admin.id, async () => { await c.query("select guardar_plantilla_crm('lentes_listos_envio', 'Hola, tu pedido ya salió: llega pronto a tu dirección.')"); return (await q("select texto from crm_plantillas where optica_id = $1 and motivo = 'lentes_listos_envio'", [optica]))[0]?.texto })
  ok(!!r.r, "0144: el administrador guarda la plantilla de «Pedido listo (envío)»" + (r.e ? " — " + r.e : ""))
  r = await como(admin.id, () => c.query("select guardar_plantilla_crm('no_existe', 'Hola, esto es una prueba larga.')"))
  ok(!!r.e && /Motivo no válido/.test(r.e), "0144: un motivo que no existe se sigue rechazando")
  const pacienteId = (await q("select id from pacientes_base where optica_id = $1 limit 1", [optica]))[0]?.id
  if (pacienteId) {
    r = await como(vera.id, async () => (await q("select registrar_contacto_de_aviso($1, 'lentes_listos_envio', 'Hola') id", [pacienteId]))[0].id)
    ok(!!r.r, "0144: Ventas deja el contacto del aviso de envío en el Seguimiento" + (r.e ? " — " + r.e : ""))
    r = await como(ajeno || rosa.id, async () => (await q("select registrar_contacto_de_aviso($1, 'lentes_listos_envio', 'Hola') id", [pacienteId]))[0].id)
    ok(!!r.e, "0144: la persona de otra óptica no puede (el paciente no es de su óptica): " + r.e)
  }

  // ═════════ 0145 · alcance «los que atiende» y la cita de la ficha ═════════
  const rolOptometra = (await q("select r.id from roles r join perfil_roles pr on pr.rol_id = r.id where pr.perfil_id = $1", [paula.id]))[0].id
  const p1 = (await q("insert into pacientes_base (optica_id, nombre) values ($1, 'ENSAYO Paciente Uno') returning id", [optica]))[0].id
  const p2 = (await q("insert into pacientes_base (optica_id, nombre) values ($1, 'ENSAYO Paciente Dos') returning id", [optica]))[0].id
  const cPaula = (await q("insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, asignado_a) values ($1, $2, 'ENSAYO Paciente Uno', '2099-02-02', '09:00 AM', 'Pendiente', $3) returning id", [optica, p1, paula.id]))[0].id
  const cAdmin1 = (await q("insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, asignado_a) values ($1, $2, 'ENSAYO Paciente Uno', '2099-01-02', '10:00 AM', 'Atendida', $3) returning id", [optica, p1, admin.id]))[0].id
  const cAdmin2 = (await q("insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, asignado_a) values ($1, $2, 'ENSAYO Paciente Dos', '2099-01-03', '10:00 AM', 'Atendida', $3) returning id", [optica, p2, admin.id]))[0].id
  const kA = (await q("insert into consultas_base (optica_id, paciente_id, paciente, fecha, cita_id) values ($1, $2, 'ENSAYO Paciente Uno', '2099-01-02', $3) returning id", [optica, p1, cAdmin1]))[0].id
  const kB = (await q("insert into consultas_base (optica_id, paciente_id, paciente, fecha, cita_id) values ($1, $2, 'ENSAYO Paciente Dos', '2099-01-03', $3) returning id", [optica, p2, cAdmin2]))[0].id
  await q("update consultas_base set profesional_id = $1 where id in ($2, $3)", [admin.id, kA, kB])
  const fichasVistasPor = (uid, alcance) => como(uid, async () => {
    return {
      alcance: (await q("select alcance_efectivo('consultas') a"))[0].a,
      fichas: (await q("select id, cita_resumen from consultas where paciente like 'ENSAYO%' order by paciente")).map((x) => ({ id: x.id, resumen: x.cita_resumen })),
      citas: (await q("select id from citas where paciente like 'ENSAYO%'")).map((x) => x.id),
    }
  })
  const poner = (alc) => q("update roles set alcance = $2::jsonb where id = $1", [rolOptometra, JSON.stringify({ citas: "propio", consultas: alc, reportes: "propio" })])
  await poner("propio")
  r = await fichasVistasPor(paula.id)
  ok(r.r?.alcance === "propio" && r.r.fichas.length === 0, "0145: «solo las suyas»: no ve las fichas que atendió otro profesional")
  await poner("atiende")
  r = await fichasVistasPor(paula.id)
  ok(r.r?.alcance === "atiende", "0145: alcance_efectivo devuelve «atiende»")
  ok(r.r?.fichas.length === 1 && r.r.fichas[0].id === kA, "0145: «los que atiende»: ve la ficha del paciente que atiende (Paciente Uno) y no la del que no atiende (Paciente Dos)")
  ok(r.r?.fichas[0]?.resumen?.fecha === "2099-01-02" && r.r.fichas[0].resumen.hora === "10:00 AM" && r.r.fichas[0].resumen.estado === "Atendida", "0145: la ficha trae la fecha, la hora y el estado de su cita aunque esa cita no sea suya")
  ok(!r.r?.citas.includes(cAdmin1) && r.r?.citas.includes(cPaula), "0145: la cita del otro profesional sigue sin aparecer en su agenda (solo se ve su fecha y estado en la ficha)")
  await poner("todo")
  r = await fichasVistasPor(paula.id)
  ok(r.r?.alcance === "todo" && r.r.fichas.length === 2 && r.r.fichas.every((f) => f.resumen?.estado === "Atendida"), "0145: «toda la óptica»: ve las dos fichas, cada una con la fecha y el estado de su cita (la incoherencia corregida)")
  await q("update roles set alcance = '{\"citas\":\"propio\"}'::jsonb where id = $1", [rolOptometra])
  r = await fichasVistasPor(paula.id)
  ok(r.r?.alcance === "todo", "0145: un rol sin alcance de fichas guardado sigue valiendo «toda la óptica» (como antes)")
  r = await fichasVistasPor(admin.id)
  ok(r.r?.alcance === "todo" && r.r.fichas.length === 2, "0145: el administrador ve todo")
  if (ajeno) {
    r = await como(ajeno, async () => ({ f: (await q("select id from consultas where paciente like 'ENSAYO%'")).length, c: (await q("select resumen_cita_de_ficha($1) x", [cAdmin1]))[0].x }))
    ok(r.r?.f === 0 && r.r?.c === null, "0145: la persona de otra óptica no ve la ficha ni el resumen de su cita")
  }
  r = await como(rosa.id, async () => (await q("select resumen_cita_de_ficha($1) x", [cAdmin1]))[0].x)
  ok(r.r?.estado === "Atendida" && Object.keys(r.r).sort().join() === "estado,fecha,hora", "0145: el resumen entrega solo fecha, hora y estado de la cita (nada más)")

  // ═════════ 0146 · horarios por persona ═════════
  const std = () => ({ activo: true, inicio: "09:00", fin: "13:00" })
  const dia = () => ({ manana: std(), tarde: { activo: true, inicio: "14:00", fin: "18:00" } })
  const semanaOptica = { lunes: dia(), martes: dia(), miercoles: dia(), jueves: dia(), viernes: dia(), sabado: { manana: std(), tarde: { activo: false, inicio: "14:00", fin: "18:00" } }, domingo: { manana: { ...std(), activo: false }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } } }
  await q("insert into disponibilidad (optica_id, horario_semanal, excepciones, duracion_cita) values ($1, $2::jsonb, '{}'::jsonb, 60) on conflict (optica_id) do update set horario_semanal = excluded.horario_semanal, excepciones = '{}'::jsonb, duracion_cita = 60", [optica, JSON.stringify(semanaOptica)])
  const mananaDeLunes = { ...semanaOptica, lunes: { manana: std(), tarde: { activo: false, inicio: "14:00", fin: "18:00" } }, martes: { manana: { ...std(), activo: false }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } } }
  r = await como(admin.id, async () => { await c.query("select guardar_horario_persona($1, false, $2::jsonb)", [paula.id, JSON.stringify(mananaDeLunes)]); return (await q("select usa_horario_optica u, horario_semanal->'lunes'->'tarde'->>'activo' t from horarios_usuario where usuario_id = $1", [paula.id]))[0] }, { guardar: true })
  ok(r.r?.u === false && r.r?.t === "false", "0146: el administrador asigna un horario propio (medio tiempo)" + (r.e ? " — " + r.e : ""))
  const fuera = { ...mananaDeLunes, lunes: { manana: { activo: true, inicio: "08:00", fin: "13:00" }, tarde: mananaDeLunes.lunes.tarde } }
  r = await como(admin.id, () => c.query("select guardar_horario_persona($1, false, $2::jsonb)", [paula.id, JSON.stringify(fuera)]))
  ok(!!r.e && /dentro del de la óptica/.test(r.e) && /lunes/.test(r.e), "0146: un turno fuera del horario de la óptica se rechaza: " + r.e)
  const sabadoTarde = { ...mananaDeLunes, sabado: { manana: std(), tarde: { activo: true, inicio: "14:00", fin: "18:00" } } }
  r = await como(admin.id, () => c.query("select guardar_horario_persona($1, false, $2::jsonb)", [paula.id, JSON.stringify(sabadoTarde)]))
  ok(!!r.e, "0146: un turno en un día/turno que la óptica no atiende se rechaza")
  r = await como(admin.id, () => c.query("select guardar_horario_persona($1, false, $2::jsonb)", [paula.id, JSON.stringify({ lunes: { manana: { activo: true, inicio: "13:00", fin: "09:00" } } })]))
  ok(!!r.e, "0146: un turno con el fin antes del inicio se rechaza")
  r = await como(rosa.id, () => c.query("select guardar_horario_persona($1, true, null)", [rosa.id]))
  ok(!!r.e && /administrador/.test(r.e), "0146: quien no es administrador no asigna horarios: " + r.e)
  r = await como(paula.id, () => c.query("update horarios_usuario set usa_horario_optica = true where usuario_id = $1", [paula.id]))
  ok(!!r.e, "0146: la persona ya no puede escribir su propio horario: " + r.e)
  r = await como(paula.id, async () => (await q("select usa_horario_optica from horarios_usuario")).length)
  ok(r.r === 1, "0146: cada persona lee solo su fila")
  r = await como(admin.id, async () => (await q("select usa_horario_optica from horarios_usuario")).length)
  ok(r.r >= 1, "0146: el administrador lee las de su óptica")
  if (ajeno) { r = await como(ajeno, () => c.query("select guardar_horario_persona($1, true, null)", [paula.id])); ok(!!r.e, "0146: el administrador de otra óptica no asigna horarios aquí: " + r.e) }

  // ── ausencias
  const lunesProximo = (() => { let d = sumarDias(hoy, 14); while (new Date(`${d}T12:00:00`).getDay() !== 1) d = sumarDias(d, 1); return d })()
  const solicitar = (uid, args) => como(uid, async () => (await q("select solicitar_ausencia($1,$2,$3,$4,$5,$6,$7) id", args))[0].id, { guardar: true })
  r = await solicitar(paula.id, ["cita_medica", lunesProximo, lunesProximo, "todo", "Control", null, null])
  const aus1 = r.r
  ok(!!aus1, "0146: cualquier persona del personal solicita una ausencia" + (r.e ? " — " + r.e : ""))
  r = await solicitar(paula.id, ["otro", lunesProximo, lunesProximo, "manana", null, null, null])
  ok(!!r.e && /Ya tienes una ausencia/.test(r.e), "0146: no se superponen dos ausencias de la misma persona: " + r.e)
  r = await solicitar(paula.id, ["otro", sumarDias(hoy, -1), sumarDias(hoy, -1), "todo", null, null, null])
  ok(!!r.e && /ya pasó/.test(r.e), "0146: no se pide una ausencia en un día que ya pasó")
  r = await solicitar(paula.id, ["otro", sumarDias(lunesProximo, 20), sumarDias(lunesProximo, 22), "manana", null, null, null])
  ok(!!r.e && /un solo día/.test(r.e), "0146: la mañana o la tarde se piden para un solo día")
  r = await solicitar(paula.id, ["viaje", sumarDias(lunesProximo, 20), sumarDias(lunesProximo, 20), "todo", null, null, null])
  ok(!!r.e && /tipo/.test(r.e), "0146: un tipo que no existe se rechaza")
  const ruta = `${optica}/${paula.id}/ensayo-certificado.pdf`
  await q("insert into storage.objects (bucket_id, name, metadata) values ('ausencias-documentos', $1, '{\"size\": 2048, \"mimetype\": \"application/pdf\"}'::jsonb)", [ruta])
  await q("insert into storage.objects (bucket_id, name, metadata) values ('ausencias-documentos', $1, '{\"size\": 6000000, \"mimetype\": \"application/pdf\"}'::jsonb)", [`${optica}/${paula.id}/grande.pdf`])
  await q("insert into storage.objects (bucket_id, name, metadata) values ('ausencias-documentos', $1, '{\"size\": 2048, \"mimetype\": \"application/msword\"}'::jsonb)", [`${optica}/${paula.id}/word.doc`])
  r = await solicitar(paula.id, ["cita_medica", sumarDias(lunesProximo, 7), sumarDias(lunesProximo, 7), "tarde", null, ruta, "certificado.pdf"])
  const aus2 = r.r
  ok(!!aus2, "0146: la solicitud con documento de respaldo (PDF) se acepta" + (r.e ? " — " + r.e : ""))
  r = await solicitar(paula.id, ["cita_medica", sumarDias(lunesProximo, 8), sumarDias(lunesProximo, 8), "todo", null, `${optica}/${paula.id}/grande.pdf`, "grande.pdf"])
  ok(!!r.e && /5 MB/.test(r.e), "0146: un documento de más de 5 MB se rechaza")
  r = await solicitar(paula.id, ["cita_medica", sumarDias(lunesProximo, 8), sumarDias(lunesProximo, 8), "todo", null, `${optica}/${paula.id}/word.doc`, "word.doc"])
  ok(!!r.e && /PDF o una foto/.test(r.e), "0146: un documento que no es PDF ni foto se rechaza")
  r = await solicitar(paula.id, ["cita_medica", sumarDias(lunesProximo, 8), sumarDias(lunesProximo, 8), "todo", null, `${optica}/${rosa.id}/de-otra-persona.pdf`, "x.pdf"])
  ok(!!r.e && /lugar correcto/.test(r.e), "0146: no se adjunta un archivo de la carpeta de otra persona")
  r = await solicitar(paula.id, ["cita_medica", sumarDias(lunesProximo, 8), sumarDias(lunesProximo, 8), "todo", null, `${optica}/${paula.id}/no-existe.pdf`, "x.pdf"])
  ok(!!r.e && /no se subió/.test(r.e), "0146: un archivo que no se subió se rechaza")

  // quién lee las filas
  r = await como(paula.id, async () => (await q("select id from ausencias_personal")).length)
  ok(r.r === 2, "0146: la persona lee sus ausencias")
  r = await como(rosa.id, async () => (await q("select id from ausencias_personal")).length)
  ok(r.r === 0, "0146: otro empleado no ve las ausencias de los demás")
  r = await como(admin.id, async () => (await q("select id from ausencias_personal")).length)
  ok(r.r === 2, "0146: el administrador de la óptica las ve")
  if (ajeno) { r = await como(ajeno, async () => (await q("select id from ausencias_personal")).length); ok(r.r === 0, "0146: el administrador de otra óptica no las ve") }
  const superadmin = (await q("select id from perfiles where rol = 'superadmin' limit 1"))[0]?.id
  if (superadmin) { r = await como(superadmin, async () => (await q("select id from ausencias_personal")).length); ok(r.r === 0, "0146: el superadmin no las ve (no hay política para él)") }
  ok((await q("select has_table_privilege('authenticated','public.ausencias_personal','insert') i, has_table_privilege('authenticated','public.ausencias_personal','update') u"))[0].i === false, "0146: nadie escribe la tabla directamente (solo las funciones)")

  // el documento: quién lo lee
  const leerObjeto = (uid) => como(uid, async () => (await q("select name from storage.objects where bucket_id = 'ausencias-documentos' and name = $1", [ruta])).length)
  ok((await leerObjeto(paula.id)).r === 1, "0146: la persona lee su documento")
  ok((await leerObjeto(admin.id)).r === 1, "0146: el administrador de la óptica lee el documento")
  ok((await leerObjeto(rosa.id)).r === 0, "0146: otro empleado NO lee el documento")
  if (ajeno) ok((await leerObjeto(ajeno)).r === 0, "0146: el administrador de otra óptica NO lo lee")
  if (superadmin) ok((await leerObjeto(superadmin)).r === 0, "0146: el superadmin NO lo lee")
  r = await como(paula.id, () => c.query("insert into storage.objects (bucket_id, name, owner) values ('ausencias-documentos', $1, $2)", [`${optica}/${paula.id}/subida-propia.pdf`, paula.id]))
  ok(!r.e, "0146: la persona sube un documento a su carpeta" + (r.e ? " — " + r.e : ""))
  r = await como(paula.id, () => c.query("insert into storage.objects (bucket_id, name, owner) values ('ausencias-documentos', $1, $2)", [`${optica}/${rosa.id}/en-la-carpeta-de-otra.pdf`, paula.id]))
  ok(!!r.e, "0146: no sube a la carpeta de otra persona: " + r.e)
  const bucket = (await q("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'ausencias-documentos'"))[0]
  ok(bucket && bucket.public === false && Number(bucket.file_size_limit) === 5242880, "0146: el almacenamiento es privado y limitado a 5 MB")

  // aprobar y rechazar
  r = await como(rosa.id, () => c.query("select resolver_ausencia($1, true)", [aus1]))
  ok(!!r.e && /administrador/.test(r.e), "0146: solo el administrador responde: " + r.e)
  r = await como(admin.id, () => c.query("select resolver_ausencia($1, false, 'no')", [aus2]))
  ok(!!r.e && /motivo del rechazo/.test(r.e), "0146: rechazar pide el motivo")
  r = await como(admin.id, async () => { await c.query("select resolver_ausencia($1, true)", [aus1]); return (await q("select estado from ausencias_personal where id = $1", [aus1]))[0].estado }, { guardar: true })
  ok(r.r === "aprobada", "0146: el administrador aprueba" + (r.e ? " — " + r.e : ""))
  r = await como(admin.id, () => c.query("select resolver_ausencia($1, false, 'Ese día falta personal')", [aus1]))
  ok(!!r.e && /ya fue respondida/.test(r.e), "0146: una ausencia respondida no se vuelve a responder")
  r = await como(admin.id, async () => { await c.query("select resolver_ausencia($1, false, 'Ese día falta personal')", [aus2]); return (await q("select estado, motivo_rechazo from ausencias_personal where id = $1", [aus2]))[0] }, { guardar: true })
  ok(r.r?.estado === "rechazada" && r.r.motivo_rechazo === "Ese día falta personal", "0146: rechaza con su motivo")
  r = await como(paula.id, async () => (await q("select titulo, cuerpo from avisos_internos order by creado_en desc")).map((x) => x.titulo))
  ok(r.r?.includes("Tu ausencia fue aprobada") && r.r?.includes("Tu ausencia fue rechazada"), "0146: la persona recibe el aviso de cada respuesta (campanita y Soporte → Avisos)" + (r.e ? " — " + r.e : ""))
  r = await como(rosa.id, async () => (await q("select titulo from avisos_internos where titulo like 'Tu ausencia%'")).length)
  ok(r.r === 0, "0146: ese aviso no lo ve otra persona")

  // la agenda de los profesionales y la web
  const agenda = (uid) => como(uid, async () => (await q("select agenda_profesionales($1) a", [optica]))[0].a)
  r = await agenda(rosa.id)
  const pa = r.r?.find((x) => x.id === paula.id)
  ok(r.r?.length === 1 && !!pa && !r.r.some((x) => x.id === rosa.id), "0146: la agenda trae solo a quienes atienden pacientes")
  ok(pa?.usaOptica === false && pa.horario?.lunes?.manana?.activo === true && pa.ausencias.length === 1 && pa.ausencias[0].desde === lunesProximo && pa.ausencias[0].franja === "todo", "0146: con su horario propio y sus ausencias APROBADAS (la rechazada no)")
  ok(Object.keys(pa.ausencias[0]).sort().join() === "desde,franja,hasta" && !JSON.stringify(r.r).includes("Control") && !JSON.stringify(r.r).includes("certificado"), "0146: de la ausencia solo van las fechas y la franja (ni motivo, ni tipo, ni documento)")
  ok(!!(await q("select has_function_privilege('anon','public.agenda_profesionales(uuid)','execute') a"))[0].a, "0146: la web (anon) puede pedirla")
  const validar = async (fecha, hora) => { await c.query("savepoint vv"); try { await c.query("select validar_horario_reserva_web($1, $2::date, $3)", [optica, fecha, hora]); await c.query("release savepoint vv"); return null } catch (e) { await c.query("rollback to savepoint vv"); return e.message } }
  await c.query("savepoint v")
  ok((await validar(sumarDias(lunesProximo, 7), "10:00 AM")) === null, "0146 · web: una hora dentro del horario de la profesional se ofrece (lunes de otra semana, mañana)")
  ok(/no está disponible/.test((await validar(sumarDias(lunesProximo, 7), "03:00 PM")) || ""), "0146 · web: la tarde del lunes (que no trabaja) ya no se ofrece")
  ok(/no está disponible/.test((await validar(sumarDias(lunesProximo, 8), "10:00 AM")) || ""), "0146 · web: el martes (que no trabaja) ya no se ofrece")
  ok(/no está disponible/.test((await validar(lunesProximo, "10:00 AM")) || ""), "0146 · web: el día de su ausencia aprobada no se ofrece")
  await q("update perfiles set es_optometra = true where id = $1", [rosa.id])
  ok((await validar(lunesProximo, "10:00 AM")) === null, "0146 · web: con otra profesional que sí atiende, la hora se sigue ofreciendo")
  await q("update perfiles set es_optometra = false where id in ($1, $2)", [rosa.id, paula.id])
  ok((await validar(sumarDias(lunesProximo, 8), "10:00 AM")) === null, "0146 · web: sin profesionales marcados la óptica atiende como siempre (su horario)")
  await q("update perfiles set es_optometra = true where id = $1", [paula.id])
  ok(/fuera del horario de atención/.test((await validar(sumarDias(lunesProximo, 7), "07:00 AM")) || ""), "0146 · web: lo de antes sigue: fuera del horario de la óptica se rechaza")
  await c.query("rollback to savepoint v")
  // «usar el horario de la óptica» y retirar
  r = await como(admin.id, async () => { await c.query("select guardar_horario_persona($1, true, null)", [paula.id]); return (await q("select usa_horario_optica u, horario_semanal h from horarios_usuario where usuario_id = $1", [paula.id]))[0] })
  ok(r.r?.u === true && JSON.stringify(r.r.h) === "{}", "0146: «Usar el horario de la óptica» deja a la persona sin horario propio")
  r = await como(paula.id, () => c.query("select retirar_ausencia($1)", [aus1]))
  ok(!!r.e, "0146: la persona no retira una ausencia ya aprobada: " + r.e)
  r = await como(admin.id, async () => { await c.query("select retirar_ausencia($1)", [aus1]); return (await q("select estado from ausencias_personal where id = $1", [aus1]))[0].estado })
  ok(r.r === "cancelada", "0146: el administrador retira una aprobada y ese tiempo vuelve a la agenda")
  const aus3 = (await solicitar(paula.id, ["otro", sumarDias(lunesProximo, 40), sumarDias(lunesProximo, 40), "todo", null, null, null])).r
  r = await como(paula.id, async () => { await c.query("select retirar_ausencia($1)", [aus3]); return (await q("select estado from ausencias_personal where id = $1", [aus3]))[0].estado })
  ok(r.r === "cancelada", "0146: la persona retira su solicitud mientras está pendiente")

  // ═════════ Usuario desactivado ═════════
  await q("insert into citas_base (optica_id, paciente, fecha, hora, estado, asignado_a) values ($1, 'ENSAYO historial', '2099-03-01', '09:00 AM', 'Atendida', $2)", [optica, rosa.id])
  r = await como(admin.id, async () => {
    await c.query("select desactivar_usuario($1, 'ensayo')", [rosa.id])
    return { equipo: (await q("select nombre, activo from equipo_optica() where id = $1", [rosa.id]))[0], cita: (await q("select asignado_a from citas where paciente = 'ENSAYO historial'"))[0]?.asignado_a }
  }, { guardar: true })
  ok(r.r?.equipo?.activo === false && r.r.equipo.nombre === rosa.nombre && r.r.cita === rosa.id, "Desactivar: su nombre sigue en el equipo (como inactivo) y lo que hizo sigue a su nombre")
  r = await como(rosa.id, async () => ({ activo: (await q("select perfil_activo_actual() a"))[0].a, citas: (await q("select id from citas")).length, pacientes: (await q("select id from pacientes")).length, aus: (await q("select id from ausencias_personal")).length }))
  ok(r.r && r.r.activo === false && r.r.citas === 0 && r.r.pacientes === 0 && r.r.aus === 0, "Desactivar: la persona desactivada no ve datos de la óptica (no puede ingresar)")
  r = await como(rosa.id, () => c.query("select solicitar_ausencia('otro', $1, $1, 'todo', null, null, null)", [sumarDias(lunesProximo, 60)]))
  ok(!!r.e, "Desactivar: tampoco puede pedir ausencias: " + r.e)
  r = await como(admin.id, async () => { await c.query("select reactivar_usuario($1)", [rosa.id]); return (await q("select activo from equipo_optica() where id = $1", [rosa.id]))[0].activo })
  ok(r.r === true, "Desactivar: se puede reactivar")
  ok((await q("select count(*)::int n from pg_proc where proname = 'eliminar_usuario'"))[0].n === 0, "No existe una función para eliminar usuarios (se conserva quién hizo cada cosa)")
} catch (e) {
  console.error("ERROR", e.message)
  fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
