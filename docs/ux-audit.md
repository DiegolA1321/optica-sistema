# Auditoría de UX/UI — Sistema Óptica

**Fecha**: 2026-09-27
**Alcance**: panel de staff (`Dashboard.jsx` + Inicio, Citas, Pacientes, ConsultaMedica, Inventario, CRM, Mensajes, Reportes, Usuarios, Configuracion, Horario, FacturaVentaModal, VentaProductoModal, y los componentes compartidos en `src/componentes/`), portal de pacientes (`PortalPaciente.jsx`), panel superadmin (`SuperadminPanel.jsx`).
**Fuera de alcance** (no revisado, a pedido): `PaginaVenta.jsx`, `Login.jsx`, `AgendarCitaPublica.jsx`, `ConfirmarCita.jsx`, `EncuestaSatisfaccion.jsx`, `PaginaLegal.jsx`.
**Sin cambios de código** — este documento es solo diagnóstico.

## Metodología

Cuatro lentes independientes, cada una aplicada a las 3 superficies por separado y luego consolidadas aquí:

1. **impeccable audit + critique** — 5 dimensiones técnicas (a11y, performance, theming, responsive, integridad de implementación) + heurísticas de Nielsen + especificidad de diseño. Incluyó `impeccable detect --json` sobre `src/paginas`/`src/componentes` (224 hallazgos crudos, cada uno verificado en contexto — 18 fueron falsos positivos del detector, documentados abajo).
2. **web-design-guidelines** — formularios, estados de carga, foco y navegación por teclado, contra la guía oficial de Web Interface Guidelines.
3. **nielsen-heuristics-audit** — evaluación dedicada y puntuada de las 10 heurísticas de Nielsen, por separado en cada una de las 3 superficies.
4. **review-animations** (Emil Kowalski, corrida directamente por Diego vía `/review-animations` — esta skill no se puede invocar desde un subagente) — animaciones y transiciones contra los 10 estándares no negociables de la skill.

Las 3 primeras corrieron como sub-agentes paralelos de solo lectura con inicio de sesión real en https://optica-sistema-zeta.vercel.app (staff, superadmin y paciente) para verificar en vivo lo que el código sugería; la cuarta corrió en esta misma conversación. Ningún hallazgo modificó datos ni código.

### Nota sobre falsos positivos descartados

El detector de `impeccable` marcó 18 casos de "texto gris ilegible sobre fondo de color" que resultaron ser falsos positivos: empareja la clase de texto en reposo con una clase `hover:` del mismo elemento como si coexistieran. Contraste real verificado del par más común: **9.51:1** (excelente). No aparecen en la tabla.

### Hallazgo confirmado por 3 lentes independientes (alta confianza)

El problema de modales sin cierre por Escape fue encontrado **de forma independiente** por `impeccable audit`, `web-design-guidelines` y `nielsen-heuristics-audit`, cada uno leyendo el código por su cuenta y verificando en vivo. Se reporta como una sola fila abajo, no tres.

## Tabla de hallazgos

