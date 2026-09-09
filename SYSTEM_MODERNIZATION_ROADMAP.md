# SYSTEM_MODERNIZATION_ROADMAP.md
### Diego Óptica — Auditoría de modernización y evolución profesional
**Fecha:** 2026-09-09 (v2 — auditoría exhaustiva) · **Alcance:** los 22 archivos de `src/paginas`, los 6 de `src/componentes`, las 12 utilidades de `src/utilidades` + `src/lib`, `App.jsx` completo, y las **54 migraciones SQL completas** (no muestreadas). Cero cambios de código en esta fase.

**Nota sobre esta versión:** la v1 de este documento se basó en una inspección dirigida (grep + lectura parcial). Diego pidió correctamente una pasada exhaustiva antes de aprobar nada, porque todo lo que salga de acá se va a implementar. Esta v2 lee cada archivo completo. Como resultado: **2 ítems de la v1 se corrigen** (ya estaban implementados) y **se agregan 24 hallazgos nuevos**, incluyendo 3 críticos que no estaban en la v1.

---

## A. Resumen ejecutivo y estado de salud actual

**Fortalezas verificadas** (sin cambios respecto a la v1 — siguen confirmadas): cifrado AES real de historia clínica, 76 políticas RLS con aislamiento multi-tenant exigido por la base de datos (no solo el frontend), automatización de recordatorios por cron+email, 71 tests pasando, code-splitting con reintento, Sentry en producción, **100% de las ~25 funciones `security definer` fijan `search_path` explícitamente** (una disciplina de seguridad que se pasa por alto incluso en código profesional), **cero secretos hardcodeados** en 54 migraciones.

**Correcciones a la v1** (la auditoría exhaustiva encontró que estos 2 puntos ya estaban resueltos):
- ~~F2 — agregar promedio de satisfacción a Reportes~~ → **ya implementado**: existe una sección completa "Satisfacción de pacientes (CSAT)" con KPI y distribución 1-5.
- ~~G2 — umbral de stock configurable por producto~~ → **ya implementado**: `esStockBajo()` ya soporta umbral por producto (`producto.critico`), expuesto en el formulario de edición de Inventario.

**Los 3 hallazgos nuevos más importantes de esta pasada:**

1. 🔴 **Datos clínicos descifrados en `localStorage` del navegador.** `App.jsx` guarda pacientes/citas/consultas completos —incluyendo diagnóstico, antecedentes y alergias ya descifrados por la vista de Supabase— en `localStorage`, sin cifrar. Esto **anula en el cliente** el cifrado AES que sí existe en la base de datos (migración 0043): cualquiera con acceso al navegador (DevTools, malware, un equipo compartido en la óptica) puede leer historia clínica completa desde `localStorage.getItem('optica_consultas')`.
2. 🔴 **La causa real del bug de gráficos borrosos no era la que corregimos esta sesión.** El proyecto ya tiene un hook (`useAnchoElemento` en `graficos.js`) creado específicamente para evitar gráficos SVG "estirados/borrosos", y los otros 2 gráficos de Superadmin sí lo usan correctamente. El gráfico **"Actividad por día" es el único que no lo usa** — tiene un `viewBox` fijo con `preserveAspectRatio="none"`, exactamente el patrón que el propio proyecto ya había identificado como causante de la falta de nitidez. El fix aplicado esta sesión (quitar el `transform` permanente) fue una mejora real pero no atacó la causa raíz de este gráfico específico.
3. 🔴 **La verificación en dos pasos (MFA) se puede saltar por completo.** Hoy MFA solo se exige en la capa de `Login.jsx` — no hay ninguna política a nivel de base de datos que bloquee una sesión válida sin el segundo factor completado. Una llamada directa a la API de Supabase con un token de sesión ya emitido (antes de completar el código MFA) no está bloqueada por nada.

**Visión de modernización (sin cambios):** cerrar brechas reales de seguridad/rendimiento/accesibilidad, sumar patrones de interacción donde reducen fricción clínica real, y ser honesto sobre qué excede el alcance de una tesis de un solo desarrollador.

---

## B. Patrones UX e interactivos

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| B1 | Búsqueda global | Solo busca pacientes | Ampliar a citas del día y productos | Cubre más de lo que el personal busca en el día a día | 🟡 MEDIA | Bajo | Baja |
| B2 | Paleta de comandos (Cmd/Ctrl+K) | No existe | Paleta ligera de navegación + acciones frecuentes | Reduce clics en uso diario intensivo | 🟢 OPCIONAL | Bajo | Media |
| B3 | Estados de carga (skeletons) | Solo Superadmin los usa | Extender a Pacientes, Citas, Inventario | Consistencia — el patrón ya existe | 🟡 MEDIA | Bajo | Baja |
| B4 | Edición inline | Ya existe en Superadmin | Extender a campos de un solo valor en ficha de paciente | Menos modales para cambios pequeños | 🟢 OPCIONAL | Bajo | Media |
| B5 | Deshacer envíos | No existe confirmación posterior | Toast "Deshacer" 5s tras crear/marcar atendida | Reduce costo de un clic accidental | 🟢 OPCIONAL | Bajo | Media |
| ~~B6~~ ⭐ | ~~Autoguardado sin confirmación — patrón reaparecido~~ | **✅ Hecho** en ambos lugares: "Duración de cada cita" en `Horario.jsx` ahora usa borrador local + botón "Guardar" explícito (mismo patrón que el horario semanal, ya validado); `PersonalizacionLogin.jsx` (compartido con SuperadminPanel) tenía algo peor de lo descrito — 12 campos con `onBlur={() => guardar()}` **además** de su propio botón "Guardar cambios"/"Cancelar cambios" ya existente, lo que hacía que "Cancelar cambios" fuera casi inútil (la mayoría de los campos ya se habían guardado solos al salir de cada uno, antes de que el usuario llegara a hacer clic en Cancelar). Se quitó el autoguardado de los campos de texto — quedan los botones explícitos como única vía; los uploads de imagen y el switch de servicios siguen guardando al instante a propósito, porque son una acción puntual del usuario, no una tecla más. Se corrigió también el texto de `Configuracion.jsx` que prometía el autoguardado que ya no existe | — | — | — | — |

