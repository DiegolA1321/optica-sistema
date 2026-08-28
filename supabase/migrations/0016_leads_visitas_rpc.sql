-- Causa real de por qué anon nunca pudo insertar en leads/visitas: PostgREST
-- envuelve TODO insert en un `WITH pgrst_source AS (INSERT ... RETURNING ...)
-- SELECT count(...) FROM pgrst_source` para calcular el status/Content-Range
-- de la respuesta, sin importar el header Prefer que mande el cliente. Ese
-- SELECT sobre la fila recién insertada exige una policy de SELECT, no solo
-- de INSERT — verificado en los logs de Postgres del proyecto (columna QUERY
-- del log muestra exactamente ese wrapping).
--
-- La solución correcta NO es agregar SELECT público a anon (expondría los
-- datos de contacto de todas las solicitudes). Se reemplaza el INSERT directo
-- por funciones SECURITY DEFINER: anon solo puede ejecutar la función, nunca
-- lee ni escribe la tabla directo — el insert interno corre como dueño de la
-- función, sin pasar por RLS en absoluto.

drop policy if exists leads_insert_publico on leads;
drop policy if exists visitas_insert_publico on visitas;

create or replace function public.crear_lead(
  p_nombre_optica text,
  p_nombre_admin text,
  p_email_admin text,
  p_slug_deseado text default null,
  p_telefono text default null,
  p_mensaje text default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into leads (nombre_optica, nombre_admin, email_admin, slug_deseado, telefono, mensaje)
  values (p_nombre_optica, p_nombre_admin, p_email_admin, p_slug_deseado, p_telefono, p_mensaje);
$$;

revoke all on function public.crear_lead(text, text, text, text, text, text) from public;
grant execute on function public.crear_lead(text, text, text, text, text, text) to anon;

create or replace function public.registrar_visita(
  p_tipo text,
  p_optica_id uuid default null
) returns void
language sql
security definer
set search_path = public
as $$
  insert into visitas (tipo, optica_id) values (p_tipo, p_optica_id);
$$;

revoke all on function public.registrar_visita(text, uuid) from public;
grant execute on function public.registrar_visita(text, uuid) to anon;