| Pantalla/Componente | Problema | Skill/Heurística | Severidad | Solución propuesta |
|---|---|---|---|---|
| ~~24 de 28 modales del sistema: `Citas.jsx` (5), `Inventario.jsx` (4), `PortalPaciente.jsx` (5), `Usuarios.jsx` (2), `Horario.jsx` (3), `CRM.jsx`, `Configuracion.jsx`, `FacturaVentaModal.jsx`, `VentaProductoModal.jsx`, `Dashboard.jsx` (modal "Mi cuenta")~~ | No cierran con tecla Escape ni declaran `role="dialog"`/`aria-modal`. `ConsultaMedica.jsx` y el command palette de `Dashboard.jsx` sí lo hacen correctamente — el patrón bueno existe en el código, solo no se propagó. Verificado en vivo: Escape no cerró el modal "Mi cuenta" (2 intentos). *(Conteo original del hallazgo: "19 de 28" — no cerraba matemáticamente con su propio desglose por archivo, y `Horario.jsx` resultó tener 3 modales en el código, no 2. El número real, contado modal por modal al migrar, es 24.)* | impeccable audit (Accessibility, WCAG 4.1.2) + web-design-guidelines (Keyboard navigation) + nielsen-heuristics-audit (Heurística 3: Control y libertad, Heurística 4: Consistencia) | **Alto** | ✅ **Resuelto** (commit `1402dd4`, "feat: accesibilidad compartida en modales"). Hook compartido `src/utilidades/useModalAccesible.js` — Escape, foco atrapado (Tab/Shift+Tab), devolución de foco al elemento disparador. Migrados los 24 modales reales; sin tocar `ConfirmarCitaModal.jsx`/`ConfirmarFichaModal.jsx`/`ConfirmarVentaModal` (ya tenían Escape, quedan sin foco atrapado — no estaban en el hallazgo original, follow-up de consistencia si se quiere). |
| ~~`PortalPaciente.jsx:386` — encabezado del sidebar~~ | El wordmark del portal está hardcodeado como literal "Diego Óptica" en JSX, sin leer `usuario?.opticaNombre`. Verificado en vivo: un paciente de "Óptica Solna Vision" ve "Diego Óptica" en su propio portal. `Dashboard.jsx:585` resuelve el mismo bloque visual correctamente con `usuario?.opticaNombre \|\| "Mi Óptica"`. | nielsen-heuristics-audit — Heurística 4 (Consistencia) y Heurística 2 (Lenguaje del mundo real) | **Alto** | ✅ **Resuelto** (commit `fbcfaa9`, "fix: nombre de óptica en portal y animación del Ctrl+K"). El fix real terminó siendo `opticaPublica?.nombre` en vez de `usuario?.opticaNombre` — ese campo no existe en el objeto de sesión del paciente (`mapPaciente` nunca lo incluyó), habría caído siempre al fallback "Mi Óptica". |
| ~~`ConsultaMedica.jsx` — ficha clínica (formulario por acordeones)~~ | Sin guardia de navegación (`beforeunload` o interno): si el usuario sale a mitad de un diagnóstico/receta sin guardar, pierde el trabajo sin aviso. Confirmado por grep: 0 usos de `beforeunload` en todo el proyecto. Dato clínico, costo de pérdida alto. | web-design-guidelines — Forms (unsaved changes) | **Alto** | ✅ **Resuelto** (commit `e2ca775`, "feat: aviso de cambios sin guardar en ficha clínica"). Dirty-tracking real sobre los campos clínicos (no solo "hay paciente seleccionado"), `beforeunload` + aviso al navegar a otra sección dentro de la app (interceptado en el chokepoint `navegar()` de `Dashboard.jsx`), verificado en vivo con login real. |
| ~~Command palette Ctrl+K (`Dashboard.jsx` ~1043-1048)~~ | Se abre con la misma animación `modal-in 180ms` que cualquier diálogo — pero es una acción disparada por teclado y de uso frecuente para el personal (el usuario primario que `PRODUCT.md` describe necesitando velocidad). Las acciones iniciadas por teclado no deberían llevar animación. | review-animations — Estándar 2 (Frequency-appropriate) | **Alto** | ✅ **Resuelto** (commit `fbcfaa9`). Animación removida del todo (abre instantáneo). |
| Botones de acción por fila (ver/editar/eliminar/vender, patrón `ACCION_*` de `tema.js`) en Pacientes, Citas, Inventario, Usuarios, CRM, Mensajes, SuperadminPanel | Miden ~28×28px — por debajo del mínimo de 44×44px para blanco de toque, repetido en prácticamente toda tabla del sistema. | impeccable audit — Responsive Design (touch targets) | Medio | Aumentar el padding (`p-1.5` → `p-2.5`) o agregar un hit-area invisible más grande sin cambiar el tamaño visual del ícono. |
| `Configuracion.jsx` (función `eliminar`) y `CRM.jsx` (función `eliminarAviso`) | Borran directamente al primer click, sin modal de confirmación — mientras `Citas.jsx` sí pide confirmación para cancelar una cita (acción destructiva comparable). | nielsen-heuristics-audit — Heurística 5 (Prevención de errores) y Heurística 4 (Consistencia) | Medio | Reusar el modal de confirmación que ya existe en `Citas.jsx` para estas dos acciones. |
| `Mensajes.jsx:262-263` y `Horario.jsx:875-877` | Estado de carga muestra solo texto plano ("Cargando…" / "Cargando tu horario...") en vez del patrón de skeleton ya establecido (`TablaSkeleton`/`animate-pulse`) — contradice la regla propia del proyecto de no mostrar pantallas vacías. `Horario.jsx` además usa "..." en vez de "…". | web-design-guidelines — Loading states | Medio | Reemplazar por skeletons con la forma del contenido real (lista de mensajes / grilla semanal); corregir el carácter de elipsis en `Horario.jsx`. |
| Panel de staff y panel superadmin completos | No existe centro de ayuda, FAQ ni tour. La única mención de "soporte" (`Dashboard.jsx:914`, banner de suspensión) no tiene link ni canal clickeable. Pesa menos de lo normal porque el usuario primario es personal entrenado de uso diario, no un primerizo (`PRODUCT.md`). | nielsen-heuristics-audit — Heurística 10 (Ayuda y documentación) | Medio | Agregar un link/email real donde se menciona "soporte", o quitar la promesa si no existe canal. |
| `Configuracion.jsx:25`, `CRM.jsx:369` — knobs de toggle switch | Animan la propiedad `left` (layout) vía `transition-all`, en vez de `transform`. Confirmado en vivo por computed style: `transitionProperty: "all"`. | review-animations — Estándar 7 (GPU-only properties) | Medio | Cambiar a `transition-transform` + `translate-x-0`/`translate-x-5` en el knob. |
| ~82 elementos en todo el sistema (botones, tarjetas, ítem de nav activo — ej. `Inicio.jsx:325`, `Dashboard.jsx:607`, `Citas.jsx:80`) | Usan `transition-all` como transición por defecto — animación de propiedad sin acotar, el disparador de escalamiento #1 de la skill de animaciones. | review-animations — Escalation trigger (transition: all) | Medio | Acotar a las propiedades reales que cambian por elemento (típicamente `transform`, `box-shadow`). |
| Toast flotante de `SuperadminPanel.jsx:2888-2903` | Entra animado (`rise-in 220ms`) pero se retira con un `setTimeout` que desmonta el elemento sin transición de salida — aparece con cuidado, desaparece de golpe. | review-animations — Pulido / asimetría entrada-salida | Medio | Animar la salida (clase `data-state` + transición de opacity/translateY) antes de desmontar. |
| `SuperadminPanel.jsx:419-422` (`mostrarToast`) | Cada llamada agenda un `setTimeout(3000ms)` sin limpiar uno previo pendiente — dos toasts en menos de 3s corren una carrera de temporizadores (verificado por lectura de código, no disparado en vivo). | review-animations — Estándar 6 (Interruptibility) | Medio | Guardar el id del timeout y `clearTimeout` antes de agendar uno nuevo. |
| Guardia global `prefers-reduced-motion` en `src/index.css` | Reduce `animation-duration`/`transition-duration` a `0.01ms !important` en todo el sistema — funciona (nada se rompe) pero es la versión más brusca del patrón recomendado ("más suave, no cero — mantener opacity, quitar movimiento"). | review-animations — Estándar 8 (Accessibility) | Medio | Acotar el guard para colapsar solo transform/scale, dejando un fade corto de opacity. |
| `Configuracion.jsx` (pestañas de ajustes) y `Pacientes.jsx` (pestañas del historial: Timeline/Ficha clínica/Lentes/Fidelización) | Únicas 2 pantallas con indicador de pestaña `border-b-2` (subrayado recto) — inconsistente con el resto del sistema (todo redondeado/píldora) y no documentado en `DESIGN.md`. | impeccable critique — Consistency and Standards | Bajo | Decidir si es un patrón secundario intencional (documentarlo) o unificarlo al lenguaje de píldora existente. |
| `CRM.jsx` — feed de actividad (badges y timestamps, ~8 instancias) | Texto a 9px/10px, por debajo del mínimo práctico de legibilidad (~12px). | impeccable audit — Accessibility (legibilidad) | Bajo | Subir a `text-[11px]`/`text-xs` mínimo; truncar el nombre si el espacio es el limitante. |
| Formularios: Pacientes ("nuevo paciente"), Usuarios, Configuración, SuperadminPanel ("crear óptica") | Campos de texto sin atributo `autoComplete` (0 ocurrencias verificadas por grep) — el navegador no puede ofrecer autofill. | web-design-guidelines — Forms | Bajo | Añadir `autoComplete="name"`/`"tel"`/`"email"`/`"street-address"` según el campo. |
| Patrón de input compartido en todo el panel de staff y portal (documentado en `DESIGN.md`) | Usa `:focus` en vez de `:focus-visible` — el anillo de foco aparece también al hacer click con mouse, no solo con teclado. No es un bloqueo de accesibilidad, solo no sigue la convención recomendada. | web-design-guidelines — Focus states | Bajo | Cambiar `focus:` por `focus-visible:` en el patrón de input compartido. |
| `SeccionMfa` en "Mi cuenta" (`Dashboard.jsx`) | La verificación en dos pasos existe pero está apagada por defecto y no es obligatoria para roles `admin`/`asistente` que manejan datos clínicos cifrados. Podría ser una decisión de producto deliberada. | nielsen-heuristics-audit — Heurística 5 (ángulo de seguridad) | Bajo | Si se quiere reforzar, exigir MFA específicamente al rol `admin`. |
| `Citas.jsx:948`, `Pacientes.jsx:1498` — menú de acciones contextual | Reusa la animación de diálogo centrado (`modal-in`, translateY+scale) para un menú posicionado junto a su disparador, en vez de una animación propia con `transform-origin` en el trigger. | review-animations — Estándar 5 (Origin & physical correctness) | Bajo | Animación propia de menú pequeño con `transform-origin` en la esquina del disparador. |
| `rise-in` en `Citas.jsx`, `CRM.jsx`, `Inventario.jsx` (320ms) vs. `Pacientes.jsx:1642` (200ms) | Mismo keyframe, dos duraciones distintas para lo que se lee como el mismo momento de "el contenido se asienta". | review-animations — Estándar 10 (Cohesion) | Bajo | Estandarizar en 320ms, o nombrar el de 200ms como variante explícita si es intencional. |
| Sistema completo — INK/PORCELAIN/GOLD hardcodeados, sin modo oscuro real | El único bloque `.dark` en `index.css` pertenece al primitivo shadcn no usado (`@/components/ui/button`). Informativo — `PRODUCT.md` no pide modo oscuro. | impeccable audit — Theming | Bajo | Ninguna acción salvo que se pida modo oscuro; considerar limpiar el bloque `.dark` muerto como tarea aparte. |

