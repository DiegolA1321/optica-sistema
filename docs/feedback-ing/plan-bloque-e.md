# Bloque E: ventas e inventario (R57 a R59)

Rama `bloque-e`. Fuentes: sección 6 de `requisitos-reunion-29sep.md` (R57 a R59), secciones 3.4 y 3.8 y el ajuste 6.2 de `vision-sistema.md`, y los pendientes anotados para este bloque en `plan-bloque-d.md` (línea 123) y `plan-prioridad-1.md` (decisión 12).

**Estado (7 oct.): Bloque E terminado.** Migración 0094 aplicada y verificada contra la base real; módulo de Ventas, comprobantes internos, luna como texto e inventario simplificado construidos y recorridos en el navegador. El resto del documento conserva el análisis y el diseño originales; la sección 8 resume lo que se hizo y en qué se apartó del diseño.

Backup previo: `C:\Users\diego\backups-optica\pre-bloque-e-2026-10-06.dump` (`pg_dump -Fc` del esquema `public`, 356 KB, fuera del repositorio porque contiene datos de pacientes). El esquema `auth` no está incluido; esta migración no lo toca.

---

## 1. Hallazgos que cambian el diseño

1. **Las lunas ya casi no son inventario.** El inventario real tiene 2 productos en total, ambos en la categoría "Armazones" y ambos en realidad lentes. Las categorías configurables de las 4 ópticas son solo "Armazones" y "Accesorios". No existe un campo "tipo de producto": una luna en inventario es solo un armazón mal categorizado. El inventario que "hay que simplificar" ya es simple; lo que sobra es el **vínculo** entre la receta, la venta y el inventario (ver 3.2).
2. **La orden de laboratorio ya guarda la luna como texto** (`tipo_lente`, `material`, `antirreflejo`, `filtro_azul`, `fotocromatico`, `otros_tratamientos`, `montura`, migración 0087). R57 y R58 ya se cumplen en la orden; faltan en la venta.
3. **El "número de factura" de la orden (R36) no existe.** `ordenesLaboratorio.js:155` imprime `orden.facturaNumero` solo si existe, pero `facturas_venta` no tiene ningún número y ningún mapper lo llena. La impresión nunca muestra el comprobante. Hace falta un correlativo interno, además del número de la factura electrónica externa.
4. **"Factura" es una palabra casi solo interna.** Los textos que el usuario ve y dicen "factura" son pocos (lista en 3.3). La mayoría de las coincidencias son nombres técnicos (`facturas_venta`, `facturaId`, `crear_factura_venta`).
5. **Las facturas de `Mensajes.jsx` y `SuperadminPanel.jsx` son otra cosa**: la tabla `facturas` es la suscripción SaaS que la plataforma le cobra a cada óptica (aviso ya registrado en la migración 0072). No se renombran en este bloque. Decisión pendiente en 6.9.
6. **El permiso `ventas` ya existe** en el catálogo de roles (`roles.js:19`, migración 0090) y en la base (`optica_de_vendedor(nivel)`), con "crear = vender y proformas, editar = abonos y órdenes, eliminar = anular". Lo que falta es que sea **módulo del menú**: hoy no está en `OPCIONES` (`Dashboard.jsx:89-106`) ni en `NOMBRES_MENU`/`menuDePermisos` (`roles.js`).
7. **La interfaz de ventas vive dentro de Pacientes** (3083 líneas): la cola, las órdenes globales, los saldos, y los 6 modales de venta están montados en `Pacientes.jsx`. El contador del menú ya sale de la lógica de Ventas (`Dashboard.jsx:143-145`) pero se pinta sobre el ítem "Pacientes" (`Dashboard.jsx:761`).
8. **Código legado sin uso.** La tabla `ventas` tiene 0 filas, `registrar_venta_producto` solo la usa código viejo, y `consultas.producto_id`/`producto_nombre`/`monto_venta` quedaron de ese camino. No se tocan en este bloque; se anotan como limpieza posterior.

---

## 2. Análisis de brechas

