# Requisitos del ingeniero: reunión del 20 de octubre de 2026

Fuentes: las tres partes de la transcripción (`reunion-2026-10-20/Reunion-parte1.txt`, `parte2`, `parte3`) leídas completas, y las notas de Diego por módulo (`retroalimentacion-*.pdf`, 8 archivos; su texto está recogido aquí, las capturas quedan en los PDF). Cuando algo viene de las notas de Diego y no del ingeniero, se marca **(nota)**; cuando viene del ingeniero, **(ing)**; cuando es una decisión ya tomada por Diego, **(decisión)**.

Regla de lectura (la de siempre): «podría ser» / «habría que analizar» del ingeniero es una dirección a resolver con criterio, no texto literal; «debería» / «hay que» es un requisito.

**Estado:** ESCRITO el 21 oct. 2026. Nada de esta lista está implementado salvo la Ronda 1 (sesión y guardados), que se registra en `docs/estado-actual.md`.

---

## Decisiones ya tomadas (Diego, 21 oct. 2026)

- **D1. Atender una cita de otro día.** Si el paciente llega antes de su día, se puede atender con confirmación («Esta cita es del 24 de octubre. ¿Atenderla hoy?»); la cita se mueve a hoy.
- **D2. «No asistió» pasa a llamarse «No efectuada»** en todo el sistema (Citas, perfil, Inicio, Reportes, portal, correos, exportaciones, pruebas).
- **D3. Atención iniciada y no terminada.** Pasa sola a «No efectuada» al cierre de la jornada de ese día, con el motivo automático «La atención se inició y no se terminó». Se conserva el borrador de la ficha.
- **D4. Toda cita «No efectuada» aparece en «Requiere tu atención» como «Contactar al paciente»**, con: «Reagendar» (la cita nueva hereda el borrador de la ficha, si lo hay), «Escribir por WhatsApp» (mensaje ya redactado) y «Descartar» (con motivo). A los 30 días sin atender deja de aparecer y queda en el historial como «Sin seguimiento». **No se reagenda sola.**
- **D5. Regla general de «Requiere tu atención» en todos los módulos:** cada aviso tiene vigencia y la acción «Descartar» con motivo.
- **D6. Se quita la confirmación de la cita por parte del paciente** (portal, detalle de la cita, Agenda, «Confirmada», avisos).
- **D7. Órdenes de laboratorio salen del perfil del paciente.** El estado de los lentes se muestra dentro de cada compra (En proceso, Listos, Entregados). En Ventas se simplifican a «Pedidos de lentes», con los laboratorios en un catálogo de Configuración.
- **D8. «Por vender» sale de Ventas** (Ventas muestra solo lo vendido). Esos pacientes pasan al CRM, en «Para contactar», con el motivo «Recibió su diagnóstico y no ha comprado», con WhatsApp y su proforma si la tiene. La proforma sigue visible en el perfil del paciente.
- **D9. Tarjetas de Pacientes:** total, nuevos este mes, con control vencido y con saldo pendiente.
- **D10. Gráficas de tendencia** (con la línea de la evolución) en todo el sistema: Reportes, el perfil del paciente (citas por mes, con selector de semana, mes y año) y el panel del superadmin.

## Plan de rondas (Diego)

1. **Ronda 1 — Sesión y guardados** (bloqueante). *En curso.*
2. **Ronda 2 — Citas, «Requiere tu atención» e Inicio.**
3. **Ronda 3 — Pacientes, perfil, ficha clínica y portal.**
4. **Ronda 4 — Ventas e Inventario.**
5. **Ronda 5 — Horario, Usuarios, Soporte, CRM y gráficas de tendencia.**
6. Al final: suite completa de Playwright (una sola vez), revisión de Diego y publicación (solo cuando él lo diga).

---

## 0. Transversal (bloqueante)

