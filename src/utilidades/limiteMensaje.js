// El largo máximo de un mensaje, el mismo en todo el sistema: el soporte ofreciendo ayuda o respondiendo, el administrador escribiendo al soporte, publicando un
// aviso o contestando a su personal, y el personal escribiendo a su administrador. El servidor lo valida también (migración 0122: el disparador
// `_limitar_largo_mensaje`), así que escribir directo en la API no lo salta.
export const LIMITE_MENSAJE = 2000
// El contador «N de 2000» solo aparece al acercarse al límite: antes es ruido.
export const UMBRAL_CONTADOR = 1800
export const contadorVisible = (largo) => largo >= UMBRAL_CONTADOR
export const textoContador = (largo) => `${largo} de ${LIMITE_MENSAJE}`
