// Las pruebas del examen y la salud ocular de una consulta, como líneas «título: texto» para el documento del diagnóstico. Solo trae lo que se registró (nada vacío). Lógica pura.
const por = (x) => (x?.od || x?.oi ? `OD ${x.od || "—"} · OI ${x.oi || "—"}` : "")

export function lineasDeExamen(consulta = {}) {
  const ex = consulta.examen || {}
  const bio = ex.biomicroscopia || {}
  const fi = consulta.ficha || null
  const salud = fi?.salud || null
  const lineas = []
  const poner = (t, v) => { if (v) lineas.push([t, v]) }
  poner("Motilidad ocular", ex.testMotor)
  const cover = fi?.coverTest?.tipo ? `${fi.coverTest.tipo}${fi.coverTest.magnitud ? ` ${fi.coverTest.magnitud}Δ` : ""}`
    : ((ex.coverTestLejos && ex.coverTestLejos !== "Ortoforia") || (ex.coverTestCerca && ex.coverTestCerca !== "Ortoforia")) ? `lejos ${ex.coverTestLejos || "—"} · cerca ${ex.coverTestCerca || "—"}` : ""
  poner("Cover test", cover)
  const bioNueva = salud?.biomicroscopia
  if (bioNueva) {
    for (const [k, t] of [["parpados", "Párpados y conjuntiva"], ["cornea", "Córnea"], ["camara", "Cámara anterior y cristalino"]]) poner(t, por({ od: bioNueva.od?.[k], oi: bioNueva.oi?.[k] }))
  } else {
    poner("Párpados y conjuntiva", bio.parpados)
    poner("Córnea", bio.cornea)
    poner("Cámara anterior y cristalino", bio.camara)
  }
  poner(salud ? "Fondo de ojo" : "Oftalmoscopia", salud ? por(salud.fondo) || ex.oftalmoscopia : ex.oftalmoscopia)
  if (ex.pioOd || ex.pioOi) poner("Presión intraocular", `OD ${ex.pioOd || "—"} · OI ${ex.pioOi || "—"} mmHg`)
  if (ex.testColor && ex.testColor !== "Normal") poner("Test de color", ex.testColor)
  return lineas
}
