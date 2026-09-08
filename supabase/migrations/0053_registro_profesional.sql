-- Hallazgo real de una auditoría en vivo (2026-09-08): la receta impresa
-- siempre deja en blanco "Reg. Prof. ____________" (ConsultaMedica.jsx) —
-- no existe en ningún lado un campo para el número de registro profesional
-- del optómetra/licenciado. Solo había un booleano puramente informativo
-- (es_optometra, migración 0048: "¿el admin es también el optómetra?").
-- Una receta óptica sin ese número pierde validez formal frente a otro
-- proveedor — hueco real, no cosmético.

alter table perfiles add column if not exists registro_profesional text;

-- Hasta ahora NADIE podía editar su propia fila en perfiles por RLS (solo
-- superadmin, o un admin editando a SUS asistentes vía
-- perfiles_admin_gestiona_asistentes de la 0017) — ni siquiera para poner su
-- propio número de registro desde "Mi cuenta". Se agrega autoedición, pero
-- restringida por columna con el mismo patrón que opticas_bloquea_columnas_
-- reservadas (0051/0052): nunca el propio rol, óptica, permisos, correo o
-- etiqueta — eso sigue exclusivo de quien administra la cuenta.
create policy perfiles_update_self on perfiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function perfiles_bloquea_columnas_reservadas()
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
  -- un asistente por su admin es una fila distinta y no pasa por acá — sigue
  -- permitiendo nombre/permisos/etiqueta_rol como ya hacía Usuarios.jsx.
  if old.id = auth.uid() then
    if new.rol is distinct from old.rol
      or new.optica_id is distinct from old.optica_id
      or new.permisos is distinct from old.permisos
      or new.email is distinct from old.email
      or new.es_optometra is distinct from old.es_optometra
      or new.etiqueta_rol is distinct from old.etiqueta_rol
    then
      raise exception 'No puedes modificar tu rol, óptica, permisos, correo o etiqueta desde tu propio perfil.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_restringe_columnas on perfiles;
create trigger perfiles_restringe_columnas
  before update on perfiles
  for each row
  execute function perfiles_bloquea_columnas_reservadas();
