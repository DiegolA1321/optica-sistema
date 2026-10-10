// Antecedentes importantes: busca en el texto libre de la ficha (antecedentes personales y familiares) las condiciones que el
// optómetra debe ver al atender, ignorando lo negado ("niega diabetes", "sin glaucoma", "no hipertensión ni diabetes").
// Es una ayuda por texto, no un diagnóstico: lo que no esté escrito con estas palabras no se detecta.

const TERMINOS = [
  { clave: "diabetes", etiqueta: "Diabetes", patron: /diabet/ },
  { clave: "hipertension", etiqueta: "Hipertensión", patron: /hipertens|presion (arterial )?alta|\bhta\b/ },
  { clave: "glaucoma", etiqueta: "Glaucoma", patron: /glaucom/ },
  { clave: "retina", etiqueta: "Desprendimiento de retina", patron: /desprendimiento (de (la )?)?retin/ },
  { clave: "queratocono", etiqueta: "Queratocono", patron: /queratocon/ },
  { clave: "uveitis", etiqueta: "Uveítis", patron: /uveit/ },
  { clave: "cataratas", etiqueta: "Cataratas", patron: /catarata/ },
  { clave: "cirugia", etiqueta: "Cirugía ocular", patron: /cirugia (ocular|de (los )?ojos?|refractiva)|\blasik\b|vitrectomia|trabeculectomia/ },
  { clave: "ambliopia", etiqueta: "Ambliopía", patron: /ambliop|ojo vago/ },
]

const NEGADORES = /\b(no|ni|niega|niegan|sin|ningun[oa]?|descarta|negativo|nunca)\b/

const normalizar = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Una frase se separa en cláusulas (coma, punto, punto y coma, salto de línea, "pero"); lo negado dentro de una cláusula
// se descarta si el negador aparece antes del término.
function detectar(texto, origen) {
  const hallados = []
  for (const clausula of normalizar(texto).split(/[,.;\n]|\bpero\b|\baunque\b/)) {
    for (const t of TERMINOS) {
      const m = t.patron.exec(clausula)
      if (!m) continue
      if (NEGADORES.test(clausula.slice(0, m.index))) continue
      if (!hallados.some((h) => h.clave === t.clave)) hallados.push({ clave: t.clave, etiqueta: t.etiqueta, origen })
    }
  }
  return hallados
}

// ficha: { antecedentes, antecedentesFamiliares } → [{ clave, etiqueta, origen: "personal" | "familiar" }]
export function antecedentesRelevantes(ficha) {
  if (!ficha) return []
  return [...detectar(ficha.antecedentes, "personal"), ...detectar(ficha.antecedentesFamiliares, "familiar")]
}

// "Diabetes · Glaucoma (familiar)"
export const textoAntecedentes = (lista) => lista.map((a) => a.etiqueta + (a.origen === "familiar" ? " (familiar)" : "")).join(" · ")
