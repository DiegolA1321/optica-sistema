-- Cédula del personal (admin/asistente), única por óptica — evita que la
-- misma persona termine con dos cuentas (Diego, 2026-09-30). Reutiliza el
-- mismo algoritmo de validación que ya usa crear_cita_publica (0067) para
-- pacientes, cedula_ecuatoriana_valida(), en vez de duplicarlo.
--
-- Nullable a propósito: las cuentas ya existentes quedan con cedula = null
-- (no hay forma de rellenarla automáticamente, nadie la registró antes). Se
-- exige solo para cuentas NUEVAS desde el frontend (Usuarios.jsx,
-- SuperadminPanel.jsx); el admin/superadmin puede completarla en las
-- cuentas viejas desde el modal de edición cuando quiera.
--
-- El índice único es parcial (where cedula is not null) para no romper con
-- los nulls existentes ni bloquear cuentas que todavía no la tienen. No
-- protege de verdad a rol='superadmin' (optica_id siempre null: dos filas
-- con optica_id null nunca chocan entre sí en un índice único de Postgres,
-- sin importar la cédula) — hoy solo existe una cuenta así, no es un caso
-- real a cubrir.

alter table public.perfiles
  add column if not exists cedula text;

create unique index if not exists perfiles_cedula_optica_unique
  on public.perfiles (optica_id, cedula)
  where cedula is not null;

create or replace function public.perfiles_valida_cedula()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cedula is not null and not cedula_ecuatoriana_valida(new.cedula) then
    raise exception 'Cédula inválida.';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_valida_cedula_trigger on perfiles;
create trigger perfiles_valida_cedula_trigger
  before insert or update on perfiles
  for each row
  execute function perfiles_valida_cedula();

-- Extiende el trigger de 0053 (perfiles_bloquea_columnas_reservadas): cedula
-- se suma a las columnas reservadas que nadie puede autoeditar. Es una
-- clave de deduplicación, no una preferencia personal como
-- registro_profesional (que sí es autoeditable, 0053) — si se permitiera
-- autoeditarla, cualquier asistente podría cambiarse su propia cédula para
-- esquivar el chequeo de duplicados.
--
-- Partido EXACTO de pg_get_functiondef contra la base real (no de la
-- migración 0053 en el repo) — sin drift, solo se agrega la condición de
-- `cedula` al mismo `if` y se actualiza el mensaje de la excepción.
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
      or new.cedula is distinct from old.cedula
    then
      raise exception 'No puedes modificar tu rol, óptica, permisos, correo, etiqueta o cédula desde tu propio perfil.';
    end if;
  end if;

  return new;
end;
$$;
