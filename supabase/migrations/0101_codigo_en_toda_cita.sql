-- Toda cita debe tener su código de seguimiento (CIT-AAAA-XXXXXX), no solo las que agenda el paciente por la web.
-- Hasta ahora el código lo ponía únicamente crear_cita_publica (0058/0067); las citas creadas por el personal en Citas.jsx
-- (agendar, "atender ahora") se guardaban sin código y el detalle no lo mostraba ni se podía buscar por él.
--
-- Mismo formato que ya usa crear_cita_publica: 'CIT-' + año de la fecha de la cita + '-' + los 6 primeros caracteres
-- (mayúsculas) del id. Un trigger lo pone al insertar si viene vacío (no pisa el que ya trae crear_cita_publica ni uno
-- explícito), y se rellenan las citas que hoy lo tienen vacío. El índice único citas_codigo_idx (0058) ya impide repetidos.
--
-- Compatibilidad con el front publicado: no manda `codigo` al crear una cita; ahora lo recibe de la base y lo devuelve la vista.

create or replace function public.poner_codigo_cita()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.codigo is null then
    new.codigo := 'CIT-' || extract(year from new.fecha)::int || '-' || upper(substring(replace(new.id::text, '-', '') from 1 for 6));
  end if;
  return new;
end;
$$;

drop trigger if exists poner_codigo_cita_trigger on public.citas_base;
create trigger poner_codigo_cita_trigger
  before insert on public.citas_base
  for each row execute function public.poner_codigo_cita();

-- Citas que ya existen sin código (solo se toca `codigo`).
update public.citas_base
   set codigo = 'CIT-' || extract(year from fecha)::int || '-' || upper(substring(replace(id::text, '-', '') from 1 for 6))
 where codigo is null;
