-- 0148 — Foto del profesional y datos públicos de «Quiénes somos» (Ingreso y página pública, puntos 8 y 9).
--
-- QUÉ HACE:
--   1. perfiles.foto_url: la foto de quien atiende pacientes. La sube la propia persona (Mi cuenta) o el administrador (Usuarios). Se usa DENTRO del sistema: «Te atiende …» en el agendamiento.
--   2. perfiles.mostrar_en_publica (por defecto NO): solo la propia persona lo activa («Mostrarme en la página pública», en Mi cuenta). Mientras esté apagado, su foto, su nombre y su registro NO
--      salen en «Quiénes somos» de la página pública. El administrador no puede activarlo por ella.
--   3. pagina_publica_datos(óptica): lo que lee la página pública. Optómetras: SOLO quienes activaron «mostrarme» (nombre, registro, foto). Números: solo totales (optómetras que atienden y pacientes
--      con al menos una atención): ningún dato de pacientes, nunca cédula, correo ni teléfono.
--   4. profesionales_agendamiento(óptica): quiénes atienden, para «Te atiende …» y el selector «Profesional» del agendamiento en línea: id, nombre y foto; el registro profesional solo de quien activó
--      «mostrarme». Sin cédula, correo, teléfono ni permisos.
--   5. guardar_mi_foto, guardar_mi_visibilidad_publica y guardar_foto_de (el administrador, solo de su óptica): las únicas vías de escribir esos dos campos; validan que la foto sea del almacenamiento
--      público de logos de su propia óptica. Quien no atiende pacientes no puede activar «mostrarme».
--
-- Los textos, el logo, el color y los servicios/preguntas editables viven en `opticas.marca` (ya editable por el administrador y ya visible en la vista `opticas_publicas`): no necesitan cambio de
-- esquema; una óptica sin esas claves (existente o nueva) recibe los textos de ejemplo desde la aplicación.
--
-- Qué NO cambia: ninguna fila existente (foto vacía y «mostrarme» apagado: la página pública no muestra a nadie hasta que cada persona lo active), ninguna política ni permiso existente. Una óptica nueva
-- no necesita nada.
-- Revertir: drop function pagina_publica_datos(uuid), profesionales_agendamiento(uuid), guardar_mi_foto(text), guardar_mi_visibilidad_publica(boolean), guardar_foto_de(uuid, text);
--   alter table public.perfiles drop column foto_url, drop column mostrar_en_publica.

alter table public.perfiles add column if not exists foto_url text;
alter table public.perfiles add column if not exists mostrar_en_publica boolean not null default false;

create or replace function public.pagina_publica_datos(p_optica_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'optometras', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'registro', p.registro_profesional, 'foto', p.foto_url) order by p.nombre)
        from perfiles p
       where p.optica_id = p_optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false) and p.mostrar_en_publica), '[]'::jsonb),
    'optometrasTotal', (
      select count(*) from perfiles p
       where p.optica_id = p_optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false)),
    'pacientesAtendidos', (
      select count(*) from (
        select paciente_id from citas_base where optica_id = p_optica_id and estado = 'Atendida' and paciente_id is not null
        union
        select paciente_id from consultas_base where optica_id = p_optica_id and paciente_id is not null
      ) t)
  )
  where exists (select 1 from opticas o where o.id = p_optica_id and o.activa);
$$;
revoke all on function public.pagina_publica_datos(uuid) from public;
grant execute on function public.pagina_publica_datos(uuid) to anon, authenticated;

create or replace function public.profesionales_agendamiento(p_optica_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'nombre', p.nombre, 'foto', p.foto_url,
           'registro', case when p.mostrar_en_publica then p.registro_profesional else null end) order by p.nombre), '[]'::jsonb)
    from perfiles p
   where p.optica_id = p_optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false)
     and exists (select 1 from opticas o where o.id = p_optica_id and o.activa);
$$;
revoke all on function public.profesionales_agendamiento(uuid) from public;
grant execute on function public.profesionales_agendamiento(uuid) to anon, authenticated;

-- La foto debe ser del almacenamiento público de logos y de la carpeta de la propia óptica (o vacía = quitarla).
create or replace function public._foto_valida(p_optica uuid, p_foto text)
returns boolean
language sql
immutable
as $$
  select p_foto is null or (length(p_foto) <= 500 and p_foto like '%/storage/v1/object/public/logos/' || p_optica::text || '/%');
$$;
revoke all on function public._foto_valida(uuid, text) from public, anon, authenticated;

create or replace function public.guardar_mi_foto(p_foto_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
begin
  select optica_id into v_optica from perfiles where id = auth.uid() and activo;
  if v_optica is null then raise exception 'Necesitas iniciar sesión.'; end if;
  if not public._foto_valida(v_optica, nullif(trim(p_foto_url), '')) then raise exception 'La foto no es válida.'; end if;
  update perfiles set foto_url = nullif(trim(p_foto_url), '') where id = auth.uid();
end;
$$;
revoke all on function public.guardar_mi_foto(text) from public, anon;
grant execute on function public.guardar_mi_foto(text) to authenticated;

create or replace function public.guardar_mi_visibilidad_publica(p_mostrar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atiende boolean;
begin
  select coalesce(es_optometra, false) into v_atiende from perfiles where id = auth.uid() and activo;
  if v_atiende is null then raise exception 'Necesitas iniciar sesión.'; end if;
  if p_mostrar and not v_atiende then raise exception 'Solo quien atiende pacientes puede aparecer en la página pública.'; end if;
  update perfiles set mostrar_en_publica = coalesce(p_mostrar, false) where id = auth.uid();
end;
$$;
revoke all on function public.guardar_mi_visibilidad_publica(boolean) from public, anon;
grant execute on function public.guardar_mi_visibilidad_publica(boolean) to authenticated;

-- El administrador puede poner o quitar la foto de alguien de su óptica (no activar «mostrarme»).
create or replace function public.guardar_foto_de(p_perfil uuid, p_foto_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := (select public.optica_id_admin_actual());
begin
  if v_optica is null then raise exception 'Solo el administrador puede cambiar la foto de otra persona.'; end if;
  if not exists (select 1 from perfiles where id = p_perfil and optica_id = v_optica) then raise exception 'Esa persona no pertenece a tu óptica.'; end if;
  if not public._foto_valida(v_optica, nullif(trim(p_foto_url), '')) then raise exception 'La foto no es válida.'; end if;
  update perfiles set foto_url = nullif(trim(p_foto_url), '') where id = p_perfil;
end;
$$;
revoke all on function public.guardar_foto_de(uuid, text) from public, anon;
grant execute on function public.guardar_foto_de(uuid, text) to authenticated;

-- Respaldo a nivel de tabla: «mostrarme» solo lo cambia la propia persona (aunque un administrador pueda editar otros datos de su perfil) y la foto siempre debe ser del almacenamiento de su óptica.
-- Las llamadas sin sesión (migraciones, mantenimiento) no se bloquean.
create or replace function public.perfiles_protege_publica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mostrar_en_publica is distinct from old.mostrar_en_publica and auth.uid() is not null and auth.uid() <> new.id then
    raise exception 'Solo la propia persona puede decidir si aparece en la página pública.';
  end if;
  if new.foto_url is distinct from old.foto_url and not public._foto_valida(new.optica_id, new.foto_url) then
    raise exception 'La foto no es válida.';
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_protege_publica_trigger on public.perfiles;
create trigger perfiles_protege_publica_trigger
  before update of mostrar_en_publica, foto_url on public.perfiles
  for each row execute function public.perfiles_protege_publica();
