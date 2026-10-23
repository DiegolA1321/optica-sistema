-- 0145 — «Los que atiende» como alcance de las fichas clínicas, y la cita de cada ficha (Ronda 5, punto 5: Crear rol / Qué datos ve).
--
-- 1. Un rol puede ver las fichas clínicas de tres maneras: «Solo las suyas» (las que atendió, como hasta hoy), «Los que atiende» (todas las fichas de los pacientes que atiende:
--    los que tienen o tuvieron una cita asignada o atendida por esa persona, o una ficha suya) y «Toda la óptica». Nuevo valor 'atiende' en roles.alcance (el valor ausente sigue siendo 'todo',
--    así que ningún rol existente cambia):
--      · alcance_efectivo(modulo) devuelve 'todo', 'atiende' o 'propio' (el más amplio entre los roles de la persona; mismo nombre y firma: create or replace).
--      · paciente_atendido_por_mi(paciente): ayuda de la política de lectura (solo responde sí o no).
--      · roles_valida (el disparador que revisa cada rol al guardarlo) acepta el valor nuevo, solo para las fichas clínicas.
--      · consultas_select deja pasar también las fichas de los pacientes que la persona atiende cuando su alcance es 'atiende'.
--
-- 2. La incoherencia que se encontró: un rol que ve las fichas de toda la óptica pero solo sus propias citas veía fichas de otros sin la cita de esa ficha (ni su fecha ni su estado).
--    La vista `consultas` ahora lleva `cita_resumen` ({ fecha, hora, estado } de la cita de la ficha), que entrega una función definer SOLO con esos tres datos y SOLO de la óptica de quien llama.
--    Las citas en sí siguen con su política (la agenda de esa persona no se llena de citas de otros): solo se ve la fecha y el estado de la cita de una ficha que ya puede ver.
--
-- Qué NO cambia: ningún dato, ningún rol existente (ninguno tiene 'atiende'), las citas, las demás políticas ni los permisos. Una óptica nueva no necesita nada.
--
-- Revertir: volver a poner roles_valida, alcance_efectivo y consultas_select de 0090/0093, recrear la vista `consultas` sin cita_resumen y
--   drop function public.paciente_atendido_por_mi(uuid), public.resumen_cita_de_ficha(uuid).

create or replace function public.paciente_atendido_por_mi(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from citas_base c
            where c.paciente_id = p_paciente and c.optica_id = (select optica_id from perfiles where id = auth.uid())
              and (c.asignado_a = auth.uid() or c.atendido_por = auth.uid()))
      or exists (
           select 1 from consultas_base k
            where k.paciente_id = p_paciente and k.optica_id = (select optica_id from perfiles where id = auth.uid()) and k.profesional_id = auth.uid());
$$;
revoke all on function public.paciente_atendido_por_mi(uuid) from public, anon;
grant execute on function public.paciente_atendido_por_mi(uuid) to authenticated;

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
    when exists (
      select 1 from perfil_roles pr join roles r on r.id = pr.rol_id
      where pr.perfil_id = auth.uid() and r.permisos ? p_modulo and r.alcance ->> p_modulo = 'atiende'
    ) then 'atiende'
    else 'propio'
  end;
$$;

-- El disparador que revisa cada rol al guardarlo: igual que antes, con «atiende» aceptado solo en las fichas clínicas.
create or replace function public.roles_valida()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    if v_nivel not in ('todo', 'propio', 'atiende') then
      raise exception 'El alcance debe ser "todo", "propio" o "atiende".';
    end if;
    if v_nivel = 'atiende' and v_modulo <> 'consultas' then
      raise exception 'El alcance «los que atiende» solo existe para las fichas clínicas.';
    end if;
  end loop;
  new.nombre := btrim(new.nombre);
  new.updated_at := now();
  return new;
end;
$function$;

drop policy consultas_select on public.consultas_base;
create policy consultas_select on public.consultas_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('pacientes', 'ver')))
    and ((select alcance_efectivo('consultas')) = 'todo' or profesional_id = auth.uid() or profesional_id is null
         or ((select alcance_efectivo('consultas')) = 'atiende' and (select paciente_atendido_por_mi(paciente_id)))));

-- La fecha, la hora y el estado de la cita de una ficha (nada más), para quien ya ve esa ficha.
create or replace function public.resumen_cita_de_ficha(p_cita uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('fecha', c.fecha, 'hora', c.hora, 'estado', c.estado)
    from citas_base c
   where c.id = p_cita and c.optica_id = (select optica_id from perfiles where id = auth.uid());
$$;
revoke all on function public.resumen_cita_de_ficha(uuid) from public, anon;
grant execute on function public.resumen_cita_de_ficha(uuid) to authenticated;

create or replace view public.consultas with (security_invoker = true) as
 select id,
    optica_id,
    paciente_id,
    paciente,
    fecha,
    motivo,
    usa_lentes,
    descifrar_clinico(antecedentes_enc) as antecedentes,
    descifrar_clinico(alergias_enc) as alergias,
    descifrar_clinico(antecedentes_familiares_enc) as antecedentes_familiares,
    descifrar_clinico(datos_clinicos_enc)::jsonb as datos_clinicos,
    descifrar_clinico(diagnostico_enc) as diagnostico,
    lente_recomendado,
    descifrar_clinico(indicaciones_enc) as indicaciones,
    proximo_control_dias,
    evolucion_calculada,
    estado_correccion,
    producto_id,
    producto_nombre,
    monto_venta,
    profesional_nombre,
    created_at,
    imagenes,
    diagnostico_categorias,
    profesional_registro,
    descifrar_clinico(detalle_consulta_enc) as detalle_consulta,
    cita_id,
    profesional_id,
    public.resumen_cita_de_ficha(cita_id) as cita_resumen
   from public.consultas_base cb;
