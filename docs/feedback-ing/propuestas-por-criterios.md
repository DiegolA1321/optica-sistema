# Propuestas extrapoladas — módulos que el ingeniero no revisó a fondo

**Fecha del análisis**: 2026-09-30
**Metodología**: solo lectura — sin cambios de código ni de datos, sin `git stash`. Se aplicaron los 9 criterios de `docs/feedback-ing/criterios-ingeniero.md` contra el código real en `main` de seis módulos que el ingeniero nunca recorrió pantalla por pantalla como sí hizo con Citas/Ficha clínica (ING1-9, reunión del 29 de septiembre): **Inventario, CRM y fidelización, Reportes, Configuración, Mensajes y el portal del paciente**. Dónde ya existía una auditoría previa contra pedidos puntuales de esos módulos (`docs/feedback-ing/estado.md`, sección "Reunión del 3 de septiembre"), no se repite — este documento busca específicamente lo que esa auditoría no cubría porque el ing nunca lo mencionó explícitamente.

> ⚠️ **Advertencia explícita, como pidió Diego**: todo lo que sigue son **propuestas extrapoladas por el sistema aplicando el criterio del ingeniero a casos que él no vio**, no pedidos suyos. Quedan pendientes de su confirmación antes de construirse. Cada hallazgo cita el criterio de `criterios-ingeniero.md` del que se deriva y el archivo:línea del código actual que lo evidencia.

---

## Inventario (`Inventario.jsx`)

### I1. Eliminar un producto es un `DELETE` real, sin aviso de su historial de ventas — ✅ **Implementado** (`51ee470`, migración `0081`)
**Criterio aplicado**: [5] Conservar el registro en lugar de borrarlo.

> Se construyó la opción de "ir más lejos": `inventario.activo boolean` (migración `0081_inventario_activo.sql`). Un producto sin ventas se sigue eliminando tal cual, con confirmación; uno con ventas se desactiva (deja de poder elegirse en `VentaProductoModal`/factura/lente recomendado de `ConsultaMedica.jsx`, pero conserva su historial y su reporte de ventas, con toggle "Ver descontinuados" y botón "Reactivar"). Verificado en vivo: los 2 productos existentes quedaron con `activo = true` tras aplicar la migración.

`confirmarEliminar()` (`Inventario.jsx:181-203`) hace `supabase.from("inventario").delete()` sin comprobar antes si el producto tiene ventas asociadas. La tabla `ventas` sí protege el dato financiero a nivel de base (`producto_id references inventario(id) on delete set null` + columna `producto_nombre` cacheada, `supabase/migrations/0047_ventas_productos.sql:24-25`), así que una venta pasada no se rompe — pero el botón "Ver reporte de ventas" (`Inventario.jsx:539`) vive sobre la fila del producto: en cuanto se elimina, ese reporte deja de ser alcanzable desde Inventario, aunque existan ventas con pagos `pendiente` asociadas a ese producto. El mismo criterio que ya se aplicó a Citas (reemplazar "Eliminar cita" por "Cancelar cita", `plan-reunion-29sep.md` Fase 3b) no llegó a Inventario.

**Cambio propuesto**: antes de eliminar, si `resumenVentasProducto(ventas, id).ventas.length > 0`, cambiar el modal de confirmación para avisarlo explícitamente ("Este producto tiene N ventas registradas, M pendientes de pago — se eliminará del catálogo pero el historial de venta se conserva") en vez de la advertencia genérica actual ("Esta acción no se puede deshacer"). Si Diego prefiere ir más lejos, un campo `activo boolean` (descontinuar en vez de borrar) que oculte el producto de "Agregar producto"/venta nueva pero lo mantenga buscable desde el reporte — a decidir con él, no asumir.

- **BD**: no para el aviso; sí (`inventario.activo boolean default true`) si se opta por descontinuar en vez de avisar.
- **Riesgo**: bajo. **Tiempo**: ~1h (aviso) / ~3-4h (descontinuar).

### I2. El orden de columnas de la tabla no sigue el orden del formulario
**Criterio aplicado**: [7] Orden consistente entre elementos relacionados.

El ing pidió explícitamente el orden del formulario "categoría → descripción del producto → el resto" (`transcripcion_ordenada.txt:135-136`, ya aplicado en `Inventario.jsx:587-619`). Pero la tabla que lista esos mismos productos usa el orden inverso: **Ítem** (nombre) primero, **Categoría** segundo (`Inventario.jsx:449-454`). Es el mismo par de campos, en el mismo módulo, en dos componentes con orden contradictorio.

