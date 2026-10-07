# Cuarta Medición de Nielsen — Sistema Óptica

**Fecha**: 2026-10-07
**Alcance**: panel de staff (Inicio, Citas, Pacientes, ConsultaMedica, Ventas, Inventario, CRM, Mensajes, Reportes, Usuarios/Roles, Configuración, Horario y componentes compartidos), portal de pacientes (`PortalPaciente.jsx`) y panel superadmin (`SuperadminPanel.jsx`). Mismo alcance que las tres mediciones anteriores.
**Metodología**: las 10 heurísticas de Nielsen (skill `nielsen-heuristics-audit`) con la misma escala 0-4 de las tres mediciones previas (puntaje alto = mejor cumplimiento). Cada puntaje se contrasta con el código actual (archivo y conteos por `grep`) y, cuando cambia, con los commits que lo explican.
**Limitación de método**: igual que las del 28/09 y 30/09, es **lectura de código y de `git log`**, sin navegación en vivo. Esta sesión tenía prohibido usar Playwright (crearía datos en la Óptica Demo), así que nada se verificó en pantalla. El panel superadmin conserva además la nota de "cobertura más liviana". Solo análisis: esta medición no cambia código.
**Mediciones comparadas**: (1) `docs/ux-audit.md`, 27/09; (2) `docs/nielsen-medicion-final.md`, 28/09; (3) `docs/nielsen-medicion-2026-09-30.md`, 30/09. Denominador de superadmin: /36, como corrigió la tercera.

---

## 0. Resultado en una mirada

| Superficie | 27/09 | 28/09 | 30/09 | **07/10** | Banda |
|---|---|---|---|---|---|
| Panel de staff | 27/40 (67,5 %) | 30/40 (75 %) | 32/40 (80 %) | **35/40 (87,5 %)** | Bien |
| Portal de pacientes | 29/36 (80,6 %) | 31/36 (86,1 %) | 31/36 (86,1 %) | **31/36 (86,1 %)** | Bien |
| Panel superadmin | 24/36 (66,7 %) | 26/36 (72,2 %) | 28/36 (77,8 %) | **28/36 (77,8 %)** | Aceptable |
| **Combinado** (112) | 80 (71,4 %) | 88 (78,6 %) | 91 (81,3 %) | **94 (83,9 %)** | Bien |

El avance de esta ronda es casi todo del **panel de staff** (+3 puntos): es donde cayeron 312 commits desde el 30/09 (168 `feat`, 64 `fix`), contra 5 en el portal y 6 en el superadmin. La heurística 10 (ayuda) sigue siendo la más débil del sistema en las cuatro mediciones.

---

## 1. Qué cambió desde la medición del 30/09

Entre el 30/09 y hoy:

