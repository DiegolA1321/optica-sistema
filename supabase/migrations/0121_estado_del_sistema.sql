-- 0121 · Estado del sistema (verificaciones reales cada 15 minutos) y uso de un módulo en la óptica.
--
-- Para el Resumen del superadmin (modo de la tesis: una sola óptica):
--   1. `verificaciones_sistema`: una fila por componente y por verificación (Inicio de sesión, Datos, Archivos, Tareas automáticas, Correo).
--      Solo la leen los superadmins; solo la escriben las funciones de abajo (nadie inserta ni borra desde la aplicación).
--   2. `verificar_sistema()`: hace las cinco verificaciones y las guarda. La llama el superadmin ("Verificar ahora") y pg_cron cada 15 minutos.
--      No se reutiliza ninguna tarea programada que ya existe: las cuatro actuales (marcar "No asistió", recordatorios, saludos, limpieza)
--      hacen otra cosa; lo que sí hace esta función es MIRAR cómo les fue a ellas para el componente "Tareas automáticas".
--   3. `estado_sistema()`: lo último de cada componente, el historial de 30 días por día, los fallos recientes y las tareas programadas.
--   4. `personal_de_la_optica(óptica)`: el personal con su rol, su último ingreso y si hizo algo en 30 días (la lista de "Personas activas").
--   5. `uso_de_modulo(óptica, módulo)`: cuándo se usó un módulo en 30 días y qué roles lo usaron. Sin conteos ni datos de pacientes ni del negocio.
--
-- Qué verifica cada componente (todo dentro de la base, con su tiempo):
--   · sesion   → las cuentas de acceso (auth.users) responden y existe al menos una cuenta activa de personal.
--   · datos    → consultas reales a las tablas del sistema.
--   · archivos → el servicio de archivos responde y existen sus 5 carpetas (logos, fotos de productos, adjuntos de consultas, facturas y adjuntos de soporte).
--   · tareas   → cada tarea programada se ejecutó cuando le toca y su última ejecución no falló (pg_cron).
--   · correo   → "No configurado" mientras falte la clave del servicio de correo o un remitente propio con dominio verificado (secreto `correo_remitente`
--                en la bóveda): hoy los envíos salen con el remitente de pruebas de Resend (onboarding@resend.dev), que no entrega a pacientes reales.
--                Configurado, falla si algún envío de las últimas 24 h fue rechazado.
-- Límite conocido: desde SQL no se puede subir ni descargar un archivo de verdad; "Archivos" comprueba el servicio y sus carpetas.
--
-- Reversión: drop function personal_de_la_optica(uuid), uso_de_modulo(uuid, text), estado_sistema(), verificar_sistema(), _registrar_verificacion(...);
--            select cron.unschedule('verificar_sistema'); drop table verificaciones_sistema;

-- 1. La tabla -------------------------------------------------------------------------------------------------------------
create table if not exists public.verificaciones_sistema (
  id bigint generated always as identity primary key,
  componente text not null check (componente in ('sesion', 'datos', 'archivos', 'tareas', 'correo')),
  estado text not null check (estado in ('operativo', 'lento', 'con_fallas', 'no_configurado')),
  latencia_ms integer,
  detalle text,
  referencia_at timestamptz, -- tareas: cuándo fue la última ejecución
  creado_at timestamptz not null default now()
);
create index if not exists verificaciones_sistema_idx on public.verificaciones_sistema (componente, creado_at desc);

