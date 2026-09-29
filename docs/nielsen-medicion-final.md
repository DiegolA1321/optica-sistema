# Medición Final de Nielsen — Sistema Óptica

**Fecha**: 2026-09-28
**Alcance**: panel de staff, portal de pacientes, panel superadmin (mismo alcance que la auditoría original del 2026-09-27, documentada en `docs/ux-audit.md`).
**Metodología**: re-evaluación de las 10 heurísticas de Nielsen con la misma escala 0-4 por heurística usada en `docs/ux-audit.md` (puntajes altos = mejor cumplimiento), aplicada tras varias rondas de correcciones desde la auditoría original. Solo lectura — sin modificación de código ni datos.
**Limitación de metodología**: a diferencia de la auditoría original (verificada en vivo con login real en las 3 superficies), esta medición es 100% basada en lectura de código — el entorno de esta ronda no tuvo acceso a herramientas de navegador. Los puntajes deben leerse con esa salvedad; el panel superadmin arrastra además la nota original de "cobertura en vivo más liviera / menos verificada".

## Qué se corrigió desde la auditoría original (2026-09-27)

Accesibilidad de modales (Escape, foco atrapado, `role="dialog"`) en 24 modales del sistema; dirty-tracking con aviso de cambios sin guardar en la ficha clínica; confirmación antes de eliminar en Configuración y CRM; skeletons que calcan la forma real del contenido en Mensajes, Horario y Citas; toasts del superadmin con salida animada y sin carrera de temporizadores; guard de `prefers-reduced-motion` menos brusco; `autoComplete` en 4 formularios; `:focus-visible` en 17 archivos; tooltips/`aria-label` en botones de solo ícono; más densidad de información en Inicio/Citas/Pacientes/ConsultaMedica; animación del menú contextual y `transition-all` acotado en Citas.jsx; duración de `rise-in` estandarizada en Pacientes.jsx.

## Hallazgos actuales (post-correcciones)

| Pantalla/Componente | Problema | Heurística afectada | Severidad | Estado |
|---|---|---|---|---|
| ~~`SuperadminPanel.jsx` — modales propios (crear óptica, editar administrador, eliminar admin/superadmin, "Mi cuenta", aviso, mensaje)~~ | 0 ocurrencias de `useModalAccesible` confirmadas por grep — el Lote 1 ("24 de 28 modales") migró los modales del panel de staff y el portal de pacientes, pero no tocó este panel. Tienen Escape funcional vía un handler propio bien construido (con guards contra cerrar mientras hay un guardado en curso), pero les falta `role="dialog"`, `aria-modal` y foco atrapado. | H3 (Control y libertad), H4 (Consistencia) | Medio | ✅ **Resuelto** (commits `feat: accesibilidad en modales del superadmin` y `feat: accesibilidad completa en modales del superadmin`). Los 7 modales propios del panel — "Crear óptica", detalle de óptica (con su confirmación inline de eliminar admin), "Quitar superadmin", "Mi cuenta", "Nuevo aviso", detalle de mensaje y "Agregar superadmin" — migrados a `useModalAccesible`, cada `onCerrar` replicando exactamente la condición de cierre que ya tenía. El viejo handler global de Escape (que coordinaba los 8 modales por prioridad) se eliminó: ya no tiene ningún modal que gestionar. Lo único que le quedaba — cerrar el menú "Más acciones" con Escape — se re-hogó en un `useEffect` propio y mínimo, sin cambiar ese comportamiento. |
| `SuperadminPanel.jsx:3112` — menú "Más acciones" | Sigue en `modal-in 120ms` sin `transform-origin` (no es un modal — es un menú anclado a su disparador — por eso no entró en este hallazgo ni en su fix). Mismo problema que tenían Citas.jsx/Pacientes.jsx antes del fix de esa rama. Fuera de alcance explícito (ver `plans/README.md`, candidato a un Plan 004). | review-animations — Physicality & origin | Bajo | Pendiente |
| `PortalPaciente.jsx:1045` (`OjoReceta`) | "Esfera · Cilindro · Eje" en `text-[10px]` — texto descriptivo real (no un eyebrow decorativo), por debajo del mínimo de legibilidad ya corregido en CRM/Citas/ConsultaMedica en rondas previas. | H8 (Estética y diseño minimalista) / legibilidad | Bajo | Pendiente |
| `PortalPaciente.jsx` — 4 botones (líneas 461, 832, 871, 954) | Siguen en `transition-all` sin acotar — no incluidos en la limpieza que se hizo solo en `Citas.jsx`. | H4 (Consistencia) / performance | Bajo | Pendiente |
| `Citas.jsx` — `ConfirmarCitaModal.jsx`, `ConfirmarFichaModal.jsx` | Ya tenían Escape antes del Lote 1 y quedaron fuera de esa migración a propósito — siguen sin foco atrapado. Documentado como follow-up desde el cierre del Lote 1, no resuelto aún. | H3 (Control y libertad) | Bajo | Pendiente |
| Botones de acción por fila (ver/editar/eliminar/vender) en las 3 superficies | ~28×28px, siguen por debajo del blanco de toque de 44×44px. Hallazgo ya trackeado (`docs/ux-audit.md` fila 35), sin cambios esta ronda. | H8 (Estética y diseño minimalista) | Medio | Pendiente |
| Las 3 superficies — canal de soporte/ayuda | Sigue sin existir un centro de ayuda o canal de soporte clickeable en ninguna de las 3 superficies. Es la heurística con el puntaje más bajo en las 3 mediciones (H10), y no fue atacada en ninguna ronda de correcciones hasta ahora. | H10 (Ayuda y documentación) | Medio | Pendiente |

