-- Bug real encontrado probando en vivo: confirmar_asistencia_cita devolvía
-- `found` de un `update ... where confirmada_at is null` — así que la
-- SEGUNDA vez que se visita el mismo link (React StrictMode dispara el
-- efecto dos veces en desarrollo; en producción, escáneres de seguridad de
-- correo como Outlook Safe Links pre-visitan los links de los emails antes
-- de que el usuario haga clic) devolvía false, y la pantalla mostraba "No
-- pudimos confirmar" aunque la cita SÍ había quedado confirmada en la
-- primera visita. Se redefine para que sea idempotente de verdad desde la
-- perspectiva de quien llama: éxito si la cita existe, sin importar si ya
-- estaba confirmada; solo falla si el id no corresponde a ninguna cita.

create or replace function public.confirmar_asistencia_cita(
  p_cita_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update citas set confirmada_at = coalesce(confirmada_at, now()) where id = p_cita_id;
  return found;
end;
$$;
