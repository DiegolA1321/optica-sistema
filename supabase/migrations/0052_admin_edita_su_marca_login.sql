-- Feedback de Diego (2026-09-08): el admin de una óptica debe poder editar
-- su propia página de login (marca, logo) desde su propio panel, no solo el
-- superadmin vía Superadmin — el ing lo mencionó explícitamente y nunca se
-- construyó. La 0051 bloqueaba marca/logo_url junto con columnas de negocio
-- (nombre, slug, activa, estado_pago, monto_mensual, proximo_vencimiento)
-- porque un admin nunca debe poder cambiar el nombre de su óptica, su slug
-- (dominio), suspenderse a sí mismo o alterar su facturación. marca/logo_url
-- son distintas: son puramente de presentación pública, y el propio admin de
-- esa óptica es quien más contexto tiene para decidir cómo se ve su login.
-- Se relajan esas dos columnas solo para el admin de LA MISMA óptica que se
-- está editando; el resto sigue reservado exclusivamente al superadmin.

create or replace function opticas_bloquea_columnas_reservadas()
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

  if new.nombre is distinct from old.nombre
    or new.slug is distinct from old.slug
    or new.activa is distinct from old.activa
    or new.estado_pago is distinct from old.estado_pago
    or new.monto_mensual is distinct from old.monto_mensual
    or new.proximo_vencimiento is distinct from old.proximo_vencimiento
  then
    raise exception 'Solo el superadministrador puede modificar nombre, slug o estado de la óptica.';
  end if;

  if (new.marca is distinct from old.marca or new.logo_url is distinct from old.logo_url)
    and not exists (
      select 1 from perfiles where id = auth.uid() and rol = 'admin' and optica_id = old.id
    )
  then
    raise exception 'Solo el administrador de esta óptica (o el superadministrador) puede modificar su marca o logo.';
  end if;

  return new;
end;
$$;
