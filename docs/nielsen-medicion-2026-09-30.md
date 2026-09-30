# Tercera Medición de Nielsen — Sistema Óptica

**Fecha**: 2026-09-30
**Alcance**: panel de staff (`Dashboard.jsx` + Inicio, Citas, Pacientes, ConsultaMedica, Inventario, CRM, Mensajes, Reportes, Usuarios, Configuracion, Horario, FacturaVentaModal, VentaProductoModal, componentes compartidos de `src/componentes/`), portal de pacientes (`PortalPaciente.jsx`), panel superadmin (`SuperadminPanel.jsx`) — mismo alcance que `docs/ux-audit.md` (2026-09-27) y `docs/nielsen-medicion-final.md` (2026-09-28).
**Metodología**: re-evaluación de las 10 heurísticas de Nielsen con la misma escala 0-4 usada en las dos mediciones previas (puntajes altos = mejor cumplimiento). Cada puntaje se contrasta contra el código actual (archivo:línea) y, cuando cambia respecto a la medición del 28/09, contra el commit que lo explica (`git log`/`git show`).
**Limitación de método**: al igual que la medición del 28/09 (y a diferencia de la del 27/09, que sí tuvo login real en las 3 superficies), esta ronda es **100% lectura de código** — sin navegación en vivo. Los puntajes deben leerse con esa salvedad; el panel superadmin conserva además la nota original de "cobertura en vivo más liviana / menos verificada" de la primera medición. Sin cambios de código ni de datos en esta sesión.

---

## 0. Qué cambió desde la medición del 28/09

Entre `a3473fe` ("docs: medición final de Nielsen", 2026-09-28) y `HEAD` (`c15570c`, 2026-09-30) hay **~70 commits**. La inmensa mayoría son features de una reunión con el ingeniero el 29/09 (`docs/feedback-ing/plan-reunion-29sep.md`) — prácticamente todo el plan de esa reunión (16 puntos + 2 de seguimiento) quedó publicado en `main` hoy. Tres cosas quedaron fuera de esta ronda de cambios:

- **`PortalPaciente.jsx`**: ningún commit lo toca desde el 28/09 (`git log --since="2026-09-28 12:00" -- src/paginas/PortalPaciente.jsx` no devuelve nada posterior a `fca58aa`/`1402dd4`, ambos ya incluidos en la medición anterior). Su puntaje **no cambia** en esta ronda.
- **`SuperadminPanel.jsx`**: un solo cambio posterior a la medición del 28/09, pero es justo el que esa medición dejó pendiente de recalcular — ver punto 1 abajo.
- El resto del panel de staff (Citas, Pacientes, ConsultaMedica, Horario, Inicio, Reportes, Usuarios, Dashboard) recibió trabajo real y concentrado.

### 1. Se cerró la nota pendiente de `SuperadminPanel.jsx` (H3/H4)

La medición del 28/09 decía textualmente: *"los puntajes H3/H4 de esta tabla quedan desactualizados para el superadmin (probablemente subirían), pero no se recalculan aquí (...) una próxima re-medición completa debería reflejarlo"*. Esa re-medición es esta. Los commits `bf8bae4` y `78ac248` (ambos posteriores a `a3473fe`) migraron los 7 modales propios del panel (`SuperadminPanel.jsx:1196-1202`: detalle de óptica, crear óptica, eliminar superadmin, "Mi cuenta", mensaje, aviso, agregar superadmin) a `useModalAccesible` — confirmado por grep, sin modales propios del panel fuera del hook. El hook (`src/utilidades/useModalAccesible.js:34-85`) da Escape + **foco atrapado real** (Tab/Shift+Tab, líneas 58-71) + devolución de foco al cerrar (línea 80), no solo Escape. Se recalculan H3 y H4 de superadmin más abajo.

### 2. Reunión del 29/09 — features nuevas relevantes para Nielsen

