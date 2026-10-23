# Resumen técnico del sistema (apoyo para la tesis)

Sistema web de gestión para ópticas: agenda de citas, historia clínica, ventas e inventario, relación con el paciente, portal del paciente y página pública de agendamiento, para varias ópticas en una misma plataforma.
Todas las cifras de este documento salen del código y de la base de datos del proyecto al **23 de octubre de 2026** (cómo se obtuvo cada una está en la sección 8).

## 1. Arquitectura

| Capa | Tecnología | Papel |
|---|---|---|
| Interfaz | **React 19** + Vite 8, Tailwind CSS 4, componentes Radix/shadcn, Lucide (íconos) | Una sola aplicación de página única; el código de cada módulo se carga solo cuando se entra a él |
| Datos y acceso | **Supabase**: **PostgreSQL** con **seguridad por filas (RLS)**, Auth (cuentas), Storage (archivos), Edge Functions (3) | Toda la información vive en PostgreSQL; el navegador habla con la base directamente y es la base la que decide qué puede ver o cambiar cada persona |
| Tareas automáticas | `pg_cron` + `pg_net` + Vault de Supabase | Recordatorios, saludos de cumpleaños, marcado de inasistencias y verificación del sistema, sin servidor propio |
| Correo | Resend (llamado desde la base con `pg_net`) | Recordatorios de cita, saludos de cumpleaños, encuesta de satisfacción y factura electrónica |
| Monitoreo | Sentry | Errores de la aplicación |
| Publicación | Vercel | Versión compilada de la aplicación |

Decisiones que sostienen el diseño:

- **La seguridad está en la base, no en la pantalla.** La interfaz oculta lo que una persona no puede usar, pero lo que la protege es la base: aunque alguien llamara a la API directamente con su sesión, las políticas de fila (RLS) y las funciones con `SECURITY DEFINER` revisan su óptica, su rol y su alcance.
- **Varias ópticas, una sola base (multi-inquilino).** Cada fila de los datos operativos lleva el identificador de su óptica (`optica_id`) y todas las políticas lo exigen; ninguna óptica ve lo de otra. Una óptica nueva se crea con un solo registro: sus tres roles predefinidos nacen por un disparador y todo lo demás sale de valores por defecto (sección 8.4).
- **Reglas de negocio en la base.** Lo que no puede fallar (que dos citas no se crucen, que una venta no se pase de abonos, que el kárdex no se edite) se impone con restricciones, disparadores y funciones; la pantalla solo avisa a tiempo.
- **Cambios de esquema versionados:** 150 migraciones SQL numeradas (20 962 líneas), cada una con su respaldo previo, ensayo en una transacción que se revierte y verificación con sesiones reales antes de darla por aplicada.

Tamaño: 372 archivos de código fuente (≈ 52 800 líneas de JavaScript/JSX sin pruebas ni componentes base de la librería de interfaz), 24 pantallas principales y 188 componentes propios.

## 2. Módulos y funciones

