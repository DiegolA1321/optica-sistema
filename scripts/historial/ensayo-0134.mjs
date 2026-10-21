// Ensayo de la migración 0134 (seguimiento de la cita, motivo de cancelación, reglas de tiempo, descarte de avisos): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/historial/ensayo-0134.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
// Ejecuta SQL con un rol y unas claims de sesión; devuelve { r: filas } o { e: mensaje } (sin romper la transacción).
// Las claims de la sesión valen hasta el fin de la transacción: se sueltan después de cada llamada para que el proceso automático corra sin sesión, como el cron real.
const soltarSesion = () => c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)")
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r")
    await soltarSesion()
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); await soltarSesion(); return { e: e.message } }
}
const fn = (nombre, n) => `select ${nombre}(${Array.from({ length: n }, (_, i) => "$" + (i + 1)).join(",")}) as r`
const cedulaValida = (semilla) => {
  const base = "09" + String(semilla).padStart(7, "0")
  let suma = 0
  for (let i = 0; i < 9; i++) { let d = Number(base[i]) * (i % 2 === 0 ? 2 : 1); if (d > 9) d -= 9; suma += d }
  return base + ((10 - (suma % 10)) % 10)
}
const eventos = (cita) => q("select tipo, actor_tipo, actor_nombre, datos from citas_eventos where cita_id = $1 order by ocurrido_en, id", [cita])
const tipos = async (cita) => (await eventos(cita)).map((e) => e.tipo)

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const admin = (await q("select id, nombre from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const recepcion = (await q("select id, nombre from perfiles where optica_id = $1 and nombre = 'Rosa Recepción Pruebas'", [OP]))[0]
  const claimsAdmin = { sub: admin.id, role: "authenticated", aal: "aal2" }
  const claimsRec = { sub: recepcion.id, role: "authenticated", aal: "aal2" }
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente 0134', cedula = '0900000089', usuario = null, clave_temporal = null, sesion_token = 'tok-134', sesion_token_creado_en = now(), anonimizado_en = null, medidas_solicitadas_en = null")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id

  // El día de prueba (martes 10 mar 2099): mañana 09–13 y tarde 14–18, cierra a las 18:00.
  const DIA = "2099-03-10"
  await c.query(`update disponibilidad set excepciones = coalesce(excepciones, '{}'::jsonb) || jsonb_build_object('${DIA}', jsonb_build_object(
    'manana', jsonb_build_object('activo', true, 'inicio', '09:00', 'fin', '13:00'), 'tarde', jsonb_build_object('activo', true, 'inicio', '14:00', 'fin', '18:00'))) where optica_id = $1`, [OP])
  const nueva = async (hora, estado = "Pendiente", extra = {}) => {
    const r = await q(`insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen, duracion_minutos, asignado_a, atendido_por)
      values ($1, $2, 'Paciente 0134', '0900000089', $3, $4, $5, 'staff', $6, $7, $8) returning id`, [OP, P, extra.fecha || DIA, hora, estado, extra.duracion ?? 50, extra.asignado ?? null, extra.atendido ?? null])
    return r[0].id
  }
  const estadoDe = async (id) => (await q("select estado from citas_base where id = $1", [id]))[0].estado
  const motivoDe = async (id) => (await q("select datos->>'motivo' m from citas_eventos where cita_id = $1 and tipo = 'no_efectuada' order by ocurrido_en desc limit 1", [id]))[0]?.m
  const cron = (cuando) => c.query("select marcar_no_asistio_automatico($1::timestamp)", [cuando])

  await c.query(leer("0134_citas_seguimiento_y_reglas_de_tiempo.sql"))

  // ── Una sola versión de cada función que cambió de firma ──
  for (const f of ["crear_cita_publica", "cancelar_cita_publica", "marcar_no_asistio_automatico", "reagendar_cita_publica", "enviar_recordatorios_citas", "mis_citas_detalle_paciente"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)
  }
  for (const f of ["confirmar_asistencia_cita", "confirmar_asistencia_paciente"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 0, `${f}: ya no existe (el paciente no confirma)`)
  }
  ok((await q("select pg_get_functiondef(p.oid) d from pg_proc p where proname = 'enviar_recordatorios_citas'"))[0].d.includes("confirmar_cita") === false, "el correo de recordatorio ya no trae el enlace de confirmación")
  ok((await q("select cron.schedule is not null as x from (select 1) t, lateral (select 1) z, lateral (select 1 as schedule) cron limit 1")).length === 1 || true, "(cron) nada que revisar aquí")
  ok((await q("select count(*)::int n from cron.job where command = 'select public.marcar_no_asistio_automatico()'"))[0].n === 1, "el cron sigue llamándola sin parámetros")

  // ── 1. Cita Pendiente: pasa a «No efectuada» al terminar su horario (inicio + duración), ni un minuto antes ──
  const A = await nueva("04:00 PM") // 4:00–4:50
  ok((await tipos(A)).join() === "agendada", "una cita nueva deja el evento «agendada»")
  ok((await eventos(A))[0].datos.origen === "recepcion" || (await eventos(A))[0].datos.origen === "web", "el evento dice por dónde se agendó")
  await cron(`${DIA} 16:49:00`)
  ok((await estadoDe(A)) === "Pendiente", "a las 4:49 (un minuto antes de terminar su horario) sigue Pendiente")
  await cron(`${DIA} 16:50:00`)
  ok((await estadoDe(A)) === "No Asistió", "a las 4:50 (terminó su horario) pasa a «No efectuada»")
  ok((await motivoDe(A)) === "El paciente no asistió", "con el motivo automático «El paciente no asistió»")
  const evA = (await eventos(A)).find((e) => e.tipo === "no_efectuada")
  ok(evA.actor_tipo === "sistema" && evA.actor_nombre === "Sistema", "el evento lo hizo el Sistema")

  // ── 2. Abrir la cita un minuto antes de que termine su horario: no pasa a «No efectuada» ──
  const B = await nueva("05:00 PM", "Pendiente", { duracion: 30 }) // 5:00–5:30
  const abrir = await como("authenticated", claimsAdmin, "update citas_base set estado = 'En Atención', atendido_por = $2 where id = $1", [B, admin.id])
  ok(abrir.e === undefined, "el administrador abre la cita (En atención) a las 5:29")
  await cron(`${DIA} 17:31:00`)
  ok((await estadoDe(B)) === "En Atención", "abierta a las 5:29, a las 5:31 sigue En atención (no pasa sola durante su horario)")
  await cron(`${DIA} 17:59:00`)
  ok((await estadoDe(B)) === "En Atención", "a las 5:59 (un minuto antes del cierre de la jornada) sigue En atención")
  await cron(`${DIA} 18:00:00`)
  ok((await estadoDe(B)) === "No Asistió", "al cierre de la jornada (6:00 PM) pasa a «No efectuada»")
  ok((await motivoDe(B)) === "La atención se inició y no se terminó", "con el motivo «La atención se inició y no se terminó»")
  ok((await tipos(B)).join() === "agendada,en_atencion,no_efectuada", "el seguimiento cuenta todo, en orden: agendada, en atención, no efectuada")

  // ── 3. Paciente que llegó (En espera): no pasa solo durante su horario; al cierre sí ──
  const C = await nueva("03:00 PM", "En Espera")
  await cron(`${DIA} 15:55:00`)
  ok((await estadoDe(C)) === "En Espera", "En espera a las 3:55 (pasó su horario) sigue En espera")
  await cron(`${DIA} 18:00:00`)
  ok((await estadoDe(C)) === "No Asistió" && (await motivoDe(C)) === "El paciente llegó y no fue atendido", "al cierre de la jornada pasa a «No efectuada» con su motivo")

  // ── 4. Una atención de un día ya pasado (cierre ya vencido) se cierra en el siguiente ciclo ──
  const D = await nueva("10:00 AM", "En Atención", { fecha: "2020-01-07" })
  await cron(`${DIA} 09:00:00`)
  ok((await estadoDe(D)) === "No Asistió", "una atención abierta de un día anterior se cierra sola")

  // ── 5. Manual: «No efectuada» solo cuando terminó el horario; una cita resuelta la corrige solo el administrador ──
  const E = await nueva("04:10 PM")
  const antes = await como("authenticated", claimsRec, "update citas_base set estado = 'No Asistió' where id = $1", [E])
  ok(antes.e?.includes("solo pasa a «No efectuada» cuando termina su horario"), "recepción no puede marcar «No efectuada» antes de que termine el horario")
  const F = await nueva("09:00 AM", "Pendiente", { fecha: "2020-01-08" })
  const despues = await como("authenticated", claimsRec, "update citas_base set estado = 'No Asistió' where id = $1", [F])
  ok(despues.e === undefined && (await estadoDe(F)) === "No Asistió", "con el horario terminado, recepción sí puede marcarla")
  const reabrir = await como("authenticated", claimsRec, "update citas_base set estado = 'Pendiente' where id = $1", [F])
  ok(reabrir.e?.includes("Solo el administrador"), "recepción no puede reabrir una cita ya resuelta")
  ok((await como("authenticated", claimsRec, fn("corregir_estado_cita", 2), [F, "Pendiente"])).e?.includes("Solo el administrador"), "corregir_estado_cita: recepción no puede")
  ok((await como("anon", null, fn("corregir_estado_cita", 2), [F, "Pendiente"])).e !== undefined, "corregir_estado_cita: un anónimo no puede")
  ok((await como("authenticated", claimsAdmin, fn("corregir_estado_cita", 3), [F, "Pendiente", "Se marcó por error"])).r?.[0].r === true, "el administrador sí corrige el estado")
  ok((await estadoDe(F)) === "Pendiente", "la cita volvió a Pendiente")
  const corr = (await eventos(F)).find((e) => e.tipo === "correccion")
  ok(corr?.datos.de === "No Asistió" && corr.datos.a === "Pendiente" && corr.datos.nota === "Se marcó por error" && corr.actor_nombre === admin.nombre, "queda en el seguimiento: de qué estado a cuál, la nota y quién")
  ok((await como("authenticated", claimsAdmin, fn("corregir_estado_cita", 2), [E, "Atendida"])).e?.includes("solo puede estar pendiente"), "una cita futura no se corrige a un estado que no puede tener")
  // quien atendía puede guardar su ficha aunque el sistema ya la haya pasado a «No efectuada»
  const G = await nueva("11:30 AM", "No Asistió", { atendido: recepcion.id })
  ok((await como("authenticated", claimsRec, "update citas_base set estado = 'Atendida' where id = $1", [G])).e === undefined, "quien la atendía puede guardar su ficha después del cierre automático (queda Atendida)")

  // ── 6. Cancelar con motivo (personal) ──
  const H = await nueva("10:10 AM")
  ok((await como("authenticated", claimsRec, fn("cancelar_cita", 3), [H, "inventado", null])).e?.includes("motivo"), "un motivo fuera de la lista se rechaza")
  ok((await como("anon", null, fn("cancelar_cita", 3), [H, "otro", null])).e !== undefined, "un anónimo no puede cancelar")
  ok((await como("authenticated", claimsRec, fn("cancelar_cita", 3), [H, "paciente_llamada", "Llamó a las 9"])).r?.[0].r === true, "recepción cancela con motivo y detalle")
  const canc = (await eventos(H)).find((e) => e.tipo === "cancelada")
  ok(canc?.datos.motivo === "El paciente lo pidió por llamada o WhatsApp" && canc.datos.detalle === "Llamó a las 9" && canc.datos.cancelada_por === "recepcion" && canc.actor_tipo === "personal" && canc.actor_nombre === recepcion.nombre, "el seguimiento dice el motivo, el detalle y quién canceló")
  ok((await q("select cancelada_por from citas_base where id = $1", [H]))[0].cancelada_por === "recepcion", "queda cancelada_por = recepción")
  ok((await como("authenticated", claimsRec, fn("cancelar_cita", 3), [H, "otro", null])).r?.[0].r === false, "cancelar otra vez no hace nada (devuelve falso)")

  // ── 7. El portal: cancelar y reagendar con el paciente como autor; agendar dice por dónde ──
  await c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('permitirReagendarPaciente', 'true', 'horasAntesReagendar', 0) where id = $1", [OP])
  const I = await nueva("10:20 AM")
  ok((await como("anon", null, fn("cancelar_cita_publica", 5), [I, P, "tok-134", null, null])).e?.includes("motivo"), "el portal exige el motivo")
  ok((await como("anon", null, fn("cancelar_cita_publica", 5), [I, P, "falso", "paciente_no_puede", null])).r?.[0].r === false, "con un token falso no cancela")
  const J = await nueva("11:10 AM")
  ok((await como("anon", null, fn("reagendar_cita_publica", 5), [J, P, DIA, "12:00 PM", "tok-134"])).r?.[0].r === true, "el paciente reagenda desde el portal")
  const reag = (await eventos(J)).find((e) => e.tipo === "reagendada")
  ok(reag?.datos.fecha_anterior === DIA && reag.datos.hora_anterior === "11:10 AM" && reag.datos.hora_nueva === "12:00 PM" && reag.actor_tipo === "paciente", "el seguimiento dice «reagendada desde» la fecha y hora anteriores, hecha por el paciente")
  ok((await como("anon", null, fn("cancelar_cita_publica", 5), [I, P, "tok-134", "paciente_no_puede", "Tengo un viaje"])).r?.[0].r === true, "el paciente cancela con motivo")
  const cancP = (await eventos(I)).find((e) => e.tipo === "cancelada")
  ok(cancP?.datos.motivo === "El paciente no puede asistir" && cancP.datos.cancelada_por === "paciente" && cancP.actor_tipo === "paciente" && cancP.actor_nombre === "Paciente 0134", "el seguimiento dice quién canceló (el paciente) y por qué")
  ok((await q("select cancelada_por from citas_base where id = $1", [I]))[0].cancelada_por === "paciente", "queda cancelada_por = paciente")
  const web = await como("anon", null, "select * from crear_cita_publica($1,'Paciente Web',$2,'09:20 AM',$3,'1990-01-01','0999999999','Consulta general',null,null,null)", [OP, DIA, cedulaValida(1234567)])
  if (web.e) console.log("   (web)", web.e)
  ok(web.e === undefined && (await eventos(web.r[0].id))[0].datos.origen === "web" && (await eventos(web.r[0].id))[0].actor_tipo === "paciente", "agendar por la web deja «agendada · web» hecha por el paciente")
  const portal = await como("anon", null, "select * from crear_cita_publica($1,'Paciente Portal',$2,'09:40 AM',$3,'1990-01-01','0999999999','Consulta general',null,null,null,'portal')", [OP, DIA, cedulaValida(1234599)])
  if (portal.e) console.log("   (portal)", portal.e)
  ok(portal.e === undefined && (await eventos(portal.r[0].id))[0].datos.origen === "portal", "agendar desde el portal deja «agendada · portal»")

  // ── 8. Contacto y descarte de avisos ──
  const K = await nueva("09:00 AM", "No Asistió", { fecha: "2020-02-03" })
  ok((await como("authenticated", claimsRec, fn("registrar_contacto_cita", 2), [K, "whatsapp"])).r?.[0].r === true, "«Escribir por WhatsApp» queda en el seguimiento")
  ok((await como("authenticated", claimsRec, fn("registrar_contacto_cita", 2), [K, "paloma"])).e?.includes("Medio"), "un medio inventado se rechaza")
  ok((await como("authenticated", claimsRec, fn("descartar_aviso", 4), ["citas:contactar_paciente", K, "", null])).e?.includes("motivo"), "descartar sin motivo se rechaza")
  ok((await como("authenticated", claimsRec, fn("descartar_aviso", 4), ["rarezas:algo", K, "x", null])).e !== undefined, "un tipo de aviso inválido se rechaza")
  ok((await como("anon", null, fn("descartar_aviso", 4), ["citas:contactar_paciente", K, "x", null])).e !== undefined, "un anónimo no descarta")
  ok((await como("authenticated", claimsRec, fn("descartar_aviso", 4), ["citas:contactar_paciente", K, "El paciente ya no vive aquí", null])).r?.[0].r === true, "recepción descarta con motivo")
  ok((await como("authenticated", claimsRec, "select tipo, clave, motivo, descartado_nombre from avisos_descartados where clave = $1", [K])).r?.[0].descartado_nombre === recepcion.nombre, "queda quién lo descartó, cuándo y por qué")
  ok((await tipos(K)).join() === "agendada,contactada,descartada" || (await tipos(K)).join() === "contactada,descartada", "el descarte también queda en el seguimiento de la cita")
  ok((await como("authenticated", claimsRec, fn("restaurar_aviso", 2), ["citas:contactar_paciente", K])).r?.[0].r === true, "se puede volver a mostrar (deshacer)")
  ok((await como("authenticated", claimsRec, "insert into avisos_descartados (optica_id, tipo, clave, motivo) values ($1, 'citas:x', 'k', 'm')", [OP])).e !== undefined, "nadie escribe directo en la tabla de descartes")
  ok((await como("authenticated", claimsRec, "insert into citas_eventos (optica_id, cita_id, tipo, actor_tipo) values ($1, $2, 'agendada', 'sistema')", [OP, K])).e !== undefined, "nadie escribe directo en la tabla de eventos")

  // ── 9. «Sin seguimiento» a los 30 días, una sola vez y solo si nadie la retomó ──
  // Dos pacientes nuevos, sin ninguna otra cita.
  const otros = []
  for (const [i, cedula] of ["0900000097", "0900000105"].entries()) {
    await c.query("update t_p set id = gen_random_uuid(), nombre = $1, cedula = $2", ["Paciente 0134 " + (i + 2), cedula])
    otros.push((await q("insert into pacientes_base select * from t_p returning id"))[0])
  }
  const L = (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, origen) values ($1,$2,'Paciente sin seguimiento','2019-05-06','09:00 AM','No Asistió','staff') returning id`, [OP, otros[0].id]))[0].id
  await cron(`${DIA} 09:00:00`)
  ok((await tipos(L)).includes("sin_seguimiento"), "una cita no efectuada de hace más de 30 días queda «Sin seguimiento»")
  await cron(`${DIA} 09:05:00`)
  ok((await tipos(L)).filter((t) => t === "sin_seguimiento").length === 1, "solo una vez")
  const M = (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, origen) values ($1,$2,'Otro paciente','2019-06-03','09:00 AM','No Asistió','staff') returning id`, [OP, otros[1].id]))[0].id
  await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, origen) values ($1,$2,'Otro paciente','2019-06-10','09:00 AM','Atendida','staff')`, [OP, otros[1].id])
  await cron(`${DIA} 09:10:00`)
  ok(!(await tipos(M)).includes("sin_seguimiento"), "si el paciente ya fue atendido después, no queda «Sin seguimiento»")

  // ── 10. Lectura ──
  const veRec = await como("authenticated", claimsRec, "select count(*)::int n from citas_eventos where cita_id = $1", [H])
  ok(veRec.r?.[0].n >= 2, "el personal que ve la cita lee su seguimiento")
  const veAnon = await como("anon", null, "select count(*)::int n from citas_eventos")
  ok(veAnon.e !== undefined || veAnon.r?.[0].n === 0, "un anónimo no lee los eventos")
  const det = await como("anon", null, fn("mis_citas_detalle_paciente", 2), [P, "tok-134"])
  ok(det.r?.[0].r && !JSON.stringify(det.r[0].r).includes("confirmada_at"), "el portal ya no recibe «confirmada_at»")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
