# Principios de diseño del sistema

Qué son: las reglas que salieron de las correcciones de Diego y del ingeniero, una por una, mientras se cerraba el módulo de **Citas** y se rehacía el **Inicio** (reunión del 7 de octubre y sesiones del 8 y 9 de octubre de 2026). Citas es el ejemplo de cómo debe quedar cada pantalla. Antes de diseñar o cambiar una pantalla se leen estas reglas, y al terminar se repasa la lista de revisión del final.

Fuentes: `docs/estado-actual.md`, `feedback-ing/requisitos-reunion-07oct-citas.md` y `...-pacientes.md`, las transcripciones del ingeniero y el historial de commits de `main`.

---

## A. Estabilidad y coherencia

### 1. Ningún control cambia de lugar al cambiar de vista, de periodo o al filtrar
Lo que está bajo el mouse debe seguir ahí. Quien navega no debe volver a buscar los botones.
- **Citas:** el ing lo señaló como C1 ("al cambiar de vista, los controles cambian de posición y se mueven bajo el mouse"). La barra quedó en dos filas fijas, iguales en Lista, Semana y Mes (`baaa884`); el título del periodo tiene ancho mínimo fijo para que las flechas y el selector no se muevan entre "Hoy", "Semana" y "Mes" (`27c1bbb`); se mide con `e2e/citas-titulos-estables.spec.js`.
- **Cómo aplicarlo:** si un bloque aparece o desaparece según el estado, reserva su espacio o ponlo donde no empuje a los demás.

### 2. Un mismo concepto da el mismo número y se llama igual en todo el sistema
Si dos pantallas hablan de lo mismo, usan la misma palabra y el mismo cálculo (una sola función).
- **Citas:** "Responsable" pasó a "Profesional" en todo el sistema, y es una sola persona por cita: quien atendió o, si no, la asignada (`4a6e4b5`, C11). "En espera" es un estado propio en Citas, en Inicio y en el gráfico de Reportes (`12c9d8b`, `bbeec5a`). "Para reagendar" usa un solo criterio compartido entre Inicio y Citas (`73fcb3a`). Una vista de "Pacientes" no puede decir "Atendida" donde Citas dice "Atendida" con otra regla.
- **"Hoy" y no "Este día":** el selector de período del Inicio dice "Hoy · Esta semana · Este mes · Todas" porque Citas ya usa "Hoy" para lo mismo; el ingeniero escribió "Este día" (I12) y Diego decidió mantener "Hoy" por coherencia (10 oct. 2026).
- **Cómo aplicarlo:** antes de escribir un número nuevo, busca si ya existe una función que lo calcula; si existe, úsala. Un nombre que no coincide con lo que hay detrás se cambia (el ing renombró "Pagos" a "Productos y servicios" por eso).

### 3. No repetir información en la misma pantalla
Cada dato aparece una vez, en el lugar donde se necesita.
- **Citas:** la tarjeta ya no trae el motivo, el origen ni el código (están en el detalle) y la vista Mes perdió el conteo repetido (`8f5552a`, `ef3b921`). "Atender ahora" y "Llegó en un horario diferente" eran dos casillas para lo mismo y quedó una (`bb9e021`). Los resultados por persona nunca se repiten.
- **Dos botones que hacen lo mismo:** se borra uno, no se cambia su texto (Diego lo rechazó cuando solo se cambió el texto de un botón repetido en la página de venta).

### 4. Agrupar por significado, no por equilibrio visual
Las cosas que responden a la misma pregunta van juntas aunque queden columnas desparejas.
- **Citas:** el detalle de una cita se organiza en tres columnas por lo que significan: **La cita** (fecha, hora, motivo, origen), **Seguimiento** (profesional, quién la atendió, confirmada, cancelada) y **Paciente** (cédula, teléfono, edad, correo) (`22ceb38`, C15). El estado y las acciones van abajo, no mezclados.
- **Cómo aplicarlo:** antes de colocar un dato, pregunta "¿a qué pregunta del usuario responde?" y ponlo con los otros datos de esa pregunta.

### 5. Los números siempre coinciden con lo que se ve
Un total, un contador o una tarjeta tiene que poder comprobarse contando lo que hay en la lista que abre.
- **Citas:** el conteo dice "3 citas hoy", "16 citas en la semana", "27 citas en el mes"; la Semana 5 – 11 oct muestra 16 y la Lista de esa semana también (`a52cf17`). Con "Ver más" la lista dibuja de a 30 y dice "Ver 30 más · quedan N", pero el conteo de arriba sigue diciendo el total real. Tocar una tarjeta del Inicio abre la lista con ese mismo filtro y ese mismo periodo (`8e10402`).
- **Cómo aplicarlo:** si una tarjeta cuenta X, el clic lleva a una lista con X filas. Si no coinciden, es un defecto, no un detalle.

### 6. Los controles no se quedan pegados
Todo lo que está activo se ve y se puede quitar con un solo gesto.
- **Citas:** C10 (un filtro "se queda pegado" y se muestra pase lo que pase). Hoy cada filtro activo es una etiqueta con "x", el botón "Limpiar" los quita todos, y "Todas" y "Para reagendar" aparecen solo mientras están activos.

---

## B. Quién ve qué y cómo llega a cada cosa

### 7. Ocultar lo que no le sirve a cada rol
El rol no ve controles que no puede usar ni datos que no le corresponden. No se deshabilita: se oculta.
- **Citas:** con alcance "propio" el optómetra no ve el nombre del profesional, salvo en las citas sin asignar (`22ceb38`). Recepción no ve "Atender" ni "Ingresar" (`roles.spec.js`). "Reasignar" y "Tomar esta cita" dependen del permiso y el alcance, no del nombre del rol (`ed7b233`). El Inicio muestra solo los bloques de los permisos que la persona tiene.
- **Cómo aplicarlo:** los permisos (`puede(usuario, módulo, acción)`), nunca el nombre del rol, deciden qué se muestra.

