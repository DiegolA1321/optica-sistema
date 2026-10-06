# Plan de prioridad 1: análisis de brechas (R1 a R45) y plan de implementación

Rama: `prioridad-1` (desde `main`, commit `b003a2d`). Este documento es solo análisis: no se modificó código ni datos.

Fuentes: `requisitos-reunion-29sep.md` (secciones 1, 2 y 3), `../vision-sistema.md` y las transcripciones en `docs/reunion-29sep/` (1.txt a 4.txt).

**Avance (tras los pasos 1, 2 y 3):** los totales de abajo ya descuentan lo construido; los requisitos resueltos llevan la nota "Resuelto" en su fila.

Leyenda: **Hecho** = cumple lo pedido. **Parcial** = existe una parte, falta otra. **Pendiente** = no existe. **Distinto** = existe, pero resuelve otra cosa de la que pidió el ingeniero.

Las rutas son relativas a `src/`. Las líneas corresponden a `b003a2d` y pueden moverse.

## Resumen

| Estado | Sección 1 Citas (R1-R19) | Sección 2 Atención (R20-R40) | Sección 3 Perfil (R41-R45) | Total |
|---|---|---|---|---|
| Hecho | 18 | 12 | 1 | **31** |
| Parcial | 0 | 4 | 2 | **6** |
| Pendiente | 0 | 4 | 0 | **4** |
| Hecho distinto | 1 | 1 | 2 | **4** |
| Total | 19 | 21 | 5 | **45** |

Lo que más pesa:
- Las dos grandes ausencias son el flujo **receta → "Listo para venta" → vendedora → orden de laboratorio** (R34-R37) y el **responsable de cada cita** (R12, R18). Ambos necesitan base de datos.
- Lo más visible para el ingeniero, y barato, es el **orden y la forma de la pantalla de Citas** (R1-R5): es lo primero que ve y no necesita base de datos.
- El calendario recién publicado (Semana y Mes) resolvió R7, R8, R10 y R11, y adelantó R9, R12 y R14. Las versiones de Semana y Mes no llegaron a la Lista ni al modal "Citas del día".

---

## 1. Citas médicas

