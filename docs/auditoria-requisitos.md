# Auditoría de requisitos (R1 a R62) y pendientes técnicos

Fecha: 6 de octubre de 2026 · Rama `bloque-f` · Fuente de requisitos: `docs/feedback-ing/requisitos-reunion-29sep.md`.

**Cómo se hizo.** Cada requisito se contrastó con el código actual (búsqueda de la pantalla, la función o la migración que lo cumple) y con los planes de `docs/feedback-ing/` (prioridad 1, bloques D, E y F). Las líneas citadas son las de hoy; se mueven con cada cambio. La suite de pruebas pasa completa (39 archivos, 309 pruebas) y el build compila. **No se volvió a recorrer cada pantalla en el navegador en esta auditoría** (la herramienta de navegador se desconectó); lo que sí se verificó en vivo es lo de los pendientes técnicos (sección 4) y el ensayo del script de demostración (sección 5). Los recorridos en navegador de cada bloque están documentados en sus planes. La columna "Cómo probarlo" sirve para repetirlos con la Óptica Demo ya poblada.

Leyenda: **Hecho** cumple lo pedido · **Hecho distinto** existe, pero resuelve el pedido de otra manera, por decisión explícita · **Parcial** falta una parte · **Pendiente** no existe.

## 1. Resumen

| Estado | Cantidad |
|---|---|
| Hecho | 59 |
| Hecho distinto | 1 (R39) |
| Parcial | 2 (R51, R62) |
| Pendiente | 0 |
| **Total** | **62** |

**Lo que no está completo, y por qué:**

| Req. | Qué falta | Razón |
|---|---|---|
| R51 | Verificación de cuentas por correo. Cédula única y correo obligatorio sí están hechos. | Depende de enviar correo con un dominio propio verificado en Resend. Ver 4.4. |
| R62 | Pulido visual final módulo por módulo y aplicación de la base visual a las páginas públicas y al Portal del paciente. | Es el Bloque G, que el ingeniero fijó "al final". La base visual común ya está aplicada al sistema interno (Bloque A, `docs/base-visual-capturas`). |

**Hecho distinto:** R39. El ingeniero dijo que la cita queda "Atendida" al generar la factura total. Por decisión de Diego (6 oct.) la cita pasa a "Atendida" al terminar la atención clínica, y la venta se sigue aparte (`pases_a_venta`: listo, vendido, descartado). Razón: quien consulta y no compra también fue atendido, y así el embudo (R40) sale de datos reales.

## 2. Tabla de los 62 requisitos

### Citas médicas (R1 a R19)

