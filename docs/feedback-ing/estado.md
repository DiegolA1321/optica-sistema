# Estado de los pedidos del ing — transcripciones vs. código actual

**Fecha**: 2026-09-29
**Metodología**: solo lectura — sin cambios de código ni de datos, sin `git stash`. Cada pedido se contrastó contra el código real del repo (no contra la memoria de sesiones anteriores), citando archivo:línea como evidencia. Sigue la disciplina ya establecida para transcripciones del ing: cada comentario se lee como evidencia de lo que observó en el sistema en ese momento, no como un ticket literal — se busca la causa real y, cuando una sesión posterior revisó su propia posición (ver nota en Citas médicas), se sigue el criterio más reciente.

**Nota de ubicación**: pediste `docs/feedback-ing/`, pero las 10 transcripciones reales están en `feedback-ing/` (raíz del repo, ignoradas por git vía `/transcripcion_*.txt` en `.gitignore`, nunca se subieron). Se leyeron desde ahí; este archivo de salida se creó donde pediste.

**Dos fuentes, dos fechas distintas**:
- `transcripcion_ordenada.txt` (3 sept.) — reunión temprana, checklist amplio por módulo (página pública, usuarios/permisos, configuración, reportes, citas, inventario, CRM, horario, superadmin).
- `transcripcion_audio ING1.txt` … `ING9.txt` (9 sept.) — recorrido en vivo del sistema ya construido, más centrado en Inicio, Citas médicas y la Ficha clínica. Varios puntos de esta sesión revisan/afinan lo pedido el 3 de septiembre — cuando hay una revisión explícita, se prioriza esta fuente por ser el criterio más reciente del propio ing.

Verificación cruzada: cada módulo se auditó con un sub-agente de solo lectura dedicado; varios de sus hallazgos se re-verificaron directamente línea por línea antes de cerrar este reporte (dos falsos "Pendiente" se corrigieron: el reporte de ventas por producto en Inventario y el bloque "Pacientes que más refieren" en CRM sí existen).

---

## Tabla de estado por módulo

### Página pública (Login.jsx / AgendarCitaPublica.jsx)
*Fuente: transcripcion_ordenada.txt "PÁGINA PÚBLICA", + ING6*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Imágenes subibles en tarjetas de servicio, sin ícono automático | ✅ Hecho | `Login.jsx:980-989` — `s.imagenUrl` se respeta tal cual la subió el admin; sin foto cae a un ícono plano de marca (no una ilustración genérica de stock) | BD + UI |
| 2-3 colores de acento configurables (no solo azul/negro) | ✅ Hecho | `Login.jsx:329,333` — `colorAcento` **y** `colorSecundario`, ambos con selector de color real en `PersonalizacionLogin.jsx:184-243`. 2 colores configurables, cumple el rango pedido (2-3) | BD + UI |
| Bloque de 3 servicios activable/desactivable | ✅ Hecho | `Login.jsx:334-336,874,954` — `serviciosActivos`, oculta el bloque completo si está apagado | BD + UI |
| Imagen de hero genérica (stock de Google) reemplazada | ✅ Hecho | `Login.jsx:931-947` — el logo propio del admin reemplaza la ilustración genérica; 0 imágenes de stock en el archivo | BD + UI |
| Horario de atención reubicado cerca del CTA / arriba | ✅ Hecho | `Login.jsx:885-906` (badge junto al CTA del hero) y `1286-1302` (footer) | UI |
| Cédula + fecha de nacimiento obligatorias, dedup por cédula | ✅ Hecho | `AgendarCitaPublica.jsx:148-176,485` — envío bloqueado sin cédula válida ni nacimiento; RPC `crear_cita_publica` resuelve o crea el paciente por cédula | BD + UI |