| Req | Estado | Evidencia y detalle |
|---|---|---|
| R1 Orden de indicadores | **Hecho** (paso 1) | `paginas/Citas.jsx:1175-1178`: el orden es Total agendadas, Citas de hoy, Próximas, Ya atendidas. Pide "Hoy" primero y "Total" al final. | **Resuelto:** "Citas de hoy" va primero y "Total agendadas" al final (`Citas.jsx`, constante `indicadores`).
| R2 Indicadores que parezcan filtros | **Hecho** (paso 1) | Ya filtran (`KpiBoton`, `Citas.jsx:102`, con `aria-pressed` y anillo de color al estar activos). Siguen siendo tarjetas grandes con ícono y cifra (`Citas.jsx:1294`). Falta el aspecto de selector (chips o pestañas con el seleccionado marcado). | **Resuelto:** Los indicadores son chips con el seleccionado en relleno oscuro y la palabra "Ver" delante (`ChipFiltro`).
| R3 Bloque de filtros (estado, origen, primera vez/seguimiento) | **Hecho** (paso 1) | El único estado de filtro es `todas / hoy / proximas / atendidas` (`Citas.jsx:366`). No existe filtro por origen ni por primera vez/seguimiento. El origen solo es un ícono en la tarjeta (`Citas.jsx:190-196`). El filtro de primera vez se quitó (comentario en `Citas.jsx:374`). **Diferencia 1 confirmada.** | **Resuelto:** Bloque "Filtros" con Estado, Origen (Todos, Web, Recepción) y Visita (Todos, Primera vez, Seguimiento), en ese orden (`utilidades/filtrosCitas.js`).
| R4 Ver todas las atendidas, en curso, canceladas y vencidas | **Hecho** (paso 1) | "Ya atendidas" existe como indicador. "Anteriores" es una sección plegable (`Citas.jsx:1557`). Las canceladas solo tienen interruptor en Semana y Mes (`Citas.jsx:1418-1427`). No hay filtro "En curso", ni "Canceladas", ni "Vencidas" en la Lista. | **Resuelto:** El estado ofrece Todas, Pendientes, En atención, Atendidas, Canceladas y No asistió; atendidas, canceladas y no asistió se listan completas, de la más reciente a la más antigua, sin esconderlas en "Anteriores". Las canceladas también aparecen en Semana y Mes al elegir ese estado. **Cambio posterior (6 oct.):** el chip "Vencidas" se reemplazó por "No asistió", con el nombre de la insignia; "Vencidas" duplicaba a "No asistió" porque el cron marca las ausencias en menos de 15 minutos.
| R5 Buscador cerca de los filtros | **Hecho** (paso 1) | El buscador está en el encabezado, junto a "Gestionar cita" (`Citas.jsx:1264-1274`), y los filtros están más abajo (`Citas.jsx:1294`). Es lo que el ingeniero pidió corregir. | **Resuelto:** El buscador está dentro del bloque de filtros, en todas las vistas.
| R6 Redefinir "primera vez" | **Hecho** (paso 1) | Se quitó el filtro y se agregó "N por registrar" (`Citas.jsx:1432`, `porRegistrar` en `Citas.jsx:95`: cita sin paciente vinculado). La tarjeta aún muestra la etiqueta "Primera vez" cuando `!cita.pacienteId` (`Citas.jsx:181-183`). Eso no significa "primera vez del paciente", así que sigue siendo ambiguo. Falta definir primera vez como "paciente sin consultas previas". | **Resuelto:** "Primera vez" pasó a significar "el paciente no tenía atenciones anteriores" (`esPrimeraVez`, con tests); la etiqueta de la tarjeta ya no desaparece al atender o agendar otra cita, y la cita sin paciente vinculado dice "Por registrar".
| R7 Vista por día y mes, hoy marcado y botón Hoy | **Hecho** | Selector Lista/Semana/Mes (`Citas.jsx:1325-1345`), botón "Hoy" (`Citas.jsx:1318-1324`) y día actual resaltado en Mes (commit `e7865a1`). La Semana es extra y queda opcional. |
| R8 Filtro por rango de fechas | **Hecho** | Desde/Hasta con flechas semana anterior/siguiente (`Citas.jsx:1371-1412`, lógica en `Citas.jsx:1054-1058`). |
| R9 Calendario "por color" según carga | **Distinto** | Semana y Mes colorean por estado de la cita (`componentes/calendarioComun.js:7-17`). No hay mapa de calor por cantidad de citas por día para ver qué días tuvieron más o menos atención. |
| R10 Lo más próximo primero | **Hecho** | `Citas.jsx:1049-1063`: hoy en adelante, cronológico, y lo pasado queda plegado en "Anteriores". |
| R11 Clic en un día del mes abre modal con sus citas en una columna | **Hecho** | `diaModalMes`, `Citas.jsx:1543-1595`, tarjetas en `grid-cols-1`, agrupadas por estado. |
| R12 Modal con paciente, fecha de agendado, motivo, origen y responsable | **Hecho** (paso 3) | La tarjeta flotante de Semana (`componentes/CalendarioSemanal.jsx:90-124`) muestra paciente, contacto, motivo, origen y fecha/hora de la cita. **Falta la fecha en que se agendó**: `created_at` existe en la base, pero `mapCita` no lo trae (`App.jsx:162-176`). **Falta el responsable**: no existe el dato (ver sección de base de datos). En Lista y Mes no hay modal de detalle: las acciones están en la tarjeta. | **Resuelto:** El detalle muestra también "Asignado a" y "Atendido por" (migración 0083); la tarjeta de la lista dice quién atiende o atendió.
| R13 Botones "Ingresar" y "Cerrar" en ese modal | **Hecho** (paso 2) | Existen en el resumen previo a Atender (`ConfirmarCitaModal` desde `Citas.jsx:1885-1894`: "Cerrar" y "Ingresar a la ficha clínica"/"Atender hoy"). Ese resumen solo trae paciente, motivo, fecha y hora, y se abre al pulsar Atender, no al hacer clic en la cita. Falta unir los dos: clic en la cita muestra el detalle completo con Ingresar y Cerrar. | **Resuelto:** Hacer clic en una cita (el nombre o el cuerpo de la tarjeta) abre el detalle con "Ingresar" (a la ficha de esa cita, pasando por el resumen) y "Cerrar" (`componentes/DetalleCitaModal.jsx`).
| R14 "Ver perfil" sin perder el lugar | **Hecho** (paso 2) | En Semana abre pestaña nueva (`CalendarioSemanal.jsx:134-141`, `calendarioComun.js:24-30`, y `?paciente=` lo recibe `Pacientes.jsx`/`Dashboard.jsx`, commit `387d8e9`). En Lista y en el modal "Citas del día" sigue navegando dentro de la app (`Citas.jsx:210`, `Citas.jsx:1224`), que es lo que el ingeniero reportó como "te pierdes". | **Resuelto:** "Ver perfil" es un enlace que abre una pestaña nueva en la tarjeta de la Lista, en el modal "Citas del día" y en el detalle.
| R15 Quitar "Crear paciente" del menú de la cita | **Hecho** (paso 2) | Sigue en el menú Más acciones cuando la cita no tiene paciente (`Citas.jsx:2220-2230`) y también en el modal "Completar registro" (`Citas.jsx:1930`). Ojo: las citas web sin paciente vinculado todavía existen (`porRegistrar`); quitar la opción obliga a resolver cómo se enlazan (ver decisiones). | **Resuelto:** Se quitó "Crear paciente" del menú de la cita. La reserva web ya crea o vincula al paciente (migración 0067). "Completar registro" queda solo al pulsar Atender sobre una cita antigua sin paciente.
| R16 Estados automáticos; "No asistió" manual | **Hecho** | En atención al abrir la ficha (`ConsultaMedica.jsx:554-566`), Atendida al cobrar (`ConsultaMedica.jsx:313-320`), No asistió automático a los 10 min (migración 0076) y manual solo si ya pasó la hora (`Citas.jsx:2214`). Queda "Corregir estado (excepción)" dentro de Editar cita (`Citas.jsx:2140-2154`), que es una puerta de rescate, no un flujo normal. |
| R17 No eliminar: reagendar o cancelar conservando registro | **Hecho** | "Cancelar cita" conserva el registro (`Citas.jsx:2042`, 0078 guarda quién canceló). Reagendar desde Editar cita y arrastrando (`Citas.jsx:860-992`). El paciente reagenda desde su portal si la óptica lo habilita (`paginas/PortalPaciente.jsx:76-102`). Salvedad: eliminar un **paciente** borra sus citas (`Pacientes.jsx:625`); es otro caso (derecho de eliminación) y conviene confirmarlo con el ingeniero. |
| R18 Administrador filtra no atendidas y ve responsable | **Hecho** (paso 3) | No hay responsable por cita (ver base de datos), ni filtro por persona. Tampoco existe "No atendidas" como filtro. | **Resuelto:** El administrador filtra por "Asignada a" y "Atendida por" (una persona, o Nadie) junto con el estado, por ejemplo No asistió + una persona; el filtro solo aparece para el rol administrador.
| R19 Mi horario: ocupados/disponibles, y el administrador ve todo el personal | **Hecho** (paso 3) | El conteo "N ocupados · M disponibles" existe, pero para el horario general de la óptica (`paginas/Horario.jsx:1106`). El horario personal es solo propio (`Horario.jsx:429`, `MiHorarioPersonal`). El administrador no ve el de cada miembro ni quién está ocupado. | **Resuelto:** "Mi horario" muestra la semana con ocupados y disponibles (citas asignadas a esa persona). El administrador ve además "El equipo hoy" (quién está libre, con cita o en atención y cuánto le queda) y el horario semanal de cualquier miembro (migración 0084: función `equipo_optica()` y lectura de `horarios_usuario` para el administrador).