alter table public.verificaciones_sistema enable row level security;
revoke all on public.verificaciones_sistema from anon, authenticated;
grant select on public.verificaciones_sistema to authenticated;
create policy verificaciones_sistema_superadmin_select on public.verificaciones_sistema for select using (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.verificaciones_sistema as restrictive for all using (mfa_satisfecho());

-- 2. Guardar una verificación (interna: nadie la llama desde fuera) -----------------------------------------------------------
create or replace function public._registrar_verificacion(p_componente text, p_estado text, p_ms integer, p_detalle text, p_ref timestamptz default null)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.verificaciones_sistema (componente, estado, latencia_ms, detalle, referencia_at)
  values (p_componente, p_estado, p_ms, p_detalle, p_ref);
$$;
revoke all on function public._registrar_verificacion(text, text, integer, text, timestamptz) from public, anon, authenticated;

-- 3. Las cinco verificaciones ------------------------------------------------------------------------------------------------
create or replace function public.verificar_sistema()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t0 timestamptz;
  ms integer;
  v_estado text;
  v_detalle text;
  v_ref timestamptz;
  v_n integer;
  v_clave text;
  v_remitente text;
  r record;
begin
  -- pg_cron entra sin sesión (auth.uid() es null); desde la aplicación solo un superadmin.
  if auth.uid() is not null and not es_superadmin() then
    raise exception 'Solo el superadministrador puede verificar el sistema.';
  end if;

  -- Datos
  begin
    t0 := clock_timestamp();
    perform count(*) from opticas;
    perform 1 from perfiles limit 1;
    ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
    v_estado := case when ms < 800 then 'operativo' when ms < 2500 then 'lento' else 'con_fallas' end;
    v_detalle := null;
  exception when others then
    ms := null; v_estado := 'con_fallas'; v_detalle := 'La base de datos no respondió: ' || sqlerrm;
  end;
  perform public._registrar_verificacion('datos', v_estado, ms, v_detalle);

  -- Inicio de sesión
  begin
    t0 := clock_timestamp();
    perform 1 from auth.users limit 1;
    perform 1 from perfiles where coalesce(activo, true) limit 1;
    ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
    if not found then
      v_estado := 'con_fallas'; v_detalle := 'No hay ninguna cuenta activa que pueda entrar.';
    else
      v_estado := case when ms < 800 then 'operativo' when ms < 2500 then 'lento' else 'con_fallas' end; v_detalle := null;
    end if;
  exception when others then
    ms := null; v_estado := 'con_fallas'; v_detalle := 'El servicio de cuentas no respondió: ' || sqlerrm;
  end;
  perform public._registrar_verificacion('sesion', v_estado, ms, v_detalle);

  -- Archivos
  begin
    t0 := clock_timestamp();
    select count(*) into v_n from storage.buckets
     where id in ('logos', 'consultas-adjuntos', 'productos', 'facturas-electronicas', 'soporte-adjuntos');
    perform 1 from storage.objects limit 1;
    ms := (extract(epoch from clock_timestamp() - t0) * 1000)::integer;
    if v_n < 5 then
      v_estado := 'con_fallas'; v_detalle := format('Faltan carpetas de archivos (hay %s de 5).', v_n);
    else
      v_estado := case when ms < 800 then 'operativo' when ms < 2500 then 'lento' else 'con_fallas' end; v_detalle := null;
    end if;
  exception when others then
    ms := null; v_estado := 'con_fallas'; v_detalle := 'El servicio de archivos no respondió: ' || sqlerrm;
  end;
  perform public._registrar_verificacion('archivos', v_estado, ms, v_detalle);

  -- Tareas automáticas
  begin
    v_estado := 'operativo'; v_detalle := null; v_ref := null;
    for r in
      select j.jobname,
             (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultima,
             (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) as ultimo_estado
        from cron.job j
       where j.active and j.jobname <> 'verificar_sistema'
    loop
      if r.jobname = 'marcar_no_asistio_automatico' then
        v_ref := r.ultima;
        if r.ultima is null or r.ultima < now() - interval '30 minutes' then
          v_estado := 'con_fallas'; v_detalle := 'Marcar "No asistió" no se ejecutó en los últimos 30 minutos.';
        elsif r.ultima < now() - interval '12 minutes' and v_estado = 'operativo' then
          v_estado := 'lento'; v_detalle := 'Marcar "No asistió" se está retrasando (debería correr cada 5 minutos).';
        end if;
      elsif r.ultima is not null and r.ultima < now() - interval '26 hours' then
        v_estado := 'con_fallas'; v_detalle := format('La tarea %s no se ejecutó en más de 26 horas.', r.jobname);
      end if;
      if r.ultimo_estado = 'failed' then
        v_estado := 'con_fallas'; v_detalle := format('La última ejecución de la tarea %s falló.', r.jobname);
      end if;
    end loop;
    ms := null;
  exception when others then
    ms := null; v_estado := 'con_fallas'; v_detalle := 'No se pudo leer el estado de las tareas programadas: ' || sqlerrm; v_ref := null;
  end;
  perform public._registrar_verificacion('tareas', v_estado, ms, v_detalle, v_ref);

  -- Correo
  begin
    select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    select decrypted_secret into v_remitente from vault.decrypted_secrets where name = 'correo_remitente' limit 1;
    if v_clave is null or btrim(v_clave) = '' or v_remitente is null or btrim(v_remitente) = '' then
      v_estado := 'no_configurado'; v_detalle := 'Falta la clave del servicio de correo o un remitente con dominio propio verificado: los correos salen con el remitente de pruebas y no llegan a los pacientes.';
    else
      select count(*) into v_n
        from notificaciones_enviadas n
        join net._http_response h on h.id = n.request_id
       where n.created_at > now() - interval '24 hours' and h.status_code >= 400;
      if v_n > 0 then
        v_estado := 'con_fallas'; v_detalle := format('El servicio de correo rechazó %s envío(s) en las últimas 24 horas.', v_n);
      else
        v_estado := 'operativo'; v_detalle := null;
      end if;
    end if;
  exception when others then
    v_estado := 'con_fallas'; v_detalle := 'No se pudo comprobar el correo: ' || sqlerrm;
  end;
  perform public._registrar_verificacion('correo', v_estado, null, v_detalle);

  -- Se guardan 35 días (el historial se muestra por 30).
  delete from public.verificaciones_sistema where creado_at < now() - interval '35 days';

  return (select coalesce(jsonb_agg(jsonb_build_object('componente', componente, 'estado', estado, 'latencia_ms', latencia_ms, 'detalle', detalle) order by id), '[]'::jsonb)
            from (select * from public.verificaciones_sistema order by id desc limit 5) u);
end;
$$;
revoke all on function public.verificar_sistema() from public, anon;
grant execute on function public.verificar_sistema() to authenticated;

-- 4. Lo que muestra el Resumen -----------------------------------------------------------------------------------------------
create or replace function public.estado_sistema()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ultimos jsonb;
  v_historial jsonb;
  v_fallos jsonb;
  v_tareas jsonb := '[]'::jsonb;
begin
  if not es_superadmin() then
    raise exception 'Solo el superadministrador puede ver esto.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('componente', componente, 'estado', estado, 'latencia_ms', latencia_ms, 'detalle', detalle,
                                               'referencia_at', referencia_at, 'creado_at', creado_at)), '[]'::jsonb)
    into v_ultimos
    from (select distinct on (componente) * from public.verificaciones_sistema order by componente, creado_at desc) u;

  select coalesce(jsonb_agg(jsonb_build_object('componente', componente, 'dia', dia, 'operativo', operativo, 'lento', lento, 'con_fallas', con_fallas,
                                               'no_configurado', no_configurado, 'latencia_media', latencia_media) order by dia, componente), '[]'::jsonb)
    into v_historial
    from (select componente, (creado_at at time zone 'America/Guayaquil')::date as dia,
                 count(*) filter (where estado = 'operativo') as operativo,
                 count(*) filter (where estado = 'lento') as lento,
                 count(*) filter (where estado = 'con_fallas') as con_fallas,
                 count(*) filter (where estado = 'no_configurado') as no_configurado,
                 round(avg(latencia_ms))::integer as latencia_media
            from public.verificaciones_sistema
           where creado_at > now() - interval '30 days'
           group by 1, 2) h;

  select coalesce(jsonb_agg(jsonb_build_object('componente', componente, 'estado', estado, 'detalle', detalle, 'creado_at', creado_at) order by creado_at desc), '[]'::jsonb)
    into v_fallos
    from (select * from public.verificaciones_sistema
           where estado in ('lento', 'con_fallas') and creado_at > now() - interval '30 days'
           order by creado_at desc limit 20) f;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('nombre', j.jobname, 'programacion', j.schedule,
             'ultima_ejecucion', (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
             'ultimo_estado', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1)) order by j.jobname), '[]'::jsonb)
      into v_tareas
      from cron.job j where j.active;
  exception when others then
    v_tareas := '[]'::jsonb;
  end;

  return jsonb_build_object('generado', now(), 'ultimos', v_ultimos, 'historial', v_historial, 'fallos', v_fallos, 'tareas', v_tareas);
