-- Ciberseguridad (2026-08-28): crear_cita_publica, crear_lead y
-- registrar_visita son RPC públicos (grant a `anon`, sin sesión real detrás)
-- que hasta ahora insertaban lo que sea que mandara el cliente, sin ningún
-- chequeo del lado del servidor — solo validación en el formulario de React,
-- que cualquiera puede saltarse llamando al RPC directo desde la consola.
-- Riesgos concretos que esto cierra:
--   - Nada impedía mandar textos gigantes (abuso de almacenamiento) en
--     nombre/motivo/mensaje.
--   - crear_cita_publica no verificaba que optica_id fuera una óptica real
--     y activa: alguien que conociera el id de OTRA óptica (visible en la
--     respuesta pública de su sitio) podía meterle citas falsas a su
--     calendario.
--   - crear_lead no validaba que el email tuviera forma de email.
--   - registrar_visita aceptaba cualquier texto como tipo, ensuciando la
--     métrica de embudo que usa Resumen (SaaS funnel).
-- No se toca la firma de ninguna función (mismos parámetros/tipos), así que
-- alcanza con create or replace, sin drop.

create or replace function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
begin
  if not exists (select 1 from opticas where id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;

  insert into citas (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, estado)
  values (
    p_optica_id, p_paciente_id,
    left(v_paciente, 200),
    left(nullif(trim(p_cedula), ''), 30),
    left(nullif(trim(p_telefono), ''), 30),
    p_fecha,
    left(v_hora, 20),
    left(nullif(trim(p_motivo), ''), 300),
    left(nullif(trim(p_motivo_publico), ''), 300),
    'Pendiente'
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.crear_lead(
  p_nombre_optica text,
  p_nombre_admin text,
  p_email_admin text,
  p_slug_deseado text default null,
  p_telefono text default null,
  p_mensaje text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_optica text := trim(p_nombre_optica);
  v_nombre_admin text := trim(p_nombre_admin);
  v_email text := lower(trim(p_email_admin));
begin
  if v_nombre_optica = '' then
    raise exception 'El nombre de la óptica es obligatorio.';
  end if;
  if v_nombre_admin = '' then
    raise exception 'El nombre de contacto es obligatorio.';
  end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  insert into leads (nombre_optica, nombre_admin, email_admin, slug_deseado, telefono, mensaje)
  values (
    left(v_nombre_optica, 200),
    left(v_nombre_admin, 200),
    left(v_email, 200),
    left(nullif(trim(p_slug_deseado), ''), 100),
    left(nullif(trim(p_telefono), ''), 30),
    left(nullif(trim(p_mensaje), ''), 2000)
  );
end;
$$;

create or replace function public.registrar_visita(
  p_tipo text,
  p_optica_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('venta', 'optica_publica') then
    raise exception 'Tipo de visita no válido.';
  end if;
  if p_optica_id is not null and not exists (select 1 from opticas where id = p_optica_id) then
    raise exception 'Óptica no válida.';
  end if;

  insert into visitas (tipo, optica_id) values (p_tipo, p_optica_id);
end;
$$;