---

## 2. Atención: de la cita a la ficha clínica y a la venta

| Req | Estado | Evidencia y detalle |
|---|---|---|
| R20 Atender: resumen y luego ficha vinculada a la cita | **Hecho** | `atenderCita` (`Citas.jsx:748-773`) abre el resumen y entra a la ficha con `citaId`. La consulta guarda `cita_id` (migración 0079, `ConsultaMedica.jsx:694`). |
| R21 En atención automático y el administrador ve cuántas | **Parcial** | Automático: sí (`ConsultaMedica.jsx:554-566`). El contador "N en atención" existe solo en la tarjeta "Mi agenda" del optómetra (`paginas/Inicio.jsx:163,604`). No hay conteo para el administrador, ni actualización en tiempo real (no hay suscripciones Realtime en el proyecto). |
| R22 Confirmar o completar datos del paciente web | **Hecho** | `Citas.jsx:765-773` abre `ConfirmarDatosPacienteModal` cuando el origen es web y no se ha confirmado (`confirmadoRecepcion`, migración 0077). |
| R23 Atender hoy una cita de otro día, con fecha real | **Hecho** | `Citas.jsx:165` permite Atender en cualquier cita no cerrada; el botón dice "Atender hoy" (`Citas.jsx:1893`); la tarjeta muestra "Atendida el…" cuando la fecha real difiere (`Citas.jsx:170-175`, `fechaRealPorCitaId`). |
| R24 Paciente sin cita: atender desde Pacientes | **Hecho** | "Atenderlo ahora" al crear (`Pacientes.jsx:1566`) y botón "Ficha clínica" en el perfil (`Pacientes.jsx:1846`). |
| R25 Sin buscador si ya estoy en un paciente | **Hecho** | El buscador solo se renderiza con `!pacienteId` (`ConsultaMedica.jsx:1401`). |
| R26 Referencia de la cita que se atiende | **Hecho** | Barra de la visita: "Cita {hora} · motivo · fecha" (`ConsultaMedica.jsx:1139-1143`) y "Sin cita · consulta directa" en su defecto. |
| R27 Contexto primero | **Hecho** | Bloque de contexto arriba (última visita, tendencia, historial: `ConsultaMedica.jsx:1226-1262`) y antecedentes colapsables con la línea base visible (`ConsultaMedica.jsx:1264-1295`). |
| R28 No repetir bloques entre pasos | **Hecho** | Los antecedentes aparecen una sola vez, en el paso Anamnesis (revisado: ninguna otra aparición entre Refracción y Diagnóstico). |
| R29 Exámenes opcionales | **Hecho** | Refracción abre vacía, con las secciones "Opcional"/"Todo opcional · vacío significa no medido" y etiquetas Registrado/No registrado (`ConsultaMedica.jsx:1531-1710`, `:2458`). |
| R30 Motivo por categorías configurables + Otros con detalle | **Hecho** | Categorías en Configuración (`Configuracion.jsx:483`), "Otros" exige detalle (`ConsultaMedica.jsx:860`), y si la cita ya trae motivo no se vuelve a pedir (`ConsultaMedica.jsx:1459`). |
| R31 Diagnóstico por categoría + detalle, lente, imágenes, indicaciones, control | **Hecho** | `diagnosticoCategorias` (migración 0049), "Otro" exige detalle (`ConsultaMedica.jsx:877-880`), imágenes (0044). |
| R32 No "posponer": guardar y seguir, o "dejar de atender" | **Parcial** | No existe un botón "Dejar de atender" que descarte lo no guardado y deje la cita como estaba. Hay aviso de cambios sin guardar al cerrar pestaña (`ConsultaMedica.jsx:395-401`) y al cambiar de sección (vía `Dashboard.jsx`). La cita queda "En atención" si se abandona; no vuelve a Pendiente. |
| R33 "Terminar atención" genera la receta, no la factura | **Distinto** | Guardar la ficha abre el panel de cobro "Cobrar y finalizar" (`ConsultaMedica.jsx:2328-2344`). La receta se imprime después de guardar. El optómetra cierra con cobro, no con receta y paso a ventas. **Diferencia 2 confirmada.** |
| R34 "Pasar a la óptica" → "Listo para venta" | **Pendiente** | No existe el botón, ni el estado (búsqueda de "Listo para venta" sin resultados en `src/` y `supabase/`). |
| R35 La vendedora toma los datos del diagnóstico y arma la proforma | **Pendiente** | No hay cola de pacientes listos. Lo más cercano es "Cobro pendiente" (`Citas.jsx:285-289`) con las líneas precargadas desde la consulta (`lineasCobroConsulta`), que ve quien abre Citas o el perfil. No es una cola de ventas ni una proforma. |
| R36 Orden de laboratorio con factura y receta, dos copias | **Pendiente** | No existe el concepto: ninguna tabla, pantalla ni impresión de orden de laboratorio. |
| R37 Laboratorio marca "Completada", aviso al administrador | **Pendiente** | Depende de R36. |
| R38 Pagos al contado, cuotas o abonos | **Parcial** | `FacturaVentaModal.jsx:550-562`: directo, tarjeta y cuotas (con cuotas pagadas). No encontré abonos libres de monto variable; confirmar si "cuotas" cubre lo que el ingeniero llama abono. |
| R39 Cita "Atendida" al generar la factura total | **Hecho** | `marcarCitaAtendida` solo corre tras el cobro exitoso (`ConsultaMedica.jsx:313-326`) y lo mismo desde Citas (`alCobrarCita`). Es coherente con lo que pidió. La nota del documento (cobra el optómetra frente a la vendedora) se atiende en R33-R35. |
| R40 Quién consultó y no compró; embudo | **Parcial** | `Reportes.jsx` mide conversión consulta → venta (`:184`) y pacientes nuevos (`:116`), pero no hay vista "primera vez → se volvió cliente" ni separación entre paciente accesible y dato estadístico. |