| Req. | Estado | Evidencia | Cómo probarlo |
|---|---|---|---|
| R1 Orden de indicadores | Hecho | `paginas/Citas.jsx:1216` (`indicadores`): "Citas de hoy" primero, "Total agendadas" al final | Citas → Lista: leer el orden de las tarjetas de arriba |
| R2 Indicadores que parezcan filtros | Hecho | `Citas.jsx:1216-1343`, botones con `aria-pressed` y relleno oscuro al estar activos | Pulsar una tarjeta: queda marcada y la lista se filtra |
| R3 Bloque de filtros (estado, origen, primera vez) | Hecho | `Citas.jsx:373-376` (estado, `origenFiltro`, `seguimientoFiltro`), `utilidades/filtrosCitas.js:4` | Abrir "Más filtros": estado, origen y primera vez/seguimiento |
| R4 Ver atendidas, en curso, canceladas y vencidas | Hecho | `utilidades/filtrosCitas.js:4` (`ESTADOS_FILTRO`), sección "Anteriores" plegable | Filtro de estado: Atendidas, En atención, Canceladas, Vencidas |
| R5 Buscador junto a los filtros | Hecho | Buscador dentro del bloque de filtros, en todas las vistas (`Citas.jsx`, bloque de filtros) | Buscar un paciente desde el mismo bloque donde están los filtros |
| R6 Redefinir "primera vez" | Hecho | `utilidades/filtrosCitas.js:33` (`esPrimeraVez`): sin consultas previas del paciente | Una segunda cita del mismo paciente ya no sale como primera vez |
| R7 Vistas día y mes, hoy marcado, botón Hoy | Hecho | `Citas.jsx:1142` (`irAHoy`), `:1366`, selector de vista `:1385`; `componentes/CalendarioMes.jsx` | Cambiar entre Lista, Semana y Mes; el día actual resaltado; pulsar "Hoy" |
| R8 Rango de fechas | Hecho | `Citas.jsx:385` (`rangoDesde`), `:1054-1064` | Elegir Desde/Hasta de la próxima semana |
| R9 Calendario por color según la carga | Hecho | `componentes/CalendarioMes.jsx:9,34,110` (modo "Carga"), `utilidades/cargaCitas.js` | Vista Mes → cambiar de "Citas" a "Carga": días más oscuros = más citas |
| R10 Lo más próximo primero | Hecho | `Citas.jsx` (orden cronológico desde hoy; lo pasado plegado en "Anteriores") | Lista: la primera cita es la más cercana a hoy |
| R11 Clic en un día del mes abre un modal en una columna | Hecho | `Citas.jsx:1137,1176,1563` (`diaModalMes`) | Vista Mes → clic en un día con citas |
| R12 Detalle: paciente, fecha de agendado, motivo, origen, responsable | Hecho | `componentes/DetalleCitaModal.jsx:96-100` ("Agendada el", "Origen", "Asignado a", "Atendido por"), abierto desde `Citas.jsx:2246`; migración 0083 | Clic en cualquier cita |
| R13 Botones Ingresar y Cerrar | Hecho | `DetalleCitaModal.jsx:45` (`onIngresar`), `componentes/ConfirmarCitaModal.jsx` | En el detalle, "Ingresar a la ficha" y "Cerrar" |
| R14 "Ver perfil" sin perder el lugar | Hecho | `Citas.jsx:193` y `componentes/CalendarioSemanal.jsx:140` abren en pestaña nueva; `Dashboard.jsx:194` recibe `?paciente=` | "Ver perfil" abre otra pestaña y la agenda sigue ahí |
| R15 Quitar "Crear paciente" del menú de la cita | Hecho | `Citas.jsx` ya no lo ofrece; solo existe en Pacientes (`Pacientes.jsx:1022,1447`) | Menú "Más acciones" de una cita: no aparece |
| R16 Estados automáticos; "No asistió" manual | Hecho | En atención al abrir la ficha (`paginas/ConsultaMedica.jsx:603-613`); Atendida al terminar (`:331-343`); No asistió automático a los 10 min (migraciones 0076, 0092); manual en `Citas.jsx:261` | Abrir la ficha desde una cita: pasa a "En atención" sola |
| R17 No eliminar: cancelar o reagendar | Hecho | `Citas.jsx:726,2310` ("Cancelar cita", conserva el registro), migración 0078; reagendar en Editar cita; el paciente reagenda desde `paginas/PortalPaciente.jsx` | Cancelar una cita: queda con badge "Cancelada por recepción" |
| R18 Administrador filtra por responsable | Hecho | `Citas.jsx:379,1020` (`asignadoFiltro`, `atendidoFiltro`), migración 0083 | Como administrador: filtrar "No asistió" + una persona del equipo |
| R19 Mi horario: ocupados/disponibles y todo el equipo | Hecho | `paginas/Horario.jsx:431,473,1112`, `componentes/HorarioEquipo.jsx`; migración 0084 | Mi horario: conteo "N ocupados · M disponibles" y horarios del equipo |

### Atención y venta (R20 a R40)