| Requisito | Estado hoy | Brecha |
|---|---|---|
| R57 Lunas como texto con precio general, no stock | Parcial | La orden ya las guarda como texto. En la venta, la luna es una línea "servicio" libre o un producto de inventario con stock. En la ficha, "Lente a recomendar" se puede vincular a un producto (`ConsultaMedica.jsx:386-392`, `2064-2100`) y eso precarga una línea de producto con descuento de stock (`costosConsulta.js:lineasCobroConsulta`). |
| R58 Solo monturas y accesorios, genéricos | Cumplido en datos | El inventario ya solo ofrece "Armazones" y "Accesorios", pero la pantalla y el buscador de venta lo llaman "productos" y no avisan que las lunas no van ahí. Hay 2 lentes mal categorizados. |
| R59 Venta: paciente, diagnóstico, montura, luna y filtros, precio final | Parcial | `FacturaVentaModal` ofrece productos (con stock) y servicios (texto libre). No hay un bloque de luna con tipo y filtros, ni la luna precarga la orden. El precio total sale de la suma de líneas. |
| R34-R39 y 3.4 (módulo propio, tablero de órdenes) | Parcial | Todo funciona, pero dentro de Pacientes y como filtros de su lista. No hay módulo, ni ítem de menú, ni página propia. |
| Ajuste 6.2: "comprobante de venta interno" + número externo | No iniciado | ~10 textos visibles dicen "factura"; el comprobante no tiene número; no hay campo para la factura electrónica. |
| Pendiente D (`plan-bloque-d.md:123`) | Abierto | El contador del menú debe pasar de Pacientes a Ventas. |
| Pendiente D (`plan-prioridad-1.md`, decisión 12) | Abierto | Cola y órdenes pasan al módulo de Ventas. |

---

## 3. Diseño

### 3.1 Módulo de Ventas propio

**Ítem de menú "Ventas"**, visible para quien tenga `ventas: ver` (rol o vista activa). Se agrega a `OPCIONES` (ícono `ShoppingBag`, ya usado en Inicio), a `NOMBRES_MENU` y a `menuDePermisos`. Va después de Pacientes y antes de Inventario. Regla única de permisos: lo que no está concedido, no se tiene; la base sigue siendo la autoridad.

**Pestañas de la página** (una sola página, `src/paginas/Ventas.jsx`):

| Pestaña | Contenido | Viene de |
|---|---|---|
| Por vender | Cola "Listos para venta" y "No compraron", con "Tomar datos del diagnóstico", proforma, "No compró", "Volver a la lista de espera" | `ColaVentas` (hoy `Pacientes.jsx:1281`) |
| Ventas | Lista de comprobantes (número, paciente, fecha, total, saldo, estado, factura electrónica) con Abonar, Crear orden, Anular, y el botón principal "Nueva venta" | Hoy repartido entre el perfil del paciente (`Pacientes.jsx:2331-2460`) y Inventario ("vendiendo") |
| Órdenes de laboratorio | Tablero por estado (enviada, lista, entregada, cancelada) con atrasadas y "Lentes listos sin avisar" | `OrdenesLaboratorio` (hoy `Pacientes.jsx:1267`) |
| Saldos | Pacientes con saldo pendiente, ordenados por monto o antigüedad, con "Abonar" directo | Hoy filtro "Pagos pendientes" de la lista de pacientes (`Pacientes.jsx:902-910`) |

Arriba, una fila de indicadores que también son filtros (mismo patrón de Citas): Por vender, Órdenes atrasadas, Lentes listos sin avisar, Saldo por cobrar. Son los mismos números del Inicio de ventas.

**Qué se mueve y qué se queda en Pacientes**

- Se mueven: la cola, las órdenes globales, los saldos globales, los modales de abono/anulación/"no compró" montados a nivel de página, los manejadores `alVender`, `alAbonar`, `alAnular` (`Pacientes.jsx:308-370`) y los badges "Listos para venta", "Órdenes de laboratorio" y "Pagos pendientes" de la lista de pacientes (`Pacientes.jsx:1054-1064`).
- Se quedan: las pestañas **Productos y servicios** y **Órdenes** del perfil de un paciente (datos de ese paciente, con sus acciones), porque responden "¿qué le vendimos a esta persona?". Son vistas del mismo dato; las acciones llaman a los mismos componentes.
- Los accesos de otras pantallas ("Nueva venta" en la fila del paciente y en su perfil, "Cobrar" de la ficha clínica y de Citas) siguen abriendo el modal de venta con el paciente cargado. No se pasan por la página de Ventas, para no agregar clics.

