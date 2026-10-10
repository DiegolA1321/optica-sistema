# Revisión de los demás módulos (10 oct 2026)

Módulos revisados: Inventario, CRM y fidelización, Mi horario, Reportes, Mensajes, Usuarios y permisos y Configuración. **Ventas** tiene su propio documento, `docs/revision-ventas.md`, actualizado el mismo día.

**Estado (actualizado el 10 oct. por la tarde): lo de esta revisión se implementó según las decisiones de Diego; ver "Revisión de los demás módulos: implementada" en `docs/estado-actual.md`. Queda de T1 el resto de las ventanas propias. Lo que sigue aquí es la revisión original: solo revisión, no se corrigió nada de lo que está aquí** (lo que se corrigió el 10 oct en Citas, el Inicio, Pacientes, Inventario y Usuarios está en `docs/estado-actual.md`). Cada hallazgo cita la regla de `docs/principios-diseno.md` que rompe.

## Cómo se hizo

- **En pantalla, a 1366×768, con la Óptica Demo y cuatro roles:** administrador, optómetra (Paula), Recepción (Rosa) y Ventas (Vera). Cada módulo que el rol ve se abrió y se leyó; además, como administrador, se abrieron sin guardar nada las ventanas de cada módulo (agregar producto, crear usuario, nuevo rol, actividad, nueva venta, ver detalles de CRM) y las pestañas de Configuración, Mi horario y Reportes.
- **En la óptica vacía (`3pldf1`)**, como administrador, para ver los estados sin datos.
- **Leyendo el código** donde la pantalla no alcanzaba para saber el porqué de un número o un permiso.
- **No se verificó:** otras zonas horarias (regla 19), una óptica con muchísimos datos, los flujos que escriben datos (se hicieron en la Demo solo lecturas), el teléfono (anchos menores a 1366 px) ni el modo impresión.
- **Qué ve cada rol:** el administrador ve los ocho módulos; el optómetra, Ventas, Inventario, CRM, Mi horario y Reportes; Recepción y Ventas, Ventas, Inventario, CRM y Mi horario. Mensajes, Usuarios y permisos y Configuración son solo del administrador.

## Lo más importante (en este orden)

1. **Mi horario:** quien tiene "Mi horario: editar" (el optómetra, por su rol predefinido) puede cambiar el horario general de la óptica y sus días cerrados, y la pantalla le dice lo contrario.
2. **Reportes:** el mismo dato sale con dos números ("Ingresos" $94.50 contra "Vendidas este mes" $223.00 del Inicio, para las mismas 2 ventas) y el optómetra ve cifras de "lo suyo" sin que la pantalla lo diga.
3. **CRM:** cada número aparece dos veces en la misma pantalla y el mismo hecho (los 4 pacientes con el control vencido) se llama de tres maneras.
4. **Inventario:** un mismo módulo se llama de seis formas.
5. **Configuración:** dos formas de guardar en la misma pantalla y una nota de versión que no debería estar ahí.
6. **Usuarios y permisos:** casi al nivel; quedan detalles de textos y de lo que cuenta cada tarjeta de usuario.
7. **Mensajes:** no se entiende a quién se le escribe.

---

## Transversal (afecta a varios módulos)

### T1. Las ventanas propias son la mayoría: 34 archivos las arman a mano y solo 4 usan la ventana estándar (`Cascaron`)
- **Regla:** 43, 18.
- **Qué se ve:** todas desvanecen el fondo (hay una prueba que lo vigila), pero cada una pone distinto la cabecera (ícono con degradado o ícono plano), el título, el cierre y el pie. Ejemplos: el detalle de CRM cierra con un botón "Cerrar" de todo el ancho; "Agregar producto" lleva "Cancelar" y "Guardar en bodega" lado a lado; "Nueva venta" es verde; "Crear usuario" y "Nuevo rol" son azules con otro ancho.
- **Propuesta:** darle a `Cascaron` las dos variantes que faltan (lista de solo lectura con "Cerrar"; formulario con "Cancelar" y acción principal) y pasar las ventanas de estos módulos a ellas, de a una por commit. Es trabajo grande pero mecánico.

