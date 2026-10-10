# Estado actual — Citas, Inicio y perfil del paciente cerrados (nota de traspaso, 9 oct 2026)

Para retomar en una sesión nueva sin leer la conversación anterior.

## Estado: Citas, el Inicio de todos los roles y el perfil del paciente están cerrados y publicados

**Publicado el 9 oct 2026 (último commit `33cc737` de `main`; el CI "build-and-test" y el despliegue de Vercel de producción terminaron con éxito, confirmados con la API de GitHub).** Incluye:

- **Perfil del paciente:** botón Datos (ventana con Editar), Historia clínica, Ver atención con receta imprimible, Resumen con cuadros que se despliegan (Fidelización primero), buscador y filtros del historial siempre visibles, calendario flotante, Enviar a laboratorio, Referido por con buscador, correo (Gmail) además de WhatsApp, y el estado en la URL (recargar deja el perfil y la pestaña; "atrás" vuelve a la lista).
- **Portal del paciente:** "Mis datos" (teléfono y correo editables; nombre, cédula y nacimiento solo los cambia la óptica) y Reagendar/Cancelar de nuevo visibles (`minutosHastaCita`).
- **Superadmin:** entrar y salir de una óptica como administrador queda en Actividad.
- **Migraciones aplicadas:** `0104` (editar un paciente actualiza sus citas y consultas; `actualizar_contacto_paciente` para el portal), `0105` (auditoría admite entrar/salir de una óptica) y `0106` (política y anticipación mínima para cambiar o cancelar citas desde el portal, validadas en el servidor con la hora de Ecuador; también impide reagendar una cita ya atendida o cancelada). Backups en `C:Usersdiegoackups-optica` (`pre-propagar-datos-paciente-…`, `pre-0105-0106-…`). Ensayos: `scripts/ensayo-0104.mjs`, `ensayo-0105.mjs`, `ensayo-0106.mjs`.
- **Pruebas:** Vitest 474 de 474; Playwright (versión compilada, `--workers=1`) 81 pasadas y 1 omitida. Las pruebas del perfil, del buscador de Pacientes y de Inicio se actualizaron a las pantallas nuevas manteniendo lo que comprueban; las de Inicio crean sus propios avisos del área Citas. El CI de ese día falló una vez por una prueba que dependía de la hora (entre las 19:00 y las 24:00 de Ecuador); se corrigió y `scripts/probar-zonas-y-horas.mjs` corre todas las pruebas unitarias en UTC y en Ecuador a seis horas distintas (todas pasan).

**Pendiente (no publicado todavía):** la implementación de `docs/revision-ventas.md` y de `docs/revision-portal-y-superadmin.md` (con las decisiones de Diego del 9 oct), en ese orden. Del portal quedan P2 a P13 y W1 a W9, y del superadmin S1 a S3 y S5 a S11.

**9 oct 2026:** el Inicio de los cuatro roles (administrador, optómetra, Recepción y Ventas, más el rol general) y el perfil del paciente quedaron terminados según la reunión del 7 de octubre y **publicados** (último commit `0253680` de `main`; el CI "build-and-test" y el despliegue de Vercel terminaron con éxito). Detalle en "Inicio y perfil del paciente" más abajo. Verificación previa: Vitest 466 de 466 y Playwright con `--workers=2`: 80 pasaron, 1 omitida (`crear-cuentas`, que ya se omitía), 0 fallos.

**Ventas (9 oct 2026):** la revisión del módulo contra `docs/principios-diseno.md` está en `docs/revision-ventas.md`, pendiente de implementar; falta verla en pantalla con cada rol.

**Portal del paciente, páginas públicas y panel del superadmin (9 oct 2026):** la revisión contra `docs/principios-diseno.md` y contra lo que ya tiene el sistema del personal (apariencia, reglas y funciones) está en `docs/revision-portal-y-superadmin.md` con las decisiones de Diego del 9 oct, **pendiente de implementar después de Ventas**, salvo dos puntos ya corregidos por afectar al sistema publicado: el portal ya muestra Reagendar y Cancelar (`7fac0a7`) y entrar/salir de una óptica como administrador queda registrado (`5c0e37d`; migración `0105` aplicada el 9 oct; la `0106`, que valida en el servidor la política y la anticipación para cambiar o cancelar citas desde el portal (hora de Ecuador), también está aplicada (9 oct) y verificada con una sesión real. Backup: `pre-0105-0106-auditoria-y-anticipacion-2026-10-09.dump`). Nada se ha corregido. Falta verla con un paciente real, con la óptica vacía y en celular. Decisiones que se piden a Diego, al principio de ese archivo.

### Citas (publicado el 8 oct 2026)