| Req. | Estado | Evidencia | Cómo probarlo |
|---|---|---|---|
| R20 Atender: resumen y luego ficha vinculada | Hecho | `Citas.jsx:774` (`atenderCita`); la consulta guarda `cita_id` (migración 0079) | "Atender" → resumen → "Ingresar" |
| R21 En atención automático y el administrador ve cuántas | Hecho | `Inicio.jsx:328,586` ("En atención ahora"); se actualiza por sondeo cada 20 s (`App.jsx:544-574`), no por suscripción en vivo | Abrir una ficha y ver el contador en el Inicio del administrador (hasta 20 s) |
| R22 Confirmar datos del paciente web al atender | Hecho | `Citas.jsx:791` abre `ConfirmarDatosPacienteModal`; migración 0077 | Atender una cita de origen web no confirmada |
| R23 Atender hoy una cita de otro día, con fecha real | Hecho | `Citas.jsx:147,1096` (`fechaRealPorCitaId`): "Atendida el…" cuando difiere | Atender una cita de mañana hoy |
| R24 Sin cita: atender desde Pacientes | Hecho | `Pacientes.jsx:1594` ("Atenderlo ahora"), botón "Ficha clínica" del perfil | Crear paciente → "Atenderlo ahora" |
| R25 Sin buscador si ya estoy en un paciente | Hecho | `ConsultaMedica.jsx:1469` (`!pacienteId &&`) | Entrar a la ficha desde una cita: no hay buscador |
| R26 Referencia de la cita | Hecho | `ConsultaMedica.jsx:1212` ("Sin cita · consulta directa" o fecha/hora de la cita) | Barra superior de la ficha |
| R27 Contexto primero | Hecho | `ConsultaMedica.jsx:483-530` (historial y tendencia entre visitas), bloque de contexto antes de la refracción | Paciente con 2+ consultas: contexto arriba |
| R28 No repetir bloques entre pasos | Hecho | Antecedentes solo en Anamnesis (`ConsultaMedica.jsx:1299,1334`) | Recorrer los tres pasos |
| R29 Exámenes opcionales | Hecho | `ConsultaMedica.jsx:1601,1635` ("Todo opcional · vacío significa no medido"), badges Registrado / No registrado | Guardar una ficha sin llenar exámenes |
| R30 Motivo por categorías + "Otros" con detalle | Hecho | Categorías en `paginas/Configuracion.jsx:541`; "Otros" exige detalle (`ConsultaMedica.jsx:466-468`); si la cita trae motivo no se vuelve a pedir | Configuración → motivos; elegir "Otros" en la ficha |
| R31 Diagnóstico por categoría + detalle, lente, imágenes, indicaciones, control | Hecho | `diagnosticoCategorias` (migración 0049), `ConsultaMedica.jsx:2014` (lente a recomendar), imágenes (0044) | Completar el paso Diagnóstico |
| R32 No posponer: guardar y seguir, o dejar de atender | Hecho | `ConsultaMedica.jsx:349`; `Citas.jsx:2295` ("Dejar de atender"), `componentes/ConfirmarDejarDeAtender.jsx` | "Dejar de atender": lo no guardado se pierde y la cita se mantiene |
| R33 "Terminar atención" genera la receta | Hecho | `ConsultaMedica.jsx:2264` ("Terminar atención"), receta imprimible | Terminar una atención: sale la receta, no la factura |
| R34 "Pasar a la óptica" → "Listo para venta" | Hecho | `ConsultaMedica.jsx:300-308` (`pasar_a_optica`, migración 0085), `:2049` | Pulsar "Pasar a la óptica": el paciente aparece en la cola de Ventas |
| R35 Vendedora toma los datos y arma la proforma | Hecho | `componentes/ColaVentas.jsx:64` ("Tomar datos del diagnóstico"), `paginas/ComprobanteVentaModal.jsx:75` | Ventas → Por vender → "Tomar datos del diagnóstico" |
| R36 Orden de laboratorio con número de comprobante y receta, dos copias | Hecho | `componentes/OrdenLaboratorioModal.jsx`, `utilidades/ordenesLaboratorio.js` (`armarHtmlOrdenDosCopias`), migraciones 0087 y 0094 (numeración interna CV-0001) | Vender con luna: se abre la orden; imprimir (paciente y laboratorio) |
| R37 Laboratorio completa, el administrador recibe el aviso | Hecho | `componentes/OrdenesLaboratorio.jsx` (enviada → lista → entregada), `Inicio.jsx:353,532` ("Lentes listos sin avisar", atrasadas), `registrar_aviso_paciente` | Marcar una orden "Lista": aparece la alerta en Inicio |
| R38 Pagos al contado, cuotas o abonos | Hecho | `ComprobanteVentaModal.jsx:163-314` (directo, tarjeta, cuotas, abonos), `componentes/AbonoModal.jsx:48` (`registrar_abono`, migración 0088) | Vender con abonos y registrar abonos hasta saldar |
| R39 Cita "Atendida" con la factura | Hecho distinto | `ConsultaMedica.jsx:331-343` (Atendida al terminar la atención); decisión de Diego del 6 oct. | Terminar atención sin vender: la cita queda Atendida |
| R40 Quién consultó y no compró; embudo | Hecho | `utilidades/embudo.js` (`calcularEmbudo`, con `esPrimeraVez` de `filtrosCitas.js`), `paginas/Reportes.jsx` ("Embudo de ventas": consultaron, pasaron, compraron, no compraron por motivo, proformas y, nuevo, "Primera vez o ya eran pacientes" con cuántos de los de primera vez compraron). Pruebas en `embudo.test.js` | Reportes → Embudo (verificado en vivo en la Óptica Demo, 7 oct.: 18 de primera vez + 27 ya pacientes = 45 consultas; 4 de los 18 compraron) |

### Perfil del paciente (R41 a R45)

