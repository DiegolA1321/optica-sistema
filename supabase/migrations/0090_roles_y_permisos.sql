-- Bloque D, paso D1 (reunión 29 sept., R46-R50 y R51 en parte): roles separados
-- de usuarios, permisos por nivel, varios roles por persona, alcance de datos y
-- desactivar usuarios en lugar de eliminarlos.
--
-- ESTA MIGRACIÓN NO CAMBIA LO QUE NADIE PUEDE HACER HOY: solo crea el modelo y
-- traslada los permisos actuales a roles equivalentes. Endurecer la base por
-- nivel (ver / crear / editar / eliminar) y el alcance "solo lo propio" son
-- pasos posteriores (0091 y 0092), cada uno con su aprobación.
--
-- Modelo:
--   * roles: por óptica. Predefinidos (Optómetra, Recepción, Ventas): se pueden
--     editar pero no eliminar. Propios: los crea el administrador y sí se
--     pueden eliminar (si nadie los usa).
--   * permisos de un rol: por módulo, una lista de niveles
--     (ver, crear, editar, eliminar). Todo nivel implica "ver".
--   * alcance de un rol: por módulo (citas, consultas, reportes) "todo" o "propio".
--   * perfil_roles: una persona puede tener varios roles; sus permisos se suman
--     y el alcance es el más amplio.
--   * El administrador de la óptica (perfiles.rol = 'admin') siempre tiene todos
--     los permisos; "Administrador" es una vista, no un rol editable.
--   * perfiles.permisos (booleanos por módulo) queda como respaldo: solo se usa
--     si una persona no tiene ningún rol. La migración le da un rol a cada
--     asistente, así que nadie queda fuera.
--   * Desactivar: perfiles.activo. Una persona desactivada pierde el acceso a
--     los datos de inmediato (optica_activa_actual() pasa a ser falso para ella),
--     conserva su historial ("Asignado a", "Atendido por") y se puede reactivar.
--
-- Módulos y niveles disponibles (el catálogo vive en _catalogo_permisos()):
--   pacientes, ventas, inventario, crm: ver, crear, editar, eliminar
--   consultas (ficha clínica), citas: ver, crear, editar
--   horario, configuracion: ver, editar      mensajes: ver, crear      reportes: ver
--   ("ventas" es nuevo: hoy quien vende se identifica por tener inventario,
--    pacientes o consultas; la migración lo traslada con esa misma regla.)

-- ════════════════════════════════════════════════════════════════
-- Catálogo de módulos y niveles
-- ════════════════════════════════════════════════════════════════
create or replace function public._catalogo_permisos()
returns jsonb
language sql
immutable
as $$
  select '{
    "pacientes":    ["ver","crear","editar","eliminar"],
    "consultas":    ["ver","crear","editar"],
    "citas":        ["ver","crear","editar"],
    "ventas":       ["ver","crear","editar","eliminar"],
    "inventario":   ["ver","crear","editar","eliminar"],
    "crm":          ["ver","crear","editar","eliminar"],
    "reportes":     ["ver"],
    "horario":      ["ver","editar"],
    "mensajes":     ["ver","crear"],
    "configuracion":["ver","editar"]
  }'::jsonb;
$$;
revoke all on function public._catalogo_permisos() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Desactivar usuarios
-- ════════════════════════════════════════════════════════════════
alter table public.perfiles
  add column activo boolean not null default true,
  add column desactivado_en timestamptz,
  add column desactivado_por uuid references public.perfiles(id) on delete set null,
  add column motivo_desactivacion text;

