// Datos de demostración para la "Óptica Demo" (pruebas automáticas y presentación de la tesis).
//
//   node --env-file=.env.local scripts/seed-optica-demo.mjs              → ENSAYO (dry-run): hace todo dentro de
//                                                                           una transacción y la revierte. No deja nada.
//   node --env-file=.env.local scripts/seed-optica-demo.mjs --ejecutar   → lo escribe de verdad (commit).
//
// Qué crea (todo ficticio, fechas relativas al día de ejecución, hora de Ecuador):
//   ~40 pacientes con cédulas ecuatorianas válidas y correos @example.com; citas de las últimas 6 semanas y de las
//   próximas 3 en todos los estados; consultas de los últimos 9 meses con diagnósticos y graduaciones variadas;
//   pases a venta (vendidos, descartados con motivo y en espera); ventas con abonos, cuotas y saldos (y una anulada);
//   órdenes de laboratorio en todos sus estados (con atrasadas); inventario de monturas y accesorios; encuestas.
//
// Garantías:
//   * Solo toca la Óptica Demo (además de sus datos, corrige las tildes de SUS listas de motivos y diagnósticos rápidos): aborta si no es exactamente ella, si ya tiene datos, o si al final cambió el
//     conteo de filas de CUALQUIER otra óptica.
//   * No envía ningún correo ni mensaje: todas las citas nacen con recordatorio y encuesta ya "enviados", todos los
//     pacientes con el saludo de cumpleaños del año ya "enviado", no se escribe en `mensajes` ni se llama a Resend,
//     y al final se comprueba que ningún proceso automático encuentre algo que enviar en esta óptica.
//   * Determinista: misma semilla → mismos nombres, cédulas y estructura; solo se desplazan las fechas.
//   * Escribe directo en las tablas base (como la migración): no pasa por las RPC porque estas dependen de una sesión.

import pg from "pg"
import { randomUUID } from "node:crypto"

const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const DEMO_NOMBRE = "Óptica Demo"
const EJECUTAR = process.argv.includes("--ejecutar")

// ───────────────────────── utilidades ─────────────────────────
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261006)
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const elige = (arr) => arr[Math.floor(rnd() * arr.length)]
const mezcla = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const pesos = (pares) => { const total = pares.reduce((s, [, p]) => s + p, 0); let r = rnd() * total; for (const [v, p] of pares) { if ((r -= p) <= 0) return v } return pares[0][0] }
const redondear = (n) => Math.round(n * 100) / 100

const sumaDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const f = new Date(Date.UTC(y, m - 1, d + n)); return f.toISOString().slice(0, 10) }
const diasEntre = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000)
const sumaMeses = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const f = new Date(Date.UTC(y, m - 1 + n, 1)); const ult = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate(); return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), Math.min(d, ult))).toISOString().slice(0, 10) }
const diaSemana = (iso) => new Date(iso + "T12:00:00Z").getUTCDay() // 0 = domingo
// Día hábil (lunes a sábado) más cercano hacia atrás/adelante.
const habil = (iso, dir = -1) => { let f = iso; while (diaSemana(f) === 0) f = sumaDias(f, dir); return f }
const timestampEC = (iso, hh = 10, mm = 0) => `${iso}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-05:00`

