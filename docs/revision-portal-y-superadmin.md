# Revisión del portal del paciente, las páginas públicas y el panel del superadmin (9 oct 2026)

Revisión hecha **leyendo el código** (`PortalPaciente.jsx`, `Login.jsx` —la página pública de cada óptica y su ventana de inicio de sesión—, `AgendarCitaPublica.jsx`, `PaginaVenta.jsx`, `ConfirmarCita.jsx`, `EncuestaSatisfaccion.jsx`, `SuperadminPanel.jsx` y las utilidades que usan) y **mirando en localhost** las páginas públicas (Óptica Demo, sin iniciar sesión) y el panel del superadmin (con una sesión real, solo leyendo). Se comparó con el sistema del personal (Citas, Inicio y el perfil del paciente) y con las 28 reglas de `docs/principios-diseno.md`.

**Estado: pendiente de implementar, después de Ventas, salvo dos puntos que se corrigieron antes porque afectan al sistema publicado (P1 y S4, ver "Ya corregido"). Nada se ha publicado.**
**No verificado en pantalla:**
- El portal con datos reales (solo se vio el código y la pantalla "Mis datos" que se probó el mismo día). Los hallazgos del portal marcados como "por código" hay que confirmarlos con un paciente real en la óptica de pruebas.
- Las páginas con la óptica vacía (`3pldf1`), con muchos datos, en celular (375 px) y en otra zona horaria (regla 19).
- Una óptica suspendida o un enlace con una óptica que no existe.
- Las páginas legales, de error, de confirmar asistencia y de encuesta (solo código).

## Cómo se comparó la apariencia

Base del sistema del personal: menú lateral **claro**, tarjetas con esquinas `rounded-2xl` y borde suave, títulos de página en serif **sin cursiva**, el color de la marca (cian→azul) para lo seleccionado y la acción principal, estados de cita con un solo color cada uno (regla 14), fechas "8 oct 2026" y horas en 12 h desde `formatoFecha.js`, aviso flotante al guardar, esqueletos al cargar, y "ningún vacío sin mensaje y acción".

## Decisiones de Diego (9 oct 2026)

1. **Menú del portal: claro**, como el del sistema del personal (con el logo y el acento de la óptica). Aplica al punto P9.
2. **Páginas públicas: barra y contenido claros y coherentes con el sistema; el pie puede quedar oscuro.** Se decide con una maqueta al implementar. Aplica a W4 (y a la ventana de inicio de sesión).
3. **Recuperación de contraseña del paciente:** por ahora la hace el personal desde "Cuenta Portal" (Restablecer clave). El portal y la ventana de inicio de sesión muestran **"¿Olvidaste tu contraseña? Comunícate con la óptica"**. La recuperación por correo, cuando exista el dominio propio. Aplica a P7.
4. **Órdenes y saldos (P3):** el paciente ve el **estado de sus órdenes y la fecha estimada de entrega**, y **cuánto debe y cuánto ha abonado**. **No ve el laboratorio ni los costos internos.**
5. **Estados de cita en el portal:** los mismos colores y nombres que el sistema (P2). Si eso cambia algo visible en Citas, se muestra antes de dejarlo (regla 27).

**Siguen abiertas (para cuando se implemente):** el orden de los puntos (propuesta: P1 a P4 y S1 a S3 primero); el color de la impersonación (S3); la función de la base para las órdenes y los saldos del portal (P3) requiere migración con el protocolo de siempre.

## Ya corregido (no esperó, afecta al sistema publicado)

