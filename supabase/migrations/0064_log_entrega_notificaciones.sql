-- Hallazgo E4 de la auditoría 2026-09-09: los 3 envíos de correo reales del
-- sistema (recordatorio de cita, saludo de cumpleaños, invitación a la
-- encuesta) llaman a `net.http_post` con `perform` — se descarta el
-- resultado sin más, y la cita/paciente se marca como "notificado" sin
-- importar si Resend realmente aceptó el correo. Un fallo (API key vencida,
-- Resend caído, correo rechazado) es hoy invisible: no hay forma de saber
-- que algo no llegó, y como ya se marcó "enviado" tampoco se reintenta.
--
-- `net.http_post` es asíncrono — devuelve un `request_id` de inmediato (la
-- llamada se encola) y la respuesta real de Resend llega después a
-- `net._http_response`, tabla interna de la extensión pg_net que un rol
-- normal no puede leer directo (ver nota de seguridad más abajo). Se agrega
-- una tabla simple para dejar registrado CADA intento con su request_id, y
-- una función que expone el cruce con la respuesta real, scoped a la óptica
-- de quien pregunta — así un fallo real ya se puede ver, sin tener que
-- construir un sistema de reintentos automáticos (fuera de alcance de esta
-- pasada).

create table public.notificaciones_enviadas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  tipo text not null check (tipo in ('recordatorio_cita', 'cumpleanos', 'encuesta_satisfaccion')),
  destinatario text not null,
  referencia_id uuid,
  request_id bigint,
  created_at timestamptz not null default now()
);

create index notificaciones_enviadas_optica_idx on notificaciones_enviadas (optica_id, created_at desc);

alter table notificaciones_enviadas enable row level security;

create policy notificaciones_staff_select on notificaciones_enviadas for select
  using (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy notificaciones_superadmin_all on notificaciones_enviadas for all
  using (es_superadmin())
  with check (es_superadmin());

-- net._http_response no es legible por roles normales (solo por el dueño de
-- la extensión / superusuario) — se expone un cruce controlado, scoped a la
-- óptica de quien llama, en vez de otorgar acceso directo a una tabla que
-- mezcla las respuestas HTTP de TODO el proyecto sin distinguir tenant.
create or replace function public.mis_notificaciones_recientes(p_limite int default 50)
returns table (
  id uuid, tipo text, destinatario text, referencia_id uuid, created_at timestamptz,
  estado text, status_code int, error_msg text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica_id uuid;
begin
  if es_superadmin() then
    v_optica_id := null;
  else
    select optica_id into v_optica_id from perfiles where perfiles.id = auth.uid();
    if v_optica_id is null then
      return;
    end if;
  end if;

  return query
  select
    n.id, n.tipo, n.destinatario, n.referencia_id, n.created_at,
    case
      when r.status_code between 200 and 299 then 'entregado'
      when r.status_code is not null then 'fallido'
      when r.timed_out then 'fallido'
      when r.error_msg is not null then 'fallido'
      else 'pendiente'
    end as estado,
    r.status_code,
    r.error_msg
  from notificaciones_enviadas n
  left join net._http_response r on r.id = n.request_id
  where v_optica_id is null or n.optica_id = v_optica_id
  order by n.created_at desc
  limit least(p_limite, 200);
end;
$$;

revoke all on function public.mis_notificaciones_recientes(int) from public;
grant execute on function public.mis_notificaciones_recientes(int) to authenticated;

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
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if v_api_key is null or v_base_url is null then
    return;
  end if;

  for v_cita in
    select
      c.id, c.optica_id, c.paciente, c.fecha, c.hora, c.motivo_publico, c.motivo,
      coalesce(nullif(c.correo, ''), nullif(p.correo, ''), nullif(p.correo, 'Sin Correo')) as correo_resuelto,
      o.nombre as optica_nombre
    from citas c
    join opticas o on o.id = c.optica_id
    left join pacientes p on p.id = c.paciente_id
    where c.estado = 'Pendiente'
      and c.recordatorio_enviado_at is null
      and c.fecha = ((now() at time zone 'America/Guayaquil')::date + 1)
      and coalesce((o.settings->>'recordatoriosCitaActivo')::boolean, true)
  loop
    v_correo := v_cita.correo_resuelto;

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

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_correo),
        'subject', 'Recordatorio: tu cita mañana en ' || v_cita.optica_nombre,
        'html', v_html
      )
    ) into v_request_id;

    insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
    values (v_cita.optica_id, 'recordatorio_cita', v_correo, v_cita.id, v_request_id);

    update citas set recordatorio_enviado_at = now() where id = v_cita.id;
  end loop;
