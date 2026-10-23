import pg from "pg"
const c = new pg.Client(); await c.connect()
const q = async (s,p)=> (await c.query(s,p)).rows
for (const r of await q(`select column_name n, data_type t, left(column_default,160) d from information_schema.columns where table_name='opticas' and table_schema='public' order by ordinal_position`)) console.log("COL", r.n, r.t, r.d??"")
for (const r of await q(`select tgname, left(pg_get_triggerdef(t.oid),200) d from pg_trigger t where tgrelid='public.opticas'::regclass and not tgisinternal`)) console.log("TRG", r.tgname, r.d)
console.log("TABLAS", (await q(`select table_name from information_schema.columns where column_name='optica_id' and table_schema='public' and table_name in (select table_name from information_schema.tables where table_type='BASE TABLE') order by 1`)).map(r=>r.table_name).join(", "))
await c.end()