| Módulo | Qué hace |
|---|---|
| **Inicio** | Panel según el rol (administración, optómetra, recepción, ventas o general): agenda de hoy, sala de espera, «Requiere tu atención» (stock bajo y sobrestock, pedidos atrasados o listos sin avisar, pagos por verificar, conteo del inventario, citas por reasignar), totales y atajos |
| **Citas** | Agenda en lista, semana y mes; estados automáticos (`Pendiente`, `En Atención`, `Atendida`, `No asistió`, `Cancelada`); cancelación con motivo; reagendamiento; «Atender» a quien llega sin cita; confirmación de reserva |
| **Pacientes** | Expediente y perfil 360° (resumen, citas, diagnóstico, compras, línea de tiempo), deduplicación por documento y fecha de nacimiento, anonimización a pedido del paciente, fidelización por niveles y referidos |
| **Ficha clínica** | Consulta en pasos (anamnesis, agudeza, refracción, diagnóstico y receta), borrador guardado en la base, receta y diagnóstico imprimibles, con opción de ocultar la graduación al imprimir |
| **Ventas** | Proformas, ventas con varias líneas, abonos y saldos, pagos por transferencia con verificación, comprobantes, anulación con motivo, **pedidos de lentes** (retira o envío, fecha aproximada, atrasado/listo/entregado) y factura electrónica |
| **Inventario** | Productos con foto, mínimo y máximo (general o por producto), kárdex de movimientos, hoja de conteo físico impresa y recordatorio periódico del conteo |
| **CRM** | «Para contactar» (control vencido o próximo, sin visitar, cumpleaños, postventa, pedido listo, diagnóstico sin compra…), plantillas editables con datos automáticos, campañas con destinatarios, historial de contactos con resultado, fidelización y cumpleaños |
| **Reportes** | Resumen, citas, clínico (incluye cómo llegan los pacientes nuevos), ventas (incluye ventas anuladas), pedidos y laboratorios; gráfico de tendencia; exportación a Excel |
| **Horario** | Horario de la óptica, horario por persona, ausencias solicitadas con documento y aprobadas por la administración, «Mi horario» |
| **Usuarios y roles** | Cuentas del personal, roles predefinidos y propios, permisos por módulo y alcance de datos, activar y desactivar |
| **Configuración** | Datos de la óptica, página pública (textos, logo, color, servicios, preguntas), parámetros de inventario y ventas, recordatorios, fidelización |
| **Soporte y mensajes** | Consultas del personal a la administración y de la administración al soporte del sistema; avisos internos |
| **Portal del paciente** | Sus citas (agendar, reagendar, cancelar con motivo), su graduación, compras y abonos, factura electrónica, solicitud de lentes y de medidas, cambio de contacto |
| **Página pública y agendamiento en línea** | Página de la óptica con su marca; agendamiento en tres pasos (motivo, fecha y hora → datos → confirmación) con horas libres reales y archivo de calendario `.ics` |
| **Panel del superadmin** | Alta, suspensión y supervisión de ópticas, métricas de la red, soporte, auditoría de lo que hace el equipo del sistema |

## 3. Modelo de datos principal

62 tablas y 4 vistas en el esquema público; las más importantes:

- **`opticas`**: la óptica (nombre, dirección de su página, marca, ajustes, catálogos, estado de suscripción). Raíz de todo lo demás.
- **`perfiles`** (cuentas del personal), **`roles`** (permisos por módulo y alcance), **`perfil_roles`**, **`horarios_usuario`**, **`ausencias_personal`**.
- **`pacientes_base`**, **`citas_base`**, **`consultas_base`** (historia clínica), **`citas_eventos`** (historial de cada cita), **`fichas_borradores`**, **`consentimientos_historial`**.
- **`inventario`**, **`inventario_costos`**, **`movimientos_inventario`** (kárdex), **`conteos_inventario`**.
- **`facturas_venta`** y **`facturas_venta_lineas`** (ventas con varias líneas), **`abonos_factura`**, **`abonos_correcciones`**, **`pagos_transferencia`**, **`ordenes_laboratorio`** (pedidos), **`facturas_electronicas`** y sus archivos y eventos.
- **CRM**: `crm_plantillas`, `crm_campanas`, `crm_contactos`, `avisos`, `avisos_contacto_paciente`.
- **Operación**: `disponibilidad` (horario de la óptica), `notificaciones_enviadas` (registro de correos), `logs_optica` (actividad), `auditoria` (acciones del superadmin), `visitas` (visitas a la página pública), `soporte_consultas` y `soporte_mensajes`.

Las tablas con datos de pacientes se llaman `*_base` porque sobre ellas hay **vistas** (`consultas`, `pacientes`, `citas`) con el nombre de siempre que descifran al leer y cifran al escribir; las políticas de la tabla se siguen aplicando según quién consulta.

## 4. Seguridad y privacidad

