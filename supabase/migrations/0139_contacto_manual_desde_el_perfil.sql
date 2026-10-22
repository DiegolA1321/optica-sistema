-- 0139 — «Enviar mensaje» del perfil del paciente queda en el Seguimiento del CRM (Ronda 3b, punto 4).
--
-- El mensaje que se escribe a mano desde el perfil (por WhatsApp o por correo) no tiene un motivo de aviso: es un contacto libre. Se agrega el motivo «mensaje_manual» a los contactos del CRM
-- y la función registrar_contacto_manual(paciente, canal, mensaje). Pide el permiso «CRM: crear» (el mismo con el que el perfil ofrece el botón «Enviar mensaje») y respeta el permiso del
-- paciente para recibir mensajes (Recordatorios de salud) igual que el CRM. No tiene plantilla propia (el texto lo escribe la persona).
--
-- Revertir: volver la restricción sin 'mensaje_manual' (borrando antes esas filas, solo si el paciente o la óptica ya no existen) y drop function public.registrar_contacto_manual(uuid, text, text).

alter table public.crm_contactos drop constraint crm_contactos_motivo_check;
alter table public.crm_contactos add constraint crm_contactos_motivo_check
  check (motivo in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion',
                    'cita_no_efectuada', 'cita_reagendada', 'lentes_listos', 'medidas_montaje', 'por_vender', 'mensaje_manual'));

create function public.registrar_contacto_manual(p_paciente_id uuid, p_canal text, p_mensaje text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('crear');
  v_p pacientes_base%rowtype;
  v_id uuid;
  v_nombre text := _nombre_de_quien_llama();
begin
  if p_canal not in ('whatsapp', 'correo') then raise exception 'Canal no válido.'; end if;
  select * into v_p from pacientes_base where id = p_paciente_id and optica_id = v_optica and anonimizado_en is null;
  if not found then raise exception 'El paciente no existe.'; end if;
  if not v_p.acepta_recordatorios and not v_p.acepta_promociones then raise exception 'Este paciente no desea recibir mensajes.'; end if;
  insert into crm_contactos (optica_id, paciente_id, motivo, canal, mensaje, creado_por, creado_por_nombre)
  values (v_optica, p_paciente_id, 'mensaje_manual', p_canal, nullif(btrim(p_mensaje), ''), auth.uid(), v_nombre)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.registrar_contacto_manual(uuid, text, text) from public, anon;
grant execute on function public.registrar_contacto_manual(uuid, text, text) to authenticated;