### T2. Las fechas se eligen con el calendario nativo del navegador en diez lugares
- **Regla:** 32, 12.
- **Qué se ve:** `type="date"` en Reportes (período personalizado), Abonos, Orden de laboratorio, Ausencias de Horario, Confirmar datos del paciente, Citas (fecha de nacimiento), la ficha clínica y el agendamiento público. Se ve distinto (`dd/mm/yyyy`) que el calendario del sistema que usa Citas.
- **Propuesta:** un selector de fecha único (el de Citas) para todos; empezar por Reportes y Abonos, que son los que más se usan.

### T3. Los nombres de los módulos no coinciden entre el menú, el título y el resto del sistema
- **Regla:** 2.
- **Qué se ve:** "Mi horario" (menú) abre una pantalla titulada "Horario" cuya primera pestaña es el horario general de la óptica y la segunda es "Mi horario". "Inventario" (menú) abre "Monturas y accesorios". En el Inicio la tarjeta se llama "Productos". Ver los puntos de Inventario y Mi horario.
- **Propuesta:** que el título de la pantalla sea el nombre del menú, y cada concepto, un solo nombre.

### T4. Las pantallas vacías no siempre tienen mensaje con acción
- **Regla:** 17, 26.
- **Qué se ve en la óptica vacía:** Inventario sí ("Agregar el primero"); Ventas dice "No hay pacientes esperando para venta" y explica cómo llegan, pero no ofrece "Nueva venta" (que está arriba); CRM muestra cuatro tarjetas en 0 y cuatro listas con mensaje, sin ninguna acción ("Registrar el primer paciente"); Reportes muestra nueve tarjetas en 0 o "—" sin decir que faltan datos ni qué hacer.
- **Propuesta:** un mensaje con su acción por pantalla: CRM y Reportes "Aún no hay pacientes: Registrar el primero" (lleva a Pacientes).

### T5. Los controles que no dicen para qué sirven
- **Regla:** 41 (el texto es legible), 9.
- **Qué se ve:** un ícono suelto junto al buscador de Inventario (vista compacta) sin texto; los íconos de la columna Acciones (lápiz, carrito, gráfica, papelera) solo con título al pasar el cursor.
- **Propuesta:** un texto corto en el ícono de vista compacta; las acciones de la fila ya tienen etiqueta accesible, bastaría que las dos más usadas lleven texto.

---

## 1. Mi horario

**Qué se ve.** El menú dice "Mi horario"; la pantalla se titula "Horario" y abre en la pestaña "Horario general de la óptica" (horario semanal por día, excepciones puntuales en un calendario, duración de cada cita). La segunda pestaña, "Mi horario", es el horario personal y lo ocupado y disponible de todo el equipo.

### 1.1 (Alta) El optómetra puede editar el horario general de la óptica, y la pantalla le dice que no
- **Reglas:** 7, 22, 2.
- **Qué pasa:** el rol predefinido del optómetra trae "Mi horario: ver, editar". `Horario.jsx:78` usa ese permiso para dejar editar el horario general y cerrar o abrir días del calendario de la óptica. Recepción, que tiene "solo ver", ve el mensaje "Solo el administrador puede editar el horario general de la óptica" y la pantalla bloqueada; el optómetra ve los mismos controles que el administrador, sin ningún aviso. El mensaje dice "solo el administrador" aunque el permiso lo da quien tenga "editar".
- **Por qué importa:** cerrar un día en el horario general quita espacios del portal del paciente; una persona que solo quería ajustar su propia agenda puede hacerlo por error.
- **Propuesta:** separar los dos permisos: "Mi horario" (el propio) para quien atiende, y "Horario de la óptica" (el general) solo para el administrador o quien se le delegue. Mientras se decide, que el mensaje diga la verdad ("Puedes editarlo porque tu rol tiene permiso de editar el horario") o que el optómetra no vea los controles del general.
- **Decisión de Diego:** ¿el optómetra debe poder cambiar el horario general? Mi recomendación: no.

