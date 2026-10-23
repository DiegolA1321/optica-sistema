import pg from "pg"
const c = new pg.Client(); await c.connect()
await c.query("begin")
const o = (await c.query(`insert into opticas(nombre,slug,marca) values('ZZ Ensayo cierre','zz-ensayo-cierre', '{"nombreMarca":"ZZ Ensayo cierre","eslogan":"Ve el mundo con claridad.","colorAcento":"#2563EB"}'::jsonb) returning *`)).rows[0]

const tablas=(await c.query(`select table_name from information_schema.columns where column_name='optica_id' and table_schema='public' and table_name in (select table_name from information_schema.tables where table_type='BASE TABLE')`)).rows.map(r=>r.table_name)
for (const t of tablas){ const n=(await c.query(`select count(*)::int n from public.${t} where optica_id=$1`,[o.id])).rows[0].n; if(n) console.log("FILAS",t,n)}
console.log(JSON.stringify((await c.query(`select nombre, * from roles where optica_id=$1`,[o.id])).rows,null,1).slice(0,6000))
await c.query("rollback"); await c.end()
