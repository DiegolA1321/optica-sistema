// "-1.50 -0.50 x90" o "No registrada": esfera, cilindro y eje de un ojo, como los lee el paciente en pantalla y en el PDF de su receta.
export const textoGraduacionOjo = (ojo = {}) => (ojo.esfera || ojo.cilindro || ojo.eje ? [ojo.esfera || "—", ojo.cilindro, ojo.eje ? `x${ojo.eje}` : ""].filter(Boolean).join(" ") : "No registrada")