### 1.2 (Media) El módulo abre en la pestaña que no es la suya
- **Reglas:** 10, 2.
- **Qué pasa:** quien entra por "Mi horario" cae en el horario general de la óptica. Para el optómetra y para Recepción, su horario es la otra pestaña.
- **Propuesta:** abrir en "Mi horario" para quien no es administrador; el administrador, en el general. El título de la pantalla, "Mi horario"; la pestaña general, "Horario de la óptica".

### 1.3 (Baja) Cuatro nombres para lo mismo
- **Regla:** 2. "Mi horario" (menú y roles), "Horario" (título), "Horario general de la óptica" y "Horario semanal habitual" (dos nombres del mismo bloque). Se resuelve con 1.2.

### 1.4 (Baja) "Libre" con "0 turnos libres"
- **Regla:** 5. En "El equipo hoy", cada persona aparece como "Libre" aunque debajo diga "0 ocupados · 0 turnos libres" (hoy es sábado y ya pasó el horario). La etiqueta contradice el número.
- **Propuesta:** "Sin turnos hoy" cuando no quedan turnos; "Libre" solo si los hay y no está en una cita.

### 1.5 (Baja) Texto largo fijo
- **Regla:** 3, 41. El párrafo "Esto define la regla general: si apagas «Lunes»…" ocupa el alto de una tarjeta en cada visita. **Propuesta:** una línea y el detalle en una ayuda al pasar el cursor.

---

## 2. Reportes

**Qué se ve.** Administrador y optómetra (Reportes no está en Recepción ni en Ventas). Período (este mes, mes pasado, 3 y 6 meses, personalizado), motivo de consulta, nueve tarjetas y varias gráficas. El optómetra ve solo lo suyo (3 consultas contra 7 del administrador).

### 2.1 (Alta) "Ingresos" y las ventas del Inicio dan números distintos para las mismas ventas
- **Reglas:** 2, 5, 24.
- **Qué pasa:** Reportes dice "Ingresos $94.50 · 2 ventas (sin anuladas) · este mes". El Inicio dice "Vendidas este mes $223.00" y su ventana "2 ventas". Son las mismas dos ventas. La diferencia es que Reportes suma lo **cobrado** (abonos, `Reportes.jsx:201`) y el Inicio suma lo **vendido** (monto total). Cada uno es correcto, pero los dos se llaman "ventas" o "ingresos" y nadie lo sabe.
- **Propuesta:** dos nombres y una frase. En Reportes, "Cobrado este mes $94.50 · de $223.00 vendidos en 2 ventas". En el Inicio, "Vendido". El dato de "vendido" sale de la misma función (`ventasDelMes`).

### 2.2 (Alta) El optómetra ve "lo suyo" sin que la pantalla lo diga
- **Reglas:** 5, 7.
- **Qué pasa:** el rol del optómetra tiene "Solo lo suyo: citas, fichas clínicas, reportes". En Reportes sus tarjetas cuentan 3 consultas, 2 pacientes nuevos y 28 de 47 citas, y la pantalla es idéntica a la del administrador, sin ninguna señal de que son solo las suyas. Quien compare con el Inicio del administrador creerá que algo no cuadra.
- **Propuesta:** una etiqueta junto al período: "Solo tus consultas y citas". El mismo texto en la cabecera de Citas y de Pacientes para el rol con alcance propio.

