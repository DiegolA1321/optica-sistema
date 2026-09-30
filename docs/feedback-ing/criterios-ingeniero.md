# Criterios recurrentes del ingeniero

**Fecha del análisis**: 2026-09-30
**Fuentes**: `feedback-ing/transcripcion_ordenada.txt` (reunión del 2026-09-03), `feedback-ing/transcripcion_audio ING1.txt`–`ING9.txt` (clips del 2026-09-09), `docs/feedback-ing/reunion-zoom-29sep.md` (reunión Zoom del 2026-09-29).

**Objetivo de este documento**: no repetir el listado de pedidos puntuales (eso ya está en `docs/feedback-ing/estado.md` y `docs/feedback-ing/plan-reunion-29sep.md`), sino extraer el **criterio de fondo** que el ingeniero aplica una y otra vez, en módulos distintos y en reuniones distintas, para poder usarlo como lente de revisión en módulos que él todavía no auditó línea por línea. Cada criterio cita al menos dos momentos reales en los que lo aplicó — ver [[reference_ing_reasoning_model]] en la memoria del proyecto para los 23 patrones ya extraídos de ING1-9; este documento los reorganiza alrededor de 9 criterios transversales y los actualiza con la reunión del 29 de septiembre.

---

## 1. Evitar pantallas vacías (fallback a lo más cercano, nunca "no hay nada")

Un estado vacío se lee como sistema roto, no como "no hay datos hoy". Si no hay nada que mostrar para el criterio exacto (hoy, esta semana), hay que mostrar lo más cercano disponible (ayer, lo más bajo en stock, lo último registrado) en vez de una pantalla en blanco.

- **ING1, 00:20-00:56** (Inicio → "Últimas citas"): *"¿Qué mostraría? Si hubiera citas para hoy me mostraría primero esas. Pero si hoy no hubiera citas, me mostraría las de ayer, las de anteayer (...) para que esto no sea vacío, sino sea como un historial previo (...) para evitar que se vea así vacío."*
- **ING1, 00:59-01:30** (mismo módulo, widget distinto — Inventario): *"Inventario lo mismo. No directamente me saldría así, sino que me saldrían los... ordenados directamente los inventarios más bajos (...) No pase esto como ahorita, que no... que no hay nada."*

Aplicado dos veces en la misma sesión, a dos widgets distintos del dashboard — confirma que es un criterio general de diseño de pantallas con datos variables, no un pedido aislado de un widget. Coincide con la regla de CLAUDE.md §2 ("Estados de Carga... prohibido mostrar pantallas vacías o parpadeos").

## 2. Contexto antes de la acción (no repetir información que el sistema ya tiene)

Si el sistema ya sabe quién es el paciente o en qué cita está, no debe volver a pedir que se lo busquen o identifiquen. Cualquier paso que reintroduce una búsqueda o un dato ya resuelto es un defecto, aunque cada paso individual funcione.

- **transcripcion_ordenada.txt:129-130** (Citas médicas, objetivo explícito del módulo): *"Objetivo: que la optómetra nunca tenga que buscar dos veces al mismo paciente."*
- **reunion-zoom-29sep.md, 07:51** (Ficha clínica, mismo criterio aplicado 26 días después a un módulo distinto): *"Yo aquí ya estoy con un paciente en específico... esto de aquí no tendría que aparecer esta opción aquí [buscador de paciente], pues yo estoy dentro del paciente."*

## 3. No duplicar información entre pasos o módulos

Si un dato ya se mostró o se capturó en un lugar, repetirlo en otra pantalla (aunque sea "solo para recordar") se lee como error, no como ayuda — incluso si la intención original era buena.

- **reunion-zoom-29sep.md, 09:14** (Ficha clínica, paso Refracción): *"En Refracción... vuelvo a preguntarme lo mismo. Antecedentes del paciente creo que está repetida."*
- **reunion-zoom-29sep.md, Video 2** (mismo día, módulo/par de módulos distinto — Ficha clínica vs. Historial): *"Ficha clínica e historial se están repitiendo o solapando. Ficha clínica debe ser el historial de diagnósticos y seguimiento."*