**Conteo**: 0 Crítico · 4 Alto · 9 Medio · 8 Bajo (21 hallazgos totales) — **Lote 1 (los 4 Alto) resuelto el 2026-09-28**, ver tachado arriba y sección "Lotes de trabajo".

## Hallazgos positivos (de las 4 lentes)

- El patrón de skeleton loader (`animate-pulse` + `bg-slate-200/70`, mismas formas que el contenido real) está realmente aplicado, no solo documentado.
- Badges de estado suaves (`bg-{color}-50`/`text-{color}-700`) consistentes en las 3 superficies.
- Inputs con foco programado (`focus:border-blue-500 focus:ring-2 focus:ring-blue-50`) y variante de error diferenciada.
- `ConsultaMedica.jsx` y el command palette de `Dashboard.jsx` ya implementan el patrón correcto de `role="dialog"` + Escape — la prueba de que el patrón bueno existe, solo no se propagó.
- Estados vacíos del portal de pacientes bien escritos, en lenguaje cálido y no técnico, acorde al público que `PRODUCT.md` describe para esa superficie.
- La paleta de comandos Ctrl+K funciona de verdad en vivo (flechas, Enter, Escape) — un acelerador real, no decorativo.
- Mensajes de error específicos y en español plano, no códigos ni jerga técnica.
- El par de animación `overlay-in`/`modal-in` (150ms/180ms, curva cúbica propia, propiedades GPU-only, `willChange` bien acotado) es un sistema de entrada de modal genuinamente bien resuelto y consistente en 19+ modales.
- El stagger de tarjetas en `CRM.jsx` (`animationDelay: i*50ms`) es exactamente el tipo de pulido de entrada por grupo recomendado.
- El sistema se siente autoral, no genérico: INK/PORCELAIN/GOLD + gradiente firma + serif Newsreader se repite con intención en las 3 superficies, incluido el portal de pacientes.