- **P1 — Reagendar y cancelar (corregido, commit `7fac0a7`).** Se agregó `minutosHastaCita` (`agendaCitas.js`, con prueba unitaria) que usa las funciones únicas del sistema y la hora de Ecuador; el portal ya no arma una fecha con texto. Si la política lo permite pero faltan menos horas de las pedidas, la cita dice "Faltan menos de 2 horas: para cambiarla, comunícate con la óptica." Probado en el navegador con un paciente de la óptica de pruebas: se ven los botones solo donde corresponde, se reagendó y se canceló una cita, y el servidor sigue rechazando un día cerrado ("Ese día la óptica no atiende") y una hora fuera del horario (reglas de la 0103). Nota: el mínimo de horas de anticipación solo lo aplica la pantalla; el servidor valida el horario, pero no esa anticipación.
- **S4 — Entrar como administrador (corregido en el código, commit `5c0e37d`; falta aplicar la migración `0105`).** Corrección a esta revisión: la **entrada ya quedaba** en la actividad de la propia óptica ("Entró como administrador de la óptica"); lo que no existía era la salida ni el registro en el panel "Actividad" del superadmin. Ahora entrada y salida —también al recargar la página estando dentro y al cerrar la sesión estando dentro— quedan en la actividad de la óptica y en la del superadmin (quién, qué óptica, cuándo). La del superadmin necesitaba `0105_auditoria_entrar_como_optica.sql` (amplía las acciones permitidas de `auditoria`): **aplicada el 9 oct** (backup `pre-0105-0106-auditoria-y-anticipacion-2026-10-09.dump`) y verificada: entradas y salidas aparecen en «Actividad» con quién, óptica y cuándo.

---

# 1. Portal del paciente y páginas públicas

## Qué se puede hacer hoy y qué falta (portal del paciente)

| Función | Hoy | Comentario |
|---|---|---|
| Ver sus citas (pendientes y pasadas) | Sí | Sin detalle de la cita (P10) |
| Pedir una cita | Sí | Comparte el selector de fecha y hora con el sistema |
| Reagendar o cancelar | **Existe pero no aparece nunca** | P1 |
| Ver su receta y los lentes recomendados | Sí | La última completa; las anteriores solo con el diagnóstico |
| Imprimir su receta | Sí | Imprime la pantalla; no tiene el membrete de la óptica |
| Ver su próximo control | **No** | P3. El personal sí lo calcula (`fechaProximoControl`) |
| Ver sus órdenes de laboratorio y su estado | **No** | P3. No hay función en la base para el portal |
| Ver sus saldos y abonos | **No** | P3 |
| Los mismos estados de cita que Citas | **No** | "En espera" se ve como "Pendiente"; colores distintos (P2) |
| Editar su teléfono y su correo | Sí (nuevo, 9 oct) | Nombre, cédula y nacimiento solo los cambia la óptica |
| Cambiar su contraseña | Sí | |
| Recuperar la contraseña si la olvidó | **No** | P7 |
| Descargar sus datos | **No** (la función `exportar_mis_datos_paciente` existe en la base) | P8 |
| Solicitar la eliminación de la cuenta | Sí | Derecho del paciente; se conserva al final de "Mis datos" |
| Solicitar sus medidas completas | Sí | |
| Confirmar asistencia / encuesta | Solo por el enlace del correo | P13 |

## Alta

### P1. Reagendar y cancelar no aparecen nunca — CORREGIDO (7fac0a7)
- **Reglas:** 15 (no ofrecer lo que no se puede, y si no se puede, decir por qué), 12 (horas desde una sola función), 16.
- **Qué pasa (por código):** `puedeReagendar` (`PortalPaciente.jsx:106`) arma `new Date("2026-11-06T09:40 AM:00")`. Las citas guardan la hora en 12 h ("09:40 AM"), así que la fecha sale inválida y la función devuelve `false` siempre. Se comprobó evaluando esa expresión con una hora "09:40 AM". Resultado: aunque la óptica active "permitir reagendar", el paciente nunca ve **Reagendar** ni **Cancelar**, y el aviso "Puedes cambiar el horario o cancelarla…" promete algo que no se puede hacer. Además, cuando la política está apagada o faltan menos horas de las permitidas, los botones desaparecen sin decir por qué.
- **Propuesta:** calcular con `minutosDesdeMedianoche`/`yaPasoLaHora` y `ahoraEcuador()` (una sola función, la misma que valida el servidor en `reagendar_cita_publica`); decir "Puedes cambiarla hasta 2 horas antes" cuando se puede y "Faltan menos de 2 horas: llama a la óptica al 09…" cuando no. Agregar una prueba con horas "AM" y "PM". Verificar con un paciente real en la óptica de pruebas.