### Usuarios y permisos (Usuarios.jsx)
*Fuente: transcripcion_ordenada.txt "USUARIOS Y PERMISOS"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Preguntar si el admin es también el optómetra/licenciado | ✅ Hecho | `SuperadminPanel.jsx:127-128,1561,3312-3359` — campo `esOptometra`/`es_optometra` | BD + UI |
| Quitar tipos fijos de usuario; solo nombre/correo/clave + permisos manuales | ✅ Hecho | `Usuarios.jsx:92-100,206-253` — sin selector de "tipo", solo checkboxes por módulo | UI |
| Botón dice "Crear usuario", no "Crear asistente" | ✅ Hecho | `Usuarios.jsx:311,597` | UI |
| Permisos agrupados en categorías, con checkbox de "toda la categoría" | ✅ Hecho | `Usuarios.jsx:44-73` (`CATEGORIAS`), `177-184` (`alternarCategoria`) | UI |
| Optómetra (admin principal) siempre con todos los permisos por defecto | ✅ Hecho | El sistema de permisos granulares solo aplica a `rol='asistente'`; `rol='admin'` no pasa por él | BD (diseño de rol) |
| Alias/etiqueta de rol descriptiva (ej. "Secretaria") | ✅ Hecho | `Usuarios.jsx:96,410-414,492-503` (`etiquetaRol`) | BD + UI |
| Editar permisos después de creado el usuario | ✅ Hecho | `Usuarios.jsx:157-167,193-204` (`abrirEditar`) | UI |
| Log de actividad por usuario, visible al admin principal | ✅ Hecho | `Usuarios.jsx:115-143` (`cargarActividad`, tabla `logs_optica`) | BD + UI |

### Configuración (Configuracion.jsx)
*Fuente: transcripcion_ordenada.txt "CONFIGURACIÓN"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Política: reagendar/cancelar propia cita + recordatorio 1 día antes | ✅ Hecho | `Configuracion.jsx:318,343-344,359` | BD + UI |
| Mantener alertas de confirmación al guardar (pedido de preservar, no un hallazgo) | ✅ Sigue existiendo | `Configuracion.jsx:213-214,220-221` | UI |
| Diagnóstico: categorías fijas + detalle libre aparte | ✅ Hecho | `Configuracion.jsx:413-427` (catálogo editable de categorías); `ConsultaMedica.jsx` separa `diagnosticoCategorias` de `diagnostico` (detalle) | BD + UI |
| Categorías de inventario sin precio (el precio va en Inventario) | ✅ Hecho | `Configuracion.jsx:428-434` — catálogo simple, sin campo de precio | UI |
| Navegación por módulo / colapsar secciones (el propio ing marcó esto como "revisar solo cuando el funcionamiento esté completo") | ✅ Hecho | `Configuracion.jsx:194-195,233,282,291,392` — pestañas "Políticas y servicios" / "Catálogos" | UI |

### Reportes (Reportes.jsx)
*Fuente: transcripcion_ordenada.txt "REPORTES"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Renombrar "Bien corregidos" → "Tratamientos finalizados" (u otro) | ⏳ **Pendiente — decisión de negocio** | `Reportes.jsx:324` sigue diciendo "Bien corregidos". El propio ing pidió "confirmar el criterio exacto con la optómetra antes de cerrarlo" — sigue siendo tu decisión, no un olvido técnico | UI |
| Redefinir "Controles vencidos" (= tratamiento terminado, no atraso) | ⏳ **Pendiente** | `Reportes.jsx:325` — verificado: la métrica actual mide "pasó la fecha de su próximo control sin volver" (atraso/recordatorio), un concepto **distinto** al que pidió el ing ("ya no necesita más controles porque su tratamiento terminó" = alta). No es solo un rename, son dos conceptos que nunca se distinguieron | UI (la fecha de próximo control ya existe, no hace falta columna nueva) |
| Encuesta de satisfacción integrada a Reportes | ✅ Hecho | `Reportes.jsx:327`, componente `EncuestaSatisfaccion` | BD + UI |
| Métrica: % de citas solicitadas que se atienden | ✅ Hecho | `Reportes.jsx:307-314,326` — comentario cita el ejemplo textual del ing ("90% de conversión") | UI |

### Citas médicas + Inicio (Citas.jsx, Inicio.jsx)
*Fuente: transcripcion_ordenada.txt "CITAS MÉDICAS" + ING1, ING2, ING4, ING5, ING6*

