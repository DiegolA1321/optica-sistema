-- 0150 — Recordatorios de cita cada hora, y remitente de los correos configurable.
--
-- HOY (0031 → 0134): el cron corre UNA vez al día (10:00 de Ecuador) y solo mira las citas del día siguiente. Una cita agendada hoy después de las 10:00 para mañana, o para dentro de
-- unas horas, nunca recibe recordatorio. Además el remitente de los tres correos del sistema (recordatorio, saludo de cumpleaños y encuesta) está escrito en el código como
-- onboarding@resend.dev, el remitente de PRUEBA de Resend: en ese modo solo entrega al dueño de la cuenta.
--
-- QUÉ HACE:
--   1. enviar_recordatorios_citas(p_ahora) pasa a mirar las citas PENDIENTES que empiezan en las próximas 24 horas (la hora de la cita, no solo el día) y que todavía no tienen
--      recordatorio. El cron corre cada hora, en punto. «p_ahora» (por defecto, ahora) existe para poder probar la regla con un reloj fijo; el cron la llama sin él.
--   2. Sin duplicados: cada cita se «reclama» (recordatorio_enviado_at) en una sola instrucción ANTES de pedir el envío; si otra corrida ya la reclamó, se salta. Una cita ya enviada
--      nunca se vuelve a enviar, aunque siga dentro de las 24 horas. Mismas condiciones de siempre: la óptica no apagó los recordatorios, el paciente los acepta, hay un correo válido
--      (sin correo válido la cita se marca como procesada y no se envía nada). Una cita que ya empezó no recibe recordatorio.
--   3. Horario de descanso: entre las 9:00 PM y las 7:00 AM (hora de Ecuador) no se envía nada; lo pendiente sale a las 7:00 AM (una cita de las 8:00 AM agendada de noche recibe su
--      correo a las 7:00 AM). Ya no dice «mañana»: el asunto es «Recordatorio de tu cita en {óptica}» y la hora se escribe sin cero de adelante («9:00 AM»).
--   4. El cron diario «recordatorios_citas_diarios» se reemplaza por «recordatorios_citas_cada_hora» (0 * * * *, UTC; la función decide por la hora de Ecuador).
--   5. REMITENTE CONFIGURABLE: _remitente_correo(nombre) arma «Nombre <dirección>» con la dirección guardada en el vault (secreto «resend_remitente»); sin ese secreto usa
--      onboarding@resend.dev, como hasta hoy. Los tres correos (recordatorio, saludos de cumpleaños, encuesta) lo usan. Para pasar a producción, cuando el dominio de la óptica esté
--      verificado en Resend, basta guardar el secreto, sin tocar código ni funciones:
--         select vault.create_secret('avisos@tu-dominio.com', 'resend_remitente');            -- la primera vez
--         select vault.update_secret((select id from vault.secrets where name = 'resend_remitente'), 'otro@tu-dominio.com');   -- para cambiarlo
--
-- Qué NO cambia: ninguna cita ni dato existente; el contenido del correo salvo el asunto y la hora; los saludos de cumpleaños y la encuesta (solo su remitente); los permisos de las
-- funciones. Una óptica nueva no necesita nada. Al aplicarla, las citas pendientes de las próximas 24 horas que no tengan recordatorio recibirán uno en la siguiente hora en punto
-- (dentro del horario de envío): es justo lo que se pide, pero conviene aplicarla fuera del horario de pruebas con usuarios.
-- Revertir: cron.unschedule('recordatorios_citas_cada_hora'); cron.schedule('recordatorios_citas_diarios', '0 15 * * *', 'select public.enviar_recordatorios_citas()');
--   drop function public.enviar_recordatorios_citas(timestamptz) y recrear la de 0134; las otras dos funciones, a su definición anterior (remitente fijo); drop function public._remitente_correo(text).