- **Cinco correcciones post-medición del 30/09 que aquella tabla no contó** (`nielsen-medicion-2026-09-30.md`, "Nota post-medición"): modales de confirmar cita/ficha con foco atrapado (`5380508`), pestañas de Configuración con `role="tab"` (`358244a`), menú del superadmin con `transform-origin` (`110beff`), legibilidad de `OjoReceta` (`05dfb40`) y reemplazo de `window.confirm` (`87c8059`). Se verificó por `grep` que siguen en pie: `ConfirmarCitaModal.jsx:27` y `ConfirmarFichaModal.jsx:26` usan `useModalAccesible`, y en `src` no queda ningún `window.confirm` (solo un comentario en `Dashboard.jsx:249`).
- **Ventas como módulo propio**: por vender, ventas, órdenes de laboratorio y saldos, con contador en el menú, buscador de pacientes y filtros por estado; "factura" pasa a "comprobante de venta" en los textos visibles; factura electrónica opcional.
- **Roles y permisos por nivel**: matriz de módulos y alcance, varios roles por persona, selector de vista, botones de crear/editar/eliminar/vender/anular que se muestran según el permiso (y la base lo exige igual), cuentas desactivadas en vez de eliminadas.
- **Inicio por rol** (administrador, optómetra, recepción, ventas, rol propio): resumen del día, desenlace de citas por período, un solo bloque "Requiere tu atención" y "Hoy". Los formularios de Registrar paciente, Agendar cita y Añadir producto abren encima del Inicio, sin cambiar de módulo.
- **Control de la ficha**: el próximo control se elige "Agendar ahora" (fecha y hora) o "Agendar después", y lo no agendado aparece como "Control sin agendar" en Inicio y en el perfil.
- **Perfil del paciente**: cabecera con acciones a la derecha, pestañas compactas, cada cita atendida se despliega con su diagnóstico, búsqueda del historial por fechas y texto.
- **Datos**: anonimizar paciente en vez de eliminar (explica qué se borra y qué se conserva y pide escribir una confirmación), hora de cita validada (`hh:mm AM/PM`) con mensaje claro si la base la rechaza, cédula obligatoria y única por óptica, una sola regla de contraseña en superadmin, portal y claves temporales.
- **Lenguaje**: tuteo en toda la app (sin voseo), "inasistencias" en vez de "no-shows", un solo formato de fecha ("3 oct 2026") y de hora ("08:19 AM") en pantallas, registros y mensajes.
- **Reportes**: embudo de ventas (consultaron → pasaron a venta → compraron, con "no compraron" por motivo), diagnósticos por mes, laboratorios (atrasos y entrega promedio).
- **Portal**: "Solicitar mis medidas completas" llega de verdad a la óptica.
- **Hoy, en esta misma rama (`despues-reunion`)**: aviso en "Requiere tu atención" de las citas canceladas por pacientes, con botón Reagendar; "AV sin evaluar" pasa a "Sin agudeza visual con lentes registrada" con explicación al pasar el cursor; la lectura pública de `opticas_publicas` ya no manda el token de sesión (adiós al 401); las pruebas pesadas ya no fallan al azar por el límite de 5 s.

---

## 2. Puntaje por heurística

### Panel de staff

| # Heurística | 27/09 | 28/09 | 30/09 | **07/10** | Por qué |
|---|---|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | 4 | **4** | Techo. Refuerzos: contador de pendientes de Ventas en el menú, "Requiere tu atención" unificado, badge "Cancelada por el paciente / por recepción" en Semana y Mes, "Control sin agendar" visible en dos lugares. |
| 2. Lenguaje del mundo real | 3 | 3 | 3 | **4** | **Sube.** En las tres mediciones previas el motivo era que no había una pasada de vocabulario. Ahora la hay y es sistemática: tuteo en toda la app, "comprobante de venta" en vez de "factura" donde no hay factura electrónica, "inasistencias", fecha y hora en un único formato, mensajes de error en lenguaje común ("La hora de la cita no es válida"), y el estado clínico "Sin agudeza visual con lentes registrada" (en esta rama) en lugar de la sigla "AV sin evaluar". Siguen usándose OD/OI, AV y similares, pero son términos del propio optómetra, que es el usuario. |
| 3. Control y libertad | 2 | 3 | 3 | **4** | **Sube.** Se cerró el motivo exacto que lo topaba en 3: `ConfirmarCitaModal`/`ConfirmarFichaModal` ya usan `useModalAccesible` (foco atrapado y devolución de foco), y no queda `window.confirm`. Además hay salidas claras: "Cancelar cita" reversible en vez de borrar, "Dejar de atender", "Agendar después", "Cerrar" del resumen sin cambiar el estado. No llega a 4 sin reservas: no existe "Deshacer" en los toasts (ver pendientes). |
| 4. Consistencia y estándares | 2 | 3 | 3 | **3** | **No sube.** `transition-all` bajó de 98 a **90** ocurrencias en `src/**/*.jsx` (cifra del 30/09 contra el `grep` de hoy), pero sigue repartido: `SuperadminPanel` 25, `Login` 9, `Pacientes` 7, `AgendarCitaPublica` 7, `PortalPaciente` 6, `PaginaVenta` 6, `Inventario` 6, `Horario` 6. Contrapeso real: comprobante, fechas y permisos ahora hablan igual en todas las pantallas. |
| 5. Prevención de errores | 2 | 3 | 4 | **4** | Techo. Se suma: botones ocultos según permiso (y la base lo exige), anonimizar con confirmación escrita, control obligatorio "ahora o después", cédula única, validación de hora, contraseña con una sola regla. |
| 6. Reconocer, no recordar | 4 | 4 | 4 | **4** | Techo. Refuerzos: el diagnóstico de cada cita se despliega en el perfil, resumen clínico arriba, tooltip que explica cada estado de corrección. |
| 7. Flexibilidad y eficiencia | 3 | 3 | 4 | **4** | Techo. Ctrl+K sigue en `Dashboard.jsx:295`; los atajos de Inicio abren el formulario sin salir del Inicio; Inicio por rol; las tarjetas abren Citas ya filtradas por estado y período; "Reagendar" desde el aviso precarga paciente, fecha y motivo. |
| 8. Diseño estético y minimalista | 3 | 3 | 3 | **3** | **No sube.** Misma razón desde la primera medición: los botones de acción por fila (`ACCION_*` con `p-1.5`, unos 28 px) quedan por debajo del blanco táctil de 44 px en Citas, Inventario, Usuarios y otros. El Inicio por rol y el perfil compacto ordenan mejor la información, pero no cierran ese hallazgo. |
| 9. Recuperación de errores | 3 | 3 | 3 | **3** | Sin cambio de nivel. Hay avances (mensajes de escritura bloqueada por permisos revocados, hora inválida explicada, autosave de Configuración que muestra el error real), pero no hay un "Deshacer" ni reintento guiado en las acciones destructivas o masivas. |
| 10. Ayuda y documentación | 1 | 1 | 1 | **2** | **Sube un punto, con reservas.** La ayuda contextual creció de verdad: tooltip por estado de corrección, descripciones en la matriz de roles, el modal de anonimizar explica qué se borra, los motivos de agendar traen su descripción. Sigue sin centro de ayuda ni canal de soporte (ver pendiente 2). |
| **Total** | 27/40 | 30/40 | 32/40 | **35/40** | |