**Nota importante**: el pedido original del 3 de septiembre era diferir la creación del registro del paciente hasta que la cita se marcara "atendida/finalizada". El propio ing **revisó esa posición en vivo el 9 de septiembre (ING6)**: *"todo paciente que tiene su cita, es un paciente que ya existe en el registro"* — pidiendo en cambio una etiqueta de origen (manual/web) en vez de diferir la creación. El sistema sigue el criterio más reciente.

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Separar "primera vez" (sin paciente) de "seguimiento" | ✅ Hecho | `Citas.jsx:730` filtro "Primera vez"; badge gated por `!cita.pacienteId` | UI |
| Paciente creado automático solo al "atender"/finalizar (posición del 3 sept.) | ✅ Hecho — con el criterio revisado por el ing el 9 sept. | El paciente se resuelve/crea por dedup de cédula al **agendar** (ver Página pública), no se difiere hasta atender. `Citas.jsx:460-476` (`atenderCita`) no crea un paciente nuevo si ya viene vinculado. Esto sigue la posición más reciente del ing (ING6), que reemplazó explícitamente la del 3 de septiembre | BD |
| Métrica % citas → pacientes atendidos | ✅ Hecho | `Reportes.jsx:307-326` | UI |
| Flujo Agendar/Gestionar, Atender→ficha directa, Ver perfil sin re-buscar | ✅ Hecho | Botón único "Gestionar cita" (`Citas.jsx:689-696`) cubre buscar/añadir→motivo→horario→confirmar; `atenderCita` salta directo a la ficha; "Ver perfil" visible cuando `cita.pacienteId` existe | UI |
| Inicio: "Últimas citas" con fallback al historial si no hay citas hoy | ✅ Hecho | `Inicio.jsx:147-168` — comentario cita explícitamente la prueba en vivo del ing con la agenda vacía | UI |
| Inicio: inventario ordenado por menor stock | ✅ Hecho | `Inicio.jsx:138-142` — más sofisticado que lo pedido: prioriza stock crítico primero | UI |
| Quitar "búsqueda rápida de paciente" del Inicio | ✅ Hecho | Confirmado ausente en `Inicio.jsx` | UI |
| Quitar "Actividad reciente" del Inicio | ✅ Hecho — ajuste de copy, no eliminación (commit `b66e5f2`) | Investigado a fondo antes de tocarlo: no es el widget que ING1 quería quitar (esa "búsqueda rápida" ya no existe), es la implementación real de un pedido distinto y posterior (exponer `logs_optica` también al admin de la óptica). Se ajustó el copy ("Registro de actividad" / "Qué cambió y quién lo hizo") para que no se lea como atajo de navegación, sin eliminar la sección | UI |
| Contraste/fondo de tarjetas del dashboard | ✅ Hecho | Todas las secciones usan `bg-white border-slate-200/60` consistente | UI |
| Renombrar a "Gestionar citas"/"Gestionar pacientes"/"Gestionar producto" | ✅ Hecho | `Inicio.jsx:194,206` + tercer atajo de inventario | UI |
| Orden consistente entre los 3 botones y las 3 secciones de abajo | ✅ Hecho | `Inicio.jsx:190-225` | UI |
| Horario flexible + "hora actual"/duración estimada | ✅ Hecho | `Citas.jsx:116-118,1220,1248-1265`; `conflictoHorarioPersonalizado` en `disponibilidad.js:312` | UI + lógica |
| Slot bloqueado por duración real hasta que la cita se resuelva | ✅ Hecho | `disponibilidad.js:279-324` — solapamiento por duración real, no por string de hora fija | Lógica (frontend, sobre `duracion_minutos` ya en BD) |
| Colores de estado: Pendiente=naranja, No asistió=rojo, Atendida=verde, En atención=azul | ✅ Hecho | `Citas.jsx:920-939` — cada uno con ícono distinto además del color | UI |
| Ocultar "Crear paciente" si la cita ya tiene paciente vinculado | ✅ Hecho | `Citas.jsx:841,965` (`!cita.pacienteId`) | UI |
| Badge de origen (web/recepción) | ✅ Hecho (commit `93f38ea`) | `Citas.jsx:848-860` — ícono compacto con `title`/`aria-label`, sin texto siempre visible, tal como pidió ING9 | UI |
| Auto no-show tras margen de gracia (~10 min) | ✅ Hecho | `supabase/migrations/0071_auto_no_asistio.sql`, `0076_no_asistio_10_minutos.sql` — pg_cron cada 5 min | **BD** |
| Notificación activa cuando se cumple la hora sin cambio de estado | ⏳ Pendiente — **decisión ya tomada en contra** | No existe canal push/SMS/correo para esto. Código cita explícitamente: *"Decisión de Diego (2026-09-10): el aviso es solo visual... no se agrega ningún correo"*. No es un olvido — es una decisión ya cerrada, dejar constancia por si se quiere reabrir | BD (requeriría canal nuevo) |
| "En Atención" automático al abrir ficha / "Atendida" automático al guardar | ✅ Hecho | `Citas.jsx:464-465` (En Atención al atender), `ConsultaMedica.jsx:840-843` (Atendida al guardar) | BD + UI |
| Columna/filtro "creación" manual vs. web en la lista de citas | ✅ Hecho (commit `6001227`) | `Citas.jsx` — nuevo `filtroOrigen`, mismo patrón de píldoras que el filtro de tipo ya existente | UI (el dato ya estaba en BD) |
| "Atender ahora" más prominente | ✅ Hecho (commit `7b60307`) | Se movió al pie de la tarjeta como botón con etiqueta y relleno sólido, mismo patrón de botón primario del resto del sistema | UI |