### 8. Un solo camino para cada acción
Si dos controles llevan al mismo sitio, se borra uno.
- **Citas:** fuera el ojo de la tarjeta, fuera el menú ⋮, fuera "Agendar otra cita" de la tarjeta (C12, C13); fuera el buscador global y Ctrl + K (decisión del 8 oct); fuera el modal "Resumen de la cita" antes de la ficha: "Atender" entra directo (C16). En Pacientes: fuera el botón "Ficha clínica" de la cabecera y "Nueva ficha clínica" del menú, porque toda atención pasa por una cita ("Atender ahora" o "Ingresar").
- **Cómo aplicarlo:** al agregar un acceso, busca si ya hay otro hacia el mismo destino; si lo hay, elimina uno (el ing pidió borrar la búsqueda rápida del Inicio porque otro acceso ya llevaba al mismo sitio).

### 9. La tarjeta muestra lo que decide; las acciones van en el detalle
En una lista, cada fila dice lo mínimo para decidir; todo lo demás está un clic más allá, en el detalle.
- **Citas:** la tarjeta tiene una etiqueta (Primera vez / Seguimiento / Por registrar), la línea del profesional, la hora, el estado y un solo botón de contexto ("Atender", "Retomar" o "Cobrar"). Ver perfil, Editar, Reasignar, Cancelar, Agendar otra cita y cambiar el estado están en el detalle (`8f5552a`, `c281699`). Hacer clic en la cita abre la cita, nunca el perfil del paciente (C12, C14).

### 10. Cada pantalla se diseña desde el flujo de trabajo de quien la usa
Se camina el recorrido real, en el orden real, con el rol real.
- **Citas / Inicio:** recepción marca "Llegó" y la cita pasa a "En espera"; esa cita cuenta en "En sala de espera"; el optómetra la ve en su Inicio y su "Siguiente paciente" es quien ya llegó; "Atender" entra directo a la ficha (`c3e762b`, `ac0799c`). Al atender una cita de otro día se pregunta "¿Atenderla hoy?" y se mueve a hoy con la hora real (`bb9e021`). Se probó con `e2e/llego-en-espera.spec.js`, de punta a punta, con dos sesiones.
- **Cómo aplicarlo:** escribe el recorrido ("llega un paciente, recepción..., el optómetra...") antes de dibujar. El ing diseña así y revisa así.

### 11. Navegar no es filtrar
Las flechas del periodo sirven para moverse; los filtros y la búsqueda sirven para acotar. No van en el mismo grupo ni se mezclan (C2).
- **Citas:** fila 1 = buscar y filtrar; fila 2 = conteo a la izquierda y periodo con sus flechas a la derecha. La búsqueda mira todas las fechas y lo dice ("Buscando en todas las fechas"), sin importar el periodo (C5).

---

## C. Datos, tiempo y estado

### 12. Fechas y horas desde una sola función
Nada arma fechas a mano.
- **Citas:** `formatoFecha(valor, nombre)` y `hora()` de `src/utilidades/formatoFecha.js` ("sept" con cuatro letras, hora en 12 h, "8 oct 2026"). "Hoy" y "ahora" salen siempre de `ahoraEcuador()` (America/Guayaquil), no de la hora del equipo (`0044afc`). Tres guardas lo impiden: `fuenteUnicaFechas.test.js` y las pruebas de reloj, que pasan con `TZ=UTC`, Ecuador, Tokio y Los Ángeles.
- **Cómo aplicarlo:** si necesitas un mes, un día o una hora, pídelo a esa función; no escribas arreglos de meses ni uses `toLocaleDateString` ni `new Date()` para "hoy".
- **El dinero, igual:** `dinero(valor)` de `src/utilidades/formatoMoneda.js` ("$3,915.50": miles con coma, dos decimales con punto). Ninguna pantalla arma un monto con `toFixed(2)` ni define su propia función; `formatoMoneda.test.js` lo vigila.

### 13. Un estado que se puede comprobar se mueve solo; el que no, lo marca una persona
- **Citas (reglas de tiempo, 21 oct. 2026, validadas en el servidor):** abrir la ficha pasa la cita a «En atención»; guardarla, a «Atendida». Una cita **Pendiente** que nadie abrió pasa a **«No efectuada» al terminar su horario** (hora de inicio + duración), con el motivo «El paciente no asistió»; nunca antes. Una cita **En espera o En atención nunca pasa sola durante su horario**: la atención iniciada y no terminada pasa a «No efectuada» **al cierre de la jornada de ese día** (según el horario de la óptica) con el motivo «La atención se inició y no se terminó» (el borrador de la ficha se conserva), y un paciente que llegó y nunca se atendió, con «El paciente llegó y no fue atendido». «Llegó» lo marca recepción porque nadie más lo sabe. Una cita no efectuada o cancelada por el paciente que nadie retoma en 30 días queda «Sin seguimiento»; nada se reagenda solo. Desde una sesión de personal no se puede marcar «No efectuada» antes de que termine el horario, y una cita ya resuelta solo la corrige el administrador («Corregir estado (excepción)», que queda en el seguimiento).
- **Ningún estado depende de que alguien se acuerde.** La confirmación de la cita por el paciente ya no existe (quien agenda, viene; si no, cancela con su motivo).

### 14. El color significa lo mismo en todo el sistema
### 14. El color significa lo mismo en todo el sistema
- **Citas:** Pendiente = naranja, En atención = azul, Atendida = verde, No efectuada = rojo (antes «No asistió»), En espera = violeta, Cancelada = gris, en el calendario, en la leyenda, en la tarjeta y en el detalle. Lo seleccionado se ve en el azul de la marca, no en negro (`f45f548`).
- **Cómo aplicarlo:** un color nuevo se define en un solo lugar y se usa para una sola cosa.
- **Tarjetas del mismo grupo:** la baldosa del ícono es igual en todas (gris neutro); el color queda reservado para un estado (Atendida verde, No asistió rojo, Pendiente naranja...). Tres tarjetas de un grupo con tres estilos de ícono parecen tres cosas distintas.

