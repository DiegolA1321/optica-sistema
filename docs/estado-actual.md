# Estado actual — barra de Citas (nota de traspaso, 7 oct 2026)

Para retomar en una sesión nueva sin leer la conversación anterior.

## Regla vigente

**No se publica nada en Vercel ni se hace push de `main` ni de la rama hasta que Diego revise y apruebe todo.**
Un commit por cambio, agregando solo archivos concretos. Sin sub-agentes en paralelo ni `git stash`.

## Ramas y commits

**Rama de trabajo: `citas-barra-v3`** (sin publicar, sin upstream). 5 commits propios sobre `main`:

| Commit | Qué hace |
|---|---|
| `e7081c4` | La cita confirmada se ve en la tarjeta y el detalle; recepción puede "Marcar como confirmada" (usa `confirmada_at`; no hizo falta SQL) |
| `73fcb3a` | "Para reagendar" (no asistió + canceladas por el paciente) con un solo criterio, compartido por Inicio y Citas (`citasParaReagendar` en `utilidades/controles.js`) |
| `281af44` | Lógica de los atajos "por confirmar" (próximo día de atención) y "Para reagendar"; la búsqueda ignora el periodo y mira todas las fechas |
| `da446b8` | Todos los roles abren en Lista con el periodo "Hoy"; si hoy no hay citas, "Hoy no hay citas" + botón "Ver próximas" |
| `db58927` | Barra única de búsqueda y filtros con panel "Filtrar", atajos por tarea con conteo, "Mostrando X de Y", "‹ Hoy ›" pegado al calendario; Inicio abre "Para reagendar" en Citas |

**`main` local: 3 commits sin publicar** (la rama `citas-barra-v3` sale de ellos):

| Commit | Qué hace |
|---|---|
| `c9a3275` | Lógica pura de filtros combinados y conteos por opción (`citaPasaFiltros`, `contarCon`, `totalDelAlcance`); "Todas" = citas activas, sin canceladas |
| `af580af` | Primera versión de la barra (menús desplegables, línea "Mostrando X de Y"); se quita "por registrar" y el interruptor de canceladas |
| `71bf0c9` | Fila en "Requiere tu atención" (administrador y recepción) con los pacientes de la web con datos sin confirmar (R22) y botón "Confirmar datos" |

Antes de estos, `origin/main` está en `3baa8df` (lo último publicado).

## Qué se implementó en la barra de Citas

- **Fila 1 (igual en las tres vistas):** selector Lista / Semana / Mes + una barra única: botón "Filtrar" (con contador), etiquetas de filtros con "x", campo "Buscar cita: paciente o código" y "Limpiar".
- **Panel "Filtrar":** una sola ventana con todas las secciones abiertas (Estado, Origen, Visita como botones con conteo; Asignada a / Atendida por solo para el administrador, como listas con conteo). Cada conteo respeta todos los demás filtros y la búsqueda, salvo el propio.
- **Fila 2 en Lista:** `[Hoy] [<día> · por confirmar] [Para reagendar] [Próximas] [Todas] [Rango…]` con conteos, y "Mostrando X de Y citas" a la derecha. Si hay búsqueda, en lugar de los atajos dice "Buscando en todas las fechas".
- **Fila 2 en Semana y Mes:** "‹ Hoy ›" + rango visible, justo encima del calendario, y el conteo del periodo a la derecha.
- **Día a confirmar:** el próximo día de atención según el horario de la óptica (un viernes → "Lun 12"). Sin horario cargado, mañana.
- **Reglas:** "Todas" = citas activas en las tres vistas; las canceladas se ven solo con Estado: Canceladas; el periodo (Hoy, Próximas…) es solo de la Lista; Semana y Mes recortan por el periodo visible; "Para reagendar" = no asistió o cancelada por el paciente, últimos 30 días, sin cita posterior activa o atendida.
- **Archivos principales:** `src/paginas/Citas.jsx`, `src/componentes/FiltrosCitas.jsx`, `src/utilidades/filtrosCitas.js`, `src/utilidades/controles.js`, `src/paginas/Inicio.jsx`, `src/componentes/ConfirmarDatosPacienteModal.jsx`.

## Cómo se verificó