### Inventario (Inventario.jsx, FacturaVentaModal.jsx)
*Fuente: transcripcion_ordenada.txt "INVENTARIO"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Crear categoría nueva sin salir del flujo (modal rápido) | ✅ Hecho | `src/componentes/CampoCategoria.jsx:8-10` — comentario cita literalmente "reunión con el ing"; combobox + botón "+" inline (`Inventario.jsx:589,665`) | UI |
| Orden de campos: categoría → descripción → resto, Observación al final | ✅ Hecho | `Inventario.jsx:587-619` — orden exacto: Categoría, Descripción, Stock/Precio, Stock mínimo, Observación (opcional, última) | UI |
| Unificar "Editar" y "Añadir stock" | ✅ Hecho | `Inventario.jsx:88-89` — comentario: "antes eran dos acciones/modales separados (feedback del ing)"; un solo botón "Editar / añadir stock" | UI |
| Reporte por producto (compradores, ingreso, pendientes de pago) | ✅ Hecho | `Inventario.jsx:767-814` — modal "Reporte de ventas": unidades vendidas, ingreso generado, con pago pendiente, pacientes distintos que lo compraron | UI (lee ventas ya existentes) |
| Pagos pendientes visibles en el perfil del paciente | ✅ Hecho | `Pacientes.jsx:1178,1844` — badge "Pago pendiente" + monto en el perfil | UI |
| Vender producto desde búsqueda de paciente o desde Inventario | ✅ Hecho | Reusa `VentaProductoModal` compartido entre ambos flujos | UI |
| Pago directo/tarjeta/cuotas + estado | ✅ Hecho | `src/utilidades/ventas.js:5-13` (`METODOS_PAGO`); estados pendiente/completado en `Pacientes.jsx:320` | BD (tablas existentes) |

### CRM / Mensajes (CRM.jsx)
*Fuente: transcripcion_ordenada.txt "CRM / MENSAJES"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Bloque "Pacientes más frecuentes" con WhatsApp | ✅ Hecho | `CRM.jsx:394-404` (`listaFieles`) | UI |
| Bloque "Cumpleaños próximos" con WhatsApp | ✅ Hecho | `CRM.jsx:405-415` (`listaCumpleanos`) | UI |
| Bloque "Sin visitar hace tiempo" (reactivación) con WhatsApp | ✅ Hecho | `CRM.jsx:416-426` (`listaInactivos`) | UI |
| Bloque de "avisos" separado de los 3 anteriores | ✅ Hecho | Tabla `avisos` en Supabase, sección propia | BD + UI |
| Botón "Ver detalles" con tabla completa ordenable por bloque | ✅ Hecho | `onVerDetalles={() => setDetalleAbierto(...)}` en cada `BloqueContacto` | UI |
| WhatsApp con mensaje predefinido según contexto | ✅ Hecho | Confirmado presente en los 4 bloques | UI |
| Quitar o rehacer "referidos" ("no aporta") | ✅ Hecho — rehecho, no eliminado | `CRM.jsx:383-393` — ya no es un bloque estático; usa `listaReferidos` con datos reales, mismo patrón `BloqueContacto` top-5 + "Ver detalles" que los otros 3 bloques | UI |

