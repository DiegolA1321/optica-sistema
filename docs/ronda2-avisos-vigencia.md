# «Requiere tu atención»: cada aviso, su vigencia y qué lo resuelve (PROPUESTA — pendiente de aprobación de Diego)

Pedido (reunión del 20 oct., punto 16 de la Ronda 2): cada aviso tiene una vigencia y la acción «Descartar» con motivo, que lo saca de la lista y queda registrado. Esta tabla lista **todos** los avisos que hoy existen en el sistema (Inicio, módulos, CRM, campanita y superadmin) y propone para cada uno cuánto vive, qué lo resuelve y si se puede descartar. **No se implementó «Descartar» ni las vigencias nuevas** hasta que Diego apruebe esta tabla y el SQL (`supabase/migrations/0134_citas_seguimiento_y_reglas_de_tiempo.sql`).

Criterio para decidir si un aviso se puede descartar: **se descarta lo que es una decisión de la persona** (a quién contactar, qué dejar pasar). **No se descarta** lo que es un hecho que el sistema o el paciente ya dejaron pendiente y que alguien debe resolver (dinero, una solicitud de datos personales, un paciente esperando respuesta, una ficha abierta): ocultarlo no lo resolvería. Cuando se descarta, queda quién, cuándo y por qué (tabla `avisos_descartados`, y en el seguimiento de la cita si el aviso es de una cita); se puede deshacer («Volver a mostrar»). Un descarte puede tener vigencia: pasada la fecha, el aviso vuelve si la causa sigue.

## Citas

| Aviso | Lo ve | Vigencia | Qué lo resuelve | ¿Descartar? |
|---|---|---|---|---|
| **Atención abierta de un día anterior** | Administrador, recepción, optómetra (las suyas) | Hasta el cierre de la jornada de ese día: la regla del servidor la pasa a «No efectuada» («La atención se inició y no se terminó») y de ahí pasa a «Contactar al paciente» | Guardar la ficha, «Dejar de atender», o el cierre de la jornada | **No**: es una ficha abierta; el sistema la cierra solo |
| **Controles sin agendar** | Administrador, recepción | 60 días desde la fecha del control recomendado (después es «control vencido» en Pacientes) | Agendar el control, o que el paciente ya tenga otra cita activa | **Sí** · «El paciente no quiere control», «Se controla en otro lugar», «Otro» · vuelve a los 60 días si sigue sin cita |
| **Citas por reasignar por ausencia** | Quien puede reasignar | Hasta la fecha de esa cita | Reasignar la cita, quitar la ausencia o cancelar la cita | **No**: se resuelve reasignando |
| **Contactar al paciente** *(reemplaza «Citas por reagendar»)* | Administrador, recepción | **30 días** desde la fecha de la cita; luego deja de aparecer y su seguimiento dice «Sin seguimiento» | Reagendar (la cita nueva hereda el borrador de la ficha), que el paciente se atienda, o descartar | **Sí** · «El paciente no quiere reagendar», «Ya se atendió en otro lugar», «No se pudo contactar», «Otro» · permanente |

## Pacientes

| Aviso | Lo ve | Vigencia | Qué lo resuelve | ¿Descartar? |
|---|---|---|---|---|
| **Paciente de la web con los datos sin verificar** | Administrador, recepción | Mientras tenga una cita abierta; sin cita y pasados 60 días deja de mostrarse (la marca queda en su ficha) | «Verificar datos (registro web)» | **No**: es requisito para atenderlo |
| **Pidió eliminar su cuenta** | Administrador | Hasta decidir (es una solicitud sobre sus datos personales) | Eliminar al paciente o rechazar la solicitud | **No**: debe resolverse, no ocultarse |
| **Control vencido** | Administrador, recepción, optómetra (sus pacientes) | Igual que «Para contactar» del CRM (visita en el último año); solo los que hoy toca contactar | Agendar o contactar desde el CRM | **Sí** · «No volverá», «Se controla en otro lugar», «Otro» · vuelve a los 90 días si sigue vencido |
| **Cambió su contacto desde el portal** | Administrador, recepción | Hasta marcarlo «Visto»; a los 14 días se retira solo | «Visto» (ya existe) | Basta «Visto» (es informativo) |
| **Pidió sus medidas de montaje** | Administrador, recepción, optómetra | Hasta responder (hay un paciente esperando) | «Enviar medidas» o «Agendar toma de medidas» | **No** |
| **Registrado sin ninguna consulta** | Administrador, recepción | 90 días desde el registro | Su primera consulta, o una cita agendada | **Sí** · «Registrado solo para el portal», «Duplicado», «No vendrá», «Otro» · permanente |
| **Cumpleaños cercano** | Administrador, recepción | Del día del cumpleaños hasta 3 días después | «Saludar» (queda el contacto en el CRM) | **No**: caduca solo |