- **Pruebas unitarias:** `npx vitest run` → 394 pasan (nuevas en `filtrosCitas.test.js`, `controles.test.js`, `Inicio.test.jsx`).
- **Playwright en la óptica de pruebas** (`?optica=v8twzq`, administrador, 1366×768; scripts de verificación en el scratchpad de la sesión, no versionados):
  - Fila 1 (selector, botón Filtrar, campo de búsqueda) en las mismas coordenadas en Lista, Semana y Mes, sin filtros, con filtros y con búsqueda; fila 2 a la misma altura; sin desplazamiento horizontal.
  - Para cada atajo (Hoy, por confirmar, Para reagendar, Próximas, Todas): número anunciado = "Mostrando X de Y" = citas en pantalla. "Rango…" no lleva conteo hasta elegir fechas.
  - Con Origen: Recepción + Visita: Primera vez, las 6 opciones de Estado anuncian lo mismo que luego se ve.
  - Buscar una cita del 20 oct con el periodo en "Hoy": la encuentra, agrupada por fecha; al borrar vuelve a "Hoy".
  - "Marcar como confirmada": el atajo baja 1, aparece "Confirmada" y persiste tras recargar.
  - Sin errores de JavaScript.
- **No verificado en pantalla:** el caso "Hoy no hay citas" + "Ver próximas" (la óptica de pruebas tiene citas hoy).
- Las 3 citas de prueba (`TEST3 …`) creadas para esto ya se borraron de la óptica de pruebas.

## Decisiones mías que Diego debe revisar

1. **"Limpiar" no cambia el periodo:** quita los filtros del panel y la búsqueda, pero el periodo (Hoy, Próximas…) se cambia solo con sus atajos.
2. **La leyenda de estados sigue dentro de la tarjeta del calendario** (que ya hace de cabecera), no en la fila 2.
3. **El Mes conserva su contador "N citas" dentro de la tarjeta**, repetido con el conteo de la fila 2 (sirve de comprobación independiente); quitarlo si estorba.
4. **"Para reagendar" ignora el filtro de Estado** para que se vean las canceladas aunque "Todas" no las incluya.
5. Menores: el periodo y la búsqueda no llevan etiqueta (ya se ven en sus controles); la tarjeta conserva el distintivo "Por registrar" para citas sin paciente vinculado; el botón "Hoy" de Semana y Mes solo mueve el periodo, ya no borra filtros.

## Pendiente

- **2 citas antiguas de la Demo sin paciente** (óptica `qu7u2j`, ambas Pendiente, origen web, con código y sin cédula):
  - `8a14467d-d38b-4e77-bd6b-5949bb337f45` — Lorena Mero Vélez, 15 oct 2026, 01:40 PM, `lorena.mero@example.com`, 0966739833.
  - `4650a523-c834-4069-805d-9821bdb38d8a` — Rafael Cedeño Pibaque, 8 oct 2026, 09:00 AM, `rafael.cedeno@example.com`, 0923126028.
  - **Decisión de Diego:** vincularlas a su paciente por cédula o nombre, con ensayo previo. **Resultado de la búsqueda hasta ahora:** ninguna de las dos tiene cédula y ningún paciente de la Demo (41) coincide por nombre, teléfono ni correo, así que no se pudieron identificar. **No se ha escrito nada.** Hay que avisarle a Diego antes de hacer nada (crear los pacientes, borrar las citas o dejarlas).
- **Nada se publica en Vercel hasta que Diego apruebe.** Esperando su revisión de la rama `citas-barra-v3` y de los 3 commits de `main`.
- Quitar las capturas cuando Diego las revise (ver abajo).

## Capturas

`C:\Users\diego\Downloads\citas-capturas\v3\` (13 archivos): `v3-lista-inicial`, `v3-lista|semana|mes-` × `sin-filtros|con-filtros|con-busqueda`, `v3-lista-busqueda-otra-semana`, `v3-panel-filtrar`, `v3-tarjeta-confirmada`. En `citas-capturas\` quedan además las de rondas anteriores (`citas-*.png`, `citas2-*.png`, `inicio-*.png`). Esa carpeta la borra Diego (el borrado desde la sesión fue bloqueado por permisos).

## Cómo levantar el servidor local para revisar esta rama

```
git checkout citas-barra-v3
npm run dev
```

Abre la URL que imprime Vite (en esta sesión fue `http://localhost:5176/`; si el puerto está ocupado, usa el siguiente). Para la óptica de pruebas: `?optica=v8twzq`; para la Demo: `?optica=qu7u2j`. Las credenciales están en `.env.test` (E2E_* / DEMO_*).
