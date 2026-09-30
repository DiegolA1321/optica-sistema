# Plan de la reunión del 29 de septiembre (Zoom)

**Fecha del análisis**: 2026-09-29
**Metodología**: solo lectura — sin cambios de código ni de datos, sin `git stash`. Cada pedido de `docs/feedback-ing/reunion-zoom-29sep.md` (excluido de git) se contrastó contra el código real en `main` y contra `docs/feedback-ing/estado.md` (auditoría de las transcripciones ING1-9 del 9 de septiembre), citando archivo:línea como evidencia. Los pedidos se leen como evidencia de lo que el ing observó en el sistema en ese momento, no como tickets literales.

**Contexto clave**: la reunión de hoy ocurrió el mismo día que tres commits en `main` (`93f38ea`…`186251d`) que ya resolvían varios de los puntos de ING1-9, incluido uno (`186251d`, "ficha clínica abre en Refracción para pacientes con historial") que se fusionó **antes** de la reunión de Zoom. Eso explica varios de los puntos de hoy: el ing está reaccionando en vivo a cambios que acababan de entrar a producción.

---

## 1. Pedidos de hoy vs. código actual

### Citas médicas

| Pedido (minuto) | Estado | Evidencia | Tipo | Riesgo | Tiempo |
|---|---|---|---|---|---|
| Botón "Citas de hoy" (02:14) | ✅ **Ya hecho** | `Citas.jsx:714` — KPI/filtro `filtro === "hoy"` | — | — | — |
| Filtro por rango de fechas personalizado (02:14) | ⏳ Pendiente | No existe selector de rango; solo `filtro` (todas/hoy/próximas/atendidas) en `Citas.jsx:143` | UI | Bajo | ~2h |
| Vista por día / por mes (00:04) | ⏳ Pendiente | Hoy es lista plana con filtros KPI, sin agrupación ni calendario mensual (`Citas.jsx:611-660`) | UI | Bajo-Medio | ~3-4h (día) + ~4-6h (mes, si se quiere calendario real) |
| Horarios ocupados/disponibles al editar un día en Mi Horario (03:13) | ⏳ Pendiente | El modal `EditorExcepcion` (`Horario.jsx:1026-1092`) solo tiene toggles mañana/tarde; no muestra citas ni huecos | UI | Bajo | ~2-3h (la lógica de solape ya existe en `disponibilidad.js`) |
| "Atender" detecta paciente no registrado → modal Crear paciente (04:33) | ✅ **Ya hecho** | `Citas.jsx:465-481` (`atenderCita` → `completarPara`/"Completar registro") | — | — | Ver Contradicción B abajo — el caso que describe el ing ya casi no debería ocurrir |
| Modal de confirmación antes de "Atender" (resumen + Ingresar/Cerrar) (01:21 V2) | ⏳ Pendiente | `atenderCita` (`Citas.jsx:465-472`) pasa directo a la ficha, sin modal intermedio | UI | Bajo | ~2h |
| Cita pasa a "Atendida" al generar factura, no al guardar ficha | ❌ **Contradice el diseño vigente** | Ver Contradicción C abajo | — | — | — |
| Vista adaptada por rol "Optómetra" (03:45) | ❌ **Contradice el modelo de roles actual** | Ver Contradicción D abajo | — | — | — |

### Pacientes

| Pedido (minuto) | Estado | Evidencia | Tipo | Riesgo | Tiempo |
|---|---|---|---|---|---|
| Renombrar "Lentes/Productos" → "Productos y servicios" + tablas diferenciadas (04:02 V2) | ⏳ Pendiente | `Pacientes.jsx:1922` sigue diciendo "Lentes/Productos"; las líneas de factura no distinguen tipo producto/servicio más allá de `facturaTipoLinea` genérico (`estado.md:164`) | UI (rename) / UI+BD (clasificación real) | Bajo / Medio | ~1h rename / +3-4h clasificación |
| Separar "Controles" (clínico) de "Fidelización" (04:02, 06:01 V2) | ⏳ Pendiente | `Pacientes.jsx:1936` — una sola pestaña "Controles/Fidelización"; `2054-2069` confirma que estado de corrección/tendencia (clínico) y CRM (fidelización) viven mezclados en el mismo bloque | UI | Bajo | ~2-3h |
| Botón "Enviar mensaje por CRM" individual desde el perfil (07:46 V2) | ⏳ Pendiente | Sin coincidencias de WhatsApp/CRM en `Pacientes.jsx` — no existe hoy | UI (reutiliza plantillas de `CRM.jsx`) | Bajo | ~2h |