-- Nadie puede cambiar su propio estado de activación (se suma a lo que ya estaba protegido).
create or replace function public.perfiles_bloquea_columnas_reservadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from perfiles where id = auth.uid() and rol = 'superadmin'
  ) then
    return new;
  end if;

  -- Solo se restringe la AUTOedición (old.id = quien ejecuta). La edición de
  -- un asistente por su admin es una fila distinta y no pasa por acá.
  if old.id = auth.uid() then
    if new.rol is distinct from old.rol
      or new.optica_id is distinct from old.optica_id
      or new.permisos is distinct from old.permisos
      or new.email is distinct from old.email
      -- es_optometra solo puede cambiar al valor que dan sus roles (lo escribe la sincronización,
      -- también cuando el administrador se asigna un rol a sí mismo)
      or (new.es_optometra is distinct from old.es_optometra and new.es_optometra is distinct from _es_optometra_por_roles(old.id))
      or new.etiqueta_rol is distinct from old.etiqueta_rol
      or new.cedula is distinct from old.cedula
      or new.activo is distinct from old.activo
      or new.desactivado_en is distinct from old.desactivado_en
      or new.desactivado_por is distinct from old.desactivado_por
      or new.motivo_desactivacion is distinct from old.motivo_desactivacion
    then
      raise exception 'No puedes modificar tu rol, óptica, permisos, correo, etiqueta, cédula ni tu estado desde tu propio perfil.';
    end if;
  end if;

  return new;
end;
$$;

-- Una persona desactivada deja de pasar el filtro de "óptica activa" que usan
-- casi todas las políticas: pierde el acceso a los datos de inmediato.
create or replace function public.optica_activa_actual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select o.activa and p.activo from perfiles p join opticas o on o.id = p.optica_id where p.id = auth.uid()),
    false
  );
$$;

-- ════════════════════════════════════════════════════════════════
-- Roles y asignaciones
-- ════════════════════════════════════════════════════════════════
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  clave text check (clave in ('optometra', 'recepcion', 'ventas')),
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  descripcion text,
  es_predefinido boolean not null default false,
  atiende_pacientes boolean not null default false,
  permisos jsonb not null default '{}'::jsonb,
  alcance jsonb not null default '{}'::jsonb,
  inicio text not null default 'general' check (inicio in ('general', 'optometra', 'recepcion', 'ventas')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_predefinido_con_clave check (es_predefinido = (clave is not null))
);
create unique index roles_nombre_unico on public.roles (optica_id, lower(btrim(nombre)));
create unique index roles_clave_unica on public.roles (optica_id, clave) where clave is not null;

create table public.perfil_roles (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  rol_id uuid not null references public.roles(id) on delete restrict,
  asignado_por uuid references public.perfiles(id) on delete set null,
  asignado_en timestamptz not null default now(),
  primary key (perfil_id, rol_id)
);
create index perfil_roles_rol_idx on public.perfil_roles (rol_id);

-- Valida y normaliza un rol: módulos y niveles del catálogo, "ver" implícito, alcance permitido.
create or replace function public.roles_valida()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cat jsonb := _catalogo_permisos();
  v_modulo text;
  v_niveles jsonb;
  v_nivel text;
  v_limpios jsonb := '{}'::jsonb;
  v_lista text[];
begin
  if jsonb_typeof(new.permisos) <> 'object' or jsonb_typeof(new.alcance) <> 'object' then
    raise exception 'Los permisos y el alcance del rol no son válidos.';
  end if;
  for v_modulo, v_niveles in select * from jsonb_each(new.permisos) loop
    if not v_cat ? v_modulo then
      raise exception 'Módulo desconocido en los permisos: %.', v_modulo;
    end if;
    if jsonb_typeof(v_niveles) <> 'array' then
      raise exception 'Los niveles de "%" deben ser una lista.', v_modulo;
    end if;
    v_lista := '{}';
    for v_nivel in select jsonb_array_elements_text(v_niveles) loop
      if not (v_cat -> v_modulo) @> to_jsonb(v_nivel) then
        raise exception 'El nivel "%" no existe para el módulo "%".', v_nivel, v_modulo;
      end if;
      v_lista := v_lista || v_nivel;
    end loop;
    if cardinality(v_lista) > 0 then
      -- cualquier nivel implica poder ver
      v_limpios := v_limpios || jsonb_build_object(v_modulo, (select jsonb_agg(l order by array_position(array['ver','crear','editar','eliminar'], l)) from (select distinct unnest(v_lista || 'ver'::text) l) s));
    end if;
  end loop;
  new.permisos := v_limpios;
  for v_modulo, v_nivel in select key, value #>> '{}' from jsonb_each(new.alcance) loop
    if v_modulo not in ('citas', 'consultas', 'reportes') then
      raise exception 'El alcance solo se define para citas, consultas y reportes.';
    end if;
    if v_nivel not in ('todo', 'propio') then
      raise exception 'El alcance debe ser "todo" o "propio".';
    end if;
  end loop;
  new.nombre := btrim(new.nombre);
  new.updated_at := now();
  return new;
