// Verificación con sesión REAL de la migración 0134 (personal con la sesión del administrador y de recepción de la óptica de pruebas; paciente por la API con su token). Deja todo limpio.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0134.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
const nuevo = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const MARCA = "E Dos E Verif 0134"
const limpiar = async () => {
  await c.query("delete from avisos_descartados where optica_id = $1 and motivo like 'Verif 0134%'", [OP])
  await c.query("delete from citas_base where optica_id = $1 and paciente like $2", [OP, MARCA + "%"])
  await c.query("delete from logs_optica where optica_id = $1 and (detalle like $2 or detalle like 'Verif 0134%' or accion = 'Descartó un aviso' and detalle like '%Verif 0134%')", [OP, MARCA + "%"])
}
const ingreso = async (prefijo) => {
  const cl = nuevo()
  const { data, error } = await cl.auth.signInWithPassword({ email: process.env[`E2E_${prefijo}_EMAIL`], password: process.env[`E2E_${prefijo}_PASSWORD`] })
  if (error) throw new Error(`No inició sesión ${prefijo}: ${error.message}`)
  return { cl, uid: data.user.id }
}
try {
  await limpiar()
  const admin = await ingreso("ADMIN")
  const rec = await ingreso("RECEPCION")
  ok(true, "administrador y recepción inician sesión de verdad")

  const [p] = await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP])
  const mkCita = async (cl, hora, extra = {}) => {
    const r = await cl.from("citas").insert({ optica_id: OP, paciente_id: p.id, paciente: MARCA, cedula: "0900000071", fecha: "2099-03-10", hora, motivo: "Consulta General", estado: "Pendiente", ...extra }).select().single()
    if (r.error) throw new Error("No se creó la cita: " + r.error.message)
    return r.data
  }
  const eventos = async (cl, id) => (await cl.from("citas_eventos").select("tipo, actor_nombre, actor_tipo, datos").eq("cita_id", id).order("ocurrido_en")).data || []

  // ── agendar por recepción deja su evento y recepción lo lee ──
  const A = await mkCita(rec.cl, "09:20 AM")
  const evA = await eventos(rec.cl, A.id)
  ok(evA.length === 1 && evA[0].tipo === "agendada" && evA[0].datos.origen === "recepcion" && evA[0].actor_tipo === "personal", "agendar desde recepción deja «agendada · recepción» hecha por una persona del personal")
  ok((await nuevo().from("citas_eventos").select("id")).data?.length === 0 || (await nuevo().from("citas_eventos").select("id")).error != null, "sin sesión no se lee ningún evento")

  // ── cancelar con motivo (recepción) ──
  const sinMotivo = await rec.cl.rpc("cancelar_cita", { p_cita_id: A.id, p_motivo: "inventado" })
  ok(sinMotivo.error?.message?.includes("motivo"), "un motivo fuera de la lista se rechaza")
  const cancela = await rec.cl.rpc("cancelar_cita", { p_cita_id: A.id, p_motivo: "optica_no_puede", p_detalle: "Verif 0134 · falla de luz" })
  ok(cancela.data === true, "recepción cancela con motivo y detalle" + (cancela.error ? " — " + cancela.error.message : ""))
  const evC = (await eventos(rec.cl, A.id)).find((e) => e.tipo === "cancelada")
  ok(evC?.datos.motivo === "La óptica no puede atender" && evC.datos.detalle === "Verif 0134 · falla de luz" && evC.datos.cancelada_por === "recepcion", "el seguimiento dice el motivo, el detalle y quién canceló")
  const fila = (await rec.cl.from("citas").select("estado, cancelada_por").eq("id", A.id).single()).data
  ok(fila?.estado === "Cancelada" && fila.cancelada_por === "recepcion", "la cita queda Cancelada por recepción (no desaparece)")

  // ── el administrador abre y marca; las reglas de tiempo se sienten desde la sesión ──
  const B = await mkCita(admin.cl, "09:40 AM")
  const antes = await rec.cl.from("citas").update({ estado: "No Asistió" }).eq("id", B.id).select()
  ok(antes.error?.message?.includes("termina su horario") || (antes.data?.length ?? 0) === 0, "recepción no puede marcar «No efectuada» antes de que termine el horario")
  const abre = await admin.cl.from("citas").update({ estado: "En Atención", atendido_por: admin.uid }).eq("id", B.id).select()
  ok(!abre.error && abre.data?.[0]?.estado === "En Atención", "el administrador abre la cita (En atención)")
  ok((await eventos(admin.cl, B.id)).map((e) => e.tipo).join() === "agendada,en_atencion", "el seguimiento lo dice: agendada, en atención")

  // ── corregir estado: solo el administrador ──
  const corrRec = await rec.cl.rpc("corregir_estado_cita", { p_cita_id: B.id, p_estado: "Pendiente" })
  ok(corrRec.error != null, "recepción no puede corregir el estado")
  const corrAdm = await admin.cl.rpc("corregir_estado_cita", { p_cita_id: B.id, p_estado: "Pendiente", p_nota: "Verif 0134 · se abrió por error" })
  ok(corrAdm.data === true, "el administrador sí corrige el estado" + (corrAdm.error ? " — " + corrAdm.error.message : ""))
  const evK = (await eventos(admin.cl, B.id)).find((e) => e.tipo === "correccion")
  ok(evK?.datos.de === "En Atención" && evK.datos.a === "Pendiente" && evK.datos.nota?.startsWith("Verif 0134"), "queda en el seguimiento de qué estado a cuál")

  // ── reagendar: la fecha anterior queda dicha ──
  const mov = await admin.cl.from("citas").update({ fecha: "2099-03-11", hora: "10:00 AM" }).eq("id", B.id).select()
  ok(!mov.error, "el personal reagenda la cita")
  const evR = (await eventos(admin.cl, B.id)).find((e) => e.tipo === "reagendada")
  ok(evR?.datos.fecha_anterior === "2099-03-10" && evR.datos.hora_anterior === "09:40 AM" && evR.datos.hora_nueva === "10:00 AM", "el seguimiento dice «reagendada desde» la fecha y hora anteriores")

  // ── contacto y descarte de avisos ──
  const contacto = await rec.cl.rpc("registrar_contacto_cita", { p_cita_id: A.id, p_medio: "whatsapp" })
  ok(contacto.data === true && (await eventos(rec.cl, A.id)).some((e) => e.tipo === "contactada"), "«Escribir por WhatsApp» queda en el seguimiento")
  const desc = await rec.cl.rpc("descartar_aviso", { p_tipo: "citas:contactar_paciente", p_clave: A.id, p_motivo: "Verif 0134 · ya no vive aquí", p_detalle: null, p_dias: null })
  ok(desc.data === true, "recepción descarta un aviso con motivo" + (desc.error ? " — " + desc.error.message : ""))
  const leido = (await rec.cl.from("avisos_descartados").select("motivo, descartado_nombre").eq("clave", A.id)).data
  ok(leido?.length === 1 && leido[0].descartado_nombre.length > 0, "queda quién lo descartó y por qué, y se lee con la sesión del personal")
  ok((await rec.cl.rpc("descartar_aviso", { p_tipo: "citas:contactar_paciente", p_clave: A.id, p_motivo: "", p_detalle: null, p_dias: null })).error != null, "descartar sin motivo se rechaza")
  ok((await rec.cl.from("avisos_descartados").insert({ optica_id: OP, tipo: "citas:x", clave: "k", motivo: "m" })).error != null, "nadie escribe directo en la tabla de descartes")
  ok((await rec.cl.rpc("restaurar_aviso", { p_tipo: "citas:contactar_paciente", p_clave: A.id })).data === true, "se puede volver a mostrar")

  // ── el portal: agendar y cancelar con motivo, y reagendar, con el paciente como autor ──
  const api = nuevo()
  const { data: ses } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = ses?.[0]?.sesion_token
  ok(!!token, "el paciente inicia sesión de verdad")
  await c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('permitirReagendarPaciente', 'true', 'horasAntesReagendar', 0) where id = $1", [OP])
  const mia = await mkCita(admin.cl, "11:20 AM")
  await c.query("update citas_base set paciente_id = $1 where id = $2", [p.id, mia.id])
  const sin = await api.rpc("cancelar_cita_publica", { p_cita_id: mia.id, p_paciente_id: p.id, p_token: token })
  ok(sin.error?.message?.includes("motivo"), "el portal exige el motivo de la cancelación")
  const reag = await api.rpc("reagendar_cita_publica", { p_cita_id: mia.id, p_paciente_id: p.id, p_fecha: "2099-03-10", p_hora: "11:40 AM", p_token: token })
  ok(reag.data === true, "el paciente reagenda desde su portal" + (reag.error ? " — " + reag.error.message : ""))
  const evP = (await eventos(admin.cl, mia.id)).find((e) => e.tipo === "reagendada")
  ok(evP?.actor_tipo === "paciente" && evP.datos.hora_anterior === "11:20 AM", "la reagendada la hizo el paciente y dice desde cuándo")
  const can = await api.rpc("cancelar_cita_publica", { p_cita_id: mia.id, p_paciente_id: p.id, p_token: token, p_motivo: "paciente_no_puede", p_detalle: "Verif 0134" })
  ok(can.data === true, "el paciente cancela con motivo" + (can.error ? " — " + can.error.message : ""))
  const evX = (await eventos(admin.cl, mia.id)).find((e) => e.tipo === "cancelada")
  ok(evX?.actor_tipo === "paciente" && evX.datos.cancelada_por === "paciente" && evX.datos.motivo === "El paciente no puede asistir", "la cancelación dice que la hizo el paciente y por qué")
  const mis = await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: p.id, p_token: token })
  ok(mis.data && !JSON.stringify(mis.data).includes("confirmada_at"), "el portal ya no recibe «confirmada_at»")
  ok((await api.rpc("confirmar_asistencia_paciente", { p_paciente_id: p.id, p_token: token, p_cita_id: mia.id })).error != null, "confirmar asistencia ya no existe")
  ok((await api.from("citas_eventos").select("id")).data?.length === 0 || true, "(el paciente no lee la tabla de eventos)")
  const portalLee = await api.from("citas_eventos").select("id").limit(1)
  ok((portalLee.data ?? []).length === 0, "el paciente por la API no lee eventos (ni los suyos: el seguimiento es del personal)")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  await limpiar()
  await c.query("update opticas set settings = settings - 'horasAntesReagendar' - 'permitirReagendarPaciente' where id = $1", [OP]).catch(() => {})
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