### 15. Evitar el error antes que avisarlo
No se ofrece lo que no se puede hacer.
- **Citas:** "Agendar" solo aparece en un día laborable con horarios libres; no se puede cerrar un día con citas por atender ("Tiene N citas: reagéndalas o cancélalas primero"); el servidor valida el horario de la reserva web y rechaza lo que la pantalla ya no ofrece (migración 0103); los horarios ocupados salen tachados.
- **Cuando algo se puede deshacer, se ofrece deshacerlo:** "Reasignar" muestra un aviso con **Deshacer** (`d54d8aa`).

### 16. Todo lo que se escribe queda guardado y se dice
- **Citas:** cada acción confirma con un aviso flotante o un cambio visible; los errores de base de datos dicen qué pasó con palabras del usuario ("Ese horario ya no está disponible — alguien más lo acaba de reservar"). Lo que se hace queda en la actividad con quién lo hizo.

---

## D. Pantallas vacías y reutilización

### 17. Ninguna pantalla vacía sin un mensaje y una acción
Un hueco sin texto parece una pantalla rota.
- **Citas:** "Hoy no hay citas" ofrece ver lo siguiente; un día cerrado dice por qué (con el nombre del feriado si lo tiene) y ofrece "Abrir este día" a quien tiene permiso, o "Pídele a un administrador que abra este día" a quien no; "Todavía no hay citas" en la óptica vacía de pruebas.
- **Cómo aplicarlo:** para cada lista y cada gráfico, escribe qué dice cuando no hay nada y qué se puede hacer desde ahí. Verifícalo en la óptica vacía (`3pldf1`).

### 18. Una sola pieza para lo que se repite
Si dos pantallas hacen lo mismo, usan el mismo componente o la misma función, para que funcionen siempre igual.
- **Citas / Pacientes:** `CamposCita` y `agendarCita.js` los usan "Gestionar cita" en Citas y "Agendar cita" en el perfil: la hora distinta, "Atender ahora" y el guardado son idénticos. El código de cita sale de una sola función de la base (`generar_codigo_cita`). Los criterios de "Para reagendar" y "Profesional" viven en una función cada uno.

---

## E. Método

### 19. Se verifica donde nadie mira
Una pantalla no está terminada hasta que se vio con cada rol, vacía, con muchos datos y en otra hora.
- **Citas:** Demo (solo lectura) para ver, óptica de pruebas para escribir, óptica vacía para los estados vacíos; Recepción, Ventas y Optómetra además del administrador; pruebas con reloj en cuatro zonas horarias; `sinVariablesNoDefinidas.test.js` corre el linter sobre todo `src`.

### 20. La decisión final es de quien usa el sistema, y todo cambio de diseño es pequeño y reversible
- **Citas:** el bloque de filtros siempre visible (C9) se construyó como pidió el ing y Diego lo descartó el mismo día: se revirtió en dos commits (`e563534`, `a168e5b`) y se guardó la versión por si se retoma. Antes de cambiar una decisión de Diego se muestra una maqueta y se espera su aprobación.
- **Cómo aplicarlo:** una decisión del ing, de Diego o de este documento no se reabre sin motivo; si hay que cambiarla, se anota el porqué en `docs/estado-actual.md`.

---

## F. Reglas que salieron de la revisión del Inicio y del perfil del paciente (9 oct. 2026)

### 21. Un mismo hecho se avisa igual en todas las pantallas que lo muestran
Si el Inicio avisa que un control está vencido, el perfil de ese paciente también lo avisa, con la misma acción. Una pantalla no puede ocultar lo que otra anuncia.
- **Citas:** una cita con la atención abierta de un día anterior dice lo mismo en la tarjeta, en el detalle, en el Inicio y en el perfil: "Abierta hace 2 días".

### 22. Una alerta viaja con su acción, y esa acción respeta el permiso
Una alerta sin botón obliga a buscar; un botón que el rol no puede usar es peor. Cada botón se oculta si el rol no tiene el permiso del módulo al que lleva (agendar: citas crear; vender y cobrar: ventas crear; enviar mensaje: CRM crear; crear acceso: pacientes editar).
- **Citas:** Reasignar y Tomar esta cita aparecen por permiso y alcance, no por nombre de rol.

### 23. Un conteo y la lista que abre usan el mismo criterio; las canceladas no desaparecen, se cuentan aparte
Una cita cancelada **se ve siempre** en Lista, Semana y Mes (atenuada y tachada, con su color en la leyenda) y el filtro «Canceladas» las deja solas; pero **no suma** a las citas del periodo: el conteo dice «16 citas · 2 canceladas». Si una tarjeta dice «3 citas», la lista tiene 3 citas más, aparte, sus canceladas. (Antes las canceladas solo salían con el filtro: cambió el 21 oct. 2026, reunión del 20 oct.)
- **Citas:** «Todas» incluye las canceladas; «Canceladas» las deja solas; al cancelar se pide el motivo y queda quién canceló (el paciente desde el portal o una persona del personal).

### 24. Cada indicador vive en un solo lugar
Si el puntaje, un estado o un total ya aparece en un bloque, no se repite en otro de la misma pantalla. El detalle va dentro de su padre, desplegable, no en una segunda lista.
- **Citas:** la tarjeta no repite lo del detalle. **Perfil:** cada venta aparece una vez, por comprobante, con sus líneas desplegables.

### 25. Un control que no aporta con pocos datos no aparece
Un buscador sobre 2 filas es ruido. Los controles de filtrado salen cuando hay volumen que filtrar.
- **Perfil:** el buscador del historial de citas aparece con más de 5 citas.

### 26. Un solo mensaje por lista vacía, y sin enlaces a lo que no existe
Una lista vacía dice una vez qué pasa y, si hay una acción útil, la ofrece. No repite el mismo hecho en tres textos ni ofrece "Ver todas" cuando no hay nada que ver.
- **Citas:** "Hoy no hay citas" con su acción; un día cerrado explica por qué y ofrece abrirlo.