### Portal de pacientes

| # Heurística | 27/09 | 28/09 | 30/09 | **07/10** | Por qué |
|---|---|---|---|---|---|
| 1. Visibilidad del estado | 4 | 4 | 4 | **4** | Sin cambio. |
| 2. Lenguaje del mundo real | 4 | 4 | 4 | **4** | Sin cambio (ya en techo; se suma el tuteo y el formato de fecha único). |
| 3. Control y libertad | 3 | 4 | 4 | **4** | Sin cambio. |
| 4. Consistencia y estándares | 2 | 3 | 3 | **3** | `PortalPaciente.jsx` mantiene 6 `transition-all`. |
| 5. Prevención de errores | 3 | 3 | 3 | **3** | Sin cambio de nivel (regla única de contraseña). |
| 6. Reconocer, no recordar | 4 | 4 | 4 | **4** | Sin cambio. |
| 7. Flexibilidad y eficiencia | n/a | n/a | n/a | **n/a** | No aplica. |
| 8. Diseño estético y minimalista | 4 | 4 | 4 | **4** | `OjoReceta` ya no usa `text-[10px]` (commit `05dfb40`); ya estaba en el techo. |
| 9. Recuperación de errores | 3 | 3 | 3 | **3** | Sin cambio. |
| 10. Ayuda y documentación | 2 | 2 | 2 | **2** | Sin canal de soporte. "Solicitar mis medidas completas" ayuda, pero no es ayuda del sistema. |
| **Total** | 29/36 | 31/36 | 31/36 | **31/36** | La superficie recibió 5 commits, todos de funciones o texto; ninguno mueve una heurística. |

### Panel superadmin

| # Heurística | 27/09 | 28/09 | 30/09 | **07/10** | Por qué |
|---|---|---|---|---|---|
| 1. Visibilidad del estado | 3 | 4 | 4 | **4** | Sin cambio. |
| 2. Lenguaje del mundo real | 3 | 3 | 3 | **3** | Sin cambio (6 commits, el tuteo y el formato de fecha ayudan pero no cambian el nivel). |
| 3. Control y libertad | 3 | 3 | 4 | **4** | Sin cambio. |
| 4. Consistencia y estándares | 3 | 3 | 4 | **4** | Se cerró la animación del menú (`110beff`). Reserva: el archivo concentra 25 de los 90 `transition-all`, la mayor cantidad del sistema. |
| 5. Prevención de errores | 2 | 2 | 2 | **2** | Sin cambio funcional de fondo. |
| 6. Reconocer, no recordar | 3 | 4 | 4 | **4** | Sin cambio. |
| 7. Flexibilidad y eficiencia | 3 | 3 | 3 | **3** | Sin cambio. |
| 8. Diseño estético y minimalista | 3 | 3 | 3 | **3** | Botones de fila en `p-1.5`. |
| 9. Recuperación de errores | n/a | n/a | n/a | **n/a** | No aplica. |
| 10. Ayuda y documentación | 1 | 1 | 1 | **1** | Sin cambio. |
| **Total (/36)** | 24 | 26 | 28 | **28** | 77,8 %. Sin verificación en vivo en esta ronda. |