| Req. | Estado | Evidencia | Cómo probarlo |
|---|---|---|---|
| R41 "Productos y servicios" | Hecho | `paginas/Pacientes.jsx:2108` (pestaña), `:1924` (tablas de productos y de servicios) | Perfil → Productos y servicios |
| R42 Separar controles clínicos de fidelización | Hecho | `Pacientes.jsx:2136` ("Fidelización"); estado de corrección y tendencia en el historial clínico | Perfil → Fidelización no repite el próximo control |
| R43 Fidelización: última visita, frecuente, referidos, cumpleaños con días | Hecho | `Pacientes.jsx:1972` (`diasParaCumpleanos`), `utilidades/fidelizacion.js` | Perfil de un paciente con cumpleaños cercano |
| R44 "Enviar mensaje por CRM" desde el perfil | Hecho | `Pacientes.jsx:393-405,2583`, funciona aunque los envíos automáticos estén apagados | Perfil → "Enviar mensaje por CRM" |
| R45 Secciones Citas y Diagnósticos | Hecho | `Pacientes.jsx:2071,2085,2754,2838` (sección Diagnósticos con la ficha completa al hacer clic) | Perfil → Citas y Diagnósticos |

### Roles, usuarios e Inicio (R46 a R56)

| Req. | Estado | Evidencia | Cómo probarlo |
|---|---|---|---|
| R46 Roles separados de usuarios | Hecho | `paginas/Usuarios.jsx:23,203` (pestañas Usuarios / Roles), `componentes/RolesPanel.jsx`; migración 0090 | Usuarios → crear usuario eligiendo rol con vista previa |
| R47 Roles predefinidos editables y propios eliminables | Hecho | `RolesPanel.jsx:19,82,90` (`es_predefinido`, restaurar), `restaurar_rol_predefinido` (0090) | Intentar eliminar "Optómetra": no se puede; crear y eliminar un rol propio |
| R48 Permisos por nivel | Hecho | `utilidades/roles.js:5-19` (ver / crear / editar / eliminar), exigido por la base (migración 0091) | Rol con Inventario solo "ver": los botones de edición no aparecen y la base rechaza el cambio |
| R49 Alcance de los datos | Hecho | `Dashboard.jsx:162-166` (`alcanceDeVista`), migración 0093 (citas, consultas y reportes "propios") | Rol con alcance "propio": Reportes solo muestra lo suyo |
| R50 Varios perfiles y cambio de vista | Hecho | `utilidades/useVistas.js:6`, `Dashboard.jsx:160,1107` (selector en el menú de usuario) | Usuario con dos roles: cambiar de vista desde el menú |
| R51 Cédula, correo y verificación | Parcial | Cédula única (migración 0082) y correo obligatorio (`Usuarios.jsx:38-84`). **No hay verificación por correo** | Crear usuario sin cédula o con una repetida: se rechaza; la verificación no existe (4.4) |
| R52 Tarjetas coherentes | Hecho | `Inicio.jsx:298-347`: cada fila con título (Totales, Citas de este mes, Hoy, Para vender) | Inicio del administrador: cada fila habla de una sola cosa |
| R53 Administrador: totales y desenlace de citas | Hecho | `Inicio.jsx:290,303-317` (totales, atendidas, no atendidas, canceladas, pacientes sin atender) | Inicio como administrador |
| R54 "N productos con stock bajo", una sola vez | Hecho | `Inicio.jsx:776` | Inicio con productos bajo el mínimo |
| R55 Atajos que abren la acción directa | Hecho | `Inicio.jsx:360` y vecinos (registrar paciente, agendar cita, añadir producto) | Pulsar cada atajo: abre el formulario |
| R56 Inicio por rol | Hecho | `Inicio.jsx:89-90,191,347` (administrador, optómetra, recepción, ventas y rol propio) | Cambiar de vista y comparar el Inicio |

### Ventas, reportes y diseño (R57 a R62)

| Req. | Estado | Evidencia | Cómo probarlo |
|---|---|---|---|
| R57 Lunas como texto con precio, no stock | Hecho | `ComprobanteVentaModal.jsx:105,128,218` (línea de tipo `luna`, migración 0094); `Inventario.jsx:413,673` aclara que las lunas no van ahí | Vender: la luna se escribe en la venta y no descuenta stock |
| R58 Solo monturas y accesorios, genéricos | Hecho | `paginas/Inventario.jsx:41-44` (categorías Armazones y Accesorios), textos genéricos | Inventario: solo esas dos categorías |
| R59 La venta: paciente, diagnóstico, montura, luna y filtros, precio total | Hecho | `ColaVentas.jsx:64` → `ComprobanteVentaModal.jsx:75,128` (tipo de luna, material, filtros, total) | Ventas → Nueva venta de un paciente con diagnóstico |
| R60 Gráficas de diagnósticos por mes y año | Hecho | `paginas/Reportes.jsx:818` ("Diagnósticos por mes"), `utilidades/reportesDiagnosticos.js` (agrupa sin importar tildes ni mayúsculas) | Reportes → Diagnósticos por mes, elegir año |
| R61 Filtro por motivo de consulta | Hecho | `Reportes.jsx:446` ("Motivo de consulta") | Reportes → elegir un motivo: cambian consultas y diagnósticos |
| R62 Diseño pulido al final, mismo lenguaje | Parcial | Base visual aplicada al sistema interno (Bloque A, `docs/base-visual-capturas`); falta el Bloque G (páginas públicas, Portal, revisión de Nielsen) | Recorrer cada módulo con el estándar visual |

