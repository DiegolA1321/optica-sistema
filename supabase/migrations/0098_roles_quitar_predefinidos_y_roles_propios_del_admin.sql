-- 0098 · Roles: se pueden quitar los predefinidos, y solo el administrador principal cambia sus propios roles.
--
-- 1) Los roles predefinidos (Optómetra, Recepción, Ventas) ya se pueden eliminar. Un rol con personas asignadas
--    sigue sin poder eliminarse (la clave foránea de perfil_roles lo impide). Quien los quite puede recuperar los que
--    falten con restaurar_roles_predefinidos_faltantes(), que los vuelve a crear con sus valores originales.
-- 2) El administrador principal de la óptica (el primer administrador que se creó) puede asignarse y quitarse roles
--    desde Usuarios, sin depender del superadministrador, y así elegir con qué vista entrar. Un administrador que se
--    cree después puede cambiar los roles de los demás, pero no los suyos.
--
-- Aplicar junto con el código de la rama ajustes-reunion. No cambia datos.

-- 1) Roles predefinidos eliminables
drop trigger if exists roles_protege_predefinidos_trigger on public.roles;
drop function if exists public.roles_protege_predefinidos();

create or replace function public.restaurar_roles_predefinidos_faltantes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_id_admin_actual();
  v_antes integer;
  v_despues integer;
begin
  if v_optica is null then
    raise exception 'Solo el administrador de la óptica puede restaurar los roles predefinidos.';
  end if;
  if not optica_activa_actual() or not mfa_satisfecho() then
    raise exception 'No tienes acceso para hacer este cambio.';
  end if;
  select count(*) into v_antes from roles where optica_id = v_optica and es_predefinido;
  perform crear_roles_predefinidos(v_optica);
  select count(*) into v_despues from roles where optica_id = v_optica and es_predefinido;
  return v_despues - v_antes;
end;
$$;
revoke all on function public.restaurar_roles_predefinidos_faltantes() from public, anon;
grant execute on function public.restaurar_roles_predefinidos_faltantes() to authenticated;

-- 2) Cambiar los propios roles: solo el administrador principal
create or replace function public.perfil_roles_cambio_propio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid := coalesce(new.perfil_id, old.perfil_id);
  v_actor uuid := auth.uid();
  v_rol text;
  v_optica uuid;
  v_principal uuid;
begin
  -- Solo importa cuando alguien cambia sus propios roles (los procesos internos y el superadministrador no entran aquí).
  if v_actor is null or v_actor <> v_perfil then
    return coalesce(new, old);
  end if;
  select rol, optica_id into v_rol, v_optica from perfiles where id = v_perfil;
  if v_rol is distinct from 'admin' then
    return coalesce(new, old);
  end if;
  select id into v_principal from perfiles where optica_id = v_optica and rol = 'admin' order by created_at, id limit 1;
  if v_principal is distinct from v_perfil then
    raise exception 'Solo el administrador principal puede cambiar sus propios roles.';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function public.perfil_roles_cambio_propio() from public, anon, authenticated;

drop trigger if exists perfil_roles_cambio_propio_trigger on public.perfil_roles;
create trigger perfil_roles_cambio_propio_trigger before insert or delete on public.perfil_roles
  for each row execute function public.perfil_roles_cambio_propio();

-- La pantalla de Usuarios pregunta si quien la mira es el administrador principal, para ofrecer (o no) "Mis roles".
create or replace function public.soy_administrador_principal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles p
     where p.id = auth.uid() and p.rol = 'admin'
       and p.id = (select id from perfiles where optica_id = p.optica_id and rol = 'admin' order by created_at, id limit 1)
  );
$$;
revoke all on function public.soy_administrador_principal() from public, anon;
grant execute on function public.soy_administrador_principal() to authenticated;