El módulo de **Citas médicas** quedó terminado, revisado por Diego en localhost y **publicado el 8 oct 2026** (último commit `86f31b0` de `main`; el CI "build-and-test" y el despliegue de Vercel terminaron con éxito: https://optica-sistema-zeta.vercel.app). Las migraciones **0100 a 0103** están aplicadas en la base. Lo siguiente son **los otros módulos de la reunión del 7 de octubre** (`feedback-ing/requisitos-reunion-07oct-citas.md` y las transcripciones ING1 e ING2): se retoman empezando por leer este documento.

**Reglas de trabajo vigentes:** cada publicación nueva (push, Vercel) la pide Diego; un commit por tema, agregando solo archivos concretos; sin sub-agentes en paralelo ni `git stash`; migraciones con el protocolo de siempre (backup con `pg_dump`, ensayo en transacción con rollback, SQL a la vista, verificación con sesión real); las capturas de revisión van a `C:\Users\diego\Downloads\citas-capturas\v4\` y las borra Diego.

## Decisiones tomadas en Citas (resumen)

- **Un solo "Profesional" por cita** (quien la atendió o, si no, a quien está asignada); con alcance "propio" se oculta salvo en las citas sin asignar. "Reasignar" y "Tomar esta cita" por permiso y alcance, no por nombre de rol; `asignado_original` lo registra un trigger.
- **Formato único de fechas y horas** (`formatoFecha.js`): "sept" con 4 letras, mes completo en el título del Mes, hora en 12 h.
- **Código de cita único en toda cita** (no solo las de la web) y generado en un solo lugar (`generar_codigo_cita`).
- **Sin buscador global ni Ctrl + K** (decisión del 8 oct); cada módulo tiene su buscador.
- **Modal "Citas del día"** al clicar un día (Semana y Mes); "Agendar" solo si el día es laborable y quedan horarios; sin "Ver esta semana".
- **Abrir un día cerrado** es una excepción de esa fecha y es **siempre solo para el personal** (sin casilla de reservas web); los días del horario habitual, incluido el domingo si la óptica lo atiende, admiten reservas web. Cerrar un día puntual lleva **nombre opcional** (feriados a mano) y no se permite con citas por atender. Lo hace quien tenga "Mi horario: editar".
- **Atender una cita de otro día la mueve a hoy** con la hora real; "Atender ahora" y "Llegó en un horario diferente" son una sola casilla.
- **El servidor valida el horario de la reserva web y del reagendado del portal** (0103); las ópticas sin horario configurado (`karla-vision`, `3pldf1`) no se validan.
- **Lo seleccionado se ve en azul** (degradado de la marca), no en negro.

## Publicación

Todo lo anterior —incluidas las migraciones 0100 a 0103— está en `origin/main`. Verificación previa: Vitest 448 de 448, build y lint sin errores, Playwright 72 pasaron (1 omitida) en la óptica de pruebas y la Demo (solo lectura).

## Cómo quedó la barra de Citas

- **Fila 1 (igual en Lista, Semana y Mes):** selector Lista / Semana / Mes a la izquierda y, a su derecha, una barra única: botón "Filtrar" (con contador), etiquetas de filtros con "x", campo "Buscar cita: paciente o código" y "Limpiar". El buscador va siempre visible.
- **Fila 2 (misma altura y estructura en las tres vistas):** a la izquierda el conteo; a la derecha el periodo con sus flechas ‹ › y título.
  - **Lista:** `[Hoy | Semana | Mes]` + flechas + título ("Hoy · jueves, 8 oct", "5 – 11 oct 2026", "Octubre de 2026"). Las flechas mueven un día, una semana o un mes. Cambiar de periodo parte desde hoy.
  - **Semana y Mes:** solo flechas y título.
  - **Conteo, siempre igual:** "3 citas hoy", "16 citas en la semana", "27 citas en el mes", "N citas en el rango"; si es otro día, "1 cita ese día"; con búsqueda, "N citas" (mira todas las fechas) y aparece "Buscando en todas las fechas".
- **Panel "Filtrar":** una sola ventana con Estado, Origen y Visita (botones; un clic en la opción activa la quita), **Fechas** (rango libre con calendario propio, solo en Lista) y **Responsable** (lista, solo administrador). Sin números en las opciones.
- **Responsable:** cada cita tiene uno solo: quien la atendió y, si todavía no, a quien está asignada (lo que dice la tarjeta). "Nadie" = sin asignar y sin atender. Los resultados por persona nunca se repiten.
- **"Todas" y "Para reagendar":** no son botones fijos. Aparecen solo mientras están activos, porque se llega a ellos desde las tarjetas de Inicio.
- **"Ver más":** la Lista dibuja de a 30 citas y ofrece el resto con "Ver 30 más · quedan N". El conteo de arriba sigue diciendo el total real. Vuelve a 30 al cambiar de periodo, filtro o búsqueda.
- **Reglas que siguen:** las canceladas se ven solo con Estado: Canceladas; "Para reagendar" = no asistió o cancelada por el paciente, últimos 30 días, sin cita posterior activa o atendida.
- **Cabecera:** ya **no hay** buscador global ni Ctrl + K (decisión de Diego). Dentro de Pacientes, Ctrl + K y "/" siguen enfocando su propio buscador.
- **Archivos principales:** `src/paginas/Citas.jsx`, `src/componentes/FiltrosCitas.jsx`, `src/utilidades/filtrosCitas.js`, `src/utilidades/controles.js`, `src/paginas/Inicio.jsx`, `src/paginas/Dashboard.jsx`.

## Reunión del 7 oct. (feedback-ing/requisitos-reunion-07oct-citas.md): C1 a C16

Construido el 8 oct, **sin publicar** (commits `4a6e4b5` a `acb96c0` en `main` local):

- **C11:** el filtro se llama **"Profesional"**: una sola persona por cita (quien atendió y, si no, la asignada). El detalle muestra "Asignado a" y "Atendido por" por separado.
- **C12 y C13 (tarjeta):** sin menú ⋮, sin el ojo, sin "Agendar otra cita", sin motivo, origen ni código. Una etiqueta (Primera vez / Seguimiento / Por registrar), una línea de profesional, hora (con ✓ si está confirmada), estado y "Atender"/"Retomar"/"Cobrar". El borde de color sigue el estado (mismos colores del calendario).
- **C15 (detalle):** tres columnas (la cita · el profesional · el paciente y su motivo), bloque "Estado" con cambios (**Llegó**, Aún no llegó, No asistió, Marcar como confirmada) y todas las acciones al pie (Ver perfil, Editar, Dejar de atender, Cancelar, Agendar otra cita, Cobrar, Atender/Retomar).
- **Llegó → "En espera":** lo marca recepción en el detalle. "En espera" tiene su color (violeta) en el calendario, su leyenda y las tarjetas. Cuenta en "En sala de espera" de Recepción, el optómetra tiene esa misma tarjeta en su Inicio y su "Siguiente paciente" es quien ya llegó. **El proceso automático de "No asistió" no toca "En espera"**: solo actualiza citas `Pendiente` (verificado con una prueba dentro de una transacción deshecha: la pendiente pasó a No Asistió y la en espera quedó igual).
- **C16:** "Atender" y "Retomar" entran directo a la ficha, sin el modal "Resumen de la cita" (también desde Inicio y desde el detalle). Una cita de otro día avisa al entrar que se atiende hoy sin mover su fecha agendada.
- **C9 (filtros siempre visibles):** se construyó el 8 oct (bloque de dos filas fijas, medido a 1366×768 sin moverse entre vistas) y **Diego lo descartó**: prefiere el botón "Filtrar ▾" con su panel y la barra compacta de antes. Quedó revertido (commits de reversión `e563534` y `a168e5b`; el bloque sigue en `c9b3be2` por si se retoma). El ing pidió el bloque visible; la decisión final es de Diego.
- **Grupo "Tarea" dentro del panel Filtrar:** "Todas · {próximo día} · por confirmar · Para reagendar". Reemplaza al periodo de la Lista mientras está elegido (otro clic lo quita y vuelve a Hoy); sale como etiqueta con "x" en la barra y lo quita "Limpiar". "Por confirmar" = citas abiertas del próximo día de atención sin confirmar. Desde Inicio ("Ver en Citas" de las que hay que reagendar) llega con este grupo activo.
- **Pruebas:** 402 unitarias; e2e `llego-en-espera.spec.js` (nuevo, óptica de pruebas) y `roles`, `inicio`, `admin-navegacion`, `despues-reunion` pasan.
- **Capturas de revisión:** `C:\Users\diego\Downloads\citas-capturas\v4\` (las borra Diego).

## Formato único de fechas y horas (8 oct)

Todo el sistema formatea fechas con `formatoFecha(valor, nombre)` y horas con `hora(valor)`, de `src/utilidades/formatoFecha.js`. Ninguna pantalla arma fechas con `toLocaleDateString` ni con arreglos de meses.

| Formato | Ejemplo (8 oct 2026) | Dónde |
|---|---|---|
| `largo` | Jueves, 8 de octubre de 2026 | cabeceras, detalle de la cita |
| `largoSinDia` | 8 de octubre de 2026 | frases |
| `medio` | 8 oct 2026 | tarjetas, listas, registros |
| `medioSinAnio` | 8 oct | espacios cortos |
| `corto` | jue 8 oct 2026 | título del día en el periodo de la Lista |
| `calendario` | Jueves, 8 de octubre | encabezados de día |
| `diaNumero` · `diaMes` · `mesAnio` · `mesAnioCorto` · `mes` · `dia` · `numerico` · `numericoCorto` | Jue 8 · 8 de octubre · Octubre 2026 · oct 2026 · oct · 08 · 08/10/2026 · 08/10 | piezas y etiquetas |

- **Títulos de periodo** (`tituloSemana`, `formatoFecha(…, "mesAnioCorto")`): "Hoy · jue 8 oct 2026", "5 – 11 oct 2026" (entre meses "28 sept – 4 oct 2026"), "oct 2026". El título tiene ancho mínimo fijo: las flechas y el selector no se mueven entre Hoy, Semana y Mes ni entre las vistas.
- **Hora:** `hora()` ("09:00 AM"); `horaA12` y `horaLegible` son esa misma función con otro nombre. Las fechas ISO armadas a mano pasaron a `fechaAISO`.
- **Mayúsculas:** la primera letra la pone la función; se quitó la clase `capitalize`, que escribía "8 De Octubre De 2026".
- **Quedan a propósito:** `etiquetaFecha` (Hoy / Mañana / Ayer y, si no, el formato `calendario`), y las iniciales de una letra (L M X J V S D) de los calendarios pequeños. Las gráficas de Reportes y superadmin usan "sept" (4 letras) como en el resto.
- Pruebas: `formatoFecha.test.js` y `e2e/citas-titulos-estables.spec.js`.

## Profesional, Reasignar, Tomar y Ausencias (8 oct)

- **Detalle de la cita:** tres columnas por significado: La cita (fecha, hora, motivo, origen), Seguimiento (profesional, atendida/agendada/confirmada/cancelada por) y Paciente (cédula, teléfono, edad, correo). El código va en la cabecera.
- **Un solo "Profesional"** (`utilidades/profesionalCita.js`): "Paula", "Reasignada de Paula" o "Atendida por Rosa (en lugar de Paula)". Con alcance "propio" se oculta, salvo en las citas sin asignar ("Sin asignar").
- **"Editar cita" ya no cambia el profesional.** Al crear se elige; después solo con **Reasignar**.
- **Reasignar** (solo Pendiente o En espera): lo puede hacer quien tenga permiso de editar citas con alcance "todo" (por permiso, no por nombre de rol). Un clic en la persona, marca "ausente a esa hora", toast con **Deshacer** y registro en la actividad. Va por la función `reasignar_cita` de la migración **0100**.
- **Tomar esta cita:** botón para las citas sin asignar; la condición va en el propio update, así que si otra persona la toma antes avisa "Ya la tomó otra persona".
- **Ausencias con autor:** "Mi horario" guarda `usuarioId` y `usuarioNombre` en cada ausencia (las anteriores no tienen autor y no generan avisos). En "Requiere tu atención" aparece "Paula estará ausente el …: N citas por reasignar" y abre la reasignación en bloque (`ReasignarCitasModal`).
- **Migración 0100 (`asignado_original` + `reasignar_cita`): aplicada el 8 oct.** `asignado_original` lo registra un trigger de `citas_base` (también desde el "Editar cita" publicado) y se vacía al volver a la persona original. Ensayo: `scripts/ensayo-0100.mjs`. Backup: `C:Usersdiegoackups-opticapre-asignado-original-2026-10-08.dump`.
- **Migración 0101 (código en toda cita): aplicada el 8 oct.** Antes solo las citas de la web tenían `CIT-AAAA-XXXXXX`; ahora un trigger lo pone a toda cita nueva (si el generado ya existe, prueba con más caracteres del id) y se rellenaron las que no lo tenían. Índice único `citas_codigo_idx` (ignora vacíos). `crear_cita_publica` ya usa el mismo generador (migración 0102, aplicada el 8 oct; el generador y el trigger son security definer para ver los códigos de todas las ópticas). Ensayo: `scripts/ensayo-0101.mjs`. Backup: `pre-codigo-cita-2026-10-08.dump`.
- **Detalle:** el estado va junto al nombre en la cabecera; las citas sin paciente ofrecen "Registrar paciente" (vincula sin cambiar el estado); las Atendidas también ofrecen "Agendar otra cita".

## Calendarios y barra de periodo (8 oct, noche)

- **Modal "Citas del día"** (`DiaCitasModal.jsx`): clic en el encabezado o en una zona libre de la columna (Semana) o en un día (Mes). Lista las citas por hora con el color de su estado; sin citas, mensaje amable según el caso (despejado, hoy libre, jornada terminada, día sin atención, pasado). "Agendar" solo si el día es laborable y quedan horarios (`diaTieneCupo`); "Ver esta semana" solo si el día tiene citas; con un solo botón va centrado. Al abrir "Agendar" desde aquí el fondo no se vuelve a animar (sin parpadeo).
- **Selector de fecha:** el título del periodo es un botón (con borde y ▾) que abre un calendario para ir a un día, semana o mes. Títulos de mes con el nombre completo ("Octubre 2026"); semana y día siguen con el mes abreviado.
- **Filtro "Fechas"** vuelve al panel de las tres vistas (desde Semana o Mes pasa a la Lista). Estuvo roto por una variable inexistente (`textoDia`).
- **Vista Mes:** se quitó el interruptor Citas/Carga y el conteo repetido.
- **Seleccionado en azul:** degradado de la marca con `backgroundOrigin: border-box` (con borde transparente el degradado se repetía y el extremo izquierdo se veía cortado).
- **Guarda:** `sinVariablesNoDefinidas.test.js` corre el linter con `no-undef` sobre todo `src`.

## Abrir días cerrados, feriados a mano y últimos ajustes de Citas (8 oct, noche)

- **Abrir un día cerrado** (domingo u otro día que el horario habitual no atiende): clic en el día en Semana, Mes o Lista → "Abrir este día" → mañana y/o tarde (horas del horario habitual) → "Solo abrir" o "Abrir y agendar". Es una excepción de esa fecha en `disponibilidad.excepciones[fecha]` (con `abiertoPor`); no cambia el horario semanal. **Un día abierto así es siempre solo para el personal**: ni la página pública ni el portal lo ofrecen y el servidor lo rechaza. Los días del horario habitual (incluido el domingo, si la óptica lo atiende) siguen admitiendo reservas web, también con una excepción que solo cambia sus horas.
- **Cerrar un día puntual con nombre (feriados, a mano):** desde Citas ("Cerrar este día (feriado u otro motivo)…" en el modal de un día de atención) o desde Mi horario (editor de la excepción). El nombre es opcional ("Feriado: Día de los Difuntos") y se ve en la Semana (en lugar de "Cerrado"), en el Mes, en la Lista, en el modal del día y en Mi horario. Un día con citas por atender no se puede cerrar ("Tiene N citas: reagéndalas o cancélalas primero"), tampoco desde Mi horario. Volver a abrir/cerrar queda en la actividad con quién lo hizo.
- **Quién puede:** administrador o cualquier rol con "Mi horario: editar" (la base ya lo exigía; Horario.jsx ahora también lo respeta). Sin el permiso se ve "Pídele a un administrador que abra este día".
- **Semana** muestra siempre los 7 días (el domingo cerrado en gris). **Lista** de un día cerrado ofrece abrirlo.
- **Atender una cita de otro día la mueve a hoy** con la hora real (queda en la actividad). "Atender ahora" y "Llegó en un horario diferente" son una sola casilla. Los horarios del selector de fecha ya no llevan scroll interno. Detalle: "Confirmar datos" para pacientes web sin confirmar.
- **Migración 0103 (aplicada el 8 oct):** `crear_cita_publica` y `reagendar_cita_publica` validan día (con atención), que no sea un día abierto de forma excepcional, y que la hora caiga dentro de una sesión activa. Sin fila en `disponibilidad` no se valida (hoy: `karla-vision` y `3pldf1`). Ensayo: `scripts/ensayo-0103.mjs`. Backup: `pre-reserva-web-horario-v2-2026-10-08.dump`.
- **Mejora futura: feriados automáticos.** Hoy los feriados se cierran a mano, día por día. Un calendario automático de feriados queda pendiente; en Ecuador varios feriados se trasladan cada año por decreto (feriados "movibles" al lunes o al viernes más cercano), así que una lista fija sería incorrecta y habría que cargarla cada año o consultar una fuente oficial. La lógica prevista es la misma: un día cerrado por defecto con su nombre, que se puede abrir (excepción > feriado > horario semanal).

## Cómo se verificó

- **Pruebas unitarias:** `npx vitest run` → 401 pasan (`filtrosCitas.test.js`, `FiltrosCitas.test.jsx`, `controles.test.js`, `Inicio.test.jsx`).
- **En el navegador (Playwright, óptica Demo `?optica=qu7u2j`, administrador):** periodos y flechas (semana 5 – 11 oct = 16 citas, igual que la vista Semana; mes de octubre = 27), rango del panel (3 – 20 oct = 25 citas), posiciones de la fila 2 iguales en las tres vistas, conteo con el mismo texto en todas, sin errores de consola. Producción: el código de Citas ya trae los cambios.
- **Otra óptica y óptica vacía:** también probado en `v8twzq` (9 citas, otro equipo) y en la **óptica vacía de pruebas** `3pldf1` ("Óptica Vacía (pruebas)", creada el 8 oct desde el panel de superadmin; credenciales del admin en `.env.test` como `VACIA_ADMIN_*`). Se deja **sin datos a propósito**: usarla solo para leer y comprobar estados vacíos. Ahí Citas muestra "0 citas hoy / en la semana / en el mes" y "Hoy no hay citas" / "Todavía no hay citas", sin errores.
- **Efecto secundario conocido:** la búsqueda por `CIT-` (que usa el e2e de roles para contar todas las citas) solo sirve en la Demo; en `v8twzq` da 0 porque sus citas no llevan código.
- **No verificado en pantalla:** "Ver más" con más de 30 citas en una lista real; "Hoy no hay citas" + "Ver esta semana"; el filtro Responsable con un optómetra concreto.

## Inicio terminado del administrador y del optómetra (9 oct.)

- **Hecho y publicado.** El Inicio del administrador y el del optómetra siguen la reunión del 7 de octubre:
  - Administrador: Totales (pacientes, citas y productos, cada uno con su "+N este mes"), Requiere tu atención en un bloque por área (Citas, Pacientes, Ventas, Inventario; tres avisos y "Ver todo (N)" por bloque, solo los que permiten sus permisos), Desenlace de las citas con selector Hoy · Esta semana · Este mes · Todas (Hoy por defecto, semana de lunes a domingo) y la lista de citas atada a ese mismo control: al tocar Atendidas, No asistieron o Canceladas, la lista muestra esas citas.
  - Optómetra: atajos pequeños, los mismos bloques según sus permisos, desenlace de sus citas y "Mi agenda de hoy · N en espera", con el siguiente paciente destacado arriba ("Atender" visible; quien ya llegó va antes que quien aún no llega) y "Atender" / "Retomar" en cada fila.
  - "Pacientes sin atender" salió de Totales y es un aviso del bloque Pacientes. Ventas incluye los saldos por cobrar.
- **Zonas horarias (revisión hecha).** "Hoy" y "ahora" salían de la hora local del equipo; con un equipo en otra zona (o en el CI, que corre en UTC) cambiaban el día y la hora de corte de cupos, controles vencidos, órdenes atrasadas y períodos del Inicio. Ahora todo pasa por `ahoraEcuador()` (`src/utilidades/horaEcuador.js`, America/Guayaquil, UTC-5 sin horario de verano). Las pruebas con reloj usan instantes fijos en hora de Ecuador y las 457 pasan con `TZ=UTC`, `America/Guayaquil`, `Asia/Tokyo` y `America/Los_Angeles`. Regla para código nuevo: no usar `new Date()` para "hoy" o "ahora"; usar `ahoraEcuador()` (las marcas de tiempo que se guardan siguen con `new Date().toISOString()`). Falta revisar el lado del servidor (funciones y migraciones SQL que calculan "hoy"), que no se tocó en esta revisión.
- **Pruebas e2e.** Playwright limpia la óptica de pruebas antes de cada corrida (`e2e/limpieza-global.js`, solo esa óptica) y las pruebas de Inicio crean sus propios datos. Suite completa con `--workers=2`: 75 pasan, 1 se salta (`crear-cuentas`, ya se saltaba).

## Inicio y perfil del paciente (9 oct., publicado)

Según la reunión del 7 de octubre (`feedback-ing/requisitos-reunion-07oct-pacientes.md`, P1 a P10) y las reglas de `docs/principios-diseno.md`.

**Inicio, los cuatro roles con la misma estructura**
- Atajos arriba a la derecha; "Requiere tu atención" en bloques por área (tres avisos y "Ver todo (N)", contados por ítem); desenlace con selector Hoy · Esta semana · Este mes · Todas; lista de citas conectada. Sin línea de resumen en ningún rol.
- Las áreas sin avisos van en una franja compacta de "todo en orden"; los bloques con avisos se reparten en dos columnas por su alto, sin huecos. Las listas vacías son una línea.
- **Recepción:** "Por llegar" y "En sala de espera" van en la cabecera de "Citas del día". No hay botón "Llegó" en el Inicio: marcar la llegada sigue solo en el detalle de la cita (un solo camino).
- **Ventas:** las tarjetas de "Para vender" (Listos, Proformas, Saldos por cobrar) eligen la lista de abajo; los saldos también son un aviso del bloque Ventas.
- **Números:** el conteo del periodo no incluye canceladas (igual que la lista y que Citas); bajo Atendidas dice "· N en atención en este momento". Texto único de la atención abierta en todo el sistema, también en Citas: "Abierta hace N días".
- **Campanita:** solo lo que no está en "Requiere tu atención" (consultas de soporte, avisos generales y solicitudes de medidas), según el permiso del rol.

**Perfil del paciente**
- Cabecera sin "Ficha clínica": se entra por la cita ("Ingresar") o con "Atender ahora", que es el mismo modal de Agendar cita con "Llegó en un horario diferente" (Citas y el perfil comparten `CamposCita` y `agendarCita.js`). El menú de la lista trae "Atender ahora" en lugar de "Nueva ficha clínica": toda atención pasa por una cita.
- Alertas debajo de la cabecera y antes de las pestañas (incluido el control vencido o sin agendar, con su botón). Toda acción respeta el permiso del rol (agendar, mensaje, crear acceso, cobrar, tomar datos, dejar de atender).
- Pestañas: Citas (la cita actual o próxima con "Ingresar", "+N citas pendientes más" y el historial; el buscador solo con más de 5 citas), Resumen (información general, conteos de citas, citas por mes, tendencia de graduación), Productos y servicios (cada venta una vez, por comprobante con sus líneas desplegables; "Nueva venta" solo para ventas sin receta, y la receta se vende solo desde "Listo para venta"), Órdenes de laboratorio y Fidelización (el puntaje vive solo aquí). "Crear acceso" solo si no tiene cuenta; "Cuenta Portal" se pulsa solo si ya la tiene.
- Sin citas hay un mensaje con "Agendar cita". Una sola forma de salir ("← Pacientes").

**Datos y reglas**
- Los 20 productos de la Demo tenían la misma fecha de alta (2026-10-07 01:56:39 UTC); se repartieron con el script con ensayo `scripts/corregir-fecha-alta-productos-demo.mjs` (ejecutado). El "+N este mes" de Productos ahora es +3.
- `docs/principios-diseno.md`: 28 reglas con ejemplos de Citas y una lista de revisión; CLAUDE.md obliga a leerlo antes de diseñar o cambiar una pantalla.

## Inicio según el documento del ingeniero, I1 a I18 (10 oct. 2026, sin publicar)
Reemplaza la estructura de la sección siguiente (que había vuelto a juntar "Requiere tu atención" en una sola lista, contra I4). Requisitos: `docs/feedback-ing/requisitos-reunion-07oct-inicio.md`; reglas 37, 38 y 41 de `docs/principios-diseno.md`.
- **Administrador, a todo el ancho:** Totales (cuatro tarjetas; Ventas muestra el total vendido y debajo "+$ este mes · N ventas", igual lógica que las demás, I8) → "Requiere tu atención" en cuatro tarjetas por área en 2×2 (Citas, Pacientes, Ventas, Inventario; misma altura; ícono, título y número; máximo tres avisos de una línea con su acción; "N elementos más" y "Ver todo →"; "Todo en orden" si no hay) → desenlace con selector Hoy · Esta semana · Este mes · Todas (la lista del día muestra todas las del día y solo se filtra al tocar una tarjeta; "N en atención ahora" bajo Atendidas, I13) → citas del día conectadas al desenlace → registro de actividad. El selector se queda como "Hoy" (decisión de Diego, regla 2).
- **Optómetra:** atajos pequeños → "Tu día": el siguiente paciente a lo ancho (quien está En espera va antes que quien está Pendiente) y la tarjeta "Fichas sin terminar" solo si hay → "Mi agenda de hoy · N citas · M en espera" (el siguiente lleva la marca "Siguiente"; cada fila: estado primero y la acción al final; sin citas hoy, su próxima jornada) → avisos por área, solo los suyos ("N de tus pacientes con el control vencido"; sin inventario ni "sin consulta") y según sus permisos → desenlace de sus citas (informativo). Se quitaron "Mis citas de hoy" y "Atendidos hoy".
- **Letra:** nada por debajo de 12 px (regla 41); sin puntos de colores.
- **Registro de actividad:** las órdenes de laboratorio, abonos y ventas se registran y se muestran en "Ventas" (también los registros viejos que se guardaron como "Pacientes").
- **Los números del día coinciden** (agenda = título = desenlace = tarjetas) con cualquier dato: `src/paginas/InicioNumerosDelDia.test.jsx` genera 40 conjuntos de citas con semilla fija y los cuenta con un cálculo independiente. Encontró un error real: la tarjeta de fichas contaba una atención abierta con fecha futura.
- **Pendiente (I6):** una sección "requiere tu atención" propia dentro de cada módulo; hoy "Ver todo →" lleva a la lista del módulo. Es trabajo nuevo y grande (el documento ya lo marcaba).
- **Pruebas:** 502 unitarias y el build; Playwright completo contra la versión compilada con `--workers=1`: 81 pasaron y 1 omitida. Una corrida anterior tuvo un fallo intermitente de `perfil-paciente.spec.js` (abrir un perfil desde la búsqueda) que no se repitió: pasó 2 de 2 aislado y en la corrida completa siguiente.

## Inicio rehecho con jerarquía (10 oct. 2026, reemplazada por la sección anterior)
Maqueta aprobada por Diego con el orden que pidió el ingeniero. Reglas 37 a 40 de `docs/principios-diseno.md`.
- **Administrador:** Totales en una fila compacta de cuatro tarjetas iguales (Pacientes, Citas, Ventas del mes en dólares con "+N este mes · total en total", Productos; baldosa gris igual en todas); debajo, a dos columnas, "Requiere tu atención" a la izquierda y el desenlace con las citas del día a la derecha; el registro de actividad al final. A 1366×768 los Totales, la atención (once líneas en la Demo) y el desenlace con las citas del día caben en la primera pantalla.
- **Requiere tu atención:** una línea por tipo de aviso (número, nombres resumidos con "y N más", una sola acción); el total se escribe una vez en el título y cada área conserva su "Ver todo →" sin número. Con un solo caso la acción lo resuelve ("Ingresar", "Agendar", "Reagendar", "Confirmar datos"); con varios abre la lista. Las áreas sin avisos son una línea de "todo en orden".
- **Desenlace:** Atendidas + No asistieron + Pendientes (pendiente, en espera y en atención) = citas del período, y el título lo dice ("12 citas = 5 + 1 + 6"); **Canceladas aparte** (borde punteado, fuera de la suma, como las cuenta Citas). La tarjeta Pendientes filtra la lista del día. El selector de período usa el azul de la marca.
- **Optómetra:** primero su agenda (el siguiente paciente destacado, sin repetirlo en la lista; sin citas hoy, su próxima jornada con citas), después sus avisos y al final el desenlace de sus citas (informativo). **Las acciones salen del permiso del rol/vista** (Reabastecer, Añadir producto, Ver en CRM, Confirmar datos...); una línea puede verse sin su botón.
- **Registro de actividad** sin notas técnicas (`detalleActividad`).
- **Demo:** se borraron 18 registros de actividad (3 de mis scripts, "Sistema", y 15 restos de pruebas) con backup `pre-limpiar-actividad-demo-2026-10-10.dump` y ensayo previo (`scripts/limpiar-actividad-demo.mjs`). No quedan datos de pruebas en las tablas de la Demo (los productos "E2E Montura" ya estaban borrados; solo quedaban sus registros). Quedan dos filas "Canceló una ausencia registrada · 2028-02-19" que son la pareja de una ausencia de prueba (no incluidas en las 18 aprobadas).
- **La Demo es de solo lectura para las pruebas:** `e2e/guardia-demo.js` cancela cualquier escritura a la API de datos en una sesión de la Demo y `e2e/verificar-demo.js` (globalTeardown) hace fallar la corrida si hubo alguna. Solo se permiten las llamadas de entrada que no escriben datos de la óptica (permisos, equipo, inicio de sesión, contador de visitas).
- **Pendiente:** al publicar, el administrador que use una vista de rol verá los permisos de ese rol (antes usaba los suyos).

## Publicación del 10 oct. 2026 (perfil del paciente, portal y migración 0107)
- **Publicado:** perfil del paciente corregido (receta siempre con graduación, órdenes de laboratorio por la venta, `CampoFecha`, resumen de lo clínico a lo comercial, filtros de Pacientes sin duplicados con números que siguen todos los filtros, antecedentes importantes en ficha y perfil, saludo con el nombre guardado), portal con la receta siempre visible y "Descargar mis datos", y reglas 29 a 36 de `docs/principios-diseno.md`. Último commit `130ae12`; CI y Vercel con éxito.
- **Pruebas antes de publicar:** 484 pruebas unitarias y el build; Playwright completo contra la versión compilada con un solo worker (80 pasaron, 1 omitida y 1 falló). El fallo era de la prueba, no del sistema: `citas-titulos-estables` no aceptaba la "á" de "Sábado" y fallaba los sábados. Se corrigió la expresión (acepta cualquier vocal con tilde), se comprobó contra los siete días y los doce meses con el texto real de la aplicación, y las pruebas unitarias pasaron simulando cada día de la semana en UTC y en Ecuador. La prueba corregida pasó en Playwright un sábado. No se repitió la suite completa porque no cambió código del sistema.
- **Pendiente:** las demás fechas nativas (pulido final), nombres y apellidos en dos campos, imágenes de la consulta en "Descargar mis datos", casillas estructuradas de antecedentes (ver las secciones de arriba).

## Decisiones y propuestas del 10 oct. (revisión del perfil del paciente)

### Portal del paciente: receta siempre visible y datos que no llegan al navegador (10 oct.)
- **Defecto encontrado:** `mis_consultas_paciente` hacía `select c.*`: el navegador del paciente recibía la consulta completa (examen, antecedentes, alergias, imágenes, monto, ids del personal) y la política de medidas solo se aplicaba al dibujar. `exportar_mis_datos_paciente` devolvía filas completas. Un anónimo no puede leer las tablas directamente (sin privilegio de lectura; se comprobó en el ensayo).
- **Regla nueva:** el paciente ve siempre su receta (esfera, cilindro, eje, adición, agudeza visual), diagnóstico, indicaciones, lente recomendado, profesional y citas. La distancia pupilar y la altura solo si la óptica lo permite (misma clave `mostrarMedidasPaciente`; las ópticas con la opción encendida no notan cambio, las de valor por defecto verán que sus pacientes ahora ven la receta: Configuración lo explica en una nota). "Solicitar mis medidas" pasó a "Solicitar distancia pupilar y medidas de montaje". Se quitó "costo adicional" de todos los textos.
- **"Descargar mis datos"** (Mis datos): archivo JSON con datos personales, citas e historial clínico (antecedentes y alergias incluidos), sin campos internos; distancia pupilar según la política.
- **Migración 0107** (`supabase/migrations/0107_portal_receta_solo_lo_permitido.sql`): mismas firmas y mismos tipos de retorno que las funciones actuales (`setof consultas`, `setof citas`, mismo jsonb), lo que ya no se entrega llega como null: la versión publicada del portal sigue funcionando hasta publicar el código nuevo. Ensayo: `scripts/ensayo-0107.mjs` (transacción con rollback). Backup previo: `C:Usersdiegoackups-opticapre-portal-receta-2026-10-10.dump`.
- **Estado:** migración **0107 aplicada el 10 oct. 2026** y código del portal **publicado el 10 oct. 2026** (último commit `130ae12` de `main`; el CI "build-and-test" y el despliegue de Vercel terminaron con éxito: https://optica-sistema-zeta.vercel.app). Verificada con llamadas HTTP reales a la API y con un paciente temporal con cuenta en la óptica de pruebas (ya borrado, junto con sus consultas y citas; la política de medidas quedó como estaba, apagada): un anónimo recibe 401 en las seis tablas; con la política apagada no llegan antecedentes, alergias, montos, ids del personal ni la distancia pupilar y la altura; con ella encendida sí llegan estas dos; un token no lee a otro paciente; la descarga no trae campos internos. La versión publicada en Vercel (código anterior) sigue funcionando con la migración: inicia sesión, muestra citas, receta (con "Medidas protegidas" mientras no se publique el código nuevo), diagnóstico e indicaciones, sin pantallas vacías ni errores nuevos en la consola.
- **Pendiente:** las **imágenes de la consulta no se incluyen en "Descargar mis datos"** (el campo `imagenes` guarda rutas internas de almacenamiento y la descarga es un solo archivo JSON). Si el derecho de acceso debe cubrirlas, hay que armarlas aparte (URLs firmadas o un ZIP con los archivos).

### Nombres y apellidos en dos campos (propuesta, sin implementar)
- **Problema:** el formulario pide "Apellidos y nombres" en un solo campo, así que la primera palabra normalmente es un apellido; en la Demo los nombres están guardados al revés (nombre primero). Hoy conviven dos formatos y no se puede saber cuál es cuál con seguridad. Por eso los mensajes **no adivinan el primer nombre**: dicen "Hola, Rosa Bravo Cedeño" tal como está guardado (o solo "Hola" si no hay nombre).
- **Propuesta:** dos campos, "Nombres" y "Apellidos" (`pacientes.nombres`, `pacientes.apellidos`), con `pacientes.nombre` como columna calculada ("Apellidos Nombres") para no romper lo que hoy lee el nombre completo. El saludo usaría "Nombres" ("Hola, Rosa").
- **Migración de los nombres existentes (en tres pasos):**
  1. Columnas nuevas y `nombre_revisado boolean default false`. Nada se borra.
  2. Una pasada con ensayo (como `scripts/corregir-fecha-alta-productos-demo.mjs`) que separa cada nombre con reglas: 4 palabras = 2 apellidos + 2 nombres; 3 = 2 apellidos + 1 nombre; 2 = 1 + 1; apellidos compuestos ("De la Cruz", "Del Pozo", "Vda. de") se agrupan con una lista de partículas. Para decidir el orden (apellidos primero o nombres primero) se compara la primera palabra con una lista de nombres de pila frecuentes del Ecuador y se usa lo que dicen la mayoría de las ópticas como pista, nunca como certeza.
  3. Todo lo que no sea inequívoco queda con `nombre_revisado = false`.
- **Casos dudosos:** una pantalla "Revisar nombres" (para el administrador) lista los marcados con la separación propuesta y dos botones, "Está bien" y "Intercambiar" (apellidos ↔ nombres), más edición a mano. Se marcan como dudosos: más de 4 palabras, una sola palabra, partículas, un nombre de pila en la posición de apellido y al revés, y cualquier nombre de la Demo hasta revisarlo. Hasta que se revisan, el saludo sigue usando el nombre completo.
- **Cuidado al migrar:** `citas.paciente` y `consultas.paciente` guardan el nombre copiado como texto y hay lugares que comparan por ese texto (`c.paciente === paciente.nombre`); hay que moverlos al `paciente_id` o actualizar las copias en la misma migración. `pacientes` es hoy una vista (migración 0055), así que los triggers INSTEAD OF también deben conocer los campos nuevos. Las RPC públicas (`crear_cita_publica`, portal) y `mapPaciente` en `App.jsx` también.

### Antecedentes importantes: aprobado, en construcción
Detección por texto (diabetes, hipertensión o "presión alta", glaucoma, desprendimiento de retina, queratocono, uveítis, cataratas, cirugía ocular, ambliopía), ignorando lo negado; barra **ámbar** bajo la de alergias en la ficha (el rojo queda solo para alergias) y en las alertas del perfil del paciente.
- **Mejora futura:** casillas estructuradas de antecedentes (diabetes, hipertensión, glaucoma... personal / familiar) en la anamnesis. Es más fiable que el texto libre, pero exige migrar los datos y cambiar la ficha; se evalúa cuando se vea cuánto falla la detección por texto.

### Filtros de la lista de Pacientes: aprobado
Las tarjetas son el filtro de corrección; las etiquetas rápidas son el filtro de seguimiento (todas con su número); "Filtrar" queda con estado y fecha de registro. Se quitan "Recetas activas" y "Corrección" de "Filtrar" (duplicaban la tarjeta "Bien corregidos").

### Pendiente del pulido final
- **Selectores de fecha nativos que faltan por pasar a `CampoFecha`:** nacimiento en "Confirmar datos" (`ConfirmarDatosPacienteModal`) y en las altas rápidas de Citas (nuevo paciente y cita pública), fecha de abono (`AbonoModal`), fecha prometida de la orden de laboratorio (`OrdenLaboratorioModal`), fecha de la consulta (`ConsultaMedica`), ausencias en `Horario`, rango personalizado de `Reportes` y fechas del `SuperadminPanel`. Alta pública: `AgendarCitaPublica` (nacimiento).

## Pendiente

- **Segunda etapa de "requiere tu atención" en cada módulo:** una sección propia dentro de Citas, Pacientes, Ventas e Inventario, de la que el Inicio toma los tres avisos más relevantes y a la que lleva cada "Ver todo". Hoy el "Ver todo" del bloque Citas abre "Para reagendar" (o, sin nada por reagendar, las atenciones abiertas), y el de Ventas, el primer aviso del bloque.
- **Revisión de zonas horarias, lado del servidor:** "hoy" y "ahora" ya salen de `ahoraEcuador()` en la aplicación, pero falta revisar las funciones y migraciones SQL que calculan "hoy". Regla para código nuevo: no usar `new Date()` para "hoy" o "ahora".
- **IMPORTANTE: la ausencia de una persona bloquea esas horas para toda la óptica**, aunque otro profesional esté disponible. Las ausencias de "Mi horario" viven en la disponibilidad de la óptica (`disponibilidad.excepciones[fecha].ausencias`) y el calendario, la reserva en línea y el índice único (óptica + fecha + hora) tratan la agenda como una sola. Con dos o más profesionales eso hace perder citas. Falta modelar la agenda por profesional. Relacionado: una cita pendiente cuya hora ya pasó, o cuyo profesional registró una ausencia, debería aparecer a los demás optómetras como "Sin atender: disponible para tomar" (hoy solo pueden tomar las sin asignar).
- **Feriados automáticos:** hoy los feriados se cierran a mano, día por día. En Ecuador varios feriados se trasladan cada año por decreto, así que una lista fija sería incorrecta; habría que cargarla cada año o consultar una fuente oficial. La lógica prevista es la misma: un día cerrado por defecto con su nombre, que se puede abrir (excepción > feriado > horario semanal).
- **Aviso de `frame-ancestors`:** pendiente de revisar. El repositorio no define ninguna política de seguridad de contenido (ni en `index.html` ni en `vercel.json`). Si el aviso aparece en la consola, lo probable es que `frame-ancestors` se declare en una etiqueta `<meta>`, donde el navegador la ignora: esa directiva solo funciona como cabecera HTTP (se configuraría en `vercel.json`). Falta confirmar de dónde viene el aviso antes de tocar nada.
