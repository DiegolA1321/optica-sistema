-- Punto 01 del Diagnóstico Maestro: auto-marcar "No Asistió" tras un margen
-- de gracia. Decisión de Diego (2026-09-10): 15 minutos tras la hora de la
-- cita; el aviso es solo visual (el badge rojo "No asistió" que ya existe en
-- Citas.jsx/CRM/Reportes — no se agrega ningún correo).
--
-- No se crea ningún estado ni badge nuevo: esta función solo hace lo mismo
-- que ya hace "Marcar No Asistió" a mano en Citas.jsx (poner
-- citas.estado = 'No Asistió'), pero automáticamente cuando el margen de
-- gracia se cumple y nadie la marcó "En Atención"/"Atendida"/"Cancelada"
-- antes. Como el estado es la misma columna que ya consume todo el sistema
-- (badge en Citas, "Tendencia de inasistencias" en Reportes, CRM), no hace
-- falta tocar ningún módulo de UI — es una sola fuente de verdad.
--
-- Arquitectura: mismo patrón que 0031 (recordatorios) — pg_cron corre una
-- función SECURITY DEFINER directo en la base, sin servidor aparte.
--
-- Solo compara contra citas 'Pendiente': una cita ya 'En Atención' significa
-- que alguien la está atendiendo ahora mismo y no debe tocarse aunque el
-- horario nominal ya haya pasado.
create extension if not exists pg_cron;

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
    and (fecha + to_timestamp(hora, 'HH12:MI AM')::time + interval '15 minutes')
        < (now() at time zone 'America/Guayaquil');
end;
$$;

select cron.schedule(
  'marcar_no_asistio_automatico',
  '*/5 * * * *', -- cada 5 minutos
  $$select public.marcar_no_asistio_automatico()$$
);
