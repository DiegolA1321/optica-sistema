// Corrige los datos clínicos de la Óptica Demo para que cada diagnóstico coincida con su graduación
// (miopía con esfera negativa, hipermetropía con esfera positiva, astigmatismo con cilindro, presbicia con
// adición y edad de 40 años o más), con valores realistas y una evolución coherente entre consultas del
// mismo paciente. También: la consulta que le faltaba a una cita "Atendida" y el nombre del administrador
// ("Demo" → "Administrador Demo").
//
//   node --env-file=.env.local scripts/corregir-datos-demo.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/corregir-datos-demo.mjs --ejecutar   # escribe de verdad
//
// Seguridad: aborta si la óptica objetivo no es exactamente "Óptica Demo"; solo toca filas de esa óptica; al terminar
// compara el conteo de filas de las demás ópticas (y de mensajes/avisos) antes y después. Es determinista: misma
// semilla, mismos valores. No envía nada.
import pg from "pg"

const EJECUTAR = process.argv.includes("--ejecutar")
const NOMBRE_OPTICA = "Óptica Demo"

// ── Generador pseudoaleatorio determinista (mulberry32) con semilla por texto ──
function hash(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function rng(semilla) {
  let a = hash(semilla)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const elegir = (r, lista) => lista[Math.floor(r() * lista.length)]
const paso = (x) => Math.round(x * 4) / 4 // múltiplos de 0,25
const fmt = (x) => (x === 0 ? "0.00" : `${x > 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`)
const fmtEsfera = (x) => (x === 0 ? "0.00" : fmt(x))

const SNELLEN = ["20/20", "20/25", "20/30", "20/40", "20/50", "20/70", "20/100", "20/200"]
const edadEn = (nacimiento, fecha) => {
  const n = new Date(nacimiento), f = new Date(fecha)
  let e = f.getUTCFullYear() - n.getUTCFullYear()
  if (f.getUTCMonth() < n.getUTCMonth() || (f.getUTCMonth() === n.getUTCMonth() && f.getUTCDate() < n.getUTCDate())) e--
  return e
}
const ee = (esf, cil) => esf + cil / 2
const iso = (d) => new Date(d).toISOString().slice(0, 10)

// Agudeza sin corrección según el equivalente esférico del ojo (más ametropía, peor agudeza).
function avSinCorreccion(r, eeOjo) {
  const a = Math.abs(eeOjo)
  const base = a < 0.5 ? 0 : a < 0.75 ? 1 : a < 1.25 ? 2 : a < 1.75 ? 3 : a < 2.5 ? 4 : a < 3.5 ? 5 : a < 5 ? 6 : 7
  const jitter = a < 0.5 ? 0 : r() < 0.3 ? 1 : 0
  return SNELLEN[Math.min(7, base + jitter)]
}

const ADICION_POR_EDAD = (edad) => (edad < 45 ? 1.0 : edad < 50 ? 1.5 : edad < 55 ? 2.0 : edad < 60 ? 2.25 : edad < 65 ? 2.5 : 2.75)

// Categorías (las del vocabulario de diagnósticos rápidos de la óptica).
const CAT = { M: "Miopía", H: "Hipermetropía", A: "Astigmatismo", MA: "Miopía y astigmatismo", HA: "Hipermetropía y astigmatismo", P: "Presbicia", S: "Sin alteración refractiva" }

// Refracción base de un ojo según la categoría "óptica" (no presbicia) del paciente.
function baseOjo(r, cat, edad) {
  const neg = (min, max) => -paso(min + r() * (max - min))
  const pos = (min, max) => paso(min + r() * (max - min))
  const ejeComun = () => elegir(r, [90, 90, 180, 180, 5, 175, 85, 10, 170])
  switch (cat) {
    case CAT.M: return { esfera: edad < 18 ? neg(0.5, 3.0) : neg(0.75, 4.5), cilindro: r() < 0.25 ? -0.25 : 0 }
    case CAT.H: return { esfera: pos(0.5, 3.0), cilindro: r() < 0.25 ? -0.25 : 0 }
    case CAT.A: return { esfera: elegir(r, [-0.25, 0, 0.25, 0.5]), cilindro: neg(0.75, 2.5), eje: ejeComun() }
    case CAT.MA: return { esfera: neg(0.75, 4.0), cilindro: neg(0.75, 2.25), eje: ejeComun() }
    case CAT.HA: return { esfera: pos(0.5, 3.0), cilindro: neg(0.75, 2.0), eje: ejeComun() }
    default: return { esfera: elegir(r, [-0.25, 0, 0, 0.25]), cilindro: 0 } // sin alteración o solo presbicia
  }
}

// Una visita posterior: evolución pequeña y plausible respecto de la anterior.
function evolucionar(r, ojo, cat, edad, meses) {
  const o = { ...ojo }
  const x = r()
  let d = 0
  if (cat === CAT.M || cat === CAT.MA) d = edad < 25 ? (x < 0.6 ? -0.25 - (r() < 0.3 ? 0.25 : 0) : 0) : x < 0.5 ? 0 : x < 0.8 ? -0.25 : x < 0.92 ? 0.25 : -0.5
  else if (cat === CAT.H || cat === CAT.HA) d = x < 0.55 ? 0 : x < 0.8 ? 0.25 : -0.25
  else d = x < 0.7 ? 0 : x < 0.85 ? 0.25 : -0.25
  if (meses < 3) d = Math.abs(d) > 0.25 ? Math.sign(d) * 0.25 : d // consultas muy seguidas: casi sin cambio
  o.esfera = paso(o.esfera + d)
  if (o.cilindro && r() < 0.25) o.cilindro = Math.min(-0.5, Math.max(-3, paso(o.cilindro + (r() < 0.5 ? -0.25 : 0.25))))
  if (o.eje != null && r() < 0.3) o.eje = Math.min(180, Math.max(1, o.eje + elegir(r, [-5, 5, 10, -10])))
  return o
}

const variacion = (a, b) => {
  const difs = ["od", "oi"].map((k) => Math.abs(ee(a[k].esfera, a[k].cilindro)) - Math.abs(ee(b[k].esfera, b[k].cilindro)))
  return difs.reduce((s, x) => s + x, 0) / difs.length
}
const verdicto = (v) => (Math.abs(v) < 0.25 ? "Sin cambios" : v > 0 ? "Aumentó" : "Disminuyó")

const client = new pg.Client()
await client.connect()
await client.query("begin")
const informe = []
try {
  const { rows: opts } = await client.query("select id, nombre from opticas order by nombre")
  const demo = opts.filter((o) => o.nombre === NOMBRE_OPTICA)
  if (demo.length !== 1) throw new Error(`Se esperaba exactamente una óptica "${NOMBRE_OPTICA}" y hay ${demo.length}`)
  const O = demo[0].id
  const conteo = async () => {
    const t = {}
    for (const tabla of ["consultas", "pacientes", "citas", "ordenes_laboratorio", "facturas_venta", "perfiles", "logs_optica"]) {
      const { rows } = await client.query(`select optica_id, count(*)::int n from ${tabla} where optica_id <> $1 group by 1 order by 1`, [O])
      t[tabla] = JSON.stringify(rows)
    }
    for (const tabla of ["mensajes", "avisos"]) {
      const { rows } = await client.query(`select count(*)::int n from ${tabla}`)
      t[tabla] = rows[0].n
    }
    return t
  }
  const antes = await conteo()

  // ── 1. Carga ──
  const { rows: consultas } = await client.query(
    `select c.id, c.paciente_id, c.fecha::text fecha, c.cita_id, c.datos_clinicos, c.diagnostico, c.diagnostico_categorias, c.lente_recomendado, c.indicaciones,
            p.fecha_nacimiento::text nacimiento, p.nombre paciente
       from consultas c join pacientes p on p.id = c.paciente_id
      where c.optica_id = $1 order by c.paciente_id, c.fecha, c.created_at`, [O])
  const { rows: vendidas } = await client.query(
    `select f.consulta_id, l.detalle->>'tipo_lente' tipo
       from facturas_venta f join facturas_venta_lineas l on l.factura_id = f.id
      where f.optica_id = $1 and f.estado <> 'anulada' and l.tipo = 'luna' and f.consulta_id is not null`, [O])
  const tipoVendido = new Map(vendidas.map((v) => [v.consulta_id, v.tipo]))

  // Una cita "Atendida" sin consulta: se le crea la ficha que debería tener.
  const { rows: sinFicha } = await client.query(
    `select c.id, c.paciente_id, c.fecha::text fecha, c.motivo, c.atendido_por, p.fecha_nacimiento::text nacimiento, p.nombre paciente,
            (select nombre from perfiles where id = c.atendido_por) profesional
       from citas c join pacientes p on p.id = c.paciente_id
      where c.optica_id = $1 and c.estado = 'Atendida' and not exists (select 1 from consultas k where k.cita_id = c.id)`, [O])
  for (const c of sinFicha) {
    consultas.push({
      id: null, paciente_id: c.paciente_id, fecha: c.fecha, cita_id: c.id, datos_clinicos: null, diagnostico: "", diagnostico_categorias: [],
      lente_recomendado: null, indicaciones: null, nacimiento: c.nacimiento, paciente: c.paciente, nueva: c, motivo: c.motivo,
    })
  }
  consultas.sort((a, b) => (a.paciente_id < b.paciente_id ? -1 : a.paciente_id > b.paciente_id ? 1 : a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))

  const porPaciente = new Map()
  for (const c of consultas) porPaciente.set(c.paciente_id, [...(porPaciente.get(c.paciente_id) || []), c])

  const residuales = []
  const cambios = [] // { consulta, nuevo }
  for (const [pid, lista] of porPaciente) {
    const r = rng("demo-clinico-" + pid)
    const edadFinal = edadEn(lista[0].nacimiento, lista[lista.length - 1].fecha)
    const vendeAvanzada = lista.some((c) => ["progresivo", "bifocal"].includes(tipoVendido.get(c.id)))

    // Categorías del paciente: se conservan las que ya tenía si son válidas para su edad.
    const previas = new Set(lista.flatMap((c) => c.diagnostico_categorias || []))
    let cats = [...previas].filter((c) => c !== CAT.P || edadFinal >= 40)
    if (cats.length === 0) cats = [elegir(r, edadFinal < 40 ? [CAT.M, CAT.M, CAT.MA, CAT.A, CAT.H, CAT.HA] : [CAT.M, CAT.A, CAT.H, CAT.MA, CAT.HA])]
    if (cats.length > 1) cats = [cats.find((c) => c !== CAT.P && c !== CAT.S) || cats[0]]
    const venta = lista.find((c) => ["progresivo", "bifocal"].includes(tipoVendido.get(c.id)))
    const quierePresbicia = edadFinal >= 40 && (vendeAvanzada || previas.has(CAT.P))
    if (quierePresbicia) cats = [CAT.P, ...cats.filter((c) => c !== CAT.P && c !== CAT.S)].slice(0, 2)
    cats = cats.filter((c, i) => cats.indexOf(c) === i)
    if (vendeAvanzada && edadFinal < 40) residuales.push(`${lista[0].paciente} (${edadFinal} años): lente ${tipoVendido.get(venta.id)} vendido, dato operativo que no se toca`)

    const optica = cats.find((c) => c !== CAT.P) || CAT.S
    let od = null, oi = null, adicion = 0, previo = null, previaFecha = null
    lista.forEach((c, i) => {
      const edad = edadEn(c.nacimiento, c.fecha)
      const conPresbicia = cats.includes(CAT.P) && edad >= 40
      const catsConsulta = conPresbicia ? cats : cats.filter((x) => x !== CAT.P).length ? cats.filter((x) => x !== CAT.P) : [CAT.S]
      const opticaC = catsConsulta.find((x) => x !== CAT.P) || CAT.S
      if (i === 0) {
        od = baseOjo(r, opticaC, edad)
        const b = baseOjo(r, opticaC, edad)
        // El otro ojo se parece al primero (anisometropía pequeña), no es un sorteo independiente.
        oi = { esfera: paso(od.esfera + elegir(r, [0, 0, 0.25, -0.25, 0.5])), cilindro: od.cilindro ? Math.min(-0.5, Math.max(-3, paso(od.cilindro + elegir(r, [0, 0, 0.25, -0.25])))) : b.cilindro && r() < 0.1 ? -0.25 : 0 }
        if (od.eje != null) oi.eje = Math.min(180, Math.max(1, 180 - od.eje + elegir(r, [0, 5, -5])))
        adicion = conPresbicia ? ADICION_POR_EDAD(edad) : 0
      } else {
        const meses = (new Date(c.fecha) - new Date(previaFecha)) / (30 * 86400000)
        od = evolucionar(r, od, opticaC, edad, meses)
        oi = evolucionar(r, oi, opticaC, edad, meses)
        if (conPresbicia) adicion = Math.max(adicion, ADICION_POR_EDAD(edad)) + (meses > 4 && r() < 0.35 ? 0.25 : 0)
      }
      // Sin presbicia no hay adición.
      const adicionC = conPresbicia ? adicion : 0
      const actual = {
        od: { esfera: od.esfera, cilindro: od.cilindro || 0, eje: od.cilindro ? od.eje ?? 90 : "" },
        oi: { esfera: oi.esfera, cilindro: oi.cilindro || 0, eje: oi.cilindro ? oi.eje ?? 90 : "" },
      }
      const tendencia = i === 0 ? "Primera consulta" : verdicto(variacion(actual, previo))
      const sufijo = catsConsulta[0] === CAT.S ? "Agudeza visual conservada, sin necesidad de corrección." : "Corrección óptica indicada según refracción."
      const rc = rng("demo-clinico-" + (c.id || c.cita_id))
      const ind = catsConsulta[0] === CAT.S ? "Sin corrección necesaria por ahora. Control en 12 meses."
        : conPresbicia ? "Lentes para lectura y trabajo cercano. Control en 6 meses."
        : elegir(rc, ["Uso de lentes de manera constante. Evitar frotarse los ojos.", "Uso permanente de lentes. Control en 12 meses.", "Pausas visuales 20-20-20 al usar pantallas. Control anual."])
      const tipo = tipoVendido.get(c.id)
      // La lente recomendada acompaña a lo que se vendió; si no hubo venta, a lo que pide el diagnóstico.
      const material = (c.lente_recomendado || "").split(" ").slice(1).join(" ") || elegir(rc, ["CR-39", "Policarbonato", "Trivex"])
      const lente = catsConsulta[0] === CAT.S ? null
        : tipo === "progresivo" ? "Progresivo " + material
        : tipo === "bifocal" ? "Bifocal " + material
        : tipo === "monofocal" ? "Monofocal " + material
        : (conPresbicia ? "Progresivo " : "Monofocal ") + material
      const dc = c.datos_clinicos || { examen: { pioOd: "16", pioOi: "16", testColor: "Normal", testMotor: "Normal", oftalmoscopia: "Fondo de ojo normal", biomicroscopia: { camara: "Profunda y quieta", cornea: "Transparente", parpados: "Sin alteraciones" }, coverTestCerca: "Ortoforia", coverTestLejos: "Ortoforia" }, medidas: { dp: "62", alt: "18", avCerca: "J1" } }
      const avCc = (ojo) => dc[ojo]?.avCc || "20/20"
      const nuevoDatos = {
        ...dc,
        od: { ...(dc.od || {}), esfera: fmtEsfera(actual.od.esfera), cilindro: fmt(actual.od.cilindro), eje: actual.od.cilindro ? String(actual.od.eje) : "", avCc: avCc("od"), avSc: avSinCorreccion(rc, ee(actual.od.esfera, actual.od.cilindro)) },
        oi: { ...(dc.oi || {}), esfera: fmtEsfera(actual.oi.esfera), cilindro: fmt(actual.oi.cilindro), eje: actual.oi.cilindro ? String(actual.oi.eje) : "", avCc: avCc("oi"), avSc: avSinCorreccion(rc, ee(actual.oi.esfera, actual.oi.cilindro)) },
        medidas: { ...(dc.medidas || {}), adicion: adicionC ? fmt(adicionC) : "" },
        retinoscopia: { od: fmtEsfera(actual.od.esfera), oi: fmtEsfera(actual.oi.esfera) },
      }
      cambios.push({
        c, datos: nuevoDatos, categorias: catsConsulta, diagnostico: `${catsConsulta.join(", ")} — ${sufijo}`, tendencia, lente, indicaciones: ind,
        receta: { od: { eje: nuevoDatos.od.eje, esfera: nuevoDatos.od.esfera, adicion: nuevoDatos.medidas.adicion, cilindro: nuevoDatos.od.cilindro }, oi: { eje: nuevoDatos.oi.eje, esfera: nuevoDatos.oi.esfera, adicion: nuevoDatos.medidas.adicion, cilindro: nuevoDatos.oi.cilindro } },
        edad,
      })
      previo = actual
      previaFecha = c.fecha
    })
  }

  // ── 2. Escritura ──
  let nuevas = 0
  for (const x of cambios) {
    if (x.c.id) {
      // consultas es una vista que descifra: se escribe en consultas_base, cifrando como lo hace la app.
      await client.query(
        `update consultas_base set datos_clinicos_enc = cifrar_clinico($2::text), diagnostico_enc = cifrar_clinico($3), diagnostico_categorias = $4, evolucion_calculada = $5,
                lente_recomendado = $6, indicaciones_enc = cifrar_clinico($7)
          where id = $1 and optica_id = $8`,
        [x.c.id, JSON.stringify(x.datos), x.diagnostico, x.categorias, x.tendencia, x.lente, x.indicaciones, O])
      await client.query(`update ordenes_laboratorio set receta_od = $2, receta_oi = $3 where consulta_id = $1 and optica_id = $4`, [x.c.id, x.receta.od, x.receta.oi, O])
    } else {
      const n = x.c.nueva
      await client.query(
        `insert into consultas_base (optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, diagnostico_categorias, evolucion_calculada, estado_correccion, lente_recomendado,
                                      proximo_control_dias, profesional_nombre, profesional_id, cita_id, imagenes, created_at,
                                      diagnostico_enc, antecedentes_enc, alergias_enc, antecedentes_familiares_enc, indicaciones_enc, datos_clinicos_enc)
         values ($1,$2,$3,$4::date,$5,$6,$7,$8,'Bien corregido',$9,365,$10,$11,$12,'[]'::jsonb,($4::date + time '11:00') at time zone 'America/Guayaquil',
                 cifrar_clinico($13), cifrar_clinico('Ninguno'), cifrar_clinico('Ninguna'), cifrar_clinico('Sin antecedentes familiares relevantes'), cifrar_clinico($14), cifrar_clinico($15::text))`,
        [O, n.paciente_id, n.paciente, n.fecha, n.motivo || "Garantía / Ajuste", x.categorias.some((k) => k !== CAT.S), x.categorias, x.tendencia, x.lente, n.profesional, n.atendido_por, n.id, x.diagnostico, x.indicaciones, JSON.stringify(x.datos)])
      nuevas++
    }
  }
  // La tendencia que muestra la lista de pacientes queda igual a la de su última consulta.
  await client.query(
    `update pacientes_base p set evolucion_enc = cifrar_clinico(u.evolucion_calculada)
       from (select distinct on (paciente_id) paciente_id, evolucion_calculada from consultas where optica_id = $1 order by paciente_id, fecha desc, created_at desc) u
      where p.id = u.paciente_id and p.optica_id = $1`, [O])

  // ── 3. Nombre del administrador ──
  const { rowCount: renombrados } = await client.query(`update perfiles set nombre = 'Administrador Demo' where optica_id = $1 and rol = 'admin' and nombre = 'Demo'`, [O])
  const { rowCount: enConsultas } = await client.query(`update consultas_base set profesional_nombre = 'Administrador Demo' where optica_id = $1 and profesional_nombre = 'Demo'`, [O])
  const { rowCount: enLogs } = await client.query(`update logs_optica set usuario_nombre = 'Administrador Demo' where optica_id = $1 and usuario_nombre = 'Demo'`, [O])

  // ── 4. Verificaciones ──
  const fallos = []
  const { rows: v } = await client.query(
    `select c.id, c.diagnostico_categorias cats, (c.datos_clinicos->'od'->>'esfera')::numeric oe, (c.datos_clinicos->'od'->>'cilindro')::numeric oc,
            (c.datos_clinicos->'oi'->>'esfera')::numeric ie, (c.datos_clinicos->'oi'->>'cilindro')::numeric ic,
            nullif(c.datos_clinicos->'medidas'->>'adicion','')::numeric adicion, extract(year from age(c.fecha, p.fecha_nacimiento))::int edad
       from consultas c join pacientes p on p.id = c.paciente_id where c.optica_id = $1`, [O])
  for (const k of v) {
    const t = (c) => k.cats.includes(c)
    const eMax = Math.max(k.oe, k.ie), eMin = Math.min(k.oe, k.ie), cMin = Math.min(k.oc, k.ic)
    if (t(CAT.M) && !(k.oe < 0 && k.ie < 0)) fallos.push(`${k.id}: miopía sin esfera negativa`)
    if (t(CAT.MA) && !(k.oe < 0 && k.ie < 0 && cMin <= -0.5)) fallos.push(`${k.id}: miopía y astigmatismo mal`)
    if (t(CAT.H) && !(k.oe > 0 && k.ie > 0)) fallos.push(`${k.id}: hipermetropía sin esfera positiva`)
    if (t(CAT.HA) && !(k.oe > 0 && k.ie > 0 && cMin <= -0.5)) fallos.push(`${k.id}: hipermetropía y astigmatismo mal`)
    if (t(CAT.A) && !(cMin <= -0.5)) fallos.push(`${k.id}: astigmatismo sin cilindro`)
    if (t(CAT.P) && !(k.adicion >= 1 && k.edad >= 40)) fallos.push(`${k.id}: presbicia sin adición o con menos de 40 años`)
    if (!t(CAT.P) && k.adicion) fallos.push(`${k.id}: adición sin presbicia`)
    if (t(CAT.S) && !(Math.abs(eMax) <= 0.5 && Math.abs(eMin) <= 0.5 && cMin >= -0.25)) fallos.push(`${k.id}: sin alteración con graduación`)
    if (eMax > 8 || eMin < -8) fallos.push(`${k.id}: valor fuera de rango`)
  }
  const { rows: sinConsulta } = await client.query(`select count(*)::int n from citas c where optica_id = $1 and estado = 'Atendida' and not exists (select 1 from consultas k where k.cita_id = c.id)`, [O])
  if (sinConsulta[0].n !== 0) fallos.push("quedan citas atendidas sin consulta")
  const despues = await conteo()
  for (const k of Object.keys(antes)) if (antes[k] !== despues[k]) fallos.push(`cambió ${k} fuera de la Óptica Demo`)

  console.log(`Base: ${process.env.PGDATABASE} · modo: ${EJECUTAR ? "EJECUTAR" : "ENSAYO (se revierte)"} · óptica ${NOMBRE_OPTICA}`)
  console.log(`Consultas corregidas: ${cambios.length - nuevas} · consultas nuevas: ${nuevas} · pacientes: ${porPaciente.size}`)
  console.log(`Administrador renombrado: perfiles ${renombrados}, consultas ${enConsultas}, logs ${enLogs}`)
  const dist = {}
  for (const x of cambios) for (const c of x.categorias) dist[c] = (dist[c] || 0) + 1
  console.log("Diagnósticos:", JSON.stringify(dist))
  console.log("Residuales (no se tocan):", residuales.length ? "\n  - " + residuales.join("\n  - ") : "ninguno")
  console.log(`Verificaciones: ${fallos.length === 0 ? "todas correctas" : fallos.length + " FALLOS"}`)
  fallos.forEach((f) => console.log("  ✗", f))
  if (fallos.length) throw new Error("Verificaciones fallidas: se revierte")
  if (EJECUTAR) { await client.query("commit"); console.log("✔ COMMIT: datos escritos.") } else { await client.query("rollback"); console.log("↩ ENSAYO terminado: ROLLBACK, no se escribió nada.") }
} catch (e) {
  await client.query("rollback")
  console.error("✗ Error, se revirtió todo:", e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
