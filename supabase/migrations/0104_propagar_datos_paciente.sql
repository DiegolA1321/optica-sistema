-- Editar un paciente (nombre, cédula, teléfono, correo) deja las citas y consultas con la copia vieja.
-- `citas` y `consultas` guardan el nombre del paciente (y la cita, también su cédula, teléfono y correo) como texto: la agenda, las
-- listas y los reportes seguían mostrando el nombre anterior hasta que alguien editaba cada cita. Este trigger copia los datos nuevos a
-- todas las citas y consultas de ese paciente en el momento de guardar la edición.
-- Solo toca las columnas copiadas; no cambia estados, fechas ni nada clínico.

create or replace function public.propagar_datos_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre
     or new.cedula is distinct from old.cedula
     or new.telefono is distinct from old.telefono
     or new.correo is distinct from old.correo then
    update citas_base
       set paciente = new.nombre, cedula = new.cedula, telefono = new.telefono, correo = new.correo
     where paciente_id = new.id
       and (paciente is distinct from new.nombre or cedula is distinct from new.cedula
            or telefono is distinct from new.telefono or correo is distinct from new.correo);
  end if;
  if new.nombre is distinct from old.nombre then
    update consultas_base set paciente = new.nombre where paciente_id = new.id and paciente is distinct from new.nombre;
  end if;
  return new;
end;
$$;

drop trigger if exists propagar_datos_paciente_trigger on public.pacientes_base;
create trigger propagar_datos_paciente_trigger
  after update of nombre, cedula, telefono, correo on public.pacientes_base
  for each row execute function public.propagar_datos_paciente();