### 2.3 (Media) Citas "98" en Reportes y "88" en el Inicio
- **Reglas:** 2, 23, 39.
- **Qué pasa:** Reportes cuenta 98 citas "solicitadas" (incluye 10 canceladas) y el Inicio y Citas "Todas" cuentan 88 (sin canceladas). Cada pantalla es coherente consigo misma, pero "58 de 98 citas solicitadas" y "88 citas" parecen discrepar.
- **Propuesta:** decidir un solo criterio. Si "solicitadas" incluye canceladas, que el texto diga "98 solicitadas (88 sin las canceladas)".

### 2.4 (Media) "Conversión", "Pasaron a venta", "Compraron" y las 2 ventas del mes
- **Reglas:** 2, 5.
- **Qué pasa:** "Ingresos: 2 ventas" y "Conversión a venta 0%" ("Compraron 0") aparecen en la misma pantalla. Son definiciones distintas (la compra del embudo solo cuenta las que nacen de una consulta del período), y la pantalla no lo explica.
- **Propuesta:** una frase bajo "Conversión": "Cuenta solo las ventas hechas desde una consulta de este período; hay N ventas más sin consulta".

### 2.5 (Media) El período personalizado usa el calendario nativo
- **Regla:** 32. Ver T2.

### 2.6 (Media) Óptica nueva: nueve tarjetas en cero y ninguna explicación
- **Regla:** 17. Ver T4.

### 2.7 (Baja) Tres nombres para "control vencido"
- **Regla:** 2. "Controles atrasados" (Reportes), "control vencido" (Inicio y Pacientes) y "Sin visitar hace tiempo" (CRM) son el mismo grupo de 4 pacientes. Ver 3.2.

### 2.8 (Baja) Cada gráfica tiene su período, pero solo algunas lo dicen
- **Regla:** 5. "Consultas por mes · últimos 6 meses" no cambia con el filtro de arriba y "Productos más vendidos" sí. Está escrito en el subtítulo de cada una, pero en letra pequeña. **Propuesta:** un chip "No depende del período" en las gráficas fijas.

---

## 3. CRM y fidelización

**Qué se ve.** Cuatro tarjetas (total de pacientes, cumpleaños cercanos, sin visitar hace tiempo, frecuentes), el saludo automático de cumpleaños, cuatro listas (los que más refieren, los más atendidos, cumpleaños próximos, sin visitar) con un botón de WhatsApp por fila, y "Avisos". Lo ven administrador, optómetra, Recepción y Ventas, con las mismas cuatro tarjetas.

### 3.1 (Alta) Cada número se dice dos veces en la misma pantalla
- **Reglas:** 3, 24.
- **Qué pasa:** "Cumpleaños cercanos 2" y debajo "Cumpleaños próximos · 2 en total"; "Sin visitar hace tiempo 4" y "4 en total"; "Pacientes frecuentes 10" y "Pacientes más atendidos · 10 en total". Las cuatro tarjetas de arriba son un resumen de las cuatro listas de abajo y ni siquiera se pueden pulsar.
- **Propuesta:** quitar las cuatro tarjetas y dejar el número en el encabezado de cada lista, o que las tarjetas sean los accesos a las listas y las listas no repitan el número. Mi recomendación: quitar las tarjetas; "Total de pacientes" ya está en Pacientes.

### 3.2 (Alta) El mismo grupo se llama de tres maneras y se cuenta por separado
- **Reglas:** 2, 21.
- **Qué pasa:** los 4 pacientes con el control vencido son "Sin visitar hace tiempo" (CRM), "pacientes con el control vencido" (Inicio y su ventana, que enlaza a CRM con el texto "Ver en CRM") y "Controles atrasados" (Reportes). Los tres dan 4 hoy, pero se calculan en lugares distintos (`controles.js`, `CRM.jsx`, `Reportes.jsx`).
- **Propuesta:** un solo nombre ("Control vencido") y una sola función para los tres.

