// Ensayo de la migración 0110 (factura electrónica guardada y entregada): la aplica DENTRO de una transacción y SIEMPRE revierte.
// Prueba con sesiones reales de distintos roles que nadie sin permiso ve ni sube los archivos, que un paciente solo baja los suyos y
// que los enlaces vencen y se revocan.
//   node --env-file=.env.local scripts/ensayo-0110.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0110_factura_electronica.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

// Ejecuta como un rol (con o sin sesión) y devuelve { r } o { e }; deshace solo lo de esa prueba.
const como = async (rol, uid, fn) => {
  await c.query("savepoint s")
  try {
    await c.query(`set local role ${rol}`)
    if (uid) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: rol, aal: "aal2" }), uid])
    else await c.query("select set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true)")
    const r = await fn()
    await c.query("reset role")
    await c.query("release savepoint s")
    return { r }
  } catch (e) {
    await c.query("rollback to savepoint s")
    await c.query("reset role")
    return { e: e.message }
  }
}
const staff = (uid, fn) => como("authenticated", uid, fn)

// Una clave de acceso válida (módulo 11) para una serie y un secuencial.
const dv = (b) => { let s = 0, p = 2; for (let i = b.length - 1; i >= 0; i--) { s += Number(b[i]) * p; p = p === 7 ? 2 : p + 1 } const d = 11 - (s % 11); return d === 11 ? 0 : d === 10 ? 1 : d }
const clave = (serie, sec, tipo = "01") => { const b = "04102026" + tipo + "1790000000001" + "1" + serie + sec + "12345678" + "1"; return b + dv(b) }

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  const ajena = (await c.query("select o.id, (select p.id from perfiles p where p.optica_id = o.id and p.rol = 'admin' limit 1) admin from opticas o where o.slug = 'qu7u2j'")).rows[0]
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const vera = await perfil("Vera Ventas Pruebas")
  const paula = await perfil("Paula Optómetra Pruebas")
  if (!optica || !admin || !vera || !paula || !ajena?.admin) throw new Error("Faltan datos de las ópticas de pruebas")

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")

  // ── Funciones de la clave
  const e = async (cl, n) => (await c.query("select error_de_clave_acceso($1, $2) e", [cl, n])).rows[0].e
  const buena = clave("001001", "000001216")
  ok((await e(buena, "001-001-000001216")) === null, "una clave válida, cruzada con su número, no tiene error")
  ok((await e(buena.slice(0, 48) + "0", null)) === "La clave de acceso no es válida: el dígito verificador debería ser " + buena[48] + ".", "dígito verificador malo: dice cuál debería ser")
  ok(/49 dígitos/.test(await e("123", null)), "una clave corta se rechaza")
  ok(/factura 001-001-000001216/.test(await e(buena, "001-001-000000999")), "clave de otra factura que el número escrito: se rechaza")
  ok(/no es de una factura/.test(await e(clave("001001", "000001216", "04"), null)), "tipo de comprobante que no es factura: se rechaza")
  ok((await e(buena, "FE-77")) === null, "un número con otro formato no se cruza")

  // ── Datos: dos pacientes con sesión del portal, una venta del primero y roles
  const mk = async (nombre, token) => {
    const id = (await c.query("insert into pacientes_base (optica_id, nombre) values ($1, $2) returning id", [optica, nombre])).rows[0].id
    await c.query("update pacientes_base set sesion_token = $2, sesion_token_creado_en = now() where id = $1", [id, token])
    return id
  }
  const p1 = await mk("ENSAYO 0110 Uno", "token-uno")
  const p2 = await mk("ENSAYO 0110 Dos", "token-dos")
  const venta = (pac) => staff(admin, async () => (await c.query("select * from crear_factura_venta($1,$2,'directo',$3::jsonb,null,null,null,null,null,$4::jsonb)", [optica, pac, JSON.stringify([{ producto_id: null, tipo: "servicio", descripcion: "Servicio", cantidad: 1, precio_unitario: 50 }]), JSON.stringify([{ metodo: "efectivo", monto: 50 }])])).rows[0])
  const f1 = (await venta(p1)).r
  const f2 = (await venta(p2)).r
  const n1 = "001-001-" + String(f1.numero).padStart(9, "0")
  const k1 = clave("001001", String(f1.numero).padStart(9, "0"))
  // Paula: solo "ver" de Ventas. Un rol sin Ventas, para quien no debe ver nada.
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolVer = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo ver', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ ventas: ["ver"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolVer])
  const sinVentas = await perfil("Rosa Recepción Pruebas")
  await c.query("delete from perfil_roles where perfil_id = $1", [sinVentas])
  const rolNada = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo sin ventas', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ citas: ["ver"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [sinVentas, rolNada])

  // ── Almacenamiento privado
  const carpeta = `${optica}/${f1.id}`
  const subir = (uid, nombre) => staff(uid, async () => (await c.query("insert into storage.objects (bucket_id, name) values ('facturas-electronicas', $1) returning id", [nombre])).rows[0])
  let x = await subir(vera, `${carpeta}/ride-1.pdf`)
  ok(!!x.r, "con Ventas 'editar' (Vera) se sube un archivo a la carpeta de su óptica")
  x = await subir(paula, `${carpeta}/ride-x.pdf`)
  ok(/row-level security|violates/.test(x.e || ""), "con solo 'ver' (Paula) NO se puede subir: " + x.e)
  x = await subir(vera, `${ajena.id}/${f1.id}/ride-1.pdf`)
  ok(/row-level security|violates/.test(x.e || ""), "ni siquiera con 'editar' se sube a la carpeta de OTRA óptica")
  const leer = (rol, uid) => como(rol, uid, async () => (await c.query("select name from storage.objects where bucket_id = 'facturas-electronicas'")).rows.length)
  ok((await leer("authenticated", vera)).r === 1, "Vera (ver/editar) ve el archivo")
  ok((await leer("authenticated", paula)).r === 1, "Paula (solo 'ver') ve el archivo")
  ok((await leer("authenticated", sinVentas)).r === 0, "quien no tiene Ventas NO ve los archivos")
  ok((await leer("authenticated", ajena.admin)).r === 0, "el administrador de OTRA óptica NO ve los archivos")
  { const a = await leer("anon", null); ok(a.r === 0 || /permission denied/.test(a.e || ""), "sin sesión NO se ve nada" + (a.e ? ": " + a.e : "")) }
  x = await staff(admin, async () => (await c.query("delete from storage.objects where bucket_id = 'facturas-electronicas'")).rowCount)
  ok(x.r === 0 || /permission|row-level|not allowed/.test(x.e || ""), "nadie borra archivos (ni el administrador): " + (x.e || x.r + " filas"))
  x = await staff(admin, async () => (await c.query("update storage.objects set name = name || 'x' where bucket_id = 'facturas-electronicas'")).rowCount)
  ok(x.r === 0 || /permission|row-level/.test(x.e || ""), "nadie sobrescribe archivos: " + (x.e || x.r + " filas"))
  await c.query("insert into storage.objects (bucket_id, name) values ('facturas-electronicas', $1)", [`${carpeta}/factura-1.xml`])

  // ── Guardar la factura electrónica
  const guardar = (uid, f, args) => staff(uid, async () => (await c.query("select guardar_factura_electronica($1,$2,$3,$4,$5,$6,$7,$8) id", [f, ...args])).rows[0].id)
  x = await guardar(paula, f1.id, [n1, k1, "2026-10-13", `${carpeta}/ride-1.pdf`, 1000, null, null])
  ok(/No tienes permiso/.test(x.e || ""), "con solo 'ver' no se registra: " + x.e)
  x = await guardar(vera, f1.id, [n1, buena.slice(0, 48) + "0", null, null, null, null, null])
  ok(/dígito verificador/.test(x.e || ""), "el servidor rechaza una clave mala: " + x.e)
  x = await guardar(vera, f1.id, [n1, clave("001001", "000000777"), null, null, null, null, null])
  ok(/es de la factura 001-001-000000777/.test(x.e || ""), "…y una clave que no es de ese número: " + x.e)
  x = await guardar(vera, f1.id, [n1, k1, "2099-01-01", null, null, null, null])
  ok(/futura/.test(x.e || ""), "…y una autorización en el futuro: " + x.e)
  x = await guardar(vera, f1.id, [n1, k1, "2026-10-13", `${ajena.id}/${f1.id}/ride-1.pdf`, 1000, null, null])
  ok(/ruta del PDF no es válida/.test(x.e || ""), "…y un archivo fuera de la carpeta de esa venta: " + x.e)
  x = await guardar(vera, f1.id, [n1, k1, "2026-10-13", `${carpeta}/no-existe.pdf`, 1000, null, null])
  ok(/no se subió/.test(x.e || ""), "…y un archivo que no está en el almacenamiento: " + x.e)
  x = await guardar(vera, f1.id, [n1, k1, "2026-10-13", `${carpeta}/ride-1.pdf`, 9999999, null, null])
  ok(/hasta 5 MB/.test(x.e || ""), "…y un PDF que pesa más de 5 MB: " + x.e)
  x = await guardar(vera, f1.id, [n1, k1, "2026-10-13", `${carpeta}/ride-1.pdf`, 1000, `${carpeta}/factura-1.xml`, 800])
  ok(!!x.r, "con 'editar' y todo en regla se registra (número, clave, autorización, PDF y XML)")
  const guardado = (await c.query("select f.factura_electronica, e.clave_acceso, e.autorizada_el from facturas_venta f join facturas_electronicas e on e.factura_id = f.id where f.id = $1", [f1.id])).rows[0]
  ok(guardado.factura_electronica === n1 && guardado.clave_acceso === k1, "queda el número en la venta y la clave en su tabla")
  ok((await c.query("select count(*)::int n from facturas_electronicas_archivos where factura_id = $1", [f1.id])).rows[0].n === 2, "y los dos archivos")
  x = await guardar(admin, f2.id, ["001-001-" + String(f2.numero).padStart(9, "0"), k1, null, null, null, null, null])
  ok(/ya está registrada/.test(x.e || "") || /es de la factura/.test(x.e || ""), "una clave ya usada en otra venta se rechaza: " + x.e)
  // Un reemplazo: otro PDF, y el anterior se conserva
  await c.query("insert into storage.objects (bucket_id, name) values ('facturas-electronicas', $1)", [`${carpeta}/ride-2.pdf`])
  x = await guardar(vera, f1.id, [n1, k1, "2026-10-13", `${carpeta}/ride-2.pdf`, 1200, null, null])
  ok(!!x.r, "reemplazar el PDF funciona")
  ok((await c.query("select count(*)::int n from facturas_electronicas_archivos where factura_id = $1 and tipo = 'pdf'", [f1.id])).rows[0].n === 2, "…y la versión anterior NO se borra (se conservan 7 años)")
  ok((await c.query("select accion from facturas_electronicas_eventos where factura_id = $1 and accion = 'reemplazo'", [f1.id])).rows.length === 1, "…y queda el evento del reemplazo")

  // ── Escritura directa y lectura de las tablas
  x = await staff(admin, () => c.query("insert into facturas_electronicas_eventos (optica_id, factura_id, accion) values ($1,$2,'registro')", [optica, f1.id]))
  ok(/permission denied/.test(x.e || ""), "nadie escribe en los eventos directamente: " + x.e)
  x = await staff(admin, () => c.query("select * from enlaces_descarga"))
  ok(/permission denied/.test(x.e || ""), "nadie lee la tabla de enlaces: " + x.e)
  ok((await staff(vera, async () => (await c.query("select id from facturas_electronicas_archivos")).rows.length)).r === 3, "Vera lee los archivos registrados (3 versiones)")
  ok((await staff(sinVentas, async () => (await c.query("select id from facturas_electronicas")).rows.length)).r === 0, "quien no tiene Ventas no lee las facturas electrónicas")
  ok((await staff(ajena.admin, async () => (await c.query("select id from facturas_electronicas_archivos")).rows.length)).r === 0, "el administrador de otra óptica no lee nada")

  // ── Eventos de descarga y envío
  x = await staff(paula, () => c.query("select registrar_evento_factura_electronica($1, 'descarga_pdf', 'RIDE')", [f1.id]))
  ok(!x.e, "con 'ver' se registra una descarga")
  x = await staff(paula, () => c.query("select registrar_evento_factura_electronica($1, 'envio_correo', null)", [f1.id]))
  ok(/No tienes permiso/.test(x.e || ""), "pero enviar por correo pide 'editar': " + x.e)
  x = await staff(sinVentas, () => c.query("select registrar_evento_factura_electronica($1, 'descarga_pdf', null)", [f1.id]))
  ok(/No tienes permiso|acceso/.test(x.e || ""), "quien no tiene Ventas no registra nada: " + x.e)

  // ── Enlaces seguros
  x = await staff(paula, () => c.query("select * from crear_enlaces_factura($1, 7)", [f1.id]))
  ok(/No tienes permiso/.test(x.e || ""), "con solo 'ver' no se crean enlaces: " + x.e)
  x = await staff(vera, () => c.query("select * from crear_enlaces_factura($1, 99)", [f1.id]))
  ok(/de 1 a 30 días/.test(x.e || ""), "un enlace dura de 1 a 30 días: " + x.e)
  const enl = await staff(vera, async () => (await c.query("select * from crear_enlaces_factura($1, 7)", [f1.id])).rows)
  ok(enl.r?.length === 2 && enl.r.every((l) => l.token.length === 48), "con 'editar' se crean dos enlaces (PDF y XML) con un código largo")
  const tPdf = enl.r.find((l) => l.tipo === "pdf").token
  ok((await c.query("select count(*)::int n from enlaces_descarga where token_hash = $1", [tPdf])).rows[0].n === 0, "en la base NO queda el código en claro")
  const resolver = (t) => como("service_role", null, async () => (await c.query("select * from resolver_enlace_descarga($1)", [t])).rows)
  x = await resolver(tPdf)
  ok(x.r?.length === 1 && x.r[0].ruta === `${carpeta}/ride-2.pdf` && x.r[0].tipo === "pdf", "la función de entrega resuelve el enlace al PDF vigente (el último)")
  ok((await resolver("codigo-que-no-existe")).r.length === 0, "un código inventado no resuelve nada")
  x = await como("authenticated", vera, () => c.query("select * from resolver_enlace_descarga($1)", [tPdf]))
  ok(/permission denied/.test(x.e || ""), "ningún usuario puede llamar a la función de entrega: " + x.e)
  x = await como("anon", null, () => c.query("select * from resolver_enlace_descarga($1)", [tPdf]))
  ok(/permission denied/.test(x.e || ""), "…ni sin sesión: " + x.e)
  ok((await c.query("select usos from enlaces_descarga where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')", [tPdf])).rows[0].usos === 1, "cada uso se cuenta")
  await staff(vera, () => c.query("select revocar_enlaces_factura($1)", [f1.id]))
  ok((await resolver(tPdf)).r.length === 0, "un enlace revocado deja de funcionar")
  const enl2 = await staff(vera, async () => (await c.query("select * from crear_enlaces_factura($1, 1)", [f1.id])).rows)
  await c.query("update enlaces_descarga set expira_en = now() - interval '1 minute' where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')", [enl2.r[0].token])
  ok((await resolver(enl2.r[0].token)).r.length === 0, "un enlace vencido deja de funcionar")

  // ── Portal del paciente
  const compras = (id, tok) => como("anon", null, async () => (await c.query("select mis_compras_paciente($1, $2) c", [id, tok])).rows[0].c)
  let r = await compras(p1, "token-uno")
  ok(r.r.length === 1 && r.r[0].id === f1.id && r.r[0].factura_electronica.pdf === true && r.r[0].factura_electronica.xml === true, "el paciente 1 ve su compra, con su factura electrónica (PDF y XML)")
  ok(!("registrado_por" in r.r[0]) && !JSON.stringify(r.r[0]).includes(vera), "…sin campos internos del personal")
  ok((await compras(p2, "token-uno")).r.length === 0, "con el token de otro paciente no se ve nada")
  ok((await compras(p1, "token-dos")).r.length === 0, "…ni con un token que no es el suyo")
  ok((await compras(p1, null)).r.length === 0, "…ni sin token")
  r = await compras(p2, "token-dos")
  ok(r.r.length === 1 && r.r[0].id === f2.id && r.r[0].factura_electronica === null, "el paciente 2 ve solo la suya, sin factura electrónica todavía")
  const autorizar = (pac, tok, f, tipo) => como("service_role", null, async () => (await c.query("select * from autorizar_descarga_paciente($1,$2,$3,$4)", [pac, tok, f, tipo])).rows)
  r = await autorizar(p1, "token-uno", f1.id, "pdf")
  ok(r.r.length === 1 && r.r[0].ruta === `${carpeta}/ride-2.pdf`, "el paciente 1 puede bajar el PDF de SU factura")
  ok((await autorizar(p2, "token-dos", f1.id, "pdf")).r.length === 0, "el paciente 2 NO puede bajar la factura del paciente 1")
  ok((await autorizar(p1, "token-dos", f1.id, "pdf")).r.length === 0, "…ni con una sesión que no es la suya")
  ok((await autorizar(p2, "token-dos", f2.id, "pdf")).r.length === 0, "…y su propia compra sin archivos no devuelve nada")
  ok((await c.query("select count(*)::int n from facturas_electronicas_eventos where factura_id = $1 and accion = 'descarga_paciente' and actor_paciente = $2", [f1.id, p1])).rows[0].n === 1, "la descarga del paciente queda registrada con su nombre")
  x = await como("anon", null, () => c.query("select * from autorizar_descarga_paciente($1,$2,$3,'pdf')", [p1, "token-uno", f1.id]))
  ok(/permission denied/.test(x.e || ""), "la función que autoriza descargas no se puede llamar sin la clave de servicio: " + x.e)
} catch (err) {
  console.error("ERROR del ensayo:", err.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos === 0 ? "\nTodo bien. Se revirtió todo (no queda ningún cambio)." : `\n${fallos} comprobaciones fallaron. Se revirtió todo.`)
  process.exitCode = fallos === 0 ? 0 : 1
}
