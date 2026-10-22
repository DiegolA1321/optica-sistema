# Ronda 4 — Ventas e Inventario (22 oct. 2026)

Diseño aprobado: `docs/ventas-inventario-propuesta/` (Ventas · lista, Nueva venta, Pedidos de lentes, Inventario · lista, Agregar producto, Registrar ingreso).
Requisitos: `docs/feedback-ing/requisitos-reunion-20oct.md` (VEN-1 a VEN-9, INV-1 a INV-8, CRM-2, D7, D8).

Hecho en localhost, sin publicar. **Una sola migración, escrita y ensayada, SIN APLICAR (espera a Diego): `0141_stock_maximo_por_producto.sql`.**

## Qué cambió

**Ventas** (`paginas/Ventas.jsx`, `componentes/ventas/PestanaVentas.jsx`, `PestanaPedidos.jsx`, `Piezas.jsx`)
- Dos pestañas: «Ventas» (por defecto) y «Pedidos de lentes». Se fueron «Por vender», «Comprobantes» y «Cobros y saldos» (los enlaces de antes —`tab=cola|porvender|comprobantes|cobros|saldos|ordenes`— siguen llegando, a su pestaña nueva).
- «Ventas»: selector de período (Hoy · Esta semana · Este mes · Elegir fechas), búsqueda y «Filtrar ▾» (ventas anuladas y forma de pago; además «Factura electrónica» para que el «Abrir en Ventas» de Reportes siga reproduciendo sus filtros). La franja (vendido, cobrado, por cobrar, pago por verificar, lentes en el laboratorio) suma lo que se ve (`utilidades/ventasLista.js`: vendido = cobrado + por cobrar) y cada dato filtra la lista, con el filtro a la vista y su equis. La lista va en columnas (fecha, paciente con su CV, detalle, total, pagado, estado del pago) y al pulsar una venta se abre su detalle completo (`DetalleComprobante`: productos, abonos con fechas, saldo, factura electrónica, pago por verificar con «Revisar», estado de los lentes, «Registrar abono», «Imprimir comprobante», «Anular venta»).
- Se quitó el número del menú de Ventas (`contarAvisosVentas` ya no existe; el botón «Requieren atención» de la cabecera sigue contando lo mismo que el Inicio).
- «Pedidos de lentes»: lista en columnas, una sola acción según el momento (Marcar listo · Contactar con la ventana única y el mensaje de lentes listos · Entregar), filtros En curso, Atrasados, Listos sin avisar, Entregados y Todos, y el laboratorio. «En el laboratorio» es un filtro que solo se llega desde la franja de Ventas y aparece con su equis. Estados: En el laboratorio · Atrasado N días · Listo · sin avisar · Listo · avisado · Entregado (`estadoDePedido`, una sola cuenta para la lista, el detalle de la venta y el detalle del pedido).
- **Nueva venta** (`ComprobanteVentaModal.jsx`, la misma ventana para Ventas, el perfil, la ficha y Citas): último diagnóstico con «Usar como guía» (lleva a la luna lo que el optómetra recomendó —tipo y filtros, `lunaDeTexto`—, deja la venta vinculada a esa consulta y marca «En atención» una solicitud del portal); pestañas Montura · Luna · Servicio con su color completo; lupa dentro del buscador; el producto elegido entra con 1 unidad (la cantidad se cambia en su fila); sin casilla «Esta venta incluye lentes»: con lunas aparece «Incluye lunas: se creará el pedido de lentes» con el laboratorio; descuento de fidelización sugerido solo con permiso de descuentos; «Pago hoy» (todo, una parte o nada: el resto queda como saldo) con su forma de pago y «Dividir el pago».
- «Orden de laboratorio» → «Pedido de lentes» en lo que ve Ventas, el detalle, el aviso de guardado, Anular venta y Eliminar paciente. **Reportes › Laboratorios conserva su texto «órdenes»** (es otro módulo cerrado, regla 27): si Diego quiere el mismo nombre, es un cambio de texto aparte.