### P2. Los estados de la cita no son los del sistema
- **Reglas:** 13, 14 (el color significa lo mismo en todo el sistema), 2.
- **Qué pasa:** el portal pinta **Pendiente en verde** (en el sistema es naranja) y **Atendida en gris** (en el sistema es verde). Cualquier cita que no sea Atendida, No asistió o Cancelada cae en "Pendiente", así que **"En espera" no existe** para el paciente (el que ya llegó y espera sigue viendo "Pendiente"). "En atención" se llama "Te están atendiendo" y usa otro estilo. El badge de estado está escrito tres veces: en el portal, en `Pacientes.jsx` (`BadgeEstadoCita`) y en `DetalleCitaModal.jsx` (`BADGE_ESTADO`).
- **Propuesta:** un solo componente de estado con los colores de siempre y un texto para el paciente por estado ("Pendiente", "Ya llegaste: te llamarán", "Te están atendiendo", "Atendida", "No asististe", "Cancelada"). **Toca Citas y el perfil** (regla 27): hay que avisar y esperar aprobación.

### P3. Faltan las cosas que el paciente más pregunta — DECIDIDO: estado y fecha estimada de entrega de las órdenes, y saldo y abonos; sin laboratorio ni costos internos
- **Reglas:** 10 (diseñar desde el flujo de quien lo usa), 21 (un mismo hecho se avisa igual en todas las pantallas que lo muestran).
- **Qué pasa:** el paciente no puede ver (a) **cuándo debe volver a control** (el personal ve "Control recomendado" y la cita agendada; el portal no), (b) **el estado de sus lentes** (las órdenes de laboratorio existen y el personal las ve, pero el portal no tiene ninguna función para consultarlas; el aviso "tus lentes están listos" solo sale por mensaje del personal), (c) **cuánto debe y qué abonó** (hay comprobantes y abonos, y el portal no los consulta), ni (d) **lo que se hizo en cada visita**: "Recetas anteriores" solo lista fecha y diagnóstico.
- **Propuesta:** en Resumen, un bloque "Tu control" con los dos datos que ya tiene el personal (fecha recomendada y cita agendada, con los mismos nombres); una sección "Mis pedidos" con el estado de cada orden ("En el laboratorio", "Lista para entrega", "Entregada") y otra "Mis pagos" con saldo y abonos; y el detalle de cada visita pasada en solo lectura. Requiere dos funciones nuevas en la base con el mismo token de sesión que las demás (migración con el protocolo de siempre) y respetar la política de las medidas. **Decisión 4.**

### P4. Lo mismo se dice cuatro veces y un número no abre nada
- **Reglas:** 3 (no repetir), 24 (cada indicador en un solo lugar), 5 y 23 (el número coincide con la lista y las canceladas no cuentan).
- **Qué pasa:** en Resumen, la próxima cita aparece en la frase de bienvenida ("Tu próxima cita es…"), en la tarjeta "Próxima visita", en el recuadro "Próxima cita" del menú lateral y en la lista "Próximas citas". La tarjeta "Total de citas" cuenta también las canceladas y no lleva a ninguna lista. Hay dos caminos para pedir cita (el botón "Pedir cita" de la cabecera y el texto "Agenda una cita").
- **Propuesta:** dejar la frase de bienvenida y la lista de próximas citas; quitar las tarjetas "Próxima visita" y "Total de citas" (o que "Total" cuente solo las activas y abra la lista) y el recuadro del menú. Un solo "Pedir cita".