end;
$$;
revoke all on function public.estado_sistema() from public, anon;
grant execute on function public.estado_sistema() to authenticated;

-- 5. Uso de un módulo en la óptica: cuándo y qué roles, sin conteos ni datos de pacientes ni del negocio ---------------------------
create or replace function public.uso_de_modulo(p_optica uuid, p_modulo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_dias jsonb;
  v_roles jsonb;
  v_ultimo timestamptz;
begin
  if not es_superadmin() then
    raise exception 'Solo el superadministrador puede ver esto.';
  end if;
  if p_modulo not in ('citas', 'pacientes', 'consultas', 'ventas', 'inventario', 'crm', 'reportes') then
    raise exception 'Módulo desconocido.';
  end if;

  with u as (
    select (l.created_at at time zone 'America/Guayaquil')::date as dia,
           coalesce(nullif(btrim(p.etiqueta_rol), ''), case p.rol when 'admin' then 'Administrador' else 'Asistente' end) as rol
      from logs_optica l
      left join perfiles p on p.id = l.usuario_id
     where l.optica_id = p_optica and l.modulo = p_modulo and l.created_at >= now() - interval '30 days'
  )
  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'roles', roles) order by dia desc), '[]'::jsonb),
         coalesce((select jsonb_agg(distinct rol) from u), '[]'::jsonb)
    into v_dias, v_roles
    from (select dia, jsonb_agg(distinct rol) as roles from u group by dia) d;

  select max(created_at) into v_ultimo from logs_optica where optica_id = p_optica and modulo = p_modulo and created_at >= now() - interval '30 days';
  return jsonb_build_object('dias', v_dias, 'roles', v_roles, 'ultimo', v_ultimo);