| Feature | Commit(s) | Heurística principal |
|---|---|---|
| "Eliminar cita" → "Cancelar cita" (soft, reversible, con badge de quién canceló) | `86960ef` (migración `cancelada_por`), `cb460db` | H5, H3 |
| Modal de resumen antes de "Atender" (Ingresar / Cerrar, este último no cambia estado) | `c62df39` | H5, H1 |
| Confirmar/corregir datos del paciente web al Atender si no fue confirmado por recepción (D2) | `a6ad1a6` (migración `confirmado_recepcion`), `48222c8` | H5 |
| Cobro obligatorio de la consulta antes de marcar "Atendida" (D3) | `ea97531` | H5 |
| Motivo de consulta: `<input type="text">` → `<select>` sobre catálogo de Configuración | `22efbce` | H5, H2 |
| Vista por día/mes en Citas médicas (calendario + modal "Citas del día") | `03df3bc` | H7 |
| Filtro por rango de fechas + filtro por origen (web/recepción) en Citas | `a75920c`, `6001227` | H7 |
| Vista "Mi agenda" para el optómetra (`es_optometra` propagado a sesión) en `Inicio.jsx` | `a220b75`, `12a65a8`, `6b97371` | H7 |
| Notificación de "No asistió" en la campana | `6e55b8e` | H1 |
| Horarios ocupados/libres al editar un día en Mi Horario | `9cc5aad` | H1 |
| Contexto de visita anterior + tendencia histórica movidos al inicio de Refracción | `bd68d92` | H6 |
| Fusión de pestañas "Historial"/"Ficha clínica"; controles clínicos movidos a Historial; "Productos y servicios" separado por línea (no por factura); botón "Enviar mensaje" (WhatsApp) desde el perfil; filtro/badge "De alta"; pestañas con `role="tab"`/`aria-selected` y estilo píldora | `5740c9a`, `c1d0710`, `a6d92a7`, `470c9e2`, `96d821b`, `e606b01` | H4, H6, H7, H2 |
| Métrica "Tratamientos finalizados" + rename "Controles atrasados" en Reportes | `3f63046`, `4c3a8b9` | H2 |

---

## 1. Tabla comparativa por heurística y superficie

Escala 0-4 por heurística (0 = no cumple, 4 = cumple completamente). `n/a` = heurística no aplicable a esa superficie (igual criterio que las dos mediciones previas). Formato de cada celda: **inicial (27/09) → segunda (28/09) → actual (30/09)**.

### Panel de staff