---

## 3. Perfil del paciente

| Req | Estado | Evidencia y detalle |
|---|---|---|
| R41 "Productos y servicios" con tabla de transacciones | **Hecho** | Pestaña "Productos y servicios" (`Pacientes.jsx:2059-2078`), con tablas separadas de productos y servicios por línea (`Pacientes.jsx:1916-1941`). |
| R42 Separar controles clínicos de fidelización | **Parcial** | El estado de corrección y la tendencia viven en Historial (`Pacientes.jsx:2095-2130`). El **próximo control sigue repetido** en Fidelización (`Pacientes.jsx:2301-2318`), por decisión de Diego del 30 sept. y contra lo que dice R43. |
| R43 Fidelización: última visita, frecuente, referidos, cumpleaños con días | **Parcial** | Última visita, Cliente frecuente y Referidos existen (`Pacientes.jsx:2320-2340`). **Falta el cumpleaños con días restantes** (existe la lógica en `CRM.jsx:36`, no se muestra en el perfil). El próximo control repetido contradice la última frase de R43. |
| R44 "Enviar mensaje por CRM" aunque el automático esté apagado | **Distinto** | "Enviar mensaje" abre WhatsApp con un texto (`Pacientes.jsx:368-382`, `:1861`). No pasa por el CRM, así que no queda registrado en `mensajes` ni en el historial de contactos. |
| R45 Secciones Citas del paciente y Diagnósticos | **Distinto** | Existe una sola pestaña "Historial" con línea de tiempo que mezcla citas, consultas, facturas y ventas (`Pacientes.jsx:2548-2598`), y cada consulta se expande con la ficha completa (`:2644-2672`). El ingeniero propuso dos secciones: Citas (pendientes, próxima, historial, botón a la cita actual) y Diagnósticos (lista con motivo y diagnóstico, clic = ficha del día), con la tendencia arriba. **Diferencia 5 confirmada.** |

