-- 0147 — «Quitar alguno» al crear una campaña del CRM (Ronda 5, rediseño del CRM).
--
-- Al preparar una campaña se ve a quiénes se les enviará (con un dato útil de cada uno) y se puede quitar a alguno. Esa lista de quitados tiene que guardarse con la campaña: si no, al abrirla
-- volverían a aparecer. crm_campanas gana `excluidos` (los ids de los pacientes que se quitaron) y crear_campana_crm los recibe (un parámetro nuevo, con valor por defecto: quien la llama sin él, o
-- una pantalla anterior, crea la campaña como siempre, sin quitados).
--
--   · La función vieja (3 parámetros) se borra antes de crear la nueva: con `create or replace` quedarían dos funciones con el mismo nombre (el gotcha de las sobrecargas).
--   · Solo se guardan ids de pacientes de la misma óptica; cualquier otro se descarta.
--
-- Qué NO cambia: ninguna campaña existente (nace con la lista vacía de quitados: reciben lo de siempre), ninguna política ni permiso (crear sigue pidiendo «CRM: crear»).
-- Una óptica nueva no necesita nada.
--
-- Revertir: drop function public.crear_campana_crm(text, text, text, uuid[]); recrear la de 0114 (3 parámetros); alter table public.crm_campanas drop column excluidos.

alter table public.crm_campanas add column excluidos uuid[] not null default '{}';

drop function public.crear_campana_crm(text, text, text);

create function public.crear_campana_crm(p_nombre text, p_grupo text, p_mensaje text, p_excluidos uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('crear');
  v_id uuid;
  v_excluidos uuid[];
begin
  if p_grupo is null or p_grupo not in ('control_vencido', 'sin_visitar', 'cumpleanos_mes', 'promociones') then
    raise exception 'Grupo no válido.';
  end if;
  if char_length(btrim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe un nombre para la campaña (mínimo 3 letras).';
  end if;
  if char_length(btrim(coalesce(p_mensaje, ''))) < 10 then
    raise exception 'Escribe el mensaje (mínimo 10 letras).';
  end if;
  if char_length(btrim(p_mensaje)) > 500 then
    raise exception 'El mensaje es demasiado largo (máximo 500 caracteres).';
  end if;
  select coalesce(array_agg(p.id), '{}') into v_excluidos from pacientes_base p where p.optica_id = v_optica and p.id = any (coalesce(p_excluidos, '{}'));
  insert into crm_campanas (optica_id, nombre, grupo, mensaje, creada_por, creada_por_nombre, excluidos)
  values (v_optica, btrim(p_nombre), p_grupo, btrim(p_mensaje), auth.uid(), _nombre_de_quien_llama(), v_excluidos)
  returning id into v_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), _nombre_de_quien_llama(), 'crm', 'Creó una campaña', btrim(p_nombre) || case when cardinality(v_excluidos) > 0 then ' · sin ' || cardinality(v_excluidos) || ' paciente' || case when cardinality(v_excluidos) = 1 then '' else 's' end else '' end);
  return v_id;
end;
$function$;
revoke all on function public.crear_campana_crm(text, text, text, uuid[]) from public, anon;
grant execute on function public.crear_campana_crm(text, text, text, uuid[]) to authenticated;