## C. Sistema de diseño y consistencia de UI

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| C1 | Tokens de color/tipografía | Constantes repetidas por archivo | Módulo único `src/lib/tema.js` | Un cambio de marca hoy toca ~15 archivos | 🟠 ALTA | Bajo | Media |
| C2 | Contraste del sidebar | Corregido esta sesión, no medido | Verificar con axe/Lighthouse | El fix fue visual, no cuantificado | 🟡 MEDIA | Ninguno | Baja |
| C4 | Layout responsive | Grids y bug de `min-height:0` corregidos parcialmente esta sesión | Auditoría sistemática en 375/768/1024/1440px | Los fixes fueron reactivos a capturas puntuales | 🟠 ALTA | Bajo | Media |
| C5 | Densidad en tablas | Bastante padding por fila | Modo "compacto" opcional en Inventario | Ver más filas sin scroll | 🟢 OPCIONAL | Bajo | Media |
| **C6** ⭐ | **Dos arquitecturas de modal compitiendo** | `ConfirmarCitaModal.jsx` y `ConfirmarFichaModal.jsx` usan Radix/shadcn `Dialog`; los +15 modales restantes del sistema son hand-rolled (`createPortal` + `fixed inset-0`) | Estandarizar en un solo patrón — probablemente el hand-rolled, ya que es el mayoritario y ya tiene el fix de `min-height:0` aplicado | Deuda de consistencia real: dos formas distintas de resolver lo mismo, con comportamiento de foco/escape potencialmente distinto entre ellas | 🟡 MEDIA | Medio (tocar componentes ya en uso) | Media |
| **C7** | Componente duplicado | `FilaDato` está copiado verbatim entre `ConfirmarCitaModal.jsx` y `ConfirmarFichaModal.jsx` | Extraer a un componente compartido | Limpieza directa, cero riesgo | 🟢 OPCIONAL | Ninguno | Baja |

## D. Optimización del flujo clínico

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| D1 | Comparar con visita anterior | Se calcula evolución, sin vista lado-a-lado | Panel colapsable de comparación en la ficha clínica | El optómetra compara mentalmente hoy; los datos ya existen | 🟠 ALTA | Bajo | Media |
| D2 | Entrada rápida de RX | Formulario estructurado ya existe | Autocompletar eje/cilindro si igualan la visita anterior | Reduce tecleo repetitivo en controles de rutina | 🟡 MEDIA | Bajo | Media |
| D3 | Pre-triage remoto | Ya implementado | — | — | — | — | — |
| D4 | Antecedentes colapsables | Ya implementado | — | — | — | — | — |
| **D5** ⭐ | **Fuga de memoria en adjuntos de la ficha clínica** | `ConsultaMedica.jsx` llama `URL.createObjectURL(f)` directo dentro del `.map()` de miniaturas de imágenes, sin `URL.revokeObjectURL()` — cada re-render con imágenes adjuntas crea una URL de blob nueva sin liberar la anterior | Mover la creación de URLs a un `useMemo`/efecto que las revoque al desmontar o al cambiar la lista de archivos | Fuga de memoria real en el módulo que más tiempo abierto pasa durante una consulta | 🟡 MEDIA | Bajo | Baja |
| D6 | Subida de imágenes secuencial | `for` con `await` uno por uno (máximo 6 archivos) | `Promise.all` | Más rápido para el optómetra al adjuntar varias imágenes | 🟢 OPCIONAL | Bajo | Baja |
| D7 | Prop muerta | `RecetaDato` acepta `ancho`, ningún llamador la pasa | Eliminar la prop | Limpieza trivial | 🟢 OPCIONAL | Ninguno | Baja |

