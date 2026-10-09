# Revisión del módulo de Ventas (9 oct 2026)

Revisión hecha **leyendo el código** (`Ventas.jsx`, `ColaVentas`, `FilaComprobante`, `OrdenesLaboratorio`, `AbonoModal`, `useVentas`, y las partes de `Inicio.jsx` y `Dashboard.jsx` que tocan Ventas) contra las 28 reglas de `docs/principios-diseno.md`, con Citas como ejemplo de cómo debe quedar. Preparada para la reunión con el ingeniero.

**Estado: pendiente de implementar. Nada se ha corregido.**
**No verificado en pantalla:** falta verlo con cada rol (administrador, Ventas, Recepción), en la óptica vacía (`3pldf1`), con muchos datos y en otra zona horaria (regla 19).

## Cómo ven el módulo los roles

Con los permisos predefinidos (`0090_roles_y_permisos.sql`), Recepción y Ventas ven lo mismo en este módulo (ver, crear y editar). Solo el administrador anula ventas ("eliminar"). El optómetra tiene solo "ver".

## Decisiones que se piden a Diego

1. **Proformas (punto 2).** ¿Llevan su propia sección en Ventas, o se quedan como etiqueta en la cola y se elimina la tarjeta "Proformas en seguimiento" del Inicio?
2. **Puntos 3 y 4 tocan el Inicio**, que es un módulo cerrado (regla 27). Corregirlos cambia la tarjeta de saldos y el contador del menú; hay que avisar y esperar aprobación antes de dejarlos.
3. **Punto 17:** confirmar si el optómetra debe ver montos y saldos de todas las ventas (hoy es lo que dice su plantilla de rol).
4. **Orden propuesto:** empezar por los puntos 1 a 4 (los que el ingeniero comprueba contando números). Diego puede descartar o reordenar cualquiera.

---

## Alta: números que no cuadran o recorridos que se cortan

### 1. La tarjeta "Ventas" no coincide con su lista
- **Regla:** 5 (los números coinciden con lo que se ve), 23 (conteo y lista con el mismo criterio).
- **Qué pasa:** la tarjeta cuenta los comprobantes sin las anuladas (`Ventas.jsx:77`). La lista abre en "Todos los estados" e incluye las anuladas (`saldosVentas.js`, `filtrarComprobantes`). Con una venta anulada la tarjeta dice 5 y la lista muestra 6.
- **Propuesta:** que "Todos los estados" no incluya las anuladas (como "Todas" en Citas no incluye canceladas); las anuladas se ven solo con el filtro "Anuladas". Misma función para la tarjeta y para la lista.

### 2. Las proformas no existen como tal en Ventas
- **Reglas:** 2, 5, 10, 13.
- **Qué pasa:**
  - El Inicio tiene la tarjeta "Proformas en seguimiento" y "Ver la cola" lleva a la cola completa. En Ventas la proforma es solo una etiqueta dentro de la cola.
  - Las proformas son un subconjunto de "Listos para venta" (`proformasEnSeguimiento` filtra los mismos pases): cada paciente con proforma se cuenta en las dos tarjetas.
  - Tras imprimir la proforma el paciente queda "listo" para siempre: no hay seguimiento (llamar o avisar) ni alerta cuando pasan los días.
- **Propuesta (depende de la decisión 1):**
  - *Opción A:* sección propia "Proformas" en Ventas, con filtro de la cola, días desde la entrega y acción de seguimiento (WhatsApp); la tarjeta del Inicio lleva a esa lista con el mismo conteo.
  - *Opción B:* la proforma queda como etiqueta en la cola, se elimina la tarjeta del Inicio y "Listos para venta" muestra "N · con proforma".
  - En ambas: un aviso cuando una proforma lleva varios días sin respuesta.

### 3. El contador del menú suma dos cosas distintas
- **Reglas:** 2, 5. **Toca el Inicio/menú: requiere aprobación (27).**
- **Qué pasa:** `Dashboard.jsx:129` suma pacientes listos para venta más órdenes que piden acción. Ese número no coincide con ninguna lista ni tarjeta.
- **Propuesta:** que el contador cuente una sola cosa con una lista que lo respalde (por ejemplo, "lo que requiere atención en Ventas" con el mismo criterio que el bloque de Ventas en "Requiere tu atención"), o quitarlo.

