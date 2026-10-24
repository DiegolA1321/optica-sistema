-- APLICADA el 23 oct. 2026 (respaldo backups-optica/pre-limpiar-solna-2026-10-23.dump; ensayo y aplicación con ensayo-limpiar-solna.mjs; verificación con verificar-limpieza-solna.mjs). «Óptica Solna Vision» quedó sin datos ni usuarios de prueba.
--
-- Solo toca esa óptica (id fijo abajo). El ensayo (ensayo-limpiar-solna.mjs) lo corre dentro de una transacción que se REVIERTE y comprueba que ninguna otra óptica cambió.
--
-- SE BORRA (lo que hay hoy en Solna → todo es de prueba: 7 pacientes «Prueba …», «Walkin Prueba QA», «Paciente anonimizado»):
--   pacientes, citas (y su historial de eventos), fichas clínicas y sus borradores, ventas/facturas con sus líneas, abonos, correcciones de abonos, pagos por transferencia y
--   facturas electrónicas, pedidos (órdenes de laboratorio y su historial), pases a venta, contactos y campañas del CRM, ausencias, avisos (internos, de contacto, descartados),
--   mensajes y consultas de soporte, solicitudes (medidas, eliminación), encuestas, registros de actividad y los contadores de numeración (comprobantes y pedidos vuelven a 1).
-- SE CONSERVA: la fila de la óptica con su configuración (datos, logo, página pública y color, ajustes, catálogos, datos bancarios), el horario de la óptica (disponibilidad),
--   los roles predefinidos (Optómetra, Recepción y Ventas) con sus alcances, las plantillas del CRM y el registro de auditoría del superadmin.
-- SE BORRA TAMBIÉN (indicación de Diego): los dos usuarios de prueba (el administrador y Leonela) con su cuenta de ingreso y su horario por persona, la cuenta huérfana de prueba,
--   el rol de prueba «Permisos actuales», el producto de prueba con su saldo inicial (el inventario empieza en cero) y las 678 visitas. El administrador real lo crea el superadmin desde su panel.
--
-- Incluye (por indicación de Diego) las 678 visitas a la página pública y las cuentas de ingreso de prueba.

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
-- Las 678 visitas a la página pública (26 ago. – 19 oct.) son tráfico de las pruebas y alimentaban el embudo del panel del superadmin (Diego: se borran).
delete from public.visitas                    where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Numeración: los comprobantes y los pedidos vuelven a empezar en 1 ──
delete from public.contador_comprobantes_venta where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.contador_ordenes_laboratorio where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';

-- ── Usuarios de prueba y su cuenta de ingreso ──
-- Borrar la cuenta de Supabase Auth se lleva su perfil, sus sesiones, su horario por persona, sus roles asignados y sus ausencias (todo cae en cascada); lo que ellos hicieron (citas, ventas…) ya se borró arriba
-- o queda sin autor. Son la del administrador, la de Leonela y una huérfana de prueba sin perfil. (El paciente «Prueba Unificacion Citas» no tiene cuenta de Auth: su acceso vivía en su fila de pacientes.)
delete from auth.users where id in (select id from public.perfiles where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e');
delete from auth.users where id = 'a7076863-4b31-492a-a977-90f09b56468a' and email = 'secretaria.qa.prueba@opticasolna.test' and not exists (select 1 from public.perfiles p where p.id = auth.users.id);
delete from public.perfiles where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e'; -- por si alguno no tuviera cuenta de Auth

-- ── Rol de prueba (los tres predefinidos se conservan) ──
delete from public.roles where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e' and es_predefinido = false;

-- ── Inventario en cero: el producto de prueba y su saldo inicial ──
-- El kárdex no se puede borrar ni editar (disparador de inmutabilidad): se desactiva SOLO dentro de esta transacción, igual que hace la limpieza de la óptica de pruebas.
alter table public.movimientos_inventario disable trigger movimientos_inventario_inmutables;
alter table public.conteos_inventario disable trigger conteos_inventario_inmutables;
delete from public.movimientos_inventario where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.conteos_inventario where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e';
delete from public.inventario where optica_id = 'b6eb867a-6b08-42c6-b493-27d139bed64e'; -- sus costos caen en cascada
alter table public.movimientos_inventario enable trigger movimientos_inventario_inmutables;
alter table public.conteos_inventario enable trigger conteos_inventario_inmutables;

-- Ensayo: se REVIERTE. Para aplicar de verdad, con respaldo hecho y aprobación, cambiar «rollback» por «commit».
rollback;