- **GEN-1 (nota).** El sistema «cierra la sesión sin avisar»: las pantallas siguen abiertas pero guardar, editar, crear y desactivar fallan con «Ya no tienes permiso para esta acción» y errores en inglés («permission denied for table roles», «permission denied for function desactivar_usuario»). Al cerrar sesión y volver a entrar todo funciona. Se investiga la causa real. → **Ronda 1.**
- **GEN-2 (nota).** Cualquier cambio debe reflejarse en todos los lugares donde se ve (lista, semana, mes, perfil, Inicio, Reportes, portal) y mostrar mensaje de confirmación. Lo que afecta a otro módulo debe afectarlo (venta → inventario, saldos, Reportes, perfil).
- **GEN-3 (ing).** Calma y claridad: tener claro para qué sirve cada opción antes de mostrarla al cliente, porque el cliente preguntará.
- **GEN-4 (ing).** Próximos pasos: Diego hace estos ajustes; después decide si se los muestra otra vez al ingeniero o hace la prueba directa con la óptica (explicando el flujo y anotando lo que digan, como prueba inicial). La prueba estructurada para la tesis viene después. Posibles reuniones: martes en la tarde o viernes en la tarde.
- **GEN-5 (ing).** Falta saber si el usuario final lo ve usable y qué elementos relevantes no se han considerado (experiencia de la óptica).
- **GEN-6 (nota, Inicio/todos los módulos).** «¿Hasta qué tiempo se considerará para que aparezca ahí? ¿Qué sucederá con los que no le tomemos atención en ‘Requiere tu atención’?» → resuelto en general por D5.

## 1. Citas

- **CIT-1 (nota 1, ing).** En lugar de «Semana» y «Mes» sueltos, un solo control «Calendario» que al pulsarlo despliega para elegir semana o mes.
- **CIT-2 (ing).** El filtro de rango («Este mes», «Esta semana») está duplicado con la vista (Lista · Semana · Mes) y contradice: con «Esta semana» y filtro «Este mes» no pasa nada. Decidir una sola vía o integrarlo en el filtro. Los demás filtros (Estado, Origen, Visita, Fechas, Profesional) están bien.
- **CIT-3 (nota 6, ing).** Quitar el filtro «Agendada» (no tiene utilidad, contradice la otra secuencia).
- **CIT-4 (nota 2, ing).** Las citas pendientes no muestran «Atender» (hoy solo sale «Ingresar»/«Seguir atendiendo»). Debe mostrarse el botón «Atender» en las pendientes de hoy. Al pulsar abre la ficha directamente.
- **CIT-5 (nota 3).** Aparece «Confirmar datos» en algunas citas y en otras no; no se entiende por qué. Explicar o unificar (es el caso de paciente «por registrar»; el ingeniero lo encontró útil como mecanismo de aviso, pero debe entenderse).
- **CIT-6 (nota 4, ing, D6).** Quitar la confirmación del paciente («agendada por / confirmada por»): quien agenda, irá; si no, cancela.
- **CIT-7 (nota 5, ing).** Las citas canceladas **no deben desaparecer**: se muestran en la lista, la semana y el mes con el estado «Cancelada», quién la canceló (paciente o personal) y el **motivo de la cancelación**. Si se reagenda, el panel debe decir que la cita es una **reagendada**. (Diego vio que al reagendar «se sale así», con captura: revisar.)
- **CIT-8 (nota 7, ing).** Regla de la hora: una cita de 4:00 a 4:50 pm y el paciente llega a las 4:49. Si hay otra cita después, se reagenda; si no hay, se atiende. Analizar el comportamiento completo. El ingeniero: la cita no pasa a «no efectuada» mientras su horario no terminó (cita 4:30–5:20: recién a las 5:20), **y nunca mientras esté en ejecución** (si se abre a las 5:19 no debe cerrarse de golpe). (Nota para decidir: hoy la regla es 10 min de tolerancia desde la hora de inicio; confirmar con Diego si pasa a «al terminar el horario».)
- **CIT-9 (nota 8, ing, D3).** Una atención que se dejó abierta (el ingeniero vio una abierta hace dos días): control de tiempo. Pasa a «No efectuada» (el ingeniero propuso «unas 5 horas o un día»; Diego decidió: al cierre de la jornada, con el motivo automático). No puede darse por atendida porque nunca se guardó la ficha.
- **CIT-10 (ing, D2).** «No asistió» → «No efectuada» (rojo). «Cancelada» es distinta de «No efectuada».
- **CIT-11 (nota 9, ing).** Orden de columnas/secciones en el detalle de la cita: **Paciente > Cita > Seguimiento**, con «Ver perfil» alineado en la fila del paciente. Botones del detalle: Ver perfil, Reasignar, Cancelar cita, Editar cita; la acción principal (Atender) abajo, en la esquina. «Reasignar» se queda (hoy hay un solo profesional, pero la óptica puede crecer).
- **CIT-12 (ing).** «Seguimiento» registra cuándo se agendó, cuándo se atendió, cuándo se canceló o cuándo no se efectuó (con fecha y hora), no solo «agendada/confirmada».
- **CIT-13 (nota 10).** Revisar que los estados se muestren bien (pendiente, en espera, en atención, atendida, no efectuada, cancelada).
- **CIT-14 (nota 11, D4).** «Requiere tu atención» ofrecía reagendar a quien no asistió; hay que decidir hasta cuándo aparece y qué pasa con los no atendidos → D4 y D5.
- **CIT-15 (nota 12, urgente).** Al registrar una cita no sale ningún mensaje y la cita **no se guarda**. → **Ronda 1** (comprobar si es la sesión) y arreglo.
- **CIT-16 (ing, opcional).** Al pulsar un día del calendario podría salir el modal de agendar con el día bloqueado y los horarios libres; pero «Gestionar cita» como está no complica y puede quedarse.
- **CIT-17 (ing, D1).** Atender una cita de otro día cuando el paciente llega antes: ver D1.
- **CIT-18 (nota 15, 16).** Agendar cita desde el perfil del paciente no la registra en ningún lugar; «Dejar de atender» no hace nada y hay que definir en qué estado queda la cita. → **Ronda 1** (comprobar) y arreglo.