## E. Gestión de pacientes y citas

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| E1 | Prevención de no-shows | Recordatorio único por email | Segundo recordatorio cercano a la hora de la cita | Un solo aviso días antes es menos efectivo | 🟡 MEDIA | Bajo | Baja |
| E2 | SMS/WhatsApp | Solo email | No implementar esta ronda (alcance ya decidido) | Requiere proveedor de pago externo | Fuera de alcance | Medio | Alta |
| E3 | Lista de espera automática | No existe | RPC que ofrezca el cupo liberado a pacientes en espera | Hoy una cancelación es un cupo perdido | 🟡 MEDIA | Medio | Alta |
| ~~E4~~ | ~~Estado de entrega de notificaciones~~ | **✅ Hecho** (migración 0064): los 3 envíos reales de correo (recordatorio de cita, cumpleaños, invitación a encuesta) descartaban el resultado de `net.http_post` con `perform` y marcaban todo como "enviado" sin importar si Resend lo aceptó. Ahora cada intento queda registrado en `notificaciones_enviadas` con su `request_id`, y una función (`mis_notificaciones_recientes()`) cruza eso con la respuesta real de pg_net, scoped a la óptica de quien pregunta. Verificado con una respuesta real ya existente en la base (403 → se ve como "fallido") y aislamiento multi-tenant confirmado | — | — | — | — |
| ~~E5~~ ⭐ | ~~El "código de cita" que se le pide guardar al paciente no sirve para nada~~ | **✅ Hecho** (migración 0058: el código se genera y guarda en el servidor dentro de `crear_cita_publica()`; el personal ya puede buscar una cita por código en `Citas.jsx`) | — | — | — | — |
| ~~E6~~ ⭐ | ~~Promesa falsa de recordatorio por WhatsApp~~ | **✅ Hecho** (`AgendarCitaPublica.jsx` ahora dice "por correo", condicionado a que el paciente haya dejado uno) | — | — | — | — |
| ~~E7~~ | ~~Posible doble reserva del mismo horario~~ | **✅ Hecho, y era peor de lo que decía la sospecha** (migración 0062): 1) el calendario público/portal calculaba disponibilidad a partir de un `citas` que en la práctica llegaba VACÍO para un visitante o paciente en un dispositivo nuevo (dependía de que un admin se hubiera logueado antes en ese navegador) — se agregó `horas_ocupadas_publicas()`, expone solo fecha/hora sin datos de pacientes; 2) sin protección real en el servidor — se agregó un índice único parcial `(optica_id, fecha, hora) where estado <> 'Cancelada'` (parcial porque cancelar no borra la fila) y `crear_cita_publica`/`reagendar_cita_publica` ahora devuelven un mensaje claro en vez del error crudo de Postgres; 3) de paso se corrigió un bug real de la propia auditoría anterior (E5): `PortalPaciente.jsx` nunca se actualizó cuando `crear_cita_publica` pasó a devolver una tabla, guardaba un arreglo completo como `id` de la cita. Verificado extremo a extremo contra producción: reserva → aparece ocupada → segunda reserva al mismo horario rechazada → cancelar libera el horario → nueva reserva ahí sí pasa | — | — | — | — |

## F. Motor de CRM y automatización

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| ~~F2~~ | ~~Encuesta post-consulta agregada a Reportes~~ | **✅ Ya implementado** (corrección a la v1) | — | — | — | — | — |
| F1 | Recordatorio de control anual | Ya se detecta, envío manual | Automatizar con el cron existente | Cerrar el círculo con la automatización que ya existe para citas | 🟡 MEDIA | Bajo | Media |
| F3 | Fatiga de recordatorios | Sin límite de frecuencia de mensajes CRM | Máximo 1 mensaje de fidelización por paciente cada N días | Evita saturar al mismo paciente el mismo día | 🟡 MEDIA | Bajo | Media |
| **F4** ⭐ | **Referidos contados por nombre, no por identidad** | `fidelizacion.js` → `contarReferidos()` empareja pacientes por **nombre normalizado en texto libre**, no por ID de paciente | Emparejar por `paciente_id` cuando exista, con el nombre como respaldo solo si no hay ID | Es el mismo patrón de bug ("identidad por nombre") que ya causó un incidente real documentado en este proyecto (Cuarta Mirada), ahora en un módulo distinto | 🟡 MEDIA | Bajo | Media |

## G. Integración de inventario y POS

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| G1 | Receta → venta | Ya unificado | — | — | — | — | — |
| ~~G2~~ | ~~Umbral de stock por producto~~ | **✅ Ya implementado** (corrección a la v1) | — | — | — | — | — |
| G3 | Alta rápida de producto en venta | Ya implementada | — | — | — | — | — |
| G4 | Paginación de inventario | Slicing manual en memoria | Paginación real vía `range()` pasado ~200 productos | No escala si el catálogo crece | 🟠 ALTA* | Medio | Alta |
| ~~G5~~ ⭐ | ~~Condición de carrera real en el descuento de stock al vender~~ | **✅ Hecho** (migración 0061: RPC `registrar_venta_producto()` hace el descuento de stock y el insert de la venta en una sola sentencia atómica; `update ... where stock >= p_cantidad` además serializa ventas concurrentes del mismo producto — verificado con dos ventas simultáneas reales contra producción: solo una pasó, la otra fue rechazada por falta de stock, sin sobreventa) | — | — | — | — |
| ~~G6~~ | ~~Categorías se pueden borrar sin verificar uso~~ | **✅ Hecho**: los 3 catálogos editables de `Configuracion.jsx` (motivos de consulta, categorías de diagnóstico, categorías de inventario) ahora verifican contra la base de datos si algún registro real la usa antes de permitir borrarla — si está en uso, se bloquea con un mensaje claro sugiriendo renombrar en vez de borrar. Verificado contra producción con datos reales de las 3 tablas involucradas (citas, consultas, inventario) | — | — | — | — |