| # Heurística | Inicial | Segunda | Actual | Qué cambió (30/09) |
|---|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | **4** | Ya en el techo. Refuerzan sin subir puntaje: modal de resumen antes de "Atender" (`Citas.jsx:656` `ingresarAFicha`, `:1571`), badge "Cancelada por recepción" vs. "por el paciente" (`Citas.jsx:228`), notificación de "No asistió" en la campana (`Dashboard.jsx:382`), horarios ocupados/libres en Mi Horario (`Horario.jsx`, commit `9cc5aad`). |
| 2. Lenguaje del mundo real | 3 | 3 | **3** | Sin violación puntual documentada que lo tuviera tope en 3 en las mediciones previas — se mantiene el juicio conservador. Mejoras de vocabulario reales pero marginales: "Controles atrasados" (antes "vencidos", `Reportes.jsx`, commit `3f63046`), "De alta" como término clínico/administrativo ya familiar para el staff (`Pacientes.jsx`, commit `96d821b`), motivo de consulta ahora tomado del mismo catálogo que usa Configuración en vez de texto libre inconsistente (`ConsultaMedica.jsx:1578-1589`, commit `22efbce`). No alcanzan para subir de banda sin una violación conocida que cerrar. |
| 3. Control y libertad | 2 | 3 | **3** | **No sube**, a propósito: el motivo exacto que lo tope en 3 en la medición del 28/09 — `ConfirmarCitaModal.jsx`/`ConfirmarFichaModal.jsx` siguen sin foco atrapado (confirmado por grep: solo tienen el `onKeyDown` de Escape agregado a mano, líneas 24-30/20-26 respectivamente; no usan `useModalAccesible`) — sigue exactamente igual. Sí hay avances reales en el espíritu de la heurística que no alcanzan a mover el número: "Cancelar cita" reemplaza un `DELETE` real por un estado reversible y visible en el historial (`Citas.jsx:599,614`, commit `cb460db`), y el modal de resumen antes de "Atender" agrega una salida de emergencia real ("Cerrar" no cambia ningún estado) donde antes se entraba directo a la ficha (commit `c62df39`). |
| 4. Consistencia y estándares | 2 | 3 | **3** | **No sube**, y por la misma razón que en la medición anterior: `transition-all` sin acotar sigue extendido por el sistema — el conteo global subió de ~82 a **98** ocurrencias (`grep -rn "transition-all" src --include=*.jsx \| wc -l`), y el código nuevo de hoy agregó más en vez de menos (`Pacientes.jsx`: 9, `Horario.jsx`: 6, frente a los 5 ya corregidos en `Citas.jsx` en la ronda anterior, que siguen siendo solo 1 ocurrencia nueva — línea 1145, el selector día/mes). Contrapeso real pero puntual: las pestañas del perfil de paciente pasan de `border-b-2` a `role="tab"`/`aria-selected` + estilo píldora (`Pacientes.jsx:1986-2030`, commit `e606b01`), cerrando la mitad del hallazgo de Lote 3 #13 — solo `Configuracion.jsx:283` queda con el indicador `border-b-2` fuera del patrón de píldora del resto del sistema. |
| 5. Prevención de errores | 2 | 3 | **4** | **Sube.** Ningún gap de "eliminar sin confirmación" documentado en las mediciones previas sigue abierto (verificado: `Inventario.jsx`/`Usuarios.jsx` tienen su propio modal de confirmación con `useModalAccesible`; `Configuracion.jsx`/`CRM.jsx` reusan `ConfirmarEliminarModal`). Sobre esa base ya sólida, hoy se suma un bloque grande de prevención real: "Cancelar" reemplaza el borrado irreversible de citas (`cb460db`); el cobro de la consulta es obligatorio antes de poder marcar "Atendida" — ya no se puede saltar el paso (`ConsultaMedica.jsx`, commit `ea97531`, mensaje de error específico en `costoConsultaErrorMsg` cuando el cobro falla pero la ficha sí se guardó); los datos del paciente web se confirman/corrigen antes de entrar a la ficha si recepción no los validó (`Citas.jsx`, commit `48222c8`); el motivo de consulta pasa de texto libre a un `<select>` sobre catálogo, eliminando errores de tipeo/inconsistencia (`ConsultaMedica.jsx:1578-1589`, commit `22efbce`). |
| 6. Reconocer, no recordar | 4 | 4 | **4** | Ya en el techo. Refuerza: el contexto de la visita anterior (valores OD/OI + diagnóstico previo + tendencia entre las últimas 2 consultas) se movió al **inicio** de Refracción en vez de aparecer solo al final como panel "en vivo" (`ConsultaMedica.jsx`, commit `bd68d92`) — el optómetra ya no tiene que recordar los valores de la visita pasada mientras refracta. |
| 7. Flexibilidad y eficiencia | 3 | 3 | **4** | **Sube.** La razón documentada de por qué se quedaba en 3 en ambas mediciones previas era explícita: *"sin cambios — no se agregaron atajos ni funciones de power-user en ninguna ronda"*. Esa razón ya no aplica: filtro por rango de fechas (`Citas.jsx:872` `rangoDesde/rangoHasta`, commit `a75920c`), filtro por origen web/recepción (`Citas.jsx:313,843-844`, commit `6001227`), vista alternable día/mes con calendario (`Citas.jsx:906,1003-1004,1121`, commit `03df3bc`), y vista "Mi agenda" que adapta Inicio.jsx al rol del usuario marcado optómetra en vez de mostrarle siempre la vista global del equipo (`Inicio.jsx:58-59,601`, commits `a220b75`+`12a65a8`+`6b97371`) son funciones reales de eficiencia/personalización para el usuario frecuente, no decorativas. |
| 8. Diseño estético y minimalista | 3 | 3 | **3** | **No sube.** Motivo documentado sin cambios: botones de acción por fila (~28×28px) siguen bajo el blanco de toque de 44×44px en casi todo el sistema — confirmado por grep de `ACCION_VER/ACCION_EDITAR/ACCION_ELIMINAR`: `Citas.jsx`, `Inventario.jsx` (×3), `Usuarios.jsx` (×2) y `SuperadminPanel.jsx` siguen en `p-1.5` (~28px). Única mejora parcial: `Pacientes.jsx` subió a `p-2` (~32px) en sus botones de fila reescritos esta ronda — sigue bajo 44px, no cierra el hallazgo. |
| 9. Recuperación de errores | 3 | 3 | **3** | Sin motivo documentado para bajar ni evidencia suficiente para subir. El nuevo flujo de cobro obligatorio agrega un caso bueno adicional (mensaje específico y no técnico cuando la ficha se guarda pero el cobro falla: *"La ficha clínica se guardó correctamente, pero el cobro de la consulta no se pudo registrar: ..."*, `ConsultaMedica.jsx`, commit `ea97531`), consistente con el patrón ya elogiado en ambas mediciones previas, pero no es un cambio de gap conocido — se mantiene. |
| 10. Ayuda y documentación | 1 | 1 | **1** | Sin cambios, confirmado: `Dashboard.jsx:941` sigue diciendo *"Contactá a soporte si esto es un error"* sin link ni canal clickeable — es texto plano dentro del banner de suspensión, igual que en las dos mediciones anteriores. Ninguna de las ~70 features de esta ronda tocó ayuda/documentación. |
| **Total** | **27/40** | **30/40** | **32/40** | |
| Banda | Aceptable | Aceptable | **Bien** | Cruza el umbral (80%) en esta medición. |