## 2. «Requiere tu atención» (todos los módulos)

- **ATN-1 (ing).** Hoy se ve «mucho texto»: nadie lee tantas palabras. Se presenta como **tarjetas**: cada una con el número y debajo la leyenda, y «Ver todo» abre el listado detallado. No se muestran nombres de personas en la tarjeta.
- **ATN-2 (ing).** Cada módulo con pocas áreas claves:
  - **Citas:** atenciones abiertas, controles sin agendar, citas por reagendar (reemplazado por D4: «Contactar al paciente»).
  - **Pacientes:** pacientes de la web sin datos confirmados, pacientes con control vencido, solicitudes/requerimientos de pacientes en línea (p. ej. medidas de montaje).
  - **Ventas:** pacientes pendientes, órdenes de laboratorio listas sin avisar al paciente, órdenes atrasadas.
  - **Inventario:** stock bajo; opcionalmente sobrestock, sin inventariar en 90 días, unidades en stock. El umbral de «mucho» es subjetivo de cada óptica (ver INV-5).
- **ATN-3 (ing).** «Un control sin agendar»: al terminar la ficha se ofrece agendar el control; si dicen que no, queda un aviso para que la persona esté pendiente (el ingeniero lo encuentra bien). Debe poder agendarse ahí mismo.
- **ATN-4 (nota 1, D5).** Vigencia de cada aviso y «Descartar» con motivo; qué pasa con los que nadie atiende.
- **ATN-5 (D4).** «Contactar al paciente» para toda cita «No efectuada» (Reagendar con borrador heredado, WhatsApp con mensaje redactado, Descartar con motivo; a los 30 días «Sin seguimiento» en el historial; nunca se reagenda sola).
- **ATN-6 (ing).** Los avisos de Soporte también deben aparecer en el Inicio.

## 3. Inicio

- **INI-1 (ing).** Se ve muy simple: falta algo de color/énfasis en los bloques principales y totales (distintivo, no saturado).
- **INI-2 (ing).** Demasiado texto en «Requiere tu atención» → tarjetas (ATN-1, ATN-2).
- **INI-3 (ing).** Los totales (pacientes y nuevos del mes, citas y del mes, ventas y del mes, productos y nuevos del mes) están bien, con los accesos rápidos (registrar paciente, agendar cita, agregar producto).
- **INI-4 (ing).** Administrador: «Desenlace de las citas» abajo está bien (lo más importante es lo de arriba). Para el optómetra el orden es: **Desenlace de mis citas → Mi próxima jornada con citas → Requiere tu atención**.
- **INI-5 (ing).** El panel que muestra el detalle de lo seleccionado en citas es redundante con el módulo Citas: dejar el resumen de citas como está y poner un botón «Ir a Citas» junto a Hoy / Esta semana / Este mes / Todas.
- **INI-6 (ing).** Solo el administrador ve ventas y productos; el optómetra no.
- **INI-7 (ing).** Tarjeta de inventario: «Sin inventariar en 90 días» o «Unidades en stock» (sin repetir «Productos 20», que ya está arriba); «Valor de inventario» está bien.
- **INI-8 (ing).** Avisos del administrador (Soporte → Avisos) deben verse también en el dashboard.

