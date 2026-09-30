-- Portal del paciente, "Solicitar mis medidas completas" (PortalPaciente.jsx):
-- el botón solo hacía setMedidasSolicitadas(true) en memoria — no llegaba a
-- ningún lado del sistema de la óptica. Diego pidió (2026-09-30) que reutilice
-- un mecanismo existente en vez de inventar uno nuevo.
--
-- Se descartó reutilizar `mensajes`: ese canal es óptica-admin ↔
-- Diego/superadmin (remitente_id referencia perfiles, no pacientes) — meter
-- ahí la solicitud de un paciente la mandaría a la bandeja de soporte de
-- Diego, no al personal de su propia óptica.
--
-- El precedente real es `solicitudes_eliminacion_paciente` (0045): paciente→
-- óptica, RPC con token, banner en el perfil del paciente. Se simplifica acá
-- a una sola columna timestamp (sin tabla aparte) porque no hace falta
-- motivo ni un estado con historial — es un flag reusable: se marca al
-- pedir, se limpia (update normal, sin RPC, la RLS de staff ya permite
-- escribir pacientes) al atenderla.
--
-- pacientes_base se edita a través de la vista `pacientes` con triggers
-- "instead of" (0067) — hay que propagar la columna nueva a la vista y a los
-- dos triggers de escritura. Extraído en vivo con pg_get_viewdef/
-- pg_get_functiondef contra la base real antes de escribir esta migración
-- (idéntico a como quedó en 0077 — sin drift).

alter table public.pacientes_base
  add column if not exists medidas_solicitadas_en timestamptz;

create or replace view public.pacientes
with (security_invoker = true)
as
select
  pb.id, pb.optica_id, pb.nombre, pb.cedula, pb.telefono, pb.correo, pb.fecha_nacimiento,
  pb.ultima_consulta,
  descifrar_clinico(pb.estado_clinico_enc) as estado_clinico,
  pb.referido_por,
  descifrar_clinico(pb.evolucion_enc) as evolucion,
  descifrar_clinico(pb.estado_correccion_enc) as estado_correccion,
  pb.fecha_registro, pb.tiene_cuenta, pb.usuario, pb.clave_temporal,
  pb.created_at, pb.updated_at, pb.sesion_token, pb.ultimo_saludo_cumple_anio,
  pb.intentos_fallidos, pb.bloqueado_hasta, pb.referido_por_id, pb.origen,
  pb.confirmado_recepcion, pb.medidas_solicitadas_en
from pacientes_base pb;

create or replace function public.pacientes_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into pacientes_base (
    optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta,
    estado_clinico_enc, referido_por, referido_por_id, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta, origen,
    confirmado_recepcion, medidas_solicitadas_en
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta,
    coalesce(new.origen, 'staff'),
    coalesce(new.confirmado_recepcion, coalesce(new.origen, 'staff') = 'staff'),
    new.medidas_solicitadas_en
  )
  returning id into v_id;

  select * into new from pacientes where id = v_id;
  return new;
end;
$$;

create or replace function public.pacientes_instead_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update pacientes_base set
    optica_id = new.optica_id,
    nombre = new.nombre,
    cedula = new.cedula,
    telefono = new.telefono,
    correo = new.correo,
    fecha_nacimiento = new.fecha_nacimiento,
    ultima_consulta = new.ultima_consulta,
    estado_clinico_enc = cifrar_clinico(new.estado_clinico),
    referido_por = new.referido_por,
    referido_por_id = new.referido_por_id,
    evolucion_enc = cifrar_clinico(new.evolucion),
    estado_correccion_enc = cifrar_clinico(new.estado_correccion),
    fecha_registro = new.fecha_registro,
    tiene_cuenta = new.tiene_cuenta,
    usuario = new.usuario,
    clave_temporal = new.clave_temporal,
    updated_at = new.updated_at,
    sesion_token = new.sesion_token,
    ultimo_saludo_cumple_anio = new.ultimo_saludo_cumple_anio,
    intentos_fallidos = new.intentos_fallidos,
    bloqueado_hasta = new.bloqueado_hasta,
    origen = coalesce(new.origen, old.origen),
    confirmado_recepcion = coalesce(new.confirmado_recepcion, old.confirmado_recepcion),
    medidas_solicitadas_en = new.medidas_solicitadas_en
  where id = old.id;
  return new;
end;
$$;

-- El paciente la llama desde su portal — mismo patrón de token que
-- cancelar_cita_publica/reagendar_cita_publica, reutilizando el helper
-- centralizado de validación de sesión (0063) en vez de repetir el chequeo.
create or replace function public.solicitar_medidas_paciente(
  p_paciente_id uuid,
  p_token text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  update pacientes set medidas_solicitadas_en = now() where id = p_paciente_id;
  return true;
end;
$$;

revoke all on function public.solicitar_medidas_paciente(uuid, text) from public;
grant execute on function public.solicitar_medidas_paciente(uuid, text) to anon;
