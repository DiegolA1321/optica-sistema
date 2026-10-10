-- Separa "Mi horario" (el propio) de "Horario de la óptica" (el general).
--
-- Hoy un solo permiso, "horario" (ver, editar), servía para las dos cosas: quien tenía "editar" (el rol Optómetra, por su plantilla)
-- podía cambiar el horario general de la óptica, sus días cerrados y la duración de cada cita, y con eso quitar espacios del portal del
-- paciente. Decisión de Diego (10 oct 2026): el optómetra no cambia el horario general; solo el administrador, o quien se le delegue.
--
-- Después de esta migración:
--   * "horario"          = Mi horario, el propio. Nivel: ver. (Quien lo tiene ve su horario y edita el suyo: esa tabla,
--                          horarios_usuario, solo deja escribir la fila de cada persona, sin ningún permiso extra.)
--   * "horario_optica"   = Horario de la óptica, el general (tabla disponibilidad). Niveles: ver, editar. Solo el administrador lo tiene
--                          siempre; a una persona o rol se le delega con "editar". "Ver" muestra el horario general en lectura.
--
-- Quién conserva qué (nadie pierde nada que deba mantener):
--   * Todo rol que tenía "Mi horario" sigue teniéndolo y gana "Horario de la óptica: ver" (así el horario general sigue visible, como hoy).
--   * Los roles PREDEFINIDOS (Optómetra, Recepción, Ventas) pierden la edición del horario general: solo el Optómetra la tenía.
--   * Los roles PROPIOS (los crea el administrador) que tenían "editar" conservan la edición del horario general: son delegaciones
--     deliberadas. Hoy hay uno: "Permisos actuales" de la Óptica Solna Vision (Leonela).
--   * Una persona sin ningún rol (respaldo con booleanos; hoy no hay ninguna) conserva el horario general si tenía "horario".
-- La base lo hace cumplir: las políticas de disponibilidad pasan a exigir "horario_optica: editar".
--
-- Función con la misma firma que ya existe (create or replace sin crear una segunda): _catalogo_permisos(), _plantilla_rol(text),
-- permisos_efectivos(uuid). El registro de actividad no se llena con "Sistema cambió los permisos de un rol" por cada rol de cada
-- óptica (regla 40): el disparador de registro se apaga solo durante la actualización de datos.

-- ── 1. Catálogo de módulos y niveles ──
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
    "horario":      ["ver"],
    "horario_optica":["ver","editar"],
    "mensajes":     ["ver","crear"],
    "configuracion":["ver","editar"]
  }'::jsonb;
$$;

-- ── 2. Plantillas de los roles predefinidos (también las usa "Restaurar valores originales") ──
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
                   "inventario":["ver"],"ventas":["ver"],"crm":["ver"],"reportes":["ver"],"horario":["ver"],"horario_optica":["ver"]},
      "alcance": {"citas":"propio","consultas":"propio","reportes":"propio"}}'::jsonb
    when 'recepcion' then '{
      "nombre": "Recepción", "atiende": false, "inicio": "recepcion",
      "descripcion": "Agenda citas, registra pacientes y cobra. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver"],"citas":["ver","crear","editar"],
                   "ventas":["ver","crear","editar"],"inventario":["ver"],"crm":["ver","crear","editar"],"horario":["ver"],"horario_optica":["ver"]},
      "alcance": {}}'::jsonb
    when 'ventas' then '{
      "nombre": "Ventas", "atiende": false, "inicio": "ventas",
      "descripcion": "Vende, arma proformas, cobra abonos y gestiona las órdenes de laboratorio. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver"],"consultas":["ver"],"citas":["ver"],"ventas":["ver","crear","editar"],
                   "inventario":["ver","crear","editar"],"crm":["ver"],"horario":["ver"],"horario_optica":["ver"]},
      "alcance": {}}'::jsonb
  end;
$$;

-- ── 3. Permisos efectivos: el respaldo de quien no tiene roles trata el horario general como el horario de siempre ──
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
      when 'horario_optica' then coalesce((v.permisos ->> 'horario')::boolean, false)
      else coalesce((v.permisos ->> v_modulo)::boolean, false)
    end;
    if v_legacy then
      v_res := v_res || jsonb_build_object(v_modulo, v_cat -> v_modulo);
    end if;
  end loop;
  return v_res;
end;
$$;

-- ── 4. Los roles que ya existen (ver el encabezado: quién conserva qué) ──
alter table public.roles disable trigger roles_registro_trigger;
update public.roles r
   set permisos = (r.permisos - 'horario')
         || jsonb_build_object('horario', '["ver"]'::jsonb)
         || jsonb_build_object('horario_optica',
              case when not r.es_predefinido and (r.permisos -> 'horario') @> '"editar"'::jsonb
                   then '["ver","editar"]'::jsonb
                   else '["ver"]'::jsonb end)
 where r.permisos ? 'horario';
alter table public.roles enable trigger roles_registro_trigger;

-- ── 5. La base lo exige: escribir el horario general pide "Horario de la óptica: editar" ──
drop policy disponibilidad_insert on public.disponibilidad;
drop policy disponibilidad_update on public.disponibilidad;
drop policy disponibilidad_delete on public.disponibilidad;
create policy disponibilidad_insert on public.disponibilidad for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario_optica', 'editar')));
create policy disponibilidad_update on public.disponibilidad for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario_optica', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario_optica', 'editar')));
create policy disponibilidad_delete on public.disponibilidad for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario_optica', 'editar')));