### P5. Listas vacías sin salida y enlaces a nada
- **Reglas:** 17, 26.
- **Qué pasa:** "Ver todas" y "Ver receta" aparecen aunque no haya citas ni receta; "No tienes citas pendientes." y "Aún no tienes una receta registrada." son texto suelto, sin botón. La frase de arriba ya dice "¿Quieres agendar una?" y debajo vuelve a decirlo la lista.
- **Propuesta:** un solo mensaje con su acción ("Pedir cita"), y ocultar "Ver todas"/"Ver receta" cuando no hay nada que ver. Para la receta: "Aparece después de tu primer examen visual."

### P6. Fechas y horas no salen de la función única
- **Regla:** 12.
- **Qué pasa:** "Recetas anteriores" muestra la fecha cruda `2026-09-26` en letra monoespaciada; la fecha de nacimiento en "Mis datos" sale como "15 de mayo de 1990" (formato largo; el sistema usa "15 may 1990"); `etiquetaFecha` devuelve "Viernes, 6 de noviembre" **sin año**, así que una cita del año siguiente se lee igual que una de este año; la hora del reagendar se arma con `new Date()` (P1).
- **Propuesta:** `fechaLegible`/`formatoFecha` en todo el portal, con año cuando no es el actual; "Hoy" y "Mañana" se mantienen.

### P7. No hay forma de recuperar la contraseña — DECIDIDO: mensaje "Comunícate con la óptica" y la hace el personal
- **Reglas:** 10, 15.
- **Qué pasa:** ni la ventana de inicio de sesión ni el portal tienen "Olvidé mi contraseña". El personal puede "Restablecer clave" desde el perfil, pero el paciente que olvidó la suya solo puede llamar. (El paciente entra con la cédula, no con el correo.)
- **Propuesta:** botón "Olvidé mi contraseña" que pide la cédula y avisa al personal (aviso en el perfil y la campanita, con "Restablecer clave" a un clic), o que envía un enlace al correo registrado. **Decisión 3.**

### P8. No puede descargar sus datos
- **Reglas:** 17 y la ley de protección de datos (portabilidad, junto con la eliminación que ya existe).
- **Qué pasa:** la función `exportar_mis_datos_paciente` existe en la base y un comentario del portal promete "exportar (autoservicio)", pero la pantalla no la usa: solo hay "Solicitar eliminación".
- **Propuesta:** botón "Descargar mis datos" en "Privacidad y tus datos", antes de "Eliminar mi cuenta".

### W1. La página de la óptica tiene cuatro caminos para iniciar sesión y dos botones principales
- **Reglas:** 3 y 8 (un solo camino por acción; se borra uno, no se cambia el texto — lo que Diego ya pidió con los botones repetidos de la página de venta).
- **Qué pasa:** "Iniciar sesión" aparece en la barra, como "¿Ya tienes cuenta? Inicia sesión" bajo el botón principal, en "Enlaces" del pie y como la etiqueta "Portal del paciente". Además de "Solicita tu cita ahora" hay un segundo botón grande, "Conoce nuestros servicios", y los mismos "Servicios" y "Cómo funciona" en el pie.
- **Propuesta:** barra con Servicios · Cómo funciona · Iniciar sesión; un solo botón principal (Solicitar cita); se quitan el enlace bajo el botón y el de "Enlaces".

### W2. Textos que no son del paciente ni de Ecuador
- **Regla:** 2 (un concepto, un nombre).
- **Qué pasa:** la barra dice **"SALUD VISUAL & CRM"** ("CRM" es jerga interna) y el pie, "SALUD VISUAL & OPTOMETRÍA". En el pie, sin horario cargado, dice "**Consultá** disponibilidad…" (voseo). El estado del día usa dos textos para lo mismo: "Cerrado hoy" y "Cerrado por hoy" (`disponibilidad.js:112` y `:121`).
- **Propuesta:** subtítulo "Salud visual & optometría" en la barra y el pie; "Consulta la disponibilidad al reservar tu cita"; un solo texto: "Cerrado hoy".

