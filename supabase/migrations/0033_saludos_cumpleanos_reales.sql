-- CRM.jsx tenía un "saludo automático de cumpleaños" que era puro mockup de
-- frontend: marcaba al paciente como "enviado" en localStorage, sin mandar
-- nada real. Ahora que existe la infraestructura de correo (migración 0031:
-- pg_cron + pg_net + Resend + Vault), se vuelve un envío real, mismo patrón
-- que los recordatorios de citas. El toggle on/off ya vivía en
-- opticas.settings->>'cumpleAuto' (Configuracion/CRM lo persisten ahí desde
-- antes) — se reutiliza tal cual, no hace falta columna nueva para eso.

alter table pacientes add column if not exists ultimo_saludo_cumple_anio int;

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
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_api_key is null then
    return;
  end if;

  for v_paciente in
    select p.id, p.nombre, p.correo, o.nombre as optica_nombre
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

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_paciente.correo),
        'subject', '¡Feliz cumpleaños de parte de ' || v_paciente.optica_nombre || '!',
        'html', v_html
      )
    );

    update pacientes set ultimo_saludo_cumple_anio = v_anio where id = v_paciente.id;
  end loop;
end;
$$;

select cron.schedule(
  'saludos_cumpleanos_diarios',
  '0 15 * * *', -- 15:00 UTC = 10:00 América/Guayaquil, mismo horario que los recordatorios de citas
  $$select public.enviar_saludos_cumpleanos()$$
);
