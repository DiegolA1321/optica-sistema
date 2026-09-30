# Plan de la reunión del 29 de septiembre (Zoom)

**Fecha del análisis**: 2026-09-29
**Metodología**: solo lectura — sin cambios de código ni de datos, sin `git stash`. Cada pedido de `docs/feedback-ing/reunion-zoom-29sep.md` (excluido de git) se contrastó contra el código real en `main` y contra `docs/feedback-ing/estado.md` (auditoría de las transcripciones ING1-9 del 9 de septiembre), citando archivo:línea como evidencia. Los pedidos se leen como evidencia de lo que el ing observó en el sistema en ese momento, no como tickets literales.

**Contexto clave**: la reunión de hoy ocurrió el mismo día que tres commits en `main` (`93f38ea`…`186251d`) que ya resolvían varios de los puntos de ING1-9, incluido uno (`186251d`, "ficha clínica abre en Refracción para pacientes con historial") que se fusionó **antes** de la reunión de Zoom. El ing revisó el sistema ya publicado, con esos cambios incluidos — sus pedidos de hoy son su criterio más reciente y **reemplazan** a los anteriores; no se leen como contradicciones a resolver sino como la decisión vigente.

---

## 0. Decisiones de Diego (29 sept., después de la reunión)

Diego zanjó las 4 contradicciones/tensiones de la sección 3 (marcadas abajo como **RESUELTA**). Quedan así:

### D1 — Antecedentes: solo en Anamnesis (resuelve Tensión A)
Se quita el bloque "Antecedentes del paciente" del paso Refracción (y de Diagnóstico); queda visible únicamente en el paso Anamnesis.

- **Evidencia**: el bloque (`ConsultaMedica.jsx:1201-1230`) hoy se renderiza fuera de cualquier condición de `subTab`, por eso aparece en los 3 pasos. Los bloques por paso sí existen (`subTab === "anamnesis"` en `:1323`, `"refraccion"` en `:1412`, `"diagnostico"` en `:1706`) — basta con envolver el bloque de antecedentes en la primera condición.
- **Efecto colateral a tener presente (no es un pendiente, es la consecuencia directa de la decisión)**: un paciente con historial sigue abriendo directo en el paso Refracción (`seleccionarPacienteCombo`, `ConsultaMedica.jsx:577`, pedido ING7) — con este cambio, ya no verá ahí ningún resumen de alergias/antecedentes salvo que vuelva manualmente a la pestaña Anamnesis.
- Tipo: UI. BD: no. Riesgo: bajo. Tiempo: ~30-60 min.

### D2 — Confirmar/completar datos en recepción al "Atender" (resuelve Contradicción B)
El paciente se sigue registrando (o deduplicando) al agendar por la web (ING6, `crear_cita_publica`, migración `0067`) — eso no cambia. Lo nuevo: al presionar "Atender" sobre una cita con `origen = 'paciente'` cuyo registro todavía no fue confirmado por recepción, se muestra primero un paso para confirmar o completar sus datos, antes de entrar a la ficha clínica.

- **Evidencia**: `pacientes_base.origen` (`'paciente'`\|`'staff'`) ya existe (migración `0067`), pero no hay ningún campo que distinga "confirmado por recepción" de "solo lo que escribió el paciente en el portal". El modal de completar registro que ya existe en `Citas.jsx:465-540` (`completarPara`/`atenderCita`) solo se dispara cuando `cita.pacienteId` es nulo — un caso cada vez más raro desde `0067`; hay que extender el disparador para que también aplique cuando `pacienteId` existe pero viene de la web y no está confirmado.
- **Requiere BD**: columna nueva, ej. `pacientes_base.confirmado_recepcion boolean not null default false` (true automático para `origen = 'staff'`; false para `origen = 'paciente'` hasta que el personal lo confirme la primera vez que se atiende). **Aviso antes de tocar la base de datos, como se pidió.**
- Tipo: BD (columna + default) + UI (`Citas.jsx`: ampliar el disparador de `atenderCita` y el modal existente para modo "confirmar" además de modo "completar"). Riesgo: Medio (toca el flujo de entrada a la ficha). Tiempo: ~3-5h.