### 4. "Saldos por cobrar" cuenta en unidades distintas
- **Reglas:** 2, 5, 8. **Toca el Inicio: requiere aprobación (27).**
- **Qué pasa:**
  - El Inicio dice "$X en N ventas" y lista por venta; Ventas dice "N pacientes" y lista por paciente.
  - El Inicio no suma las ventas viejas de la tabla `ventas` y Ventas sí. Hoy esa tabla no tiene filas, pero el día que las tenga los totales se separan.
  - Los saldos se alcanzan por dos caminos: la pestaña Saldos y el filtro "Con saldo" de la pestaña Ventas.
- **Propuesta:** una sola función para el total y para la unidad (se propone por paciente, que es lo que se cobra); el Inicio usa la misma; se deja un solo camino (la pestaña Saldos) y se quita el filtro "Con saldo" o se enlaza a ella.

### 5. Un abono mal puesto no se puede deshacer
- **Regla:** 15 (se puede deshacer lo que se hace).
- **Qué pasa:** no hay función para anular o corregir un abono; solo "Anular" de toda la venta.
- **Propuesta:** anular un abono con motivo (solo con permiso "eliminar"), que quede en la actividad y recalcule el saldo. Requiere una función nueva en la base (migración con el protocolo de siempre).

### 6. No hay forma de ver o imprimir un comprobante ya guardado
- **Regla:** 10 (flujo de quien lo usa).
- **Qué pasa:** no se encontró ninguna acción para ver o imprimir un comprobante guardado. Solo se imprime la proforma. La fila es todo lo que hay del comprobante.
- **Propuesta:** un detalle del comprobante (líneas, abonos, órdenes, factura electrónica) con "Imprimir"; sería también el lugar donde van las acciones que hoy saturan la fila (punto 8).

### 7. El paciente que espera en la cola no genera ningún aviso
- **Reglas:** 21, 22.
- **Qué pasa:** el administrador y Recepción no tienen esa alerta en "Requiere tu atención". Solo aparece en el contador del menú de quien puede vender.
- **Propuesta:** un aviso en el bloque Ventas de "Requiere tu atención" ("N pacientes esperan hace más de X días") con la acción "Ver la cola", según el permiso. Toca el Inicio: requiere aprobación (27).

---

## Media: estructura y consistencia

### 8. Las filas hacen demasiado
- **Reglas:** 9, 4.
- **Qué pasa:** un comprobante trae hasta 5 acciones (Abonar, Crear u Otra orden, Anular, Registrar o Corregir factura electrónica); una orden, hasta 7 (Avisar, Marcar, Imprimir, Editar, Otra orden, Volver, Historial). Citas deja un solo botón de contexto y el resto en el detalle.
- **Propuesta:** en la fila, un solo botón de contexto (Abonar si hay saldo; Marcar o Avisar en las órdenes) y el estado; el resto en el detalle (punto 6).

### 9. Varios caminos para la misma acción
- **Reglas:** 8, 3.
- **Qué pasa:** Abonar se hace desde la fila del comprobante, desde Saldos (un botón por venta) y desde "Entrega con saldo". Crear orden está en la fila del comprobante y como "Otra orden" en Órdenes. "Nueva venta" está en la cabecera y como enlace en la lista vacía. En Saldos los números CV-… salen en el texto y otra vez en los botones.
- **Propuesta:** borrar los repetidos, no cambiarles el texto: un camino para abonar (el detalle del comprobante, al que Saldos lleva), un camino para crear orden, y "Nueva venta" solo en la cabecera.

### 10. Nombres que no coinciden con lo que hay detrás
- **Regla:** 2.
- **Qué pasa:** "Por vender" (pestaña), "Listos para venta" (chip e Inicio) y "Para vender" (Inicio) son lo mismo. La pestaña "Ventas" lista comprobantes, y se mezclan "venta", "comprobante", "factura" y "CV". El botón "Tomar datos del diagnóstico" abre un modal titulado "Venta de X". "Lo pensará" es el motivo de "No compró" y también el texto de la tarjeta de proformas.
- **Propuesta:** un vocabulario único (se propone "Por vender", "Comprobantes", "Órdenes de laboratorio", "Saldos") usado en pestañas, Inicio, menú y botones; el botón de la cola se llama como lo que abre ("Vender" / "Armar venta").