-- ── 6. Las ausencias de cada persona ──
-- Una ausencia ("No podré asistir") vive dentro del horario general: disponibilidad.excepciones[fecha].ausencias, con su autor
-- (usuarioId, usuarioNombre). Con el paso 5, quien no puede escribir el horario general tampoco podría registrar su propia ausencia, y
-- se rompería el aviso "estará ausente: N citas por reasignar". Estas dos funciones lo resuelven: cada persona agrega o quita SOLO las
-- suyas, sin ningún permiso sobre el horario general, y no puede tocar nada más del horario ni las ausencias de otra persona.
-- Quien tiene "Horario de la óptica: editar" (el administrador o a quien se le delegue) puede quitar la de cualquiera.
-- El autor lo pone la base (no el navegador), y la lectura/modificación va con la fila bloqueada: dos personas registrando a la vez ya no
-- se pisan (antes el navegador reescribía el horario completo).
create or replace function public.registrar_ausencia(p_fecha date, p_inicio text, p_fin text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_fila disponibilidad%rowtype;
  v_clave text;
  v_dias text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  v_base jsonb;
  v_nueva jsonb;
begin
  select * into v_perfil from perfiles where id = auth.uid();
  if not found or not optica_activa_actual() or not tiene_permiso('horario', 'ver') then
    raise exception 'No tienes acceso para hacer este cambio.';
  end if;
  if p_fecha is null or p_fecha < (now() at time zone 'America/Guayaquil')::date then
    raise exception 'La fecha de la ausencia no puede ser anterior a hoy.';
  end if;
  if p_inicio is null or p_fin is null
     or p_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_fin !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or p_fin <= p_inicio then
    raise exception 'Indica una hora de inicio y una de fin válidas.';
  end if;
  select * into v_fila from disponibilidad where optica_id = v_perfil.optica_id for update;
  if not found then
    raise exception 'La óptica todavía no tiene un horario guardado.';
  end if;
  v_clave := to_char(p_fecha, 'YYYY-MM-DD');
  -- Igual que horarioEfectivo() en la aplicación: la excepción de ese día o, si no hay, el horario normal de ese día de la semana.
  v_base := coalesce(v_fila.excepciones -> v_clave,
                     v_fila.horario_semanal -> v_dias[extract(dow from p_fecha)::int + 1],
                     '{"manana":{"activo":false},"tarde":{"activo":false}}'::jsonb);
  v_nueva := v_base || jsonb_build_object('ausencias',
    coalesce(v_base -> 'ausencias', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('inicio', p_inicio, 'fin', p_fin, 'motivo', coalesce(left(btrim(p_motivo), 200), ''),
                                            'usuarioId', v_perfil.id, 'usuarioNombre', v_perfil.nombre)));
  update disponibilidad
     set excepciones = jsonb_set(excepciones, array[v_clave], v_nueva, true), updated_at = now()
   where optica_id = v_perfil.optica_id;
  return v_nueva;
end;
$$;
revoke all on function public.registrar_ausencia(date, text, text, text) from public, anon;
grant execute on function public.registrar_ausencia(date, text, text, text) to authenticated;

create or replace function public.quitar_ausencia(p_fecha date, p_inicio text, p_fin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_fila disponibilidad%rowtype;
  v_clave text;
  v_dias text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  v_exc jsonb;
  v_normal jsonb;
  v_todas boolean;
  v_pos int;
  v_restantes jsonb;
  v_nueva jsonb;
begin
  select * into v_perfil from perfiles where id = auth.uid();
  if not found or not optica_activa_actual() or not tiene_permiso('horario', 'ver') then
    raise exception 'No tienes acceso para hacer este cambio.';
  end if;
  v_todas := tiene_permiso('horario_optica', 'editar'); -- el administrador o quien tenga el horario de la óptica delegado
  select * into v_fila from disponibilidad where optica_id = v_perfil.optica_id for update;
  v_clave := to_char(p_fecha, 'YYYY-MM-DD');
  v_exc := v_fila.excepciones -> v_clave;
  select t.ord::int into v_pos
    from jsonb_array_elements(coalesce(v_exc -> 'ausencias', '[]'::jsonb)) with ordinality as t(a, ord)
   where t.a ->> 'inicio' = p_inicio and t.a ->> 'fin' = p_fin and (v_todas or t.a ->> 'usuarioId' = v_perfil.id::text)
   order by t.ord limit 1;
  if v_pos is null then
    if exists (select 1 from jsonb_array_elements(coalesce(v_exc -> 'ausencias', '[]'::jsonb)) a where a ->> 'inicio' = p_inicio and a ->> 'fin' = p_fin) then
      raise exception 'Solo puedes quitar tus propias ausencias.';
    end if;
    raise exception 'No se encontró esa ausencia.';
  end if;
  select coalesce(jsonb_agg(t.a order by t.ord), '[]'::jsonb) into v_restantes
    from jsonb_array_elements(v_exc -> 'ausencias') with ordinality as t(a, ord) where t.ord <> v_pos;
  v_normal := v_fila.horario_semanal -> v_dias[extract(dow from p_fecha)::int + 1];
  -- Si la excepción solo existía para cargar esa ausencia (sus horas son las normales de ese día), se borra entera.
  if jsonb_array_length(v_restantes) = 0
     and coalesce(v_exc -> 'manana' = v_normal -> 'manana', false) and coalesce(v_exc -> 'tarde' = v_normal -> 'tarde', false) then
    update disponibilidad set excepciones = excepciones - v_clave, updated_at = now() where optica_id = v_perfil.optica_id;
    return null;
  end if;
  v_nueva := v_exc || jsonb_build_object('ausencias', v_restantes);
  update disponibilidad set excepciones = jsonb_set(excepciones, array[v_clave], v_nueva, true), updated_at = now() where optica_id = v_perfil.optica_id;
  return v_nueva;
end;
$$;
revoke all on function public.quitar_ausencia(date, text, text) from public, anon;
grant execute on function public.quitar_ausencia(date, text, text) to authenticated;