### Ficha clínica

| Pedido (minuto) | Estado | Evidencia | Tipo | Riesgo | Tiempo |
|---|---|---|---|---|---|
| Eliminar buscador de pacientes dentro de la ficha en atención (07:51) | 🟡 **Parcial** | Para pacientes con historial ya no aparece (186251d salta directo a Refracción). Para pacientes **nuevos** que entran por "Atender", el buscador de Anamnesis (`ConsultaMedica.jsx:1347-1389`) sigue visible y editable aunque el paciente ya venga resuelto por `pacienteInicial` | UI | Bajo | ~1-2h (condicionar el render cuando `pacienteInicial`+`citaIdInicial` ya vienen dados) |
| Antecedentes repetidos en Refracción (09:14) | 🟡 **Tensión de diseño, nace del propio commit de hoy** | Ver Contradicción/Tensión A abajo | — | — | — |
| Motivo de consulta como selector de categorías configurables (11:06) | ⏳ Pendiente | Sigue siendo `<input type="text">` (`ConsultaMedica.jsx:1427-1434`); ya se reposicionó arriba de Refracción hoy (186251d), pero no es un desplegable ni es configurable | UI+BD (catálogo en Configuración, reutilizando el patrón ya usado para diagnóstico/inventario) | Medio | ~3-4h |
| Reubicar Tendencia de graduación / Estado de corrección antes de la refracción (13:44) | 🟡 **Parcial** | Hoy es un panel "en vivo" al **final** del paso Refracción (`ConsultaMedica.jsx:1701`) y de nuevo en Diagnóstico (`:1709`) — no un contexto histórico visible **antes** de empezar a refractar | UI | Bajo-Medio | ~2-3h |

### Lo que el ing confirmó que se mantiene (no tocar)

Diseño de tarjetas de citas (00:31), indicador de día actual en Mi Horario (02:06), validaciones bloqueantes de formulario (10:59), modal de Historial Clínico (08:24) — los cuatro siguen exactamente como están hoy.

---

## 2. Los 3 pendientes anteriores (decisiones ya tomadas, sin implementar)

Ninguno de los tres tiene código nuevo desde `aac5115` (el commit de `estado.md` de hoy a las 14:56) — solo se decidió *qué opción* tomar, no se construyó todavía.

### 2.1 Tratamiento finalizado — Opción A
`estado_clinico = 'De alta'` (columna nueva, probablemente en `pacientes`) + métrica **"Tratamientos finalizados"** en Reportes + renombrar "Controles vencidos" → **"Controles atrasados"**, excluyendo a los pacientes de alta de esa segunda métrica.

- **Relación con hoy**: se cruza directamente con el pedido de separar "Controles/Fidelización" (sección 1, Pacientes). "Controles atrasados" es exactamente el tipo de dato que el ing quiere ver en la mitad clínica de esa pestaña, no en la de fidelización. Conviene construirlas **en la misma fase**: al mover los controles clínicos fuera del bloque combinado, ese es el lugar natural para el nuevo badge "De alta" y la métrica de atraso.
- Tipo: BD (columna nueva) + UI (Reportes, badge en perfil). Riesgo: Medio (dos KPIs visibles en Reportes cambian de significado). Tiempo: ~3-4h.

### 2.2 Notificación de no asistencia en la campana — Opción A (reactiva)
Solo dentro de la campana de notificaciones in-app, sin canal push/SMS/correo (eso ya se descartó el 2026-09-10).

