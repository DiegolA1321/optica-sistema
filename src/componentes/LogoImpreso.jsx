// El logo de la óptica en las HOJAS (receta, diagnóstico impreso, hoja de conteo): el equivalente de LogoOptica para documentos que se dibujan con estilos en línea
// (la impresión y el PDF no dependen de las clases de la pantalla). Mismo criterio: entero (object-fit: contain, ni deformado ni cortado) y con un tamaño máximo.
//   alto: alto del logo en px · anchoMax: lo más ancho que puede ser (logos horizontales) · ancho: ancho fijo (el PDF lo calcula con la proporción del logo, ver anchoDeLogo).
// `data-logo` marca el lugar donde el PDF dibuja la imagen (un JPEG), porque en el PDF el <img> no se copia.

// Ancho de la caja del logo según su proporción (ancho/alto): ni más ancho que `max` ni más angosto que la mitad del alto.
export const anchoDeLogo = (proporcion, alto = 52, max = 150) => {
  const p = Number.isFinite(proporcion) && proporcion > 0 ? proporcion : 1
  return Math.min(max, Math.max(Math.round(alto / 2), Math.round(alto * p)))
}

export default function LogoImpreso({ url, nombre = "", alto = 52, anchoMax = 150, ancho }) {
  if (!url) return null
  return (
    <span data-logo style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", justifyContent: "center", height: alto, width: ancho, maxWidth: anchoMax }}>
      <img src={url} alt={nombre ? `Logo de ${nombre}` : "Logo"} style={{ display: "block", height: "100%", width: ancho ? "100%" : "auto", maxWidth: "100%", objectFit: "contain" }} />
    </span>
  )
}
