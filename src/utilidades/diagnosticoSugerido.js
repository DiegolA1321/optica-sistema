// Diagnóstico sugerido a partir de la refracción final: el sistema propone la categoría del catálogo de la óptica (la que ya existe, nunca una nueva) y avisa si hay adición (presbicia).
// El optómetra lo confirma o lo cambia: esto nunca elige por él.
import { aNumero } from "./refraccion"

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

// Qué tiene un ojo: miopía (esfera ≤ −0.50), hipermetropía (esfera ≥ +0.50), astigmatismo (cilindro ≥ 0.50 en valor absoluto). Una esfera de ±0.25 o menos no cuenta como defecto.
export function tipoDeOjo(ojo) {
  const e = aNumero(ojo?.esfera)
  const c = aNumero(ojo?.cilindro)
  if (e === null && c === null) return null
  return { miopia: e !== null && e <= -0.5, hipermetropia: e !== null && e >= 0.5, astigmatismo: c !== null && Math.abs(c) >= 0.5 }
}

// { categorias: [nombre del catálogo...], motivo: "texto", presbicia: boolean, presbiciaCategoria: nombre|null } o null si no hay nada que sugerir.
//   `catalogo`: las categorías que configura la óptica. `receta`: { od, oi, medidas } (la refracción final del formulario).
export function sugerirDiagnostico(receta, catalogo = []) {
  const ojos = [tipoDeOjo(receta?.od), tipoDeOjo(receta?.oi)].filter(Boolean)
  if (!ojos.length) return null
  const busca = (...nombres) => catalogo.find((c) => nombres.map(sinTildes).includes(sinTildes(c))) || null
  const miopia = ojos.some((o) => o.miopia)
  const hiper = ojos.some((o) => o.hipermetropia)
  const astig = ojos.some((o) => o.astigmatismo)
  let categorias = []
  let motivo = ""
  if (miopia && hiper) {
    // Un ojo miope y otro hipermétrope (anisometropía): no se elige por el optómetra.
    categorias = [busca("Miopía"), busca("Hipermetropía"), astig ? busca("Astigmatismo") : null].filter(Boolean)
    motivo = "Un ojo con miopía y el otro con hipermetropía"
  } else if (miopia) {
    const junto = astig && busca("Miopía y astigmatismo")
    categorias = junto ? [junto] : [busca("Miopía"), astig ? busca("Astigmatismo") : null].filter(Boolean)
    motivo = astig ? "Esfera negativa con cilindro" : "Esfera negativa"
  } else if (hiper) {
    const junto = astig && busca("Hipermetropía y astigmatismo")
    categorias = junto ? [junto] : [busca("Hipermetropía"), astig ? busca("Astigmatismo") : null].filter(Boolean)
    motivo = astig ? "Esfera positiva con cilindro" : "Esfera positiva"
  } else if (astig) {
    categorias = [busca("Astigmatismo")].filter(Boolean)
    motivo = "Cilindro sin defecto de esfera"
  } else {
    categorias = [busca("Sin alteración refractiva", "Sin alteracion refractiva", "Normal")].filter(Boolean)
    motivo = "Esfera y cilindro dentro de lo normal"
  }
  const adicion = [receta?.medidas?.adicionOd, receta?.medidas?.adicionOi, receta?.medidas?.adicion].map(aNumero).some((n) => n !== null && n > 0)
  const presbiciaCategoria = adicion ? busca("Presbicia", "Vista cansada") : null
  if (!categorias.length && !adicion) return null
  return { categorias, motivo, presbicia: adicion, presbiciaCategoria }
}