## 4. Pacientes (lista)

- **PAC-1 (nota 2, ing).** Los tres filtros de la lista no convencen: un paciente no viene solo porque necesita lentes (puede ser prevención). Replantear qué filtros sirven.
- **PAC-2 (nota 3).** El filtro 4 «¿para qué sirve? creo que para nada» → quitarlo o justificarlo. (Ver captura 4 del PDF.)
- **PAC-3 (nota 5).** Un filtro «de alta» («¿alta de qué?») y «corrección: aumentó o no» no se entienden → revisar.
- **PAC-4 (nota 3, urgente).** Verificar que realmente funcionan: Atender ahora, Nueva venta, Restablecer clave (y entrar al portal con la nueva), Editar datos (reflejados en todos los lugares), Eliminar (se elimina en todos los lugares, incluido el acceso al portal, **con confirmación previa**). → **Ronda 1.**
- **PAC-5 (nota 12).** Al editar, no pedir campos obligatorios que no se tocan (si solo quiero cambiar el nombre). Al guardar debe haber mensaje y el cambio debe verse en todos lados (citas del paciente, lista general, etc.). Hoy no hay mensaje y no guarda nada.
- **PAC-6 (nota 13).** Al crear un paciente, ofrecer **ir al perfil o atenderlo de una vez** (llega alguien nuevo cuando no hay citas).
- **PAC-7 (nota 14).** Crear paciente no deja crear. → **Ronda 1.**
- **PAC-8 (nota 3 de pacientes, visual).** El cuadro de filtros/lista monta el scroll sobre el correo («se ve feo»); en otra pantalla algo «se rompe, se sale». Arreglar.
- **PAC-9 (D9).** Tarjetas de la lista: total, nuevos este mes, con control vencido y con saldo pendiente.

## 5. Perfil del paciente

- **PER-1 (nota 6, ing).** Quitar los ojos/graduación de la cabecera: distrae, no todos los pacientes tienen graduación, ya está en otra sección. Con eso, reorganizar los botones.
- **PER-2 (nota 6, ing).** Botones a la derecha en cuadrícula de dos en dos: **Historia clínica | Datos** y **Agendar cita | Enviar mensaje** (la nota dice «enviar datos»; el ingeniero dijo «enviar mensajes»).
- **PER-3 (ing).** Quitar «Ingresar» (hace lo mismo que «Seguir atendiendo»); dejar «Dejar de atender» arriba para cancelar rápido; quitar el bloque de «Abierto hace dos días» de arriba porque ocupa una línea de espacio y separa el resto sin necesidad. «Seguir atendiendo» está bien (nota).
- **PER-4 (nota 7, ing).** Los avisos de «cita en atención» y «cobro pendiente» pasan al **Resumen**, debajo de lo que hay (no sobre las pestañas).
- **PER-5 (ing).** Resumen: arriba los avisos (cita pendiente/en atención, cobro pendiente), luego estado de corrección, próximo control, última consulta, compras y fidelización. «Citas del paciente» y «Citas por mes» **se pasan a la pestaña Citas** (en dos bloques: conteos a la izquierda — pendientes, atendidas, no efectuadas, canceladas — y la gráfica de tendencia a la derecha; debajo el historial de citas).
- **PER-6 (nota 11, ing).** «Estado de corrección» es de optometría y no todos los pacientes van por eso: revisar qué se muestra cuando no aplica (no dejarlo vacío). «Compras/Lentes» no debe decir «lentes» (también lunas u otros productos).
- **PER-7 (ing, D10).** «Citas por mes» como **gráfico de tendencia** (no barras), con selector de **semana, mes y año**, por defecto mes o semana.
- **PER-8 (ing).** Fidelización está bien (los puntos y beneficios aún sin definir por Diego).
- **PER-9 (nota 8, ing).** La pestaña «Graduación» se llama **«Diagnóstico»**: muestra todo el diagnóstico de la última cita (no solo graduación; los pacientes sin graduación también tienen diagnóstico), con filtro por otras citas. «Comparar dos recetas» → «Comparar diagnósticos»; «Imprimir receta» → «Imprimir diagnóstico» («receta» suena a tratamiento). Hay un botón que no se entiende («Explicar al paciente»: revisar).
- **PER-10 (nota 9, ing).** En Compras, «Nueva venta» está lejos y solitario: ponerlo dentro de un bloque blanco con el listado (que no «flote» sobre el fondo).
- **PER-11 (nota 10, ing, D7).** Quitar la pestaña «Órdenes de laboratorio»: al paciente no le importa dónde se hacen los lentes; el estado va dentro de cada compra (En proceso, Listos, Entregados).
- **PER-12 (ing).** «Historia clínica» (antecedentes) se queda tal cual; el «Diagnóstico» a la vista rápida también (permite ver cómo está el paciente actualmente).
- **PER-13 (nota 15).** Agendar una cita desde el perfil debe registrarse y verse en Citas. → **Ronda 1** (comprobar).
- **PER-14 (nota 16, 17).** «Dejar de atender» no hace nada y no se sabe en qué estado queda el paciente/cita. → **Ronda 1** (comprobar) + D3/D4.
- **PER-15 (ing).** Proformas («por vender»): según D8 siguen visibles en el perfil.

