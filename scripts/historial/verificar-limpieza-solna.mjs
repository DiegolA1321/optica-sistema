// Verificación posterior a la limpieza de Solna Vision (conexión nueva, ya confirmada): sin datos ni usuarios de prueba, configuración intacta, y las demás ópticas con sus usuarios.
import pg from "pg"
const c = new pg.Client(); await c.connect()
const O = "b6eb867a-6b08-42c6-b493-27d139bed64e"
const q = async (s, p) => (await c.query(s, p)).rows
let f = 0; const ok = (b, m) => { console.log((b ? "✔ " : "✘ ") + m); if (!b) f++ }
const tablas = (await q("select c.table_name t from information_schema.columns c join information_schema.tables x using (table_schema, table_name) where c.table_schema='public' and c.column_name='optica_id' and x.table_type='BASE TABLE'")).map((r) => r.t)
const con = {}
for (const t of tablas) { const n = (await q(`select count(*)::int n from public.${t} where optica_id=$1`, [O]))[0].n; if (n) con[t] = n }
ok(JSON.stringify(Object.entries(con).sort()) === JSON.stringify([["auditoria", 7], ["disponibilidad", 1], ["roles", 3]]), "Solna solo tiene: " + JSON.stringify(con))
ok((await q("select count(*)::int n from auth.users where email like '%opticasolna.test' or email ilike '%solna%'"))[0].n === 0, "ninguna cuenta de ingreso de Solna")
const o = (await q("select nombre, slug, activa, estado_pago, marca->>'colorAcento' color, marca->>'nombreMarca' marca from opticas where id=$1", [O]))[0]
ok(!!o && o.activa, "la óptica sigue: " + JSON.stringify(o))
ok((await q("select count(*)::int n from roles where optica_id=$1 and es_predefinido and clave in ('optometra','recepcion','ventas')", [O]))[0].n === 3, "los 3 roles predefinidos")
const otras = await q("select o.slug, (select count(*)::int from perfiles p where p.optica_id=o.id) usuarios, (select count(*)::int from pacientes_base x where x.optica_id=o.id) pacientes from opticas o where o.id<>$1 order by 1", [O])
console.log("otras ópticas:", JSON.stringify(otras))
await c.end(); process.exit(f ? 1 : 0)
