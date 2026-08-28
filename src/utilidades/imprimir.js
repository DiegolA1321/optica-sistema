// Imprime un documento (factura, etc.) clonándolo a un portal fuera del árbol
// normal, en vez de imprimir la página completa — mismo patrón que
// ConsultaMedica.jsx usa para la receta, pero generalizado con una clase de
// impresión configurable para no pisar la de recetas si ambos documentos
// coexisten en la misma pantalla. No se tocó ConsultaMedica.jsx: sigue con
// su propia copia, esto es para nuevos documentos (factura y los que sigan).
export function imprimirDocumento(elementId, claseImpresion = "printing-documento") {
  const original = document.getElementById(elementId)
  if (!original) {
    window.print()
    return
  }
  const clon = original.cloneNode(true)
  clon.removeAttribute("id")

  // Los inputs/textarea no clonan su value: se reemplazan por texto plano.
  const origs = original.querySelectorAll("input, textarea")
  const clones = clon.querySelectorAll("input, textarea")
  clones.forEach((el, i) => {
    const val = (origs[i] && origs[i].value) || ""
    const div = document.createElement("div")
    div.textContent = val
    div.style.cssText = "border-bottom:1px solid #cbd5e1;padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;min-height:22px;"
    el.replaceWith(div)
  })

  clon.querySelectorAll(".no-print").forEach((n) => n.remove())
  clon.style.border = "none"
  clon.style.boxShadow = "none"
  clon.style.borderRadius = "0"

  const previo = document.getElementById("print-portal")
  if (previo) previo.remove()
  const portal = document.createElement("div")
  portal.id = "print-portal"
  portal.appendChild(clon)
  document.body.appendChild(portal)
  document.body.classList.add(claseImpresion)

  const limpiar = () => {
    document.body.classList.remove(claseImpresion)
    const p = document.getElementById("print-portal")
    if (p) p.remove()
  }
  window.addEventListener("afterprint", limpiar, { once: true })
  window.print()
  setTimeout(limpiar, 1500)
}

// Estilos @media print correspondientes — insertar en un <style> junto al
// documento imprimible, con la misma claseImpresion pasada a imprimirDocumento.
export const estilosImpresion = (claseImpresion = "printing-documento") => `
  @page { margin: 1.4cm; }
  #print-portal { display: none; }
  @media print {
    body.${claseImpresion} > *:not(#print-portal) { display: none !important; }
    #print-portal { display: block !important; }
    #print-portal, #print-portal * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
`
