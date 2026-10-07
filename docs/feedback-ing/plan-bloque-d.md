# Plan del Bloque D: roles, usuarios e Inicio por rol

Rama: `bloque-d` (creada desde `prioridad-1`). Fuentes: secciones 4 y 5 de `requisitos-reunion-29sep.md` (R46 a R56), secciones 3.6, 3.7 y 6.4 de `docs/vision-sistema.md` y los pendientes anotados en `plan-prioridad-1.md`.

**Estado (7 oct.):** Bloque D terminado. Migraciones 0090 a 0093 aplicadas y verificadas contra la base real; pantallas de Roles y Usuarios, selector de vista, Inicio por rol y cola de ventas en el Inicio hechos. Quedan fuera del bloque, por decisión: la verificación de correo (depende del dominio en Resend) y las cuentas de la Óptica Demo, que crea Diego desde Usuarios.

---

## 1. Análisis de brechas (R46 a R56)

| Req. | Qué pide | Estado | Evidencia en el código y la base |
|---|---|---|---|
| R46 | Separar Roles de Usuarios; al crear un usuario se elige su rol, con vista previa | **Pendiente** | `Usuarios.jsx` mezcla todo: cada persona lleva sus propias casillas (`permisos` jsonb de booleanos en `perfiles`) y una etiqueta de texto libre (`etiqueta_rol`). No existe la entidad "rol". |
| R47 | Roles predefinidos editables y no eliminables; roles propios eliminables | **Pendiente** | `etiqueta_rol` es solo un texto; no hay plantillas ni "Optómetra"/"Asistente" con permisos ya armados. |
| R48 | Permisos por nivel (ver, crear, editar, eliminar) | **Pendiente** | Hoy cada módulo es sí/no (`CATEGORIAS` en `Usuarios.jsx:42-70`). En la base, `tiene_permiso_modulo()` (0034) da lectura **y** escritura completas si el módulo está en true, y las políticas de escritura son `FOR ALL`. No se puede decir "ve el inventario pero no lo modifica". |
| R49 | Alcance de los datos: el optómetra ve sus pacientes y su horario; los reportes globales son de quien tenga ese permiso | **Parcial** | Un optómetra que no es admin entra a "Hoy" en Citas (`Citas.jsx:360`), ve "Mi agenda" y no ve ingresos ni conversión (`Reportes.jsx:96`, `:353`). Pero **todas** las citas y consultas de la óptica le llegan al navegador y los reportes cuentan todo: es un filtro de pantalla, no de datos. Las consultas guardan `profesional_nombre` (texto), no un id, y no se puede filtrar bien "las suyas". |
| R50 | Más de un perfil por persona y cambio de vista desde el menú | **Parcial** | Un administrador con `es_optometra` ve su bloque "Mi agenda" **además** de la vista de gestión (`Inicio.jsx:699`); no hay selector ni cambio de vista, y un asistente no puede tener dos perfiles. |
| R51 | Cédula única, correo obligatorio, verificación por correo | **Parcial** | Cédula: obligatoria en cuentas nuevas y validada en la base (0082, `perfiles_valida_cedula`). Correo: obligatorio y con formato validado en `Usuarios.jsx`. **Verificación: no existe.** Las 8 cuentas de Auth están confirmadas sin verificar: la opción "Confirm email" está apagada. |
| R52 | Tarjetas coherentes (todas totales, o todas "hoy") | **Pendiente** | La fila superior de `Inicio.jsx:224-256` mezcla un total ("Registrados en la base de datos"), un "hoy" ("citas para hoy") y una alerta ("alertas de stock bajo"). |
| R53 | Administrador: totales y citas atendidas, no atendidas, canceladas y pacientes sin atender | **Parcial** | Hay total de pacientes y "En atención ahora"; faltan citas registradas (total), atendidas / no atendidas / canceladas, y pacientes sin atender. |
| R54 | "10 productos con stock bajo", no "alertas"; sin repetirlo | **Pendiente** | El stock bajo aparece dos veces: en la tarjeta ("alertas de stock bajo") y en el bloque "Reabastecimiento" ("N alertas", `Inicio.jsx:644`). |
| R55 | Atajos que abren la acción directa | **Hecho** | Registrar paciente, Agendar cita y Añadir producto abren la acción en un clic (`Inicio.jsx:224-256`). |
| R56 | Cada rol ve en Inicio lo suyo; el optómetra, sus citas de hoy | **Parcial** | Solo existe una vista especial (optómetra no administrador). No hay Inicio para recepción ni para quien vende, y un administrador que también atiende ve la vista de gestión completa con totales y stock. |

