-- 0122 · «Ofrecer ayuda» como una conversación de soporte iniciada por el superadmin.
--
-- Hoy publicaba un aviso (un anuncio de una sola vía): el administrador no podía responder, no quedaba registro de qué pasó y se podía repetir sin límite.
-- Ahora es una CONSULTA de Soporte «Iniciada por el soporte», con su número, su módulo y la guía como DATO (`ayuda_modulo`), no como una dirección escrita:
--
--   1. `soporte_consultas.iniciada_por` ('optica' | 'soporte') y `ayuda_modulo` (el módulo de uso del que se ofrece ayuda: la guía se abre en el sistema
--      donde esté, sin enlaces con dominio). El tipo nuevo `ayuda` es el de estas consultas (no aparece al escribir una consulta).
--   2. `ayudas_ofrecidas`: el registro de cada ayuda ofrecida (qué módulo, a qué óptica, cuándo, en qué consulta). De ahí salen «Ayuda ofrecida el …» y el
--      límite: no se vuelve a ofrecer ayuda con un módulo hasta 30 días después.
--   3. `modulos_no_usados`: los módulos que el administrador de la óptica marcó con «No usamos este módulo». Dejan de contarse como «sin uso», salen de
--      «Requiere tu atención» y no se les vuelve a ofrecer ayuda. El administrador lo deshace desde Configuración (`volver_a_usar_modulo`).
--   4. El mismo límite de 2000 caracteres en TODO mensaje del sistema (al soporte, del soporte, a un administrador, avisos): un disparador que lo valida en el
--      servidor y dice «El mensaje es demasiado largo (máximo 2000 caracteres)», escribiendo por la pantalla o directo por la API. Los mensajes anteriores no se tocan.
--   5. Funciones (todo lo valida el servidor): `ofrecer_ayuda` (solo el superadmin), `no_usamos_modulo` y `volver_a_usar_modulo` (solo el administrador de esa
--      óptica) y `marcar_consulta_soporte_leida`, que ahora también deja que el administrador lea una oferta de ayuda (baja la campanita).
--
-- Privacidad (regla 44): ofrecer ayuda no lee ningún dato del negocio ni de los pacientes; solo escribe en Soporte.
-- El administrador de la óptica ve la oferta (la política de lectura de Soporte ya le deja ver todas las consultas de su óptica); el personal que no es
-- administrador no la ve.
--
-- Reversión: drop trigger soporte_mensajes_largo on soporte_mensajes (y soporte_consultas_largo, avisos_internos_largo, mensajes_anuncio_largo); drop function _limitar_largo_mensaje();
--            drop function ofrecer_ayuda(uuid, text, text), no_usamos_modulo(uuid), volver_a_usar_modulo(text); drop table modulos_no_usados, ayudas_ofrecidas;
--            alter table soporte_consultas drop column ayuda_modulo, drop column iniciada_por; (y volver a crear marcar_consulta_soporte_leida como en 0115).

-- 1. Consultas iniciadas por el soporte -------------------------------------------------------------------------------------
alter table public.soporte_consultas
  add column if not exists iniciada_por text not null default 'optica' check (iniciada_por in ('optica', 'soporte')),
  add column if not exists ayuda_modulo text check (ayuda_modulo in ('citas', 'pacientes', 'consultas', 'ventas', 'inventario', 'crm', 'reportes'));

alter table public.soporte_consultas
  add constraint soporte_consultas_ayuda_coherente check (iniciada_por = 'soporte' or ayuda_modulo is null);

-- El tipo `ayuda` (la consulta con la que el soporte ofrece ayuda): se reemplaza la regla de los tipos.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.soporte_consultas'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%problema%'
  loop
    execute format('alter table public.soporte_consultas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.soporte_consultas
  add constraint soporte_consultas_tipo_check check (tipo in ('problema', 'pregunta', 'sugerencia', 'ayuda'));
-- El tipo `ayuda` es solo del soporte: una óptica no puede escribir una consulta de ese tipo.
alter table public.soporte_consultas
  add constraint soporte_consultas_ayuda_del_soporte check (tipo <> 'ayuda' or iniciada_por = 'soporte');

-- 2. Lo que se ofreció y lo que la óptica decidió ---------------------------------------------------------------------------
create table if not exists public.ayudas_ofrecidas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  modulo text not null check (modulo in ('citas', 'pacientes', 'consultas', 'ventas', 'inventario', 'crm', 'reportes')),
  consulta_id uuid references public.soporte_consultas(id) on delete set null,
  ofrecida_por uuid references public.perfiles(id) on delete set null,
  ofrecida_en timestamptz not null default now()
);
create index if not exists ayudas_ofrecidas_idx on public.ayudas_ofrecidas (optica_id, modulo, ofrecida_en desc);