end;
$$;

create or replace function public.enviar_saludos_cumpleanos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_anio int := extract(year from v_hoy)::int;
  v_paciente record;
  v_html text;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_api_key is null then
    return;
  end if;

  for v_paciente in
    select p.id, p.optica_id, p.nombre, p.correo, o.nombre as optica_nombre
    from pacientes p
    join opticas o on o.id = p.optica_id
    where p.fecha_nacimiento is not null
      and extract(month from p.fecha_nacimiento) = extract(month from v_hoy)
      and extract(day from p.fecha_nacimiento) = extract(day from v_hoy)
      and coalesce((o.settings->>'cumpleAuto')::boolean, false) = true
      and coalesce(p.ultimo_saludo_cumple_anio, 0) < v_anio
      and p.correo is not null and p.correo <> '' and p.correo <> 'Sin Correo'
      and p.correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  loop
    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">¡Feliz cumpleaños, ' || v_paciente.nombre || '!</h2>'
      || '<p>Todo el equipo de <strong>' || v_paciente.optica_nombre || '</strong> te desea un año lleno de buena salud visual y buenos momentos. 🎉</p>'
      || '<p>Como agradecimiento por tu confianza, ¡pásate a vernos pronto, tenemos algo especial para ti!</p>'
      || '</div>';

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_paciente.correo),
        'subject', '¡Feliz cumpleaños de parte de ' || v_paciente.optica_nombre || '!',
        'html', v_html
      )
    ) into v_request_id;

    insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
    values (v_paciente.optica_id, 'cumpleanos', v_paciente.correo, v_paciente.id, v_request_id);

    update pacientes set ultimo_saludo_cumple_anio = v_anio where id = v_paciente.id;
  end loop;
end;
$$;

create or replace function public.notificar_encuesta_satisfaccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key text;
  v_base_url text;
  v_correo text;
  v_optica_nombre text;
  v_link text;
  v_html text;
  v_request_id bigint;
begin
  if new.estado is distinct from 'Atendida' or old.estado is not distinct from 'Atendida' or new.encuesta_enviada_at is not null then
    return new;
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if v_api_key is null or v_base_url is null then
    return new;
  end if;

  select coalesce(nullif(new.correo, ''), nullif(p.correo, ''), nullif(p.correo, 'Sin Correo')), o.nombre
    into v_correo, v_optica_nombre
    from opticas o
    left join pacientes p on p.id = new.paciente_id
    where o.id = new.optica_id;

  if v_correo is null or v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    update citas set encuesta_enviada_at = now() where id = new.id;
    return new;
  end if;

  v_link := v_base_url || '/?encuesta_cita=' || new.id;
  v_html :=
    '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
    || '<h2 style="color:#0E2B33">¿Cómo te fue en tu visita?</h2>'
    || '<p>Hola ' || new.paciente || ', gracias por visitarnos en <strong>' || v_optica_nombre || '</strong>. Tu opinión nos ayuda a mejorar.</p>'
    || '<p><a href="' || v_link || '" style="display:inline-block;padding:10px 20px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px">Calificar mi visita</a></p>'
    || '<p style="color:#64748b;font-size:12px">Te toma menos de un minuto.</p>'
    || '</div>';

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Encuestas <onboarding@resend.dev>',
      'to', jsonb_build_array(v_correo),
      'subject', '¿Cómo te fue en ' || v_optica_nombre || '?',
      'html', v_html
    )
  ) into v_request_id;

  insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
  values (new.optica_id, 'encuesta_satisfaccion', v_correo, new.id, v_request_id);

  update citas set encuesta_enviada_at = now() where id = new.id;
  return new;
end;
$$;