### Pendientes anotados en el plan de la prioridad 1 y en la visión

| Pendiente | Origen | Estado |
|---|---|---|
| Desactivar usuarios en lugar de eliminarlos | Decisión 7 de `plan-prioridad-1.md` | **Pendiente**: hoy "Eliminar" borra la cuenta (`Usuarios.jsx:298`, función `eliminar-cuenta-auth`), y con ella el nombre en "Asignado a" / "Atendido por" de sus citas (`on delete set null`, 0083). |
| Selector "Asignado a" sin desactivados (los nombres siguen en las citas viejas) | Decisión 7 | **Pendiente**: `equipo_optica()` no devuelve el estado de la cuenta. |
| Misma regla de contraseña en todas las formas de crear cuentas | `vision-sistema.md` 3.6 | **Pendiente**: `Usuarios.jsx` exige 8 caracteres con letras y números (`esClaveSegura`); en `SuperadminPanel.jsx` cuatro formularios aceptan 6 (`:580`, `:1232`, `:1619`, `:1691`: cambiar clave, crear óptica, segundo administrador, superadmin) y el portal del paciente también (`PortalPaciente.jsx:349`). |
| Permiso "eliminar" de Pacientes para la anonimización | Nota del Bloque D en `plan-prioridad-1.md` | **Pendiente**: hoy `anonimizar_paciente` exige `rol = 'admin'`. |
| Mover la cola de ventas y las órdenes al Inicio de quien vende | Decisión 12 de `plan-prioridad-1.md` | **Pendiente**: viven en Pacientes y el contador en el menú. |
| Cuentas de optómetra y recepcionista de la Óptica Demo | `vision-sistema.md` 3.6 | **Pendiente**: la Óptica Demo solo tiene su administrador. |
| "Ver como este rol" | `vision-sistema.md` 3.6 ("más allá") | Propuesto (paso D2). |

### Hallazgos que cambian el diseño
1. **La interfaz y la base no coinciden en el valor por defecto.** `Dashboard.jsx:151` muestra un módulo si `permisos[modulo] !== false` (si falta la clave, se ve); `tiene_permiso_modulo()` lo niega (`coalesce(..., false)`). Hoy no afecta a nadie porque el único asistente tiene todas las claves escritas, pero el modelo nuevo debe tener una sola regla: **lo que no está concedido, no se tiene**.
2. **"Quien vende" no existe como permiso.** Las políticas y funciones de ventas (`facturas_venta`, `pases_a_venta`, `abonos_factura`, `ordenes_laboratorio`, `optica_de_vendedor()`) deciden con "inventario **o** pacientes **o** consultas". Hace falta un módulo propio, **ventas**.
3. **Los permisos son también de seguridad, no solo de pantalla** (0034, 0074): cualquier cambio debe hacerse en la base, y la interfaz solo lo refleja.
4. **Hay lecturas que no se cortan al desactivar a alguien.** Varias políticas de lectura no comprueban "óptica activa" (`disponibilidad`, `respuestas_satisfaccion`, `notificaciones_enviadas`, `logs_optica`, `solicitudes_eliminacion_paciente`, `facturas_venta_lineas`, adjuntos de consultas en storage). Es el mismo hueco que ya existe para una óptica suspendida; se cierra en 0091.
5. **`es_optometra` es un interruptor suelto** (lo cambia el superadmin en un administrador y el administrador en un asistente). Con roles debe derivarse de ellos: si algún rol de la persona "atiende pacientes", es optómetra.