### Mi horario (Horario.jsx)
*Fuente: transcripcion_ordenada.txt "MI HORARIO"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Diferenciar horario general (óptica) de "Mi horario" (personal) | ✅ Hecho | `Horario.jsx:51` — comentario explícito sobre esta distinción | BD + UI |
| Marcar ausencia propia como respaldo en el sistema | ✅ Hecho | `Horario.jsx:287-393,793` — sección "Ausencias", modal "No podré asistir" | BD + UI |

### Panel superadministrador (SuperadminPanel.jsx)
*Fuente: transcripcion_ordenada.txt "PANEL SUPERADMINISTRADOR"*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| Estado "Suspendida" de una óptica (confirmación, se mantiene) | ✅ Sigue existiendo | `SuperadminPanel.jsx:450,886-907,1340-1343` | — |
| Leads/CRM se mantiene; "pago pendiente" ocultable | ✅ Hecho | Pestaña "Leads" completa; `estado_pago`/`monto_mensual` gateados por `MODO_SAAS_VISIBLE` | UI (gate de config) |
| Mensajería del superadmin (confirmación, se mantiene) | ✅ Sigue existiendo | Flujo completo de mensajes/aviso general presente | — |
| "Próximos cumpleaños" de admins (confirmación, se mantiene) | ✅ Sigue existiendo | Sin señal de que se haya quitado | — |
| Actividad del superadmin solo sus acciones; detalle por óptica aparte | ✅ Hecho | Comentario explícito: *"'Ver actividades' de esa óptica (logs_optica) — separado a propósito de la sección 'Actividad' general del panel superadmin"* | BD (tabla `logs_optica` + RLS) |
| Bloque de actividad expuesto también al admin de la óptica | ✅ Hecho | `Usuarios.jsx:117,127` — *"Solo lo ve el administrador principal (RLS: logs_optica_admin_select)"* | BD (política RLS) |
| Filtro por fecha en actividad | ✅ Hecho | `filtroFechaActividad`, `filtroActorActividad` | UI |
| Logs en tabla de BD para trazabilidad | ✅ Hecho | `registrarAuditoria()` inserta en tabla de logs, consumida en 4 archivos | BD |
| Un superadmin puede crear otros superadmins | ✅ Hecho | Modal "Agregar superadmin" (migrado a accesibilidad esta misma sesión) | BD + UI |
| Impersonación — "entrar como" admin de una óptica | ✅ Hecho | `SuperadminPanel.jsx:3130-3243` — botón "Entrar como administrador" | BD (requiere sesión válida del lado servidor) |
| Solo el superadmin edita datos base de la óptica | ✅ Hecho | Trigger `opticas_restringe_columnas` (migración 0051) | BD (trigger) |
| Slug genérico/corto (no basado en el nombre); nombre único con sugerencia | ✅ Hecho | `generarCodigoOptica()` (slug aleatorio de 6 caracteres); validación de nombre único con sugerencia automática ("Carla Visión 01") | BD |

### Ficha clínica (ConsultaMedica.jsx)
*Fuente: ING7, ING8, ING9*