Nota: en el primer caso el propio equipo ya había introducido ese bloque a propósito (commit `186251d`, para resolver un pedido anterior de ING7 de mostrar antecedentes sin obligar a volver a Anamnesis) — el ing lo siguió leyendo como duplicado aunque estuviera colapsado en una sola línea. El criterio de fondo no es "nunca mostrar el mismo dato dos veces", es "cualquier reaparición de un bloque/título ya visto en otro paso se percibe como repetido, sin importar cuánto se resuma" (ver `plan-reunion-29sep.md`, Contradicción A).

## 4. Automatizar transiciones de estado que reflejan un hecho objetivo

Un estado que corresponde a un hecho verificable por el sistema (el usuario entró a la ficha, se guardó el diagnóstico, pasó el margen de tiempo) debe cambiar solo, sin botón manual — un toggle manual permite que la etiqueta se desincronice de la realidad. Los overrides manuales quedan como ruta secundaria, explícitamente marcada como incompleta (sin historial).

- **ING9, 02:00-02:45 y 03:30-04:15**: *"Cuando yo ingreso a 'Atender paciente', automáticamente va a cambiar el estado a 'En atención' (...) No fue porque le dio clic y le puse 'En atención', sino porque el sistema automáticamente reconoció que estoy dentro de la interfaz (...) Una vez que yo ya hago el envío del diagnóstico, este va a cambiar a 'Atendido', automáticamente."*
- **reunion-zoom-29sep.md, Video 2** (mismo criterio, 26 días después, confirmado de nuevo): *"Cuando doy 'Atender', el sistema debe marcar automáticamente la etiqueta 'En atención', así el administrador ve cuántas citas están en atención en tiempo real."*

## 5. Conservar el registro en lugar de borrarlo (reagendar/cancelar, no eliminar)

Un registro con historial (una cita, una atención) no debe desaparecer de la base de datos — el evento ocurrió y debe quedar trazable. La acción correcta es reagendar o marcar un estado (cancelada, no asistió), nunca un `DELETE`.

- **transcripcion_ordenada.txt:611-612** (Configuración → Políticas hacia el paciente, 2026-09-03): *"Se puede reagendar o cancelar su propia cita (...) por eso no estaba habilitado el reagendar cita."* — ya entonces la única acción del lado paciente contemplada era reagendar/cancelar, nunca borrar.
- **reunion-zoom-29sep.md, Video 2** (mismo criterio aplicado del lado del staff, 26 días después): *"Si la persona no llegó, se marca manualmente 'No asistió'. No deberíamos eliminar citas, sino re-agendarlas."*

Ya implementado para Citas (ver `plan-reunion-29sep.md`, Fase 3b — "Cancelar cita" con `citas_base.cancelada_por` reemplazó el `DELETE`). Extender el mismo criterio a cualquier otro módulo con un botón "Eliminar" sobre un registro con historial.

## 6. Categorías fijas en vez de texto libre, cuando el dato alimenta un reporte

Antes de dejar un campo como texto libre hay que preguntarse si algún reporte futuro necesitará agrupar por ese campo. Si la respuesta es sí, el campo debe ser una categoría fija (configurable desde Configuración) con un campo secundario de detalle libre para el matiz — texto libre sin estructura "no se agrupa".

- **transcripcion_ordenada.txt:82** (Ficha clínica → Diagnóstico, 2026-09-03): pide *"categorías FIJAS de diagnóstico (miopía, astigmatismo, presbicia, etc.)"* con un campo de detalle aparte.
- **reunion-zoom-29sep.md, 11:06** (mismo criterio, 26 días después, aplicado a Motivo de consulta): *"Habíamos definido algunas consultas generales... unos tipos de consultas en concreto para yo poder seleccionarlas... y dentro de las configuraciones podríamos añadir otros tipos de consultas (...) esto ayuda a luego hacer reportes, porque podemos filtrar por motivos de consulta. Si lo tengo muy abierto no se agrupa."*

## 7. Orden consistente entre elementos relacionados (formularios, botones, listas)