### Portal de pacientes

| # Heurística | Inicial | Segunda | Actual | Qué cambió (30/09) |
|---|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | **4** | Sin cambios — `PortalPaciente.jsx` no fue tocado desde el 28/09. |
| 2. Lenguaje del mundo real | 4 | 4 | **4** | Sin cambios. |
| 3. Control y libertad | 3 | 4 | **4** | Sin cambios. |
| 4. Consistencia y estándares | 2 | 3 | **3** | Sin cambios — motivo documentado sigue igual: 4 botones en `transition-all` sin acotar (`PortalPaciente.jsx:461,832,871,954`), confirmado sin cambios por grep (6 ocurrencias totales del string en el archivo, mismas líneas). |
| 5. Prevención de errores | 3 | 3 | **3** | Sin cambios. |
| 6. Reconocer, no recordar | 4 | 4 | **4** | Sin cambios. |
| 7. Flexibilidad y eficiencia | n/a | n/a | **n/a** | No aplicable, igual que antes. |
| 8. Diseño estético y minimalista | 4 | 4 | **4** | Sin cambios — `OjoReceta` (`PortalPaciente.jsx:1045`) sigue en `text-[10px]` para "Esfera · Cilindro · Eje", confirmado sin cambios por grep. |
| 9. Recuperación de errores | 3 | 3 | **3** | Sin cambios. |
| 10. Ayuda y documentación | 2 | 2 | **2** | Sin cambios — sin mención de soporte/ayuda en el portal (confirmado por grep, 0 coincidencias). |
| **Total** | **29/36** | **31/36** | **31/36** | Sin cambios — la superficie no recibió trabajo esta ronda. |
| Banda | Bien | Bien | **Bien** | |

### Panel superadmin

| # Heurística | Inicial | Segunda | Actual | Qué cambió (30/09) |
|---|---|---|---|---|
| 1. Visibilidad del estado | 3 | 4 | **4** | Sin cambios esta ronda (subió en la medición anterior por el fix del toast). |
| 2. Lenguaje del mundo real | 3 | 3 | **3** | Sin cambios. |
| 3. Control y libertad | 3 | 3 | **4** | **Sube — cierra la nota pendiente de la medición del 28/09.** Los 7 modales propios del panel (`SuperadminPanel.jsx:1196-1202`) están migrados a `useModalAccesible`, confirmado por grep: no queda ningún modal del panel fuera del hook. El hook da foco atrapado real (Tab/Shift+Tab) y devolución de foco, no solo Escape (`useModalAccesible.js:58-80`) — el mismo nivel que ya tenían Staff y Portal. |
| 4. Consistencia y estándares | 3 | 3 | **4** | **Sube**, misma razón que H3: el panel ya usa el mismo patrón de accesibilidad de modales que el resto del sistema, cerrando la inconsistencia que lo tenía en 3 ("sus propios modales no fueron migrados"). El menú "Más acciones" (`SuperadminPanel.jsx:3112` aprox., sin `transform-origin` propio) sigue pendiente, pero es un hallazgo de animación de severidad Baja — no es el motivo que documentaron las dos mediciones previas para el tope en 3, así que no bloquea el salto a 4. |
| 5. Prevención de errores | 2 | 2 | **2** | Sin cambios — `SuperadminPanel.jsx` no recibió trabajo funcional nuevo esta ronda. |
| 6. Reconocer, no recordar | 3 | 4 | **4** | Sin cambios esta ronda. |
| 7. Flexibilidad y eficiencia | 3 | 3 | **3** | Sin cambios. |
| 8. Diseño estético y minimalista | 3 | 3 | **3** | Sin cambios — botones de acción de fila siguen en `p-1.5` (`SuperadminPanel.jsx`), confirmado por grep. |
| 9. Recuperación de errores | n/a | n/a | **n/a** | No aplicable, igual que antes. |
| 10. Ayuda y documentación | 1 | 1 | **1** | Sin cambios. |
| **Total (convención original /32)** | **24/32** | **26/32** | **28/32** | Ver nota de método abajo — este denominador es el mismo que usan las dos mediciones previas, preservado aquí solo para comparabilidad directa con esas tablas. |
| **Total (denominador correcto /36)** | 24/36 (66.7%) | 26/36 (72.2%) | **28/36 (77.8%)** | 9 heurísticas puntuadas (todas menos H9) × 4 = 36, no 32. |
| Banda (con /32, como en los reportes previos) | Aceptable | Bien | **Bien** | |
| Banda (con /36, matemáticamente correcta) | Aceptable | Aceptable | **Aceptable** (77.8%, cerca del umbral de 80% pero sin cruzarlo) | |