### W3. La vista previa de la reserva dice otra cosa que la página
- **Reglas:** 12 (horas en 12 h) y 21 (un mismo hecho dicho igual).
- **Qué pasa:** el chip del primer bloque dice "Cerrado por hoy", pero la maqueta de "Tu cita en tres pasos" muestra "Disponible hoy", días 12 a 16 y horas "08:30 · 09:15 · 10:00" sin AM/PM, todo escrito a mano.
- **Propuesta:** que la maqueta se vea claramente como ejemplo (con la palabra "Ejemplo") o que use la disponibilidad real de la óptica, que la página ya tiene cargada, con horas en 12 h.

## Media

### P9. El portal no se ve como el sistema del personal
- **Reglas:** 14 y coherencia; guía del proyecto (no usar `transition-all` en código nuevo).
- **Qué pasa:** menú lateral oscuro con degradado y círculos decorativos (el del personal es claro); tarjetas `rounded-3xl` (el sistema usa `rounded-2xl`); saludo en serif cursiva grande; destellos desenfocados detrás de las tarjetas; íconos en cuadros pastel de colores propios (índigo, dorado); sombras más fuertes; los botones suben al pasar el cursor (`hover:-translate-y`) y varios usan `transition-all`. Los textos de página usan serif en negrita (como el personal) pero el saludo es cursiva.
- **Propuesta:** **Decisión 1.** Menú claro con el logo y el acento de la óptica, `rounded-2xl`, sin destellos, sin cursiva, transiciones acotadas, y los componentes que ya existen (tarjeta de estado, aviso flotante).

### P10. La cita no tiene detalle
- **Regla:** 9 (la fila dice lo mínimo; lo demás, un clic más allá).
- **Qué pasa:** cada fila muestra motivo, fecha, hora y estado, más los botones de reagendar/cancelar (cuando funcionen). No se ve el profesional, el código de la cita, ni qué hacer ("llega 10 minutos antes").
- **Propuesta:** al tocar la fila, una ventana con la cita (código, profesional, motivo, estado explicado y las acciones), con el mismo estilo de "Detalle de la cita" del personal.

### P11. La pantalla "Mis datos" (nueva) debe ajustarse a las mismas reglas
- **Reglas:** 12, 16.
- **Qué pasa:** la fecha de nacimiento y "Paciente desde" salen en formato largo (ver P6); el aviso de guardado desaparece solo a los 6 segundos sin posibilidad de verlo de nuevo.
- **Propuesta:** `fechaLegible`; aviso flotante igual al del resto del sistema.

### P12. El paciente no se entera de nada dentro del portal
- **Reglas:** 21, 22.
- **Qué pasa:** no hay avisos dentro del portal (tus lentes están listos, tu control vence, tu cita cambió). Todo depende del correo o del mensaje del personal.
- **Propuesta:** un bloque "Avisos" en Resumen con lo que ya tiene el sistema (orden lista, control próximo, cita confirmada o cambiada) y la misma acción de siempre.

### P13. Confirmar asistencia y la encuesta viven aparte
- **Reglas:** 8, 18.
- **Qué pasa:** `ConfirmarCita.jsx` y `EncuestaSatisfaccion.jsx` son páginas sueltas con su propio aspecto; la próxima cita en el portal no tiene "Confirmar asistencia".
- **Propuesta:** botón "Confirmar asistencia" en la próxima cita (la base ya guarda `confirmada_at`) y la encuesta como ventana del portal; las páginas sueltas quedan solo como destino del enlace del correo.

