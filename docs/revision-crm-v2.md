# Revisión del CRM v2 (15 oct. 2026, rama `crm-v2`)

Comparación del módulo con lo que se pidió, con los criterios del ingeniero (`docs/feedback-ing/criterios-ingeniero.md`) y con `docs/principios-diseno.md`.
Estado: construido y probado con la base de mentira (Vitest) y visto en pantalla con la Óptica Demo; **la migración 0114 todavía no está aplicada**, así que lo que escribe en la base y la prueba de Playwright del recorrido esperan esa aprobación.

## 1. Los seis problemas del pedido

| # | Problema | Cómo quedó |
|---|---|---|
| 1 | Rankings y tareas mezclados | Las tareas viven en **Para contactar**; los rankings, en **Fidelización**, aparte. |
| 2 | Sin seguimiento | Cada contacto se anota (quién, cuándo, canal, mensaje) y se registra el resultado; "volver a contactar en N días" reaparece solo. Pestaña **Seguimiento**. |
| 3 | Solo cinco nombres | Listas completas con "Ver 30 más", buscador cuando hay más de cinco, y filtros por motivo con su número. Fidelización muestra a todos. |
| 4 | Faltan los grupos valiosos | Control que vence en 30 días, sin visitar más de 12 meses y seguimiento después de la compra (lentes entregados hace 7 a 15 días). |
| 5 | "Avisos" con lista nativa | Reemplazado por **Campañas**: grupos, plantillas con variables y envío uno por uno. Ya no hay ninguna lista nativa del navegador. |
| 6 | Sin consentimiento | Dos permisos separados, con quién y cuándo; el paciente los cambia en "Mis datos"; el servidor los exige. |

## 2. Lo pedido, punto por punto

- **Para contactar** ✔ una lista, un paciente por fila con sus motivos como etiquetas; filtros con su número; "Contactar" (WhatsApp con la plantilla) y "Registrar resultado" (agendó, no respondió, volver en N días, no le interesa, no desea mensajes); reaparecen solos; si agenda una cita, queda resuelto; "No compraron" sigue en Ventas.
- **Seguimiento** ✔ fecha, paciente, motivo, canal, resultado y quién; período y filtros; contactados, agendaron y tasa de respuesta de lo que se ve.
- **Campañas** ✔ cuatro grupos, plantillas editables, variables, envío uno por uno marcando cada envío (queda en Seguimiento), exportar la lista (Excel). **Correo: no se hizo** (espera el dominio propio, como se dijo).
- **Fidelización** ✔ rankings de puntaje, más frecuentes y más refieren, con todos los nombres.
- **Consentimiento** ✔ "Recordatorios de salud" (sí por defecto) y "Promociones" (no por defecto); en el perfil (Datos del paciente) y en "Mis datos" del portal; "No desea recibir mensajes" apaga los dos; historial inmutable de quién y cuándo. Además, el saludo de cumpleaños y el recordatorio de cita por correo ya no salen para quien no acepta recordatorios.
- **Plantillas** ✔ seis (control vencido, control próximo, cumpleaños, reactivación, después de la compra, promoción), cortas y con el nombre de la óptica.

## 3. Criterios del ingeniero

1. *Evitar pantallas vacías* ✔ cada lista vacía dice qué pasa y ofrece una acción (preparar campaña, ir a Para contactar, crear la primera campaña, registrar el primer paciente).
2. *Contexto antes de la acción* ✔ el nombre abre el perfil; "Contactar" ya trae el mensaje con el nombre y la óptica; el resultado se anota en el contacto que ya existe (no se vuelve a buscar al paciente).
3. *No duplicar información* ✔ los rankings ya no se repiten en dos listas; el saludo automático vive una sola vez (Campañas); "Plantillas" tiene un solo acceso.
4. *Estados que se mueven solos* ✔ la cita agendada resuelve el contacto; los descansos y reapariciones salen de reglas, no de que alguien se acuerde.
5. *Conservar el registro* ✔ los contactos y los cambios de permisos no se editan ni se borran (solo se anota el resultado).
6. *Categorías fijas* ✔ motivos, canales y resultados son listas fijas (sirven para filtrar y para Reportes).
7. *Orden consistente* ✔ el orden de los filtros es el del pedido; Contactar y Registrar resultado no cambian de lugar (solo cambia cuál es el principal).
8. *Vistas por rol* ✔ con CRM "ver" no hay ninguna acción; "crear" contacta y crea campañas; "editar" cambia plantillas y el saludo automático.
9. *Flujos conectados* ✔ Inicio → CRM con el motivo y todos incluidos (mismo número); CRM → perfil; el resultado "agendó" se confirma solo con la cita.

## 4. Principios de diseño (lista de revisión)

- Posiciones estables ✔ pestañas, filtros y botones no se mueven; lo que descansa se ve con un interruptor, no con un cambio de pantalla.
- Un número, un nombre ✔ "Control vencido" usa `esInactivo` (el mismo del Inicio, Pacientes y Reportes); el cumpleaños usa la misma ventana que el Inicio (`diasCumpleEnVentana`). Con "Incluir a quienes no hay que contactar hoy" el número es **exactamente** el del Inicio; sin él, es lo que queda por hacer hoy (y el interruptor dice cuántos faltan).
- Cada número lleva a lo que promete ✔ el aviso del Inicio abre el CRM en ese motivo con todos incluidos; las tarjetas de Seguimiento filtran lo que cuentan.
- Cabecera igual a las demás ✔ "Requieren atención" (la misma ventana) y la acción principal "Nueva campaña".
- Ventana estándar ✔ `Cascaron` en el resultado, la campaña, las plantillas, el detalle del contacto y los avisos.
- Fechas y "hoy" desde las funciones únicas ✔ (`hoyISO`, `formatoFecha`, `diaDeRegistro`, `CampoFecha`).
- Sin lista nativa ✔. Azul de la marca ✔. A 1366×768 sin desplazamiento horizontal ✔ (visto en la Demo; la prueba de Playwright lo vigila).
- Los permisos ocultan ✔ por permiso, no por nombre de rol.

## 5. Lo que no se verificó todavía

- Escritura real contra la base (la migración no está aplicada): contactar, resultados, campañas, permisos y el recorrido de Playwright (`e2e/crm-v2.spec.js`, 7 pruebas escritas, sin correr).
- Otros roles en pantalla (se probaron con la base de mentira), la óptica vacía y otras zonas horarias.
- El portal con un paciente real (`mis_permisos_mensajes` / `actualizar_consentimiento_paciente`): se verifica con la migración aplicada.

## 6. Decisiones que conviene que Diego confirme

1. **Cumpleaños y seguimiento de compra se tratan como "recordatorios de salud"** (no llevan oferta); solo la campaña de promociones exige el permiso de promociones.
2. **Recordatorios de salud: sí por defecto** (es parte del servicio); **promociones: no** hasta que el paciente lo acepte. Los pacientes que ya existen quedan así.
3. **Descansos tras un contacto:** "no respondió" 3 días, "agendó" 30, "no le interesa" 180 (constantes en `crmContactos.js`).
4. **Una fila por paciente con todos sus motivos:** quien tiene control vencido y cumple años cuenta en los dos filtros; "Todos" lo cuenta una vez.
5. **El formulario de registro por la web no pregunta todavía por los permisos** (hoy nacen con el valor por defecto y el paciente los cambia en el portal).
