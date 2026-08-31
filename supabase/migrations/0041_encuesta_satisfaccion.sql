-- Encuesta de satisfacción (CSAT) post-consulta — el anteproyecto pide
-- evaluar aceptabilidad con encuestas de satisfacción (CSAT/NPS) como parte
-- de la metodología de evaluación. En vez de que Diego tenga que armar y
-- repartir encuestas a mano, el sistema manda un correo automático apenas
-- se marca una cita como "Atendida" (mismo patrón de correo real que
-- recordatorios/cumpleaños: pg_net + Resend + Vault), con un link público
-- de un solo uso — igual que "Confirmar mi asistencia" — a un formulario
-- corto (1 a 5 + comentario opcional). El resultado se agrega en Reportes.

alter table citas add column if not exists encuesta_enviada_at timestamptz;

create table respuestas_satisfaccion (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  cita_id uuid not null unique references citas(id) on delete cascade,
  puntaje smallint not null check (puntaje between 1 and 5),
  comentario text,
  created_at timestamptz not null default now()
);
create index respuestas_satisfaccion_optica_id_idx on respuestas_satisfaccion(optica_id);

alter table respuestas_satisfaccion enable row level security;

-- Solo lectura para el admin de la óptica (Reportes) y el superadmin — el
-- envío público pasa siempre por la función SECURITY DEFINER de abajo,
-- nunca por una policy de insert directa (ver nota en migración 0027 sobre
-- por qué "with check(true)" no es seguro para escritura pública real).
create policy respuestas_satisfaccion_admin_select on respuestas_satisfaccion
  for select
  using (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy respuestas_satisfaccion_superadmin_all on respuestas_satisfaccion
  for all using (es_superadmin()) with check (es_superadmin());

-- ── enviar_encuesta_satisfaccion: llamado por la página pública de la
--    encuesta. cita_id (uuid v4) hace de token, igual que
--    confirmar_asistencia_cita — de un solo uso funcional gracias al
--    índice único sobre cita_id (un segundo intento no rompe nada, solo no
--    inserta de nuevo).
create or replace function public.enviar_encuesta_satisfaccion(
  p_cita_id uuid,
  p_puntaje smallint,
  p_comentario text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica_id uuid;
begin
  if p_puntaje < 1 or p_puntaje > 5 then
    raise exception 'El puntaje debe estar entre 1 y 5.';
  end if;

  select optica_id into v_optica_id from citas where id = p_cita_id;
  if v_optica_id is null then
    return false;
  end if;

  insert into respuestas_satisfaccion (optica_id, cita_id, puntaje, comentario)
  values (v_optica_id, p_cita_id, p_puntaje, left(nullif(trim(p_comentario), ''), 500))
  on conflict (cita_id) do nothing;

  return found;
end;
$$;

revoke all on function public.enviar_encuesta_satisfaccion(uuid, smallint, text) from public;
grant execute on function public.enviar_encuesta_satisfaccion(uuid, smallint, text) to anon;

-- ── Trigger: al marcar una cita "Atendida" (desde Citas.jsx), manda el
--    correo con el link de la encuesta. No es un cron — reacciona al
--    instante sobre el mismo update que ya hace el optómetra, sin paso
--    manual nuevo. Si Vault no tiene las claves todavía, no hace nada
--    (mismo criterio que enviar_recordatorios_citas).
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

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Encuestas <onboarding@resend.dev>',
      'to', jsonb_build_array(v_correo),
      'subject', '¿Cómo te fue en ' || v_optica_nombre || '?',
      'html', v_html
    )
  );

  update citas set encuesta_enviada_at = now() where id = new.id;
  return new;
end;
$$;

create trigger trigger_encuesta_satisfaccion
  after update of estado on citas
  for each row
  execute function public.notificar_encuesta_satisfaccion();
