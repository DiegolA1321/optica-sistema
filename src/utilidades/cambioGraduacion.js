// El cambio de graduación entre dos recetas: UNA sola función para la ficha, el perfil y el portal. Compara la ESFERA de cada ojo (no el equivalente esférico), en pasos de 0.25, y lo dice en palabras:
// «0.50 más de miopía», «0.25 menos de hipermetropía», «Sin cambios». Si el ojo cruza de lado (de miopía a hipermetropía o al revés), lo dice tal cual.
// El veredicto del paciente (Aumentó, Disminuyó, Sin cambios) sale de esas mismas cuentas: el de mayor cambio manda.

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
const aPaso = (n) => Math.round(n * 4) / 4
// «−1.25» (signo menos de verdad, punto decimal) para decir un valor dentro de una frase.
const dos = (n) => Math.abs(n).toFixed(2)
const valor = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + dos(n)
const ladoDe = (n) => (n < 0 ? "miopía" : n > 0 ? "hipermetropía" : null)

// El cambio de la esfera de UN ojo. null si falta alguna de las dos.
// { antes, ahora, delta, magnitud, sentido: "igual" | "mas" | "menos" | "cruce", tipo, aumento, texto }
//   · magnitud: cuánto cambió (siempre positiva, en pasos de 0.25)   · aumento: con signo, + si necesita más corrección que antes
export function cambioDeEsfera(antes, ahora) {
  const a = num(antes)
  const b = num(ahora)
  if (a === null || b === null) return null
  const x = aPaso(a)
  const y = aPaso(b)
  const delta = aPaso(y - x)
  if (delta === 0) return { antes: x, ahora: y, delta: 0, magnitud: 0, sentido: "igual", tipo: ladoDe(y) || ladoDe(x), aumento: 0, texto: "Sin cambios" }
  const la = ladoDe(x)
  const lb = ladoDe(y)
  if (la && lb && la !== lb) {
    const magnitud = Math.abs(delta)
    return { antes: x, ahora: y, delta, magnitud, sentido: "cruce", tipo: lb, aumento: magnitud, texto: `Pasó de ${la} (${valor(x)}) a ${lb} (${valor(y)})` }
  }
  const tipo = lb || la
  const mas = Math.abs(y) > Math.abs(x)
  const magnitud = Math.abs(Math.abs(y) - Math.abs(x))
  return { antes: x, ahora: y, delta, magnitud, sentido: mas ? "mas" : "menos", tipo, aumento: mas ? magnitud : -magnitud, texto: `${dos(magnitud)} ${mas ? "más" : "menos"} de ${tipo}` }
}

// El cambio de los dos ojos entre una receta y la anterior: { od, oi, verdicto, magnitud } o null si no hay ningún ojo comparable.
// `verdicto`: Sin cambios si ningún ojo cambió; si no, el sentido del ojo que más cambió (a igualdad, Aumentó).
export function cambioEntre(reciente, previa) {
  const od = cambioDeEsfera(previa?.od?.esfera, reciente?.od?.esfera)
  const oi = cambioDeEsfera(previa?.oi?.esfera, reciente?.oi?.esfera)
  const ojos = [od, oi].filter(Boolean)
  if (!ojos.length) return null
  const mayor = ojos.reduce((m, o) => (Math.abs(o.aumento) > Math.abs(m.aumento) ? o : m), ojos[0])
  const verdicto = ojos.every((o) => o.sentido === "igual") ? "Sin cambios" : mayor.aumento >= 0 ? "Aumentó" : "Disminuyó"
  return { od, oi, verdicto, aumento: mayor.aumento }
}

// «Ojo derecho 0.50 más de miopía · ojo izquierdo sin cambios», para una línea de la ficha, del perfil o del portal. `siglas`: «OD» y «OI» en vez de «Ojo derecho» y «Ojo izquierdo».
export function lineaDeCambio(cambio, { siglas = false } = {}) {
  if (!cambio) return ""
  const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1)
  const partes = [[siglas ? "OD" : "Ojo derecho", cambio.od], [siglas ? "OI" : "Ojo izquierdo", cambio.oi]].filter(([, c]) => c)
  return partes.map(([n, c]) => `${n}: ${minus(c.texto)}`).join(" · ")
}
