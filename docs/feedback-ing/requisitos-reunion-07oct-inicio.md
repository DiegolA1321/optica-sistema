# Requisitos del ingeniero: reunión del 7 de octubre, Inicio

Fuente: transcripciones "Administrador_inicio" y "Optometra_Inicio" de la reunión del 7 de octubre (feedback-ing/reunion-07oct/). El ingeniero revisó la versión publicada ese día.

## Lo que aprobó

- I1. Los roles: "ya tenemos mayor control y pertinencia" para cada tipo de usuario (optómetra y administrador).
- I2. El límite de ancho para pantallas grandes: "se ve interesante".
- I3. La idea de "Requiere tu atención": "el enfoque, la idea está bastante bien".

## Inicio del administrador

### "Requiere tu atención"

- I4. No mezclar todo en una sola lista: "me mandas todo de golpe… veo problemas que al final no los quiero ni siquiera analizar". Separarlo en bloques por área principal del sistema (órdenes, pacientes, productos), para ver "qué requiere mi atención en cada área", ordenado visualmente.
- I5. Límite por bloque: mostrar los tres más importantes y un enlace "hay N elementos más que requieren tu atención, ver todo". No desplegarlo dentro del Inicio, porque se pierde el diseño (un bloque crece hacia abajo y el otro no).
- I6. Cada módulo debe tener su propia sección de "requiere tu atención" (por ejemplo, Inventario con el stock bajo y las demás situaciones detectadas). El Inicio solo toma de ahí los tres más relevantes, y "ver todo" lleva a esa sección del módulo. "El dashboard es un atajo o acceso rápido; todo eso se alimenta de la información de los bloques correspondientes."

### La línea de resumen de arriba

- I7. "6 pendientes que requieren tu atención · 7 citas hoy · 1 en atención ahora" es información redundante: se repite más abajo. Quitarla.

### Totales (rendimiento del negocio)

- I8. Un número suelto no dice nada ("lo veo mañana 98, lo veo mañana 100… ¿qué me dice?"). Cada total debe mostrarse con su contexto del mes: "+5 este mes" y el total. Con la misma lógica en todas las tarjetas, y el mismo orden (primero el mes y abajo el total, o al revés, pero igual en todas).
- I9. Los tres bloques principales: pacientes registrados, citas registradas y productos en inventario. Cada uno lleva a su módulo.
- I10. "Pacientes sin atender" no encaja en Totales: parece una alerta, no un dato de rendimiento, y no tiene contexto ("¿sin atender en qué sentido? ¿en función de cuántos?"). Además, parece lo mismo que "no atendidas". Sacarlo de Totales.

### Desenlace de las citas

- I11. Es la misma línea de información que las citas de hoy: va junto a ellas, debajo de "Requiere tu atención".
- I12. El selector de periodo debe ser "Este día · Esta semana · Este mes · Todas", con "Este día" por defecto (hoy solo tiene "Este mes / Todas").
  - Decisión de Diego (10 oct.): el selector se queda como "Hoy", no "Este día": Citas ya usa "Hoy" para lo mismo y un concepto se llama igual en todo el sistema (regla 2 de `docs/principios-diseno.md`).
- I13. Tarjetas: atendidas (con "N en atención ahora" como dato complementario), no atendidas y canceladas. Así "en atención ahora" deja de ser una fila aparte.

### Las citas del día

- I14. Debajo del desenlace, cerca de él, la lista de quiénes son ("aquí está el detalle de quiénes son").
- I15. No una fila por cada paciente en atención, porque con diez a la vez hay que desplazarse. Usar la misma lógica de Citas: una lista del día con etiquetas por estado y un selector de estado (en atención, no asistió, atendidas), y el enlace a la agenda completa.

### Orden propuesto por el ingeniero

1. Totales (pacientes, citas, productos), con el mes y el total.
2. Requiere tu atención, en bloques por área.
3. Desenlace de las citas, con el selector de periodo.
4. Las citas del día, con su selector de estado.

## Inicio del optómetra

- I16. Es similar al del administrador, pero sin Totales.
- I17. "Registrar paciente" y "Agendar cita" también son acciones del optómetra: deben estar, como atajos. Que sean pequeños está bien, porque no son lo principal: "la parte principal de esto es todo lo que está acá" (su atención y su agenda).
- I18. "Faltaría darle al optómetra las opciones que le corresponden": atender, retomar, el registro de atención y su agenda de hoy.
  - Aclaración de Diego (10 oct.): "el registro de atención" es "requiere tu atención" mal transcrito; ya está cubierto por las tarjetas de avisos del optómetra.

## Contradicciones con lo ya construido (decidir antes de implementar)

1. I4 contra el Inicio actual: hoy "Requiere tu atención" es un solo bloque que mezcla todas las áreas. Antes se decidió así para reducir colores y bloques sueltos; ahora el ingeniero pide bloques por área, con un estilo común.
2. I10: "Pacientes sin atender" se movió a Totales en una ronda anterior, para no mezclar periodos. El ingeniero pide sacarlo.
3. I12: el selector del desenlace hoy es "Este mes / Todas".
4. I6 es trabajo nuevo y grande: una sección "requiere tu atención" dentro de cada módulo (Citas, Pacientes, Ventas e Inventario).