### 3.3 (Media) Los pacientes frecuentes y los que más refieren son dos listas con el mismo botón en cada fila
- **Reglas:** 9, 3. El botón WhatsApp se repite en más de veinte filas de la pantalla. Una lista de "pacientes frecuentes" a quienes se les escribe por WhatsApp es el flujo que Diego quiere, pero en "los que más refieren" y "los más atendidos" la acción natural es agradecer, no un recordatorio.
- **Propuesta:** dejar WhatsApp en cumpleaños y en "sin visitar" (donde hay un motivo) y en las otras dos listas, el paciente y su número, con la acción en el detalle ("Ver detalles").

### 3.4 (Media) "Ver detalles" abre una ventana que no es la estándar
- **Regla:** 43. La ventana "Pacientes que más refieren" tiene cabecera propia y un botón "Cerrar" de todo el ancho; la estándar lleva el cierre abajo a la derecha. Además "Ver detalles" aparece solo en las listas con más de cinco filas: en las otras dos no hay forma de ver la lista completa o de ordenarla.
- **Propuesta:** la variante "lista" de `Cascaron` (T1) en las cuatro, con el mismo botón en todas.

### 3.5 (Media) Pantalla vacía sin acción
- **Regla:** 17. Ver T4.

### 3.6 (Baja) El saludo automático ocupa una fila entera
- **Regla:** 3, 4. Un interruptor con dos líneas de texto ocupa el ancho de la pantalla, entre las tarjetas y las listas. **Propuesta:** moverlo a Configuración (es una política) o a una línea compacta junto al título.

---

## 4. Inventario

**Qué se ve.** Cuatro tarjetas (Productos, Unidades en stock, Valor de bodega, Stock bajo), la lista "Stock disponible" con filtros por categoría y "Nuevos este mes", y por producto: editar, vender, ver movimientos, eliminar. Hoy ya quedó arreglado: el stock bajo se dice una vez (la tarjeta es el filtro), la cabecera igual que en los demás módulos y "Nuevos este mes" con su número.

### 4.1 (Alta) El módulo se llama de seis maneras
- **Regla:** 2.
- **Qué se ve:** "Inventario" (menú), "Monturas y accesorios" (título), "Productos" (tarjeta del Inicio y de este módulo), "Agregar producto" (botón), "Ingresar montura o accesorio" (ventana), "Guardar en bodega", "Valor de bodega", "No hay productos en bodega".
- **Propuesta:** "Inventario" en el menú y en el título; "Productos" para cada ítem; "bodega" fuera (o "inventario"). El botón "Agregar producto", la ventana "Agregar producto", el guardado "Guardar producto".

### 4.2 (Media) Quien solo puede ver Inventario ve lo mismo que quien lo administra, sin aviso
- **Reglas:** 7, 22. El optómetra y Recepción ven "Stock bajo" y la lista, y para el optómetra desaparecen casi todas las acciones (queda un ícono de gráfica). Pero el optómetra no ve "Requieren atención" aunque la pantalla le muestra 7 productos en stock bajo, porque su Inicio los oculta (`incStock && plantilla !== "optometra"`). Dos pantallas que se contradicen: una dice que no le toca, la otra le muestra el número.
- **Propuesta:** mismo criterio en las dos: si ve el inventario, ve el aviso; o la tarjeta "Stock bajo" no se pulsa para quien no puede reabastecer.

### 4.3 (Media) El botón principal queda solo cuando falta "Agregar producto"
- **Regla:** 1, 35. Para Recepción, que no puede crear, "Requieren atención" queda a la derecha, donde está "Agregar producto" para el administrador. Es coherente (el aviso va junto a la acción), pero cambia de posición entre roles. **Propuesta:** dejarlo; solo que la prueba de posición cubra los dos casos.

### 4.4 (Media) Un ícono sin texto junto al buscador
- **Regla:** 41, 9. Ver T5.

### 4.5 (Baja) "Nuevos este mes (0)" en una óptica vacía
- **Regla:** 25. Con cero productos aparece el filtro "Nuevos este mes (0)" que no aporta. **Propuesta:** no mostrarlo mientras no haya al menos un producto.