Además, dentro del Bloque F se pidieron las **órdenes atrasadas por laboratorio, el tiempo promedio de entrega y las ventas por tipo de luna**: hechos (`Reportes.jsx:880,919`, `utilidades/reportesLaboratorio.js`), con los montos ocultos a quien no ve Ventas.

## 3. Cambios de esta fase

- **Diagnósticos agrupados:** en Reportes, "Sin alteracion refractiva" y "Sin alteración refractiva" (y variantes de mayúsculas o espacios) se cuentan en una sola fila, con el nombre de la variante más usada. Aplica a la tabla "Diagnósticos por mes" y al "Top 5". Con pruebas (`utilidades/reportesDiagnosticos.test.js`). *Origen del problema:* las listas de diagnósticos y motivos de las ópticas se guardaron sin tildes ("Miopia", "Adaptacion de Lentes"); el script de demostración corrige las de la Óptica Demo.

## 4. Pendientes técnicos

### 4.1 Error 401 de `opticas_publicas` al abrir la app

- **Causa (verificada contra la base real):** no es un problema de permisos. La vista responde 200 con la clave pública sola y con una sesión recién iniciada; responde **401 (PGRST301)** solo cuando la petición lleva un token de sesión inválido o vencido. `resolverOpticaPublica` (`utilidades/opticaActual.js:25-33`) usa el cliente principal, que adjunta el token guardado en el navegador aunque la lectura sea pública.
- **No reproducido en el navegador** (herramienta desconectada): la hipótesis es una sesión guardada caducada o revocada en el momento de la primera lectura. Se confirma abriendo la app con una sesión vieja y mirando la pestaña de red.
- **¿Requiere base de datos?** No.
- **Propuesta:** que esa lectura pública use un cliente sin sesión (ya existe `crearClienteTemporal()` en `lib/supabaseClient.js`, con `persistSession:false`). Cambio de unas cinco líneas.

### 4.2 Hallazgo nuevo y más grave: la vista pública acepta escrituras anónimas

Al investigar el 401 apareció esto, **confirmado**:

- `opticas_publicas` es una vista simple (una sola tabla), por lo tanto actualizable, y corre con los privilegios de su dueño, sorteando RLS. Los permisos por defecto de Supabase le dieron `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` a `anon` y `authenticated`.
- Prueba sin riesgo por HTTP: un `PATCH` con la clave pública y un filtro que no coincide con ninguna fila respondió **204** (permitido). En una transacción revertida, con el rol `anon`: `UPDATE … SET settings = '{}'` afectó 1 fila; `INSERT` creó una óptica; `UPDATE nombre`, `UPDATE logo_url` quedaron frenados por los disparadores de `opticas`; `DELETE` falló solo de rebote (restricción de `perfiles`). Nada quedó escrito.
- **Impacto:** cualquier persona con la clave pública (está en el JavaScript de la app) puede sobrescribir `settings`, `motivos_consulta` y `diagnosticos_rapidos` de cualquier óptica y crear ópticas falsas. Las otras tres vistas con permisos de escritura (`citas`, `consultas`, `pacientes`) usan `security_invoker`, así que sí respetan RLS.
- **¿Requiere base de datos?** Sí. SQL (**aplicado el 6 de octubre, migración 0095**):

```sql
-- 0095_opticas_publicas_solo_lectura.sql
revoke insert, update, delete, truncate, references, trigger
  on public.opticas_publicas from anon, authenticated;
-- La vista conserva select para anon y authenticated (login, agendar cita y portal siguen igual).
```

  Verificación posterior: repetir el `PATCH` anónimo (debe dar 401/403) y comprobar que el login, la página de agendar y el portal siguen cargando la óptica.

#### Estado de la seguridad de permisos (actualizado el 6 de octubre)