---

## 2. Diseño

### 2.1 Modelo
- **Rol** (por óptica): nombre, descripción, permisos por módulo y nivel, alcance de datos, si atiende pacientes y qué Inicio muestra.
- **Predefinidos** (Optómetra, Recepción, Ventas): se pueden editar y **restaurar a sus valores originales**, no eliminar. **Propios**: los crea el administrador y se pueden eliminar si nadie los usa.
- **Persona ↔ roles**: una persona puede tener varios roles; sus permisos **se suman** y el alcance es **el más amplio**.
- **Administrador de la óptica** (`perfiles.rol = 'admin'`): siempre tiene todo. "Administrador" es una **vista**, no un rol editable. Gestionar usuarios y roles sigue siendo solo del administrador.
- Los booleanos de `perfiles.permisos` quedan como **respaldo** solo para una persona sin ningún rol (la migración le da un rol a cada asistente).

### 2.2 Módulos y niveles
| Módulo | Niveles | Notas |
|---|---|---|
| Pacientes | ver, crear, editar, **eliminar** | "eliminar" = anonimizar (reemplaza el chequeo `rol = 'admin'` de `anonimizar_paciente`) |
| Ficha clínica | ver, crear, editar | Sin eliminar: las fichas no se borran |
| Citas | ver, crear, editar | Sin eliminar (R17: cancelar, no borrar) |
| Ventas (nuevo) | ver, crear, editar, eliminar | crear = vender y proformas; editar = abonos, órdenes y estados; eliminar = anular ventas |
| Inventario | ver, crear, editar, eliminar | |
| CRM | ver, crear, editar, eliminar | |
| Reportes | ver | El alcance decide si ve todo o solo lo suyo |
| Mi horario | ver, editar | Editar los horarios **del equipo** sigue siendo del administrador |
| Mensajes | ver, crear | Administración delegable |
| Configuración | ver, editar | Administración delegable |

Cualquier nivel implica "ver". La matriz de la pantalla de Roles es módulos por filas y Ver / Crear / Editar / Eliminar por columnas.

### 2.3 Roles predefinidos
| | Optómetra | Recepción | Ventas |
|---|---|---|---|
| Atiende pacientes | Sí | No | No |
| Pacientes | ver, crear, editar | ver, crear, editar | ver |
| Ficha clínica | ver, crear, editar | **ver** | **ver** |
| Citas | ver, crear, editar | ver, crear, editar | ver |
| Ventas | ver | ver, crear, editar | ver, crear, editar |
| Inventario | ver | ver | ver, crear, editar |
| CRM | ver | ver, crear, editar | ver |
| Reportes | ver (solo lo suyo) | — | — |
| Mi horario | ver, editar | ver | ver |
| Alcance | citas, consultas y reportes: **propio** | todo | todo |
| Inicio | Optómetra | Recepción | Ventas |

### 2.4 Alcance de los datos (R49)
- Por rol y solo para **citas, consultas y reportes**: "todo" o "propio".
- **Propio** en citas = asignadas a mí, atendidas por mí, **o todavía sin asignar** (así una cita sin responsable no queda invisible para todos).
- **Propio** en consultas = las que yo atendí. Requiere una columna nueva `consultas.profesional_id` (hoy solo hay el nombre), con relleno de las existentes por nombre.
- Reportes se calcula sobre lo que la persona puede ver, por lo que queda acotado solo.
- Los pacientes **no** se acotan: son compartidos (recepción agenda a cualquiera).
- Se hace cumplir en la base (políticas de lectura), no solo en pantalla. Paso 0092.

### 2.5 Varios roles y cambio de vista (R50)
- La persona ve en el menú de usuario un selector **"Vista: Administrador / Optómetra"** (solo si tiene más de una). La elección se recuerda en el navegador.
- La vista decide: qué ítems del menú, qué Inicio, y el alcance que se aplica a Citas y Reportes (en la vista Optómetra, solo lo suyo).
- **La vista no es una frontera de seguridad:** la base aplica la suma de permisos y el alcance más amplio de todos los roles. Sirve para enfocarse, no para bloquear.

