-- 0127 · «Agregada a tu calendario» se guarda en la base, por cita
-- Pedido de Diego (18 oct. 2026): hasta hoy el portal anotaba en el navegador que el paciente ya había agregado una cita a su calendario, así que en otro aparato volvía a ofrecerla.
-- Ahora queda en la cita y vale en todos sus aparatos.
--
--   1. citas_base.agregada_calendario_at: cuándo el paciente la agregó a su calendario (null = no). Sin cambios en la vista `citas` ni en las políticas.
--   2. marcar_cita_en_calendario_paciente(paciente, token, cita): la marca, solo en una cita PENDIENTE del propio paciente (idempotente: conserva la primera fecha). Mismo token de sesión.
--   3. mis_citas_detalle_paciente: ahora también entrega `en_calendario_at` (mismo resto que 0125; misma firma, sin duplicar sobrecargas).
--   4. Si la cita cambia de día u hora (el paciente la reagenda o el personal la mueve), la marca se borra: el evento del calendario ya no coincide y se vuelve a ofrecer.

alter table public.citas_base add column if not exists agregada_calendario_at timestamptz;

create or replace function public.citas_base_borrar_marca_calendario()
returns trigger
language plpgsql
as $function$
begin
  if (new.fecha is distinct from old.fecha or new.hora is distinct from old.hora) and new.agregada_calendario_at is not distinct from old.agregada_calendario_at then
    new.agregada_calendario_at := null;
  end if;
  return new;
end;
$function$;
drop trigger if exists citas_base_borrar_marca_calendario on public.citas_base;
create trigger citas_base_borrar_marca_calendario before update of fecha, hora on public.citas_base
  for each row execute function public.citas_base_borrar_marca_calendario();

create or replace function public.marcar_cita_en_calendario_paciente(p_paciente_id uuid, p_token text, p_cita_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;
  update citas_base set agregada_calendario_at = coalesce(agregada_calendario_at, now())
   where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$function$;
revoke all on function public.marcar_cita_en_calendario_paciente(uuid, text, uuid) from public;
grant execute on function public.marcar_cita_en_calendario_paciente(uuid, text, uuid) to anon, authenticated;

create or replace function public.mis_citas_detalle_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cita_id', c.id,
    'profesional', (select pe.nombre from perfiles pe where pe.id = coalesce(c.atendido_por, c.asignado_a)),
    'confirmada_at', c.confirmada_at,
    'consulta_id', (select co.id from consultas_base co where co.cita_id = c.id order by co.created_at desc limit 1),
    'calificacion', (select jsonb_build_object('puntaje', r.puntaje, 'comentario', r.comentario) from respuestas_satisfaccion r where r.cita_id = c.id),
    'en_calendario_at', (select cb.agregada_calendario_at from citas_base cb where cb.id = c.id)
  ) order by c.fecha desc, c.hora desc), '[]'::jsonb)
  from citas c
  where c.paciente_id = p_paciente_id and sesion_paciente_valida(p_paciente_id, p_token);
$function$;
revoke all on function public.mis_citas_detalle_paciente(uuid, text) from public;
grant execute on function public.mis_citas_detalle_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop trigger citas_base_borrar_marca_calendario on citas_base; drop function citas_base_borrar_marca_calendario();
--   drop function marcar_cita_en_calendario_paciente(uuid, text, uuid);
--   Volver a crear mis_citas_detalle_paciente con el cuerpo de 0125; alter table citas_base drop column agregada_calendario_at;
