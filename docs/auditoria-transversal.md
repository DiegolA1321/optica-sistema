# Auditoría transversal por perfil (16 oct. 2026)

Solo se revisó: **no se corrigió nada**. Contra `docs/principios-diseno.md` (reglas numeradas "R…") y lo que pidió Diego.

## Cómo se hizo (y qué no se pudo ver)

- **Recorrido automático de solo lectura** (Playwright, 1366×768) con sesiones reales: cada módulo y cada pestaña, más los detalles (cita, producto, perfil del paciente) y los enlaces del Inicio. Una guardia cancelaba cualquier escritura a tablas (no hubo ninguna; solo dejó pasar las funciones de lectura). Al entrar como superadmin a una óptica, la guardia bloqueó las dos escrituras de bitácora que esa entrada hace (`logs_optica`, `auditoria`), así que no quedó rastro.
- **Ópticas:** Demo (`qu7u2j`) con Administrador, Optómetra, Recepción y Ventas; óptica de pruebas (`v8twzq`) con su administrador; óptica vacía (`3pldf1`) con su administrador; panel del superadmin; páginas públicas en escritorio y celular (390 px).
- **Lo que NO se pudo ver, y por qué:**
  1. **Rol propio con permisos parciales:** ni en la Demo ni en la óptica de pruebas existe uno (solo los tres predefinidos). Crear uno era escribir. Probé *simular* "solo ver" cambiando en el navegador la respuesta de `mis_permisos`: la mitad de la pantalla lo obedeció (se ocultaron "Nueva venta", "Agregar producto", "Conteo físico") y la otra mitad no (el menú y el CRM siguieron como Ventas), así que esa prueba **no es concluyente**. Lo de esta sección sale de leer el código y está marcado "(código)".
  2. **Portal con un paciente con compras y factura electrónica:** no hay cuenta de portal utilizable. La cuenta `paciente@gmail.com` de mis notas ya no existe; las únicas con cuenta son "Diego alarcon" (Demo, 0 compras, sin clave conocida) y una de la óptica real Solna (no se toca). El portal se revisó por código y por sus pruebas. **Necesito de Diego una cuenta de portal con compras o su permiso para crear una en la óptica de pruebas.**
  3. Celular: solo las páginas públicas (sin desbordamiento horizontal a 390 px).
- Importancia: **alta** = el perfil ve o puede intentar lo que no le corresponde, o un dato que lleva a decidir mal; **media** = incumple una regla de forma visible o un número no coincide; **baja** = pulido.

## Resumen: lo más importante

| # | Importancia | Dónde | Qué |
|---|---|---|---|
| T1 | **Alta** | Citas › detalle de la cita (todos los perfiles sin "citas: editar") | Ventas (citas "solo ver") ve **Editar cita** y **Cancelar cita**; el código tampoco condiciona Agendar otra cita, Dejar de atender, No asistió ni Cobrar. |
| T2 | **Alta** | Usuarios y permisos | Optómetra, Recepción y Ventas muestran en ámbar **"Tiene administración delegada (Soporte y/o Configuración)"**; desde la comunicación interna eso es falso: Soporte "ver, crear" solo les deja escribir a su administrador. |
| T3 | Media | Óptica nueva | Todo catálogo nuevo nace **sin tildes** ("Adaptacion de Lentes", "Garantia / Ajuste", "Miopia", "Sin alteracion refractiva"); la reserva pública y Reportes los muestran así. La Demo se corrigió con un script; las nuevas no. |
| T4 | Media | Óptica nueva › Registro de actividad | La óptica vacía ya trae al menos 5 entradas que su administrador no hizo ("Sistema cambió los permisos de un rol…", de la migración 0115). |
| T5 | Media | CRM y Pacientes del optómetra | Mismo módulo, otros números que Recepción/administrador (Para contactar 7 vs 9; Control sin agendar 0 vs 1) sin decirlo en pantalla; Total/Bien corregidos sí coinciden. |
| T6 | Media | Todo el sistema | **234 líneas de código con texto de 10–11,5 px** (R41 prohíbe bajar de 12). Se ven en el Inicio, Usuarios, Configuración, Mi horario, CRM y Superadmin. |
| T7 | Media | Superadmin › Resumen | "Asistentes 56" cuenta desactivados (7 activos); "Pacientes atendidos en la red 78" es el total registrado (41 con consulta) y repite la tarjeta "Pacientes 78". |
| T8 | Baja | Superadmin | "acciónes" (con tilde de más) en 4 lugares. |