## Hallazgos positivos nuevos (no estaban en el reporte original)

- **Panel de staff**: la barra sticky de identidad del paciente en `ConsultaMedica.jsx` (~línea 1122) reduce carga de memoria en formularios largos, sin haber sido pedida como fix de una heurística específica.
- **Panel de staff**: el badge "Registrado"/"No registrado" en los acordeones colapsados de la ficha clínica es legible a `text-xs` (antes 10px) — cierre incidental de un hallazgo de legibilidad que también refuerza H6.
- **Portal de pacientes**: los 5 modales migrados tienen `role="dialog"` + `aria-modal="true"` + `aria-labelledby` correctamente enlazado a su título, verificado uno por uno.
- **Portal de pacientes**: `SelectorFechaHora` se reutiliza idéntico entre "Agendar" y "Reagendar" — mismo componente, cero duplicación de lógica de disponibilidad.
- **Panel superadmin**: el handler de Escape centralizado con prioridad por capa (líneas 835-852) es un patrón más cuidado que un simple `onKeyDown` por modal — cierra el guardado en curso antes de permitir cerrar.
- **Panel superadmin**: el fix de la carrera de temporizadores del toast fue puntual y con cleanup en desmontaje, sin dejar timers huérfanos.

## Puntaje Nielsen por superficie — medición actual

| # Heurística | Staff | Portal paciente | Superadmin* |
|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | 4 |
| 2. Lenguaje del mundo real | 3 | 4 | 3 |
| 3. Control y libertad | 3 | 4 | 3 |
| 4. Consistencia y estándares | 3 | 3 | 3 |
| 5. Prevención de errores | 3 | 3 | 2 |
| 6. Reconocer, no recordar | 4 | 4 | 4 |
| 7. Flexibilidad y eficiencia | 3 | n/a | 3 |
| 8. Diseño estético y minimalista | 3 | 4 | 3 |
| 9. Recuperación de errores | 3 | 3 | n/a |
| 10. Ayuda y documentación | 1 | 2 | 1 |
| **Total** | **30/40** | **31/36** | **26/32** |
| Banda | Aceptable | Bien | Bien |

*Superadmin: medición 100% basada en código esta ronda (sin login en vivo) — mantener la reserva de "cobertura más liviera" del reporte original, ahora agravada.

Bandas aplicadas consistentemente con los 3 puntos de datos del reporte original (Aceptable ≈67-79%, Bien ≥80%): **el panel superadmin cruza el umbral de "Aceptable" a "Bien"** (75% → 81.25%) en esta medición — es el único de los tres que cambia de banda.