| Migración | Qué hace | Estado |
|---|---|---|
| 0095 | `opticas_publicas` queda de solo lectura | **Aplicada** y verificada |
| 0096 (partes a, b, d) | Sin TRUNCATE, REFERENCES ni TRIGGER; `anon` solo con SELECT en `opticas_publicas` y `disponibilidad`; funciones internas de envío y de no asistió cerradas a la API; `cifrar_clinico` y `descifrar_clinico` cerradas a `anon` | **Aplicada** y verificada |
| 0097 (parte c) | Quitar a `authenticated` la escritura directa en las tablas que solo se usan por RPC | **NO aplicada** (borrador). Se aplica después de las pruebas con Playwright |

Verificación (51 de 51 comprobaciones, con datos de prueba en transacciones revertidas y lecturas reales): login del administrador y del superadmin, vistas de pacientes, citas y consultas descifradas, reserva pública, portal del paciente, venta con orden de laboratorio y abonos, y los cuatro trabajos programados activos. El cron real de "no asistió" corrió después del cambio y terminó bien.

**Pendientes de esta línea:**
1. **Aplicar la 0097** tras las pruebas con Playwright (recorrer un flujo por rol; correr `scripts/test-rls.mjs`). Aviso: `registrar_venta_producto`, la función antigua sin uso, dejaría de funcionar al quitar el INSERT de `ventas`.
2. **Revisar la ejecución real de las 15:00 UTC** de `enviar_recordatorios_citas` y `enviar_saludos_cumpleanos` en `cron.job_run_details`: ya no se llaman por la API, pero solo se probaron como `postgres` dentro de una transacción.
3. **Revisar los registros de la API de Supabase** (Logs → API) buscando PATCH, POST o DELETE sin sesión contra `opticas_publicas` mientras estuvo abierto el hueco: es la única prueba definitiva de si alguien lo usó. En la base no se encontraron ópticas desconocidas ni cambios atribuibles (ver el análisis del 6 de octubre).
4. Quedan por revisar las funciones `exportar_mis_datos_paciente`, `mis_notificaciones_recientes` y `tiene_permiso_modulo`: se dejaron fuera a propósito porque no está claro si algo las usa.

### 4.3 Verificación en dos pasos obligatoria para administradores

- **Hoy:** es opcional. Hay 0 factores TOTP inscritos en la base; los cuatro administradores y el superadmin no la tienen. `Login.jsx:600-625` la exige solo si ya existe un factor verificado, y la comprobación está envuelta en un `try/catch` que, si falla, deja entrar sin segundo factor. En la base, `mfa_satisfecho()` (migración 0057) exige `aal2` únicamente cuando la cuenta ya tiene un factor, y esa regla restrictiva ya cubre 9 tablas.
- **Qué falta:** (1) obligar a inscribirse a quien no tiene factor; (2) que la base exija el segundo factor a los administradores aunque no se hayan inscrito.
- **¿Requiere base de datos?** El paso 1 no; el paso 2 sí.
- **Propuesta por fases:**
  1. *Sin SQL:* tras iniciar sesión, un administrador sin factor ve una pantalla obligatoria de inscripción (reutiliza `SeccionMfa.jsx`) y no pasa al panel hasta completarla. Quitar el "entrar igual" del `catch` para administradores.
  2. *Con SQL, después de que todos se inscriban:* que `mfa_satisfecho()` devuelva falso para un administrador sin factor verificado, con un plazo de gracia (`opticas.mfa_obligatorio_desde`) para no dejar a nadie fuera.
- **Riesgos a decidir:** las cuentas de prueba (`andres@gmail.com`, el superadmin) y las pruebas automáticas que inician sesión necesitarían un factor o una excepción; y recuperar una cuenta que pierde su teléfono (hoy requeriría al superadmin con acceso a la base).

### 4.4 Verificación de cuentas por correo (R51)

- **Hoy:** "Confirm email" de Supabase Auth está apagado y no hay flujo de invitación.
- **Dependencia, más amplia de lo que se creía:** los correos automáticos (recordatorios, encuesta, cumpleaños) salen de `onboarding@resend.dev` (migraciones 0031, 0033, 0041). Según la documentación de Resend, ese remitente de prueba solo entrega a la dirección dueña de la cuenta; **conviene confirmarlo**, porque implicaría que hoy esos correos no llegan a pacientes reales. Con un dominio propio verificado se resuelve todo a la vez.
- **¿Requiere base de datos?** No para el flujo (Auth guarda `email_confirmed_at`): configurar el SMTP de Auth con Resend, activar "Confirm email" y crear usuarios por invitación (el administrador no conoce la contraseña). Solo cambiaría el remitente en las funciones de la base, que es una migración pequeña de reemplazo de función.
- **Propuesta:** esperar al dominio; preparar entre tanto la función de invitación (hay precedente en `supabase/functions/eliminar-cuenta-auth`).

