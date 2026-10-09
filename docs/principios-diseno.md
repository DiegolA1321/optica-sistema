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

### 13. Un estado que se puede comprobar se mueve solo; el que no, lo marca una persona
- **Citas:** abrir la ficha pasa la cita a "En Atención"; guardarla la pasa a "Atendida"; pasados 10 minutos sin iniciar se marca "No asistió" (solo las "Pendiente": nunca toca "En espera"). "Llegó" lo marca recepción porque nadie más lo sabe. Ningún estado depende de que alguien se acuerde.

### 14. El color significa lo mismo en todo el sistema
- **Citas:** Pendiente = naranja, En atención = azul, Atendida = verde, No asistió = rojo, En espera = violeta, Cancelada = gris, en el calendario, en la leyenda, en la tarjeta y en el detalle. Lo seleccionado se ve en el azul de la marca, no en negro (`f45f548`).
- **Cómo aplicarlo:** un color nuevo se define en un solo lugar y se usa para una sola cosa.

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

### 23. Un conteo y la lista que abre usan el mismo criterio, incluidas las canceladas
Las canceladas no cuentan como citas del día ni del periodo: se cuentan aparte y solo se listan cuando se pide. Si una tarjeta dice "3 citas", la lista tiene 3.
- **Citas:** "Todas" son las citas activas; las canceladas se ven solo con Estado: Canceladas.

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