## Puntaje Nielsen por superficie (de nielsen-heuristics-audit)

| # Heurística | Staff | Portal paciente | Superadmin* |
|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | 3 |
| 2. Lenguaje del mundo real | 3 | 4 | 3 |
| 3. Control y libertad | 2 | 3 | 3 |
| 4. Consistencia y estándares | 2 | 2 | 3 |
| 5. Prevención de errores | 2 | 3 | 2 |
| 6. Reconocer, no recordar | 4 | 4 | 3 |
| 7. Flexibilidad y eficiencia | 3 | n/a | 3 |
| 8. Diseño estético y minimalista | 3 | 4 | 3 |
| 9. Recuperación de errores | 3 | 3 | n/a |
| 10. Ayuda y documentación | 1 | 2 | 1 |
| **Total** | **27/40** | **29/36** | **24/32** |
| Banda | Aceptable | Bien | Aceptable |

*Superadmin: cobertura en vivo más liviana (una pantalla probada a fondo, resto por lectura de código) — tratar como menos verificado que los otros dos.

## Lotes de trabajo, ordenados por impacto

### Lote 1 — Alto impacto (hacer primero) — ✅ **Completo** (2026-09-28)
1. ~~**Modales sin cierre por Escape**~~ ✅ Resuelto — hook compartido `useModalAccesible`, 24 modales migrados (commit `1402dd4`).
2. ~~**`PortalPaciente.jsx` muestra el nombre de óptica equivocado**~~ ✅ Resuelto (commit `fbcfaa9`).
3. ~~**Ficha clínica sin guardia de cambios sin guardar**~~ ✅ Resuelto (commit `e2ca775`).
4. ~~**Animación en el Ctrl+K**~~ ✅ Resuelto (commit `fbcfaa9`).