**CRM y Por vender** — el paciente que recibió su diagnóstico y no ha comprado entra a «Para contactar» con el motivo «Recibió su diagnóstico y no ha comprado» (`crmContactos.motivosDe`: pase abierto, sin una venta posterior), con «Contactar» (la ventana única con la plantilla del CRM) y su proforma. Sin cambio de base de datos (el motivo y su plantilla ya existían desde la 0135; «Contactar» usa `registrar_contacto_de_aviso`). El Inicio cuenta exactamente esa lista (un aviso «N pacientes recibieron su diagnóstico y no han comprado» en Ventas, que abre el CRM con ese filtro); «Reportes → cola» y el distintivo «Por vender» de la lista de Pacientes también llevan allí. El perfil conserva su aviso con «Vender la receta» y la proforma.

**Laboratorios** — catálogo en **Configuración → Laboratorios** (agregar, editar, desactivar; nunca se elimina). Vive en la parametrización de la óptica (`parametrizacion.laboratorios`, como la fidelización): sin cambio de esquema. `LaboratoriosContexto` lo da a «Nueva venta», al pedido de lentes y a la lista. El panel ofrece «Agregarlos al catálogo» con los que ya usan los pedidos (unificando los nombres parecidos) y avisa si dos del catálogo parecen el mismo.

**Inventario** (`paginas/Inventario.jsx`) — pestañas Activos / Descontinuados (cada descontinuado, «Reactivar»); franja (productos activos con sus unidades, valor, stock bajo, sobrestock, sin vender en 90 días) cuyos datos filtran la lista (el valor abre su desglose); cada producto con existencia, mínimo, máximo y barrita (rojo bajo, ámbar sobre, verde en orden; `utilidades/inventario.js`: `estadoDeStock`). «Conteo físico» y su historial se reemplazaron por «Imprimir hoja de conteo» (código, descripción, existencia en el sistema y una columna en blanco; las diferencias se corrigen con «Ajustar stock»). **Configuración → Inventario**: stock mínimo y máximo generales. «Agregar producto»: si ya existe (activo o descontinuado) avisa al escribir y ofrece «Reactivarlo»; mínimo y máximo con «Usar el general (N)». «Registrar ingreso»: unidades y costo por unidad opcional (queda como el costo del producto), y si con el ingreso se pasa del máximo avisa antes («Quedarías con 58 u., casi el doble de tu máximo (30). Puedes registrarlo igual.») con «Registrar igual». Inicio: la columna Inventario de «Requiere tu atención» suma el sobrestock (con «Descartar», como el stock bajo). **El máximo no limita nada: solo avisa.**

## Decisiones que tomé y Diego puede revertir
1. En la imagen de «Pedidos de lentes» el botón de cada fila cae debajo del número de pedido (parece un salto de línea de la maqueta); lo puse en una sexta columna, a la derecha, alineado.
2. Los colores del diseño son lisos; las píldoras activas, los botones principales y la franja usan el azul de la marca del sistema (el degradado de siempre) para no abrir una excepción solo en estos dos módulos (regla 14).
3. «Nueva venta» ya no pide el número de la factura electrónica (se registra después en el detalle de la venta, que es donde se descargan sus archivos) ni ofrece «Cuotas» (queda «Pago hoy» + saldo con abonos, que es lo que muestra el diseño). Las ventas en cuotas que ya existen se ven y se cobran igual.
4. Se perdió de Ventas «Cobrado hoy por método de pago» con su Excel; el mismo número sale del período «Hoy» + «Filtrar › Forma de pago» y el Excel de cobros está en Reportes.
5. «No compró» ya no existe en Ventas: en el CRM, el resultado «No le interesa» deja descansar al paciente 180 días.

## Los laboratorios repetidos — propuesta para unificar (NO aplicada)

Datos reales hoy (solo lectura): Óptica Demo — «Laboratorio Visión Norte» (7 pedidos), «Óptica Lab Guayaquil» (7), «LabLentes Quito» (6) y **«Laboratorio Visión» (2)**, que es el mismo laboratorio que «Laboratorio Visión Norte». Óptica Solna Vision — «Lab Norte», «Lab Sur» y un pedido sin laboratorio (sin repetidos).