Lo que **sí** quedó bien en todos los perfiles: sin desplazamiento horizontal en ningún módulo ni en las páginas públicas (a 1366 y 390 px); montos y fechas con el formato único (la única excepción es "$0" en un texto de Configuración); Recepción, Ventas y Optómetra **no ven costos, margen ni rotación** en Inventario ni en Reportes (el servidor ya no los envía); los números de "Requieren atención" coinciden entre el Inicio y la cabecera de cada módulo en los cuatro perfiles; los enlaces "Abrir en …" del Inicio del optómetra y de Ventas llevan a pantallas que pueden abrir y con el mismo número; las listas vacías de la óptica nueva dicen qué pasa y ofrecen una acción (con las salvedades de abajo).

---

## 1. Administrador (Demo y óptica de pruebas)

Casi todo se revisó antes; esta pasada lo confirma. Menú completo (11 entradas), sin errores de consola, sin desbordes.

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| A1 | Usuarios y permisos | Ver T2: el aviso ámbar sale en las tres tarjetas del personal, con texto de 11 px. | R2, R3, R41 | Alta |
| A2 | Usuarios y permisos | Cada rol dice "Mi horario · solo ver", pero esas personas editan su propio horario y ausencias (la ayuda del permiso lo dice: "edita su propio horario"). El resumen contradice lo que pueden hacer. | R2 | Baja |
| A3 | Inicio · Mi horario · Usuarios · Configuración | Textos de 10–11 px: etiquetas "Atendidas / No asistieron / Pendientes / Canceladas", insignia del rol, "Según el horario general", "Hoy", L M X J V S D, "· ver, crear, editar", notas de Configuración › Página pública (10 px). | R41 | Media |
| A4 | Configuración › Catálogos | La frase "incluso a $0 … cuenta como $0" no usa el formato único ("$0.00"). | R12 | Baja |
| A5 | Soporte | Sin hallazgos: pestañas en el orden pedido (Consultas del personal · Soporte del sistema · Avisos · Ayuda). | — | — |

## 2. Optómetra (alcance propio)

Menú: Inicio, Citas, Pacientes, Ventas, Inventario, CRM, Mi horario, Reportes (Resumen, Citas, Clínico, Laboratorios), Soporte (Mis consultas · Avisos · Ayuda). Ve 1 cita hoy (la suya), no ve el nombre del profesional, no ve costos.

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| O1 | CRM y Pacientes | Con "consultas: propio", el CRM calcula con sus consultas: "Para contactar 7" (admin y Recepción 9), "Control próximo (1)" vs (3), "Fidelización 34" vs 35. En Pacientes: "Visitas recientes (15)" vs 16 y "Control sin agendar (0)" vs (1), pero "Total 41 · Bien corregidos 25 · Requieren ajuste 6 · Sin consulta 7" son idénticos a los del administrador. Nada en pantalla dice qué cifras son "las suyas" (el Inicio sí dice "de tus pacientes"). | R2, R5, R7 | Media |
| O2 | Citas (código) | **"Cobrar"** (tarjeta y detalle de una cita con cobro pendiente) no pregunta por "ventas: crear" (`Citas.jsx:198-204`, `DetalleCitaModal.jsx:206`); el optómetra solo tiene Ventas "ver". Hoy no hay cobros pendientes en la Demo, así que no se vio en pantalla. | R7, R22 | Media |
| O3 | Ventas | Ve todos los comprobantes y los saldos de todos los pacientes y el botón "Exportar a Excel" de Cobros y saldos (tiene Ventas "ver"). No es un fallo del código sino una decisión de rol: confirmar que un optómetra debe ver los saldos de toda la óptica. | R7 | Baja |
| O4 | Ventas › comprobante | Abre el detalle completo (venta, pagos, factura electrónica) con solo "Imprimir comprobante": sin acciones de escritura. Correcto para "solo ver". | R7 | — |
| O5 | Citas › detalle | Ve "Llegó", "Marcar como confirmada", "Editar cita", "Cancelar cita", "Atender": todo coincide con sus permisos (Citas: ver, crear, editar). Sin hallazgo. | — | — |
| O6 | Inicio | Con avisos de Citas en 0 la tarjeta dice "Todo en orden" y aun así ofrece "Ver todo →" (lleva a Citas). | R26 | Baja |
| O7 | Reportes | Subtítulo "¿Cómo le fue a la óptica en este período?" con la etiqueta "Solo tus consultas y tus citas": el título habla de la óptica y los números son suyos. | R2 | Baja |