## 6. Ficha clínica

- **FIC-1 (ing).** La ficha de cinco pasos: los pasos 2, 3 y 4 son partes de un mismo proceso (registrar cómo está el paciente), no secuenciales. Volver a tres pasos: (1) motivo/anamnesis; (2) examen — Agudeza visual, Refracción, Salud ocular, etc. como **bloques desplegables compactos** que el optómetra abre según lo que realmente registra; (3) diagnóstico y receta. Quitar el encabezado grande. (Interpretación a confirmar con Diego.)
- **FIC-2 (ing).** No todo debe ser obligatorio: no todas las citas llevan todos los datos; todo opcional salvo lo mínimo.
- **FIC-3 (ing).** Al **terminar la atención**, mostrar una vista previa del reporte con los botones de descargar/imprimir (antes se veía el cuadro con la impresión; hoy es opcional y se pierde).
- **FIC-4 (ing).** Poder **descargar/ver el reporte después**: desde la cita en Citas y en el perfil («Ver receta/Imprimir diagnóstico» en el detalle de la cita). Debe estar antes de presentarla a la optómetra.
- **FIC-5 (ing).** Los valores fijos de agudeza se validan con la optómetra (Diego aún no la ha mostrado). Ya anotado: «la ficha debe validarla la optómetra de la óptica».
- **FIC-6 (ing).** El resto del flujo del paciente se ve bien; solo coordinar los tres pasos.
- **FIC-7 (ing).** Ventas: «tomar datos del diagnóstico» al vender a un paciente desde Ventas (ver su último diagnóstico para sugerirle mejor) — ver VEN-9.

## 7. Portal del paciente

(No hubo notas del portal; salen de las decisiones.)

- **POR-1 (D6).** Quitar «Confirmar asistencia» y «Confirmada».
- **POR-2 (D2).** «No asistió» → «No efectuada» en Mis citas y filtros.
- **POR-3 (D7).** El estado de los lentes se muestra dentro de cada compra (En proceso, Listos, Entregados); el paciente no ve «órdenes de laboratorio».
- **POR-4 (ing, nota 10).** Al paciente solo le importa tener sus lentes, no dónde se hacen.
- **POR-5 (D1, D4).** Citas movidas a hoy o reagendadas deben verse bien en el portal.

## 8. Ventas