---

## Las seis diferencias del final del documento de requisitos

1. **Filtros de Citas (R3): cierta.** Solo existen `todas / hoy / proximas / atendidas` (`Citas.jsx:366`). Origen y primera vez ya no son filtros.
2. **Cobro (R33-R39): cierta.** Al guardar la ficha se abre el panel de cobro (`ConsultaMedica.jsx:2328`). No existe receta como cierre, ni paso a ventas, ni orden de laboratorio.
3. **Responsable de la cita (R12, R18): cierta.** `citas_base` no tiene columna de responsable (`0007_operativos_core.sql:97-110` y migraciones posteriores) y `mapCita` no lo expone (`App.jsx:162-176`). Matiz: `consultas` guarda `profesional_nombre` como texto (0022). Eso dice quién firmó la consulta, pero no cubre las citas no atendidas, que es lo que necesita el administrador.
4. **Roles (R46-R50): cierta, con una verificación superficial.** `Usuarios.jsx` maneja permisos por módulo (booleanos, `:78-90`) y la marca `esOptometra` (`:107`). No hay roles reutilizables ni niveles de permiso. Está fuera de las secciones 1 a 3.
5. **Perfil del paciente (R45): cierta.** Historial y Ficha clínica se unificaron en una línea de tiempo; no hay secciones Citas y Diagnósticos separadas.
6. **Inventario (R57-R59): cierta, con una verificación superficial.** El lente recomendado se vincula a un producto de inventario con stock (`ConsultaMedica.jsx:1980`, `lenteProductos` filtra por `stock > 0`). Está fuera de las secciones 1 a 3; se trata en el bloque E.