### 4.5 Pendientes que dejan los planes de los bloques

| Pendiente | Origen | ¿BD? | Propuesta |
|---|---|---|---|
| Contraseña mínima también en las funciones del portal del paciente y en los requisitos de Supabase Auth (hoy solo en pantalla) | Plan D | Sí (portal) + configuración de Auth | Migración que valide largo y complejidad en la creación y cambio de clave del portal; subir el mínimo en Auth |
| Limpieza del camino antiguo `ventas`, `registrar_venta_producto`, `consultas.producto_id` y `monto_venta` (0 filas, reportes todavía lo leen en algunos cálculos) | Plan E | Sí | Hacerlo después de la auditoría, con respaldo; primero quitar las lecturas en `Reportes.jsx` |
| Aviso por WhatsApp de "lentes listos" y estado de la orden en el portal del paciente | Plan E | No / opcional | Reutilizar `mensajeLentesListos` (ya existe); estado en el portal es lectura de la orden |
| Renombrar las facturas de suscripción SaaS ("cobro de suscripción") | Plan E 6.9 | No | Solo texto, si se quiere |
| Integración con el SRI | Plan E | — | Trabajo futuro declarado en la tesis |
| Consentimiento informado de tratamiento de datos al registrar o agendar (LOPDP, `vision-sistema.md` 6.3) | Visión | Sí (registro del consentimiento) | No encontré nada en el código; es el hueco legal más visible. Casilla obligatoria con fecha y versión del texto |
| Registro de auditoría de quién *vio* datos clínicos (hoy se registran cambios, no lecturas) | Visión 6.3 | Sí | Evaluar costo; puede limitarse a la apertura de la ficha |
| Registro de cambios de permisos de roles | Visión 6.4 | No (ya existe `registrarLog`) | `RolesPanel` registra eliminar y restaurar (`:41,52`); falta guardar y editar |
| Cuentas de optómetra y recepcionista de la Óptica Demo | Plan D | No | Las crea Diego desde Usuarios (decisión del Bloque D) |
| Bloque G: pulido final, medición de Nielsen, páginas públicas y Portal | Visión | No | Siguiente fase |
| Verificaciones pendientes de los Bloques E y F con datos reales (orden entregada con promedio, venta con luna, usuario sin permiso de Ventas, alcance propio) | Planes E y F | No | El script de la Óptica Demo deja esos casos listos |
| Tiempo real del contador "En atención" (hoy sondeo de 20 s) | R21 | No | Suficiente para la tesis; Realtime solo si el ingeniero lo exige |

### 4.5 bis Pruebas unitarias intermitentes (a investigar)

El 7 de octubre, al correr `npm test` justo después de agregar las pruebas de Playwright y mientras el servidor de desarrollo seguía abierto, **4 pruebas unitarias fallaron una sola vez** (291 de 295 pasaron). Se repitió la corrida sin cambiar nada y pasaron las 295. No se guardó el nombre de las pruebas que fallaron. **Segunda aparición (7 de octubre):** falló una sola prueba, `ConsultaMedica.test.jsx › 'Siguiente' y 'Terminar atención' son nodos <button> distintos`, en una corrida con el servidor de desarrollo abierto; las dos corridas siguientes pasaron 303 de 303. **Pendiente:** investigar la causa (sospecha: tiempos de espera por la carga de la máquina), repitiendo la suite con el servidor abierto y con `--reporter=verbose` para identificar cuáles son.

### 4.6 Observación de limpieza (no es del código)

El estado de git arrastra 16 enlaces borrados en `.claude/skills/` desde antes de esta sesión. No los toqué ni los incluí en ningún commit; conviene resolverlos aparte (restaurarlos o confirmar el borrado).

### 4.7 Cierre de R40 (7 oct.)

Hecho sin tocar la base de datos. `calcularEmbudo` recibe además el `historial` completo de consultas (sin el filtro por motivo, para que filtrar no vuelva "primera vez" a un paciente antiguo) y usa `esPrimeraVez` por cada consulta del período. El embudo muestra cuántas consultas fueron de primera vez, cuántas de pacientes que ya lo eran y cuántos de los de primera vez compraron. Límites conocidos: una consulta sin paciente vinculado (paciente anonimizado) cuenta como primera vez, igual que en Citas; y no se mide todavía cuántos de los de primera vez regresaron a una segunda consulta, solo cuántos compraron.

