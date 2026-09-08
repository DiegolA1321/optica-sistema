-- Hallazgo de seguridad de la "Sexta Mirada" (2026-09-04): la policy RLS
-- opticas_update_own_admin (migración 0001) permite que el admin de una
-- óptica actualice CUALQUIER columna de su propia fila en `opticas` —
-- solo restringe el `id`, no las columnas. La interfaz (SuperadminPanel.jsx)
-- ya respeta el límite y nunca deja que un admin de óptica toque
-- nombre/slug/marca/logo desde la UI, pero eso es solo una capa visual:
-- cualquiera podía llamar la API de PostgREST directo (mismo JWT que ya
-- tiene por estar logueado como admin de su óptica) y reescribir el nombre,
-- el slug, la marca o el logo de su propia óptica — o incluso su estado de
-- pago o si está activa/suspendida, campos que solo el superadmin debe
-- controlar. Mismo patrón que el bug de escalamiento de privilegios
-- corregido en la migración 0029.
--
-- RLS no restringe columnas por sí solo, y GRANT/REVOKE a nivel de columna
-- no sirve aquí porque superadmin y admin de óptica comparten el mismo rol
-- de Postgres (`authenticated`) — la única diferencia está en la fila de
-- `perfiles`. La forma correcta es un trigger BEFORE UPDATE que, cuando
-- quien ejecuta la actualización no es superadmin, verifica que las
-- columnas reservadas no hayan cambiado de valor.
--
-- Columnas que el admin de óptica SÍ debe poder tocar (ya lo hace hoy desde
-- Configuracion.jsx / App.jsx): settings, motivos_consulta,
-- diagnosticos_rapidos, categorias_inventario.
-- Todo lo demás (nombre, slug, logo_url, marca, activa, estado_pago,
-- monto_mensual, proximo_vencimiento) queda reservado al superadmin.

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
    or new.logo_url is distinct from old.logo_url
    or new.marca is distinct from old.marca
    or new.activa is distinct from old.activa
    or new.estado_pago is distinct from old.estado_pago
    or new.monto_mensual is distinct from old.monto_mensual
    or new.proximo_vencimiento is distinct from old.proximo_vencimiento
  then
    raise exception 'Solo el superadministrador puede modificar nombre, slug, marca, logo o estado de la óptica.';
  end if;

  return new;
end;
$$;

drop trigger if exists opticas_restringe_columnas on opticas;
create trigger opticas_restringe_columnas
  before update on opticas
  for each row
  execute function opticas_bloquea_columnas_reservadas();
