-- PROPUESTA (NO APLICADA): dejar a «Óptica Solna Vision» sin datos de prueba. Se aplica solo cuando Diego lo apruebe, con respaldo previo.
--
-- Solo toca esa óptica (id fijo abajo). El ensayo (ensayo-limpiar-solna.mjs) lo corre dentro de una transacción que se REVIERTE y comprueba que ninguna otra óptica cambió.
--
-- SE BORRA (lo que hay hoy en Solna → todo es de prueba: 7 pacientes «Prueba …», «Walkin Prueba QA», «Paciente anonimizado»):
--   pacientes, citas (y su historial de eventos), fichas clínicas y sus borradores, ventas/facturas con sus líneas, abonos, correcciones de abonos, pagos por transferencia y
--   facturas electrónicas, pedidos (órdenes de laboratorio y su historial), pases a venta, contactos y campañas del CRM, ausencias, avisos (internos, de contacto, descartados),
--   mensajes y consultas de soporte, solicitudes (medidas, eliminación), encuestas, registros de actividad y los contadores de numeración (comprobantes y pedidos vuelven a 1).
-- SE CONSERVA: la óptica y sus datos (nombre, slug, logo, marca/página pública, ajustes, catálogos, datos bancarios), el horario (disponibilidad y horarios por persona),
--   usuarios (perfiles) y roles, plantillas del CRM, productos (inventario, sus costos y su saldo inicial en el kárdex) y el registro de auditoría del superadmin.
--
-- Decisiones para Diego (están marcadas con ◆ abajo): (1) las 678 «visitas» a la página pública; (2) la cuenta de acceso del paciente «Prueba Unificacion Citas» en el sistema de ingreso.

begin;

-- ── Lo que cuelga de ventas y pedidos ──
delete from public.ordenes_laboratorio        where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e'; -- su historial cae en cascada
delete from public.pases_a_venta              where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.abonos_correcciones        where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.abonos_factura             where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.pagos_transferencia        where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.facturas_venta             where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e'; -- líneas, enlaces de descarga y facturas electrónicas caen en cascada
delete from public.ventas                     where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Clínico y agenda ──
delete from public.fichas_borradores          where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.respuestas_satisfaccion    where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.consultas_base             where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.citas_base                 where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e'; -- citas_eventos cae en cascada
delete from public.ausencias_personal         where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── CRM, avisos, solicitudes, mensajes ──
delete from public.crm_contactos              where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.crm_campanas               where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.avisos_contacto_paciente   where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.avisos_descartados         where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.avisos_internos            where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.avisos                     where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.solicitudes_medidas        where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.solicitudes_eliminacion_paciente where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.consentimientos_historial  where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.notificaciones_enviadas    where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.ayudas_ofrecidas           where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.mensajes                   where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.soporte_mensajes           where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.soporte_consultas          where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.entradas_soporte           where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Pacientes (al final: lo anterior ya no los referencia) ──
delete from public.pacientes_base             where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Actividad ──
delete from public.logs_optica                where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
-- ◆ (1) Las 678 visitas a la página pública (26 ago. – 19 oct.) son tráfico de las pruebas y alimentan el embudo del panel del superadmin. Quitar el comentario para borrarlas:
-- delete from public.visitas                  where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Numeración: los comprobantes y los pedidos vuelven a empezar en 1 ──
delete from public.contador_comprobantes_venta where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.contador_ordenes_laboratorio where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ◆ (2) Cuenta de ingreso del paciente «Prueba Unificacion Citas» (auth.users, sin perfil): el SQL no la toca (las cuentas se quitan con la Edge Function eliminar-cuenta-auth, no con SQL).
--     Queda sin paciente al que apuntar y sin ningún permiso; se puede quitar aparte con la función, o dejarla.

-- Ensayo: se REVIERTE. Para aplicar de verdad, con respaldo hecho y aprobación, cambiar «rollback» por «commit».
rollback;