- **Seguridad por filas:** las 62 tablas del esquema público tienen RLS activado, con **168 políticas**; las operaciones sensibles pasan por **246 funciones** propias, de las cuales 208 son `SECURITY DEFINER` (se ejecutan con permisos controlados y revisan quién llama, su óptica y su permiso antes de hacer nada).
- **Roles y alcances:** once módulos con permisos por nivel (ver, crear, editar, eliminar) y, para citas, fichas clínicas y reportes, un **alcance de datos**: «solo lo suyo», «los que atiende» (solo fichas) o «toda la óptica». Cada óptica nace con tres roles predefinidos (Optómetra, Recepción, Ventas) y puede crear los suyos; todo rol nuevo parte apagado y con el alcance más restrictivo. Los permisos revocados dejan de valer aunque la persona tenga la sesión abierta, y una óptica suspendida pierde el acceso en pocos minutos.
- **Datos clínicos cifrados:** diagnóstico, antecedentes, alergias, indicaciones, datos clínicos de la consulta, estado clínico del paciente y triaje se guardan cifrados con AES (`pgp_sym_encrypt`, 12 columnas `*_enc`); la clave vive en el Vault de Supabase, nunca en el código.
- **Auditoría:** `logs_optica` registra la actividad de cada óptica («Registró una ficha clínica», «Editó los permisos de un usuario»…); `auditoria` registra lo que hace el equipo del sistema sobre las ópticas y **no se puede editar ni borrar** (disparador `auditoria_inmutable`); cada cita guarda su propio historial de eventos; el consentimiento de contacto de cada paciente guarda su historial; el kárdex del inventario y las actas de conteo son **inmutables**.
- **Documentos privados:** 6 depósitos de archivos; cuatro son privados (documentos de ausencias, adjuntos de consultas, facturas electrónicas, adjuntos de soporte) con 20 políticas de acceso; solo son públicos el logo y las fotos de productos. Verificado con sesiones reales que el documento de una ausencia solo lo leen quien lo envió y la administración de su óptica; otro empleado, otra óptica y el superadmin no.
- **Concurrencia de citas («una hora, un profesional»):** un disparador (`citas_sin_choque`) con un candado por óptica, fecha y hora impide que dos citas del mismo profesional se crucen en el tiempo (inicio más duración), por cualquier camino de escritura —web, portal, personal, reagendamiento—. Verificado con dos y cinco confirmaciones simultáneas desde conexiones distintas: gana una y las demás reciben «Esa hora acaba de ocuparse. Elige otra.»
- **Otras medidas:** deduplicación de pacientes por documento y fecha de nacimiento; las funciones públicas (agendamiento, visitas, contacto) tienen límite de frecuencia por IP; la clave de correo no sale de la base; Content-Security-Policy estricta en la versión compilada; la protección contra incrustar la página en otro sitio (`frame-ancestors` y `X-Frame-Options`) va en las cabeceras HTTP de la publicación (`vercel.json`); la sesión se cierra por inactividad (se cuenta entre todas las pestañas) y por vencimiento, con aviso claro; ningún error técnico de la base se muestra al usuario.

## 5. Recordatorios y tareas automáticas

Cinco tareas programadas en la base (`pg_cron`):

| Tarea | Frecuencia | Qué hace |
|---|---|---|
| `recordatorios_citas_cada_hora` | cada hora en punto | Envía por correo el recordatorio de las citas **pendientes que empiezan en las próximas 24 horas**. Sin duplicados (cada cita se reclama en una sola instrucción antes de enviar); no envía entre las 9:00 PM y las 7:00 AM (lo pendiente sale a las 7:00 AM); una cita creada hace menos de 2 horas no se recuerda (el paciente acaba de recibir su confirmación); respeta que el paciente no acepte recordatorios y que la óptica los apague. Verificado con reloj fijo, sin correos reales |
| `marcar_no_asistio_automatico` | cada 5 minutos | Marca como «No asistió» las citas que no se iniciaron 10 minutos después de su hora (editable a mano) |
| `saludos_cumpleanos_diarios` | diaria | Envía el saludo de cumpleaños a quien aceptó recibirlo |
| `limpiar_limite_solicitudes` | diaria | Limpia el registro del límite de frecuencia por IP de las funciones públicas (agendar, registrar visita, dejar un contacto) |
| `verificar_sistema` | cada 15 minutos | Comprueba la salud de las tareas y de los envíos y alimenta el aviso de estado del sistema |

Además, los estados de la cita cambian solos con el trabajo: abrir la ficha desde una cita la pasa a «En Atención» y guardarla a «Atendida». El remitente de los tres correos del sistema es configurable sin tocar el código (secreto `resend_remitente`).

