// Función de Vercel: abre un enlace corto de Google Maps (maps.app.goo.gl/…) y devuelve la dirección larga a la que lleva,
// porque el navegador no puede seguir esa redirección (CORS). Solo sigue enlaces de Google Maps, https y a lo sumo 5 saltos:
// cada salto se vuelve a validar, para que no sirva de puente hacia otros sitios. No usa ni devuelve datos de nadie.
const HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "www.google.com", "google.com", "maps.google.com"])

const permitida = (u) => u.protocol === "https:" && HOSTS.has(u.hostname) && (u.hostname === "maps.app.goo.gl" || u.pathname.startsWith("/maps"))

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store")
  let actual
  try { actual = new URL(String(req.query?.url || "")) } catch { return res.status(400).json({ error: "Enlace inválido" }) }
  if (!permitida(actual)) return res.status(400).json({ error: "Solo se aceptan enlaces de Google Maps" })
  try {
    for (let salto = 0; salto < 5; salto++) {
      if (actual.hostname !== "maps.app.goo.gl" && actual.hostname !== "goo.gl") return res.status(200).json({ url: actual.toString() })
      const r = await fetch(actual, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" } })
      const destino = r.headers.get("location")
      if (!destino) break
      actual = new URL(destino, actual)
      if (!permitida(actual)) return res.status(400).json({ error: "El enlace lleva a otro sitio" })
    }
    return res.status(200).json({ url: actual.toString() })
  } catch {
    return res.status(502).json({ error: "No se pudo abrir el enlace" })
  }
}