Propuesta: 1) quedarse con «Laboratorio Visión Norte» (el más usado) y 2) pasarle los 2 pedidos de «Laboratorio Visión». Con el protocolo de siempre (respaldo, ensayo que revierte, aplicación, verificación), y **solo cuando Diego lo apruebe**:

```sql
-- Óptica Demo: unificar «Laboratorio Visión» con «Laboratorio Visión Norte» (2 pedidos).
update ordenes_laboratorio
   set laboratorio = 'Laboratorio Visión Norte'
 where optica_id = (select id from opticas where nombre = 'Óptica Demo')
   and laboratorio = 'Laboratorio Visión';
```

Sin esa corrección, nada se rompe: el panel «Laboratorios» ya los une al traerlos al catálogo, y los 2 pedidos viejos siguen mostrando el nombre con que se pidieron (el filtro «Laboratorio» de la lista los ofrece aparte).

## Migración `0141_stock_maximo_por_producto.sql` (ESCRITA Y ENSAYADA, SIN APLICAR)
`alter table inventario add column stock_maximo integer` (NULL = «usar el general», entre 1 y 9999), sin tocar ningún dato (22 productos hoy, todos quedan «usar el general»), sin función, sin política nueva y sin disparador (el máximo no limita nada). Ensayo `scripts/historial/ensayo-0141.mjs` (10/10, revierte). **Mientras no se aplique**: el máximo general y el sobrestock funcionan (viven en la parametrización); lo único que no se puede es guardar un máximo propio de un producto (la pantalla lo dice: «El stock máximo propio todavía no está disponible…»). Al aplicarla: respaldo con `pg_dump`, ensayo, aplicar, `scripts/historial/verificar-0141.mjs` (por hacer con la sesión real al aplicar).

## Lo que una óptica nueva necesita de esta ronda (para la ronda de cierre)
- **Catálogo de laboratorios**: nace vacío. «Nueva venta» dice «Sin laboratorios» y manda a Configuración → Laboratorios; el pedido se puede crear sin laboratorio. Si una óptica ya tiene pedidos, el panel ofrece traer sus laboratorios.
- **Stock mínimo y máximo generales**: no hay que crear nada (10 y 30 salen del código hasta que el administrador los cambie en Configuración → Inventario); cada producto empieza en «Usar el general».
- **Plantilla del CRM «Recibió su diagnóstico y no ha comprado»**: ya existe para todas las ópticas (`PLANTILLAS_BASE.por_vender`, 0135); no hay plantillas nuevas. La plantilla «Lentes listos» (la de «Contactar» de un pedido) también existía.
- **Permisos y roles**: sin cambios (el rol «Ventas» ahora describe «Ventas, pedidos de lentes y saldos por cobrar»). Quien no tiene «CRM: ver» ve el aviso «por vender» del Inicio y puede contactar desde ahí, pero no abre el CRM.
- **Base de datos**: solo la 0141 (columna vacía por defecto en todas las ópticas, las de hoy y las que se creen).

## Pendiente para la ronda de cierre
- Aplicar la 0141 (con la aprobación de Diego) y verificar con sesión real el máximo propio de un producto.
- Decidir la unificación de «Laboratorio Visión» (SQL arriba).
- Suite completa de Playwright: **no se corrió ni se tocó ninguna e2e en esta ronda** (instrucción de Diego). Estas 14 mencionan textos que cambiaron («Por vender», «Comprobantes», «Cobros y saldos», «Órdenes de laboratorio», «Conteo físico», «Esta venta incluye lentes», «Descripción de la montura o accesorio», «Tomar datos», «Marcar lista», «Avisar por WhatsApp») y hay que ajustarlas antes de la corrida final: `auditoria-correcciones`, `factura-electronica`, `flujo-completo`, `inicio-ventanas`, `inventario-v2`, `pago-por-transferencia`, `perfil-reorganizado`, `portal-recorrido`, `portal-solicitar-lentes`, `roles`, `ronda1-acciones`, `ronda3a-capturas`, `ventas-abonos` y `ventas-v2`. Las pruebas unitarias sí se actualizaron (Vitest completo: 1755 de 1755).