## 3. Recepción

Menú sin Reportes, Usuarios ni Configuración; con Soporte. Ve "Gestionar cita", "Crear paciente", "Nueva venta", "Reasignar"; no ve "Atender", ni costos, ni "Agregar producto"/"Conteo físico".

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| R1 | Inicio / módulos | Los avisos coinciden con las cabeceras: Citas 19 (1+1+17), Pacientes 14 (2+5+7), Ventas 9 (1+8), Inventario 7. Los 4 "Ver todo" y los 9 enlaces "Abrir en …" de sus ventanas llevan a pantallas que Recepción puede abrir; en Inventario la ventana no ofrece "Reabastecer" (correcto: solo ve). Perfil del paciente: "Agendar cita", "Enviar mensaje", "Crear acceso", "Tomar datos" acordes a sus permisos. Sin hallazgo. | — | — |
| R2 | Ventas | "Tomar datos del diagnóstico" visible con Fichas clínicas "solo ver" (`roles.spec` lo da por válido). Confirmar si es la intención. | R22 | Baja |
| R3 | Inventario | Costos ocultos y sin acciones de escritura: correcto. El kárdex (pestaña Movimientos) se muestra solo lectura. | — | — |
| R4 | Mi horario | Los textos de 10 px de A3 se repiten. | R41 | Baja |

## 4. Ventas

Menú sin Reportes, Usuarios ni Configuración. Ve "Nueva venta", "Agregar producto", "Conteo físico" (Inventario: editar).

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| V1 | Citas › detalle de la cita | **Ve "Editar cita" y "Cancelar cita"** teniendo Citas "solo ver" (comprobado en pantalla con Vera Ventas Demo). El código (`Citas.jsx:2070-2088`) condiciona Llegó, Confirmar, Tomar y Reasignar, pero pasa sin condición Editar, Cancelar, Agendar otra cita, Dejar de atender, No asistió y Cobrar. Lo más probable es que el servidor rechace el cambio, pero la persona ve un botón que no puede usar. Afecta a cualquier rol propio con Citas "ver". | R7, R22 | **Alta** |
| V2 | Inicio | La tarjeta dice "Contactar" y el botón solo abre la cola "Más de 30 días" de Ventas (`Inicio.jsx:662`); no contacta a nadie. El texto no dice adónde lleva. | R42 | Baja |
| V3 | Perfil y comprobante | En el perfil del paciente Ventas ve solo "Historia clínica", "Datos" y "Tomar datos" (no "Agendar cita", "Crear acceso" ni "Enviar mensaje"): bien. En el comprobante ve "Abonar", "Corregir" y "Otra orden" (Ventas: editar); el optómetra y los roles de solo ver solo ven "Imprimir comprobante". Sin hallazgo. | R7 | — |
| V4 | Inicio · enlaces | "Abrir en Ventas · Más de 30 días (1) / Listas sin avisar (3) / Órdenes atrasadas (4) / Saldos por cobrar (6 pacientes)" y "Abrir en Inventario · Stock bajo (7)" llevan a pantallas que puede abrir y a los mismos números (1+3+4+8 ventas = 16). Sin hallazgo. | R42 | — |

## 5. Rol propio con permisos parciales (actualizado el 16 oct., revisado de verdad)

Diego pidió crearlo: rol temporal "E Dos E Rol parcial" (Citas ver, Ventas ver, Pacientes ver y crear) asignado a Vera en la óptica de pruebas, revisado con su sesión, y borrado al terminar (Vera volvió a su rol Ventas). Menú correcto: Inicio, Citas, Pacientes, Ventas (sin Soporte, CRM, Inventario ni Reportes).

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| P0 | Citas › detalle | Comprobado con el rol real: ve "Editar cita" y "Dejar de atender" con Citas solo ver (T1). | R7, R22 | Alta |
| P0b | Pacientes › ⋮ | Comprobado: "Más acciones" abre un menú **vacío** (P1). | R7 | Media |
| P0c | Pacientes y perfil | Sin Ficha clínica ver, igual ve el botón "Historia clínica" en el perfil y las tarjetas clínicas "Bien corregidos / Requieren ajuste / Sin agudeza visual". | R7 | Media |