end;
$$;
create trigger roles_valida_trigger before insert or update on public.roles
  for each row execute function public.roles_valida();

-- Un rol predefinido no se elimina (se puede editar y restaurar).
create or replace function public.roles_protege_predefinidos()
returns trigger
language plpgsql
as $$
begin
  if old.es_predefinido and exists (select 1 from opticas where id = old.optica_id) then
    raise exception 'Un rol predefinido no se puede eliminar; puedes editarlo.';
  end if;
  return old;
end;
$$;
create trigger roles_protege_predefinidos_trigger before delete on public.roles
  for each row execute function public.roles_protege_predefinidos();

-- El rol y la persona deben ser de la misma óptica.
create or replace function public.perfil_roles_valida()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_perfil_optica uuid;
  v_rol_optica uuid;
begin
  select optica_id into v_perfil_optica from perfiles where id = new.perfil_id;
  select optica_id into v_rol_optica from roles where id = new.rol_id;
  if v_perfil_optica is null or v_perfil_optica is distinct from v_rol_optica then
    raise exception 'El rol y la persona deben ser de la misma óptica.';
  end if;
  return new;
end;
$$;
create trigger perfil_roles_valida_trigger before insert on public.perfil_roles
  for each row execute function public.perfil_roles_valida();

-- es_optometra (quien atiende pacientes) pasa a derivarse de los roles: si algún
-- rol de la persona "atiende pacientes", es optómetra.
create or replace function public._es_optometra_por_roles(p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfil_roles pr join roles r on r.id = pr.rol_id
    where pr.perfil_id = p_perfil and r.atiende_pacientes
  );
$$;
revoke all on function public._es_optometra_por_roles(uuid) from public, anon, authenticated;

create or replace function public.sincronizar_es_optometra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := coalesce(new.perfil_id, old.perfil_id);
begin
  update perfiles set es_optometra = _es_optometra_por_roles(v_perfil) where id = v_perfil;
  return null;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- Seguridad de las tablas nuevas: lectura para el equipo de la óptica,
-- escritura solo del administrador, mismo candado de segundo factor.
-- ════════════════════════════════════════════════════════════════
alter table public.roles enable row level security;
alter table public.perfil_roles enable row level security;

create policy roles_equipo_select on public.roles for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()));
create policy roles_admin_write on public.roles for all
  using (optica_id = optica_id_admin_actual() and optica_activa_actual())
  with check (optica_id = optica_id_admin_actual() and optica_activa_actual());
create policy roles_superadmin_all on public.roles for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.roles as restrictive for all
  using (mfa_satisfecho()) with check (mfa_satisfecho());

create policy perfil_roles_select on public.perfil_roles for select
  using (
    perfil_id = auth.uid()
    or exists (select 1 from public.perfiles p where p.id = perfil_roles.perfil_id and p.optica_id = optica_id_admin_actual())
  );
create policy perfil_roles_admin_write on public.perfil_roles for all
  using (exists (select 1 from public.perfiles p where p.id = perfil_roles.perfil_id and p.optica_id = optica_id_admin_actual()) and optica_activa_actual())
  with check (exists (select 1 from public.perfiles p where p.id = perfil_roles.perfil_id and p.optica_id = optica_id_admin_actual()) and optica_activa_actual());
create policy perfil_roles_superadmin_all on public.perfil_roles for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.perfil_roles as restrictive for all
  using (mfa_satisfecho()) with check (mfa_satisfecho());