create table if not exists public.modulos_no_usados (
  optica_id uuid not null references public.opticas(id) on delete cascade,
  modulo text not null check (modulo in ('citas', 'pacientes', 'consultas', 'ventas', 'inventario', 'crm', 'reportes')),
  marcado_por uuid references public.perfiles(id) on delete set null,
  marcado_nombre text,
  marcado_en timestamptz not null default now(),
  primary key (optica_id, modulo)
);

alter table public.ayudas_ofrecidas enable row level security;
alter table public.modulos_no_usados enable row level security;
revoke all on public.ayudas_ofrecidas, public.modulos_no_usados from anon, authenticated;
grant select on public.ayudas_ofrecidas, public.modulos_no_usados to authenticated;

create policy ayudas_ofrecidas_superadmin on public.ayudas_ofrecidas for select using (es_superadmin());
create policy modulos_no_usados_superadmin on public.modulos_no_usados for select using (es_superadmin());
create policy modulos_no_usados_admin on public.modulos_no_usados for select
  using (optica_id = (select p.optica_id from public.perfiles p where p.id = auth.uid()) and optica_activa_actual() and _es_admin_optica_actual());
create policy exige_aal2_si_mfa_activo on public.ayudas_ofrecidas as restrictive for all using (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.modulos_no_usados as restrictive for all using (mfa_satisfecho());

-- 3. El superadmin ofrece ayuda ------------------------------------------------------------------------------------------------
create or replace function public.ofrecer_ayuda(p_optica uuid, p_modulo text, p_mensaje text)
returns table (id uuid, numero integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_n integer;
  v_nombre text;
  v_ultima timestamptz;
  v_nombres constant jsonb := '{"citas":"Citas médicas","pacientes":"Pacientes","consultas":"Ficha clínica","ventas":"Ventas","inventario":"Inventario","crm":"CRM y fidelización","reportes":"Reportes"}';
begin
  if not es_superadmin() then
    raise exception 'Solo el soporte puede ofrecer ayuda.';
  end if;
  if p_modulo is null or not (v_nombres ? p_modulo) then
    raise exception 'Módulo desconocido.';
  end if;
  if btrim(coalesce(p_mensaje, '')) = '' then
    raise exception 'Escribe el mensaje para la óptica.';
  end if;
  if char_length(btrim(p_mensaje)) > 2000 then
    raise exception 'El mensaje es demasiado largo (máximo 2000 caracteres).';
  end if;
  perform 1 from public.opticas o where o.id = p_optica and o.activa;
  if not found then
    raise exception 'La óptica no existe o está suspendida.';
  end if;
  if exists (select 1 from public.modulos_no_usados m where m.optica_id = p_optica and m.modulo = p_modulo) then
    raise exception 'La óptica indicó que no usa este módulo: no se le ofrece ayuda.';
  end if;
  select max(a.ofrecida_en) into v_ultima from public.ayudas_ofrecidas a where a.optica_id = p_optica and a.modulo = p_modulo;
  if v_ultima is not null and v_ultima > now() - interval '30 days' then
    raise exception 'Ya se ofreció ayuda con este módulo el %. Podrás volver a ofrecerla el %.',
      to_char(v_ultima at time zone 'America/Guayaquil', 'DD/MM/YYYY'), to_char((v_ultima + interval '30 days') at time zone 'America/Guayaquil', 'DD/MM/YYYY');
  end if;

  v_nombre := _nombre_de_quien_llama();
  -- La consulta queda con el soporte (destino superadmin) y «Respondida»: el soporte habló último y la óptica tiene la palabra. No cuenta como una respuesta
  -- del soporte a una pregunta (sin «primera respuesta»), así que no altera los tiempos de atención.
  insert into public.soporte_consultas (id, optica_id, autor_id, autor_nombre, autor_rol, modulo, tipo, urgencia, asunto, descripcion, estado, destino,
                                        ultimo_mensaje_de, respuesta_sin_leer, iniciada_por, ayuda_modulo)
  values (v_id, p_optica, auth.uid(), v_nombre, 'Soporte', case p_modulo when 'consultas' then 'pacientes' else p_modulo end, 'ayuda', 'normal',
          'Ayuda con ' || (v_nombres ->> p_modulo), left(btrim(p_mensaje), 2000), 'respondida', 'superadmin', 'soporte', true, 'soporte', p_modulo)
  returning soporte_consultas.numero into v_n;

  insert into public.soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo)
  values (v_id, p_optica, auth.uid(), v_nombre, 'soporte', left(btrim(p_mensaje), 2000));

  insert into public.ayudas_ofrecidas (optica_id, modulo, consulta_id, ofrecida_por) values (p_optica, p_modulo, v_id, auth.uid());

  return query select v_id, v_n;
end;
$$;
revoke all on function public.ofrecer_ayuda(uuid, text, text) from public, anon;
grant execute on function public.ofrecer_ayuda(uuid, text, text) to authenticated;

-- 4. El administrador de la óptica decide ---------------------------------------------------------------------------------------
create or replace function public.no_usamos_modulo(p_consulta uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c public.soporte_consultas%rowtype;
  v_nombre text := _nombre_de_quien_llama();
begin
  if not _es_admin_optica_actual() then
    raise exception 'Solo el administrador puede indicar que no usan un módulo.';
  end if;
  v_c := _consulta_visible_soporte(p_consulta, v_optica);
  if v_c.iniciada_por <> 'soporte' or v_c.ayuda_modulo is null then
    raise exception 'Esta consulta no es una oferta de ayuda.';
  end if;

  insert into public.modulos_no_usados (optica_id, modulo, marcado_por, marcado_nombre)
  values (v_optica, v_c.ayuda_modulo, auth.uid(), v_nombre)
  on conflict (optica_id, modulo) do nothing;

  insert into public.soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo)
  values (p_consulta, v_optica, auth.uid(), v_nombre, 'admin', 'No usamos este módulo, así que no necesitamos ayuda con él.');

  update public.soporte_consultas
     set estado = 'resuelta', resuelta_en = coalesce(resuelta_en, now()), ultimo_mensaje_de = 'optica', respuesta_sin_leer = false, actualizada_en = now()
   where id = p_consulta;
end;
$$;
revoke all on function public.no_usamos_modulo(uuid) from public, anon;
grant execute on function public.no_usamos_modulo(uuid) to authenticated;

create or replace function public.volver_a_usar_modulo(p_modulo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_optica uuid := _optica_de_soporte('crear');
begin
  if not _es_admin_optica_actual() then
    raise exception 'Solo el administrador puede deshacer esta decisión.';
  end if;
  delete from public.modulos_no_usados where optica_id = v_optica and modulo = p_modulo;
end;
$$;
revoke all on function public.volver_a_usar_modulo(text) from public, anon;
grant execute on function public.volver_a_usar_modulo(text) to authenticated;

-- 5. Leer una oferta de ayuda baja la campanita ------------------------------------------------------------------------------------
create or replace function public.marcar_consulta_soporte_leida(p_consulta uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('ver');
begin
  update soporte_consultas set respuesta_sin_leer = false
   where id = p_consulta and optica_id = v_optica and respuesta_sin_leer
     and (autor_id = auth.uid() or (iniciada_por = 'soporte' and _es_admin_optica_actual()));
end;
$function$;

-- 6. El mismo límite en todo mensaje: 2000 caracteres ----------------------------------------------------------------------------------
-- Las funciones de Soporte recortaban a 4000 en silencio y las tablas aceptaban hasta 4000: ahora el servidor rechaza lo que pase de 2000 con un mensaje claro.
-- Solo para lo nuevo (insert): lo que ya está escrito no se toca. Cubre: lo que escribe el personal o el administrador a Soporte (consulta y respuestas), lo que
-- responde y ofrece el soporte, los avisos que publica el administrador y los avisos del superadmin.
create or replace function public._limitar_largo_mensaje()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if char_length(btrim(coalesce(to_jsonb(new) ->> tg_argv[0], ''))) > 2000 then
    raise exception 'El mensaje es demasiado largo (máximo 2000 caracteres).';
  end if;
  return new;
end;
$$;
create trigger soporte_mensajes_largo before insert on public.soporte_mensajes for each row execute function public._limitar_largo_mensaje('cuerpo');
create trigger soporte_consultas_largo before insert on public.soporte_consultas for each row execute function public._limitar_largo_mensaje('descripcion');
create trigger avisos_internos_largo before insert on public.avisos_internos for each row execute function public._limitar_largo_mensaje('cuerpo');
create trigger mensajes_anuncio_largo before insert on public.mensajes for each row when (new.tipo = 'anuncio') execute function public._limitar_largo_mensaje('cuerpo');