## Ventas

| Aviso | Lo ve | Vigencia | Qué lo resuelve | ¿Descartar? |
|---|---|---|---|---|
| **Pago por transferencia por verificar** | Administrador, ventas | Hasta revisar el comprobante | Aprobar o rechazar el pago | **No** (hay dinero de por medio) |
| **Pidió lentes nuevos desde su portal** | Administrador, ventas | 30 días (después cuenta como «espera su venta») | Tomar la solicitud / vender | **Sí** · «No concretó», «Compró en otro lugar», «Otro» · permanente |
| **Espera su venta hace más de 30 días** | Administrador, ventas | Los primeros 30 días en Ventas; **a partir de ahí pasa al CRM («Para contactar» · «Recibió su diagnóstico y no ha comprado»)** (decisión D8, Ronda 4) | Vender, «No compró» o contactarlo | **Sí**, en el CRM |
| **Orden de laboratorio lista sin avisar** | Administrador, ventas | Hasta avisar al paciente | «Avisar» o entregar | **No** (un paciente espera sus lentes) |
| **Orden atrasada** | Administrador, ventas | Hasta recibirla | Recibir la orden o cambiar su fecha prometida | **No** |
| **Venta con saldo** | Administrador, ventas | Hasta cobrar el saldo | Abono completo o anulación de la venta | **No** (es dinero) |

## Inventario

| Aviso | Lo ve | Vigencia | Qué lo resuelve | ¿Descartar? |
|---|---|---|---|---|
| **Producto con stock bajo** | Administrador, ventas, inventario | Hasta que el stock supere el mínimo | Reabastecer, cambiar el mínimo o descontinuar | **Sí** · «No se repondrá», «Se repone en otra fecha», «Otro» · vuelve a los 30 días si sigue bajo |

## CRM, campanita y superadmin

| Aviso | Lo ve | Vigencia | Qué lo resuelve | ¿Descartar? |
|---|---|---|---|---|
| Toca volver a contactar hoy (CRM) | Quien contacta | El día elegido | Registrar el contacto | Ya existe «volver a contactar el…» (posponer) |
| Cumpleaños hoy sin saludar (CRM) | Quien contacta | El día | Saludar | No: caduca solo |
| Contacto de días anteriores sin resultado anotado (CRM) | Quien contacta | 7 días | Registrar el resultado | No |
| Respuesta del soporte a tu consulta | Quien escribió | Hasta abrir la consulta | Abrirla / «Marcar leída» | «Marcar leída» |
| Consulta del personal que espera tu respuesta | Administrador | Hasta responder o resolver | Responder, resolver o escalar | No |
| Oferta de ayuda del soporte | Administrador | 30 días (límite que ya valida el servidor) | Abrir la conversación o «No usamos este módulo» | «No usamos este módulo» (ya existe, se puede deshacer) |
| Aviso del sistema sin leer | Administrador | Hasta marcarlo leído o hasta su fecha | «Marcar leído» | «Marcar leído» |
| Aviso del administrador al personal | Cada destinatario | Hasta su fecha de vencimiento o hasta marcarlo leído | «Marcar leído» | «Marcar leído» |
| Consulta urgente abierta / consulta que espera respuesta (superadmin) | Superadmin | Hasta responder o resolver | Responder / resolver | No |
| Módulo sin uso en 30 días (superadmin) | Superadmin | Ventana móvil de 30 días | Que se use, o «No usamos este módulo» de la óptica | Ya existe (decisión de la óptica) |
| Permiso de acceso del soporte activo (superadmin) | Superadmin | 24 h a 7 días, o hasta revocarlo | Vence o se revoca | No |
| Componente lento o caído (superadmin) | Superadmin | Hasta que se recupere | Se recupera solo | No |

## Decisiones que se le piden a Diego

1. ¿Se aprueban **qué se puede descartar** y las **vigencias** de las tablas? (Lo marcado «No» se resuelve, no se esconde.)
2. ¿Los **motivos de descarte** son una lista fija por aviso (como se propone, para poder agrupar en Reportes) con «Otro» + detalle opcional?
3. Un **descarte con vigencia** (stock bajo 30 días, control vencido 90 días, controles sin agendar 60 días) vuelve solo si la causa sigue; los demás son permanentes. ¿Está bien?
4. La atención que quedó en espera (el paciente llegó y nunca se atendió) también pasa a «No efectuada» al cierre de la jornada, con el motivo «El paciente llegó y no fue atendido» (no estaba en la lista; evita que quede «En espera» para siempre).