## 6. Pruebas

| Tipo | Cantidad | Qué cubre |
|---|---|---|
| **Unitarias y de componentes** (Vitest + Testing Library) | 1 993 pruebas en 177 archivos | Reglas de negocio puras (fechas y horas de Ecuador, disponibilidad y horas libres, estados de cita, fidelización, CRM, inventario, ventas y abonos, permisos y roles, formato de documentos) y el comportamiento de cada pantalla y componente con datos simulados |
| **De extremo a extremo** (Playwright, Chromium) | 245 pruebas en 57 archivos | Recorridos reales contra la versión compilada y la base: citas, pacientes, ficha clínica, ventas y abonos, inventario, CRM, reportes, usuarios y roles, soporte, horario y ausencias, portal del paciente, página pública, sesión en varias pestañas, permisos por API |
| **Verificaciones de la base** (scripts con transacción que se revierte) | 77 scripts históricos, uno por cambio de base | Ensayo de cada migración y verificación con sesiones reales de cada rol |

**Resultado de la suite completa de Playwright (versión compilada, un solo proceso, en 7 grupos de archivos, 23 oct. 2026):** 245 pruebas: **236 pasaron, 0 fallaron y 9 se omitieron**. Las 9 omitidas lo son por diseño, no por fallo: 3 necesitan las credenciales del superadministrador (comunicación interna, ofrecer ayuda y soporte), 1 solo corre cuando se pide crear cuentas reales (`E2E_CREAR_CUENTAS`) y 5 son capturas de pantalla (`E2E_CAPTURAS`). En la primera pasada completa fallaron 68 pruebas; 66 eran expectativas de pantallas anteriores (se corrigieron las pruebas, no las pantallas) y las demás eran cruces entre pruebas por la regla de una hora por profesional. Las unitarias: 1 993 de 1 993 pasaron.

## 7. Trabajo futuro

- **Verificación en dos pasos** para todo el personal: hoy existe como opción para quien la activa; falta completarla, exigirla por rol y anunciarla.
- **Mensajes SMS** a pacientes sin correo, además del correo y de WhatsApp.
- **Teleoptometría:** consulta a distancia con videollamada y registro en la ficha.
- **Sistema del personal adaptable al celular:** hoy el portal del paciente y la página pública se adaptan al celular; el sistema del personal está pensado para pantalla de escritorio.
- **Pago con tarjeta en línea** para abonos y ventas desde el portal (hoy: efectivo en la óptica y transferencia con verificación).
- **Dominio propio para el correo de los recordatorios:** verificar el dominio de la óptica en el proveedor de correo y guardar la dirección en el secreto del remitente; mientras tanto, los correos salen desde la dirección de prueba del proveedor, que solo entrega al dueño de la cuenta.
- **Modelo predictivo** (por ejemplo, riesgo de inasistencia) y **uso sin conexión**: previstos en el anteproyecto y dejados fuera a propósito.

## 8. Cómo se obtuvo cada cifra

1. **Base de datos** (consulta directa a PostgreSQL): tablas, vistas, RLS, políticas, funciones, disparadores, depósitos, tareas programadas y columnas cifradas salen de `information_schema`, `pg_class`, `pg_policies`, `pg_proc`, `pg_trigger`, `storage.buckets` y `cron.job`.
2. **Código:** archivos y líneas contados sobre los archivos versionados (`git ls-files`), sin pruebas ni los componentes base de la librería de interfaz; migraciones, de `supabase/migrations`.
3. **Pruebas:** unitarias, del resultado de `npm test`; extremo a extremo, de `npx playwright test --list` y del resultado de la corrida completa; el detalle de lo que falló y se corrigió está en `docs/estado-actual.md`.
4. **Óptica nueva:** `scripts/historial/verificar-optica-nueva.mjs` (crea una óptica como el panel del superadmin, comprueba roles, recordatorios y tablas vacías, y revierte) y `src/utilidades/opticaNueva.test.js` (valores por defecto: plantillas del CRM, fidelización, motivos de cancelación, mínimo y máximo de inventario, recordatorio del conteo, textos y color de la página pública).