-- ════════════════════════════════════════════════════════════════
-- Plantillas de roles predefinidos
-- ════════════════════════════════════════════════════════════════
create or replace function public._plantilla_rol(p_clave text)
returns jsonb
language sql
immutable
as $$
  select case p_clave
    when 'optometra' then '{
      "nombre": "Optómetra", "atiende": true, "inicio": "optometra",
      "descripcion": "Atiende pacientes: su agenda, la ficha clínica y la receta. Ve el inventario y las ventas sin modificarlos.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver","crear","editar"],"citas":["ver","crear","editar"],
                   "inventario":["ver"],"ventas":["ver"],"crm":["ver"],"reportes":["ver"],"horario":["ver","editar"]},
      "alcance": {"citas":"propio","consultas":"propio","reportes":"propio"}}'::jsonb
    when 'recepcion' then '{
      "nombre": "Recepción", "atiende": false, "inicio": "recepcion",
      "descripcion": "Agenda citas, registra pacientes y cobra. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver"],"citas":["ver","crear","editar"],
                   "ventas":["ver","crear","editar"],"inventario":["ver"],"crm":["ver","crear","editar"],"horario":["ver"]},
      "alcance": {}}'::jsonb
    when 'ventas' then '{
      "nombre": "Ventas", "atiende": false, "inicio": "ventas",
      "descripcion": "Vende, arma proformas, cobra abonos y gestiona las órdenes de laboratorio. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver"],"consultas":["ver"],"citas":["ver"],"ventas":["ver","crear","editar"],
                   "inventario":["ver","crear","editar"],"crm":["ver"],"horario":["ver"]},
      "alcance": {}}'::jsonb
  end;
$$;
revoke all on function public._plantilla_rol(text) from public, anon, authenticated;