---

## 3. Qué explica la mejora (+3 en staff)

1. **H3, de 3 a 4**: se cerró el único motivo documentado (modales de confirmación sin foco atrapado) y se quitó el último `window.confirm`.
2. **H2 3→4**: la primera pasada sistemática de vocabulario (tuteo, comprobante, inasistencias, formato único de fecha y hora, estados clínicos legibles).
3. **H10 1→2**: ayuda contextual real en varias pantallas; el canal de soporte sigue sin existir.

H4 y H8 siguen en 3 por las mismas causas de las tres mediciones previas, ninguna atacada todavía: `transition-all` y los blancos táctiles de 28 px.

---

## 4. Pendientes, por severidad

### Medio
1. **Blancos táctiles de 28 px en los botones de acción por fila** (H8). Sin cambio desde la primera medición; afecta Citas, Inventario, Usuarios y SuperadminPanel, y `Pacientes` solo llega a unos 32 px.
2. **Soporte inexistente y un falso enlace** (H10). `Login.jsx:786` muestra "¿Problemas? Soporte técnico" como un `<span>` gris sin enlace ni correo: parece una ayuda y no lo es. Los avisos de óptica suspendida (`Dashboard.jsx:1180`) dicen "Contacta a soporte" sin ningún medio de contacto. **Hallazgo nuevo en concreto**: es lo que más barato subiría H10 en las tres superficies (un `mailto:` o un enlace de WhatsApp).
3. **Sin "Deshacer"** (H3/H9). Las acciones reversibles (cancelar cita, dejar de atender) se confirman con toast, pero ningún toast ofrece revertir.
4. **`transition-all` en 90 sitios** (H4). Bajó de 98, pero sigue; la regla de `CLAUDE.md` evita que crezca, no lo limpia.

### Bajo
5. **El aviso de canceladas en Inicio muestra 3 filas y luego "Y N más"** (H1/H7), como los demás avisos: es coherente, pero con muchas cancelaciones la lista completa queda en Citas, no en Inicio.
6. **`PortalPaciente.jsx` con 6 `transition-all`** (H4). Sin tocar desde el 28/09.
7. **MFA no obligatorio para el administrador** (H5, ángulo de seguridad). Decisión pendiente desde la primera medición, no defecto.
8. **Superadmin sin verificar en vivo desde el 27/09** (método). Los puntajes del superadmin son los menos fiables de las cuatro mediciones.

---

## 5. Lo que esta medición no pudo comprobar

- No se navegó en pantalla (restricción de la sesión): todos los puntajes salen del código. Las tres del 28/09 al 07/10 tienen la misma limitación; solo la del 27/09 usó login real.
- Los puntos de H2 y H10 del staff son un **juicio** apoyado en evidencia de código (textos, tooltips, formatos), no una prueba con usuarios. Si se prefiere la lectura conservadora, serían 3 y 1, y el staff quedaría en 33/40 (82,5 %), igualmente en banda "Bien".
- Una medición completa debería recorrer en vivo los flujos nuevos (Ventas, Roles, control de la ficha, anonimizar) con las cuentas de prueba, cuando ya no haya riesgo de crear datos en la Demo.

---

## Referencias

- Medición inicial: `docs/ux-audit.md` (27/09). Segunda: `docs/nielsen-medicion-final.md` (28/09). Tercera: `docs/nielsen-medicion-2026-09-30.md` (30/09).
- Requisitos y pendientes técnicos: `docs/auditoria-requisitos.md`.