**Nota post-medición (2026-09-28, después de esta tabla)**: se migraron los 7 modales propios del panel superadmin (crear óptica, detalle de óptica, eliminar superadmin, Mi cuenta, aviso, mensaje, agregar superadmin) a `useModalAccesible` en dos rondas — ver hallazgo resuelto arriba. Los puntajes H3/H4 de esta tabla quedan desactualizados para el superadmin (probablemente subirían), pero no se recalculan aquí para no mezclar una medición con una corrección puntual posterior — una próxima re-medición completa debería reflejarlo.

## Tabla comparativa — puntaje inicial (2026-09-27) vs. puntaje nuevo (2026-09-28)

| Heurística | Staff orig. → nuevo | Portal orig. → nuevo | Superadmin orig. → nuevo | Qué cambió |
|---|---|---|---|---|
| 1. Visibilidad del estado | 4 → 4 | 4 → 4 | 3 → **4** | Superadmin sube: toast con salida animada y sin carrera de temporizadores (antes desaparecía de golpe y podía duplicarse). |
| 2. Lenguaje del mundo real | 3 → 3 | 4 → 4 | 3 → 3 | Sin cambios de copy/terminología en ninguna ronda de correcciones. |
| 3. Control y libertad | 2 → **3** | 3 → **4** | 3 → 3 | Staff y Portal suben: los 24 modales reales del sistema migrados a `useModalAccesible` (Escape + foco atrapado + `role="dialog"`). Portal llega al techo (sus 5 modales, todos migrados); Staff no llega a 4 porque `ConfirmarCitaModal`/`ConfirmarFichaModal` siguen sin foco atrapado. Superadmin sin cambio: sus propios modales no fueron migrados (ver hallazgo nuevo arriba). |
| 4. Consistencia y estándares | 2 → **3** | 2 → **3** | 3 → 3 | Staff y Portal suben: `:focus-visible` unificado, `ConfirmarEliminarModal` reusado, toggles con `transition-transform` consistente. Ninguno llega a 4: `transition-all` sigue sin acotar en el resto del sistema (~77 elementos fuera de Citas.jsx). Superadmin sin cambio directo. |
| 5. Prevención de errores | 2 → **3** | 3 → 3 | 2 → 2 | Staff sube: confirmación antes de eliminar en Configuración/CRM + dirty-tracking en la ficha clínica cierran dos gaps reales. Portal y Superadmin ya tenían su propio flujo de confirmación desde antes, sin cambio. |
| 6. Reconocer, no recordar | 4 → 4 | 4 → 4 | 3 → **4** | Superadmin sube: tooltips/`aria-label` agregados en los botones de solo ícono que no los tenían (limpiar filtro, guardar/cancelar nombre, regenerar código, imprimir factura). Staff y Portal ya estaban en el techo. |
| 7. Flexibilidad y eficiencia | 3 → 3 | n/a | 3 → 3 | Sin cambios — no se agregaron atajos ni funciones de power-user en ninguna ronda. |
| 8. Diseño estético y minimalista | 3 → 3 | 4 → 4 | 3 → 3 | Mejora real de densidad (Inicio, Citas) pero ningún puntaje sube de banda: los botones de acción de fila (~28×28px) siguen bajo el blanco de toque de 44px en las 3 superficies. |
| 9. Recuperación de errores | 3 → 3 | 3 → 3 | n/a | Sin cambios dirigidos — los mensajes de error específicos con reintento ya eran fuertes y no se tocaron. |
| 10. Ayuda y documentación | 1 → 1 | 2 → 2 | 1 → 1 | Sin cambio en ninguna superficie — sigue siendo la heurística más débil de las 3 mediciones, nunca atacada en ninguna ronda de correcciones. |
| **Total** | **27/40 → 30/40** | **29/36 → 31/36** | **24/32 → 26/32** | Suma combinada de las 3 superficies: **80/108 (74%) → 87/108 (81%)**. |
