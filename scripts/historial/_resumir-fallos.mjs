// Resume la salida de la lista de Playwright: una línea por prueba fallida con el primer error. Uso: node _resumir-fallos.mjs <archivo>
import fs from "node:fs"
const t = fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)
const out = []
for (let i = 0; i < t.length; i++) {
  const m = t[i].match(/^\s+(\d+)\) \[chromium\] › e2e[\\/](\S+?):(\d+):\d+ › (.*)$/)
  if (!m) continue
  let e = ""
  for (let j = i + 1; j < i + 40; j++) {
    if (/^\s+(Error|TimeoutError)/.test(t[j]) || /Test timeout/.test(t[j])) { e = [t[j], t[j + 1], t[j + 2], t[j + 3], t[j + 4]].map((x) => (x || "").trim()).filter(Boolean).join(" | "); break }
  }
  out.push(`${m[1]} ${m[2]}:${m[3]} ${m[4].slice(0, 80)}\n     → ${e.slice(0, 380)}`)
}
console.log(out.join("\n"))