**Cambio propuesto**: mover la columna "Categoría" antes de "Ítem" en el `<thead>`/`<tbody>` (`Inventario.jsx:449-454` y `508-510`), para que la tabla calque el mismo orden que ya tiene el formulario.

- **BD**: no. **Riesgo**: bajo (solo reordenar 2 `<th>`/`<td>`). **Tiempo**: ~20 min.

### I3. El nombre del paciente en "Reporte de ventas" no enlaza a su perfil — ✅ **Implementado** (`b0d0a91`)
**Criterio aplicado**: [9] Flujos conectados end-to-end.

> Más barato de lo previsto: el deep-link ya existía (`accionPacienteInicio`/`accionInicial`, usado por el buscador global y por Citas.jsx/Inicio.jsx) — no hizo falta construir plomería nueva en `Dashboard.jsx`, solo exponer el mismo callback `onVerPerfil` a `Inventario`/`CRM` y convertir el nombre en un botón en ambos.

El modal "Reporte de ventas" (`Inventario.jsx:768-836`) muestra, por cada venta, `nombrePaciente(v.pacienteId)` como texto plano (`Inventario.jsx:814`). Si un empleado ve ahí "Diego Alarcón · $45 · Pendiente" y quiere revisar o cobrar esa deuda, hoy tiene que cerrar el modal, ir a Pacientes y volver a buscarlo — exactamente el "buscar dos veces" que el ing marcó como objetivo a evitar (`transcripcion_ordenada.txt:129-130`). No existe hoy en todo el código ningún mecanismo para abrir el perfil de un paciente específico desde otro módulo (verificado: no hay ningún `pacienteIdInicial` ni prop equivalente en `Pacientes.jsx`/`Dashboard.jsx`) — sí existe el patrón general para otros deep-links (`productoIdParaReabastecer`, `fichaClinicaPacienteInicial`, `Dashboard.jsx:166-167`), que se puede replicar.

**Cambio propuesto**: agregar `pacienteIdParaAbrir`/`onPacienteParaAbrirConsumido` a `Dashboard.jsx` (mismo patrón que los otros dos deep-links), que `Pacientes.jsx` consuma para abrir directo el perfil de ese paciente; convertir el nombre en el reporte de Inventario (y en CRM, ver C1 abajo) en un botón que dispare esa navegación.

- **BD**: no. **Riesgo**: bajo-medio (toca el router de `Dashboard.jsx`, reutilizando un patrón ya probado). **Tiempo**: ~2-3h (la plomería del deep-link, reutilizable luego para CRM sin costo adicional).

---

## CRM y fidelización (`CRM.jsx`)

### C1. Los 4 bloques curados y "Ver detalles" no enlazan al perfil del paciente — ✅ **Implementado** (`b0d0a91`)
**Criterio aplicado**: [9] Flujos conectados end-to-end.

`FilaContacto` (`CRM.jsx:602-639`) y la tabla de `ModalDetalleCRM` (`CRM.jsx:706-726`) muestran el nombre del paciente como texto plano — la única acción disponible es "WhatsApp". Si la óptica ve "Juan Pérez — sin visitar hace 45 días" y quiere revisar su historial antes de escribirle (o registrar algo en su ficha), no hay atajo: hay que ir a Pacientes y buscarlo de nuevo. Mismo defecto que I3 en Inventario, mismo mecanismo a construir — no son dos features, es un solo deep-link reutilizado en dos módulos.

**Cambio propuesto**: mismo deep-link de I3 (`pacienteIdParaAbrir`), aplicado al nombre del paciente en `FilaContacto` y en las filas de `ModalDetalleCRM`.

- **BD**: no. **Riesgo**: bajo (una vez construido el deep-link en I3, este uso es trivial). **Tiempo**: ~30 min adicionales sobre I3.

*Nota: esto es la dirección inversa del pedido ya conocido y pendiente de la reunión del 29 de septiembre ("Enviar mensaje por CRM" desde el perfil del paciente, `plan-reunion-29sep.md` Fase 4 punto 16) — ese va de Pacientes hacia CRM; este va de CRM hacia Pacientes. Son complementarios, no el mismo pedido.*

---