### D3 — "Atendida" al guardar la ficha junto con su cobro (resuelve Contradicción C, construye 2.3-Opción B)
La cita pasa a "Atendida" cuando se guarda la ficha clínica **junto con** el cobro de la consulta — usando el campo dedicado de costo de consulta (no una línea de factura de producto genérica).

- **Evidencia**: hoy `ConsultaMedica.jsx:854-858` marca "Atendida" al guardar la ficha, sin condición de cobro. No existe ninguna columna `costo_consulta` todavía (confirmado por búsqueda en todo el repo). El editor de factura de productos (`facturaLineas`, `ConsultaMedica.jsx:244-407`) es un mecanismo aparte — mezclarlo sería repetir el problema que el propio ing señaló ("yo llego ahí, hago la consulta y la cancelo si no me hago los lentes").
- **Requiere BD**: columna nueva `consultas.costo_consulta numeric` (ver pendiente 2.3, Opción B — se construye en la misma fase). **Aviso antes de tocar la base de datos.**
- Tipo: BD (columna nueva) + UI (campo de costo de consulta en el Paso 3 de la Ficha Clínica, obligatorio para poder guardar+marcar Atendida; ficha impresa). Riesgo: Bajo-Medio. Tiempo: ~3-4h (incluye el pendiente 2.3 completo).

### D4 — Vista adaptada por rol, sin tocar la base de datos (resuelve Contradicción D)
No se crea un rol nuevo. Se reutiliza el flag que ya existe en BD, `perfiles.es_optometra` (migración `0048`, hoy solo usado dentro de `SuperadminPanel.jsx` para marcar si el admin de una óptica es también el optómetra). El admin ve la vista global de todo el equipo (como hoy); el usuario marcado `es_optometra = true` ve su agenda del día, los pacientes en atención y lo que le toca atender.

- **Evidencia de que no falta BD**: la columna ya existe; lo que falta es propagarla al estado `usuario` de la app — hoy `es_optometra` no viaja más allá de `SuperadminPanel.jsx`. Se arma en `App.jsx:725` (restauración de sesión) y `Login.jsx:463-472` (login explícito), agregando `esOptometra: perfil.es_optometra` a ambos `setUsuario(...)`.
- **Dónde se nota la vista**: `Inicio.jsx` ya distingue `esAdmin` (`:51`) y ya calcula `citasHoy` (`:147`) — se extiende con un filtro adicional cuando `usuario.esOptometra` (agenda del día + "En Atención" + próximas del propio optómetra, en vez de la vista global del equipo). Mismo criterio aplicado a `Citas.jsx` si Diego confirma que también debe filtrarse ahí.
- Tipo: UI (2 archivos para propagar el flag + `Inicio.jsx`/`Citas.jsx` para filtrar). BD: no. Riesgo: Bajo-Medio (toca el dashboard principal). Tiempo: ~4-6h.

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