### 27. Lo que toca otro módulo cerrado se avisa antes de dejarlo
Si un cambio comparte un componente o un criterio con un módulo ya aprobado (Citas), se dice qué cambia allí y por qué, y se espera la aprobación antes de dejarlo.
- **Ejemplo:** unificar el texto "Abierta hace N días" cambia la etiqueta de la tarjeta de Citas; se pidió aprobación.

### 28. Las pruebas crean sus propios datos y leen la Demo solo para mirar
Una prueba que escribe corre en la óptica de pruebas y crea lo que necesita (paciente con historial, cita de hoy). La Demo es de solo lectura.

---

## G. Reglas que salieron de la revisión del perfil del paciente (10 oct. 2026)

### 29. Lo que el paciente necesita para actuar se le entrega completo; la privacidad es de lo comercial
La receta es el documento con el que el paciente compra sus lentes: se imprime siempre con la graduación. La política de ocultar medidas aplica a la proforma y a los comprobantes, y en el portal solo a la distancia pupilar y la altura de montaje (regla 36), nunca a la receta.
- **Perfil / Ficha:** se quitó la casilla "Incluir medidas" y el aviso "por política de la óptica" de la receta. **Portal:** el paciente ve siempre su receta (esfera, cilindro, eje, adición, agudeza visual).
- **Cómo aplicarlo:** antes de ocultar un dato en un documento, pregunta si la persona que lo recibe lo necesita para hacer lo que el documento le pide.

### 30. Lo que nace de otra cosa se crea desde su origen, y la acción de una pantalla vacía lleva al origen
Una orden de laboratorio sale de una venta (lleva su montura y su luna). No se ofrece crearla sin venta, y su pantalla vacía no trae un atajo que se salte la venta.
- **Perfil:** "Enviar a laboratorio" solo aparece si el paciente tiene una venta; sin órdenes y con el paciente "Listo para venta", la pantalla vacía ofrece "Vender la receta", que es el camino hacia la orden. Lo mismo en "Productos y servicios" vacío.

### 31. Crear y editar son el mismo formulario
Mismos colores, mismo botón principal, mismos campos. Editar no cambia de color para "avisar" que es otro modo: el título ya lo dice.
- **Perfil:** "Editar paciente" dejó el naranja y usa el azul de la marca igual que "Crear paciente". Las acciones principales de una pestaña son un botón compacto del color principal, no una barra de lado a lado.

### 32. Las fechas se eligen con el calendario del sistema, no con el nativo del navegador
`CampoFecha` (`src/componentes/CampoFecha.jsx`) tiene el mismo calendario que el selector de citas y mes/año en listas para llegar a una fecha de nacimiento sin pulsar "anterior" cien veces. Los campos de fecha nuevos lo usan.
- **Pendiente de migrar (mismo defecto):** nacimiento en "Confirmar datos" y en las altas rápidas de Citas, abonos, orden de laboratorio, Reportes y vencimiento en Superadmin. (Las ausencias de Horario ya usan `CampoFecha`.)

### 33. Un bloque de resumen va de lo clínico a lo comercial: primero lo que decide la atención
En el Resumen del paciente el orden es: estado de corrección, control recomendado, última consulta y compras; después las citas; al final la fidelización. Quien atiende lee de arriba abajo y lo primero es lo que necesita para atender.

### 34. Un mensaje a una persona la trata como persona
El saludo no adivina el nombre: mientras el nombre y el apellido estén en un solo campo, se escribe "Hola, Rosa Bravo Cedeño" tal como está guardado (ver "Nombres y apellidos en dos campos" en `docs/estado-actual.md`). Los conteos concuerdan en singular y plural ("Le falta 1 consulta", "Le faltan 2 consultas", "falta 1 día"). Los filtros de una lista no se muestran si la lista está vacía.

### 35. Los botones de una cabecera van en una sola fila, y un acceso que ya existe en otro control no se repite
- **Perfil:** la cabecera tiene identidad arriba y las acciones en una fila debajo. "Restablecer clave" se quitó porque la etiqueta "Cuenta Portal: Activa" ya abre esas opciones (regla 8).

### 36. Lo que se oculta se oculta en el servidor, y el sistema no habla de costos
Ocultar algo solo al dibujar la pantalla no lo oculta: el dato igual llega al navegador. Lo que una persona no debe ver no se envía. Las funciones que el portal usa entregan solo lo que el portal muestra (`mis_consultas_paciente`, `mis_citas_paciente`), y "Descargar mis datos" (`exportar_mis_datos_paciente`) entrega todos los datos personales y clínicos del paciente (antecedentes y alergias incluidos) pero nunca campos internos: ids del personal, intentos de inicio de sesión, montos, tokens ni campos de control.
- **Portal:** la distancia pupilar y la altura solo viajan si la óptica lo permite (`opticas.settings.mostrarMedidasPaciente`; la clave se conserva). Migración 0107.
- **Textos:** ninguna pantalla menciona costos o cobros adicionales por entregar datos de salud; si la óptica los cobra, lo hace fuera del sistema.
- **Cómo aplicarlo:** al ocultar un dato por rol, política o paciente, comprueba qué responde la función o la consulta, no qué dibuja el componente. Se verifica con una llamada real con el token del paciente (`scripts/historial/ensayo-0107.mjs`).

---

## H. Reglas que salieron de la revisión del Inicio (10 oct. 2026)