### 2.6 Desactivar usuarios
- `perfiles.activo` + quién y cuándo. El administrador desactiva y reactiva; no puede desactivarse a sí mismo ni a otro administrador.
- Una cuenta desactivada **pierde el acceso a los datos de inmediato** (la comprobación de "óptica activa" ya incluye a la persona) y conserva su historial.
- Al desactivar se informa cuántas citas futuras siguen asignadas a esa persona, para reasignarlas.
- "Eliminar" desaparece para el personal (se mantiene en el panel del superadmin).
- Complemento: una función de borde que bloquea la sesión de Auth de la cuenta desactivada (paso D8).

### 2.7 Contraseñas y correo (R51)
- **Una sola regla** (8 o más caracteres, con letras y números) en una función compartida, usada en los cuatro formularios del superadmin y en Usuarios; en el portal del paciente se aplica en el formulario y en la función de la base.
- Configurar la misma exigencia en Supabase Auth (requisitos de contraseña) para que valga aunque alguien llame a la API sin pasar por la pantalla.
- **Verificación por correo:** hoy apagada. La forma recomendada es **invitar**: el administrador crea la cuenta con el correo y la persona define su propia contraseña desde el enlace, con lo que además el administrador nunca conoce la contraseña. **Depende de poder enviar correo** (SMTP propio / dominio en Resend, ya pendiente). Mientras tanto se mantiene la contraseña inicial que da el administrador.

### 2.8 Inicio por rol (R52 a R56)
**Regla de coherencia:** cada fila de tarjetas habla de una sola cosa y lo dice en su título ("Totales", "Hoy", "Este mes").

- **Administrador (negocio):**
  - *Totales:* Pacientes registrados · Citas registradas · Productos en inventario (cada una con su atajo: Registrar paciente / Agendar cita / Añadir producto).
  - *Citas este mes:* Atendidas · No atendidas · Canceladas · Pacientes sin atender (cada una abre Citas con ese filtro, R18).
  - *Stock:* un solo bloque "**N productos con stock bajo**" con su lista y reabastecer en un clic; sale de la fila de tarjetas.
  - *Pendientes:* atenciones abiertas de días anteriores, órdenes por atender, solicitudes de eliminación, controles vencidos y cumpleaños.
- **Optómetra (hoy):** Mis citas de hoy · Siguiente paciente · En atención ahora · Atendidos hoy; su agenda de hoy; pendientes: atenciones abiertas, controles vencidos. Sin totales ni stock.
- **Recepción (hoy):** Citas de hoy · Por confirmar · En sala de espera · No asistieron; la agenda del día; atajos Registrar paciente y Agendar cita; cumpleaños y controles vencidos.
- **Ventas (para vender):** Listos para venta · Proformas en seguimiento · Órdenes atrasadas · Lentes listos sin avisar · Saldos por cobrar; la cola y las órdenes en lista compacta con su acción directa; "N productos con stock bajo"; atajo Nueva venta.
- **Rol propio:** el Inicio se arma con los bloques de los módulos que ese rol puede ver (citas de hoy si ve citas, pendientes de venta si ve ventas, stock si ve inventario).
- **Mover la cola y las órdenes:** pasan al Inicio de quien vende; el contador del menú sale de Pacientes y queda esperando el módulo de Ventas (Bloque E). Pacientes conserva el acceso mientras tanto. *(Cerrado en el Bloque E, 7 oct.: la cola, las órdenes y el contador viven ahora en el módulo de Ventas.)*

---

## 3. Pasos de trabajo