create or replace function public.crear_roles_predefinidos(p_optica_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave text;
  v_p jsonb;
begin
  foreach v_clave in array array['optometra', 'recepcion', 'ventas'] loop
    v_p := _plantilla_rol(v_clave);
    insert into roles (optica_id, clave, nombre, descripcion, es_predefinido, atiende_pacientes, permisos, alcance, inicio)
    values (p_optica_id, v_clave, v_p ->> 'nombre', v_p ->> 'descripcion', true, (v_p ->> 'atiende')::boolean, v_p -> 'permisos', v_p -> 'alcance', v_p ->> 'inicio')
    on conflict do nothing;
  end loop;
end;
$$;
revoke all on function public.crear_roles_predefinidos(uuid) from public, anon, authenticated;

create or replace function public.opticas_crea_roles_predefinidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform crear_roles_predefinidos(new.id);
  return new;
end;
$$;
create trigger opticas_roles_predefinidos_trigger after insert on public.opticas
  for each row execute function public.opticas_crea_roles_predefinidos();

-- "Restaurar valores originales" de un rol predefinido.
create or replace function public.restaurar_rol_predefinido(p_rol_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol roles%rowtype;
  v_p jsonb;
begin
  select * into v_rol from roles where id = p_rol_id and optica_id = optica_id_admin_actual();
  if not found or not v_rol.es_predefinido then
    raise exception 'Solo se pueden restaurar los roles predefinidos de tu óptica.';
  end if;
  if not optica_activa_actual() or not mfa_satisfecho() then
    raise exception 'No tienes acceso para hacer este cambio.';
  end if;
  v_p := _plantilla_rol(v_rol.clave);
  update roles
     set nombre = v_p ->> 'nombre', descripcion = v_p ->> 'descripcion', atiende_pacientes = (v_p ->> 'atiende')::boolean,
         permisos = v_p -> 'permisos', alcance = v_p -> 'alcance', inicio = v_p ->> 'inicio'
   where id = p_rol_id;
  return true;
end;
$$;
revoke all on function public.restaurar_rol_predefinido(uuid) from public, anon;
grant execute on function public.restaurar_rol_predefinido(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Permisos efectivos y comprobaciones
-- ════════════════════════════════════════════════════════════════
create or replace function public.permisos_efectivos(p_perfil uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v perfiles%rowtype;
  v_cat jsonb := _catalogo_permisos();
  v_res jsonb := '{}'::jsonb;
  v_modulo text;
  v_legacy boolean;
begin
  select * into v from perfiles where id = p_perfil;
  if not found or not v.activo then
    return '{}'::jsonb;
  end if;
  if v.rol in ('admin', 'superadmin') then
    return v_cat;
  end if;
  if exists (select 1 from perfil_roles where perfil_id = p_perfil) then
    -- varios roles: los permisos se suman
    select coalesce(jsonb_object_agg(s.modulo, s.niveles), '{}'::jsonb) into v_res
    from (
      select u.modulo, jsonb_agg(u.nivel order by array_position(array['ver','crear','editar','eliminar'], u.nivel)) as niveles
      from (
        select distinct e.key as modulo, l.nivel
        from perfil_roles pr
        join roles r on r.id = pr.rol_id
        cross join lateral jsonb_each(r.permisos) as e
        cross join lateral jsonb_array_elements_text(e.value) as l(nivel)
        where pr.perfil_id = p_perfil
      ) u
      group by u.modulo
    ) s;
    return v_res;
  end if;
  -- Respaldo (persona sin roles): los booleanos de siempre; verdadero = todos los niveles del módulo
  for v_modulo in select jsonb_object_keys(v_cat) loop
    v_legacy := case v_modulo
      when 'ventas' then coalesce((v.permisos ->> 'inventario')::boolean, false) or coalesce((v.permisos ->> 'pacientes')::boolean, false) or coalesce((v.permisos ->> 'consultas')::boolean, false)
      else coalesce((v.permisos ->> v_modulo)::boolean, false)
    end;
    if v_legacy then
      v_res := v_res || jsonb_build_object(v_modulo, v_cat -> v_modulo);
    end if;
  end loop;
  return v_res;
end;
$$;
revoke all on function public.permisos_efectivos(uuid) from public, anon;
grant execute on function public.permisos_efectivos(uuid) to authenticated;

create or replace function public.tiene_permiso(p_modulo text, p_nivel text default 'ver')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((permisos_efectivos(auth.uid()) -> p_modulo) @> to_jsonb(p_nivel), false);
$$;
revoke all on function public.tiene_permiso(text, text) from public, anon;
grant execute on function public.tiene_permiso(text, text) to authenticated;

-- La función de siempre (misma firma, sin sobrecarga): ahora lee los roles. Para quien
-- ya tenía el módulo, "ver" equivale a lo que antes era "tener el módulo".
create or replace function public.tiene_permiso_modulo(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select tiene_permiso(p_modulo, 'ver');
$$;

-- Alcance de los datos de un módulo para quien llama: 'todo' o 'propio' (el más amplio entre sus roles).
create or replace function public.alcance_efectivo(p_modulo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select rol from perfiles where id = auth.uid()) in ('admin', 'superadmin') then 'todo'
    when not exists (select 1 from perfil_roles pr join roles r on r.id = pr.rol_id where pr.perfil_id = auth.uid() and r.permisos ? p_modulo) then 'todo'
    when exists (
      select 1 from perfil_roles pr join roles r on r.id = pr.rol_id
      where pr.perfil_id = auth.uid() and r.permisos ? p_modulo and coalesce(r.alcance ->> p_modulo, 'todo') = 'todo'
    ) then 'todo'
    else 'propio'
  end;
$$;
revoke all on function public.alcance_efectivo(text) from public, anon;
grant execute on function public.alcance_efectivo(text) to authenticated;

-- Todo lo que la aplicación necesita saber de quien entró, en una sola llamada.
create or replace function public.mis_permisos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v perfiles%rowtype;
  v_modulo text;
  v_alcance jsonb := '{}'::jsonb;
begin
  select * into v from perfiles where id = auth.uid();
  if not found then
    return null;
  end if;
  foreach v_modulo in array array['citas', 'consultas', 'reportes'] loop
    v_alcance := v_alcance || jsonb_build_object(v_modulo, alcance_efectivo(v_modulo));
  end loop;
  return jsonb_build_object(
    'activo', v.activo,
    'rol', v.rol,
    'permisos', permisos_efectivos(auth.uid()),
    'alcance', v_alcance,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'inicio', r.inicio, 'atiende', r.atiende_pacientes,
                                          'alcance', r.alcance) order by r.nombre)
      from perfil_roles pr join roles r on r.id = pr.rol_id where pr.perfil_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.mis_permisos() from public, anon;
grant execute on function public.mis_permisos() to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Desactivar y reactivar (solo el administrador; nunca a sí mismo ni a otro administrador)
-- ════════════════════════════════════════════════════════════════
create or replace function public.desactivar_usuario(p_perfil_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_id_admin_actual();
  v_p perfiles%rowtype;
  v_citas integer;
begin
  if v_optica is null or not optica_activa_actual() or not mfa_satisfecho() then
    raise exception 'Solo el administrador puede desactivar usuarios.';
  end if;
  select * into v_p from perfiles where id = p_perfil_id and optica_id = v_optica;
  if not found then
    raise exception 'La persona no existe.';
  end if;
  if v_p.id = auth.uid() then
    raise exception 'No puedes desactivar tu propia cuenta.';
  end if;
  if v_p.rol <> 'asistente' then
    raise exception 'Solo se pueden desactivar cuentas del personal.';
  end if;
  update perfiles
     set activo = false, desactivado_en = now(), desactivado_por = auth.uid(), motivo_desactivacion = nullif(btrim(p_motivo), '')
   where id = p_perfil_id;
  -- Citas futuras que quedan asignadas a esta persona (para que el administrador las reasigne)
  select count(*) into v_citas from citas_base
   where optica_id = v_optica and asignado_a = p_perfil_id and fecha >= current_date and estado in ('Pendiente', 'En Espera');
  return jsonb_build_object('citas_futuras_asignadas', v_citas);
end;
$$;
revoke all on function public.desactivar_usuario(uuid, text) from public, anon;
grant execute on function public.desactivar_usuario(uuid, text) to authenticated;

create or replace function public.reactivar_usuario(p_perfil_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_id_admin_actual();
begin
  if v_optica is null or not optica_activa_actual() or not mfa_satisfecho() then
    raise exception 'Solo el administrador puede reactivar usuarios.';
  end if;
  update perfiles
     set activo = true, desactivado_en = null, desactivado_por = null, motivo_desactivacion = null
   where id = p_perfil_id and optica_id = v_optica and rol = 'asistente';
  if not found then
    raise exception 'La persona no existe.';
  end if;
  return true;
end;
$$;
revoke all on function public.reactivar_usuario(uuid) from public, anon;
grant execute on function public.reactivar_usuario(uuid) to authenticated;

-- El equipo con su estado: la interfaz oculta a los desactivados en los selectores (por ejemplo
-- "Asignado a") pero conserva sus nombres en las citas antiguas.
drop function public.equipo_optica();
create function public.equipo_optica()
returns table (id uuid, nombre text, rol text, es_optometra boolean, activo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.rol, coalesce(p.es_optometra, false), p.activo
  from perfiles yo
  join perfiles p on p.optica_id = yo.optica_id
  where yo.id = auth.uid()
    and yo.rol in ('admin', 'asistente', 'superadmin')
    and p.rol in ('admin', 'asistente')
    and optica_activa_actual()
  order by p.nombre;
$$;
revoke all on function public.equipo_optica() from public, anon;
grant execute on function public.equipo_optica() to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Traslado de lo que existe, sin que nadie pierda acceso
-- ════════════════════════════════════════════════════════════════
-- 1) Roles predefinidos en cada óptica que ya existe.
do $$
declare
  v_o record;
begin
  for v_o in select id from opticas loop
    perform crear_roles_predefinidos(v_o.id);
  end loop;
end;
$$;

-- 2) Cada asistente recibe un rol propio EQUIVALENTE a lo que tiene hoy (los mismos
--    módulos con todos sus niveles; alcance "todo"). Los asistentes con exactamente los
--    mismos permisos comparten ese rol. Después el administrador puede pasarlos a un
--    rol predefinido desde la nueva pantalla.
do $$
declare
  v_grupo record;
  v_cat jsonb := _catalogo_permisos();
  v_permisos jsonb;
  v_modulo text;
  v_activo boolean;
  v_rol uuid;
  v_n integer;
  v_optica uuid := null;
begin
  for v_grupo in
    select a.optica_id,
           a.permisos_norm,
           bool_or(coalesce(a.es_optometra, false)) as atiende,
           array_agg(a.id) as perfiles
    from (
      select p.id, p.optica_id, p.es_optometra,
             (select coalesce(jsonb_object_agg(k, coalesce((p.permisos ->> k)::boolean, false) ), '{}'::jsonb)
                from unnest(array['pacientes','consultas','citas','inventario','crm','reportes','horario','mensajes','configuracion']) k) as permisos_norm
      from perfiles p where p.rol = 'asistente'
    ) a
    group by a.optica_id, a.permisos_norm
    order by a.optica_id
  loop
    v_permisos := '{}'::jsonb;
    for v_modulo in select jsonb_object_keys(v_cat) loop
      v_activo := case v_modulo
        when 'ventas' then coalesce((v_grupo.permisos_norm ->> 'inventario')::boolean, false) or coalesce((v_grupo.permisos_norm ->> 'pacientes')::boolean, false) or coalesce((v_grupo.permisos_norm ->> 'consultas')::boolean, false)
        else coalesce((v_grupo.permisos_norm ->> v_modulo)::boolean, false)
      end;
      if v_activo then
        v_permisos := v_permisos || jsonb_build_object(v_modulo, v_cat -> v_modulo);
      end if;
    end loop;
    select count(*) + 1 into v_n from roles where optica_id = v_grupo.optica_id and not es_predefinido;
    insert into roles (optica_id, nombre, descripcion, es_predefinido, atiende_pacientes, permisos, alcance, inicio)
    values (v_grupo.optica_id,
            case when v_n = 1 then 'Permisos actuales' else 'Permisos actuales ' || v_n end,
            'Creado al pasar al nuevo sistema de roles: conserva exactamente lo que esta persona podía hacer antes.',
            false, v_grupo.atiende, v_permisos, '{}'::jsonb, case when v_grupo.atiende then 'optometra' else 'general' end)
    returning id into v_rol;
    insert into perfil_roles (perfil_id, rol_id)
    select unnest(v_grupo.perfiles), v_rol;
  end loop;
end;
$$;

-- 3) Los administradores que también atienden (es_optometra) reciben el rol Optómetra,
--    para poder cambiar a esa vista. Su acceso no cambia: el administrador siempre tiene todo.
insert into perfil_roles (perfil_id, rol_id)
select p.id, r.id
from perfiles p
join roles r on r.optica_id = p.optica_id and r.clave = 'optometra'
where p.rol = 'admin' and coalesce(p.es_optometra, false)
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════
-- Registro de cambios de permisos (se activa después del traslado, para que
-- el traslado no llene la actividad de la óptica)
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_cambio_permisos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_actor perfiles%rowtype;
  v_accion text;
  v_detalle text;
  v_rol roles%rowtype;
  v_persona text;
begin
  select * into v_actor from perfiles where id = auth.uid();
  if tg_table_name = 'roles' then
    v_rol := case when tg_op = 'DELETE' then old else new end;
    v_optica := v_rol.optica_id;
    -- Al borrar una óptica entera sus roles se borran en cascada: no hay nada que registrar.
    if tg_op = 'DELETE' and not exists (select 1 from opticas where id = v_optica) then
      return null;
    end if;
    v_accion := case tg_op when 'INSERT' then 'Creó un rol' when 'DELETE' then 'Eliminó un rol' else 'Cambió los permisos de un rol' end;
    v_detalle := v_rol.nombre;
    if tg_op = 'UPDATE' and old.permisos = new.permisos and old.alcance = new.alcance and old.nombre = new.nombre and old.inicio = new.inicio and old.atiende_pacientes = new.atiende_pacientes then
      return null;
    end if;
  else
    select p.optica_id, p.nombre into v_optica, v_persona from perfiles p where p.id = coalesce(new.perfil_id, old.perfil_id);
    select * into v_rol from roles where id = coalesce(new.rol_id, old.rol_id);
    v_accion := case tg_op when 'INSERT' then 'Asignó un rol' else 'Quitó un rol' end;
    v_detalle := coalesce(v_rol.nombre, 'rol') || ' · ' || coalesce(v_persona, 'persona');
  end if;
  if v_optica is not null then
    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_optica, v_actor.id, coalesce(v_actor.nombre, 'Sistema'), 'usuarios', v_accion, v_detalle);
  end if;
  return null;
end;
$$;
create trigger roles_registro_trigger after insert or update or delete on public.roles
  for each row execute function public.registrar_cambio_permisos();
create trigger perfil_roles_registro_trigger after insert or delete on public.perfil_roles
  for each row execute function public.registrar_cambio_permisos();
create trigger perfil_roles_es_optometra_trigger after insert or delete on public.perfil_roles
  for each row execute function public.sincronizar_es_optometra();