### 11. Los controles cambian de lugar entre pestañas
- **Reglas:** 1, 11.
- **Qué pasa:** Cola: chips y luego el buscador. Ventas: buscador, estado y casilla en una fila. Órdenes: chips con el laboratorio a la derecha y el buscador debajo. El banner "Atrasos por laboratorio" aparece y desaparece y empuja la lista; el banner de error empuja toda la página.
- **Propuesta:** una barra con la misma estructura en las tres pestañas (buscador y "Filtrar" arriba, conteo a la izquierda); los banners en un espacio reservado o como aviso flotante.

### 12. Lo seleccionado no usa un solo color
- **Regla:** 14.
- **Qué pasa:** las tarjetas y chips de la cola van en verde, los filtros de Órdenes en negro (`INK`) y la barra de Citas en azul. Hay dos botones principales de colores distintos: verde ("Nueva venta", "Abonar") y degradado azul ("Tomar datos", "Marcar lista").
- **Propuesta:** seleccionado en el azul de la marca (como Citas) y un único color para el botón principal.

### 13. Filtros pegados y listas vacías sin salida
- **Reglas:** 6, 17, 26.
- **Qué pasa:** estado, casilla y texto de Ventas no tienen etiqueta con "x" ni "Limpiar". Las listas vacías por filtro (Ventas, Órdenes, búsqueda en la cola) no ofrecen "Quitar filtros". La lista vacía de Órdenes repite el mismo hecho en dos textos.
- **Propuesta:** etiquetas con "x" y "Limpiar" como en Citas; un mensaje por lista vacía con su acción.

### 14. Recepción y los permisos no cuadran
- **Reglas:** 21, 22.
- **Qué pasa:** Recepción puede vender y marcar órdenes, y el menú le cuenta las órdenes por atender, pero su Inicio no las muestra. La ayuda de permisos dice "Editar = abonos y órdenes", pero crear una orden desde un comprobante pide "crear" y cambiar su estado pide "editar".
- **Propuesta:** decidir un mapa claro (qué nivel para cada acción), corregir la ayuda o los botones, y que el Inicio de Recepción muestre lo mismo que el menú le cuenta.

---

## Baja

### 15. Información repetida
- **Regla:** 3. El subtítulo de la página repite las cuatro tarjetas; el chip "Listos para venta (N)" repite el número de la tarjeta "Por vender".
- **Propuesta:** quitar el subtítulo y el chip repetido.

### 16. Buscadores siempre visibles
- **Regla:** 25. La cola y los comprobantes muestran buscador aunque haya 2 filas; Órdenes lo muestra desde la primera orden.
- **Propuesta:** mostrarlo con más de 5 filas, como en el historial de citas del perfil.

### 17. El optómetra ve montos y saldos de todas las ventas
- **Regla:** 7. Es lo que dice su plantilla de rol, pero conviene confirmarlo (decisión 3).

### 18. Detalles técnicos
- **Reglas:** 12, 18, 16.
  - `dinero` está definido por separado en 6 archivos y hay `$${x.toFixed(2)}` suelto en otros: una sola función.
  - `AbonoModal` y `diasEnEspera` convierten fechas con la zona del equipo y no con `ahoraEcuador()`.
  - Las acciones de Ventas se registran en la actividad bajo el módulo "pacientes".
  - El skeleton desaparece apenas una de las listas tiene datos.

---

## Antes de dar el módulo por terminado

Repasar la lista de revisión de `docs/principios-diseno.md`, verificar con los tres roles, en `3pldf1` (estados vacíos), con muchos datos y en cuatro zonas horarias, y agregar pruebas para los conteos (punto 1, 3 y 4) y para el flujo cola → venta → abono → orden (regla 28: las pruebas crean sus datos en la óptica de pruebas).
