-- Faltaba: el admin no tenía ninguna policy para leer/editar/eliminar las
-- filas de perfiles de sus propios asistentes (solo existían
-- perfiles_select_self y perfiles_superadmin_all). Sin esto, listar,
-- editar o eliminar un asistente desde Usuarios.jsx fallaba silenciosamente
-- por RLS. Se limita explícitamente a filas rol='asistente' de la misma
-- optica_id del admin — nunca a otros admins ni a superadmins.

create policy perfiles_admin_gestiona_asistentes on perfiles
  for all
  using (
    rol = 'asistente'
    and optica_id = (select p2.optica_id from perfiles p2 where p2.id = auth.uid() and p2.rol = 'admin')
  )
  with check (
    rol = 'asistente'
    and optica_id = (select p2.optica_id from perfiles p2 where p2.id = auth.uid() and p2.rol = 'admin')
  );