### 37. Jerarquía: lo más importante para cada rol va primero, en el orden que pidió el ingeniero
Una pantalla de resumen responde en 5 segundos "¿cómo va hoy?": quien la abre lee de arriba abajo, así que lo que decide su día va arriba. Si el ingeniero fijó un orden o una estructura, eso manda y no se reordena ni se compacta por gusto: un criterio mío ("que todo quepa en la primera pantalla") nunca pasa por encima de lo que él pidió.
- **Administrador, a todo el ancho:** Totales (cuatro tarjetas, cada una con su tinte suave que no es un color de estado), "Requiere tu atención" en cuatro tarjetas por área (Citas, Pacientes, Ventas, Inventario) en una cuadrícula de 2×2, el desenlace con sus cuatro números (atendidas, no efectuadas, pendientes y canceladas aparte), su selector de período y «Ir a Citas» —**sin la lista de citas debajo**: es lo mismo que el módulo Citas y cada tarjeta lleva allí con su mismo número—, y el registro de actividad al final.
- **Optómetra, en este orden (20 oct. 2026):** atajos pequeños; **el desenlace de mis citas**; su día (siguiente paciente con "Atender", fichas sin terminar con "Seguir atendiendo" solo si hay) y su agenda de hoy con sus botones (sin citas hoy, su próxima jornada); **sus avisos** en tarjetas por área, solo los suyos y según sus permisos; y el apartado «Avisos» del administrador (los no leídos destacados). Sin totales.
- **Recepción y ventas:** el mismo diseño de tarjetas en su «Requiere tu atención»; el apartado «Avisos» del administrador, debajo.
- **Cómo aplicarlo:** antes de rediseñar una pantalla, lee los requisitos del ingeniero que la cubren y compara punto por punto; si una regla de este documento choca con un requisito, gana el requisito y se corrige la regla.

### 38. "Requiere tu atención" se separa por área, en tarjetas: nunca todo en una sola lista
El ingeniero criticó el bloque que mezclaba todo en una lista y pidió separarlo por área; el 20 oct. 2026 pidió además que no tenga tanto texto: **tarjetitas**. Cada área (Citas, Pacientes, Ventas, Inventario) es una tarjeta propia, de la misma altura que las demás de su fila, con su ícono, su título y el total de avisos del área; dentro, **como máximo tres tarjetitas, cada una con el número grande y una leyenda corta** («por contactar», «con stock bajo») **sin nombres de pacientes**. Un área sin avisos es una línea: «Todo en orden».
- **Qué abre cada cosa:** la tarjetita abre SU lista en la ventana estándar (regla 43), con cada caso, su detalle y su acción y el enlace «Abrir en …» con el número del destino (regla 42); «N avisos más» abre la ventana con todas las del área; «Ver todo →» lleva al módulo (con el filtro del aviso si el área tiene un solo tipo).
- **Un aviso por tipo, no por persona,** y el mismo criterio en todas las áreas. Una acción que el rol no puede usar no se muestra (regla 7). La leyenda concuerda en singular y plural («1 orden atrasada»).
- **Vigencia y descarte:** cada aviso tiene una vigencia y, si es una decisión de la persona, «Descartar» con motivo (queda quién, cuándo y por qué; se puede deshacer). Lo que es un hecho pendiente (dinero, una solicitud de datos, un paciente esperando) se resuelve, no se esconde. Tabla en `docs/ronda2-avisos-vigencia.md`.
- **Qué falló:** una versión de esta regla pedía "un solo cuadro con un subtítulo por área" y "el total una sola vez en el título"; eso devolvió la lista única que el ingeniero había rechazado.


### 39. Las partes suman el total que se anuncia, y lo aparte se dice aparte
Si una fila dice "12 citas", las tarjetas que la componen suman 12; la suma no se escribe en el título (cada número se lee una sola vez, en su tarjeta). Lo que no cuenta en el total (las citas canceladas, regla 23) se muestra aparte, separado de la suma, para que el total coincida con lo que cuenta Citas.

### 40. El registro de actividad es para personas, y las pruebas y los scripts no escriben en él
Cada línea es una frase que entiende quien administra la óptica ("Administrador Demo agendó el control de Ana Pérez"), sin notas técnicas, nombres de scripts ni ids. Los scripts de mantenimiento y las pruebas automáticas no escriben en `logs_optica` de una óptica real ni de la Demo; sus notas van a un archivo del repositorio.
- **Pruebas:** toda prueba que escribe usa la óptica de pruebas (regla 28); la Demo es de solo lectura.


### 41. El texto es legible y el color comunica
Ningún texto es más pequeño que el del resto del sistema: las líneas y los datos van en el tamaño normal (14 px) y las etiquetas y notas secundarias no bajan de 12 px; nada de 11 o 13 px sueltos para "ganar espacio". Un adorno que no comunica nada (por ejemplo un punto de color delante de cada aviso) no se pone: el color se reserva para un significado (regla 14), como el rojo de una alerta real.
- **Inicio:** si algo no cabe en una línea, se acorta el texto o se recorta con puntos suspensivos; no se achica la letra.

### 42. Todo lo que se puede presionar lleva exactamente a lo que promete
Una tarjeta, un número, un enlace o un botón abre el destino que su texto y su número anuncian: el mismo período, los mismos filtros, el mismo número y la vista que corresponde al rol de quien presiona. Si un enlace no puede llevar a lo mismo, su texto dice adónde lleva.
- **Qué falló (revisión del 10 oct. 2026, enlaces del Inicio de cada rol recorridos uno por uno):** la tarjeta "Citas 98" abría las citas de hoy (1) y Citas "Todas" mostraba 88 porque el 98 incluía 10 canceladas; la tarjeta "Ventas" abría la cola de pacientes por vender y no los comprobantes; "Ver todo" de Citas (16 avisos) abría solo "Para reagendar" (14), el de Pacientes (15) la lista completa de 41 y el de Ventas la cola de 5; "Revisar" (2 pacientes de la web sin confirmar) abría los 41 pacientes; al optómetra con la próxima jornada del lunes (1 cita) "Ver todas en Citas" lo llevaba a "Todas" (88 citas), un período que su Citas no ofrece; y su "Ver todo" de Citas lo llevaba al "Para reagendar" de toda la óptica (8) por un aviso que era suyo (1).
- **Cómo aplicarlo:** cada enlace se prueba como una pareja (lo que dice, lo que abre): el número que se ve antes es el que se ve después, y el período y los filtros que se ven antes quedan puestos. Un total del Inicio cuenta lo mismo que la lista a la que lleva (las canceladas no suman en los dos lados, regla 23). Un aviso que necesita decisión se abre en la ventana estándar del sistema (regla 43), con sus casos y la acción de cada uno, sin mover nada de la pantalla (I5 del ingeniero).