Una séptima observación, no listada en el documento: el calendario nuevo (Semana/Mes) y la Lista no comparten comportamiento (Ver perfil, detalle, filtros). Parte del plan consiste en unificarlos.

---

## Requisitos que necesitan cambios en la base de datos

Todas las tablas que se tocan (`citas`, `consultas`) son vistas sobre `citas_base` / `consultas_base` con cifrado (0043, 0055). Cada cambio implica recrear la vista y actualizar el mapper de `App.jsx`, porque una columna nueva es invisible hasta que se agrega a `mapCita` / `mapConsulta` (ya ocurrió con `origen` y `cancelada_por`). Si cambia la firma de una función RPC, hay que hacer `drop function` de la anterior y buscar todos sus llamadores.

| Cambio | Requisitos | Detalle |
|---|---|---|
| **Responsable de la cita** | R12, R18 | Dos columnas en `citas_base`: `asignado_a` (opcional al agendar) y `atendido_por` (automático al atender), ambas `uuid references perfiles(id)`. Con índice para filtrar por persona. Los datos antiguos quedan sin responsable (mostrar "Sin asignar"). |
| **Estado "Listo para venta"** | R34, R35, R39 | Mejor en `consultas_base` que en `citas`: la cita sigue su ciclo (Atendida al facturar, R39), y es la receta la que pasa a ventas. Por ejemplo `estado_venta text check (in ('sin_pasar','listo','vendido'))` y `pasada_a_optica_en timestamptz`. Evita ampliar el `check` de estados de cita (0059). |
| **Orden de laboratorio** | R36, R37 | Tabla nueva `ordenes_laboratorio`: `optica_id`, `consulta_id`, `factura_id`, número, detalle (montura, tipo de lente, filtros, receta en jsonb), `estado` (enviada / completada), `completada_en`. RLS por óptica y permiso. El aviso al administrador puede usar la tabla de notificaciones/mensajes que ya existe (0005), o un indicador en Inicio. |
| **Abonos libres** | R38 | Tabla de abonos de una venta o factura (monto, fecha, nota) y saldo derivado; las cuotas existentes se migran como abonos. |
| **Anonimización de pacientes** | R17, R40 | Función `anonimizar_paciente(id)` que limpia las copias de nombre, cédula, teléfono y correo en `pacientes`, `citas`, `consultas` y ventas, y conserva los registros. Posible columna `anonimizado_en`. Requiere revisar el cifrado de `pacientes_base`/`citas_base` (0043, 0055). |
| **Horario del personal visible al administrador** | R19 | Probablemente una política de lectura (RLS) para que el admin lea el horario personal de cada miembro. No verifiqué dónde se guarda `horarioPersonal`; revisar antes de decidir. |
| **Tiempo real de "en atención"** | R21 | Sin cambio de esquema: habilitar Realtime para `citas` y suscribirse en Inicio. Si no se quiere Realtime, bastaría con refrescar cada cierto tiempo. |

Sin cambios de base de datos: R1-R6, R7-R11, R13-R17, R32, R40, R41-R45. Solo código (R40 y R43 reutilizan datos existentes: `fecha_nacimiento`, conteo de consultas).

---

## Plan de implementación por pasos pequeños

Orden: primero lo que el ingeniero verá al abrir Citas, luego lo que rompe el flujo de atención, y al final lo que requiere más base de datos. Cada paso es un commit o una pequeña serie, con tests y recorrido en el navegador antes de mostrarlo. Los pasos 1 a 5 y 8 a 9 no tocan la base de datos.

