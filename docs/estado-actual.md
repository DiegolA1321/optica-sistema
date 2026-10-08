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
- **Pendiente: C9** (bloque de filtros visibles). Falta que Diego apruebe el esquema (a 1366×768, sin números por opción, sin mover nada al cambiar de vista).
- **Pruebas:** 402 unitarias; e2e `llego-en-espera.spec.js` (nuevo, óptica de pruebas) y `roles`, `inicio`, `admin-navegacion`, `despues-reunion` pasan.
- **Capturas de revisión:** `C:\Users\diego\Downloads\citas-capturas\v4\` (las borra Diego).

## Cómo se verificó

- **Pruebas unitarias:** `npx vitest run` → 401 pasan (`filtrosCitas.test.js`, `FiltrosCitas.test.jsx`, `controles.test.js`, `Inicio.test.jsx`).
- **En el navegador (Playwright, óptica Demo `?optica=qu7u2j`, administrador):** periodos y flechas (semana 5 – 11 oct = 16 citas, igual que la vista Semana; mes de octubre = 27), rango del panel (3 – 20 oct = 25 citas), posiciones de la fila 2 iguales en las tres vistas, conteo con el mismo texto en todas, sin errores de consola. Producción: el código de Citas ya trae los cambios.
- **Otra óptica y óptica vacía:** también probado en `v8twzq` (9 citas, otro equipo) y en la **óptica vacía de pruebas** `3pldf1` ("Óptica Vacía (pruebas)", creada el 8 oct desde el panel de superadmin; credenciales del admin en `.env.test` como `VACIA_ADMIN_*`). Se deja **sin datos a propósito**: usarla solo para leer y comprobar estados vacíos. Ahí Citas muestra "0 citas hoy / en la semana / en el mes" y "Hoy no hay citas" / "Todavía no hay citas", sin errores.
- **Efecto secundario conocido:** la búsqueda por `CIT-` (que usa el e2e de roles para contar todas las citas) solo sirve en la Demo; en `v8twzq` da 0 porque sus citas no llevan código.
- **No verificado en pantalla:** "Ver más" con más de 30 citas en una lista real; "Hoy no hay citas" + "Ver esta semana"; el filtro Responsable con un optómetra concreto.

## Pendiente

- **E2E (`e2e/roles.spec.js`):** `totalAgendadas` leía el número del botón "Todas" de Citas; ahora cuenta con la búsqueda `CIT-` (mira todas las fechas). **No se ha corrido.** `e2e/inicio.spec.js` usa "Todas" del período del desenlace de Inicio, que no cambió.
- **Capturas del bug de Diagnóstico:** se restauraron (commit de esta nota) porque `docs/feedback-ing/bug-diagnostico-receta.md` las enlaza; sin ellas el documento tenía imágenes rotas.
- **2 citas antiguas de la Demo sin paciente** (óptica `qu7u2j`, ambas Pendiente, origen web, con código y sin cédula):
  - `8a14467d-d38b-4e77-bd6b-5949bb337f45` — Lorena Mero Vélez, 15 oct 2026, 01:40 PM, `lorena.mero@example.com`, 0966739833.
  - `4650a523-c834-4069-805d-9821bdb38d8a` — Rafael Cedeño Pibaque, 8 oct 2026, 09:00 AM, `rafael.cedeno@example.com`, 0923126028.
  - **Decisión de Diego:** vincularlas a su paciente por cédula o nombre, con ensayo previo. Ninguna tiene cédula y ningún paciente de la Demo (41) coincide por nombre, teléfono ni correo. **No se ha escrito nada.** Hay que avisarle a Diego antes de crear los pacientes, borrar las citas o dejarlas.
- **`CLAUDE.md`, sección 2:** ya refleja que no hay buscador global ni Ctrl + K.
- **Capturas de revisión:** `C:\Users\diego\Downloads\citas-capturas\` (rondas anteriores) las borra Diego.