| Pedido | Estado | Evidencia | BD o UI |
|---|---|---|---|
| "Atender" entra directo a la ficha clínica | ✅ Hecho | `Citas.jsx:460-465` → `onAtender` abre `ConsultaMedica` con `citaIdInicial`/`pacienteInicial` | UI |
| Separar "motivo" (fijo) de "Detalle de la consulta" (libre) | ✅ Hecho | `ConsultaMedica.jsx:147-153` — comentario cita explícitamente esta separación pedida en vivo | UI |
| Antecedentes del paciente (fijos) separados, primero, no repetidos cada vez | ✅ Hecho | Bloque colapsable "Antecedentes del paciente", con vista previa de línea base sin necesidad de expandir | UI |
| Minimizar "Estado de corrección"/"Tendencia de graduación" (no protagonismo) | ✅ Hecho | `ConsultaMedica.jsx:1737-1745` — comentario cita "ING7" explícitamente; se retiró de la receta impresa, queda como referencia interna | UI |
| Checkbox medidas de refracción: config general + override por consulta | ✅ Hecho | `mostrarMedidasPaciente` (config general) + `incluirMedidasReceta` (por consulta) | UI (config ya en BD) |
| Diagnóstico categoría fija + detalle libre; checkbox "¿Recomendar lente?" con buscador | ✅ Hecho | `diagnosticoCategorias`, `recomendarLente`, `lenteRecomendadoProductoId` vinculado a inventario | UI |
| Separar flujo de venta del flujo de diagnóstico | ✅ Hecho | Comentario cita textualmente al ing ("no lo incluyo directamente aquí") | UI |
| Modal "¿Registrar venta?" cero fricción al guardar con lente vinculado | ✅ Hecho | `mostrarConfirmarVenta` — se dispara solo si hay lente vinculado y no se armó factura manual ya | UI |
| Renombrar "Pagos" → "Productos" | ✅ Hecho | `Pacientes.jsx:1864-1874` — comentario: *"El ing rechazó tanto 'Pagos' como 'Ventas' — 'aquí están los productos que le he vendido al paciente'"* | UI |
| Bloque "Última cita" visible + botón "Ver historial" separado | ✅ Hecho | `TarjetaVisita` inline + botón "Ver historial" que abre el modal completo | UI |
| Badges "Registrado"/"No registrado" en secciones colapsables | ✅ Hecho | `EtiquetaRegistro` en retinoscopía/examen físico/biomicroscopía | UI |
| Validación bloqueante al avanzar sin completar campos obligatorios | ✅ Hecho | `ConsultaMedica.jsx:936-958` (`irA`) + banner "No puedes continuar todavía" | UI |
| Monto/costo de la consulta, aparte de venta de productos | 🟡 Parcial | Se puede facturar como línea de "servicio" genérica (`facturaTipoLinea`), pero no es un campo obligatorio y dedicado como pidió el ing | BD (columna nueva o convención de línea de factura — requiere decidir esquema) |
| Factura multi-producto real | ✅ Hecho | `facturaLineas` (array) + RPC `crear_factura_venta` — Punto 06, migración 0072 | BD (ya migrada) |
| Ícono para origen de la cita (no texto largo) | 🟡 Parcial (ver Citas médicas arriba) | Mismo hallazgo que en la tabla de Citas | UI |
| Estados automáticos completos (En Atención/Atendida/No Asistió) | ✅ Hecho | Ver tabla de Citas médicas arriba | BD + UI |
| Marcar "Atendido" manualmente sin ficha completa | ✅ Hecho | `Citas.jsx:990` — botón en "Más acciones" marca "Atendida" directo, sin pasar por la ficha | UI |
| Categoría de diagnóstico "Otro" con detalle libre | ✅ Hecho | `ConsultaMedica.jsx:1760-1792` — "Otro" siempre disponible, detalle obligatorio si se elige | UI |

---

## El error "Revisa tu conexión e inténtalo de nuevo" (ING3)

**Contexto del audio**: mientras se registraba una cita en vivo, un horario "se desactivó porque pasamos la hora", el ing recalculó a mano una hora posterior, seleccionó al paciente y el motivo, y al confirmar la cita apareció ese mensaje genérico.

**¿Sigue pudiendo ocurrir hoy?** Sí, pero como *fallback* deliberado para errores no clasificados — no como el bug real que casi con certeza causó esa ocurrencia puntual.

La función exacta es `agendarCita` (`Citas.jsx:287-334`). El error que se muestra depende del tipo de fallo:

```js
// Citas.jsx:309-332 — actual
if (errorInsert) {
  setError(
    errorInsert.code === "23505"
      ? "Ese horario ya no está disponible — alguien más lo acaba de reservar. Elige otro."
      : esErrorSinPermiso(errorInsert)
        ? MENSAJE_SIN_PERMISO
        : "No se pudo registrar la cita. Revisa tu conexión e intenta de nuevo."
  )
}
```

El comentario justo arriba de esa función (líneas 310-314) explica el historial real:

> *"Antes esta llamada descartaba el error (solo desestructuraba `data`) — si el insert fallaba (red, RLS, o el índice único que evita doble reserva, hallazgo E7), igual se mostraba 'cita guardada correctamente' con un id inventado en el cliente, sin que nadie se enterara de que nunca llegó al servidor."*

