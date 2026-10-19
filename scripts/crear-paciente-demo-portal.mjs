// Crea en la Óptica Demo el paciente de demostración PERMANENTE «Paciente Demostración Portal»: cuenta de portal y un historial completo y realista (una cita próxima
// confirmada, cuatro pasadas, tres recetas con cambios de graduación, dos compras —una con lentes en el laboratorio y saldo, otra pagada y entregada con su factura
// electrónica— y un próximo control). No se borra nunca: sirve para revisar el portal y para presentarlo. La limpieza de la óptica de pruebas no toca la Demo.
//
// Este script ES la excepción a «la Demo es de solo lectura» (regla 40): solo él la escribe, y solo para crear a este paciente. Se niega a correr si el paciente ya existe.
// Las pruebas de Playwright siguen en solo lectura (e2e/guardia-demo.js).
//
//   node --env-file=.env.local --env-file=.env.test scripts/crear-paciente-demo-portal.mjs --ensayo   (todo dentro de una transacción que se revierte)
//   node --env-file=.env.local --env-file=.env.test scripts/crear-paciente-demo-portal.mjs            (lo crea; guarda DEMO_PORTAL_CEDULA y DEMO_PORTAL_CLAVE en .env.test)
import pg from "pg"
import fs from "node:fs"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const ENSAYO = process.argv.includes("--ensayo")
const NOMBRE = "Paciente Demostración Portal"
const c = new pg.Client()
await c.connect()
const q = async (t, p) => (await c.query(t, p)).rows
const ok = (m) => console.log("✔ " + m)

// Cédula ecuatoriana válida (provincia 09, tercer dígito < 6, dígito verificador módulo 10) que no use nadie en la óptica.
const cedulaValida = (base9) => {
  let suma = 0
  for (let i = 0; i < 9; i++) { let d = Number(base9[i]) * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; suma += d }
  return base9 + ((10 - (suma % 10)) % 10)
}