### 2.3 Campo dedicado de costo de consulta — Opción B — **decidido hoy, se construye junto con D3**
Columna dedicada nueva (no reutilizar una línea de factura genérica). Diego confirmó Opción B el 29 sept. como parte de D3: "Atendida" se dispara al guardar la ficha junto con este costo. Ver [Sección 0, D3](#d3--atendida-al-guardar-la-ficha-junto-con-su-cobro-resuelve-contradicción-c-construye-23-opción-b).

---

## 3. Contradicciones con decisiones anteriores del ing o con cambios de hoy

*Las 4 quedaron resueltas por decisión de Diego el 29 sept. — ver [Sección 0](#0-decisiones-de-diego-29-sept-después-de-la-reunión) para la decisión final de cada una. Se deja el análisis original como respaldo de por qué eran contradicciones antes de la decisión.*

### A. Antecedentes "repetidos" en Refracción — nace del commit de hoy (`186251d`) — **RESUELTA → D1**
El commit de esta mañana (`186251d`, antes de la reunión) respondía a un pedido de ING7: mostrar los antecedentes también en Refracción para un paciente con historial, sin forzarlo a volver a Anamnesis. Se implementó como un bloque **colapsado** con resumen de una línea, visible en los 3 pasos (`ConsultaMedica.jsx:1190-1230`).

En la reunión de hoy (09:14) el ing ve ese mismo bloque en Refracción y lo lee como "antecedentes repetidos" — el defecto exacto que `186251d` se proponía evitar. No es un bug de implementación (el bloque está colapsado, con un resumen de una línea, no repite el formulario completo); es una tensión de percepción: cualquier reaparición de la cabecera "Antecedentes del paciente" fuera de Anamnesis se lee como duplicado a primera vista, colapsada o no.

**No revertir `186251d`** — rompería el pedido original de ING7. Alternativa a confirmar con el ing: cuando el bloque esté colapsado fuera de Anamnesis, quitar la cabecera de acordeón y dejar solo un renglón discreto ("Alergias: Ninguna · Antecedentes: Ninguno") integrado a la barra sticky de identidad del paciente (`ConsultaMedica.jsx:1141`) en vez de una tarjeta aparte con su propio título. Riesgo: bajo (solo UI), pero es una decisión de diseño — no tocar sin confirmar. ~1-2h una vez decidido.

### B. "Crear paciente" al atender vs. la propia revisión del ing en ING6 — **RESUELTA → D2**
El código actual ya resuelve o crea al paciente **al agendar** por la web, con deduplicación por cédula (`crear_cita_publica`) — la posición que el propio ing adoptó en ING6 (9 sept.): un paciente con cita ya existe en el registro antes de llegar a "Atender".

Hoy el ing narra el flujo describiendo el caso contrario: llega un paciente registrado por web, "Atender" detecta que no es usuario activo y pide el registro primero. Eso describe el modelo **anterior** a su propia revisión de ING6 (creación diferida hasta atender), no el modelo vigente.

El modal que pidió **sí existe** (`Citas.jsx:465-481`, para el caso —hoy infrecuente— de una cita sin `pacienteId`), así que no hay nada que arreglar en código. La discrepancia es de expectativa, no de implementación: conviene reconfirmar con el ing en la próxima reunión si quiere mantener ING6 (creación al agendar) o volver a la creación diferida, antes de que la ambigüedad genere más pedidos contradictorios.

### C. Cita "Atendida" al generar factura vs. al guardar la ficha — **RESUELTA → D3**
Contradice el diseño vigente y documentado: `ConsultaMedica.jsx:854-858` marca "Atendida" al guardar la ficha clínica, no al facturar. Es una regla ya formalizada en `CLAUDE.md` ("Al guardar la ficha médica: actualizar estado automáticamente a Atendida"), no un detalle menor.

Cambiarlo tiene un problema práctico que el propio ing señala en la misma transcripción de hoy: no toda consulta termina en venta de producto el mismo día ("yo llego ahí, hago la consulta y la cancelo si no me hago los lentes"). Si "Atendida" dependiera de facturar, una consulta sin venta de lentes quedaría indefinidamente "En Atención", rompiendo reportes y el flujo de no-show. Ver también 2.3 — el campo dedicado de costo de consulta (opción B) refuerza este argumento.

**No implementar tal cual.** Confirmar con el ing en la próxima reunión, mostrándole el caso de consulta sin venta.

### D. Vista por rol "Optómetra" vs. el modelo de roles real — **RESUELTA → D4**
El modelo de datos actual (`Usuarios.jsx`) solo tiene dos roles en `perfiles.rol`: `admin` y `asistente`, con permisos granulares por módulo para `asistente`. Existe un flag `esOptometra`/`es_optometra` (`SuperadminPanel.jsx`) que marca si el admin **es también** el optómetra — es un atributo del admin, no un tercer rol con pantallas propias.

El pedido de hoy asume un rol "Optómetra" separado, con vista propia (solo sus citas/tareas) distinta de "Administrador" (control global). Eso no existe y no se logra solo extendiendo el sistema de permisos por checkbox ya construido para `asistente`.

Antes de estimar esto falta una decisión de producto: ¿"Optómetra" es un permiso más dentro de `asistente` (ej. "ver solo mis citas", barato, reutiliza lo existente) o es un tercer rol real con BD/RLS/UI propios (cambio estructural)? Llevar la pregunta a la próxima reunión — no implementar sin esa decisión.

---

## 4. Plan por fases (reorganizado tras las decisiones del 29 sept.)

Las 4 decisiones de Diego (D1-D4, sección 0) reemplazan la vieja Fase 0 ("aclarar con el ing") — ya no hay nada pendiente de aclarar, hay que construir. Las fases quedan ordenadas por: sin-BD primero, luego BD (con aviso previo), luego el resto de pendientes de la reunión que no dependían de ninguna contradicción.

### Fase 1 — Decisiones de hoy sin tocar BD (arrancar ya, con tu aprobación) — ✅ **PUBLICADA en `main`** (commit `7cf84b9`, merge de `reunion-29sep`)
1. **D1** — Antecedentes solo en el paso Anamnesis (quitar de Refracción y Diagnóstico) — `ConsultaMedica.jsx` — ~30-60 min — ✅ `f06da43`
2. **D4** — Vista por rol: propagar `es_optometra` a `usuario` (`App.jsx`, `Login.jsx`) y filtrar `Inicio.jsx` (agenda del día/en atención) para quien tiene el flag activo — ~4-6h — ✅ `12a65a8`, `a220b75`, `6b97371`, `9130a7f`
3. Filtro por rango de fechas en Citas médicas (pendiente de la reunión, sigue vigente) — `Citas.jsx` — ~2h — ✅ `a75920c`
4. Notificación de no asistencia en la campana (pendiente anterior 2.2, opción A) — `Dashboard.jsx` — ~1-2h — ✅ `6e55b8e`

*Subtotal Fase 1: ~8-10h.*

### Fase 2 — Decisiones de hoy que requieren BD (te aviso antes de correr cada migración) — ✅ **PUBLICADA en `main`**
5. **D3** — Campo de costo de consulta en Paso 3 de la Ficha Clínica + mover el disparador de "Atendida" para que dependa de guardar ficha+cobro (construye también el pendiente 2.3) — ~3-4h — ✅ `ea97531`, implementado sin migración: reutiliza `facturas_venta`/`crear_factura_venta` con una línea de servicio "Consulta" (costo obligatorio, puede ser 0) en vez de una columna dedicada `consultas.costo_consulta`
6. **D2** — Columna `pacientes_base.confirmado_recepcion` + paso de confirmar/completar datos al "Atender" una cita de origen web no confirmada — `Citas.jsx` — ~3-5h — ✅ `a6ad1a6` (migración `0077`), `48222c8`

*Subtotal Fase 2: ~6-9h + 2 migraciones (avisadas antes de aplicarse).*

### Fase 3 — Resto de pedidos de la reunión, bajo riesgo, sin BD
7. Ocultar el buscador de paciente en Anamnesis cuando ya viene resuelto desde "Atender" — ~1-2h — ✅ `5142dc3`
8. Reubicar el contexto de la visita anterior (+ tendencia histórica entre las 2 últimas consultas) antes de empezar a llenar refracción; panel en vivo renombrado a "Comparación con la refracción de hoy" — ~2-3h — ✅ `bd68d92`
9. Horarios ocupados/disponibles en el modal de Mi Horario — ~2-3h
10. Modal de confirmación antes de "Atender" (resumen + Ingresar/Cerrar) — ~2h
11. Separar pestaña "Controles" (clínico) de "Fidelización" — ~2-3h
12. Vista por día/mes en Citas médicas — ~3-6h según alcance

*Subtotal Fase 3: ~13-20h.*

### Fase 4 — Resto de pedidos que requieren BD o Configuración, riesgo medio
13. Motivo de consulta como selector configurable — ~3-4h — ✅ `22efbce`, sin migración: reutiliza el catálogo `motivosConsulta` que ya existía en `parametrizacion` (Configuración)
14. Tratamiento finalizado / `estado_clinico` + métricas en Reportes (pendiente anterior 2.1, opción A) — construir junto con el punto 11 de la Fase 3 — ~3-4h
15. Renombrar "Lentes/Productos" → "Productos y servicios" + clasificación real por tipo — ~1h rename / +3-4h clasificación
16. Botón "Enviar mensaje por CRM" individual desde el perfil — ~2h

*Subtotal Fase 4: ~9-14h.*