end;
$$;
revoke all on function public.uso_de_modulo(uuid, text) from public, anon;
grant execute on function public.uso_de_modulo(uuid, text) to authenticated;

-- 5b. El personal de la óptica: rol (el que le asignó el administrador), último ingreso y si hizo algo en 30 días -----------------------
create or replace function public.personal_de_la_optica(p_optica uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el superadministrador puede ver esto.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'nombre', p.nombre,
             'rol', coalesce(nullif(btrim(p.etiqueta_rol), ''), case p.rol when 'admin' then 'Administrador' else 'Asistente' end),
             'activo', coalesce(p.activo, true),
             'ultimo_ingreso', u.last_sign_in_at,
             'activa_30d', exists (select 1 from logs_optica l where l.usuario_id = p.id and l.optica_id = p_optica and l.created_at >= now() - interval '30 days')
           ) order by p.nombre)
      from perfiles p
      left join auth.users u on u.id = p.id
     where p.optica_id = p_optica and p.rol in ('admin', 'asistente')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.personal_de_la_optica(uuid) from public, anon;
grant execute on function public.personal_de_la_optica(uuid) to authenticated;

-- 6. Cada 15 minutos ----------------------------------------------------------------------------------------------------------
do $$ begin perform cron.unschedule('verificar_sistema'); exception when others then null; end $$;
select cron.schedule('verificar_sistema', '*/15 * * * *', $$select public.verificar_sistema()$$);

-- Primera verificación, para que el Resumen tenga algo que mostrar desde el primer momento.
select public.verificar_sistema();