// "hh:mm AM/PM" (lo exige la base) a partir de minutos desde medianoche.
const horaAmPm = (min) => { const h24 = Math.floor(min / 60) % 24, m = min % 60; const h12 = h24 % 12 === 0 ? 12 : h24 % 12; return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}` }
const FRANJAS = Array.from({ length: 14 }, (_, i) => 9 * 60 + i * 40).filter((m) => m <= 17 * 60) // 09:00 … 17:20, cada 40 min

// Cédula ecuatoriana válida (provincia 01-24, tercer dígito < 6, dígito verificador módulo 10).
const PROVINCIAS = ["09", "13", "17", "01", "11", "07", "18", "23"]
function cedulaValida(usadas) {
  for (;;) {
    const base = elige(PROVINCIAS) + String(entre(0, 5)) + String(entre(0, 999999)).padStart(6, "0")
    let suma = 0
    for (let i = 0; i < 9; i++) { let v = Number(base[i]) * (i % 2 === 0 ? 2 : 1); if (v > 9) v -= 9; suma += v }
    const dv = (10 - (suma % 10)) % 10
    const cedula = base + dv
    if (!usadas.has(cedula)) { usadas.add(cedula); return cedula }
  }
}
const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "")

// ───────────────────────── catálogos ficticios ─────────────────────────
const NOMBRES_M = ["Carlos", "Luis", "Jorge", "Andrés", "Marco", "Diego", "Fernando", "Patricio", "Santiago", "Byron", "Kevin", "Mateo", "Esteban", "Raúl", "Wilson"]
const NOMBRES_F = ["María", "Ana", "Carmen", "Lucía", "Gabriela", "Verónica", "Daniela", "Karla", "Paola", "Jessica", "Sofía", "Rosa", "Mónica", "Alexandra", "Valeria"]
const APELLIDOS = ["Zambrano", "Mendoza", "Cedeño", "Párraga", "Loor", "Alcívar", "Intriago", "Macías", "Vera", "Delgado", "Cevallos", "Moreira", "Baque", "Pincay", "Holguín", "Chávez", "Villamar", "Santana", "Bravo", "Quiroz", "Mero", "Anchundia", "Giler", "Solórzano", "Andrade"]
const LABORATORIOS = [
  { nombre: "Laboratorio Visión Norte", dias: [3, 5] },
  { nombre: "Óptica Lab Guayaquil", dias: [6, 8] },
  { nombre: "LabLentes Quito", dias: [9, 13] },
]
const MATERIALES = ["CR-39", "Policarbonato", "Alto índice 1.67", "Trivex"]
const OBS_DX = {
  Miopía: { sph: [-0.5, -6.5], cil: false },
  Hipermetropía: { sph: [0.5, 4.5], cil: false },
  Astigmatismo: { sph: [-1.0, 1.0], cil: true },
  Presbicia: { sph: [0.25, 1.75], cil: false, adicion: true },
  "Miopía y astigmatismo": { sph: [-0.75, -5.0], cil: true },
  "Hipermetropía y astigmatismo": { sph: [0.5, 3.5], cil: true },
  "Sin alteración refractiva": { sph: [0, 0], cil: false },
}
const FRECUENCIA_DX = [["Miopía", 26], ["Astigmatismo", 14], ["Miopía y astigmatismo", 16], ["Hipermetropía", 11], ["Hipermetropía y astigmatismo", 7], ["Presbicia", 16], ["Sin alteración refractiva", 10]]
const MOTIVOS = [["Consulta General", 38], ["Examen de Control", 30], ["Adaptación de Lentes", 18], ["Garantía / Ajuste", 14]]
const MONTURAS = [
  ["Montura 1, marco negro, acetato", 45], ["Montura 2, marco carey, acetato", 52], ["Montura 3, marco metálico dorado", 68], ["Montura 4, marco metálico plateado", 62],
  ["Montura 5, marco azul, TR-90", 58], ["Montura 6, marco transparente, acetato", 49], ["Montura 7, marco al aire, titanio", 120], ["Montura 8, marco redondo, metal", 74],
  ["Montura 9, marco rectangular, negro mate", 55], ["Montura 10, marco infantil, flexible", 38], ["Montura 11, marco cat-eye, rojo", 64], ["Montura 12, marco aviador, dorado", 79],
  ["Montura 13, marco deportivo, TR-90", 85], ["Montura 14, marco vino, acetato", 57],
]
const ACCESORIOS = [["Estuche rígido", 6], ["Paño de microfibra", 2.5], ["Líquido limpiador 60 ml", 4.5], ["Cordón para gafas", 3.5], ["Kit de tornillos y destornillador", 3], ["Estuche flexible", 3.5]]

const TXT_ANTECEDENTES = ["Ninguno relevante", "Uso prolongado de pantallas", "Cefaleas ocasionales", "Diabetes tipo 2 controlada", "Hipertensión controlada", "Cirugía ocular previa: ninguna"]
const TXT_ALERGIAS = ["Ninguna", "Ninguna", "Polen", "Penicilina", "Ninguna"]
const INDICACIONES = ["Uso permanente de lentes. Control en 12 meses.", "Pausas visuales 20-20-20 al usar pantallas. Control anual.", "Lentes para lectura y trabajo cercano. Control en 6 meses.", "Uso de lentes de manera constante. Evitar frotarse los ojos.", "Sin corrección necesaria por ahora. Control en 12 meses."]

const out = (...a) => console.log(...a)

// ───────────────────────── ejecución ─────────────────────────
const c = new pg.Client()
await c.connect()
let ok = false
try {
  await c.query("begin")
  const Q = (sql, params) => c.query(sql, params)

  // ── 1. Guardias ──
  const { rows: [conexion] } = await Q("select current_database() db, inet_server_addr()::text ip")
  out(`Base de datos: ${conexion.db}  ·  modo: ${EJECUTAR ? "EJECUCIÓN REAL (commit)" : "ENSAYO (dry-run, se revierte)"}`)

  const { rows: [demo] } = await Q("select id, nombre, activa, slug from opticas where id = $1", [DEMO_ID])
  if (!demo || demo.nombre !== DEMO_NOMBRE) throw new Error(`ABORTO: la óptica ${DEMO_ID} no es "${DEMO_NOMBRE}" (se encontró: ${demo ? demo.nombre : "nada"}).`)
  const { rows: otras } = await Q("select id, nombre from opticas where id <> $1 order by nombre", [DEMO_ID])
  out(`Óptica objetivo: ${demo.nombre} (slug ${demo.slug}). Otras ópticas en la base (no se tocan): ${otras.map((o) => o.nombre).join(", ") || "ninguna"}`)

  const TABLAS = ["pacientes_base", "citas_base", "consultas_base", "inventario", "pases_a_venta", "facturas_venta", "abonos_factura", "ordenes_laboratorio", "respuestas_satisfaccion"]
  const contar = async (idOptica) => {
    const r = {}
    for (const t of TABLAS) r[t] = Number((await Q(`select count(*) n from ${t} where optica_id ${idOptica ? "= $1" : "<> $1"}`, [DEMO_ID])).rows[0].n)
    return r
  }
  const antesOtras = await contar(false)
  const antesDemo = await contar(true)
  const conDatos = Object.entries(antesDemo).filter(([, n]) => n > 0)
  if (conDatos.length) throw new Error(`ABORTO: la Óptica Demo ya tiene datos (${conDatos.map(([t, n]) => `${t}: ${n}`).join(", ")}). Este script solo llena una óptica vacía.`)

  const { rows: admins } = await Q("select id, nombre from perfiles where optica_id = $1 and rol = 'admin' order by created_at limit 1", [DEMO_ID])
  if (!admins.length) throw new Error("ABORTO: la Óptica Demo no tiene un administrador que figure como responsable.")
  const ADMIN = admins[0].id
  const ADMIN_NOMBRE = admins[0].nombre

  const { rows: [t0] } = await Q("select (now() at time zone 'America/Guayaquil')::date::text hoy, (extract(hour from now() at time zone 'America/Guayaquil') * 60 + extract(minute from now() at time zone 'America/Guayaquil'))::int minutos")
  const HOY = t0.hoy
  const AHORA_MIN = t0.minutos
  out(`Hoy (Ecuador): ${HOY}, ${horaAmPm(AHORA_MIN)}. Responsable de las atenciones: ${ADMIN_NOMBRE}.`)

  // Catálogos de la propia óptica: se corrigen las tildes de los textos de configuración (solo de la Demo).
  await Q(`update opticas set motivos_consulta = $2::text[], diagnosticos_rapidos = $3::text[] where id = $1`, [DEMO_ID, MOTIVOS.map(([m]) => m), FRECUENCIA_DX.map(([d]) => d)])

  const cifrar = async (t) => (t == null ? null : (await Q("select cifrar_clinico($1) v", [t])).rows[0].v)

  // ── 2. Inventario ──
  const inv = []
  const insertInv = async (nombre, categoria, precio, stock, critico, obs) => {
    const id = randomUUID()
    await Q("insert into inventario (id, optica_id, nombre, categoria, stock, precio, critico, observacion, activo) values ($1,$2,$3,$4,$5,$6,$7,$8,true)", [id, DEMO_ID, nombre, categoria, stock, precio, critico, obs])
    inv.push({ id, nombre, categoria, precio, stock, critico, vendidas: 0 })
  }
  for (const [i, [n, p]] of MONTURAS.entries()) await insertInv(n, "Armazones", p, 0, 3, i % 3 === 0 ? "Unisex" : null) // el stock real se fija al final
  for (const [n, p] of ACCESORIOS) await insertInv(n, "Accesorios", p, 0, 5, null)
  const stockInicial = new Map(inv.map((p) => [p.id, p.categoria === "Armazones" ? entre(4, 14) : entre(12, 40)]))
  // Para ver alertas de stock: 3 monturas casi agotadas, 1 agotada, 1 accesorio bajo.
  const bajos = mezcla(inv.filter((p) => p.categoria === "Armazones")).slice(0, 4)
  bajos.slice(0, 3).forEach((p) => stockInicial.set(p.id, entre(4, 5))) // tras las ventas quedan en o bajo el mínimo
  const armazones = inv.filter((p) => p.categoria === "Armazones")

  // ── 3. Pacientes ──
  const usadasCedulas = new Set()
  const usadosNombres = new Set()
  const NUM_PAC = 40
  const pacientes = []
  const PAC_SIN_ATENDER = 3 // staff, sin cita ni consulta
  const PAC_WEB_NUEVOS = 4 // origen web, con cita próxima y sin consulta
  while (pacientes.length < NUM_PAC) {
    const mujer = rnd() < 0.55
    const nombre1 = elige(mujer ? NOMBRES_F : NOMBRES_M)
    const apellido1 = elige(APELLIDOS)
    let apellido2 = elige(APELLIDOS)
    if (apellido2 === apellido1) apellido2 = elige(APELLIDOS.filter((a) => a !== apellido1))
    const nombre = `${nombre1} ${apellido1} ${apellido2}`
    if (usadosNombres.has(nombre)) continue
    usadosNombres.add(nombre)
    const edad = pesos([[entre(6, 17), 12], [entre(18, 39), 38], [entre(40, 59), 30], [entre(60, 80), 20]])
    pacientes.push({
      id: randomUUID(), nombre, mujer, edad,
      cedula: cedulaValida(usadasCedulas),
      telefono: "09" + String(entre(10000000, 99999999)),
      correo: `${sinTildes(nombre1)}.${sinTildes(apellido1)}${pacientes.length + 1}@example.com`,
      nacimiento: sumaDias(sumaMeses(HOY, -12 * edad), -entre(0, 360)),
      consultas: [], tipo: "atendido",
    })
  }
  // Roles de demostración dentro de los 40.
  const orden = mezcla(pacientes)
  orden.slice(0, PAC_SIN_ATENDER).forEach((p) => (p.tipo = "sin_atender"))
  orden.slice(PAC_SIN_ATENDER, PAC_SIN_ATENDER + PAC_WEB_NUEVOS).forEach((p) => (p.tipo = "web_nuevo"))
  // Tres cumpleaños en los próximos días (el año de nacimiento se conserva).
  orden.filter((p) => p.tipo === "atendido").slice(0, 3).forEach((p, i) => {
    const prox = sumaDias(HOY, [2, 9, 15][i]); p.nacimiento = `${p.nacimiento.slice(0, 4)}${prox.slice(4)}`
  })
  const atendidos = pacientes.filter((p) => p.tipo === "atendido")

  // ── 4. Consultas (últimos 9 meses) ──
  const consultas = []
  const diasDe = (p, n) => { const f = []; for (let i = 0; i < n; i++) f.push(habil(sumaDias(HOY, -entre(1, 270)), -1)); return f.sort() }
  // Reparto: 2 de cada 3 pacientes atendidos tienen 2-3 consultas (para ver la tendencia de graduación).
  const garantizar = [sumaDias(HOY, -3), sumaDias(HOY, -9), sumaDias(HOY, -17), sumaDias(HOY, -24), sumaDias(HOY, -33), sumaDias(HOY, -40)] // hay actividad en las últimas 6 semanas
  atendidos.forEach((p, i) => {
    const n = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3
    p.fechas = diasDe(p, n)
    if (i < garantizar.length) p.fechas[p.fechas.length - 1] = habil(garantizar[i], -1)
    p.fechas = [...new Set(p.fechas)].sort()
  })
  const lente = (dx, adicion) => (adicion ? "Progresivo" : /Hipermetrop|Miop|Astig/.test(dx) ? pesos([["Monofocal", 70], ["Bifocal", 10], ["Progresivo", 20]]) : "")
  for (const p of atendidos) {
    let previa = null
    for (const fecha of p.fechas) {
      const dx = previa && rnd() < 0.8 ? previa.dx : pesos(FRECUENCIA_DX)
      const cats = [dx]
      if (rnd() < 0.08 && dx === "Presbicia") cats.push("Miopía")
      const def = OBS_DX[dx]
      const base = previa ? previa.sphBase : def.sph[0] + rnd() * (def.sph[1] - def.sph[0])
      const delta = previa ? elige([0, 0, 0.25, -0.25, 0.5, -0.5]) : 0
      const esfOd = redondear(Math.round((base + delta) * 4) / 4)
      const esfOi = redondear(Math.round((base + delta + elige([0, 0.25, -0.25])) * 4) / 4)
      const cilOd = def.cil ? -redondear(elige([0.5, 0.75, 1, 1.25, 1.5, 2])) : 0
      const cilOi = def.cil ? -redondear(elige([0.5, 0.75, 1, 1.25, 1.5])) : 0
      const adicion = def.adicion || (p.edad >= 45 && rnd() < 0.3) ? redondear(0.75 + Math.min(2, (p.edad - 40) / 18)) : 0
      const fmt = (n) => (n === 0 ? "0.00" : (n > 0 ? "+" : "") + n.toFixed(2))
      const avSc = dx === "Sin alteración refractiva" ? "20/20" : elige(["20/40", "20/50", "20/60", "20/80", "20/100", "20/30"])
      const avCc = rnd() < 0.08 ? "" : pesos([["20/20", 60], ["20/25", 25], ["20/40", 15]])
      const estadoCorreccion = avCc === "" ? "Sin evaluar" : avCc === "20/40" ? "Requiere ajuste" : "Bien corregido"
      const prom = (Math.abs(esfOd) + Math.abs(esfOi)) / 2
      const evolucion = !previa ? "Primera consulta" : Math.abs(prom - previa.prom) < 0.25 ? "Sin cambios" : prom > previa.prom ? "Aumentó" : "Disminuyó"
      const motivo = !previa ? pesos([["Consulta General", 60], ["Adaptación de Lentes", 40]]) : pesos([["Examen de Control", 60], ["Garantía / Ajuste", 20], ["Consulta General", 20]])
      const rec = lente(dx, adicion > 0)
      const consulta = {
        id: randomUUID(), p, fecha, dx, cats, motivo, esfOd, esfOi, cilOd, cilOi, adicion, avSc, avCc, estadoCorreccion, evolucion,
        lenteRecomendado: rec ? `${rec} ${elige(MATERIALES)}` : "", tipoLente: rec ? rec.toLowerCase() : "", sphBase: base + delta, prom,
        od: { esfera: fmt(esfOd), cilindro: cilOd ? fmt(cilOd) : "0.00", eje: cilOd ? String(elige([5, 10, 45, 90, 100, 170, 180])) : "", avSc, avCc },
        oi: { esfera: fmt(esfOi), cilindro: cilOi ? fmt(cilOi) : "0.00", eje: cilOi ? String(elige([5, 10, 45, 90, 100, 170, 180])) : "", avSc, avCc },
        medidas: { dp: String(entre(58, 68)), alt: String(entre(16, 24)), adicion: adicion ? fmt(adicion) : "", avCerca: adicion ? "J2" : "J1" },
        proxControl: dx === "Sin alteración refractiva" ? 365 : pesos([[180, 35], [365, 55], [90, 10]]),
        conCita: rnd() < 0.82, hora: horaAmPm(elige(FRANJAS)),
      }
      previa = { dx, sphBase: consulta.sphBase, prom }
      p.consultas.push(consulta); consultas.push(consulta)
    }
  }
  consultas.sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultimaDe = (p) => p.consultas[p.consultas.length - 1]
  // Un par de pacientes "De alta" (tratamiento finalizado).
  atendidos.filter((p) => ultimaDe(p).dx === "Sin alteración refractiva").slice(0, 2).forEach((p) => (p.deAlta = true))

  // Referidos: 6 pacientes llegaron por recomendación de otro.
  const referidos = mezcla(pacientes).slice(0, 6)
  referidos.forEach((p, i) => { const r = pacientes[(pacientes.indexOf(p) + 7 + i) % pacientes.length]; if (r !== p) { p.referidoPorId = r.id; p.referidoPor = r.nombre } })

  // Primera fecha de registro: la de su primera consulta (o una reciente).
  for (const p of pacientes) p.registro = p.consultas[0]?.fecha ?? sumaDias(HOY, -entre(0, 20))
  // 5 pacientes registrados por la web; 3 de ellos sin confirmar por recepción.
  const web = pacientes.filter((p) => p.tipo === "web_nuevo").concat(mezcla(atendidos).slice(0, 1))
  web.forEach((p, i) => { p.origen = "paciente"; p.confirmado = i >= 3 })
  pacientes.forEach((p) => { p.origen ||= "staff"; p.confirmado ??= true })

  // ── 5. Inserción de pacientes ──
  for (const p of pacientes) {
    const u = ultimaDe(p)
    await Q(
      `insert into pacientes_base (id, optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta, referido_por, referido_por_id, fecha_registro,
         tiene_cuenta, origen, confirmado_recepcion, ultimo_saludo_cumple_anio, estado_clinico_enc, evolucion_enc, estado_correccion_enc)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,$13,$14,$15,$16,$17)`,
      [p.id, DEMO_ID, p.nombre, p.cedula, p.telefono, p.correo, p.nacimiento, u ? u.fecha : "Pendiente", p.referidoPor ?? null, null, p.registro,
        p.origen, p.confirmado, Number(HOY.slice(0, 4)),
        await cifrar(p.deAlta ? "De alta" : "Activo"), await cifrar(u ? u.evolucion : "Sin evaluación"), await cifrar(u ? u.estadoCorreccion : "Sin evaluación")],
    )
  }

  for (const p of pacientes) if (p.referidoPorId) await Q("update pacientes_base set referido_por_id = $2 where id = $1", [p.id, p.referidoPorId])

  // ── 6. Citas ──
  const citas = []
  const nuevaCita = (o) => {
    const id = o.id ?? randomUUID()
    const cita = { id, estado: "Pendiente", origen: "staff", ...o }
    cita.codigo = `CIT-${cita.fecha.slice(0, 4)}-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`
    citas.push(cita)
    return cita
  }
  // 6a. Una cita atendida por cada consulta con cita.
  for (const k of consultas) {
    if (!k.conCita) continue
    const cita = nuevaCita({ fecha: k.fecha, hora: k.hora, paciente: k.p, motivo: k.motivo, estado: "Atendida", atendidoPor: ADMIN, asignadoA: ADMIN, origen: k.p.origen, creadaEn: sumaDias(k.fecha, -entre(1, 6)) })
    k.cita = cita
  }
  // 6b. Últimas 6 semanas: inasistencias y canceladas (de pacientes ya atendidos).
  const pasadas = (n) => habil(sumaDias(HOY, -entre(2, 42)), -1)
  for (let i = 0; i < 6; i++) nuevaCita({ fecha: pasadas(), hora: horaAmPm(elige(FRANJAS)), paciente: elige(atendidos), motivo: elige(MOTIVOS)[0], estado: "No Asistió", asignadoA: ADMIN, creadaEn: sumaDias(HOY, -entre(43, 50)) })
  for (let i = 0; i < 4; i++) nuevaCita({ fecha: pasadas(), hora: horaAmPm(elige(FRANJAS)), paciente: elige(atendidos), motivo: elige(MOTIVOS)[0], estado: "Cancelada", canceladaPor: "paciente", asignadoA: ADMIN, creadaEn: sumaDias(HOY, -entre(43, 50)) })
  for (let i = 0; i < 3; i++) nuevaCita({ fecha: pasadas(), hora: horaAmPm(elige(FRANJAS)), paciente: elige(atendidos), motivo: elige(MOTIVOS)[0], estado: "Cancelada", canceladaPor: "recepcion", asignadoA: ADMIN, creadaEn: sumaDias(HOY, -entre(43, 50)) })
  // 6c. Hoy, según la hora actual: nada "Pendiente" en el pasado (el proceso automático lo marcaría "No asistió").
  const hoyCitas = []
  const pasadoHoy = FRANJAS.filter((m) => m + 15 < AHORA_MIN)
  const futuroHoy = FRANJAS.filter((m) => m > AHORA_MIN + 15)
  const librePac = mezcla(atendidos)
  let pi = 0
  const sig = () => librePac[pi++ % librePac.length]
  if (pasadoHoy.length >= 1) hoyCitas.push({ min: pasadoHoy[0], estado: "Atendida", atendidoPor: ADMIN })
  if (pasadoHoy.length >= 2) hoyCitas.push({ min: pasadoHoy[1], estado: "No Asistió" })
  if (pasadoHoy.length >= 3) hoyCitas.push({ min: pasadoHoy[pasadoHoy.length - 1], estado: "En Atención", atendidoPor: ADMIN })
  if (pasadoHoy.length >= 4) hoyCitas.push({ min: pasadoHoy[pasadoHoy.length - 2], estado: "En Espera" })
  futuroHoy.slice(0, 3).forEach((m) => hoyCitas.push({ min: m, estado: "Pendiente" }))
  if (HOY && diaSemana(HOY) !== 0) {
    for (const h of hoyCitas) nuevaCita({ fecha: HOY, hora: horaAmPm(h.min), paciente: sig(), motivo: elige(MOTIVOS)[0], estado: h.estado, atendidoPor: h.atendidoPor, asignadoA: ADMIN, creadaEn: sumaDias(HOY, -entre(1, 8)) })
  }
  // 6d. Próximas 3 semanas (con confirmaciones y alguna cancelada). Los pacientes web nuevos tienen su primera cita aquí.
  const proximas = []
  for (let d = 1; d <= 21; d++) {
    const f = sumaDias(HOY, d); if (diaSemana(f) === 0) continue
    const n = entre(0, 2)
    const horas = mezcla(FRANJAS).slice(0, n).sort((a, b) => a - b)
    horas.forEach((m) => proximas.push({ fecha: f, min: m }))
  }
  const webNuevos = pacientes.filter((p) => p.tipo === "web_nuevo")
  proximas.forEach((s, i) => {
    const esWeb = i < webNuevos.length
    const p = esWeb ? webNuevos[i] : sig()
    const estado = !esWeb && i % 9 === 4 ? "Cancelada" : "Pendiente"
    nuevaCita({
      fecha: s.fecha, hora: horaAmPm(s.min), paciente: p, motivo: elige(MOTIVOS)[0], estado, origen: esWeb || p.origen === "paciente" ? "paciente" : "staff",
      canceladaPor: estado === "Cancelada" ? "paciente" : undefined, asignadoA: ADMIN, confirmada: estado === "Pendiente" && i % 3 === 0,
      creadaEn: sumaDias(HOY, -entre(0, 6)),
    })
  })
  // Dos citas web sin paciente vinculado todavía ("por registrar").
  for (let i = 0; i < 2; i++) {
    const f = sumaDias(HOY, entre(2, 12)); if (diaSemana(f) === 0) continue
    nuevaCita({ fecha: f, hora: horaAmPm(elige(FRANJAS)), paciente: null, nombreLibre: ["Rafael Cedeño Pibaque", "Lorena Mero Vélez"][i], motivo: "Consulta General", origen: "paciente", creadaEn: sumaDias(HOY, -1) })
  }
  // Nunca dos citas en la misma hora el mismo día: si chocan, la cita se mueve a otra franja libre de ese día
  // (las de hoy conservan su hora, que depende del reloj); si no queda ninguna, se descarta solo si no tiene consulta.
  const enlazadas = new Set(consultas.filter((k) => k.cita).map((k) => k.cita.id))
  const ocupadas = new Set()
  citas.sort((a, b) => (a.fecha === HOY ? 0 : 1) - (b.fecha === HOY ? 0 : 1))
  for (let i = 0; i < citas.length; i++) {
    const ct = citas[i]
    if (!ocupadas.has(ct.fecha + ct.hora)) { ocupadas.add(ct.fecha + ct.hora); continue }
    const libre = FRANJAS.map(horaAmPm).find((h) => !ocupadas.has(ct.fecha + h))
    if (libre && ct.fecha !== HOY) { ct.hora = libre; ocupadas.add(ct.fecha + libre) }
    else if (!enlazadas.has(ct.id)) { citas.splice(i, 1); i-- }
    else throw new Error("No hay franja libre para una cita con consulta: " + ct.fecha)
  }

  for (const ct of citas) {
    const p = ct.paciente
    const nombre = p ? p.nombre : ct.nombreLibre
    await Q(
      `insert into citas_base (id, optica_id, paciente_id, paciente, cedula, telefono, correo, fecha, hora, motivo, motivo_publico, estado, origen, codigo, duracion_minutos,
         cancelada_por, asignado_a, atendido_por, recordatorio_enviado_at, encuesta_enviada_at, confirmada_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,40,$15,$16,$17, now(), now(), $18, $19)`,
      [ct.id, DEMO_ID, p ? p.id : null, nombre, p ? p.cedula : null, p ? p.telefono : "09" + String(entre(10000000, 99999999)), p ? p.correo : `${sinTildes(nombre.split(" ")[0])}.${sinTildes(nombre.split(" ")[1])}@example.com`,
        ct.fecha, ct.hora, ct.motivo, ct.origen === "paciente" ? ct.motivo : null, ct.estado, ct.origen, ct.codigo, ct.canceladaPor ?? null, ct.asignadoA ?? null, ct.atendidoPor ?? null,
        ct.confirmada ? timestampEC(sumaDias(HOY, -1), 15, 30) : null, timestampEC(ct.creadaEn ?? sumaDias(ct.fecha, -3), 11, 0)],
    )
  }

  // ── 7. Consultas (inserción) ──
  for (const k of consultas) {
    const dxTexto = `${k.cats.join(", ")} — ${k.dx === "Sin alteración refractiva" ? "Agudeza visual conservada, sin necesidad de corrección." : "Corrección óptica indicada según refracción."}`
    const datos = {
      retinoscopia: { od: `${k.od.esfera}`, oi: `${k.oi.esfera}` },
      od: k.od, oi: k.oi, medidas: k.medidas,
      examen: { pioOd: String(entre(12, 18)), pioOi: String(entre(12, 18)), testColor: "Normal", testMotor: "Normal", oftalmoscopia: "Fondo de ojo normal", biomicroscopia: { camara: "Profunda y quieta", cornea: "Transparente", parpados: "Sin alteraciones" }, coverTestCerca: "Ortoforia", coverTestLejos: "Ortoforia" },
    }
    await Q(
      `insert into consultas_base (id, optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, lente_recomendado, proximo_control_dias, evolucion_calculada, estado_correccion,
         profesional_nombre, profesional_id, cita_id, diagnostico_categorias, imagenes, created_at,
         diagnostico_enc, antecedentes_enc, alergias_enc, antecedentes_familiares_enc, indicaciones_enc, datos_clinicos_enc, detalle_consulta_enc)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'[]'::jsonb,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [k.id, DEMO_ID, k.p.id, k.p.nombre, k.fecha, k.motivo, k.p.consultas[0] !== k, k.lenteRecomendado || null, k.proxControl, k.evolucion, k.estadoCorreccion,
        ADMIN_NOMBRE, ADMIN, k.cita ? k.cita.id : null, k.cats, timestampEC(k.fecha, 10, 30),
        await cifrar(dxTexto), await cifrar(elige(TXT_ANTECEDENTES)), await cifrar(elige(TXT_ALERGIAS)), await cifrar("Sin antecedentes familiares relevantes"),
        await cifrar(elige(INDICACIONES)), await cifrar(JSON.stringify(datos)), await cifrar(k.motivo === "Garantía / Ajuste" ? "Ajuste de plaquetas y revisión de ajuste general." : null)],
    )
  }

  // ── 8. Pases a venta, ventas, abonos y órdenes de laboratorio ──
  // Consultas con lente recomendado y al menos 3 días de antigüedad (las más nuevas quedan "en espera").
  const candidatas = consultas.filter((k) => k.lenteRecomendado)
  const recientes = candidatas.filter((k) => diasEntre(k.fecha, HOY) <= 12).slice(-5)
  const resto = candidatas.filter((k) => !recientes.includes(k))
  const reparto = mezcla(resto)
  const NUM_VENDIDOS = Math.min(20, Math.floor(reparto.length * 0.62))
  const vendidas = reparto.slice(0, NUM_VENDIDOS)
  const descartadas = reparto.slice(NUM_VENDIDOS, NUM_VENDIDOS + Math.min(8, reparto.length - NUM_VENDIDOS))
  const MOTIVOS_DESC = [["precio", null], ["precio", null], ["lo_pensara", null], ["lo_pensara", null], ["otro_lugar", null], ["otro_lugar", null], ["otro", "Prefirió esperar a su próximo pago"], ["precio", null]]

  const pase = async (k, extra = {}) => {
    const id = randomUUID()
    await Q(`insert into pases_a_venta (id, optica_id, consulta_id, paciente_id, cita_id, estado, pasada_por, pasada_en) values ($1,$2,$3,$4,$5,'listo',$6,$7)`,
      [id, DEMO_ID, k.id, k.p.id, k.cita ? k.cita.id : null, ADMIN, timestampEC(k.fecha, 11, 15)])
    return id
  }
  for (const k of recientes) await pase(k) // en espera
  for (const [i, k] of descartadas.entries()) {
    const id = await pase(k)
    const [motivo, detalle] = MOTIVOS_DESC[i % MOTIVOS_DESC.length]
    const proforma = i % 2 === 0 ? redondear(entre(70, 240)) : null
    await Q(`update pases_a_venta set estado='descartado', motivo_descarte=$2, detalle_descarte=$3, cerrada_por=$4, cerrada_en=$5, proforma_entregada_en=$6, proforma_total=$7 where id=$1`,
      [id, motivo, detalle, ADMIN, timestampEC(sumaDias(k.fecha, entre(0, 2)), 12, 0), proforma ? timestampEC(k.fecha, 11, 40) : null, proforma])
  }

  let numeroFactura = 0
  let numeroOrden = 0
  const ventas = []
  const ventasOrdenadas = vendidas.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
  const metodos = ["directo", "directo", "directo", "tarjeta", "tarjeta", "cuotas", "cuotas", "abonos", "abonos", "abonos", "abonos", "directo", "tarjeta", "abonos", "cuotas", "directo", "abonos", "tarjeta", "directo", "abonos"]
  // Las 8 ventas más recientes entre las de consultas con 25+ días tienen su orden abierta (en espera, atrasada o lista);
  // el paciente volvió a comprar días después de la consulta. Las demás órdenes están entregadas.
  const PLANES_ABIERTOS = ["enviada", "lista_sin_avisar", "atrasada", "lista_sin_avisar", "atrasada", "lista_avisada", "atrasada", "enviada"]
  const idxAbiertas = ventasOrdenadas.map((k, i) => [k, i]).filter(([k, i]) => i !== 3 && diasEntre(k.fecha, HOY) >= 25).slice(-PLANES_ABIERTOS.length).map(([, i]) => i)
  for (const [i, k] of ventasOrdenadas.entries()) {
    const id = randomUUID()
    const lab = LABORATORIOS[i % LABORATORIOS.length]
    const duracion = entre(lab.dias[0], lab.dias[1])
    const planAbierto = PLANES_ABIERTOS[idxAbiertas.indexOf(i)] // undefined si no es una de las abiertas
    const edadAbierta = { enviada: entre(1, 3), atrasada: entre(10, 16), lista_sin_avisar: duracion + entre(1, 3), lista_avisada: duracion + 2 }[planAbierto]
    const fechaVenta = planAbierto ? sumaDias(HOY, -edadAbierta) : (sumaDias(k.fecha, entre(0, 2)) > HOY ? k.fecha : sumaDias(k.fecha, entre(0, 2)))
    const montura = elige(armazones)
    montura.vendidas++
    const tipo = k.tipoLente || "monofocal"
    const material = elige(MATERIALES)
    const trat = { antirreflejo: rnd() < 0.6, filtroAzul: rnd() < 0.45, fotocromatico: rnd() < 0.2 }
    const precioLuna = redondear((tipo === "progresivo" ? entre(130, 210) : tipo === "bifocal" ? entre(75, 105) : entre(38, 70)) + (trat.antirreflejo ? 18 : 0) + (trat.filtroAzul ? 15 : 0) + (trat.fotocromatico ? 28 : 0) + (material === "Alto índice 1.67" ? 45 : 0))
    const descTrat = [trat.antirreflejo && "antirreflejo", trat.filtroAzul && "filtro azul", trat.fotocromatico && "fotocromático"].filter(Boolean).join(", ")
    const etiqueta = { monofocal: "Monofocal", bifocal: "Bifocal", progresivo: "Progresivo" }[tipo]
    const lineas = [
      { tipo: "producto", productoId: montura.id, descripcion: montura.nombre, cantidad: 1, precio: montura.precio, detalle: null },
      { tipo: "luna", productoId: null, descripcion: `Luna: ${[etiqueta, material, descTrat].filter(Boolean).join(" · ")}`, cantidad: 1, precio: precioLuna, detalle: { tipo_lente: tipo, material, antirreflejo: trat.antirreflejo, filtro_azul: trat.filtroAzul, fotocromatico: trat.fotocromatico, otros_tratamientos: null } },
    ]
    if (rnd() < 0.35) lineas.push({ tipo: "servicio", productoId: null, descripcion: "Limpieza y ajuste de montura", cantidad: 1, precio: 5, detalle: null })
    if (rnd() < 0.2) { const acc = elige(inv.filter((p) => p.categoria === "Accesorios")); acc.vendidas++; lineas.push({ tipo: "producto", productoId: acc.id, descripcion: acc.nombre, cantidad: 1, precio: acc.precio, detalle: null }) }
    const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0))
    const metodo = metodos[i % metodos.length]
    const anulada = i === 3 // una venta anulada, con su orden cancelada
    // Pagos
    let abonos = [], cuotasTotales = null, cuotasPagadas = 0, estado
    if (metodo === "directo" || metodo === "tarjeta") { estado = "pagada" }
    else if (metodo === "cuotas") {
      cuotasTotales = elige([2, 3, 4])
      const diasDesde = diasEntre(fechaVenta, HOY)
      cuotasPagadas = Math.min(cuotasTotales, Math.max(1, Math.floor(diasDesde / 30) + 1))
      if (i % 5 === 0) cuotasPagadas = cuotasTotales
      const cuota = redondear(total / cuotasTotales)
      for (let q = 0; q < cuotasPagadas; q++) {
        const ultima = q === cuotasTotales - 1
        const fecha = sumaDias(fechaVenta, 30 * q); if (fecha > HOY) break
        abonos.push({ fecha, monto: ultima ? redondear(total - cuota * (cuotasTotales - 1)) : cuota, nota: `Cuota ${q + 1} de ${cuotasTotales}` })
      }
      cuotasPagadas = abonos.length
      estado = cuotasPagadas >= cuotasTotales ? "pagada" : "pendiente_pago"
    } else { // abonos libres
      const inicial = redondear(total * elige([0.3, 0.4, 0.5]))
      abonos.push({ fecha: fechaVenta, monto: inicial, nota: "Abono inicial" })
      let pagado = inicial
      const extra = elige([0, 1, 2])
      for (let q = 1; q <= extra; q++) {
        const f = sumaDias(fechaVenta, 12 * q); if (f > HOY) break
        const m = redondear(Math.min(total - pagado, total * elige([0.15, 0.2, 0.25])))
        if (m <= 0) break
        abonos.push({ fecha: f, monto: m, nota: "Abono" }); pagado = redondear(pagado + m)
      }
      if (i % 4 === 1 && pagado < total && sumaDias(fechaVenta, 45) <= HOY) { abonos.push({ fecha: sumaDias(fechaVenta, 45), monto: redondear(total - pagado), nota: "Cancelación del saldo" }); pagado = total }
      estado = redondear(pagado) >= total ? "pagada" : "pendiente_pago"
    }
    if (anulada) { estado = "anulada"; abonos = [] }
    await pase(k)
    numeroFactura++
    const creada = timestampEC(fechaVenta, 12, entre(0, 50))
    await Q(
      `insert into facturas_venta (id, optica_id, paciente_id, cita_id, consulta_id, metodo_pago, cuotas_totales, cuotas_pagadas, monto_total, estado, anulada_motivo, anulada_at, anulada_por, registrado_por, created_at, numero, factura_electronica)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, DEMO_ID, k.p.id, k.cita ? k.cita.id : null, k.id, metodo, cuotasTotales, cuotasPagadas, total, estado,
        anulada ? "Venta de demostración anulada: el paciente cambió de montura" : null, anulada ? timestampEC(sumaDias(fechaVenta, 1), 16, 0) : null, anulada ? ADMIN : null,
        ADMIN, creada, numeroFactura, i % 2 === 0 && !anulada ? `001-001-${String(1200 + i).padStart(9, "0")}` : null],
    )
    for (const l of lineas) {
      await Q(`insert into facturas_venta_lineas (factura_id, producto_id, tipo, descripcion, cantidad, precio_unitario, subtotal, detalle, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, l.productoId, l.tipo, l.descripcion, l.cantidad, l.precio, redondear(l.cantidad * l.precio), l.detalle ? JSON.stringify(l.detalle) : null, creada])
    }
    for (const a of abonos) await Q(`insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por) values ($1,$2,$3,$4,$5,$6)`, [DEMO_ID, id, a.monto, a.fecha, a.nota, ADMIN])
    ventas.push({ id, k, fechaVenta, tipo, material, trat, montura, anulada, estado, plan: anulada ? "cancelada" : planAbierto || "entregada", lab, duracion })
    // El disparador marca el pase como vendido con la fecha de hoy: se deja la fecha real de la venta.
    await Q(`update pases_a_venta set cerrada_en = $2 where consulta_id = $1 and estado = 'vendido'`, [k.id, creada])
  }
  // Pases anulados vuelven a "listo" por el disparador (igual que en el sistema real); la anulada deja el suyo en espera.

  // Órdenes de laboratorio: una por venta; estados repartidos (la anulada queda cancelada).
  const ordenadas = ventas.slice().sort((a, b) => a.fechaVenta.localeCompare(b.fechaVenta))
  const hechas = []
  for (const v of ordenadas) {
    const { plan, lab, duracion } = v
    const estado = plan === "cancelada" ? "cancelada" : plan.startsWith("lista") ? "lista" : plan === "atrasada" ? "enviada" : plan
    const promesa = plan === "atrasada" ? sumaDias(HOY, -entre(1, 4)) : plan === "enviada" ? sumaDias(HOY, entre(2, 6)) : sumaDias(v.fechaVenta, entre(duracion, duracion + 3))
    const id = randomUUID()
    numeroOrden++
    const k = v.k
    const receta = (o) => ({ esfera: o.esfera, cilindro: o.cilindro, eje: o.eje, adicion: k.medidas.adicion || "" })
    const creadaEn = timestampEC(v.fechaVenta, 13, entre(0, 50))
    const fechaLista = sumaDias(v.fechaVenta, duracion - 1 > 0 ? duracion - 1 : 1)
    const fechaEntrega = sumaDias(v.fechaVenta, duracion)
    const avisadaEn = estado === "entregada" || plan === "lista_avisada" ? timestampEC(estado === "entregada" ? fechaLista : sumaDias(HOY, -1), 15, 0) : null
    await Q(
      `insert into ordenes_laboratorio (id, optica_id, numero, factura_id, consulta_id, paciente_id, cita_id, receta_od, receta_oi, dp_lejos, dp_cerca, altura_montaje, tipo_lente, material,
         antirreflejo, filtro_azul, fotocromatico, otros_tratamientos, montura, montura_medidas, laboratorio, fecha_prometida, observaciones, estado, creada_por, creada_en, paciente_avisado_en, paciente_avisado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,null,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
      [id, DEMO_ID, numeroOrden, v.id, k.id, k.p.id, k.cita ? k.cita.id : null, JSON.stringify(receta(k.od)), JSON.stringify(receta(k.oi)), k.medidas.dp, k.medidas.adicion ? String(Number(k.medidas.dp) - 2) : null, k.medidas.alt,
        v.tipo, v.material, v.trat.antirreflejo, v.trat.filtroAzul, v.trat.fotocromatico, v.montura.nombre, null, lab.nombre, promesa, k.lenteRecomendado ? `Lente recomendado: ${k.lenteRecomendado}` : null,
        estado, ADMIN, creadaEn, avisadaEn, avisadaEn ? ADMIN : null],
    )
    await Q(`insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, cambiado_en) values ($1,'enviada',$2,$3)`, [id, ADMIN, creadaEn])
    if (estado === "lista" || estado === "entregada") await Q(`insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, cambiado_en) values ($1,'lista',$2,$3)`, [id, ADMIN, timestampEC(fechaLista, 11, 0)])
    if (estado === "entregada") await Q(`insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, cambiado_en) values ($1,'entregada',$2,$3)`, [id, ADMIN, timestampEC(fechaEntrega, 16, 0)])
    if (estado === "cancelada") await Q(`insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, cambiado_en, nota) values ($1,'cancelada',$2,$3,'Venta anulada')`, [id, ADMIN, timestampEC(sumaDias(v.fechaVenta, 1), 16, 5)])
    hechas.push({ estado, plan })
  }

  // Contadores y stock
  await Q(`insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1,$2) on conflict (optica_id) do update set ultimo_numero = excluded.ultimo_numero`, [DEMO_ID, numeroFactura])
  await Q(`insert into contador_ordenes_laboratorio (optica_id, ultimo_numero) values ($1,$2) on conflict (optica_id) do update set ultimo_numero = excluded.ultimo_numero`, [DEMO_ID, numeroOrden])
  for (const p of inv) {
    let stock = Math.max(0, stockInicial.get(p.id) - p.vendidas)
    if (p === bajos[3]) stock = 0 // una montura agotada
    if (p.categoria === "Accesorios" && p === inv.find((x) => x.categoria === "Accesorios")) stock = 4 // un accesorio bajo el mínimo
    await Q("update inventario set stock = $2 where id = $1", [p.id, stock])
  }

  // Encuestas de satisfacción de algunas citas atendidas (para el reporte).
  const atendidasCitas = citas.filter((x) => x.estado === "Atendida" && x.fecha < HOY)
  const puntajes = [5, 5, 5, 5, 5, 5, 4, 4, 4, 3, 3, 2]
  for (const [i, ct] of mezcla(atendidasCitas).slice(0, puntajes.length).entries()) {
    await Q(`insert into respuestas_satisfaccion (optica_id, cita_id, puntaje, comentario, created_at) values ($1,$2,$3,$4,$5)`,
      [DEMO_ID, ct.id, puntajes[i], puntajes[i] >= 5 ? "Excelente atención" : puntajes[i] === 4 ? "Muy buen servicio" : puntajes[i] === 3 ? "Tardaron un poco en atenderme" : "Esperé demasiado", timestampEC(sumaDias(ct.fecha, 1), 9, 0)])
  }

  // Consultas sin cita: el paciente "llegó sin cita" (R24); nada más que hacer.

  // ── 9. Verificaciones (todas deben pasar, si no se revierte todo) ──
  out("\nVerificaciones:")
  const fallos = []
  const check = async (nombre, sql, esperado, params = [DEMO_ID]) => {
    const { rows: [r] } = await Q(sql, params)
    const valor = Object.values(r)[0]
    const bien = typeof esperado === "function" ? esperado(Number(valor)) : String(valor) === String(esperado)
    out(`  ${bien ? "✔" : "✘"} ${nombre}: ${valor}`)
    if (!bien) fallos.push(nombre)
  }
  await check("pacientes insertados", "select count(*) from pacientes_base where optica_id=$1", NUM_PAC)
  await check("cédulas inválidas", "select count(*) from pacientes_base where optica_id=$1 and not cedula_ecuatoriana_valida(cedula)", 0)
  await check("cédulas repetidas", "select count(*)-count(distinct cedula) from pacientes_base where optica_id=$1", 0)
  await check("correos que no son @example.com", "select count(*) from (select correo from pacientes_base where optica_id=$1 union all select correo from citas_base where optica_id=$1) t where correo not like '%@example.com'", 0)
  await check("horas fuera del formato hh:mm AM/PM", "select count(*) from citas_base where optica_id=$1 and hora !~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$'", 0)
  await check("citas por estado (hoy y futuras incluidas)", "select string_agg(estado||'='||n, ', ' order by estado) from (select estado, count(*) n from citas_base where optica_id=$1 group by estado) t", (_) => true)
  await check("citas 'Pendiente' ya vencidas (las marcaría el proceso automático)", "select count(*) from citas_base where optica_id=$1 and estado='Pendiente' and (fecha + to_timestamp(hora,'HH12:MI AM')::time + interval '10 minutes') < (now() at time zone 'America/Guayaquil')", 0)
  await check("citas elegibles para recordatorio por correo", "select count(*) from citas_base where optica_id=$1 and estado='Pendiente' and recordatorio_enviado_at is null", 0)
  await check("citas que podrían disparar la encuesta por correo", "select count(*) from citas_base where optica_id=$1 and encuesta_enviada_at is null", 0)
  await check("pacientes elegibles para saludo de cumpleaños", "select count(*) from pacientes_base where optica_id=$1 and coalesce(ultimo_saludo_cumple_anio,0) < extract(year from now())::int", 0)
  await check("consultas", "select count(*) from consultas_base where optica_id=$1", consultas.length)
  await check("consultas legibles por la vista de la app (diagnóstico descifrado)", "select count(*) from consultas where optica_id=$1 and diagnostico is not null and diagnostico <> '' and datos_clinicos is not null", consultas.length)
  await check("pacientes legibles por la vista (estado clínico descifrado)", "select count(*) from pacientes where optica_id=$1 and estado_clinico in ('Activo','De alta')", NUM_PAC)
  await check("consultas de los últimos 6 meses por mes (distintos)", "select count(distinct to_char(fecha,'YYYY-MM')) from consultas_base where optica_id=$1 and fecha >= (now() - interval '6 months')::date", (n) => n >= 5)
  await check("pases por estado", "select string_agg(estado||'='||n, ', ' order by estado) from (select estado, count(*) n from pases_a_venta where optica_id=$1 group by estado) t", (_) => true)
  await check("pases descartados sin motivo", "select count(*) from pases_a_venta where optica_id=$1 and estado='descartado' and motivo_descarte is null", 0)
  await check("ventas por estado", "select string_agg(estado||'='||n, ', ' order by estado) from (select estado, count(*) n from facturas_venta where optica_id=$1 group by estado) t", (_) => true)
  await check("ventas con saldo pendiente", "select count(*) from facturas_venta f where optica_id=$1 and estado='pendiente_pago'", (n) => n >= 3)
  await check("abonos que superan el total de su venta", "select count(*) from (select f.id from facturas_venta f join abonos_factura a on a.factura_id=f.id where f.optica_id=$1 group by f.id, f.monto_total having sum(a.monto) > f.monto_total) t", 0)
  await check("ventas 'pagada' sin el total abonado (abonos/cuotas)", "select count(*) from facturas_venta f where optica_id=$1 and metodo_pago in ('abonos','cuotas') and estado='pagada' and (select coalesce(sum(monto),0) from abonos_factura where factura_id=f.id) <> f.monto_total", 0)
  await check("ventas 'pendiente_pago' ya cubiertas", "select count(*) from facturas_venta f where optica_id=$1 and estado='pendiente_pago' and (select coalesce(sum(monto),0) from abonos_factura where factura_id=f.id) >= f.monto_total", 0)
  await check("números de comprobante repetidos", "select count(*)-count(distinct numero) from facturas_venta where optica_id=$1", 0)
  await check("órdenes por estado", "select string_agg(estado||'='||n, ', ' order by estado) from (select estado, count(*) n from ordenes_laboratorio where optica_id=$1 group by estado) t", (_) => true)
  await check("órdenes atrasadas (enviada con fecha vencida)", "select count(*) from ordenes_laboratorio where optica_id=$1 and estado='enviada' and fecha_prometida < (now() at time zone 'America/Guayaquil')::date", (n) => n >= 3)
  await check("órdenes 'lista' sin avisar", "select count(*) from ordenes_laboratorio where optica_id=$1 and estado='lista' and paciente_avisado_en is null", (n) => n >= 1)
  await check("órdenes entregadas sin fecha de entrega en el historial", "select count(*) from ordenes_laboratorio o where optica_id=$1 and estado='entregada' and not exists (select 1 from ordenes_laboratorio_historial h where h.orden_id=o.id and h.estado='entregada')", 0)
  await check("monturas bajo el stock mínimo", "select count(*) from inventario where optica_id=$1 and stock <= critico", (n) => n >= 3)
  await check("stock negativo", "select count(*) from inventario where optica_id=$1 and stock < 0", 0)

  // Ninguna otra óptica cambió.
  const despuesOtras = await contar(false)
  const cambiaron = TABLAS.filter((t) => despuesOtras[t] !== antesOtras[t])
  out(`  ${cambiaron.length ? "✘" : "✔"} filas de las otras ópticas sin cambios: ${cambiaron.length ? cambiaron.map((t) => `${t} ${antesOtras[t]}→${despuesOtras[t]}`).join(", ") : "iguales en las " + TABLAS.length + " tablas"}`)
  if (cambiaron.length) fallos.push("otras ópticas modificadas")
  const { rows: [fuera] } = await Q("select count(*) n from facturas_venta where optica_id <> $1 and created_at > now() - interval '1 minute'", [DEMO_ID])
  if (Number(fuera.n) > 0) fallos.push("facturas en otra óptica")

  const despuesDemo = await contar(true)
  out("\nResumen de lo creado en la Óptica Demo:")
  for (const t of TABLAS) out(`  ${t.padEnd(26)} ${despuesDemo[t]}`)
  out(`  ${"(comprobantes hasta CV-".padEnd(26)} ${String(numeroFactura).padStart(4, "0")}), órdenes hasta OL-${String(numeroOrden).padStart(4, "0")}`)

  if (fallos.length) throw new Error(`ABORTO: fallaron verificaciones: ${fallos.join("; ")}`)

  if (EJECUTAR) { await c.query("commit"); ok = true; out("\n✔ COMMIT: los datos quedaron escritos en la Óptica Demo.") }
  else { await c.query("rollback"); ok = true; out("\n↩ ENSAYO terminado: ROLLBACK, no se escribió nada. Para escribir de verdad: --ejecutar") }
} catch (e) {
  try { await c.query("rollback") } catch { /* ya revertido */ }
  console.error("\n✘ " + (e.message || e))
  process.exitCode = 1
} finally {
  if (ok && !EJECUTAR) {
    const { rows: [r] } = await c.query("select count(*) n from pacientes_base where optica_id = $1", [DEMO_ID])
    out(`Comprobación posterior: la Óptica Demo tiene ${r.n} pacientes (debe ser 0).`)
  }
  await c.end()
}
