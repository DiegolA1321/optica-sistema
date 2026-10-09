# Estado actual — barra de Citas (nota de traspaso, 8 oct 2026)

Para retomar en una sesión nueva sin leer la conversación anterior.

## Regla vigente

Diego aprobó y mandó publicar el 8 oct 2026: `main` está en `origin/main` y Vercel desplegó (https://optica-sistema-zeta.vercel.app). Desde aquí, **cada publicación nueva la pide Diego**; no se hace push sin que lo diga.
Un commit por tema, agregando solo archivos concretos. Sin sub-agentes en paralelo ni `git stash`.

## Ramas y commits

`main` y `citas-barra-v3` apuntan al mismo commit (`a52cf17`, publicado). Lo último, de más nuevo a más viejo:

| Commit | Qué hace |
|---|---|
| `a52cf17` | Periodos Hoy / Semana / Mes con flechas, rango libre como filtro del panel, "Ver más", un solo filtro "Responsable", fila 2 igual en las tres vistas |
| `45a8370` | Ajustes de la barra tras revisión: atajo "Mañana", sin números en el panel, etiquetas desglosadas, calendario propio del rango, se quita el aviso de atenciones abiertas en Citas |
| `eba73c9` | Se quitan el buscador global de la cabecera y la paleta Ctrl + K; el contenido sube y reserva el espacio de la barra de desplazamiento; `CLAUDE.md` actualizado |
| `978eefc` … `c9a3275` | Barra única de búsqueda y filtros, "Para reagendar", confirmada en la tarjeta, fila de Inicio con datos sin confirmar (R22) |

Sin cambios de base de datos en nada de esto.

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

## Abrir días cerrados y últimos ajustes de Citas (8 oct, noche)

- **Abrir un día cerrado** (domingo; después feriados): clic en el día en Semana, Mes o Lista → "Abrir este día" → mañana y/o tarde (horas del horario habitual), casilla "Permitir también reservas por la web" (desmarcada) → "Solo abrir" o "Abrir y agendar". Es una excepción de esa fecha en `disponibilidad.excepciones[fecha]` con `reservasWeb` y `abiertoPor`; no cambia el horario semanal. Se ve en Mi horario (etiqueta Solo personal / También web), se registra en la actividad y se puede volver a cerrar solo si no tiene citas por atender ("Tiene N citas: reagéndalas o cancélalas primero", también desde Mi horario). Quién puede: administrador o cualquier rol con "Mi horario: editar" (la base ya lo exigía; Horario.jsx ahora también lo respeta).
- **Semana** muestra siempre los 7 días (el domingo cerrado en gris). **Lista** de un día cerrado ofrece abrirlo.
- **Página pública:** un día abierto sin reservas web no aparece (`slotsDisponibles(..., { publico: true })`). Las excepciones anteriores siguen admitiendo reservas web.
- **Atender una cita de otro día la mueve a hoy** con la hora real (queda en la actividad). "Atender ahora" y "Llegó en un horario diferente" son una sola casilla. Los horarios del selector de fecha ya no llevan scroll interno. Detalle: "Confirmar datos" para pacientes web sin confirmar.
- **Migración 0103 (escrita y ensayada, NO aplicada):** `crear_cita_publica` rechaza días cerrados, días abiertos sin reservas web y horas fuera de una sesión activa. Backup: `pre-reserva-web-horario-2026-10-08.dump`. Pendiente aparte: `reagendar_cita_publica` (portal del paciente) no aplica aún la misma regla.

## Cómo se verificó

- **Pruebas unitarias:** `npx vitest run` → 401 pasan (`filtrosCitas.test.js`, `FiltrosCitas.test.jsx`, `controles.test.js`, `Inicio.test.jsx`).
- **En el navegador (Playwright, óptica Demo `?optica=qu7u2j`, administrador):** periodos y flechas (semana 5 – 11 oct = 16 citas, igual que la vista Semana; mes de octubre = 27), rango del panel (3 – 20 oct = 25 citas), posiciones de la fila 2 iguales en las tres vistas, conteo con el mismo texto en todas, sin errores de consola. Producción: el código de Citas ya trae los cambios.
- **Otra óptica y óptica vacía:** también probado en `v8twzq` (9 citas, otro equipo) y en la **óptica vacía de pruebas** `3pldf1` ("Óptica Vacía (pruebas)", creada el 8 oct desde el panel de superadmin; credenciales del admin en `.env.test` como `VACIA_ADMIN_*`). Se deja **sin datos a propósito**: usarla solo para leer y comprobar estados vacíos. Ahí Citas muestra "0 citas hoy / en la semana / en el mes" y "Hoy no hay citas" / "Todavía no hay citas", sin errores.
- **Efecto secundario conocido:** la búsqueda por `CIT-` (que usa el e2e de roles para contar todas las citas) solo sirve en la Demo; en `v8twzq` da 0 porque sus citas no llevan código.
- **No verificado en pantalla:** "Ver más" con más de 30 citas en una lista real; "Hoy no hay citas" + "Ver esta semana"; el filtro Responsable con un optómetra concreto.

## Pendiente

- **IMPORTANTE (se corregirá después): la ausencia de una persona bloquea esas horas para toda la óptica**, aunque otro profesional esté disponible. Las ausencias de "Mi horario" viven en la disponibilidad de la óptica (`disponibilidad.excepciones[fecha].ausencias`) y el calendario, la reserva en línea y el índice único (óptica + fecha + hora) tratan la agenda como una sola. Con dos o más profesionales eso hace perder citas. Falta modelar la agenda por profesional.
- **Mejora futura:** una cita pendiente cuya hora ya pasó, o cuyo profesional registró una ausencia, debe aparecer a los demás optómetras como "Sin atender: disponible para tomar" (hoy solo pueden tomar las que están sin asignar).
- **E2E (`e2e/roles.spec.js`):** `totalAgendadas` leía el número del botón "Todas" de Citas; ahora cuenta con la búsqueda `CIT-` (mira todas las fechas). **No se ha corrido.** `e2e/inicio.spec.js` usa "Todas" del período del desenlace de Inicio, que no cambió.
- **Capturas del bug de Diagnóstico:** se restauraron (commit de esta nota) porque `docs/feedback-ing/bug-diagnostico-receta.md` las enlaza; sin ellas el documento tenía imágenes rotas.
- **Las 2 citas antiguas de la Demo sin paciente: resueltas el 8 oct.** Lorena Mero Vélez (`8a14467d-…`) y Rafael Cedeño Pibaque (`4650a523-…`) no se pudieron ligar con certeza a ningún paciente de la Demo (41): sin cédula, y sin coincidencia por nombre, teléfono ni correo. Con ensayo previo (transacción deshecha), se **cancelaron** (`estado = Cancelada`, `cancelada_por = recepcion`, con su registro en la actividad). La de Rafael estaba en "No asistió"; ya no hay citas activas sin paciente en la Demo.
- **`CLAUDE.md`, sección 2:** ya refleja que no hay buscador global ni Ctrl + K.
- **Capturas de revisión:** `C:\Users\diego\Downloads\citas-capturas\` (rondas anteriores) las borra Diego.
