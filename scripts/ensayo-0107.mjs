// Ensayo de la migración 0107 (el portal recibe solo lo permitido): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0107.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0107_portal_receta_solo_lo_permitido.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
// Ejecuta fn como la API (rol anon) y deshace lo que haga.
const comoAnon = async (fn) => {
  await c.query("savepoint r")
  try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); await c.query("rollback to savepoint r"); return { r } }
  catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
const rpc = (fn, ...args) => comoAnon(() => c.query(`select * from ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")})`, args).then((r) => r.rows))

const PROHIBIDAS_CONSULTA = ["optica_id", "motivo", "antecedentes", "alergias", "antecedentes_familiares", "detalle_consulta", "diagnostico_categorias",
  "proximo_control_dias", "evolucion_calculada", "estado_correccion", "producto_id", "producto_nombre", "monto_venta", "profesional_id", "cita_id"]
const ID_PERSONAL = "00000000-0000-0000-0000-000000000001"

try {
  await c.query("begin")
  const [op] = await q("select id from opticas where slug = 'v8twzq'")
  const OP = op.id
  const poner = (v) => c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || $2::jsonb where id = $1", [OP, JSON.stringify({ mostrarMedidasPaciente: v })])

  // ── Datos: dos pacientes de prueba (A con consulta y cita, B aparte), cada uno con su token
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  const clonar = async (cedula, token) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
    await c.query("update t_p set id = gen_random_uuid(), cedula = $1, usuario = null, clave_temporal = null, sesion_token = $2, sesion_token_creado_en = now()", [cedula, token])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const A = await clonar("0900000011", "tok-A")
  const B = await clonar("0900000012", "tok-B")
  const dc = {
    od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avSc: "20/40", avCc: "20/20" },
    oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avSc: "20/50", avCc: "20/25" },
    medidas: { adicion: "+1.00", dp: "62", alt: "18", avCerca: "20/20" },
    examen: { pioOd: "15", oftalmoscopia: "normal" },
    retinoscopia: { od: "x" },
    control_agenda: "despues", control_asignado_a: ID_PERSONAL, lente_producto_id: "zzz",
  }
  await c.query(
    `insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, antecedentes, alergias, antecedentes_familiares, datos_clinicos,
       diagnostico, lente_recomendado, indicaciones, proximo_control_dias, evolucion_calculada, estado_correccion, producto_nombre, monto_venta,
       profesional_nombre, profesional_registro, detalle_consulta, imagenes)
     values ($1, $2, 'Paciente A', current_date, 'Control', true, 'Diabetes tipo 2', 'Penicilina', 'Madre con glaucoma', $3::jsonb,
       'Miopía', 'Monofocal', 'Uso permanente', 180, 'Estable', 'Bien corregido', 'Lente X', 123.45,
       'Dra. Prueba', 'REG-1', 'Detalle interno', '[{"path":"a/b.png"}]'::jsonb)`,
    [OP, A, JSON.stringify(dc)],
  )
  const [staff] = await q("select id from perfiles where optica_id = $1 limit 1", [OP])
  await c.query("drop table if exists t_c")
  await c.query("create temp table t_c as select * from citas_base where optica_id = $1 limit 1", [OP])
  await c.query(`update t_c set id = gen_random_uuid(), paciente_id = $1, codigo = null, fecha = date '2031-01-05', asignado_a = $2, atendido_por = $2, asignado_original = $2,
                   origen = 'paciente', recordatorio_enviado_at = now()`, [A, staff?.id || null])
  const idCita = (await q("insert into citas_base select * from t_c returning id"))[0].id
  await c.query(`update citas set triage = '{"dolor":true}'::jsonb where id = $1`, [idCita])

  // ── 0. Estado ANTES de la migración (constancia de lo que se corrige)
  const antes = await rpc("mis_consultas_paciente", A, "tok-A")
  ok(antes.r?.length === 1 && antes.r[0].antecedentes === "Diabetes tipo 2" && !!antes.r[0].datos_clinicos?.examen, "ANTES: la función entregaba antecedentes y examen al navegador (el defecto)")
  const nombres = ["mis_consultas_paciente", "mis_citas_paciente", "exportar_mis_datos_paciente"]
  const aclAntes = JSON.stringify(await q("select proname, proacl::text from pg_proc where proname = any($1) and pronamespace = 'public'::regnamespace order by proname", [nombres]))
  const colsVista = (await q("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'consultas' order by ordinal_position")).map((r) => r.column_name)

  // ── 1. Un anónimo no puede leer las tablas directamente
  for (const t of ["consultas", "consultas_base", "pacientes", "pacientes_base", "citas", "citas_base"]) {
    const r = await comoAnon(() => c.query(`select * from ${t} limit 1`))
    ok(!!r.e && /permission denied/i.test(r.e), `anon no puede leer ${t}: ${(r.e || "SIN ERROR").slice(0, 50)}`)
  }

  // ── 2. Aplicar la migración
  await c.query(sql)
  ok(true, "la migración se aplica sin errores")
  ok((await q("select count(*)::int n from pg_proc where proname = any($1) and pronamespace = 'public'::regnamespace", [nombres]))[0].n === 3, "sin sobrecargas: una sola versión de cada función pública")
  ok(JSON.stringify(await q("select proname, proacl::text from pg_proc where proname = any($1) and pronamespace = 'public'::regnamespace order by proname", [nombres])) === aclAntes, "los permisos de las tres funciones quedan iguales")
  ok((await q("select pg_get_function_result(oid) r from pg_proc where proname = 'mis_consultas_paciente'"))[0].r === "SETOF consultas", "mis_consultas_paciente sigue devolviendo setof consultas (compatible)")
  ok((await q("select pg_get_function_result(oid) r from pg_proc where proname = 'mis_citas_paciente'"))[0].r === "SETOF citas", "mis_citas_paciente sigue devolviendo setof citas (compatible)")
  for (const [fn, args] of [["portal_muestra_montaje", "gen_random_uuid()"], ["consulta_para_paciente", "'{}'::jsonb, true, true"]]) {
    const r = await comoAnon(() => c.query(`select ${fn}(${args})`))
    ok(!!r.e, `la función de apoyo ${fn} no se puede llamar desde la API: ${(r.e || "").slice(0, 45)}`)
  }

  // ── 3. Portal, política apagada
  await poner(false)
  const p = await rpc("mis_consultas_paciente", A, "tok-A")
  ok(!p.e && p.r.length === 1, "el paciente A recibe su consulta" + (p.e ? " — " + p.e : ""))
  const f = p.r?.[0] || {}
  ok(Object.keys(f).join() === colsVista.join(), "la respuesta tiene exactamente las mismas columnas que antes (forma compatible)")
  for (const k of PROHIBIDAS_CONSULTA) ok(f[k] == null, `portal: ${k} llega vacío`)
  ok(f.imagenes == null || JSON.stringify(f.imagenes) === "[]", "portal: imagenes llega vacío")
  ok(f.diagnostico === "Miopía" && f.lente_recomendado === "Monofocal" && f.indicaciones === "Uso permanente" && f.profesional_nombre === "Dra. Prueba" && f.profesional_registro === "REG-1" && f.usa_lentes === true, "portal: diagnóstico, lente, indicaciones, profesional y usa_lentes intactos")
  const d = f.datos_clinicos || {}
  ok(Object.keys(d).sort().join() === "medidas,od,oi", "portal: datos_clinicos solo trae od, oi y medidas: " + Object.keys(d).join())
  ok(d.od?.esfera === "-1.50" && d.od?.cilindro === "-0.50" && d.od?.eje === "90" && d.od?.avSc === "20/40" && d.od?.avCc === "20/20" && d.oi?.esfera === "-1.25", "portal: esfera, cilindro, eje y agudeza visual de cada ojo")
  ok(d.medidas?.adicion === "+1.00" && d.medidas?.avCerca === "20/20", "portal: la adición y la agudeza de cerca siempre llegan")
  ok(!("dp" in (d.medidas || {})) && !("alt" in (d.medidas || {})), "política APAGADA: no llegan la distancia pupilar ni la altura")
  const txt = JSON.stringify(f)
  ok(!txt.includes(ID_PERSONAL) && !txt.includes("Penicilina") && !txt.includes("123.45") && !txt.includes("Detalle interno"), "portal: ni ids del personal, ni alergias, ni montos, ni detalle en ninguna parte de la respuesta")

  // ── 4. Portal, política encendida
  await poner(true)
  const on = (await rpc("mis_consultas_paciente", A, "tok-A")).r[0]
  ok(on.datos_clinicos.medidas.dp === "62" && on.datos_clinicos.medidas.alt === "18", "política ENCENDIDA: llegan la distancia pupilar y la altura")
  ok(on.alergias == null && on.datos_clinicos.examen === undefined, "política encendida: lo demás sigue sin llegar")
  await poner(false)

  // ── 5. Un paciente no puede leer los datos de otro
  for (const [quien, args] of [["token de B sobre A", [A, "tok-B"]], ["token inventado", [A, "xxxx"]], ["sin token", [A, null]]]) {
    const r = await rpc("mis_consultas_paciente", ...args)
    ok(!r.e && r.r.length === 0, `mis_consultas_paciente: ${quien} no devuelve nada`)
    const r2 = await rpc("mis_citas_paciente", ...args)
    ok(!r2.e && r2.r.length === 0, `mis_citas_paciente: ${quien} no devuelve nada`)
    const r3 = await rpc("exportar_mis_datos_paciente", ...args)
    ok(!r3.e && r3.r[0].exportar_mis_datos_paciente === null, `exportar_mis_datos_paciente: ${quien} devuelve null`)
  }
  ok((await rpc("mis_consultas_paciente", B, "tok-B")).r.length === 0, "B recibe solo lo suyo (no tiene consultas)")

  // ── 6. Citas
  const ci = (await rpc("mis_citas_paciente", A, "tok-A")).r
  ok(ci.length === 1 && ci[0].asignado_a == null && ci[0].atendido_por == null && ci[0].asignado_original == null && ci[0].triage == null && ci[0].origen == null && ci[0].recordatorio_enviado_at == null, "citas: sin ids del personal ni campos de control")
  ok(!!ci[0].fecha && !!ci[0].hora && !!ci[0].estado && !!ci[0].paciente_id, "citas: fecha, hora, estado y paciente intactos")

  // ── 7. Descargar mis datos
  const ex = (await rpc("exportar_mis_datos_paciente", A, "tok-A")).r[0].exportar_mis_datos_paciente
  ok(Object.keys(ex).sort().join() === "citas,consultas,exportado_en,perfil", "exportación: misma forma de respuesta (perfil, citas, consultas, exportado_en)")
  const exTxt = JSON.stringify(ex)
  for (const k of ["clave_temporal", "sesion_token", "intentos_fallidos", "bloqueado_hasta", "optica_id", "referido_por_id", "confirmado_recepcion", "medidas_solicitadas_en",
    "asignado_a", "atendido_por", "asignado_original", "recordatorio_enviado_at", "monto_venta", "producto_id", "producto_nombre", "profesional_id", "cita_id",
    "control_agenda", "control_asignado_a", "lente_producto_id", "origen"]) {
    ok(!exTxt.includes('"' + k + '"'), `exportación: no trae ${k}`)
  }
  ok(!exTxt.includes("123.45") && !exTxt.includes("tok-A") && !exTxt.includes(ID_PERSONAL), "exportación: ni montos, ni el token, ni ids del personal")
  const e1 = ex.consultas[0]
  ok(e1.antecedentes === "Diabetes tipo 2" && e1.alergias === "Penicilina" && e1.antecedentes_familiares === "Madre con glaucoma", "exportación: incluye antecedentes y alergias")
  ok(e1.datos_clinicos.examen?.pioOd === "15" && !!e1.datos_clinicos.retinoscopia && e1.datos_clinicos.od?.esfera === "-1.50", "exportación: incluye el examen clínico y la receta")
  ok(!("dp" in e1.datos_clinicos.medidas) && !("alt" in e1.datos_clinicos.medidas) && e1.datos_clinicos.medidas.adicion === "+1.00", "exportación con política APAGADA: sin distancia pupilar ni altura")
  await poner(true)
  const exOn = (await rpc("exportar_mis_datos_paciente", A, "tok-A")).r[0].exportar_mis_datos_paciente
  ok(exOn.consultas[0].datos_clinicos.medidas.dp === "62", "exportación con política ENCENDIDA: incluye la distancia pupilar")
  ok(ex.perfil.cedula === "0900000011" && ex.citas.length === 1 && ex.citas[0].triage?.dolor === true, "exportación: perfil propio y triaje propio incluidos")
  void B
} catch (e) {
  console.error("✘ ERROR:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien. La transacción se revirtió: no quedó nada.")
  process.exit(fallos ? 1 : 0)
}
