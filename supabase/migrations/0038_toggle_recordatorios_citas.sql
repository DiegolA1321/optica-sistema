-- Feedback de Diego (2026-08-30): el módulo de Configuración se sentía corto
-- ("agrégale más cosas o hazlo mejor"). Los recordatorios automáticos de
-- citas (migración 0031) ya existían pero eran todo-o-nada a nivel
-- plataforma (dependían solo de que Vault tuviera la API key) — se agrega un
-- interruptor por óptica en Configuración, en la misma tabla de "políticas
-- hacia el paciente" donde ya vive el de reagendar/cancelar. Default true
-- (opticas.settings->>'recordatoriosCitaActivo' ausente = comportamiento de
-- siempre) para no cambiar nada en las ópticas que nunca toquen este switch.
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