### 43. Los detalles y las listas se muestran en la ventana estándar del sistema, no en patrones nuevos
Para ver un detalle o una lista encima de una pantalla se usa la misma ventana que ya usan "Registrar paciente", el detalle de la cita y la historia clínica: centrada, con el fondo desenfocado, cabecera con el ícono de marca, título y subtítulo, cierre con la X o con Escape (y botón "Cerrar" en el pie), y desplazamiento interno cuando el contenido es largo. No se inventan paneles laterales, cajones ni desplegables nuevos: un patrón que existe en una sola pantalla se siente roto en las demás.
- **Inicio:** al pulsar un aviso, el encabezado de su tarjeta o su "Ver todo →", se abre esa ventana con una sección por tipo de aviso, cada caso con su detalle y su acción propia y un enlace "Abrir en …" que dice adónde lleva y con qué número (regla 42). Al resolver un caso, la lista y los números del Inicio se actualizan. Un aviso de un solo caso abre la misma ventana: todos funcionan igual.
- **Ventana o menú pequeño:** lo que tiene contenido para leer o elegir con calma (detalles, listas, formularios, el registro de actividad, las opciones de una tarjeta de Totales) es una ventana y desvanece TODO el fondo, incluida la barra lateral y la cabecera (la capa es la estándar, `z-50`; ninguna ventana baja de ahí). Lo que es una elección rápida de una línea (el panel Filtrar, el selector de fecha o de periodo, el menú de usuario, la campana, los menús "⋮", las listas de los selectores con buscador) es un menú pequeño pegado a su botón y NO desvanece. `ventanasEstandar.test.js` vigila que toda capa que cubre la pantalla lleve `backdrop-blur`.
- **Cada tarjeta de Totales abre una ventana** con las dos maneras de verla ("Todos" y "Nuevos este mes"), y cada opción lleva al módulo con el mismo número (regla 42). "Este mes" tiene una sola definición (`esDeEsteMes`, `utilidades/inicio.js`): el Inicio cuenta con ella y cada módulo filtra con ella.
- **"Requieren atención" en cada módulo:** Citas, Pacientes, Ventas e Inventario tienen en su cabecera un botón con el número de avisos de su área que abre la misma ventana del Inicio; sin avisos queda en su sitio como "Todo en orden".
- **Cómo aplicarlo:** antes de crear un componente de ventana, busca el existente (`Cascaron` en `AtencionPaciente.jsx` y los modales de Pacientes y Citas) y reutilízalo; si le falta algo, se agrega ahí para todas las pantallas.

---

## I. Privacidad de los datos de la óptica (16 oct. 2026)

### 44. El superadmin ve lo necesario para operar el sistema, nunca los datos del negocio ni de los pacientes de una óptica, salvo con autorización de la óptica
Por la ley de protección de datos personales, la óptica es la responsable de sus datos y el superadmin (quien administra el sistema) es el encargado. Por los principios de minimización y confidencialidad, y porque las fichas clínicas son datos de salud, el panel del superadmin solo muestra lo que hace falta para saber si el sistema funciona y se usa: estado del sistema, personas activas, qué módulos se usan y cuándo fue la última vez, el soporte y su propia actividad. No muestra cuántas citas, consultas, ventas o pacientes tiene una óptica, ni sus nombres, ni su actividad interna.
- **Entrar como administrador** solo es posible si el administrador de la óptica activó «Permitir acceso del soporte» (Configuración › Privacidad, o al escalar una consulta) por un tiempo limitado (24 horas por defecto, máximo 7 días) y revocable. Al entrar, el superadmin indica el motivo; la entrada queda en la actividad de la propia óptica y en la del superadmin, y el administrador recibe un aviso con la fecha y el motivo. Un entorno de prueba no necesita autorización.
- **Se valida en el servidor, no en la pantalla** (regla 36): `acceso_soporte(óptica)` en las políticas de todas las tablas con datos del negocio o de pacientes, en los archivos de fichas, facturas y fotos, y en las funciones que actúan sobre otra óptica (migración 0120). Ocultar un número en la pantalla no basta si el dato igual llega al navegador.
- **Cómo aplicarlo:** al agregar algo al panel del superadmin, pregunta si sin eso se puede saber que el sistema funciona y se usa. Si la respuesta es no, no se muestra. Un dato nuevo del negocio o de los pacientes no entra en `datos_negocio_superadmin()`.

## J. Una sola óptica (16 oct. 2026)

### 46. Lo que el sistema le dice a una persona y espera respuesta es una conversación, no un anuncio
Un aviso es de una sola vía: sirve para informar («mañana hay mantenimiento»). Cuando el soporte ofrece ayuda, pregunta o espera una decisión, se abre una conversación de Soporte («Iniciada por el soporte», con su número) para que la otra persona pueda responder, quede el registro de qué pasó y se pueda decidir sin salir de ahí. Reglas que la acompañan: (1) lo que se abre —una guía, una pantalla— se guarda como dato (un módulo), nunca como una dirección escrita en el mensaje (no se escribe `localhost` ni un dominio fijo: la prueba `sinDireccionesFijas.test.js` lo revisa); (2) lo que se ofrece no se repite sin límite (una vez por módulo cada 30 días) y el servidor lo valida; (3) quien recibe puede decir que no le interesa y eso se respeta y se puede deshacer; (4) el botón dice lo que hace («Enviar a la óptica», «Ofrecer ayuda»), y se ve cómo lo recibirá la otra persona antes de enviarlo.

### 47. Todo mensaje tiene el mismo límite (2000 caracteres) y toda vista previa se ve como muestra
- **Límite:** el mismo en todo el sistema (soporte, administrador y personal; consultas, respuestas, avisos y ofrecer ayuda): 2000 caracteres, validado también en el servidor (`_limitar_largo_mensaje`). El contador «N de 2000» (`ContadorMensaje`) aparece solo desde los 1800; no siempre. Una nota corta (la del escalamiento, 1000) o un comentario de calificación (500) no son mensajes y conservan su límite propio.
- **Vista previa:** una muestra nunca parece la pantalla real: etiqueta «Vista previa», fondo y borde punteado distintos (`VistaPrevia`), botones atenuados que no se pulsan, sin efecto al pasar el cursor y con el texto «El administrador podrá usar este botón» (`BotonDeMuestra`), y las etiquetas de menú de una muestra también atenuadas (`EtiquetaDeMuestra`). Vale para toda vista previa del sistema (ayuda ofrecida, roles, usuarios).
- **Subtítulo de una ventana:** se ve completo (no se corta con «…»).

