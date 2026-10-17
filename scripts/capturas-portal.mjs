// Capturas del portal del paciente (portal v2) en celular (390), tablet (768) y laptop (1366×768): de un paciente nuevo y de uno con citas, lentes en el
// laboratorio y saldo. Trabaja SOLO en la óptica de pruebas: crea un paciente nuevo temporal y, para el paciente fijo del portal, una consulta y tres citas
// que borra al terminar (aunque falle). Los lentes se ven con ?_muestra=lentes (datos de ejemplo, solo en desarrollo) mientras la migración 0123 no esté aplicada.
//
//   node --env-file=.env.local --env-file=.env.test scripts/capturas-portal.mjs [carpeta-de-salida]
import { chromium } from "@playwright/test"
import pg from "pg"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "docs/portal-v2-capturas")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
const TAMANOS = [["celular", 390, 844], ["tablet", 768, 1024], ["laptop", 1366, 768]]
const CLAVE_NUEVO = "PortalNuevo2026x"
fs.mkdirSync(SALIDA, { recursive: true })

const c = new pg.Client()
await c.connect()
const q = async (t, p) => (await c.query(t, p)).rows
const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date::text d"))[0].d
const sumar = async (dias) => (await q("select ($1::date + $2::int)::text d", [hoy, dias]))[0].d
const OPTICA = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const fijo = (await q("select id, nombre from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OPTICA]))[0]
let nuevoId = null
const citasCreadas = []

async function preparar() {
  // Paciente nuevo, con cuenta y sin ningún dato.
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [fijo.id])
  await c.query(
    `update t_p set id = gen_random_uuid(), nombre = 'E Dos E Portal Nuevo', cedula = '0999999990', usuario = null, fecha_nacimiento = date '1952-05-15', fecha_registro = $1::date,
       clave_temporal = extensions.crypt($2, extensions.gen_salt('bf')), tiene_cuenta = true, sesion_token = null, intentos_fallidos = 0, bloqueado_hasta = null,
       ultima_consulta = null, estado_clinico_enc = null, evolucion_enc = null, estado_correccion_enc = null, referido_por = null, referido_por_id = null, correo = 'nuevo@example.com', telefono = '0991112233'`,
    [hoy, CLAVE_NUEVO],
  )
  nuevoId = (await q("insert into pacientes_base select * from t_p returning id"))[0].id

  // Paciente con datos: una receta y tres citas (próxima, atendida y cancelada).
  await c.query(
    `insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, diagnostico, lente_recomendado, indicaciones, proximo_control_dias, profesional_nombre, profesional_registro, datos_clinicos)
     values ($1, $2, $3, $4::date, 'E2E captura', true, 'Miopía y astigmatismo', 'Progresivo con filtro azul', 'Uso permanente. Control en seis meses.', 180, 'Dra. Prueba', 'REG-1',
       '{"od":{"esfera":"-1.50","cilindro":"-0.50","eje":"90","avSc":"20/40","avCc":"20/20"},"oi":{"esfera":"-1.25","cilindro":"-0.75","eje":"80","avSc":"20/50","avCc":"20/25"},"medidas":{"adicion":"+1.00"}}'::jsonb)`,
    [OPTICA, fijo.id, fijo.nombre, await sumar(-150)],
  )
  for (const [dias, hora, estado] of [[5, "11:20 AM", "Pendiente"], [-150, "11:20 AM", "Atendida"], [-60, "11:20 AM", "Cancelada"]]) {
    const r = await q(`insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado) values ($1, $2, $3, '0914760947', $4::date, $5, 'Consulta General', $6) returning id`, [OPTICA, fijo.id, fijo.nombre, await sumar(dias), hora, estado])
    citasCreadas.push(r[0].id)
  }
}

async function limpiar() {
  if (citasCreadas.length) await c.query("delete from citas_base where id = any($1)", [citasCreadas])
  await c.query("delete from consultas_base where optica_id = $1 and paciente_id = $2 and motivo = 'E2E captura'", [OPTICA, fijo.id])
  if (nuevoId) await c.query("delete from pacientes_base where id = $1", [nuevoId])
}

async function entrar(page, cedula, clave, extra = "") {
  await page.goto(`${BASE}/?optica=v8twzq${extra}`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click()
  await page.keyboard.insertText(cedula)
  await page.getByPlaceholder("Tu contraseña").click()
  await page.keyboard.insertText(clave)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.getByRole("heading", { name: "Resumen" }).waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Cargando tu resumen"]'), null, { timeout: 30_000 })
}

let fallo = null
try {
  await preparar()
  const browser = await chromium.launch()
  for (const [nombre, ancho, alto] of TAMANOS) {
    for (const caso of ["nuevo", "completo"]) {
      const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, locale: "es-EC", deviceScaleFactor: 1 })
      const page = await ctx.newPage()
      if (caso === "nuevo") await entrar(page, "0999999990", CLAVE_NUEVO)
      else await entrar(page, process.env.E2E_PORTAL_CEDULA, process.env.E2E_PORTAL_CLAVE, "&_muestra=lentes")
      await page.waitForTimeout(600)
      const foto = (n) => page.screenshot({ path: path.join(SALIDA, `${nombre}-${caso}-${n}.png`) })
      await foto("resumen")
      if (caso === "completo") {
        await page.setViewportSize({ width: ancho, height: nombre === "laptop" ? 1400 : 2000 })
        await page.waitForTimeout(300)
        await foto("resumen-completo")
        await page.setViewportSize({ width: ancho, height: alto })
        for (const [boton, n] of [["Mis citas", "citas"], ["Mi receta", "receta"], ["Mis compras", "compras"]]) {
          await page.getByRole("navigation", { name: "Menú del portal" }).filter({ visible: true }).getByRole("button", { name: boton, exact: true }).click()
          await page.waitForTimeout(800)
          await page.setViewportSize({ width: ancho, height: nombre === "laptop" ? 1500 : 2200 })
          await page.waitForTimeout(300)
          await foto(n)
          await page.setViewportSize({ width: ancho, height: alto })
        }
      }
      await ctx.close()
    }
  }
  await browser.close()
} catch (e) {
  fallo = e
} finally {
  await limpiar()
  await c.end()
}
if (fallo) { console.error("✘ " + fallo.message); process.exit(1) }
console.log("Capturas en " + SALIDA + ": " + fs.readdirSync(SALIDA).length + " archivos. Datos de prueba borrados.")
