import pg from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/_run-migration.mjs <archivo.sql>");
  process.exit(1);
}
const sql = readFileSync(file, "utf8");

const client = new pg.Client();
await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("OK: migración aplicada -", file);
} catch (err) {
  await client.query("rollback");
  console.error("ERROR, se revirtió todo:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