### 45. En el modo de la tesis el sistema es para una sola óptica: ninguna pantalla muestra selectores, filtros, comparaciones ni tablas de varias ópticas, ni textos que hablen de ellas
Con `MODO_SAAS_VISIBLE` apagado el sistema es para una sola óptica (Óptica Solna Vision). Todo se escribe en singular y habla de «la óptica»: sin selector ni filtro de óptica, sin comparar una óptica con otra, sin tablas ni columnas «por óptica», sin «todas las ópticas», sin «¿qué óptica…?». Los entornos de prueba no cuentan en nada salvo que se active «Incluir entornos de prueba», y se llaman siempre «entornos de prueba» (nunca «ópticas de prueba»). Lo que se construyó para varias ópticas (filtros, tablas, comparaciones) puede volver cuando se encienda el modo comercial: se condiciona a `MODO_SAAS_VISIBLE`, no se borra.
- **Cómo aplicarlo:** al diseñar o revisar una pantalla del panel del superadmin, busca «óptica(s)» en los textos, los filtros y las columnas. Un filtro o una columna de óptica solo aparece si hay más de una que elegir (`MODO_SAAS_VISIBLE` o con los entornos de prueba incluidos). Un aviso va «al administrador de la óptica», sin elegir destinatario.

## K. Todo el sistema en cualquier pantalla (17 oct. 2026)

### 48. Todo el sistema funciona y se ve bien en celular (390 px), tablet (768 px) y laptop (1366×768)
Vale para el personal, el superadmin, el portal del paciente y las páginas públicas, sin excepción. En los tres tamaños: **sin desplazamiento horizontal**, nada cortado ni fuera de la pantalla, **menús adaptados** (en el celular el menú lateral se abre con un botón o pasa a una barra inferior), las tarjetas se apilan, las tablas se convierten en listas legibles, las ventanas caben en la pantalla (en el celular ocupan todo el alto, con desplazamiento interno) y **todo lo que se toca mide al menos 44 px** de alto y de ancho. El portal lo usan pacientes mayores desde el celular: su texto es de 16 px como mínimo.
- **Cómo aplicarlo:** al terminar una pantalla se mira en los tres tamaños; una prueba de Playwright comprueba que `document.documentElement.scrollWidth` no supera el ancho de la ventana a 390, 768 y 1366 px (`e2e/portal-adaptable.spec.js` es el modelo).
- **Estado:** la revisión del resto del sistema en los tres tamaños está en `docs/historial/revision-adaptable.md`.

### 49. Lo que el paciente y el personal ven del mismo hecho es un solo componente con dos versiones, y el documento que se entrega es una sola hoja
La graduación se explica al paciente en el portal y se le enseña en la consulta: es el mismo componente (`componentes/graduacion/Graduacion.jsx`) con la versión del paciente (palabras simples, explicación por rangos de valores en `utilidades/graduacion.js`) y la del personal (OD y OI, esfera, cilindro, eje, adición, agudeza visual y distancia pupilar). «Explicar al paciente» muestra la primera dentro del perfil. Los puntos de fidelidad salen de una sola fórmula (`puntosFidelidad`, la del CRM) y la receta que se imprime al terminar la consulta, la que se ve en «Imprimir receta» del perfil y la que el paciente guarda como PDF desde su portal son la misma hoja (`HojaReceta`, impresa con `imprimirHojaReceta`).
- **Cómo aplicarlo:** si el paciente y el personal ven el mismo dato, se cambia el componente una vez y las dos versiones cambian juntas; un cálculo (un nivel, un puntaje, un rango) no se repite en una pantalla.

### 50. Una lista es una tabla: columnas que reparten el ancho, números y estados alineados, toda la fila se pulsa
Citas, compras, recetas, órdenes y solicitudes se leen como una tabla (encabezado de columnas; en pantalla angosta las columnas se apilan con su rótulo). Las columnas reparten el ancho con `fr` y mínimos que caben en una laptop de 1093 px (nunca anchos fijos que dejen el centro vacío). Los montos van a la derecha en su columna y los estados a la izquierda en una columna fija. Toda tarjeta o fila que resume algo abre su detalle en la ventana estándar, y TODA su área se pulsa (un botón `.pt-abrir` sobre la fila, no solo el título). El contenido ocupa el ancho disponible menos 32 px, sin tope. Lo comprueba `e2e/diseno-reglas.spec.js`.
- **Cómo aplicarlo:** una lista nueva lleva `data-lista`, cada fila `data-fila` y sus celdas `data-col="monto"` / `data-col="estado"`; la prueba la recorre sola.

### 51. Todo gráfico de una serie en el tiempo es el mismo gráfico de tendencia
`GraficoTendencia` (`src/componentes/graficas/`) es la única forma de dibujar «cuánto va de cada período»: barras por período, la línea del promedio de 3 períodos y la línea punteada de la tendencia; arriba el último valor con su cambio frente al período anterior y cuánto sube o baja por período según la tendencia; debajo, una frase que lo explica en palabras. Las cuentas están en `utilidades/tendencia.js`. Con menos de 3 períodos con datos no se dibuja la tendencia y la frase dice por qué (no se inventa una línea con dos puntos).
- **Cómo aplicarlo:** un gráfico nuevo de meses, semanas o años usa esta pieza (Reportes, el panel del superadmin, el perfil...). Las barras siguen siendo botones que abren la lista de lo que las compone (regla 5). El color de la tendencia dice si lo que pasa conviene (verde) o no (rojo) según el indicador.