| # | Paso | Requisitos | Se verá funcionando al terminar |
|---|---|---|---|
| 1 | **Indicadores y bloque de filtros de Citas** | R1, R2, R3, R4, R5, R6 | "Citas de hoy" va primero y "Total" al final, como chips seleccionables. Debajo, un bloque de filtros con estado (todas, en curso, atendidas, canceladas, vencidas), origen (web o recepción) y primera vez/seguimiento, con el buscador pegado a ellos. "Primera vez" pasa a significar "paciente sin consultas previas"; la etiqueta de "sin paciente vinculado" cambia a "Por registrar". Funciona igual en Lista y Mes. |
| 2 | **Detalle de la cita al hacer clic** | R12 (menos responsable), R13, R14, R15 | Un solo modal de detalle en Lista, Semana y Mes: paciente, fecha en que se agendó, motivo, origen, estado, con "Ingresar" y "Cerrar". "Ver perfil" siempre abre en pestaña nueva. Se quita "Crear paciente" del menú (o se resuelve el caso de la cita web sin paciente vinculado, ver decisiones). |
| 3 | **Responsable de la cita** | R12 (completo), R18, R19 | Migración con el responsable. Cada cita muestra "A cargo: nombre". El administrador filtra por persona y por "no atendidas" para ver quién estaba a cargo. En Mi horario, el administrador ve ocupados y disponibles de cada miembro. |
| 4 | **Calendario por intensidad** | R9 | Una opción "Carga" en la vista Mes que sombrea cada día según la cantidad de citas (más oscuro, más atención), con leyenda, para planificar. |
| 5 | **Dejar de atender y conteo en atención** | R21, R32 | En la ficha, "Dejar de atender" descarta lo no guardado y devuelve la cita a Pendiente, con confirmación. En Inicio, el administrador ve "N en atención ahora", actualizado solo. |
| 6 | **Fidelización y mensaje por CRM** | R42, R43, R44 | Fidelización con cumpleaños ("20 días para su cumpleaños"), sin el próximo control repetido. "Enviar mensaje" desde el perfil registra el envío en el CRM aunque los automáticos estén apagados. |
| 7 | **Citas y Diagnósticos en el perfil** | R45 | El perfil tiene sección **Citas** (pendientes, próxima, historial, botón a la cita actual) y sección **Diagnósticos** (lista con motivo y diagnóstico, clic abre la ficha completa de ese día), con la tendencia de graduación arriba. La línea de tiempo completa puede conservarse como vista secundaria. |
| 8 | **Terminar atención con receta y "Pasar a la óptica"** | R33, R34 | Migración de estado de venta. El botón final de la ficha es "Terminar atención": genera la receta y deja al paciente "Listo para venta". El cobro inmediato queda como opción para quien tenga permiso de ventas (ver decisiones). |
| 9 | **Cola de ventas y proforma** | R35, R39 | La vendedora ve la lista "Listo para venta", busca al paciente, pulsa "Tomar datos del diagnóstico" y obtiene la proforma con lo recetado. Al facturar, la cita pasa a "Atendida". |
| 10 | **Orden de laboratorio** | R36, R37 | Migración de órdenes. Al registrar la venta se genera la orden con número de factura, montura, tipo de lente, filtros y receta, con dos impresiones (paciente y laboratorio). El laboratorio la marca "Completada" y el administrador recibe el aviso para llamar al paciente. |
| 11 | **Abonos libres y embudo** | R38, R40 | Abonos con monto y fecha libres hasta completar el total, con el saldo pendiente visible en la venta y en el perfil; las cuotas son un caso de abonos. En Reportes, el embudo consultaron → compraron → volvieron, separando pacientes identificables de datos estadísticos. |
| 12 | **Anonimizar al eliminar un paciente** | R17, R40 | Eliminar un paciente borra sus datos personales (nombre, cédula, teléfono, correo) y deja sus citas, consultas y ventas sin identificarlo; los reportes y el embudo siguen contando esas visitas. Una sola función en la base, usada también por la solicitud de eliminación del portal. |

Los pasos 8 a 10 forman el flujo grande que pidió el ingeniero (receta → venta → laboratorio) y se pueden mostrar como un recorrido completo al terminar el 10.

---

## Decisiones tomadas (Diego, tras revisar el plan)