**Navegación y avisos**

- `Inicio.jsx` (`onVerCola`, `onVerOrdenes`, `Dashboard.jsx:669-671`) navega a `ventas` con la pestaña y el filtro, en lugar de `pacientes`. Se reutiliza `accionPacienteInicio` como `accionVentasInicio`, mismo mecanismo.
- El contador del menú (`avisosPacientes`) se pinta sobre "Ventas". Pacientes deja de mostrarlo.
- Ctrl+K y el buscador global: se agrega "Ventas" como destino y los comprobantes por número.

**Estructura de código (sin abstracciones nuevas)**

- `Ventas.jsx` recibe las mismas props que hoy recibe Pacientes para ventas (`pases`, `ordenesLab`, `abonos`, `facturasVenta`, `pacientes`, `inventario`, `equipo`). No se crea estado global nuevo; el estado compartido sigue en `Dashboard`/`App`.
- Los manejadores de venta que hoy están en `Pacientes.jsx` se extraen a `src/utilidades/useVentas.js` (un hook) para que Pacientes y Ventas los compartan sin duplicar.
- `FacturaVentaModal.jsx` se renombra a `ComprobanteVentaModal.jsx` (`git mv`, en un commit propio), con sus 4 importadores (Citas, Inventario, Pacientes, ConsultaMedica).
- Esqueleto de carga (`TablaSkeleton`) mientras `cargaInicial` sea verdadera, como el resto.

### 3.2 Inventario simplificado y lunas como texto

**Principio:** el inventario controla lo que se cuenta (monturas y accesorios). Las lunas se hacen por pedido: son un texto con precio, en la venta y en la orden.

**Inventario**
- La pantalla se titula "Monturas y accesorios". En el alta y en el alta rápida de la venta, una línea de ayuda: "Las lunas no se registran aquí: se escriben en la venta."
- Sin cambios de esquema. Las categorías siguen siendo configurables.
- La sugerencia de nombre es genérica ("Montura 1, marco negro, modelo tal"): el placeholder del campo Nombre pasa a ese ejemplo (R58).

**Venta (R59)**, en el modal de comprobante, en este orden:
1. Paciente (precargado si viene de la cola o del perfil).
2. **Montura** y **accesorios**: el buscador de inventario actual (con stock y foto). Es el único que descuenta stock.
3. **Luna** (línea nueva de tipo `luna`): tipo (monofocal, bifocal, progresivo), material, tratamientos (antirreflejo, filtro azul, fotocromático, otros) y **precio**. Los mismos catálogos que ya usa la orden. Con eso se arma una descripción legible ("Monofocal CR-39 · antirreflejo, filtro azul") y se guarda también como `detalle` estructurado en la línea.
4. **Servicios** (consulta, ajuste, limpieza), como hoy.
5. **Total**: la suma. La vendedora fija el "precio final" escribiendo el precio de la luna. Un campo de descuento se deja fuera por ahora (decisión 6.8).

**Precarga de la orden de laboratorio.** Al crear la orden desde un comprobante con línea `luna`, el tipo, material y tratamientos salen del `detalle` y la montura sale de la línea de producto. La vendedora escribe la luna una sola vez. Hoy `OrdenLaboratorioModal.jsx:55-60` adivina la montura buscando "armaz|montura|marco" en la categoría o tomando la primera línea; con las lunas fuera del inventario eso se simplifica a la primera línea de producto.

**Ficha clínica.** "Lente a recomendar" queda como texto (R57): se quita el buscador "Vincular a un producto de inventario" (`ConsultaMedica.jsx:2064-2100`) y los estados `lenteRecomendadoProductoId`, `lenteBusquedaProducto`, `lenteProductosFiltrados`. `lineasCobroConsulta` y `proforma.js:16` generan una línea `luna` con el texto recomendado y precio 0, en lugar de una línea de producto. `datos_clinicos.lente_producto_id` se deja de escribir; las fichas antiguas que lo tengan se leen sin error y se ignora el valor.

**Qué hacer con los productos de tipo luna que existen hoy**