| Paso | Qué incluye | Base de datos |
|---|---|---|
| **D1** | Modelo de roles, permisos efectivos, desactivar, traslado de lo existente | **0090** (propuesta abajo) |
| **D2** | Pantallas: Roles (matriz con vista previa y "Ver como este rol") y Usuarios (elegir roles, desactivar); la interfaz lee `mis_permisos()` y oculta o desactiva botones por nivel; "Asignado a" sin desactivados; regla de contraseña única; `anonimizar_paciente` pasa al permiso "eliminar" de Pacientes | `anonimizar_paciente` y la regla de contraseña del portal (parte de 0091) |
| **D3** | Endurecer la base por nivel: políticas separadas por ver / crear / editar / eliminar; ventas con su propio módulo; cerrar las lecturas que no comprueban "óptica activa" | **0091** |
| **D3b** | Proceso "No asistió" que no se detiene por una hora mal escrita (la salta y avisa) y restricción "hh:mm AM/PM" en las citas | **0092** |
| **D4** | Alcance "propio": `consultas.profesional_id`, políticas de lectura de citas y consultas y de la encuesta, Reportes acotado | **0093** |
| **D5** | Selector de vista en el menú de usuario | — |
| **D6** | Inicio por rol (administrador, optómetra, recepción, ventas, rol propio) | — |
| **D7** | Cola de ventas y órdenes al Inicio de quien vende | — |
| **D8** | Cuentas de la Óptica Demo (optómetra y recepcionista); invitación por correo y bloqueo de sesión de cuentas desactivadas (necesitan correo y una función de borde) | — |

Cada migración lleva su respaldo, su SQL completo y su aprobación antes de aplicarse.

---

## 4. Riesgos y cómo nadie pierde acceso

**Qué podría romper los permisos actuales y cómo se evita:**

1. **Cambiar de booleanos a niveles.** La migración 0090 **no cambia lo que nadie puede hacer**: a cada asistente le crea un rol propio **equivalente** ("Permisos actuales") con **todos los niveles** de cada módulo que hoy tiene, y alcance "todo". Quien hoy tiene Pacientes sigue pudiendo ver, crear, editar y eliminar. Quien no tiene Mensajes ni Configuración, sigue sin tenerlos.
2. **"Quien vende".** Hoy se decide por tener inventario, pacientes o consultas. El módulo nuevo **ventas** se concede con esa misma regla, así que nadie que vendía deja de poder hacerlo.
3. **El rol predefinido Optómetra limita a "lo propio".** Aplicado de golpe, el optómetra actual perdería de vista las citas y consultas de los demás. **Por eso a nadie se le asigna el predefinido automáticamente**: Leonela (el único asistente de Óptica Solna Vision) pasa a "Permisos actuales" y el administrador decide cuándo cambiarla al rol Optómetra, con la vista previa a la vista.
4. **Administradores.** Siguen con todo. Los que ya estaban marcados como optómetra reciben además el rol Optómetra, solo para poder cambiar a esa vista.
5. **Respaldo.** Si alguna persona se quedara sin ningún rol, la base usa sus booleanos de siempre; no queda sin acceso.
6. **Orden de despliegue.** Apenas se aplique la 0090, la pantalla actual de Usuarios deja de afectar a la base (la base lee los roles). Por eso la 0090 y el código del paso D2 se entregan **seguidos**, sin una pausa en que se pueda editar permisos "en vacío".
7. **Una persona desactivada pierde el acceso de inmediato** (esta migración) y el resto de las lecturas se cierra en 0091; mientras tanto la pantalla también la saca al volver a cargar.
8. **`es_optometra` pasa a derivarse de los roles.** Una marca puesta a mano por el superadmin se recalcula la primera vez que cambian los roles de esa persona. La migración no la toca.

**Verificación hecha en simulación (transacción revertida), 53 comprobaciones:** antes y después de la migración, el asistente existente, el administrador y el administrador-optómetra tienen **los mismos módulos y ven las mismas filas** en 11 tablas; no se crea ni se borra ninguna cuenta; los roles se validan (módulo y nivel desconocidos, nombre repetido); los predefinidos no se eliminan y sí se restauran; los permisos de varios roles se suman y el alcance es el más amplio; un asistente no puede crear roles, asignarse roles ni cambiar su estado; otra óptica no ve ni toca los roles; desactivar corta el acceso a los datos y reactivar lo devuelve; un administrador puede asignarse un rol a sí mismo; eliminar una óptica elimina sus roles sin errores; sin roles se usa el respaldo.

