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
| **B6** ⭐ | **Autoguardado sin confirmación — patrón reaparecido** | Ya se corrigió una vez en otra pantalla (lección: "autoguardado invisible se lee como botón faltante"), pero **reaparece en 2 lugares nuevos** encontrados esta pasada: el campo "Duración de cada cita" en `Horario.jsx` (guarda en cada tecla, sin confirmación) y la pestaña "Página de login" en `Configuracion.jsx` (dice textualmente en su propia UI "se guardan solos al salir de cada campo") | Aplicar el mismo patrón ya usado y validado en el resto del sistema: campo editable + botón de guardar explícito + confirmación visible | Es literalmente el mismo bug de UX que ya se identificó y arregló antes, reapareciendo en código nuevo — vale la pena una revisión puntual de **todos** los `onChange`/`onBlur` que llaman `setX` directo a Supabase sin pasar por un botón | 🟠 ALTA | Bajo | Media |

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
| E4 | Estado de entrega de notificaciones | El cron no expone éxito/fallo de Resend | Loguear la respuesta en una tabla simple | Un fallo de Resend hoy es invisible | 🟠 ALTA | Bajo | Baja |
| ~~E5~~ ⭐ | ~~El "código de cita" que se le pide guardar al paciente no sirve para nada~~ | **✅ Hecho** (migración 0058: el código se genera y guarda en el servidor dentro de `crear_cita_publica()`; el personal ya puede buscar una cita por código en `Citas.jsx`) | — | — | — | — |
| ~~E6~~ ⭐ | ~~Promesa falsa de recordatorio por WhatsApp~~ | **✅ Hecho** (`AgendarCitaPublica.jsx` ahora dice "por correo", condicionado a que el paciente haya dejado uno) | — | — | — | — |
| **E7** | Posible doble reserva del mismo horario | `SelectorFechaHora.jsx` calcula disponibilidad en el cliente a partir de citas ya cargadas — **sin confirmar** si `crear_cita_publica` re-valida el cupo de forma atómica en el servidor | Verificar la función SQL; si no hay un `unique`/lock, agregar validación atómica server-side | Dos pacientes reservando el mismo horario casi simultáneo podrían ambos "tener éxito" | 🟠 ALTA (pendiente de verificar) | Medio | Media |

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
| **G6** | Categorías se pueden borrar sin verificar uso | En `Configuracion.jsx`, eliminar una categoría de inventario/diagnóstico no verifica si algún producto o consulta ya la usa | Bloquear o advertir si la categoría está en uso antes de borrar | Puede dejar referencias huérfanas (un producto con una categoría que ya no existe) | 🟠 ALTA | Bajo | Media |

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
| I3 | Sesión de paciente | Token propio con expiración | Confirmar duración y si hay renovación silenciosa | No verificado si el timeout es razonable | 🟠 ALTA | Bajo | Baja |
| I4 | Auditoría de acciones | Auditoría de superadmin/admin ya implementada. **Escalado esta pasada**: `ConsultaMedica.jsx` — el módulo que crea/edita historia clínica— **nunca llama a `registrarLog()`** | Agregar registro de auditoría a creación/edición de consultas | El módulo más sensible del sistema no deja rastro de quién tocó una historia clínica | 🟠 ALTA | Bajo | Media |
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
| 🟠 ALTA | 19 (6 ✅ hechos: E5, E6, G5, I10, J2, J11 — 13 restantes) | B6 ⭐, C1, C4, D1, E4, ~~E5~~ ⭐, ~~E6~~ ⭐, E7 ⭐, G4, ~~G5~~ ⭐, G6, I3, I4, ~~I10~~ ⭐, I11 ⭐, J1, ~~J2~~, ~~J11~~ ⭐, J12 ⭐ |
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

**Próximo paso:** quedan 13 ítems 🟠 Alto (B6, C1, C4, D1, E4, E7, G4, G6, I3, I4, I11, J1, J12). Cada cambio se prueba contra la suite de 71 tests (`npm test`) y, cuando toca seguridad, también contra `npm run test:rls` antes de continuar al siguiente.