## Reportes (`Reportes.jsx`)

### R1. Reportes no recibe `usuario` — no se filtra por rol pese a que D4 ya existe — ✅ **Implementado** (`90c4b53`)
**Criterio aplicado**: [8] Vistas adaptadas al rol real del usuario.

> Alcance decidido por Diego, distinto al propuesto abajo: en vez de filtrar por `profesionalId`, se ocultan directamente las métricas financieras (Ingresos, Conversión a venta, Productos más vendidos) para un optómetra no-admin — el resto (Consultas, Pacientes nuevos, Bien corregidos, Tratamientos finalizados, Controles atrasados, Citas→atendidos, Satisfacción, Diagnósticos, Tendencia de inasistencias, Estado de corrección) queda visible para todos los roles con permiso al módulo.

El 29 de septiembre el ing pidió explícitamente que el administrador vea el control global y el optómetra vea solo lo suyo (`reunion-zoom-29sep.md`, 03:45), y Diego ya decidió (D4, `plan-reunion-29sep.md`) reutilizar el flag `perfiles.es_optometra` para eso — ya implementado en `Inicio.jsx` y `Citas.jsx` (commits `12a65a8`, `a220b75`, `6b97371`, `9130a7f`). Pero `Reportes.jsx` no recibe `usuario` en absoluto: `Dashboard.jsx:529` lo instancia como `<Reportes cargaInicial={...} pacientes={...} consultas={...} citas={...} ventas={...} facturasVenta={...} respuestasSatisfaccion={...} />`, sin el prop. Todos los KPIs (consultas, ingresos, conversión, satisfacción) son siempre el agregado de toda la óptica, sin importar quién los mire.

**Cambio propuesto**: extender el mismo criterio D4 a Reportes — cuando `usuario.esOptometra` esté activo, filtrar "Consultas", "Pacientes nuevos" y "Diagnósticos más frecuentes" a las consultas atendidas por ese profesional (ya existe `consultas.profesionalId`/`registrado_por`, ver migración `0054_profesional_registro_consulta.sql`), dejando ingresos/satisfacción/agregados de negocio visibles solo al administrador (o visibles igual, a decidir con Diego — no todos los KPIs tienen sentido filtrados por persona).

- **BD**: no (la columna de profesional ya existe). **Riesgo**: medio (toca qué ve cada rol en una pantalla de negocio — requiere que Diego confirme qué KPIs deben filtrarse y cuáles no). **Tiempo**: ~3-4h una vez decidido el alcance exacto.

### R2. Los KPIs y gráficos son islas — no hay clic-through hacia los módulos que ya tienen esos mismos datos filtrables
**Criterio aplicado**: [9] Flujos conectados end-to-end.

Varios números de Reportes duplican exactamente un cálculo que otro módulo ya expone de forma interactiva, pero no hay navegación entre ambos:

- "Controles atrasados" (`Reportes.jsx:137,332`) usa `esInactivo(p, consultas)` — la **misma función** que ya usa CRM para armar el bloque "Sin visitar hace tiempo" (`CRM.jsx:26,99`). Son el mismo dato, calculado dos veces, en dos pantallas que no se enlazan.
- "Productos más vendidos" (`Reportes.jsx:279-290`) no enlaza al modal "Reporte de ventas" por producto que ya existe en Inventario (`Inventario.jsx:539,767-836`) — el mismo dato, más detallado, a un clic de distancia que nadie conecta.
- "Diagnósticos más frecuentes" (`Reportes.jsx:262-274`) no enlaza a una vista filtrada de pacientes con ese diagnóstico.

**Cambio propuesto**: convertir cada barra/fila de esos tres gráficos en un enlace de navegación (`onClick` → `setVista` con el filtro correspondiente ya aplicado) hacia el módulo que tiene el detalle real — mismo patrón que Inicio.jsx ya usa para su alerta de stock bajo (`destino: "inventario"`, `Dashboard.jsx:388`).

- **BD**: no. **Riesgo**: bajo-medio (cada módulo destino necesita aceptar un filtro inicial vía prop, algo que Citas/Inicio ya hacen). **Tiempo**: ~3-4h para los tres.

---

## Configuración (`Configuracion.jsx`)

### G1. Las 3 tarjetas de servicio de la página pública están fijas en código, no en el catálogo de "Servicios que ofrece tu óptica"
**Criterio aplicado**: [6] Categorías fijas en vez de texto libre (extendido a "configurable por óptica" en vez de "fijo en código") + [9] Flujos conectados.