Lo anterior, por código:

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| P1 | Pacientes (código) | El botón "⋮ Más acciones" de cada fila es incondicional (`Pacientes.jsx:1451`); sus opciones sí se filtran por permiso, así que quien solo ve abre un menú **vacío**. | R7 | Media |
| P2 | Citas | V1 y O2 aplican tal cual. | R7, R22 | Alta |
| P3 | Usuarios (al crearlo) | El aviso "administración delegada" (T2) aparecerá también en cualquier rol propio con Soporte. | R2 | Media |

## 6. Portal del paciente (actualizado el 16 oct., revisado de verdad)

Diego pidió crear en la óptica de pruebas un paciente con cuenta, una compra con abono y una factura electrónica: "E Dos E Portal Auditoria" (CV-0006, $60, abono $20, factura 001-001-000000006 con PDF y XML). Mis compras muestra bien el saldo ("Total $60.00 · Abonado $20.00 · Debes $40.00") y las descargas "Factura (PDF)" y "XML"; sin desbordes a 1366 px; el celular quedó sin revisar.

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| PO1 | Resumen | Quien debe $40 no lo lee en el Resumen: el saldo solo aparece en Mis compras. | R21 | Media |
| PO2 | Resumen / Mis citas / Mi receta | Sin citas, lo mismo se dice tres veces en el Resumen; la receta vacía dice "Aún…" en un lado y "Todavía…" en otro (W2). | R3, R26 | Baja |
| PO3 | Mis datos | "Recordatorios de salud: Avisos de su control…" está en tercera persona; el resto de la pantalla habla de "tu". | R2 | Baja |
| PO4 | Mis datos | "Descargar mis datos" aparece como título del bloque y otra vez como botón. | R3, R8 | Baja |
| PO5 | Encabezado | La palabra "Paciente" bajo el nombre mide 10 px. | R41 | Baja |

Lo anterior, por código: Pestañas: Resumen, Mis citas, Mi receta, Mis compras, Mis datos. Las listas vacías tienen mensaje ("Todavía no tienes compras registradas", "Aún no tienes una receta registrada"); `MisCompras` y `PortalPaciente` tienen pruebas.

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| W1 | Portal | 16 usos de texto de 10–11 px en `PortalPaciente.jsx`. | R41 | Media |
| W2 | Resumen y Mis citas (código) | Un paciente sin citas lee lo mismo tres veces en la pestaña Resumen: el saludo ("No tienes citas pendientes. ¿Quieres agendar una?"), la tarjeta "Próxima visita · Sin citas" y el cuadro "Próximas citas · No tienes citas pendientes" (`PortalPaciente.jsx:607, 612, 623`); en Mis citas se repite otra vez (línea 661). La receta vacía usa dos redacciones ("Aún no tienes…" en Resumen, "Todavía no tienes…" en Mi receta). | R3, R26, R2 | Baja |
| W3 | Pendiente | Mis compras con facturas (descarga, saldo, abonos) y factura electrónica: **sin ver**. Falta la cuenta. | — | — |

## 7. Superadmin (y entrada a una óptica como administrador)

Pestañas: Resumen, Ópticas, Leads, Soporte, Actividad, Superadmins. Sin desbordes ni errores.

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| S1 | Resumen / Actividad / Superadmins | "7 acciónes", "4 acciónes", "3 acciónes", "28 acciónes registradas": la palabra es "acciones". | ortografía | Baja |
| S2 | Resumen | "Asistentes 56 en 5 ópticas": la base tiene 56 cuentas de asistente pero **7 activas** (las otras 49 son pruebas desactivadas). El número cuenta gente que ya no trabaja. | R5 | Media |
| S3 | Resumen | "Pacientes atendidos en la red 78" es el total de pacientes registrados; con consulta hay 41. Además repite el 78 de la tarjeta "Pacientes". | R2, R3, R5 | Media |
| S4 | Resumen | El bloque "Estado del sistema 100% · 5 activas · 0 suspendidas" repite las tarjetas Activas y Suspendidas de arriba. | R3, R24 | Baja |
| S5 | Resumen | "Estado de Supabase: Lento · 1431 ms" nombra al proveedor técnico y no ofrece qué hacer. | R17 | Baja |
| S6 | Textos | Etiquetas de 10, 10,5, 11 y 11,5 px ("Superadministrador", "TÚ", "Hoy", fechas de Leads). 48 usos en `SuperadminPanel.jsx`. | R41 | Media |
| S7 | Entrar a una óptica | La franja "Estás dentro de QA Test Claude como superadmin — cualquier acción queda registrada" y "Salir y volver a Superadmin" funcionan; el menú y los módulos son los del administrador. Dentro, Soporte ofrece "Soporte del sistema" (escribirse a sí mismo) y Usuarios lista 53 personas, 49 desactivadas de pruebas. | R7 | Baja |