| Producto | Óptica | Historial | Propuesta |
|---|---|---|---|
| "Lente Monofocal Antirreflejo QA" ($45, stock 10) | Óptica Solna Vision | 0 líneas, 0 ventas viejas, 0 consultas | Descontinuar (`activo = false`, ya existe desde 0081). Es un dato de prueba. |
| "Lentes" ($20, stock 10) | Optica Karla V | 0 líneas, 0 ventas viejas, 0 consultas | No tocar desde aquí: es de otra óptica. Su administrador lo descontinúa desde Inventario. |

Cómo no se pierde historial: nadie tiene ventas de estos productos, y aunque las tuvieran, cada línea de venta guarda su propia `descripcion`, cantidad y precio (columnas de `facturas_venta_lineas`) y la clave al producto es `on delete set null`. Se **descontinúa, no se borra**: la fila se conserva y deja de aparecer en listas y buscadores. Para el futuro, ninguna venta nueva puede apuntar a una luna del inventario, porque la luna deja de ser un producto. La descontinuación del producto de QA va comentada en la sección 7 de la migración, para que la apruebes por separado.

### 3.3 "Factura" pasa a "comprobante de venta interno"

**Regla de redacción** (ajuste 6.2):
- Primera mención en cada pantalla, modal o impresión: "Comprobante de venta interno".
- Menciones siguientes y botones: "Comprobante" o "Venta".
- Toda impresión de un comprobante lleva una leyenda fija: "Documento interno. No es una factura electrónica autorizada por el SRI."
- La palabra "factura" queda solo en "Factura electrónica (SRI)" para el número externo.

**Textos visibles que hay que cambiar** (lista a verificar con `grep` al implementar; se excluyen `Mensajes.jsx` y `SuperadminPanel.jsx`, ver 6.9):

| Archivo | Texto actual |
|---|---|
| `FacturaVentaModal.jsx:310` | "No se pudo generar la factura…" |
| `FacturaVentaModal.jsx:323` | Registro de actividad "Generó una factura" |
| `FacturaVentaModal.jsx:566` | "Guardar y usar en esta factura" |
| `Pacientes.jsx:337`, `2034` | Título "Nueva factura" |
| `Pacientes.jsx:827-828` | "Factura precargada con…", "Abriendo factura para…" |
| `Pacientes.jsx:2009` | Botón "Facturar receta" |
| `proforma.js:69` | "No es una factura ni un comprobante de venta…" (pasa a: "Esto es un presupuesto. No es un comprobante de venta ni una factura electrónica.") |
| Mensajes de la base | `crear_factura_venta` ("Una factura necesita al menos una línea") y `anular_factura_venta` ("La factura no existe…"): ya reescritos en la migración 0094 |
| Pruebas | `FacturaVentaModal.test.jsx`, `proforma.test.js`, `cobrosPendientes.test.js` (descripciones) |

**Qué no se renombra:** tablas, columnas, funciones y variables (`facturas_venta`, `crear_factura_venta`, `facturaId`…). Renombrarlos obligaría a recrear políticas, triggers y RPC sin que el usuario vea nada. Un comentario en `ComprobanteVentaModal.jsx` y en `App.jsx` (`mapFacturaVenta`) explica la diferencia entre el nombre técnico y el nombre en pantalla.

**Número del comprobante (nuevo).** Cada comprobante recibe un correlativo por óptica, con formato `CV-0001`, visible en la lista de Ventas, el perfil del paciente y las dos copias de la orden de laboratorio (R36). Se corrige así que `facturaNumero` nunca se llene.

**Campo opcional "Factura electrónica (SRI)".**
- En el modal de venta, un campo opcional al final ("Número de la factura electrónica, si ya la emitiste").
- En la lista de Ventas y en el detalle, una celda editable: se puede cargar o corregir después con un botón "Registrar número" (la factura electrónica suele emitirse más tarde). Exige nivel `editar` de Ventas.
- Validación en pantalla: acepta el formato SRI `001-001-000000123` (15 dígitos, con o sin guiones, que se normaliza); si no coincide, avisa sin bloquear, porque el proveedor de facturación puede usar otro formato. La base solo exige texto de 1 a 60 caracteres y que no se repita en otra venta vigente de la misma óptica.
- Una venta anulada libera su número.

