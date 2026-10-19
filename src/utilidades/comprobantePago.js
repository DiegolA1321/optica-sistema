// El comprobante de una transferencia que el paciente sube desde su portal (migración 0131): una foto (JPG o PNG) o un PDF de hasta 2 MB. Las fotos se reducen antes de enviarlas
// (un celular las hace de 5 MB o más); el PDF se envía tal cual.
export const TIPOS_COMPROBANTE = ["image/jpeg", "image/png", "application/pdf"]
export const MAX_BYTES_COMPROBANTE = 2 * 1024 * 1024
const LADO_MAXIMO = 1600

// Devuelve el mensaje si el archivo no sirve, o "" si sirve.
export function problemaDelComprobante(archivo) {
  if (!archivo) return "Elige la foto o el PDF de tu comprobante."
  if (!TIPOS_COMPROBANTE.includes(archivo.type)) return "El comprobante debe ser una foto (JPG o PNG) o un PDF."
  if (archivo.type === "application/pdf" && archivo.size > MAX_BYTES_COMPROBANTE) return "El PDF pesa más de 2 MB. Toma una foto del comprobante o envía uno más liviano."
  return ""
}

const aBase64 = (blob) => new Promise((resolve, reject) => {
  const lector = new FileReader()
  lector.onload = () => resolve(String(lector.result).split(",")[1] || "")
  lector.onerror = () => reject(new Error("No pudimos leer el archivo."))
  lector.readAsDataURL(blob)
})

// { nombre, tipo, base64 } listo para enviar. Una foto se reduce a 1600 px de lado y se guarda como JPG.
export async function prepararComprobante(archivo) {
  if (archivo.type === "application/pdf") return { nombre: archivo.name, tipo: archivo.type, base64: await aBase64(archivo) }
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("No pudimos abrir la foto.")); i.src = url })
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
    const lienzo = document.createElement("canvas")
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala))
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala))
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise((resolve) => lienzo.toBlob(resolve, "image/jpeg", 0.8))
    if (!blob || blob.size > MAX_BYTES_COMPROBANTE) throw new Error("La foto es demasiado grande. Toma otra más cerca del comprobante.")
    return { nombre: archivo.name.replace(/\.[^.]+$/, "") + ".jpg", tipo: "image/jpeg", base64: await aBase64(blob) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// El estado de un pago reportado, como lo lee el paciente.
export const ESTADO_PAGO = {
  por_verificar: { nombre: "Pago en verificación", tono: "azul" },
  confirmado: { nombre: "Pago confirmado", tono: "verde" },
  rechazado: { nombre: "Pago rechazado", tono: "rojo" },
}
