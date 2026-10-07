-- 0098 · Solo el administrador principal cambia sus propios roles.
--
-- El administrador principal de la óptica (el primer administrador que se creó) puede asignarse y quitarse roles
-- desde Usuarios ("Mis roles"), sin depender del superadministrador, y así elegir con qué vista entrar. Un
-- administrador que se cree después puede cambiar los roles de los demás, pero no los suyos.
-- Los roles predefinidos siguen sin poder eliminarse (R47): esta migración no los toca.
--
-- Aplicar junto con el código de la rama ajustes-reunion. No cambia datos.

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