### 3.4 Archivos que se tocan (estimación)

`Dashboard.jsx` (menú, navegación, contador), `roles.js` (menú), `Ventas.jsx` (nuevo), `useVentas.js` (nuevo), `Pacientes.jsx` (se retira lo que se mueve), `ComprobanteVentaModal.jsx` (renombrado, bloque de luna, factura electrónica), `ConsultaMedica.jsx` y `costosConsulta.js` (luna como texto), `proforma.js`, `Inventario.jsx` (copy), `Inicio.jsx` (destinos), `App.jsx` (`mapFacturaVenta` agrega `numero`, `facturaElectronica`, y `detalle` en las líneas), `ordenesLaboratorio.js` (usa `numero`), `OrdenLaboratorioModal.jsx` (precarga desde `detalle`).

---

## 4. Qué requiere base de datos

Una migración, `0094_comprobantes_venta_internos.sql`, sin aplicar. Todo lo demás (módulo de Ventas, rename de textos, inventario, ficha clínica) es solo código.

| Cambio | Para qué |
|---|---|
| Tabla `contador_comprobantes_venta` y columna `facturas_venta.numero` (única por óptica, con relleno de las 2 ventas existentes) | Correlativo `CV-0001` y número en la orden (R36) |
| Columna `facturas_venta.factura_electronica` (opcional, índice único parcial entre ventas no anuladas) | Registrar la factura electrónica externa |
| `facturas_venta_lineas.tipo` admite `'luna'` y nueva columna `detalle jsonb` | Luna como texto con datos para la orden y reportes |
| `crear_factura_venta`: firma nueva, asigna número, recibe la factura electrónica, valida el tipo de línea, solo descuenta stock en líneas `producto`, no guarda `producto_id` en lunas ni servicios | R57-R59 |
| Nueva `registrar_factura_electronica(p_factura_id, p_numero)` | Cargar o corregir el número después, con nivel `editar` |
| `anular_factura_venta`: igual, con mensaje "comprobante" | Vocabulario |

**Riesgos y cómo se cubren**
- **Sobrecarga silenciosa de `crear_factura_venta`:** se hace `drop function` de la firma anterior antes de crear la nueva. Verificado: queda una sola versión.
- **Un solo llamador:** `FacturaVentaModal.jsx:292` es el único que llama a `crear_factura_venta` (revisado con `grep` en `src`). Se actualiza en el mismo bloque. Debe ir en el mismo despliegue que la migración, porque el resultado ahora incluye `numero` y el cliente viejo seguiría funcionando pero sin leerlo.
- **Mapeadores:** `mapFacturaVenta` (`App.jsx:234`) es una lista blanca: la columna nueva es invisible hasta que se agrega allí.
- **Triggers:** el relleno de `numero` no dispara los de `facturas_venta`, que se activan con `UPDATE OF estado`.
- **Sin pérdida de datos:** no se borra ni se cambia ninguna fila existente, salvo darles número a 2 ventas.

**Prueba en seco, ya hecha.** Se ejecutó el SQL completo dentro de una transacción que se revirtió (`ROLLBACK` confirmado: la columna `numero` no existe después). Resultados:
- Relleno: las 2 ventas existentes de Óptica Solna Vision quedaron con los números 1 y 2; el contador quedó en 2.
- Quedó una sola versión de cada función (sin sobrecargas).
- Una venta con montura, luna y servicio recibió el número 3, el stock bajó 1 (solo por la montura), la luna y el servicio quedaron sin producto y la luna conservó su `detalle`.
- La siguiente venta recibió el 4.
- Rechazos con su mensaje: factura electrónica repetida, tipo de línea inválido, `detalle` que no es objeto, número ya usado al registrar, y un usuario sin permiso de ventas (probado quitándole en la transacción sus roles y permisos).
- `registrar_factura_electronica` recorta espacios y limpia el número con texto vacío.
- Anular una venta devuelve el stock y libera su número de factura electrónica, que se pudo reutilizar.

Esa transacción usó datos reales de Óptica Solna Vision solo en lectura y revirtió todo lo demás. Nada quedó guardado.

---