> **Nota de método — corrección a la medición del 28/09**: las dos mediciones previas (`docs/ux-audit.md` y `docs/nielsen-medicion-final.md`) puntúan 9 heurísticas para superadmin (todas salvo H9, marcada `n/a`), pero dividen por **32** en vez de 36 (9 × 4) en ambos documentos — un error aritmético consistente, no un criterio intencional documentado. Bajo ese denominador equivocado, la medición del 28/09 concluía que *"el panel superadmin cruza el umbral de 'Aceptable' a 'Bien' (75% → 81.25%)"*. Con el denominador correcto, esa medición da **72.2%**, y **nunca cruzó a "Bien"**. La medición de hoy (77.8% con /36) tampoco cruza, aunque se acerca. Se preserva la fila `/32` en la tabla solo para que el lector pueda comparar número contra número con los dos documentos anteriores tal como quedaron escritos; la fila `/36` es la que debe leerse como correcta.

---

## 2. Totales por superficie — resumen

| Superficie | Inicial (27/09) | Segunda (28/09) | Actual (30/09) |
|---|---|---|---|
| Panel de staff | 27/40 (67.5%) — Aceptable | 30/40 (75%) — Aceptable | **32/40 (80%) — Bien** |
| Portal de pacientes | 29/36 (80.6%) — Bien | 31/36 (86.1%) — Bien | **31/36 (86.1%) — Bien** |
| Panel superadmin | 24/36 (66.7%) — Aceptable¹ | 26/36 (72.2%) — Aceptable¹ | **28/36 (77.8%) — Aceptable¹** |

¹ Porcentaje recalculado con el denominador correcto (/36); ver nota de método arriba. Con la convención `/32` de los dos reportes anteriores, los mismos puntajes dan 75% / 81.25% / 87.5%.

**Suma combinada de las 3 superficies** (con denominadores correctos, 40+36+36=112): **80/112 (71.4%) → 88/112 (78.6%) → 91/112 (81.3%)**.

---

## 3. Principales mejoras que explican la evolución, con commits

1. **Panel de staff cruza de "Aceptable" a "Bien"** (75% → 80%), impulsado por tres heurísticas que subieron un nivel completo:
   - **H5 (Prevención de errores, 3→4)**: cancelar-no-eliminar citas (`86960ef`, `cb460db`), cobro obligatorio de la consulta antes de "Atendida" (`ea97531`), confirmación de datos del paciente web al Atender (`a6ad1a6`, `48222c8`), motivo de consulta por catálogo en vez de texto libre (`22efbce`).
   - **H7 (Flexibilidad y eficiencia, 3→4)**: filtro por rango de fechas (`a75920c`), filtro por origen (`6001227`), vista día/mes (`03df3bc`), vista "Mi agenda" por rol (`a220b75`, `12a65a8`, `6b97371`).
   - Aporte adicional sin cambiar de heurística de techo: contexto de visita anterior al inicio de Refracción reforzando H6 (`bd68d92`).