*Condicional al crecimiento real de datos.

## H. Analítica e indicadores clave

Sin cambios respecto a la v1 — H1 (hecho), H2 (tendencia de no-show, Media), H3 (rotación de inventario, Opcional), H4 (tiempo de atención, Opcional).

## I. Seguridad, RBAC y auditabilidad

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| I1 | Cifrado de datos clínicos | `consultas` cifrado. **Refinado esta pasada**: además de `pacientes.estado_clinico/evolucion` y `citas.triage`, se confirma que **`pacientes.estado_correccion`** también queda sin cifrar | Extender el mismo patrón ya probado (Vault + pgcrypto + vista transparente) a las 3 columnas | Mismo nivel de sensibilidad que lo ya cifrado | 🔴 CRÍTICA | Medio | Media |
| I2 | Tests de RLS | 76 políticas, sin suite automatizada | Tests con clientes anon/authenticated contra base de prueba | Ya hubo un incidente real de escalamiento de privilegios | 🔴 CRÍTICA | Bajo | Alta |
| **I6** ⭐⭐ | **Datos clínicos descifrados guardados en `localStorage`** | `App.jsx` (líneas ~307-317) serializa pacientes/citas/consultas completos —incluyendo diagnóstico, antecedentes, alergias ya descifrados— en `localStorage`, sin cifrar | Cifrar antes de guardar en `localStorage` (misma clave/patrón que ya existe), o eliminar el cacheo local de campos clínicos y recargarlos siempre desde Supabase | **Esto anula en el cliente el cifrado de base de datos que ya construimos** — cualquiera con acceso al navegador lee la historia clínica en texto plano | 🔴 CRÍTICA | Medio | Media |
| **I7** ⭐⭐ | **MFA no se aplica a nivel de base de datos** | MFA se exige solo en `Login.jsx` (capa de aplicación) — no hay política RLS/`aal2` que bloquee una sesión válida sin el segundo factor completo (el propio código lo documenta) | Exigir `aal2` en las políticas RLS de las tablas más sensibles para roles con MFA activado | Una sesión válida sin completar MFA no está bloqueada por nada si se llama la API directo, saltándose la app | 🔴 CRÍTICA | Medio | Alta |
| ~~I3~~ | ~~Sesión de paciente~~ | **✅ Hecho, y era peor de lo esperado** (migración 0063): al verificar la duración real resultó que NO había ninguna — el token de sesión del paciente era válido para siempre. Se agregó expiración de 30 días y se centralizó la verificación en una sola función (`sesion_paciente_valida()`) usada por los 7 RPC que aceptan el token. **Bonus real encontrado de paso**: `mis_citas_paciente` y `mis_consultas_paciente` estaban **rotas en producción ahora mismo** (declaraban devolver el tipo de la tabla base pero seleccionaban de la vista descifrada, con columnas en orden distinto desde que el cifrado las reordenó) — "Mis citas" y "Mi receta" del portal del paciente fallaban con error en cualquier intento real. Corregido y verificado extremo a extremo: login → token válido → esas dos funciones ya responden → token de 31 días se rechaza → token de 29 días sigue vigente → invalidar sesión limpia todo | — | — | — | — |
| ~~I4~~ | ~~Auditoría de acciones~~ | **✅ Hecho**: `ConsultaMedica.jsx` ahora llama a `registrarLog()` al guardar una ficha clínica. Bonus encontrado de paso: este mismo archivo tenía **su propia copia** del bug de G5 (descuento de stock no atómico al vincular una venta a la consulta) — se corrigió con el mismo RPC `registrar_venta_producto()` que ya usa `VentaProductoModal.jsx` | — | — | — | — |
| I5 | Gestión de secretos | Correcto — Vault, nunca en archivos versionados | — | — | — | — | — |
| **I8** ⭐ | **Política de contraseña débil para cuentas de staff** | `Usuarios.jsx` solo exige `clave.length >= 6` para cuentas de asistente/optómetra, que pueden recibir permisos delegados de administración | Subir el mínimo (8-10) y pedir algo de complejidad | Es un sistema con datos clínicos; 6 caracteres es bajo para cuentas con permisos delegados | 🟡 MEDIA | Bajo | Baja |
| **I9** ⭐ | **Tabla sin RLS** | `limite_solicitudes` (rate-limiting de RPCs públicos) es la única de las 54 migraciones sin `enable row level security` | Habilitar RLS con una policy restrictiva | Expone IPs y timestamps de intentos contra RPCs públicos si los defaults de Supabase lo permiten | 🟡 MEDIA | Bajo | Baja |
| ~~I10~~ ⭐ | ~~`citas.estado` sin restricción a nivel de base de datos~~ | **✅ Hecho** (migración 0059: `check (estado in ('Pendiente','En Espera','En Atención','Atendida','No Asistió','Cancelada'))`, verificado que rechaza un valor inválido) | — | — | — | — |
| **I11** ⭐ | **El bug de "función duplicada silenciosa" ya ocurrió dos veces** | El mismo error (`create or replace function` cambiando de firma sin `drop` previo) rompió `crear_cita_publica` en producción **dos veces** (migraciones 0031→0035 y de nuevo 0040→0042) — ambas veces documentadas y corregidas, pero sin ninguna salvaguarda para que no vuelva a pasar | Agregar una convención de equipo/checklist (o un lint de migraciones) que exija `drop function if exists` antes de cualquier `create or replace` que cambie parámetros | El mismo error real ya costó dos incidentes de producción en el mismo proyecto | 🟠 ALTA | Ninguno (es proceso, no código de producción) | Baja |
| **I12** | Texto libre potencialmente sensible sin cifrar | `citas.motivo`/`motivo_publico` (ej. "seguimiento de glaucoma") quedan en texto plano | Evaluar cifrar si el volumen de texto realmente libre lo justifica | Menor prioridad que I1 — dato de exposición más acotada | 🟢 OPCIONAL | Bajo | Media |
| **I13** | Página legal desactualizada | Dice "hash (bcrypt)" sin confirmar que coincide con el mecanismo real; fecha "agosto 2026" ya vieja frente a MFA/cifrado AES agregados después | Verificar el texto contra el mecanismo real y actualizar la fecha | Un documento legal debe describir lo que el sistema realmente hace | 🟢 OPCIONAL | Ninguno | Baja |
| **I14** | Validación de archivos solo en cliente | `PersonalizacionLogin.jsx` valida tamaño/tipo de logo solo en el navegador (`accept` del input es solo una sugerencia) | Verificar policies del bucket de Storage — que también validen tipo/tamaño del lado del servidor | Un `accept` de HTML no impide subir cualquier archivo vía API directa | 🟡 MEDIA | Bajo | Baja |
| **I15** | Persistencia de categoría sin confirmar | `CampoCategoria.jsx` crea una categoría nueva llamando solo al setter de estado del padre — no se confirmó en esta pasada si eso persiste a Supabase o se pierde al recargar | Verificar el flujo completo hasta la base de datos | Si no persiste, una categoría "creada" desaparece al refrescar | 🟡 MEDIA | Bajo | Baja |