## 8. Páginas públicas (inicio de sesión, reserva, página de la óptica, venta del sistema)

Escritorio y celular, sin desbordes ni errores de consola (un error de red `ERR_NETWORK_CHANGED` aislado).

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| PU1 | Página de venta | La maqueta de la agenda dice "Miércoles 26 de agosto" fijo (hoy es viernes 16 oct.). Es decoración, pero parece una fecha real. | R12 | Baja |
| PU2 | Reserva de una óptica nueva | Motivos "Adaptacion de Lentes", "Garantia / Ajuste" (ver T3). La Demo los muestra bien. | R2 | Media |
| PU3 | Reserva | Sin hallazgo en el flujo (pasos, permisos de mensajes, cédula/nacimiento). | — | — |

## 9. Óptica nueva y vacía (`3pldf1`)

Los 11 módulos cargan sin errores. Lo que dicen las pantallas vacías:

| Id | Módulo | Qué pasa | Regla | Imp. |
|---|---|---|---|---|
| E1 | Catálogos (T3) | Motivos y diagnósticos sin tildes desde el primer día. | R2 | Media |
| E2 | Inicio › Registro de actividad (T4) | Trae "Sistema cambió los permisos de un rol — Optómetra/Recepción/Ventas" (15 oct., 09:15 PM) y "Diego Alarcón creó un rol…" (8 oct.). Es lo primero que lee el dueño de una óptica sin haber hecho nada. | R40 | Media |
| E3 | Inicio | Las cuatro tarjetas "Todo en orden · Nada pendiente en esta área · Ver todo →" no guían: no dicen qué configurar primero (horario, logo, equipo). "Ver todo" repite el menú lateral. | R17, R26 | Baja |
| E4 | Citas | "Hoy no hay citas · Ver esta semana" en una óptica que no tiene ninguna cita: el enlace lleva a nada. Debería decir "Todavía no hay citas" y ofrecer "Gestionar cita". El Inicio dice "Hoy no hay citas." sin acción. | R17, R26 | Media |
| E5 | Pacientes | Con 0 pacientes se muestran el buscador, "Filtrar", las cuatro tarjetas en 0 y los filtros "Visitas recientes (0) · Pagos pendientes (0) …" encima del mensaje "Aún no hay pacientes registrados · Crear el primero". | R25, R34 | Media |
| E6 | Inventario | "Conteo físico" disponible con 0 productos; "Sin venderse en 90 días: 0 — Todo se está moviendo" sin ningún producto. | R15, R17 | Baja |
| E7 | Reportes | El mismo cartel "Todavía no hay datos · Registrar el primer paciente" se repite arriba de cada una de las 6 pestañas, incluso en Inventario (donde la acción correcta es agregar productos) y debajo vienen las tarjetas en cero y los 4 filtros. | R3, R26 | Media |
| E8 | Soporte | Con 0 personal: "Tu personal todavía no te escribió" y "Publicar un aviso al personal". Aceptable. | — | — |
| E9 | Ventas, CRM, Soporte (resto) | Mensaje y acción presentes ("Registrar la primera venta", "Registrar el primer paciente", "Ver los comprobantes"). Sin hallazgo. | — | — |

---

## Pendiente de confirmar con Diego

1. Una cuenta de portal con compras y factura electrónica (o permiso para crearla en la óptica de pruebas).
2. Si se quiere ver un rol propio de verdad: permiso para crear uno en la óptica de pruebas.
3. Decisión de rol: ¿el optómetra debe ver comprobantes y saldos de toda la óptica (O3) y "Tomar datos del diagnóstico" en Recepción (R2)?