### 4.6 (Baja) La ventana "Agregar producto" pide "Stock mínimo (alerta)" con una leyenda de 16 palabras
- **Regla:** 3, 25. **Propuesta:** el campo con "General: 10" como texto de ayuda corto y el detalle al pasar el cursor.

---

## 5. Configuración

**Qué se ve.** Solo el administrador. Tres pestañas: "Políticas y servicios" (interruptores), "Catálogos" (motivos de consulta, categorías de diagnóstico) y "Página de login".

### 5.1 (Media) Dos formas de guardar en la misma pantalla
- **Reglas:** 16, 18.
- **Qué pasa:** los interruptores de políticas se guardan al pulsarlos; los catálogos se guardan al salir del campo (`onBlur`, `Configuracion.jsx:146`) o con "Agregar"; la pestaña "Página de login" pide "Guardar cambios" y "Cancelar cambios". Quien cambia un interruptor y luego edita la marca no sabe qué quedó guardado.
- **Propuesta:** decir siempre lo guardado ("Guardado" junto al control o aviso) y, en la pestaña de la página pública, explicar que se aplica con "Guardar cambios". Mejor aún, una sola regla para las tres pestañas.

### 5.2 (Media) Una nota de versión permanente
- **Reglas:** 3, 40. En Políticas, bajo el primer interruptor, un recuadro azul dice "Cambio en el portal del paciente: desde esta versión el paciente ve siempre su receta…". Es una nota de lanzamiento que seguirá ahí siempre.
- **Propuesta:** quitarla o mostrarla una sola vez y poder cerrarla.

### 5.3 (Media) Datos de prueba en el catálogo de la Demo
- **Regla:** 40. Entre los motivos de consulta de la Demo hay "E2E Motivo f9jv2", residuo de una prueba que se ve al administrador y lo verá cualquier lista que use ese catálogo. **Propuesta:** borrarlo (con el protocolo de siempre: respaldo y ensayo) y que las pruebas que crean catálogos corran en la óptica de pruebas (regla 28).

### 5.4 (Baja) La barra "Guardar cambios" tapa la lista
- **Regla:** 1, 6. En "Página de login" la barra con los botones queda fija abajo, blanca y sin sombra, y corta los campos que pasan por detrás. **Propuesta:** fondo con borde superior y sombra, o la barra al final del formulario.

### 5.5 (Baja) "Página de login" no dice lo que es
- **Regla:** 2. La descripción de la pestaña dice "es lo primero que ve un paciente antes de agendar una cita": es la página pública de la óptica, no el login. **Propuesta:** "Página pública".

### 5.6 (Baja) El aviso azul de arriba repite que solo el administrador la ve
- **Regla:** 3. "Estos parámetros solo los ve y edita el administrador" ya lo sabe quien llegó (el menú solo se lo muestra a él). **Propuesta:** quitar la segunda frase.

---

## 6. Usuarios y permisos

**Qué se ve.** Solo el administrador. Pestañas "Usuarios" (4) y "Roles" (3), con "Actividad" y la acción principal en la cabecera ("Crear usuario" o "Nuevo rol", este último movido hoy a la cabecera). Los roles predefinidos muestran sus permisos como etiquetas con el nivel (ver, crear, editar).

### 6.1 (Media) La tarjeta del usuario lista los módulos, no lo que puede hacer en ellos
- **Reglas:** 5, 7. La tarjeta de Paula dice "Citas médicas, Pacientes, Ventas, Inventario, CRM, Mi horario, Reportes" sin niveles; la del rol dice "Ventas · solo ver". Quien quiera saber si Paula puede cobrar tiene que abrir el rol.
- **Propuesta:** usar las mismas etiquetas con nivel en las dos (ya existe el componente en Roles).

### 6.2 (Media) "Crear usuario" marca solo la cédula como obligatoria
- **Regla:** 15, 16. El nombre, el correo y la contraseña también lo son y no tienen asterisco. **Propuesta:** marcar todos, o ninguno y decirlo al guardar.