## J. Rendimiento y arquitectura

| ID | Feature/Componente | Estado actual | Estado propuesto | Justificación | Prioridad | Riesgo | Complejidad |
|---|---|---|---|---|---|---|---|
| **J6** ⭐⭐ | **Causa raíz real del gráfico "Actividad por día" borroso** | El proyecto ya tiene `useAnchoElemento()` (en `graficos.js`), creado explícitamente para este problema, y los otros 2 gráficos de Superadmin sí lo usan. Este gráfico específico usa un `viewBox` fijo + `preserveAspectRatio="none"` sin el hook | Aplicar `useAnchoElemento()` a este gráfico, igual que a los otros dos | Esta es la explicación real de la queja repetida de Diego sobre gráficos borrosos — el fix de esta sesión (quitar el `transform` permanente) ayudó pero no cerró la causa raíz de este gráfico | 🔴 CRÍTICA | Bajo | Baja |
| J1 | Bundle principal | 567 KB / 165 KB gzip | Separar lo que comparten Login público y Dashboard | Un visitante público descarga código de administración | 🟠 ALTA | Bajo | Media |
| ~~J2~~ | ~~Índices de base de datos~~ | **✅ Hecho** (migración 0060: `pacientes(optica_id, cedula)`, `pacientes(optica_id, usuario)` — usados por `verificar_login_paciente()` en cada login de portal — y `citas(optica_id, fecha)`) | — | — | — | — |
| J3 | Paginación del servidor | Ver G4 | Ídem G4, aplica también a Pacientes | Ídem G4 | 🟠 ALTA* | Medio | Alta |
| J5 | Accesibilidad — regiones dinámicas | 1 sola región `aria-live` en toda la app | `aria-live="polite"` en los ~15-20 banners de éxito/error existentes | Un lector de pantalla no anuncia "Cita guardada correctamente" | 🔴 CRÍTICA | Ninguno | Media |
| **J7** ⭐ | **Llamadas a Supabase sin manejar error, en varios archivos** | Confirmado en `App.jsx` (~10 casos), `CRM.jsx` y `Mensajes.jsx` (carga de datos) — sin `.catch()` ni chequeo de `error`, la app queda silenciosamente con datos viejos si Supabase falla o RLS deniega | Agregar manejo de error visible (banner) en las cargas de datos principales | Un fallo de red hoy es indistinguible de "no hay datos" para el usuario | 🟡 MEDIA | Bajo | Media |
| ~~J11~~ ⭐ | ~~UUID de una óptica real hardcodeado como fallback global~~ | **Decisión de Diego (2026-09-09)**: mantener el fallback silencioso a Solna Vision — ya hay 2 ópticas reales activas en producción (Solna y Karla V) y reemplazarlo por una página de "óptica no encontrada" cambiaría lo que ven pacientes reales que hoy usan el link base sin darse cuenta. Se resolvió la parte de mantenibilidad real: el UUID ya no vive fijo en el código — ahora es `VITE_OPTICA_ID_DEFAULT` (con el mismo valor de siempre como respaldo si la variable no está configurada), así que cambiarlo no exige un deploy. La resolución de "óptica no encontrada" real depende de J12 (dominio propio por óptica) — sigue pendiente junto con esa | — | — | — | — |
| **J12** ⭐ | **"Tu propio dominio" es una promesa de marketing sin implementar** | `resolverSitio.js` tiene `DOMINIOS_RAIZ = []` — genuinamente vacío. Hoy el multi-tenant funciona solo por `?sitio=`/`?optica=` en la URL, no por subdominio/dominio propio | Implementar routing real por dominio, o ajustar el texto de `PaginaVenta.jsx` ("con tu propia marca y tu propio link") a lo que existe hoy | `PaginaVenta.jsx` promete literalmente "tu propio link" a ópticas potenciales — hoy no es cierto a nivel de infraestructura | 🟠 ALTA | Alto (routing/DNS) | Alta |
| J4 | Caching de queries | Sin capa de caché compartida | Hook propio de caché en memoria | Reduce llamadas repetidas al navegar | 🟢 OPCIONAL | Medio | Alta |
| **J8** | Código muerto confirmado | `disponibilidad.js` → `esPasada()` exportada, con test, pero ningún componente la importa (confirmado con grep) | Eliminar | Limpieza directa | 🟢 OPCIONAL | Ninguno | Baja |

