-- Recordatorios automáticos de citas por correo (el anteproyecto de tesis
-- promete reducción de no-shows vía recordatorios multicanal confirmables —
-- hasta ahora el CRM solo abría un link manual de WhatsApp, nada automático).
--
-- Arquitectura: sin servidor aparte. Un cron de Postgres (pg_cron) corre una
-- vez al día y llama directo a la API de Resend vía pg_net (HTTP async desde
-- la propia base). La API key vive en Supabase Vault, nunca en una columna
-- ni en este archivo — se inserta aparte, fuera de las migraciones versionadas.
--
-- Cobertura: el formulario público de "agendar sin cuenta" nunca pedía
-- correo (solo nombre/teléfono), así que se agrega citas.correo para que
-- también esas citas puedan recibir recordatorio si el paciente lo da.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table citas
  add column if not exists correo text,
  add column if not exists recordatorio_enviado_at timestamptz,
  add column if not exists confirmada_at timestamptz;

-- ── crear_cita_publica: ahora acepta correo opcional ──
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

-- ── confirmar_asistencia_cita: el link "Confirmar mi asistencia" del correo
--    llama esto. cita_id (uuid v4, 122 bits al azar) hace de token — mismo
--    criterio que un link de RSVP/unsubscribe: de un solo uso funcional
--    (idempotente), no expone ni cambia nada más que "confirmada_at", y
--    llega solo a la casilla del paciente porque el cron se lo manda a él.
create or replace function public.confirmar_asistencia_cita(
  p_cita_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update citas set confirmada_at = now() where id = p_cita_id and confirmada_at is null;
  return found;
end;
$$;

revoke all on function public.confirmar_asistencia_cita(uuid) from public;
grant execute on function public.confirmar_asistencia_cita(uuid) to anon;

-- ── enviar_recordatorios_citas: el cron diario. Recorre las citas de
--    "mañana" (hora de Ecuador) sin recordatorio enviado, resuelve el correo
--    (el de la cita si la reservaron sin cuenta, si no el del paciente
--    vinculado) y llama a Resend vía pg_net. Si Vault no tiene la API key
--    todavía, no hace nada (para que correr esto antes de configurar la key
--    no rompa el cron) — ver nota al final del archivo para cargarla.
create or replace function public.enviar_recordatorios_citas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_base_url text;
  v_cita record;
  v_correo text;
  v_link text;
  v_html text;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if v_api_key is null or v_base_url is null then
    return;
  end if;

  for v_cita in
    select
      c.id, c.paciente, c.fecha, c.hora, c.motivo_publico, c.motivo,
      coalesce(nullif(c.correo, ''), nullif(p.correo, ''), nullif(p.correo, 'Sin Correo')) as correo_resuelto,
      o.nombre as optica_nombre
    from citas c
    join opticas o on o.id = c.optica_id
    left join pacientes p on p.id = c.paciente_id
    where c.estado = 'Pendiente'
      and c.recordatorio_enviado_at is null
      and c.fecha = ((now() at time zone 'America/Guayaquil')::date + 1)
  loop
    v_correo := v_cita.correo_resuelto;

    -- Sin correo válido: igual se marca como "procesada" para no
    -- reintentarla todos los días sin necesidad.
    if v_correo is null or v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      update citas set recordatorio_enviado_at = now() where id = v_cita.id;
      continue;
    end if;

    v_link := v_base_url || '/?confirmar_cita=' || v_cita.id;
    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">Recordatorio de tu cita</h2>'
      || '<p>Hola ' || v_cita.paciente || ', te recordamos tu cita en <strong>' || v_cita.optica_nombre || '</strong>:</p>'
      || '<p style="font-size:18px"><strong>' || to_char(v_cita.fecha, 'DD/MM/YYYY') || ' a las ' || v_cita.hora || '</strong></p>'
      || case when coalesce(v_cita.motivo_publico, v_cita.motivo) is not null
           then '<p>Motivo: ' || coalesce(v_cita.motivo_publico, v_cita.motivo) || '</p>'
           else '' end
      || '<p><a href="' || v_link || '" style="display:inline-block;padding:10px 20px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px">Confirmar mi asistencia</a></p>'
      || '<p style="color:#64748b;font-size:12px">Si no puedes asistir, comunícate con la óptica para reagendar.</p>'
      || '</div>';

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_correo),
        'subject', 'Recordatorio: tu cita mañana en ' || v_cita.optica_nombre,
        'html', v_html
      )
    );

    update citas set recordatorio_enviado_at = now() where id = v_cita.id;
  end loop;
end;
$$;

select cron.schedule(
  'recordatorios_citas_diarios',
  '0 15 * * *', -- 15:00 UTC = 10:00 América/Guayaquil (Ecuador no tiene horario de verano)
  $$select public.enviar_recordatorios_citas()$$
);

-- ── Para activar el envío real (fuera de esta migración, nunca con la key
--    en texto plano en un archivo versionado):
--
--   select vault.create_secret('re_xxxxxxxx', 'resend_api_key', 'API key de Resend para recordatorios');
--   select vault.create_secret('https://tu-dominio-real.com', 'app_base_url', 'Base URL pública del sistema, para el link de confirmación');