## 5. Datos de demostración de la Óptica Demo

Script: `scripts/seed-optica-demo.mjs`. **Ejecutado de verdad el 6 de octubre (20:56 hora de Ecuador)** tras un ensayo previo revertido: 29 verificaciones correctas; solo cambió la Óptica Demo (las otras tres ópticas conservan exactamente sus filas y fechas de modificación) y no se encoló ningún correo ni mensaje (`notificaciones_enviadas`, `mensajes` y la cola de `pg_net` sin cambios). No se puede volver a ejecutar sobre la misma óptica: aborta si ya tiene datos.

```
node --env-file=.env.local scripts/seed-optica-demo.mjs              # ensayo: no deja nada
node --env-file=.env.local scripts/seed-optica-demo.mjs --ejecutar   # escribe de verdad
```

**Qué crea:** 40 pacientes (cédulas válidas, verificadas con `cedula_ecuatoriana_valida`; correos `@example.com`); 90 citas (últimas 6 semanas, hoy y próximas 3 semanas, en todos los estados: Pendiente, En espera, En atención, Atendida, No asistió y Cancelada por paciente y por recepción, horas "hh:mm AM/PM"); 66 consultas de los últimos 9 meses con diagnósticos y graduaciones variadas y tendencia entre visitas; 32 pases a venta (19 vendidos, 8 descartados con motivo, 5 en espera); 20 comprobantes (11 pagados, 8 con saldo, 1 anulada) con 19 abonos y cuotas; 20 órdenes de laboratorio (11 entregadas, 5 enviadas de las cuales 3 atrasadas, 3 listas, 1 cancelada) repartidas en tres laboratorios con tiempos distintos; 20 productos (14 monturas y 6 accesorios, 7 bajo el mínimo); 12 encuestas de satisfacción. Pacientes web sin confirmar, citas web sin paciente, "sin atender" y cumpleaños próximos incluidos.

**Seguridad (todas comprobadas dentro del ensayo):**
- Aborta si la óptica objetivo no es exactamente "Óptica Demo", si ya tiene datos, si no tiene administrador, o si al terminar cambió el conteo de filas de cualquier otra óptica (compara 9 tablas antes y después).
- No envía nada: todas las citas nacen con recordatorio y encuesta ya "enviados", todos los pacientes con el saludo de cumpleaños del año ya "enviado", no escribe en `mensajes` y no llama a Resend. El ensayo verifica que ningún proceso automático encuentre algo que enviar (0 citas elegibles, 0 pacientes elegibles) y que ninguna cita "Pendiente" ya haya vencido (el proceso de "No asistió" no la tocaría).
- Se deja una excepción a la regla "solo datos": corrige con tildes las listas de motivos y diagnósticos rápidos de la propia Óptica Demo (estaban sin tildes). No toca nombre, estado ni configuración de pagos.
- Determinista: misma semilla, mismos nombres y cédulas; solo se mueven las fechas con el día de ejecución.

**Salida del ensayo (6 oct., 20:18 hora de Ecuador):**

```
Base de datos: postgres  ·  modo: ENSAYO (dry-run, se revierte)
Óptica objetivo: Óptica Demo. Otras ópticas (no se tocan): Optica Karla V, Óptica Solna Vision, QA Test Claude
Verificaciones: 29 de 29 correctas
  pacientes 40 · cédulas inválidas 0 · cédulas repetidas 0 · correos fuera de @example.com 0 · horas con formato inválido 0
  citas: Atendida 57, Cancelada 9, En Atención 1, En Espera 1, No Asistió 7, Pendiente 15
  Pendiente vencidas 0 · elegibles para recordatorio 0 · para encuesta 0 · para cumpleaños 0
  consultas 66 (legibles por la vista, 66) · pacientes legibles 40 · meses distintos con consultas 7
  pases: descartado 8, listo 5, vendido 19
  ventas: anulada 1, pagada 11, pendiente_pago 8 · abonos que exceden el total 0 · números de comprobante repetidos 0
  órdenes: cancelada 1, entregada 11, enviada 5, lista 3 · atrasadas 3 · listas sin avisar 2 · entregadas sin fecha 0
  monturas bajo el mínimo 7 · stock negativo 0 · otras ópticas sin cambios (9 tablas)
↩ ENSAYO terminado: ROLLBACK, no se escribió nada.
Comprobación posterior: la Óptica Demo tiene 0 pacientes (debe ser 0).
```

*(La salida completa se reproduce corriendo el ensayo; los conteos varían un poco con la hora de ejecución porque las citas de hoy dependen del reloj.)*
