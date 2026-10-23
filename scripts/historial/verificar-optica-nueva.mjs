// Cierre: qué recibe una óptica nueva. La crea como lo hace el panel del superadmin (un insert en `opticas`) dentro de una transacción que SIEMPRE se revierte,
// comprueba lo que la base le da y deja a la vista lo que sale del código (eso lo cubre src/utilidades/opticaNueva.test.js). Ningún correo real: llave de Resend falsa
// y pg_net solo encola; al final se comprueba que la cola y el registro de envíos quedaron como estaban.
//
//   node --env-file=.env.local scripts/historial/verificar-optica-nueva.mjs
import pg from "pg"
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const colaAntes = (await q("select count(*)::int n from net.http_request_queue"))[0].n
const enviosAntes = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
const opticasAntes = (await q("select count(*)::int n from opticas"))[0].n
try {
  await c.query("begin")
  await c.query("delete from vault.secrets where name = 'resend_api_key'")
  await c.query("select vault.create_secret('LLAVE-FALSA-DEL-ENSAYO', 'resend_api_key')")
  const o = (await q(`insert into opticas (nombre, slug, es_de_prueba, marca) values ('ZZ Óptica nueva (ensayo)', 'zz-optica-nueva', false,
    '{"nombreMarca":"ZZ Óptica nueva (ensayo)","eslogan":"Ve el mundo con claridad.","colorAcento":"#2563EB"}'::jsonb) returning *`))[0]

  // Marca y valores de la fila
  ok(o.marca.colorAcento === "#2563EB" && o.marca.nombreMarca === "ZZ Óptica nueva (ensayo)" && o.marca.eslogan === "Ve el mundo con claridad.", "marca: nombre, eslogan y color de acento")
  ok(o.activa === true && o.estado_pago === "al_dia", "nace activa y al día")
  ok(o.settings.manejaProgresion === true && o.settings.mostrarMedidasPaciente === false, "ajustes de base (progresión sí, medidas al paciente no)")
  ok(o.settings.recordatoriosCitaActivo === undefined, "ajuste de recordatorios sin escribir (la base y la pantalla leen «sin escribir» = ACTIVO)")
  ok(JSON.stringify(o.motivos_consulta) === JSON.stringify(["Consulta General", "Adaptación de Lentes", "Examen de Control", "Garantía / Ajuste"]), "motivos de consulta de la óptica")
  ok(o.diagnosticos_rapidos.length === 7, "diagnósticos rápidos (7)")
  ok(JSON.stringify(o.categorias_inventario) === JSON.stringify(["Monturas", "Accesorios"]), "categorías de inventario")

  // Roles predefinidos
  const roles = await q("select clave, nombre, es_predefinido, atiende_pacientes, permisos, alcance, inicio from roles where optica_id = $1 order by clave", [o.id])
  ok(roles.map((r) => r.clave).join() === "optometra,recepcion,ventas", "roles predefinidos: " + roles.map((r) => r.nombre).join(", "))
  const por = Object.fromEntries(roles.map((r) => [r.clave, r]))
  ok(roles.every((r) => r.es_predefinido), "los tres son predefinidos")
  ok(por.optometra.atiende_pacientes === true && !por.recepcion.atiende_pacientes && !por.ventas.atiende_pacientes, "solo el Optómetra atiende pacientes")
  ok(por.optometra.alcance.consultas === "propio" && por.optometra.alcance.citas === "propio" && por.optometra.alcance.reportes === "propio", "alcances del Optómetra: citas, fichas y reportes «propio»")
  ok(Object.keys(por.recepcion.alcance).length === 0 && Object.keys(por.ventas.alcance).length === 0, "Recepción y Ventas sin restricción de alcance (toda la óptica)")
  ok(roles.every((r) => r.permisos.horario?.includes("ver") && r.permisos.horario_optica?.includes("ver") && r.permisos.mensajes?.includes("ver")), "todos ven Horario, horario de la óptica y Mensajes")
  ok(por.recepcion.permisos.pacientes.includes("crear") && por.recepcion.permisos.consultas.join() === "ver" && por.ventas.permisos.ventas.includes("crear"), "permisos de Recepción y Ventas")

  // Tablas que NO se llenan solas (todo lo demás sale del código, ver opticaNueva.test.js)
  const vacias = ["crm_plantillas", "disponibilidad", "horarios_usuario", "inventario", "pacientes_base", "citas_base", "crm_campanas", "ausencias_personal", "avisos_internos", "logs_optica"]
  for (const t of vacias) ok((await q(`select count(*)::int n from public.${t} where optica_id = $1`, [o.id]))[0].n === 0, `${t}: vacía (nada que sembrar; el sistema usa los valores por defecto)`)

  // Recordatorios de citas: una cita de hoy en 4 h, creada hace 3 h, sale con la óptica recién creada (la función no exige ningún ajuste guardado)
  const ahora = "2026-11-02T10:30:00-05:00"
  const nuevaCita = async (nombre, hora) => (await q(`insert into citas_base (optica_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, correo, created_at)
    values ($1, $2, '1710034065', '0991234567', '2026-11-02', $3, 'Consulta General', 'Pendiente', 'presencial', 'prueba@example.invalid', $4::timestamptz - interval '3 hours') returning id`, [o.id, nombre, hora, ahora]))[0].id
  const cita = await nuevaCita("Paciente Óptica Nueva", "03:00 PM")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [ahora])
  const cola = (await q("select convert_from(body, 'utf8')::jsonb b from net.http_request_queue where url = 'https://api.resend.com/emails' order by id")).map((x) => x.b).filter((b) => /ZZ Óptica nueva/.test(b.subject || ""))
  ok(cola.length === 1 && cola[0].to[0] === "prueba@example.invalid", "el recordatorio de cita sale para una óptica nueva (sin tocar ningún ajuste): " + cola.length + " correo encolado")
  ok((await q("select recordatorio_enviado_at is not null e from citas_base where id = $1", [cita]))[0].e, "la cita queda marcada como recordada")
  // Se apaga solo cuando la óptica lo apaga
  await c.query(`update opticas set settings = settings || '{"recordatoriosCitaActivo": false}'::jsonb where id = $1`, [o.id])
  const cita2 = await nuevaCita("Paciente Óptica Nueva 2", "04:00 PM")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [ahora])
  ok(!(await q("select recordatorio_enviado_at is not null e from citas_base where id = $1", [cita2]))[0].e, "con el ajuste apagado por la óptica, no se recuerda")
} catch (e) {
  console.log("✘ ERROR:", e.message); fallos++
} finally {
  await c.query("rollback")
  const colaDespues = (await q("select count(*)::int n from net.http_request_queue"))[0].n
  const enviosDespues = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
  const opticasDespues = (await q("select count(*)::int n from opticas"))[0].n
  ok(colaDespues === colaAntes && enviosDespues === enviosAntes && opticasDespues === opticasAntes, "revertido: la óptica de prueba ya no existe, cola de pg_net y envíos sin cambios")
  const key = (await q("select count(*)::int n from vault.decrypted_secrets where name = 'resend_api_key' and decrypted_secret <> 'LLAVE-FALSA-DEL-ENSAYO'"))[0].n
  ok(key === 1, "la llave real de Resend sigue en el vault")
  await c.end()
}
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : "\nTodo ✔")
process.exit(fallos ? 1 : 0)
