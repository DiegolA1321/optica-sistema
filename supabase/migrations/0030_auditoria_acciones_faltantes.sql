-- Bug real encontrado en la revisión (2026-08-28): SuperadminPanel.jsx
-- llama a registrarAuditoria() con 12 acciones distintas (hay hasta un mapa
-- de íconos/etiquetas para las 12 en el propio archivo, líneas ~209-220),
-- pero auditoria_accion_check (migración 0004) solo permite 8. Las otras 4
-- — responder_mensaje, publicar_anuncio, actualizar_pago, generar_factura —
-- violan el CHECK en cada intento de insert, y registrarAuditoria() traga
-- el error con un console.warn (nadie lo ve en uso normal). Confirmado
-- contra la tabla real: nunca se guardó ninguna de esas 4 acciones, a pesar
-- de que el código las dispara regularmente (responder mensajes, publicar
-- avisos, marcar pagos, generar facturas). El anteproyecto de tesis promete
-- trazabilidad de auditoría — esto la dejaba incompleta en silencio.

alter table auditoria drop constraint if exists auditoria_accion_check;
alter table auditoria add constraint auditoria_accion_check check (accion in (
  'crear_optica', 'suspender_optica', 'reactivar_optica', 'renombrar_optica',
  'agregar_administrador', 'eliminar_administrador',
  'crear_superadmin', 'eliminar_superadmin',
  'responder_mensaje', 'publicar_anuncio', 'actualizar_pago', 'generar_factura'
));
