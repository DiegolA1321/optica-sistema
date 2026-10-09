-- Toda cita debe tener su código de seguimiento (CIT-AAAA-XXXXXX), no solo las que agenda el paciente por la web.
-- Hasta ahora el código lo ponía únicamente crear_cita_publica (0058/0067); las citas creadas por el personal en Citas.jsx
-- (agendar, "atender ahora") se guardaban sin código y el detalle no lo mostraba ni se podía buscar por él.
--
-- Mismo formato que ya usa crear_cita_publica: 'CIT-' + año de la fecha de la cita + '-' + los 6 primeros caracteres
-- (mayúsculas) del id. Un trigger lo pone al insertar si viene vacío (no pisa el que ya trae crear_cita_publica ni uno
-- explícito) y se rellenan las citas que hoy lo tienen vacío.
--
-- UNICIDAD: el código es único. El índice único (el de 0058, que ignora los vacíos) se asegura aquí con `if not exists`, y el
-- generador, si el código que le toca ya existe, prueba con más caracteres del id (7, 8, … 32) y, como último recurso, con
-- un trozo de md5 aleatorio. Así nunca se repite ni falla un insert por una coincidencia.
--
-- Compatibilidad con el front publicado: no manda `codigo` al crear una cita; ahora lo recibe de la base y lo devuelve la vista.

create unique index if not exists citas_codigo_idx on public.citas_base (codigo) where codigo is not null;

create or replace function public.generar_codigo_cita(p_id uuid, p_fecha date)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_hex text := upper(replace(p_id::text, '-', ''));
  v_base text := 'CIT-' || extract(year from p_fecha)::int || '-';
  v_codigo text;
  v_largo int;
begin
  for v_largo in 6..32 loop
    v_codigo := v_base || substring(v_hex from 1 for v_largo);
    if not exists (select 1 from citas_base where codigo = v_codigo) then
      return v_codigo;
    end if;
  end loop;
  loop
    v_codigo := v_base || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    if not exists (select 1 from citas_base where codigo = v_codigo) then
      return v_codigo;
    end if;
  end loop;
end;
$$;

create or replace function public.poner_codigo_cita()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.codigo is null then
    new.codigo := generar_codigo_cita(new.id, new.fecha);
  end if;
  return new;
end;
$$;

drop trigger if exists poner_codigo_cita_trigger on public.citas_base;
create trigger poner_codigo_cita_trigger
  before insert on public.citas_base
  for each row execute function public.poner_codigo_cita();

-- Citas que ya existen sin código (solo se toca `codigo`), una por una para que cada código nuevo cuente para el siguiente.
do $$
declare
  r record;
begin
  for r in select id, fecha from public.citas_base where codigo is null order by created_at loop
    update public.citas_base set codigo = public.generar_codigo_cita(r.id, r.fecha) where id = r.id;
  end loop;
end;
$$;