*Condicional al crecimiento real de datos.

---

## Resumen de prioridades (v2 — recuento real)

| Prioridad | Cantidad | Ítems |
|---|---|---|
| 🔴 CRÍTICA | 6 | I1, I2, I6 ⭐⭐, I7 ⭐⭐, J5, J6 ⭐⭐ |
| 🟠 ALTA | 19 (12 ✅ hechos: B6, E4, E5, E6, E7, G5, G6, I3, I4, I10, J2, J11 — 6 restantes, G4 en espera de datos) | ~~B6~~ ⭐, C1, C4, D1, ~~E4~~, ~~E5~~ ⭐, ~~E6~~ ⭐, ~~E7~~ ⭐, G4 (en espera), ~~G5~~ ⭐, ~~G6~~, ~~I3~~, ~~I4~~, ~~I10~~ ⭐, I11 ⭐, J1, ~~J2~~, ~~J11~~ ⭐, J12 ⭐ |
| 🟡 MEDIA | 15 | B1, B3, C2, C6 ⭐, D2, D5 ⭐, E1, E3, F1, F3, F4 ⭐, H2, I8 ⭐, I9 ⭐, I14 ⭐, I15 ⭐, J7 ⭐ |
| 🟢 OPCIONAL | 12 | B2, B4, B5, C5, C7, D6, D7, H3, H4, I12, I13, J4, J8 |
| ✅ Ya implementado (corregido en esta pasada) | 2 | F2, G2 |
| Fuera de alcance (decisión ya tomada) | 1 | E2 |

⭐ = hallazgo nuevo de la auditoría exhaustiva (no estaba en la v1). ⭐⭐ = los 3 más importantes — ver Resumen ejecutivo.

---

## Estado (actualizado 2026-09-09, tras aprobación de Diego)

**Fase 1 y Fase 2 (los 6 críticos) — ✅ completas, probadas y en producción:**
- I6: `App.jsx` ya no persiste campos clínicos en `localStorage`.
- J6: el gráfico "Actividad por día" ya usa `useAnchoElemento()`.
- J5: `role="alert"`/`role="status"` agregado a ~30 banners en todo el sistema.
- I1: `pacientes.estado_clinico/evolucion/estado_correccion` y `citas.triage` ya cifrados (migración 0055), verificado lectura/escritura contra producción.
- I2: `scripts/test-rls.mjs` (`npm run test:rls`) — 9/9 pruebas reales contra la base de datos.
- I7: policy RESTRICTIVE nueva exige `aal2` cuando la cuenta tiene MFA verificado (migración 0057), sin tocar ninguna de las 76 policies existentes.
- Bonus: I9 (RLS en `limite_solicitudes`, migración 0056) se resolvió de paso.

