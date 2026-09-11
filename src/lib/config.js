// Bandera global para ocultar temporalmente, solo en la interfaz, todo lo
// que revela el modelo SaaS/multi-óptica (el anteproyecto de tesis presenta
// el sistema como si fuera para una sola óptica, no como un producto que se
// vende a varias). No borra código, tablas, ni afecta la arquitectura
// multi-tenant real por debajo — solo condiciona qué se renderiza.
//
// Default: oculto. Para volver a mostrarlo (uso operativo real de Diego
// administrando varias ópticas), definir VITE_MOSTRAR_SAAS=true en
// .env.local o en las variables de entorno del despliegue.
export const MODO_SAAS_VISIBLE = import.meta.env.VITE_MOSTRAR_SAAS === 'true'