### W4. Franjas oscuras en las páginas públicas
- **Regla:** decisión de Diego (heroes claros, `PORCELAIN`) y 14.
- **Qué pasa:** la barra superior, la franja "Preguntas frecuentes", el pie y la cabecera de la ventana de inicio de sesión son oscuros (`INK`) o con degradado oscuro; el bloque central de la página ya está en claro. El propio código dice que la franja de preguntas frecuentes tiene "el mismo acento oscuro … vetado".
- **Propuesta:** **Decisión 2.** Barra y ventana de inicio de sesión en claro; la franja de preguntas, en claro con el mismo estilo de las tarjetas de servicios; el pie puede seguir oscuro.

### W5. La reserva permite una cita sin ninguna forma de contacto
- **Regla:** 15 (evitar el error en vez de avisarlo).
- **Qué pasa:** el subtítulo dice "con tu nombre y teléfono basta", pero teléfono y correo son opcionales. Una cita sin ninguno no recibe recordatorio y no se le puede avisar si la óptica cierra ese día o cambia la hora.
- **Propuesta:** pedir al menos uno de los dos (teléfono o correo), con el mismo formato que valida el personal.

### W6. La confirmación de la reserva no dice cómo cambiarla
- **Reglas:** 10, 16.
- **Qué pasa:** "¡Tu cita está reservada!" muestra el código, pero no dice cómo cambiar o cancelar la cita si no tiene cuenta, ni da el teléfono de la óptica, ni "agregar al calendario".
- **Propuesta:** el teléfono y el correo de la óptica, el enlace al portal ("Activa tu cuenta para reagendar") y un "Agregar al calendario".

### W7. La página de venta del sistema usa estados y fechas de mentira
- **Reglas:** 12, 14.
- **Qué pasa:** la agenda de ejemplo dice "Miércoles 26 de agosto" (fecha escrita a mano) y marca las citas con etiquetas de colores propios (verde azulado, azul y dorado: "Medición", "Compra de lentes", "Consulta") que no son los estados del sistema. Los botones principales dicen "Obtener sistema", "Ver cómo funciona" y "Solicitar mi plan".
- **Propuesta:** la fecha del día y los estados reales (Pendiente, En espera, Atendida) con sus colores; un solo texto para el botón de contacto.

## Baja

### W8. Accesibilidad
- **Qué pasa:** la reserva (`AgendarCitaPublica.jsx`) no tiene ningún `aria-label` y depende de los marcadores de posición; el portal tiene 13. No se probó el teclado ni el foco.
- **Propuesta:** pasar la skill `web-design-guidelines` por estas pantallas antes de darlas por terminadas.

### W9. Esqueletos de carga
- **Qué pasa:** el portal y las páginas públicas no tienen esqueletos de carga (0 usos en el código); la guía del proyecto prohíbe mostrar pantallas vacías mientras se piden los datos. El inicio de sesión sí avisa "Estamos cargando los datos de la óptica".
- **Propuesta:** esqueletos en Resumen, Mis citas y Mi receta del portal, y en la lista de servicios y horario de la página pública.

---

# 2. Panel del superadmin

## Qué se puede hacer hoy y qué falta

| Función | Hoy | Comentario |
|---|---|---|
| Crear una óptica (con su administrador, dirección propia y datos de acceso) | Sí | Los roles predefinidos se crean solos al crear la óptica (disparador de `0090`) |
| Regla de contraseñas | Sí | Usa la misma `validarClaveNueva` que el sistema (8 caracteres, letra y número) al crear la óptica, otro administrador y otro superadmin |
| Editar nombre, personalización del login, administradores | Sí | |
| Administrar los roles de una óptica | **Casi nada** | Solo se activa "también atiende" (rol Optómetra). No se ven los roles ni se pueden restaurar (S2) |
| Suspender y reactivar | Sí | Con confirmación; sin motivo ni aviso al administrador (S7) |
| Ver el uso de cada óptica | **Parcial** | Solo asistentes y pacientes (S1) |
| Suscripción y facturas | Sí | Monto, vencimiento, estado y lista de facturas; el guardado es invisible (S8) |
| Mensajes de soporte y avisos | Sí | Llamado "CRM" (S5) |
| Entrar como administrador (impersonación) | Sí | Desde el detalle y desde el menú de la lista; color violeta (S3) |
| Registro de actividad | **Parcial** | Solo las acciones del superadmin; la entrada a una óptica no se registra (S4) |
| Leads de la página de venta | Sí | |
| Agregar y quitar superadmins | Sí | |