**Fase 3 (🟠 Alto) — en curso:**
- E5: el código de cita ahora se genera y guarda en el servidor (migración 0058); el personal puede buscar una cita por código en `Citas.jsx`.
- E6: corregida la promesa falsa de recordatorio por WhatsApp — ahora dice correo, condicionado a que el paciente haya dejado uno.
- I10: `check` constraint en `citas.estado` (migración 0059), verificado que rechaza valores inválidos.
- J2: índices agregados en `pacientes(optica_id, cedula)`, `pacientes(optica_id, usuario)` y `citas(optica_id, fecha)` (migración 0060).
- G5: venta de producto ahora es atómica vía RPC `registrar_venta_producto()` (migración 0061), verificado con una prueba real de concurrencia (dos ventas simultáneas del mismo producto: solo una pasó).
- J11: se encontró que ya hay 2 ópticas reales activas en producción (Solna y Karla V) — Diego decidió mantener el fallback a Solna por ahora; se externalizó el UUID a `VITE_OPTICA_ID_DEFAULT` para que cambiarlo no requiera deploy. **Pendiente: agregar esa variable en Vercel** (hoy solo está en `.env.local`) — si no se agrega ahí, producción sigue funcionando igual (usa el mismo valor como respaldo), simplemente no queda configurable sin deploy hasta que se agregue.
- E7: la doble reserva de horarios resultó ser un problema más real de lo sospechado — el calendario público/portal casi siempre calculaba disponibilidad con cero citas cargadas. Se agregó una función pública que expone solo fecha/hora reales, más un índice único server-side que bloquea de verdad la doble reserva. De paso se corrigió un bug real que había quedado de la ronda de E5 (PortalPaciente.jsx guardaba mal el id de la cita nueva).
- I4: `registrarLog()` agregado a `ConsultaMedica.jsx`. Al revisar ese archivo para I4 se encontró que también tenía su propia copia del bug de G5 (venta+stock no atómicos al vincular un producto a la consulta) — corregida con el mismo RPC.
- G4 revisado y dejado en espera a propósito: solo hay 1 producto en inventario en toda la base hoy — construir paginación ahora sería trabajo prematuro sin datos que lo justifiquen (la propia auditoría lo marca "condicional al crecimiento real de datos").
- I3: el token de sesión del paciente no tenía ninguna expiración — ahora dura 30 días. **Bonus real encontrado al verificar esto**: `mis_citas_paciente` y `mis_consultas_paciente` estaban rotas en producción ("Mis citas"/"Mi receta" del portal fallaban siempre) — corregido de paso.
- B6: quitado el autoguardado silencioso de "Duración de cada cita" (Horario.jsx) y, peor de lo descrito, de 12 campos de `PersonalizacionLogin.jsx` que además tenían su propio botón "Guardar cambios" — el autoguardado por `onBlur` volvía inútil al botón "Cancelar cambios".
- G6: los 3 catálogos editables de Configuracion.jsx ahora verifican uso real en base de datos antes de dejar borrar una categoría/motivo.
- E4: los 3 envíos de correo reales ahora quedan registrados con su request_id y se puede ver si Resend realmente los entregó, en vez de marcarse "enviado" a ciegas.

**Fase "premium UI/UX" (2026-09-09, pedido aparte de Diego) — en curso:**

Diego pidió una pasada dedicada de modernización visual (spec completo:
auditoría primero, preservar lo que ya está bien, sistema de tokens
cohesivo, sin efectos gratuitos). Auditoría real ejecutada (grep+lectura,
no supuestos) antes de tocar código — ver hallazgos abajo. Orden acordado:
Fase 1 fundación (tokens + consistencia de componentes) → Fase 2
(dashboard + perfil de paciente unificado, piezas nuevas) → Fase 3
(tablas/formularios/loading/responsive sistemático = C4).

**Fase 1 (fundación) — hecha, verificada (build + 71 tests en cada commit):**
- ~~C1 (color)~~ ✅: `src/lib/tema.js` centraliza INK/PORCELAIN/GOLD (antes
  copy-pasteados en 32 lugares de 26 archivos) + tokens `ACCION_*`
  (ver/editar/confirmar/eliminar) extraídos del patrón de color **real**
  ya mayoritario en el código (no inventados — se verificó contra el uso
  existente antes de fijar cada tono). Aplicados en Inicio, Usuarios,
  Inventario, Pacientes, Horario, Citas, SuperadminPanel. Theme de
  Tailwind (`--primary`/`--primary-foreground`) corregido a la marca real
  en vez del gris stock de shadcn.
- ~~C1 (tipografía)~~ ✅ **hallazgo corregido, no era un problema real**: la
  auditoría inicial reportó "Sora declarada pero casi sin usar" como
  inconsistencia. Al revisar en detalle: Sora (`font-heading`) es
  correctamente el logotipo de marca ("Sistema Óptica" en nav/footer de
  PaginaVenta) — nunca fue pensada como fuente de headings de sección.
  El serif itálico (Newsreader) es un acento deliberado solo para los 4-5
  momentos "bienvenido" (Login, PaginaVenta, Inicio, PortalPaciente). El
  resto de headers de sección usa sans bold plano, apropiado para una UI
  densa. Es una jerarquía de 3 niveles intencional, no un descuido — no
  se tocó.
- **Adopción del `<Button>` compartido de shadcn** ✅ **hallazgo corregido,
  no era un problema real**: el roadmap original leyó "0% de adopción"
  como una brecha. Al revisar: el botón primario real del sistema (fondo
  degradado cian→azul + sombra, `rounded-xl`, hover `-translate-y-0.5`)
  se usa **128 veces en 22/23 páginas** con la misma clase — ya es un
  sistema de diseño de facto extremadamente consistente, solo que
  hand-rolled en vez de extraído a componente. El botón "Cancelar"
  (outline slate) tiene el mismo nivel de consistencia (13+ usos en 6
  archivos). Adoptar el `<Button>` de shadcn ahí habría *reemplazado* un
  patrón ya bueno por uno peor — no se hizo (sección 19 del pedido de
  Diego: si ya está bien, no tocar).
- ~~C6~~ ✅: `ConfirmarCitaModal.jsx` y `ConfirmarFichaModal.jsx` (los
  únicos 2 de ~15 modales construidos sobre Radix/shadcn Dialog en vez
  del patrón hand-rolled mayoritario) migrados al patrón hand-rolled,
  con el cierre por tecla Escape agregado a mano para no perder lo que
  Radix daba gratis (regresión real de accesibilidad que se evitó, no
  solo un tema de consistencia). `components/ui/dialog.jsx` y
  `button.jsx` quedaron sin ningún consumidor — no se borraron
  (bloqueados por el clasificador de permisos sobre `rm`), pero el build
  ya no incluye su chunk (-67KB).