### 6.3 (Baja) La contraseña la escribe quien crea el usuario
- **Regla:** 15, 36. El administrador define una contraseña para otra persona y luego se la comunica. **Propuesta:** (decisión de Diego) un enlace para que la persona la elija; no es urgente.

### 6.4 (Baja) Etiquetas de módulo inconsistentes en la actividad
- **Regla:** 2. La actividad llama "Mi horario" al módulo de horario y "Ficha clínica" a Consultas, y en Ventas aparecen acciones antiguas bajo "Pacientes". Se normaliza ya con `moduloDeRegistro`; falta "Horario". Ver 1.3.

---

## 7. Mensajes

**Qué se ve.** Solo el administrador. Dos tarjetas ("Consultas abiertas 0 · todo al día", "Avisos 0 · de la óptica") que filtran, un formulario "Escribir una consulta" y la lista "Tus mensajes (0)".

### 7.1 (Alta) No se entiende a quién se le escribe
- **Reglas:** 2, 34.
- **Qué pasa:** el subtítulo dice "Escribe al equipo de la óptica" y el formulario "Le llega directo al equipo de la óptica", pero el ejemplo del asunto es "Necesito cambiar el nombre de mi óptica", que es algo que se pide al proveedor del sistema, no al equipo de la óptica. En el modo anteproyecto (`MODO_SAAS_VISIBLE` apagado) el nombre del proveedor se oculta con "la óptica" (`Mensajes.jsx:14`), y el administrador de una óptica lee "el equipo de la óptica" como "mis empleados".
- **Propuesta:** un título claro y neutro, aunque no se nombre al proveedor: "Soporte" o "Consultas al administrador del sistema". Los avisos, "Avisos del sistema".

### 7.2 (Media) Dos tarjetas que filtran a cero
- **Regla:** 25, 3. "Consultas abiertas 0" y "Avisos 0" son filtros de una lista vacía; el mensaje "Todavía no hay mensajes" repite lo que dicen las tarjetas. **Propuesta:** mostrar las tarjetas solo cuando haya mensajes, y dejar el formulario como lo primero que se ve.

### 7.3 (Baja) "Mensajes" y "Notificaciones" son dos cosas con nombres cercanos
- **Regla:** 2. La campana (alertas del sistema) y el módulo "Mensajes" (conversación con soporte) se parecen en el nombre y no en lo que hacen. Se resuelve con 7.1.

---

## Decisiones que se piden a Diego

1. **Mi horario (1.1):** ¿el optómetra puede cambiar el horario general de la óptica? (recomendado: no; separar "Mi horario" y "Horario de la óptica").
2. **Reportes (2.1):** nombrar "Cobrado" y "Vendido" y mostrar los dos, o dejar solo "Vendido" en todos lados.
3. **CRM (3.1):** quitar las cuatro tarjetas de arriba (recomendado) o dejarlas como accesos.
4. **Inventario (4.1):** el nombre único del módulo ("Inventario" y "Productos").
5. **Usuarios (6.3):** si la contraseña la elige la persona (más seguro) o la define el administrador (como hoy).
6. **Mensajes (7.1):** cómo se llama la conversación con el proveedor mientras el modo anteproyecto esconde su nombre.
7. **Orden:** empezar por las tres altas (Mi horario 1.1, Reportes 2.1 y 2.2, CRM 3.1 y 3.2) y dejar para el final T1 (las ventanas), que es lo más largo.

## Antes de dar cada módulo por terminado

Repasar la lista de revisión de `docs/principios-diseno.md`, verificar con cada rol que ve el módulo, en la óptica vacía (`3pldf1`) y con muchos datos, y agregar pruebas para los números que se corrijan (2.1, 2.3, 3.2) y para los permisos (1.1: que el optómetra no pueda editar el horario general ni por la base).