El ing ya había marcado estas 3 tarjetas para revisión el 3 de septiembre (`transcripcion_ordenada.txt:30`). Hoy `Configuracion.jsx` tiene una sección "Servicios que ofrece tu óptica" (`:378-397`) que existe exactamente para este propósito, pero solo contiene un toggle ("Adaptación de lentes de progresión", un campo clínico). Las 3 tarjetas que se muestran en la página pública de login (`SERVICIOS`, `Login.jsx:127-155`: "Exámenes optométricos", "Monturas y lentes", "Seguimiento personalizado", cada una con ícono/texto/features) son un array hardcodeado en el componente — **el mismo para las 26+ ópticas del sistema**, sin relación con lo que esa óptica en particular ofrece o quiere destacar.

**Cambio propuesto**: mover `SERVICIOS` a una tabla/columna editable (probablemente `opticas.servicios_destacados jsonb`, reutilizando el patrón de `opticas.marca` ya usado para branding) y exponer su edición en la pestaña "Página de login" de Configuración, junto a `PersonalizacionLogin`.

- **BD**: sí (columna nueva en `opticas`, patrón ya usado). **Riesgo**: medio (toca la página pública que ve todo paciente potencial, además del componente `PersonalizacionLogin` ya existente). **Tiempo**: ~4-5h.

---

## Mensajes (`Mensajes.jsx`)

### M1. Una respuesta nueva del equipo no genera ninguna notificación positiva — solo baja un contador
**Criterio aplicado**: [4] Automatizar transiciones de estado que reflejan un hecho objetivo (extendido: el hecho debe notificarse, no solo reflejarse en un número que baja).

La campanita de Inicio ya muestra "N consultas esperando respuesta" mientras `mensajes.estado === 'abierto'` (`Dashboard.jsx:397`) — esto reutiliza el mismo patrón de `alertas.push(...)` que el ing validó implícitamente para citas/inventario/CRM. Pero cuando el equipo de soporte responde y el mensaje pasa a `resuelto` (con `m.respuesta` ahora lleno, `Mensajes.jsx:310-316`), la única señal es que ese número **baja** — no hay ninguna entrada nueva en `alertas` tipo "tienes una respuesta nueva a tu consulta". Alguien que no vuelve a entrar a Mensajes por su cuenta no se entera de que le respondieron.

**Cambio propuesto**: agregar a `Dashboard.jsx` un conteo de mensajes `resuelto` respondidos en las últimas 48h que el usuario todavía no vio (ej. comparando `respondido_at` contra un timestamp de última visita a Mensajes en `localStorage`, mismo criterio ya usado para `optica_crm_contactos_hoy` en CRM), y empujar una entrada `alertas.push({..., texto: "Te respondieron: <asunto>", destino: "mensajes"})`.

- **BD**: no (todo el dato ya existe: `respuesta`, `respondido_at`). **Riesgo**: bajo. **Tiempo**: ~1-2h.

---

## Portal del paciente (`PortalPaciente.jsx`)

### P1. "Solicitar mis medidas completas" no envía nada — es solo un `useState` local — ✅ **Implementado** (`f727a8b`, migración `0080`)
**Criterio aplicado**: [9] Flujos conectados end-to-end. *(Este hallazgo se lee más como un defecto funcional que una mejora de diseño — se incluye igual porque apareció al aplicar el mismo criterio con el que se revisó todo lo demás.)*

> Se descartó reutilizar `mensajes` (ese canal es óptica-admin ↔ Diego/superadmin, no paciente↔óptica — ver `docs/feedback-ing/` conversación del 30/09). Se construyó en su lugar `pacientes_base.medidas_solicitadas_en timestamptz` + RPC `solicitar_medidas_paciente` (token, reutiliza `sesion_paciente_valida` de la migración 0063) — más liviano que el precedente de `solicitudes_eliminacion_paciente` porque no necesita tabla ni motivo aparte. El personal ve un banner en el perfil del paciente y una entrada en la campana de notificaciones; "marcar atendida" es un update normal sin RPC nuevo de ese lado.

