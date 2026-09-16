-- Ajusta el margen de gracia de "No Asistió" automático de 15 a 10 minutos
-- (decisión de Diego, 2026-09-16, reemplaza la de 0071/2026-09-10). Mismo
-- patrón: solo cambia el intervalo dentro de la función — el cron job
-- ('marcar_no_asistio_automatico', cada 5 minutos) sigue igual, así que no
-- hace falta reprogramarlo, solo reemplazar el cuerpo de la función.
create or replace function public.marcar_no_asistio_automatico()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update citas_base
  set estado = 'No Asistió'
  where estado = 'Pendiente'
    and (fecha + to_timestamp(hora, 'HH12:MI AM')::time + interval '10 minutes')
        < (now() at time zone 'America/Guayaquil');
end;
$$;
