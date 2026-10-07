-- Seguridad: mínimo privilegio, parte C. BORRADOR: NO aplicar hasta terminar las pruebas con Playwright.
--
-- Quita a `authenticated` la escritura directa en las tablas que la app solo modifica mediante funciones RPC
-- (SECURITY DEFINER, no necesitan permisos de tabla del llamador), y deja las escrituras que el cliente sí hace.
-- Lectura: se conserva en todo (la limita el RLS).
--
-- Tablas que quedan sin escritura directa para authenticated (solo por RPC): abonos_factura, facturas_venta,
-- facturas_venta_lineas, ordenes_laboratorio, ordenes_laboratorio_historial, pases_a_venta, contador_*,
-- limite_solicitudes, notificaciones_enviadas, respuestas_satisfaccion, solicitudes_eliminacion_paciente, visitas.
-- `ventas` conserva solo UPDATE (camino antiguo) y se quita su INSERT: `registrar_venta_producto` (invoker, sin uso)
-- dejaría de funcionar.

revoke insert, update, delete on all tables in schema public from authenticated;

-- Vistas y tablas base de pacientes, citas y consultas (los disparadores INSTEAD OF corren como quien llama).
-- No se devuelve DELETE: la app no elimina citas ni consultas (se cancelan) y los pacientes se anonimizan por RPC.
grant insert, update on public.pacientes, public.citas, public.consultas to authenticated;
grant insert, update on public.pacientes_base, public.citas_base, public.consultas_base to authenticated;

grant insert, update, delete on public.inventario to authenticated;
grant insert, update         on public.disponibilidad, public.horarios_usuario, public.mensajes, public.perfiles, public.opticas to authenticated;
grant insert, update, delete on public.roles, public.perfil_roles to authenticated;
grant insert, delete         on public.avisos to authenticated;
grant insert                 on public.logs_optica, public.auditoria to authenticated;
grant insert, update         on public.facturas to authenticated;              -- cobros de suscripción (superadmin)
grant update                 on public.leads, public.ventas to authenticated;  -- leads: superadmin; ventas: camino antiguo

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
-- grant insert, update, delete on all tables in schema public to authenticated;