## Alta

### S1. No se puede ver cuánto usa cada óptica el sistema
- **Reglas:** 2 y 5 (un concepto, un nombre; el número coincide con lo que se ve).
- **Qué pasa:** el detalle de una óptica solo muestra "Asistentes 3" y "Pacientes 41". No hay citas del mes, consultas, ventas, último ingreso del administrador ni si la óptica dejó de usarlo. En Resumen hay dos tarjetas con el mismo número y dos nombres: "Pacientes 65" y "Pacientes atendidos en la red 65" (atendidos no es lo mismo que registrados), y "Volumen de consultas generadas — fichas clínicas registradas, toda la red".
- **Propuesta:** una tabla "Uso" en el detalle de cada óptica y en la lista (pacientes, citas del mes, consultas del mes, ventas del mes, último ingreso del administrador), calculada con las mismas funciones que Reportes. Un solo "Pacientes" en Resumen y los nombres en palabras del usuario ("Consultas registradas").

### S2. Los roles de una óptica no se ven ni se restauran
- **Reglas:** 7, 18.
- **Qué pasa:** al crear la óptica la base crea los roles predefinidos (`crear_roles_predefinidos`). Si el administrador los borra o cambia, el superadmin no puede verlo ni devolverlos a su estado original: lo único que toca de roles es el botón "también atiende".
- **Propuesta:** en el detalle, una sección "Roles" con la lista y sus permisos (solo lectura) y "Restaurar los predefinidos" (llama a la función que ya existe), con confirmación.

### S3. El violeta de "Entrar como administrador" es el color de "En espera"
- **Reglas:** 14 (un color nuevo se define en un solo lugar y se usa para una sola cosa).
- **Qué pasa:** el botón del detalle y de la lista, y la franja que se ve dentro de la óptica, son violeta. En Citas, el violeta es "En espera".
- **Propuesta:** **Decisión de Diego** sobre el color. Un tono que no sea de estado (por ejemplo, el azul oscuro de la marca con un ícono de ojo) para todo lo de impersonación.

### S4. El registro de actividad no cubre lo que más importa — entrar/salir CORREGIDO en el código (5c0e37d), migración 0105 aplicada el 9 oct y verificada en «Actividad»
- **Reglas:** 16 (lo que se hace queda en la actividad).
- **Qué pasa:** "Actividad" lista las acciones del superadmin (crear y suspender ópticas, avisos, altas y bajas de superadmins). La franja de impersonación dice "cualquier acción queda registrada", pero **por código entrar a una óptica no deja ningún registro** (las acciones que se registran son: crear óptica, renombrar, suspender y reactivar, agregar y quitar administradores, crear y quitar superadmins, actualizar pago, generar factura, publicar aviso y responder mensaje; no hay "entrar como"), y lo que se hace adentro queda como acción del administrador. No se probó en pantalla. Los encabezados de día salen "Lunes, 5 De Octubre" y "Sábado, 12 De Septiembre": mayúscula en "De" y mes completo, y el sistema usa "5 oct 2026" (regla 12).
- **Propuesta:** registrar la entrada y la salida de cada impersonación, con la óptica, y que las acciones hechas dentro queden marcadas como hechas por el superadmin; fechas con `formatoFecha` (el "De" en mayúscula viene de la clase `capitalize`).

## Media