## 5. Orden de implementación (después de aprobar el SQL)

Cada paso es un commit con archivos concretos, con tests y revisión en el navegador. Ningún paso se publica ni se empuja.

| # | Paso | Notas |
|---|---|---|
| 0 | Aplicar la migración 0094 | Solo tras tu aprobación, con `scripts/_run-migration.mjs` |
| 1 | Mapeadores y utilidades: `numero`, `facturaElectronica`, `detalle`; formato `CV-0001` | Con tests |
| 2 | Renombrar `FacturaVentaModal` a `ComprobanteVentaModal` | Commit propio, solo `git mv` e imports |
| 3 | Modal de comprobante: bloque Luna, factura electrónica, leyenda | Actualiza la llamada a `crear_factura_venta` |
| 4 | Textos "factura" a "comprobante", impresiones y tests | Con la lista de la sección 3.3 |
| 5 | Ficha clínica y proforma: luna como texto | Quita el vínculo con inventario |
| 6 | Inventario: copy y ejemplo genérico | Solo textos |
| 7 | Módulo de Ventas: menú, página, pestañas, mover manejadores | El paso grande; puede dividirse en 2 o 3 commits |
| 8 | Inicio, buscador global y contador del menú apuntan a Ventas | |
| 9 | Orden de laboratorio: número de comprobante y precarga desde `detalle` | |
| 10 | Documentar cierre del bloque en `estado.md` | |

**Verificación.** `npm test` (mínimo 78) y el build, en cada paso. Los datos de prueba se crean solo dentro de transacciones que se revierten (patrón de `scripts/test-rls.mjs`): las pruebas de las funciones de la base se repiten ahí con cada cambio. La revisión en el navegador se limita a flujos que no guardan datos (abrir el modal, armar la venta, ver la lista); un flujo de punta a punta que guarde una venta real, para probar el modal completo, necesita tu autorización porque el navegador no puede revertir una transacción.

---

## 6. Decisiones para ti

| # | Decisión | Recomendación |
|---|---|---|
| 6.1 | Aprobar el SQL de `0094` tal como está | Sí. Puedo aplicarlo cuando lo apruebes. |
| 6.2 | La luna como línea de tipo `luna` con `detalle`, o reutilizar `servicio` con solo texto | `luna` con `detalle`: permite precargar la orden y contar lunas por tipo en Reportes. Costo: un tipo más en la restricción. |
| 6.3 | Correlativo interno `CV-0001` por óptica | Sí; sin él, el número del comprobante en la orden (R36) no existe. |
| 6.4 | Número de factura electrónica: formato libre con aviso (recomendado) o validación estricta del SRI | Con aviso, porque los proveedores de facturación pueden formatearlo distinto. |
| 6.5 | Descontinuar el producto de QA de Óptica Solna Vision (línea comentada en la sección 7 de la migración) | Sí. |
| 6.6 | "Lentes" de Optica Karla V: ¿es de un cliente real? | No tocarlo desde aquí; que su administrador lo descontinúe. |
| 6.7 | Nombre del ítem de menú | "Ventas", con el contador de pendientes. |
| 6.8 | "Precio final total" libre (con descuento implícito) o suma de líneas | Suma de líneas por ahora: la vendedora ajusta el precio de la luna. Si el ingeniero quiere un campo de descuento explícito, es una columna más y se agrega después. |
| 6.9 | Las facturas de suscripción SaaS (`Mensajes.jsx`, `SuperadminPanel.jsx`) | Fuera de este bloque. Si quieres renombrarlas también ("cobro de suscripción"), es solo texto. |
| 6.10 | La estrategia de pruebas con el navegador (sin guardar datos reales) | Aceptarla, o autorizar una venta real de prueba que luego borres tú. |

---

## 7. Fuera de este bloque

- Limpieza del camino legado `ventas` / `registrar_venta_producto` / `consultas.producto_id` (0 filas hoy).
- Integración con el SRI (trabajo futuro declarado en la tesis).
- Aviso al paciente por WhatsApp de "tus lentes están listos" y su estado en el portal (3.4, "más allá"): se evalúa al cerrar el módulo, porque depende de que las órdenes ya estén en su sitio.

---

## 8. Cierre del bloque (7 oct.)

