-- Límite de frecuencia por IP en los RPC públicos que cualquiera puede
-- llamar sin ninguna credencial (crear_lead, crear_cita_publica,
-- registrar_visita). Hasta ahora solo validaban formato — nada impedía
-- llamarlos cientos de veces seguidas desde la misma IP. Verificado que
-- Supabase (detrás de Cloudflare) expone la IP real del que llama vía
-- current_setting('request.headers') -> 'cf-connecting-ip' — probado en
-- vivo con una llamada real antes de construir esto.

-- Bug real encontrado de paso probando esto en vivo: la migración 0031
-- agregó p_correo a crear_cita_publica con `create or replace function`,
-- pero eso NO reemplaza una función cuando cambia la cantidad de
-- parámetros — crea una SEGUNDA versión superpuesta (9 parámetros la
-- vieja, 10 la nueva) en vez de reemplazar la primera. El resultado:
-- cualquier llamada que no incluyera p_correo por nombre (exactamente lo
-- que hace PortalPaciente.jsx al agendar) quedaba ambigua entre las dos
-- versiones y fallaba con "Could not choose the best candidate function"
-- — el agendamiento de citas desde el portal del paciente estuvo roto en
-- producción desde que se aplicó la migración 0031. Se limpia acá.
drop function if exists public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text);

create table if not exists limite_solicitudes (
  id bigserial primary key,
  ip text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);
create index if not exists limite_solicitudes_ip_endpoint_idx on limite_solicitudes (ip, endpoint, created_at);

-- Registra el intento y devuelve true si ya se pasó del máximo permitido
-- para esa IP+endpoint en la ventana de tiempo dada. Nunca falla por sí
-- misma si no puede leer la IP (queda como 'desconocida', comparte límite
-- entre todos los que caigan en ese caso raro — mejor eso que romper el
-- flujo real por un problema de infraestructura).
create or replace function public.limite_excedido(p_endpoint text, p_maximo int, p_ventana interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text;
  v_conteo int;
begin
  v_ip := coalesce(
    nullif(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''),
    nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    'desconocida'
  );

  insert into limite_solicitudes (ip, endpoint) values (v_ip, p_endpoint);

  select count(*) into v_conteo
  from limite_solicitudes
  where ip = v_ip and endpoint = p_endpoint and created_at > now() - p_ventana;

  return v_conteo > p_maximo;
end;
$$;

revoke all on function public.limite_excedido(text, int, interval) from public;
grant execute on function public.limite_excedido(text, int, interval) to anon, authenticated;

-- Limpieza diaria — sin esto la tabla crece para siempre.
select cron.schedule(
  'limpiar_limite_solicitudes',
  '30 4 * * *',
  $$delete from limite_solicitudes where created_at < now() - interval '1 day'$$
);

-- ── crear_lead: máximo 5 solicitudes cada 10 minutos por IP ──
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
  if limite_excedido('crear_lead', 5, interval '10 minutes') then
    raise exception 'Demasiadas solicitudes seguidas. Intenta de nuevo en unos minutos.';
  end if;

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

-- ── crear_cita_publica: máximo 8 solicitudes cada 15 minutos por IP ──
create or replace function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null,
  p_correo text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
  v_correo text := nullif(trim(p_correo), '');
begin
  if limite_excedido('crear_cita_publica', 8, interval '15 minutes') then
    raise exception 'Demasiadas solicitudes seguidas. Intenta de nuevo en unos minutos.';
  end if;

  if not exists (select 1 from opticas where id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  insert into citas (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, estado)
  values (
    p_optica_id, p_paciente_id,
    left(v_paciente, 200),
    left(nullif(trim(p_cedula), ''), 30),
    left(nullif(trim(p_telefono), ''), 30),
    p_fecha,
    left(v_hora, 20),
    left(nullif(trim(p_motivo), ''), 300),
    left(nullif(trim(p_motivo_publico), ''), 300),
    left(v_correo, 200),
    'Pendiente'
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ── registrar_visita: máximo 30 cada 5 minutos por IP (es automático al
--    cargar la página, no un clic explícito del visitante, así que el
--    margen es más generoso que en los otros dos) ──
create or replace function public.registrar_visita(
  p_tipo text,
  p_optica_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if limite_excedido('registrar_visita', 30, interval '5 minutes') then
    return; -- sin raise: es una métrica, no una acción del usuario — falla en silencio, no debe romper la carga de la página.
  end if;

  if p_tipo not in ('venta', 'optica_publica') then
    raise exception 'Tipo de visita no válido.';
  end if;
  if p_optica_id is not null and not exists (select 1 from opticas where id = p_optica_id) then
    raise exception 'Óptica no válida.';
  end if;

  insert into visitas (tipo, optica_id) values (p_tipo, p_optica_id);
end;
$$;