- **Hallazgo que reduce el estimado anterior**: ya existe un centro de notificaciones real y funcionando — `Dashboard.jsx:373-400` (`alertas`), consumido en `821-841`. Ya alimenta alertas de stock bajo, citas de hoy, mensajes, cumpleaños y controles vencidos con exactamente el mismo patrón (`arr.push({...})`). Agregar "No asistió" es una entrada más en ese mismo arreglo, no un mecanismo nuevo.
- **Relación con hoy**: no se mencionó explícitamente en la reunión, pero si "Optómetra" termina viendo solo sus propias citas (pedido de rol), la campana debería filtrar igual — mismo criterio de alcance.
- Tipo: UI (una entrada más en `alertas`, reutiliza el auto no-show ya construido en `0071_auto_no_asistio.sql`/`0076_no_asistio_10_minutos.sql`). Riesgo: Bajo. Tiempo: ~1-2h (más barato de lo estimado en `estado.md`, que asumía un canal nuevo).

### 2.3 Campo dedicado de costo de consulta — Opción B
Columna dedicada nueva (no reutilizar una línea de factura genérica).

- **Relación con hoy**: refuerza el argumento de la Contradicción C (abajo). Si la consulta en sí tiene un cargo propio y obligatorio, separado de la venta de productos, tiene aún más sentido que "Atendida" se dispare al guardar la ficha (que es donde vivirá ese costo) y no al facturar productos — que puede no existir en absoluto ese día.
- Tipo: BD (columna nueva en `consultas`, ej. `costo_consulta numeric`) + UI (campo en Ficha Clínica, ficha impresa). Riesgo: Bajo-Medio. Tiempo: ~2-3h.

---

## 3. Contradicciones con decisiones anteriores del ing o con cambios de hoy

### A. Antecedentes "repetidos" en Refracción — nace del commit de hoy (`186251d`)
El commit de esta mañana (`186251d`, antes de la reunión) respondía a un pedido de ING7: mostrar los antecedentes también en Refracción para un paciente con historial, sin forzarlo a volver a Anamnesis. Se implementó como un bloque **colapsado** con resumen de una línea, visible en los 3 pasos (`ConsultaMedica.jsx:1190-1230`).

En la reunión de hoy (09:14) el ing ve ese mismo bloque en Refracción y lo lee como "antecedentes repetidos" — el defecto exacto que `186251d` se proponía evitar. No es un bug de implementación (el bloque está colapsado, con un resumen de una línea, no repite el formulario completo); es una tensión de percepción: cualquier reaparición de la cabecera "Antecedentes del paciente" fuera de Anamnesis se lee como duplicado a primera vista, colapsada o no.

**No revertir `186251d`** — rompería el pedido original de ING7. Alternativa a confirmar con el ing: cuando el bloque esté colapsado fuera de Anamnesis, quitar la cabecera de acordeón y dejar solo un renglón discreto ("Alergias: Ninguna · Antecedentes: Ninguno") integrado a la barra sticky de identidad del paciente (`ConsultaMedica.jsx:1141`) en vez de una tarjeta aparte con su propio título. Riesgo: bajo (solo UI), pero es una decisión de diseño — no tocar sin confirmar. ~1-2h una vez decidido.

### B. "Crear paciente" al atender vs. la propia revisión del ing en ING6
El código actual ya resuelve o crea al paciente **al agendar** por la web, con deduplicación por cédula (`crear_cita_publica`) — la posición que el propio ing adoptó en ING6 (9 sept.): un paciente con cita ya existe en el registro antes de llegar a "Atender".

Hoy el ing narra el flujo describiendo el caso contrario: llega un paciente registrado por web, "Atender" detecta que no es usuario activo y pide el registro primero. Eso describe el modelo **anterior** a su propia revisión de ING6 (creación diferida hasta atender), no el modelo vigente.

El modal que pidió **sí existe** (`Citas.jsx:465-481`, para el caso —hoy infrecuente— de una cita sin `pacienteId`), así que no hay nada que arreglar en código. La discrepancia es de expectativa, no de implementación: conviene reconfirmar con el ing en la próxima reunión si quiere mantener ING6 (creación al agendar) o volver a la creación diferida, antes de que la ambigüedad genere más pedidos contradictorios.

### C. Cita "Atendida" al generar factura vs. al guardar la ficha
Contradice el diseño vigente y documentado: `ConsultaMedica.jsx:854-858` marca "Atendida" al guardar la ficha clínica, no al facturar. Es una regla ya formalizada en `CLAUDE.md` ("Al guardar la ficha médica: actualizar estado automáticamente a Atendida"), no un detalle menor.