try {
  const OP = (await q("select id from opticas where slug = 'qu7u2j'"))[0].id
  if ((await q("select 1 from pacientes_base where optica_id = $1 and nombre = $2", [OP, NOMBRE])).length) throw new Error("El paciente de demostración ya existe: no se vuelve a crear ni se borra.")
  const optometra = (await q("select id, nombre from perfiles where optica_id = $1 and es_optometra and rol = 'asistente' order by nombre limit 1", [OP]))[0]
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
  const logsAntes = (await q("select count(*)::int n from logs_optica where optica_id = $1", [OP]))[0].n

  await c.query("begin")
  const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date::text d"))[0].d
  const dia = async (dias) => (await q("select ($1::date + $2::int)::text d", [hoy, dias]))[0].d
  const clave = "Demo-" + crypto.randomBytes(5).toString("hex")
  let cedula = ""
  for (let n = 0; n < 50; n++) {
    const probable = cedulaValida("09" + String(Math.floor(Math.random() * 6)) + String(Math.floor(Math.random() * 1e6)).padStart(6, "0"))
    if (!(await q("select 1 from pacientes_base where cedula = $1", [probable])).length) { cedula = probable; break }
  }

  // ── Paciente con cuenta de portal (clon de un paciente de la Demo, con todo lo clínico y personal reemplazado)
  const base = (await q("select id from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP]))[0].id
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base])
  await c.query(
    `update t_p set id = gen_random_uuid(), nombre = $1, cedula = $2, usuario = null, fecha_nacimiento = date '1954-03-12', fecha_registro = $3::date, telefono = '0987654321',
       correo = 'paciente.demostracion@example.com', clave_temporal = extensions.crypt($4, extensions.gen_salt('bf')), tiene_cuenta = true, sesion_token = null, intentos_fallidos = 0,
       bloqueado_hasta = null, ultima_consulta = null, estado_clinico_enc = null, evolucion_enc = null, estado_correccion_enc = null, referido_por = null, referido_por_id = null,
       origen = 'staff', confirmado_recepcion = true, medidas_solicitadas_en = null, acepta_recordatorios = true, acepta_promociones = false`,
    [NOMBRE, cedula, await dia(-540), clave],
  )
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  ok(`paciente creado (cédula ${cedula.slice(0, 2)}…)`)

  // ── Citas: tres atendidas (una por receta), una que no asistió y la próxima, confirmada
  const hora = ["10:20 AM", "03:00 PM", "11:40 AM"]
  const fechas = [await dia(-540), await dia(-330), await dia(-180)]
  const citaId = []
  for (let i = 0; i < 3; i++) {
    citaId.push((await q(
      `insert into citas_base (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, atendido_por, asignado_a, confirmada_at)
       values ($1, $2, $3, $4, '0987654321', $5::date, $6, $7, 'Atendida', $8, $9, $9, $5::date) returning id`,
      [OP, P, NOMBRE, cedula, fechas[i], hora[i], i === 0 ? "Consulta General" : "Examen de Control", i === 1 ? "paciente" : "staff", optometra.id],
    ))[0].id)
  }
  await c.query(`insert into citas_base (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, asignado_a) values ($1, $2, $3, $4, '0987654321', $5::date, '09:00 AM', 'Examen de Control', 'No Asistió', 'staff', $6)`, [OP, P, NOMBRE, cedula, await dia(-100), optometra.id])
  let proxima = await dia(4)
  if ((await q("select extract(dow from $1::date)::int d", [proxima]))[0].d === 0) proxima = await dia(5)
  let horaProxima = "10:40 AM"
  for (const h of ["10:40 AM", "04:40 PM", "05:20 PM", "02:40 PM"]) {
    if (!(await q("select 1 from citas_base where optica_id = $1 and fecha = $2::date and hora = $3 and estado not in ('Cancelada', 'No Asistió')", [OP, proxima, h])).length) { horaProxima = h; break }
  }
  await c.query(`insert into citas_base (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, asignado_a, confirmada_at) values ($1, $2, $3, $4, '0987654321', $5::date, $6, 'Examen de Control', 'Pendiente', 'paciente', $7, now())`, [OP, P, NOMBRE, cedula, proxima, horaProxima, optometra.id])
  ok(`citas: próxima el ${proxima} a las ${horaProxima} (confirmada) y 4 pasadas`)

  // ── Tres recetas con cambios de graduación (la última lleva adición y las indicaciones del optómetra)
  const rec = [
    { f: fechas[0], cita: citaId[0], dx: "Miopía leve", lente: "Monofocal", ind: "Usa tus lentes para ver de lejos. Control en 6 meses.", dias: 180, od: ["-1.00", "-0.25", "90", "20/20"], oi: ["-0.75", "-0.25", "85", "20/20"], med: {} },
    { f: fechas[1], cita: citaId[1], dx: "Miopía y astigmatismo", lente: "Monofocal con antirreflejo", ind: "Usa tus lentes todo el día. Control en 6 meses.", dias: 180, od: ["-1.25", "-0.50", "90", "20/20"], oi: ["-1.00", "-0.50", "85", "20/20"], med: {} },
    { f: fechas[2], cita: citaId[2], dx: "Miopía y astigmatismo, presbicia incipiente", lente: "Progresivo con filtro azul", ind: "Haz una pausa cada 20 minutos frente a pantallas: mira algo lejano durante 20 segundos. Usa tus lentes todo el día. Control en 8 meses.", dias: 240, od: ["-1.75", "-0.50", "90", "20/20"], oi: ["-1.25", "-0.75", "80", "20/25"], med: { adicion: "+1.00", dp: "62", alt: "18" } },
  ]
  const consultaId = []
  for (const r of rec) {
    const dc = { od: { esfera: r.od[0], cilindro: r.od[1], eje: r.od[2], avCc: r.od[3] }, oi: { esfera: r.oi[0], cilindro: r.oi[1], eje: r.oi[2], avCc: r.oi[3] }, medidas: r.med }
    await c.query(
      `insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, diagnostico, lente_recomendado, indicaciones, proximo_control_dias, profesional_nombre, profesional_registro, profesional_id, cita_id, datos_clinicos)
       values ($1, $2, $3, $4::date, 'Examen de Control', true, $5, $6, $7, $8, $9, 'REG-DEMO-01', $10, $11, $12::jsonb)`,
      [OP, P, NOMBRE, r.f, r.dx, r.lente, r.ind, r.dias, optometra.nombre, optometra.id, r.cita, JSON.stringify(dc)],
    )
    consultaId.push((await q("select id from consultas_base where paciente_id = $1 and fecha = $2::date", [P, r.f]))[0].id)
  }
  ok("3 recetas (graduación de -1.00 a -1.75) con indicaciones")

  // ── Compras. 1: lentes progresivos en el laboratorio, con saldo. 2: lentes monofocales pagados y entregados, con factura electrónica.
  const numero = async (tabla) => (await q(`insert into ${tabla} (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = ${tabla}.ultimo_numero + 1 returning ultimo_numero n`, [OP]))[0].n
  const factura = async ({ cuando, total, estado, metodo, lineas, consulta, cita }) => {
    const f = (await q(
      `insert into facturas_venta (optica_id, paciente_id, cita_id, consulta_id, metodo_pago, monto_total, estado, registrado_por, numero, created_at, pagos)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, ($10::date + time '11:00') at time zone 'America/Guayaquil', $11::jsonb) returning id, numero`,
      [OP, P, cita, consulta, metodo, total, estado, admin, await numero("contador_comprobantes_venta"), cuando, metodo === "directo" ? JSON.stringify([{ metodo: "tarjeta", monto: total }]) : null],
    ))[0]
    for (const [tipo, descripcion, precio] of lineas) await c.query("insert into facturas_venta_lineas (factura_id, tipo, descripcion, cantidad, precio_unitario, subtotal) values ($1, $2, $3, 1, $4, $4)", [f.id, tipo, descripcion, precio])
    return f
  }
  const orden = async ({ fac, consulta, cita, tipo, montura, prometida, estado, historial }) => {
    const o = (await q(
      `insert into ordenes_laboratorio (optica_id, numero, factura_id, consulta_id, paciente_id, cita_id, tipo_lente, material, antirreflejo, filtro_azul, montura, laboratorio, fecha_prometida, estado, creada_por, creada_en)
       values ($1, $2, $3, $4, $5, $6, $7, 'Policarbonato', true, $8, $9, 'Laboratorio Visión', $10::date, $11, $12, $13::timestamptz) returning id`,
      [OP, await numero("contador_ordenes_laboratorio"), fac, consulta, P, cita, tipo, tipo === "progresivo", montura, prometida, estado, admin, historial[0][1]],
    ))[0].id
    for (const [e, cuando] of historial) await c.query("insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, cambiado_en) values ($1, $2, $3, $4::timestamptz)", [o, e, admin, cuando])
    return o
  }
  const f1 = await factura({ cuando: await dia(-9), total: 265, estado: "pendiente_pago", metodo: "abonos", consulta: consultaId[2], cita: citaId[2], lineas: [["producto", "Montura Ray-Ban Aviator", 85], ["luna", "Lunas progresivas con filtro azul", 180]] })
  await c.query(`insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos) values ($1, $2, 120, $3::date, 'Abono inicial', $4, '[{"metodo":"efectivo","monto":120}]'::jsonb)`, [OP, f1.id, await dia(-9), admin])
  await orden({ fac: f1.id, consulta: consultaId[2], cita: citaId[2], tipo: "progresivo", montura: "Ray-Ban Aviator", prometida: await dia(5), estado: "enviada", historial: [["enviada", `${await dia(-8)}T15:00:00-05:00`]] })
  const f2 = await factura({ cuando: await dia(-325), total: 150, estado: "pagada", metodo: "directo", consulta: consultaId[1], cita: citaId[1], lineas: [["producto", "Montura Oakley Clásica", 60], ["luna", "Lunas monofocales con antirreflejo", 90]] })
  await c.query("update facturas_venta set factura_electronica = '001-001-000004521' where id = $1", [f2.id])
  await orden({ fac: f2.id, consulta: consultaId[1], cita: citaId[1], tipo: "monofocal", montura: "Oakley Clásica", prometida: await dia(-318), estado: "entregada", historial: [["enviada", `${await dia(-324)}T15:00:00-05:00`], ["lista", `${await dia(-319)}T14:00:00-05:00`], ["entregada", `${await dia(-318)}T10:30:00-05:00`]] })
  ok("2 compras: CV-" + String(f1.numero).padStart(4, "0") + " con saldo de $145.00 y lentes en el laboratorio; CV-" + String(f2.numero).padStart(4, "0") + " pagada y entregada")

  const logsDespues = (await q("select count(*)::int n from logs_optica where optica_id = $1", [OP]))[0].n
  if (logsDespues !== logsAntes) { await c.query("delete from logs_optica where optica_id = $1 and created_at >= now() - interval '5 minutes'", [OP]); ok(`quité ${logsDespues - logsAntes} registro(s) de actividad que dejaron los disparadores (regla 40: un script no escribe en la actividad de la Demo)`) }

  if (ENSAYO) { await c.query("rollback"); console.log("\nEnsayo completo: todo se pudo crear y se revirtió. No quedó nada en la Demo."); process.exit(0) }
  await c.query("commit")

  // ── La factura electrónica de la compra 2: el PDF y el XML por la API, con la sesión del administrador de la Demo (el mismo camino que usa la pantalla de Ventas).
  const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error: eSesion } = await api.auth.signInWithPassword({ email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD })
  if (eSesion) throw new Error("No se pudo entrar como administrador de la Demo para subir la factura electrónica: " + eSesion.message)
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 78>>stream\nBT /F1 14 Tf 20 120 Td (Factura de demostracion 001-001-000004521) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n")
  const xml = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0"><infoTributaria><razonSocial>Optica Demo</razonSocial><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000004521</secuencial></infoTributaria></factura>')
  const sube = async (cuerpo, tipo) => {
    const ruta = `${OP}/${f2.id}/${tipo === "pdf" ? "ride" : "factura"}-${Date.now()}.${tipo}`
    const { error } = await api.storage.from("facturas-electronicas").upload(ruta, cuerpo, { contentType: tipo === "pdf" ? "application/pdf" : "application/xml" })
    if (error) throw new Error("No se pudo subir el " + tipo + ": " + error.message)
    return { ruta, bytes: cuerpo.length }
  }
  const sp = await sube(pdf, "pdf"), sx = await sube(xml, "xml")
  const { error: eFe } = await api.rpc("guardar_factura_electronica", { p_factura_id: f2.id, p_numero: "001-001-000004521", p_clave: null, p_autorizada: await dia(-325), p_pdf_ruta: sp.ruta, p_pdf_bytes: sp.bytes, p_xml_ruta: sx.ruta, p_xml_bytes: sx.bytes })
  if (eFe) throw new Error("No se pudo guardar la factura electrónica: " + eFe.message)
  ok("factura electrónica 001-001-000004521 con su PDF y su XML")
  // Esa función anota el registro en la actividad de la Demo: se quita (regla 40).
  await c.query("delete from logs_optica where optica_id = $1 and created_at >= now() - interval '5 minutes' and detalle ilike '%000004521%'", [OP])

  let env = fs.existsSync(".env.test") ? fs.readFileSync(".env.test", "utf8") : ""
  if (env && !env.endsWith("\n")) env += "\n"
  for (const [k, v] of [["DEMO_PORTAL_CEDULA", cedula], ["DEMO_PORTAL_CLAVE", clave]]) env = new RegExp(`^${k}=`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), () => `${k}=${v}`) : env + `${k}=${v}\n`
  fs.writeFileSync(".env.test", env)
  console.log("\nListo. Las credenciales del paciente de demostración quedaron en .env.test (DEMO_PORTAL_CEDULA y DEMO_PORTAL_CLAVE).")
} catch (e) {
  try { await c.query("rollback") } catch { /* sin transacción abierta */ }
  console.error("✘ " + e.message)
  process.exitCode = 1
} finally {
  await c.end()
}