---

## 5. Decisiones que necesito de Diego

1. **Roles predefinidos.** ¿Optómetra, Recepción y Ventas, con los permisos de la tabla 2.3? ¿Hace falta alguno más (por ejemplo "Administrador delegado")?
2. **Alcance "propio" de las citas** incluye las **sin asignar**. ¿Está bien, o prefieres que el optómetra solo vea las asignadas a él?
3. **Leonela** (único asistente): ¿queda con "Permisos actuales" hasta que la pases tú al rol que corresponda? (Es lo que propongo.)
4. **Pacientes no acotados por alcance.** ¿De acuerdo? (Recepción necesita buscar a cualquiera.)
5. **Verificación por correo:** ¿esperamos al dominio en Resend para la invitación, o la dejamos fuera del bloque?
6. **Estado de la cuenta del personal al desactivar:** además de bloquear los datos, ¿quieres que se cierre su sesión en Auth (requiere publicar una función de borde)? Propongo hacerlo en D8.

---

## 6. Migraciones del bloque

| Migración | Qué hace | Estado |
|---|---|---|
| 0090 | Modelo de roles, permisos efectivos, desactivar, traslado | Aplicada |
| 0091 | Permisos por nivel en la base, cuentas desactivadas sin acceso | Aplicada (junto con la 0090) |
| 0092 | Hora de las citas ("hh:mm AM/PM", restricción validada; la cita antigua "10:00" pasó a "10:00 AM") y proceso "No asistió" que salta las horas mal escritas y avisa | Aplicada el 7 oct. |
| 0093 | Alcance "propio" de citas (incluye las que la persona atendió aunque estén asignadas a otra), consultas y encuestas | Aplicada el 7 oct. |

## 7. Estado de los requisitos (R46 a R56)

| Req. | Estado | Cómo quedó |
|---|---|---|
| R46 Roles separados de usuarios | **Hecho** | Pestañas "Usuarios" y "Roles"; al crear un usuario se eligen sus roles con vista previa de lo que verá. |
| R47 Predefinidos editables y propios | **Hecho** | Optómetra, Recepción y Ventas (editables, restaurables, no eliminables) y roles propios (eliminables si nadie los usa). |
| R48 Permisos por nivel | **Hecho** | Ver / Crear / Editar / Eliminar por módulo, exigido por la base (0091) y reflejado en los botones. |
| R49 Alcance de los datos | **Hecho** | "Solo lo propio" en citas, consultas y reportes, exigido por la base (0093); en la vista de un rol enfoca Citas y Reportes. |
| R50 Varios roles y cambio de vista | **Hecho** | Los permisos se suman; selector de vista en el menú de usuario. |
| R51 Cédula, correo y verificación | **Parcial** | Cédula única y correo obligatorio hechos; la verificación por correo queda fuera del bloque, junto al dominio en Resend. |
| R52 a R56 Inicio por rol | **Hecho** | Administrador, Optómetra, Recepción, Ventas y rol propio; cada fila de tarjetas con un título (Totales, Citas de este mes, Hoy, Para vender); "N productos con stock bajo" una sola vez; atajos en un clic. |

Pendientes anotados en el plan de la prioridad 1: desactivar usuarios (hecho), selector "Asignado a" sin desactivados (hecho), misma regla de contraseña (hecha en pantalla; falta en la base del portal y en Supabase Auth), permiso "eliminar" de Pacientes para anonimizar (hecho), cola de ventas y órdenes en el Inicio de quien vende (hecho).

**Pendiente fuera del bloque:** contraseña mínima en las funciones de la base del portal del paciente y en los requisitos de contraseña de Supabase Auth (hoy la regla vive en la pantalla); verificación de correo (depende del dominio en Resend).