### S5. "CRM" es el nombre de los mensajes de soporte
- **Regla:** 2.
- **Qué pasa:** en el panel del superadmin "CRM" agrupa mensajes, avisos, pagos y cumpleaños de los administradores. En el sistema del personal "Mensajes" es el soporte con el equipo y "CRM y fidelización" es otra cosa (recordatorios a pacientes).
- **Propuesta:** llamarlo "Mensajes".

### S6. Lenguaje técnico a la vista
- **Regla:** 2 (palabras del usuario).
- **Qué pasa:** la tarjeta "Estado de Supabase — Operativo, 1079 ms"; "Slug" en el detalle y en el formulario.
- **Propuesta:** "Servicio en línea" (con la latencia en un texto pequeño o en un detalle técnico) y "Dirección de la página" en lugar de "slug".

### S7. Suspender no pide motivo ni avisa
- **Reglas:** 15, 16.
- **Qué pasa:** suspender y reactivar piden confirmación, pero no un motivo ni avisan al administrador de la óptica (que ve de golpe que no entra). La suscripción "Vencido" y la suspensión son dos cosas manuales sin relación.
- **Propuesta:** motivo opcional que queda en Actividad y un mensaje al administrador por el canal de Mensajes; al marcar la suscripción como vencida, ofrecer "Suspender ahora".

### S8. El guardado de la suscripción es invisible
- **Reglas:** 16.
- **Qué pasa:** el monto y el vencimiento se guardan al salir del campo (solo aparece "Guardando…" un instante), sin botón ni confirmación; es lo mismo que ya se corrigió en Configuración (el guardado que se lee como "falta un botón"). La fecha usa el selector nativo del navegador, no el calendario del sistema.
- **Propuesta:** botón "Guardar" con aviso flotante y el selector de fecha del sistema. Facturas: poder verlas e imprimirlas como comprobante.

### S9. Apariencia: es lo más cercano al sistema del personal, con diferencias menores
- **Reglas:** 3, 14.
- **Qué pasa:** mismo menú claro, tipografía y tarjetas. Diferencias: sombras más fuertes en las tarjetas de métricas, una línea de tendencia en seis tarjetas (el número de pacientes vuelve a aparecer en otra tarjeta, ver S1), colores pastel propios por tipo de actividad y de lead (no son los estados de cita), y tamaños de letra sueltos (`text-[10.5px]`, `text-[11.5px]`).
- **Propuesta:** tarjetas con la misma sombra y esquinas que Inicio; sin tendencias salvo donde ayuden a decidir; un solo conjunto de colores de estado.

## Baja

### S10. Fechas armadas a mano
- **Regla:** 12.
- **Qué pasa:** el panel usa `formatoFecha` en la mayoría de los lugares, pero varias fechas de "hoy" y de periodos se arman con `new Date()` o `Date.now()` en lugar de `ahoraEcuador()`. No se auditó una por una.
- **Propuesta:** revisarlas todas al implementar, y agregar el panel a la prueba `fuenteUnicaFechas.test.js`.

### S11. Listas vacías
- **Regla:** 17.
- **Qué pasa:** no se vieron los estados vacíos (sin leads, sin mensajes, sin facturas) porque el panel actual tiene datos.
- **Propuesta:** verificarlos creando una óptica de prueba vacía, igual que se hizo con Citas.

---

## Lo que ya está bien (no se toca)

- La reserva en línea comparte el selector de fecha y hora y la ventana de confirmación con el sistema del personal, valida el horario en el servidor y evita duplicados con cédula y fecha de nacimiento.
- El portal ya respeta la política de las medidas de la receta, deja pedir las medidas completas y deja solicitar la eliminación de la cuenta.
- El panel del superadmin comparte menú, tipografía, esqueletos de carga y confirmaciones con el sistema del personal, y aplica la misma regla de contraseñas.
- "Mis datos" (9 oct): teléfono y correo editables con validación en pantalla y en la base; nombre, cédula y nacimiento solo los cambia la óptica.