### Decisiones de Diego
Línea de tipo `luna` con `detalle` (sí). Total como suma de líneas, sin campo de descuento por ahora (sí). Descontinuar el producto de luna de prueba de Óptica Solna Vision (sí, ejecutado en la 0094; fue `activo = false`, la fila se conserva). Las demás (6.1 a 6.10), según las recomendaciones: el "Lentes" de Optica Karla V no se tocó.

### Compatibilidad con el sitio publicado (main)
El sitio de Vercel llama a `crear_factura_venta` con 8 parámetros con nombre. La nueva versión conserva esos 8 con el mismo nombre y orden; el parámetro nuevo (`p_factura_electronica`) va al final con valor por defecto, y la columna nueva del resultado (`numero`) va al final. Verificado dentro de una transacción revertida, antes y después de aplicar la 0094, llamando con los nombres exactos de main: la venta se crea, recibe su número y descuenta el stock; además `registrar_abono`, `crear_orden_laboratorio`, `anular_factura_venta` (el trigger cancela la orden abierta y la anulación repone el stock) y la lectura `select *` con líneas, todo con los nombres de main. Las tablas ganaron columnas y un tipo de línea, sin quitar nada.

### Hecho
- **Base:** 0094 aplicada. Las 2 ventas existentes quedaron numeradas CV-0001 y CV-0002.
- **Comprobante:** número `CV-0001` visible en Ventas, el perfil del paciente y las dos copias de la orden de laboratorio; campo opcional de factura electrónica (en la venta y después, con "Registrar factura electrónica" / "Corregir"), con aviso sin bloqueo si no tiene el formato del SRI; leyenda "Documento interno. No es una factura electrónica autorizada por el SRI."
- **Luna:** bloque de luna en el modal de venta (tipo, material, tratamientos, precio) que precarga la orden de laboratorio, también cuando la orden se crea después desde la lista. La ficha clínica ya no vincula el lente a un producto; la venta y la proforma arrancan con la luna como línea de texto.
- **Inventario:** "Monturas y accesorios", con ejemplo genérico y el aviso de que las lunas se escriben en la venta. Los productos descontinuados ya no aparecen en el buscador de la venta.
- **Módulo de Ventas:** ítem de menú con su contador, pestañas Por vender, Ventas, Órdenes de laboratorio y Saldos por cobrar; búsqueda por paciente, cédula, CV o factura electrónica; "Nueva venta" sugiere vincular la venta al pase abierto del paciente. El Inicio y el buscador global (Ctrl+K) llevan al módulo. Los manejadores salieron de Pacientes a `useVentas.js`, `ModalesVentas.jsx` y `FilaComprobante.jsx`.
- **Textos:** "factura" pasa a "comprobante de venta" en lo visible (la lista de la sección 3.3), sin renombrar tablas ni funciones. `FacturaVentaModal` ahora es `ComprobanteVentaModal`.

### Apartes del diseño
- **"Pagos pendientes" se queda en la lista de Pacientes** como filtro de pacientes (además del nuevo Saldos en Ventas). Solo se movieron "Listos para venta", "Órdenes de laboratorio" y "No compraron".
- Los pacientes con rol sin permiso `ventas` ya no ven el contador en Pacientes ni la cola allí; el contador está en Ventas.
- Las facturas de suscripción SaaS (`Mensajes.jsx`, `SuperadminPanel.jsx`) no se tocaron (6.9).
- El texto "Descontinuar un producto" de la sección 7 de la migración se ejecutó solo para el de QA.

### Venta de prueba autorizada
Se registró CV-0003 (luna progresiva, $60, factura electrónica 001-001-000000555, luego corregida a ...556) para Walkin Prueba QA, y se anuló al terminar con el motivo "Venta de prueba del Bloque E". Queda en el historial como anulada, con su número consumido. No se creó ninguna orden de laboratorio. El resto de las pruebas se hicieron en transacciones revertidas.

### Pendiente fuera del bloque
Limpieza del camino legado `ventas` / `registrar_venta_producto` / `consultas.producto_id` (0 filas); aviso de "lentes listos" por WhatsApp y su estado en el portal; reportes que cuenten lunas por tipo a partir de `detalle`.