El orden de los campos de un formulario, o de los botones de acceso rápido frente a los widgets a los que apuntan, debe seguir siempre la misma lógica (de lo obligatorio/prioritario a lo opcional, o calcado 1-a-1 con el orden visual del destino) — no un orden arbitrario o heredado de cómo se construyó el código.

- **transcripcion_ordenada.txt:135-136 y 733** (Inventario, formulario de producto): *"Revisar el orden de los campos del formulario: categoría → descripción del producto → el resto; mover 'Observación' más arriba/abajo según prioridad"* — Observación es opcional y debe ir al final, después de precio/stock.
- **ING2, 18-19** (módulo distinto — Inicio, botones de acceso rápido vs. widgets del dashboard): *"Tú decides. Si paciente está aquí primero... aquí arriba está el botón de gestionar paciente. Si cita está aquí, acá arriba sería gestionar cita. Ahora si sigues cita hoy primero, entonces cambia de orden."* — el orden de los botones debe calcar el orden visual de los widgets que abren, sea cual sea ese orden.

## 8. Vistas adaptadas al rol real del usuario, no una sola vista para todos

La interfaz no debe mostrar la misma información global a todos los roles — el administrador necesita control/visión de todo el equipo, y quien atiende pacientes directamente (el optómetra) necesita solo su propia agenda y sus tareas inmediatas. Esto es distinto del sistema de permisos granulares por checkbox (que ya existe y es deliberadamente no-basado-en-roles-fijos, ver patrón #6 de [[reference_ing_reasoning_model]]): aquí el criterio es sobre *qué ve* cada quien, no sobre *qué puede hacer*.

- **transcripcion_ordenada.txt:575** (Usuarios y permisos, 2026-09-03, sobre un admin que no es el optómetra): *"Y el optómetra ya no técnicamente ya no, o sea, esa persona no necesitaría las opciones del optómetra."*
- **reunion-zoom-29sep.md, 03:45** (mismo criterio, 26 días después, aplicado a Citas/Panel general): *"Como administrador y como optómetra cambia un poco la perspectiva... El administrador busca ver y controlar cómo se está dando todo, y el optómetra simplemente se centra en lo que él tiene que cumplir... las opciones no están como para que tengan más pertenencia con el rol."*

## 9. Flujos conectados end-to-end, nunca módulos aislados que se repiten entre sí

Citas, ficha clínica y venta son etapas de un mismo flujo y deben pasarse el contexto entre sí (una cita atendida debe abrir directo la ficha vinculada; un diagnóstico con lente recomendado debe ofrecer la venta como paso siguiente, no como acción aparte que hay que recordar hacer). Cuando dos pantallas hacen prácticamente lo mismo o deberían estar enlazadas y no lo están, es un defecto de integración, no una limitación aceptable.

- **ING9, 08:00-08:46** (Ficha clínica → Venta): al guardar el diagnóstico con lente recomendado, *"me sale... el modal 'Se detectó el registro de un lente sugerido. ¿Desea efectuar o gestionar la compra?'"* — el hand-off es automático, no un módulo aparte que hay que recordar abrir.
- **reunion-zoom-29sep.md, Video 1** (mismo criterio, 26 días después, aplicado a Citas → Ficha clínica): *"Lo que podríamos optimizar aquí es que la ficha clínica es directa pero no está vinculada a una cita. Tendríamos que tener aquí las citas del paciente actual (...) En resumen Diego, mejoremos la integración entre Citas y la atención directa del Paciente."*

---

## Cómo se usan estos criterios

Antes de revisar cualquier pantalla (la haya visto el ing o no), preguntar para cada uno de los 9 criterios: *¿esta pantalla lo cumple?* Si no, ¿qué cambiaría el ing y por qué, siguiendo la misma lógica que aplicó en los casos citados arriba? Ese es exactamente el ejercicio de `docs/feedback-ing/propuestas-por-criterios.md`, aplicado a los módulos que el ingeniero nunca recorrió pantalla por pantalla (Inventario, CRM/fidelización, Reportes, Configuración, Mensajes, portal del paciente) — con la salvedad de que son propuestas **extrapoladas**, no pedidos suyos, y quedan pendientes de su confirmación.