Cambiarlo tiene un problema práctico que el propio ing señala en la misma transcripción de hoy: no toda consulta termina en venta de producto el mismo día ("yo llego ahí, hago la consulta y la cancelo si no me hago los lentes"). Si "Atendida" dependiera de facturar, una consulta sin venta de lentes quedaría indefinidamente "En Atención", rompiendo reportes y el flujo de no-show. Ver también 2.3 — el campo dedicado de costo de consulta (opción B) refuerza este argumento.

**No implementar tal cual.** Confirmar con el ing en la próxima reunión, mostrándole el caso de consulta sin venta.

### D. Vista por rol "Optómetra" vs. el modelo de roles real
El modelo de datos actual (`Usuarios.jsx`) solo tiene dos roles en `perfiles.rol`: `admin` y `asistente`, con permisos granulares por módulo para `asistente`. Existe un flag `esOptometra`/`es_optometra` (`SuperadminPanel.jsx`) que marca si el admin **es también** el optómetra — es un atributo del admin, no un tercer rol con pantallas propias.

El pedido de hoy asume un rol "Optómetra" separado, con vista propia (solo sus citas/tareas) distinta de "Administrador" (control global). Eso no existe y no se logra solo extendiendo el sistema de permisos por checkbox ya construido para `asistente`.

Antes de estimar esto falta una decisión de producto: ¿"Optómetra" es un permiso más dentro de `asistente` (ej. "ver solo mis citas", barato, reutiliza lo existente) o es un tercer rol real con BD/RLS/UI propios (cambio estructural)? Llevar la pregunta a la próxima reunión — no implementar sin esa decisión.

---

## 4. Plan por fases

### Fase 0 — Aclarar con el ing antes de tocar código (no es trabajo de desarrollo)
Las 4 contradicciones/tensiones de la sección 3 (A, B, C, D). Bloquean cualquier estimado serio de "Vista por rol" y condicionan cómo se resuelve el bloque de antecedentes y el disparador de "Atendida".

### Fase 1 — Alta prioridad, bajo riesgo, solo UI (arrancar ya)
1. Filtro por rango de fechas en Citas médicas — ~2h
2. Ocultar el buscador de paciente en Anamnesis cuando ya viene resuelto desde "Atender" — ~1-2h
3. Reubicar el panel de tendencia/estado de corrección antes de empezar a llenar refracción — ~2-3h
4. Notificación de no asistencia en la campana (pendiente anterior 2.2, opción A) — ~1-2h

*Subtotal Fase 1: ~7-10h.*

### Fase 2 — Media prioridad, bajo riesgo, solo UI
5. Horarios ocupados/disponibles en el modal de Mi Horario — ~2-3h
6. Modal de confirmación antes de "Atender" (resumen + Ingresar/Cerrar) — ~2h
7. Separar pestaña "Controles" (clínico) de "Fidelización" — ~2-3h
8. Vista por día/mes en Citas médicas — ~3-6h según alcance

*Subtotal Fase 2: ~9-14h.*

### Fase 3 — Requiere BD o Configuración, riesgo medio
9. Motivo de consulta como selector configurable — ~3-4h
10. Tratamiento finalizado / `estado_clinico` + métricas en Reportes (pendiente anterior 2.1, opción A) — construir junto con el punto 7 de la Fase 2 — ~3-4h
11. Campo dedicado de costo de consulta (pendiente anterior 2.3, opción B) — ~2-3h
12. Renombrar "Lentes/Productos" → "Productos y servicios" + clasificación real por tipo — ~1h rename / +3-4h clasificación
13. Botón "Enviar mensaje por CRM" individual desde el perfil — ~2h

*Subtotal Fase 3: ~11-17h.*

### Fase 4 — Depende de lo que se resuelva en Fase 0
14. Ajuste del bloque "Antecedentes del paciente" fuera de Anamnesis (Tensión A) — ~1-2h una vez decidido el patrón visual
15. Vista por rol Administrador/Optómetra (Contradicción D) — estimado solo una vez decidido si es permiso nuevo dentro de `asistente` o un rol estructural nuevo
16. Ajuste del disparador de "Atendida" si el ing insiste tras ver el caso de consulta sin venta (Contradicción C) — no estimable sin esa conversación
17. Confirmar el modelo de creación de paciente (Contradicción B) — sin cambios de código previstos, solo alinear expectativas