-- ═══ 1. Remitente configurable ═══
create or replace function public._remitente_correo(p_nombre text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p_nombre || ' <' || coalesce((select nullif(trim(decrypted_secret), '') from vault.decrypted_secrets where name = 'resend_remitente' limit 1), 'onboarding@resend.dev') || '>';
$$;
revoke all on function public._remitente_correo(text) from public, anon, authenticated;

-- ═══ 2. Recordatorios: las próximas 24 horas, cada hora, sin duplicados y sin molestar de noche ═══
drop function public.enviar_recordatorios_citas();
create function public.enviar_recordatorios_citas(p_ahora timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_api_key text;
  v_cita record;
  v_correo text;
  v_html text;
  v_request_id bigint;
  v_ahora timestamp := p_ahora at time zone 'America/Guayaquil';
  v_hora_local int := extract(hour from p_ahora at time zone 'America/Guayaquil')::int;
  v_remitente text;
begin
  -- Horario de descanso (9:00 PM a 7:00 AM, hora de Ecuador): lo pendiente sale a las 7:00 AM.
  if v_hora_local < 7 or v_hora_local >= 21 then
    return;
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_api_key is null then
    return;
  end if;
  v_remitente := public._remitente_correo('Recordatorios');

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
      -- la cita empieza dentro de las próximas 24 horas (y todavía no empezó)
      and (c.fecha + make_interval(mins => public._minutos_hora(c.hora))) > v_ahora
      and (c.fecha + make_interval(mins => public._minutos_hora(c.hora))) <= v_ahora + interval '24 hours'
      and coalesce((o.settings->>'recordatoriosCitaActivo')::boolean, true)
      and coalesce(p.acepta_recordatorios, true)
    order by c.fecha, public._minutos_hora(c.hora)
  loop
    -- Se reclama la cita ANTES de enviar: si otra corrida ya la reclamó (recordatorio_enviado_at no es nulo) se salta. Nunca dos correos para la misma cita.
    update citas set recordatorio_enviado_at = now() where id = v_cita.id and recordatorio_enviado_at is null;
    if not found then
      continue;
    end if;

    v_correo := v_cita.correo_resuelto;
    if v_correo is null or v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      continue;
    end if;

    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">Recordatorio de tu cita</h2>'
      || '<p>Hola ' || v_cita.paciente || ', te recordamos tu cita en <strong>' || v_cita.optica_nombre || '</strong>:</p>'
      || '<p style="font-size:18px"><strong>' || to_char(v_cita.fecha, 'DD/MM/YYYY') || ' a las ' || regexp_replace(v_cita.hora, '^0', '') || '</strong></p>'
      || case when coalesce(v_cita.motivo_publico, v_cita.motivo) is not null
           then '<p>Motivo: ' || coalesce(v_cita.motivo_publico, v_cita.motivo) || '</p>'
           else '' end
      || '<p>Te esperamos. No necesitas confirmar tu asistencia.</p>'
      || '<p style="color:#64748b;font-size:12px">Si no puedes asistir, cancela o reagenda tu cita desde tu portal o comunícate con la óptica.</p>'
      || '</div>';

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', v_remitente,
        'to', jsonb_build_array(v_correo),
        'subject', 'Recordatorio de tu cita en ' || v_cita.optica_nombre,
        'html', v_html
      )
    ) into v_request_id;

    insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
    values (v_cita.optica_id, 'recordatorio_cita', v_correo, v_cita.id, v_request_id);
  end loop;
end;
$function$;
revoke all on function public.enviar_recordatorios_citas(timestamptz) from public, anon, authenticated;

-- ═══ 3. Cron: cada hora en lugar de una vez al día ═══
select cron.unschedule('recordatorios_citas_diarios');
select cron.schedule('recordatorios_citas_cada_hora', '0 * * * *', $$select public.enviar_recordatorios_citas()$$);

-- ═══ 4. Los otros dos correos, con el remitente configurable (lo demás, idéntico a la definición vigente) ═══
CREATE OR REPLACE FUNCTION public.enviar_saludos_cumpleanos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and p.acepta_promociones
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
        'from', public._remitente_correo('Recordatorios'),
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
$function$;

CREATE OR REPLACE FUNCTION public.notificar_encuesta_satisfaccion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'from', public._remitente_correo('Encuestas'),
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
$function$;