### Lote 2 — Impacto medio (consistencia y pulido funcional)
5. Confirmación de eliminar unificada (`Configuracion.jsx`, `CRM.jsx`) reusando el modal ya existente en `Citas.jsx`.
6. Estados de carga sin skeleton en `Mensajes.jsx` y `Horario.jsx`.
7. Blancos de toque <44px en botones de acción por fila (todo el sistema).
8. Canal de soporte real donde se lo menciona, o quitar la promesa.
9. Toggle switches: animar `transform` en vez de `left`.
10. `transition-all` → propiedades acotadas (limpieza sistémica, 82 elementos).
11. Toast de `SuperadminPanel.jsx`: animación de salida + fix de la carrera de temporizadores.
12. Guard de `prefers-reduced-motion` menos brusco (mantener fade de opacity).

### Lote 3 — Bajo impacto (pulido cosmético, cuando haya tiempo)
13. Indicador de tabs inconsistente (`border-b-2` vs. píldora) en 2 pantallas.
14. Texto 9-10px en el feed de `CRM.jsx`.
15. `autoComplete` faltante en 4 formularios.
16. `:focus` → `:focus-visible` en el patrón de input compartido.
17. MFA no obligatorio para el rol `admin` — registrar como decisión pendiente, no defecto.
18. Menú de acciones contextual reusando la animación de modal en vez de una propia.
19. Duración de `rise-in` inconsistente (200ms vs. 320ms) en un solo archivo.
20. Bloque `.dark` muerto en `index.css` (limpieza de código no usado).
