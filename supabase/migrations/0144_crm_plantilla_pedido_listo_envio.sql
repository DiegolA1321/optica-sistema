-- 0144 — Plantilla propia para «Pedido listo (envío)» (Ronda 5, punto 9: plantillas del CRM).
--
-- Hasta ahora «Pedido listo» era un solo motivo (lentes_listos) con una variable {entrega} que decía «retíralo» o «te lo enviaremos». El diseño aprobado de Plantillas del CRM
-- lista «Pedido listo (retira)» y «Pedido listo (envío)» como dos motivos con su propio texto editable. Se agrega el motivo lentes_listos_envio:
--
--   1. crm_contactos y crm_plantillas aceptan el motivo nuevo (el contacto de un aviso de envío queda en el Seguimiento con su nombre).
--   2. guardar_plantilla_crm lo acepta (misma firma: create or replace, sin overload).
--   3. registrar_contacto_de_aviso lo trata como los demás pedidos: pide el permiso de Ventas (misma firma: create or replace).
--
-- Qué NO cambia: ningún dato existente (lentes_listos sigue siendo el de quien retira; lo que una óptica personalizó sigue valiendo para él), ninguna política ni permiso.
-- Una óptica nueva no necesita nada: sin fila en crm_plantillas, el texto sale del código (la plantilla de fábrica de cada motivo).
--
-- Revertir: volver a poner las dos restricciones sin 'lentes_listos_envio' (borrando antes las filas que lo usen) y recrear las dos funciones con su cuerpo de 0135.

alter table public.crm_contactos drop constraint crm_contactos_motivo_check;
alter table public.crm_contactos add constraint crm_contactos_motivo_check
  check (motivo in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion',
                    'cita_no_efectuada', 'cita_reagendada', 'lentes_listos', 'lentes_listos_envio', 'medidas_montaje', 'por_vender', 'mensaje_manual'));

alter table public.crm_plantillas drop constraint crm_plantillas_motivo_check;
alter table public.crm_plantillas add constraint crm_plantillas_motivo_check
  check (motivo in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion',
                    'cita_no_efectuada', 'cita_reagendada', 'lentes_listos', 'lentes_listos_envio', 'medidas_montaje', 'por_vender'));

create or replace function public.guardar_plantilla_crm(p_motivo text, p_texto text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('editar');
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if p_motivo is null or p_motivo not in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion',
                                          'cita_no_efectuada', 'cita_reagendada', 'lentes_listos', 'lentes_listos_envio', 'medidas_montaje', 'por_vender') then
    raise exception 'Motivo no válido.';
  end if;
  if v_texto = '' then
    delete from crm_plantillas where optica_id = v_optica and motivo = p_motivo;
    return;
  end if;
  if char_length(v_texto) < 10 then
    raise exception 'El mensaje es muy corto (mínimo 10 letras).';
  end if;
  if char_length(v_texto) > 500 then
    raise exception 'El mensaje es demasiado largo (máximo 500 caracteres).';
  end if;
  insert into crm_plantillas (optica_id, motivo, texto, actualizada_por_nombre)
  values (v_optica, p_motivo, v_texto, _nombre_de_quien_llama())
  on conflict (optica_id, motivo) do update set texto = excluded.texto, actualizada_por_nombre = excluded.actualizada_por_nombre, actualizada_en = now();
end;
$function$;

create or replace function public.registrar_contacto_de_aviso(p_paciente_id uuid, p_motivo text, p_mensaje text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_p pacientes_base%rowtype;
  v_modulo text;
  v_id uuid;
  v_nombre text := _nombre_de_quien_llama();
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;

  -- El permiso es el del módulo donde vive el aviso.
  v_modulo := case p_motivo
    when 'control_vencido' then 'pacientes'
    when 'medidas_montaje' then 'pacientes'
    when 'cita_no_efectuada' then 'citas'
    when 'cita_reagendada' then 'citas'
    when 'lentes_listos' then 'ventas'
    when 'lentes_listos_envio' then 'ventas'
    when 'por_vender' then 'ventas'
  end;
  if v_modulo is null then raise exception 'Motivo no válido.'; end if;
  if not tiene_permiso(v_modulo, 'ver') then raise exception 'No tienes permiso para esta acción.'; end if;

  select * into v_p from pacientes_base where id = p_paciente_id and optica_id = v_optica and anonimizado_en is null;
  if not found then raise exception 'El paciente no existe.'; end if;

  -- Los mensajes comerciales respetan «Recordatorios de salud»; los del servicio que el paciente ya pidió o recibe (su cita, sus lentes, sus medidas) no.
  if p_motivo in ('control_vencido', 'por_vender') and not v_p.acepta_recordatorios then
    raise exception '%', case when not v_p.acepta_promociones then 'Este paciente no desea recibir mensajes.' else 'Este paciente no aceptó recibir recordatorios de salud.' end;
  end if;

  insert into crm_contactos (optica_id, paciente_id, motivo, canal, mensaje, creado_por, creado_por_nombre)
  values (v_optica, p_paciente_id, p_motivo, 'whatsapp', nullif(btrim(p_mensaje), ''), auth.uid(), v_nombre)
  returning id into v_id;
  return v_id;
end;
$function$;
