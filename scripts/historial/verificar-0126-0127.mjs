// Verificación con sesión REAL de paciente (la API, con el token del inicio de sesión) de las migraciones 0126 y 0127, en la óptica de pruebas.
// Crea una compra con dos abonos y dos citas del paciente fijo del portal y lo borra todo al terminar.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0126-0127.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id, nombre from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
const otro = (await q("select id from pacientes_base where optica_id = $1 and id <> $2 and anonimizado_en is null limit 1", [OP, P.id]))[0]
const citas = []
let factura = null
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id

  // 0126
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  factura = (await q("insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 90, 'pendiente_pago', $3, $4) returning id", [OP, P.id, admin, numero]))[0].id
  await c.query("insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos) values ($1, $2, 30, current_date - 2, 'nota interna', $3, '[{\"metodo\":\"efectivo\",\"monto\":30}]'::jsonb), ($1, $2, 10, current_date, 'otra', $3, '[{\"metodo\":\"efectivo\",\"monto\":10}]'::jsonb)", [OP, factura, admin])
  const m = await api.rpc("mis_compras_paciente", { p_paciente_id: P.id, p_token: token })
  const compra = m.data?.find((x) => x.id === factura)
  ok(!m.error && compra && compra.abonos.length === 2 && Number(compra.abonos[0].monto) === 30, "la compra trae sus dos abonos, del más antiguo al más reciente")
  ok(compra.abonos.every((a) => Object.keys(a).sort().join() === "fecha,monto"), "cada abono trae solo fecha y monto (sin la nota ni quién lo registró)")
  ok(Number(compra.abonado) === 40 && Number(compra.saldo) === 50, "lo abonado y el saldo coinciden con Cobros y saldos ($40 y $50)")
  ok((await api.rpc("mis_compras_paciente", { p_paciente_id: P.id, p_token: "inventado" })).data.length === 0, "con un token inventado no entrega nada")

  // 0127
  const nueva = async (estado, dias, hora, quien = P.id) => {
    const id = (await q("insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado) values ($1, $2, $6, (now() at time zone 'America/Guayaquil')::date + $3::int, $4, 'Consulta General', $5) returning id", [OP, quien, dias, hora, estado, P.nombre]))[0].id
    citas.push(id); return id
  }
  const futura = await nueva("Pendiente", 5, "10:20 AM")
  const atendida = await nueva("Atendida", -2, "10:20 AM")
  const ajena = otro ? await nueva("Pendiente", 5, "09:00 AM", otro.id) : null
  const d0 = await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: token })
  ok(!d0.error && d0.data.find((x) => x.cita_id === futura)?.en_calendario_at === null, "el detalle trae en_calendario_at, vacío al principio")
  ok(d0.data.every((x) => Object.keys(x).sort().join() === "calificacion,cita_id,confirmada_at,consulta_id,en_calendario_at,profesional"), "solo los seis campos, sin ids del personal")
  const r1 = await api.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: futura })
  ok(!r1.error && r1.data === true, "marca su cita futura como agregada al calendario")
  ok((await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: token })).data.find((x) => x.cita_id === futura).en_calendario_at !== null, "al pedir el detalle de nuevo (otro aparato) ya viene marcada")
  ok((await api.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: atendida })).data === false, "una cita atendida no se marca")
  if (ajena) ok((await api.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: ajena })).data === false, "no marca la cita de otro paciente")
  ok((await api.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: P.id, p_token: "inventado", p_cita_id: futura })).data === false, "con un token inventado no marca")
  // El personal reagenda: la marca se borra, así que el portal vuelve a ofrecerla.
  await c.query("update citas_base set hora = '11:00 AM' where id = $1", [futura])
  ok((await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: token })).data.find((x) => x.cita_id === futura).en_calendario_at === null, "si la cita cambia de hora, el portal vuelve a ofrecer agregarla")
  // Nadie más puede escribir la columna por la API.
  const escribir = await api.from("citas").update({ agregada_calendario_at: new Date().toISOString() }).eq("id", futura)
  ok(!!escribir.error || (await q("select agregada_calendario_at a from citas_base where id = $1", [futura]))[0].a === null, "sin sesión del personal, la API no escribe esa columna")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  if (citas.length) await c.query("delete from citas_base where id = any($1)", [citas])
  if (factura) {
    await c.query("delete from abonos_factura where factura_id = $1", [factura])
    await c.query("delete from facturas_venta where id = $1", [factura])
  }
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