## Segunda vuelta de la Ronda 4 (22 oct. 2026): pedidos sin laboratorio y detalles de Diego

**Navegación:** el menú no navegaba cuando la dirección tenía dos barras (`//?optica=…`): `pushState` rechazaba la ruta («SecurityError»). `utilidades/urlEstado.js` exporta `rutaSegura()` (colapsa las barras iniciales) y la usan `irADestino` y todo `pushState`/`replaceState` (Dashboard, App, `escribirParam`). `e2e/navegacion-modulos.spec.js` tiene un test que entra por `//?optica=…` y recorre el menú.

**Pedidos sin laboratorio:** la óptica no administra al laboratorio; el pedido es el registro simple de lo que se encarga afuera.
- «Pedidos de lentes» → **«Pedidos»**. Nace solo cuando una venta incluye lunas: «Nueva venta» pide la **entrega** («Retira en la óptica» o «Envío a domicilio», con su dirección) y la **fecha aproximada** (por defecto hoy + los días de **Configuración → Ventas**, 7 si no hay) y crea el pedido al guardar (`utilidades/pedidosVenta.js`), sin ventana intermedia.
- Estados: En proceso → Listo → Entregado, y «Atrasado N días» si pasa la fecha sin estar listo (cada paso queda con fecha y quién, en el historial). Una acción por momento: **Marcar listo**, **Avisar al paciente** (la ventana única de Contactar; la plantilla «Pedido listo» lleva `{entrega}`: «Te esperamos en la óptica para retirarlo» o «Te lo enviaremos a …») y **Entregar**.
- Filtros: En proceso, Atrasados, Listos para entregar, Entregados, Todos + buscador (paciente o número). «Listos sin avisar» sigue llegando desde el Inicio como filtro con su equis. La franja de Ventas dice «Pedidos en proceso» y lleva a ese filtro.
- Se quitó el laboratorio de todo: Configuración → Laboratorios (ahora es Configuración → **Ventas**, con los días por defecto), el catálogo y su contexto, Nueva venta, el pedido, la lista, el detalle, Inicio, Reportes (la pestaña **Pedidos** de Reportes mide atrasos y tiempos de entrega, por retira/envío), Excel y la copia que se imprime. El laboratorio ya guardado en la base **no se borra**: solo no se muestra.
- Portal («Tus lentes»), perfil y Inicio usan los mismos estados; el portal dice «te los enviaremos» si es envío (necesita la migración 0142 para recibir la entrega).
- `ParametrizacionContexto` (antes `LaboratoriosContexto`) da la parametrización a «Nueva venta» donde no la pasa el padre.

**Migración `0142_pedidos_entrega_y_fecha_aproximada.sql` (ESCRITA Y ENSAYADA, SIN APLICAR):** columnas `entrega` ('retira'|'envio', por defecto 'retira') y `direccion_entrega` en `ordenes_laboratorio` (envío exige dirección), `crear_orden_laboratorio`/`actualizar_orden_laboratorio` con las mismas firmas leyendo la entrega, y `mis_ordenes_paciente` con `entrega`. Ensayo que revierte: `scripts/historial/ensayo-0142.mjs` (20/20). Sin ella la pantalla funciona (todos «retira»), pero no se puede guardar un envío.

**Detalles:** pestañas sin flechas y con la línea de lado a lado (`Pestanas` en `Piezas.jsx`); selector de período del ancho justo; Inventario sin Stock bajo/Sobrestock (la franja los filtra y recalcula lo que se ve); «+» categoría abre su ventanita (`CampoCategoria`); avisos de campos obligatorios del sistema (`noValidate`); «Imprimir hoja de conteo» descarga un PDF de varias páginas (`descargarHojaConteo.jsx`, `HojaConteo.jsx`, `conteoImpresion.js`).

**e2e pendientes de ajustar (suite final):** `ventas-v2`, `flujo-completo`, `perfil-reorganizado`, `ronda3a-capturas` siguen nombrando «Órdenes de laboratorio»/«Laboratorio»; `reportes` e `inventario-v2` ya usan «Pedidos».
