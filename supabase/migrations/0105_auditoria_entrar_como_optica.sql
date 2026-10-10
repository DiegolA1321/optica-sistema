-- Entrar como administrador de una óptica (impersonación) deja registro en la actividad del superadmin.
--
-- La franja que ve el superadmin dentro de una óptica dice "cualquier acción queda registrada", pero en la tabla `auditoria`
-- (la que lista el panel "Actividad") no cabía esta acción: el CHECK `auditoria_accion_check` solo permite las 12 acciones de la
-- migración 0030. Esta migración agrega dos: entrar_como_optica y salir_de_optica.
--
-- Solo amplía la lista de acciones permitidas. No cambia datos, funciones, vistas ni permisos: quien puede escribir en `auditoria`
-- sigue siendo únicamente el superadmin (política `auditoria_superadmin_all`).

alter table public.auditoria drop constraint if exists auditoria_accion_check;
alter table public.auditoria add constraint auditoria_accion_check check (accion in (
  'crear_optica', 'suspender_optica', 'reactivar_optica', 'renombrar_optica',
  'agregar_administrador', 'eliminar_administrador',
  'crear_superadmin', 'eliminar_superadmin',
  'responder_mensaje', 'publicar_anuncio', 'actualizar_pago', 'generar_factura',
  'entrar_como_optica', 'salir_de_optica'
));
