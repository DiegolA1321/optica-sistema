-- 0137 — Las plantillas del CRM las lee todo el personal que escribe desde un aviso (Ronda 3a, punto 4).
--
-- Los avisos del Inicio, de Citas, de Pacientes y de Ventas abren WhatsApp con la plantilla que la óptica personalizó en el CRM. La tabla crm_plantillas solo la lee quien tiene
-- «CRM: ver»; recepción o ventas pueden no tenerlo y entonces escribirían con el mensaje base, ignorando lo que la óptica personalizó. Esta función entrega SOLO los textos de las
-- plantillas (nada de contactos ni de pacientes) a cualquier persona activa del personal de esa óptica.
--
-- Revertir: drop function public.plantillas_de_avisos();

create or replace function public.plantillas_de_avisos()
returns table(motivo text, texto text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  return query select t.motivo, t.texto from crm_plantillas t where t.optica_id = v_optica;
end;
$function$;
revoke all on function public.plantillas_de_avisos() from public, anon;
grant execute on function public.plantillas_de_avisos() to authenticated;