El botón "Solicitar mis medidas completas" (`PortalPaciente.jsx:643-649`) llama únicamente a `setMedidasSolicitadas(true)` — no hay ningún `supabase.rpc(...)` ni insert de por medio. El paciente ve "Solicitud enviada" (con ícono de check verde) pero **nadie del lado de la óptica recibe ni ve esa solicitud en ningún lado** — no hay fila nueva en `mensajes`, ni entrada en `alertas`, ni tabla dedicada. Es una confirmación visual sin acción real detrás — justo lo que CLAUDE.md §2 pide evitar ("Micro-feedback Inmediato" implica que la confirmación refleje algo que de verdad ocurrió), y contradice el criterio [9] con el ejemplo más literal posible: un botón que aparenta conectar dos lados del sistema y no conecta ninguno.

**Cambio propuesto**: que el botón inserte una fila en `mensajes` (`tipo: "consulta"`, remitente el paciente en vez de un admin — requiere permitir que `RLS` de `mensajes` acepte un insert autenticado por token de paciente, no solo por `perfiles.id`) o, más simple y reutilizando lo ya construido en M1, una entrada en una tabla de "solicitudes" que alimente la campanita de Inicio del lado óptica.

- **BD**: probablemente sí (política RLS nueva sobre `mensajes`, o tabla dedicada si se prefiere no mezclar canales paciente/óptica). **Riesgo**: medio (toca autenticación de pacientes contra una tabla pensada para staff). **Tiempo**: ~3-4h.

### P2. El portal no muestra nada de compras, ventas o pagos pendientes del propio paciente
**Criterio aplicado**: [9] Flujos conectados end-to-end.

Búsqueda confirmada: ni "pago", "compra", "factura" ni "producto" aparecen en ningún lado de `PortalPaciente.jsx`. El lado staff sí trackea esto en detalle — `Pacientes.jsx` muestra un badge "Pago pendiente" con el monto adeudado (`Pacientes.jsx:1255`, alimentado por `facturasVenta`/`ventas` con `estado === 'pendiente_pago'`) — pero el paciente dueño de esa deuda no tiene ninguna forma de verla por su cuenta en su propio portal. Esto es la extensión natural del patrón #23 de `reference_ing_reasoning_model.md` (unificar cada acción con costo en una vista de pagos por paciente) al lado del paciente, no solo al del staff — el ing nunca lo pidió explícitamente para el portal, pero es la misma lógica que si aplicó del lado interno.

**Cambio propuesto**: una quinta sección en `OPCIONES` (`PortalPaciente.jsx:48-53`), "Mis compras", listando `ventas`/`facturasVenta` del paciente (ya se resuelven por `pacienteId` igual que `misConsultas`/`misCitas`) con su estado de pago — sin exponer datos de otros pacientes, solo lectura.

- **BD**: no (las tablas y RLS de lectura por paciente para `citas`/`consultas` ya existen con este mismo patrón — replicarlo para `ventas`/`facturas_venta`). **Riesgo**: bajo-medio (nueva política RLS de solo-lectura). **Tiempo**: ~3-4h.

---

## Resumen

| Módulo | Hallazgos | Estado | Requieren BD | Ya construido/reutilizable |
|---|---|---|---|---|
| Inventario | I1, I2, I3 | I1 ✅ `51ee470` (0081) · I3 ✅ `b0d0a91` · I2 ⏳ pendiente | I1 (hecho) | I3 reutilizó el deep-link existente (`accionPacienteInicio`), no hizo falta construirlo |
| CRM | C1 | ✅ `b0d0a91` | No | Reutilizó el deep-link de I3 |
| Reportes | R1, R2 | R1 ✅ `90c4b53` (alcance final: ocultar KPIs financieros) · R2 ⏳ pendiente | No | R1 reutilizó `es_optometra` (D4) |
| Configuración | G1 | ⏳ pendiente | Sí | Reutiliza el patrón de `opticas.marca` |
| Mensajes | M1 | ⏳ pendiente | No | Reutiliza el patrón `alertas.push` de `Dashboard.jsx` |
| Portal del paciente | P1, P2 | P1 ✅ `f727a8b` (0080) · P2 ⏳ pendiente | P1 sí (hecho) · P2 no | P2 reutiliza el patrón RLS de lectura por paciente ya usado en citas/consultas |

5 de 10 hallazgos implementados y verificados (2026-09-30): I1, I3, C1, R1, P1. Quedan pendientes de confirmar con Diego: I2, R2, G1, M1, P2 — mismo criterio de este documento, sin construirse todavía.