- **VEN-1 (nota 2, ing, D8).** Ventas muestra las ventas realizadas, no proformas ni «candidatos a vender». «Por vender» sale de aquí (va al CRM, D8). La principal es el listado de ventas: pendientes, efectuadas o pendientes de entrega.
- **VEN-2 (ing).** «Comprobantes» (los vendidos) va **primero**. Unir «Comprobantes» y «Cobros y saldos»: bajo los comprobantes, un bloque con «Ventas con saldo» y los totales; los totales cambian según los filtros aplicados.
- **VEN-3 (nota 3, ing, D7).** «Órdenes de laboratorio»: al ingeniero no lo convence. Si se conserva, simplificar a **«Pedidos de lentes»**; la lista hoy está muy desordenada; los laboratorios en un **catálogo de Configuración** («¿dónde se agregan los laboratorios?»). Mantener «órdenes atrasadas» y «listas sin avisar al paciente» como avisos (ATN-2).
- **VEN-4 (nota 4).** Dos secciones se pueden juntar «para mostrar algo muy completo» (ver VEN-2).
- **VEN-5 (nota 5).** «Nueva venta»: es raro tener que seleccionar si incluye lentes; el filtro de blanco sobre blanco no completa el color y la lupa está desalineada (debajo de donde debe ir).
- **VEN-6 (nota 5, 7).** Una venta nueva (desde Ventas o desde el perfil del paciente) debe reflejarse en el perfil del paciente, en Reportes, en el inventario (descuenta el stock) y en los saldos.
- **VEN-7 (nota 6).** Quitar «ese número» de la pantalla (ver captura del PDF; sin identificar con certeza).
- **VEN-8 (nota 7, 8, urgente).** Vender no funciona: no muestra mensaje ni hace la venta; registrar un abono da error y no se refleja en el paciente ni en los demás lados. → **Ronda 1** (comprobar).
- **VEN-9 (ing).** Al vender a un paciente desde Ventas, poder tomar los datos de su último diagnóstico para sugerirle mejor.

## 9. Inventario

- **INV-1 (nota 2, urgente).** Los cambios no muestran mensaje y **no se guardan**; sale «Ya no tienes permiso» siendo administrador. → **Ronda 1.**
- **INV-2 (nota 3, ing).** Apartado de **productos descontinuados**: verlos, reactivarlos; al agregar un producto, el sistema verifica si ya existe y en qué sección (activo o descontinuado) y ofrece darle continuidad.
- **INV-3 (nota 5).** Producto nuevo se refleja en todos los lados; descontinuado deja de mostrarse (ventas, citas, listas) y, al reactivarlo, vuelve a mostrarse. Guardar no funciona en ningún lado. → **Ronda 1.**
- **INV-4 (nota 4).** Stock: al vender baja; debe verse en Reportes. «Cualquier cosa que afecte otro módulo debe afectarlo.»
- **INV-5 (ing, nota 2).** **Stock máximo / sobrestock**, igual que el mínimo, para avisar «tienes bastante de esto», sin limitar. Editable; que sea **global** (en Configuración) además de por producto, no uno a uno. Al registrar un ingreso, avisar «sobrestock» antes de guardar.
- **INV-6 (nota 4, ing).** «Conteo físico»: más útil como **imprimir la lista de productos** para contar; analizar un «control semanal» (incluso automático). «Historial del conteo» da error hoy.
- **INV-7 (ing).** «Ajustar stock» está bien (por conteo, unidades que existen, merma, devolución al proveedor).
- **INV-8 (nota 6).** Punto 6 sin texto (ver captura); revisar el cambio de stock que hoy falla.

## 10. CRM

- **CRM-1 (ing).** Faltan tarjetas de información rápida: próximo cumpleaños, cliente más destacado, más fiel, el que más recomendó (top de cada cosa) y debajo el detalle.
- **CRM-2 (D8).** «Para contactar»: pacientes con motivo «Recibió su diagnóstico y no ha comprado», con WhatsApp y su proforma si la tiene.

## 11. Horario

- **HOR-1 (nota 1, ing).** El administrador debe poder asignar el **horario por persona**, no solo uno general (medio tiempo, tiempo completo, distintos horarios), o la opción «para todos». Selector arriba con el nombre de la persona y su rol (varias personas pueden tener el mismo rol con horarios distintos).
- **HOR-2 (nota 2).** El cambio de horario debe verse en todos lados: otros roles, la Agenda y el perfil del paciente (al abrir otra fecha).
- **HOR-3 (ing).** El horario de la óptica (el de la página pública) es distinto del de cada trabajador. El optómetra/asistente ve «su horario disponible» asignado por el administrador.
- **HOR-4 (nota 2).** «Mi horario» está raro: ¿debe llamarse así?; verificar que la información sea correcta; «No podré asistir» — ¿qué es?, ¿el personal avisa que no podrá ir?; si es así, no está implementado en los otros perfiles (optómetra, recepción, ventas) y habría que validarlo (dar o no el permiso).