2. **Panel superadmin cierra la nota pendiente de la medición anterior** (H3 y H4, ambas 3→4): migración completa de los 7 modales propios a `useModalAccesible` (`bf8bae4`, `78ac248`), con foco atrapado real, no solo Escape.
3. **Corrección metodológica**: el denominador `/32` usado en ambas mediciones previas para superadmin era aritméticamente incorrecto (debía ser `/36`); la afirmación de la medición del 28/09 de que superadmin había cruzado a "Bien" no se sostiene con el denominador correcto. Documentado en la nota de método de la sección 1.
4. **Portal de pacientes no se movió** — no recibió ningún commit desde la medición del 28/09; se mantiene en 31/36.

---

## 4. Problemas pendientes (trabajo futuro), ordenados por severidad

### Medio
1. **Blancos de toque <44px en botones de acción por fila** (H8) — `Citas.jsx`, `Inventario.jsx` (×3), `Usuarios.jsx` (×2), `SuperadminPanel.jsx` siguen en `p-1.5` (~28px); `Pacientes.jsx` mejoró a `p-2` (~32px) pero tampoco llega a 44px. Sistema completo, sin resolver en ninguna de las 3 mediciones.
2. **Canal de soporte inexistente** (H10) — la heurística más débil de las 3 superficies en las 3 mediciones (Staff 1, Superadmin 1, Portal 2). `Dashboard.jsx:941` menciona "soporte" sin link ni canal clickeable. Ninguna ronda de correcciones lo atacó todavía.
3. **`transition-all` sin acotar, creciendo en vez de achicarse** (H4) — 98 ocurrencias en todo el sistema (antes ~82), incluyendo código nuevo de esta ronda (`Pacientes.jsx`: 9, `Horario.jsx`: 6). Solo los 5 de `Citas.jsx` de una ronda anterior siguen resueltos.

### Bajo
4. **`ConfirmarCitaModal.jsx`/`ConfirmarFichaModal.jsx` sin foco atrapado** (H3) — tienen Escape hand-rolled y `role="dialog"`/`aria-modal`, pero no usan `useModalAccesible`; es el único motivo que sigue topando H3 del panel de staff en 3 en vez de 4.
5. **Indicador de pestañas inconsistente, ahora solo en `Configuracion.jsx`** (H4) — `Pacientes.jsx` migró a `role="tab"`+píldora esta ronda (commit `e606b01`); `Configuracion.jsx:283` sigue con `border-b-2`, el único lugar del sistema con ese patrón.
6. **`SuperadminPanel.jsx` — menú "Más acciones" sin `transform-origin` propio** (review-animations / H4) — sigue reusando la animación de modal centrado para un menú anclado a su disparador, mismo patrón ya corregido en `Citas.jsx`/`Pacientes.jsx`. Candidato explícito a un Plan 004 según `plans/README.md`.
7. **`PortalPaciente.jsx` — `OjoReceta` en `text-[10px]`** (H8/legibilidad) — "Esfera · Cilindro · Eje" sigue bajo el mínimo práctico de legibilidad ya corregido en CRM/Citas/ConsultaMedica.
8. **`PortalPaciente.jsx` — 4 botones en `transition-all` sin acotar** (H4) — líneas 461, 832, 871, 954, sin tocar.
9. **MFA no obligatorio para el rol `admin`** (H5, ángulo de seguridad) — registrado como decisión pendiente desde la primera medición, no defecto.
10. **`Dashboard.jsx:323` usa `window.confirm()` nativo del navegador en vez del patrón de modal propio del sistema** (H4, no reportado en las dos mediciones anteriores) — el aviso de "cambios sin guardar en la ficha clínica" es el único punto de confirmación del sistema que rompe la consistencia visual (diálogo nativo del navegador, sin estilo, en vez del patrón `modal-in`/`ConfirmarCitaModal` usado en el resto del sistema para confirmaciones similares).

---

## Referencias

- Medición inicial: `docs/ux-audit.md` (2026-09-27, tabla "Puntaje Nielsen por superficie").
- Segunda medición: `docs/nielsen-medicion-final.md` (2026-09-28).
- Plan de la reunión que explica la mayoría de los cambios de esta ronda: `docs/feedback-ing/plan-reunion-29sep.md`.