1. **R15, el paciente se crea al agendar.** Al reservar por la web se crea la ficha del paciente, o se vincula la existente si la cédula ya está registrada; queda pendiente de confirmar (`confirmado_recepcion = false`) y recepción la confirma al atender (R22). Se quita "Crear paciente" del menú de la cita.
   - **Verificado en código y en la base: la función de reserva pública ya hace esto, no requiere SQL nuevo.** `crear_cita_publica` (migración 0067) busca por `(optica_id, cedula)`, reutiliza al paciente o lo crea con `origen = 'paciente'`, y la cita siempre queda con `paciente_id`. El paciente nuevo nace con `confirmado_recepcion = false` (columna de 0077; el trigger solo lo pone en `true` para `origen = 'staff'`). Hay una sola firma de la función en la base (sin sobrecargas duplicadas).
   - Solo existen 3 citas sin paciente vinculado, todas antiguas (agendadas antes de 0067) y ya cerradas (2 Atendida, 1 No asistió), así que "N por registrar" hoy vale 0.
   - Decisión sobre un paciente conocido: **no se reconfirma**, mantiene su estado. La función actual ya se comporta así; no hay cambio que hacer.
   - Lo que sí se hace es solo código: quitar la opción del menú (paso 2). Se conserva el modal "Completar registro" al pulsar Atender como red de seguridad para las citas antiguas sin paciente.
2. **Quién cobra.** El optómetra cierra la atención con la receta y "Pasar a la óptica". Quien tenga permiso de ventas cobra; si es la misma persona, puede cobrar de inmediato en el mismo momento (pasos 8 y 9).
3. **Próximo control.** Se quita de la pestaña Fidelización, porque ya está en el historial clínico, y se muestra en la **cabecera del perfil del paciente, junto a sus alertas** (paso 6; hoy está en la tira de resumen del perfil).
4. **Responsable de la cita (paso 3): dos datos.**
   - **Asignado a**: opcional al agendar (quién debería atender).
   - **Atendido por**: se registra automáticamente al atender (quien abre la ficha de esa cita).
   - El administrador puede filtrar por ambos (R18). Migración: dos columnas en `citas_base` (`asignado_a`, `atendido_por`, ambas `uuid references perfiles(id)`), expuestas por la vista `citas` y por `mapCita`.

5. **Eliminar un paciente anonimiza, no borra (R17, R40).** Se eliminan sus datos personales (nombre, cédula, teléfono, correo y dirección) y se conservan sus citas, consultas y ventas sin identificarlo, para las estadísticas. Paso propio, el 12 del plan. Hallazgos para ese paso:
   - Hoy `Pacientes.jsx:625` borra las citas del paciente.
   - **No existe un campo de dirección** en `pacientes`; no hay nada que borrar ahí.
   - Los datos personales están **copiados** en otras tablas: `citas` (paciente, cédula, teléfono, correo) y `consultas` / ventas / facturas (nombre del paciente). La anonimización debe limpiar también esas copias, no solo `pacientes`.
   - La solicitud de eliminación del portal y el borrado manual deben llevar al mismo procedimiento, que conviene hacer como función en la base (una sola transacción) y no desde el navegador.
6. **Abonos libres (R38).** Se implementan abonos con monto y fecha libres hasta completar el total, con el saldo pendiente visible. Las cuotas pasan a ser un caso de abonos (un plan de N abonos iguales). Paso 11 del plan; requiere tabla de abonos.

7. **Usuarios del personal: se desactivan, no se eliminan (para el Bloque D).** Para no perder el historial de "Asignado a" y "Atendido por". Hoy eliminar un usuario borraría ese dato de sus citas (`on delete set null` en 0083), y además cascada con `auth.users`. Cuando el personal se desactive: el selector "Asignado a" **no debe mostrar a los desactivados**, pero el nombre de quien atendió o estaba asignado **debe seguir visible en las citas antiguas** (por eso `equipo_optica()` deberá devolver también a los desactivados, con una marca, para resolver nombres, y el selector los filtra). En el Bloque D: reemplazar "Eliminar usuario" por "Desactivar" (sin acceso, con su nombre conservado en las citas y en los reportes) y reactivar.
8. **Filtro de estado.** "Vencidas" se reemplaza por "No asistió" (hecho, R4).

## Pendientes fuera de este bloque

- **Error 401 de `opticas_publicas` al abrir la app.** La consola muestra `GET /rest/v1/opticas_publicas?...&id=eq.<id>` con 401 al cargar, incluso con la sesión iniciada. Ya aparecía antes de los pasos 1 y 2. No bloquea nada visible, pero hay que revisar los permisos de esa vista/tabla para la sesión autenticada antes de la presentación. (Detectado el 6 de octubre; no se trabaja en el bloque de prioridad 1.)