## 12. Usuarios y permisos

- **USU-1 (nota 1).** Al crear un rol «ahora está feo» y con «alcance para todos»: **mal**, no todo debe estar al alcance de todos, para eso existen los roles. Rediseñar la creación de rol.
- **USU-2 (nota 1, urgente).** Crear rol da error en inglés; crear usuario no funciona; editar usuario y cambiar su rol no funciona; «Actividad» da error; desactivar da error; los demás usuarios aparecen «Sin rol». → **Ronda 1** (la causa es la sesión).
- **USU-3 (nota 3).** Solo sale «Desactivar»: definir si el desactivado puede entrar y no hacer nada, o no puede entrar; y la opción de **eliminar** (no puede ingresar nunca más con sus credenciales).
- **USU-4 (nota 4).** El sistema «cierra la sesión sin avisar… cierras sesión y abres otra vez y ya tienes todo»: investigar. → **Ronda 1.**
- **USU-5 (ing).** Roles y permisos «se vio bien como se estaban creando» (conversación anterior).

## 13. Soporte

- **SOP-1 (nota 1, urgente).** «En Soporte me sale que no tengo permisos.» → **Ronda 1.**
- **SOP-2 (nota 1, ing).** Los otros paneles (por ejemplo el optómetra) muestran las mismas opciones que el administrador: **mal**, ya se había conversado cómo debía ser. El optómetra ve solo lo suyo. → **Ronda 1** (punto 4 de Diego, en la vista de Optómetra) y revisión posterior.
- **SOP-3 (ing).** Jerarquía: el optómetra envía su solicitud al **administrador de la óptica**, y el administrador, si no lo puede resolver, la envía al **superadmin** (soporte del sistema). Puede ser en dos caminos: si la persona identifica que es un problema del sistema, también puede ir directo; pero normalmente: optómetra → administrador → superadmin.
- **SOP-4 (ing).** «Soporte del sistema» (consulta al superadmin) está bien.
- **SOP-5 (ing, ATN-6).** Los avisos de Soporte se muestran en la notificación y en el dashboard.

## 14. Reportes y gráficas

- **REP-1 (nota, ing, D10).** Las gráficas de Reportes son de barras sin desnivel visible: deben ser **gráficas de tendencia** (se ve la línea marcada de cómo van las cosas); se pueden poner barras con la línea encima. Aplicarlo en **todas** las gráficas del sistema para ser más profesional.
- **REP-2 (ing).** Reportes está seccionado (resumen, consultas por mes…) y se puede exportar: bien.

## 15. Superadmin

- **SUP-1 (D10).** Gráficas de tendencia en el panel del superadmin (con línea de evolución).
- **SUP-2 (ing).** Las consultas de soporte del sistema llegan al superadmin vía el administrador de la óptica (SOP-3).
- **SUP-3 (Ronda 1).** El superadmin no debe verse afectado por los cambios de sesión (misma garantía: sesión vencida → mensaje y ingreso).

---

## Cruce con las notas (control de completitud)

Cada punto numerado de los 8 PDF de Diego está en la lista: citas 1–12 (CIT-1…CIT-15), pacientes 1–16 (PAC, PER, CIT-18), ventas 1–8 (VEN), inventario 1–6 (INV), horario 1–2 (HOR), permisos 1–4 (USU), reportes (REP-1), soporte 1 (SOP-1/2). De la transcripción: filtros y vista de citas, estados y tiempos, seguimiento, orden del detalle, «Requiere tu atención» en tarjetas, Inicio (colores, orden por rol, panel redundante, tarjetas de inventario), perfil (botones, resumen, citas, gráfica de tendencia, «Diagnóstico»), ficha (tres pasos, reporte al terminar), Ventas, Inventario, CRM, Horario por persona, Reportes (tendencia), Soporte (jerarquía y avisos en el dashboard), Usuarios, y el plan de próximas reuniones.