**Conclusión**: el bug más probable detrás de ese momento no era la conexión en sí — el código de entonces podía fallar en silencio y mentir sobre el éxito. Eso ya está corregido: hoy todo fallo de guardado se muestra con 3 niveles de especificidad — choque de horario (mensaje concreto y accionable), sin permiso (mensaje concreto), y cualquier otro fallo no clasificado, incluida una caída de red real, cae en el mensaje genérico que viste en ING3. Ese mensaje genérico es hoy el *fallback* de diseño intencional en ~40 puntos del sistema, no algo que arreglar caso por caso.

**Lo que no se puede confirmar sin los logs de esa sesión en vivo**: si esa ocurrencia puntual específica fue una caída de red real (plausible, era una demo en vivo) o el bug de guardado silencioso que ya se corrigió. Ambos son consistentes con el audio; el segundo es la explicación más probable dado que el propio código documenta ese bug exacto como ya identificado y resuelto.

---

## Se puede hacer hoy de forma segura
*(Solo interfaz, bajo riesgo, rápido — no toca base de datos ni lógica de citas)*

Las 4 implementadas el 2026-09-29 en la rama `mejoras-ing`, una por commit, `npm test` en verde (78/78) después de cada una:

1. ✅ **Hecho** (commit `93f38ea`, "fix: badge de origen como ícono compacto con tooltip"). Badge de origen (web/recepción) en `Citas.jsx` — ahora ícono compacto con `title`/`aria-label` (tooltip nativo), sin texto siempre visible, tal como pidió ING9. El ícono queda `aria-hidden`; el nombre accesible vive en el contenedor.
2. ✅ **Hecho** (commit `7b60307`, "fix: botón 'Atender ahora' más visible en la tarjeta de cita"). Se movió del header de la tarjeta (ícono suelto, mismo tamaño que acciones secundarias) al pie, como botón con etiqueta visible y relleno sólido — mismo patrón de botón primario que el resto del sistema (`GRAD`, `hover:-translate-y-0.5`). Mismo `onClick`/condición que antes, sin cambios de lógica.
3. ✅ **Hecho** (commit `6001227`, "feat: filtro por origen (web/recepción) en Citas médicas"). Nuevo filtro `filtroOrigen` (Cualquier origen / Web / Recepción), mismo patrón visual de píldoras que el filtro de tipo ya existente, eje independiente y compuesto con los filtros de estado y tipo.
4. ✅ **Hecho — ajuste de copy, no eliminación** (commit `b66e5f2`, "fix: aclarar copy de 'Actividad reciente' como registro de auditoría"). Investigación antes de tocar el código: este bloque **no es** el widget que ING1 pidió quitar (aquella "búsqueda rápida de paciente" ya no existe en ninguna parte); es la implementación real de un pedido distinto y posterior — exponer el registro de `logs_optica` también al admin de la óptica (`transcripcion_ordenada.txt`, sección Panel Superadministrador). Eliminarlo habría deshecho ese pedido sin resolver el de ING1. Se optó por un ajuste cosmético: "Actividad reciente" → "Registro de actividad", subtítulo "Qué cambió y quién lo hizo" — para que se lea como auditoría, no como atajo de navegación.

## Para después
*(Requiere base de datos, decisión de negocio, o pruebas con datos reales)*

1. **Definir y renombrar "Bien corregidos"** en Reportes — pendiente explícitamente de tu decisión y la de la optómetra sobre el nombre/criterio exacto.
2. **Redefinir "Controles vencidos"** para medir fin-de-tratamiento en vez de atraso — requiere decidir el criterio clínico primero; una vez decidido, el cambio de cálculo/label es solo interfaz (la fecha ya existe en BD).
3. **Notificación activa** (push/SMS/correo) cuando una cita pasa su hora sin cambio de estado — Diego ya decidió explícitamente el 2026-09-10 mantenerlo solo visual, sin canal activo. Se deja acá por si se quiere reabrir esa decisión, no porque falte implementar algo que se haya pedido y olvidado.
4. **Campo dedicado "monto de la cita/consulta"**, separado de la venta de productos — hoy se cubre indirectamente con una línea de "servicio" genérica en la factura; si se quiere un campo obligatorio y distinto, implica decidir el esquema (¿columna en `consultas`? ¿siempre una línea de factura?).
