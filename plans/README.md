# Plans — improve-animations

Alcance de esta ronda: panel del staff (Citas.jsx, Pacientes.jsx), acotado a los 3 hallazgos pendientes de `docs/ux-audit.md` que el usuario pidió explícitamente. Portal de pacientes y panel superadmin no tuvieron hallazgos pendientes de animación en el reporte; no se auditaron de nuevo en esta ronda.

| # | Plan | Severidad | Categoría | Archivos | Estado |
|---|---|---|---|---|---|
| 001 | [Menú "Más acciones" anclado a su disparador](001-menu-contextual-transform-origin.md) | LOW | Physicality & origin | `index.css`, `Citas.jsx`, `Pacientes.jsx` | DONE |
| 002 | [Duración de `rise-in` consistente en Pacientes](002-rise-in-duracion-consistente.md) | LOW | Cohesion & tokens | `Pacientes.jsx` | DONE |
| 003 | [`transition-all` acotado en 5 botones de Citas](003-citas-transition-all-a-propiedades-acotadas.md) | MEDIUM | Performance | `Citas.jsx` | DONE |

## Orden de ejecución recomendado

Sin dependencias entre los tres — los tres tocan puntos disjuntos del código (uno solo toca `index.css` + los dos menús contextuales; otro solo una línea del historial clínico; otro solo 5 botones de Citas.jsx). Se ejecutaron en el orden 001 → 002 → 003 por prioridad de leverage (001 es el único que toca un archivo compartido, mejor resolverlo primero por si algo más depende del nuevo keyframe).

## Fuera de alcance, detectado durante el audit (no incluido en esta ronda)

- `src/paginas/SuperadminPanel.jsx:3112` tiene el mismo problema que el Plan 001 (menú "Más acciones" reutilizando `modal-in`) — el usuario pidió esta ronda solo para Citas y Pacientes. Candidato natural para un Plan 004 si se quiere cerrar el patrón en las 3 pantallas.
- El resto de los ~82 elementos con `transition-all` en el sistema (docs/ux-audit.md fila 40) fuera de `Citas.jsx` — el Plan 003 solo cubrió los 5 de Citas.jsx pedidos explícitamente.