- ~~C7~~ ✅: `FilaDato` (duplicado verbatim entre los 2 modales de arriba)
  extraído a `src/componentes/FilaDato.jsx`.

**Fase 2 — hecha, verificada (build + 71 tests):**
- **Perfil de paciente unificado** ✅ **hallazgo corregido a mitad de
  camino**: la auditoría (y mi primer diagnóstico) dijeron que no
  existía. Al revisar de cerca sí existe — vive como overlay dentro de
  `Pacientes.jsx` (identidad, badges, deuda, 4 tabs: Valoraciones/Citas/
  Evolución/Pagos), solo que el grep de la auditoría buscaba una página
  separada y no lo encontró. Se cerró el único hueco real: 5to tab
  "Fidelización" (próximo control con badge de vencido, última visita,
  cliente frecuente, referidos) reusando `utilidades/fidelizacion.js`
  sin llamadas nuevas a Supabase.
- **Dashboard "qué cambió"** ✅: KPI de pacientes agrega "+N este mes"
  (real, sobre `fechaRegistro`); nueva sección "Actividad reciente"
  (solo admin principal, misma fuente/RLS que ya usa `Usuarios.jsx` vía
  `logs_optica` — no se duplicó lógica) con link a la vista completa.

**Fase 3 (= C4 del roadmap original) — hecha, verificada (build + 71 tests):**
- **Auditoría responsive sistemática 375/768/1024/1440** ✅: un fork
  dedicado auditó (sin tocar código) los 3 archivos originalmente
  sospechosos por bajo conteo de breakpoints (Mensajes, PaginaLegal,
  Configuracion) — **los 3 resultaron falsas alarmas**, ya son
  responsive de verdad (bajo conteo de `sm:`/`md:` porque genuinamente
  no necesitan más, no por descuido). El spot-check por las dudas sí
  encontró un problema real en 2 archivos que NO estaban en la lista de
  sospechosos: `Reportes.jsx` y `CRM.jsx` saltaban de 1 a 2 columnas de
  KPI sin punto medio (`grid-cols-2 lg:grid-cols-4`), amontonando
  etiquetas largas ("Conversión a venta", "Cumpleaños cercanos") contra
  el ícono a 375px — corregido a `grid-cols-1 sm:grid-cols-2
  lg:grid-cols-4`.
- **Loading states** ✅: el hallazgo original ("7 páginas sin cobertura
  detectada") también resultó una falsa alarma — esas páginas reciben
  sus datos por props ya resueltos (`App.jsx` centraliza la carga
  inicial con `PantallaCargando()`), no tienen ningún fetch propio que
  necesite spinner. El gap real, más chico pero real, eran 2 acciones
  puntuales con round-trip a Supabase y cero feedback visual mientras
  estaban en vuelo: "Atender ahora" en `Citas.jsx` y "Publicar"/
  "Eliminar" aviso en `CRM.jsx` — se agregó disabled+spinner a las tres.
- **Formularios**: se encontraron y unificaron 12 labels con un estilo
  minoritario (`font-medium text-slate-600` en Pacientes.jsx/
  ConsultaMedica.jsx) contra el mayoritario (`font-semibold
  text-slate-700`, 59 usos en el resto). La convención de campos
  requeridos (asterisco visual vs. validación JS al enviar) quedó
  intacta — son dos estrategias legítimas, no una inconsistencia
  trivial de arreglar sin tocar lógica de validación.
- **Tablas**: sample directo confirmó que Citas.jsx no usa `<table>`
  (lista/tarjetas, apropiado para una agenda) y que Pacientes.jsx vs.
  Inventario.jsx difieren en padding de celda (`px-5 py-3.5` vs. `px-4
  py-3`) — diferencia de 4px, de bajo impacto visual real, se dejó sin
  tocar por relación costo/beneficio (tocar cada `<td>` de ambas tablas
  por una diferencia casi imperceptible).

**I11 (roadmap original, 🟠 Alto)** ✅ **cerrado con una salvaguarda
real, no solo documentación**: `scripts/_run-migration.mjs` ahora
detecta los `create or replace function` de cada migración y avisa si
el nombre quedó con más de un overload en `pg_proc` después de
aplicarla — exactamente el bug que rompió `crear_cita_publica()` en
producción dos veces. Probado con una función descartable (creada y
borrada, nada residual).

**No verificado visualmente en navegador todavía** (build+tests sí, en
los 13 commits de esta ronda) — pendiente un vistazo en vivo cuando
Diego tenga credenciales a mano: los 2 modales migrados de Radix, el
tab Fidelización nuevo, la sección Actividad reciente del dashboard, y
los 3 archivos de esta Fase 3.

**Próximo paso (roadmap original, separado de la pasada premium de
arriba):** quedan 3 ítems 🟠 Alto — D1 (comparación con visita
anterior en la ficha clínica), J1 (separar bundle público/dashboard),
J12 (dominio propio real por óptica o corregir la promesa de
marketing) — G4 en espera de que el catálogo crezca.