### 52. Un dato sensible se guarda en privado y lo ve solo quien lo envió y quien administra
El documento de respaldo de una ausencia puede ser un certificado médico: va a un almacenamiento privado, en la carpeta de quien lo envía, y solo lo leen esa persona y el administrador de su óptica (ni otros empleados ni el superadmin). Lo que el resto del sistema necesita saber de esa ausencia (el tiempo bloqueado en la agenda y en la web) viaja sin el motivo, sin el tipo y sin el documento.
- **Cómo aplicarlo:** al agregar un dato sensible, decide quién lo lee en la política de la base (regla 36), guárdalo fuera de la tabla que lee todo el equipo y entrega a las demás pantallas solo el resumen que necesitan. Se prueba con una sesión real de cada rol (`scripts/historial/ensayo-0143-0146.mjs`).

---

## Lista de revisión antes de dar una pantalla por terminada

Cada pregunta remite a una regla; la respuesta debe ser "sí".

1. ¿Algún control cambia de lugar al cambiar de vista, periodo o filtro? (1)
2. ¿Cada concepto se llama igual y usa el mismo cálculo que en Citas, Inicio y Reportes? (2)
3. ¿Hay algún dato repetido o dos controles hacia el mismo destino? (3, 8)
4. ¿Cada bloque agrupa por la pregunta que responde? (4)
5. ¿Cada número coincide con la lista que abre y con lo que se ve? (5)
6. ¿Todo lo activo se ve y se puede quitar? (6)
7. ¿Cada rol ve solo lo que puede usar, decidido por permisos? (7)
8. ¿Las filas muestran lo que decide, y las acciones están en el detalle? (9)
9. ¿Se escribió el recorrido de quien la usa antes de diseñar? (10)
10. ¿Las fechas, las horas y el "hoy" salen de las funciones únicas? (12)
11. ¿Los estados y colores son los de siempre? (13, 14)
12. ¿Se evita el error en vez de solo avisarlo, y se puede deshacer? (15, 16)
13. ¿Cada lista, gráfico y bloque vacío dice qué pasa y qué hacer? (17)
14. ¿Se reutilizó la pieza existente en lugar de copiarla? (18)
15. ¿Se vio con otro rol, vacía, con muchos datos y en otra zona horaria? (19)
16. ¿Lo que una pantalla avisa también lo avisan las demás que muestran ese hecho, con la misma acción y el permiso correcto? (21, 22)
17. ¿Cada conteo coincide con su lista, canceladas incluidas, y cada indicador vive en un solo lugar? (23, 24)
18. ¿Los controles de más (buscadores, enlaces "Ver todas") aparecen solo cuando hay algo que filtrar o ver? (25, 26)
19. ¿El cambio toca otro módulo cerrado? Si sí, se avisó y se aprobó. (27)
20. ¿Un documento que el paciente necesita sale completo, y lo que depende de otra cosa (orden, cobro) solo se crea desde su origen? (29, 30)
21. ¿Crear y editar se ven igual, y las fechas usan `CampoFecha`? (31, 32)
22. ¿El bloque va de lo clínico a lo comercial, el saludo no adivina el nombre y el singular/plural concuerda? (33, 34)
23. ¿Lo que se oculta se oculta en el servidor (se comprobó la respuesta real) y ningún texto habla de costos? (36)
24. ¿La pantalla sigue la estructura y el orden que pidió el ingeniero (comparada punto por punto con sus requisitos) y pone primero lo que decide el día de cada rol? (37)
25. ¿"Requiere tu atención" son tarjetas por área de la misma altura, con máximo tres avisos de una línea cada uno, una sola acción y "Ver todo →" sin repetir el número? (38)
26. ¿Las tarjetas suman el total del título y lo que no cuenta se muestra aparte? (39)
27. ¿El registro de actividad se lee como frases para personas, sin notas técnicas, y ninguna prueba ni script escribe en la Demo? (40)
28. ¿Ningún texto es más pequeño que el del resto del sistema y ningún adorno de color queda sin significado? (41)
29. ¿Cada tarjeta, número y enlace abre exactamente lo que promete (mismo período, mismos filtros, mismo número, vista del rol) y el texto dice adónde lleva? (42)
30. ¿Los detalles y las listas se abren en la ventana estándar (centrada, fondo desenfocado, X y Escape, scroll interno) y no en un patrón nuevo? (43)
31. ¿El panel del superadmin muestra solo lo necesario para operar (nunca volumen del negocio ni datos de pacientes), y lo que necesita ver de una óptica lo autorizó su administrador y lo exige el servidor? (44)
32. ¿Con el modo de la tesis ninguna pantalla muestra selectores, filtros, comparaciones, tablas ni textos de varias ópticas, y los entornos de prueba solo cuentan si se activa «Incluir entornos de prueba»? (45)
33. ¿Lo que espera una respuesta o una decisión es una conversación con su registro (no un anuncio), guarda lo que se abre como dato (sin direcciones escritas), tiene límite de repetición validado en el servidor y deja decir que no? (46)
34. ¿Todo cuadro de mensaje usa el mismo límite de 2000 (con el contador solo desde 1800 y validado en el servidor), y toda vista previa es claramente una muestra con sus botones atenuados y sin efecto? (47)
35. ¿Se ve y funciona en celular (390 px), tablet (768 px) y laptop (1366×768), sin desplazamiento horizontal, con el menú adaptado y todo lo que se toca de 44 px o más? (48)
36. ¿Lo que el paciente y el personal ven del mismo hecho es un solo componente con dos versiones, con las mismas cuentas, y el documento que se entrega es una sola hoja? (49)
37. ¿Cada lista es una tabla de columnas que reparten el ancho, con montos y estados alineados, y toda la fila se pulsa y abre su detalle? (50)
38. ¿Todo gráfico de una serie en el tiempo es el de tendencia (barras, promedio de 3 períodos, tendencia punteada, cambio y frase), y sin tendencia dibujada con menos de 3 períodos? (51)
39. ¿Un dato sensible se guarda en privado, lo lee solo quien lo envió y quien administra, y las demás pantallas reciben solo el resumen que necesitan? (52)
